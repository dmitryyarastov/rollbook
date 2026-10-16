# Stats

All derived numbers on screen come from `src/stats.ts` — plus `src/xp.ts`, the XP/gamification layer documented at the bottom of this file, which builds on stats. Every function is pure and side-effect-free; anything time-dependent takes `todayIso` (a local `yyyy-mm-dd` string) as an explicit parameter. Date arithmetic comes from `src/dates.ts` (local-parts only; `toISOString()`/UTC APIs are banned for calendar dates — see [architecture.md](architecture.md)). Weeks are Monday–Sunday everywhere.

## Contracts that hold across the whole module

- **No stats function reads the clock.** The `todayIso` every stat consumes comes from one place: `src/App.tsx — useTodayIso`, which produces it from `toIso(new Date())` and refreshes it on a 60-second interval (so the app rolls over midnight without a reload). (One other render-path clock exists — `src/screens/Log.tsx — WhenCard` reads `new Date()` on a 30-second interval for its today/yesterday caption — but it never feeds stats.) `yearMilestone` constructs a `Date` from parts for pace projection, but never reads "now". This is what makes `src/stats.test.ts` timezone- and clock-proof: every test passes a fixed `todayIso`.
- **One definition of "a round": `sessionRounds(s) = s.rolls + s.specific`.** Free-sparring rolls and positional ("specific") sparring rounds count together in every round-based stat — `sessionMinutes`, `weekSummary` (total and bars), `volume12w`, `yearTotals`, `yearMilestone`, and the SessionRow right-slot number all go through `sessionRounds`. The `specific` sum is additionally exposed on its own (the Home "Specific · week" card). `sessionRounds` reads the stored `specific` **total** only — the typed `specClosed`/`specMount`/`specOpen` breakdown never additionally feeds a round stat (app-written rows keep `specific === closed + mount + open`, see [data-model.md](data-model.md); the breakdown's one stats consumer is the `matchesSpecific` predicates in `src/xp.ts` below). Never reach for `s.rolls` directly in a round aggregate.
- **Competitions cannot move training aggregates — enforced at the type level.** Every aggregate (`weekSummary`, the `weeklyStreak` family, `tagCounts30d`, `focusProgress`, `volume12w`, `yearTotals`, `yearMilestone`) takes `Session[]` only. `Competition` appears only in deliberate, bounded exports: `historyFeed`, whose output is a tagged `HistoryEntry` union used purely for rendering the interleaved history list, and the goal milestones `medalMilestone` / `openGuardMilestone` — which read competition `placement`/`tags` as goal evidence — plus the `milestones` wrapper that threads them. A comp can still never move streak/hours/rounds even by accident. Keep this: never widen a training-aggregate signature to accept `Competition`.
- **Mat hours are a deliberate lower bound.** `sessionMinutes = sessionRounds(s) * s.roundMin`; `sessionHours` divides by 60. Only logged sparring rounds (free + specific) count — warm-ups, drilling, and technique time are excluded on purpose. UI labels ("mat hours" in `src/screens/Home.tsx`, "Mat hours · year" in `src/screens/Progress.tsx`) accept this undercount; do not "fix" it by folding in the separate whole-session `durationMin`, which deliberately stays an independent load measure.
- **30-day windows are inclusive of both ends**: `last30d` filters `date >= addDays(todayIso, -29) && date <= todayIso` — exactly 30 calendar days ending today. Tested boundary: day −29 in, day −30 out.
- **All sorts are non-mutating** (spread-copy before `.sort`).

## Function reference

### `sessionRounds(s)`, `sessionMinutes(s)`, `sessionHours(s)`
`sessionRounds = rolls + specific` — the shared combined-rounds definition (contract above). `sessionMinutes` is `sessionRounds(s) * roundMin`; `sessionHours` is that over 60. `RoundMin` is the triple-declared whitelist `4|5|6|8` (`src/types.ts`, `src/sync.ts` pull sanitizer, `supabase-schema.sql` check — see [data-model.md](data-model.md)); changing it changes hours math here.

### `formatHours(h)`
Rendering rule from the design handoff: below 10, one decimal (`Math.round(h*10)/10` then `toString()`, so `3.0` renders `"3"` not `"3.0"`); at 10 and above, rounded integer. The branch tests the raw value, so 9.96 still renders `"10"` via the decimal branch. Used by Home (week hours) and Progress (year hours).

### `sortByDateDesc(sessions)`
Date desc, then `createdAt` desc within a date. Module-private `sortByDateAsc` is the mirror, used by the `yearMilestone` crossing scan (the competition milestones have their own generic `byDateAsc` over `{ date }`).

### `historyFeed(sessions, competitions)` → `HistoryEntry[]`
Interleaves both kinds newest-first: date desc, then `createdAt` desc, then — only on an **exact** date+createdAt tie — competition before session. Rationale: the comp is the headline event of the day, and the rule makes tests deterministic. The `kind` tiebreak never fires unless both earlier comparisons are 0. Consumers: `src/screens/Sessions.tsx` (full feed, gi-filtered), `src/screens/Home.tsx` (top 3).

### `last30d(sessions, todayIso)`
The shared 30-day inclusive window (semantics above). `tagCounts30d` is its only remaining delegate (`focusProgress` moved to the current week, 2026-10; `subs30d` was removed outright) — change the window here and the technique counts plus the "last 30 days" copy in Techniques' subtitle move together.

### `weekSummary(sessions, todayIso)`
Current Monday–Sunday week: `rounds` (combined `sessionRounds` sum), `specific` (positional rounds alone — the Home "Specific · week" card), `hours` (`sessionHours` sum), session count, and `bars` — seven `{day, rounds}` entries Mon..Sun with display letters `M T W T F S S` (letters repeat; renderers must key by index, not letter). Future days of the week are naturally zero.

### `weeklyStreak(sessions, todayIso, qualifies)` → `{ weeks, sinceIso }`
The generalized week-walk behind every flame row on the Progress screen: buckets sessions by Monday (module-private `sessionsByWeek`), then counts consecutive weeks whose session list satisfies `qualifies`, walking back from the current Monday. The current week counts as soon as it qualifies, and an **unfinished current week never breaks the streak** — if it doesn't qualify yet, counting simply starts from last week. Contiguity is strict: current week qualifying but last week failing gives `weeks = 1`. `sinceIso` is the Monday of the earliest week in the streak, `null` when `weeks = 0`. The three exports below are thin `qualifies` wrappers over it — new streak flavors should be too.

### `bestWeeklyStreak(sessions, todayIso, qualifies)` → `number`
The longest qualifying run across **all** history — the muted "best ×N" marker on the Progress flame rows ([design-system.md](design-system.md)), rendered only when it exceeds the live streak. Same Monday bucketing (`sessionsByWeek`) as `weeklyStreak`, but instead of walking back from today it walks **forward** from the earliest logged week through the current week, tracking the maximum consecutive-qualifying count. The bound matters: the walk is `earliest logged Monday .. mondayOf(todayIso)` inclusive, so a qualifying current week extends the tail run, while a not-yet-qualifying current week merely ends the tail run — it can never lower the recorded best. `0` with no sessions. Progress passes the same three predicates as the live flames, rebuilt inline (`trains`/`mixes`/`focuses` in `src/screens/Progress.tsx`) since the `weeklyStreak` wrappers don't export theirs.

### `streak(sessions, goal, todayIso)`
The original **display** streak: `weeklyStreak` with `week.length >= goal`. `goal` is `Settings.weeklyGoal` threaded from callers (Home, Progress).

### `giNoGiStreak(sessions, todayIso)`
`weeklyStreak` with "at least one gi AND one no-gi session in the week".

### `focusStreak(sessions, focusTag, todayIso)`
`weeklyStreak` with "at least one session tagged `focusTag`" (exact membership via `s.tags.includes`, same matching as `focusProgress`). An empty `focusTag` short-circuits to `{ weeks: 0, sinceIso: null }` — no focus goal set. Progress renders all three as `.frow` flame rows ([design-system.md](design-system.md)): `streak(goal)`, `giNoGiStreak`, `focusStreak(data.focus.tag)`.

### `tagCounts30d(sessions, todayIso)`
Per-tag session counts over `last30d`, sorted count desc then `localeCompare` name asc. Counts one per occurrence in `s.tags`; session tag arrays are deduplicated at form level, so this equals sessions-containing-tag. Feeds the Techniques cloud.

### `withSessionTags(tagList, sessions)`
Master tag list plus any tag referenced by a session but absent from the list, appended after the master order in session-iteration order. **Rationale (blob sync):** `tagList` lives in the app_state blob under a single `stateUpdatedAt` LWW clock ([sync.md](sync.md)); a racing list edit on another device can wholesale replace the list and drop a tag that logged sessions still reference. This function guarantees a tag you've logged with stays visible and toggleable regardless. Returns the **same reference** when nothing is missing (pinned by a test). Both consumers (`src/App.tsx — logTagList`, Techniques sections) call it *inside* `useMemo`s keyed on `data.tagList`/`data.sessions`, so nothing currently depends on that identity — it makes the output safe to use as a dep later. Output is then ordered/grouped by [curriculum.md](curriculum.md) logic (`orderTagsByCurriculum` / `groupTagsByCurriculum`), which sends unknown tags to a trailing Other group.

### `focusProgress(sessions, focusTag, todayIso)` → `{ pct, tagged, total }`
Share of the **current week's** sessions carrying `focusTag` — the pool is `mondayOf(todayIso) <= date <= todayIso` (weekly since 2026-10; it was a 30-day window before, hence the FocusCard's "Focus this week" copy). Empty `focusTag` short-circuits to an empty pool → `{0, 0, 0}`; so does a week with no sessions yet. `pct` is `Math.round(100 * tagged / total)`, 0 when the pool is empty. Note the asymmetry with `focusStreak`, which stays a Monday-week walk over all history.

### `volume12w(sessions, todayIso)`
Combined rounds (`sessionRounds` sum) per Monday–Sunday week for the 12 weeks ending with the **current** week, oldest first. The last bucket is the in-progress week, so it undercounts until Sunday — that is expected chart behavior, not a bug.

### `yearTotals(sessions, todayIso)`
Hours and combined rounds for sessions whose `date` starts with the current year string (the returned field is still named `rolls`, but it sums `sessionRounds`).

## Milestones

`milestones(sessions, competitions, todayIso)` returns `[medalMilestone, openGuardMilestone, yearMilestone]` in the order Progress renders them. Each returns `{ achieved, title, sub }`. The first two are the season's competition goals and take `Competition[]` only — the deliberate exception to the `Session[]`-only rule (contract above); `yearMilestone` takes `Session[]` only. The year target is the module constant `YEAR_TARGET = 250`, recalibrated 2026-08-30 from live pace (~11.2 rolls/week with 17.6 weeks left projected ~237–251 by Dec 31; the original 500 needed a fantasy ~28/week — the rationale comment sits on the constant). `title`/`sub` interpolate the constant, so on-screen copy follows a constant change automatically — the milestone tests are what hard-code the rendered numbers.

### `medalMilestone(competitions)`
Goal: podium at AJP World Pro Amateurs. Achieved by the **earliest** competition (date-asc via `byDateAsc`) whose title matches `/ajp/i` AND whose `placement !== 'none'` — a medal at a non-AJP comp shows on its own history row but does not complete this goal. Achieved → `"{Bronze|Silver|Gold} at {title} — {fmtShort(date)}"` (labels from the module's `PLACEMENT_LABEL`). Not achieved → `"No AJP podium yet"`.

### `openGuardMilestone(competitions)`
Goal: play open guard in competition. Achieved by the **earliest** competition carrying any open-guard-family tag — `c.tags.find(isOpenGuardTag)` against the `OPEN_GUARD_TAGS` whitelist in src/curriculum.ts (closed and half guard deliberately excluded; see [curriculum.md](curriculum.md)). Achieved → `"{tag} at {title} — {fmtShort(date)}"`, with the tag in the comp's own spelling. Not achieved → `"Play it, then tag it on the comp entry"`.

### `yearMilestone`
250 rounds in the calendar year (combined — the scan accumulates `sessionRounds`). Ascending scan; achieved at the session whose rounds cross the target (`sub: "Hit {date}"`). Not achieved → `"{cum} / 250"`, plus, when `cum > 0`, a linear pace projection: `crossingDoy = ceil(dayOfYear(todayIso) * 250 / cum)`; if ≤ 365 the sub appends `" — on pace for {monthFull}"` where the month comes from `new Date(year, 0, crossingDoy)` (local day-overflow arithmetic, no clock read). Projections past day 365 render no pace clause (a Dec-31 landing in a leap year, doy 366, is also suppressed — accepted simplification; you're barely on pace anyway).

## XP (`src/xp.ts`)

The gamification layer — character level, daily XP, and the six lifelong characteristics — lives in its own module, `src/xp.ts`. Everything in it is a **pure derivation from logged history** (sessions + competitions): nothing stored, nothing synced, nothing to migrate. The formulas are arbitrary by nature, so they are pinned by `src/xp.test.ts` and must be changed deliberately, never casually — a formula change silently recomputes every level across the whole journey. The module keeps the stats purity rules: no clock reads (`yearXp` takes `todayIso`), local date parts only. Imports point one way — `src/xp.ts` imports `sessionRounds` from `src/stats.ts` and `groupOfTag` from `src/curriculum.ts` ([curriculum.md](curriculum.md)); neither imports back, so there are no cycles. Unlike the training aggregates, XP **deliberately** reads `Competition[]` — it is a motivation layer, not a training stat, and that competition-awareness must stay confined to this module (never widen a `src/stats.ts` aggregate signature for it; the type-level contract above stands).

### `sessionXp(s)` / `compXp(c)` / `totalXp(sessions, competitions)`
`sessionXp = 20 + 5 × sessionRounds(s)` — base attendance plus combined rounds (a 2-round class = 30). `compXp = 150 + 40 × matches + 60 × wins + medal bonus`, where the bonus is the module `MEDAL_XP` map keyed by the `Placement` union (`none` 0 / `bronze` 200 / `silver` 350 / `gold` 600 — a new placement value must extend the map). `totalXp` sums both kinds over all history.

### `levelFromXp(xp, base, step)` → `{ level, into, need }`
Linearly growing level costs: clearing level n costs `base + step·(n−1)`. `into` is the XP accumulated inside the current level and `need` the cost to clear it — the pair drives every thin progress bar. Negative input clamps to level 1 at 0. `characterLevel` is the 100/50 curve (the Home header level, fed by `totalXp`); module-private `characteristicLevel` is 50/25 — cheaper early levels keep the six attributes feeling alive at flat-grant rates.

### `yearXp(sessions, competitions, todayIso)` → `{ byDay, today, year, bestDay, avgPerDay }`
Per-day XP buckets for `todayIso`'s calendar year — `byDay` has 365/366 entries (leap-year aware: the length is derived from `dayIndex` of Dec 31). `dayIndex` builds both dates from **local parts** (`new Date(y, m−1, d)`) and `Math.round`s the ms difference, so DST's 23/25-hour days cannot skew an index. Tile fields: `today` (today's bucket), `year` (total), `bestDay` (max bucket), `avgPerDay` = year total ÷ days elapsed through today, rounded (`0` before any XP). Feeds the Progress "Experience" tiles and the year sparkline.

### `characteristics(sessions, competitions)` → `CharacteristicState[]`
`CHARACTERISTICS` is the **fixed, lifelong six-attribute set** chosen by the owner as the axes he wants to upgrade across his whole BJJ journey — an RPG character sheet, not a tag cloud. The SET is stable by design; only the tag matchers may grow. Tag matchers (each takes `(tag, gi)`):

| id | Matches |
|---|---|
| `passing` | `groupOfTag(tag) === 'passing'` |
| `retention` | exact-tag whitelist `RETENTION_TAGS` (guard retention / retention / guard recovery / granby roll / granby), trim+lowercase normalized |
| `takedowns-gi` | the `standing` curriculum group, **gi sessions only** |
| `wrestling-nogi` | the `standing` curriculum group, **no-gi only** (the one matcher pair that reads the entry's `gi` flag) |
| `leglocks` | `groupOfTag(tag) === 'legs'` |
| `top-control` | explicit whitelist `TOP_CONTROL_TAGS` — pins, back control, and the front-headlock family worked **from top**; escapes, guard recovery, and bottom-side attacks like the buggy choke are deliberately absent (they share curriculum groups with the pins but are bottom work) |

**Typed specific rounds also feed characteristics** — a `Characteristic` may carry an optional `matchesSpecific(session)` predicate alongside its tag matcher. The gym's 2+2-minute swap formats work both sides per round, so the crediting mirrors that: a session with guard-format work (`specClosed > 0 || specOpen > 0`) feeds **both** `passing` and `retention` (the shared `guardSpecific` predicate); a session with `specMount > 0` feeds `top-control` (the mount-escape side has no attribute). The other three characteristics have no predicate. A session qualifies for an attribute when **its tags match OR `matchesSpecific` passes** — one grant either way.

Grants are **flat per entry**: 25 XP per session / 60 per competition that touches the attribute (by tags, or for sessions by `matchesSpecific`), regardless of how many of its tags match — so tag-spamming one session cannot grind an attribute, and a session qualifying via both a tag and specific work still counts once. Each returned state carries `id`/`label`/`xp` plus the 50/25 `level`/`into`/`need` fields for the Progress characteristic cards. `sessionsToNext(state)` = `ceil((need − into) / 25)` — the qualifying training sessions still needed for the next level (a competition's 60 can leave a remainder, hence the ceiling); it powers the cards' "N sessions to LV n+1" hint.

## Coupling table

| If you change… | You must also change… |
| --- | --- |
| `sessionRounds` (the rolls + specific definition) | Every round stat downstream (`sessionMinutes`/`sessionHours`, `weekSummary`, `volume12w`, `yearTotals`, `yearMilestone`), the SessionRow right-slot number (`src/components/SessionRow.tsx` imports it), `sessionXp` in `src/xp.ts` (it multiplies the same definition), and the pinned numbers in `src/stats.test.ts` / `src/demo.test.ts` / `src/xp.test.ts` |
| `last30d` window length/inclusivity | `tagCounts30d` semantics inherit it; the "last 30 days" copy in `src/screens/Techniques.tsx`; boundary tests in `src/stats.test.ts` |
| Week start (`src/dates.ts — mondayOf`) | `weekSummary` bars, `focusProgress` (current-week pool), the `weeklyStreak` family (`streak`, `giNoGiStreak`, `focusStreak`), `bestWeeklyStreak`, `volume12w`, and the `M T W T F S S` letters in `weekSummary` |
| `RoundMin` union (`src/types.ts`) | `sessionMinutes` hours math; the pull-sanitizer whitelist in `src/sync.ts` and the SQL check in `supabase-schema.sql` ([data-model.md](data-model.md)) |
| `YEAR_TARGET` | Milestone tests in `src/stats.test.ts` and the demo pinned numbers in `src/demo.test.ts`, which hard-code the rendered strings (the `title`/`sub` copy interpolates the constant and follows automatically) |
| `OPEN_GUARD_TAGS` / `isOpenGuardTag` (`src/curriculum.ts`) | `openGuardMilestone` semantics and its tests in `src/stats.test.ts` ([curriculum.md](curriculum.md)) |
| The `/ajp/i` title match or a `Placement` value | `medalMilestone` tests in `src/stats.test.ts`; `Placement` is triple-declared ([data-model.md](data-model.md)) |
| `milestones()` array order | Progress screen render order (it maps the array directly) |
| `historyFeed` tie rules | The comp-first determinism tests; any snapshotting of Home's top-3 feed |
| `withSessionTags` same-reference return | The same-reference test in `src/stats.test.ts` (consumers in `src/App.tsx` / `src/screens/Techniques.tsx` memoize on the raw inputs, not on this identity) |
| `formatHours` thresholds | The design renderings it matches ([design-system.md](design-system.md)); Home and Progress hour tiles |
| An XP formula or level-curve constant (`src/xp.ts` — `sessionXp`/`compXp`/`MEDAL_XP`, the 100/50 and 50/25 curves, the flat 25/60 characteristic grants) | The pinned numbers in `src/xp.test.ts`; nothing else — levels silently recompute across all history (`src/demo.test.ts` deliberately asserts no XP numbers) |
| `CHARACTERISTICS` (tag matchers, `matchesSpecific` predicates, `TOP_CONTROL_TAGS`, `RETENTION_TAGS`) | The matcher and typed-specific tests in `src/xp.test.ts`; the SET of six ids is fixed by design — extend matchers, don't add/remove attributes casually. Curriculum `TAG_GROUP` moves also shift the `passing`/`standing`/`legs` matchers through `groupOfTag` ([curriculum.md](curriculum.md)); the `Session` breakdown fields feed `matchesSpecific` ([data-model.md](data-model.md)) |
| `useTodayIso` (moving/removing the interval) | Midnight rollover behavior of every stat on screen |

## Testing

`src/stats.test.ts` covers each edge named above with fixed `todayIso` values — window boundaries, the weekly `focusProgress` pool (previous-week sessions excluded; empty week → `{0,0,0}`), specific rounds counted into week/volume/year totals, unfinished-week behavior for the streak variants (gi+no-gi needs both kinds per week; focus needs a tagged session, empty tag → 0), `bestWeeklyStreak` (longest historical run beats the tail run; a qualifying current week extends; a non-qualifying one never erases the best; empty → 0), the competition-milestone rules (case-insensitive AJP title match, non-AJP medals excluded, closed/half guard not open guard), pace-clause presence/absence, comp-first tie, same-reference `withSessionTags`. The XP module has its own suite, `src/xp.test.ts`, pinning every formula and matcher above (see [testing.md](testing.md)). Extend them whenever a rule here changes (`npm test` + `npm run build` must be green before any commit).
