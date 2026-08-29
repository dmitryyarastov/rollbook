import { Trophy } from '@phosphor-icons/react'
import { fmtShort } from '../dates'
import type { Competition } from '../types'

interface CompRowProps {
  comp: Competition
  expanded?: boolean
  onClick: () => void
}

const OUTCOME_LABEL = { win: 'WIN', loss: 'LOSS', draw: 'DRAW' } as const
const PLACEMENT_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as const

/** History row for a competition — SessionRow's accordion pattern (button root, span children). */
export function CompRow({ comp: c, expanded = false, onClick }: CompRowProps) {
  const wins = c.matches.filter((m) => m.outcome === 'win').length
  const losses = c.matches.filter((m) => m.outcome === 'loss').length
  const draws = c.matches.filter((m) => m.outcome === 'draw').length
  const record = draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`
  return (
    <button
      className={`card srow${expanded ? ' srow--open' : ''}`}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <span className="srow-main">
        <span className="srow-badge srow-badge--comp">
          <Trophy size={16} />
        </span>
        <span className="srow-body">
          <span className="srow-title">{c.title}</span>
          <span className="srow-meta">
            {[
              fmtShort(c.date),
              c.gi ? 'Gi' : 'No-Gi',
              `${c.matches.length} ${c.matches.length === 1 ? 'match' : 'matches'}`,
              c.placement !== 'none' && PLACEMENT_LABEL[c.placement],
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="srow-right">
          <span className="srow-rolls">{record}</span>
          <span className="micro">RECORD</span>
        </span>
      </span>
      {expanded && (
        <span className="srow-panel">
          {c.matches.length > 0 && (
            <span className="crow-matches">
              {c.matches.map((m, i) => (
                <span key={i} className="crow-match">
                  <span className={`crow-oc crow-oc--${m.outcome}`}>{OUTCOME_LABEL[m.outcome]}</span>
                  <span className="crow-score">
                    {m.myPoints}–{m.theirPoints}
                  </span>
                  {m.submission && <span className="crow-fin">· {m.submission}</span>}
                </span>
              ))}
            </span>
          )}
          {c.cardio > 0 && (
            <span className="crow-cardio">
              <span className="crow-cardio-n">{c.cardio}/5</span>
              <span className="micro">CARDIO</span>
            </span>
          )}
          {c.workedWell && (
            <span className="crow-note">
              <span className="micro">WHAT WORKED</span>
              <span className="crow-note-text">{c.workedWell}</span>
            </span>
          )}
          {c.didntWork && (
            <span className="crow-note">
              <span className="micro">WHAT DIDN’T</span>
              <span className="crow-note-text">{c.didntWork}</span>
            </span>
          )}
          {c.tags.length > 0 && (
            <span className="srow-tags">
              {c.tags.map((t) => (
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
