/**
 * Derived stats — every number on screen comes from the stored sessions
 * through these pure functions. All take `todayIso` explicitly so tests are
 * timezone- and clock-proof. Weeks run Monday–Sunday.
 */
import type { Competition, Session } from './types'
import { addDays, dayOfYear, fmtShort, mondayOf, monthFull, parseIso } from './dates'

export const sessionMinutes = (s: Session) => s.rolls * s.roundMin
export const sessionHours = (s: Session) => sessionMinutes(s) / 60

/** '3.2' below 10, '86' at 10 and above (matches the design's renderings). */
export function formatHours(h: number): string {
  return h < 10 ? (Math.round(h * 10) / 10).toString() : Math.round(h).toString()
}

export function sortByDateDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
}

export type HistoryEntry = { kind: 'session'; item: Session } | { kind: 'comp'; item: Competition }

/**
 * Sessions and competitions interleaved for history rendering, newest first:
 * date desc, then createdAt desc; an exact tie puts the competition first
 * (the headline event of the day — and determinism for tests).
 */
export function historyFeed(sessions: Session[], competitions: Competition[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    ...sessions.map((item): HistoryEntry => ({ kind: 'session', item })),
    ...competitions.map((item): HistoryEntry => ({ kind: 'comp', item })),
  ]
  return entries.sort(
    (a, b) =>
      (a.item.date === b.item.date ? 0 : a.item.date < b.item.date ? 1 : -1) ||
      b.item.createdAt - a.item.createdAt ||
      (a.kind === b.kind ? 0 : a.kind === 'comp' ? -1 : 1),
  )
}

function sortByDateAsc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
}

/** Sessions in the 30-day window ending today (inclusive). */
export function last30d(sessions: Session[], todayIso: string): Session[] {
  const from = addDays(todayIso, -29)
  return sessions.filter((s) => s.date >= from && s.date <= todayIso)
}

// ── This week ────────────────────────────────────────────────────────────────

export interface WeekSummary {
  rolls: number
  hours: number
  sessions: number
  /** Mon..Sun */
  bars: { day: string; rolls: number }[]
}

export function weekSummary(sessions: Session[], todayIso: string): WeekSummary {
  const mon = mondayOf(todayIso)
  const sun = addDays(mon, 6)
  const inWeek = sessions.filter((s) => s.date >= mon && s.date <= sun)
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const bars = dayLetters.map((day, i) => {
    const date = addDays(mon, i)
    return { day, rolls: inWeek.filter((s) => s.date === date).reduce((a, s) => a + s.rolls, 0) }
  })
  return {
    rolls: inWeek.reduce((a, s) => a + s.rolls, 0),
    hours: inWeek.reduce((a, s) => a + sessionHours(s), 0),
    sessions: inWeek.length,
    bars,
  }
}

// ── Streak ───────────────────────────────────────────────────────────────────

function sessionsPerWeek(sessions: Session[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    const k = mondayOf(s.date)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export interface Streak {
  weeks: number
  /** Monday of the earliest week in the streak; null when weeks = 0. */
  sinceIso: string | null
}

/**
 * Consecutive fully-elapsed weeks meeting `goal`, walking back from last
 * week — plus the current week once it already qualifies. An unfinished
 * current week never breaks the streak.
 */
export function streak(sessions: Session[], goal: number, todayIso: string): Streak {
  const perWeek = sessionsPerWeek(sessions)
  const curMon = mondayOf(todayIso)
  let weeks = 0
  let sinceIso: string | null = null
  if ((perWeek.get(curMon) ?? 0) >= goal) {
    weeks++
    sinceIso = curMon
  }
  let w = addDays(curMon, -7)
  while ((perWeek.get(w) ?? 0) >= goal) {
    weeks++
    sinceIso = w
    w = addDays(w, -7)
  }
  return { weeks, sinceIso }
}

// ── 30-day aggregates ────────────────────────────────────────────────────────

export function subs30d(sessions: Session[], todayIso: string): { subsFor: number; subsAgainst: number } {
  const pool = last30d(sessions, todayIso)
  return {
    subsFor: pool.reduce((a, s) => a + s.subsFor, 0),
    subsAgainst: pool.reduce((a, s) => a + s.subsAgainst, 0),
  }
}

/** Tag usage in the last 30 days, most-used first (name tiebreak). */
export function tagCounts30d(sessions: Session[], todayIso: string): { name: string; n: number }[] {
  const m = new Map<string, number>()
  for (const s of last30d(sessions, todayIso)) {
    for (const t of s.tags) m.set(t, (m.get(t) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

/**
 * Master tag list plus any tag referenced by a session but missing from it —
 * a tag you've logged with must always stay toggleable, even if list edits
 * on another device raced and dropped it (blob-level state sync).
 */
export function withSessionTags(tagList: string[], sessions: Session[]): string[] {
  const known = new Set(tagList)
  const out = [...tagList]
  for (const s of sessions) {
    for (const t of s.tags) {
      if (!known.has(t)) {
        known.add(t)
        out.push(t)
      }
    }
  }
  return out.length === tagList.length ? tagList : out
}

export interface FocusProgress {
  pct: number
  tagged: number
  total: number
}

export function focusProgress(sessions: Session[], focusTag: string, todayIso: string): FocusProgress {
  const pool = focusTag ? last30d(sessions, todayIso) : []
  const tagged = pool.filter((s) => s.tags.includes(focusTag)).length
  return { pct: pool.length ? Math.round((100 * tagged) / pool.length) : 0, tagged, total: pool.length }
}

// ── Longer horizons ──────────────────────────────────────────────────────────

/** Rounds per week for the 12 weeks ending with the current one (oldest first). */
export function volume12w(sessions: Session[], todayIso: string): number[] {
  const curMon = mondayOf(todayIso)
  return Array.from({ length: 12 }, (_, i) => {
    const mon = addDays(curMon, (i - 11) * 7)
    const end = addDays(mon, 6)
    return sessions.filter((s) => s.date >= mon && s.date <= end).reduce((a, s) => a + s.rolls, 0)
  })
}

export function yearTotals(sessions: Session[], todayIso: string): { hours: number; rolls: number } {
  const year = todayIso.slice(0, 4)
  const pool = sessions.filter((s) => s.date.startsWith(year))
  return {
    hours: pool.reduce((a, s) => a + sessionHours(s), 0),
    rolls: pool.reduce((a, s) => a + s.rolls, 0),
  }
}

// ── Milestones ───────────────────────────────────────────────────────────────

export interface Milestone {
  achieved: boolean
  title: string
  sub: string
}

const QUARTER_TARGET = 100
const STREAK_TARGET = 10
const YEAR_TARGET = 500

function quarterKey(iso: string): string {
  const d = parseIso(iso)
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`
}

/** 100 rounds inside one calendar quarter; sub = most recent crossing date. */
export function quarterMilestone(sessions: Session[], todayIso: string): Milestone {
  const title = `${QUARTER_TARGET} rounds in a quarter`
  const running = new Map<string, number>()
  let hitIso: string | null = null
  for (const s of sortByDateAsc(sessions)) {
    const q = quarterKey(s.date)
    const prev = running.get(q) ?? 0
    running.set(q, prev + s.rolls)
    if (prev < QUARTER_TARGET && prev + s.rolls >= QUARTER_TARGET) hitIso = s.date
  }
  if (hitIso) return { achieved: true, title, sub: `Hit ${fmtShort(hitIso)}` }
  const now = running.get(quarterKey(todayIso)) ?? 0
  return { achieved: false, title, sub: `${now} / ${QUARTER_TARGET} this quarter` }
}

/**
 * Ten consecutive completed weeks meeting `goal`. Achieved the Monday after
 * the 10th week wraps (the display streak may count an in-progress week; a
 * milestone only counts finished ones).
 */
export function streakMilestone(sessions: Session[], goal: number, todayIso: string): Milestone {
  const title = `${STREAK_TARGET}-week streak`
  const perWeek = sessionsPerWeek(sessions)
  const weeks = [...perWeek.keys()].sort()
  let run = 0
  if (weeks.length > 0) {
    const lastCompletedMon = addDays(mondayOf(todayIso), -7)
    for (let w = weeks[0]; w <= lastCompletedMon; w = addDays(w, 7)) {
      run = (perWeek.get(w) ?? 0) >= goal ? run + 1 : 0
      if (run === STREAK_TARGET) return { achieved: true, title, sub: `Hit ${fmtShort(addDays(w, 7))}` }
    }
  }
  // `run` is now the trailing completed-weeks run — the honest progress figure.
  return { achieved: false, title, sub: `${run} / ${STREAK_TARGET} weeks` }
}

/** 500 rounds in the calendar year; in progress shows a linear pace month. */
export function yearMilestone(sessions: Session[], todayIso: string): Milestone {
  const title = `${YEAR_TARGET} rounds this year`
  const year = todayIso.slice(0, 4)
  let cum = 0
  for (const s of sortByDateAsc(sessions)) {
    if (!s.date.startsWith(year)) continue
    if (cum < YEAR_TARGET && cum + s.rolls >= YEAR_TARGET) return { achieved: true, title, sub: `Hit ${fmtShort(s.date)}` }
    cum += s.rolls
  }
  let sub = `${cum} / ${YEAR_TARGET}`
  if (cum > 0) {
    const doy = dayOfYear(todayIso)
    const crossingDoy = Math.ceil((doy * YEAR_TARGET) / cum)
    if (crossingDoy <= 365) {
      const crossing = new Date(Number(year), 0, crossingDoy)
      sub += ` — on pace for ${monthFull(crossing.getMonth())}`
    }
  }
  return { achieved: false, title, sub }
}

export function milestones(sessions: Session[], goal: number, todayIso: string): Milestone[] {
  return [
    quarterMilestone(sessions, todayIso),
    streakMilestone(sessions, goal, todayIso),
    yearMilestone(sessions, todayIso),
  ]
}
