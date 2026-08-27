# Data model

All persistent state is one `AppData` object (src/types.ts — `AppData`) held in React state and mirrored to a single localStorage key. localStorage is the UI's source of truth; remote sync (see [sync.md](sync.md)) is background convenience and never authoritative for deletions. Every type below lives in src/types.ts unless noted.

## Core invariants (read first)

- **Sessions and competitions are append-only per id.** The app creates rows and never edits or deletes them. This is the *only* reason the blind full-table upsert push in src/sync.ts — `pushAll` is safe. See "The append-only rule" below for exactly what this forbids.
- **Calendar dates are local `yyyy-mm-dd` strings.** They are produced by src/dates.ts — `toIso` (local getters) and parsed by `parseIso`. `toISOString()` / any UTC API is banned for calendar dates: an evening session must land on that local day. Weeks are Monday-start (src/dates.ts — `mondayOf`).
- **Timestamps (`createdAt`/`updatedAt`) are epoch-ms numbers, app-authoritative.** The DB has no `now()` defaults or triggers (supabase-schema.sql) — a DB trigger would corrupt LWW for offline-delayed pushes. `updatedAt` drives last-write-wins merges in src/sync.ts — `mergeById`.
- **`demo-` prefixed ids never sync in either direction** (src/sync.ts — `isPushable`, also applied to remote rows inside `mergeById`).
- **Whitelisted value sets are triple-declared**: TS union (src/types.ts) + pull-sanitizer whitelist (src/sync.ts) + SQL check constraint (supabase-schema.sql) — true of `RoundMin` and `CardioRating`. `CompOutcome` has no SQL leg (it lives in the jsonb `matches` column, which has no per-field checks) and the `time` format has no TS union (regex in src/sync.ts + SQL only). All declared legs must accept/reject identically.

## Persisted types

### `Session`

One training session. Created only by `saveSession` in src/App.tsx; never mutated afterward.

| Field | Type | Semantics |
|---|---|---|
| `id` | `string` | From src/store.ts — `uid()` (`crypto.randomUUID()` with a timestamp+random fallback). `demo-N` for seed data. Upsert conflict key remotely. |
| `date` | `string` | Local calendar date `yyyy-mm-dd`. Derived from the *resolved start* (see `time`), not from save time. Pushed verbatim to the DB `date` column, never routed through a JS `Date` on the sync path. |
| `createdAt` | `number` | Epoch ms at save. Used as merge tiebreak sort key for remote-only rows and as the `updatedAt` backfill for pre-sync blobs. |
| `updatedAt` | `number` | Epoch ms of last local edit — in practice equal to `createdAt` because sessions are append-only. LWW clock per row. |
| `title` | `string` | Computed once at save by src/dates.ts — `autoTitle` from the resolved start (weekday morning/afternoon/evening class, weekend open mat) and stored; never recomputed. |
| `gi` | `boolean` | Gi vs no-gi. |
| `rolls` | `number` | Sparring round count. SQL check: 0–1000. |
| `subsFor` / `subsAgainst` | `number` | Submission tallies. SQL check: 0–1000 each. |
| `roundMin` | `RoundMin` | Minutes per round: `4 \| 5 \| 6 \| 8`. Triple-declared (see coupling table). Drives mat-hours math in [stats.md](stats.md). |
| `tags` | `string[]` | Free-form technique tags; membership in `AppData.tagList` is *not* enforced (stats union session tags back in via src/stats.ts — `withSessionTags`). |
| `time` | `string \| null` | Actual session start, local `'HH:MM'` 24h. `null` on rows created before the time picker existed (and on demo rows). Regex-validated on pull and by SQL check — the two patterns must stay identical. |

**`time` / `when` semantics.** `LogForm.when` (`'HH:MM' | null`) is the *picked* wall-clock time; `null` means "now". At save, src/dates.ts — `resolveWhen(now, when)` resolves it to the **most recent occurrence** of that wall-clock time: today if already passed, else yesterday — because classes are logged the morning after. `Session.date`, `Session.title`, and `Session.time` all derive from that resolved instant; `createdAt`/`updatedAt` use the actual save moment. After save, `when` resets to `null` (a per-session fact; a stale value would silently re-date the next log) while `gi`/`roundMin` persist as sticky preferences (src/App.tsx — `saveSession` form reset).

### `Competition` and `CompMatch`

A competition entry — append-only per id, same rule as `Session`. Created only by `saveComp` in src/App.tsx. Matches live as a `CompMatch[]` **on the row** (jsonb column remotely, not a child table): the anon role cannot DELETE, so child rows could never be reconciled — the whole competition is the atomic LWW unit.

`Competition` fields: `id`, `createdAt`, `updatedAt` as in `Session`; `date` is the local save day (`toIso(now)` — no time picker, no `resolveWhen` shift). `title` is resolved at save time (trimmed event name or the default `'Competition'` — the default is also the pull-sanitizer fallback in src/sync.ts — `fromCompRow`). `gi: boolean`; `cardio: CardioRating` (`0..5`, `0` = unrated, `5` = gassed); `workedWell` / `didntWork` free text, trimmed at save; `matches: CompMatch[]`.

`CompMatch`: `outcome: CompOutcome` (`'win' | 'loss' | 'draw'`), `myPoints` / `theirPoints: number`, `submission: string` — non-empty means the match ended by that submission (mine on a win, theirs on a loss). The jsonb column has no per-field SQL checks; the client-side caps in src/sync.ts — `sanitizeMatches` (`MAX_MATCHES = 50`, `MAX_POINTS = 1000`, outcome whitelist) are the only bounds on pulled data.

**Competitions are history-only.** Every derived-stat function takes `Session[]` only (see [stats.md](stats.md); the one src/stats.ts function that accepts `Competition[]`, `historyFeed`, is display-only interleaving for the history list), so competitions cannot affect streak/hours/rounds even by accident — this is type-level enforcement, keep it.

### `AppData`

| Field | Type | Semantics |
|---|---|---|
| `sessions` | `Session[]` | Chronological append order locally; merge appends remote-only rows sorted by `(date, createdAt)`. |
| `competitions` | `Competition[]` | Same. Absent from pre-competitions blobs (see `load()` below). |
| `tagList` | `string[]` | User's tag vocabulary, input order. Display order is computed per-render by src/curriculum.ts — `orderTagsByCurriculum` (see [curriculum.md](curriculum.md)); the stored order is never rewritten. |
| `focus` | `FocusGoal` | `{ title, tag }`. `tag` is the tag whose 30-day frequency drives the progress bar; empty `tag` = no goal set. |
| `settings` | `Settings` | `{ weeklyGoal: number, showMilestones: boolean }`. |
| `stateUpdatedAt` | `number` | Single LWW clock for the whole `focus` + `tagList` + `settings` blob (contrast: per-row `updatedAt` for sessions/competitions). **`0` means "never touched locally"** and gates the `app_state` push in src/sync.ts — `pushAll`, so a fresh install cannot overwrite remote state with defaults. Every mutation of focus/tagList/settings must stamp it (`setFocus` / `addTag` in src/App.tsx do). |

### Ephemeral (never persisted)

`Tab` (`'dash' | 'history' | 'log' | 'tech' | 'progress'`), `GiFilter` (`'All' | 'Gi' | 'No-Gi'`), `LogMode` (`'training' | 'comp'`), `LogForm`, `CompForm` — all React state in src/App.tsx. `LogForm` defaults are `EMPTY_FORM` in src/App.tsx (`roundMin: 5`, `gi: true`, `when: null`); `CompForm` defaults are `EMPTY_COMP_FORM` (`cardio: 0`, `gi: true`). After a comp save, only `gi` survives the reset (sticky preference).

## localStorage blob (`rollbook:v1`)

src/store.ts — `STORAGE_KEY = 'rollbook:v1'`. The value is `JSON.stringify(AppData)`, written on **every** state change by the `useEffect` in src/store.ts — `useAppData` (`persist` swallows quota/private-mode errors; the app keeps working in memory). There is no debounce and no partial writes: whole blob, every change.

Reading is src/store.ts — `load()`, exported for tests; the app reaches it only through `useAppData`'s `useState(load)` initializer (i.e. read once per app boot).

## `load()` is the migration mechanism

There are no versioned migrations and no version bump planned — `load()` does **field-wise defaulting against `emptyData()`** and that is the entire schema-evolution story for the local blob:

- Whole-blob `JSON.parse` failure or missing key → fresh `emptyData()` (empty arrays, `DEFAULT_TAGS` copy, empty focus, `{ weeklyGoal: 2, showMilestones: true }`, `stateUpdatedAt: 0`).
- Missing/malformed top-level keys → per-key defaults (`Array.isArray` guards; `focus`/`settings` are spread-merged over the defaults so *new sub-fields added later* auto-heal; an empty `tagList` is replaced by `DEFAULT_TAGS`).
- Unknown keys in the stored blob are **dropped** — `load()` builds a fresh object literal, it does not spread `parsed`.
- Per-session backfills: pre-sync rows lacking `updatedAt` get `createdAt`; rows lacking `time` (pre-picker) get `null`.
- `competitions` missing (pre-feature blobs) → empty array.

**Consequence: adding a field to `Session` or `AppData` requires adding its default/backfill in `load()` in the same change**, or existing installs boot with `undefined` in that field. Adding a synced `Session` field additionally requires the SQL addendum + mapper work (see coupling table and [sync.md](sync.md)).

`DEFAULT_TAGS` (src/store.ts) is the 14-tag starter vocabulary; its members deliberately match the curriculum tables in src/curriculum.ts so a fresh install's tag sheet is fully ordered (see [curriculum.md](curriculum.md)).

`uid()` (src/store.ts): `crypto.randomUUID()` when available, else `base36(now)-base36(random)`. The remote `id` column is `text`, not `uuid`, so the fallback shape is legal remotely — keep it that way.

## The append-only rule

Sessions and competitions are append-only per id **by design**, not by accident. Everything below silently depends on it:

- src/sync.ts — `pushAll` blindly upserts *all* local non-demo rows with `Prefer: resolution=merge-duplicates` and no read-back. Safe only because a row's content never changes after creation — a stale device re-pushing old rows writes identical bytes.
- Local `updatedAt === createdAt` always holds for app-created rows, so LWW ties resolve harmlessly.
- `mergeById` keeps local-only rows unconditionally (remote is never authoritative for deletions).

**Forbidden without sync rework** (each requires at minimum a pull-before-every-push so a stale device cannot resurrect or clobber, and a real conflict story):

| Feature | Why it breaks today |
|---|---|
| Edit a session/competition | A device that pushed before pulling overwrites the newer edit with its stale copy; LWW only helps if every push is preceded by a pull. |
| Delete a session/competition | The next push from any device that still has the row re-upserts it; `mergeById` on other devices re-appends it as "remote-only". Deletion needs tombstones, and the anon role has DELETE revoked besides. |
| Editing matches inside a competition | Same as edit — the comp row is the atomic unit, so any match change is a row edit. |

If you add any of these, update the model note at the top of src/sync.ts and this section together.

## Demo data (src/demo.ts — `demoData`)

Deterministic seed anchored to the runtime `todayIso`, loaded only via the console helper `window.rollbook.seed()` installed by src/App.tsx (`window.rollbook.clear()` resets to `emptyData()`). The app itself always starts empty.

Two layers:

1. **Showcase window** — the hardcoded `SHOWCASE` table, week offsets `0..-11` relative to `mondayOf(todayIso)`, reproduces the design handoff's dashboard *through the real stats functions*: week bars M4/W8/F6, an 11-week streak (week −11 holds the single-session streak breaker), a 30-day window of 11 sessions with the focus tag in 7 (64%), subs 9/12, and the prototype's exact 12-week volume chart `[12,15,10,18,14,9,16,20,13,17,15,18]`. Weeks −3..0 are the 30-day showcase; week −4 deliberately stays Mon–Fri so nothing leaks into the 30-day window. Editing `SHOWCASE` numbers breaks those derived readouts — verify against src/stats.ts, not by eye.
2. **PRNG filler** — weeks −12..−30, `mulberry32` with fixed seed `20260802`, clipped to the current calendar year (`jan1` guard both ends). `LIGHT_WEEKS` inserts sub-2-session weeks at −27/−20/−13 so no accidental ≥10-week streak predates the showcase run. Sized so the 500-round milestone reads "on pace for October" in early August.

Sessions get ids `demo-0..n` (index after date-sort), `createdAt = updatedAt = ` 18:00 local on their date plus `i` ms (unique, stable ordering), `time: null`. Two showcase competitions get `demo-comp-0/1` (Saturdays 2 and 6 weeks back, same year guard). The seeded `focus` is `{ title: 'Guard retention under pressure', tag: 'Guard retention' }`; `stateUpdatedAt` stays `0` via the `emptyData()` spread, so seeding never pushes app_state.

**Demo data is a local-only plaything**: `isPushable` excludes `demo-` ids from every push, and `mergeById` drops `demo-` ids arriving from remote — a real hand-tampered `demo-99` row was once found in the DB and was invisible in-app because of exactly these layers. Never reuse the `demo-` prefix for real data, and never generate real ids that start with it.

## Coupling table

| If you change… | You must also change… |
|---|---|
| Any `Session` field (add/rename) | src/store.ts — `load()` backfill; src/sync.ts — `toRow` + `fromRow` (with sanitization); supabase-schema.sql idempotent addendum (run **before** deploying — a missing sessions column 400s/PGRST204 and pushes fail strict, unlike the tolerated 404 for a whole missing competitions table); src/demo.ts session mapper; tests. |
| Any `Competition`/`CompMatch` field | src/store.ts — `load()` (if defaulting needed); src/sync.ts — `toCompRow` + `fromCompRow`/`sanitizeMatches`; supabase-schema.sql; src/demo.ts comp seeds. |
| `RoundMin` union (src/types.ts) | `ROUND_MINS` whitelist in src/sync.ts; `round_min in (4,5,6,8)` check in supabase-schema.sql; roundMin picker in src/screens/Log.tsx; mat-hours math assumptions in [stats.md](stats.md). |
| `CardioRating` union | `CARDIO_RATINGS` in src/sync.ts; `cardio between 0 and 5` check in supabase-schema.sql; the cardio control in src/screens/Log.tsx. |
| `CompOutcome` union | `OUTCOMES` in src/sync.ts; outcome UI in src/screens/Log.tsx. |
| The `'HH:MM'` time format | The regex in src/sync.ts — `fromRow` and the SQL `"time" ~ …` check (must accept/reject identically); src/dates.ts — `toHhmm`/`fmtTime`/`resolveWhen`. |
| `focus`/`tagList`/`settings` shape | src/sync.ts — `fromStateRow` defaults and the `pushAll` app_state payload; `load()`'s spread-merge covers local healing automatically. |
| `DEFAULT_TAGS` | Curriculum ordering coverage in src/curriculum.ts ([curriculum.md](curriculum.md)); src/demo.ts tag pools (`SHOWCASE`, `FILLER_TAGS`) which assume these names. |
| `STORAGE_KEY` (`rollbook:v1`) | Don't — existing installs would lose their data. A bump would need an explicit old-key read-and-migrate in `load()`. |
| Append-only assumption (any edit/delete feature) | src/sync.ts push model (pull-before-every-push at minimum), the header comment in src/sync.ts, and this document. |

Siblings: [architecture.md](architecture.md) · [sync.md](sync.md) · [stats.md](stats.md) · [curriculum.md](curriculum.md) · [design-system.md](design-system.md) · [build-pwa.md](build-pwa.md) · [testing.md](testing.md) · [operations.md](operations.md)
