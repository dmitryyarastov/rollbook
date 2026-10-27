import { fmtShort, fmtTime, weekdayBadge } from '../dates'
import { SPEC_FORMATS, specBreakdownSum } from '../specific'
import { sessionRounds } from '../stats'
import type { Session } from '../types'

interface SessionRowProps {
  session: Session
  expanded?: boolean
  onClick: () => void
}

export function SessionRow({ session: s, expanded = false, onClick }: SessionRowProps) {
  return (
    <button
      className={`card srow${expanded ? ' srow--open' : ''}${s.intensity !== null ? ` srow--rpe${s.intensity}` : ''}`}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <span className="srow-main">
        <span className={`srow-badge${s.gi ? ' srow-badge--gi' : ''}`}>{weekdayBadge(s.date)}</span>
        <span className="srow-body">
          <span className="srow-title">{s.title}</span>
          <span className="srow-meta">
            {[fmtShort(s.date), s.time && fmtTime(s.time), s.gi ? 'Gi' : 'No-Gi', `${s.roundMin} min rounds`,
              s.durationMin !== null && `${s.durationMin} min session`, s.intensity !== null && `RPE ${s.intensity}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="srow-right">
          <span className="srow-rolls">{sessionRounds(s)}</span>
          <span className="micro">ROUNDS</span>
        </span>
      </span>
      {expanded && (
        <span className="srow-panel">
          <span className="srow-stats">
            {/* Typed specific rounds when the breakdown exists; legacy total otherwise. */}
            {SPEC_FORMATS.filter((f) => s[f.key] > 0).map((f) => (
              <span key={f.key} className="srow-stat">
                <span className="srow-stat-n">{s[f.key]}</span>
                <span className="micro">{f.short}</span>
              </span>
            ))}
            {s.specific > 0 && specBreakdownSum(s) === 0 && (
              <span className="srow-stat">
                <span className="srow-stat-n">{s.specific}</span>
                <span className="micro">SPECIFIC</span>
              </span>
            )}
            {/* Sub counting retired 2026-10 — shown only on rows that have data. */}
            {s.subsFor + s.subsAgainst > 0 && (
              <span className="srow-stat">
                <span className="srow-stat-n">
                  {s.subsFor}–{s.subsAgainst}
                </span>
                <span className="micro">SUBS F–A</span>
              </span>
            )}
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
