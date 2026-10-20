import { describe, expect, it } from 'vitest'
import { SPEC_FORMATS, specBreakdownSum } from './specific'

describe('specific-training formats', () => {
  it('lists the six formats in curriculum order', () => {
    expect(SPEC_FORMATS.map((f) => f.label)).toEqual([
      'Closed guard',
      'Open guard',
      'Side control',
      'Mount',
      'Back control',
      'Turtle',
    ])
  })

  it('sums every format', () => {
    expect(
      specBreakdownSum({ specClosed: 1, specOpen: 2, specSide: 3, specMount: 4, specBack: 5, specTurtle: 6 }),
    ).toBe(21)
    expect(specBreakdownSum({ specClosed: 0, specOpen: 0, specSide: 0, specMount: 0, specBack: 0, specTurtle: 0 })).toBe(0)
  })
})
