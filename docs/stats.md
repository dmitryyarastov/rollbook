# Stats

All derived numbers on screen come from `src/stats.ts`. Every function is pure and side-effect-free; anything time-dependent takes `todayIso` (a local `yyyy-mm-dd` string) as an explicit parameter. Date arithmetic comes from `src/dates.ts` (local-parts only; `toISOString()`/UTC APIs are banned for calendar dates — see [architecture.md](architecture.md)). Weeks are Monday–Sunday everywhere.

## Contracts that hold across the whole module

- **No stats function reads the clock.** The `todayIso` every stat consumes comes from one place: `src/App.tsx — useTodayIso`, which produces it from `toIso(new Date())` and refreshes it on a 60-second interval (so the app rolls over midnight without a reload). (One other render-path clock exists — `src/screens/Log.tsx — WhenCard` reads `new Date()` on a 30-second interval for its today/yesterday caption — but it never feeds stats.) `yearMilestone` constructs a `Date` from parts for pace projection, but never reads "now". This is what makes `src/stats.test.ts` timezone- and clock-proof: every test passes a fixed `todayIso`.
- **Competitions cannot affect stats — enforced at the type level.** Every aggregate (`weekSummary`, `streak`, `subs30d`, `tagCounts30d`, `focusProgress`, `volume12w`, `yearTotals`, all milestones) takes `Session[]` only. `Competition` appears in exactly one export, `historyFeed`, whose output is a tagged `HistoryEntry` union used purely for rendering the interleaved history list. Comps are history-only by design; a comp can never move streak/hours/rounds even by accident. Keep this: never widen a stats signature to accept `Competition`.
- **Mat hours are a deliberate lower bound.** `sessionMinutes = s.rolls * s.roundMin`; `sessionHours` divides by 60. Only logged sparring rounds count — warm-ups, drilling, and technique time are excluded on purpose. UI labels ("mat hours" in `src/screens/Home.tsx`, "Mat hours · year" in `src/screens/Progress.tsx`) accept this undercount; do not "fix" it by adding a per-session duration.
- **30-day windows are inclusive of both ends**: `last30d` filters `date >= addDays(todayIso, -29) && date <= todayIso` — exactly 30 calendar days ending today. Tested boundary: day −29 in, day −30 out.
- **All sorts are non-mutating** (spread-copy before `.sort`).

## Function reference

### `sessionMinutes(s)`, `sessionHours(s)`
`rolls * roundMin` and that over 60. `RoundMin` is the triple-declared whitelist `4|5|6|8` (`src/types.ts`, `src/sync.ts` pull sanitizer, `supabase-schema.sql` check — see [data-model.md](data-model.md)); changing it changes hours math here.

### `formatHours(h)`
Rendering rule from the design handoff: below 10, one decimal (`Math.round(h*10)/10` then `toString()`, so `3.0` renders `"3"` not `"3.0"`); at 10 and above, rounded integer. The branch tests the raw value, so 9.96 still renders `"10"` via the decimal branch. Used by Home (week hours) and Progress (year hours).

### `sortByDateDesc(sessions)`
Date desc, then `createdAt` desc within a date. Module-private `sortByDateAsc` is the mirror, used by the milestone crossing scans.

### `historyFeed(sessions, competitions)` → `HistoryEntry[]`
Interleaves both kinds newest-first: date desc, then `createdAt` desc, then — only on an **exact** date+createdAt tie — competition before session. Rationale: the comp is the headline event of the day, and the rule makes tests deterministic. The `kind` tiebreak never fires unless both earlier comparisons are 0. Consumers: `src/screens/Sessions.tsx` (full feed, gi-filtered), `src/screens/Home.tsx` (top 3).

### `last30d(sessions, todayIso)`
The shared 30-day inclusive window (semantics above). `subs30d`, `tagCounts30d`, and `focusProgress` all delegate to it — change the window here and all three (plus the 30-day UI copy: "Subs · 30d" in Home, "last 30 days" in Techniques' subtitle and `src/components/FocusCard.tsx`) move together.

### `weekSummary(sessions, todayIso)`
Current Monday–Sunday week: total rolls, hours (`sessionHours` sum), session count, and `bars` — seven `{day, rolls}` entries Mon..Sun with display letters `M T W T F S S` (letters repeat; renderers must key by index, not letter). Future days of the week are naturally zero.

### `streak(sessions, goal, todayIso)` → `{ weeks, sinceIso }`
The **display** streak: consecutive weeks with ≥ `goal` sessions, walking back week-by-week from the current Monday. The current week counts as soon as it qualifies, and an **unfinished current week never breaks the streak** — if it hasn't hit `goal` yet, counting simply starts from last week. Contiguity is strict: current week qualifying but last week failing gives `weeks = 1`. `sinceIso` is the Monday of the earliest week in the streak, `null` when `weeks = 0`. `goal` is `Settings.weeklyGoal` threaded from callers (Home, Progress; `milestones` threads the same goal to `streakMilestone`, not to `streak`).

### `subs30d(sessions, todayIso)`
Sums `subsFor` / `subsAgainst` over `last30d`.

### `tagCounts30d(sessions, todayIso)`
Per-tag session counts over `last30d`, sorted count desc then `localeCompare` name asc. Counts one per occurrence in `s.tags`; session tag arrays are deduplicated at form level, so this equals sessions-containing-tag. Feeds the Techniques cloud.

### `withSessionTags(tagList, sessions)`
Master tag list plus any tag referenced by a session but absent from the list, appended after the master order in session-iteration order. **Rationale (blob sync):** `tagList` lives in the app_state blob under a single `stateUpdatedAt` LWW clock ([sync.md](sync.md)); a racing list edit on another device can wholesale replace the list and drop a tag that logged sessions still reference. This function guarantees a tag you've logged with stays visible and toggleable regardless. Returns the **same reference** when nothing is missing (pinned by a test). Both consumers (`src/App.tsx — logTagList`, Techniques sections) call it *inside* `useMemo`s keyed on `data.tagList`/`data.sessions`, so nothing currently depends on that identity — it makes the output safe to use as a dep later. Output is then ordered/grouped by [curriculum.md](curriculum.md) logic (`orderTagsByCurriculum` / `groupTagsByCurriculum`), which sends unknown tags to a trailing Other group.

### `focusProgress(sessions, focusTag, todayIso)` → `{ pct, tagged, total }`
Share of `last30d` sessions carrying `focusTag`. Empty `focusTag` short-circuits to an empty pool → `{0, 0, 0}`. `pct` is `Math.round(100 * tagged / total)`, 0 when the pool is empty.

### `volume12w(sessions, todayIso)`
Rolls per Monday–Sunday week for the 12 weeks ending with the **current** week, oldest first. The last bucket is the in-progress week, so it undercounts until Sunday — that is expected chart behavior, not a bug.

### `yearTotals(sessions, todayIso)`
Hours and rolls for sessions whose `date` starts with the current year string.

## Milestones

`milestones(sessions, goal, todayIso)` returns `[quarterMilestone, streakMilestone, yearMilestone]` in the order Progress renders them. Each returns `{ achieved, title, sub }`. Targets are module constants `QUARTER_TARGET = 100`, `STREAK_TARGET = 10`, `YEAR_TARGET = 500`; each `title`/`sub` string interpolates its constant, so on-screen copy follows a constant change automatically — the milestone tests are what hard-code the rendered numbers.

### `quarterMilestone`
100 rolls inside one calendar quarter. Scans sessions date-ascending, keeping a running total per quarter key; records the date of every crossing and reports the **most recent** crossing (`sub: "Hit Aug 1"` via `fmtShort`). Not achieved → `"{n} / 100 this quarter"` for the quarter containing `todayIso`. Internal `quarterKey` is `YYYY-Q0..Q3` (**zero-based**, never displayed — keep that in mind if it ever leaks into UI).

### `streakMilestone`
Ten consecutive **completed** weeks meeting `goal`. This is stricter than the display `streak`: it iterates Mondays from the earliest logged week through `addDays(mondayOf(todayIso), -7)` (last completed week) only — an in-progress current week never counts toward the milestone even when it already qualifies (tested: 9 completed + qualifying current week = not achieved, while the display streak would show 10). Achieved date is the Monday **after** the 10th week wraps (`addDays(w, 7)`). Not achieved → `"{run} / 10 weeks"` where `run` is the trailing run of consecutive qualifying completed weeks (resets to 0 at any gap — the honest progress figure). Monday iteration compares iso strings, valid because the format is fixed-width.

### `yearMilestone`
500 rolls in the calendar year. Ascending scan; achieved at the session whose rolls cross the target (`sub: "Hit {date}"`). Not achieved → `"{cum} / 500"`, plus, when `cum > 0`, a linear pace projection: `crossingDoy = ceil(dayOfYear(todayIso) * 500 / cum)`; if ≤ 365 the sub appends `" — on pace for {monthFull}"` where the month comes from `new Date(year, 0, crossingDoy)` (local day-overflow arithmetic, no clock read). Projections past day 365 render no pace clause (a Dec-31 landing in a leap year, doy 366, is also suppressed — accepted simplification; you're barely on pace anyway).

## Coupling table

| If you change… | You must also change… |
| --- | --- |
| `last30d` window length/inclusivity | `subs30d`, `tagCounts30d`, `focusProgress` semantics inherit it; 30-day copy ("Subs · 30d" in `src/screens/Home.tsx`, "last 30 days" in `src/screens/Techniques.tsx` and `src/components/FocusCard.tsx`); boundary tests in `src/stats.test.ts` |
| Week start (`src/dates.ts — mondayOf`) | `weekSummary` bars, `streak`, `streakMilestone`, `volume12w`, and the `M T W T F S S` letters in `weekSummary` |
| `RoundMin` union (`src/types.ts`) | `sessionMinutes` hours math; the pull-sanitizer whitelist in `src/sync.ts` and the SQL check in `supabase-schema.sql` ([data-model.md](data-model.md)) |
| `QUARTER_TARGET` / `STREAK_TARGET` / `YEAR_TARGET` | Milestone tests in `src/stats.test.ts`, which hard-code the rendered strings (the `title`/`sub` copy interpolates the constants and follows automatically) |
| `milestones()` array order | Progress screen render order (it maps the array directly) |
| `historyFeed` tie rules | The comp-first determinism tests; any snapshotting of Home's top-3 feed |
| `withSessionTags` same-reference return | The same-reference test in `src/stats.test.ts` (consumers in `src/App.tsx` / `src/screens/Techniques.tsx` memoize on the raw inputs, not on this identity) |
| `formatHours` thresholds | The design renderings it matches ([design-system.md](design-system.md)); Home and Progress hour tiles |
| `useTodayIso` (moving/removing the interval) | Midnight rollover behavior of every stat on screen |

## Testing

`src/stats.test.ts` covers each edge named above with fixed `todayIso` values — window boundaries, unfinished-week streak behavior, completed-weeks-only milestone rule, pace-clause presence/absence, comp-first tie, same-reference `withSessionTags`. Extend it whenever a rule here changes; see [testing.md](testing.md) for conventions (`npm test` + `npm run build` must be green before any commit).
