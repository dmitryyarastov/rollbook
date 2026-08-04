import type { ReactNode } from 'react'

interface ChipProps {
  on: boolean
  onClick: () => void
  children: ReactNode
  /** filter = 8×15 padding, dur = 8×14, tech = 8×13 (from the prototype). */
  variant?: 'filter' | 'dur' | 'tech'
}

export function Chip({ on, onClick, children, variant = 'filter' }: ChipProps) {
  const mod = variant === 'filter' ? '' : ` chip--${variant}`
  return (
    <button className={`chip${mod}${on ? ' chip--on' : ''}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  )
}
