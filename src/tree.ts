/**
 * The skill tree — derived entirely from the logging vocabulary and the log.
 * Branches are the Gracie Barra position groups (src/curriculum.ts), leaves
 * are the tags themselves (every tag in tagList plus any a session carries),
 * and progress reuses the characteristic scale verbatim: 25 XP per touching
 * session, 60 per competition, flat per entry, levels on the 50/25 curve.
 * Nothing is stored or synced and no tree data lives in code beyond the
 * typed-round mapping below — the tree re-derives from history on every
 * render, so the result of the last class is always the current tree (the
 * owner's design, 2026-10-23, chosen over importing his RPGreal tree; see
 * docs/skill-tree.md). Pure and clock-free like src/xp.ts, and like it
 * deliberately competition-aware. Imports point one way (curriculum, stats,
 * xp → tree); nothing imports back.
 */
import { CURRICULUM_GROUPS, groupOfTag } from './curriculum'
import type { CurriculumGroupId } from './curriculum'
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

/** A branch: one curriculum position group holding its tags, most trained first. */
export interface TreeBranch extends NodeProgress {
  group: CurriculumGroupId
  label: string
  /** Tags in the branch with any XP. */
  explored: number
  /** All tags in the branch. */
  total: number
  tags: TagNode[]
}

/**
 * Typed specific rounds light position branches (never leaves — a swap round
 * is positional, not a technique). Each 2+2 round trains both roles: the
 * guard formats train the guard player and the passer, so they credit Guard
 * and Guard passing — the same crediting as the characteristics; a pin,
 * back or turtle format trains the control from top and the escape from
 * bottom, and the GB groups already hold both sides (generic "Escapes" files
 * under Side control, "Turtle defense" under Back & turtle).
 */
export const SPEC_GROUPS: Record<SpecKey, readonly CurriculumGroupId[]> = {
  specClosed: ['guard', 'passing'],
  specOpen: ['guard', 'passing'],
  specSide: ['side'],
  specMount: ['mount'],
  specBack: ['back'],
  specTurtle: ['back'],
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

/**
 * Build the tree. Leaves are one node per tag (`withSessionTags` — the master
 * list plus session-borne tags; one node per normalized spelling, the first
 * spelling wins), placed by `groupOfTag`; unmapped tags land in the trailing
 * Other branch. A leaf is touched by an entry whose tags include it (exact,
 * normalized); a branch is touched by an entry that touches any of its leaves
 * or logs a typed format mapped to it — flat per entry, so three guard tags
 * and a closed-guard round in one session credit Guard 25 once. Branches come
 * out in curriculum order, only those with a tag or any XP; within a branch
 * the most-trained tags (sessions + comps) come first, ties by name.
 */
export function skillTree(tagList: string[], sessions: Session[], competitions: Competition[]): TreeBranch[] {
  const leaves = new Map<string, { tag: string; group: CurriculumGroupId }>()
  // Local rows reach here unsanitized (store.ts spreads session tags through),
  // so a hand-edited blob with a non-string tag must not blank the screen.
  for (const t of withSessionTags(tagList, sessions)) {
    if (typeof t !== 'string') continue
    const k = norm(t)
    if (!leaves.has(k)) leaves.set(k, { tag: t, group: groupOfTag(t) })
  }
  const tagAcc = new Map<string, Acc>()
  const groupAcc = new Map<string, Acc>()

  const touch = (tags: string[], s: Session | null, grant: number, isComp: boolean, date: string) => {
    const touchedTags = new Set<string>()
    for (const t of tags) if (typeof t === 'string' && leaves.has(norm(t))) touchedTags.add(norm(t))
    const touchedGroups = new Set<CurriculumGroupId>()
    for (const k of touchedTags) touchedGroups.add(leaves.get(k)!.group)
    if (s) for (const key of Object.keys(SPEC_GROUPS) as SpecKey[]) if (s[key] > 0) for (const g of SPEC_GROUPS[key]) touchedGroups.add(g)
    for (const k of touchedTags) credit(tagAcc, k, grant, isComp, date)
    for (const g of touchedGroups) credit(groupAcc, g, grant, isComp, date)
  }
  for (const s of sessions) touch(s.tags, s, SESSION_CHAR_XP, false, s.date)
  for (const c of competitions) touch(c.tags, null, COMP_CHAR_XP, true, c.date)

  const branches: TreeBranch[] = []
  for (const g of CURRICULUM_GROUPS) {
    const tags: TagNode[] = []
    for (const [k, leaf] of leaves) if (leaf.group === g.id) tags.push({ tag: leaf.tag, ...progressOf(tagAcc.get(k)) })
    const progress = progressOf(groupAcc.get(g.id))
    if (tags.length === 0 && progress.xp === 0) continue
    tags.sort((a, b) => b.sessions + b.comps - (a.sessions + a.comps) || a.tag.localeCompare(b.tag))
    branches.push({
      group: g.id,
      label: g.label,
      ...progress,
      explored: tags.filter((t) => t.xp > 0).length,
      total: tags.length,
      tags,
    })
  }
  return branches
}
