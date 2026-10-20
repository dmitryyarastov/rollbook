# Rollbook

Personal BJJ training tracker — a mobile-first PWA built from the
`design_handoff_rollbook` bundle (Nocturne design system, high-fidelity).
Single user, no accounts: `localStorage` is the source of truth, with
optional background sync to a personal Supabase project (see below).

Five screens behind a bottom tab bar; the raised center tab is the
~30-second post-class logging flow, with a Training / Competition toggle —
competition entries record matches (outcome, points, submission), one
cardio rating for the event, a podium placement, the techniques worked,
and what worked / what didn't. Training entries record free-sparring rounds
and positional ("specific") rounds typed by the gym's 2+2-minute swap
formats — closed guard, open guard, side control, mount, back control,
turtle — plus round length and whole-session duration with 1–5 RPE for
downstream training-load analysis.
The character also carries a belt rank: Progress shows the current belt and
stripes with a one-tap Promote button for the next stripe or belt, and a
pencil to set any rank on any past date.

System documentation for contributors (and AI agents) lives in
[docs/](docs/) — architecture, data model, sync protocol, stats semantics,
curriculum mapping, design system, build/PWA, testing, and operations —
with [CLAUDE.md](CLAUDE.md) as the entry point and invariants digest.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — dates/stats/xp/belts/specific/curriculum/store/sync/demo suites
npm run build      # typecheck + production build + SW precache injection
npm run preview    # serve the production build
npm run icons      # regenerate public/icons PNGs from the SVG mark (sharp)
```

Try it with data: open the browser console and run

```js
window.rollbook.seed()   // deterministic demo history (~7 months)
window.rollbook.clear()  // back to a fresh empty app
```

The app itself starts empty; the seed is for demos and development.

## Install on a phone

Serve `dist/` from any static host (HTTPS), open it on the phone, and use
"Add to Home Screen". The service worker precaches the app shell at first
visit, so it opens and works fully offline afterwards. Icons/manifest cover
Android (incl. maskable) and iOS (`apple-touch-icon`).

## Remote sync (Supabase, optional)

With `src/config.ts` filled in (project URL + publishable key — public-by-design,
RLS protects the data), the app syncs automatically: pull + merge on launch,
debounced push on every save/edit, plus on regaining connectivity and on
foregrounding the PWA. localStorage stays the offline source of truth; sync
never blocks the UI, and a paused/unreachable project just shows a quiet
"sync error" on Home while everything keeps working locally.

- Schema: [supabase-schema.sql](supabase-schema.sql) (run once in the SQL editor).
  On an existing project, run each delimited addendum section at the bottom
  you haven't run yet — all are idempotent. The "Session start time" ALTER is
  **required** for builds with the When picker, the "Competition placement
  + technique tags" ALTER for builds with the goals feature, the "Whole-session
  duration + RPE" ALTER for builds deployed from September 2026, the
  "Specific (positional) rounds" ALTER for builds from October 2026, the
  "Specific-training formats" ALTER (spec_closed / spec_mount / spec_open)
  for builds from mid-October 2026, and the "More specific-training formats"
  ALTER (spec_side / spec_back / spec_turtle) for builds with the side
  control / back control / turtle steppers: until the applicable section
  runs, pushes to that table 400 and sync shows an error (data stays safe
  locally).
  A missing competitions or promotions table is merely tolerated (comps and
  belt rank events stay local until it exists — so the "Belt promotions"
  section may run before or after deploying) — the tolerance covers the whole
  table, not a missing column.
  Sessions, competitions, and promotions land in plain Postgres tables —
  query them from the dashboard or psql:
  `select tag, count(*) from sessions, unnest(tags) tag group by 1;`
- Merges are last-write-wins by `updatedAt`; remote is never authoritative
  for deletions, and the anon role cannot DELETE at all.
- Demo data (`window.rollbook.seed()`) never syncs; `clear()` resets local
  only — the next launch re-imports your real history from the database.
- No login yet (single hardcoded user). The schema is shaped so adding real
  auth later is a policy swap — see the notes at the bottom of the SQL file.

## How the numbers are computed (`src/stats.ts`, `src/xp.ts`)

Everything on screen derives from the stored history — pure functions, all
parameterized by a local-date `todayIso` and covered by tests:

- **Weeks are Monday–Sunday**, in the device's timezone. Local date math
  only; no UTC (`toISOString`) anywhere — an evening session must land on
  that local day.
- **Rounds** count free sparring and positional ("specific") rounds
  together — the week hero and bars, the 12-week volume chart, year totals,
  and the 250-round milestone all use that combined number; specific rounds
  also get their own weekly card on Home.
- **Mat hours** = `(free rolls + specific rounds) × round length` (sparring
  time). The quick-log flow also captures whole-session minutes separately;
  mat hours deliberately remain the narrower, comparable sparring-time measure.
- **Streaks** = consecutive weeks meeting a rule, plus the current week once
  it qualifies (an unfinished week never breaks a streak). Three flame rows
  on Progress: ≥ `weeklyGoal` sessions a week, at least one gi and one no-gi
  session in the same week, and a session tagged the focus tag each week.
  Each row also shows a muted "best ×N" — the longest run anywhere in
  history — but only when it beats the current one.
- **XP and levels** (`src/xp.ts`) are derived the same way — recomputed from
  history, nothing stored. A session earns `20 + 5 × rounds`; a competition
  `150 + 40 × match + 60 × win` plus a podium bonus (200/350/600). The
  character level on Home runs on linearly growing level costs
  (100, 150, 200, …); the Experience section on Progress shows XP today /
  this year / best day / average per day plus a year sparkline.
- **Characteristics** are nine lifelong attributes — passing, guard
  retention, takedowns (gi), wrestling (no-gi), leg locks, top control,
  side control, back control, turtle —
  that level up (on a faster 50/25 curve) from a flat 25 XP per session or
  60 per competition whose tags touch them. Typed specific rounds count
  too: the 2+2 swap formats work both sides, so guard-format rounds
  (closed or open) feed both passing and guard retention, mount rounds feed
  top control, and side control, back control and turtle rounds feed their
  own control plus top control (the escaping side earns nothing). Flat per entry, so tagging one session ten ways
  doesn't grind — and a session qualifying via both a tag and specific work
  still counts once; the standing group splits by the session's gi flag, and
  escapes deliberately don't count as top control. The set is fixed by
  design; only the matching may grow.
- **Belt rank** (`src/belts.ts`) is the exception to "nothing stored": a
  promotion is awarded, not computed, so each one is saved as a dated rank
  event (white → blue → purple → brown with 0–4 stripes, then black with
  0–6 degrees). The current rank is simply the latest event; a correction is
  just a newer event, so history is never edited. Rank feeds no stat or XP.
- **Technique counts** use a 30-day window ending today. **Focus progress**
  = share of the current Monday-start week's sessions tagged with the
  focus's linked tag ("Focus this week"). Submission counting was retired
  from the UI in October 2026 — historical tallies still show, condensed, on
  old session rows.
- **Milestones** are the season goals: a medal at AJP World Pro Ams (the
  earliest competition titled "AJP…" with a podium placement — non-AJP
  medals don't count), open guard played in competition (the earliest
  competition tagged with an open-guard-family tag; closed and half guard
  deliberately excluded), and 250 rounds in the calendar year with a linear
  pace projection month.

- **Competitions never touch training stats**: they interleave with sessions
  on the Sessions screen and Home's recent list, and their placement/tags
  feed the two competition milestones above — but streak, mat hours, and
  rounds come from sessions only. XP is the deliberate exception: it is
  gamification, not a training stat, so competitions earn XP too.

Settings `weeklyGoal` (default 2) and `showMilestones` are stored under the
`rollbook:v1` localStorage key; there is deliberately no settings UI (per
the handoff — they were tweakable props in the prototype).

## Tag ordering (Gracie Barra curriculum)

Technique tags are ordered by Gracie Barra's position themes — Standing &
takedowns → Guard → Guard passing → Side control → Mount & knee on belly →
Back & turtle → Leg locks — everywhere they appear (Log chips, the focus-tag
picker, and the Techniques tag cloud, which shows labelled groups). GB's
16-week cycle rotates positions, and week numbers drift between cycle
revisions, so the order follows the canonical theme sequence, not hard week
numbers. The mapping lives in `src/curriculum.ts` (exact names,
case-insensitive; unknown tags fall into a trailing "Other" group). This
replaced the earlier most-used-first ordering.

## Deviations from the handoff (deliberate)

The prototype's hardcoded numbers are internally inconsistent (hero says 14
rounds while its own bars sum to 18; dates don't match the real 2026
calendar). This app derives every value from data — layout and styling are
what's faithful, not the sample numbers.

Additions the design didn't draw but its "real-app additions" require,
styled in-system:

- **Gi / No-Gi chips** on the Log screen (sessions need a type; mirrors the
  Sessions filter chips).
- **Focus-goal editing**: pencil toggle on the focus card opens an inline
  panel (title input + linked-tag picker).
- **“+ Add” chip** in the Log technique wrap to append custom tags
  (case-insensitive dedupe; commits on Enter or blur).
- **Competition logging**: the Log screen's Training / Competition chips
  switch to a comp form (event name, cardio 1–5, podium placement chips,
  per-match outcome/points/submission editors, a tap-to-tag technique wrap,
  what worked / what didn't) — all styled in-system.
- Auto-titles at save time: Morning/Afternoon/Evening class on weekdays,
  Open mat on weekends. Empty states are quiet neutral-500 hints.
- **"When" picker** on the Log form: Now, the scheduled class slots
  (7:30 PM no-gi / 8:30 PM gi), or a free time input. A picked time resolves
  to its most recent occurrence — an evening class logged the next morning
  lands on the right day with the right title — and is stored on the session
  ('HH:MM', shown in history rows).
- **Session load card**: a 15-minute whole-class duration stepper and 1–5
  session-RPE chips. Both reset to 60 minutes / RPE 3 after each save so a
  previous class's per-session facts cannot silently carry forward.
- **Specific rounds** (October 2026): compact steppers in the Rounds card
  log positional-sparring rounds beside free rolls — one labeled row per
  format of the gym's 2+2-minute swap rounds (closed guard, open guard,
  side control, mount, back control, turtle; each side plays both roles),
  all rendered from the one list in `src/specific.ts`; every round stat
  counts the specific total together with free rolls. The prototype's
  Submissions card was retired at the same time — old sessions keep and
  display their historical sub tallies, and pre-format sessions show an
  untyped specific total.
- **XP, levels & characteristics** (October 2026): a character-level row on
  Home and an Experience section on Progress (XP stat tiles + a year
  sparkline), plus nine lifelong characteristics as level cards — all pure
  derivations from the logged history, styled in-system (thin accent
  progress lines, no big fills). See "How the numbers are computed" below.
- **Belt rank** (October 2026): a belt card at the top of Progress → Levels
  (current rank, since when, the rank history), a Promote button with an
  inline confirm, an Undo promotion button for mis-taps, and a pencil panel
  for first setup or backdated history (a day that already has an entry is
  replaced; future dates are refused); a small belt glyph joins Home's level
  row. Belt
  colors are the one deliberate departure from the palette, drawn only at
  glyph size.

## Code map

```
src/
  nocturne.css   design tokens (copied from the handoff, fonts self-hosted)
  app.css        all component styles, translated 1:1 from the prototype
  types.ts       Session / Competition / Promotion / AppData / form models
  dates.ts       local-date + Monday-week helpers, formatting, auto-titles
  stats.ts       every derived stat + the history feed (tested in stats.test.ts)
  xp.ts          XP formulas, levels, nine lifelong characteristics (xp.test.ts)
  belts.ts       belt ladder + current rank from promotion events (belts.test.ts)
  specific.ts    the six 2+2 swap-round formats, one list (specific.test.ts)
  curriculum.ts  Gracie Barra position groups + tag ordering
  store.ts       localStorage persistence (rollbook:v1) + defaults
  sync.ts        Supabase PostgREST mapping/merge + IO (useSync.ts schedules)
  demo.ts        deterministic demo seed, anchored to "today"
  App.tsx        tab/UI state, save flows, window.rollbook helpers
  components/    TabBar, Chip, Stepper, SessionRow, CompRow, FocusCard,
                 BeltGlyph, BeltCard
  screens/       Home, Sessions, Log, Techniques, Progress
public/
  sw.js          network-first SW; build injects the precache list
  manifest.webmanifest, icons/
scripts/
  make-icons.mjs, sw-precache.mjs
```
