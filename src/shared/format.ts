export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatHours(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} hrs`
}

export function formatStatusLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatTimeRange(scheduledStart: string, scheduledEnd: string): string {
  const start = scheduledStart.slice(11, 16)
  const end = scheduledEnd.slice(11, 16)
  const date = scheduledStart.slice(0, 10)
  return `${date} · ${start}–${end}`
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatWeekdayDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return String(input)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDurationHours(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  if (hours <= 0) return ''
  const whole = Math.round(hours * 10) / 10
  const display = whole % 1 === 0 ? String(Math.round(whole)) : whole.toFixed(1)
  return `${display === '1' ? '1 hour' : `${display} hours`}`
}

export function formatAddress(
  address?: Record<string, string | number | undefined> | null,
): string {
  if (!address) return 'No address'
  const line1 = address.line1
  const line2 = address.line2
  const city = address.city
  const state = address.state
  const postalCode = address.postalCode

  const parts = []
  if (line1) parts.push(line1)
  if (line2) parts.push(line2)

  const cityState = [city, state].filter(Boolean).join(', ')
  if (cityState) parts.push(cityState)
  if (postalCode) parts.push(postalCode)

  return parts.length > 0 ? parts.join(', ') : 'No address'
}

export function formatStreetAddress(
  address?: Record<string, string | number | undefined> | null,
): string {
  if (!address) return 'No address'
  const line1 = address.line1
  const line2 = address.line2
  const parts = [line1, line2].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'No address'
}
