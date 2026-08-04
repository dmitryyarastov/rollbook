import { describe, expect, it } from 'vitest'
import { addDays, autoTitle, dayOfYear, fmtShort, fmtToday, mondayOf, parseIso, toIso, weekdayBadge } from './dates'

describe('dates', () => {
  it('round-trips local iso dates', () => {
    expect(toIso(parseIso('2026-08-02'))).toBe('2026-08-02')
    expect(toIso(new Date(2026, 7, 2))).toBe('2026-08-02')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-08-02', -29)).toBe('2026-07-04')
  })

  it('finds Monday of the week', () => {
    expect(mondayOf('2026-08-02')).toBe('2026-07-27') // Sunday
    expect(mondayOf('2026-07-27')).toBe('2026-07-27') // Monday
    expect(mondayOf('2026-07-30')).toBe('2026-07-27') // Thursday
  })

  it('formats dates like the design', () => {
    expect(fmtToday('2026-08-02')).toBe('Sun, Aug 2')
    expect(fmtShort('2026-08-01')).toBe('Aug 1')
    expect(weekdayBadge('2026-07-31')).toBe('FRI')
    expect(weekdayBadge('2026-07-29')).toBe('WED')
  })

  it('computes day of year', () => {
    expect(dayOfYear('2026-01-01')).toBe(1)
    expect(dayOfYear('2026-08-02')).toBe(214)
    expect(dayOfYear('2026-12-31')).toBe(365)
  })

  it('auto-titles sessions by time and weekday', () => {
    expect(autoTitle(new Date(2026, 7, 3, 9, 0))).toBe('Morning class') // Mon 9am
    expect(autoTitle(new Date(2026, 7, 3, 13, 0))).toBe('Afternoon class')
    expect(autoTitle(new Date(2026, 7, 3, 19, 30))).toBe('Evening class')
    expect(autoTitle(new Date(2026, 7, 1, 11, 0))).toBe('Open mat') // Saturday
    expect(autoTitle(new Date(2026, 7, 2, 19, 0))).toBe('Open mat') // Sunday evening
  })
})
