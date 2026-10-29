# Skill tree

The Techniques screen's **Skill tree** section (2026-10-23; on Progress until 2026-10-27) is a map of the whole game with per-node progress — the idea borrowed from RPGreal's skill trees, rebuilt on Rollbook's own rule that **everything on the character sheet except belt rank is derived from the log**. There is no tree data in code and nothing stored or synced: the tree is a pure function of the tag vocabulary and logged history (`src/tree.ts — skillTree`), so the result of the last class is always the current tree. Since 2026-10-28 it has **two levels above the tags**: the owner's six branches and, where his tags cluster, sub-groups ([curriculum.md](curriculum.md) holds the hierarchy and every placement ruling).

Sibling docs: [stats.md](stats.md) (the XP scale it reuses), [curriculum.md](curriculum.md) (the hierarchy and vocabulary that shape it), [design-system.md](design-system.md) (the outline's CSS contract), [testing.md](testing.md).

## History and the owner's rulings

The feature began (2026-10-23) as a port of Dmitrii's own 90-node RPGreal tree (captured from his marketplace listing; the capture and the original proposal sit untracked in the main checkout as `docs/skill-tree-rpgreal.json` / `docs/skill-tree-proposal.md`). A static tree was built and he answered the proposal's open questions (add Top control and Escapes branches, generic submission tags credit every same-label node, drop the duplicate Half-butterfly, normalize spelling, place new nodes for his unmapped tags, levels on the 50/25 curve, mastery stamps later). He then changed the design mid-session:

> I don't want a ready-to-use tree from my RPGreal marketplace — I want to create a new one from scratch. I just need the mapping between my tags in session logging and the skill tree … create a tree automatically based on the tags, and the result of the last classes I've had should be the current version of the tree.

The static tree was removed and replaced by the derived one below. His rulings on the derived design, all pinned by `src/tree.test.ts`:

- **Structure (2026-10-23): position groups → tags; (2026-10-28): his own game map → sub-groups → tags.** The tree first used the seven Gracie Barra position groups as branches. On 2026-10-28 ("changing the tags hierarchy and names") he replaced them with **his own top level** — Standing & takedowns, Guard, Guard passing, Top control, Escapes, Leg locks, plus the trailing Other — and added a **second level** where his tags cluster (Standing › Wrestling / Judo; Guard › Closed / Open / Half guard; Guard passing › Pressure / Dynamic / Opening closed guard; Top control › Side control / Mount & knee on belly / Back & turtle). Generic submissions and sweeps hang directly from Guard; Escapes and Leg locks are flat. Still zero tree data of its own: branches and sub-groups are `CURRICULUM_GROUPS` / `CURRICULUM_SUBGROUPS`, and every tag is a leaf under its `placeOfTag` place — a tag joins the right node the moment it has a `TAG_DEFS` entry; until then it shows under Other.
- **Nodes: every tag in the list, dim until trained.** The whole logging vocabulary is the map (`withSessionTags(tagList, sessions)` — the master list plus session-borne tags), so untrained tags are visible as dim rows, never "locked"; there is no unlock order in BJJ worth enforcing.
- **Order: most trained first** inside a branch or sub-group (touching sessions + competitions, ties by name); sub-groups themselves stay in curriculum order.
- **Placement: Techniques**, between Most worked and All tags — beside the Focus card its "Set as focus" feeds. It first shipped on Progress under Levels (his 2026-10-23 call); after living with it he moved it to Techniques on 2026-10-27. Techniques keeps its All tags cloud: the cloud is the 30-day glance with counts, the tree the all-time map with levels.
- **Progress: levels on the 50/25 curve** with the flat 25-per-session / 60-per-competition grants — one grammar with the six characteristic cards.
- **Swap rounds light both roles (2026-10-28).** The side, mount, back and turtle formats light Top control **and** Escapes in the tree (the pin and the escape), the way the guard formats light Guard and Guard passing. The characteristics stay Top-control-only, by design.
- **Stored mastery stamps (RPGreal's "XP for mastering"): later.** Nothing stored; if ever wanted it is the `Promotion` pattern (a new 404-tolerated table, sanitized pull, never deleted) plus the sync playbook ([sync.md](sync.md)).

Earlier rulings on the static tree that no longer apply to code (every tag maps itself now) are kept only in that proposal file.

## The derivation — `src/tree.ts`

`skillTree(tagList, sessions, competitions) → TreeBranch[]`. Pure and clock-free (no `todayIso` needed — nothing in it is date-relative; the "last trained" readout is formatted in the component from the caller's `todayIso`). Like `src/xp.ts` it deliberately reads `Competition[]`: it is a motivation layer, not a training stat, so the type-level rule that aggregates take `Session[]` only ([stats.md](stats.md)) does not apply, and it must never feed a stat. Imports point one way — `curriculum` (groups, sub-groups, `placeOfTag`, `groupOfPlace`), `stats` (`withSessionTags`), `xp` (`characteristicLevel`, `SESSION_CHAR_XP`, `COMP_CHAR_XP`) → `tree`; nothing imports back.

**Leaves.** One `TagNode` per tag in `withSessionTags(tagList, sessions)`, deduplicated by normalized spelling (trim + lowercase; the first spelling wins — in practice the master list's, since `addTag` already dedupes case-insensitively). The leaf's `tag` is that spelling, which is what session tags carry and what the focus goal links. Each leaf is filed by `placeOfTag(tag)`: directly under a branch, or in one of its sub-groups. The tree does **not** fold aliases — that happens at the boundaries (`load()`, the pull sanitizers, the save paths; [curriculum.md](curriculum.md)), so by the time data reaches the tree every spelling is canonical; a hand-edited local row carrying an old alias would be its own dim leaf (pinned).

**Touching.** A leaf is touched by an entry (session or competition) whose tags include it — exact normalized membership, so "Passing" credits only the Passing leaf, never every passing technique. A **sub-group** is touched by an entry that touches any of its leaves, or, for sessions, logs a typed specific format mapped to it; a **branch** by an entry that touches any of its leaves or sub-groups, or logs a format mapped to it or to one of its sub-groups (`SPEC_GROUPS` names places — crediting a sub-group always credits its branch):

| Format | Lights | Why |
|---|---|---|
| `specClosed` | Guard › Closed guard (and Guard) **and** Guard passing | each 2+2 swap round trains the guard player and the passer — the same crediting as the `passing`/`retention` characteristics |
| `specOpen` | Guard › Open guard (and Guard) **and** Guard passing | same |
| `specSide` | Top control › Side control (and Top control) **and** Escapes | the pin from top and the escape from bottom (owner ruling, 2026-10-28) |
| `specMount` | Top control › Mount & knee on belly (and Top control) **and** Escapes | same, both roles |
| `specBack`, `specTurtle` | Top control › Back & turtle (and Top control) **and** Escapes | same |

Typed rounds light **positions only** — a swap round is positional, not a technique, so no leaf is touched. A sub-group or branch can therefore carry XP with zero tags (e.g. Closed guard rounds logged with no closed-guard tag in the list, or Guard passing lit by a guard round); such a node still renders, with "0 / 0" and its level, and the open row says so: "Lit by typed rounds only — no tag here yet."

**Grants are flat per entry**, exactly as for the characteristics: 25 XP per touching session, 60 per touching competition, once per node however many of the entry's tags or formats hit it (three guard tags plus a closed-guard round credit Guard 25 once; each of the three leaves also gets 25, and the Closed guard sub-group 25). A node's XP is therefore not the sum of its children's — it is "entries in this part of the game".

**Per node** (`NodeProgress`): `xp`, `sessions`, `comps`, `lastIso` (the latest touching date — local `yyyy-mm-dd` strings compared as strings — or `null`), and the 50/25 `level`/`into`/`need` from `characteristicLevel`. Untouched nodes are `{ xp: 0, sessions: 0, comps: 0, lastIso: null, level: 1, into: 0, need: 50 }`. `sessionsToNext` from `src/xp.ts` powers the "N sessions to LV n+1" hint.

**Branches** (`TreeBranch`) come out in `CURRICULUM_GROUPS` order, only those with at least one leaf anywhere or any XP (Other only ever appears with tags — it has no format and no sub-groups). Each carries its **direct** `tags` (most trained first), its `subgroups` (`TreeSubgroup`: `subgroup`, `label`, progress, `explored`/`total`, `tags`) — only those with a leaf or any XP, in `CURRICULUM_SUBGROUPS` order — and `explored` (leaves with XP) over `total` (all leaves) counted **across the whole branch**, direct and nested.

**Deliberate limits.** A competition tag outside the vocabulary credits nothing — leaves come from `withSessionTags`, which re-adds session-borne tags but not competition-borne ones, so a comp tag that no session carries drops out of the tree (with its 60 XP) only if `tagList` is later replaced (the LWW case [operations.md](operations.md) describes); the comp form itself only offers list tags. Session tags that are not strings (a hand-edited local blob — `load()` folds string tags but a non-array `tags` heals to `[]`) are skipped rather than thrown on, and the component applies the same guard to `focus.tag`. The tree never influences streaks, hours, rounds, character XP or the characteristics — adding node XP to the character would double-count the same sessions.

## The outline — `src/components/SkillTree.tsx`

Props `{ tree: TreeBranch[]; todayIso; focusTag; onFocusTag(tag) }`. RPGreal draws a radial canvas; at 375 px that is unusable, so the tree is a collapsible **outline** (what RPGreal's own navigation panel is):

- **Branch card** (`card tree-branch`, `--idle` at 0 XP): a full-width `tree-head` button (`aria-expanded`) — caret (Phosphor CaretRight ⇄ CaretDown, neutral-500), the branch label (13px 500), `tree-cov` "explored / total" (11px neutral-500; the whole branch, nested leaves included), the shared `.level-chip` (11px 500, 0.08em tracking, accent-300; neutral-600 when the branch is idle) — over the shared `.level-track`/`.level-fill` 3px bar. The head bleeds over the card's padding and extends over the track (`::after`), so the whole ≈39px strip toggles, not just the text line; its keyboard focus ring is drawn inside the card (`outline-offset: -3px`, rounded) since the bled box coincides with the card edge. Branches start collapsed; the open set is screen-local state (one `useState<Set<string>>` keyed by branch id and by `"group/subgroup"` for sub-groups), so it resets with the tab like every accordion in the app.
- **Tag rows** (`tree-row`, under a neutral-800 top border): one button per leaf, most trained first — label (13px neutral-300, ellipsis; neutral-600 when `--idle`, accent-300 when `--focus`, the text color when `--sel`), a 12px accent Target glyph (`role="img"`, "Current focus") on the focus leaf, the `.level-chip`, and a 40×3px accent-filled `tree-row-track`. Tapping a row selects it (single-select, `aria-expanded`). The branch's **direct** leaves come first, then its sub-groups.
- **Sub-group rows** (`tree-row tree-row--sub`, `--idle` at 0 XP): the same row grammar with a 12px caret in front, a 500-weight label, the "explored / total" `tree-cov`, the LV chip and the 40px track; tapping toggles it. Open, its leaves render in `tree-sub-rows` — nested under a 1px neutral-800 guide line (6px in, 12px padding) — most trained first, or the "Lit by typed rounds only" line when it has none. Sub-groups start collapsed too, so opening Guard shows its generic rows and three sub-group heads, not thirty rows.
- **Detail** (`tree-detail`, an accent-800 bordered box under the selected row — the in-place panel idiom, not a modal): "7 sessions · 1 comp · last 5 d ago" (11px neutral-500; "Not trained yet — tag a session with it to light it up." when idle), the "25 / 125 XP · 4 sessions to LV 5" line (10px), and a bare `chip chip--tech` **Set as focus** button — or the accent-300 text "Current focus" when the leaf is the focus tag. "last …" is `agoLabel`: today / yesterday / "N d ago" under 14 days / "N wk ago" (rounded, so 67–69 days read "10 wk ago") under 70 days / else `fmtShort` with the year when it differs — computed from `daysBetween(lastIso, todayIso)` in `src/dates.ts`, never from the clock. The same detail renders for a nested leaf.
- **Set as focus** calls `onFocusTag(tag)`; Techniques turns that into `onChangeFocus({ title: tag, tag })` → `App.setFocus` (stamps `stateUpdatedAt`, pushes the app_state blob — this is a real write, see the dev-server rule in [operations.md](operations.md)). The goal title is set to the tag name; the Focus card's pencil edits it afterwards. A leaf *is* a tag, so nothing is ever minted into `tagList` here — which also means a session-borne leaf (present only on sessions, not in the master list) can become the focus tag; `focusProgress`/`focusStreak` work on it, but the FocusCard picker (raw `tagList`) shows no selected chip for it.
- Empty tree (no tags, no history): the `.empty` line "Add technique tags in the Log form to grow the tree."

Design-law check: Inter 400/500 only; the accent appears as the 3px track fills, the detail box border (accent-800), the LV chips and the focus mark — never a fill; the sub-group guide is a neutral line. The CSS lives in one `/* ── Techniques: skill tree ── */` block beside the other Techniques sections ([design-system.md](design-system.md)).

## Where it meshes

| System | Relationship |
|---|---|
| Characteristics (`src/xp.ts`) | Same scale (`SESSION_CHAR_XP`/`COMP_CHAR_XP`, `characteristicLevel` — exported from xp.ts for exactly this reuse). Branches ≈ attributes, but they are different cuts: the tree is breadth over the owner's game map, the six attributes are his lifelong depth axes. Neither feeds the other — the tree lights Escapes for a pin round, the characteristics do not. |
| Curriculum (`src/curriculum.ts`) | `TAG_DEFS` **is** the tree's mapping — moving a tag between places moves its leaf and its node credit; renaming one changes the leaf's label everywhere (the boundaries fold stored spellings); see the coupling rows in [curriculum.md](curriculum.md). |
| Typed specific rounds (`src/specific.ts`) | `SPEC_GROUPS` names every format explicitly; a new format needs a deliberate place decision here (and in `xp.ts`). |
| Focus of the week | "Set as focus" writes the existing `FocusGoal`; `focusProgress`/`focusStreak` work unchanged. |
| Character XP, milestones, belt | No coupling. |
| Techniques screen | Hosts the section (Focus card → Most worked → Skill tree → All tags). The `useMemo` that builds counts and curriculum sections also builds the tree, so its deps include `data.competitions`. |
| Progress screen | No coupling since 2026-10-27 (it hosted the section for four days; its memo no longer reads `data.tagList`). |

## Coupling table

| If you change… | You must also change… |
|---|---|
| `SPEC_GROUPS` or a `SpecKey` (`src/specific.ts`) | the pinned mapping and the typed-round cases in `src/tree.test.ts`; the `matchesSpecific` predicates in `src/xp.ts` are the sibling decision ([stats.md](stats.md)) — the two deliberately differ on the escaping side (tree: lit; characteristics: nothing) |
| `TAG_DEFS` / `CURRICULUM_GROUPS` / `CURRICULUM_SUBGROUPS` (`src/curriculum.ts`) | branch and sub-group membership, order and labels follow automatically; `src/tree.test.ts` uses real tags (Half guard, Knee cut, Leg drag, Leg locks, DLR X, Sweeps, Kimura, De La Riva, Closed guard, Side control, Escapes, Toe hold, Single leg X) and real sub-group ids — a placement change for one of those moves a test |
| The 25/60 grants or the 50/25 curve (`src/xp.ts`) | every node's level recomputes silently; the pinned numbers in `src/tree.test.ts` and `src/xp.test.ts` |
| `withSessionTags` semantics (`src/stats.ts`) | which tags are leaves |
| `TreeBranch` / `TreeSubgroup` shape | the outline component (`src/components/SkillTree.tsx`, verified in the browser — no component tests) |
| `daysBetween` / `fmtShort` (`src/dates.ts`) | the `agoLabel` readout (component-only, verified manually) |
