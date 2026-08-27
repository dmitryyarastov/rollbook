import { X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { autoTitle, fmtTime, resolveWhen, toIso } from '../dates'
import { Chip } from '../components/Chip'
import { Stepper } from '../components/Stepper'
import type { CardioRating, CompForm, CompMatch, CompOutcome, LogForm, LogMode, RoundMin } from '../types'

const DUR_OPTIONS: RoundMin[] = [4, 5, 6, 8]
/** Pre-scheduled class slots (local, 24h): 7:30 PM no-gi, 8:30 PM gi. */
const SCHEDULED_SLOTS = ['19:30', '20:30']
const CARDIO_OPTIONS: CardioRating[] = [1, 2, 3, 4, 5]
const OUTCOME_OPTIONS: { value: CompOutcome; label: string }[] = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'draw', label: 'Draw' },
]
/** Mirrors the sync-side cap — a comp larger than this would truncate on pull. */
const MAX_MATCHES = 50

interface LogProps {
  form: LogForm
  onPatch: (patch: Partial<LogForm>) => void
  mode: LogMode
  onMode: (m: LogMode) => void
  compForm: CompForm
  onPatchComp: (patch: Partial<CompForm>) => void
  onSaveComp: () => void
  tagList: string[]
  onAddTag: (name: string) => void
  onSave: () => void
  saved: boolean
}

export function Log({
  form,
  onPatch,
  mode,
  onMode,
  compForm,
  onPatchComp,
  onSaveComp,
  tagList,
  onAddTag,
  onSave,
  saved,
}: LogProps) {
  const [adding, setAdding] = useState(false)
  const [newTag, setNewTag] = useState('')
  const committed = useRef(false)

  const toggleTag = (t: string) =>
    onPatch({ tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t] })

  const commitTag = () => {
    if (committed.current) return
    committed.current = true
    const name = newTag.trim()
    setAdding(false)
    setNewTag('')
    if (!name) return
    const existing = tagList.find((t) => t.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!form.tags.includes(existing)) toggleTag(existing)
    } else {
      onAddTag(name)
      onPatch({ tags: [...form.tags, name] })
    }
  }

  const comp = mode === 'comp'
  const gi = comp ? compForm.gi : form.gi
  const setGi = (v: boolean) => (comp ? onPatchComp({ gi: v }) : onPatch({ gi: v }))

  return (
    <div className="screen">
      <h1 className="screen-title">{comp ? 'Log competition' : 'Log session'}</h1>
      <div className="screen-sub">{comp ? 'Match by match — while it’s fresh.' : '30 seconds now — details optional, later.'}</div>

      {/* Training vs competition — same chip pattern as the type row below. */}
      <div className="chips log-mode">
        <Chip on={!comp} onClick={() => onMode('training')}>
          Training
        </Chip>
        <Chip on={comp} onClick={() => onMode('comp')}>
          Competition
        </Chip>
      </div>

      {/* The design captures no session type; this mirrors its filter chips. */}
      <div className="chips log-type">
        <Chip on={gi} onClick={() => setGi(true)}>
          Gi
        </Chip>
        <Chip on={!gi} onClick={() => setGi(false)}>
          No-Gi
        </Chip>
      </div>

      {comp ? (
        <CompFields compForm={compForm} onPatchComp={onPatchComp} onSaveComp={onSaveComp} saved={saved} />
      ) : (
        <>
      <div className="log-stack">
        <WhenCard when={form.when} onPick={(when) => onPatch({ when })} />

        <section className="card card--lg log-card">
          <div className="kicker">Rounds sparred</div>
          <div className="stepper-row">
            <Stepper
              kind="minus"
              size="lg"
              label="Fewer rounds"
              onClick={() => onPatch({ rolls: Math.max(0, form.rolls - 1) })}
            />
            <div className="log-count">{form.rolls}</div>
            <Stepper kind="plus" size="lg" accent label="More rounds" onClick={() => onPatch({ rolls: form.rolls + 1 })} />
          </div>
          <div className="dur-row">
            {DUR_OPTIONS.map((d) => (
              <Chip key={d} variant="dur" on={form.roundMin === d} onClick={() => onPatch({ roundMin: d })}>
                {d} min
              </Chip>
            ))}
          </div>
          <div className="dur-cap">round length</div>
        </section>

        <section className="card card--lg log-card">
          <div className="kicker">Submissions</div>
          <div className="subs-split">
            <div className="subs-half">
              <div className="subs-half-label subs-half-label--for">FOR</div>
              <div className="subs-stepper">
                <Stepper
                  kind="minus"
                  size="sm"
                  label="Fewer subs for"
                  onClick={() => onPatch({ subsFor: Math.max(0, form.subsFor - 1) })}
                />
                <div className="subs-count">{form.subsFor}</div>
                <Stepper
                  kind="plus"
                  size="sm"
                  accent
                  label="More subs for"
                  onClick={() => onPatch({ subsFor: form.subsFor + 1 })}
                />
              </div>
            </div>
            <div className="vdiv" />
            <div className="subs-half">
              <div className="subs-half-label subs-half-label--against">AGAINST</div>
              <div className="subs-stepper">
                <Stepper
                  kind="minus"
                  size="sm"
                  label="Fewer subs against"
                  onClick={() => onPatch({ subsAgainst: Math.max(0, form.subsAgainst - 1) })}
                />
                <div className="subs-count">{form.subsAgainst}</div>
                <Stepper
                  kind="plus"
                  size="sm"
                  label="More subs against"
                  onClick={() => onPatch({ subsAgainst: form.subsAgainst + 1 })}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="card card--lg log-card">
          <div className="tech-head">
            <div className="kicker">Techniques worked</div>
            <div className="tech-hint">tap to tag</div>
          </div>
          <div className="chip-wrap log-tags">
            {tagList.map((t) => (
              <Chip key={t} variant="tech" on={form.tags.includes(t)} onClick={() => toggleTag(t)}>
                {t}
              </Chip>
            ))}
            {adding ? (
              <input
                className="chip-input"
                autoFocus
                value={newTag}
                placeholder="New tag"
                aria-label="New technique tag"
                onChange={(e) => setNewTag(e.target.value)}
                onFocus={() => {
                  committed.current = false
                }}
                onBlur={commitTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTag()
                  if (e.key === 'Escape') {
                    committed.current = true
                    setAdding(false)
                    setNewTag('')
                  }
                }}
              />
            ) : (
              <button className="chip chip--tech" onClick={() => setAdding(true)}>
                + Add
              </button>
            )}
          </div>
        </section>
      </div>

      <button className="save-btn" onClick={onSave}>
        Save session
      </button>
      {saved && <div className="saved-msg">Session saved — nice work.</div>}
        </>
      )}
    </div>
  )
}

interface CompFieldsProps {
  compForm: CompForm
  onPatchComp: (patch: Partial<CompForm>) => void
  onSaveComp: () => void
  saved: boolean
}

function CompFields({ compForm, onPatchComp, onSaveComp, saved }: CompFieldsProps) {
  const wins = compForm.matches.filter((m) => m.outcome === 'win').length
  const losses = compForm.matches.filter((m) => m.outcome === 'loss').length
  const draws = compForm.matches.filter((m) => m.outcome === 'draw').length
  const record = draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`

  const addMatch = () => {
    if (compForm.matches.length >= MAX_MATCHES) return
    onPatchComp({ matches: [...compForm.matches, { outcome: 'win', myPoints: 0, theirPoints: 0, submission: '' }] })
  }
  const patchMatch = (i: number, patch: Partial<CompMatch>) =>
    onPatchComp({ matches: compForm.matches.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  const removeMatch = (i: number) => onPatchComp({ matches: compForm.matches.filter((_, j) => j !== i) })

  return (
    <>
      <div className="log-stack">
        <section className="card card--lg log-card">
          <div className="kicker">Event</div>
          <input
            className="input comp-event"
            value={compForm.name}
            placeholder="Competition"
            aria-label="Event name"
            onChange={(e) => onPatchComp({ name: e.target.value })}
          />
          <div className="dur-row">
            {CARDIO_OPTIONS.map((n) => (
              <Chip
                key={n}
                variant="dur"
                on={compForm.cardio === n}
                onClick={() => onPatchComp({ cardio: compForm.cardio === n ? 0 : n })}
              >
                {n}
              </Chip>
            ))}
          </div>
          <div className="dur-cap">cardio — 1 fine · 5 gassed</div>
        </section>

        <section className="card card--lg log-card">
          <div className="tech-head">
            <div className="kicker">Matches</div>
            {compForm.matches.length > 0 && <div className="tech-hint">{record}</div>}
          </div>
          {compForm.matches.length === 0 ? (
            <div className="match-empty">No matches yet — add your first below.</div>
          ) : (
            <div className="match-list">
              {compForm.matches.map((m, i) => (
                <MatchEditor key={i} match={m} index={i} onPatch={patchMatch} onRemove={removeMatch} />
              ))}
            </div>
          )}
          <button className="chip chip--tech match-add" onClick={addMatch}>
            + Add match
          </button>
        </section>

        <section className="card card--lg log-card">
          <div className="kicker">Notes</div>
          <div className="comp-notes">
            <div>
              <label className="field-label" htmlFor="comp-worked">
                What worked
              </label>
              <textarea
                id="comp-worked"
                className="input input--area"
                rows={3}
                value={compForm.workedWell}
                onChange={(e) => onPatchComp({ workedWell: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="comp-didnt">
                What didn’t
              </label>
              <textarea
                id="comp-didnt"
                className="input input--area"
                rows={3}
                value={compForm.didntWork}
                onChange={(e) => onPatchComp({ didntWork: e.target.value })}
              />
            </div>
          </div>
        </section>
      </div>

      <button className="save-btn" onClick={onSaveComp}>
        Save competition
      </button>
      {saved && <div className="saved-msg">Competition saved — nice work.</div>}
    </>
  )
}

interface MatchEditorProps {
  match: CompMatch
  index: number
  onPatch: (i: number, patch: Partial<CompMatch>) => void
  onRemove: (i: number) => void
}

function MatchEditor({ match: m, index: i, onPatch, onRemove }: MatchEditorProps) {
  return (
    <div className="match">
      <div className="match-head">
        <span className="micro">MATCH {i + 1}</span>
        <button className="icon-btn" aria-label={`Remove match ${i + 1}`} onClick={() => onRemove(i)}>
          <X size={13} />
        </button>
      </div>
      <div className="chips match-outcomes">
        {OUTCOME_OPTIONS.map((o) => (
          <Chip key={o.value} variant="tech" on={m.outcome === o.value} onClick={() => onPatch(i, { outcome: o.value })}>
            {o.label}
          </Chip>
        ))}
      </div>
      <div className="match-points">
        <div className="match-half">
          <div className="match-half-label match-half-label--me">ME</div>
          <div className="match-stepper">
            <Stepper
              kind="minus"
              size="sm"
              label={`Fewer points for me, match ${i + 1}`}
              onClick={() => onPatch(i, { myPoints: Math.max(0, m.myPoints - 1) })}
            />
            <div className="match-count">{m.myPoints}</div>
            <Stepper
              kind="plus"
              size="sm"
              accent
              label={`More points for me, match ${i + 1}`}
              onClick={() => onPatch(i, { myPoints: m.myPoints + 1 })}
            />
          </div>
        </div>
        <div className="vdiv" />
        <div className="match-half">
          <div className="match-half-label match-half-label--them">THEM</div>
          <div className="match-stepper">
            <Stepper
              kind="minus"
              size="sm"
              label={`Fewer points for them, match ${i + 1}`}
              onClick={() => onPatch(i, { theirPoints: Math.max(0, m.theirPoints - 1) })}
            />
            <div className="match-count">{m.theirPoints}</div>
            <Stepper
              kind="plus"
              size="sm"
              label={`More points for them, match ${i + 1}`}
              onClick={() => onPatch(i, { theirPoints: m.theirPoints + 1 })}
            />
          </div>
        </div>
      </div>
      <input
        className="input input--sm"
        value={m.submission}
        placeholder="Submission (optional)"
        aria-label={`Match ${i + 1} submission`}
        onChange={(e) => onPatch(i, { submission: e.target.value })}
      />
    </div>
  )
}

interface WhenCardProps {
  when: string | null
  onPick: (when: string | null) => void
}

/**
 * Session start picker: "Now" for logging right after class, the scheduled
 * slots (and a free time input) for logging later — typically the morning
 * after an evening class, which is why a not-yet-passed time means yesterday.
 */
function WhenCard({ when, onPick }: WhenCardProps) {
  // Live clock: the today/yesterday caption must track the wall clock, or an
  // idle screen promises one day while save (which re-resolves) writes another.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const start = resolveWhen(now, when)
  const caption =
    when === null
      ? 'logged as right now'
      : `${toIso(start) === toIso(now) ? 'today' : 'yesterday'} \u00b7 ${autoTitle(start)}`
  return (
    <section className="card card--lg log-card">
      <div className="kicker">When</div>
      <div className="when-row">
        <Chip variant="dur" on={when === null} onClick={() => onPick(null)}>
          Now
        </Chip>
        {SCHEDULED_SLOTS.map((t) => (
          <Chip key={t} variant="dur" on={when === t} onClick={() => onPick(t)}>
            {fmtTime(t)}
          </Chip>
        ))}
        <input
          className="input input--time"
          type="time"
          value={when ?? ''}
          aria-label="Session start time"
          onChange={(e) => onPick(e.target.value || null)}
        />
      </div>
      <div className="dur-cap">{caption}</div>
    </section>
  )
}
