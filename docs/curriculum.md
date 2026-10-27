# Curriculum ordering

`src/curriculum.ts` orders technique tags by the Gracie Barra (GB) curriculum's position-theme sequence. It is a pure module with two jobs: display-time tag ordering — it never mutates the persisted `tagList` (see [data-model.md](data-model.md)), which stays append-only master data in input order — and the open-guard tag whitelist behind the competition milestone (`isOpenGuardTag`, below). Two more consumers have since attached to `groupOfTag`: the characteristic matchers in `src/xp.ts` and, since 2026-10-23, the skill tree in `src/tree.ts` (see "Beyond ordering" below, [stats.md](stats.md) and [skill-tree.md](skill-tree.md)).

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

## Owner rulings (2026-10) — authoritative, pinned by the "owner's 2026-10 tag rulings" test

The owner classified his own newer tags; these override any plausible-looking alternative:

- **`SLX` / `single leg x` → `guard`**, and a member of `OPEN_GUARD_TAGS` — it is an open guard, so an SLX-tagged competition satisfies the open-guard milestone.
- **`Top lock` → `guard`** — a closed-guard variant *despite the name*; it is NOT top control and must not feed that characteristic.
- **`Side scissors` → `guard`** — a closed-guard improved position.
- **`Pendulum` → `guard`** (alias of the mapped `pendulum sweep`).
- **`Double under pass`, `Long step pass` → `passing`** (aliases of `double under` / `long step`).
- **`Slide by` → `standing`** — a no-gi standing technique (the gi split routes it to the Wrestling · No-Gi characteristic on no-gi sessions).
- **`Turtle defense` → `back`** — bottom-side turtle work; back & turtle theme, deliberately not top control.
- **`2on1 from closed guard` → `guard`** (2026-10-16) — the owner's name for the arm drag (two-on-one) hit from closed guard, usually into a back take. It is deliberately a separate tag from `Arm drag`, which stays `standing` for arm drags on the feet (no-gi, alongside `Slide by`). As a guard-bottom attack it feeds no characteristic; it is not an open guard.

## The 2026-10 vocabulary harvest

~75 additional names (with spelling variants) were researched from GB school curriculum pages and
reputable BJJ glossaries and folded into `TAG_GROUP`, so tags the owner is likely to type in the
future arrive pre-mapped — modern guards (k-guard, reverse DLR, worm/lapel guards), wrestling
vocabulary (blast double, duck under, collar tie), passing systems (headquarters, pressure passing,
sao paulo), pins and back attacks (scarf hold, gift wrap, body triangle, neckties), and the
leg-lock game (inside/outside heel hook, saddle synonyms 411/honey hole/inside sankaku, reaps,
calf slicers). Unambiguous open guards joined `OPEN_GUARD_TAGS` (z-guard and rubber guard
deliberately did not — half-guard family and closed-guard system respectively), and unambiguous
top-position work joined `TOP_CONTROL_TAGS` in `src/xp.ts` (buggy choke, escapes, and turtle-bottom
stayed out — bottom work). Spot-pinned by the "2026-10 vocabulary harvest" tests. Known-rare names
were deliberately skipped (squid/octopus/williams guard, cement mixer, banana split, …) — unknown
tags falling into Other remains the correct, predictable behavior.

## Live-data audit (2026-10-16)

A review queried the live synced tag list and found four real tags still in Other; they were mapped by precedent with the app's existing entries (research-based, not owner rulings — revisit if the owner disagrees):

- **`Yoko Tomoe Nage` → `standing`** — side variant of the harvested `tomoe nage`.
- **`Opening Closed Guard` → `passing`** — same technique as `guard break`; GB teaches it in the guard-top weeks.
- **`Cow catcher` → `back`**, and in `TOP_CONTROL_TAGS` — front-headlock control from the top, filed like `front headlock`.
- **`Half Butterfly` → `guard`**, **not** in `OPEN_GUARD_TAGS` — **owner ruling (2026-10-16): it is a half-guard variant**, so like z-guard it does not satisfy the open-guard milestone.

Pinned by the "maps every tag in the live synced data" test. After any new tag appears in real use, re-run the audit query in [operations.md](operations.md)'s spirit: every live tag should land in a real group.

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
| `CURRICULUM_GROUPS` order, ids, or labels | Pinned sequence + section-label tests in `src/curriculum.test.ts`; `CurriculumGroupId` union; the skill tree's branch order and labels follow it (`src/tree.test.ts` pins both) |
| `TAG_GROUP` entries | `REAL_TAGS` ordering fixture and judgment-call tests in `src/curriculum.test.ts`; characteristic XP in `src/xp.ts` — the `passing`, `standing` (takedowns-gi / wrestling-nogi), and `legs` matchers read `groupOfTag`, so moving a tag between those groups silently moves its lifetime XP (`src/xp.test.ts`, [stats.md](stats.md)); the skill tree (`src/tree.ts`) places every tag's leaf and credits its branch by `groupOfTag`, so a move also re-homes the leaf and shifts branch XP (`src/tree.test.ts` if it uses that tag, [skill-tree.md](skill-tree.md)) |
| `DEFAULT_TAGS` in `src/store.ts` (add a tag) | Add a `TAG_GROUP` entry, or the never-`other` test fails |
| `groupOfTag` normalization | Key format of every `TAG_GROUP` entry (they must stay pre-normalized) |
| `OPEN_GUARD_TAGS` / `isOpenGuardTag` | `openGuardMilestone` behavior and its tests in `src/stats.test.ts` ([stats.md](stats.md)); entries must stay pre-normalized like `TAG_GROUP` keys |

## Where ordering is applied (and where it is not)

- **Log chips** — `src/App.tsx` computes `logTagList` in a `useMemo`: `orderTagsByCurriculum(withSessionTags(data.tagList, data.sessions))`, passed as `tagList` to `src/screens/Log.tsx`. `withSessionTags` (`src/stats.ts`, see [stats.md](stats.md)) appends tags that exist only on sessions, display-time, without persisting them. The memo exists because Log form state lives in `App`, so every keystroke re-renders it.
- **Focus tag picker** — `src/components/FocusCard.tsx` calls `orderTagsByCurriculum(tagList)` on its prop internally. Both call sites (`src/screens/Home.tsx`, `src/screens/Techniques.tsx`) pass raw `data.tagList` — **not** `withSessionTags` — so session-only tags do not appear in the focus picker. That asymmetry is current fact, not accident-proofed; keep it in mind if unifying. (One more focus-setting path exists since 2026-10-23: the skill tree's "Set as focus" on Techniques, whose leaves come from `withSessionTags` — a session-only tag set there becomes `focus.tag` but shows no selected chip in the FocusCard picker; see [skill-tree.md](skill-tree.md).)
- **Techniques grouped cloud** — `src/screens/Techniques.tsx` uses `groupTagsByCurriculum(withSessionTags(data.tagList, data.sessions))` inside its `useMemo`, rendering one `cloud-group` block per section with the section `label` as the header (styles in `src/app.css`, see [design-system.md](design-system.md)).

**Not applied to persisted data.** `data.tagList` order is untouched everywhere: `addTag` in `src/App.tsx` appends; sync ([sync.md](sync.md)) pushes the array verbatim and never reorders it on pull (the pull sanitizer only type-filters entries, falling back to the local list when empty). Curriculum ordering is a lens over master data, never a write.

## Beyond ordering: the XP characteristic matchers and the skill tree

The skill tree ([skill-tree.md](skill-tree.md)) is the newest consumer of `groupOfTag`: `TAG_GROUP` **is** its mapping. `src/tree.ts — skillTree` makes one branch per `CURRICULUM_GROUPS` entry and files every tag's leaf under `groupOfTag(tag)`, so an unmapped tag shows under Other until it gets an entry here, and mapping it moves the leaf (and its branch credit) on the next render — no tree data lives anywhere else.

`src/xp.ts — CHARACTERISTICS` matches session/comp tags through `groupOfTag` for four of the six lifelong attributes: `passing` (the `passing` group), `takedowns-gi` / `wrestling-nogi` (the `standing` group, split by the entry's `gi` flag), and `leglocks` (the `legs` group). The other two matchers — guard retention and top control — keep their own exact-tag whitelists inside `src/xp.ts` (same no-heuristics policy as `TAG_GROUP`: pre-normalized exact membership, spelling variants as separate entries, extend the set, never fuzz the match). The coupling is live in both directions of intent: extending `TAG_GROUP` so a new tag orders correctly **also** enrolls it in the matching characteristic — usually what's wanted, but check `src/xp.test.ts` when the group is `passing`/`standing`/`legs` ([stats.md](stats.md)).
