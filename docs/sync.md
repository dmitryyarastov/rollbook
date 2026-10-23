# Sync

Background sync of localStorage state to Supabase over raw PostgREST `fetch` — no supabase-js, no auth. **localStorage (`rollbook:v1`) is the UI's source of truth; sync is a convenience layer that must never be able to lose or corrupt local data.** Remote is untrusted (the anon key in `src/config.ts` is public-by-design and anyone can INSERT/UPDATE), so every pulled row passes through a sanitizing mapper, and remote is never authoritative for deletions. See [architecture.md](architecture.md) for where sync sits in the app, [data-model.md](data-model.md) for the types, [operations.md](operations.md) for the Supabase side.

Code lives in exactly two files:

- `src/sync.ts` — pure mapping/merge functions plus a thin fetch shell (`pullAll`, `pushAll`). No React.
- `src/useSync.ts` — `useSync` hook: all scheduling (triggers, debounce, status). No fetch logic.

Keep that split. Everything in `src/sync.ts` is unit-testable with a stub fetch (`src/sync.test.ts` — `stubFetch`); `useSync` stays thin enough to review by eye.

## Why the blind full-table push is safe (load-bearing invariant)

`src/sync.ts` — `pushAll` upserts **every** local non-demo session, competition, and promotion (belt rank event) on every push, with `Prefer: resolution=merge-duplicates` and `on_conflict=id`. It never pulls first. This is only correct because **sessions, competitions, and promotions are append-only per id by design** (for promotions that is also the correction model — a fixed rank is a new event, see [data-model.md](data-model.md)): a row, once created, is never edited or deleted in the UI, so a stale device re-upserting its copy writes back byte-identical data — **with one exception: version skew when a column is added.** A device still on the old build pulls new rows through its old `fromRow`, silently dropping the new field; once it updates, `load()` backfills the default, and its next full-table push writes that default over the real remote value (see the tie-break below for how `spec_*` is protected, and the playbook step for future columns). **If you ever add an edit or delete feature for sessions, competitions, or promotions, this invariant breaks** — a device that has been offline will overwrite a newer edit with its stale copy. The required change is a pull-before-every-push (merge, then push the merged result), not a smarter payload. The header comment in `src/sync.ts` says the same thing; keep both in agreement.

Payload size is a non-issue for years: ~500 sessions ≈ 150 KB. PostgREST caps GET responses at 1000 rows; the pull orders `updated_at.desc` so a hypothetical overflow drops the *oldest* rows, not the newest.

## The two LWW clocks

There are two independent last-write-wins mechanisms; do not conflate them.

| Clock | Scope | Field | Tie behavior | Zero value |
|---|---|---|---|---|
| Per-row | each `Session` / `Competition` / `Promotion` | `updatedAt` (epoch ms locally, `updated_at` timestamptz remotely) | strictly-newer remote wins; **ties keep local** — except the sessions-only `recoversBreakdown` tie-break (below) | n/a — always set at creation |
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

Call sites in `src/App.tsx`: `saveSession`, `saveComp`, `addPromotion`, `addTag`, `setFocus` — each calls `requestPush()` immediately after its `update()`. **Any new mutation of synced data must call `requestPush()`** or it syncs only at the next cycle trigger.

`src/sync.ts` — `pushAll(d, fetch)` sends up to four POSTs in parallel:

- `sessions?on_conflict=id` — all local sessions passing `isPushable`, mapped by `toRow`. Skipped if none.
- `app_state?on_conflict=user_id` — the `{focus, tagList, settings}` blob, **only when `stateUpdatedAt > 0`**.
- `competitions?on_conflict=id` — all local comps passing `isPushable`, mapped by `toCompRow`. Skipped if none; tracked outside the strict list for 404 tolerance (below).
- `promotions?on_conflict=id` — all local rank events passing `isPushable`, mapped by `toPromoRow` (`date` verbatim, `belt`/`stripes` as-is, epoch-ms timestamps as ISO `timestamptz`, `user_id` from `SYNC_USER_ID`). Skipped if none; tolerated on 404 exactly like competitions.

All with `Prefer: resolution=merge-duplicates,return=minimal`. `isPushable` (`src/sync.ts`) excludes any id starting with `demo-`: demo seed data (`src/demo.ts`) is a local plaything and never syncs in either direction — **rows only**: the seed's `tagList`/`focus` ride in the app_state blob and go up with the next stamped state edit (`setFocus`/`addTag`), see "Dev servers write to the live database" in [operations.md](operations.md).

## mergeById semantics

`src/sync.ts` — `mergeById<T extends Mergeable>` is one generic used by `mergeSessions`, `mergeCompetitions`, and `mergePromotions` **so entity merge semantics can never drift** — do not fork it. (`mergePromotions` passes no tie predicate; merged order is irrelevant for rank events, since `rankTimeline` (src/belts.ts) orders them itself.) Rules, per id:

1. Strictly-newer remote (`r.updatedAt > l.updatedAt`) replaces local; **ties keep local** (so a re-pull of your own push is a no-op). `mergeById` takes an optional `preferRemoteOnTie(l, r)` predicate; `mergeSessions` passes `recoversBreakdown`, which on an exact tie lets the **richer copy win**: the remote row replaces local when it carries **more typed specific rounds** (`specBreakdownSum(r) > specBreakdownSum(l)`, src/specific.ts), provided both copies agree on the `specific` total and the remote breakdown stays **within** it (`specBreakdownSum(r) <= r.specific` — app-written rows keep breakdown === `specific`). This repairs version skew: a build that predates a `spec_*` column drops it on pull, and after that device updates, `load()` backfills zero — the same row at the same `updatedAt`, minus part of its breakdown. For a pre-format build that is the whole breakdown; for a build that knew only some formats it is just the newer ones (a row with 1 closed-guard + 2 side-control rounds, pulled by a closed/mount/open build, keeps its 1 and loses the 2). That partial loss is why the rule compares sums instead of the original "all-zero local vs non-zero remote" test, which it would have slipped past. Without the tie-break the stripped device pushes its zeros over the real values on every push, flip-flopping with the device that logged them. The rule is one-directional by construction: a poorer remote copy never replaces real local values, a different total is treated as a different fact (no replacement), and a remote breakdown exceeding its own total — impossible for an app-written row, so tampering — is never adopted. Pinned by the three "version skew" tests in `src/sync.test.ts` (all-zero, partial, over-total).
2. Remote-only rows are appended, sorted by `date` asc then `createdAt` asc (string compare on the yyyy-mm-dd date — correct, and no JS `Date` involved).
3. Local-only rows are **always kept** — remote is not authoritative for deletions; a tampered/emptied remote table can never erase local history. (A real hand-tampered `demo-99` row was once found in the DB and was invisible in-app because of the demo filter + this rule.)
4. Remote `demo-` rows are filtered out via `isPushable` before merging.
5. **Same-reference bailout**: when nothing changed, the function returns the original `local` array reference so React state updates bail out and no re-render/persist happens on every 60 s visibility pull.

`mergeAppData` composes the three merges plus the state-blob adoption. Two coupling rules here, covered by tests in `src/sync.test.ts`:

- The bailout condition must check **sessions AND competitions AND promotions AND state adoption**: `if (sessions === d.sessions && competitions === d.competitions && promotions === d.promotions && !adopt) return d`. Omitting a term makes the bailout fire while that entity has pulled changes, silently discarding them; returning `d` only when every term holds is what keeps a no-op pull from becoming a spurious state update.
- **Both** return branches (state adopted / not adopted) must spread **all three** arrays — `sessions`, `competitions`, `promotions`. The historical bug shape is adopting remote state but dropping pulled competitions in that branch — the test "adopts pulled competitions in both state branches" pins this for comps; "adopts pulled promotions" exercises only the not-adopted (`state: null`) branch, so the adopted branch's `promotions` spread is held by code review alone.

## Sanitizers (pull side)

With no auth, every remote row is attacker-writable, so `pullAll` maps everything through sanitizers before it can reach state or stats. Rule of thumb encoded in all four: **structurally unusable → drop the row (`null`); fixable → clamp to a sane default.** Junk rows in the response array are silently filtered out.

`fromRow` (sessions):

| Field | Rule |
|---|---|
| `id` | non-empty string, else **drop row** |
| `date` | `/^\d{4}-\d{2}-\d{2}$/`, else **drop row** (verbatim string, never through `Date`) |
| `created_at`, `updated_at` | `Date.parse`-able string, else **drop row** |
| `title` | string, else `''` |
| `gi` | `=== true`, else `false` |
| `rolls`, `subs_for`, `subs_against` | `count()`: number-coerced, rounded, floored at 0 (`subs_*` persist for historical rows only — the UI stopped counting 2026-10) |
| `specific` | `count()` additionally capped at 1000 — `Math.min(1000, count(…))`, matching the SQL `specific between 0 and 1000` check |
| `spec_closed`, `spec_open`, `spec_side`, `spec_mount`, `spec_back`, `spec_turtle` | same rule as `specific` — `Math.min(1000, count(…))` each, matching the six SQL `between 0 and 1000` checks (the typed specific-format breakdown; sanitized independently, the total/sum lockstep is an app-write guarantee, not a pull-side repair — the one place sum and total meet after a pull is the `recoversBreakdown` tie-break, which refuses to adopt a breakdown over its total) |
| `round_min` | must be in `[4, 5, 6, 8]` (`ROUND_MINS`), else `5` |
| `duration_min` | integer 1–600, else `null` (legacy-compatible) |
| `intensity` | must be in `[1, 2, 3, 4, 5]` (`SESSION_INTENSITIES`), else `null` |
| `tags` | array filtered to string members, else `[]` |
| `time` | string matching `/^([01]\d|2[0-3]):[0-5]\d$/`, else `null` |

`fromCompRow` (competitions): same id/date/timestamp drop rules; `title` defaults to `'Competition'`, `cardio` must be in 0–5 (`CARDIO_RATINGS`) else `0`, `placement` must be a string in `PLACEMENTS` (`'none' | 'bronze' | 'silver' | 'gold'`) else `'none'`, `worked_well`/`didnt_work` default `''`, `tags` is an array filtered to string members else `[]` (the same rule as session tags — it is a real `text[]` column, not jsonb), and `matches` goes through `sanitizeMatches`:

- non-array → `[]`; list truncated at **`MAX_MATCHES = 50`**;
- entry with `outcome` not in `['win','loss','draw']` → **entry dropped** (outcome is semantically essential, no sane default);
- `myPoints`/`theirPoints` → `count()` capped at **`MAX_POINTS = 1000`**; `submission` → trimmed string else `''`.

The caps matter: `matches` is a jsonb column and `supabase-schema.sql` only checks `jsonb_typeof(matches) = 'array'` — **these client caps are the only per-field enforcement the jsonb ever gets** (unlike sessions, where the SQL CHECK constraints mirror the TS ranges). Matches live as jsonb *on* the competitions row rather than in a child table because anon cannot DELETE: child rows could never be reconciled, so the whole competition is the atomic LWW unit.

`fromPromoRow` (promotions): same id/date/timestamp drop rules, and then **drop, never clamp**, on the rank itself — `belt` must be a string in `BELTS` and `stripes` (number-coerced) an integer within that belt's cap (0–4, or 0–6 degrees on black), both checked by the shared src/belts.ts — `isValidRank`, mirroring the SQL `belt in (…)` and `promotions_stripes_check`. The belt and stripes are the event's whole meaning: a clamped or defaulted rank (say, an unknown belt read as `'white'`, or 7 stripes cut to 4) would be a *guessed* promotion that could silently re-rank the character as the latest event. Dropping is the safe failure: a genuine event still lives on the device that created it, whose next blind push rewrites the tampered remote row. `user_id` is not read back.

`fromStateRow` (app_state): drops the row only on an unparsable `updated_at`; every field inside the blob falls back per-field to `emptyData()` defaults (`src/store.ts`). Note `tagList` falls back when the remote list is empty, not just malformed.

## Error tolerance matrix

| Request | Failure | Behavior | Why |
|---|---|---|---|
| pull `competitions` | **404 exactly** | tolerated → `[]`, sessions/state still merge | table may postdate this build — the SQL addendum in `supabase-schema.sql` not yet run; comps stay local until it is |
| push `competitions` | **404 exactly** | tolerated, push counts as success | same; comps upload on the first push after the owner runs the addendum |
| pull/push `competitions` | any other non-ok | throw → `fail()` | real outage |
| pull `promotions` | **404 exactly** | tolerated → `[]`, everything else still merges | same as comps: the "Belt promotions" addendum may run before or after the deploy; rank events stay local until it does |
| push `promotions` | **404 exactly** | tolerated, push counts as success | rank events upload on the first push after the addendum runs |
| pull/push `promotions` | any other non-ok | throw → `fail()` | real outage |
| pull/push `sessions`, `app_state` | any non-ok | throw → `fail()` | strict |
| any request | > 10 s | `AbortSignal.timeout` rejects → `fail()` | paused Supabase project hangs otherwise |

A missing **column** on an existing table is deliberately loud, not tolerated: PostgREST answers **400 (PGRST204)** when a pushed payload names an unknown column. That 400 fails the whole push and shows "sync error". This is by design — it forces the ALTER-before-deploy ordering below rather than silently dropping data. It applies to competitions and promotions too: their 404 tolerance covers only the *whole table* missing — a comp push against a table lacking the `placement`/`tags` columns 400s, and so would a future promotions column. A sessions push missing `duration_min`/`intensity`, `specific`, or any of the format breakdown columns (`spec_closed`/`spec_mount`/`spec_open`, then `spec_side`/`spec_back`/`spec_turtle`) does the same, so each matching addendum in `supabase-schema.sql` must run before deploying the build that pushes those columns.

## SyncStatus lifecycle

`src/sync.ts` — `type SyncStatus = 'disabled' | 'syncing' | 'synced' | 'offline' | 'error'`.

- Initial: `'disabled'` when `SYNC_ENABLED` is false (`src/config.ts` — empty URL/key turns the whole feature off, so a fresh clone runs local-only; so does `VITE_SYNC_OFF=1`, the `npm run dev -- --mode nosync` dev mode), else `'syncing'`.
- Every cycle/push start → `'syncing'`; success → `'synced'`; failure → `fail()` picks `'offline'` vs `'error'` by `navigator.onLine`.
- Rendered only on the Home screen (`src/screens/Home.tsx` — `SYNC_LABELS`); `disabled` maps to `null` (nothing shown). `'offline'` reads "offline — will sync", which is honest: the `online` trigger will fire a cycle.

## Playbook: adding a synced field to sessions

Whitelisted value sets are **triple-declared** — TS union, pull-sanitizer whitelist, SQL CHECK — and all three must accept/reject identically (e.g. `RoundMin` `4|5|6|8`; session `SessionIntensity` / `SESSION_INTENSITIES` / `intensity between 1 and 5`; competition `Placement`; and the matching `time` regex). Bounded numeric fields such as `duration_min`, `specific`, and the six `spec_*` format columns must match sanitizer and SQL bounds too. The October 2026 "More specific-training formats" addendum (`spec_side`/`spec_back`/`spec_turtle`: three integer columns, default 0, 0–1000 both in the sanitizer cap and the SQL check) is the latest worked example — the same shape as the month's first formats addendum (`spec_closed`/`spec_mount`/`spec_open`), which followed the single `specific` column; September 2026's duration/RPE is the nullable-field variant. A new specific-training format also needs its `SPEC_FORMATS` entry in `src/specific.ts`, the single list the UI and the breakdown sum read (see the coupling table in [data-model.md](data-model.md)).

1. **`src/types.ts`** — add the field to `Session` (union type if it's an enum).
2. **`src/store.ts` — `load`** — default the field for pre-existing localStorage blobs (as `time: typeof s.time === 'string' ? s.time : null` does).
3. **`src/sync.ts`** — extend `SessionRow`, `toRow`, and `fromRow` (sanitizer rule: drop-row vs clamp, matching the table above).
4. **`supabase-schema.sql`** — append a new delimited, **idempotent** addendum section (`alter table … add column if not exists`, plus a CHECK mirroring the TS/sanitizer whitelist). Never edit earlier sections — they are a run history. The anon key cannot DDL: apply the section through the Supabase MCP server (`apply_migration`, connected for training-hub sessions since 2026-10) after showing the owner the SQL, or have the owner paste it into the Supabase SQL editor.
5. **Ordering: run the ALTER before deploying the build that pushes the column.** A push from the new build against the old schema is a 400 (PGRST204) and sync goes loud-red until the ALTER runs. Pushing to `main` deploys (GitHub Pages), so: run SQL first, then push the commit.
6. **`src/sync.test.ts`** — extend the round-trip test (`fromRow(toRow(s))` ms-exact) and add malformed-value cases for the sanitizer rule.
7. **Decide the version-skew story.** Any device still on the previous build will pull new rows and drop the field; after it updates, `load()` backfills your default and the next full-table push writes that default over the real value. If the default is information-free for display only (e.g. a `null` that just hides a meta segment), accepting a lost value may be fine — say so in the commit. If the value feeds anything (XP, stats), add a `preferRemoteOnTie` rule like `recoversBreakdown` so a non-default remote beats a backfilled local default on an exact `updatedAt` tie, and pin it with a test. A new specific-training format needs no new rule: `recoversBreakdown` compares `specBreakdownSum`, which reads every `SPEC_FORMATS` entry, so the richer copy already wins on a tie — the side/back/turtle formats rode on it (the "version skew, partial" test is their pin).
8. `npm test` and `npm run build` green before commit (see [testing.md](testing.md), [operations.md](operations.md)).

## Playbook: adding a synced entity (a new table)

Model it on competitions end-to-end. Promotions (belt rank events, October 2026) are the latest and smallest worked example — a flat row, no jsonb, no tie predicate — and each step below names what they did:

1. Type in `src/types.ts` with `id`/`date`/`createdAt`/`updatedAt` (the `Mergeable` shape) — and keep it **append-only per id**, or the blind push is unsound for it from day one. *Promotions:* `Promotion` + the `Belt` union; a rank correction is a new event, never an edit, so the entity never needed an edit path.
2. `src/store.ts` — add to `AppData`, `emptyData`, and `load` (default `[]` for old blobs). *Promotions:* `load` also drops malformed events outright (no sane default for a rank).
3. `src/sync.ts` — row interface, `toXRow`/`fromXRow` sanitizer, `mergeXs = mergeById`, wire into `RemotePull`, `pullAll`, `pushAll`, and `mergeAppData` (**extend the bailout condition and spread the new array in both return branches**). *Promotions:* `PromotionRow`, `toPromoRow`/`fromPromoRow` (drop-not-clamp on the rank — see Sanitizers), `mergePromotions`, `RemotePull.promotions`, a fourth GET in `pullAll`, a fourth POST in `pushAll` (tracked beside the comps request, outside the strict list), and the fourth bailout term.
4. Decide the tolerance class: if the table ships as a schema addendum after the build can already be live, give it the competitions-style 404 tolerance on both pull and push; otherwise strict. *Promotions:* tolerated, so the addendum may run before or after the deploy.
5. `supabase-schema.sql` addendum: table with CHECKs, index on `(user_id, date)`, RLS enable, drop-then-create anon select/insert/update policies (`with check (user_id = 'dmitrii')`), and `revoke delete … from anon`. No timestamp defaults/triggers. *Promotions:* "Belt promotions (added 2026-10)" — a `belt in (…)` check plus a named cross-field `promotions_stripes_check` (the cap depends on the belt), the pattern for any rule that spans two columns.
6. Stats stay entity-proof by type: every training aggregate in `src/stats.ts` takes `Session[]` only (the deliberate competition-aware exports are `historyFeed`, the render-only history list, and the goal milestones `medalMilestone`/`openGuardMilestone`), so new entities cannot leak into streak/hours/rounds by accident — preserve that (see [stats.md](stats.md)). *Promotions:* read only by `src/belts.ts` and the UI; neither stats nor XP sees them.
7. Mirror the full `src/sync.test.ts` battery: round-trip, drop rules, clamp rules, merge semantics, same-reference bailout, both mergeAppData branches, push URL/headers/demo-filter, 404 tolerance. *Promotions:* the "promotion rows" block (round-trip, drop cases), demo-filtered merge + same-reference, "adopts pulled promotions", and the push/pull 404-tolerated / other-status-rejects pair; existing `mergeAppData` fixtures gained `promotions: []`.

## Coupling table

| If you change… | You must also change… |
|---|---|
| any whitelisted value set (`RoundMin`, `CardioRating`, `Placement`, `Belt`, `time` format, …) | all three declarations: `src/types.ts` union, `src/sync.ts` sanitizer whitelist/regex (for `Belt` and its stripe caps: `isValidRank` in `src/belts.ts`), `supabase-schema.sql` CHECK — identically |
| `Session`/`Competition`/`Promotion` shape | `src/store.ts` `load` defaults, `src/sync.ts` row types + `toRow`/`fromRow` (or the comp/promo twins), SQL addendum, `src/sync.test.ts` round-trip |
| add an edit/delete feature for sessions, comps, or promotions | `pushAll` must become pull-merge-then-push (blind upsert is no longer safe); update the header comment in `src/sync.ts` and this doc |
| `mergeAppData` | keep the four-term bailout and the `competitions`/`promotions` spreads in both branches; tests pin the comps branches and the not-adopted promotions branch |
| the `update` API in `src/store.ts` — `useAppData` | `useSync.cycle` merge-inside-updater must still see concurrent saves |
| a new mutation of synced data in `src/App.tsx` | call `requestPush()` after it; stamp `stateUpdatedAt` if it touches focus/tagList/settings |
| `SyncStatus` values | `src/screens/Home.tsx` — `SYNC_LABELS` (exhaustive `Record`, compiler will catch) |
| `SYNC_USER_ID` / auth model | every RLS policy in `supabase-schema.sql` (migration notes at the end of its first section), `baseHeaders` bearer token |
