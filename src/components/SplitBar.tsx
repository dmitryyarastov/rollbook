interface SplitBarProps {
  /** Combined rounds the bar stands for; 0 renders the empty track. */
  rounds: number
  /** The gi share of `rounds`; the rest stacks above it as no-gi. */
  gi: number
  /** Mean RPE of the period (1–5), or null when no session logged one. */
  rpe: number | null
  /** Pixel height of the whole bar (the caller owns the scale). */
  height: number
  /** Bright shades (this week / the current column). */
  current?: boolean
}

/** The heat ramp step for a mean RPE: nearest whole step, clamped to 1–5. */
export const rpeStep = (rpe: number): number => Math.min(5, Math.max(1, Math.round(rpe)))

/**
 * A stacked gi / no-gi bar: gi sits at the base, no-gi on top, totals keep
 * their height. A period with a mean RPE wears a 3px heat cap above the bar
 * (outside its height, so the scale stays exact); periods without one — no
 * rounds, or history from before RPE was logged — show no cap.
 */
export function SplitBar({ rounds, gi, rpe, height, current = false }: SplitBarProps) {
  const nogi = Math.max(0, rounds - gi)
  const step = rpe !== null && rounds > 0 ? rpeStep(rpe) : null
  return (
    <div className="barstack">
      {step !== null && <div className={`bar-heat bar-heat--rpe${step}`} />}
      <div className={`bar${current ? ' bar--cur' : ''}`} style={{ height }}>
        {nogi > 0 && <div className="bar-seg bar-seg--nogi" style={{ flexGrow: nogi }} />}
        {gi > 0 && <div className="bar-seg bar-seg--gi" style={{ flexGrow: gi }} />}
      </div>
    </div>
  )
}

/** The gi / no-gi / avg-RPE key shown under a stacked chart. */
export function BarLegend() {
  return (
    <div className="bar-legend">
      <span className="bar-key">
        <span className="bar bar--cur bar-swatch">
          <span className="bar-seg bar-seg--gi" style={{ flexGrow: 1 }} />
        </span>
        Gi
      </span>
      <span className="bar-key">
        <span className="bar bar--cur bar-swatch">
          <span className="bar-seg bar-seg--nogi" style={{ flexGrow: 1 }} />
        </span>
        No-Gi
      </span>
      <span className="bar-key">
        <span className="bar-swatch bar-swatch--heat" />
        Avg RPE
      </span>
    </div>
  )
}
