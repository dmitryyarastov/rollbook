import { Check, DotsThree, Flame } from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { Rank } from '../belts'
import { BeltCard } from '../components/BeltCard'
import { SkillTree } from '../components/SkillTree'
import { fmtShort } from '../dates'
import {
  bestWeeklyStreak,
  focusStreak,
  formatHours,
  giNoGiStreak,
  milestones,
  streak,
  volume12w,
  yearTotals,
} from '../stats'
import { skillTree } from '../tree'
import type { AppData, FocusGoal, Session } from '../types'
import { characteristics, characterLevel, sessionsToNext, totalXp, yearXp } from '../xp'

interface ProgressProps {
  data: AppData
  todayIso: string
  onAddPromotion: (rank: Rank, dateIso: string) => void
  onChangeFocus: (focus: FocusGoal) => void
}

export function Progress({ data, todayIso, onAddPromotion, onChangeFocus }: ProgressProps) {
  const goal = data.settings.weeklyGoal
  const st = streak(data.sessions, goal, todayIso)
  const vol = volume12w(data.sessions, todayIso)
  const maxVol = Math.max(...vol, 1)
  const year = yearTotals(data.sessions, todayIso)
  const { flames, xp, chars, totalXpAll, lvl, tree } = useMemo(() => {
    const trains = (week: Session[]) => week.length >= goal
    const mixes = (week: Session[]) => week.some((s) => s.gi) && week.some((s) => !s.gi)
    const focuses = (week: Session[]) => data.focus.tag !== '' && week.some((s) => s.tags.includes(data.focus.tag))
    return {
      flames: [
        {
          label: `Training — ${goal}+ sessions / week`,
          n: st.weeks,
          best: bestWeeklyStreak(data.sessions, todayIso, trains),
        },
        {
          label: 'Gi + No-Gi in the same week',
          n: giNoGiStreak(data.sessions, todayIso).weeks,
          best: bestWeeklyStreak(data.sessions, todayIso, mixes),
        },
        {
          label: data.focus.tag ? `Focus work — ${data.focus.tag}` : 'Focus work — set a focus tag',
          n: focusStreak(data.sessions, data.focus.tag, todayIso).weeks,
          best: bestWeeklyStreak(data.sessions, todayIso, focuses),
        },
      ],
      xp: yearXp(data.sessions, data.competitions, todayIso),
      chars: characteristics(data.sessions, data.competitions),
      totalXpAll: totalXp(data.sessions, data.competitions),
      lvl: characterLevel(totalXp(data.sessions, data.competitions)),
      tree: skillTree(data.tagList, data.sessions, data.competitions),
    }
  }, [data.sessions, data.competitions, data.tagList, data.focus.tag, goal, st.weeks, todayIso])

  return (
    <div className="screen">
      <h1 className="screen-title">Progress</h1>
      <div className="screen-sub">Consistency beats intensity.</div>

      <section className="card card--lg streak-card">
        <div className="ring-wrap">
          <div className="ring-pulse" />
          <div className="ring">
            <div className="ring-n">{st.weeks}</div>
            <div className="ring-l">{st.weeks === 1 ? 'WEEK' : 'WEEKS'}</div>
          </div>
        </div>
        <div className="streak-title">Current streak</div>
        <div className="streak-sub">
          {st.weeks > 0 && st.sinceIso
            ? `${goal}+ sessions every week since ${fmtShort(st.sinceIso)}`
            : `Log ${goal}+ sessions a week to start a streak.`}
        </div>
      </section>

      <div className="section-label label-row">Levels</div>
      <div className="mrows">
        <BeltCard promotions={data.promotions} todayIso={todayIso} onAdd={onAddPromotion} />
        <div className="card crow-char">
          <div className="crow-char-head">
            <span className="crow-char-label">Character</span>
            <span className="crow-char-lv">LV {lvl.level}</span>
          </div>
          <div className="level-track">
            <span className="level-fill" style={{ width: `${Math.round((100 * lvl.into) / lvl.need)}%` }} />
          </div>
          <div className="crow-char-xp">
            {lvl.into} / {lvl.need} XP · {totalXpAll.toLocaleString('en-US')} total
          </div>
        </div>
      </div>
      <div className="levels-sublabel">Characteristics</div>
      <div className="mrows">
        {chars.map((c) => {
          const n = sessionsToNext(c)
          return (
            <div key={c.id} className={`card crow-char${c.xp > 0 ? '' : ' crow-char--idle'}`}>
              <div className="crow-char-head">
                <span className="crow-char-label">{c.label}</span>
                <span className="crow-char-lv">LV {c.level}</span>
              </div>
              <div className="level-track">
                <span className="level-fill" style={{ width: `${Math.round((100 * c.into) / c.need)}%` }} />
              </div>
              <div className="crow-char-xp">
                {c.into} / {c.need} XP · {n} {n === 1 ? 'session' : 'sessions'} to LV {c.level + 1}
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-label label-row">Skill tree</div>
      <SkillTree
        tree={tree}
        todayIso={todayIso}
        focusTag={data.focus.tag}
        // A leaf IS a tag, so "Set as focus" links it directly and titles the goal after it.
        onFocusTag={(tag) => onChangeFocus({ title: tag, tag })}
      />

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
            {f.best > f.n && <div className="frow-best">best ×{f.best}</div>}
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

      <div className="section-label label-row">Experience</div>
      <div className="stat-row">
        <section className="card stat-card">
          <div className="kicker">XP today</div>
          <div className="stat-line">
            <span className="stat-n stat-n--xp">+{xp.today}</span>
          </div>
        </section>
        <section className="card stat-card">
          <div className="kicker">This year</div>
          <div className="stat-line">
            <span className="stat-n">+{xp.year}</span>
          </div>
        </section>
      </div>
      <div className="stat-row">
        <section className="card stat-card">
          <div className="kicker">Best day</div>
          <div className="stat-line">
            <span className="stat-n">+{xp.bestDay}</span>
          </div>
        </section>
        <section className="card stat-card">
          <div className="kicker">Avg / day</div>
          <div className="stat-line">
            <span className="stat-n">+{xp.avgPerDay}</span>
          </div>
        </section>
      </div>
      <section className="card xp-card">
        <XpSparkline byDay={xp.byDay} />
        <div className="vol-x">
          <span>Jan</span>
          <span>Dec</span>
        </div>
      </section>

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

/** Year XP as a single polyline — the quiet cousin of RPGreal's XP chart. */
function XpSparkline({ byDay }: { byDay: number[] }) {
  const W = 320
  const H = 72
  const max = Math.max(...byDay, 1)
  const points = byDay
    .map((v, i) => `${((i / (byDay.length - 1)) * W).toFixed(1)},${(H - 4 - (v / max) * (H - 8)).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="xp-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="XP per day this year">
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
