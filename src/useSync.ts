/**
 * Scheduling side of sync. Triggers: launch (pull → merge → push), explicit
 * requestPush() from save/edit call sites (debounced), regaining 'online',
 * and PWA foregrounding (visibilitychange, throttled — an installed app
 * resumed from the background does not re-launch, and this is the natural
 * "switched devices" pull moment).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { SYNC_ENABLED } from './config'
import { mergeAppData, pullAll, pushAll } from './sync'
import type { SyncStatus } from './sync'
import type { AppData } from './types'

const PUSH_DEBOUNCE_MS = 2_000
const VISIBILITY_MIN_GAP_MS = 60_000

export function useSync(
  data: AppData,
  update: (fn: (d: AppData) => AppData) => void,
): { status: SyncStatus; requestPush: () => void } {
  const [status, setStatus] = useState<SyncStatus>(SYNC_ENABLED ? 'syncing' : 'disabled')
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const started = useRef(false)
  const lastCycleAt = useRef(0)

  const fail = useCallback(() => setStatus(navigator.onLine ? 'error' : 'offline'), [])

  // Trailing debounce; bursts of saves/edits collapse into one upsert that
  // reads the freshest data at fire time. Failures wait for the next trigger.
  const requestPush = useCallback(() => {
    if (!SYNC_ENABLED) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setStatus('syncing')
      pushAll(dataRef.current).then(() => setStatus('synced'), fail)
    }, PUSH_DEBOUNCE_MS)
  }, [fail])

  const cycle = useCallback(() => {
    if (!SYNC_ENABLED) return
    lastCycleAt.current = Date.now()
    setStatus('syncing')
    pullAll().then((remote) => {
      // Merge INSIDE the functional updater: a session saved while the pull
      // was in flight is present in `d` here, so it survives ("absent
      // remotely → kept"). Computing a merged value outside and overwriting
      // would clobber exactly those writes.
      update((d) => mergeAppData(d, remote))
      requestPush() // push back anything remote was missing
    }, fail)
  }, [update, requestPush, fail])

  // Launch cycle once per real mount; the ref survives StrictMode's
  // simulated remount. Deliberately NO abort in cleanup — it would cancel
  // this only pull; AbortSignal.timeout in the IO layer is the sole cancel.
  useEffect(() => {
    if (!started.current && SYNC_ENABLED) {
      started.current = true
      cycle()
    }
  }, [cycle])

  useEffect(() => {
    if (!SYNC_ENABLED) return
    const onOnline = () => cycle()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCycleAt.current > VISIBILITY_MIN_GAP_MS) {
        cycle()
      }
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cycle])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return { status, requestPush }
}
