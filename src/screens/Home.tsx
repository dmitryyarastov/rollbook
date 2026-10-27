import { useMemo } from 'react'
import { currentRank, rankLabel } from '../belts'
import { BeltGlyph } from '../components/BeltGlyph'
import { CompRow } from '../components/CompRow'
import { FocusCard } from '../components/FocusCard'
import { SessionRow } from '../components/SessionRow'
import { BarLegend, SplitBar } from '../components/SplitBar'
import { fmtToday } from '../dates'
import { focusProgress, formatHours, historyFeed, streak, weekSummary } from '../stats'
import { characterLevel, totalXp } from '../xp'
import type { SyncStatus } from '../sync'
import type { AppData, FocusGoal } from '../types'

const SYNC_LABELS: Record<SyncStatus, string | null> = {
  disabled: null,
  syncing: 'syncing…',
  synced: 'synced',
  offline: 'offline — will sync',
  error: 'sync error',
}

interface HomeProps {
  data: AppData
  todayIso: string
  syncStatus: SyncStatus
  onSeeAll: () => void
  onOpenSession: (id: string) => void
  onChangeFocus: (focus: FocusGoal) => void
}

export function Home({ data, todayIso, syncStatus, onSeeAll, onOpenSession, onChangeFocus }: HomeProps) {
  const goal = data.settings.weeklyGoal
  const { week, st, recent, lvl, rank } = useMemo(
    () => ({
      week: weekSummary(data.sessions, todayIso),
      st: streak(data.sessions, goal, todayIso),
      recent: historyFeed(data.sessions, data.competitions).slice(0, 3),
      lvl: characterLevel(totalXp(data.sessions, data.competitions)),
      rank: currentRank(data.promotions, todayIso),
    }),
    [data.sessions, data.competitions, data.promotions, goal, todayIso],
  )
  const maxBar = Math.max(...week.bars.map((b) => b.rounds), 1)

  return (
    <div className="screen">
      <header className="home-head">
        <h1 className="home-title">Rollbook</h1>
        <div className="home-head-right">
          <div className="home-date">{fmtToday(todayIso)}</div>
          {SYNC_LABELS[syncStatus] && <div className="sync-note">{SYNC_LABELS[syncStatus]}</div>}
        </div>
      </header>

      {rank && (
        <div className="rank-row">
          <BeltGlyph belt={rank.belt} stripes={rank.stripes} />
          <span className="rank-label">{rankLabel(rank)}</span>
        </div>
      )}
      <div className="level-row">
        <span className="level-chip">LV {lvl.level}</span>
        <span className="level-track">
          <span className="level-fill" style={{ width: `${Math.round((100 * lvl.into) / lvl.need)}%` }} />
        </span>
        <span className="level-xp">
          {lvl.into} / {lvl.need} XP
        </span>
      </div>

      <section className="card card--lg hero">
        <div className="hero-top">
          <div>
            <div className="kicker">This week</div>
            <div className="hero-num-row">
              <div className="hero-num">{week.rounds}</div>
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
              <SplitBar rounds={b.rounds} gi={b.gi} rpe={b.rpe} height={b.rounds > 0 ? 8 + (b.rounds / maxBar) * 40 : 4} current />
              <div className="weekbar-day">{b.day}</div>
            </div>
          ))}
        </div>
        <BarLegend />
      </section>

      <div className="stat-row">
        <section className="card stat-card">
          <div className="kicker">Streak</div>
          <div className="stat-line">
            <span className="stat-n">{st.weeks}</span>
            <span className="stat-u">{st.weeks === 1 ? 'week' : 'weeks'}</span>
          </div>
          <div className="stat-note">training {goal}+ / week</div>
        </section>
        <section className="card stat-card">
          <div className="kicker">Specific · week</div>
          <div className="stat-line">
            <span className="stat-n">{week.specific}</span>
            <span className="stat-u">rounds</span>
          </div>
          <div className="stat-note">positional sparring</div>
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
          {recent.map((e) =>
            e.kind === 'session' ? (
              <SessionRow key={e.item.id} session={e.item} onClick={() => onOpenSession(e.item.id)} />
            ) : (
              <CompRow key={e.item.id} comp={e.item} onClick={() => onOpenSession(e.item.id)} />
            ),
          )}
        </div>
      ) : (
        <div className="empty">No sessions yet — hit the + tab after class.</div>
      )}
    </div>
  )
}
