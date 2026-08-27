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
  // ── Guard (bottom) ──
  'closed guard': 'guard',
  'open guard': 'guard',
  'half guard': 'guard',
  'deep half': 'guard',
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
  'kimura': 'guard',
  'armbar': 'guard',
  'triangle': 'guard',
  'omoplata': 'guard',
  'hip bump': 'guard',
  'scissor sweep': 'guard',
  'flower sweep': 'guard',
  'pendulum sweep': 'guard',
  'wrestling up': 'guard',
  // ── Guard passing ──
  'passing': 'passing',
  'guard passing': 'passing',
  'guard break': 'passing',
  'knee cut': 'passing',
  'knee slice': 'passing',
  'over-under pass': 'passing',
  'over under pass': 'passing',
  'torreando': 'passing',
  'toreando': 'passing',
  'double under': 'passing',
  'leg drag': 'passing',
  'stack pass': 'passing',
  'x-pass': 'passing',
  'x pass': 'passing',
  'long step': 'passing',
  'smash pass': 'passing',
  'body lock pass': 'passing',
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
  'turtle': 'back',
  'crucifix': 'back',
  'clock choke': 'back',
  'seatbelt': 'back',
  'loop choke': 'back',
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
