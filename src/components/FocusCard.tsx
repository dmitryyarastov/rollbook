import { Check, PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { orderTagsByCurriculum } from '../curriculum'
import type { FocusProgress } from '../stats'
import type { FocusGoal } from '../types'
import { Chip } from './Chip'

interface FocusCardProps {
  /** home: pct in the header; tech: pct in a bottom row (per the handoff). */
  variant: 'home' | 'tech'
  focus: FocusGoal
  progress: FocusProgress
  tagList: string[]
  onChange: (focus: FocusGoal) => void
}

/**
 * "Focus this month" card. The design ships no edit UI; the handoff's
 * real-app additions call for an editable goal, so a pencil toggle opens an
 * in-system panel (title input + linked-tag picker) below the card content.
 */
export function FocusCard({ variant, focus, progress, tagList, onChange }: FocusCardProps) {
  const [editing, setEditing] = useState(false)
  const hasGoal = focus.title.trim().length > 0
  const hasTag = focus.tag.length > 0

  const sub = !hasGoal
    ? 'Pick a goal and link a technique tag to track it.'
    : !hasTag
      ? 'Link a technique tag to track progress.'
      : progress.total === 0
        ? 'No sessions in the last 30 days yet.'
        : `Tagged in ${progress.tagged} of your last ${progress.total} sessions`
  const pct = `${progress.pct}%`

  return (
    <section className={`card card--accent focus${variant === 'tech' ? ' focus--tech' : ''}`}>
      <div className="focus-head">
        <div className="kicker kicker--accent">Focus this month</div>
        <div className="focus-head-right">
          {variant === 'home' && hasTag && <div className="focus-pct">{pct}</div>}
          <button
            className="icon-btn"
            aria-label={editing ? 'Done editing focus goal' : 'Edit focus goal'}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? <Check size={13} /> : <PencilSimple size={13} />}
          </button>
        </div>
      </div>
      <div className={`focus-title${hasGoal ? '' : ' focus-title--placeholder'}`}>
        {hasGoal ? focus.title : 'Set a monthly focus'}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: pct }} />
      </div>
      {variant === 'home' ? (
        <div className="focus-sub">{sub}</div>
      ) : (
        <div className="focus-foot">
          <div className="focus-sub">{sub}</div>
          {hasTag && <div className="focus-pct focus-pct--tech">{pct}</div>}
        </div>
      )}
      {editing && (
        <div className="focus-panel">
          <div>
            <label className="field-label" htmlFor="focus-title">
              Goal title
            </label>
            <input
              id="focus-title"
              className="input"
              value={focus.title}
              placeholder="e.g. Guard retention under pressure"
              onChange={(e) => onChange({ ...focus, title: e.target.value })}
            />
          </div>
          <div>
            <span className="field-label">Linked tag — drives the progress bar</span>
            <div className="chip-wrap">
              {orderTagsByCurriculum(tagList).map((t) => (
                <Chip
                  key={t}
                  variant="tech"
                  on={focus.tag === t}
                  onClick={() => onChange({ ...focus, tag: focus.tag === t ? '' : t })}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
