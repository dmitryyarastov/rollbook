import { Check, DotsThree } from '@phosphor-icons/react'
import { fmtShort } from '../dates'
import { formatHours, milestones, streak, volume12w, yearTotals } from '../stats'
import type { AppData } from '../types'

interface ProgressProps {
  data: AppData
  todayIso: string
}

export function Progress({ data, todayIso }: ProgressProps) {
  const goal = data.settings.weeklyGoal
  const st = streak(data.sessions, goal, todayIso)
  const vol = volume12w(data.sessions, todayIso)
  const maxVol = Math.max(...vol, 1)
  const year = yearTotals(data.sessions, todayIso)

  return (
    <div className="screen">
      <h1 className="screen-title">Progress</h1>
      <div className="screen-sub">Consistency beats intensity.</div>

      <section className="card card--lg streak-card">
        <div className="ring-wrap">
          <div className="ring-pulse" />
          <div className="ring">
            <div className="ring-n">{st.weeks}</div>
            <div className="ring-l">WEEKS</div>
          </div>
        </div>
        <div className="streak-title">Current streak</div>
        <div className="streak-sub">
          {st.weeks > 0 && st.sinceIso
            ? `${goal}+ sessions every week since ${fmtShort(st.sinceIso)}`
            : `Log ${goal}+ sessions a week to start a streak.`}
        </div>
      </section>

      <div className="section-label label-row">Sparring volume · 12 weeks</div>
      <section className="card vol-card">
        <div className="vol-bars">
          {vol.map((v, i) => (
            <div key={i} className="vol-col">
              <div className="vol-n">{v}</div>
              <div
                className={`vol-fill${i === vol.length - 1 ? ' vol-fill--cur' : ''}`}
                style={{ height: v > 0 ? Math.max(4, Math.round((v / maxVol) * 78)) : 2 }}
              />
            </div>
          ))}
        </div>
        <div className="vol-x">
          <span>12 wks ago</span>
          <span>this week</span>
        </div>
      </section>

      <div className="stat-row">
        <section className="card stat-card">
          <div className="kicker">Mat hours · year</div>
          <div className="stat-line">
            <span className="stat-n">{formatHours(year.hours)}</span>
            <span className="stat-u">hrs</span>
          </div>
        </section>
        <section className="card stat-card">
          <div className="kicker">Rounds · year</div>
          <div className="stat-line">
            <span className="stat-n">{year.rolls}</span>
            <span className="stat-u">rolls</span>
          </div>
        </section>
      </div>

      {data.settings.showMilestones && (
        <div>
          <div className="section-label label-row">Milestones</div>
          <div className="mrows">
            {milestones(data.sessions, goal, todayIso).map((m) => (
              <div key={m.title} className={`card mrow${m.achieved ? '' : ' mrow--pending'}`}>
                <div className="mrow-icon">
                  {m.achieved ? <Check size={16} /> : <DotsThree size={16} />}
                </div>
                <div>
                  <div className="mrow-title">{m.title}</div>
                  <div className="mrow-sub">{m.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
