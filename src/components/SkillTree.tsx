import { CaretDown, CaretRight, Target } from '@phosphor-icons/react'
import { useState } from 'react'
import { daysBetween, fmtShort } from '../dates'
import type { NodeProgress, TreeBranch } from '../tree'
import { sessionsToNext } from '../xp'

interface SkillTreeProps {
  tree: TreeBranch[]
  todayIso: string
  /** The current focus tag ('' = none); its leaf renders as the focus node. */
  focusTag: string
  onFocusTag: (tag: string) => void
}

/** "today" / "yesterday" / "5 d ago" / "3 wk ago" / "Jul 3" — relative to the caller's todayIso, never the clock. */
function agoLabel(lastIso: string, todayIso: string): string {
  const d = daysBetween(lastIso, todayIso)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 14) return `${d} d ago`
  if (d < 70) return `${Math.round(d / 7)} wk ago`
  return lastIso.slice(0, 4) === todayIso.slice(0, 4) ? fmtShort(lastIso) : `${fmtShort(lastIso)}, ${lastIso.slice(0, 4)}`
}

const pct = (p: NodeProgress) => `${Math.round((100 * p.into) / p.need)}%`
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
const norm = (tag: string) => tag.trim().toLowerCase()

/**
 * The skill tree as a collapsible outline (Techniques screen, beside the
 * Focus card it feeds): one card per position branch
 * with "explored n / m" and its own level; opening it lists the branch's
 * tags, most trained first. Tapping a tag opens an in-place detail
 * (sessions, last trained, XP to the next level) with "Set as focus" — the
 * RPGreal "create a goal from a node" idea, wired to the existing weekly
 * focus. Untrained tags render dim, never "locked". State is screen-local
 * (resets with the tab, like every accordion here).
 */
export function SkillTree({ tree, todayIso, focusTag, onFocusTag }: SkillTreeProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  // load() spreads focus through unsanitized; a hand-edited blob must not blank the screen.
  const focusNorm = typeof focusTag === 'string' && focusTag ? norm(focusTag) : null

  const toggleBranch = (group: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  if (tree.length === 0) return <div className="empty">Add technique tags in the Log form to grow the tree.</div>

  return (
    <div className="tree">
      {tree.map((branch) => {
        const isOpen = open.has(branch.group)
        return (
          <section key={branch.group} className={`card tree-branch${branch.xp === 0 ? ' tree-branch--idle' : ''}`}>
            <button className="tree-head" aria-expanded={isOpen} onClick={() => toggleBranch(branch.group)}>
              <span className="tree-caret">{isOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}</span>
              <span className="tree-head-label">{branch.label}</span>
              <span className="tree-cov">
                {branch.explored} / {branch.total}
              </span>
              <span className="level-chip">LV {branch.level}</span>
            </button>
            <div className="level-track">
              <span className="level-fill" style={{ width: pct(branch) }} />
            </div>
            {isOpen && (
              <div className="tree-rows">
                {branch.tags.length === 0 && <div className="tree-detail-line">Lit by typed rounds only — no tag here yet.</div>}
                {branch.tags.map((leaf) => {
                  const idle = leaf.xp === 0
                  const sel = selected === leaf.tag
                  const isFocus = focusNorm !== null && norm(leaf.tag) === focusNorm
                  const toNext = sessionsToNext(leaf)
                  return (
                    <div key={leaf.tag}>
                      <button
                        className={`tree-row${idle ? ' tree-row--idle' : ''}${sel ? ' tree-row--sel' : ''}${isFocus ? ' tree-row--focus' : ''}`}
                        aria-expanded={sel}
                        onClick={() => setSelected(sel ? null : leaf.tag)}
                      >
                        <span className="tree-row-label">{leaf.tag}</span>
                        {isFocus && (
                          <span className="tree-row-focus" role="img" aria-label="Current focus">
                            <Target size={12} />
                          </span>
                        )}
                        <span className="level-chip">LV {leaf.level}</span>
                        <span className="tree-row-track">
                          <span className="tree-row-fill" style={{ width: pct(leaf) }} />
                        </span>
                      </button>
                      {sel && (
                        <div className="tree-detail">
                          <div className="tree-detail-line">
                            {idle
                              ? 'Not trained yet — tag a session with it to light it up.'
                              : [
                                  plural(leaf.sessions, 'session'),
                                  leaf.comps > 0 ? plural(leaf.comps, 'comp') : null,
                                  leaf.lastIso ? `last ${agoLabel(leaf.lastIso, todayIso)}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                          </div>
                          <div className="tree-detail-xp">
                            {leaf.into} / {leaf.need} XP · {plural(toNext, 'session')} to LV {leaf.level + 1}
                          </div>
                          <div className="tree-detail-actions">
                            {isFocus ? (
                              <span className="tree-detail-focus">Current focus</span>
                            ) : (
                              <button className="chip chip--tech" onClick={() => onFocusTag(leaf.tag)}>
                                Set as focus
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
