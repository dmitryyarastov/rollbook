# Skill tree

The Progress screen's **Skill tree** section (2026-10-23) is a map of the whole game with per-node progress — the idea borrowed from RPGreal's skill trees, rebuilt on Rollbook's own rule that **everything on the character sheet except belt rank is derived from the log**. There is no tree data in code and nothing stored or synced: the tree is a pure function of the tag vocabulary and logged history (`src/tree.ts — skillTree`), so the result of the last class is always the current tree.

Sibling docs: [stats.md](stats.md) (the XP scale it reuses), [curriculum.md](curriculum.md) (the grouping that shapes it), [design-system.md](design-system.md) (the outline's CSS contract), [testing.md](testing.md).

## History and the owner's rulings (2026-10-23)

The feature began as a port of Dmitrii's own 90-node RPGreal tree (captured from his marketplace listing; the capture and the original proposal sit untracked in the main checkout as `docs/skill-tree-rpgreal.json` / `docs/skill-tree-proposal.md`). A static tree was built and he answered the proposal's open questions (add Top control and Escapes branches, generic submission tags credit every same-label node, drop the duplicate Half-butterfly, normalize spelling, place new nodes for his unmapped tags, levels on the 50/25 curve, mastery stamps later). He then changed the design mid-session:

> I don't want a ready-to-use tree from my RPGreal marketplace — I want to create a new one from scratch. I just need the mapping between my tags in session logging and the skill tree … create a tree automatically based on the tags, and the result of the last classes I've had should be the current version of the tree.

The static tree was removed and replaced by the derived one below. His rulings on the derived design, all pinned by `src/tree.test.ts`:

- **Structure: position groups → tags.** Branches are the seven Gracie Barra position groups `src/curriculum.ts` already defines (Standing & takedowns, Guard, Guard passing, Side control, Mount & knee on belly, Back & turtle, Leg locks), plus the trailing Other for unmapped tags; every tag is a leaf under its `groupOfTag` group. Zero new mapping to maintain — a tag joins the right branch the moment it has a `TAG_GROUP` entry ([curriculum.md](curriculum.md)); until then it shows under Other.
- **Nodes: every tag in the list, dim until trained.** The whole logging vocabulary is the map (`withSessionTags(tagList, sessions)` — the master list plus session-borne tags), so untrained tags are visible as dim rows, never "locked"; there is no unlock order in BJJ worth enforcing.
- **Order: most trained first** inside a branch (touching sessions + competitions, ties by name).
- **Placement: a section on Progress** under Levels (not on Techniques, which keeps its All tags cloud).
- **Progress: levels on the 50/25 curve** with the flat 25-per-session / 60-per-competition grants — one grammar with the six characteristic cards.
- **Stored mastery stamps (RPGreal's "XP for mastering"): later.** Nothing stored; if ever wanted it is the `Promotion` pattern (a new 404-tolerated table, sanitized pull, never deleted) plus the sync playbook ([sync.md](sync.md)).

Earlier rulings on the static tree that no longer apply to code (every tag maps itself now) are kept only in that proposal file.

## The derivation — `src/tree.ts`

`skillTree(tagList, sessions, competitions) → TreeBranch[]`. Pure and clock-free (no `todayIso` needed — nothing in it is date-relative; the "last trained" readout is formatted in the component from the caller's `todayIso`). Like `src/xp.ts` it deliberately reads `Competition[]`: it is a motivation layer, not a training stat, so the type-level rule that aggregates take `Session[]` only ([stats.md](stats.md)) does not apply, and it must never feed a stat. Imports point one way — `curriculum` (groups), `stats` (`withSessionTags`), `xp` (`characteristicLevel`, `SESSION_CHAR_XP`, `COMP_CHAR_XP`) → `tree`; nothing imports back.

**Leaves.** One `TagNode` per tag in `withSessionTags(tagList, sessions)`, deduplicated by normalized spelling (trim + lowercase; the first spelling wins — in practice the master list's, since `addTag` already dedupes case-insensitively). The leaf's `tag` is that spelling, which is what session tags carry and what the focus goal links.

**Touching.** A leaf is touched by an entry (session or competition) whose tags include it — exact normalized membership, so "Passing" credits only the Passing leaf, never every passing technique. A branch is touched by an entry that touches any of its leaves **or**, for sessions, logs a typed specific format mapped to it by `SPEC_GROUPS`:

| Format | Branches | Why |
|---|---|---|
| `specClosed`, `specOpen` | Guard **and** Guard passing | each 2+2 swap round trains the guard player and the passer — the same crediting as the `passing`/`retention` characteristics |
| `specSide` | Side control | top control and the escape both live in the GB side-control theme (generic Escapes files there, [curriculum.md](curriculum.md)) |
| `specMount` | Mount & knee on belly | same, both roles |
| `specBack`, `specTurtle` | Back & turtle | same; Turtle defense already files under Back & turtle |

Typed rounds light **branches only** — a swap round is positional, not a technique, so no leaf is touched. A branch can therefore carry XP with zero tags (e.g. side-control rounds logged before any side-control tag exists); such a branch still renders, with "0 / 0" and its level, and the open card says so: "Lit by typed rounds only — no tag here yet."

**Grants are flat per entry**, exactly as for the characteristics: 25 XP per touching session, 60 per touching competition, once per node however many of the entry's tags or formats hit it (three guard tags plus a closed-guard round credit Guard 25 once; each of the three leaves also gets 25). The branch's XP is therefore not the sum of its leaves' — it is "sessions in this part of the game".

**Per node** (`NodeProgress`): `xp`, `sessions`, `comps`, `lastIso` (the latest touching date — local `yyyy-mm-dd` strings compared as strings — or `null`), and the 50/25 `level`/`into`/`need` from `characteristicLevel`. Untouched nodes are `{ xp: 0, sessions: 0, comps: 0, lastIso: null, level: 1, into: 0, need: 50 }`. `sessionsToNext` from `src/xp.ts` powers the "N sessions to LV n+1" hint.

**Branches** come out in `CURRICULUM_GROUPS` order, only those with at least one tag or any XP (Other only ever appears with tags — it has no format). Each carries `explored` (leaves with XP) over `total` (all leaves) for the "n / m" readout.

**Deliberate limits.** A competition tag outside the vocabulary credits nothing — leaves come from `withSessionTags`, which re-adds session-borne tags but not competition-borne ones, so a comp tag that no session carries drops out of the tree (with its 60 XP) only if `tagList` is later replaced (the LWW case [operations.md](operations.md) describes); the comp form itself only offers list tags. Session tags that are not strings (a hand-edited local blob — `load()` spreads session tags through unsanitized) are skipped rather than thrown on, and the component applies the same guard to `focus.tag` (also spread through by `load()`), which it only normalizes when it is a non-empty string. The tree never influences streaks, hours, rounds, character XP or the characteristics — adding node XP to the character would double-count the same sessions.

## The outline — `src/components/SkillTree.tsx`

Props `{ tree: TreeBranch[]; todayIso; focusTag; onFocusTag(tag) }`. RPGreal draws a radial canvas; at 375 px that is unusable, so the tree is a collapsible **outline** (what RPGreal's own navigation panel is):

- **Branch card** (`card tree-branch`, `--idle` at 0 XP): a full-width `tree-head` button (`aria-expanded`) — caret (Phosphor CaretRight ⇄ CaretDown, neutral-500), the group label (13px 500), `tree-cov` "explored / total" (11px neutral-500), the shared `.level-chip` (11px 500, 0.08em tracking, accent-300; neutral-600 when the branch is idle) — over the shared `.level-track`/`.level-fill` 3px bar. The head bleeds over the card's padding and extends over the track (`::after`), so the whole ≈39px strip toggles, not just the text line; its keyboard focus ring is drawn inside the card (`outline-offset: -3px`, rounded) since the bled box coincides with the card edge. The hover brighten skips the selected and the focus rows, which carry their own color. Branches start collapsed; the open set is screen-local state (`useState<Set<group>>`), so it resets with the tab like every accordion in the app.
- **Tag rows** (`tree-row`, under a neutral-800 top border): one button per leaf, most trained first — label (13px neutral-300, ellipsis; neutral-600 when `--idle`, accent-300 when `--focus`, the text color when `--sel`), a 12px accent Target glyph (`role="img"`, "Current focus") on the focus leaf, the `.level-chip`, and a 40×3px accent-filled `tree-row-track`. Tapping a row selects it (single-select, `aria-expanded`).
- **Detail** (`tree-detail`, an accent-800 bordered box under the selected row — the in-place panel idiom, not a modal): "7 sessions · 1 comp · last 5 d ago" (11px neutral-500; "Not trained yet — tag a session with it to light it up." when idle), the "25 / 125 XP · 4 sessions to LV 5" line (10px), and a bare `chip chip--tech` **Set as focus** button — or the accent-300 text "Current focus" when the leaf is the focus tag. "last …" is `agoLabel`: today / yesterday / "N d ago" under 14 days / "N wk ago" (rounded, so 67–69 days read "10 wk ago") under 70 days / else `fmtShort` with the year when it differs — computed from `daysBetween(lastIso, todayIso)` in `src/dates.ts`, never from the clock.
- **Set as focus** calls `onFocusTag(tag)`; Progress turns that into `onChangeFocus({ title: tag, tag })` → `App.setFocus` (stamps `stateUpdatedAt`, pushes the app_state blob — this is a real write, see the dev-server rule in [operations.md](operations.md)). The goal title is set to the tag name; the Focus card's pencil edits it afterwards. A leaf *is* a tag, so nothing is ever minted into `tagList` here — which also means a session-borne leaf (present only on sessions, not in the master list) can become the focus tag; `focusProgress`/`focusStreak` work on it, but the FocusCard picker (raw `tagList`) shows no selected chip for it.
- Empty tree (no tags, no history): the `.empty` line "Add technique tags in the Log form to grow the tree."

Design-law check: Inter 400/500 only; the accent appears as the 3px track fills, the detail box border (accent-800), the LV chips and the focus mark — never a fill. The CSS lives in one `/* ── Progress: skill tree ── */` block before the tab bar ([design-system.md](design-system.md)).

## Where it meshes

| System | Relationship |
|---|---|
| Characteristics (`src/xp.ts`) | Same scale (`SESSION_CHAR_XP`/`COMP_CHAR_XP`, `characteristicLevel` — exported from xp.ts for exactly this reuse). Branches ≈ attributes, but they are different cuts: the tree is breadth over the GB position map, the six attributes are the owner's lifelong depth axes. Neither feeds the other. |
| Curriculum (`src/curriculum.ts`) | `TAG_GROUP` **is** the tree's mapping — moving a tag between groups moves its leaf and its branch credit; see the coupling row in [curriculum.md](curriculum.md). |
| Typed specific rounds (`src/specific.ts`) | `SPEC_GROUPS` names every format explicitly; a new format needs a deliberate branch decision here (and in `xp.ts`). |
| Focus of the week | "Set as focus" writes the existing `FocusGoal`; `focusProgress`/`focusStreak` work unchanged. |
| Character XP, milestones, belt | No coupling. |
| Techniques screen | Unchanged — keeps the 30-day bars and the All tags cloud. |

## Coupling table

| If you change… | You must also change… |
|---|---|
| `SPEC_GROUPS` or a `SpecKey` (`src/specific.ts`) | the pinned mapping and the typed-round cases in `src/tree.test.ts`; the `matchesSpecific` predicates in `src/xp.ts` are the sibling decision ([stats.md](stats.md)) |
| `TAG_GROUP` / `CURRICULUM_GROUPS` (`src/curriculum.ts`) | branch membership and order follow automatically; `src/tree.test.ts` uses real tags (Half guard, Knee cut, Leg locks, DLR X, Sweeps, Kimura, De La Riva, Side Control, Escapes, Toe hold, Leg drag) — a mapping change for one of those moves a test |
| The 25/60 grants or the 50/25 curve (`src/xp.ts`) | every node's level recomputes silently; the pinned numbers in `src/tree.test.ts` and `src/xp.test.ts` |
| `withSessionTags` semantics (`src/stats.ts`) | which tags are leaves |
| `daysBetween` / `fmtShort` (`src/dates.ts`) | the `agoLabel` readout (component-only, verified manually) |
