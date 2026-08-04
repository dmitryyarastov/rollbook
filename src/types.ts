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
