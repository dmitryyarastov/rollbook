# Sync

Background sync of localStorage state to Supabase over raw PostgREST `fetch` — no supabase-js, no auth. **localStorage (`rollbook:v1`) is the UI's source of truth; sync is a convenience layer that must never be able to lose or corrupt local data.** Remote is untrusted (the anon key in `src/config.ts` is public-by-design and anyone can INSERT/UPDATE), so every pulled row passes through a sanitizing mapper, and remote is never authoritative for deletions. See [architecture.md](architecture.md) for where sync sits in the app, [data-model.md](data-model.md) for the types, [operations.md](operations.md) for the Supabase side.

Code lives in exactly two files:

- `src/sync.ts` — pure mapping/merge functions plus a thin fetch shell (`pullAll`, `pushAll`). No React.
- `src/useSync.ts` — `useSync` hook: all scheduling (triggers, debounce, status). No fetch logic.

Keep that split. Everything in `src/sync.ts` is unit-testable with a stub fetch (`src/sync.test.ts` — `stubFetch`); `useSync` stays thin enough to review by eye.

## Why the blind full-table push is safe (load-bearing invariant)

`src/sync.ts` — `pushAll` upserts **every** local non-demo session and competition on every push, with `Prefer: resolution=merge-duplicates` and `on_conflict=id`. It never pulls first. This is only correct because **sessions and competitions are append-only per id by design**: a row, once created, is never edited or deleted in the UI, so a stale device re-upserting its copy writes back byte-identical data. **If you ever add an edit or delete feature for sessions or competitions, this invariant breaks** — a device that has been offline will overwrite a newer edit with its stale copy. The required change is a pull-before-every-push (merge, then push the merged result), not a smarter payload. The header comment in `src/sync.ts` says the same thing; keep both in agreement.

Payload size is a non-issue for years: ~500 sessions ≈ 150 KB. PostgREST caps GET responses at 1000 rows; the pull orders `updated_at.desc` so a hypothetical overflow drops the *oldest* rows, not the newest.

## The two LWW clocks

There are two independent last-write-wins mechanisms; do not conflate them.

| Clock | Scope | Field | Tie behavior | Zero value |
|---|---|---|---|---|
| Per-row | each `Session` / `Competition` | `updatedAt` (epoch ms locally, `updated_at` timestamptz remotely) | strictly-newer remote wins; **ties keep local** | n/a — always set at creation |
| Single blob | `focus` + `tagList` + `settings` together | `AppData.stateUpdatedAt` | remote adopted only if strictly newer | `0` = "never touched locally" |

`stateUpdatedAt === 0` gates the `app_state` push in `pushAll`: a fresh install that has never edited focus/tags/settings must not overwrite the remote blob with defaults. Every call site that mutates focus/tagList/settings must stamp `stateUpdatedAt: Date.now()` in the same `update()` (see `src/App.tsx` — `addTag`, `setFocus`); a mutation without the stamp will never sync.

Timestamps are **app-authoritative**: `supabase-schema.sql` deliberately has no `now()` defaults or triggers on `updated_at` — a DB trigger would corrupt LWW for offline-delayed pushes (a Monday edit pushed Wednesday must not beat a Tuesday edit). If you hand-edit rows in the SQL editor, set `updated_at = now()` yourself or devices will never pick the change up.

## Pull cycle

`src/useSync.ts` — `useSync(data, update)` runs `cycle()` = pull → merge → push-back. Triggers:

1. **Launch** — once per real mount, guarded by a `started` ref that survives React StrictMode's simulated remount (dev double-invoke). Cleanup deliberately does **not** abort the in-flight pull — StrictMode cleanup would cancel the only pull; `AbortSignal.timeout(10_000)` in the IO layer is the sole cancellation.
2. **`online` event** — regaining connectivity.
3. **`visibilitychange` → visible** — throttled to at most once per 60 s (`VISIBILITY_MIN_GAP_MS`, tracked in `lastCycleAt`). This is the "switched devices" moment: an installed PWA resumed from the background does not re-run launch, so this is the only trigger that pulls another device's writes mid-day.

### Merge INSIDE the functional updater (do not refactor this away)

```ts
pullAll().then((remote) => {
  update((d) => mergeAppData(d, remote))
  requestPush()
}, fail)
```

The merge runs against `d`, the state **at updater-execution time** — not the state captured when the pull started. A session saved while the pull was in flight is present in `d` and survives via mergeById's "local-only rows always kept" rule. Computing `mergeAppData(dataSnapshot, remote)` outside the updater and calling `update(() => merged)` would clobber exactly those concurrent saves. Any refactor of `useSync` or the `update` API must preserve this.

After the merge, `cycle` calls `requestPush()` so anything remote was missing (rows created offline) is pushed back — the pull/push pair converges both directions.

## Push

`src/useSync.ts` — `requestPush()` is a **2-second trailing debounce** (`PUSH_DEBOUNCE_MS`): each call clears and re-arms the timer, so a burst of saves collapses into one push that reads `dataRef.current` (a ref kept current by an every-render effect) at *fire* time — never a stale closure. Failures do not retry; the next trigger (another save, `online`, visibility) is the retry.

Call sites in `src/App.tsx`: `saveSession`, `saveComp`, `addTag`, `setFocus` — each calls `requestPush()` immediately after its `update()`. **Any new mutation of synced data must call `requestPush()`** or it syncs only at the next cycle trigger.

`src/sync.ts` — `pushAll(d, fetch)` sends up to three POSTs in parallel:

- `sessions?on_conflict=id` — all local sessions passing `isPushable`, mapped by `toRow`. Skipped if none.
- `app_state?on_conflict=user_id` — the `{focus, tagList, settings}` blob, **only when `stateUpdatedAt > 0`**.
- `competitions?on_conflict=id` — all local comps passing `isPushable`, mapped by `toCompRow`. Skipped if none; tracked outside the strict list for 404 tolerance (below).

All with `Prefer: resolution=merge-duplicates,return=minimal`. `isPushable` (`src/sync.ts`) excludes any id starting with `demo-`: demo seed data (`src/demo.ts`) is a local plaything and never syncs in either direction.

## mergeById semantics

`src/sync.ts` — `mergeById<T extends Mergeable>` is one generic used by both `mergeSessions` and `mergeCompetitions` **so session and competition merge semantics can never drift** — do not fork it. Rules, per id:

1. Strictly-newer remote (`r.updatedAt > l.updatedAt`) replaces local; **ties keep local** (so a re-pull of your own push is a no-op).
2. Remote-only rows are appended, sorted by `date` asc then `createdAt` asc (string compare on the yyyy-mm-dd date — correct, and no JS `Date` involved).
3. Local-only rows are **always kept** — remote is not authoritative for deletions; a tampered/emptied remote table can never erase local history. (A real hand-tampered `demo-99` row was once found in the DB and was invisible in-app because of the demo filter + this rule.)
4. Remote `demo-` rows are filtered out via `isPushable` before merging.
5. **Same-reference bailout**: when nothing changed, the function returns the original `local` array reference so React state updates bail out and no re-render/persist happens on every 60 s visibility pull.

`mergeAppData` composes the two merges plus the state-blob adoption. Two coupling rules here, both covered by tests in `src/sync.test.ts`:

- The bailout condition must check **sessions AND competitions AND state adoption**: `if (sessions === d.sessions && competitions === d.competitions && !adopt) return d`. Forgetting one term makes every pull a spurious state update.
- **Both** return branches (state adopted / not adopted) must spread **both** `sessions` and `competitions`. The historical bug shape is adopting remote state but dropping pulled competitions in that branch — the test "adopts pulled competitions in both state branches" pins this.

## Sanitizers (pull side)

With no auth, every remote row is attacker-writable, so `pullAll` maps everything through sanitizers before it can reach state or stats. Rule of thumb encoded in all three: **structurally unusable → drop the row (`null`); fixable → clamp to a sane default.** Junk rows in the response array are silently filtered out.

`fromRow` (sessions):

| Field | Rule |
|---|---|
| `id` | non-empty string, else **drop row** |
| `date` | `/^\d{4}-\d{2}-\d{2}$/`, else **drop row** (verbatim string, never through `Date`) |
| `created_at`, `updated_at` | `Date.parse`-able string, else **drop row** |
| `title` | string, else `''` |
| `gi` | `=== true`, else `false` |
| `rolls`, `subs_for`, `subs_against` | `count()`: number-coerced, rounded, floored at 0 |
| `round_min` | must be in `[4, 5, 6, 8]` (`ROUND_MINS`), else `5` |
| `tags` | array filtered to string members, else `[]` |
| `time` | string matching `/^([01]\d|2[0-3]):[0-5]\d$/`, else `null` |

`fromCompRow` (competitions): same id/date/timestamp drop rules; `title` defaults to `'Competition'`, `cardio` must be in 0–5 (`CARDIO_RATINGS`) else `0`, `worked_well`/`didnt_work` default `''`, and `matches` goes through `sanitizeMatches`:

- non-array → `[]`; list truncated at **`MAX_MATCHES = 50`**;
- entry with `outcome` not in `['win','loss','draw']` → **entry dropped** (outcome is semantically essential, no sane default);
- `myPoints`/`theirPoints` → `count()` capped at **`MAX_POINTS = 1000`**; `submission` → trimmed string else `''`.

The caps matter: `matches` is a jsonb column and `supabase-schema.sql` only checks `jsonb_typeof(matches) = 'array'` — **these client caps are the only per-field enforcement the jsonb ever gets** (unlike sessions, where the SQL CHECK constraints mirror the TS ranges). Matches live as jsonb *on* the competitions row rather than in a child table because anon cannot DELETE: child rows could never be reconciled, so the whole competition is the atomic LWW unit.

`fromStateRow` (app_state): drops the row only on an unparsable `updated_at`; every field inside the blob falls back per-field to `emptyData()` defaults (`src/store.ts`). Note `tagList` falls back when the remote list is empty, not just malformed.

## Error tolerance matrix

| Request | Failure | Behavior | Why |
|---|---|---|---|
| pull `competitions` | **404 exactly** | tolerated → `[]`, sessions/state still merge | table may postdate this build — the SQL addendum in `supabase-schema.sql` not yet run; comps stay local until it is |
| push `competitions` | **404 exactly** | tolerated, push counts as success | same; comps upload on the first push after the owner runs the addendum |
| pull/push `competitions` | any other non-ok | throw → `fail()` | real outage |
| pull/push `sessions`, `app_state` | any non-ok | throw → `fail()` | strict |
| any request | > 10 s | `AbortSignal.timeout` rejects → `fail()` | paused Supabase project hangs otherwise |

A missing **column** on an existing table is deliberately loud, not tolerated: PostgREST answers **400 (PGRST204)** when a pushed payload names an unknown column. That 400 fails the whole push and shows "sync error". This is by design — it forces the ALTER-before-deploy ordering below rather than silently dropping data.

## SyncStatus lifecycle

`src/sync.ts` — `type SyncStatus = 'disabled' | 'syncing' | 'synced' | 'offline' | 'error'`.

- Initial: `'disabled'` when `SYNC_ENABLED` is false (`src/config.ts` — empty URL/key turns the whole feature off; a fresh clone runs local-only), else `'syncing'`.
- Every cycle/push start → `'syncing'`; success → `'synced'`; failure → `fail()` picks `'offline'` vs `'error'` by `navigator.onLine`.
- Rendered only on the Home screen (`src/screens/Home.tsx` — `SYNC_LABELS`); `disabled` maps to `null` (nothing shown). `'offline'` reads "offline — will sync", which is honest: the `online` trigger will fire a cycle.

## Playbook: adding a synced field to sessions

Whitelisted value sets are **triple-declared** — TS union, pull-sanitizer whitelist, SQL CHECK — and all three must accept/reject identically (e.g. `RoundMin` `4|5|6|8`; the `time` regex in `fromRow` and the SQL `~` check are the same automaton). Follow all steps; the recent `time` column (`src/types.ts` / `supabase-schema.sql` addendum "Session start time") is the worked example.

1. **`src/types.ts`** — add the field to `Session` (union type if it's an enum).
2. **`src/store.ts` — `load`** — default the field for pre-existing localStorage blobs (as `time: typeof s.time === 'string' ? s.time : null` does).
3. **`src/sync.ts`** — extend `SessionRow`, `toRow`, and `fromRow` (sanitizer rule: drop-row vs clamp, matching the table above).
4. **`supabase-schema.sql`** — append a new delimited, **idempotent** addendum section (`alter table … add column if not exists`, plus a CHECK mirroring the TS/sanitizer whitelist). Never edit earlier sections — they are a run history. The anon key cannot DDL; the owner pastes the section into the Supabase SQL editor by hand.
5. **Ordering: run the ALTER before deploying the build that pushes the column.** A push from the new build against the old schema is a 400 (PGRST204) and sync goes loud-red until the ALTER runs. Pushing to `main` deploys (GitHub Pages), so: run SQL first, then push the commit.
6. **`src/sync.test.ts`** — extend the round-trip test (`fromRow(toRow(s))` ms-exact) and add malformed-value cases for the sanitizer rule.
7. `npm test` and `npm run build` green before commit (see [testing.md](testing.md), [operations.md](operations.md)).

## Playbook: adding a synced entity (a new table)

Model it on competitions end-to-end:

1. Type in `src/types.ts` with `id`/`date`/`createdAt`/`updatedAt` (the `Mergeable` shape) — and keep it **append-only per id**, or the blind push is unsound for it from day one.
2. `src/store.ts` — add to `AppData`, `emptyData`, and `load` (default `[]` for old blobs).
3. `src/sync.ts` — row interface, `toXRow`/`fromXRow` sanitizer, `mergeXs = mergeById`, wire into `RemotePull`, `pullAll`, `pushAll`, and `mergeAppData` (**extend the bailout condition and spread the new array in both return branches**).
4. Decide the tolerance class: if the table ships as a schema addendum after the build can already be live, give it the competitions-style 404 tolerance on both pull and push; otherwise strict.
5. `supabase-schema.sql` addendum: table with CHECKs, index on `(user_id, date)`, RLS enable, drop-then-create anon select/insert/update policies (`with check (user_id = 'dmitrii')`), and `revoke delete … from anon`. No timestamp defaults/triggers.
6. Stats stay competition-proof by type: every aggregate in `src/stats.ts` takes `Session[]` only (`historyFeed`, the render-only history list, is the sole export that also takes `Competition[]`), so new entities cannot leak into streak/hours/rounds by accident — preserve that (see [stats.md](stats.md)).
7. Mirror the full `src/sync.test.ts` battery: round-trip, drop rules, clamp rules, merge semantics, same-reference bailout, both mergeAppData branches, push URL/headers/demo-filter, 404 tolerance.

## Coupling table

| If you change… | You must also change… |
|---|---|
| any whitelisted value set (`RoundMin`, `CardioRating`, `time` format, …) | all three declarations: `src/types.ts` union, `src/sync.ts` sanitizer whitelist/regex, `supabase-schema.sql` CHECK — identically |
| `Session`/`Competition` shape | `src/store.ts` `load` defaults, `src/sync.ts` row types + `toRow`/`fromRow` (or comp twins), SQL addendum, `src/sync.test.ts` round-trip |
| add an edit/delete feature for sessions or comps | `pushAll` must become pull-merge-then-push (blind upsert is no longer safe); update the header comment in `src/sync.ts` and this doc |
| `mergeAppData` | keep the three-term bailout and `competitions` spread in both branches; tests pin both |
| the `update` API in `src/store.ts` — `useAppData` | `useSync.cycle` merge-inside-updater must still see concurrent saves |
| a new mutation of synced data in `src/App.tsx` | call `requestPush()` after it; stamp `stateUpdatedAt` if it touches focus/tagList/settings |
| `SyncStatus` values | `src/screens/Home.tsx` — `SYNC_LABELS` (exhaustive `Record`, compiler will catch) |
| `SYNC_USER_ID` / auth model | every RLS policy in `supabase-schema.sql` (migration notes at the end of its first section), `baseHeaders` bearer token |
