import { describe, expect, it } from 'vitest'
import { CURRICULUM_GROUPS, groupOfTag, groupTagsByCurriculum, orderTagsByCurriculum } from './curriculum'
import { DEFAULT_TAGS } from './store'

/** The real synced tagList as of 2026-08 — the order tags were added. */
const REAL_TAGS = [
  'Half guard', 'Guard retention', 'Knee cut', 'Kimura', 'De La Riva', 'Leg locks',
  'Sweeps', 'Passing', 'Darce', 'Mount attacks', 'Back takes', 'Escapes', 'DLR X',
  'Over-Under Pass', 'Side Control', 'Closed Guard', 'Mount',
]

describe('orderTagsByCurriculum', () => {
  it('orders the real tag list by GB position groups, input order within groups', () => {
    expect(orderTagsByCurriculum(REAL_TAGS)).toEqual([
      // guard
      'Half guard', 'Guard retention', 'Kimura', 'De La Riva', 'Sweeps', 'DLR X', 'Closed Guard',
      // passing
      'Knee cut', 'Passing', 'Over-Under Pass',
      // side control
      'Escapes', 'Side Control',
      // mount & KOB
      'Mount attacks', 'Mount',
      // back & turtle
      'Darce', 'Back takes',
      // leg locks
      'Leg locks',
    ])
  })

  it('puts unknown tags last, preserving input order', () => {
    expect(orderTagsByCurriculum(['Wristlocks', 'Half guard', 'My weird drill'])).toEqual([
      'Half guard', 'Wristlocks', 'My weird drill',
    ])
  })

  it('matches case-insensitively and trims', () => {
    expect(orderTagsByCurriculum(['closed guard', 'DLR x', '  Kimura '])).toEqual([
      'closed guard', 'DLR x', '  Kimura ',
    ])
    expect(groupOfTag('closed guard')).toBe('guard')
    expect(groupOfTag('DLR x')).toBe('guard')
    expect(groupOfTag('  Kimura ')).toBe('guard')
  })

  it('keeps relative order within a group regardless of other groups in between', () => {
    expect(orderTagsByCurriculum(['Sweeps', 'Passing', 'Kimura', 'Mount'])).toEqual([
      'Sweeps', 'Kimura', 'Passing', 'Mount',
    ])
  })

  it('returns [] for empty input', () => {
    expect(orderTagsByCurriculum([])).toEqual([])
  })
})

describe('groupTagsByCurriculum', () => {
  it('returns only non-empty groups, in curriculum order, with labels', () => {
    const sections = groupTagsByCurriculum(['Leg locks', 'Kimura', 'Double leg'])
    expect(sections).toEqual([
      { group: 'standing', label: 'Standing & takedowns', tags: ['Double leg'] },
      { group: 'guard', label: 'Guard', tags: ['Kimura'] },
      { group: 'legs', label: 'Leg locks', tags: ['Leg locks'] },
    ])
  })

  it('returns [] for empty input', () => {
    expect(groupTagsByCurriculum([])).toEqual([])
  })

  it('group ids and labels stay in the canonical GB theme sequence', () => {
    expect(CURRICULUM_GROUPS.map((g) => g.id)).toEqual([
      'standing', 'guard', 'passing', 'side', 'mount', 'back', 'legs', 'other',
    ])
  })
})

describe('groupOfTag judgment calls (documented deviations)', () => {
  it("files generic 'Escapes' under side control (GB pin-escape rotation starts there)", () => {
    expect(groupOfTag('Escapes')).toBe('side')
  })

  it("files 'Half guard' under guard (practical usage over GB1's side-control-recovery slot)", () => {
    expect(groupOfTag('Half guard')).toBe('guard')
  })

  it("files 'Darce' under back & turtle (front-headlock family)", () => {
    expect(groupOfTag('Darce')).toBe('back')
  })

  it('maps every default tag to a real group, never other', () => {
    for (const t of DEFAULT_TAGS) expect(groupOfTag(t), t).not.toBe('other')
  })
})
