import type { Id } from '../../../../convex/_generated/dataModel'

export type EnrichedShift = {
  _id: Id<'shifts'>
  _creationTime: number
  tenantId: Id<'tenants'>
  clientId: Id<'clients'>
  caregiverId: string
  scheduledStart: string
  scheduledEnd: string
  status: string
  serviceType: 'SLS' | 'ILS'
  rate: number
  clientDisplayName: string
  caregiverDisplayName: string
  serviceLocationOverride?: {
    label: string
    addressLine?: string
    latitude: number
    longitude: number
    radiusMeters?: number
  }
}

export function toIsoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}

export function formatDateInput(d: Date): string {
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

export function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()
  const startText = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const endText = end.toLocaleDateString('en-US', {
    month: sameMonth ? undefined : 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const separator = sameMonth ? '–' : ' – '
  return `${startText}${separator}${endText}`
}

export function localDayOfWeek(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.getDay()
}

export function localDateString(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return formatDateInput(date)
}

export function coversSlot(
  windows: Array<{
    kind: 'recurring' | 'one-off'
    dayOfWeek?: number
    date?: string
    startTime: string
    endTime: string
    available: boolean
  }>,
  date: string,
  startTime: string,
  endTime: string,
): 'available' | 'no-windows' | 'uncovered' {
  const day = localDayOfWeek(`${date}T${startTime}`)
  const matching = windows.filter(
    (w) =>
      (w.kind === 'recurring' && w.dayOfWeek === day) ||
      (w.kind === 'one-off' && w.date === date),
  )

  if (matching.length === 0) return 'no-windows'

  const available = matching
    .filter((w) => w.available)
    .map((w) => ({
      start: timeToMinutes(w.startTime),
      end: timeToMinutes(w.endTime),
    }))
    .sort((a, b) => a.start - b.start)

  if (available.length === 0) return 'uncovered'

  const slotStart = timeToMinutes(startTime)
  const slotEnd = timeToMinutes(endTime)
  let coveredUntil = slotStart

  for (const interval of available) {
    if (interval.start > coveredUntil) return 'uncovered'
    coveredUntil = Math.max(coveredUntil, interval.end)
    if (coveredUntil >= slotEnd) return 'available'
  }

  return 'uncovered'
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function parseConflictError(
  message: string,
): { start: string; end: string } | null {
  const match = message.match(/\(([^)]+) - ([^)]+)\)/)
  if (!match) return null
  return { start: match[1], end: match[2] }
}
