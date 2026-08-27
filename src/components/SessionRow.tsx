import { fmtShort, fmtTime, weekdayBadge } from '../dates'
import type { Session } from '../types'

interface SessionRowProps {
  session: Session
  expanded?: boolean
  onClick: () => void
}

export function SessionRow({ session: s, expanded = false, onClick }: SessionRowProps) {
  return (
    <button
      className={`card srow${expanded ? ' srow--open' : ''}`}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <span className="srow-main">
        <span className={`srow-badge${s.gi ? ' srow-badge--gi' : ''}`}>{weekdayBadge(s.date)}</span>
        <span className="srow-body">
          <span className="srow-title">{s.title}</span>
          <span className="srow-meta">
            {[fmtShort(s.date), s.time && fmtTime(s.time), s.gi ? 'Gi' : 'No-Gi', `${s.roundMin} min rounds`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="srow-right">
          <span className="srow-rolls">{s.rolls}</span>
          <span className="micro">ROUNDS</span>
        </span>
      </span>
      {expanded && (
        <span className="srow-panel">
          <span className="srow-stats">
            <span className="srow-stat">
              <span className="srow-stat-n srow-stat-n--for">{s.subsFor}</span>
              <span className="micro">SUBS FOR</span>
            </span>
            <span className="srow-stat">
              <span className="srow-stat-n">{s.subsAgainst}</span>
              <span className="micro">AGAINST</span>
            </span>
            <span className="srow-stat">
              <span className="srow-stat-n">{s.roundMin} min</span>
              <span className="micro">ROUND LEN</span>
            </span>
          </span>
          {s.tags.length > 0 && (
            <span className="srow-tags">
              {s.tags.map((t) => (
                <span key={t} className="tagchip">
                  {t}
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
