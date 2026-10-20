/**
 * The gym's specific-training formats: 2+2-minute positional swap rounds,
 * each partner playing both roles at full resistance. This list is the single
 * source for the Log steppers, the history-row captions and the breakdown
 * sum. Adding a format = an entry here + the Session/LogForm field
 * (types.ts), the sync column (sync.ts) and an SQL addendum.
 */
import type { Session } from './types'

export type SpecKey = 'specClosed' | 'specOpen' | 'specSide' | 'specMount' | 'specBack' | 'specTurtle'

export interface SpecFormat {
  key: SpecKey
  /** Log-form row label. */
  label: string
  /** Expanded history-row caption (micro caps). */
  short: string
}

/** Curriculum order — guard, then the pins, then back and turtle (same as tag ordering). */
export const SPEC_FORMATS: readonly SpecFormat[] = [
  { key: 'specClosed', label: 'Closed guard', short: 'CLOSED GD' },
  { key: 'specOpen', label: 'Open guard', short: 'OPEN GD' },
  { key: 'specSide', label: 'Side control', short: 'SIDE' },
  { key: 'specMount', label: 'Mount', short: 'MOUNT' },
  { key: 'specBack', label: 'Back control', short: 'BACK' },
  { key: 'specTurtle', label: 'Turtle', short: 'TURTLE' },
]

/** Typed rounds across every format. App-written rows keep this equal to `specific`. */
export const specBreakdownSum = (s: Pick<Session, SpecKey>): number =>
  SPEC_FORMATS.reduce((sum, f) => sum + s[f.key], 0)
