# Rollbook — agent guide

Personal BJJ training tracker for a single user (Dmitrii). Mobile-first PWA:
React 18 + TypeScript (strict) + Vite, vitest, no router, no state library,
hand-written service worker. Local-first: `localStorage` (`rollbook:v1`) is
the source of truth; background sync to a personal Supabase Postgres via
plain `fetch` against PostgREST (deliberately no supabase-js). Live at
https://dmitryyarastov.github.io/rollbook/ — **pushing to `main` deploys**.

Deep documentation lives in `docs/` — read the relevant file before touching
a system:

| Doc | Covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | module map, state ownership, data flow, render paths |
| [docs/data-model.md](docs/data-model.md) | types, localStorage shape, load()/defaulting migration idiom, demo seed |
| [docs/sync.md](docs/sync.md) | the whole sync protocol + the playbook for adding synced fields/entities |
| [docs/stats.md](docs/stats.md) | every derived stat's exact semantics |
| [docs/curriculum.md](docs/curriculum.md) | Gracie Barra tag ordering: research, mapping, judgment calls |
| [docs/design-system.md](docs/design-system.md) | Nocturne rules, tokens, component/CSS conventions |
| [docs/build-pwa.md](docs/build-pwa.md) | vite, service worker strategy, precache injection, deploy |
| [docs/testing.md](docs/testing.md) | suites, factories, what to update when changing X |
| [docs/operations.md](docs/operations.md) | Supabase ops, schema addenda, RLS, live-data inspection, recovery |

## Commands

```bash
npm run dev        # vite dev server, port 5173 (often already running)
npm test           # vitest — all suites must pass before any commit
npm run build      # strict tsc + vite build + SW precache injection
npm run preview    # serve the production build (port 4173) — needed to test the SW
```

Browser console: `window.rollbook.seed()` loads deterministic demo data,
`window.rollbook.clear()` resets local. Neither touches the remote database
(`demo-` ids never sync), but **a real session/competition saved through the
UI syncs to the live database and cannot be deleted by the app** — never
save real-looking test entries against the live backend.

## Working rules

- `npm test` and `npm run build` green before any commit.
- Commit only when the owner asks. A push to `main` is a deploy — treat it
  as one.
- Schema changes are SQL addendum sections appended to
  `supabase-schema.sql`, hand-run by the owner in the Supabase SQL editor
  (the app's key cannot run DDL). A new **column** on a pushed table must be
  applied **before** deploying the build that pushes it (missing column =
  400 = loud sync error); a new **table** is tolerated when missing (404 →
  data stays local until it exists). Give the owner exact click-by-click
  instructions and the SQL in a copyable block.

## Hard invariants (violating any of these is a bug)

1. **Never UTC for calendar dates.** Dates are local `yyyy-mm-dd` built via
   `src/dates.ts` local getters only; `toISOString()` / `new Date('yyyy-mm-dd')`
   are banned for calendar math. Weeks start Monday.
2. **Stats are pure and clock-free.** No function in `src/stats.ts` may read
   the clock — anything date-relative takes `todayIso` explicitly. Every
   training aggregate takes `Session[]` only; the deliberate
   competition-aware exports are `historyFeed` (the render-only history
   interleave) and the goal milestones `medalMilestone`/`openGuardMilestone`
   (via `milestones`), which read competition placement/tags as goal
   evidence — competitions must never influence streak/hours/rounds/subs.
3. **Sessions and competitions are append-only per id.** That is the only
   reason the blind full-table upsert push is safe. An edit or delete
   feature requires pull-before-every-push first (see docs/sync.md).
4. **Remote is untrusted.** Anon can insert/update (no auth yet); every pull
   goes through sanitizing mappers in `src/sync.ts`; remote never deletes
   local rows; ids starting `demo-` never sync in either direction.
5. **Timestamps are app-authoritative.** No `now()` defaults or triggers in
   the DB — they would corrupt last-write-wins for offline-delayed pushes.
   Two LWW clocks: per-row `updatedAt` vs the single `stateUpdatedAt` for
   the focus/tagList/settings blob (`0` = never touched, gates its push).
6. **Whitelists are triple-declared** — TS union (`types.ts`), pull
   sanitizer (`sync.ts`), SQL check (`supabase-schema.sql`) — and must stay
   in lockstep: `RoundMin`, `CardioRating`, the competition `Placement`, the
   session `time` HH:MM regex.
7. **Design is law** (see docs/design-system.md): Inter 400/500 only; accent
   `#9184d9` only as lines/borders/glows/text marks, never a large fill;
   outlined buttons; component CSS appended to `src/app.css` as ordered
   `/* ── section ── */` blocks; longhand font properties; form controls
   need explicit `font-family: inherit`.
8. **The precache contract**: `scripts/sw-precache.mjs` text-replaces the
   `const CACHE = …` and `const PRECACHE = …` lines in `public/sw.js` — keep
   those two lines' exact shape.
9. **The public key is public on purpose.** `src/config.ts` ships the
   Supabase publishable key; RLS (with DELETE revoked) is the protection.
   Never commit an `sb_secret_…` key.

## Context that saves you a wrong turn

- The user's classes run in the **evenings** (19:30 no-gi, 20:30 gi) but get
  logged the **morning after** — that's why `resolveWhen` maps a
  not-yet-passed picked time to yesterday, and why `LogForm.when` resets
  after each save while gi/roundMin stick.
- Tag ordering is display-time only; the persisted `tagList` is append-only
  master data. The GB curriculum mapping has three documented judgment calls
  (Escapes→side control, Half guard→guard, Darce→back & turtle) pinned by
  tests — don't "fix" them casually.
- The UI recreates a high-fidelity handoff (`~/Downloads/design_handoff_rollbook/`,
  may not exist on every machine — `src/app.css` is the faithful transcription).
- Sessions logged before the When picker existed may carry morning-shifted
  dates/titles; that's known historical data, not a bug to hunt.
- No settings UI exists **by design** (per the handoff); `weeklyGoal` and
  `showMilestones` are storage-only knobs.
- Perf posture: the app is deliberately simple — `useMemo` guards the
  per-keystroke/per-toggle paths; `React.memo` on rows was considered and
  rejected (API churn for negligible gain). The SW serves hashed assets
  cache-first (immutable), navigations network-first (deploy freshness).
