import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'

const STORAGE_KEY = 'rollbook:v1'

export const DEFAULT_TAGS = [
  'Half guard',
  'Guard retention',
  'Knee cut',
  'Kimura',
  'De La Riva',
  'Leg locks',
  'Sweeps',
  'Passing',
  'Darce',
  'Mount attacks',
  'Back takes',
  'Escapes',
]

export function emptyData(): AppData {
  return {
    sessions: [],
    tagList: [...DEFAULT_TAGS],
    focus: { title: '', tag: '' },
    settings: { weeklyGoal: 2, showMilestones: true },
    stateUpdatedAt: 0,
  }
}

function load(): AppData {
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
      })),
      tagList: Array.isArray(parsed.tagList) && parsed.tagList.length > 0 ? parsed.tagList : base.tagList,
      focus: { ...base.focus, ...parsed.focus },
      settings: { ...base.settings, ...parsed.settings },
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
