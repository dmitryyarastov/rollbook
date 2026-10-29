# Curriculum: the tag vocabulary and its hierarchy

`src/curriculum.ts` is the technique-tag vocabulary: every known tag's **canonical spelling**, the **aliases** that fold into it, and the **two-level hierarchy** every tag hangs from. It is a pure module with three jobs — display-time ordering (it never mutates the persisted `tagList`, which stays append-only master data in input order, see [data-model.md](data-model.md)), **canonicalization** (a pure, idempotent fold applied where data enters the app — never a stored migration, see "Canonical spellings" below), and the open-guard whitelist behind the competition milestone (`isOpenGuardTag`). Three consumers hang off its placement functions: the characteristic matchers in `src/xp.ts`, the skill tree in `src/tree.ts`, and the Techniques cloud / Log picker ordering (see "Beyond ordering" below, [stats.md](stats.md) and [skill-tree.md](skill-tree.md)).

## History: from Gracie Barra position groups to the owner's game map

The module began (2026-08) as a Gracie Barra (GB) curriculum ordering. GB teaches a worldwide 16-week rotating cycle organized by **position themes**: guard themes in odd weeks, split between guard bottom and guard passing; pin themes (side control, mount/knee-on-belly, back) in even weeks; standing material on a 4-week cadence; leg locks as the rank-gated tail. Week numbers drift between cycle revisions, so the module ordered by the canonical theme sequence — standing → guard → passing → pins → back → leg locks — never by week numbers. That sequence still shapes the branch order below.

On **2026-10-28** the owner replaced the seven GB position groups with his **own top level** — the map of the game from his RPGreal skill tree ([skill-tree.md](skill-tree.md)), with the Top control and Escapes branches he had asked for on 2026-10-23 — and added a **second level** where his tags cluster. The same session normalized his tag spellings (next section). His rulings, all pinned by `src/curriculum.test.ts`:

- **Six branches**: Standing & takedowns · Guard · Guard passing · Top control · Escapes · Leg locks, plus the trailing Other.
- **Top control splits three ways**: Side control · Mount & knee on belly · Back & turtle. Darce and Panda file under Back & turtle (the front-headlock family stays turtle-adjacent, as it always did).
- **Escapes is a branch of its own**: the generic Escapes tag, Turtle defense, and the harvested escape names (mount/back escapes, upa, shrimp, elbow, ghost and running escapes). Roll through defense stays in Other, as he ruled.
- **Generic submissions and sweeps hang directly from Guard** (Kimura, Armbar, Triangle, Sweeps, Lumberjack sweep, plus Guard retention) — they are hit from several guards, so they are not filed inside Closed / Open / Half.
- **Panda → Back & turtle**; **Roll through defense → leave in Other** (his words, same day).
- **Side / mount / back / turtle swap rounds light Top control *and* Escapes** in the tree — the both-roles rule — while the characteristics stay Top-control-only ([skill-tree.md](skill-tree.md), [stats.md](stats.md)).

## The hierarchy

`CURRICULUM_GROUPS` (branches, display order) and `CURRICULUM_SUBGROUPS` (sub-groups, display order within their branch) are the two exported, ordered sources of truth. A pinned test asserts both exact sequences — reordering is a deliberate act that must update it.

| Branch (`CurriculumGroupId`) | Label | Sub-groups (`CurriculumSubgroupId`) |
|---|---|---|
| `standing` | Standing & takedowns | `wrestling` Wrestling · `judo` Judo |
| `guard` | Guard | `closed-guard` Closed guard · `open-guard` Open guard · `half-guard` Half guard |
| `passing` | Guard passing | `pressure-passing` Pressure passing · `dynamic-passing` Dynamic passing · `opening-closed-guard` Opening closed guard |
| `top` | Top control | `side-control` Side control · `mount-kob` Mount & knee on belly · `back-turtle` Back & turtle |
| `escapes` | Escapes | — (flat) |
| `legs` | Leg locks | — (flat) |
| `other` | Other | — (the trailing bucket for unmapped tags; never a place a tag is declared in) |

A tag's **place** (`CurriculumPlace`) is either a branch id or a sub-group id: a tag with a sub-group entry sits in it; a tag declared on a branch hangs **directly** from that branch (Takedowns, Guard pull, Passing, the generic guard attacks, every Escapes and Leg locks tag). Where his live tags sit on 2026-10-28:

- Standing & takedowns › **Wrestling**: Single leg takedown, Arm drag, Slide by, Cow catcher · **Judo**: Tomoe nage, Yoko tomoe nage
- Guard (direct): Guard retention, Sweeps, Lumberjack sweep, Kimura, Armbar, Triangle · **Closed guard**: Closed guard, Top lock, Side scissors, 2-on-1 from closed guard, Pendulum sweep · **Open guard**: De La Riva, DLR X, Single leg X, Spider guard · **Half guard**: Half guard, Half butterfly
- Guard passing (direct): Passing · **Pressure passing**: Over-under pass, Double under pass, Smash pass · **Dynamic passing**: Knee cut, Long step pass · **Opening closed guard**: Opening closed guard
- Top control › **Side control**: Side control · **Mount & knee on belly**: Mount attacks, Mount, Gift wrap · **Back & turtle**: Back takes, Darce, Panda
- Escapes: Escapes, Turtle defense
- Leg locks: Leg locks
- Other: Roll through defense

## Canonical spellings and aliases (the 2026-10-28 rename)

Every tag is declared once in `TAG_DEFS` as `{ name, place, aliases? }`: `name` is the canonical spelling (sentence case; proper nouns keep their capitals — De La Riva, DLR X, Sao Paulo pass), `aliases` are other spellings that fold into it. Both are matched **trimmed and lowercased** (`norm`), so the alias list never needs case variants — only genuinely different spellings (`slx`, `knee slice`, `rnc`, `d'arce`, `honey hole` …). `TAG_DEFS` is exported for the vocabulary tests only; the app reads it through the functions below.

The owner normalized his live vocabulary on 2026-10-28 (owner ruling: "normalize all"):

| Before | Canonical now |
|---|---|
| Closed Guard · Side Control · Over-Under Pass · Double Under Pass · Smash Pass · Opening Closed Guard · Top Lock · Side Scissors · Half Butterfly · Spider Guard · Tomoe Nage · Yoko Tomoe Nage | the same names in sentence case |
| SLX | Single leg X |
| 2on1 from closed guard | 2-on-1 from closed guard |
| Pendulum | Pendulum sweep |
| De La Riva, DLR X, and every other live tag | unchanged |

Every old spelling stays an alias, so stored rows, the focus tag (`DLR X`, unchanged) and the whitelists keep resolving. Aliases are spellings and plain synonyms of **one** technique, never two techniques — the three merges that are synonyms rather than spellings, for the owner to eyeball: `footlock` → `Ankle lock` (the IBJJF "straight foot lock"), bare `butterfly` → `Butterfly guard`, and `turtle escapes` / `turtle bottom` → `Turtle defense`. The harvested vocabulary got canonical names in the same pass (`X-guard` with alias `x guard`, `Toreando` with `torreando`/`bullfighter`/`matador pass`, `Kesa gatame` with `scarf hold`, `Saddle` with `411`/`honey hole`/`inside sankaku`, …) — so two spellings of one technique can never become two leaves.

**Where the fold is applied — the boundaries, never the middle.** `canonicalTag`/`canonicalTags` run exactly where data enters the app, so everything downstream (stats, XP, the tree, exact-match comparisons such as `focusProgress`) sees one spelling and stays simple:

| Boundary | What folds |
|---|---|
| `src/store.ts — load()` | every session's and competition's `tags`, the `tagList` (duplicates collapse, first position kept), `focus.tag` — a **read-side normalization, not a stamped edit**: `stateUpdatedAt` is untouched ([data-model.md](data-model.md)) |
| `src/sync.ts — fromRow` / `fromCompRow` / `fromStateRow` | the same four, on every pull — a stale device's old spelling can never resurrect a renamed tag ([sync.md](sync.md), which also reasons the rename through last-write-wins) |
| `src/App.tsx — saveSession` / `saveComp` / `addTag`, `src/screens/Log.tsx — commitTag` | new rows and new names are written canonical; typing an alias ("slx") lands on the existing tag instead of minting a second one |

Stored data is therefore never migrated in place: a row written before the rename still says `Closed Guard` in the database until a device pushes its folded copy back (the blind upsert of identical-meaning rows — see [sync.md](sync.md)), and the optional one-off SQL tidy in [operations.md](operations.md) only accelerates that. The app's behavior is the same either way.

## Mapping conventions

- **Exact-name lookup only.** `placeOfTag`/`groupOfTag`/`canonicalTag` normalize with `tag.trim().toLowerCase()` and look the key up; names and aliases are normalized at module init, so a declaration can't silently fail to match.
- **Deliberately no keyword heuristics** (no substring matching, no "contains 'guard' → guard"). "Unknown → Other, in input order, spelled as typed" is the only behavior a user can predict, and the vocabulary is cheap to extend. Do not add fuzzy matching.
- **One declaration per spelling.** A spelling declared twice (as a name or alias) would silently shadow a definition; the "declares every spelling once" test rejects it. Spelling variants are aliases of one definition, never separate definitions.
- Unmapped tags fall to `'other'` via `placeOfTag`'s `?? 'other'` and render in the trailing Other group, preserving input order; `canonicalTag` returns them trimmed but otherwise as typed.

## The judgment calls (do not "fix" without reading this)

Three deviations from a naive placement, each pinned by a named test in `src/curriculum.test.ts`. The 2026-10-28 top level re-homed two of them; the reasoning stands:

1. **Generic `Escapes` → the Escapes branch.** Until 2026-10-28 it filed under Side control (GB's pin-escape rotation starts there); the owner's Escapes branch now holds the whole bottom game, so the generic tag — his second most-used — anchors that branch. Turtle defense, mount/back escapes and the harvested escape names sit beside it. (Buggy choke, a bottom-side-control attack, files here too: it is bottom work, and must never feed Top control.)
2. **`Half guard` → Guard › Half guard.** GB1 technically teaches half guard as side-control recovery; practical usage (how this user tags sessions) treats it as a guard. Deep half, Half butterfly, Z-guard, knee shield, lockdown and the half-guard sweeps sit with it.
3. **`Darce` → Top control › Back & turtle** (with anaconda, guillotine, front headlock, the neckties). The front-headlock family is turtle-adjacent, so it files with back and turtle rather than under side control or a submissions bucket. Cow catcher is the exception by owner ruling (below).

## Owner rulings (2026-10) — authoritative, pinned by the "owner's 2026-10 tag rulings" tests

- **`Single leg X` (was `SLX`) → Guard › Open guard**, and a member of `OPEN_GUARD_TAGS` under both spellings — an open guard, so an SLX-tagged competition satisfies the open-guard milestone.
- **`Top lock` → Guard › Closed guard** — a closed-guard variant *despite the name*; it is NOT top control and must not feed that characteristic.
- **`Side scissors` → Guard › Closed guard** — a closed-guard improved position.
- **`Pendulum sweep` (was `Pendulum`) → Guard › Closed guard.**
- **`Double under pass` → Guard passing › Pressure passing; `Long step pass` → Dynamic passing.**
- **`Slide by` → Standing › Wrestling** — a no-gi standing technique (the gi split routes it to the Wrestling · No-Gi characteristic on no-gi sessions).
- **`Turtle defense` → Escapes** — bottom-side turtle work; deliberately not top control. (Until 2026-10-28 it filed under Back & turtle.)
- **`2-on-1 from closed guard` (was `2on1 from closed guard`) → Guard › Closed guard** (2026-10-16) — the owner's name for the arm drag (two-on-one) hit from closed guard, usually into a back take. It is deliberately a separate tag from `Arm drag`, which stays under Standing › Wrestling for arm drags on the feet (no-gi, alongside `Slide by`). As a guard-bottom attack it feeds no characteristic; it is not an open guard.
- **`Half butterfly` → Guard › Half guard**, **not** in `OPEN_GUARD_TAGS` — owner ruling (2026-10-16): it is a half-guard variant, so like Z-guard it does not satisfy the open-guard milestone.
- **`Single leg takedown` → Standing › Wrestling** (2026-10-27): the skill tree made the gap visible — the map knew `single leg` but not his tag's spelling, so the leaf sat under Other. Its hyphenated and double-leg twins are aliases of it and of `Double leg takedown`; as standing tags they feed Takedowns · Gi / Wrestling · No-Gi through `groupOfTag` (pinned in `src/xp.test.ts`).
- **`Cow catcher` → Standing › Wrestling** (2026-10-27, overriding the 2026-10-16 research placement under back & turtle): for him it is standing work, a front-headlock entry off the feet. It keeps its `TOP_CONTROL_TAGS` entry in `src/xp.ts` — removing it would silently lower his Top control level — so a cow-catcher session feeds Top control **and** Takedowns · Gi / Wrestling · No-Gi.
- **`Panda` → Top control › Back & turtle** (2026-10-28; it sat in Other). **`Roll through defense` stays in Other** (same ruling: "leave as it is").

Research placements that are not owner rulings (revisit if he disagrees): `Yoko tomoe nage` and `Tomoe nage` → Judo (he keeps both tags; the side variant is its own technique), `Opening closed guard` → its own passing sub-group (= guard break; GB teaches it in the guard-top weeks).

## The 2026-10 vocabulary harvest

~75 additional names (with spelling variants) were researched from GB school curriculum pages and reputable BJJ glossaries and folded into the vocabulary, so tags the owner is likely to type in the future arrive pre-placed and pre-spelled — modern guards (K-guard, Reverse De La Riva, worm/lapel guards), wrestling vocabulary (Blast double, Duck under, Collar tie), passing systems (Headquarters, Pressure passing, Sao Paulo pass), pins and back attacks (Kesa gatame, Gift wrap, Body triangle, the neckties), and the leg-lock game (inside/outside heel hook, Saddle with its synonyms, Knee reap, Calf slicer). Unambiguous open guards are in `OPEN_GUARD_TAGS` (Z-guard and Rubber guard deliberately are not — half-guard family and closed-guard system respectively), and unambiguous top-position work is in `TOP_CONTROL_TAGS` in `src/xp.ts` (Buggy choke, the escapes and turtle-bottom stayed out — bottom work). On 2026-10-28 every harvested name was re-homed into the owner's branches and given a canonical spelling with its variants as aliases (`Toreando` absorbs `torreando`/`bullfighter`/`matador pass`; `Saddle` absorbs `411`/`honey hole`/`inside sankaku`; `Ankle lock` absorbs `straight ankle lock`/`footlock`; `Turtle defense` absorbs `turtle bottom`/`turtle escapes` …). Spot-pinned by the "2026-10 vocabulary harvest" test. Known-rare names were deliberately skipped (squid/octopus/williams guard, cement mixer, banana split, …) — unknown tags falling into Other remains the correct, predictable behavior.

## Live-data audit

The skill tree ([skill-tree.md](skill-tree.md)) is the live audit: any tag under its Other branch is a missing `TAG_DEFS` entry (or, like Roll through defense, a deliberate one). The "maps every live tag (2026-10-28)" test pins the 41-tag live vocabulary of that date under its original spellings and asserts each lands in a real branch (Roll through defense excepted) and that its canonical spelling lands in the same place. After any new tag appears in real use, re-run the audit query in [operations.md](operations.md)'s spirit.

## Public API and semantics

- `canonicalTag(tag: string): string` — the canonical spelling: a known name or alias folds to its definition's `name`; an unknown tag comes back trimmed, otherwise as typed. **Idempotent** (pinned over every name and alias).
- `canonicalTags(tags: readonly unknown[]): string[]` — the array form for stored rows and lists: non-strings and blanks dropped, every member folded, duplicates collapsed keeping the **first** position; order otherwise preserved.
- `placeOfTag(tag: string): CurriculumPlace | 'other'` — normalized exact lookup of the tag's place (branch or sub-group id), `'other'` fallback.
- `groupOfTag(tag: string): CurriculumGroupId` — the tag's branch (a sub-group's parent, or the branch itself). The API the characteristic matchers use; `groupOfPlace(place)` is the underlying map.
- `subgroupOfTag(tag: string): CurriculumSubgroupId | null` — the tag's sub-group, or `null` when it hangs directly from its branch or is unmapped.
- `isOpenGuardTag(tag: string): boolean` — normalized membership test against the module-private `OPEN_GUARD_TAGS` set: the open-guard family under every spelling (`open guard`, `de la riva`/`dlr`, `dlr x`/`deep dlr`, `single leg x`/`slx`, `spider`/`spider guard`, `lasso`, `butterfly`/`butterfly guard`, `x-guard`/`x guard`, `deep half`, `k-guard`, `reverse de la riva`/`rdlr`, `worm guard`, `lapel guard(s)`, `93 guard`, `shin to shin`, `collar sleeve`, `berimbolo`/`bolo`). Closed guard and half guard are **deliberately excluded** — the "open guard in competition" milestone (`openGuardMilestone`, see [stats.md](stats.md)) is about playing open guard, not any guard. It is a **separate declaration from the Open guard sub-group on purpose**: Deep half sits under Half guard in the tree yet counts here, the sub-group's sweeps (Tripod/Butterfly/Hook/Elevator sweep) are techniques and do not, and the milestone's meaning must not drift with tree housekeeping. The pinned test keeps the two in step: every guard in the sub-group is whitelisted under every spelling, and nothing outside Guard is.
- `groupTagsByCurriculum(tags: string[]): CurriculumSection[]` — non-empty branches only, in `CURRICULUM_GROUPS` order; each section carries `{ group, label, tags, subsections }` where `tags` are the branch's **direct** tags and `subsections` its non-empty sub-groups (`{ subgroup, label, tags }`) in `CURRICULUM_SUBGROUPS` order; **input order preserved within every list**, the caller's spellings kept (ordering is a lens, not a fold).
- `orderTagsByCurriculum(tags: string[]): string[]` — flat version: each branch's direct tags, then its sub-groups in order; stable within every list; unknown tags last in input order.

All of these are pure and cheap; callers memoize the ordering functions where they run per-keystroke (see below).

## How to add or move a tag

1. Add a `t('Canonical name', 'place', [aliases])` entry to `TAG_DEFS` in `src/curriculum.ts` — or edit the existing one. Spelling variants are aliases of one entry, never a second entry; the place is a branch id for a generic tag or a sub-group id.
2. Update `src/curriculum.test.ts`. The `REAL_TAGS` ordering fixture pins the 2026-08 synced list's exact ordering — a placement change touching one of those tags changes the expected array. A moved judgment-call or ruling tag must also update its named test. `LIVE_TAGS_2026_10_28` pins that every live tag resolves.
3. If the tag is in `DEFAULT_TAGS` (`src/store.ts`), it must be canonical and map to a real branch: the "every default tag is already canonical" test iterates `DEFAULT_TAGS`.
4. A **rename** of an existing name: change `name`, add the old spelling to `aliases`. Nothing else in the data path — the boundaries fold stored data on the next load/pull. But `src/xp.ts`'s whitelists (`TOP_CONTROL_TAGS`, `RETENTION_TAGS`) match normalized spellings, so the new name's normalized form must be listed there too or the tag silently stops feeding its level: the lockstep test in `src/xp.test.ts` ("every vocabulary spelling credits exactly what its canonical name credits") fails until it is, and its sibling pins that every whitelisted spelling is a known vocabulary entry.
5. `npm test` green before commit (see [testing.md](testing.md)).

### Coupling table

| If you change | You must also change |
|---|---|
| `CURRICULUM_GROUPS` / `CURRICULUM_SUBGROUPS` order, ids, or labels | Pinned sequence + section-label tests in `src/curriculum.test.ts`; the `CurriculumGroupId` / `CurriculumSubgroupId` unions; the skill tree's branch and sub-group order and labels follow (`src/tree.test.ts` pins both); `SPEC_GROUPS` in `src/tree.ts` names sub-group ids |
| A tag's `place` in `TAG_DEFS` | `REAL_TAGS` ordering fixture and the ruling tests in `src/curriculum.test.ts`; characteristic XP in `src/xp.ts` — the `passing`, `standing` (takedowns-gi / wrestling-nogi), and `legs` matchers read `groupOfTag`, so moving a tag across those branches silently moves its lifetime XP (`src/xp.test.ts`, [stats.md](stats.md)); the skill tree (`src/tree.ts`) places every tag's leaf and credits its sub-group and branch by `placeOfTag`, so a move re-homes the leaf and shifts node XP (`src/tree.test.ts` if it uses that tag, [skill-tree.md](skill-tree.md)) |
| A tag's `name` (a rename) | add the old spelling as an alias; the folding tests in `src/store.test.ts` / `src/sync.test.ts` if they use that tag; `TOP_CONTROL_TAGS` / `RETENTION_TAGS` in `src/xp.ts` must contain the new normalized name (they are exact whitelists); `DEFAULT_TAGS` and the demo seed (`src/demo.ts`) must use the new spelling (pinned by `src/curriculum.test.ts` and `src/demo.test.ts`) |
| `DEFAULT_TAGS` in `src/store.ts` (add a tag) | Add a `TAG_DEFS` entry with that exact canonical spelling, or the "already canonical / never other" test fails |
| `norm` (the normalization) | every lookup — names, aliases, the whitelists in `src/xp.ts` and `OPEN_GUARD_TAGS` all assume trim + lowercase |
| `OPEN_GUARD_TAGS` / `isOpenGuardTag` | `openGuardMilestone` behavior and its tests in `src/stats.test.ts` ([stats.md](stats.md)); the whitelist/sub-group lockstep test in `src/curriculum.test.ts`; entries must stay pre-normalized |
| `canonicalTag` / `canonicalTags` semantics | the three boundaries (`load`, the pull sanitizers, the save paths) and their tests; [data-model.md](data-model.md) and [sync.md](sync.md) describe the fold |

## Where ordering is applied (and where it is not)

- **Log chips** — `src/App.tsx` computes `logTagList` in a `useMemo`: `orderTagsByCurriculum(withSessionTags(data.tagList, data.sessions))`, passed as `tagList` to `src/screens/Log.tsx`. `withSessionTags` (`src/stats.ts`, see [stats.md](stats.md)) appends tags that exist only on sessions, display-time, without persisting them. The memo exists because Log form state lives in `App`, so every keystroke re-renders it. The chips come out branch by branch — a branch's generic tags first, then its sub-groups (Guard: Guard retention, Kimura, Sweeps …, then Closed guard, Top lock …, then De La Riva, DLR X …, then Half guard …).
- **Focus tag picker** — `src/components/FocusCard.tsx` calls `orderTagsByCurriculum(tagList)` on its prop internally. Both call sites (`src/screens/Home.tsx`, `src/screens/Techniques.tsx`) pass raw `data.tagList` — **not** `withSessionTags` — so session-only tags do not appear in the focus picker. That asymmetry is current fact, not accident-proofed; keep it in mind if unifying. (One more focus-setting path exists since 2026-10-23: the skill tree's "Set as focus" on Techniques, whose leaves come from `withSessionTags` — a session-only tag set there becomes `focus.tag` but shows no selected chip in the FocusCard picker; see [skill-tree.md](skill-tree.md).)
- **Techniques grouped cloud** — `src/screens/Techniques.tsx` uses `groupTagsByCurriculum(withSessionTags(data.tagList, data.sessions))` inside its `useMemo`, rendering one `cloud-group` block per branch with the branch label as the header, its direct tags as the first cloud, then one `cloud-sub` (small `cloud-sub-label` + cloud) per non-empty sub-group (styles in `src/app.css`, see [design-system.md](design-system.md)).

**Not applied to persisted data.** `data.tagList` order is untouched everywhere: `addTag` in `src/App.tsx` appends (the canonical spelling); sync ([sync.md](sync.md)) pushes the array verbatim and never reorders it on pull (the pull sanitizer folds spellings and collapses duplicates but keeps the order). Curriculum ordering is a lens over master data, never a write.

## Beyond ordering: the XP characteristic matchers and the skill tree

The skill tree ([skill-tree.md](skill-tree.md)) is the biggest consumer: `TAG_DEFS` **is** its mapping. `src/tree.ts — skillTree` makes one branch per `CURRICULUM_GROUPS` entry and one sub-group node per `CURRICULUM_SUBGROUPS` entry, and files every tag's leaf by `placeOfTag(tag)` — so an unmapped tag shows under Other until it gets an entry here, and mapping it moves the leaf (and its node credit) on the next render — no tree data lives anywhere else.

`src/xp.ts — CHARACTERISTICS` matches session/comp tags through `groupOfTag` for four of the six lifelong attributes: `passing` (the `passing` branch), `takedowns-gi` / `wrestling-nogi` (the `standing` branch, split by the entry's `gi` flag), and `leglocks` (the `legs` branch). The 2026-10-28 top level kept those three branch ids and their membership exactly, so **no characteristic level moved** in the rename. The other two matchers — guard retention and top control — keep their own exact-tag whitelists inside `src/xp.ts` (same no-heuristics policy: pre-normalized exact membership, extend the set, never fuzz the match; they contain the normalized form of every canonical name they mean, and the old aliases besides). The coupling is live in both directions of intent: adding a tag here so it orders correctly **also** enrolls it in the matching characteristic — usually what's wanted, but check `src/xp.test.ts` when the branch is `passing`/`standing`/`legs` ([stats.md](stats.md)).
