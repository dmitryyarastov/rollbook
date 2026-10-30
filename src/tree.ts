/**
 * The skill tree — derived entirely from the logging vocabulary and the log.
 * Branches are the owner's game map (src/curriculum.ts: Standing & takedowns,
 * Guard, Guard passing, Top control, Escapes, Leg locks), sub-groups the
 * clusters under them (Closed / Open / Half guard, …), leaves the tags
 * themselves (every tag in tagList plus any a session carries), and progress
 * reuses the characteristic scale verbatim: 25 XP per touching session, 60
 * per competition, flat per entry, levels on the 50/25 curve. Nothing is
 * stored or synced and no tree data lives in code beyond the typed-round
 * mapping below — the tree re-derives from history on every render, so the
 * result of the last class is always the current tree (the owner's design,
 * 2026-10-23, chosen over importing his RPGreal tree; the two-level hierarchy
 * is his 2026-10-28 ruling, see docs/skill-tree.md). Pure and clock-free like
 * src/xp.ts, and like it deliberately competition-aware. Imports point one
 * way (curriculum, stats, xp → tree); nothing imports back.
 */
import { CURRICULUM_GROUPS, CURRICULUM_SUBGROUPS, groupOfPlace, placeOfTag } from './curriculum'
import type { CurriculumGroupId, CurriculumPlace, CurriculumSubgroupId } from './curriculum'
import type { SpecKey } from './specific'
import { withSessionTags } from './stats'
import type { Competition, Session } from './types'
import { characteristicLevel, COMP_CHAR_XP, SESSION_CHAR_XP } from './xp'
import type { LevelState } from './xp'

export interface NodeProgress extends LevelState {
  xp: number
  /** Touching training sessions. */
  sessions: number
  /** Touching competitions. */
  comps: number
  /** Latest date (session or competition) that touched the node; null when untouched. */
  lastIso: string | null
}

/** A leaf: one tag, in the tag list's own spelling (what session tags carry). */
export interface TagNode extends NodeProgress {
  tag: string
}

/** A sub-group: one cluster under a branch, holding its tags most trained first. */
export interface TreeSubgroup extends NodeProgress {
  subgroup: CurriculumSubgroupId
  label: string
  /** Tags in the sub-group with any XP. */
  explored: number
  /** All tags in the sub-group. */
  total: number
  tags: TagNode[]
}

/** A branch: one game-map group holding its direct tags (most trained first) and its sub-groups (curriculum order). */
export interface TreeBranch extends NodeProgress {
  group: CurriculumGroupId
  label: string
  /** Tags anywhere in the branch (direct or in a sub-group) with any XP. */
  explored: number
  /** All tags anywhere in the branch. */
  total: number
  /** Tags hanging directly from the branch. */
  tags: TagNode[]
  /** Sub-groups with a tag or any XP, in curriculum order. */
  subgroups: TreeSubgroup[]
}

/**
 * Typed specific rounds light positions (never leaves — a swap round is
 * positional, not a technique). Each 2+2 round trains both roles: the guard
 * formats train the guard player and the passer, so they credit the matching
 * guard sub-group (and Guard through it) plus Guard passing — the same
 * crediting as the characteristics; a pin, back or turtle format trains the
 * control from top and the escape from bottom, so it credits its Top control
 * sub-group (and Top control) plus Escapes & defense (owner ruling,
 * 2026-10-28; the characteristics credit Top control only, by design — the
 * escaping side has no attribute). The turtle format's bottom role is turtle
 * defense, so it reaches that branch through its Turtle defense sub-group
 * (since that sub-group was created, 2026-10-30). Crediting a sub-group
 * always credits its branch too.
 */
export const SPEC_GROUPS: Record<SpecKey, readonly CurriculumPlace[]> = {
  specClosed: ['closed-guard', 'passing'],
  specOpen: ['open-guard', 'passing'],
  specSide: ['side-control', 'escapes'],
  specMount: ['mount-kob', 'escapes'],
  specBack: ['back-turtle', 'escapes'],
  specTurtle: ['back-turtle', 'turtle-defense'],
}

const norm = (tag: string) => tag.trim().toLowerCase()

interface Acc {
  xp: number
  sessions: number
  comps: number
  lastIso: string | null
}

function credit(acc: Map<string, Acc>, key: string, grant: number, isComp: boolean, date: string): void {
  const a = acc.get(key) ?? { xp: 0, sessions: 0, comps: 0, lastIso: null }
  a.xp += grant
  if (isComp) a.comps++
  else a.sessions++
  // Local yyyy-mm-dd strings compare lexically.
  if (a.lastIso === null || date > a.lastIso) a.lastIso = date
  acc.set(key, a)
}

const progressOf = (a: Acc | undefined): NodeProgress =>
  a ? { ...a, ...characteristicLevel(a.xp) } : { xp: 0, sessions: 0, comps: 0, lastIso: null, ...characteristicLevel(0) }

const byTrained = (a: TagNode, b: TagNode) => b.sessions + b.comps - (a.sessions + a.comps) || a.tag.localeCompare(b.tag)

/**
 * Build the tree. Leaves are one node per tag (`withSessionTags` — the master
 * list plus session-borne tags; one node per normalized spelling, the first
 * spelling wins), placed by `placeOfTag` under a branch or one of its
 * sub-groups; unmapped tags land in the trailing Other branch. A leaf is
 * touched by an entry whose tags include it (exact, normalized); a sub-group
 * by an entry that touches any of its leaves or logs a typed format mapped
 * to it; a branch by an entry that touches any of its leaves or sub-groups
 * or logs a format mapped to it — flat per entry, so three guard tags and a
 * closed-guard round in one session credit Guard 25 once. Branches come out
 * in curriculum order, only those with a tag or any XP; sub-groups likewise,
 * in curriculum order inside their branch; within a branch or sub-group the
 * most-trained tags (sessions + comps) come first, ties by name.
 */
export function skillTree(tagList: string[], sessions: Session[], competitions: Competition[]): TreeBranch[] {
  const leaves = new Map<string, { tag: string; place: CurriculumPlace | 'other' }>()
  // Local rows reach here unsanitized (store.ts spreads session tags through),
  // so a hand-edited blob with a non-string tag must not blank the screen.
  for (const t of withSessionTags(tagList, sessions)) {
    if (typeof t !== 'string') continue
    const k = norm(t)
    if (!leaves.has(k)) leaves.set(k, { tag: t, place: placeOfTag(t) })
  }
  const tagAcc = new Map<string, Acc>()
  const nodeAcc = new Map<string, Acc>() // branch and sub-group ids share one namespace (they are disjoint)

  const touch = (tags: string[], s: Session | null, grant: number, isComp: boolean, date: string) => {
    const touchedTags = new Set<string>()
    for (const t of tags) if (typeof t === 'string' && leaves.has(norm(t))) touchedTags.add(norm(t))
    const touchedNodes = new Set<string>()
    const touchPlace = (place: CurriculumPlace | 'other') => {
      touchedNodes.add(place)
      touchedNodes.add(groupOfPlace(place))
    }
    for (const k of touchedTags) touchPlace(leaves.get(k)!.place)
    if (s) for (const key of Object.keys(SPEC_GROUPS) as SpecKey[]) if (s[key] > 0) for (const p of SPEC_GROUPS[key]) touchPlace(p)
    for (const k of touchedTags) credit(tagAcc, k, grant, isComp, date)
    for (const n of touchedNodes) credit(nodeAcc, n, grant, isComp, date)
  }
  for (const s of sessions) touch(s.tags, s, SESSION_CHAR_XP, false, s.date)
  for (const c of competitions) touch(c.tags, null, COMP_CHAR_XP, true, c.date)

  const leavesAt = (place: CurriculumPlace | 'other'): TagNode[] => {
    const tags: TagNode[] = []
    for (const [k, leaf] of leaves) if (leaf.place === place) tags.push({ tag: leaf.tag, ...progressOf(tagAcc.get(k)) })
    return tags.sort(byTrained)
  }
  const explored = (tags: TagNode[]) => tags.filter((t) => t.xp > 0).length

  const branches: TreeBranch[] = []
  for (const g of CURRICULUM_GROUPS) {
    const direct = leavesAt(g.id)
    const subgroups: TreeSubgroup[] = []
    for (const s of CURRICULUM_SUBGROUPS) {
      if (s.group !== g.id) continue
      const tags = leavesAt(s.id)
      const progress = progressOf(nodeAcc.get(s.id))
      if (tags.length === 0 && progress.xp === 0) continue
      subgroups.push({ subgroup: s.id, label: s.label, ...progress, explored: explored(tags), total: tags.length, tags })
    }
    const progress = progressOf(nodeAcc.get(g.id))
    if (direct.length === 0 && subgroups.length === 0 && progress.xp === 0) continue
    branches.push({
      group: g.id,
      label: g.label,
      ...progress,
      explored: explored(direct) + subgroups.reduce((n, s) => n + s.explored, 0),
      total: direct.length + subgroups.reduce((n, s) => n + s.total, 0),
      tags: direct,
      subgroups,
    })
  }
  return branches
}
