import { FocusCard } from '../components/FocusCard'
import { SessionRow } from '../components/SessionRow'
import { fmtToday } from '../dates'
import { focusProgress, formatHours, sortByDateDesc, streak, subs30d, weekSummary } from '../stats'
import type { AppData, FocusGoal } from '../types'

interface HomeProps {
  data: AppData
  todayIso: string
  onSeeAll: () => void
  onOpenSession: (id: string) => void
  onChangeFocus: (focus: FocusGoal) => void
}

export function Home({ data, todayIso, onSeeAll, onOpenSession, onChangeFocus }: HomeProps) {
  const goal = data.settings.weeklyGoal
  const week = weekSummary(data.sessions, todayIso)
  const st = streak(data.sessions, goal, todayIso)
  const subs = subs30d(data.sessions, todayIso)
  const recent = sortByDateDesc(data.sessions).slice(0, 3)
  const maxBar = Math.max(...week.bars.map((b) => b.rolls), 1)

  return (
    <div className="screen">
      <header className="home-head">
        <h1 className="home-title">Rollbook</h1>
        <div className="home-date">{fmtToday(todayIso)}</div>
      </header>

      <section className="card card--lg hero">
        <div className="hero-top">
          <div>
            <div className="kicker">This week</div>
            <div className="hero-num-row">
              <div className="hero-num">{week.rolls}</div>
              <div className="hero-cap">
                rounds
                <br />
                sparred
              </div>
            </div>
          </div>
          <div className="hero-side">
            <div>
              <div className="hero-stat-n">{formatHours(week.hours)}</div>
              <div className="hero-stat-l">mat hours</div>
            </div>
            <div>
              <div className="hero-stat-n">{week.sessions}</div>
              <div className="hero-stat-l">sessions</div>
            </div>
          </div>
        </div>
        <div className="weekbars">
          {week.bars.map((b, i) => (
            <div key={i} className="weekbar">
              <div
                className={`weekbar-fill${b.rolls > 0 ? ' weekbar-fill--on' : ''}`}
                style={{ height: b.rolls > 0 ? 8 + (b.rolls / maxBar) * 40 : 4 }}
              />
              <div className="weekbar-day">{b.day}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="stat-row">
        <section className="card stat-card">
          <div className="kicker">Streak</div>
          <div className="stat-line">
            <span className="stat-n">{st.weeks}</span>
            <span className="stat-u">weeks</span>
          </div>
          <div className="stat-note">training {goal}+ / week</div>
        </section>
        <section className="card stat-card">
          <div className="kicker">Subs · 30d</div>
          <div className="subs-line">
            <span className="subs-for">{subs.subsFor}</span>
            <span className="subs-l">for</span>
            <span className="subs-against">{subs.subsAgainst}</span>
            <span className="subs-l">against</span>
          </div>
        </section>
      </div>

      <FocusCard
        variant="home"
        focus={data.focus}
        progress={focusProgress(data.sessions, data.focus.tag, todayIso)}
        tagList={data.tagList}
        onChange={onChangeFocus}
      />

      <div className="section-head">
        <div className="section-label">Recent sessions</div>
        <button className="link" onClick={onSeeAll}>
          See all
        </button>
      </div>
      {recent.length > 0 ? (
        <div className="slist">
          {recent.map((s) => (
            <SessionRow key={s.id} session={s} onClick={() => onOpenSession(s.id)} />
          ))}
        </div>
      ) : (
        <div className="empty">No sessions yet — hit the + tab after class.</div>
      )}
    </div>
  )
}
