import { useRef, useState } from 'react'
import { Chip } from '../components/Chip'
import { Stepper } from '../components/Stepper'
import type { LogForm, RoundMin } from '../types'

const DUR_OPTIONS: RoundMin[] = [4, 5, 6, 8]

interface LogProps {
  form: LogForm
  onPatch: (patch: Partial<LogForm>) => void
  tagList: string[]
  onAddTag: (name: string) => void
  onSave: () => void
  saved: boolean
}

export function Log({ form, onPatch, tagList, onAddTag, onSave, saved }: LogProps) {
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

  return (
    <div className="screen">
      <h1 className="screen-title">Log session</h1>
      <div className="screen-sub">30 seconds now — details optional, later.</div>

      {/* The design captures no session type; this mirrors its filter chips. */}
      <div className="chips log-type">
        <Chip on={form.gi} onClick={() => onPatch({ gi: true })}>
          Gi
        </Chip>
        <Chip on={!form.gi} onClick={() => onPatch({ gi: false })}>
          No-Gi
        </Chip>
      </div>

      <div className="log-stack">
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
    </div>
  )
}
