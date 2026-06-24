import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const HOME_COORDS = { latitude: 44.9778, longitude: -93.265 }
const NEARBY_COORDS = { latitude: 44.9779, longitude: -93.2649 }
const FAR_COORDS = { latitude: 45.05, longitude: -93.1 }
const DEFAULT_GEOFENCE = {
  enabled: false,
  enforceClockIn: false,
  enforceClockOut: false,
  defaultRadiusMeters: 100,
  maxAccuracyMeters: 50,
}

async function seedAgency(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    geofence?: typeof DEFAULT_GEOFENCE
    scheduledStart?: string
    shiftStatus?: 'scheduled' | 'in_progress'
    note?: {
      startTime?: string
      endTime?: string
      servicesProvided?: string
      clientResponse?: string
      narrative?: string
    }
    task?: {
      status?: 'pending' | 'complete'
      proofName?: string
    }
    clientServiceAddress?: {
      line1: string
      latitude: number
      longitude: number
    }
    serviceLocationOverride?: {
      label: string
      latitude: number
      longitude: number
      radiusMeters?: number
    }
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

    if (options.geofence) {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: options.geofence,
      })
    }

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
        ...options.clientServiceAddress,
      },
    })

    const scheduledStart = options.scheduledStart ?? '2020-01-01T08:00:00Z'
    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart,
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: options.shiftStatus ?? 'scheduled',
      serviceType: 'SLS',
      rate: 25,
      serviceLocationOverride: options.serviceLocationOverride,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: options.note?.startTime ?? '',
      endTime: options.note?.endTime ?? '',
      servicesProvided: options.note?.servicesProvided ?? '',
      clientResponse: options.note?.clientResponse ?? '',
      narrative: options.note?.narrative ?? '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: options.task?.status ?? 'pending',
      proofName: options.task?.proofName,
    })

    return { tenantId, clientId, shiftId }
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

describe('clock-in behavior', () => {
  it('blocks note write before clock-in', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_note_block'
    const caregiverId = 'user_cg_note_block'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'in_progress',
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.shifts.updateProgressNote,
        {
          clerkOrgId,
          shiftId,
          narrative: 'I tried to write a note before clocking in.',
        },
      ),
    ).rejects.toThrow('must clock in')
  })

  it('blocks clock-in when geofence is enabled and location is missing', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_missing'
    const caregiverId = 'user_cg_geo_missing'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockIn: true,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
        clerkOrgId,
        shiftId,
      }),
    ).rejects.toThrow('Location is required')
  })

  it('blocks clock-in outside the service radius', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_outside'
    const caregiverId = 'user_cg_geo_outside'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockIn: true,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
        clerkOrgId,
        shiftId,
        location: { ...FAR_COORDS, accuracyMeters: 10 },
      }),
    ).rejects.toThrow('outside the allowed')
  })

  it('succeeds inside radius and stores distance and location evidence', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_inside'
    const caregiverId = 'user_cg_geo_inside'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockIn: true,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
        location: { ...NEARBY_COORDS, accuracyMeters: 10 },
      },
    )

    expect(result.punchId).toBeDefined()
    expect(result.clockInAt).toBeDefined()

    const punch = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.timePunches.get,
      { clerkOrgId, punchId: result.punchId as Id<'timePunches'> },
    )

    expect(punch.punchType).toBe('clock_in')
    expect(punch.location?.withinGeofence).toBe(true)
    expect(punch.location?.distanceMeters).toBeGreaterThan(0)
    expect(punch.location?.distanceMeters).toBeLessThan(100)
    expect(punch.location?.targetLabel).toBe('Client home')
  })

  it('succeeds without location when geofence is disabled', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_disabled'
    const caregiverId = 'user_cg_geo_disabled'
    const { shiftId } = await seedAgency(t, { clerkOrgId, caregiverId })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
      },
    )

    expect(result.punchId).toBeDefined()

    const shift = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.shiftQueries.getWithDetails,
      { clerkOrgId, shiftId },
    )

    expect(shift.shift.clockInAt).toBeDefined()
    expect(shift.shift.status).toBe('in_progress')
  })

  it('is idempotent: double clock-in does not create two punches', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_double_in'
    const caregiverId = 'user_cg_double_in'
    const { shiftId, tenantId } = await seedAgency(t, { clerkOrgId, caregiverId })

    const first = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )
    const second = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(second.punchId).toBe(first.punchId)

    const punches = await t.run(async (ctx) => {
      return ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift_type', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', 'clock_in'),
        )
        .collect()
    })

    expect(punches).toHaveLength(1)
  })

  it('succeeds with poor accuracy when geofence is disabled', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_disabled_poor_accuracy'
    const caregiverId = 'user_cg_geo_disabled_poor_accuracy'
    const { shiftId } = await seedAgency(t, { clerkOrgId, caregiverId })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
        location: { ...HOME_COORDS, accuracyMeters: 200 },
      },
    )

    expect(result.punchId).toBeDefined()
  })

  it('succeeds with poor accuracy when geofence is enabled but clock-in is not enforced', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_enforce_off_poor_accuracy'
    const caregiverId = 'user_cg_geo_enforce_off_poor_accuracy'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockIn: false,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
        location: { ...HOME_COORDS, accuracyMeters: 200 },
      },
    )

    expect(result.punchId).toBeDefined()
  })
})

describe('clock-out behavior', () => {
  it('blocks direct submitDocumentation before clock-out', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_bypass'
    const caregiverId = 'user_cg_submit_bypass'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'in_progress',
      note: {
        startTime: '08:00',
        endTime: '16:00',
        servicesProvided: 'Services',
        clientResponse: 'Good',
        narrative: 'Detailed narrative',
      },
      task: { status: 'complete', proofName: 'proof.pdf' },
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
      clerkOrgId,
      shiftId,
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.shifts.submitDocumentation,
        {
          clerkOrgId,
          shiftId,
          note: {
            startTime: '08:00',
            endTime: '16:00',
            servicesProvided: 'Services',
            clientResponse: 'Good',
            narrative: 'Detailed narrative',
          },
          tasks: [],
        },
      ),
    ).rejects.toThrow('must clock out')
  })

  it('blocks clock-out when note is incomplete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_out_incomplete'
    const caregiverId = 'user_cg_out_incomplete'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'in_progress',
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
      clerkOrgId,
      shiftId,
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockOut, {
        clerkOrgId,
        shiftId,
      }),
    ).rejects.toThrow('Incomplete documentation')
  })

  it('blocks clock-out outside radius when geofence is enabled', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_out_outside'
    const caregiverId = 'user_cg_out_outside'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'in_progress',
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockOut: true,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
      note: {
        startTime: '08:00',
        endTime: '16:00',
        servicesProvided: 'Services',
        clientResponse: 'Good',
        narrative: 'Detailed narrative',
      },
      task: { status: 'complete', proofName: 'proof.pdf' },
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
      clerkOrgId,
      shiftId,
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockOut, {
        clerkOrgId,
        shiftId,
        location: { ...FAR_COORDS, accuracyMeters: 10 },
      }),
    ).rejects.toThrow('outside the allowed')
  })

  it('succeeds and emits clock_out punch, audit, and submitted status when complete and inside radius', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_out_success'
    const caregiverId = 'user_cg_out_success'
    const { shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'in_progress',
      geofence: {
        ...DEFAULT_GEOFENCE,
        enabled: true,
        enforceClockOut: true,
      },
      clientServiceAddress: {
        line1: 'Client home',
        ...HOME_COORDS,
      },
      note: {
        startTime: '08:00',
        endTime: '16:00',
        servicesProvided: 'Services',
        clientResponse: 'Good',
        narrative: 'Detailed narrative',
      },
      task: { status: 'complete', proofName: 'proof.pdf' },
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
      clerkOrgId,
      shiftId,
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockOut,
      {
        clerkOrgId,
        shiftId,
        location: { ...NEARBY_COORDS, accuracyMeters: 10 },
      },
    )

    expect(result.punchId).toBeDefined()
    expect(result.clockOutAt).toBeDefined()

    const punch = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.timePunches.get,
      { clerkOrgId, punchId: result.punchId as Id<'timePunches'> },
    )

    expect(punch.punchType).toBe('clock_out')
    expect(punch.location?.withinGeofence).toBe(true)

    const shift = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.shiftQueries.getWithDetails,
      { clerkOrgId, shiftId },
    )

    expect(shift.shift.status).toBe('submitted')
    expect(shift.shift.clockOutAt).toBeDefined()

    const auditEvents = await t.run(async (ctx) => {
      return ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', shift.shift.tenantId))
        .collect()
    })

    const clockOutAudit = auditEvents.find(
      (event) => event.action === 'shift_clocked_out',
    )
    expect(clockOutAudit).toBeDefined()
  })

  it('reuses existing clock-out punch when resubmitting a corrected shift', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_resubmit'
    const caregiverId = 'user_cg_correction_resubmit'
    const { shiftId, tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      shiftStatus: 'needs_correction',
      note: {
        startTime: '08:00',
        endTime: '16:00',
        servicesProvided: 'Services',
        clientResponse: 'Good',
        narrative: 'Detailed narrative',
      },
      task: { status: 'complete', proofName: 'proof.pdf' },
    })

    const [{ taskId }, clockOutPunchId] = await t.run(async (ctx) => {
      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: '2020-01-01T08:00:00Z',
        source: 'atriax',
        adpSyncStatus: 'pending_credentials',
        createdAt: '2020-01-01T08:00:00Z',
      })
      const outPunch = await ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: '2020-01-01T16:00:00Z',
        source: 'atriax',
        adpSyncStatus: 'pending_credentials',
        createdAt: '2020-01-01T16:00:00Z',
      })
      await ctx.db.patch(shiftId, {
        clockInAt: '2020-01-01T08:00:00Z',
        clockOutAt: '2020-01-01T16:00:00Z',
      })
      const task = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      return [{ taskId: task!._id }, outPunch]
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockOut,
      {
        clerkOrgId,
        shiftId,
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Updated services',
          clientResponse: 'Good',
          narrative: 'Updated narrative',
        },
        tasks: [
          {
            taskId,
            status: 'complete',
            proofName: 'updated-proof.pdf',
          },
        ],
      },
    )

    expect(result.punchId).toBe(clockOutPunchId)

    const shift = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.shiftQueries.getWithDetails,
      { clerkOrgId, shiftId },
    )

    expect(shift.shift.status).toBe('submitted')
    expect(shift.note.narrative).toBe('Updated narrative')
    expect(shift.note.servicesProvided).toBe('Updated services')
    expect(shift.tasks[0].proofName).toBe('updated-proof.pdf')

    const punches = await t.run(async (ctx) => {
      return ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift_type', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', 'clock_out'),
        )
        .collect()
    })

    expect(punches).toHaveLength(1)
  })
})
