import { rankLabel } from '../belts'
import type { Belt } from '../types'

interface BeltGlyphProps {
  belt: Belt
  stripes: number
  size?: 'sm' | 'md'
}

/**
 * A belt drawn as the real thing: body in the belt's color, a rank bar near
 * the tip (black on colored belts, red on black) carrying one tick per
 * stripe or degree. Belt colors are semantic, not accent — kept small.
 */
export function BeltGlyph({ belt, stripes, size = 'sm' }: BeltGlyphProps) {
  return (
    <span className={`belt belt--${belt} belt--${size}`} role="img" aria-label={rankLabel({ belt, stripes })}>
      <span className="belt-bar">
        {Array.from({ length: stripes }, (_, i) => (
          <span key={i} className="belt-stripe" />
        ))}
      </span>
    </span>
  )
}
