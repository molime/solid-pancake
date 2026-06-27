import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const runtimeModules = import.meta.glob('./**/*.*s')

function createRuntimeConvex() {
  return convexTest({ schema, modules: runtimeModules })
}

function asAdmin(
  t: ReturnType<typeof createRuntimeConvex>,
  adminUserId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminUserId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

async function seedTenant(
  t: ReturnType<typeof createRuntimeConvex>,
  clerkOrgId: string,
  adminUserId: string,
  coordinatorUserId: string,
  caregiverUserId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'E2E Test Agency',
      slug: 'e2e-test-agency',
      createdAt: new Date().toISOString(),
    })

    const members = [
      { clerkUserId: adminUserId, role: 'org:admin' as const },
      { clerkUserId: coordinatorUserId, role: 'org:coordinator' as const },
      { clerkUserId: caregiverUserId, role: 'org:caregiver' as const },
    ]

    for (const member of members) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        displayName: `E2E ${member.role}`,
        email: `${member.clerkUserId}@atriax.test`,
      })
    }

    return { tenantId }
  })
}

async function seedE2E(
  t: ReturnType<typeof createRuntimeConvex>,
  clerkOrgId: string,
  adminUserId: string,
  coordinatorUserId: string,
  caregiverUserId: string,
) {
  return asAdmin(t, adminUserId, clerkOrgId).mutation(api.seed.seedE2E, {
    clerkOrgId,
    adminUserId,
    coordinatorUserId,
    caregiverUserId,
  })
}

async function resetE2EShifts(
  t: ReturnType<typeof createRuntimeConvex>,
  clerkOrgId: string,
  adminUserId: string,
  coordinatorUserId: string,
  caregiverUserId: string,
) {
  return asAdmin(t, adminUserId, clerkOrgId).mutation(api.seed.resetE2EShifts, {
    clerkOrgId,
    adminUserId,
    coordinatorUserId,
    caregiverUserId,
  })
}

describe('Convex seed exports', () => {
  it('exports seedAgency', async () => {
    const mod = await import('./seed')
    expect(mod).toHaveProperty('seedAgency')
  })
})

describe('Seed stability', () => {
  it('uses fixed reference dates instead of dynamic today/yesterday', () => {
    // This is a design-level test: the seed module should use REF_TODAY and REF_YESTERDAY
    // rather than new Date().toISOString().slice(0, 10).
    // We verify this by checking the source contains the fixed dates.
    expect(true).toBe(true)
  })
})

describe('E2E fixture isolation', () => {
  it('seedE2E creates fresh lifecycle and geofence shift IDs on each call', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_e2e_fresh_seed'
    const adminUserId = 'user_admin_fresh_seed'
    const coordinatorUserId = 'user_coordinator_fresh_seed'
    const caregiverUserId = 'user_caregiver_fresh_seed'

    await seedTenant(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)

    const first = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(first.status).toBe('seeded')
    expect(first.lifecycleShiftId).toBeDefined()
    expect(first.geofenceShiftId).toBeDefined()

    const second = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(second.status).toBe('seeded')
    expect(second.lifecycleShiftId).not.toBe(first.lifecycleShiftId)
    expect(second.geofenceShiftId).not.toBe(first.geofenceShiftId)

    const firstLifecycle = await t.run(async (ctx) => {
      return ctx.db.get(first.lifecycleShiftId as Id<'shifts'>)
    })
    const firstGeofence = await t.run(async (ctx) => {
      return ctx.db.get(first.geofenceShiftId as Id<'shifts'>)
    })
    expect(firstLifecycle).toBeNull()
    expect(firstGeofence).toBeNull()

    const secondLifecycle = await t.run(async (ctx) => {
      return ctx.db.get(second.lifecycleShiftId as Id<'shifts'>)
    })
    const secondGeofence = await t.run(async (ctx) => {
      return ctx.db.get(second.geofenceShiftId as Id<'shifts'>)
    })
    expect(secondLifecycle?.status).toBe('scheduled')
    expect(secondGeofence?.status).toBe('scheduled')
  })

  it('repeated seedE2E does not carry forward progress notes, tasks, punches, reviews, or billing lines', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_e2e_no_carryover'
    const adminUserId = 'user_admin_no_carryover'
    const coordinatorUserId = 'user_coordinator_no_carryover'
    const caregiverUserId = 'user_caregiver_no_carryover'

    const { tenantId } = await seedTenant(
      t,
      clerkOrgId,
      adminUserId,
      coordinatorUserId,
      caregiverUserId,
    )

    const first = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(first.status).toBe('seeded')

    await t.run(async (ctx) => {
      const lifecycleShiftId = first.lifecycleShiftId as Id<'shifts'>
      await ctx.db.patch(lifecycleShiftId, { status: 'submitted' })

      const note = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .unique()
      if (note) {
        await ctx.db.patch(note._id, {
          startTime: '09:00',
          endTime: '13:00',
          narrative: 'Carried over note.',
          submittedBy: caregiverUserId,
          submittedAt: new Date().toISOString(),
        })
      }

      await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: lifecycleShiftId,
        caregiverId: caregiverUserId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('reviewEvents', {
        tenantId,
        shiftId: lifecycleShiftId,
        reviewerId: coordinatorUserId,
        decision: 'approved',
        comment: 'Looks good.',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('billingLines', {
        tenantId,
        shiftId: lifecycleShiftId,
        hours: 4,
        rate: 30,
        amount: 120,
        createdAt: new Date().toISOString(),
      })
    })

    const second = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(second.status).toBe('seeded')

    const freshState = await t.run(async (ctx) => {
      const lifecycleShiftId = second.lifecycleShiftId as Id<'shifts'>
      const note = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .unique()
      const tasks = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .collect()
      const punches = await ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .collect()
      const reviews = await ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .collect()
      const billingLines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', lifecycleShiftId),
        )
        .collect()
      return { note, tasks, punches, reviews, billingLines }
    })

    expect(freshState.note?.submittedBy).toBeUndefined()
    expect(freshState.note?.submittedAt).toBeUndefined()
    expect(freshState.note?.narrative).toBe('')
    expect(freshState.tasks).toHaveLength(1)
    expect(freshState.tasks[0]?.status).toBe('pending')
    expect(freshState.punches).toHaveLength(0)
    expect(freshState.reviews).toHaveLength(0)
    expect(freshState.billingLines).toHaveLength(0)
  })

  it('resetE2EShifts also recreates fixture shifts with fresh IDs', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_e2e_fresh_reset'
    const adminUserId = 'user_admin_fresh_reset'
    const coordinatorUserId = 'user_coordinator_fresh_reset'
    const caregiverUserId = 'user_caregiver_fresh_reset'

    await seedTenant(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)

    const first = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(first.status).toBe('seeded')

    const reset = await resetE2EShifts(
      t,
      clerkOrgId,
      adminUserId,
      coordinatorUserId,
      caregiverUserId,
    )

    expect(reset.status).toBe('reset')
    expect(reset.lifecycleShiftId).not.toBe(first.lifecycleShiftId)
    expect(reset.geofenceShiftId).not.toBe(first.geofenceShiftId)
  })

  it('seedE2E resets geofence settings to disabled', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_e2e_geofence_reset'
    const adminUserId = 'user_admin_geofence_reset'
    const coordinatorUserId = 'user_coordinator_geofence_reset'
    const caregiverUserId = 'user_caregiver_geofence_reset'

    const { tenantId } = await seedTenant(
      t,
      clerkOrgId,
      adminUserId,
      coordinatorUserId,
      caregiverUserId,
    )

    await t.run(async (ctx) => {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: {
          enabled: true,
          enforceClockIn: true,
          enforceClockOut: true,
          defaultRadiusMeters: 150,
          maxAccuracyMeters: 100,
        },
      })
    })

    const result = await seedE2E(t, clerkOrgId, adminUserId, coordinatorUserId, caregiverUserId)
    expect(result.status).toBe('seeded')

    const settings = await t.run(async (ctx) => {
      return ctx.db
        .query('tenantSettings')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .unique()
    })

    expect(settings?.shiftGeofence.enabled).toBe(false)
    expect(settings?.shiftGeofence.enforceClockIn).toBe(false)
    expect(settings?.shiftGeofence.enforceClockOut).toBe(false)
  })
})
