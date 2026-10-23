import { describe, expect, it } from 'vitest'
import { skillTree, SPEC_GROUPS } from './tree'
import type { TreeBranch } from './tree'
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
const leaf = (tree: TreeBranch[], group: string, tag: string) => branch(tree, group).tags.find((t) => t.tag === tag)!

describe('skillTree structure', () => {
  it('builds one branch per curriculum group that has a tag, in curriculum order, tags as leaves', () => {
    const tree = skillTree(['My weird drill', 'Leg locks', 'Knee cut', 'Half guard'], [], [])
    expect(tree.map((b) => b.group)).toEqual(['guard', 'passing', 'legs', 'other'])
    expect(tree.map((b) => b.label)).toEqual(['Guard', 'Guard passing', 'Leg locks', 'Other'])
    expect(branch(tree, 'guard').tags.map((t) => t.tag)).toEqual(['Half guard'])
    expect(branch(tree, 'other').tags.map((t) => t.tag)).toEqual(['My weird drill'])
    expect(branch(tree, 'guard')).toMatchObject({ explored: 0, total: 1, xp: 0, level: 1 })
  })

  it('includes session-borne tags, one leaf per normalized spelling (first spelling wins)', () => {
    const tree = skillTree(['Knee cut'], [mk(TODAY, { tags: ['knee cut'] }), mk(TODAY, { tags: ['Leg drag'] })], [])
    expect(branch(tree, 'passing').tags.map((t) => t.tag)).toEqual(['Knee cut', 'Leg drag'])
    expect(leaf(tree, 'passing', 'Knee cut').sessions).toBe(1)
    expect(branch(tree, 'passing').total).toBe(2)
  })

  it('is empty with no tags and no history, and omits groups with neither tags nor XP', () => {
    expect(skillTree([], [], [])).toEqual([])
    expect(skillTree(['Knee cut'], [], []).map((b) => b.group)).toEqual(['passing'])
  })

  it('orders leaves most trained first (sessions + comps), ties by name', () => {
    const tree = skillTree(
      ['Sweeps', 'Kimura', 'De La Riva'],
      [mk(TODAY, { tags: ['Kimura', 'Sweeps'] }), mk(TODAY, { tags: ['Kimura'] }), mk(TODAY, { tags: ['De La Riva'] })],
      [],
    )
    expect(branch(tree, 'guard').tags.map((t) => t.tag)).toEqual(['Kimura', 'De La Riva', 'Sweeps'])
    expect(branch(tree, 'guard')).toMatchObject({ explored: 3, total: 3 })
    // a competition counts as one entry in the order, same as a session
    const withComp = skillTree(
      ['Sweeps', 'Kimura'],
      [mk(TODAY, { tags: ['Kimura'] }), mk(TODAY, { tags: ['Sweeps'] })],
      [mkComp(TODAY, { tags: ['Sweeps'] })],
    )
    expect(branch(withComp, 'guard').tags.map((t) => t.tag)).toEqual(['Sweeps', 'Kimura'])
  })

  it('tolerates a non-string tag in a corrupt local blob instead of throwing', () => {
    const junk = 7 as unknown as string
    const tree = skillTree(['Knee cut', junk], [mk(TODAY, { tags: ['Knee cut', junk] })], [])
    expect(tree.map((b) => b.group)).toEqual(['passing'])
    expect(leaf(tree, 'passing', 'Knee cut').sessions).toBe(1)
  })
})

describe('skillTree progress', () => {
  it('credits the tagged leaf and its branch 25 per session, nothing else', () => {
    const tree = skillTree(['Knee cut', 'Leg drag', 'Half guard'], [mk(TODAY, { tags: ['Knee cut'] })], [])
    expect(leaf(tree, 'passing', 'Knee cut')).toMatchObject({ xp: 25, sessions: 1, comps: 0, lastIso: TODAY, level: 1, into: 25, need: 50 })
    expect(leaf(tree, 'passing', 'Leg drag').xp).toBe(0)
    expect(branch(tree, 'passing')).toMatchObject({ xp: 25, sessions: 1, explored: 1, total: 2 })
    expect(branch(tree, 'guard').xp).toBe(0)
  })

  it('is flat per entry at branch level: three guard tags and a closed-guard round credit Guard once', () => {
    const tree = skillTree(
      ['Half guard', 'Kimura', 'Sweeps'],
      [mk(TODAY, { tags: ['Half guard', 'Kimura', 'Sweeps'], specClosed: 2, specific: 2 })],
      [],
    )
    expect(branch(tree, 'guard')).toMatchObject({ xp: 25, sessions: 1, explored: 3, total: 3 })
    for (const t of ['Half guard', 'Kimura', 'Sweeps']) expect(leaf(tree, 'guard', t).xp, t).toBe(25)
    // the closed-guard round also trains the passer: Guard passing lights with no tag at all
    expect(branch(tree, 'passing')).toMatchObject({ xp: 25, total: 0, explored: 0, tags: [] })
  })

  it('typed rounds light position branches only, both roles of the swap', () => {
    const side = skillTree(['Side Control', 'Escapes'], [mk(TODAY, { specSide: 1, specific: 1 })], [])
    expect(branch(side, 'side')).toMatchObject({ xp: 25, explored: 0, total: 2 })
    expect(leaf(side, 'side', 'Side Control').xp).toBe(0)
    expect(leaf(side, 'side', 'Escapes').xp).toBe(0)
    const back = skillTree([], [mk(TODAY, { specTurtle: 1, specBack: 1, specific: 2 })], [])
    expect(back.map((b) => b.group)).toEqual(['back'])
    expect(branch(back, 'back').xp).toBe(25)
    const mount = skillTree([], [mk(TODAY, { specMount: 3, specific: 3 })], [])
    expect(mount.map((b) => b.group)).toEqual(['mount'])
  })

  it('pins the typed-round mapping', () => {
    expect(SPEC_GROUPS).toEqual({
      specClosed: ['guard', 'passing'],
      specOpen: ['guard', 'passing'],
      specSide: ['side'],
      specMount: ['mount'],
      specBack: ['back'],
      specTurtle: ['back'],
    })
  })

  it('competitions grant 60 and derive a level on the 50/25 curve', () => {
    const tree = skillTree(['DLR X'], [], [mkComp(TODAY, { tags: ['DLR X'] })])
    const dlr = leaf(tree, 'guard', 'DLR X')
    expect(dlr).toMatchObject({ xp: 60, sessions: 0, comps: 1, lastIso: TODAY, level: 2, into: 10, need: 75 })
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
    expect(branch(tree, 'passing').tags.map((t) => t.tag)).toEqual(['Knee cut'])
    expect(branch(tree, 'passing').total).toBe(1)
  })
})
