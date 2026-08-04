import { describe, expect, it } from 'vitest'
import { demoData } from './demo'
import {
  focusProgress,
  milestones,
  streak,
  subs30d,
  tagCounts30d,
  volume12w,
  weekSummary,
  yearTotals,
} from './stats'

const TODAY = '2026-08-02' // Sunday — every showcase session exists

describe('demo seed (through the real stats functions)', () => {
  const data = demoData(TODAY)
  const { sessions } = data

  it('never creates future or prior-year sessions', () => {
    expect(sessions.every((s) => s.date <= TODAY && s.date >= '2026-01-01')).toBe(true)
  })

  it('reproduces the handoff dashboard week: 18 rolls, 3 sessions, bars M4/W8/F6', () => {
    const w = weekSummary(sessions, TODAY)
    expect(w.rolls).toBe(18)
    expect(w.sessions).toBe(3)
    expect(w.bars.map((b) => b.rolls)).toEqual([4, 0, 8, 0, 6, 0, 0])
  })

  it('has an 11-week streak since May 18', () => {
    expect(streak(sessions, 2, TODAY)).toEqual({ weeks: 11, sinceIso: '2026-05-18' })
  })

  it('shows 9 subs for / 12 against over 30 days', () => {
    expect(subs30d(sessions, TODAY)).toEqual({ subsFor: 9, subsAgainst: 12 })
  })

  it('tags the focus in 7 of the last 11 sessions (64%)', () => {
    expect(focusProgress(sessions, data.focus.tag, TODAY)).toEqual({ pct: 64, tagged: 7, total: 11 })
  })

  it('ranks techniques with the focus tag on top', () => {
    const counts = tagCounts30d(sessions, TODAY)
    expect(counts[0]).toEqual({ name: 'Guard retention', n: 7 })
    expect(counts[1]).toEqual({ name: 'Half guard', n: 6 })
    expect(counts[2]).toEqual({ name: 'Knee cut', n: 5 })
    expect(counts.length).toBeGreaterThanOrEqual(10)
  })

  it('matches the prototype 12-week volume chart', () => {
    expect(volume12w(sessions, TODAY)).toEqual([12, 15, 10, 18, 14, 9, 16, 20, 13, 17, 15, 18])
  })

  it('lands the milestone trio like the handoff', () => {
    const [quarter, tenWeek, fiveHundred] = milestones(sessions, 2, TODAY)
    expect(quarter.achieved).toBe(true)
    expect(quarter.sub).toMatch(/^Hit (May|Jun)/)
    expect(tenWeek).toEqual({ achieved: true, title: '10-week streak', sub: 'Hit Jul 27' })
    expect(fiveHundred.achieved).toBe(false)
    expect(fiveHundred.sub).toMatch(/on pace for (September|October|November)$/)
  })

  it('has a plausible year volume for early August', () => {
    const { rolls } = yearTotals(sessions, TODAY)
    expect(rolls).toBeGreaterThan(300)
    expect(rolls).toBeLessThan(430)
  })
})
