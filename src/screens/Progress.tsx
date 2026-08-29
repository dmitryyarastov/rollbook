import { Check, DotsThree, Flame } from '@phosphor-icons/react'
import { fmtShort } from '../dates'
import { focusStreak, formatHours, giNoGiStreak, milestones, streak, volume12w, yearTotals } from '../stats'
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
  const flames = [
    { label: `Training — ${goal}+ sessions / week`, n: st.weeks },
    { label: 'Gi + No-Gi in the same week', n: giNoGiStreak(data.sessions, todayIso).weeks },
    {
      label: data.focus.tag ? `Focus work — ${data.focus.tag}` : 'Focus work — set a focus tag',
      n: focusStreak(data.sessions, data.focus.tag, todayIso).weeks,
    },
  ]

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

      <div className="section-label label-row">Streaks</div>
      <div className="mrows">
        {flames.map((f) => (
          <div key={f.label} className={`card frow${f.n > 0 ? '' : ' frow--cold'}`}>
            <div className="frow-flame">
              <Flame size={16} weight={f.n > 0 ? 'fill' : 'regular'} />
            </div>
            <div className="frow-n">×{f.n}</div>
            <div className="frow-label">{f.label}</div>
          </div>
        ))}
      </div>

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
            {milestones(data.sessions, data.competitions, todayIso).map((m) => (
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
