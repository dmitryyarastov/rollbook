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

  it('still backfills session updatedAt from createdAt (pre-sync blobs)', () => {
    stubStorage(JSON.stringify({ sessions: [session] }))
    expect(load().sessions[0].updatedAt).toBe(100)
  })

  it('returns fresh empty data when storage is empty or unparseable', () => {
    stubStorage(null)
    expect(load()).toEqual(emptyData())
    stubStorage('{not json')
    expect(load()).toEqual(emptyData())
  })
})
