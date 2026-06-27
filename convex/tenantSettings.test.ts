import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'

const sourcePath = resolve(__dirname, 'tenantSettings.ts')
const source = readFileSync(sourcePath, 'utf-8')

describe('Tenant geofence defaults', () => {
  it('has geofence enforcement turned off by default', () => {
    expect(DEFAULT_SHIFT_GEOFENCE.enabled).toBe(false)
    expect(DEFAULT_SHIFT_GEOFENCE.enforceClockIn).toBe(false)
    expect(DEFAULT_SHIFT_GEOFENCE.enforceClockOut).toBe(false)
  })

  it('exports numeric radius defaults', () => {
    expect(typeof DEFAULT_SHIFT_GEOFENCE.defaultRadiusMeters).toBe('number')
    expect(typeof DEFAULT_SHIFT_GEOFENCE.maxAccuracyMeters).toBe('number')
    expect(DEFAULT_SHIFT_GEOFENCE.defaultRadiusMeters).toBeGreaterThan(0)
    expect(DEFAULT_SHIFT_GEOFENCE.maxAccuracyMeters).toBeGreaterThan(0)
  })
})

describe('Convex tenantSettings exports', () => {
  it('exports get and updateShiftGeofence', async () => {
    const mod = await import('./tenantSettings')
    expect(mod).toHaveProperty('get')
    expect(mod).toHaveProperty('updateShiftGeofence')
    expect(mod).toHaveProperty('DEFAULT_SHIFT_GEOFENCE')
  })
})

describe('tenantSettings role guards', () => {
  it('restricts updateShiftGeofence to admin and coordinator', () => {
    expect(source).toContain('updateShiftGeofence')
    expect(source).toContain("'org:admin'")
    expect(source).toContain("'org:coordinator'")
    expect(source).not.toContain("'org:caregiver'")
  })
})
