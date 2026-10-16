import { describe, expect, it } from 'vitest'
import {
  currentRank,
  isPromotionDate,
  isValidRank,
  maxStripes,
  nextRank,
  promotionLabel,
  promotionsAsc,
  rankLabel,
  rankTimeline,
  undoTarget,
} from './belts'
import type { Promotion } from './types'

let seq = 0
function mkP(date: string, belt: Promotion['belt'], stripes: number, extra: Partial<Promotion> = {}): Promotion {
  seq++
  return { id: `p${seq}`, date, createdAt: seq, updatedAt: seq, belt, stripes, ...extra }
}

describe('the ladder', () => {
  it('colored belts take 4 stripes, black takes 6 degrees', () => {
    expect(maxStripes('white')).toBe(4)
    expect(maxStripes('brown')).toBe(4)
    expect(maxStripes('black')).toBe(6)
  })

  it('nextRank adds a stripe, then promotes to the next belt at 0', () => {
    expect(nextRank({ belt: 'white', stripes: 3 })).toEqual({ belt: 'white', stripes: 4 })
    expect(nextRank({ belt: 'white', stripes: 4 })).toEqual({ belt: 'blue', stripes: 0 })
    expect(nextRank({ belt: 'brown', stripes: 4 })).toEqual({ belt: 'black', stripes: 0 })
    expect(nextRank({ belt: 'black', stripes: 5 })).toEqual({ belt: 'black', stripes: 6 })
    expect(nextRank({ belt: 'black', stripes: 6 })).toBeNull()
  })

  it('validates ranks against the per-belt stripe cap', () => {
    expect(isValidRank({ belt: 'white', stripes: 4 })).toBe(true)
    expect(isValidRank({ belt: 'white', stripes: 5 })).toBe(false)
    expect(isValidRank({ belt: 'black', stripes: 6 })).toBe(true)
    expect(isValidRank({ belt: 'blue', stripes: -1 })).toBe(false)
    expect(isValidRank({ belt: 'blue', stripes: 1.5 })).toBe(false)
  })
})

describe('labels', () => {
  it('names ranks the way a gym says them', () => {
    expect(rankLabel({ belt: 'white', stripes: 4 })).toBe('White belt · 4 stripes')
    expect(rankLabel({ belt: 'blue', stripes: 1 })).toBe('Blue belt · 1 stripe')
    expect(rankLabel({ belt: 'blue', stripes: 0 })).toBe('Blue belt')
    expect(rankLabel({ belt: 'black', stripes: 2 })).toBe('Black belt · 2nd degree')
  })

  it('names the next promotion', () => {
    expect(promotionLabel({ belt: 'white', stripes: 4 }, { belt: 'blue', stripes: 0 })).toBe('Promote to blue belt')
    expect(promotionLabel({ belt: 'blue', stripes: 0 }, { belt: 'blue', stripes: 1 })).toBe('Add 1st stripe')
    expect(promotionLabel({ belt: 'black', stripes: 2 }, { belt: 'black', stripes: 3 })).toBe('Award 3rd degree')
  })
})

const TODAY = '2027-12-31'

describe('currentRank', () => {
  it('is null with no events', () => {
    expect(currentRank([], TODAY)).toBeNull()
  })

  it('the latest day wins', () => {
    const r = currentRank([mkP('2026-10-16', 'blue', 0), mkP('2026-07-03', 'white', 4)], TODAY)
    expect(r).toMatchObject({ belt: 'blue', stripes: 0, sinceIso: '2026-10-16', beltSinceIso: '2026-10-16' })
  })

  it('a backdated duplicate of the current rank moves the since-date back', () => {
    const seed = mkP('2026-10-16', 'white', 4)
    const real = mkP('2026-07-03', 'white', 4)
    expect(currentRank([seed, real], TODAY)).toMatchObject({ belt: 'white', stripes: 4, sinceIso: '2026-07-03' })
  })

  it('beltSince spans every stripe on the current belt', () => {
    const r = currentRank(
      [
        mkP('2025-01-10', 'white', 0),
        mkP('2025-06-01', 'white', 2),
        mkP('2026-07-03', 'white', 4),
        mkP('2027-03-01', 'blue', 0),
        mkP('2027-09-01', 'blue', 1),
      ],
      TODAY,
    )
    expect(r).toMatchObject({ belt: 'blue', stripes: 1, sinceIso: '2027-09-01', beltSinceIso: '2027-03-01' })
  })

  it('backdated history before the current rank does not change it', () => {
    const r = currentRank([mkP('2026-10-16', 'white', 4), mkP('2026-03-01', 'white', 2)], TODAY)
    expect(r).toMatchObject({ stripes: 4, sinceIso: '2026-10-16', beltSinceIso: '2026-03-01' })
  })

  it('events dated after today are ignored until their date arrives', () => {
    const typo = mkP('2027-10-16', 'white', 4) // a mistyped year
    const real = mkP('2026-10-20', 'blue', 0)
    expect(currentRank([typo, real], '2026-10-20')).toMatchObject({ belt: 'blue', stripes: 0 })
  })
})

describe('corrections (review findings, 2026-10-16)', () => {
  it('a same-day correction REPLACES the mistake — since-date and history survive', () => {
    const real = mkP('2026-07-03', 'white', 4)
    const mistake = mkP('2026-10-16', 'blue', 0)
    const fix = mkP('2026-10-16', 'white', 4)
    expect(currentRank([real, mistake, fix], TODAY)).toMatchObject({
      belt: 'white',
      stripes: 4,
      sinceIso: '2026-07-03',
      beltSinceIso: '2026-07-03',
    })
    expect(rankTimeline([real, mistake, fix], TODAY)).toEqual([{ belt: 'white', stripes: 4, sinceIso: '2026-07-03' }])
  })

  it('a stripe mis-tap corrected the same day leaves one coherent since-line', () => {
    const a = mkP('2026-10-01', 'blue', 0)
    const mistake = mkP('2026-11-01', 'blue', 1)
    const fix = mkP('2026-11-01', 'blue', 0)
    expect(currentRank([a, mistake, fix], TODAY)).toMatchObject({ sinceIso: '2026-10-01', beltSinceIso: '2026-10-01' })
  })

  it('exact createdAt ties on one day resolve by id, identically on every device', () => {
    const x = mkP('2026-10-16', 'blue', 0, { id: 'b', createdAt: 5 })
    const y = mkP('2026-10-16', 'white', 4, { id: 'a', createdAt: 5 })
    expect(currentRank([x, y], TODAY)!.belt).toBe(currentRank([y, x], TODAY)!.belt)
    expect(currentRank([x, y], TODAY)!.belt).toBe('blue') // 'b' > 'a'
  })

  it('the timeline hides superseded events and collapses duplicates', () => {
    const t = rankTimeline(
      [mkP('2026-07-03', 'white', 4), mkP('2026-10-16', 'white', 4), mkP('2027-03-01', 'blue', 0)],
      TODAY,
    )
    expect(t).toEqual([
      { belt: 'white', stripes: 4, sinceIso: '2026-07-03' },
      { belt: 'blue', stripes: 0, sinceIso: '2027-03-01' },
    ])
  })
})

describe('undoTarget', () => {
  it('reverts the latest promotion by re-entering its day with the previous rank', () => {
    const seed = mkP('2026-10-16', 'white', 4)
    const promo = mkP('2026-10-16', 'blue', 0) // same day as the seed (mis-tap)
    expect(undoTarget([seed, promo], TODAY)).toEqual({ rank: { belt: 'white', stripes: 4 }, dateIso: '2026-10-16' })
  })

  it('works days later: the undo is dated on the promotion day, so it replaces it', () => {
    const seed = mkP('2026-07-03', 'white', 4)
    const promo = mkP('2026-10-16', 'blue', 0)
    const target = undoTarget([seed, promo], '2026-10-20')!
    expect(target.dateIso).toBe('2026-10-16')
    const undo = mkP(target.dateIso, target.rank.belt, target.rank.stripes)
    expect(currentRank([seed, promo, undo], '2026-10-20')).toMatchObject({ belt: 'white', stripes: 4, sinceIso: '2026-07-03' })
  })

  it('is not offered after an undo (no redo toggle) or for a downward change', () => {
    const seed = mkP('2026-10-16', 'white', 4)
    const promo = mkP('2026-10-16', 'blue', 0)
    const undo = mkP('2026-10-16', 'white', 4)
    expect(undoTarget([seed, promo, undo], TODAY)).toBeNull()
    expect(undoTarget([mkP('2026-10-01', 'blue', 0), mkP('2026-10-02', 'white', 4)], TODAY)).toBeNull()
  })

  it('is not offered with a single entry', () => {
    expect(undoTarget([mkP('2026-10-16', 'white', 4)], TODAY)).toBeNull()
    expect(undoTarget([], TODAY)).toBeNull()
  })
})

describe('isPromotionDate', () => {
  it('accepts real past/today dates only', () => {
    expect(isPromotionDate('2026-10-16', '2026-10-16')).toBe(true)
    expect(isPromotionDate('2026-07-03', '2026-10-16')).toBe(true)
    expect(isPromotionDate('2027-10-16', '2026-10-16')).toBe(false) // future
    expect(isPromotionDate('', '2026-10-16')).toBe(false) // cleared input
    expect(isPromotionDate('20261-10-16', '2026-10-16')).toBe(false) // 5-digit year
  })

  it('promotionsAsc sorts the raw log without mutating', () => {
    const list = [mkP('2026-10-16', 'white', 4), mkP('2026-03-01', 'white', 2)]
    const copy = [...list]
    expect(promotionsAsc(list).map((p) => p.date)).toEqual(['2026-03-01', '2026-10-16'])
    expect(list).toEqual(copy)
  })
})
