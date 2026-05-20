import { describe, expect, it, vi } from 'vitest'
import {
  initialShiftStatusForStart,
  isScheduledStartDue,
} from './shiftLifecycle'

describe('shift lifecycle helpers', () => {
  it('treats past and current scheduled starts as due', () => {
    const now = new Date('2026-05-20T12:00:00Z').getTime()

    expect(isScheduledStartDue('2026-05-20T11:59:00Z', now)).toBe(true)
    expect(isScheduledStartDue('2026-05-20T12:00:00Z', now)).toBe(true)
  })

  it('does not treat future scheduled starts as due', () => {
    const now = new Date('2026-05-20T12:00:00Z').getTime()

    expect(isScheduledStartDue('2026-05-20T12:01:00Z', now)).toBe(false)
  })

  it('creates due shifts in progress and future shifts as scheduled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'))

    expect(initialShiftStatusForStart('2026-05-20T10:00:00Z')).toBe(
      'in_progress',
    )
    expect(initialShiftStatusForStart('2026-05-21T10:00:00Z')).toBe(
      'scheduled',
    )

    vi.useRealTimers()
  })
})
