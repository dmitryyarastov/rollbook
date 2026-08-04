# Rollbook

Personal BJJ training tracker — a mobile-first PWA built from the
`design_handoff_rollbook` bundle (Nocturne design system, high-fidelity).
Single user, no accounts, no backend: all data lives in `localStorage`.

Five screens behind a bottom tab bar; the raised center tab is the
~30-second post-class logging flow.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — dates/stats/demo-seed suites
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

## How the numbers are computed (`src/stats.ts`)

Everything on screen derives from stored sessions — pure functions, all
parameterized by a local-date `todayIso` and covered by tests:

- **Weeks are Monday–Sunday**, in the device's timezone. Local date math
  only; no UTC (`toISOString`) anywhere — an evening session must land on
  that local day.
- **Mat hours** = `rounds × round length` (sparring time). The quick-log
  flow doesn't capture class length, so this is deliberately a lower bound.
- **Streak** = consecutive completed weeks with ≥ `weeklyGoal` sessions,
  plus the current week once it qualifies (an unfinished week never breaks
  the streak).
- **Subs / technique counts / focus progress** use a 30-day window ending
  today. Focus progress = share of those sessions tagged with the focus's
  linked tag.
- **Milestones**: 100 rounds inside a calendar quarter (dated when crossed),
  a 10-week streak of completed weeks (dated the Monday after week 10), and
  500 rounds in the calendar year with a linear pace projection month.

Settings `weeklyGoal` (default 2) and `showMilestones` are stored under the
`rollbook:v1` localStorage key; there is deliberately no settings UI (per
the handoff — they were tweakable props in the prototype).

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
- Auto-titles at save time: Morning/Afternoon/Evening class on weekdays,
  Open mat on weekends. Empty states are quiet neutral-500 hints.

## Code map

```
src/
  nocturne.css   design tokens (copied from the handoff, fonts self-hosted)
  app.css        all component styles, translated 1:1 from the prototype
  types.ts       Session / AppData / LogForm models
  dates.ts       local-date + Monday-week helpers, formatting, auto-titles
  stats.ts       every derived stat (tested in stats.test.ts)
  store.ts       localStorage persistence (rollbook:v1) + defaults
  demo.ts        deterministic demo seed, anchored to "today"
  App.tsx        tab/UI state, save flow, window.rollbook helpers
  components/    TabBar, Chip, Stepper, SessionRow, FocusCard
  screens/       Home, Sessions, Log, Techniques, Progress
public/
  sw.js          network-first SW; build injects the precache list
  manifest.webmanifest, icons/
scripts/
  make-icons.mjs, sw-precache.mjs
```
