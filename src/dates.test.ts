import { describe, expect, it } from 'vitest'
import { addDays, autoTitle, dayOfYear, fmtShort, fmtTime, fmtToday, mondayOf, parseIso, resolveWhen, toHhmm, toIso, weekdayBadge } from './dates'

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

describe('time helpers (session start picker)', () => {
  it('formats HH:MM as 12-hour clock', () => {
    expect(fmtTime('19:30')).toBe('7:30 PM')
    expect(fmtTime('09:05')).toBe('9:05 AM')
    expect(fmtTime('00:15')).toBe('12:15 AM')
    expect(fmtTime('12:00')).toBe('12:00 PM')
  })

  it('extracts local HH:MM from a Date', () => {
    expect(toHhmm(new Date(2026, 7, 26, 19, 30))).toBe('19:30')
    expect(toHhmm(new Date(2026, 7, 26, 7, 5))).toBe('07:05')
  })

  it('resolveWhen: null means now; a passed time means today', () => {
    const now = new Date(2026, 7, 26, 22, 0)
    expect(resolveWhen(now, null)).toBe(now)
    expect(resolveWhen(now, '19:30')).toEqual(new Date(2026, 7, 26, 19, 30))
  })

  it('resolveWhen: a not-yet-passed time means yesterday (morning-after logging)', () => {
    const morning = new Date(2026, 7, 26, 9, 0)
    expect(resolveWhen(morning, '19:30')).toEqual(new Date(2026, 7, 25, 19, 30))
  })

  it('resolveWhen: crosses month boundaries via day-overflow arithmetic', () => {
    expect(resolveWhen(new Date(2026, 8, 1, 7, 0), '20:30')).toEqual(new Date(2026, 7, 31, 20, 30))
  })
})
