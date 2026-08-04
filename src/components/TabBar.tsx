import { ChartBar, House, ListBullets, Plus, Target } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { Tab } from '../types'

const TABS: { id: Tab; label: string; icon?: Icon }[] = [
  { id: 'dash', label: 'Home', icon: House },
  { id: 'history', label: 'Sessions', icon: ListBullets },
  { id: 'log', label: 'Log' },
  { id: 'tech', label: 'Techniques', icon: Target },
  { id: 'progress', label: 'Progress', icon: ChartBar },
]

export function TabBar({ tab, onPick }: { tab: Tab; onPick: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const TabIcon = t.icon
        return (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' tab--active' : ''}`}
            onClick={() => onPick(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {TabIcon ? (
              <span className="tab-icon">
                <TabIcon size={21} />
              </span>
            ) : (
              <span className="tab-log">
                <Plus size={22} />
              </span>
            )}
            <span className="tab-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
