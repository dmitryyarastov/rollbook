/**
 * Local-date helpers. All dates are `yyyy-mm-dd` strings in the device's
 * timezone — a session logged after evening class must land on that local
 * day, so UTC-based APIs (toISOString, `new Date('yyyy-mm-dd')`) are off
 * limits throughout.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_BADGE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add days to a local date (DST-safe via Date's day-overflow arithmetic). */
export function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const d = parseIso(iso)
  const dow = (d.getDay() + 6) % 7
  return addDays(iso, -dow)
}

/** 'Aug 1' */
export function fmtShort(iso: string): string {
  const d = parseIso(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** 'Sun, Aug 2' */
export function fmtToday(iso: string): string {
  const d = parseIso(iso)
  return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

/** 'FRI' — session-row badge. */
export function weekdayBadge(iso: string): string {
  return DAYS_BADGE[parseIso(iso).getDay()]
}

export function monthFull(monthIndex: number): string {
  return MONTHS_FULL[monthIndex]
}

/** 1-based day of year. */
export function dayOfYear(iso: string): number {
  const d = parseIso(iso)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.round((d.getTime() - jan1.getTime()) / 86400000) + 1
}

/** 'HH:MM' (24h) of a Date's local wall-clock time. */
export function toHhmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** '7:30 PM' from 'HH:MM'. */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Resolve a picked class time to a concrete local datetime: the most recent
 * occurrence of that wall-clock time — today if it has already passed, else
 * yesterday (the "logging the morning after an evening class" case). null =
 * right now. Day-overflow Date arithmetic keeps month/DST boundaries safe.
 */
export function resolveWhen(now: Date, hhmm: string | null): Date {
  if (!hhmm) return now
  const [h, m] = hhmm.split(':').map(Number)
  const cand = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  return cand > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, h, m) : cand
}

/**
 * Title for a session logged at `when`: weekday mornings/afternoons/evenings
 * are classes, weekends are open mats. Computed once at save time and stored.
 */
export function autoTitle(when: Date): string {
  const dow = when.getDay()
  if (dow === 0 || dow === 6) return 'Open mat'
  const h = when.getHours()
  if (h < 12) return 'Morning class'
  if (h < 17) return 'Afternoon class'
  return 'Evening class'
}
