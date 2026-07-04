import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { checkShiftConflict } from './scheduling'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  userId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: userId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  userId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: userId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  userId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: userId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

type SeedResult = {
  tenantId: Id<'tenants'>
  clientId: Id<'clients'>
  caregiverId: string
  otherCaregiverId: string
  coordinatorId: string
  adminId: string
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
): Promise<SeedResult> {
  const adminId = `admin_${clerkOrgId}`
  const coordinatorId = `coordinator_${clerkOrgId}`
  const caregiverId = `caregiver_${clerkOrgId}`
  const otherCaregiverId = `other_caregiver_${clerkOrgId}`

  const result = await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Agency',
      slug: 'agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin User',
      email: 'admin@agency.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: coordinatorId,
      role: 'org:coordinator',
      displayName: 'Coordinator User',
      email: 'coordinator@agency.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver User',
      email: 'caregiver@agency.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: otherCaregiverId,
      role: 'org:caregiver',
      displayName: 'Other Caregiver',
      email: 'other@agency.com',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client A',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    return {
      tenantId,
      clientId,
      caregiverId,
      otherCaregiverId,
      coordinatorId,
      adminId,
    }
  })

  return result as SeedResult
}

describe('scheduling helpers', () => {
  it('detects no conflict on adjacent shifts', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_adjacent'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    const second = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T10:00:00Z',
        scheduledEnd: '2024-06-01T11:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    expect(second.shiftId).toBeDefined()
  })

  it('detects conflict on overlapping shifts', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_overlap'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const first = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    await expect(
      asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
        api.scheduling.createShift,
        {
          clerkOrgId,
          clientId,
          caregiverId,
          scheduledStart: '2024-06-01T09:30:00Z',
          scheduledEnd: '2024-06-01T10:30:00Z',
          serviceType: 'SLS',
          rate: 25,
        },
      ),
    ).rejects.toThrow(first.shiftId)
  })

  it('detects conflict on same start', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_same_start'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const first = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    await expect(
      asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
        api.scheduling.createShift,
        {
          clerkOrgId,
          clientId,
          caregiverId,
          scheduledStart: '2024-06-01T09:00:00Z',
          scheduledEnd: '2024-06-01T11:00:00Z',
          serviceType: 'SLS',
          rate: 25,
        },
      ),
    ).rejects.toThrow(first.shiftId)
  })

  it('does not conflict with completed (billing_ready) shifts', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_completed'
    const { tenantId, clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    await t.run(async (ctx) => {
      await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        status: 'billing_ready',
        serviceType: 'SLS',
        rate: 25,
      })
    })

    const second = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:30:00Z',
        scheduledEnd: '2024-06-01T10:30:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    expect(second.shiftId).toBeDefined()
  })

  it('excludes the current shift from conflict detection', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_exclude'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const first = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    const updated = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).mutation(api.scheduling.updateShift, {
      clerkOrgId,
      shiftId: first.shiftId,
      scheduledStart: '2024-06-01T08:30:00Z',
      scheduledEnd: '2024-06-01T09:30:00Z',
    })

    expect(updated.shiftId).toBe(first.shiftId)
  })

  it('checkShiftConflict helper returns the conflicting shift doc', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_helper_conflict'
    const { tenantId, clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const first = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    const conflict = await t.run(async (ctx) =>
      checkShiftConflict(
        ctx,
        tenantId,
        caregiverId,
        '2024-06-01T09:30:00Z',
        '2024-06-01T10:30:00Z',
      ),
    )

    expect(conflict).not.toBeNull()
    expect(conflict?._id).toBe(first.shiftId)
  })
})

describe('createShift', () => {
  it('succeeds for admin and coordinator', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_create_roles'
    const { clientId, caregiverId, coordinatorId } = await seedTenant(
      t,
      clerkOrgId,
    )

    const asCoord = asCoordinator(t, coordinatorId, clerkOrgId)
    const created = await asCoord.mutation(api.scheduling.createShift, {
      clerkOrgId,
      clientId,
      caregiverId,
      scheduledStart: '2024-06-01T09:00:00Z',
      scheduledEnd: '2024-06-01T10:00:00Z',
      serviceType: 'SLS',
      rate: 25,
    })

    expect(created.shiftId).toBeDefined()
  })

  it('blocks a cross-tenant caregiver', async () => {
    const t = createTestConvex()
    const orgA = 'org_cross_a'
    const orgB = 'org_cross_b'
    const seedA = await seedTenant(t, orgA)
    const seedB = await seedTenant(t, orgB)

    await expect(
      asAdmin(t, seedB.adminId, orgB).mutation(api.scheduling.createShift, {
        clerkOrgId: orgB,
        clientId: seedB.clientId,
        caregiverId: seedA.caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      }),
    ).rejects.toThrow('Selected caregiver must be an active caregiver')
  })

  it('returns an availability warning when windows exist but do not cover the slot', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_avail_warning'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.scheduling.addAvailabilityWindow,
      {
        clerkOrgId,
        kind: 'recurring',
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '10:00',
        available: true,
      },
    )

    const created = await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T10:00:00Z',
        scheduledEnd: '2024-06-01T12:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    expect(created.shiftId).toBeDefined()
    expect(created.availabilityWarning).toBe(
      'Caregiver availability does not cover this slot.',
    )
  })
})

describe('updateShift', () => {
  it('is blocked when the shift is submitted', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_update_submitted'
    const { tenantId, clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const shiftId = await t.run(async (ctx) => {
      return await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        status: 'submitted',
        serviceType: 'SLS',
        rate: 25,
      })
    })

    await expect(
      asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
        api.scheduling.updateShift,
        {
          clerkOrgId,
          shiftId,
          rate: 30,
        },
      ),
    ).rejects.toThrow('Cannot edit a shift that is submitted or approved')
  })
})

describe('deleteShift', () => {
  it('is blocked when the shift is in progress', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_delete_progress'
    const { tenantId, clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    const shiftId = await t.run(async (ctx) => {
      return await ctx.db.insert('shifts', {
        tenantId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        status: 'in_progress',
        serviceType: 'SLS',
        rate: 25,
      })
    })

    await expect(
      asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
        api.scheduling.deleteShift,
        {
          clerkOrgId,
          shiftId,
        },
      ),
    ).rejects.toThrow('Only scheduled shifts can be deleted')
  })
})

describe('requestCoverage', () => {
  it('is blocked for a shift assigned to another caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_coverage_wrong'
    const { clientId, caregiverId, otherCaregiverId } = await seedTenant(
      t,
      clerkOrgId,
    )

    const { shiftId } = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).mutation(api.scheduling.createShift, {
      clerkOrgId,
      clientId,
      caregiverId,
      scheduledStart: '2024-06-01T09:00:00Z',
      scheduledEnd: '2024-06-01T10:00:00Z',
      serviceType: 'SLS',
      rate: 25,
    })

    await expect(
      asCaregiver(t, otherCaregiverId, clerkOrgId).mutation(
        api.scheduling.requestCoverage,
        {
          clerkOrgId,
          shiftId,
          reason: 'I am unavailable',
        },
      ),
    ).rejects.toThrow('You can only request coverage for your assigned shifts')
  })
})

describe('availability windows', () => {
  it('restricts update and delete to the owning caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_avail_owner'
    const { caregiverId, otherCaregiverId } = await seedTenant(t, clerkOrgId)

    const { windowId } = await asCaregiver(
      t,
      caregiverId,
      clerkOrgId,
    ).mutation(api.scheduling.addAvailabilityWindow, {
      clerkOrgId,
      kind: 'recurring',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      available: true,
    })

    await expect(
      asCaregiver(t, otherCaregiverId, clerkOrgId).mutation(
        api.scheduling.updateAvailabilityWindow,
        {
          clerkOrgId,
          windowId,
          note: 'Changed by someone else',
        },
      ),
    ).rejects.toThrow('You can only update your own availability windows')

    await expect(
      asCaregiver(t, otherCaregiverId, clerkOrgId).mutation(
        api.scheduling.deleteAvailabilityWindow,
        {
          clerkOrgId,
          windowId,
        },
      ),
    ).rejects.toThrow('You can only delete your own availability windows')
  })
})

describe('listShifts', () => {
  it('rejects caregivers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_roles'
    const { caregiverId } = await seedTenant(t, clerkOrgId)

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(api.scheduling.listShifts, {
        clerkOrgId,
      }),
    ).rejects.toThrow('org:admin, org:coordinator')
  })

  it('returns shifts with joined client and caregiver names', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_joins'
    const { clientId, caregiverId } = await seedTenant(t, clerkOrgId)

    await asAdmin(t, `admin_${clerkOrgId}`, clerkOrgId).mutation(
      api.scheduling.createShift,
      {
        clerkOrgId,
        clientId,
        caregiverId,
        scheduledStart: '2024-06-01T09:00:00Z',
        scheduledEnd: '2024-06-01T10:00:00Z',
        serviceType: 'SLS',
        rate: 25,
      },
    )

    const result = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).query(api.scheduling.listShifts, {
      clerkOrgId,
      status: 'scheduled',
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].clientDisplayName).toBe('Client A')
    expect(result.items[0].caregiverDisplayName).toBe('Caregiver User')
  })
})

describe('coverage lifecycle', () => {
  it('allows a caregiver to request coverage and an admin to resolve it', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_coverage_lifecycle'
    const { clientId, caregiverId, otherCaregiverId } = await seedTenant(
      t,
      clerkOrgId,
    )

    const { shiftId } = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).mutation(api.scheduling.createShift, {
      clerkOrgId,
      clientId,
      caregiverId,
      scheduledStart: '2024-06-01T09:00:00Z',
      scheduledEnd: '2024-06-01T10:00:00Z',
      serviceType: 'SLS',
      rate: 25,
    })

    const { coverageRequestId } = await asCaregiver(
      t,
      caregiverId,
      clerkOrgId,
    ).mutation(api.scheduling.requestCoverage, {
      clerkOrgId,
      shiftId,
      reason: 'Family emergency',
    })

    const resolved = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).mutation(api.scheduling.resolveCoverage, {
      clerkOrgId,
      coverageRequestId,
      reassignedTo: otherCaregiverId,
    })

    expect(resolved.shiftId).toBe(shiftId)
    expect(resolved.coverageRequestId).toBe(coverageRequestId)

    const requests = await asAdmin(
      t,
      `admin_${clerkOrgId}`,
      clerkOrgId,
    ).query(api.scheduling.listCoverageRequests, {
      clerkOrgId,
      status: 'filled',
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].reassignedTo).toBe(otherCaregiverId)
  })
})
