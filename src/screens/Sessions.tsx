import { Chip } from '../components/Chip'
import { SessionRow } from '../components/SessionRow'
import { sortByDateDesc } from '../stats'
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
  const list = sortByDateDesc(data.sessions).filter(
    (s) => filter === 'All' || (filter === 'Gi') === s.gi,
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
          {list.map((s) => (
            <SessionRow key={s.id} session={s} expanded={expandedId === s.id} onClick={() => onToggle(s.id)} />
          ))}
        </div>
      ) : (
        <div className="empty">
          {data.sessions.length === 0
            ? 'No sessions yet — hit the + tab after class.'
            : `No ${filter} sessions logged yet.`}
        </div>
      )}
    </div>
  )
}
