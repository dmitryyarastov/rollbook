# Stats

All derived numbers on screen come from `src/stats.ts`. Every function is pure and side-effect-free; anything time-dependent takes `todayIso` (a local `yyyy-mm-dd` string) as an explicit parameter. Date arithmetic comes from `src/dates.ts` (local-parts only; `toISOString()`/UTC APIs are banned for calendar dates — see [architecture.md](architecture.md)). Weeks are Monday–Sunday everywhere.

## Contracts that hold across the whole module

- **No stats function reads the clock.** The `todayIso` every stat consumes comes from one place: `src/App.tsx — useTodayIso`, which produces it from `toIso(new Date())` and refreshes it on a 60-second interval (so the app rolls over midnight without a reload). (One other render-path clock exists — `src/screens/Log.tsx — WhenCard` reads `new Date()` on a 30-second interval for its today/yesterday caption — but it never feeds stats.) `yearMilestone` constructs a `Date` from parts for pace projection, but never reads "now". This is what makes `src/stats.test.ts` timezone- and clock-proof: every test passes a fixed `todayIso`.
- **Competitions cannot move training aggregates — enforced at the type level.** Every aggregate (`weekSummary`, the `weeklyStreak` family, `subs30d`, `tagCounts30d`, `focusProgress`, `volume12w`, `yearTotals`, `yearMilestone`) takes `Session[]` only. `Competition` appears only in deliberate, bounded exports: `historyFeed`, whose output is a tagged `HistoryEntry` union used purely for rendering the interleaved history list, and the goal milestones `medalMilestone` / `openGuardMilestone` — which read competition `placement`/`tags` as goal evidence — plus the `milestones` wrapper that threads them. A comp can still never move streak/hours/rounds/subs even by accident. Keep this: never widen a training-aggregate signature to accept `Competition`.
- **Mat hours are a deliberate lower bound.** `sessionMinutes = s.rolls * s.roundMin`; `sessionHours` divides by 60. Only logged sparring rounds count — warm-ups, drilling, and technique time are excluded on purpose. UI labels ("mat hours" in `src/screens/Home.tsx`, "Mat hours · year" in `src/screens/Progress.tsx`) accept this undercount; do not "fix" it by adding a per-session duration.
- **30-day windows are inclusive of both ends**: `last30d` filters `date >= addDays(todayIso, -29) && date <= todayIso` — exactly 30 calendar days ending today. Tested boundary: day −29 in, day −30 out.
- **All sorts are non-mutating** (spread-copy before `.sort`).

## Function reference

### `sessionMinutes(s)`, `sessionHours(s)`
`rolls * roundMin` and that over 60. `RoundMin` is the triple-declared whitelist `4|5|6|8` (`src/types.ts`, `src/sync.ts` pull sanitizer, `supabase-schema.sql` check — see [data-model.md](data-model.md)); changing it changes hours math here.

### `formatHours(h)`
Rendering rule from the design handoff: below 10, one decimal (`Math.round(h*10)/10` then `toString()`, so `3.0` renders `"3"` not `"3.0"`); at 10 and above, rounded integer. The branch tests the raw value, so 9.96 still renders `"10"` via the decimal branch. Used by Home (week hours) and Progress (year hours).

### `sortByDateDesc(sessions)`
Date desc, then `createdAt` desc within a date. Module-private `sortByDateAsc` is the mirror, used by the `yearMilestone` crossing scan (the competition milestones have their own generic `byDateAsc` over `{ date }`).

### `historyFeed(sessions, competitions)` → `HistoryEntry[]`
Interleaves both kinds newest-first: date desc, then `createdAt` desc, then — only on an **exact** date+createdAt tie — competition before session. Rationale: the comp is the headline event of the day, and the rule makes tests deterministic. The `kind` tiebreak never fires unless both earlier comparisons are 0. Consumers: `src/screens/Sessions.tsx` (full feed, gi-filtered), `src/screens/Home.tsx` (top 3).

### `last30d(sessions, todayIso)`
The shared 30-day inclusive window (semantics above). `subs30d`, `tagCounts30d`, and `focusProgress` all delegate to it — change the window here and all three (plus the 30-day UI copy: "Subs · 30d" in Home, "last 30 days" in Techniques' subtitle and `src/components/FocusCard.tsx`) move together.

### `weekSummary(sessions, todayIso)`
Current Monday–Sunday week: total rolls, hours (`sessionHours` sum), session count, and `bars` — seven `{day, rolls}` entries Mon..Sun with display letters `M T W T F S S` (letters repeat; renderers must key by index, not letter). Future days of the week are naturally zero.

### `weeklyStreak(sessions, todayIso, qualifies)` → `{ weeks, sinceIso }`
The generalized week-walk behind every flame row on the Progress screen: buckets sessions by Monday (module-private `sessionsByWeek`), then counts consecutive weeks whose session list satisfies `qualifies`, walking back from the current Monday. The current week counts as soon as it qualifies, and an **unfinished current week never breaks the streak** — if it doesn't qualify yet, counting simply starts from last week. Contiguity is strict: current week qualifying but last week failing gives `weeks = 1`. `sinceIso` is the Monday of the earliest week in the streak, `null` when `weeks = 0`. The three exports below are thin `qualifies` wrappers over it — new streak flavors should be too.

### `streak(sessions, goal, todayIso)`
The original **display** streak: `weeklyStreak` with `week.length >= goal`. `goal` is `Settings.weeklyGoal` threaded from callers (Home, Progress).

### `giNoGiStreak(sessions, todayIso)`
`weeklyStreak` with "at least one gi AND one no-gi session in the week".

### `focusStreak(sessions, focusTag, todayIso)`
`weeklyStreak` with "at least one session tagged `focusTag`" (exact membership via `s.tags.includes`, same matching as `focusProgress`). An empty `focusTag` short-circuits to `{ weeks: 0, sinceIso: null }` — no focus goal set. Progress renders all three as `.frow` flame rows ([design-system.md](design-system.md)): `streak(goal)`, `giNoGiStreak`, `focusStreak(data.focus.tag)`.

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

`milestones(sessions, competitions, todayIso)` returns `[medalMilestone, openGuardMilestone, yearMilestone]` in the order Progress renders them. Each returns `{ achieved, title, sub }`. The first two are the season's competition goals and take `Competition[]` only — the deliberate exception to the `Session[]`-only rule (contract above); `yearMilestone` takes `Session[]` only. The year target is the module constant `YEAR_TARGET = 250`, recalibrated 2026-08-30 from live pace (~11.2 rolls/week with 17.6 weeks left projected ~237–251 by Dec 31; the original 500 needed a fantasy ~28/week — the rationale comment sits on the constant). `title`/`sub` interpolate the constant, so on-screen copy follows a constant change automatically — the milestone tests are what hard-code the rendered numbers.

### `medalMilestone(competitions)`
Goal: podium at AJP World Pro Amateurs. Achieved by the **earliest** competition (date-asc via `byDateAsc`) whose title matches `/ajp/i` AND whose `placement !== 'none'` — a medal at a non-AJP comp shows on its own history row but does not complete this goal. Achieved → `"{Bronze|Silver|Gold} at {title} — {fmtShort(date)}"` (labels from the module's `PLACEMENT_LABEL`). Not achieved → `"No AJP podium yet"`.

### `openGuardMilestone(competitions)`
Goal: play open guard in competition. Achieved by the **earliest** competition carrying any open-guard-family tag — `c.tags.find(isOpenGuardTag)` against the `OPEN_GUARD_TAGS` whitelist in src/curriculum.ts (closed and half guard deliberately excluded; see [curriculum.md](curriculum.md)). Achieved → `"{tag} at {title} — {fmtShort(date)}"`, with the tag in the comp's own spelling. Not achieved → `"Play it, then tag it on the comp entry"`.

### `yearMilestone`
250 rolls in the calendar year. Ascending scan; achieved at the session whose rolls cross the target (`sub: "Hit {date}"`). Not achieved → `"{cum} / 250"`, plus, when `cum > 0`, a linear pace projection: `crossingDoy = ceil(dayOfYear(todayIso) * 250 / cum)`; if ≤ 365 the sub appends `" — on pace for {monthFull}"` where the month comes from `new Date(year, 0, crossingDoy)` (local day-overflow arithmetic, no clock read). Projections past day 365 render no pace clause (a Dec-31 landing in a leap year, doy 366, is also suppressed — accepted simplification; you're barely on pace anyway).

## Coupling table

| If you change… | You must also change… |
| --- | --- |
| `last30d` window length/inclusivity | `subs30d`, `tagCounts30d`, `focusProgress` semantics inherit it; 30-day copy ("Subs · 30d" in `src/screens/Home.tsx`, "last 30 days" in `src/screens/Techniques.tsx` and `src/components/FocusCard.tsx`); boundary tests in `src/stats.test.ts` |
| Week start (`src/dates.ts — mondayOf`) | `weekSummary` bars, the `weeklyStreak` family (`streak`, `giNoGiStreak`, `focusStreak`), `volume12w`, and the `M T W T F S S` letters in `weekSummary` |
| `RoundMin` union (`src/types.ts`) | `sessionMinutes` hours math; the pull-sanitizer whitelist in `src/sync.ts` and the SQL check in `supabase-schema.sql` ([data-model.md](data-model.md)) |
| `YEAR_TARGET` | Milestone tests in `src/stats.test.ts` and the demo pinned numbers in `src/demo.test.ts`, which hard-code the rendered strings (the `title`/`sub` copy interpolates the constant and follows automatically) |
| `OPEN_GUARD_TAGS` / `isOpenGuardTag` (`src/curriculum.ts`) | `openGuardMilestone` semantics and its tests in `src/stats.test.ts` ([curriculum.md](curriculum.md)) |
| The `/ajp/i` title match or a `Placement` value | `medalMilestone` tests in `src/stats.test.ts`; `Placement` is triple-declared ([data-model.md](data-model.md)) |
| `milestones()` array order | Progress screen render order (it maps the array directly) |
| `historyFeed` tie rules | The comp-first determinism tests; any snapshotting of Home's top-3 feed |
| `withSessionTags` same-reference return | The same-reference test in `src/stats.test.ts` (consumers in `src/App.tsx` / `src/screens/Techniques.tsx` memoize on the raw inputs, not on this identity) |
| `formatHours` thresholds | The design renderings it matches ([design-system.md](design-system.md)); Home and Progress hour tiles |
| `useTodayIso` (moving/removing the interval) | Midnight rollover behavior of every stat on screen |

## Testing

`src/stats.test.ts` covers each edge named above with fixed `todayIso` values — window boundaries, unfinished-week behavior for the streak variants (gi+no-gi needs both kinds per week; focus needs a tagged session, empty tag → 0), the competition-milestone rules (case-insensitive AJP title match, non-AJP medals excluded, closed/half guard not open guard), pace-clause presence/absence, comp-first tie, same-reference `withSessionTags`. Extend it whenever a rule here changes; see [testing.md](testing.md) for conventions (`npm test` + `npm run build` must be green before any commit).
