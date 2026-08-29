# Curriculum ordering

`src/curriculum.ts` orders technique tags by the Gracie Barra (GB) curriculum's position-theme sequence. It is a pure module with two jobs: display-time tag ordering — it never mutates the persisted `tagList` (see [data-model.md](data-model.md)), which stays append-only master data in input order — and the open-guard tag whitelist behind the competition milestone (`isOpenGuardTag`, below).

## GB curriculum research (why the module looks like this)

GB teaches a worldwide 16-week rotating cycle organized by **position themes**, not fixed technique lists. The reconstruction used here: guard themes occupy odd weeks, split between guard bottom and guard passing; pin themes (side control, mount/knee-on-belly, back) occupy even weeks; standing/takedown material rotates on a 4-week cadence. **Week numbers drift between GB cycle revisions**, so this module deliberately orders by the canonical theme sequence — standing → guard → passing → pins → back → leg locks — and never by hard week numbers. The official syllabus is member-gated; the sequence was reconstructed from public GB school sites. Leg locks trail the sequence because GB places leg attacks at the end of the rotation and rank-gates them in the fundamentals program — they are the advanced tail of the cycle, not a positional theme with a week slot.

## Canonical group order

`CURRICULUM_GROUPS` (exported, `src/curriculum.ts`) is the single ordered source of truth:

| id | label |
|---|---|
| `standing` | Standing & takedowns |
| `guard` | Guard |
| `passing` | Guard passing |
| `side` | Side control |
| `mount` | Mount & knee on belly |
| `back` | Back & turtle |
| `legs` | Leg locks |
| `other` | Other |

`other` is not a GB theme; it is the trailing bucket for unmapped tags. The `CurriculumGroupId` union type is exported alongside. A pinned test in `src/curriculum.test.ts` asserts this exact id sequence — reordering groups is a deliberate act that must update that test.

## TAG_GROUP mapping conventions

`TAG_GROUP` (module-private, `src/curriculum.ts`) maps tag names to group ids.

- **Exact-name lookup only.** Keys are pre-lowercased; `groupOfTag` normalizes the input with `tag.trim().toLowerCase()` before lookup. A key that is not already lowercase/trimmed will silently never match.
- **Deliberately no keyword heuristics** (no substring matching, no "contains 'guard' → guard"). "Unknown → Other, in input order" is the only behavior a user can predict, and the map is cheap to extend. Do not add fuzzy matching.
- Spelling variants each get their own explicit key: `'x-guard'`/`'x guard'`, `'torreando'`/`'toreando'`, `'darce'`/`"d'arce"`, `'dlr'`/`'de la riva'`, `'kob'`/`'knee on belly'`, etc.
- Unmapped tags fall to `'other'` via `groupOfTag`'s `?? 'other'` and render in a trailing Other group, preserving input order.

## The three judgment calls (do not "fix" without reading this)

These are documented deviations, each pinned by a test in `src/curriculum.test.ts` (`groupOfTag judgment calls (documented deviations)` describe block):

1. **Generic `Escapes` → `side`.** GB's pin-escape rotation starts at side control, so the generic tag files there rather than getting its own group or landing in mount.
2. **`Half guard` → `guard`.** GB1 technically teaches half guard as side-control recovery; practical usage (how this user tags sessions) treats it as a guard, so it files under Guard.
3. **`Darce` → `back`** (along with anaconda, guillotine, front headlock). The front-headlock family is turtle-adjacent, so it files under Back & turtle rather than side control or a submissions bucket.

## Public API and semantics

- `groupOfTag(tag: string): CurriculumGroupId` — normalized exact lookup, `'other'` fallback.
- `isOpenGuardTag(tag: string): boolean` — normalized (trim + lowercase) membership test against the module-private `OPEN_GUARD_TAGS` set: the open-guard family (`open guard`, `de la riva`/`dlr`/`dlr x`, `spider`/`spider guard`, `lasso`, `butterfly`/`butterfly guard`, `x-guard`/`x guard`, `deep half`). Closed guard and half guard are **deliberately excluded** — the "open guard in competition" milestone (src/stats.ts — `openGuardMilestone`, see [stats.md](stats.md)) is about playing open guard, not any guard. Same no-heuristics policy as `TAG_GROUP`: exact whitelist membership with spelling variants as separate entries, no substring matching — extend the set, never fuzz the match.
- `groupTagsByCurriculum(tags: string[]): CurriculumSection[]` — non-empty groups only, in `CURRICULUM_GROUPS` order; **input order preserved within each group**; each section carries `{ group, label, tags }`.
- `orderTagsByCurriculum(tags: string[]): string[]` — flat version (`flatMap` over sections). Stable within groups; unknown tags last in input order.

All of these are pure and cheap; callers memoize the ordering functions where they run per-keystroke (see below).

## How to add or move a tag mapping

1. Edit `TAG_GROUP` in `src/curriculum.ts`. Key must be the lowercase, trimmed form of the tag; add spelling variants as separate keys.
2. Update `src/curriculum.test.ts`. The `REAL_TAGS` fixture pins the real synced tagList (as of 2026-08) and its exact expected ordering — a mapping change that touches any of those tags changes the expected array. A moved judgment-call tag must also update its dedicated test.
3. If the tag is in `DEFAULT_TAGS` (`src/store.ts`), it must map to a real group: the test `maps every default tag to a real group, never other` iterates `DEFAULT_TAGS` and rejects `'other'`.
4. `npm test` green before commit (see [testing.md](testing.md)).

### Coupling table

| If you change | You must also change |
|---|---|
| `CURRICULUM_GROUPS` order, ids, or labels | Pinned sequence + section-label tests in `src/curriculum.test.ts`; `CurriculumGroupId` union |
| `TAG_GROUP` entries | `REAL_TAGS` ordering fixture and judgment-call tests in `src/curriculum.test.ts` |
| `DEFAULT_TAGS` in `src/store.ts` (add a tag) | Add a `TAG_GROUP` entry, or the never-`other` test fails |
| `groupOfTag` normalization | Key format of every `TAG_GROUP` entry (they must stay pre-normalized) |
| `OPEN_GUARD_TAGS` / `isOpenGuardTag` | `openGuardMilestone` behavior and its tests in `src/stats.test.ts` ([stats.md](stats.md)); entries must stay pre-normalized like `TAG_GROUP` keys |

## Where ordering is applied (and where it is not)

- **Log chips** — `src/App.tsx` computes `logTagList` in a `useMemo`: `orderTagsByCurriculum(withSessionTags(data.tagList, data.sessions))`, passed as `tagList` to `src/screens/Log.tsx`. `withSessionTags` (`src/stats.ts`, see [stats.md](stats.md)) appends tags that exist only on sessions, display-time, without persisting them. The memo exists because Log form state lives in `App`, so every keystroke re-renders it.
- **Focus tag picker** — `src/components/FocusCard.tsx` calls `orderTagsByCurriculum(tagList)` on its prop internally. Both call sites (`src/screens/Home.tsx`, `src/screens/Techniques.tsx`) pass raw `data.tagList` — **not** `withSessionTags` — so session-only tags do not appear in the focus picker. That asymmetry is current fact, not accident-proofed; keep it in mind if unifying.
- **Techniques grouped cloud** — `src/screens/Techniques.tsx` uses `groupTagsByCurriculum(withSessionTags(data.tagList, data.sessions))` inside its `useMemo`, rendering one `cloud-group` block per section with the section `label` as the header (styles in `src/app.css`, see [design-system.md](design-system.md)).

**Not applied to persisted data.** `data.tagList` order is untouched everywhere: `addTag` in `src/App.tsx` appends; sync ([sync.md](sync.md)) pushes the array verbatim and never reorders it on pull (the pull sanitizer only type-filters entries, falling back to the local list when empty). Curriculum ordering is a lens over master data, never a write.
