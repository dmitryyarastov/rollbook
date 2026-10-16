/**
 * The XP system — character level, daily XP, and the six lifelong
 * characteristics. Everything here is a pure derivation from logged history
 * (sessions + competitions): no stored XP, no sync, nothing to migrate.
 * Formulas are arbitrary by nature; they are pinned by xp.test.ts and
 * documented in docs/stats.md — change them deliberately, never casually,
 * because levels silently recompute across the whole journey.
 */
import { groupOfTag } from './curriculum'
import { sessionRounds } from './stats'
import type { Competition, Session } from './types'

// ── XP formulas ──────────────────────────────────────────────────────────────

/** 20 per session + 5 per round (free + specific): a 2-round class = 30. */
export const sessionXp = (s: Session): number => 20 + 5 * sessionRounds(s)

const MEDAL_XP = { none: 0, bronze: 200, silver: 350, gold: 600 } as const

/** 150 per comp + 40 per match + 60 per win + podium bonus. */
export function compXp(c: Competition): number {
  const wins = c.matches.filter((m) => m.outcome === 'win').length
  return 150 + 40 * c.matches.length + 60 * wins + MEDAL_XP[c.placement]
}

export function totalXp(sessions: Session[], competitions: Competition[]): number {
  return (
    sessions.reduce((a, s) => a + sessionXp(s), 0) + competitions.reduce((a, c) => a + compXp(c), 0)
  )
}

// ── Level curve ──────────────────────────────────────────────────────────────

export interface LevelState {
  level: number
  /** XP accumulated inside the current level. */
  into: number
  /** XP needed to clear the current level. */
  need: number
}

/**
 * Linearly growing level costs: clearing level n costs `base + step·(n−1)`.
 * Character levels use 100/50; characteristics use 50/25 (faster early levels
 * keep the six attributes feeling alive at one-tag-per-session rates).
 */
export function levelFromXp(xp: number, base: number, step: number): LevelState {
  let level = 1
  // Non-finite XP (a corrupted local blob) must not spin the loop forever.
  let rest = Number.isFinite(xp) ? Math.max(0, xp) : 0
  let cost = base
  while (rest >= cost) {
    rest -= cost
    level++
    cost = base + step * (level - 1)
  }
  return { level, into: rest, need: cost }
}

export const characterLevel = (xp: number): LevelState => levelFromXp(xp, 100, 50)
const characteristicLevel = (xp: number): LevelState => levelFromXp(xp, 50, 25)

// ── Daily XP (tiles + year chart) ────────────────────────────────────────────

export interface YearXp {
  /** XP per day, Jan 1 .. Dec 31 of todayIso's year (365/366 entries). */
  byDay: number[]
  today: number
  year: number
  bestDay: number
  /** Year XP ÷ days elapsed (rounded); 0 before any XP. */
  avgPerDay: number
}

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const jan1 = new Date(y, 0, 1)
  return Math.round((new Date(y, m - 1, d).getTime() - jan1.getTime()) / 86400000)
}

export function yearXp(sessions: Session[], competitions: Competition[], todayIso: string): YearXp {
  const year = todayIso.slice(0, 4)
  const days = dayIndex(`${year}-12-31`) + 1
  const byDay = new Array<number>(days).fill(0)
  for (const s of sessions) if (s.date.startsWith(year)) byDay[dayIndex(s.date)] += sessionXp(s)
  for (const c of competitions) if (c.date.startsWith(year)) byDay[dayIndex(c.date)] += compXp(c)
  const todayIdx = dayIndex(todayIso)
  const total = byDay.reduce((a, b) => a + b, 0)
  return {
    byDay,
    today: byDay[todayIdx],
    year: total,
    bestDay: Math.max(...byDay),
    avgPerDay: total > 0 ? Math.round(total / (todayIdx + 1)) : 0,
  }
}

// ── Characteristics (the lifelong attribute sheet) ───────────────────────────

/**
 * Explicit top-position whitelist: pins and back control worked FROM TOP.
 * Escapes and guard recovery live under the side/mount/back curriculum groups
 * but are bottom work — deliberately absent here.
 */
const TOP_CONTROL_TAGS = new Set([
  'side control',
  'north south',
  'north-south',
  'kesa gatame',
  'americana',
  'paper cutter',
  'crossface',
  'mount',
  'mount attacks',
  'technical mount',
  'knee on belly',
  'kob',
  'ezekiel',
  's-mount',
  'cross collar choke',
  'back takes',
  'back control',
  'back attacks',
  'rnc',
  'rear naked choke',
  'bow and arrow',
  'seatbelt',
  'clock choke',
  'crucifix',
  'front headlock',
  'darce',
  "d'arce",
  'anaconda',
  'cow catcher',
  // 2026-10 vocabulary harvest — unambiguous top-position work only (buggy
  // choke, ghost/running escapes, turtle bottom etc. are bottom work and
  // deliberately absent).
  'scarf hold',
  'scarf hold control',
  'reverse kesa gatame',
  'reverse kesa',
  'reverse scarf hold',
  'north south choke',
  'north-south choke',
  'bread cutter',
  'bread cutter choke',
  'arm triangle',
  'head and arm choke',
  'kata gatame',
  'mounted triangle',
  'triangle from mount',
  'baseball bat choke',
  'baseball choke',
  'gift wrap',
  'giftwrap',
  'monoplata',
  'body triangle',
  'rear mount',
  'back mount',
  'straight jacket',
  'straitjacket',
  'straight jacket system',
  'rear triangle',
  'back triangle',
  'peruvian necktie',
  'japanese necktie',
  'turtle attacks',
  'turtle top',
])

const RETENTION_TAGS = new Set(['guard retention', 'retention', 'guard recovery', 'granby roll', 'granby'])

const norm = (tag: string) => tag.trim().toLowerCase()

export interface Characteristic {
  id: string
  label: string
  /** Does this tag (in a gi/no-gi context) feed the attribute? */
  matches: (tag: string, gi: boolean) => boolean
  /**
   * Does the session's typed specific work feed it? Each 2+2 swap round
   * works both sides: guard formats train passing AND retention; the mount
   * format trains top control (the escape side has no attribute).
   */
  matchesSpecific?: (s: Session) => boolean
}

/**
 * The fixed, lifelong attribute set — chosen by Dmitrii as the axes he wants
 * to upgrade across his whole BJJ journey. The SET is stable by design (an
 * RPG character sheet, not a tag cloud); only its tag matchers may grow.
 */
const guardSpecific = (s: Session) => s.specClosed > 0 || s.specOpen > 0

export const CHARACTERISTICS: Characteristic[] = [
  {
    id: 'passing',
    label: 'Passing',
    matches: (t) => groupOfTag(t) === 'passing',
    matchesSpecific: guardSpecific,
  },
  {
    id: 'retention',
    label: 'Guard retention',
    matches: (t) => RETENTION_TAGS.has(norm(t)),
    matchesSpecific: guardSpecific,
  },
  { id: 'takedowns-gi', label: 'Takedowns · Gi', matches: (t, gi) => gi && groupOfTag(t) === 'standing' },
  { id: 'wrestling-nogi', label: 'Wrestling · No-Gi', matches: (t, gi) => !gi && groupOfTag(t) === 'standing' },
  { id: 'leglocks', label: 'Leg locks', matches: (t) => groupOfTag(t) === 'legs' },
  {
    id: 'top-control',
    label: 'Top control',
    matches: (t) => TOP_CONTROL_TAGS.has(norm(t)),
    matchesSpecific: (s) => s.specMount > 0,
  },
]

const SESSION_CHAR_XP = 25

/** Qualifying training sessions still needed to clear a characteristic's current level. */
export const sessionsToNext = (c: LevelState): number => Math.ceil((c.need - c.into) / SESSION_CHAR_XP)
const COMP_CHAR_XP = 60

export interface CharacteristicState extends LevelState {
  id: string
  label: string
  xp: number
}

/**
 * 25 XP per session (60 per competition) whose tags touch the attribute —
 * flat per entry, so tag-spamming a single session can't grind an attribute.
 */
export function characteristics(sessions: Session[], competitions: Competition[]): CharacteristicState[] {
  return CHARACTERISTICS.map((c) => {
    let xp = 0
    for (const s of sessions)
      if (s.tags.some((t) => c.matches(t, s.gi)) || (c.matchesSpecific?.(s) ?? false)) xp += SESSION_CHAR_XP
    for (const k of competitions) if (k.tags.some((t) => c.matches(t, k.gi))) xp += COMP_CHAR_XP
    return { id: c.id, label: c.label, xp, ...characteristicLevel(xp) }
  })
}
