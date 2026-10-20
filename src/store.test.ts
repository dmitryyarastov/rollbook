import { afterEach, describe, expect, it } from 'vitest'
import { emptyData, load } from './store'

/** Minimal localStorage stub — vitest runs in a node environment. */
function stubStorage(raw: string | null) {
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => raw,
    setItem: () => {},
    removeItem: () => {},
  }
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
})

const session = {
  id: 's1',
  date: '2026-08-01',
  createdAt: 100,
  title: 'Evening class',
  gi: true,
  rolls: 4,
  subsFor: 1,
  subsAgainst: 0,
  roundMin: 5,
  tags: ['Kimura'],
}

const comp = {
  id: 'c1',
  date: '2026-08-15',
  createdAt: 200,
  updatedAt: 200,
  title: 'Regional Open',
  gi: true,
  cardio: 4,
  placement: 'bronze',
  tags: ['De La Riva'],
  workedWell: 'Grips',
  didntWork: 'Cardio',
  matches: [{ outcome: 'win', myPoints: 4, theirPoints: 2, submission: '' }],
}

describe('load', () => {
  it('defaults competitions to [] for blobs from before the feature', () => {
    stubStorage(JSON.stringify({ sessions: [session], tagList: ['Kimura'] }))
    const d = load()
    expect(d.competitions).toEqual([])
    expect(d.sessions).toHaveLength(1)
  })

  it('replaces a junk competitions value with []', () => {
    stubStorage(JSON.stringify({ competitions: 'junk' }))
    expect(load().competitions).toEqual([])
  })

  it('round-trips a stored competition', () => {
    stubStorage(JSON.stringify({ competitions: [comp] }))
    expect(load().competitions).toEqual([comp])
  })

  it('backfills placement and tags on comps from before the goals feature', () => {
    const legacy = { ...comp } as Record<string, unknown>
    delete legacy.placement
    delete legacy.tags
    stubStorage(JSON.stringify({ competitions: [legacy] }))
    const c = load().competitions[0]
    expect(c.placement).toBe('none')
    expect(c.tags).toEqual([])
    stubStorage(JSON.stringify({ competitions: [{ ...comp, placement: 'junk', tags: 'junk' }] }))
    expect(load().competitions[0].placement).toBe('none')
    expect(load().competitions[0].tags).toEqual([])
  })

  it('still backfills session updatedAt from createdAt (pre-sync blobs)', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].updatedAt).toBe(100)
  })

  it('clamps corrupted rolls (an Infinity blob must not freeze the level math)', () => {
    stubStorage(JSON.stringify({ sessions: [{ ...session, rolls: 1e309 }] }))
    expect(load().sessions[0].rolls).toBe(0)
    stubStorage(JSON.stringify({ sessions: [{ ...session, rolls: -3 }] }))
    expect(load().sessions[0].rolls).toBe(0)
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].rolls).toBe(4)
  })

  it('backfills the typed specific breakdown to zeros on older blobs', () => {
    stubStorage(JSON.stringify({ sessions: [{ ...session, specific: 2 }] }))
    const s = load().sessions[0]
    expect([s.specClosed, s.specMount, s.specOpen, s.specSide, s.specBack, s.specTurtle]).toEqual([0, 0, 0, 0, 0, 0])
    expect(s.specific).toBe(2)
    stubStorage(JSON.stringify({ sessions: [{ ...session, specMount: 'junk', specOpen: 2 }] }))
    expect([load().sessions[0].specMount, load().sessions[0].specOpen]).toEqual([0, 2])
  })

  it('backfills specific rounds to 0 for blobs from before the split', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].specific).toBe(0)
    stubStorage(JSON.stringify({ sessions: [{ ...session, specific: 'junk' }] }))
    expect(load().sessions[0].specific).toBe(0)
    stubStorage(JSON.stringify({ sessions: [{ ...session, specific: 3 }] }))
    expect(load().sessions[0].specific).toBe(3)
  })

  it('backfills session time to null for blobs from before the picker', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].time).toBeNull()
    stubStorage(JSON.stringify({ sessions: [{ ...session, time: '19:30' }] }))
    expect(load().sessions[0].time).toBe('19:30')
  })

  it('backfills session duration and intensity to null for legacy blobs', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].durationMin).toBeNull()
    expect(load().sessions[0].intensity).toBeNull()
    stubStorage(JSON.stringify({ sessions: [{ ...session, durationMin: 90, intensity: 4 }] }))
    expect(load().sessions[0].durationMin).toBe(90)
    expect(load().sessions[0].intensity).toBe(4)
    stubStorage(JSON.stringify({ sessions: [{ ...session, durationMin: 0, intensity: 7 }] }))
    expect(load().sessions[0].durationMin).toBeNull()
    expect(load().sessions[0].intensity).toBeNull()
  })

  it('clamps a poisoned weeklyGoal from the blob', () => {
    stubStorage(JSON.stringify({ settings: { weeklyGoal: 0, showMilestones: true } }))
    expect(load().settings.weeklyGoal).toBe(2)
    stubStorage(JSON.stringify({ settings: { weeklyGoal: 3 } }))
    expect(load().settings.weeklyGoal).toBe(3)
  })

  it('defaults promotions to [] for older blobs and drops malformed rank events', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().promotions).toEqual([])
    const good = { id: 'p1', date: '2026-10-16', createdAt: 1, updatedAt: 1, belt: 'white', stripes: 4 }
    stubStorage(
      JSON.stringify({
        promotions: [
          good,
          { ...good, id: 'p2', belt: 'coral' },
          { ...good, id: 'p3', stripes: 9 },
          { ...good, id: 'p4', date: '16/10/2026' },
          'junk',
          null,
        ],
      }),
    )
    expect(load().promotions).toEqual([good])
  })

  it('returns fresh empty data when storage is empty or unparseable', () => {
    stubStorage(null)
    expect(load()).toEqual(emptyData())
    stubStorage('{not json')
    expect(load()).toEqual(emptyData())
  })
})
