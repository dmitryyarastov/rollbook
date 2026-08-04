export type RoundMin = 4 | 5 | 6 | 8

export interface Session {
  id: string
  /** Local calendar date, `yyyy-mm-dd`. Never derived via toISOString(). */
  date: string
  createdAt: number
  title: string
  gi: boolean
  rolls: number
  subsFor: number
  subsAgainst: number
  roundMin: RoundMin
  tags: string[]
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
  tagList: string[]
  focus: FocusGoal
  settings: Settings
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
