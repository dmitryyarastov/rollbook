import { useMemo } from 'react'
import { Chip } from '../components/Chip'
import { CompRow } from '../components/CompRow'
import { SessionRow } from '../components/SessionRow'
import { historyFeed } from '../stats'
import type { AppData, GiFilter } from '../types'

const FILTERS: GiFilter[] = ['All', 'Gi', 'No-Gi']

interface SessionsProps {
  data: AppData
  filter: GiFilter
  onFilter: (f: GiFilter) => void
  expandedId: string | null
  onToggle: (id: string) => void
}

export function Sessions({ data, filter, onFilter, expandedId, onToggle }: SessionsProps) {
  // Accordion toggles re-render this screen; the feed only depends on data.
  const list = useMemo(
    () =>
      historyFeed(data.sessions, data.competitions).filter(
        (e) => filter === 'All' || (filter === 'Gi') === e.item.gi,
      ),
    [data.sessions, data.competitions, filter],
  )

  return (
    <div className="screen">
      <h1 className="screen-title">Sessions</h1>
      <div className="chips chips--filters">
        {FILTERS.map((f) => (
          <Chip key={f} on={filter === f} onClick={() => onFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      {list.length > 0 ? (
        <div className="slist">
          {list.map((e) =>
            e.kind === 'session' ? (
              <SessionRow
                key={e.item.id}
                session={e.item}
                expanded={expandedId === e.item.id}
                onClick={() => onToggle(e.item.id)}
              />
            ) : (
              <CompRow
                key={e.item.id}
                comp={e.item}
                expanded={expandedId === e.item.id}
                onClick={() => onToggle(e.item.id)}
              />
            ),
          )}
        </div>
      ) : (
        <div className="empty">
          {data.sessions.length + data.competitions.length === 0
            ? 'No sessions yet — hit the + tab after class.'
            : `No ${filter} entries logged yet.`}
        </div>
      )}
    </div>
  )
}
