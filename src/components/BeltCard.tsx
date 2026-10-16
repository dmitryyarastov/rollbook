import { PencilSimple, X } from '@phosphor-icons/react'
import { useState } from 'react'
import {
  BELT_LABEL,
  BELTS,
  currentRank,
  isPromotionDate,
  maxStripes,
  nextRank,
  promotionLabel,
  rankLabel,
  rankTimeline,
  undoTarget,
} from '../belts'
import type { Rank } from '../belts'
import { fmtShort } from '../dates'
import type { Belt, Promotion } from '../types'
import { BeltGlyph } from './BeltGlyph'
import { Chip } from './Chip'

interface BeltCardProps {
  promotions: Promotion[]
  todayIso: string
  onAdd: (rank: Rank, dateIso: string) => void
}

const fmtDated = (iso: string) => `${fmtShort(iso)}, ${iso.slice(0, 4)}`

/**
 * The character's belt. Promote advances one rung (stripe or belt) after an
 * inline confirmation; Undo promotion reverts the latest promotion by
 * re-entering its day; the pencil opens a panel to set any rank on any past
 * date (first setup, backdated history, or replacing a day's entry). Every
 * action appends a Promotion event — rank history is never edited or deleted;
 * see rankTimeline in src/belts.ts for how the log becomes the timeline.
 */
export function BeltCard({ promotions, todayIso, onAdd }: BeltCardProps) {
  const rank = currentRank(promotions, todayIso)
  const next = rank ? nextRank(rank) : null
  const undo = undoTarget(promotions, todayIso)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftBelt, setDraftBelt] = useState<Belt>(rank?.belt ?? 'white')
  const [draftStripes, setDraftStripes] = useState(rank?.stripes ?? 0)
  const [draftDate, setDraftDate] = useState(todayIso)

  const toggleEditor = () => {
    setDraftBelt(rank?.belt ?? 'white')
    setDraftStripes(rank?.stripes ?? 0)
    setDraftDate(todayIso)
    setConfirming(false)
    setEditing((e) => !e)
  }

  const pickBelt = (b: Belt) => {
    setDraftBelt(b)
    setDraftStripes((s) => Math.min(s, maxStripes(b)))
  }

  const dateOk = isPromotionDate(draftDate, todayIso)
  const dateProblem = !draftDate ? 'Pick a date.' : !dateOk ? 'The date can’t be in the future.' : null

  const saveDraft = () => {
    if (!dateOk) return
    onAdd({ belt: draftBelt, stripes: draftStripes }, draftDate)
    setEditing(false)
  }

  const history = rankTimeline(promotions, todayIso).reverse().slice(0, 6)

  return (
    <section className="card belt-card">
      <div className="focus-head">
        <div className="kicker">Belt</div>
        <button className="icon-btn" aria-label={editing ? 'Cancel rank editing' : 'Set rank'} onClick={toggleEditor}>
          {editing ? <X size={13} /> : <PencilSimple size={13} />}
        </button>
      </div>

      {rank ? (
        <div className="belt-now">
          <BeltGlyph belt={rank.belt} stripes={rank.stripes} size="md" />
          <div>
            <div className="belt-rank">{rankLabel(rank)}</div>
            <div className="belt-since">
              since {fmtDated(rank.sinceIso)}
              {rank.beltSinceIso !== rank.sinceIso &&
                ` · ${BELT_LABEL[rank.belt].toLowerCase()} since ${fmtDated(rank.beltSinceIso)}`}
            </div>
          </div>
        </div>
      ) : (
        <div className="belt-empty">No rank set yet — tap the pencil to set your current belt.</div>
      )}

      {rank && !editing && (next || undo) && (
        <div className="belt-actions">
          {confirming && next ? (
            <>
              <span className="belt-confirm-q">{promotionLabel(rank, next)} today?</span>
              <Chip
                variant="tech"
                on
                onClick={() => {
                  onAdd(next, todayIso)
                  setConfirming(false)
                }}
              >
                Confirm
              </Chip>
              <Chip variant="tech" on={false} onClick={() => setConfirming(false)}>
                Cancel
              </Chip>
            </>
          ) : (
            <>
              {next && (
                <button className="chip chip--tech" onClick={() => setConfirming(true)}>
                  {promotionLabel(rank, next)}
                </button>
              )}
              {undo && (
                <button className="chip chip--tech" onClick={() => onAdd(undo.rank, undo.dateIso)}>
                  Undo promotion
                </button>
              )}
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="focus-panel">
          <div>
            <span className="field-label">Belt</span>
            <div className="chip-wrap">
              {BELTS.map((b) => (
                <Chip key={b} variant="tech" on={draftBelt === b} onClick={() => pickBelt(b)}>
                  {BELT_LABEL[b].replace(' belt', '')}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <span className="field-label">{draftBelt === 'black' ? 'Degrees' : 'Stripes'}</span>
            <div className="chip-wrap">
              {Array.from({ length: maxStripes(draftBelt) + 1 }, (_, n) => (
                <Chip key={n} variant="dur" on={draftStripes === n} onClick={() => setDraftStripes(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="belt-date">
              Date — a day that already has an entry is replaced; an earlier date adds history
            </label>
            <input
              id="belt-date"
              className="input input--time"
              type="date"
              value={draftDate}
              max={todayIso}
              onChange={(e) => setDraftDate(e.target.value)}
            />
            {dateProblem && <div className="belt-date-error">{dateProblem}</div>}
          </div>
          <button className="chip chip--tech" onClick={saveDraft} disabled={!dateOk}>
            Save {rankLabel({ belt: draftBelt, stripes: draftStripes })}
          </button>
        </div>
      )}

      {history.length > 1 && !editing && (
        <div className="belt-history">
          {history.map((e) => (
            <div key={`${e.sinceIso}-${e.belt}-${e.stripes}`} className="belt-history-row">
              <span>{rankLabel(e)}</span>
              <span>{fmtDated(e.sinceIso)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
