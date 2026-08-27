# Build, Toolchain & PWA

How Rollbook is compiled, type-checked, turned into an offline-capable PWA, and deployed to GitHub Pages. Sibling docs: [architecture.md](architecture.md) (module layout), [testing.md](testing.md) (what the vitest run covers), [operations.md](operations.md) (deploy/rollback practice), [design-system.md](design-system.md) (why only Inter 400/500 ships).

## npm scripts (package.json)

| Script | Command | Notes |
|---|---|---|
| `dev` | `vite` | Dev server on port 5173, `strictPort: true` (fails rather than drifting to 5174). No service worker in dev — registration is PROD-gated. |
| `build` | `tsc --noEmit && vite build && node scripts/sw-precache.mjs` | Three stages, all required: type-check (Vite/esbuild strips types without checking them), bundle to `dist/`, then inject the precache manifest into `dist/sw.js`. A `dist/` produced without the third stage ships a service worker whose cache is named `rollbook-dev` and precaches almost nothing — never deploy that. |
| `preview` | `vite preview` | Serves `dist/` locally. The closest local approximation of the Pages deployment (relative base, built sw.js). |
| `test` | `vitest run` | One-shot, non-watch. Must be green (with `npm run build`) before any commit — working rule. |
| `icons` | `node scripts/make-icons.mjs` | One-time icon regeneration; outputs are committed under `public/icons/`. |

`dist/` is gitignored; every deploy rebuilds it in CI.

## vite.config.ts

- `base: './'` — **load-bearing.** GitHub Pages serves the app from `/rollbook/`, not the domain root, so every asset URL in built HTML/CSS must be relative. This pairs with the relative `start_url`/`scope` in `public/manifest.webmanifest`, the relative `PRECACHE` paths in the service worker, and the `${import.meta.env.BASE_URL}sw.js` registration in `src/main.tsx`. Changing `base` requires revisiting all four.
- `test: { environment: 'node' }` — vitest config lives here (note the `/// <reference types="vitest/config" />` line). Node environment means **no DOM in tests**: everything under test (stats, sync mappers, storage codecs) is pure functions by design. Do not add jsdom to test a component; keep logic pure instead (see [testing.md](testing.md)).
- Only plugin: `@vitejs/plugin-react`. No PWA plugin — the service worker is hand-rolled (below) to keep the dependency budget at four runtime deps.

## tsconfig.json

`strict: true` plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. `noEmit` — tsc is a checker only; Vite emits. `moduleResolution: "bundler"`, `isolatedModules`, `types: ["vite/client"]` (typing for `import.meta.env.PROD` / `BASE_URL`). `include` covers `src` and `vite.config.ts` — a new top-level `.ts` file outside those paths is silently unchecked by the build gate.

## Service worker, end to end

### Registration — src/main.tsx

Registered only when `import.meta.env.PROD`, on `window` `load`, at `${import.meta.env.BASE_URL}sw.js`. Registration failure is deliberately swallowed: offline support is a convenience layered on an app whose real state is localStorage (see [architecture.md](architecture.md)); the app must be fully functional with no SW at all. Dev never registers a SW, so stale-cache confusion cannot occur during development.

### Strategy — public/sw.js

`public/sw.js` is copied verbatim into `dist/` by Vite (public dir), then rewritten by `scripts/sw-precache.mjs`.

- **Install**: `cache.addAll(PRECACHE)` into the cache named `CACHE`, then `skipWaiting()`. The precache list is the entire app shell, so the app is offline-ready after the very first visit.
- **Activate**: delete every cache whose name is not the current `CACHE`, then `clients.claim()`. Cache naming *is* the versioning scheme — one cache per deploy, previous deploy's cache purged on activate.
- **Fetch**: only same-origin GETs are handled. `request.mode === 'navigate'` → `networkFirst` (try network, cache the response, fall back to the cached request, then to the cached `'./'` shell). Everything else → `cacheFirst` (assets are content-hashed, hence immutable — refetching them is pure waste). `fetchAndCache` only writes `res.ok` responses into the cache.
- **`ignoreVary: true` on every cache lookup** (`fromCache`): Vite's server (and some hosts) send `Vary: Origin` on assets. Module-script requests carry an `Origin` header that install-time `addAll` entries lack, so a spec-compliant Vary match would *miss* the precached entry and the app would break offline. URL identity is sufficient here; do not remove this flag.

### Precache injection — scripts/sw-precache.mjs

Post-build step. Walks `dist/` recursively and builds the precache list as `'./'`-relative paths, excluding:

- `./sw.js` (the worker never caches itself),
- `./index.html` (navigations request `'./'`, which is the first entry — caching the HTML under a second URL would double-store it and never be hit),
- `*.woff` (fallback format for pre-2016 browsers only; `src/main.tsx` imports `@fontsource/inter` latin-400/500, and modern browsers only ever fetch the `.woff2`. Precaching `.woff` would download ~62KB nobody uses. If some ancient browser does request it, runtime `cacheFirst` still caches it then.)

The list is sorted, `'./'` is prepended, and a 10-char sha256 of the joined list becomes the cache name `rollbook-<hash>` — so an identical rebuild produces an identical cache name (no pointless purge), and any asset change produces a new one.

**Fragile text-replacement contract**: the script rewrites `dist/sw.js` with two regexes, `/const CACHE = .*$/m` and `/const PRECACHE = .*$/m`. The two lines in `public/sw.js`

```js
const CACHE = 'rollbook-dev' /* __CACHE_NAME__ */
const PRECACHE = ['./', './manifest.webmanifest'] /* __PRECACHE__ */
```

must each stay a **single line starting exactly `const CACHE = ` / `const PRECACHE = `**, and no other line in the file may match those patterns. If you rename either constant, wrap the declaration, or introduce a second occurrence, the injection silently misses and production ships the `rollbook-dev` stub — there is no build error. After changing either file, verify by inspecting `dist/sw.js` (the build log line `sw.js: precaching N entries, cache rollbook-<hash>` is the cheap check; currently N=11).

### How a deploy reaches an installed PWA

1. Push to `main` → CI publishes a new `dist/` (new content-hashed asset names, new HTML naming them, byte-different `sw.js` with a new cache name).
2. Next app open, the **old** SW handles the navigation network-first, so an online open fetches the fresh HTML immediately; its new hashed assets miss the old cache and come from the network. In parallel the browser re-fetches `sw.js`, sees new bytes, installs the new worker (which precaches the new shell) and — via `skipWaiting`/`clients.claim` — activates it and purges the old cache.
3. **Why it can still take a second open**: if that open happens offline (or the network fetch fails), `networkFirst` falls back to the previous deploy's cached shell — correct behavior, self-heals on the next online open. GitHub Pages also serves HTML and `sw.js` with `max-age=600`, so an open within ~10 minutes of the previous one can be served stale out of the HTTP cache. Worst case is one stale-but-working open; never more, and never a broken mix of old HTML with purged assets (the old cache survives until the new worker activates).

## Icons — scripts/make-icons.mjs

Generates the four PNGs in `public/icons/` from an inline SVG of the app mark (dark `#161826` tile, `#9184d9` ring + cross — accent-as-line, per [design-system.md](design-system.md)) using `sharp` (devDependency). The `rx` parameter: `rx > 0` bakes rounded corners for plain icons (`icon-192.png`, `icon-512.png`); `rx = 0` renders full-bleed squares for `icon-512-maskable.png` and `apple-touch-icon.png`, which the OS masks itself. `public/icons/icon.svg` (favicon + manifest `any` icon) is a separate hand-maintained file — if you change the mark in `make-icons.mjs`, update `icon.svg` to match and rerun `npm run icons`.

## index.html and manifest

- `index.html`: `style="background:#161826"` inline on `<html>` kills the white flash before CSS loads; `meta color-scheme dark`, `theme-color #161826`, `viewport-fit=cover` (safe-area insets), the three `apple-mobile-web-app-*` metas for iOS standalone mode, SVG favicon, `apple-touch-icon` link, manifest link. All hand-authored URLs relative (`./…`) — same subpath constraint as `base`; the root-absolute `/src/main.tsx` script tag is the dev entry, replaced at build with relative hashed asset URLs.
- `public/manifest.webmanifest`: `start_url: "./"`, `scope: "./"` (relative for the same reason), `display: standalone`, `orientation: portrait`, `background_color`/`theme_color` `#161826`, icon set including the maskable 512.

## Deploy pipeline — .github/workflows/deploy.yml

Triggers: push to `main` and `workflow_dispatch`. **Treat every push to `main` as a production deploy.** Steps: checkout → setup-node 22 with npm cache → `npm ci` → `npx vitest run` (tests gate the deploy independently of the build) → `npm run build` (type-check + bundle + precache injection) → `configure-pages` (`enablement: true` — self-provisions Pages) → `upload-pages-artifact` from `dist` → `deploy-pages`. Permissions are least-privilege (`contents: read`, `pages: write`, `id-token: write`); `concurrency: pages` with `cancel-in-progress` so rapid pushes deploy only the newest.

## Bundle size baseline — do not regress

Single JS chunk, `dist/assets/index-*.js` ≈ **63 KB gzipped** (63,468 bytes at time of writing; 11 precache entries, total shell ≈ 324 KB on disk / ~158 KB gzipped). This is the point of the tiny dependency budget: four runtime deps (`react`, `react-dom`, tree-shaken `@phosphor-icons/react`, `@fontsource/inter` which contributes fonts/CSS, not JS), no router, no state library, no supabase-js (plain fetch — see [sync.md](sync.md)). Before adding any dependency, measure: `npm run build && gzip -c dist/assets/index-*.js | wc -c`. A jump past ~70 KB gz needs a written justification; prefer hand-rolling (the SW, the PostgREST client) as this repo consistently does.

## Coupling table

| If you change… | You must also… |
|---|---|
| The `const CACHE` / `const PRECACHE` lines in `public/sw.js` (rename, reformat, wrap) | Update both regexes in `scripts/sw-precache.mjs`, then verify `dist/sw.js` no longer says `rollbook-dev` |
| `base` in `vite.config.ts` | Revisit SW registration path in `src/main.tsx`, `start_url`/`scope` in `public/manifest.webmanifest`, relative links in `index.html`, `'./'`-relative paths in `public/sw.js` / `scripts/sw-precache.mjs` |
| Output layout of `dist/` (e.g. `assetsDir`, new file types) | Re-check the exclusion filter in `scripts/sw-precache.mjs` (`sw.js`, `index.html`, `.woff`) |
| Font imports in `src/main.tsx` | Keep the `.woff` exclusion rationale valid in `scripts/sw-precache.mjs`; respect the Inter 400/500-only rule ([design-system.md](design-system.md)) |
| The app mark in `scripts/make-icons.mjs` | Update `public/icons/icon.svg` by hand, run `npm run icons`, commit the PNGs |
| The `build` script chain in `package.json` | Confirm `.github/workflows/deploy.yml` still runs the precache injection (it calls `npm run build`) |
| Node version assumptions | Bump `node-version` in `.github/workflows/deploy.yml` (currently 22) |
| Navigation/caching strategy in `public/sw.js` | Re-verify the deploy-update walkthrough above still holds (network-first navigations are what make deploys reach installed PWAs) |
