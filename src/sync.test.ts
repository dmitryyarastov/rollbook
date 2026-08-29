import { describe, expect, it } from 'vitest'
import { emptyData } from './store'
import {
  fromCompRow,
  fromRow,
  fromStateRow,
  isPushable,
  mergeAppData,
  mergeCompetitions,
  mergeSessions,
  pullAll,
  pushAll,
  toCompRow,
  toRow,
} from './sync'
import type { AppData, Competition, Session } from './types'

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
    time: null,
    ...over,
  }
}

function appData(over: Partial<AppData> = {}): AppData {
  return { ...emptyData(), ...over }
}

function mkComp(over: Partial<Competition> = {}): Competition {
  seq++
  return {
    id: `c${seq}`,
    date: '2026-08-15',
    createdAt: 1_754_000_000_123,
    updatedAt: 1_754_000_000_123,
    title: 'Regional Open',
    gi: true,
    cardio: 4,
    placement: 'none',
    workedWell: 'Grips held up',
    didntWork: 'Gassed in match 3',
    matches: [
      { outcome: 'win', myPoints: 4, theirPoints: 2, submission: '' },
      { outcome: 'loss', myPoints: 0, theirPoints: 0, submission: 'Armbar' },
    ],
    tags: [],
    ...over,
  }
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

  it('round-trips the session time and nulls anything malformed', () => {
    expect(fromRow(toRow(mk({ time: '19:30' })))!.time).toBe('19:30')
    expect(fromRow(toRow(mk()))!.time).toBeNull()
    for (const bad of ['25:00', '7:30', '19:60', '7:30pm', 1930]) {
      expect(fromRow({ ...toRow(mk()), time: bad })!.time).toBeNull()
    }
  })
})

describe('competition row mapping', () => {
  it('round-trips a competition ms-exactly, matches included', () => {
    const c = mkComp({ updatedAt: 1_754_000_000_456 })
    expect(fromCompRow(toCompRow(c))).toEqual(c)
  })

  it('drops rows that are structurally unusable', () => {
    const good = toCompRow(mkComp())
    expect(fromCompRow(null)).toBeNull()
    expect(fromCompRow({ ...good, id: '' })).toBeNull()
    expect(fromCompRow({ ...good, id: 42 })).toBeNull()
    expect(fromCompRow({ ...good, date: '15/08/2026' })).toBeNull()
    expect(fromCompRow({ ...good, updated_at: 'not a time' })).toBeNull()
  })

  it('sanitizes fixable tampered fields', () => {
    const c = fromCompRow({
      ...toCompRow(mkComp()),
      title: 7,
      gi: 'yes',
      cardio: 9,
      worked_well: 5,
      didnt_work: null,
    })
    expect(c).not.toBeNull()
    expect(c!.title).toBe('Competition')
    expect(c!.gi).toBe(false)
    expect(c!.cardio).toBe(0)
    expect(c!.workedWell).toBe('')
    expect(c!.didntWork).toBe('')
    expect(fromCompRow({ ...toCompRow(mkComp()), cardio: 'bad' })!.cardio).toBe(0)
  })

  it('sanitizes the untrusted matches jsonb', () => {
    const base = toCompRow(mkComp())
    expect(fromCompRow({ ...base, matches: 'not-an-array' })!.matches).toEqual([])
    const c = fromCompRow({
      ...base,
      matches: [
        null,
        42,
        { outcome: 'ko' },
        { outcome: 'win', myPoints: 'lots', theirPoints: -3, submission: 9 },
        { outcome: 'draw', myPoints: 1e9, theirPoints: 2, submission: '  ' },
        { outcome: 'loss', myPoints: 0, theirPoints: 6, submission: ' Triangle ' },
      ],
    })
    expect(c!.matches).toEqual([
      { outcome: 'win', myPoints: 0, theirPoints: 0, submission: '' },
      { outcome: 'draw', myPoints: 1000, theirPoints: 2, submission: '' },
      { outcome: 'loss', myPoints: 0, theirPoints: 6, submission: 'Triangle' },
    ])
  })

  it('round-trips placement and tags; sanitizes tampered values', () => {
    const c = mkComp({ placement: 'silver', tags: ['DLR X', 'Open guard'] })
    expect(fromCompRow(toCompRow(c))).toEqual(c)
    const bad = fromCompRow({ ...toCompRow(mkComp()), placement: 'platinum', tags: ['ok', 7, null] })
    expect(bad!.placement).toBe('none')
    expect(bad!.tags).toEqual(['ok'])
    expect(fromCompRow({ ...toCompRow(mkComp()), placement: 9, tags: 'not-an-array' })!.placement).toBe('none')
    expect(fromCompRow({ ...toCompRow(mkComp()), tags: 'not-an-array' })!.tags).toEqual([])
  })

  it('caps a tampered match list at 50 entries', () => {
    const many = Array.from({ length: 60 }, () => ({ outcome: 'win', myPoints: 0, theirPoints: 0, submission: '' }))
    expect(fromCompRow({ ...toCompRow(mkComp()), matches: many })!.matches).toHaveLength(50)
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

describe('mergeCompetitions', () => {
  it('mirrors session merge semantics: newer remote wins, ties keep local', () => {
    const local = mkComp({ id: 'a', cardio: 2, updatedAt: 200 })
    expect(mergeCompetitions([local], [{ ...local, cardio: 5, updatedAt: 300 }])[0].cardio).toBe(5)
    expect(mergeCompetitions([local], [{ ...local, cardio: 5, updatedAt: 200 }])[0].cardio).toBe(2)
  })

  it('appends remote-only comps, never deletes local, ignores demo ids', () => {
    const local = [mkComp({ id: 'a', date: '2026-08-02' })]
    const merged = mergeCompetitions(local, [
      mkComp({ id: 'b', date: '2026-08-01' }),
      mkComp({ id: 'demo-comp-1' }),
    ])
    expect(merged.map((c) => c.id)).toEqual(['a', 'b'])
    expect(mergeCompetitions(local, [])).toHaveLength(1)
  })

  it('returns the same reference when nothing changed', () => {
    const local = [mkComp({ id: 'a', updatedAt: 500 })]
    expect(mergeCompetitions(local, [{ ...local[0], updatedAt: 400 }])).toBe(local)
    expect(mergeCompetitions(local, [])).toBe(local)
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
    const out = mergeAppData(d, { sessions: [], competitions: [], state: remoteState })
    expect(out.focus.tag).toBe('Berimbolo')
    expect(out.settings.weeklyGoal).toBe(3)
    expect(out.stateUpdatedAt).toBe(900)
  })

  it('keeps local state when remote is older or absent', () => {
    const d = appData({ stateUpdatedAt: 1000, focus: { title: 'Mine', tag: 'Kimura' } })
    expect(mergeAppData(d, { sessions: [], competitions: [], state: remoteState }).focus.tag).toBe('Kimura')
    expect(mergeAppData(d, { sessions: [], competitions: [], state: null })).toBe(d)
  })

  it('adopts pulled competitions in both state branches', () => {
    const c = mkComp({ id: 'r-comp' })
    const d = appData({ stateUpdatedAt: 1000 })
    expect(mergeAppData(d, { sessions: [], competitions: [c], state: null }).competitions).toEqual([c])
    const adopted = mergeAppData(appData({ stateUpdatedAt: 100 }), { sessions: [], competitions: [c], state: remoteState })
    expect(adopted.competitions).toEqual([c])
    expect(adopted.focus.tag).toBe('Berimbolo')
  })

  it('returns the same reference when sessions, competitions, and state are all unchanged', () => {
    const d = appData({ sessions: [mk()], competitions: [mkComp()], stateUpdatedAt: 1000 })
    expect(mergeAppData(d, { sessions: d.sessions, competitions: d.competitions, state: null })).toBe(d)
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

  it('clamps weeklyGoal to a positive integer (a 0 goal would stall the streak walk)', () => {
    const row = (weeklyGoal: unknown) =>
      fromStateRow({ state: { settings: { weeklyGoal, showMilestones: true } }, updated_at: '2026-08-04T10:00:00Z' })
    expect(row(0)!.settings.weeklyGoal).toBe(2)
    expect(row(-3)!.settings.weeklyGoal).toBe(2)
    expect(row(Number.NaN)!.settings.weeklyGoal).toBe(2)
    expect(row(2.6)!.settings.weeklyGoal).toBe(3)
    expect(row(4)!.settings.weeklyGoal).toBe(4)
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

  it('upserts non-demo competitions to their own table', async () => {
    const { f, calls } = stubFetch()
    const d = appData({ competitions: [mkComp({ id: 'real-c' }), mkComp({ id: 'demo-comp-0' })] })
    await pushAll(d, f)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/rest/v1/competitions?on_conflict=id')
    const headers = calls[0].init!.headers as Record<string, string>
    expect(headers.Prefer).toBe('resolution=merge-duplicates,return=minimal')
    const body = JSON.parse(String(calls[0].init!.body)) as { id: string; matches: unknown[] }[]
    expect(body.map((r) => r.id)).toEqual(['real-c'])
    expect(body[0].matches).toHaveLength(2)
  })

  it('sends no competitions request when only demo comps exist', async () => {
    const { f, calls } = stubFetch()
    await pushAll(appData({ competitions: [mkComp({ id: 'demo-comp-0' })] }), f)
    expect(calls).toHaveLength(0)
  })

  it('tolerates a 404 on competitions (table not created yet) but nothing else', async () => {
    const respond404 = (url: string) =>
      url.includes('/competitions') ? new Response('missing', { status: 404 }) : okJson([])
    const { f } = stubFetch(respond404)
    const d = appData({ sessions: [mk()], competitions: [mkComp()] })
    await expect(pushAll(d, f)).resolves.toBeUndefined()
    const bad = stubFetch((url) =>
      url.includes('/competitions') ? new Response('down', { status: 503 }) : okJson([]),
    )
    await expect(pushAll(d, bad.f)).rejects.toThrow('503')
  })

  it('rejects on a non-ok response (paused project)', async () => {
    const { f } = stubFetch(() => new Response('paused', { status: 503 }))
    await expect(pushAll(appData({ sessions: [mk()] }), f)).rejects.toThrow('503')
  })
})

describe('pullAll', () => {
  it('fetches all three tables, maps rows, drops junk, picks the state row', async () => {
    const good = toRow(mk({ id: 'r1' }))
    const goodComp = toCompRow(mkComp({ id: 'rc1' }))
    const { f, calls } = stubFetch((url) =>
      url.includes('/sessions')
        ? okJson([good, { junk: true }])
        : url.includes('/competitions')
          ? okJson([goodComp, { junk: true }])
          : okJson([{ state: {}, updated_at: '2026-08-04T09:00:00Z' }]),
    )
    const pull = await pullAll(f)
    expect(calls.some((c) => c.url.includes('sessions?select=*&user_id=eq.dmitrii&order=updated_at.desc'))).toBe(true)
    expect(calls.some((c) => c.url.includes('competitions?select=*&user_id=eq.dmitrii&order=updated_at.desc'))).toBe(
      true,
    )
    expect(calls.some((c) => c.url.includes('app_state?select=*&user_id=eq.dmitrii'))).toBe(true)
    expect(pull.sessions.map((s) => s.id)).toEqual(['r1'])
    expect(pull.competitions.map((c) => c.id)).toEqual(['rc1'])
    expect(pull.state).not.toBeNull()
  })

  it('tolerates a 404 on competitions only (table not created yet)', async () => {
    const good = toRow(mk({ id: 'r1' }))
    const { f } = stubFetch((url) =>
      url.includes('/competitions')
        ? new Response('missing', { status: 404 })
        : url.includes('/sessions')
          ? okJson([good])
          : okJson([]),
    )
    const pull = await pullAll(f)
    expect(pull.competitions).toEqual([])
    expect(pull.sessions.map((s) => s.id)).toEqual(['r1'])
    const bad = stubFetch((url) =>
      url.includes('/competitions') ? new Response('down', { status: 500 }) : okJson([]),
    )
    await expect(pullAll(bad.f)).rejects.toThrow('500')
  })

  it('returns null state when the table is empty and rejects on failure', async () => {
    const { f } = stubFetch(() => okJson([]))
    expect((await pullAll(f)).state).toBeNull()
    const bad = stubFetch(() => new Response('x', { status: 500 }))
    await expect(pullAll(bad.f)).rejects.toThrow('500')
  })
})

describe('isPushable', () => {
  it('filters demo ids only, for sessions and competitions alike', () => {
    expect(isPushable(mk({ id: 'demo-12' }))).toBe(false)
    expect(isPushable(mk({ id: 'a-demo' }))).toBe(true)
    expect(isPushable(mkComp({ id: 'demo-comp-1' }))).toBe(false)
    expect(isPushable(mkComp({ id: 'real-comp' }))).toBe(true)
  })
})
