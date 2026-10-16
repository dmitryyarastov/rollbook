import { describe, expect, it } from 'vitest'
import type { Competition, Session } from './types'
import {
  CHARACTERISTICS,
  characteristics,
  characterLevel,
  compXp,
  levelFromXp,
  sessionsToNext,
  sessionXp,
  totalXp,
  yearXp,
} from './xp'

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

describe('xp formulas', () => {
  it('session: 20 base + 5 per combined round', () => {
    expect(sessionXp(mk(TODAY, { rolls: 2 }))).toBe(30)
    expect(sessionXp(mk(TODAY, { rolls: 4, specific: 2 }))).toBe(50)
    expect(sessionXp(mk(TODAY, { rolls: 0 }))).toBe(20)
  })

  it('comp: 150 base + 40 per match + 60 per win + podium bonus', () => {
    const matches = [
      { outcome: 'win' as const, myPoints: 4, theirPoints: 2, submission: '' },
      { outcome: 'win' as const, myPoints: 0, theirPoints: 0, submission: 'Armbar' },
      { outcome: 'loss' as const, myPoints: 2, theirPoints: 5, submission: '' },
    ]
    expect(compXp(mkComp(TODAY, { matches }))).toBe(150 + 120 + 120)
    expect(compXp(mkComp(TODAY, { matches, placement: 'bronze' }))).toBe(150 + 120 + 120 + 200)
    expect(compXp(mkComp(TODAY, { placement: 'gold' }))).toBe(750)
  })

  it('totals sum both kinds', () => {
    expect(totalXp([mk(TODAY, { rolls: 2 })], [mkComp(TODAY)])).toBe(30 + 150)
  })
})

describe('level curve', () => {
  it('level costs grow linearly and XP carries into the level', () => {
    expect(levelFromXp(0, 100, 50)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFromXp(99, 100, 50)).toEqual({ level: 1, into: 99, need: 100 })
    expect(levelFromXp(100, 100, 50)).toEqual({ level: 2, into: 0, need: 150 })
    expect(levelFromXp(260, 100, 50)).toEqual({ level: 3, into: 10, need: 200 })
    expect(levelFromXp(-5, 100, 50).level).toBe(1)
  })

  it('treats non-finite XP as zero instead of freezing', () => {
    expect(levelFromXp(Number.POSITIVE_INFINITY, 100, 50)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFromXp(Number.NaN, 100, 50)).toEqual({ level: 1, into: 0, need: 100 })
  })

  it('character curve: level 10 needs 2700 cumulative', () => {
    // sum of 100+50(k-1) for k=1..9 = 900 + 50*36 = 2700
    expect(characterLevel(2699).level).toBe(9)
    expect(characterLevel(2700).level).toBe(10)
  })
})

describe('yearXp', () => {
  it('buckets by local date within the calendar year', () => {
    const y = yearXp(
      [mk('2026-08-02', { rolls: 2 }), mk('2026-08-01', { rolls: 4 }), mk('2025-12-31', { rolls: 100 })],
      [mkComp('2026-07-15')],
      TODAY,
    )
    expect(y.today).toBe(30)
    expect(y.year).toBe(30 + 40 + 150)
    expect(y.bestDay).toBe(150)
    expect(y.byDay).toHaveLength(365)
    expect(y.avgPerDay).toBe(Math.round(220 / 214)) // Aug 2 is day 214 of 2026
  })

  it('is all zeros with no activity', () => {
    const y = yearXp([], [], TODAY)
    expect(y.year).toBe(0)
    expect(y.today).toBe(0)
    expect(y.avgPerDay).toBe(0)
  })
})

describe('characteristics', () => {
  const byId = (states: ReturnType<typeof characteristics>, id: string) => states.find((s) => s.id === id)!

  it('defines the six lifelong attributes in order', () => {
    expect(CHARACTERISTICS.map((c) => c.id)).toEqual([
      'passing',
      'retention',
      'takedowns-gi',
      'wrestling-nogi',
      'leglocks',
      'top-control',
    ])
  })

  it('a session feeds every attribute its tags touch, flat 25 each', () => {
    const s = [mk(TODAY, { tags: ['Knee cut', 'Guard retention', 'Side Control'] })]
    const states = characteristics(s, [])
    expect(byId(states, 'passing').xp).toBe(25)
    expect(byId(states, 'retention').xp).toBe(25)
    expect(byId(states, 'top-control').xp).toBe(25)
    expect(byId(states, 'leglocks').xp).toBe(0)
  })

  it('tag-spamming one session cannot grind an attribute', () => {
    const s = [mk(TODAY, { tags: ['Knee cut', 'Passing', 'Over-Under Pass'] })]
    expect(byId(characteristics(s, []), 'passing').xp).toBe(25)
  })

  it('standing work splits by gi: takedowns vs wrestling', () => {
    const s = [
      mk(TODAY, { gi: true, tags: ['Takedowns'] }),
      mk(TODAY, { gi: false, tags: ['Takedowns'] }),
      mk(TODAY, { gi: false, tags: ['Wrestling'] }),
    ]
    const states = characteristics(s, [])
    expect(byId(states, 'takedowns-gi').xp).toBe(25)
    expect(byId(states, 'wrestling-nogi').xp).toBe(50)
  })

  it('escapes do not feed top control (bottom work)', () => {
    const states = characteristics([mk(TODAY, { tags: ['Escapes', 'Mount'] })], [])
    expect(byId(states, 'top-control').xp).toBe(25) // Mount yes, Escapes no
    expect(byId(characteristics([mk(TODAY, { tags: ['Escapes'] })], []), 'top-control').xp).toBe(0)
  })

  it('harvested vocabulary feeds the right attributes', () => {
    const states = characteristics(
      [
        mk(TODAY, { gi: false, tags: ['Blast double'] }), // wrestling no-gi
        mk(TODAY, { tags: ['Granby roll'] }), // retention
        mk(TODAY, { tags: ['Gift wrap', 'Buggy choke'] }), // top control (buggy is bottom — no double count)
        mk(TODAY, { tags: ['Inside heel hook'] }), // leg locks
      ],
      [],
    )
    expect(byId(states, 'wrestling-nogi').xp).toBe(25)
    expect(byId(states, 'retention').xp).toBe(25)
    expect(byId(states, 'top-control').xp).toBe(25)
    expect(byId(states, 'leglocks').xp).toBe(25)
    expect(byId(characteristics([mk(TODAY, { tags: ['Buggy choke'] })], []), 'top-control').xp).toBe(0)
  })

  it('the live-audit tags feed their attributes', () => {
    const states = characteristics(
      [
        mk(TODAY, { gi: true, tags: ['Yoko Tomoe Nage'] }), // takedowns gi
        mk(TODAY, { tags: ['Opening Closed Guard'] }), // passing
        mk(TODAY, { gi: false, tags: ['Cow catcher'] }), // top control
      ],
      [],
    )
    expect(byId(states, 'takedowns-gi').xp).toBe(25)
    expect(byId(states, 'passing').xp).toBe(25)
    expect(byId(states, 'top-control').xp).toBe(25)
  })

  it('typed specific rounds feed characteristics without tags', () => {
    const states = characteristics(
      [
        mk(TODAY, { specClosed: 2 }), // guard format: passing + retention
        mk(TODAY, { specMount: 1 }), // mount format: top control only
      ],
      [],
    )
    expect(byId(states, 'passing').xp).toBe(25)
    expect(byId(states, 'retention').xp).toBe(25)
    expect(byId(states, 'top-control').xp).toBe(25)
    expect(byId(states, 'leglocks').xp).toBe(0)
    // a session qualifying via BOTH a tag and specific work still counts once
    const both = characteristics([mk(TODAY, { tags: ['Knee cut'], specOpen: 1 })], [])
    expect(byId(both, 'passing').xp).toBe(25)
  })

  it('sessionsToNext counts 25-XP sessions, rounding up', () => {
    expect(sessionsToNext({ level: 6, into: 150, need: 175 })).toBe(1)
    expect(sessionsToNext({ level: 7, into: 25, need: 200 })).toBe(7)
    expect(sessionsToNext({ level: 1, into: 0, need: 50 })).toBe(2)
    expect(sessionsToNext({ level: 2, into: 60, need: 75 })).toBe(1) // a comp's 60 can leave a remainder
  })

  it('competitions feed 60 and levels derive from xp', () => {
    const states = characteristics([], [mkComp(TODAY, { tags: ['DLR X', 'Leg locks'] })])
    const legs = byId(states, 'leglocks')
    expect(legs.xp).toBe(60)
    expect(legs.level).toBe(2) // 60 clears the 50-cost first level
    expect(legs.into).toBe(10)
    expect(legs.need).toBe(75)
  })
})
