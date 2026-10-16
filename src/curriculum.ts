/**
 * Technique-tag ordering by the Gracie Barra curriculum. GB teaches a
 * worldwide 16-week rotating cycle organized by position themes; week
 * numbers drift between cycle revisions, so ordering follows the canonical
 * theme sequence (standing → guard → passing → pins → back → leg locks),
 * never hard week numbers. Display-time only — the persisted tagList stays
 * append-only master data.
 */

export type CurriculumGroupId =
  | 'standing'
  | 'guard'
  | 'passing'
  | 'side'
  | 'mount'
  | 'back'
  | 'legs'
  | 'other'

export interface CurriculumGroup {
  id: CurriculumGroupId
  label: string
}

export const CURRICULUM_GROUPS: CurriculumGroup[] = [
  { id: 'standing', label: 'Standing & takedowns' },
  { id: 'guard', label: 'Guard' },
  { id: 'passing', label: 'Guard passing' },
  { id: 'side', label: 'Side control' },
  { id: 'mount', label: 'Mount & knee on belly' },
  { id: 'back', label: 'Back & turtle' },
  { id: 'legs', label: 'Leg locks' },
  { id: 'other', label: 'Other' },
]

/**
 * Exact-name lookup, case-insensitive (keys pre-lowercased). Deliberately no
 * keyword heuristics — "unknown → Other, in input order" is the only behavior
 * a user can predict, and the map is cheap to extend. Judgment calls, flagged:
 * generic "Escapes" files under Side control (GB's pin-escape rotation starts
 * there); "Half guard" under Guard (practical usage; GB1 technically teaches
 * it as side-control recovery); Darce/anaconda/guillotine under Back & turtle
 * (front-headlock family, turtle-adjacent).
 */
const TAG_GROUP: Record<string, CurriculumGroupId> = {
  // ── Standing & takedowns ──
  'takedowns': 'standing',
  'wrestling': 'standing',
  'judo': 'standing',
  'single leg': 'standing',
  'double leg': 'standing',
  'ankle pick': 'standing',
  'arm drag': 'standing',
  'snapdown': 'standing',
  'osoto gari': 'standing',
  'seoi nage': 'standing',
  'uchi mata': 'standing',
  'o goshi': 'standing',
  'hip throw': 'standing',
  'foot sweep': 'standing',
  'guard pull': 'standing',
  'grip fighting': 'standing',
  'body lock takedown': 'standing',
  'slide by': 'standing', // no-gi standing technique (owner ruling)
  // 2026-10 vocabulary harvest (GB curriculum + BJJ glossaries; see docs/curriculum.md)
  'blast double': 'standing',
  'blast double leg': 'standing',
  'high crotch': 'standing',
  'high-crotch': 'standing',
  'duck under': 'standing',
  'duckunder': 'standing',
  'duck-under': 'standing',
  "fireman's carry": 'standing',
  'firemans carry': 'standing',
  'kata guruma': 'standing',
  'knee tap': 'standing',
  'knee pick': 'standing',
  'inside trip': 'standing',
  'ouchi gari': 'standing',
  'kouchi gari': 'standing',
  'outside trip': 'standing',
  'kosoto gake': 'standing',
  'kosoto gari': 'standing',
  'harai goshi': 'standing',
  'harai-goshi': 'standing',
  'tomoe nage': 'standing',
  'yoko tomoe nage': 'standing', // side variant of tomoe nage — live tag, 2026-10
  'collar tie': 'standing',
  'collar-tie': 'standing',
  'underhook': 'standing', // ambiguous (also half-guard bottom); standing dominates as a bare tag
  'underhooks': 'standing',
  'whizzer': 'standing',
  'overhook': 'standing',
  'sprawl': 'standing',
  'technical stand up': 'standing',
  'technical standup': 'standing',
  'technical get up': 'standing',
  // ── Guard (bottom) ──
  'closed guard': 'guard',
  'open guard': 'guard',
  'half guard': 'guard',
  'deep half': 'guard',
  'half butterfly': 'guard', // a half-guard variant, NOT open guard (owner ruling, 2026-10-16)
  'guard retention': 'guard',
  'sweeps': 'guard',
  'de la riva': 'guard',
  'dlr': 'guard',
  'dlr x': 'guard',
  'x-guard': 'guard',
  'x guard': 'guard',
  'butterfly': 'guard',
  'butterfly guard': 'guard',
  'spider': 'guard',
  'spider guard': 'guard',
  'lasso': 'guard',
  'slx': 'guard', // single leg X — an open guard (owner ruling, 2026-10)
  'single leg x': 'guard',
  'top lock': 'guard', // a closed-guard variant despite the name — NOT top control (owner ruling)
  'side scissors': 'guard', // closed-guard improved position (owner ruling)
  '2on1 from closed guard': 'guard', // the closed-guard arm drag — distinct from standing 'arm drag' (owner ruling)
  '2 on 1 from closed guard': 'guard',
  '2-on-1 from closed guard': 'guard',
  'pendulum': 'guard',
  'kimura': 'guard',
  'armbar': 'guard',
  'triangle': 'guard',
  'omoplata': 'guard',
  'hip bump': 'guard',
  'scissor sweep': 'guard',
  'flower sweep': 'guard',
  'pendulum sweep': 'guard',
  'wrestling up': 'guard',
  'k-guard': 'guard',
  'k guard': 'guard',
  'z-guard': 'guard',
  'z guard': 'guard',
  'knee shield': 'guard',
  'reverse de la riva': 'guard',
  'rdlr': 'guard',
  'reverse dlr': 'guard',
  'rubber guard': 'guard',
  'worm guard': 'guard',
  'lapel guard': 'guard',
  'lapel guards': 'guard',
  '93 guard': 'guard',
  'ninety three guard': 'guard',
  'shin to shin': 'guard',
  'shin-to-shin': 'guard',
  'shin on shin': 'guard',
  'collar sleeve': 'guard',
  'collar and sleeve': 'guard',
  'lockdown': 'guard',
  'electric chair': 'guard',
  'berimbolo': 'guard',
  'bolo': 'guard',
  'tripod sweep': 'guard',
  'lumberjack sweep': 'guard',
  'waiter sweep': 'guard',
  'muscle sweep': 'guard',
  'old school': 'guard',
  'old school sweep': 'guard',
  'butterfly sweep': 'guard',
  'hook sweep': 'guard',
  'elevator sweep': 'guard',
  'sit up sweep': 'guard',
  'situp sweep': 'guard',
  'sit-up sweep': 'guard',
  'gogoplata': 'guard',
  'wrist lock': 'guard', // hit from everywhere; guard chains dominate tagging
  'wristlock': 'guard',
  'wrist locks': 'guard',
  'guard recovery': 'guard',
  'granby roll': 'guard', // retention inversion (also a turtle escape; guard usage dominates)
  'granby': 'guard',
  // ── Guard passing ──
  'passing': 'passing',
  'guard passing': 'passing',
  'guard break': 'passing',
  'opening closed guard': 'passing', // = guard break; GB teaches it in the guard-top weeks — live tag
  'knee cut': 'passing',
  'knee slice': 'passing',
  'over-under pass': 'passing',
  'over under pass': 'passing',
  'torreando': 'passing',
  'toreando': 'passing',
  'double under': 'passing',
  'double under pass': 'passing',
  'long step pass': 'passing',
  'leg drag': 'passing',
  'stack pass': 'passing',
  'x-pass': 'passing',
  'x pass': 'passing',
  'long step': 'passing',
  'smash pass': 'passing',
  'body lock pass': 'passing',
  'folding pass': 'passing',
  'knee compression pass': 'passing',
  'hip switch': 'passing',
  'hip switch pass': 'passing',
  'headquarters': 'passing',
  'hq': 'passing',
  'head quarters': 'passing',
  'float pass': 'passing',
  'floating pass': 'passing',
  'backstep': 'passing', // also a leg-entry motion; chiefly the half-guard backstep pass
  'back step': 'passing',
  'bullfighter': 'passing',
  'bullfighter pass': 'passing',
  'matador pass': 'passing',
  'half guard pass': 'passing',
  'half guard passing': 'passing',
  'pressure passing': 'passing',
  'pressure pass': 'passing',
  'weave pass': 'passing',
  'arm weave pass': 'passing',
  'leg weave': 'passing',
  'sao paulo pass': 'passing',
  'tozi pass': 'passing',
  // ── Side control ──
  'side control': 'side',
  'escapes': 'side',
  'north south': 'side',
  'north-south': 'side',
  'shrimp': 'side',
  'elbow escape': 'side',
  'americana': 'side',
  'kesa gatame': 'side',
  'paper cutter': 'side',
  'crossface': 'side',
  'scarf hold': 'side',
  'scarf hold control': 'side',
  'reverse kesa gatame': 'side',
  'reverse kesa': 'side',
  'reverse scarf hold': 'side',
  'north south choke': 'side',
  'north-south choke': 'side',
  'bread cutter': 'side',
  'bread cutter choke': 'side',
  'buggy choke': 'side', // attacked FROM BOTTOM side control — not top control
  'ghost escape': 'side',
  'running escape': 'side',
  'running man escape': 'side',
  // ── Mount & knee on belly ──
  'mount': 'mount',
  'mount attacks': 'mount',
  'mount escapes': 'mount',
  'technical mount': 'mount',
  'knee on belly': 'mount',
  'kob': 'mount',
  'ezekiel': 'mount',
  's-mount': 'mount',
  'upa': 'mount',
  'cross collar choke': 'mount',
  'arm triangle': 'mount',
  'head and arm choke': 'mount',
  'kata gatame': 'mount',
  'mounted triangle': 'mount',
  'triangle from mount': 'mount',
  'baseball bat choke': 'mount',
  'baseball choke': 'mount',
  'gift wrap': 'mount',
  'giftwrap': 'mount',
  'monoplata': 'mount',
  // ── Back & turtle ──
  'back takes': 'back',
  'back control': 'back',
  'back attacks': 'back',
  'back escapes': 'back',
  'rnc': 'back',
  'rear naked choke': 'back',
  'bow and arrow': 'back',
  'darce': 'back',
  "d'arce": 'back',
  'anaconda': 'back',
  'guillotine': 'back',
  'front headlock': 'back',
  'cow catcher': 'back', // front-headlock control from the top — live tag; also feeds Top control
  'turtle': 'back',
  'turtle defense': 'back', // bottom-side turtle work — back & turtle theme, not top control
  'crucifix': 'back',
  'clock choke': 'back',
  'seatbelt': 'back',
  'loop choke': 'back',
  'peruvian necktie': 'back',
  'japanese necktie': 'back',
  'arm in guillotine': 'back',
  'arm-in guillotine': 'back',
  'body triangle': 'back',
  'straight jacket': 'back',
  'straitjacket': 'back',
  'straight jacket system': 'back',
  'rear triangle': 'back',
  'back triangle': 'back',
  'truck': 'back',
  'the truck': 'back',
  'twister': 'back',
  'turtle attacks': 'back',
  'turtle top': 'back',
  'turtle escapes': 'back',
  'turtle bottom': 'back',
  'rear mount': 'back',
  'back mount': 'back',
  // ── Leg locks ──
  'leg locks': 'legs',
  'leglocks': 'legs',
  'heel hook': 'legs',
  'kneebar': 'legs',
  'ankle lock': 'legs',
  'straight ankle lock': 'legs',
  'footlock': 'legs',
  'toe hold': 'legs',
  'ashi garami': 'legs',
  'saddle': 'legs',
  '50/50': 'legs',
  'leg entanglements': 'legs',
  'inside heel hook': 'legs',
  'outside heel hook': 'legs',
  'outside ashi': 'legs',
  'double outside ashi': 'legs',
  'inside sankaku': 'legs',
  'inside senkaku': 'legs',
  '411': 'legs',
  '4-11': 'legs',
  'honey hole': 'legs',
  'honeyhole': 'legs',
  'false reap': 'legs',
  'knee reap': 'legs',
  'reap': 'legs',
  'reaping': 'legs',
  '80/20': 'legs',
  '80-20': 'legs',
  'backside 50/50': 'legs',
  'back side 50/50': 'legs',
  'estima lock': 'legs',
  'calf slicer': 'legs',
  'calf crank': 'legs',
  'calf cutter': 'legs',
}

/**
 * The open-guard family — the explicit whitelist behind the "used open guard
 * in competition" milestone (closed guard and half guard deliberately
 * excluded; same no-heuristics policy as TAG_GROUP).
 */
const OPEN_GUARD_TAGS = new Set([
  'open guard',
  'slx',
  'single leg x',
  'de la riva',
  'dlr',
  'dlr x',
  'spider',
  'spider guard',
  'lasso',
  'butterfly',
  'butterfly guard',
  'x-guard',
  'x guard',
  'deep half',
  'k-guard',
  'k guard',
  'reverse de la riva',
  'rdlr',
  'reverse dlr',
  'worm guard',
  'lapel guard',
  'lapel guards',
  '93 guard',
  'ninety three guard',
  'shin to shin',
  'shin-to-shin',
  'shin on shin',
  'collar sleeve',
  'collar and sleeve',
  'berimbolo',
  'bolo',
])

export function isOpenGuardTag(tag: string): boolean {
  return OPEN_GUARD_TAGS.has(tag.trim().toLowerCase())
}

export function groupOfTag(tag: string): CurriculumGroupId {
  return TAG_GROUP[tag.trim().toLowerCase()] ?? 'other'
}

export interface CurriculumSection {
  group: CurriculumGroupId
  label: string
  tags: string[]
}

/** Non-empty groups in curriculum order; input order preserved within a group. */
export function groupTagsByCurriculum(tags: string[]): CurriculumSection[] {
  const byGroup = new Map<CurriculumGroupId, string[]>()
  for (const t of tags) {
    const g = groupOfTag(t)
    const list = byGroup.get(g)
    if (list) list.push(t)
    else byGroup.set(g, [t])
  }
  return CURRICULUM_GROUPS.filter((g) => byGroup.has(g.id)).map((g) => ({
    group: g.id,
    label: g.label,
    tags: byGroup.get(g.id)!,
  }))
}

/** Flat curriculum order — stable within groups; unknown tags last in input order. */
export function orderTagsByCurriculum(tags: string[]): string[] {
  return groupTagsByCurriculum(tags).flatMap((s) => s.tags)
}
