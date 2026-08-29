/**
 * Derived stats — every number on screen comes from the stored sessions
 * through these pure functions. All take `todayIso` explicitly so tests are
 * timezone- and clock-proof. Weeks run Monday–Sunday.
 */
import type { Competition, Session } from './types'
import { isOpenGuardTag } from './curriculum'
import { addDays, dayOfYear, fmtShort, mondayOf, monthFull } from './dates'

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

function sessionsByWeek(sessions: Session[]): Map<string, Session[]> {
  const m = new Map<string, Session[]>()
  for (const s of sessions) {
    const k = mondayOf(s.date)
    const list = m.get(k)
    if (list) list.push(s)
    else m.set(k, [s])
  }
  return m
}

export interface Streak {
  weeks: number
  /** Monday of the earliest week in the streak; null when weeks = 0. */
  sinceIso: string | null
}

/**
 * Consecutive weeks whose sessions satisfy `qualifies`, walking back from
 * last week — plus the current week once it already qualifies. An unfinished
 * current week never breaks the streak. The shared walk behind every flame
 * on the Progress screen.
 */
export function weeklyStreak(
  sessions: Session[],
  todayIso: string,
  qualifies: (week: Session[]) => boolean,
): Streak {
  const byWeek = sessionsByWeek(sessions)
  const curMon = mondayOf(todayIso)
  // Bounded at the earliest logged week: a predicate that accepts an empty
  // week (e.g. a tampered weeklyGoal of 0) must not walk the calendar
  // forever. Legit predicates all reject empty weeks, so the bound never
  // shortens a real streak.
  let earliest = curMon
  for (const k of byWeek.keys()) if (k < earliest) earliest = k
  let weeks = 0
  let sinceIso: string | null = null
  if (qualifies(byWeek.get(curMon) ?? [])) {
    weeks++
    sinceIso = curMon
  }
  let w = addDays(curMon, -7)
  while (w >= earliest && qualifies(byWeek.get(w) ?? [])) {
    weeks++
    sinceIso = w
    w = addDays(w, -7)
  }
  return { weeks, sinceIso }
}

/** Consecutive weeks with at least `goal` sessions (the original streak). */
export function streak(sessions: Session[], goal: number, todayIso: string): Streak {
  return weeklyStreak(sessions, todayIso, (week) => week.length >= goal)
}

/** Consecutive weeks with at least one gi AND one no-gi session. */
export function giNoGiStreak(sessions: Session[], todayIso: string): Streak {
  return weeklyStreak(sessions, todayIso, (week) => week.some((s) => s.gi) && week.some((s) => !s.gi))
}

/** Consecutive weeks with at least one session tagged the focus tag. */
export function focusStreak(sessions: Session[], focusTag: string, todayIso: string): Streak {
  if (!focusTag) return { weeks: 0, sinceIso: null }
  return weeklyStreak(sessions, todayIso, (week) => week.some((s) => s.tags.includes(focusTag)))
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

/**
 * Recalibrated 2026-08-30 from live data ("plan the most easily fulfillable"):
 * 40 rolls logged at ~11.2/week with 17.6 weeks left projected ~237 by Dec 31
 * on current pace, ~251 on the new two-classes-per-evening schedule. 250 is
 * the honest reachable target; the original 500 needed a fantasy 28/week.
 */
const YEAR_TARGET = 250

const PLACEMENT_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', none: '' } as const

const byDateAsc = <T extends { date: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

/**
 * Goal: podium at AJP World Pro Amateurs. Achieved by the earliest
 * competition whose title mentions AJP and carries a placement — a medal at
 * a non-AJP comp shows on its own row but does not complete this goal.
 */
export function medalMilestone(competitions: Competition[]): Milestone {
  const title = 'Medal at AJP World Pro Ams'
  const hit = byDateAsc(competitions).find((c) => /ajp/i.test(c.title) && c.placement !== 'none')
  if (hit) return { achieved: true, title, sub: `${PLACEMENT_LABEL[hit.placement]} at ${hit.title} — ${fmtShort(hit.date)}` }
  return { achieved: false, title, sub: 'No AJP podium yet' }
}

/**
 * Goal: play open guard in competition. Achieved by the earliest competition
 * tagged with any open-guard-family tag (see curriculum.ts — isOpenGuardTag).
 */
export function openGuardMilestone(competitions: Competition[]): Milestone {
  const title = 'Open guard in competition'
  for (const c of byDateAsc(competitions)) {
    const tag = c.tags.find(isOpenGuardTag)
    if (tag) return { achieved: true, title, sub: `${tag} at ${c.title} — ${fmtShort(c.date)}` }
  }
  return { achieved: false, title, sub: 'Play it, then tag it on the comp entry' }
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

export function milestones(sessions: Session[], competitions: Competition[], todayIso: string): Milestone[] {
  return [medalMilestone(competitions), openGuardMilestone(competitions), yearMilestone(sessions, todayIso)]
}
