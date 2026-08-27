# Architecture

Rollbook is a single-user, mobile-first BJJ training tracker PWA: React 18 + TypeScript strict + Vite, no router, no state library, no supabase-js. `localStorage` (`rollbook:v1`) is the UI's source of truth; Supabase PostgREST sync is a background convenience layered on top (see [sync.md](sync.md)). The whole app is one React tree rooted at `src/App.tsx`; everything below it is props down / callbacks up. There is deliberately no context, no reducer, no global store — `AppData` is small enough that a single `useState` plus immutable functional updates covers it.

## Module map

Every file in `src/`, one responsibility each:

| File | Responsibility |
|---|---|
| `src/main.tsx` | Entry point: imports Inter 400/500 (self-hosted @fontsource), `nocturne.css`, `app.css`; mounts `<App/>` in StrictMode; registers `sw.js` in prod builds only (failure swallowed — offline is a nice-to-have). |
| `src/App.tsx` | Composition root. Owns all tab-surviving transient UI state, all mutation actions (`saveSession`, `saveComp`, `addTag`, `setFocus`), tab switching, the `useTodayIso` minute clock, and the `window.rollbook` seed/clear helpers. Default export `App`. |
| `src/store.ts` | Persistence: `STORAGE_KEY` (`rollbook:v1`), `DEFAULT_TAGS`, `emptyData`, `load` (parse + per-field defaulting = the schema-migration idiom, see [data-model.md](data-model.md)), `persist`, the `useAppData` hook, `uid`. |
| `src/types.ts` | The entire domain vocabulary: `Session`, `Competition`, `CompMatch`, `AppData`, `FocusGoal`, `Settings`, form types (`LogForm`, `CompForm`), UI unions (`Tab`, `GiFilter`, `LogMode`), value whitelists (`RoundMin`, `CardioRating`, `CompOutcome`). |
| `src/dates.ts` | Local-date helpers (`toIso`, `parseIso`, `addDays`, `mondayOf`, formatters, `resolveWhen`, `autoTitle`, `toHhmm`, `fmtTime`). Enforces the project-wide ban on UTC APIs for calendar dates; weeks are Monday-start. |
| `src/stats.ts` | Every derived number on screen, as pure functions of `(Session[], todayIso)` — competitions are type-excluded so they can never affect stats (see [stats.md](stats.md)). Also `historyFeed` (the one function that takes competitions, for display interleaving) and `withSessionTags`. |
| `src/curriculum.ts` | Gracie Barra curriculum grouping/ordering of technique tags: `CURRICULUM_GROUPS`, `groupOfTag`, `groupTagsByCurriculum`, `orderTagsByCurriculum`. Display-time only; exact-name lookup, no heuristics (see [curriculum.md](curriculum.md)). |
| `src/demo.ts` | `demoData(todayIso)` — deterministic demo seed (explicit showcase window + mulberry32 PRNG filler) reproducing the design handoff's dashboard through the real stats functions. All ids are `demo-` prefixed so they never sync. |
| `src/sync.ts` | Pure sync core + IO shell: row mappers (`toRow`/`fromRow`, `toCompRow`/`fromCompRow`, `fromStateRow` — pull side sanitizes untrusted remote data), LWW merge (`mergeById` generic → `mergeSessions`/`mergeCompetitions`, `mergeAppData`), `isPushable`, `pullAll`/`pushAll` (plain `fetch` against PostgREST). No React in here. |
| `src/useSync.ts` | Scheduling side of sync: `useSync` hook — launch cycle, 2 s trailing-debounced `requestPush`, `online` and throttled `visibilitychange` triggers, `SyncStatus` state. |
| `src/config.ts` | Supabase constants (`SUPABASE_URL`, `SUPABASE_ANON_KEY` — public by design, `SYNC_USER_ID='dmitrii'`) and the `SYNC_ENABLED` kill switch (empty strings = fully local app). |
| `src/nocturne.css` | Nocturne design-system tokens + base styles, transcribed from the handoff (Google Fonts @import dropped in favor of @fontsource). Do not edit casually — see [design-system.md](design-system.md). |
| `src/app.css` | All component CSS, appended as ordered `/* ── section ── */` blocks, BEM-lite class names. The faithful transcription of the design handoff. |
| `src/vite-env.d.ts` | Vite client type reference. |
| `src/components/TabBar.tsx` | Bottom nav: the `TABS` array (id/label/icon), renders the five tab buttons, `aria-current` on the active one. |
| `src/components/Chip.tsx` | Toggle chip (`filter`/`dur`/`tech` size variants), `aria-pressed`. |
| `src/components/Stepper.tsx` | +/− stepper button (`lg`/`sm`, optional accent). |
| `src/components/SessionRow.tsx` | Session history row; optional expanded accordion panel (subs, round length, tags). Root is a `<button>`, children are `<span>`s (valid HTML inside a button). |
| `src/components/CompRow.tsx` | Competition history row, same accordion pattern; computes the W-L(-D) record, shows matches/cardio/notes when expanded. |
| `src/components/FocusCard.tsx` | "Focus this month" card, shared by Home and Techniques (`variant` prop moves the % readout); pencil toggle opens the inline edit panel (title input + curriculum-ordered linked-tag picker). |
| `src/screens/Home.tsx` | Dashboard: week hero + bars, streak and subs-30d cards, FocusCard, 3 most recent history entries, sync-status label. |
| `src/screens/Sessions.tsx` | Full history feed with Gi/No-Gi filter chips and the expand/collapse accordion. |
| `src/screens/Log.tsx` | Both log forms: training (WhenCard, rounds, subs, tag chips + inline new-tag input) and competition (`CompFields`, `MatchEditor`, `WhenCard` lives here too as a private component). Owns `SCHEDULED_SLOTS` (19:30 / 20:30) and mirrors sync's `MAX_MATCHES=50` cap. |
| `src/screens/Techniques.tsx` | 30-day most-worked bars + the all-tags cloud grouped by curriculum section, plus the FocusCard. |
| `src/screens/Progress.tsx` | Streak ring, 12-week volume bars, year totals, milestones (gated on `settings.showMilestones`). |
| `src/*.test.ts` | Vitest suites colocated with their subjects: `dates`, `stats`, `store`, `sync`, `curriculum`, `demo` (see [testing.md](testing.md)). |

Outside `src/`: `index.html` (shell + manifest link), `public/sw.js` + `public/manifest.webmanifest` + `public/icons/` (PWA shell), `scripts/sw-precache.mjs` and `scripts/make-icons.mjs` (build helpers), `vite.config.ts` (`base:'./'` for the GitHub Pages `/rollbook/` mount, vitest `environment:'node'`), `supabase-schema.sql` (owner-run DDL + addenda). Details in [build-pwa.md](build-pwa.md) and [operations.md](operations.md).

## State ownership

**Persistent state** — exactly one owner: `App` holds the full `AppData` via `src/store.ts — useAppData`. `useAppData` initializes from `load()` (localStorage parse with per-field defaulting), exposes a stable `update(fn)` (functional immutable updates only), and a `useEffect` persists every change back to `rollbook:v1`. Nothing else reads or writes localStorage. `AppData` = `sessions` + `competitions` (append-only entity arrays, per-row `updatedAt`) + the state blob (`tagList`, `focus`, `settings`, stamped by the single `stateUpdatedAt` clock — see [sync.md](sync.md) for the two-clock model, [data-model.md](data-model.md) for shapes). There is no settings UI by design; `weeklyGoal`/`showMilestones` are storage-only knobs.

**Transient state hoisted to `App`** (survives tab switches on purpose):

- `tab: Tab` — the active screen.
- `expandedId` — which history row's accordion is open (shared by the Home→Sessions deep link).
- `filter: GiFilter` — Sessions screen filter.
- `form: LogForm` — the training log form. After save, counts/tags/`when` reset but `gi`/`roundMin` persist (sticky preferences vs per-session facts).
- `logMode: LogMode` + `compForm: CompForm` — Log screen mode toggle and the competition form; both forms keep their state across a mode switch.
- `saved` — the post-save confirmation flag; cleared by any form edit, mode switch, or tab switch.

**Transient state that stays local** (resets when its component unmounts — including on every tab switch, because of the `key={tab}` remount, see below):

- `FocusCard` — `editing` (is the inline edit panel open).
- `Log` — `adding` + `newTag` + the `committed` ref (the inline new-tag input; the ref dedupes Enter-then-blur double commits).
- `WhenCard` (private to `src/screens/Log.tsx`) — `now`, a 30-second-interval live clock so the "today/yesterday" caption tracks the wall clock the same way save-time `resolveWhen` will.
- `App`'s `useTodayIso` — `todayIso`, re-evaluated every 60 s; since `toIso` returns an identical string until midnight, React's `Object.is` bailout means the interval only causes a real re-render at the date rollover.
- `useSync` — `status: SyncStatus`, plus refs (`dataRef`, debounce timer, StrictMode launch guard, visibility throttle timestamp).

## Data flow

One write path. A user action in a screen calls a callback prop; the callback lives in `App` and calls `update(fn)` with an immutable transform (`saveSession` appends a `Session` built from `form` — `resolveWhen` picks the concrete start datetime, `autoTitle`/`toIso`/`toHhmm` derive title/date/time; `saveComp` appends a `Competition`; `addTag` appends to `tagList` and stamps `stateUpdatedAt`; `setFocus` replaces `focus` and stamps `stateUpdatedAt`). React commits the new `AppData`; the `useAppData` persist effect writes it to localStorage synchronously after render. Mutating call sites then call `requestPush()` — a 2-second trailing debounce in `src/useSync.ts — useSync` that collapses bursts and, at fire time, reads the freshest data from a ref and calls `src/sync.ts — pushAll`, which blindly upserts all non-demo rows to PostgREST (`Prefer: resolution=merge-duplicates`). The blind push is safe only because sessions and competitions are append-only per id — an edit/delete feature requires pull-before-every-push first ([sync.md](sync.md)).

The read-back path: `useSync` runs a `cycle()` (pull → merge → push-back) at launch (once, StrictMode-guarded), on regaining `online`, and on `visibilitychange` to visible throttled to once per 60 s (the "switched devices" moment for an installed PWA). `pullAll` fetches sessions/competitions/app_state, sanitizes every row through the `fromRow`/`fromCompRow`/`fromStateRow` mappers (remote is untrusted), and the merge happens **inside** the functional updater — `update((d) => mergeAppData(d, remote))` — so a session saved while the pull was in flight is present in `d` and survives. Sync failures only flip the status label; the UI never blocks on the network.

## Render paths

`App` is the only stateful ancestor of the screens, so every App-level state change (data or hoisted UI state) re-renders `App` and its currently mounted screen; there is no memoized component boundary below it. (Component-local state — FocusCard `editing`, WhenCard's clock — re-renders only its own component.)

- **Every keystroke in Log re-renders `App`** (form state is hoisted). The expensive derivation on that path — curriculum-ordering the tag list — is `useMemo`'d in `App` (`logTagList`, deps `data.tagList`/`data.sessions`), so keystrokes re-run only cheap JSX.
- Screens guard their own per-interaction paths with `useMemo`: `Sessions` memoizes the filtered `historyFeed` (accordion toggles re-render the screen but not the feed computation), `Home` memoizes week/streak/subs/recent, `Techniques` memoizes counts + curriculum sections. `Progress` computes inline — it has no per-keystroke/per-toggle interactions, only data/`todayIso` changes.
- `React.memo` on row components was **deliberately rejected**: it would force API churn (stable per-row handlers) and row render cost is negligible at realistic n. Do not add it reflexively.
- Recurring re-renders: sync status transitions (a handful per cycle); the `WhenCard` clock every 30 s while the training log form is mounted; `useTodayIso` only at midnight (see bailout note above).

## Tab model (no router)

Navigation is plain state: `Tab = 'dash' | 'history' | 'log' | 'tech' | 'progress'` (`src/types.ts`), a `tab` useState in `App`, conditional rendering of exactly one screen, and `src/components/TabBar.tsx` at the bottom. No URLs, no history integration — back button behavior is the browser's, by design for an installed PWA. The `<main className="screens" key={tab}>` wrapper is **keyed by tab**, so switching remounts the subtree: scroll position resets (per the handoff) and screen-local state (FocusCard `editing`, Log's new-tag input, WhenCard's clock) resets — while everything meant to survive a switch is hoisted to `App` (see State ownership). `pickTab` also clears `saved`. Cross-screen navigation exists in exactly two places: Home's "See all" (`pickTab('history')`) and a recent-row tap (`openSession(id)`: sets `expandedId` and jumps to Sessions; on Sessions itself the same handler toggles the accordion). Adding a screen = extend the `Tab` union, add a `TABS` entry, add a conditional branch in `App` — nothing else.

## `window.rollbook` helpers

An `App` effect installs `window.rollbook = { seed, clear }` (removed on unmount). `seed()` replaces the entire `AppData` with `demoData(today)`; `clear()` replaces it with `emptyData()`. Both flow through the normal `update` → persist path, so they overwrite localStorage. Neither touches the remote: `demo-` ids are filtered by `isPushable` in both push and merge directions, and neither helper calls `requestPush`. Consequence worth knowing: on a device with sync enabled, `clear()` empties local state but the next pull cycle merges every real remote row back in — local clearing is not remote deletion (the app cannot delete remote rows at all; see [operations.md](operations.md)).

## Where do I add…

| Change | Touch points | Full playbook |
|---|---|---|
| A new screen | `Tab` union in `src/types.ts`; `TABS` in `src/components/TabBar.tsx`; a conditional branch in `src/App.tsx`; a `src/screens/*.tsx` file; a new `/* ── section ── */` CSS block appended to `src/app.css`. Hoist to `App` any state that must survive tab switches. | [design-system.md](design-system.md) for the CSS rules |
| A new field on `Session` | `src/types.ts — Session`; defaulting in `src/store.ts — load` (old blobs lack it); `src/sync.ts — toRow` + `fromRow` (with a sanitizer); a column addendum in `supabase-schema.sql` **applied before deploy** (missing column = 400 = loud sync error); form plumbing in `src/types.ts — LogForm` / `src/App.tsx — saveSession` / `src/screens/Log.tsx`; tests. If the value set is a whitelist it is triple-declared: TS union + pull sanitizer + SQL CHECK, in lockstep. | [data-model.md](data-model.md) + [sync.md](sync.md) |
| A new derived stat | A pure function in `src/stats.ts` taking `(Session[], …, todayIso)` — never `Competition[]`, never `new Date()` inside; render it in a screen (wrap in that screen's `useMemo` if it sits on a per-toggle path); a test in `src/stats.test.ts`. | [stats.md](stats.md) |
| A new synced entity | Model on `Competition`: type in `src/types.ts` (with `id`/`date`/`createdAt`/`updatedAt` so `mergeById` applies); array on `AppData` + `load` defaulting; mappers + merge wiring in `src/sync.ts` (`pullAll`/`pushAll`, tolerate 404 while the table doesn't exist yet); a table addendum in `supabase-schema.sql` with RLS and DELETE revoked; keep it append-only per id or add pull-before-push. | [sync.md](sync.md) + [operations.md](operations.md) |
| A new technique-tag mapping | `TAG_GROUP` in `src/curriculum.ts` (lower-case key) + `src/curriculum.test.ts`. Unknown tags already fall into the trailing Other group by design. | [curriculum.md](curriculum.md) |
| Anything under `public/sw.js` / the build | Mind the precache contract: `scripts/sw-precache.mjs` text-replaces the two `const CACHE`/`const PRECACHE` lines — keep their exact shape. | [build-pwa.md](build-pwa.md) |
