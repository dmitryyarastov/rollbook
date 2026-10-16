/**
 * Belt rank — the one character attribute that is awarded, not derived.
 * Ranks are stored as append-only Promotion events; everything here is a
 * pure function over that event list (no clock reads: the caller supplies
 * dates). The ladder is the standard adult system: white → blue → purple →
 * brown with 0–4 stripes each, then black with degrees 0–6.
 */
import type { Belt, Promotion } from './types'

export const BELTS: readonly Belt[] = ['white', 'blue', 'purple', 'brown', 'black']

export const BELT_LABEL: Record<Belt, string> = {
  white: 'White belt',
  blue: 'Blue belt',
  purple: 'Purple belt',
  brown: 'Brown belt',
  black: 'Black belt',
}

/** Stripes on colored belts; degrees on black. */
export const maxStripes = (belt: Belt): number => (belt === 'black' ? 6 : 4)

export interface Rank {
  belt: Belt
  stripes: number
}

export const isValidRank = (r: Rank): boolean =>
  BELTS.includes(r.belt) && Number.isInteger(r.stripes) && r.stripes >= 0 && r.stripes <= maxStripes(r.belt)

/** The next rung: one more stripe, or the next belt at 0 stripes. null at the top (black, 6th degree). */
export function nextRank(r: Rank): Rank | null {
  if (r.stripes < maxStripes(r.belt)) return { belt: r.belt, stripes: r.stripes + 1 }
  const i = BELTS.indexOf(r.belt)
  return i < BELTS.length - 1 ? { belt: BELTS[i + 1], stripes: 0 } : null
}

const ordinal = (n: number): string => {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

/** 'White belt · 4 stripes', 'Blue belt', 'Black belt · 2nd degree'. */
export function rankLabel(r: Rank): string {
  if (r.stripes === 0) return BELT_LABEL[r.belt]
  if (r.belt === 'black') return `${BELT_LABEL.black} · ${ordinal(r.stripes)} degree`
  return `${BELT_LABEL[r.belt]} · ${r.stripes} ${r.stripes === 1 ? 'stripe' : 'stripes'}`
}

/** What the next promotion is called on the button: 'Add 1st stripe', 'Promote to blue belt', 'Award 1st degree'. */
export function promotionLabel(from: Rank, to: Rank): string {
  if (to.belt !== from.belt) return `Promote to ${BELT_LABEL[to.belt].toLowerCase()}`
  return to.belt === 'black' ? `Award ${ordinal(to.stripes)} degree` : `Add ${ordinal(to.stripes)} stripe`
}

/** Events oldest → newest: by date, then createdAt. The raw log, not the timeline. */
export function promotionsAsc(promotions: Promotion[]): Promotion[] {
  return [...promotions].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
  )
}

/** Total order on the ladder — higher is more senior. */
export const rankOrder = (r: Rank): number => BELTS.indexOf(r.belt) * 10 + r.stripes

export interface RankEntry extends Rank {
  /** First day of this run of the same rank. */
  sinceIso: string
}

/** The event in effect for one day: the latest-created; id breaks exact ties so every device agrees. */
function dayWinners(promotions: Promotion[], todayIso: string): Promotion[] {
  const byDate = new Map<string, Promotion>()
  for (const p of promotions) {
    if (p.date > todayIso) continue
    const cur = byDate.get(p.date)
    if (!cur || p.createdAt > cur.createdAt || (p.createdAt === cur.createdAt && p.id > cur.id)) byDate.set(p.date, p)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * The effective rank history, oldest → newest. Three rules turn the raw,
 * append-only event log into it:
 * 1. Per date, only the latest-created event counts — a same-day entry
 *    REPLACES that day's earlier one. This is how mistakes are corrected:
 *    re-enter the mistaken day (Undo does exactly that), and the mistake drops
 *    out of the timeline instead of following it.
 * 2. Events dated after today are ignored until their date arrives, so a
 *    typo'd or tampered future date can never pin the rank.
 * 3. Consecutive days at the same rank collapse into one entry dated at the
 *    first, so a backdated duplicate moves "since" back instead of resetting it.
 */
export function rankTimeline(promotions: Promotion[], todayIso: string): RankEntry[] {
  const out: RankEntry[] = []
  for (const p of dayWinners(promotions, todayIso)) {
    const last = out[out.length - 1]
    if (last && last.belt === p.belt && last.stripes === p.stripes) continue
    out.push({ belt: p.belt, stripes: p.stripes, sinceIso: p.date })
  }
  return out
}

export interface CurrentRank extends Rank {
  /** First day of the current rank. */
  sinceIso: string
  /** First day of the current belt (any stripes). */
  beltSinceIso: string
}

export function currentRank(promotions: Promotion[], todayIso: string): CurrentRank | null {
  const timeline = rankTimeline(promotions, todayIso)
  const last = timeline[timeline.length - 1]
  if (!last) return null
  let beltSinceIso = last.sinceIso
  for (let i = timeline.length - 2; i >= 0 && timeline[i].belt === last.belt; i--) beltSinceIso = timeline[i].sinceIso
  return { belt: last.belt, stripes: last.stripes, sinceIso: last.sinceIso, beltSinceIso }
}

/**
 * What "Undo promotion" would append: the rank in effect before the latest
 * day's entry, dated that same day — so by rule 1 it replaces the promotion
 * however many days later the undo happens. Offered only when the latest
 * change moved UP the ladder, so undoing never turns into a redo toggle.
 */
export function undoTarget(promotions: Promotion[], todayIso: string): { rank: Rank; dateIso: string } | null {
  const winners = dayWinners(promotions, todayIso)
  const latest = winners[winners.length - 1]
  if (!latest) return null
  const before = currentRank(
    promotions.filter((p) => p.id !== latest.id),
    todayIso,
  )
  if (!before || rankOrder(before) >= rankOrder(latest)) return null
  return { rank: { belt: before.belt, stripes: before.stripes }, dateIso: latest.date }
}

/** A date the editor may save: real yyyy-mm-dd, not in the future. */
export const isPromotionDate = (iso: string, todayIso: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso <= todayIso
