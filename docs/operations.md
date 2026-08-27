# Operations

Running the live system: the Supabase project, the schema of record, RLS, live-data
inspection, the deploy pipeline, known data history, and recovery. Protocol-level sync
behavior (mappers, merge, push/pull) is in [sync.md](sync.md); build and service-worker
mechanics are in [build-pwa.md](build-pwa.md).

## The Supabase project

- URL and key live in `src/config.ts` — `SUPABASE_URL`
  (`https://rdhzcvmvtxnzittmclgr.supabase.co`), `SUPABASE_ANON_KEY`, `SYNC_USER_ID`
  (`'dmitrii'`). Setting either string to `''` flips `SYNC_ENABLED` off and the app runs
  exactly like the pre-sync local-only build — that is the kill switch if the backend
  ever misbehaves.
- **The publishable key is committed on purpose.** It is public-by-design; protection is
  RLS in the database, never secrecy of `src/config.ts`. Never commit an `sb_secret_…`
  key anywhere in this repo — that key bypasses RLS entirely.
- There is no auth by choice: a single hardcoded `user_id = 'dmitrii'`. Everything anon
  can do (select/insert/update, no delete) is the whole threat surface; see the RLS
  section below and "Remote is untrusted" in [sync.md](sync.md).

## supabase-schema.sql is the schema of record

`supabase-schema.sql` at the repo root is the only description of the live database.
There are no migration files and no migration tooling; the anon key cannot run DDL, so
**every schema change is hand-run by the owner in the Supabase dashboard SQL editor**.

### The addendum pattern

The file grows by appending idempotent, delimited sections
(`-- ── Title (added yyyy-mm) ──…`). Never rewrite the base section to fold an addendum
in — the file's order is the replay order for a fresh project, and the section
boundaries are the "what do I paste on an existing project" units. Current sections:

| Section | Creates | Idempotency mechanism |
|---|---|---|
| Base (top of file) | `sessions`, `app_state` tables, index, RLS enable, anon policies, `revoke delete` | none — base runs once on a fresh project only |
| Competitions (added 2026-08) | `competitions` table, index, RLS, policies, `revoke delete` | `create table if not exists`, `create index if not exists`, `drop policy if exists` before each `create policy` (Postgres has no `create policy if not exists`) |
| Session start time (added 2026-08) | `sessions.time` column with HH:MM check | `add column if not exists` |

Applying on an existing project: paste and run **just the new section** in the SQL
editor. Applying on a fresh project: run the whole file top to bottom.

### The ALTER-before-deploy rule

The two failure modes for schema drift are deliberately asymmetric (see `pullAll` /
`pushAll` in `src/sync.ts`):

- **Missing table → tolerated.** PostgREST answers **404** for a table it does not know;
  `pullAll` and `pushAll` treat exactly a competitions 404 as "no remote comps" —
  competitions stay local and upload on the first push after the owner runs the
  addendum. This is why a new *entity* can ship code-first.
- **Missing column on a pushed table → loud failure.** PostgREST answers **400**
  (`PGRST204`, "column not found in schema cache") when a pushed row names an unknown
  column, and `pushAll` throws — session sync goes to `error` status for every device
  running that build. This strictness is deliberate. **The `ALTER TABLE … ADD COLUMN`
  must be run in the SQL editor before deploying any build whose `toRow` includes the
  new column.** Order of operations for a new pushed column: append the addendum →
  owner runs it → confirm via curl (below) → then push to `main`.

When a change adds a whitelisted value set or constraint, remember the triple
declaration (see [sync.md](sync.md) and CLAUDE.md invariant 6): the TS union in
`src/types.ts`, the pull sanitizer in `src/sync.ts`, and the SQL `check` in
`supabase-schema.sql` must accept/reject identically — e.g. the `time` HH:MM regex in
`fromRow` and the SQL check on `sessions.time` match the same strings (spelled with
`\d` in TS, `[0-9]` in SQL).

## RLS model and the no-DELETE guarantee

All three tables have RLS enabled with anon policies for **select / insert / update
only**, each insert/update checked against `user_id = 'dmitrii'`. There is deliberately
no delete policy, and the privilege is additionally **revoked outright**
(`revoke delete on … from anon`). Consequences:

- A stranger who finds the site (the key is public) can add noise rows or mutate
  existing ones, but can **never erase history**. Pull-side sanitizers in `src/sync.ts`
  (`fromRow`, `fromCompRow`, `fromStateRow`) plus "remote never deletes local rows" in
  `mergeById` are the second layer that keeps tampering out of the app.
- **The app can never delete anything either.** Janitorial deletes (tamper rows, junk)
  are owner-only operations via the dashboard Table Editor or SQL editor (or psql with
  owner credentials). This is by design; do not add a delete path to the app without
  first reading invariant 3 in CLAUDE.md and the pull-before-push discussion in
  [sync.md](sync.md).
- **When hand-editing rows in SQL, set `updated_at = now()`** — the DB has no `now()`
  defaults or triggers (they would corrupt LWW for offline-delayed pushes; header
  comment in `supabase-schema.sql`), so a hand edit that leaves `updated_at` stale is
  invisible to every device: their local copy ties or wins the merge.

Note the asymmetry that follows: a hand-edited row with bumped `updated_at` *will*
propagate to devices on next pull, but a hand-**deleted** row will be **re-inserted by
the next push** from any device that still holds it locally (blind full-table upsert).
To truly remove a real row you must delete it in SQL *and* clear it from every device's
localStorage — or accept it will resurrect. Tamper rows with `demo-` ids are the
exception: `isPushable` excludes them from push and `mergeById` from merge, so deleting
them in SQL is final.

## Inspecting live data with curl

PostgREST requires **both** headers — `apikey` and `Authorization: Bearer` — with the
same publishable key (values from `src/config.ts`):

```bash
KEY='sb_publishable__QGdeG-Y0kPIafSQpIIfSw__B1MsCKv'
BASE='https://rdhzcvmvtxnzittmclgr.supabase.co/rest/v1'
AUTH=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

# Latest sessions (id, date, time, title), newest first
curl -s "${AUTH[@]}" \
  "$BASE/sessions?select=id,date,time,title,updated_at&user_id=eq.dmitrii&order=date.desc&limit=10"

# Exact row count without a body
curl -sI "${AUTH[@]}" -H 'Prefer: count=exact' \
  "$BASE/sessions?select=id&user_id=eq.dmitrii" | grep -i content-range

# One row by id
curl -s "${AUTH[@]}" "$BASE/sessions?id=eq.<the-id>"

# Competitions and the app_state blob
curl -s "${AUTH[@]}" "$BASE/competitions?select=*&user_id=eq.dmitrii&order=date.desc"
curl -s "${AUTH[@]}" "$BASE/app_state?user_id=eq.dmitrii"

# Hunt for rows the app would hide (see the demo-99 incident below)
curl -s "${AUTH[@]}" "$BASE/sessions?id=like.demo-*"
```

PostgREST caps any response at 1000 rows; the app's own pull orders
`updated_at.desc` so hypothetical overflow drops the oldest (see `pullAll` in
`src/sync.ts`). For inspection, add `&offset=` paging if the count ever approaches that.

Remember: with this key you can also INSERT and UPDATE. Never "test" against the live
tables with real-looking rows — the app cannot delete them (CLAUDE.md warns the same
about the UI). Use `demo-` prefixed ids if you must write, and delete them as owner
afterwards.

## Deploy pipeline

**A push to `main` is a deploy** — `.github/workflows/deploy.yml` runs on every push:
checkout → Node 22 → `npm ci` → `npx vitest run` → `npm run build` (strict `tsc`, vite
build, `scripts/sw-precache.mjs` precache injection) → upload `dist/` →
`actions/deploy-pages`. Concurrency group `pages` with `cancel-in-progress: true`, so
rapid pushes only deploy the last one. The site serves at
`https://dmitryyarastov.github.io/rollbook/` (subpath — hence `base: './'` in
`vite.config.ts`).

Verifying a deploy landed:

```bash
gh run list --workflow deploy.yml --limit 3        # green run for your SHA?
curl -s https://dmitryyarastov.github.io/rollbook/ | grep -o 'assets/[^"]*'   # new hashes?
curl -s https://dmitryyarastov.github.io/rollbook/sw.js | grep "const CACHE"  # new cache name?
```

The asset hashes in the served `index.html` change with any change to the built JS/CSS,
and the `rollbook-<hash>` cache constant in `sw.js` is hashed from the precache file
list; matching them against your local `dist/` output confirms the exact build is live.

PWA update behavior (details in [build-pwa.md](build-pwa.md)): navigations are
**network-first**, so a fresh deploy's HTML — which names the new hashed assets — is
picked up on the **next load/foreground navigation**; hashed assets are cache-first and
immutable. The new SW `skipWaiting`s and `clients.claim`s, and its activate handler
purges every cache whose name is not the current `CACHE` (not just `rollbook-*` ones). Net effect: an installed PWA gets the new version one
app-open after the deploy (or on pull-to-refresh), no manual cache-busting ever needed.
If the deploy included a new pushed column, remember the ALTER must already be live or
every updated device immediately shows a sync error.

## Known data history

- **The `demo-99` tamper incident.** A hand-inserted row with id `demo-99` was once
  found in the live `sessions` table (anyone with the public key can insert). It was
  invisible in-app — `mergeById` skips non-pushable (`demo-`) remote ids and the
  sanitizers bound every field — which is exactly the layered-defense design working.
  It was deleted by the owner via the dashboard. If odd totals are ever reported,
  compare the curl row count against the in-app count and hunt with the `id=like.demo-*`
  query above; also check for rows the sanitizers silently drop on pull (bad
  ids/dates/timestamps) — out-of-range values are clamped, not dropped.
- **Legacy morning-after sessions.** Classes run in the evening but were historically
  logged the next morning; before the When picker (`LogForm.when` / `resolveWhen`)
  existed, those rows were stamped with the logging morning's date and sometimes carry
  auto-titles derived from it. `sessions.time` is `null` on all rows predating the
  picker (the column's addendum note says the same). This is **known historical data,
  not a bug** — do not "fix" it in code. If the owner ever wants it corrected, the only
  route is hand-SQL per row (`update … set date = …, updated_at = now() where id = …`);
  the bumped `updated_at` propagates the fix to devices on their next pull.

## Future auth migration

Sketch preserved as comments at the bottom of the base section in
`supabase-schema.sql`: when real auth lands (Supabase magic link / OAuth), the change is
a **policy swap, not a schema rewrite** — repoint each policy at the `authenticated`
role with `with check (user_id = (select auth.uid()::text))`, backfill `user_id` once,
and have the client send the user's JWT as the Bearer token instead of the publishable
key (the `baseHeaders` helper in `src/sync.ts` is the single place that sets both
headers). Nothing else in the sync protocol changes.

## Disaster recovery

**localStorage (`rollbook:v1`, see `src/store.ts`) on the phone is authoritative; the
database is a replica.** If the Supabase project is lost, corrupted, or wiped:

1. Create/repair the project and run `supabase-schema.sql` top to bottom in the SQL
   editor (fresh) or the missing sections (partial).
2. Update `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `src/config.ts` if the project
   changed, and deploy.
3. Open the app on any device holding the local copy. The launch cycle
   (`src/useSync.ts` — `useSync`: pull → merge → push) blind-upserts every non-demo
   session and competition plus the state blob (pushed only when `stateUpdatedAt > 0`) —
   the DB is fully rebuilt by that one push. No import tooling exists or is needed.

The inverse also holds: a fresh device with empty localStorage rebuilds itself from the
DB on first pull. The only unrecoverable scenario is losing every device's localStorage
*and* the database simultaneously — there is no third copy, so if that risk ever
matters, an occasional owner-run curl dump of the three tables to a file is the cheap
insurance.

## Operational coupling table

| If you change… | You must also… |
|---|---|
| `src/config.ts` URL/key | Point at a project where `supabase-schema.sql` has been run in full; verify with the curl queries above |
| `supabase-schema.sql` (new column on a pushed table) | Run the ALTER in the SQL editor **before** deploying the build that pushes it; update `src/types.ts` union + `src/sync.ts` `toRow`/`fromRow` sanitizer in lockstep ([sync.md](sync.md) playbook) |
| `supabase-schema.sql` (new table) | Nothing urgent — code may ship first; pushes/pulls tolerate the 404 only if you replicate the competitions pattern in `pullAll`/`pushAll` |
| A SQL `check` constraint | Mirror it exactly in the `src/sync.ts` sanitizer and the `src/types.ts` union (triple declaration) |
| Any row by hand in SQL | Set `updated_at = now()` on it, or no device will ever pick the change up |
| RLS policies (auth migration) | Swap the Bearer token source in `baseHeaders` (`src/sync.ts`) and backfill `user_id` |
| `.github/workflows/deploy.yml` | Keep `npx vitest run` + `npm run build` before upload — the workflow is the last green-gate before the live site |
