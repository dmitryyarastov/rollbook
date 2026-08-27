/**
 * Deterministic demo data, anchored to the runtime "today" so the dashboard
 * always shows a live-looking training history. Two layers:
 *
 * 1. An explicit showcase window (current week back to week −11) that
 *    reproduces the design handoff's dashboard through the real stats
 *    functions: week bars M4/W8/F6, an 11-week streak "since" ten weeks back,
 *    30-day window of 11 sessions with the focus tag in 7 (64%), subs 9/12,
 *    and the prototype's exact 12-week volume chart.
 * 2. PRNG filler (mulberry32, fixed seed) for the rest of the year, sized so
 *    the 500-round milestone reads "on pace for October" in early August.
 *
 * Loaded via `window.rollbook.seed()` — the app itself starts empty.
 */
import { addDays, mondayOf, parseIso } from './dates'
import { DEFAULT_TAGS, emptyData } from './store'
import type { AppData, Competition, RoundMin, Session } from './types'

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Spec {
  day: number // offset from the week's Monday, 0..6
  rolls: number
  gi: boolean
  dur: RoundMin
  title: string
  sf: number
  sa: number
  tags: string[]
}

const s = (day: number, rolls: number, gi: boolean, dur: RoundMin, title: string, sf: number, sa: number, tags: string[]): Spec => ({
  day, rolls, gi, dur, title, sf, sa, tags,
})

/** week offset (0 = current) → sessions. Weeks −3..0 are the 30-day showcase. */
const SHOWCASE: [number, Spec[]][] = [
  [0, [
    s(0, 4, true, 5, 'Morning class', 1, 1, ['De La Riva', 'Sweeps']),
    s(2, 8, false, 6, 'No-Gi open mat', 3, 4, ['Leg locks', 'Guard retention']),
    s(4, 6, true, 5, 'Evening class', 2, 1, ['Half guard', 'Kimura', 'Knee cut']),
  ]],
  [-1, [
    s(1, 3, true, 5, 'Drilling + rolls', 0, 1, ['Knee cut', 'Mount attacks']),
    s(3, 5, false, 5, 'Evening class', 1, 2, ['Half guard', 'Darce']),
    s(5, 7, true, 6, 'Competition training', 2, 3, ['Guard retention', 'Passing']),
  ]],
  [-2, [
    s(1, 6, true, 5, 'Evening class', 0, 0, ['Guard retention', 'Half guard', 'Kimura', 'Back takes']),
    s(3, 7, false, 6, 'No-Gi open mat', 0, 0, ['Guard retention', 'Half guard', 'Knee cut', 'De La Riva']),
    s(5, 4, true, 5, 'Open mat', 0, 0, ['Guard retention', 'Half guard', 'Knee cut', 'Escapes']),
  ]],
  [-3, [
    s(2, 6, true, 5, 'Morning class', 0, 0, ['Guard retention', 'Half guard', 'Kimura', 'De La Riva']),
    s(4, 7, false, 6, 'No-Gi open mat', 0, 0, ['Guard retention', 'Knee cut', 'Kimura', 'Sweeps']),
  ]],
  // Streak body: every week ≥ 2 sessions; weekly rolls match the prototype's
  // 12-week volume chart [12,15,10,18,14,9,16,20,13,17,15,18] (weeks −11..0).
  // Week −4 stays on Mon–Fri so nothing leaks into the 30-day window.
  [-4, [
    s(0, 7, true, 5, 'Morning class', 1, 2, ['Half guard', 'Sweeps']),
    s(2, 7, false, 6, 'No-Gi open mat', 2, 1, ['Leg locks', 'Escapes']),
    s(4, 6, true, 5, 'Evening class', 0, 1, ['Knee cut', 'Passing']),
  ]],
  [-5, [
    s(0, 6, true, 5, 'Evening class', 1, 1, ['Guard retention', 'Passing']),
    s(2, 5, true, 5, 'Morning class', 0, 2, ['De La Riva', 'Back takes']),
    s(4, 5, false, 6, 'No-Gi open mat', 2, 2, ['Leg locks', 'Darce']),
  ]],
  [-6, [
    s(2, 5, true, 6, 'Evening class', 1, 0, ['Kimura', 'Mount attacks']),
    s(5, 4, false, 5, 'Open mat', 0, 1, ['Half guard', 'Escapes']),
  ]],
  [-7, [
    s(1, 8, true, 5, 'Evening class', 2, 1, ['Guard retention', 'Knee cut']),
    s(3, 6, false, 6, 'No-Gi open mat', 1, 3, ['Leg locks', 'Back takes']),
  ]],
  [-8, [
    s(0, 7, true, 5, 'Morning class', 1, 1, ['Half guard', 'Kimura']),
    s(2, 6, true, 5, 'Evening class', 0, 0, ['De La Riva', 'Sweeps']),
    s(4, 5, false, 6, 'No-Gi open mat', 2, 2, ['Guard retention', 'Darce']),
  ]],
  [-9, [
    s(1, 6, true, 5, 'Evening class', 1, 2, ['Knee cut', 'Passing']),
    s(4, 4, false, 5, 'No-Gi open mat', 1, 0, ['Half guard', 'Leg locks']),
  ]],
  [-10, [
    s(1, 8, true, 5, 'Evening class', 2, 1, ['Guard retention', 'Sweeps']),
    s(3, 7, false, 6, 'No-Gi open mat', 1, 2, ['Half guard', 'Mount attacks']),
  ]],
  // Streak breaker: a single session caps the streak at exactly 11 weeks.
  [-11, [
    s(5, 12, true, 6, 'Competition training', 3, 2, ['Guard retention', 'Passing']),
  ]],
]

const FILLER_TAGS: string[][] = [
  ['Half guard', 'Sweeps'],
  ['Guard retention', 'Passing'],
  ['Knee cut', 'Mount attacks'],
  ['De La Riva', 'Back takes'],
  ['Leg locks', 'Escapes'],
  ['Kimura', 'Half guard'],
]

// Light weeks in the filler break any accidental 10-week streak before the
// showcase, so the "10-week streak" milestone dates to the showcase run.
const LIGHT_WEEKS: Record<number, number> = { [-27]: 1, [-20]: 0, [-13]: 1 }

export function demoData(todayIso: string): AppData {
  const curMon = mondayOf(todayIso)
  const jan1 = `${todayIso.slice(0, 4)}-01-01`
  const rng = mulberry32(20260802)
  const specs: { date: string; spec: Spec }[] = []

  for (const [week, list] of SHOWCASE) {
    for (const spec of list) specs.push({ date: addDays(curMon, week * 7 + spec.day), spec })
  }

  for (let week = -12; week >= -30; week--) {
    const mon = addDays(curMon, week * 7)
    if (mon < jan1) break
    const count = LIGHT_WEEKS[week] ?? 2
    const days = [0, 1, 2, 3, 4, 5].sort(() => rng() - 0.5).slice(0, count).sort((a, b) => a - b)
    for (const day of days) {
      const gi = rng() < 0.65
      specs.push({
        date: addDays(mon, day),
        spec: s(
          day,
          5 + Math.floor(rng() * 3),
          gi,
          rng() < 0.6 ? 5 : 6,
          !gi ? 'No-Gi open mat' : day === 5 ? 'Open mat' : rng() < 0.4 ? 'Morning class' : 'Evening class',
          Math.floor(rng() * 3),
          Math.floor(rng() * 3),
          FILLER_TAGS[(Math.abs(week) * 2 + day) % FILLER_TAGS.length],
        ),
      })
    }
  }

  const sessions: Session[] = specs
    .filter(({ date }) => date <= todayIso && date >= jan1)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date, spec }, i) => ({
      id: `demo-${i}`,
      date,
      createdAt: parseIso(date).getTime() + 18 * 3600_000 + i,
      updatedAt: parseIso(date).getTime() + 18 * 3600_000 + i,
      title: spec.title,
      gi: spec.gi,
      rolls: spec.rolls,
      subsFor: spec.sf,
      subsAgainst: spec.sa,
      roundMin: spec.dur,
      tags: spec.tags,
    }))

  // Two showcase competitions (Saturdays 2 and 6 weeks back — always in the
  // past, but the same year-boundary guard as sessions). demo- ids never sync.
  const comp = (
    i: number,
    date: string,
    over: Omit<Competition, 'id' | 'date' | 'createdAt' | 'updatedAt'>,
  ): Competition => ({
    id: `demo-comp-${i}`,
    date,
    createdAt: parseIso(date).getTime() + 10 * 3600_000 + i,
    updatedAt: parseIso(date).getTime() + 10 * 3600_000 + i,
    ...over,
  })
  const competitions: Competition[] = [
    comp(0, addDays(curMon, -2 * 7 + 5), {
      title: 'Regional Open',
      gi: true,
      cardio: 4,
      workedWell: 'Grips and top pressure held up.',
      didntWork: 'Gassed badly in match three.',
      matches: [
        { outcome: 'win', myPoints: 4, theirPoints: 2, submission: '' },
        { outcome: 'win', myPoints: 0, theirPoints: 0, submission: 'Armbar' },
        { outcome: 'loss', myPoints: 2, theirPoints: 5, submission: '' },
      ],
    }),
    comp(1, addDays(curMon, -6 * 7 + 5), {
      title: 'Competition',
      gi: false,
      cardio: 2,
      workedWell: 'Wrestling up from butterfly.',
      didntWork: 'Got caught extending in scrambles.',
      matches: [
        { outcome: 'win', myPoints: 6, theirPoints: 0, submission: '' },
        { outcome: 'loss', myPoints: 0, theirPoints: 0, submission: 'Heel hook' },
      ],
    }),
  ].filter((c) => c.date <= todayIso && c.date >= jan1)

  return {
    ...emptyData(),
    sessions,
    competitions,
    tagList: [...DEFAULT_TAGS],
    focus: { title: 'Guard retention under pressure', tag: 'Guard retention' },
  }
}
