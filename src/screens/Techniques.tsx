import { FocusCard } from '../components/FocusCard'
import { focusProgress, tagCounts30d } from '../stats'
import type { AppData, FocusGoal } from '../types'

interface TechniquesProps {
  data: AppData
  todayIso: string
  onChangeFocus: (focus: FocusGoal) => void
}

export function Techniques({ data, todayIso, onChangeFocus }: TechniquesProps) {
  const counts = tagCounts30d(data.sessions, todayIso)
  const top = counts.filter((c) => c.n > 0).slice(0, 6)
  const max = top[0]?.n ?? 1
  const byName = new Map(counts.map((c) => [c.name, c.n]))
  const cloud = data.tagList
    .map((t) => ({ label: t, n: byName.get(t) ?? 0 }))
    .sort((a, b) => b.n - a.n)

  return (
    <div className="screen">
      <h1 className="screen-title">Techniques</h1>
      <div className="screen-sub">What you've been working, last 30 days.</div>

      <FocusCard
        variant="tech"
        focus={data.focus}
        progress={focusProgress(data.sessions, data.focus.tag, todayIso)}
        tagList={data.tagList}
        onChange={onChangeFocus}
      />

      <div className="section-label label-row">Most worked</div>
      {top.length > 0 ? (
        <div className="trows">
          {top.map((t, i) => (
            <div key={t.name} className="trow">
              <div className="trow-name">{t.name}</div>
              <div className="trow-track">
                <div
                  className={`trow-fill${i === 0 ? ' trow-fill--first' : i < 3 ? ' trow-fill--top3' : ''}`}
                  style={{ width: `${Math.round((t.n / max) * 100)}%` }}
                />
              </div>
              <div className="trow-n">{t.n}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Tag techniques when you log sessions to see them here.</div>
      )}

      <div className="section-label label-row">All tags</div>
      <div className="tag-cloud">
        {cloud.map((t) => (
          <div key={t.label} className="tagstat">
            {t.label} <span className="tagstat-n">{t.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
