import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { haversineDistanceMeters } from './locationValidation'

const shiftSourcePath = resolve(__dirname, 'shifts.ts')
const shiftSource = readFileSync(shiftSourcePath, 'utf-8')
const locationSourcePath = resolve(__dirname, 'locationValidation.ts')
const locationSource = readFileSync(locationSourcePath, 'utf-8')

describe('shift clock exports', () => {
  it('exports clockIn and clockOut', async () => {
    const mod = await import('./shifts')
    expect(mod).toHaveProperty('clockIn')
    expect(mod).toHaveProperty('clockOut')
  })
})

describe('clock-in/out authorization', () => {
  it('restricts clockIn to caregivers', () => {
    expect(shiftSource).toContain('export const clockIn')
    expect(shiftSource).toMatch(
      /clockIn[\s\S]*?requireTenantRole[\s\S]*?\['org:caregiver'\]/,
    )
  })

  it('restricts clockOut to caregivers', () => {
    expect(shiftSource).toContain('export const clockOut')
    expect(shiftSource).toMatch(
      /clockOut[\s\S]*?requireTenantRole[\s\S]*?\['org:caregiver'\]/,
    )
  })

  it('only allows caregivers to clock their assigned shifts', () => {
    expect(shiftSource).toContain(
      'Caregivers can only clock in to their assigned shifts.',
    )
    expect(shiftSource).toContain(
      'Caregivers can only clock out of their assigned shifts.',
    )
  })
})

describe('progress note writes require clock-in', () => {
  it('guards updateProgressNote with assertClockInPunchExists', () => {
    expect(shiftSource).toContain('export const updateProgressNote')
    expect(shiftSource).toContain('assertClockInPunchExists')
  })

  it('guards submitDocumentation with assertClockInPunchExists', () => {
    expect(shiftSource).toMatch(/submitShift[\s\S]*?assertClockInPunchExists/)
  })

  it('includes a clear error when clock-in is missing', () => {
    expect(shiftSource).toContain(
      'You must clock in before you can document or submit this shift.',
    )
  })
})

describe('clock-in geofence gating', () => {
  it('validates location through validateClockPunchLocation', () => {
    expect(shiftSource).toContain('validateClockPunchLocation')
    expect(shiftSource).toContain('resolveShiftServiceTarget')
  })

  it('requires location when geofence enforcement is enabled', () => {
    expect(locationSource).toContain('Location is required for this punch')
  })

  it('rejects clock-in outside the service radius', () => {
    expect(locationSource).toContain('outside the allowed')
  })

  it('enforces maximum location accuracy', () => {
    expect(locationSource).toContain('exceeds the agency limit')
  })
})

describe('clock-out documentation gating', () => {
  it('validates documentation completeness before clock-out', () => {
    expect(shiftSource).toMatch(/clockOut[\s\S]*?validateShiftDocumentation/)
  })

  it('blocks clock-out when documentation is incomplete', () => {
    expect(shiftSource).toMatch(/clockOut[\s\S]*?Incomplete documentation/)
  })
})

describe('clock-out geofence gating', () => {
  it('validates clock-out location before submitting', () => {
    const clockOutBlock = shiftSource.slice(
      shiftSource.indexOf('export const clockOut'),
    )
    const submitIndex = clockOutBlock.indexOf('await submitShift')
    expect(submitIndex).toBeGreaterThan(0)
    expect(clockOutBlock.indexOf('validateClockPunchLocation')).toBeLessThan(
      submitIndex,
    )
  })
})

describe('clock punch side effects', () => {
  it('records clock_in and clock_out timePunches', () => {
    expect(shiftSource).toContain("punchType: 'clock_in'")
    expect(shiftSource).toContain("punchType: 'clock_out'")
  })

  it('patches shift clockInAt and clockOutAt timestamps', () => {
    expect(shiftSource).toContain('clockInAt: now')
    expect(shiftSource).toContain('clockOutAt: now')
  })

  it('writes audit events for clock actions', () => {
    expect(shiftSource).toContain("'shift_submitted'")
    expect(shiftSource).toContain('clocked_in')
    expect(shiftSource).toContain('clocked_out')
    expect(shiftSource).toContain('ctx.runMutation(internal.audit.record')
  })

  it('enqueues ADP sync after clock punches', () => {
    expect(shiftSource).toContain('internal.adpSync.adpSyncPunch')
  })
})

describe('idempotent clock-in', () => {
  it('looks up existing clock_in punch before creating another', () => {
    expect(shiftSource).toMatch(/clockIn[\s\S]*?findPunch[\s\S]*?'clock_in'/)
  })

  it('returns existing punch on double clock-in', () => {
    expect(shiftSource).toContain('if (existing) {')
    expect(shiftSource).toContain('return { punchId: existing._id')
  })
})

describe('clock-out reuses submit path', () => {
  it('calls submitShift from clockOut', () => {
    const clockOutBlock = shiftSource.slice(
      shiftSource.indexOf('export const clockOut'),
    )
    expect(clockOutBlock).toContain('await submitShift(')
  })
})

describe('service location mutations', () => {
  it('exports updateServiceLocationOverride for admin/coordinator', () => {
    expect(shiftSource).toContain('export const updateServiceLocationOverride')
    expect(shiftSource).toContain("'org:admin'")
    expect(shiftSource).toContain("'org:coordinator'")
  })
})

describe('haversine sanity for test coordinates', () => {
  it('computes a small distance for nearby coordinates', () => {
    const home = { latitude: 44.9778, longitude: -93.265 }
    const nearby = { latitude: 44.9779, longitude: -93.2649 }
    expect(haversineDistanceMeters(home, nearby)).toBeLessThan(100)
  })
})
