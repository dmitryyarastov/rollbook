export type RoundMin = 4 | 5 | 6 | 8

export interface Session {
  id: string
  /** Local calendar date, `yyyy-mm-dd`. Never derived via toISOString(). */
  date: string
  createdAt: number
  /** Epoch ms of the last local edit; drives last-write-wins sync merges. */
  updatedAt: number
  title: string
  gi: boolean
  rolls: number
  subsFor: number
  subsAgainst: number
  roundMin: RoundMin
  tags: string[]
}

export type CompOutcome = 'win' | 'loss' | 'draw'
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
  workedWell: string
  didntWork: string
  matches: CompMatch[]
}

export interface FocusGoal {
  title: string
  /** Tag whose 30-day frequency drives the progress bar. Empty = no goal set. */
  tag: string
}

export interface Settings {
  weeklyGoal: number
  showMilestones: boolean
}

export interface AppData {
  sessions: Session[]
  competitions: Competition[]
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
  subsFor: number
  subsAgainst: number
  roundMin: RoundMin
  gi: boolean
  tags: string[]
}

export type LogMode = 'training' | 'comp'

export interface CompForm {
  name: string
  gi: boolean
  cardio: CardioRating
  workedWell: string
  didntWork: string
  matches: CompMatch[]
}
