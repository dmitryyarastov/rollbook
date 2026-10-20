/**
 * Remote sync against Supabase PostgREST — pure mapping/merge functions plus
 * a thin fetch shell. No React in here; the useSync hook owns scheduling.
 *
 * Model: localStorage is the UI's source of truth. Pushes blindly upsert all
 * local non-demo sessions (`merge-duplicates`) — safe because sessions are
 * append-only per id in this app. If a session-EDIT feature ever lands, add
 * a pull-before-every-push, or stale devices may overwrite newer edits.
 * Pulls merge last-write-wins by updatedAt and never delete local rows.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL, SYNC_USER_ID } from './config'
import { emptyData } from './store'
import { isValidRank } from './belts'
import { specBreakdownSum } from './specific'
import type {
  AppData,
  Belt,
  CardioRating,
  CompMatch,
  CompOutcome,
  Competition,
  FocusGoal,
  Placement,
  Promotion,
  RoundMin,
  Session,
  SessionIntensity,
  Settings,
} from './types'

export type SyncStatus = 'disabled' | 'syncing' | 'synced' | 'offline' | 'error'

export interface RemoteState {
  focus: FocusGoal
  tagList: string[]
  settings: Settings
  updatedAt: number
}

export interface RemotePull {
  sessions: Session[]
  competitions: Competition[]
  promotions: Promotion[]
  state: RemoteState | null
}

/** Demo seed data stays a local plaything — never pushed, never pulled. */
export const isPushable = (s: { id: string }): boolean => !s.id.startsWith('demo-')

// ── Row mapping ──────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  user_id: string
  date: string
  title: string
  gi: boolean
  rolls: number
  specific: number
  spec_closed: number
  spec_mount: number
  spec_open: number
  spec_side: number
  spec_back: number
  spec_turtle: number
  subs_for: number
  subs_against: number
  round_min: number
  duration_min: number | null
  intensity: number | null
  tags: string[]
  time: string | null
  created_at: string
  updated_at: string
}

export function toRow(s: Session): SessionRow {
  return {
    id: s.id,
    user_id: SYNC_USER_ID,
    date: s.date, // verbatim yyyy-mm-dd — never routed through a JS Date
    title: s.title,
    gi: s.gi,
    rolls: s.rolls,
    specific: s.specific,
    spec_closed: s.specClosed,
    spec_mount: s.specMount,
    spec_open: s.specOpen,
    spec_side: s.specSide,
    spec_back: s.specBack,
    spec_turtle: s.specTurtle,
    subs_for: s.subsFor,
    subs_against: s.subsAgainst,
    round_min: s.roundMin,
    duration_min: s.durationMin,
    intensity: s.intensity,
    tags: s.tags,
    time: s.time,
    created_at: new Date(s.createdAt).toISOString(),
    updated_at: new Date(s.updatedAt).toISOString(),
  }
}

const ROUND_MINS: readonly number[] = [4, 5, 6, 8]
const SESSION_INTENSITIES: readonly number[] = [1, 2, 3, 4, 5]
const count = (v: unknown): number => Math.max(0, Math.round(Number(v) || 0))

const wholeBetween = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Sanitizing pull-side mapper: with no auth, remote rows are untrusted.
 * Unusable rows (bad id/date/timestamps) are dropped; fixable fields are
 * clamped to sane values so tampering can't poison the derived stats.
 */
export function fromRow(r: unknown): Session | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '') return null
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
  const createdAt = typeof o.created_at === 'string' ? Date.parse(o.created_at) : NaN
  const updatedAt = typeof o.updated_at === 'string' ? Date.parse(o.updated_at) : NaN
  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) return null
  const roundMin = ROUND_MINS.includes(Number(o.round_min)) ? (Number(o.round_min) as RoundMin) : 5
  return {
    id: o.id,
    date: o.date,
    createdAt,
    updatedAt,
    title: typeof o.title === 'string' ? o.title : '',
    gi: o.gi === true,
    rolls: count(o.rolls),
    specific: Math.min(1000, count(o.specific)),
    specClosed: Math.min(1000, count(o.spec_closed)),
    specMount: Math.min(1000, count(o.spec_mount)),
    specOpen: Math.min(1000, count(o.spec_open)),
    specSide: Math.min(1000, count(o.spec_side)),
    specBack: Math.min(1000, count(o.spec_back)),
    specTurtle: Math.min(1000, count(o.spec_turtle)),
    subsFor: count(o.subs_for),
    subsAgainst: count(o.subs_against),
    roundMin,
    durationMin: wholeBetween(o.duration_min, 1, 600),
    intensity: (SESSION_INTENSITIES.includes(Number(o.intensity)) ? Number(o.intensity) : null) as SessionIntensity | null,
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    time: typeof o.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.time) ? o.time : null,
  }
}

interface CompetitionRow {
  id: string
  user_id: string
  date: string
  title: string
  gi: boolean
  cardio: number
  placement: string
  worked_well: string
  didnt_work: string
  matches: CompMatch[] // serialized into the jsonb column
  tags: string[]
  created_at: string
  updated_at: string
}

export function toCompRow(c: Competition): CompetitionRow {
  return {
    id: c.id,
    user_id: SYNC_USER_ID,
    date: c.date, // verbatim yyyy-mm-dd — never routed through a JS Date
    title: c.title,
    gi: c.gi,
    cardio: c.cardio,
    placement: c.placement,
    worked_well: c.workedWell,
    didnt_work: c.didntWork,
    matches: c.matches,
    tags: c.tags,
    created_at: new Date(c.createdAt).toISOString(),
    updated_at: new Date(c.updatedAt).toISOString(),
  }
}

const CARDIO_RATINGS: readonly number[] = [0, 1, 2, 3, 4, 5]
const PLACEMENTS: readonly string[] = ['none', 'bronze', 'silver', 'gold']
const OUTCOMES: readonly string[] = ['win', 'loss', 'draw']
/** The jsonb column has no per-field CHECKs — these client caps are the only bounds. */
const MAX_MATCHES = 50
const MAX_POINTS = 1000

function sanitizeMatches(v: unknown): CompMatch[] {
  if (!Array.isArray(v)) return []
  const out: CompMatch[] = []
  for (const m of v.slice(0, MAX_MATCHES)) {
    if (typeof m !== 'object' || m === null) continue
    const o = m as Record<string, unknown>
    // Outcome is semantically essential — no sane default, drop the entry.
    if (typeof o.outcome !== 'string' || !OUTCOMES.includes(o.outcome)) continue
    out.push({
      outcome: o.outcome as CompOutcome,
      myPoints: Math.min(MAX_POINTS, count(o.myPoints)),
      theirPoints: Math.min(MAX_POINTS, count(o.theirPoints)),
      submission: typeof o.submission === 'string' ? o.submission.trim() : '',
    })
  }
  return out
}

/** Sanitizing pull-side mapper for competitions — same trust model as fromRow. */
export function fromCompRow(r: unknown): Competition | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '') return null
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
  const createdAt = typeof o.created_at === 'string' ? Date.parse(o.created_at) : NaN
  const updatedAt = typeof o.updated_at === 'string' ? Date.parse(o.updated_at) : NaN
  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) return null
  return {
    id: o.id,
    date: o.date,
    createdAt,
    updatedAt,
    title: typeof o.title === 'string' ? o.title : 'Competition',
    gi: o.gi === true,
    cardio: (CARDIO_RATINGS.includes(Number(o.cardio)) ? Number(o.cardio) : 0) as CardioRating,
    placement: (typeof o.placement === 'string' && PLACEMENTS.includes(o.placement) ? o.placement : 'none') as Placement,
    workedWell: typeof o.worked_well === 'string' ? o.worked_well : '',
    didntWork: typeof o.didnt_work === 'string' ? o.didnt_work : '',
    matches: sanitizeMatches(o.matches),
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
  }
}

interface PromotionRow {
  id: string
  user_id: string
  date: string
  belt: string
  stripes: number
  created_at: string
  updated_at: string
}

export function toPromoRow(p: Promotion): PromotionRow {
  return {
    id: p.id,
    user_id: SYNC_USER_ID,
    date: p.date, // verbatim yyyy-mm-dd — never routed through a JS Date
    belt: p.belt,
    stripes: p.stripes,
    created_at: new Date(p.createdAt).toISOString(),
    updated_at: new Date(p.updatedAt).toISOString(),
  }
}

/**
 * Sanitizing pull-side mapper for rank events. The belt is the event's whole
 * meaning, so an unknown belt drops the row (no sane default — a guessed
 * belt would silently re-rank the character); stripes outside the belt's
 * cap also drop it rather than clamp, for the same reason.
 */
export function fromPromoRow(r: unknown): Promotion | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id === '') return null
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
  const createdAt = typeof o.created_at === 'string' ? Date.parse(o.created_at) : NaN
  const updatedAt = typeof o.updated_at === 'string' ? Date.parse(o.updated_at) : NaN
  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) return null
  const rank = { belt: o.belt as Belt, stripes: Number(o.stripes) }
  if (typeof o.belt !== 'string' || !isValidRank(rank)) return null
  return { id: o.id, date: o.date, createdAt, updatedAt, belt: rank.belt, stripes: rank.stripes }
}

export function fromStateRow(r: unknown): RemoteState | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  const updatedAt = typeof o.updated_at === 'string' ? Date.parse(o.updated_at) : NaN
  if (Number.isNaN(updatedAt)) return null
  const base = emptyData()
  const s = (typeof o.state === 'object' && o.state !== null ? o.state : {}) as Record<string, unknown>
  const focus = (typeof s.focus === 'object' && s.focus !== null ? s.focus : {}) as Record<string, unknown>
  const settings = (typeof s.settings === 'object' && s.settings !== null ? s.settings : {}) as Record<string, unknown>
  return {
    focus: {
      title: typeof focus.title === 'string' ? focus.title : base.focus.title,
      tag: typeof focus.tag === 'string' ? focus.tag : base.focus.tag,
    },
    tagList:
      Array.isArray(s.tagList) && s.tagList.length > 0
        ? s.tagList.filter((t): t is string => typeof t === 'string')
        : base.tagList,
    settings: {
      // Clamped to a positive integer: a tampered 0/negative goal would make
      // every empty week "qualify" and stall the streak walks.
      weeklyGoal:
        typeof settings.weeklyGoal === 'number' && Number.isFinite(settings.weeklyGoal) && settings.weeklyGoal >= 1
          ? Math.round(settings.weeklyGoal)
          : base.settings.weeklyGoal,
      showMilestones:
        typeof settings.showMilestones === 'boolean' ? settings.showMilestones : base.settings.showMilestones,
    },
    updatedAt,
  }
}

// ── Merge (last-write-wins) ──────────────────────────────────────────────────

interface Mergeable {
  id: string
  date: string
  createdAt: number
  updatedAt: number
}

/**
 * Per id: strictly-newer remote wins, ties keep local. Remote-only rows are
 * appended; local-only rows are ALWAYS kept — remote is not authoritative
 * for deletions, so remote tampering can never erase history. Returns the
 * same array reference when nothing changed (React bailout). One generic so
 * session and competition merge semantics can never drift.
 */
function mergeById<T extends Mergeable>(
  local: T[],
  remote: T[],
  preferRemoteOnTie?: (l: T, r: T) => boolean,
): T[] {
  const remoteById = new Map<string, T>()
  for (const r of remote) if (isPushable(r)) remoteById.set(r.id, r)
  let changed = false
  const out = local.map((l) => {
    const r = remoteById.get(l.id)
    remoteById.delete(l.id)
    if (r && (r.updatedAt > l.updatedAt || (r.updatedAt === l.updatedAt && (preferRemoteOnTie?.(l, r) ?? false)))) {
      changed = true
      return r
    }
    return l
  })
  if (remoteById.size > 0) {
    changed = true
    out.push(
      ...[...remoteById.values()].sort((a, b) =>
        a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
      ),
    )
  }
  return changed ? out : local
}

/**
 * Version-skew repair for the typed specific breakdown. A build that predates
 * a spec_* column drops it on pull; after that device updates, load()
 * backfills zero — the same row at the same updatedAt, minus part of the
 * breakdown (all of it for pre-format builds; only the newer formats for a
 * build that knew some). Left to "ties keep local", that device would push
 * its zeros over the real values forever. So on a tie, the copy carrying MORE
 * typed rounds wins, provided both agree on the total and the richer copy
 * stays within it (app-written rows keep breakdown === specific). One-way by
 * construction: real local values are never replaced by poorer remote ones.
 */
const recoversBreakdown = (l: Session, r: Session): boolean =>
  r.specific === l.specific && specBreakdownSum(r) > specBreakdownSum(l) && specBreakdownSum(r) <= r.specific

export const mergeSessions = (local: Session[], remote: Session[]): Session[] =>
  mergeById(local, remote, recoversBreakdown)
export const mergeCompetitions = (local: Competition[], remote: Competition[]): Competition[] =>
  mergeById(local, remote)
export const mergePromotions = (local: Promotion[], remote: Promotion[]): Promotion[] =>
  mergeById(local, remote)

export function mergeAppData(d: AppData, remote: RemotePull): AppData {
  const sessions = mergeSessions(d.sessions, remote.sessions)
  const competitions = mergeCompetitions(d.competitions, remote.competitions)
  const promotions = mergePromotions(d.promotions, remote.promotions)
  const adopt = remote.state !== null && remote.state.updatedAt > d.stateUpdatedAt
  if (sessions === d.sessions && competitions === d.competitions && promotions === d.promotions && !adopt) return d
  if (!adopt || remote.state === null) return { ...d, sessions, competitions, promotions }
  return {
    ...d,
    sessions,
    competitions,
    promotions,
    focus: remote.state.focus,
    tagList: remote.state.tagList,
    settings: remote.state.settings,
    stateUpdatedAt: remote.state.updatedAt,
  }
}

// ── IO shell ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000

const baseHeaders = (): Record<string, string> => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
})

export async function pullAll(f: typeof fetch = fetch): Promise<RemotePull> {
  const get = (path: string) =>
    f(`${SUPABASE_URL}/rest/v1/${path}`, { headers: baseHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) })
  // PostgREST caps responses at 1000 rows; updated_at.desc means a
  // hypothetical overflow drops the oldest sessions, not the newest.
  const [sesRes, compRes, promoRes, stateRes] = await Promise.all([
    get(`sessions?select=*&user_id=eq.${SYNC_USER_ID}&order=updated_at.desc`),
    get(`competitions?select=*&user_id=eq.${SYNC_USER_ID}&order=updated_at.desc`),
    get(`promotions?select=*&user_id=eq.${SYNC_USER_ID}&order=updated_at.desc`),
    get(`app_state?select=*&user_id=eq.${SYNC_USER_ID}`),
  ])
  if (!sesRes.ok || !stateRes.ok) throw new Error(`sync pull ${sesRes.status}/${stateRes.status}`)
  // The competitions and promotions tables may postdate this build's schema
  // (the SQL addendum not yet run): PostgREST answers 404 for a missing table.
  // Treat exactly that as "none remote" so sessions keep syncing; anything
  // else is real.
  if (!compRes.ok && compRes.status !== 404) throw new Error(`sync pull ${compRes.status}`)
  if (!promoRes.ok && promoRes.status !== 404) throw new Error(`sync pull ${promoRes.status}`)
  const sesJson = (await sesRes.json()) as unknown
  const compJson = compRes.ok ? ((await compRes.json()) as unknown) : []
  const promoJson = promoRes.ok ? ((await promoRes.json()) as unknown) : []
  const stateJson = (await stateRes.json()) as unknown
  return {
    sessions: (Array.isArray(sesJson) ? sesJson : []).map(fromRow).filter((s): s is Session => s !== null),
    competitions: (Array.isArray(compJson) ? compJson : [])
      .map(fromCompRow)
      .filter((c): c is Competition => c !== null),
    promotions: (Array.isArray(promoJson) ? promoJson : [])
      .map(fromPromoRow)
      .filter((p): p is Promotion => p !== null),
    state: Array.isArray(stateJson) && stateJson.length > 0 ? fromStateRow(stateJson[0]) : null,
  }
}

export async function pushAll(d: AppData, f: typeof fetch = fetch): Promise<void> {
  const post = (path: string, body: unknown) =>
    f(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        ...baseHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  const rows = d.sessions.filter(isPushable).map(toRow)
  const compRows = d.competitions.filter(isPushable).map(toCompRow)
  const promoRows = d.promotions.filter(isPushable).map(toPromoRow)
  const reqs: Promise<Response>[] = []
  if (rows.length > 0) reqs.push(post('sessions?on_conflict=id', rows))
  if (d.stateUpdatedAt > 0) {
    // Never-touched local state (0) must not overwrite remote with defaults.
    reqs.push(
      post('app_state?on_conflict=user_id', [
        {
          user_id: SYNC_USER_ID,
          state: { focus: d.focus, tagList: d.tagList, settings: d.settings },
          updated_at: new Date(d.stateUpdatedAt).toISOString(),
        },
      ]),
    )
  }
  // Tracked outside `reqs`: a 404 (table not created yet) is tolerated for
  // competitions and promotions only — they stay local and upload on the
  // first push after the SQL addendum runs. Sessions/app_state stay strict.
  const compReq = compRows.length > 0 ? post('competitions?on_conflict=id', compRows) : null
  const promoReq = promoRows.length > 0 ? post('promotions?on_conflict=id', promoRows) : null
  const [strict, compRes, promoRes] = await Promise.all([Promise.all(reqs), compReq, promoReq])
  for (const res of strict) {
    if (!res.ok) throw new Error(`sync push ${res.status}`)
  }
  if (compRes !== null && !compRes.ok && compRes.status !== 404) throw new Error(`sync push ${compRes.status}`)
  if (promoRes !== null && !promoRes.ok && promoRes.status !== 404) throw new Error(`sync push ${promoRes.status}`)
}
