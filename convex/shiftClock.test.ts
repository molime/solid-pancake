import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convexTest } from 'convex-test'
import { haversineDistanceMeters } from './locationValidation'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

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
    expect(shiftSource).toContain('internal.adpOutbound.adpSyncPunch')
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

const runtimeModules = import.meta.glob('./**/*.*s')

function createRuntimeConvex() {
  return convexTest({ schema, modules: runtimeModules })
}

async function seedShift(
  t: ReturnType<typeof createRuntimeConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    geofenceEnabled?: boolean
    clientLatitude?: number
    clientLongitude?: number
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence: {
        enabled: options.geofenceEnabled ?? false,
        enforceClockIn: options.geofenceEnabled ?? false,
        enforceClockOut: options.geofenceEnabled ?? false,
        defaultRadiusMeters: 100,
        maxAccuracyMeters: 50,
      },
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
      serviceAddress: {
        line1: '123 Main St',
        city: 'Minneapolis',
        state: 'MN',
        postalCode: '55401',
        latitude: options.clientLatitude,
        longitude: options.clientLongitude,
      },
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: 'pending',
    })

    return { tenantId, clientId, shiftId }
  })
}

function asCaregiverRuntime(
  t: ReturnType<typeof createRuntimeConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

describe('clock-in geofence runtime', () => {
  it('allows clock-in without location when geofence is disabled', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_disabled'
    const caregiverId = 'user_cg_geo_disabled'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: false,
    })

    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(result.punchId).toBeDefined()

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punch?.location).toBeUndefined()
  })

  it('allows clock-in inside radius and stores location evidence', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_inside'
    const caregiverId = 'user_cg_geo_inside'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
        location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 5 },
      },
    )

    expect(result.punchId).toBeDefined()

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punch?.location).toBeDefined()
    expect(punch?.location?.withinGeofence).toBe(true)
  })

  it('rejects clock-in outside radius and creates no punch', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_outside'
    const caregiverId = 'user_cg_geo_outside'
    const { tenantId, shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        {
          clerkOrgId,
          shiftId,
          location: { latitude: 45.0, longitude: -93.0, accuracyMeters: 5 },
        },
      ),
    ).rejects.toThrow('outside the allowed')

    const punches = await t.run(async (ctx) => {
      return ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift_type', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', 'clock_in'),
        )
        .collect()
    })
    expect(punches).toHaveLength(0)
  })

  it('rejects clock-in when required location is missing', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_missing'
    const caregiverId = 'user_cg_geo_missing'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        { clerkOrgId, shiftId },
      ),
    ).rejects.toThrow('Location is required')
  })

  it('rejects clock-in when location accuracy exceeds agency limit', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_accuracy'
    const caregiverId = 'user_cg_geo_accuracy'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        {
          clerkOrgId,
          shiftId,
          location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 200 },
        },
      ),
    ).rejects.toThrow('exceeds the agency limit')
  })
})
