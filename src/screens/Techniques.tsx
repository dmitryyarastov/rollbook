import { FocusCard } from '../components/FocusCard'
import { groupTagsByCurriculum } from '../curriculum'
import { focusProgress, tagCounts30d, withSessionTags } from '../stats'
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
  const sections = groupTagsByCurriculum(withSessionTags(data.tagList, data.sessions))

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
      {sections.map((sec) => (
        <div key={sec.group} className="cloud-group">
          <div className="cloud-group-label">{sec.label}</div>
          <div className="tag-cloud">
            {sec.tags.map((t) => (
              <div key={t} className="tagstat">
                {t} <span className="tagstat-n">{byName.get(t) ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
