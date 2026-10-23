# Data model

All persistent state is one `AppData` object (src/types.ts — `AppData`) held in React state and mirrored to a single localStorage key. localStorage is the UI's source of truth; remote sync (see [sync.md](sync.md)) is background convenience and never authoritative for deletions. Every type below lives in src/types.ts unless noted. The XP/level/characteristics system deliberately adds **nothing** here — it is a pure derivation from the sessions/competitions below (src/xp.ts, see [stats.md](stats.md)): no stored XP, no new fields, no sync or migration surface. Belt rank is the one exception, and deliberately so: a rank is **awarded** by a coach, not derivable from logged history, so it is stored — as append-only `Promotion` events (below).

## Core invariants (read first)

- **Sessions, competitions, and promotions (belt rank events) are append-only per id.** The app creates rows and never edits or deletes them. This is the *only* reason the blind full-table upsert push in src/sync.ts — `pushAll` is safe. See "The append-only rule" below for exactly what this forbids.
- **Calendar dates are local `yyyy-mm-dd` strings.** They are produced by src/dates.ts — `toIso` (local getters) and parsed by `parseIso`. `toISOString()` / any UTC API is banned for calendar dates: an evening session must land on that local day. Weeks are Monday-start (src/dates.ts — `mondayOf`).
- **Timestamps (`createdAt`/`updatedAt`) are epoch-ms numbers, app-authoritative.** The DB has no `now()` defaults or triggers (supabase-schema.sql) — a DB trigger would corrupt LWW for offline-delayed pushes. `updatedAt` drives last-write-wins merges in src/sync.ts — `mergeById`.
- **`demo-` prefixed ids never sync in either direction** (src/sync.ts — `isPushable`, also applied to remote rows inside `mergeById`).
- **Whitelisted value sets are triple-declared**: TS union (src/types.ts) + pull-sanitizer whitelist (src/sync.ts) + SQL check constraint (supabase-schema.sql) — true of `RoundMin`, `SessionIntensity`, `CardioRating`, `Placement`, and `Belt` with its per-belt stripe cap (the sanitizer leg for the rank is `isValidRank` in src/belts.ts, which `fromPromoRow` calls; the SQL leg is the `belt in (…)` check plus the cross-field `promotions_stripes_check`). `CompOutcome` has no SQL leg (it lives in the jsonb `matches` column, which has no per-field checks) and the `time` format has no TS union (regex in src/sync.ts + SQL only). Session-duration and specific-round bounds (the `specific` total and each of the six format columns `spec_closed`/`spec_open`/`spec_side`/`spec_mount`/`spec_back`/`spec_turtle`, 0–1000) likewise match between sanitizer and SQL. All declared legs must accept/reject identically.

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
| `rolls` | `number` | Free-sparring round count. SQL check: 0–1000. Every round-based stat counts `rolls + specific` together (src/stats.ts — `sessionRounds`, see [stats.md](stats.md)). |
| `specific` | `number` | Positional ("specific") sparring rounds, **total**, logged beside free rolls. Integer, SQL check: 0–1000, column default 0. `0` on rows from before the October 2026 split (`load()` backfill). Counted with `rolls` in every round stat; also summed alone for the Home "Specific · week" card. **Lockstep rule:** on app-written rows `saveSession` computes `specific = specBreakdownSum(form)` (src/specific.ts — the sum over every format in `SPEC_FORMATS`); it remains the only field round stats read (the breakdown never additionally feeds rounds). |
| `specClosed` / `specOpen` / `specSide` / `specMount` / `specBack` / `specTurtle` | `number` | Per-format breakdown of `specific` — the gym's 2+2-minute swap formats (closed guard retention/passing, open guard passing, then side control, mount, back control and turtle — control from top vs escape from bottom; each side plays both roles). The single list of formats, in curriculum order, is `SPEC_FORMATS` in src/specific.ts. Integers, SQL checks: 0–1000 each, column defaults 0. `0` on rows from before a format existed (`load()` backfill): a legacy row from before any format keeps an untyped `specific` total with a zero breakdown, and a row logged when only closed/mount/open existed has zeros in side/back/turtle. Feed the per-type SessionRow stats and the `matchesSpecific` characteristic predicates in src/xp.ts ([stats.md](stats.md)) — never round stats directly. |
| `subsFor` / `subsAgainst` | `number` | Submission tallies — **historical only**: counting was retired from the UI 2026-10 (`saveSession` writes 0; the fields and their SQL checks, 0–1000 each, remain for old rows, which SessionRow shows as a condensed `F–A` stat). |
| `roundMin` | `RoundMin` | Minutes per round: `4 \| 5 \| 6 \| 8`. Triple-declared (see coupling table). Drives mat-hours math in [stats.md](stats.md). |
| `durationMin` | `number \| null` | Whole class/open-mat minutes, integer 1–600. `null` on rows saved before the September 2026 load controls. Independent of the sparring-time product `(rolls + specific) × roundMin`. |
| `intensity` | `SessionIntensity \| null` | Whole-session RPE: `1 \| 2 \| 3 \| 4 \| 5` (easy → maximal). `null` on legacy rows. Triple-declared. |
| `tags` | `string[]` | Free-form technique tags; membership in `AppData.tagList` is *not* enforced (stats union session tags back in via src/stats.ts — `withSessionTags`). |
| `time` | `string \| null` | Actual session start, local `'HH:MM'` 24h. `null` on rows created before the time picker existed (and on demo rows). Regex-validated on pull and by SQL check — the two patterns must stay identical. |

**Training-form reset semantics.** `LogForm.when` (`'HH:MM' | null`) is the *picked* wall-clock time; `null` means "now". At save, src/dates.ts — `resolveWhen(now, when)` resolves it to the **most recent occurrence** of that wall-clock time: today if already passed, else yesterday — because classes are logged the morning after. `Session.date`, `Session.title`, and `Session.time` all derive from that resolved instant; `createdAt`/`updatedAt` use the actual save moment. After save, counts/tags/`when` reset and duration/RPE return to 60 minutes / 3 because they are per-session facts; only `gi`/`roundMin` persist as sticky preferences (src/App.tsx — `saveSession` form reset).

### `Competition` and `CompMatch`

A competition entry — append-only per id, same rule as `Session`. Created only by `saveComp` in src/App.tsx. Matches live as a `CompMatch[]` **on the row** (jsonb column remotely, not a child table): the anon role cannot DELETE, so child rows could never be reconciled — the whole competition is the atomic LWW unit.

`Competition` fields: `id`, `createdAt`, `updatedAt` as in `Session`; `date` is the local save day (`toIso(now)` — no time picker, no `resolveWhen` shift). `title` is resolved at save time (trimmed event name or the default `'Competition'` — the default is also the pull-sanitizer fallback in src/sync.ts — `fromCompRow`). `gi: boolean`; `cardio: CardioRating` (`0..5`, `0` = unrated, `5` = gassed); `placement: Placement` (`'none' | 'bronze' | 'silver' | 'gold'`, `'none'` = no medal — the default; triple-declared, see coupling table); `workedWell` / `didntWork` free text, trimmed at save; `matches: CompMatch[]`; `tags: string[]` — techniques worked during the event, same tag vocabulary as sessions (a real `text[]` column remotely, filtered to string members on pull — unlike the jsonb `matches`). `placement` and `tags` are the evidence the competition goal milestones read (src/stats.ts — `medalMilestone` / `openGuardMilestone`, see [stats.md](stats.md)).

`CompMatch`: `outcome: CompOutcome` (`'win' | 'loss' | 'draw'`), `myPoints` / `theirPoints: number`, `submission: string` — non-empty means the match ended by that submission (mine on a win, theirs on a loss). The jsonb column has no per-field SQL checks; the client-side caps in src/sync.ts — `sanitizeMatches` (`MAX_MATCHES = 50`, `MAX_POINTS = 1000`, outcome whitelist) are the only bounds on pulled data.

**Competitions cannot move training aggregates.** Every aggregate stat takes `Session[]` only (see [stats.md](stats.md)); the src/stats.ts exports that accept `Competition[]` are deliberate and bounded — `historyFeed` (display-only interleaving for the history list) and the goal milestones `medalMilestone` / `openGuardMilestone` (via `milestones`), which read `placement`/`tags` as goal evidence — so competitions cannot affect streak/hours/rounds even by accident. This is type-level enforcement, keep it.

### `Promotion` (belt rank events)

One rank event: "the rank became `belt`/`stripes` on `date`". Append-only per id, same rule as `Session`. Created only by `addPromotion` in src/App.tsx (called from the Progress belt card, src/components/BeltCard.tsx); never mutated afterward.

**Why rank is stored, not derived.** Everything else on the character sheet (XP, levels, characteristics) is recomputed from logged history and stores nothing. A belt or stripe is awarded by a coach — no amount of logged training implies one — so it is the one attribute that must be recorded. Storing it as an **event list** rather than a single "current rank" field keeps it inside the append-only rule: the current rank is a pure derivation over the events (src/belts.ts — `currentRank`, see [stats.md](stats.md)), and the blind full-table upsert stays safe for it.

| Field | Type | Semantics |
|---|---|---|
| `id` | `string` | `uid()`; `demo-promo-N` for seed data. Upsert conflict key remotely. |
| `date` | `string` | Local calendar date `yyyy-mm-dd` the rank took effect: today for the one-tap Promote button, or any picked date (input `max` = today) from the rank editor. Pushed verbatim, never through a JS `Date`. |
| `createdAt` | `number` | Epoch ms at save. Decides which event a `date` keeps: per date only the latest-created counts (exact ties by `id`), so a same-day entry **replaces** the day's earlier one — how a mis-tap is corrected and how Undo works. |
| `updatedAt` | `number` | Epoch ms of last local edit — equal to `createdAt` (append-only). LWW clock per row. |
| `belt` | `Belt` | `'white' \| 'blue' \| 'purple' \| 'brown' \| 'black'` — the IBJJF-style adult ladder, in order (`BELTS` in src/belts.ts). Triple-declared (see coupling table). |
| `stripes` | `number` | Integer 0–4 on colored belts; on black it counts **degrees**, 0–6 (src/belts.ts — `maxStripes`). The cap depends on the belt, so it is a cross-field rule: `isValidRank` in TS, `promotions_stripes_check` in SQL. |

**A correction is a new event, never an edit.** A mis-tapped promotion is fixed by re-entering its day with the right rank (Undo promotion does exactly that, dated on the promotion's day, however many days later) — the newer entry replaces the mistake in the timeline, so neither the since-date nor the history keeps a trace of it. Setting the current rank to its real, earlier date appends a backdated duplicate, which moves the "since" date back rather than changing the rank; an event dated before the latest one adds history without touching the current rank; an event dated in the future is refused by the editor and ignored by every reader until its date (src/belts.ts — `rankTimeline`). Nothing is ever edited or deleted, so the anon role's missing DELETE never matters. Promotions feed no stat and no XP — nothing in src/stats.ts or src/xp.ts reads them.

### `AppData`

| Field | Type | Semantics |
|---|---|---|
| `sessions` | `Session[]` | Chronological append order locally; merge appends remote-only rows sorted by `(date, createdAt)`. |
| `competitions` | `Competition[]` | Same. Absent from pre-competitions blobs (see `load()` below). |
| `promotions` | `Promotion[]` | Belt rank events, append order locally (merge appends remote-only rows the same way). Order is not meaningful: every reader goes through src/belts.ts — `rankTimeline` / `currentRank`. Absent from pre-belts blobs; `load()` drops entries without a valid id, `yyyy-mm-dd` date, numeric timestamps, or a valid rank. |
| `tagList` | `string[]` | User's tag vocabulary, input order. Display order is computed per-render by src/curriculum.ts — `orderTagsByCurriculum` (see [curriculum.md](curriculum.md)); the stored order is never rewritten. |
| `focus` | `FocusGoal` | `{ title, tag }`. `tag` is the tag whose current-week frequency drives the progress bar (weekly since 2026-10 — the "Focus this week" card); empty `tag` = no goal set. |
| `settings` | `Settings` | `{ weeklyGoal: number, showMilestones: boolean }`. |
| `stateUpdatedAt` | `number` | Single LWW clock for the whole `focus` + `tagList` + `settings` blob (contrast: per-row `updatedAt` for sessions/competitions/promotions). **`0` means "never touched locally"** and gates the `app_state` push in src/sync.ts — `pushAll`, so a fresh install cannot overwrite remote state with defaults. Every mutation of focus/tagList/settings must stamp it (`setFocus` / `addTag` in src/App.tsx do). |

### Ephemeral (never persisted)

`Tab` (`'dash' | 'history' | 'log' | 'tech' | 'progress'`), `GiFilter` (`'All' | 'Gi' | 'No-Gi'`), `LogMode` (`'training' | 'comp'`), `LogForm`, `CompForm` — all React state in src/App.tsx. `LogForm` carries seven round counts — `rolls` plus the six typed specific formats `specClosed`/`specOpen`/`specSide`/`specMount`/`specBack`/`specTurtle` (there is no `specific` form field: `saveSession` computes the stored total as their sum via `specBreakdownSum`; the subs steppers and their `subsFor`/`subsAgainst` form fields were removed 2026-10 — `saveSession` writes those session fields as 0) — plus `roundMin`, `durationMin`, `intensity`, `gi`, `tags`, `when`. Its defaults are `EMPTY_FORM` in src/App.tsx (`rolls: 0`, all six `spec*` counts `0`, `roundMin: 5`, `durationMin: 60`, `intensity: 3`, `gi: true`, `when: null`); the post-save reset zeroes all seven counts. `CompForm` defaults are `EMPTY_COMP_FORM` (`cardio: 0`, `gi: true`, `placement: 'none'`, empty `tags`). After a comp save, only `gi` survives the reset (sticky preference).

## localStorage blob (`rollbook:v1`)

src/store.ts — `STORAGE_KEY = 'rollbook:v1'`. The value is `JSON.stringify(AppData)`, written on **every** state change by the `useEffect` in src/store.ts — `useAppData` (`persist` swallows quota/private-mode errors; the app keeps working in memory). There is no debounce and no partial writes: whole blob, every change.

Reading is src/store.ts — `load()`, exported for tests; the app reaches it only through `useAppData`'s `useState(load)` initializer (i.e. read once per app boot).

## `load()` is the migration mechanism

There are no versioned migrations and no version bump planned — `load()` does **field-wise defaulting against `emptyData()`** and that is the entire schema-evolution story for the local blob:

- Whole-blob `JSON.parse` failure or missing key → fresh `emptyData()` (empty arrays, `DEFAULT_TAGS` copy, empty focus, `{ weeklyGoal: 2, showMilestones: true }`, `stateUpdatedAt: 0`).
- Missing/malformed top-level keys → per-key defaults (`Array.isArray` guards; `focus`/`settings` are spread-merged over the defaults so *new sub-fields added later* auto-heal; an empty `tagList` is replaced by `DEFAULT_TAGS`).
- Unknown keys in the stored blob are **dropped** — `load()` builds a fresh object literal, it does not spread `parsed`.
- Per-session backfills: pre-sync rows lacking `updatedAt` get `createdAt`; rows lacking `time` (pre-picker), `durationMin`, or `intensity` get `null`; rows lacking `specific` (pre-split) or any of the six format counts (pre-formats, or pre-dating side/back/turtle) get `0`. Malformed/out-of-range duration/RPE also heal to `null`, and a malformed/out-of-range `specific` or format count heals to `0` (each field independently — integer 0–1000 or it resets; the format counts share the `roundCount` helper).
- `competitions` missing (pre-feature blobs) → empty array. Per-comp backfills for pre-goals blobs: `placement` kept only when it is a whitelisted medal value (else `'none'`), `tags` kept only when an array (else `[]`).
- `promotions` missing (pre-belts blobs) → empty array. Malformed events are **dropped, not healed**: an entry survives only with a string `id` and `date`, numeric `createdAt`/`updatedAt`, and a rank passing src/belts.ts — `isValidRank` (known belt, integer stripes within that belt's cap). The rank is the event's whole meaning, so there is no safe default to heal to — the same drop-not-clamp rule as the pull sanitizer (see [sync.md](sync.md)).

**Consequence: adding a field to `Session` or `AppData` requires adding its default/backfill in `load()` in the same change**, or existing installs boot with `undefined` in that field. Adding a synced `Session` field additionally requires the SQL addendum + mapper work (see coupling table and [sync.md](sync.md)).

`DEFAULT_TAGS` (src/store.ts) is the 14-tag starter vocabulary; its members deliberately match the curriculum tables in src/curriculum.ts so a fresh install's tag sheet is fully ordered (see [curriculum.md](curriculum.md)).

`uid()` (src/store.ts): `crypto.randomUUID()` when available, else `base36(now)-base36(random)`. The remote `id` column is `text`, not `uuid`, so the fallback shape is legal remotely — keep it that way.

## The append-only rule

Sessions, competitions, and promotions are append-only per id **by design**, not by accident. For promotions the rule is also the correction story: a rank that needs changing gets a new event, never an edit (see `Promotion` above). Everything below silently depends on it:

- src/sync.ts — `pushAll` blindly upserts *all* local non-demo rows with `Prefer: resolution=merge-duplicates` and no read-back. Safe only because a row's content never changes after creation — a stale device re-pushing old rows writes identical bytes.
- Local `updatedAt === createdAt` always holds for app-created rows, so LWW ties resolve harmlessly.
- `mergeById` keeps local-only rows unconditionally (remote is never authoritative for deletions).

**Forbidden without sync rework** (each requires at minimum a pull-before-every-push so a stale device cannot resurrect or clobber, and a real conflict story):

| Feature | Why it breaks today |
|---|---|
| Edit a session/competition | A device that pushed before pulling overwrites the newer edit with its stale copy; LWW only helps if every push is preceded by a pull. |
| Delete a session/competition | The next push from any device that still has the row re-upserts it; `mergeById` on other devices re-appends it as "remote-only". Deletion needs tombstones, and the anon role has DELETE revoked besides. |
| Editing matches inside a competition | Same as edit — the comp row is the atomic unit, so any match change is a row edit. |
| Edit or delete a promotion (rank event) | Same as edit/delete above. Not needed either: a same-day entry already replaces a mistake in the timeline (`rankTimeline`), and the belt card's Undo and editor exist for exactly that. |

If you add any of these, update the model note at the top of src/sync.ts and this section together.

## Demo data (src/demo.ts — `demoData`)

Deterministic seed anchored to the runtime `todayIso`, loaded only via the console helper `window.rollbook.seed()` installed by src/App.tsx (`window.rollbook.clear()` resets to `emptyData()`). The app itself always starts empty.

Two layers:

1. **Showcase window** — the hardcoded `SHOWCASE` table, week offsets `0..-11` relative to `mondayOf(todayIso)`, reproduces the design handoff's dashboard *through the real stats functions*: week bars M4/W8/F6 (18 rounds — every demo session has `specific: 0`, so combined rounds equal rolls), an 11-week streak (week −11 holds the single-session streak breaker), a 30-day window of 11 sessions feeding the technique ranking (focus tag in 7 of them), a weekly focus readout of 1 tagged in the current week's 3 sessions (33% — pinned in `src/demo.test.ts`), and the prototype's exact 12-week volume chart `[12,15,10,18,14,9,16,20,13,17,15,18]`. The seed rows still carry historical sub tallies (`sf`/`sa`), which the UI shows only as the condensed per-row stat since sub counting was retired. Weeks −3..0 are the 30-day showcase; week −4 deliberately stays Mon–Fri so nothing leaks into the 30-day window. Editing `SHOWCASE` numbers breaks those derived readouts — verify against src/stats.ts, not by eye.
2. **PRNG filler** — weeks −12..−30, `mulberry32` with fixed seed `20260802`, clipped to the current calendar year (`jan1` guard both ends). `LIGHT_WEEKS` inserts sub-2-session weeks at −27/−20/−13 so no accidental long streak predates the showcase run. Volume lands between 300 and 430 rolls by early August — past the 250-round year milestone, which the demo therefore shows as achieved mid-year.

Sessions get ids `demo-0..n` (index after date-sort), `createdAt = updatedAt = ` 18:00 local on their date plus `i` ms (unique, stable ordering), `time: null`, `specific: 0` with an all-zero six-format breakdown (keeping every pinned demo number intact), `durationMin: 60`, and `intensity: 3`. Two showcase competitions get `demo-comp-0/1` (Saturdays 2 and 6 weeks back, same year guard); the Regional Open carries `placement: 'bronze'` and tags `De La Riva`/`Sweeps` while the no-gi comp stays `'none'`/untagged, so the demo milestone trio reads AJP pending / open guard achieved (pinned in `src/demo.test.ts`). Two rank events get `demo-promo-0/1` so the belt card has a history to show: white belt 4 stripes (a Wednesday 16 weeks back) then blue belt 0 stripes (a Thursday 3 weeks back), `createdAt = updatedAt =` 20:00 local on their date plus `i` ms, with the same year guard as the comps (pinned in `src/demo.test.ts`). The seeded `focus` is `{ title: 'Guard retention under pressure', tag: 'Guard retention' }`; `stateUpdatedAt` stays `0` via the `emptyData()` spread, so seeding never pushes app_state.

**Demo data is a local-only plaything** (rows only — the seed's `tagList`/`focus` are ordinary state and go up with the next stamped state edit; see [operations.md](operations.md) "Dev servers write to the live database"): `isPushable` excludes `demo-` ids from every push, and `mergeById` drops `demo-` ids arriving from remote — a real hand-tampered `demo-99` row was once found in the DB and was invisible in-app because of exactly these layers. Never reuse the `demo-` prefix for real data, and never generate real ids that start with it.

## Coupling table

| If you change… | You must also change… |
|---|---|
| Any `Session` field (add/rename) | src/store.ts — `load()` backfill; src/sync.ts — `toRow` + `fromRow` (with sanitization); supabase-schema.sql idempotent addendum (run **before** deploying — a missing sessions column 400s/PGRST204 and pushes fail strict, unlike the tolerated 404 for a whole missing competitions table); src/demo.ts session mapper; tests. |
| A specific-training format (add one) | Its `SPEC_FORMATS` entry and `SpecKey` member in src/specific.ts (key, Log label, history caption — the Log steppers, SessionRow captions, `specBreakdownSum` and so the `recoversBreakdown` tie-break all follow the list); the `Session` + `LogForm` field in src/types.ts; the `roundCount` backfill in `load()`; `EMPTY_FORM`, the `saveSession` copy, and the post-save reset in src/App.tsx; the `spec_*` column in src/sync.ts `SessionRow`/`toRow`/`fromRow` (`Math.min(1000, count(…))`); an SQL addendum applied **before** deploy; src/demo.ts zero; a deliberate `matchesSpecific` decision in src/xp.ts; tests (`specific.test.ts` order, `mk` factories). |
| Any `Competition`/`CompMatch` field (add/rename) | src/store.ts — `load()` (if defaulting needed); src/sync.ts — `toCompRow` + `fromCompRow`/`sanitizeMatches`; supabase-schema.sql idempotent addendum (a new **column** on the pushed competitions table must be applied **before** deploy — the tolerated 404 covers only the whole table missing, a missing column 400s the comp push); src/demo.ts comp seeds; tests. |
| Any `Promotion` field (add/rename) | src/store.ts — `load()` filter; src/sync.ts — `toPromoRow` + `fromPromoRow`; supabase-schema.sql idempotent addendum (a new **column** on the pushed promotions table must be applied **before** deploy, same as comps — the tolerated 404 covers only the whole table missing); src/demo.ts rank seeds; tests (`mkPromo` in `sync.test.ts`, `mkP` in `belts.test.ts`). |
| `Belt` union or a stripe cap (src/types.ts, src/belts.ts — `BELTS`/`maxStripes`) | `isValidRank` (the shared sanitizer leg for both `load()` and `fromPromoRow`); the `belt in (…)` check and `promotions_stripes_check` in supabase-schema.sql; `nextRank`/`rankLabel`/`promotionLabel` and `BELT_LABEL` in src/belts.ts; the `.belt--{belt}` color classes in src/app.css; `belts.test.ts` pinned ladder. |
| `RoundMin` union (src/types.ts) | `ROUND_MINS` whitelist in src/sync.ts; `round_min in (4,5,6,8)` check in supabase-schema.sql; roundMin picker in src/screens/Log.tsx; mat-hours math assumptions in [stats.md](stats.md). |
| `SessionIntensity` union | `SESSION_INTENSITIES` in src/sync.ts; `intensity between 1 and 5` check in supabase-schema.sql; session-RPE chips in src/screens/Log.tsx; parent training-hub importer bounds. |
| `CardioRating` union | `CARDIO_RATINGS` in src/sync.ts; `cardio between 0 and 5` check in supabase-schema.sql; the cardio control in src/screens/Log.tsx. |
| `Placement` union | `PLACEMENTS` in src/sync.ts; `placement in ('none','bronze','silver','gold')` check in supabase-schema.sql; the podium chip row in src/screens/Log.tsx; the `PLACEMENT_LABEL` maps in src/components/CompRow.tsx and src/stats.ts; the `load()` backfill whitelist in src/store.ts. |
| `CompOutcome` union | `OUTCOMES` in src/sync.ts; outcome UI in src/screens/Log.tsx. |
| The `'HH:MM'` time format | The regex in src/sync.ts — `fromRow` and the SQL `"time" ~ …` check (must accept/reject identically); src/dates.ts — `toHhmm`/`fmtTime`/`resolveWhen`. |
| `focus`/`tagList`/`settings` shape | src/sync.ts — `fromStateRow` defaults and the `pushAll` app_state payload; `load()`'s spread-merge covers local healing automatically. |
| `DEFAULT_TAGS` | Curriculum ordering coverage in src/curriculum.ts ([curriculum.md](curriculum.md)); src/demo.ts tag pools (`SHOWCASE`, `FILLER_TAGS`) which assume these names. |
| `STORAGE_KEY` (`rollbook:v1`) | Don't — existing installs would lose their data. A bump would need an explicit old-key read-and-migrate in `load()`. |
| Append-only assumption (any edit/delete feature, for any of the three entities) | src/sync.ts push model (pull-before-every-push at minimum), the header comment in src/sync.ts, and this document. |

Siblings: [architecture.md](architecture.md) · [sync.md](sync.md) · [stats.md](stats.md) · [curriculum.md](curriculum.md) · [design-system.md](design-system.md) · [build-pwa.md](build-pwa.md) · [testing.md](testing.md) · [operations.md](operations.md)
