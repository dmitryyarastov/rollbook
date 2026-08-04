import { Minus, Plus } from '@phosphor-icons/react'

interface StepperProps {
  kind: 'minus' | 'plus'
  size: 'lg' | 'sm'
  accent?: boolean
  label: string
  onClick: () => void
}

export function Stepper({ kind, size, accent = false, label, onClick }: StepperProps) {
  const StepIcon = kind === 'minus' ? Minus : Plus
  return (
    <button
      className={`step step--${size}${accent ? ' step--accent' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <StepIcon size={size === 'lg' ? 20 : 16} />
    </button>
  )
}
