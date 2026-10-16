import { describe, expect, it } from 'vitest'
import { CURRICULUM_GROUPS, groupOfTag, groupTagsByCurriculum, isOpenGuardTag, orderTagsByCurriculum } from './curriculum'
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

  it("pins the owner's 2026-10 tag rulings", () => {
    expect(groupOfTag('SLX')).toBe('guard')
    expect(groupOfTag('Top lock')).toBe('guard') // closed guard despite the name
    expect(groupOfTag('Side scissors')).toBe('guard')
    expect(groupOfTag('Pendulum')).toBe('guard')
    expect(groupOfTag('Double under pass')).toBe('passing')
    expect(groupOfTag('Long step pass')).toBe('passing')
    expect(groupOfTag('Slide by')).toBe('standing')
    expect(groupOfTag('Turtle defense')).toBe('back')
    expect(isOpenGuardTag('SLX')).toBe(true) // open guard — counts for the comp milestone
    expect(isOpenGuardTag('Top lock')).toBe(false) // closed guard — does not
  })

  it('maps every tag in the live synced data (2026-10-16 audit)', () => {
    expect(groupOfTag('Yoko Tomoe Nage')).toBe('standing')
    expect(groupOfTag('Opening Closed Guard')).toBe('passing')
    expect(groupOfTag('Cow catcher')).toBe('back')
    expect(groupOfTag('Half Butterfly')).toBe('guard')
    expect(isOpenGuardTag('Half Butterfly')).toBe(false) // owner ruling: half-guard variant
  })

  it('spot-checks the 2026-10 vocabulary harvest', () => {
    expect(groupOfTag('Blast double')).toBe('standing')
    expect(groupOfTag('K-guard')).toBe('guard')
    expect(groupOfTag('Reverse De La Riva')).toBe('guard')
    expect(groupOfTag('Headquarters')).toBe('passing')
    expect(groupOfTag('North south choke')).toBe('side')
    expect(groupOfTag('Gift wrap')).toBe('mount')
    expect(groupOfTag('Body triangle')).toBe('back')
    expect(groupOfTag('Inside heel hook')).toBe('legs')
    expect(groupOfTag('Calf slicer')).toBe('legs')
    expect(isOpenGuardTag('K-guard')).toBe(true)
    expect(isOpenGuardTag('Berimbolo')).toBe(true)
    expect(isOpenGuardTag('Z-guard')).toBe(false) // half-guard family — not open guard
    expect(isOpenGuardTag('Rubber guard')).toBe(false) // closed-guard system
  })

  it('maps every default tag to a real group, never other', () => {
    for (const t of DEFAULT_TAGS) expect(groupOfTag(t), t).not.toBe('other')
  })
})
