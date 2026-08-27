import { describe, expect, it } from 'vitest'
import type { Competition, Session } from './types'
import {
  focusProgress,
  formatHours,
  historyFeed,
  last30d,
  quarterMilestone,
  withSessionTags,
  sortByDateDesc,
  streak,
  streakMilestone,
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
    workedWell: '',
    didntWork: '',
    matches: [],
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

describe('milestones', () => {
  it('quarter: crossing date of the achieving quarter', () => {
    const s = [
      mk('2026-04-10', { rolls: 60 }),
      mk('2026-05-14', { rolls: 45 }), // crosses 100 in Q2
      mk('2026-07-20', { rolls: 10 }),
    ]
    expect(quarterMilestone(s, TODAY)).toEqual({ achieved: true, title: '100 rounds in a quarter', sub: 'Hit May 14' })
  })

  it('quarter: in progress shows current-quarter count', () => {
    const s = [mk('2026-07-20', { rolls: 40 }), mk('2026-06-30', { rolls: 30 })]
    expect(quarterMilestone(s, TODAY).sub).toBe('40 / 100 this quarter')
  })

  it('streak milestone: only completed weeks count, dated the Monday after week 10', () => {
    const sessions: Session[] = []
    // Build 10 completed goal-met weeks ending Sun 2026-07-26 (weeks starting May 18 … Jul 20)
    for (let i = 0; i < 10; i++) {
      const base = new Date(2026, 4, 18 + i * 7)
      const mondayIso = `2026-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      sessions.push(mk(mondayIso), mk(mondayIso))
    }
    const m = streakMilestone(sessions, 2, TODAY)
    expect(m).toEqual({ achieved: true, title: '10-week streak', sub: 'Hit Jul 27' })
  })

  it('streak milestone: nine completed weeks plus a qualifying current week is not achieved', () => {
    const sessions: Session[] = []
    for (let i = 0; i < 9; i++) {
      const base = new Date(2026, 4, 25 + i * 7)
      const mondayIso = `2026-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      sessions.push(mk(mondayIso), mk(mondayIso))
    }
    sessions.push(mk('2026-07-27'), mk('2026-07-28')) // current week qualifies
    const m = streakMilestone(sessions, 2, TODAY)
    expect(m.achieved).toBe(false)
    expect(m.sub).toBe('9 / 10 weeks') // completed weeks only — current week is still open
  })

  it('year: achieved with crossing date', () => {
    const s = [mk('2026-02-01', { rolls: 300 }), mk('2026-03-05', { rolls: 250 })]
    expect(yearMilestone(s, TODAY)).toEqual({ achieved: true, title: '500 rounds this year', sub: 'Hit Mar 5' })
  })

  it('year: shows pace month when projection lands inside the year', () => {
    const s = [mk('2026-06-01', { rolls: 360 })]
    const m = yearMilestone(s, TODAY)
    expect(m.achieved).toBe(false)
    expect(m.sub).toBe('360 / 500 — on pace for October') // ceil(214*500/360) = day 298 = Oct 25
  })

  it('year: no pace clause when off pace or empty', () => {
    expect(yearMilestone([], TODAY).sub).toBe('0 / 500')
    expect(yearMilestone([mk('2026-08-01', { rolls: 10 })], TODAY).sub).toBe('10 / 500')
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
