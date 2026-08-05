import { useEffect, useState } from 'react'
import { TabBar } from './components/TabBar'
import { autoTitle, toIso } from './dates'
import { demoData } from './demo'
import { Home } from './screens/Home'
import { Log } from './screens/Log'
import { Progress } from './screens/Progress'
import { Sessions } from './screens/Sessions'
import { Techniques } from './screens/Techniques'
import { orderTagsByUsage, withSessionTags } from './stats'
import { emptyData, uid, useAppData } from './store'
import { useSync } from './useSync'
import type { FocusGoal, GiFilter, LogForm, Session, Tab } from './types'

declare global {
  interface Window {
    rollbook?: { seed: () => void; clear: () => void }
  }
}

function useTodayIso(): string {
  const [iso, setIso] = useState(() => toIso(new Date()))
  useEffect(() => {
    const t = setInterval(() => setIso(toIso(new Date())), 60_000)
    return () => clearInterval(t)
  }, [])
  return iso
}

const EMPTY_FORM: LogForm = { rolls: 0, subsFor: 0, subsAgainst: 0, roundMin: 5, gi: true, tags: [] }

export default function App() {
  const [data, update] = useAppData()
  const { status: syncStatus, requestPush } = useSync(data, update)
  const todayIso = useTodayIso()
  const [tab, setTab] = useState<Tab>('dash')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<GiFilter>('All')
  const [form, setForm] = useState<LogForm>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)

  // Demo/reset helpers for trying the app: window.rollbook.seed() / .clear()
  useEffect(() => {
    window.rollbook = {
      seed: () => update(() => demoData(toIso(new Date()))),
      clear: () => update(() => emptyData()),
    }
    return () => {
      delete window.rollbook
    }
  }, [update])

  // Switching away from Log clears the saved confirmation (per the handoff).
  const pickTab = (t: Tab) => {
    setTab(t)
    setSaved(false)
  }

  // A recent-session tap on Home opens Sessions with that row expanded;
  // on Sessions itself the same tap toggles the accordion.
  const openSession = (id: string) => {
    setExpandedId((cur) => (tab === 'history' && cur === id ? null : id))
    setTab('history')
  }

  const patchForm = (patch: Partial<LogForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }

  const saveSession = () => {
    const now = new Date()
    const session: Session = {
      id: uid(),
      date: toIso(now),
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      title: autoTitle(now),
      gi: form.gi,
      rolls: form.rolls,
      subsFor: form.subsFor,
      subsAgainst: form.subsAgainst,
      roundMin: form.roundMin,
      tags: form.tags,
    }
    update((d) => ({ ...d, sessions: [...d.sessions, session] }))
    setForm((f) => ({ ...f, rolls: 0, subsFor: 0, subsAgainst: 0, tags: [] }))
    setSaved(true)
    requestPush()
  }

  const addTag = (name: string) => {
    const stamp = Date.now()
    update((d) =>
      d.tagList.some((t) => t.toLowerCase() === name.toLowerCase())
        ? d
        : { ...d, tagList: [...d.tagList, name], stateUpdatedAt: stamp },
    )
    requestPush()
  }

  const setFocus = (focus: FocusGoal) => {
    const stamp = Date.now()
    update((d) => ({ ...d, focus, stateUpdatedAt: stamp }))
    requestPush()
  }

  return (
    <div className="app">
      {/* Keyed by tab so scroll position resets on switch (per the handoff). */}
      <main className="screens" key={tab}>
        {tab === 'dash' && (
          <Home
            data={data}
            todayIso={todayIso}
            syncStatus={syncStatus}
            onSeeAll={() => pickTab('history')}
            onOpenSession={openSession}
            onChangeFocus={setFocus}
          />
        )}
        {tab === 'history' && (
          <Sessions
            data={data}
            filter={filter}
            onFilter={setFilter}
            expandedId={expandedId}
            onToggle={openSession}
          />
        )}
        {tab === 'log' && (
          <Log
            form={form}
            onPatch={patchForm}
            tagList={orderTagsByUsage(withSessionTags(data.tagList, data.sessions), data.sessions, todayIso)}
            onAddTag={addTag}
            onSave={saveSession}
            saved={saved}
          />
        )}
        {tab === 'tech' && <Techniques data={data} todayIso={todayIso} onChangeFocus={setFocus} />}
        {tab === 'progress' && <Progress data={data} todayIso={todayIso} />}
      </main>
      <TabBar tab={tab} onPick={pickTab} />
    </div>
  )
}
