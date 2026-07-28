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

export function formatDocumentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    photo_id: 'Photo identification',
    cpr_certificate: 'CPR certificate',
    background_check: 'Background check',
    employment_agreement: 'Employment agreement',
    form_submission: 'Application form',
    car_insurance: 'Car insurance policy',
  }
  return labels[category] ?? formatStatusLabel(category)
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

export function formatDateUS(input: Date | string | undefined | null): string {
  if (input === undefined || input === null) return ''
  let date: Date
  if (typeof input === 'string') {
    // Parse ISO date-only strings as local date to avoid timezone shifts.
    const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      date = new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    } else {
      date = new Date(input)
    }
  } else {
    date = input
  }
  if (Number.isNaN(date.getTime())) return String(input)
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function calculateAge(dateOfBirth: string | undefined): number | undefined {
  if (!dateOfBirth) return undefined
  let birth: Date
  // Parse ISO date-only strings as local date to avoid timezone shifts.
  const dateOnlyMatch = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    birth = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    )
  } else {
    birth = new Date(dateOfBirth)
  }
  if (Number.isNaN(birth.getTime())) return undefined
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
  if (today < birthdayThisYear) age -= 1
  return age
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
