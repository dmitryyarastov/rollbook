import { describe, expect, it } from 'vitest'
import {
  CURRICULUM_GROUPS,
  CURRICULUM_SUBGROUPS,
  TAG_DEFS,
  canonicalTag,
  canonicalTags,
  groupOfTag,
  groupTagsByCurriculum,
  isOpenGuardTag,
  orderTagsByCurriculum,
  placeOfTag,
  subgroupOfTag,
} from './curriculum'
import { DEFAULT_TAGS } from './store'

/** The real synced tagList as of 2026-08 — the order tags were added, in their original spellings. */
const REAL_TAGS = [
  'Half guard', 'Guard retention', 'Knee cut', 'Kimura', 'De La Riva', 'Leg locks',
  'Sweeps', 'Passing', 'Darce', 'Mount attacks', 'Back takes', 'Escapes', 'DLR X',
  'Over-Under Pass', 'Side Control', 'Closed Guard', 'Mount',
]

/** The live vocabulary on 2026-10-28 (41 tags, exact spellings before the rename). */
const LIVE_TAGS_2026_10_28 = [
  ...REAL_TAGS,
  'Long step pass', 'Top Lock', 'Turtle defense', 'Arm drag', 'Slide by', 'Armbar', 'Double Under Pass',
  'Triangle', 'Half Butterfly', 'Pendulum', 'Side Scissors', 'SLX', 'Cow catcher', 'Opening Closed Guard',
  'Yoko Tomoe Nage', '2on1 from closed guard', 'Single leg takedown', 'Smash Pass', 'Gift wrap',
  'Lumberjack sweep', 'Tomoe Nage', 'Spider Guard', 'Panda', 'Roll through defense',
]

describe('orderTagsByCurriculum', () => {
  it('orders the real tag list by branch, direct tags before sub-groups, input order within each', () => {
    expect(orderTagsByCurriculum(REAL_TAGS)).toEqual([
      // guard: direct (generic attacks and sweeps), then closed › open › half
      'Guard retention', 'Kimura', 'Sweeps', 'Closed Guard', 'De La Riva', 'DLR X', 'Half guard',
      // passing: direct, then pressure › dynamic
      'Passing', 'Over-Under Pass', 'Knee cut',
      // top control: side › mount › back & turtle
      'Side Control', 'Mount attacks', 'Mount', 'Darce', 'Back takes',
      // escapes
      'Escapes',
      // leg locks
      'Leg locks',
    ])
  })

  it('puts unknown tags last, preserving input order', () => {
    expect(orderTagsByCurriculum(['Wristlocks', 'Half guard', 'My weird drill'])).toEqual([
      'Half guard', 'Wristlocks', 'My weird drill',
    ])
  })

  it('matches case-insensitively and trims, keeping the caller spelling in the output', () => {
    expect(orderTagsByCurriculum(['closed guard', 'DLR x', '  Kimura '])).toEqual([
      '  Kimura ', 'closed guard', 'DLR x',
    ])
    expect(groupOfTag('closed guard')).toBe('guard')
    expect(groupOfTag('DLR x')).toBe('guard')
    expect(groupOfTag('  Kimura ')).toBe('guard')
  })

  it('keeps relative order within a place regardless of other groups in between', () => {
    expect(orderTagsByCurriculum(['Sweeps', 'Passing', 'Kimura', 'Mount'])).toEqual([
      'Sweeps', 'Kimura', 'Passing', 'Mount',
    ])
  })

  it('returns [] for empty input', () => {
    expect(orderTagsByCurriculum([])).toEqual([])
  })
})

describe('groupTagsByCurriculum', () => {
  it('returns only non-empty branches and sub-groups, in curriculum order, with labels', () => {
    const sections = groupTagsByCurriculum(['Leg locks', 'Kimura', 'Double leg', 'Top lock', 'Closed guard'])
    expect(sections).toEqual([
      {
        group: 'standing',
        label: 'Standing & takedowns',
        tags: [],
        subsections: [{ subgroup: 'wrestling', label: 'Wrestling', tags: ['Double leg'] }],
      },
      {
        group: 'guard',
        label: 'Guard',
        tags: ['Kimura'],
        subsections: [{ subgroup: 'closed-guard', label: 'Closed guard', tags: ['Top lock', 'Closed guard'] }],
      },
      { group: 'legs', label: 'Leg locks', tags: ['Leg locks'], subsections: [] },
    ])
  })

  it('returns [] for empty input', () => {
    expect(groupTagsByCurriculum([])).toEqual([])
  })

  it("branch ids and labels stay in the owner's game-map sequence (2026-10-28)", () => {
    expect(CURRICULUM_GROUPS.map((g) => g.id)).toEqual([
      'standing', 'guard', 'passing', 'top', 'escapes', 'legs', 'other',
    ])
    expect(CURRICULUM_GROUPS.map((g) => g.label)).toEqual([
      'Standing & takedowns', 'Guard', 'Guard passing', 'Top control', 'Escapes', 'Leg locks', 'Other',
    ])
  })

  it('sub-groups sit under their branch in display order; Escapes, Leg locks and Other are flat', () => {
    expect(CURRICULUM_SUBGROUPS.map((s) => `${s.group}/${s.id}`)).toEqual([
      'standing/wrestling', 'standing/judo',
      'guard/closed-guard', 'guard/open-guard', 'guard/half-guard',
      'passing/pressure-passing', 'passing/dynamic-passing', 'passing/opening-closed-guard',
      'top/side-control', 'top/mount-kob', 'top/back-turtle',
    ])
    for (const s of CURRICULUM_SUBGROUPS) expect(['escapes', 'legs', 'other']).not.toContain(s.group)
  })
})

describe('canonical spellings (2026-10-28 rename)', () => {
  it('folds the renamed live tags and keeps every other live spelling', () => {
    expect(canonicalTag('Closed Guard')).toBe('Closed guard')
    expect(canonicalTag('Side Control')).toBe('Side control')
    expect(canonicalTag('Over-Under Pass')).toBe('Over-under pass')
    expect(canonicalTag('Double Under Pass')).toBe('Double under pass')
    expect(canonicalTag('Smash Pass')).toBe('Smash pass')
    expect(canonicalTag('Opening Closed Guard')).toBe('Opening closed guard')
    expect(canonicalTag('Top Lock')).toBe('Top lock')
    expect(canonicalTag('Side Scissors')).toBe('Side scissors')
    expect(canonicalTag('Half Butterfly')).toBe('Half butterfly')
    expect(canonicalTag('Spider Guard')).toBe('Spider guard')
    expect(canonicalTag('Tomoe Nage')).toBe('Tomoe nage')
    expect(canonicalTag('Yoko Tomoe Nage')).toBe('Yoko tomoe nage')
    expect(canonicalTag('SLX')).toBe('Single leg X')
    expect(canonicalTag('2on1 from closed guard')).toBe('2-on-1 from closed guard')
    expect(canonicalTag('Pendulum')).toBe('Pendulum sweep')
    // proper nouns and the rest stay as they are
    for (const same of ['De La Riva', 'DLR X', 'Half guard', 'Guard retention', 'Knee cut', 'Kimura', 'Leg locks', 'Sweeps',
      'Passing', 'Darce', 'Mount attacks', 'Back takes', 'Escapes', 'Mount', 'Long step pass', 'Turtle defense', 'Arm drag',
      'Slide by', 'Armbar', 'Triangle', 'Cow catcher', 'Single leg takedown', 'Gift wrap', 'Lumberjack sweep', 'Panda'])
      expect(canonicalTag(same), same).toBe(same)
    // unknown tags keep their spelling, trimmed
    expect(canonicalTag('Roll through defense')).toBe('Roll through defense')
    expect(canonicalTag('  My weird drill ')).toBe('My weird drill')
  })

  it('is case-insensitive, trims, and folds aliases of the harvested vocabulary', () => {
    expect(canonicalTag('closed guard')).toBe('Closed guard')
    expect(canonicalTag('  KNEE CUT ')).toBe('Knee cut')
    expect(canonicalTag('knee slice')).toBe('Knee cut')
    expect(canonicalTag('dlr')).toBe('De La Riva')
    expect(canonicalTag('x guard')).toBe('X-guard')
    expect(canonicalTag("d'arce")).toBe('Darce')
    expect(canonicalTag('rnc')).toBe('Rear naked choke')
    expect(canonicalTag('kob')).toBe('Knee on belly')
    expect(canonicalTag('honey hole')).toBe('Saddle')
    expect(canonicalTag('retention')).toBe('Guard retention')
  })

  it('is idempotent over every name and alias', () => {
    for (const def of TAG_DEFS) {
      for (const spelling of [def.name, ...(def.aliases ?? [])]) {
        const once = canonicalTag(spelling)
        expect(once, spelling).toBe(def.name)
        expect(canonicalTag(once), spelling).toBe(once)
      }
    }
  })

  it('declares every spelling once — a duplicate key would silently shadow a definition', () => {
    const seen = new Map<string, string>()
    for (const def of TAG_DEFS) {
      for (const spelling of [def.name, ...(def.aliases ?? [])]) {
        const key = spelling.trim().toLowerCase()
        expect(seen.get(key), `${spelling} already declared by ${seen.get(key)}`).toBeUndefined()
        seen.set(key, def.name)
      }
      // a name is itself canonical: sentence case or a proper noun, never padded
      expect(def.name).toBe(def.name.trim())
    }
  })

  it('canonicalTags folds, drops junk and blanks, and collapses duplicates keeping the first position', () => {
    expect(canonicalTags(['SLX', 'Kimura', 'Single leg X', 7, null, '', '  ', 'kimura', 'Closed Guard'])).toEqual([
      'Single leg X', 'Kimura', 'Closed guard',
    ])
    expect(canonicalTags([])).toEqual([])
  })

  it('every default tag is already canonical and maps to a real branch, never other', () => {
    for (const t of DEFAULT_TAGS) {
      expect(canonicalTag(t), t).toBe(t)
      expect(groupOfTag(t), t).not.toBe('other')
    }
  })
})

describe('placement: judgment calls, owner rulings and the live audit', () => {
  it("files generic 'Escapes' in the Escapes branch (the bottom game has its own branch since 2026-10-28)", () => {
    expect(groupOfTag('Escapes')).toBe('escapes')
    expect(subgroupOfTag('Escapes')).toBeNull()
  })

  it("files 'Half guard' under Guard › Half guard (practical usage over GB1's side-control-recovery slot)", () => {
    expect(placeOfTag('Half guard')).toBe('half-guard')
    expect(groupOfTag('Half guard')).toBe('guard')
  })

  it("files 'Darce' under Top control › Back & turtle (front-headlock family, turtle-adjacent)", () => {
    expect(placeOfTag('Darce')).toBe('back-turtle')
    expect(groupOfTag('Darce')).toBe('top')
    expect(placeOfTag('Anaconda')).toBe('back-turtle')
    expect(placeOfTag('Guillotine')).toBe('back-turtle')
  })

  it("pins the owner's 2026-10 tag rulings", () => {
    expect(placeOfTag('SLX')).toBe('open-guard')
    expect(placeOfTag('Top lock')).toBe('closed-guard') // closed guard despite the name
    expect(placeOfTag('Side scissors')).toBe('closed-guard')
    expect(placeOfTag('Pendulum')).toBe('closed-guard')
    expect(placeOfTag('Double under pass')).toBe('pressure-passing')
    expect(placeOfTag('Long step pass')).toBe('dynamic-passing')
    expect(placeOfTag('Slide by')).toBe('wrestling')
    expect(groupOfTag('Turtle defense')).toBe('escapes')
    expect(isOpenGuardTag('SLX')).toBe(true) // open guard — counts for the comp milestone
    expect(isOpenGuardTag('Single leg X')).toBe(true)
    expect(isOpenGuardTag('Top lock')).toBe(false) // closed guard — does not
    expect(placeOfTag('2on1 from closed guard')).toBe('closed-guard') // closed-guard arm drag
    expect(placeOfTag('2-on-1 from closed guard')).toBe('closed-guard')
    expect(placeOfTag('Arm drag')).toBe('wrestling') // the standing arm drag stays separate
    expect(isOpenGuardTag('2-on-1 from closed guard')).toBe(false)
  })

  it("pins the owner's 2026-10-28 rulings", () => {
    // generic submissions and sweeps hang directly from Guard — hit from several guards
    for (const generic of ['Kimura', 'Armbar', 'Triangle', 'Sweeps', 'Lumberjack sweep', 'Guard retention']) {
      expect(groupOfTag(generic), generic).toBe('guard')
      expect(subgroupOfTag(generic), generic).toBeNull()
    }
    expect(placeOfTag('Panda')).toBe('back-turtle') // moved out of Other
    expect(groupOfTag('Roll through defense')).toBe('other') // left as it is
    // Top control is split three ways; Escapes holds the bottom game
    expect(placeOfTag('Side control')).toBe('side-control')
    expect(placeOfTag('Mount attacks')).toBe('mount-kob')
    expect(placeOfTag('Gift wrap')).toBe('mount-kob')
    expect(placeOfTag('Back takes')).toBe('back-turtle')
    expect(placeOfTag('Turtle defense')).toBe('escapes')
    expect(placeOfTag('Mount escapes')).toBe('escapes')
    expect(placeOfTag('Buggy choke')).toBe('escapes') // bottom-side attack — the bottom game, not top control
  })

  it('maps every live tag (2026-10-28) to a real branch, except Roll through defense by ruling', () => {
    for (const tag of LIVE_TAGS_2026_10_28) {
      if (tag === 'Roll through defense') continue
      expect(groupOfTag(tag), tag).not.toBe('other')
      // and the canonical spelling lands in the same place as the live one
      expect(placeOfTag(canonicalTag(tag)), tag).toBe(placeOfTag(tag))
    }
    expect(placeOfTag('Yoko Tomoe Nage')).toBe('judo')
    expect(placeOfTag('Tomoe Nage')).toBe('judo')
    expect(placeOfTag('Opening Closed Guard')).toBe('opening-closed-guard')
    expect(placeOfTag('Cow catcher')).toBe('wrestling') // standing by owner ruling, 2026-10-27
    expect(placeOfTag('Half Butterfly')).toBe('half-guard')
    expect(isOpenGuardTag('Half Butterfly')).toBe(false) // owner ruling: half-guard variant
    expect(placeOfTag('Single leg takedown')).toBe('wrestling')
    expect(placeOfTag('single-leg takedown')).toBe('wrestling')
    expect(placeOfTag('Double leg takedown')).toBe('wrestling')
    expect(placeOfTag('Spider Guard')).toBe('open-guard')
  })

  it('spot-checks the 2026-10 vocabulary harvest in its new homes', () => {
    expect(placeOfTag('Blast double')).toBe('wrestling')
    expect(placeOfTag('Osoto gari')).toBe('judo')
    expect(placeOfTag('Guard pull')).toBe('standing') // directly under the branch
    expect(placeOfTag('K-guard')).toBe('open-guard')
    expect(placeOfTag('Reverse De La Riva')).toBe('open-guard')
    expect(placeOfTag('Z-guard')).toBe('half-guard')
    expect(placeOfTag('Rubber guard')).toBe('closed-guard')
    expect(placeOfTag('Headquarters')).toBe('dynamic-passing')
    expect(placeOfTag('Stack pass')).toBe('pressure-passing')
    expect(placeOfTag('Guard break')).toBe('opening-closed-guard')
    expect(placeOfTag('North south choke')).toBe('side-control')
    expect(placeOfTag('Body triangle')).toBe('back-turtle')
    expect(placeOfTag('Ghost escape')).toBe('escapes')
    expect(placeOfTag('Inside heel hook')).toBe('legs')
    expect(placeOfTag('Calf slicer')).toBe('legs')
    expect(isOpenGuardTag('K-guard')).toBe(true)
    expect(isOpenGuardTag('Berimbolo')).toBe(true)
    expect(isOpenGuardTag('Deep half')).toBe(true) // counts for the milestone though it hangs under Half guard
    expect(isOpenGuardTag('Z-guard')).toBe(false) // half-guard family — not open guard
    expect(isOpenGuardTag('Rubber guard')).toBe(false) // closed-guard system
  })

  it('the open-guard whitelist is a separate declaration that stays in step with the Open guard sub-group', () => {
    for (const def of TAG_DEFS) {
      // every guard in the sub-group (its sweeps are techniques, not guards) is whitelisted under every spelling
      if (def.place === 'open-guard' && !def.name.endsWith('sweep'))
        for (const spelling of [def.name, ...(def.aliases ?? [])]) expect(isOpenGuardTag(spelling), spelling).toBe(true)
      // and nothing outside Guard is — deep half (under Half guard) is the one deliberate extra
      if (isOpenGuardTag(def.name)) expect(['open-guard', 'half-guard']).toContain(def.place)
    }
    expect(isOpenGuardTag('Tripod sweep')).toBe(false)
    expect(isOpenGuardTag('Butterfly sweep')).toBe(false)
  })
})
