import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'

const STORAGE_KEY = 'rollbook:v1'

export const DEFAULT_TAGS = [
  'Half guard',
  'Guard retention',
  'Knee cut',
  'Kimura',
  'De La Riva',
  'DLR X',
  'Leg locks',
  'Sweeps',
  'Passing',
  'Over-Under Pass',
  'Darce',
  'Mount attacks',
  'Back takes',
  'Escapes',
]

export function emptyData(): AppData {
  return {
    sessions: [],
    competitions: [],
    tagList: [...DEFAULT_TAGS],
    focus: { title: '', tag: '' },
    settings: { weeklyGoal: 2, showMilestones: true },
    stateUpdatedAt: 0,
  }
}

/** Exported for tests; the app itself only reaches it through useAppData. */
export function load(): AppData {
  const base = emptyData()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      // Pre-sync data lacks updatedAt: default it to createdAt.
      sessions: (Array.isArray(parsed.sessions) ? parsed.sessions : base.sessions).map((s) => ({
        ...s,
        updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : s.createdAt,
        rolls: typeof s.rolls === 'number' && Number.isInteger(s.rolls) && s.rolls >= 0 && s.rolls <= 1000 ? s.rolls : 0,
        specific:
          typeof s.specific === 'number' && Number.isInteger(s.specific) && s.specific >= 0 && s.specific <= 1000
            ? s.specific
            : 0,
        specClosed:
          typeof s.specClosed === 'number' && Number.isInteger(s.specClosed) && s.specClosed >= 0 && s.specClosed <= 1000
            ? s.specClosed
            : 0,
        specMount:
          typeof s.specMount === 'number' && Number.isInteger(s.specMount) && s.specMount >= 0 && s.specMount <= 1000
            ? s.specMount
            : 0,
        specOpen:
          typeof s.specOpen === 'number' && Number.isInteger(s.specOpen) && s.specOpen >= 0 && s.specOpen <= 1000
            ? s.specOpen
            : 0,
        durationMin:
          typeof s.durationMin === 'number' && Number.isInteger(s.durationMin) && s.durationMin >= 1 && s.durationMin <= 600
            ? s.durationMin
            : null,
        intensity:
          s.intensity === 1 || s.intensity === 2 || s.intensity === 3 || s.intensity === 4 || s.intensity === 5
            ? s.intensity
            : null,
        time: typeof s.time === 'string' ? s.time : null,
      })),
      // Blobs from before the competitions feature simply gain the empty array;
      // pre-placement/tags comps gain the defaults.
      competitions: (Array.isArray(parsed.competitions) ? parsed.competitions : base.competitions).map((c) => ({
        ...c,
        placement: c.placement === 'bronze' || c.placement === 'silver' || c.placement === 'gold' ? c.placement : 'none',
        tags: Array.isArray(c.tags) ? c.tags : [],
      })),
      tagList: Array.isArray(parsed.tagList) && parsed.tagList.length > 0 ? parsed.tagList : base.tagList,
      focus: { ...base.focus, ...parsed.focus },
      settings: {
        ...base.settings,
        ...parsed.settings,
        // Same clamp as the pull sanitizer — a poisoned goal must not persist.
        weeklyGoal:
          typeof parsed.settings?.weeklyGoal === 'number' &&
          Number.isFinite(parsed.settings.weeklyGoal) &&
          parsed.settings.weeklyGoal >= 1
            ? Math.round(parsed.settings.weeklyGoal)
            : base.settings.weeklyGoal,
      },
      stateUpdatedAt: typeof parsed.stateUpdatedAt === 'number' ? parsed.stateUpdatedAt : 0,
    }
  } catch {
    return base
  }
}

function persist(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Private mode / quota: the app keeps working in memory.
  }
}

export function useAppData(): [AppData, (fn: (d: AppData) => AppData) => void] {
  const [data, setData] = useState<AppData>(load)
  const update = useCallback((fn: (d: AppData) => AppData) => setData(fn), [])
  useEffect(() => persist(data), [data])
  return [data, update]
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
