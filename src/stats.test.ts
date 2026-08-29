import { describe, expect, it } from 'vitest'
import type { Competition, Session } from './types'
import {
  focusProgress,
  formatHours,
  focusStreak,
  giNoGiStreak,
  historyFeed,
  last30d,
  medalMilestone,
  milestones,
  openGuardMilestone,
  withSessionTags,
  sortByDateDesc,
  streak,
  subs30d,
  volume12w,
  weekSummary,
  yearMilestone,
  yearTotals,
} from './stats'

const TODAY = '2026-08-02' // Sunday; current week starts Mon 2026-07-27

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
    rolls: 5,
    subsFor: 0,
    subsAgainst: 0,
    roundMin: 5,
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

describe('weekSummary', () => {
  it('is all zeros with no sessions', () => {
    const w = weekSummary([], TODAY)
    expect(w.rolls).toBe(0)
    expect(w.sessions).toBe(0)
    expect(w.bars.map((b) => b.rolls)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('sums the current Monday-Sunday week per day', () => {
    const sessions = [
      mk('2026-07-27', { rolls: 4 }), // Mon
      mk('2026-07-29', { rolls: 8, roundMin: 6 }), // Wed
      mk('2026-07-31', { rolls: 6 }), // Fri
      mk('2026-07-26', { rolls: 9 }), // previous Sunday — excluded
    ]
    const w = weekSummary(sessions, TODAY)
    expect(w.rolls).toBe(18)
    expect(w.sessions).toBe(3)
    expect(w.bars.map((b) => b.rolls)).toEqual([4, 0, 8, 0, 6, 0, 0])
    expect(formatHours(w.hours)).toBe('1.6') // 4*5 + 8*6 + 6*5 = 98 min
  })
})

describe('streak', () => {
  it('is zero with no sessions', () => {
    expect(streak([], 2, TODAY)).toEqual({ weeks: 0, sinceIso: null })
  })

  it('counts the current week once it qualifies', () => {
    const s = [mk('2026-07-27'), mk('2026-07-29')]
    expect(streak(s, 2, TODAY)).toEqual({ weeks: 1, sinceIso: '2026-07-27' })
  })

  it('does not break on an unfinished current week', () => {
    const s = [mk('2026-07-28'), mk('2026-07-20'), mk('2026-07-22'), mk('2026-07-13'), mk('2026-07-15')]
    expect(streak(s, 2, TODAY)).toEqual({ weeks: 2, sinceIso: '2026-07-13' })
  })

  it('stops at the first week under goal', () => {
    const s = [
      mk('2026-07-27'), mk('2026-07-29'),
      mk('2026-07-20'), mk('2026-07-22'),
      mk('2026-07-15'), // single session — breaks
      mk('2026-07-06'), mk('2026-07-08'),
    ]
    expect(streak(s, 2, TODAY)).toEqual({ weeks: 2, sinceIso: '2026-07-20' })
  })
})

describe('30-day window', () => {
  it('includes day -29 and excludes day -30', () => {
    const edgeIn = mk('2026-07-04', { subsFor: 1 })
    const edgeOut = mk('2026-07-03', { subsFor: 1 })
    expect(last30d([edgeIn, edgeOut], TODAY)).toEqual([edgeIn])
    expect(subs30d([edgeIn, edgeOut], TODAY).subsFor).toBe(1)
  })

  it('computes focus progress over the window', () => {
    const s = [
      mk('2026-08-01', { tags: ['Guard retention'] }),
      mk('2026-07-30', { tags: ['Kimura'] }),
      mk('2026-07-28', { tags: ['Guard retention', 'Sweeps'] }),
    ]
    expect(focusProgress(s, 'Guard retention', TODAY)).toEqual({ pct: 67, tagged: 2, total: 3 })
    expect(focusProgress(s, '', TODAY)).toEqual({ pct: 0, tagged: 0, total: 0 })
  })
})

describe('volume and year totals', () => {
  it('buckets 12 weeks oldest-first', () => {
    const s = [
      mk('2026-07-27', { rolls: 3 }), // current week → last bucket
      mk('2026-05-11', { rolls: 7 }), // 11 weeks back → first bucket
      mk('2026-05-10', { rolls: 9 }), // 12 weeks back — out
    ]
    const v = volume12w(s, TODAY)
    expect(v).toHaveLength(12)
    expect(v[11]).toBe(3)
    expect(v[0]).toBe(7)
    expect(v.reduce((a, b) => a + b)).toBe(10)
  })

  it('sums the calendar year only', () => {
    const s = [mk('2026-01-01', { rolls: 6, roundMin: 5 }), mk('2025-12-31', { rolls: 50 })]
    expect(yearTotals(s, TODAY)).toEqual({ hours: 0.5, rolls: 6 })
  })
})

describe('weekly streak variants', () => {
  it('gi + no-gi: counts weeks with at least one of each', () => {
    const s = [
      mk('2026-07-27', { gi: true }), // current week: both
      mk('2026-07-28', { gi: false }),
      mk('2026-07-20', { gi: true }), // last week: both
      mk('2026-07-24', { gi: false }),
      mk('2026-07-13', { gi: true }), // two weeks back: gi only — breaks
      mk('2026-07-14', { gi: true }),
    ]
    expect(giNoGiStreak(s, TODAY)).toEqual({ weeks: 2, sinceIso: '2026-07-20' })
  })

  it('gi + no-gi: an unfinished current week without both does not break the streak', () => {
    const s = [
      mk('2026-08-01', { gi: true }), // current week: gi only so far
      mk('2026-07-20', { gi: true }),
      mk('2026-07-21', { gi: false }),
    ]
    expect(giNoGiStreak(s, TODAY).weeks).toBe(1)
  })

  it('focus: counts weeks with at least one focus-tagged session; empty tag = 0', () => {
    const s = [
      mk('2026-07-28', { tags: ['Guard retention'] }),
      mk('2026-07-22', { tags: ['Guard retention', 'Kimura'] }),
      mk('2026-07-15', { tags: ['Kimura'] }), // untagged week breaks
    ]
    expect(focusStreak(s, 'Guard retention', TODAY)).toEqual({ weeks: 2, sinceIso: '2026-07-20' })
    expect(focusStreak(s, '', TODAY)).toEqual({ weeks: 0, sinceIso: null })
  })
})

describe('weeklyStreak bound', () => {
  it('a predicate that accepts empty weeks terminates at the earliest logged week', () => {
    // goal 0 makes every week qualify — the walk must stop, not march forever
    expect(streak([mk('2026-07-28')], 0, TODAY)).toEqual({ weeks: 1, sinceIso: '2026-07-27' })
    expect(streak([mk('2026-07-07')], 0, TODAY)).toEqual({ weeks: 4, sinceIso: '2026-07-06' })
    expect(streak([], 0, TODAY)).toEqual({ weeks: 1, sinceIso: '2026-07-27' })
  })
})

describe('milestones', () => {
  it('medal: earliest AJP-titled comp with a placement achieves it', () => {
    const comps = [
      mkComp('2026-09-12', { title: 'Regional Open', placement: 'gold' }), // not AJP — no effect
      mkComp('2026-11-20', { title: 'AJP World Pro Ams', placement: 'silver' }),
      mkComp('2026-12-05', { title: 'AJP Grand Slam', placement: 'bronze' }),
    ]
    expect(medalMilestone(comps)).toEqual({
      achieved: true,
      title: 'Medal at AJP World Pro Ams',
      sub: 'Silver at AJP World Pro Ams — Nov 20',
    })
  })

  it('medal: matches AJP case-insensitively; no placement or no AJP comp stays pending', () => {
    expect(medalMilestone([mkComp('2026-11-20', { title: 'ajp tour uae national', placement: 'bronze' })]).achieved).toBe(true)
    expect(medalMilestone([mkComp('2026-11-20', { title: 'AJP World Pro', placement: 'none' })]).achieved).toBe(false)
    expect(medalMilestone([mkComp('2026-09-12', { title: 'Regional Open', placement: 'gold' })]).achieved).toBe(false)
    expect(medalMilestone([]).sub).toBe('No AJP podium yet')
  })

  it('open guard: earliest comp with an open-guard-family tag achieves it', () => {
    const comps = [
      mkComp('2026-09-12', { title: 'Regional Open', tags: ['Closed Guard', 'Half guard'] }), // not open guard
      mkComp('2026-10-03', { title: 'Local Cup', tags: ['DLR X'] }),
      mkComp('2026-11-20', { title: 'AJP World Pro', tags: ['Open guard'] }),
    ]
    expect(openGuardMilestone(comps)).toEqual({
      achieved: true,
      title: 'Open guard in competition',
      sub: 'DLR X at Local Cup — Oct 3',
    })
  })

  it('open guard: closed and half guard do not qualify; empty stays pending', () => {
    expect(openGuardMilestone([mkComp('2026-09-12', { tags: ['Closed Guard'] })]).achieved).toBe(false)
    expect(openGuardMilestone([]).sub).toBe('Play it, then tag it on the comp entry')
  })

  it('year: achieved with crossing date', () => {
    const s = [mk('2026-02-01', { rolls: 150 }), mk('2026-03-05', { rolls: 120 })]
    expect(yearMilestone(s, TODAY)).toEqual({ achieved: true, title: '250 rounds this year', sub: 'Hit Mar 5' })
  })

  it('year: shows pace month when projection lands inside the year', () => {
    const s = [mk('2026-06-01', { rolls: 180 })]
    const m = yearMilestone(s, TODAY)
    expect(m.achieved).toBe(false)
    expect(m.sub).toBe('180 / 250 — on pace for October') // ceil(214*250/180) = day 298 = Oct 25
  })

  it('year: no pace clause when off pace or empty', () => {
    expect(yearMilestone([], TODAY).sub).toBe('0 / 250')
    expect(yearMilestone([mk('2026-08-01', { rolls: 5 })], TODAY).sub).toBe('5 / 250')
  })

  it('milestones returns the goal pair plus the year target', () => {
    const titles = milestones([], [], TODAY).map((m) => m.title)
    expect(titles).toEqual(['Medal at AJP World Pro Ams', 'Open guard in competition', '250 rounds this year'])
  })
})

describe('withSessionTags', () => {
  it('appends session-borne tags missing from the master list', () => {
    const sessions = [mk('2026-08-01', { tags: ['Half guard', 'Over-Under Pass'] })]
    expect(withSessionTags(['Half guard', 'Kimura'], sessions)).toEqual(['Half guard', 'Kimura', 'Over-Under Pass'])
  })

  it('returns the same reference when nothing is missing', () => {
    const list = ['Half guard']
    expect(withSessionTags(list, [mk('2026-08-01', { tags: ['Half guard'] })])).toBe(list)
  })
})

describe('historyFeed', () => {
  it('interleaves sessions and competitions by date desc', () => {
    const s1 = mk('2026-08-01')
    const c = mkComp('2026-07-30')
    const s2 = mk('2026-07-28')
    expect(historyFeed([s2, s1], [c])).toEqual([
      { kind: 'session', item: s1 },
      { kind: 'comp', item: c },
      { kind: 'session', item: s2 },
    ])
  })

  it('breaks same-date ties by createdAt desc across kinds', () => {
    const s = mk('2026-08-01') // createdAt = seq, earlier
    const c = mkComp('2026-08-01') // later createdAt
    expect(historyFeed([s], [c]).map((e) => e.kind)).toEqual(['comp', 'session'])
  })

  it('puts the competition first on an exact date+createdAt tie', () => {
    const s = mk('2026-08-01', { createdAt: 100 })
    const c = mkComp('2026-08-01', { createdAt: 100 })
    expect(historyFeed([s], [c]).map((e) => e.kind)).toEqual(['comp', 'session'])
  })

  it('handles empty inputs', () => {
    expect(historyFeed([], [])).toEqual([])
    const s = mk('2026-08-01')
    expect(historyFeed([s], [])).toEqual([{ kind: 'session', item: s }])
  })
})

describe('sortByDateDesc', () => {
  it('sorts by date then createdAt, newest first', () => {
    const a = mk('2026-08-01')
    const b = mk('2026-08-01')
    const c = mk('2026-07-30')
    expect(sortByDateDesc([c, a, b]).map((x) => x.id)).toEqual([b.id, a.id, c.id])
  })
})
