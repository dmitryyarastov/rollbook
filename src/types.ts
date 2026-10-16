export type RoundMin = 4 | 5 | 6 | 8
/** Whole-session perceived intensity: 1 = easy, 5 = maximal. */
export type SessionIntensity = 1 | 2 | 3 | 4 | 5

export interface Session {
  id: string
  /** Local calendar date, `yyyy-mm-dd`. Never derived via toISOString(). */
  date: string
  createdAt: number
  /** Epoch ms of the last local edit; drives last-write-wins sync merges. */
  updatedAt: number
  title: string
  gi: boolean
  /** Free-sparring rounds. Round-based stats count rolls + specific together. */
  rolls: number
  /** Positional ("specific") sparring rounds, total; 0 on rows from before the split. */
  specific: number
  /**
   * Per-format breakdown of `specific` — the gym's 2+2-minute swap rounds
   * (each side plays both roles). Zero on rows from before the formats
   * existed; app-written rows keep specific === closed + mount + open.
   */
  specClosed: number
  specMount: number
  specOpen: number
  /** Submission counting retired from the UI 2026-10; kept for historical rows. */
  subsFor: number
  subsAgainst: number
  roundMin: RoundMin
  /** Whole class/open-mat duration in minutes; null on legacy rows. */
  durationMin: number | null
  /** Whole-session RPE on a 1–5 scale; null on legacy rows. */
  intensity: SessionIntensity | null
  tags: string[]
  /** Session start, local 'HH:MM' (24h); null on rows from before the picker. */
  time: string | null
}

export type CompOutcome = 'win' | 'loss' | 'draw'
export type Placement = 'none' | 'bronze' | 'silver' | 'gold'
/** 0 = unrated; 1 = fine … 5 = gassed. */
export type CardioRating = 0 | 1 | 2 | 3 | 4 | 5

export interface CompMatch {
  outcome: CompOutcome
  myPoints: number
  theirPoints: number
  /** Non-empty = the match ended by this submission (mine on a win, theirs on a loss). */
  submission: string
}

/** A competition entry — append-only per id, like Session (keeps blind upsert safe). */
export interface Competition {
  id: string
  /** Local calendar date, `yyyy-mm-dd`. Never derived via toISOString(). */
  date: string
  createdAt: number
  /** Epoch ms of the last local edit; drives last-write-wins sync merges. */
  updatedAt: number
  /** Resolved at save time: trimmed event name, or the default 'Competition'. */
  title: string
  gi: boolean
  cardio: CardioRating
  /** Podium finish for the event; 'none' = no medal (the default). */
  placement: Placement
  workedWell: string
  didntWork: string
  matches: CompMatch[]
  /** Techniques worked during the event — same tag vocabulary as sessions. */
  tags: string[]
}

export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'

/**
 * A rank event: "the rank became belt/stripes on this date". Append-only per
 * id like sessions — the current rank is the latest event, and a correction
 * (a mis-tap, a backdated stripe) is simply another event, never an edit.
 * Stripes are 0–4 on colored belts; on black they are degrees, 0–6.
 */
export interface Promotion {
  id: string
  /** Local calendar date, `yyyy-mm-dd`. Never derived via toISOString(). */
  date: string
  createdAt: number
  /** Epoch ms of the last local edit; drives last-write-wins sync merges. */
  updatedAt: number
  belt: Belt
  stripes: number
}

export interface FocusGoal {
  title: string
  /** Tag whose current-week frequency drives the progress bar. Empty = no goal set. */
  tag: string
}

export interface Settings {
  weeklyGoal: number
  showMilestones: boolean
}

export interface AppData {
  sessions: Session[]
  competitions: Competition[]
  promotions: Promotion[]
  tagList: string[]
  focus: FocusGoal
  settings: Settings
  /** Epoch ms of the last local focus/tagList/settings edit; 0 = never touched. */
  stateUpdatedAt: number
}

export type Tab = 'dash' | 'history' | 'log' | 'tech' | 'progress'
export type GiFilter = 'All' | 'Gi' | 'No-Gi'

export interface LogForm {
  rolls: number
  specClosed: number
  specMount: number
  specOpen: number
  roundMin: RoundMin
  /** Whole class/open-mat duration in minutes. */
  durationMin: number
  /** Whole-session RPE on a 1–5 scale. */
  intensity: SessionIntensity
  gi: boolean
  tags: string[]
  /** Picked start time 'HH:MM', or null = "now". */
  when: string | null
}

export type LogMode = 'training' | 'comp'

export interface CompForm {
  name: string
  gi: boolean
  cardio: CardioRating
  placement: Placement
  workedWell: string
  didntWork: string
  matches: CompMatch[]
  tags: string[]
}
