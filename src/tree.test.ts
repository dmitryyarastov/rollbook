import { describe, expect, it } from 'vitest'
import { skillTree, SPEC_GROUPS } from './tree'
import type { TagNode, TreeBranch } from './tree'
import type { Competition, Session } from './types'

let seq = 0
function mk(date: string, extra: Partial<Session> = {}): Session {
  seq++
  return {
    id: `t${seq}`,
    date,
    createdAt: seq,
    updatedAt: seq,
    title: 'Test',
    gi: true,
    rolls: 4,
    specific: 0,
    specClosed: 0,
    specMount: 0,
    specOpen: 0,
    specSide: 0,
    specBack: 0,
    specTurtle: 0,
    subsFor: 0,
    subsAgainst: 0,
    roundMin: 5,
    durationMin: 60,
    intensity: 3,
    tags: [],
    time: null,
    ...extra,
  }
}

function mkComp(date: string, extra: Partial<Competition> = {}): Competition {
  seq++
  return {
    id: `c${seq}`,
    date,
    createdAt: seq,
    updatedAt: seq,
    title: 'Competition',
    gi: true,
    cardio: 3,
    placement: 'none',
    workedWell: '',
    didntWork: '',
    matches: [],
    tags: [],
    ...extra,
  }
}

const TODAY = '2026-08-02'
const branch = (tree: TreeBranch[], group: string) => tree.find((b) => b.group === group)!
const sub = (tree: TreeBranch[], group: string, subgroup: string) => branch(tree, group).subgroups.find((s) => s.subgroup === subgroup)!
/** Every leaf in a branch — its direct tags plus every sub-group's. */
const leavesOf = (b: TreeBranch): TagNode[] => [...b.tags, ...b.subgroups.flatMap((s) => s.tags)]
const leaf = (tree: TreeBranch[], group: string, tag: string) => leavesOf(branch(tree, group)).find((t) => t.tag === tag)!
const names = (tags: TagNode[]) => tags.map((t) => t.tag)

describe('skillTree structure', () => {
  it('builds one branch per group that has a tag, in curriculum order, tags as leaves under their place', () => {
    const tree = skillTree(['My weird drill', 'Leg locks', 'Knee cut', 'Half guard', 'Kimura'], [], [])
    expect(tree.map((b) => b.group)).toEqual(['guard', 'passing', 'legs', 'other'])
    expect(tree.map((b) => b.label)).toEqual(['Guard', 'Guard passing', 'Leg locks', 'Other'])
    // a generic attack hangs directly from Guard; Half guard sits in its sub-group
    expect(names(branch(tree, 'guard').tags)).toEqual(['Kimura'])
    expect(branch(tree, 'guard').subgroups.map((s) => [s.subgroup, s.label, names(s.tags)])).toEqual([
      ['half-guard', 'Half guard', ['Half guard']],
    ])
    expect(names(branch(tree, 'other').tags)).toEqual(['My weird drill'])
    expect(branch(tree, 'other').subgroups).toEqual([])
    expect(branch(tree, 'guard')).toMatchObject({ explored: 0, total: 2, xp: 0, level: 1 })
    expect(sub(tree, 'passing', 'dynamic-passing')).toMatchObject({ explored: 0, total: 1, xp: 0, level: 1 })
  })

  it('includes session-borne tags, one leaf per normalized spelling (first spelling wins)', () => {
    const tree = skillTree(['Knee cut'], [mk(TODAY, { tags: ['knee cut'] }), mk(TODAY, { tags: ['Leg drag'] })], [])
    expect(names(sub(tree, 'passing', 'dynamic-passing').tags)).toEqual(['Knee cut', 'Leg drag'])
    expect(leaf(tree, 'passing', 'Knee cut').sessions).toBe(1)
    expect(branch(tree, 'passing').total).toBe(2)
  })

  it('is empty with no tags and no history, and omits branches and sub-groups with neither tags nor XP', () => {
    expect(skillTree([], [], [])).toEqual([])
    const tree = skillTree(['Knee cut'], [], [])
    expect(tree.map((b) => b.group)).toEqual(['passing'])
    expect(branch(tree, 'passing').subgroups.map((s) => s.subgroup)).toEqual(['dynamic-passing'])
  })

  it('orders leaves most trained first (sessions + comps), ties by name; sub-groups stay in curriculum order', () => {
    const tree = skillTree(
      ['Sweeps', 'Kimura', 'De La Riva', 'Half guard', 'Closed guard'],
      [
        mk(TODAY, { tags: ['Kimura', 'Sweeps'] }),
        mk(TODAY, { tags: ['Kimura'] }),
        mk(TODAY, { tags: ['De La Riva', 'Half guard'] }),
        mk(TODAY, { tags: ['Half guard'] }),
      ],
      [],
    )
    expect(names(branch(tree, 'guard').tags)).toEqual(['Kimura', 'Sweeps'])
    expect(branch(tree, 'guard').subgroups.map((s) => s.subgroup)).toEqual(['closed-guard', 'open-guard', 'half-guard'])
    expect(branch(tree, 'guard')).toMatchObject({ explored: 4, total: 5 })
    // a competition counts as one entry in the order, same as a session
    const withComp = skillTree(
      ['Sweeps', 'Kimura'],
      [mk(TODAY, { tags: ['Kimura'] }), mk(TODAY, { tags: ['Sweeps'] })],
      [mkComp(TODAY, { tags: ['Sweeps'] })],
    )
    expect(names(branch(withComp, 'guard').tags)).toEqual(['Sweeps', 'Kimura'])
  })

  it('tolerates a non-string tag in a corrupt local blob instead of throwing', () => {
    const junk = 7 as unknown as string
    const tree = skillTree(['Knee cut', junk], [mk(TODAY, { tags: ['Knee cut', junk] })], [])
    expect(tree.map((b) => b.group)).toEqual(['passing'])
    expect(leaf(tree, 'passing', 'Knee cut').sessions).toBe(1)
  })
})

describe('skillTree progress', () => {
  it('credits the tagged leaf, its sub-group and its branch 25 per session, nothing else', () => {
    const tree = skillTree(['Knee cut', 'Leg drag', 'Half guard'], [mk(TODAY, { tags: ['Knee cut'] })], [])
    expect(leaf(tree, 'passing', 'Knee cut')).toMatchObject({ xp: 25, sessions: 1, comps: 0, lastIso: TODAY, level: 1, into: 25, need: 50 })
    expect(leaf(tree, 'passing', 'Leg drag').xp).toBe(0)
    expect(sub(tree, 'passing', 'dynamic-passing')).toMatchObject({ xp: 25, sessions: 1, explored: 1, total: 2 })
    expect(branch(tree, 'passing')).toMatchObject({ xp: 25, sessions: 1, explored: 1, total: 2 })
    expect(branch(tree, 'guard').xp).toBe(0)
    expect(sub(tree, 'guard', 'half-guard').xp).toBe(0)
  })

  it('is flat per entry at every level: three guard tags and a closed-guard round credit Guard once', () => {
    const tree = skillTree(
      ['Half guard', 'Kimura', 'Sweeps'],
      [mk(TODAY, { tags: ['Half guard', 'Kimura', 'Sweeps'], specClosed: 2, specific: 2 })],
      [],
    )
    expect(branch(tree, 'guard')).toMatchObject({ xp: 25, sessions: 1, explored: 3, total: 3 })
    for (const t of ['Half guard', 'Kimura', 'Sweeps']) expect(leaf(tree, 'guard', t).xp, t).toBe(25)
    // the round lights the Closed guard sub-group with no tag in it, and the passer's branch
    expect(sub(tree, 'guard', 'closed-guard')).toMatchObject({ xp: 25, total: 0, explored: 0, tags: [] })
    expect(sub(tree, 'guard', 'half-guard')).toMatchObject({ xp: 25, total: 1, explored: 1 })
    expect(branch(tree, 'passing')).toMatchObject({ xp: 25, total: 0, explored: 0, tags: [], subgroups: [] })
  })

  it('typed rounds light positions only, both roles of the swap', () => {
    const side = skillTree(['Side control', 'Escapes'], [mk(TODAY, { specSide: 1, specific: 1 })], [])
    expect(side.map((b) => b.group)).toEqual(['top', 'escapes'])
    expect(branch(side, 'top')).toMatchObject({ xp: 25, explored: 0, total: 1 })
    expect(sub(side, 'top', 'side-control')).toMatchObject({ xp: 25, explored: 0, total: 1 })
    expect(branch(side, 'escapes')).toMatchObject({ xp: 25, explored: 0, total: 1 })
    expect(leaf(side, 'top', 'Side control').xp).toBe(0)
    expect(leaf(side, 'escapes', 'Escapes').xp).toBe(0)
    const back = skillTree([], [mk(TODAY, { specTurtle: 1, specBack: 1, specific: 2 })], [])
    expect(back.map((b) => b.group)).toEqual(['top', 'escapes'])
    expect(branch(back, 'top').xp).toBe(25)
    expect(branch(back, 'top').subgroups.map((s) => [s.subgroup, s.xp, s.total])).toEqual([['back-turtle', 25, 0]])
    const mount = skillTree([], [mk(TODAY, { specMount: 3, specific: 3 })], [])
    expect(mount.map((b) => b.group)).toEqual(['top', 'escapes'])
    expect(branch(mount, 'top').subgroups.map((s) => s.subgroup)).toEqual(['mount-kob'])
    const open = skillTree([], [mk(TODAY, { specOpen: 1, specific: 1 })], [])
    expect(open.map((b) => b.group)).toEqual(['guard', 'passing'])
    expect(branch(open, 'guard').subgroups.map((s) => s.subgroup)).toEqual(['open-guard'])
  })

  it('pins the typed-round mapping', () => {
    expect(SPEC_GROUPS).toEqual({
      specClosed: ['closed-guard', 'passing'],
      specOpen: ['open-guard', 'passing'],
      specSide: ['side-control', 'escapes'],
      specMount: ['mount-kob', 'escapes'],
      specBack: ['back-turtle', 'escapes'],
      specTurtle: ['back-turtle', 'escapes'],
    })
  })

  it('competitions grant 60 and derive a level on the 50/25 curve', () => {
    const tree = skillTree(['DLR X'], [], [mkComp(TODAY, { tags: ['DLR X'] })])
    const dlr = leaf(tree, 'guard', 'DLR X')
    expect(dlr).toMatchObject({ xp: 60, sessions: 0, comps: 1, lastIso: TODAY, level: 2, into: 10, need: 75 })
    expect(sub(tree, 'guard', 'open-guard')).toMatchObject({ xp: 60, comps: 1 })
    expect(branch(tree, 'guard')).toMatchObject({ xp: 60, comps: 1 })
  })

  it('leaves untrained tags at LV 1 with no last date', () => {
    const tree = skillTree(['Toe hold'], [mk(TODAY, { tags: ['Knee cut'] })], [])
    expect(leaf(tree, 'legs', 'Toe hold')).toEqual({ tag: 'Toe hold', xp: 0, sessions: 0, comps: 0, lastIso: null, level: 1, into: 0, need: 50 })
  })

  it('tracks the latest touching date across sessions and competitions', () => {
    const tree = skillTree(
      ['Knee cut'],
      [mk('2026-07-01', { tags: ['Knee cut'] }), mk('2026-08-02', { tags: ['Knee cut'] })],
      [mkComp('2026-07-15', { tags: ['Knee cut'] })],
    )
    expect(leaf(tree, 'passing', 'Knee cut')).toMatchObject({ lastIso: '2026-08-02', sessions: 2, comps: 1, xp: 110 })
    const later = skillTree(['Knee cut'], [mk('2026-07-01', { tags: ['Knee cut'] })], [mkComp('2026-07-15', { tags: ['Knee cut'] })])
    expect(leaf(later, 'passing', 'Knee cut').lastIso).toBe('2026-07-15')
  })

  it('a competition tag outside the vocabulary credits nothing', () => {
    expect(skillTree([], [], [mkComp(TODAY, { tags: ['Knee cut'] })])).toEqual([])
  })

  it('matches tags case-insensitively and trimmed, and dedupes leaves the same way', () => {
    const tree = skillTree(['Knee cut'], [mk(TODAY, { tags: ['  KNEE CUT '] })], [])
    expect(leaf(tree, 'passing', 'Knee cut').sessions).toBe(1)
    // the padded spelling is the same leaf, not a second one
    expect(names(sub(tree, 'passing', 'dynamic-passing').tags)).toEqual(['Knee cut'])
    expect(branch(tree, 'passing').total).toBe(1)
  })

  it('an unfolded alias in a session (pre-rename row) is its own leaf — folding happens at the boundaries, not here', () => {
    // load() and the pull sanitizers canonicalize before data reaches the tree; the tree itself only normalizes case.
    const tree = skillTree(['Single leg X'], [mk(TODAY, { tags: ['SLX'] })], [])
    expect(names(sub(tree, 'guard', 'open-guard').tags)).toEqual(['SLX', 'Single leg X'])
    expect(leaf(tree, 'guard', 'Single leg X').xp).toBe(0)
  })
})
