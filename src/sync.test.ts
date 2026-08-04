import { describe, expect, it } from 'vitest'
import { emptyData } from './store'
import {
  fromRow,
  fromStateRow,
  isPushable,
  mergeAppData,
  mergeSessions,
  pullAll,
  pushAll,
  toRow,
} from './sync'
import type { AppData, Session } from './types'

let seq = 0
function mk(over: Partial<Session> = {}): Session {
  seq++
  return {
    id: `s${seq}`,
    date: '2026-08-01',
    createdAt: 1_754_000_000_123,
    updatedAt: 1_754_000_000_123,
    title: 'Evening class',
    gi: true,
    rolls: 5,
    subsFor: 1,
    subsAgainst: 2,
    roundMin: 5,
    tags: ['Half guard'],
    ...over,
  }
}

function appData(over: Partial<AppData> = {}): AppData {
  return { ...emptyData(), ...over }
}

interface Call {
  url: string
  init?: RequestInit
}

function stubFetch(respond: (url: string) => Response = () => okJson([])) {
  const calls: Call[] = []
  const f = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return respond(String(input))
  }) as typeof fetch
  return { f, calls }
}

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('row mapping', () => {
  it('round-trips a session ms-exactly', () => {
    const s = mk({ updatedAt: 1_754_000_000_456, tags: ['Kimura', 'Knee cut'] })
    expect(fromRow(toRow(s))).toEqual(s)
  })

  it('drops rows that are structurally unusable', () => {
    const good = toRow(mk())
    expect(fromRow(null)).toBeNull()
    expect(fromRow({ ...good, id: '' })).toBeNull()
    expect(fromRow({ ...good, id: 42 })).toBeNull()
    expect(fromRow({ ...good, date: '01/08/2026' })).toBeNull()
    expect(fromRow({ ...good, updated_at: 'not a time' })).toBeNull()
  })

  it('sanitizes fixable tampered fields', () => {
    const s = fromRow({
      ...toRow(mk()),
      rolls: -5,
      subs_for: 'lots',
      round_min: 7,
      tags: 'not-an-array',
      title: 7,
      gi: 'yes',
    })
    expect(s).not.toBeNull()
    expect(s!.rolls).toBe(0)
    expect(s!.subsFor).toBe(0)
    expect(s!.roundMin).toBe(5)
    expect(s!.tags).toEqual([])
    expect(s!.title).toBe('')
    expect(s!.gi).toBe(false)
  })

  it('keeps only string members of tags', () => {
    const s = fromRow({ ...toRow(mk()), tags: ['ok', 3, null, 'also ok'] })
    expect(s!.tags).toEqual(['ok', 'also ok'])
  })
})

describe('mergeSessions', () => {
  it('takes the remote version when strictly newer', () => {
    const local = mk({ id: 'a', rolls: 3, updatedAt: 100 })
    const remote = { ...local, rolls: 8, updatedAt: 200 }
    expect(mergeSessions([local], [remote])[0].rolls).toBe(8)
  })

  it('keeps local on ties and when local is newer', () => {
    const local = mk({ id: 'a', rolls: 3, updatedAt: 200 })
    expect(mergeSessions([local], [{ ...local, rolls: 8, updatedAt: 200 }])[0].rolls).toBe(3)
    expect(mergeSessions([local], [{ ...local, rolls: 8, updatedAt: 150 }])[0].rolls).toBe(3)
  })

  it('appends remote-only sessions sorted by date then createdAt', () => {
    const local = [mk({ id: 'a', date: '2026-08-02' })]
    const r1 = mk({ id: 'b', date: '2026-08-03', createdAt: 2 })
    const r2 = mk({ id: 'c', date: '2026-08-01', createdAt: 1 })
    const merged = mergeSessions(local, [r1, r2])
    expect(merged.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('never deletes local sessions missing remotely', () => {
    const local = [mk({ id: 'a' }), mk({ id: 'b' })]
    expect(mergeSessions(local, [])).toHaveLength(2)
  })

  it('ignores remote rows with demo ids', () => {
    const local = [mk({ id: 'a' })]
    const merged = mergeSessions(local, [mk({ id: 'demo-3' })])
    expect(merged.map((s) => s.id)).toEqual(['a'])
  })

  it('returns the same reference when nothing changed', () => {
    const local = [mk({ id: 'a', updatedAt: 500 })]
    expect(mergeSessions(local, [{ ...local[0], updatedAt: 400 }])).toBe(local)
    expect(mergeSessions(local, [])).toBe(local)
  })
})

describe('mergeAppData', () => {
  const remoteState = {
    focus: { title: 'Berimbolo month', tag: 'Berimbolo' },
    tagList: ['Berimbolo'],
    settings: { weeklyGoal: 3, showMilestones: false },
    updatedAt: 900,
  }

  it('adopts remote state when strictly newer', () => {
    const d = appData({ stateUpdatedAt: 100 })
    const out = mergeAppData(d, { sessions: [], state: remoteState })
    expect(out.focus.tag).toBe('Berimbolo')
    expect(out.settings.weeklyGoal).toBe(3)
    expect(out.stateUpdatedAt).toBe(900)
  })

  it('keeps local state when remote is older or absent', () => {
    const d = appData({ stateUpdatedAt: 1000, focus: { title: 'Mine', tag: 'Kimura' } })
    expect(mergeAppData(d, { sessions: [], state: remoteState }).focus.tag).toBe('Kimura')
    expect(mergeAppData(d, { sessions: [], state: null })).toBe(d)
  })

  it('returns the same reference when nothing changed at all', () => {
    const d = appData({ sessions: [mk()], stateUpdatedAt: 1000 })
    expect(mergeAppData(d, { sessions: d.sessions, state: null })).toBe(d)
  })
})

describe('fromStateRow', () => {
  it('parses a well-formed row', () => {
    const st = fromStateRow({
      user_id: 'dmitrii',
      state: { focus: { title: 'T', tag: 'x' }, tagList: ['x'], settings: { weeklyGoal: 4, showMilestones: true } },
      updated_at: '2026-08-04T10:00:00.5+00:00',
    })
    expect(st).toMatchObject({ focus: { title: 'T', tag: 'x' }, tagList: ['x'] })
    expect(st!.updatedAt).toBe(Date.parse('2026-08-04T10:00:00.5+00:00'))
  })

  it('falls back to defaults for malformed fields and rejects bad timestamps', () => {
    const st = fromStateRow({ state: { focus: 42, tagList: [], settings: null }, updated_at: '2026-08-04T10:00:00Z' })
    expect(st!.focus).toEqual({ title: '', tag: '' })
    expect(st!.tagList).toEqual(emptyData().tagList)
    expect(st!.settings).toEqual(emptyData().settings)
    expect(fromStateRow({ state: {}, updated_at: 'junk' })).toBeNull()
  })
})

describe('pushAll', () => {
  it('upserts non-demo sessions with the right URL, headers, and body', async () => {
    const { f, calls } = stubFetch()
    const d = appData({ sessions: [mk({ id: 'real-1' }), mk({ id: 'demo-0' })] })
    await pushAll(d, f)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/rest/v1/sessions?on_conflict=id')
    const headers = calls[0].init!.headers as Record<string, string>
    expect(headers.apikey).toBeDefined()
    expect(headers.Authorization).toMatch(/^Bearer /)
    expect(headers.Prefer).toBe('resolution=merge-duplicates,return=minimal')
    const body = JSON.parse(String(calls[0].init!.body)) as { id: string }[]
    expect(body.map((r) => r.id)).toEqual(['real-1'])
  })

  it('sends nothing when only demo sessions exist and state is untouched', async () => {
    const { f, calls } = stubFetch()
    await pushAll(appData({ sessions: [mk({ id: 'demo-0' })] }), f)
    expect(calls).toHaveLength(0)
  })

  it('upserts app_state only once stateUpdatedAt > 0', async () => {
    const { f, calls } = stubFetch()
    await pushAll(appData({ stateUpdatedAt: 1234 }), f)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/rest/v1/app_state?on_conflict=user_id')
    const body = JSON.parse(String(calls[0].init!.body)) as { user_id: string; state: unknown }[]
    expect(body[0].user_id).toBe('dmitrii')
    expect(body[0].state).toEqual({
      focus: emptyData().focus,
      tagList: emptyData().tagList,
      settings: emptyData().settings,
    })
  })

  it('rejects on a non-ok response (paused project)', async () => {
    const { f } = stubFetch(() => new Response('paused', { status: 503 }))
    await expect(pushAll(appData({ sessions: [mk()] }), f)).rejects.toThrow('503')
  })
})

describe('pullAll', () => {
  it('fetches both tables, maps sessions, drops junk, picks the state row', async () => {
    const good = toRow(mk({ id: 'r1' }))
    const { f, calls } = stubFetch((url) =>
      url.includes('/sessions')
        ? okJson([good, { junk: true }])
        : okJson([{ state: {}, updated_at: '2026-08-04T09:00:00Z' }]),
    )
    const pull = await pullAll(f)
    expect(calls.some((c) => c.url.includes('sessions?select=*&user_id=eq.dmitrii&order=updated_at.desc'))).toBe(true)
    expect(calls.some((c) => c.url.includes('app_state?select=*&user_id=eq.dmitrii'))).toBe(true)
    expect(pull.sessions.map((s) => s.id)).toEqual(['r1'])
    expect(pull.state).not.toBeNull()
  })

  it('returns null state when the table is empty and rejects on failure', async () => {
    const { f } = stubFetch(() => okJson([]))
    expect((await pullAll(f)).state).toBeNull()
    const bad = stubFetch(() => new Response('x', { status: 500 }))
    await expect(pullAll(bad.f)).rejects.toThrow('500')
  })
})

describe('isPushable', () => {
  it('filters demo ids only', () => {
    expect(isPushable(mk({ id: 'demo-12' }))).toBe(false)
    expect(isPushable(mk({ id: 'a-demo' }))).toBe(true)
  })
})
