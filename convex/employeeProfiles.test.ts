import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

function stubClerkInvitation() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_test',
            email_address: 'caregiver@test.com',
            role: 'org:member',
            role_name: 'Member',
            status: 'pending',
            created_at: Date.now(),
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  coordinatorId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: coordinatorId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
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

describe('createCaregiver', () => {
  it('creates an employee profile and enqueues worker sync', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver'
    const adminId = 'user_admin_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    expect(result.profileId).toBeDefined()
    expect(result.emailAddress).toBe('caregiver@test.com')

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver@test.com')
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('reuses the same profile when createCaregiver is called again with the same email and a different name', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_reuse'
    const adminId = 'user_admin_create_reuse'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const first = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Original Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const second = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Updated Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(second.profileId).toBe(first.profileId)

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Updated Name')
  })

  it('marks profile as pending_credentials when ADP is not configured', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_no_adp'
    const adminId = 'user_admin_create_no_adp'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver-no-adp@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver-no-adp@test.com')
    expect(profile?.adpSyncStatus).toBe('pending_credentials')
  })

  it('throws before creating a profile when CLERK_SECRET_KEY is missing', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '')
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_no_secret'
    const adminId = 'user_admin_create_no_secret'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(
        api.employeeProfiles.createCaregiver,
        {
          clerkOrgId,
          displayName: 'New Caregiver',
          email: 'caregiver-no-secret@test.com',
          appBaseUrl: 'http://localhost',
        },
      ),
    ).rejects.toThrow('CLERK_SECRET_KEY')

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(0)
  })

  it('deletes the profile when the Clerk invitation fails', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({
              errors: [
                { message: 'Email address is invalid.', long_message: 'Email address is invalid.' },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_invite_fail'
    const adminId = 'user_admin_create_invite_fail'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(
        api.employeeProfiles.createCaregiver,
        {
          clerkOrgId,
          displayName: 'New Caregiver',
          email: 'bad-email',
          appBaseUrl: 'http://localhost',
        },
      ),
    ).rejects.toThrow()

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(0)
  })

  it('rejects non-admin callers', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_coordinator'
    const coordinatorId = 'user_coordinator_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).action(
        api.employeeProfiles.createCaregiver,
        {
          clerkOrgId,
          displayName: 'Caregiver',
          email: 'caregiver@test.com',
          appBaseUrl: 'http://localhost',
        },
      ),
    ).rejects.toThrow('only agency admins')
  })
})

describe('runAdpInitialWorkerLoad', () => {
  it('returns correct matched/created counts with mocked ADP', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-one',
          workerID: 'w-one',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-two',
          workerID: 'w-two',
          displayName: 'New ADP Employee',
          email: 'new@example.com',
          status: 'active',
        },
      ],
    })

    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_summary'
    const adminId = 'user_admin_load'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.runAdpInitialWorkerLoad,
      { clerkOrgId },
    )

    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)
  })
})

describe('listEmployeeProfiles', () => {
  it('returns profiles for admin and includes adpSyncStatus', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles'
    const adminId = 'user_admin_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Caregiver One',
        email: 'one@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const profiles = await asAdmin(t, adminId, clerkOrgId).query(
      api.employeeProfiles.listEmployeeProfiles,
      { clerkOrgId },
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Caregiver One')
    expect(profiles[0]?.adpSyncStatus).toBe('queued')
  })

  it('rejects caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles_caregiver'
    const caregiverId = 'user_cg_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(
        api.employeeProfiles.listEmployeeProfiles,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})

describe('tenantSettings.updateShiftGeofence role guards', () => {
  it('allows admin and coordinator edits and rejects caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_roles'
    const adminId = 'user_admin_geo'
    const coordinatorId = 'user_coordinator_geo'
    const caregiverId = 'user_cg_geo'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    const payload = {
      clerkOrgId,
      enabled: true,
      enforceClockIn: true,
      enforceClockOut: false,
      defaultRadiusMeters: 150,
      maxAccuracyMeters: 75,
    }

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).rejects.toThrow()
  })
})
