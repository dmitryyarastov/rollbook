/**
 * The technique-tag vocabulary: canonical spellings, the aliases that fold
 * into them, and the two-level hierarchy every tag hangs from. The top level
 * is the owner's own map of the game (2026-10-28, replacing the Gracie Barra
 * position groups the module started with): Standing & takedowns → Guard →
 * Guard passing → Top control → Escapes & defense → Leg locks, with Other
 * trailing for unmapped tags. Sub-groups sit under a branch only where his
 * tags cluster; a tag without one hangs directly from its branch.
 *
 * Two jobs, both pure: display-time ordering (the persisted tagList stays
 * append-only master data in input order) and canonicalization — a pure,
 * idempotent fold of spelling variants into one name, applied where data
 * enters the app (store.load, the pull sanitizers, the save paths), never
 * as a stored migration. Exact-name lookup only, no keyword heuristics:
 * "unknown → Other, in input order, spelled as typed" is the only behavior a
 * user can predict, and the vocabulary is cheap to extend.
 */

export type CurriculumGroupId = 'standing' | 'guard' | 'passing' | 'top' | 'escapes' | 'legs' | 'other'

export type CurriculumSubgroupId =
  | 'wrestling'
  | 'judo'
  | 'closed-guard'
  | 'open-guard'
  | 'half-guard'
  | 'pressure-passing'
  | 'dynamic-passing'
  | 'opening-closed-guard'
  | 'side-control'
  | 'mount-kob'
  | 'back-turtle'
  | 'turtle-defense'

export interface CurriculumGroup {
  id: CurriculumGroupId
  label: string
}

export interface CurriculumSubgroup {
  id: CurriculumSubgroupId
  group: CurriculumGroupId
  label: string
}

/** The branches, in display order — the owner's game map (2026-10-28). */
export const CURRICULUM_GROUPS: CurriculumGroup[] = [
  { id: 'standing', label: 'Standing & takedowns' },
  { id: 'guard', label: 'Guard' },
  { id: 'passing', label: 'Guard passing' },
  { id: 'top', label: 'Top control' },
  // Owner ruling 2026-10-30: renamed from "Escapes" — the branch holds the
  // whole bottom game, defending the turtle included. The id stays 'escapes'.
  { id: 'escapes', label: 'Escapes & defense' },
  { id: 'legs', label: 'Leg locks' },
  { id: 'other', label: 'Other' },
]

/** The sub-groups, in display order within their branch. Other and Leg locks are flat. */
export const CURRICULUM_SUBGROUPS: CurriculumSubgroup[] = [
  { id: 'wrestling', group: 'standing', label: 'Wrestling' },
  { id: 'judo', group: 'standing', label: 'Judo' },
  { id: 'closed-guard', group: 'guard', label: 'Closed guard' },
  { id: 'open-guard', group: 'guard', label: 'Open guard' },
  { id: 'half-guard', group: 'guard', label: 'Half guard' },
  { id: 'pressure-passing', group: 'passing', label: 'Pressure passing' },
  { id: 'dynamic-passing', group: 'passing', label: 'Dynamic passing' },
  { id: 'opening-closed-guard', group: 'passing', label: 'Opening closed guard' },
  { id: 'side-control', group: 'top', label: 'Side control' },
  { id: 'mount-kob', group: 'top', label: 'Mount & knee on belly' },
  { id: 'back-turtle', group: 'top', label: 'Back & turtle' },
  { id: 'turtle-defense', group: 'escapes', label: 'Turtle defense' },
]

/** Where a mapped tag hangs: directly from a branch, or in one of its sub-groups. */
export type CurriculumPlace = Exclude<CurriculumGroupId, 'other'> | CurriculumSubgroupId

export interface TagDef {
  /** The canonical spelling — what the app stores and shows. */
  name: string
  place: CurriculumPlace
  /** Other spellings that fold into `name` (matched trimmed + lowercased). */
  aliases?: readonly string[]
}

const t = (name: string, place: CurriculumPlace, aliases?: readonly string[]): TagDef =>
  aliases ? { name, place, aliases } : { name, place }

/**
 * The vocabulary. Canonical names are sentence case (proper nouns keep their
 * capitals: De La Riva, DLR X); the owner's live tags were normalized on
 * 2026-10-28 (Closed Guard → Closed guard, SLX → Single leg X, 2on1 from
 * closed guard → 2-on-1 from closed guard, Pendulum → Pendulum sweep, …) and
 * every old spelling stays an alias so stored rows, the focus tag and the
 * whitelists keep resolving. Owner rulings are flagged inline; the rest is
 * the 2026-10 vocabulary harvest (GB curriculum pages + BJJ glossaries, see
 * docs/curriculum.md), re-homed into his branches. Exported for the
 * vocabulary tests only — the app reads it through the functions below.
 */
export const TAG_DEFS: readonly TagDef[] = [
  // ── Standing & takedowns ──
  t('Takedowns', 'standing'),
  t('Guard pull', 'standing'),
  t('Grip fighting', 'standing'),
  t('Technical stand up', 'standing', ['technical standup', 'technical get up']),
  // Wrestling
  t('Wrestling', 'wrestling'),
  // Live tag — sat in Other until the owner moved it to Standing (2026-10-27).
  t('Single leg takedown', 'wrestling', ['single leg', 'single-leg', 'single-leg takedown']),
  t('Double leg takedown', 'wrestling', ['double leg', 'double-leg', 'double-leg takedown']),
  t('Ankle pick', 'wrestling'),
  // The standing arm drag; the closed-guard one is its own tag (owner ruling, 2026-10-16).
  t('Arm drag', 'wrestling'),
  t('Snapdown', 'wrestling'),
  t('Blast double', 'wrestling', ['blast double leg']),
  t('High crotch', 'wrestling', ['high-crotch']),
  t('Duck under', 'wrestling', ['duckunder', 'duck-under']),
  t("Fireman's carry", 'wrestling', ['firemans carry']),
  t('Knee tap', 'wrestling'),
  t('Knee pick', 'wrestling'),
  t('Inside trip', 'wrestling'),
  t('Outside trip', 'wrestling'),
  t('Collar tie', 'wrestling', ['collar-tie']),
  t('Underhook', 'wrestling', ['underhooks']), // ambiguous (also half-guard bottom); standing dominates as a bare tag
  t('Whizzer', 'wrestling'),
  t('Overhook', 'wrestling'),
  t('Sprawl', 'wrestling'),
  t('Body lock takedown', 'wrestling'),
  t('Slide by', 'wrestling'), // no-gi standing technique (owner ruling, 2026-10)
  // Owner ruling 2026-10-27: a front-headlock entry off the feet, so standing
  // work for him (moved from Back & turtle). Still in TOP_CONTROL_TAGS
  // (src/xp.ts), so it feeds Top control AND the gi-split standing attributes.
  t('Cow catcher', 'wrestling'),
  // Judo
  t('Judo', 'judo'),
  t('Osoto gari', 'judo'),
  t('Seoi nage', 'judo'),
  t('Uchi mata', 'judo'),
  t('O goshi', 'judo'),
  t('Hip throw', 'judo'),
  t('Foot sweep', 'judo'),
  t('Kata guruma', 'judo'),
  t('Ouchi gari', 'judo'),
  t('Kouchi gari', 'judo'),
  t('Kosoto gake', 'judo'),
  t('Kosoto gari', 'judo'),
  t('Harai goshi', 'judo', ['harai-goshi']),
  t('Tomoe nage', 'judo'), // live tag (2026-10-27); the side variant below stays a separate tag
  t('Yoko tomoe nage', 'judo'),

  // ── Guard ──
  // Generic attacks and sweeps hang directly from Guard: they are hit from
  // several guards, so they stay generic leaves (owner ruling, 2026-10-28).
  t('Guard retention', 'guard', ['retention']),
  t('Guard recovery', 'guard'),
  t('Granby roll', 'guard', ['granby']), // retention inversion (also a turtle escape; guard usage dominates)
  t('Sweeps', 'guard'),
  t('Lumberjack sweep', 'guard'),
  t('Kimura', 'guard'),
  t('Armbar', 'guard', ['arm bar']),
  t('Triangle', 'guard', ['triangle choke']),
  t('Omoplata', 'guard'),
  t('Gogoplata', 'guard'),
  t('Wrist lock', 'guard', ['wristlock', 'wrist locks']), // hit from everywhere; guard chains dominate tagging
  t('Wrestling up', 'guard', ['wrestle up']),
  // Closed guard
  t('Closed guard', 'closed-guard'),
  t('Top lock', 'closed-guard'), // a closed-guard variant despite the name — NOT top control (owner ruling)
  t('Side scissors', 'closed-guard'), // closed-guard improved position (owner ruling)
  // The closed-guard arm drag — distinct from the standing 'Arm drag' (owner ruling, 2026-10-16).
  t('2-on-1 from closed guard', 'closed-guard', ['2on1 from closed guard', '2 on 1 from closed guard']),
  t('Pendulum sweep', 'closed-guard', ['pendulum']),
  t('Flower sweep', 'closed-guard'),
  t('Hip bump', 'closed-guard', ['hip bump sweep']),
  t('Scissor sweep', 'closed-guard'),
  t('Sit up sweep', 'closed-guard', ['situp sweep', 'sit-up sweep']),
  t('Muscle sweep', 'closed-guard'),
  t('Rubber guard', 'closed-guard'), // closed-guard system — not open guard
  // Open guard
  t('Open guard', 'open-guard'),
  t('De La Riva', 'open-guard', ['dlr', 'de la riva guard']),
  t('DLR X', 'open-guard', ['deep dlr', 'deep de la riva']),
  t('Single leg X', 'open-guard', ['slx', 'single leg x guard']), // an open guard (owner ruling, 2026-10)
  t('X-guard', 'open-guard', ['x guard']),
  t('Butterfly guard', 'open-guard', ['butterfly']),
  t('Spider guard', 'open-guard', ['spider']),
  t('Lasso', 'open-guard', ['lasso guard']),
  t('K-guard', 'open-guard', ['k guard']),
  t('Reverse De La Riva', 'open-guard', ['rdlr', 'reverse dlr']),
  t('Worm guard', 'open-guard'),
  t('Lapel guard', 'open-guard', ['lapel guards']),
  t('93 guard', 'open-guard', ['ninety three guard']),
  t('Shin to shin', 'open-guard', ['shin-to-shin', 'shin on shin']),
  t('Collar sleeve', 'open-guard', ['collar and sleeve']),
  t('Berimbolo', 'open-guard', ['bolo']),
  t('Tripod sweep', 'open-guard'),
  t('Butterfly sweep', 'open-guard'),
  t('Hook sweep', 'open-guard'),
  t('Elevator sweep', 'open-guard'),
  // Half guard — practical usage (GB1 technically teaches it as side-control recovery)
  t('Half guard', 'half-guard'),
  t('Deep half', 'half-guard', ['deep half guard']),
  t('Half butterfly', 'half-guard', ['half-butterfly']), // a half-guard variant, NOT open guard (owner ruling, 2026-10-16)
  t('Z-guard', 'half-guard', ['z guard']), // half-guard family — not open guard
  t('Knee shield', 'half-guard'),
  t('Lockdown', 'half-guard'),
  t('Electric chair', 'half-guard'),
  t('Old school', 'half-guard', ['old school sweep']),
  t('Waiter sweep', 'half-guard'),

  // ── Guard passing ──
  t('Passing', 'passing', ['guard passing']),
  // Pressure passing
  t('Pressure passing', 'pressure-passing', ['pressure pass']),
  t('Over-under pass', 'pressure-passing', ['over under pass', 'over-under', 'over under']),
  t('Double under pass', 'pressure-passing', ['double under']),
  t('Smash pass', 'pressure-passing'),
  t('Stack pass', 'pressure-passing'),
  t('Body lock pass', 'pressure-passing'),
  t('Half guard pass', 'pressure-passing', ['half guard passing']),
  t('Weave pass', 'pressure-passing', ['arm weave pass']),
  t('Leg weave', 'pressure-passing'),
  t('Sao Paulo pass', 'pressure-passing', ['tozi pass']),
  t('Knee compression pass', 'pressure-passing'),
  t('Folding pass', 'pressure-passing'),
  // Dynamic passing
  t('Knee cut', 'dynamic-passing', ['knee slice']),
  t('Long step pass', 'dynamic-passing', ['long step']),
  t('Toreando', 'dynamic-passing', ['torreando', 'bullfighter', 'bullfighter pass', 'matador pass']),
  t('Leg drag', 'dynamic-passing'),
  t('X-pass', 'dynamic-passing', ['x pass']),
  t('Float pass', 'dynamic-passing', ['floating pass']),
  t('Backstep', 'dynamic-passing', ['back step']), // also a leg-entry motion; chiefly the half-guard backstep pass
  t('Hip switch', 'dynamic-passing', ['hip switch pass']),
  t('Headquarters', 'dynamic-passing', ['hq', 'head quarters']),
  // Opening closed guard — live tag; = guard break, taught in the guard-top weeks
  t('Opening closed guard', 'opening-closed-guard', ['guard break']),

  // ── Top control ── (pins and the back, worked from top)
  // Side control
  t('Side control', 'side-control'),
  t('North south', 'side-control', ['north-south']),
  t('Americana', 'side-control'),
  t('Kesa gatame', 'side-control', ['scarf hold', 'scarf hold control']),
  t('Reverse kesa gatame', 'side-control', ['reverse kesa', 'reverse scarf hold']),
  t('Paper cutter', 'side-control', ['paper cutter choke']),
  t('Crossface', 'side-control'),
  t('North south choke', 'side-control', ['north-south choke']),
  t('Bread cutter', 'side-control', ['bread cutter choke']),
  // Mount & knee on belly
  t('Mount', 'mount-kob'),
  t('Mount attacks', 'mount-kob'),
  t('Technical mount', 'mount-kob'),
  t('Knee on belly', 'mount-kob', ['kob']),
  t('Ezekiel', 'mount-kob'),
  t('S-mount', 'mount-kob'),
  t('Cross collar choke', 'mount-kob'),
  t('Arm triangle', 'mount-kob', ['head and arm choke', 'kata gatame']),
  t('Mounted triangle', 'mount-kob', ['triangle from mount']),
  t('Baseball bat choke', 'mount-kob', ['baseball choke']),
  t('Gift wrap', 'mount-kob', ['giftwrap']),
  t('Monoplata', 'mount-kob'),
  // Back & turtle — back control, turtle top, and the front-headlock family
  // (turtle-adjacent, so Darce/anaconda/guillotine file here, not under side control)
  t('Back takes', 'back-turtle', ['back take']),
  t('Back control', 'back-turtle', ['rear mount', 'back mount']),
  t('Back attacks', 'back-turtle'),
  t('Rear naked choke', 'back-turtle', ['rnc']),
  t('Bow and arrow', 'back-turtle', ['bow and arrow choke']),
  t('Seatbelt', 'back-turtle'),
  t('Body triangle', 'back-turtle'),
  t('Straight jacket', 'back-turtle', ['straitjacket', 'straight jacket system']),
  t('Rear triangle', 'back-turtle', ['back triangle']),
  t('Crucifix', 'back-turtle'),
  t('Clock choke', 'back-turtle'),
  t('Loop choke', 'back-turtle'),
  t('Darce', 'back-turtle', ["d'arce"]),
  t('Anaconda', 'back-turtle'),
  t('Guillotine', 'back-turtle'),
  t('Arm in guillotine', 'back-turtle', ['arm-in guillotine']),
  t('Front headlock', 'back-turtle'),
  t('Peruvian necktie', 'back-turtle'),
  t('Japanese necktie', 'back-turtle'),
  t('Turtle', 'back-turtle'),
  t('Turtle attacks', 'back-turtle', ['turtle top']),
  t('Truck', 'back-turtle', ['the truck']),
  t('Twister', 'back-turtle'),

  // ── Escapes & defense ── (the bottom game: surviving and escaping the pins,
  // the back and the turtle; the turtle work has its own sub-group)
  t('Escapes', 'escapes'), // the generic tag — his most-used bottom tag, so the branch exists for it
  t('Shrimp', 'escapes'),
  t('Elbow escape', 'escapes'),
  t('Mount escapes', 'escapes'),
  t('Upa', 'escapes'),
  t('Back escapes', 'escapes'),
  t('Ghost escape', 'escapes'),
  t('Running escape', 'escapes', ['running man escape']),
  t('Buggy choke', 'escapes'), // attacked FROM BOTTOM side control — bottom game, never top control
  // Turtle defense — bottom-side turtle work, never top control (owner ruling)
  t('Turtle defense', 'turtle-defense', ['turtle bottom', 'turtle escapes']),
  // Owner ruling 2026-10-30: defending from turtle, so bottom work under Turtle
  // defense (2026-10-28 had it under Top control › Back & turtle; it sat in
  // Other before that). Deliberately absent from TOP_CONTROL_TAGS (src/xp.ts).
  t('Panda', 'turtle-defense'),

  // ── Leg locks ── (flat: the advanced tail of the cycle)
  t('Leg locks', 'legs', ['leglocks']),
  t('Heel hook', 'legs'),
  t('Inside heel hook', 'legs'),
  t('Outside heel hook', 'legs'),
  t('Kneebar', 'legs', ['knee bar']),
  t('Ankle lock', 'legs', ['straight ankle lock', 'footlock']),
  t('Toe hold', 'legs'),
  t('Ashi garami', 'legs'),
  t('Saddle', 'legs', ['inside sankaku', 'inside senkaku', '411', '4-11', 'honey hole', 'honeyhole']),
  t('50/50', 'legs'),
  t('Backside 50/50', 'legs', ['back side 50/50']),
  t('Outside ashi', 'legs'),
  t('Double outside ashi', 'legs'),
  t('Leg entanglements', 'legs'),
  t('Knee reap', 'legs', ['reap', 'reaping', 'false reap']),
  t('80/20', 'legs', ['80-20']),
  t('Estima lock', 'legs'),
  t('Calf slicer', 'legs', ['calf crank', 'calf cutter']),
]

const norm = (tag: string) => tag.trim().toLowerCase()

const SUBGROUP_BY_ID = new Map<CurriculumSubgroupId, CurriculumSubgroup>(CURRICULUM_SUBGROUPS.map((s) => [s.id, s]))

/** Normalized spelling (name or alias) → definition. First declaration wins; a test pins uniqueness. */
const DEF_BY_KEY = new Map<string, TagDef>()
for (const def of TAG_DEFS) {
  for (const key of [def.name, ...(def.aliases ?? [])]) {
    const k = norm(key)
    if (!DEF_BY_KEY.has(k)) DEF_BY_KEY.set(k, def)
  }
}

/**
 * The open-guard family — the explicit whitelist behind the "used open guard
 * in competition" milestone (closed guard and half guard deliberately
 * excluded). A separate declaration from the Open guard sub-group on
 * purpose: deep half sits under Half guard in the tree yet counts here, and
 * the milestone's meaning must not drift with tree housekeeping. Same
 * no-heuristics policy: exact membership of the normalized tag, aliases
 * listed so unfolded spellings still match.
 */
const OPEN_GUARD_TAGS = new Set([
  'open guard',
  'slx',
  'single leg x',
  'single leg x guard',
  'de la riva',
  'de la riva guard',
  'dlr',
  'dlr x',
  'deep dlr',
  'deep de la riva',
  'spider',
  'spider guard',
  'lasso',
  'lasso guard',
  'butterfly',
  'butterfly guard',
  'x-guard',
  'x guard',
  'deep half',
  'deep half guard',
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
  return OPEN_GUARD_TAGS.has(norm(tag))
}

/**
 * The canonical spelling of a tag: a known name or alias folds to its
 * definition's name; an unknown tag is kept as typed, trimmed. Idempotent —
 * canonicalTag(canonicalTag(x)) === canonicalTag(x) for every x.
 */
export function canonicalTag(tag: string): string {
  return DEF_BY_KEY.get(norm(tag))?.name ?? tag.trim()
}

/**
 * Canonical, deduplicated tag array for a stored row or list: non-strings
 * and blanks are dropped, every member is folded through `canonicalTag`, and
 * two spellings of one tag keep the first position only. Order preserved.
 */
export function canonicalTags(tags: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = canonicalTag(raw)
    if (tag === '') continue
    const k = norm(tag)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(tag)
  }
  return out
}

/** Where a tag hangs: a branch or sub-group id, or 'other' when unmapped. */
export function placeOfTag(tag: string): CurriculumPlace | 'other' {
  return DEF_BY_KEY.get(norm(tag))?.place ?? 'other'
}

/** The branch a place belongs to (a sub-group's parent, or the branch itself). */
export function groupOfPlace(place: CurriculumPlace | 'other'): CurriculumGroupId {
  return SUBGROUP_BY_ID.get(place as CurriculumSubgroupId)?.group ?? (place as CurriculumGroupId)
}

export function groupOfTag(tag: string): CurriculumGroupId {
  return groupOfPlace(placeOfTag(tag))
}

/** The tag's sub-group, or null when it hangs directly from its branch (or is unmapped). */
export function subgroupOfTag(tag: string): CurriculumSubgroupId | null {
  const place = placeOfTag(tag)
  return SUBGROUP_BY_ID.has(place as CurriculumSubgroupId) ? (place as CurriculumSubgroupId) : null
}

export interface CurriculumSubsection {
  subgroup: CurriculumSubgroupId
  label: string
  tags: string[]
}

export interface CurriculumSection {
  group: CurriculumGroupId
  label: string
  /** Tags hanging directly from the branch, input order. */
  tags: string[]
  /** Non-empty sub-groups only, in CURRICULUM_SUBGROUPS order; input order within each. */
  subsections: CurriculumSubsection[]
}

/**
 * Non-empty branches in curriculum order, each with its direct tags and its
 * non-empty sub-groups; input order preserved within every list, and the
 * caller's spellings kept (ordering is a lens, not a fold).
 */
export function groupTagsByCurriculum(tags: string[]): CurriculumSection[] {
  const byPlace = new Map<CurriculumPlace | 'other', string[]>()
  for (const tag of tags) {
    const place = placeOfTag(tag)
    const list = byPlace.get(place)
    if (list) list.push(tag)
    else byPlace.set(place, [tag])
  }
  const sections: CurriculumSection[] = []
  for (const g of CURRICULUM_GROUPS) {
    const direct = byPlace.get(g.id) ?? []
    const subsections: CurriculumSubsection[] = []
    for (const s of CURRICULUM_SUBGROUPS) {
      if (s.group !== g.id) continue
      const list = byPlace.get(s.id)
      if (list) subsections.push({ subgroup: s.id, label: s.label, tags: list })
    }
    if (direct.length === 0 && subsections.length === 0) continue
    sections.push({ group: g.id, label: g.label, tags: direct, subsections })
  }
  return sections
}

/** Flat curriculum order — a branch's direct tags, then its sub-groups in order; unknown tags last in input order. */
export function orderTagsByCurriculum(tags: string[]): string[] {
  return groupTagsByCurriculum(tags).flatMap((s) => [...s.tags, ...s.subsections.flatMap((sub) => sub.tags)])
}
