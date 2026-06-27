import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'
import { sanitizeError } from './adpSync'

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

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function seedAgency(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    caregiverEmail?: string
    configureAdp?: boolean
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: options.caregiverEmail ?? 'caregiver@example.com',
    })

    if (options.configureAdp) {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
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

    return { tenantId, memberId, clientId, shiftId }
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

describe('adpSyncPunch', () => {
  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_unconfigured'
    const caregiverId = 'user_cg_adp_unconfigured'
    const caregiverEmail = 'unconfigured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: false,
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(result.punchId).toBeDefined()

    const punchBefore = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.timePunches.get,
      {
        clerkOrgId,
        punchId: result.punchId as Id<'timePunches'>,
      },
    )
    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')

    const eventsBefore = await t.run(async (ctx) => {
      return ctx.db.query('integrationEvents').collect()
    })
    expect(eventsBefore).toHaveLength(0)

    // Flip integration connection to configured and add employee profile
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-unconfigured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.patch(result.punchId as Id<'timePunches'>, {
        adpSyncStatus: 'queued',
      })
    })

    const syncResult = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId: result.punchId as Id<'timePunches'>,
    })
    expect(syncResult.status).toBe('synced')
    expect(syncResult.adpPunchId).toBeDefined()

    const punchAfter = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punchAfter?.adpSyncStatus).toBe('synced')
    expect(punchAfter?.adpPunchId).toBe(syncResult.adpPunchId)
  })

  it('posts punch once, stores adpPunchId, and is idempotent', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_configured'
    const caregiverId = 'user_cg_adp_configured'
    const caregiverEmail = 'configured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-configured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('synced')
    expect(first.adpPunchId).toBeDefined()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('already_synced')

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punch?.adpSyncStatus).toBe('synced')
    expect(punch?.adpPunchId).toBe(first.adpPunchId)

    expect(mock.callCounts.postPunch).toBe(1)

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('success')
  })

  it('does not send location evidence in the ADP punch payload', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_location'
    const caregiverId = 'user_cg_adp_location'
    const caregiverEmail = 'location@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-location@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          distanceMeters: 12,
          targetLabel: 'Client service address',
          targetLatitude: 44.9778,
          targetLongitude: -93.265,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    expect(mock.callCounts.postPunch).toBe(1)
    expect(mock.lastPunchInput).toBeDefined()
    expect(mock.lastPunchInput).not.toHaveProperty('location')
    expect(mock.lastPunchInput).not.toHaveProperty('latitude')
    expect(mock.lastPunchInput).not.toHaveProperty('longitude')
    expect(mock.lastPunchInput).not.toHaveProperty('distanceMeters')
    expect(mock.lastPunchInput).toHaveProperty('idempotencyKey')
    expect(mock.lastPunchInput).toHaveProperty('associateOID')
    expect(mock.lastPunchInput).toHaveProperty('punchType')
    expect(mock.lastPunchInput).toHaveProperty('at')
  })

  it('does not leak ADP secrets into integrationEvents on failure', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({
      failNextCall: true,
      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_secret_leak'
    const caregiverId = 'user_cg_adp_secret_leak'
    const caregiverEmail = 'secret-leak@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })

    expect(events.length).toBeGreaterThan(0)
    const eventJson = JSON.stringify(events)
    expect(eventJson).not.toContain('mock-client-secret')
    expect(eventJson).not.toContain('mock-client-id')
    expect(eventJson).not.toContain('bW9jay1jbGllbnQtaWQ')

    const punch = await t.run(async (ctx) => ctx.db.get(timePunchId))
    expect(punch?.adpError).toBeDefined()
    expect(punch?.adpError).not.toContain('mock-client-secret')
    expect(punch?.adpError).not.toContain('mock-client-id')

    mock.clearFailure()
  })

  it('records error and succeeds on retry', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_retry'
    const caregiverId = 'user_cg_adp_retry'
    const caregiverEmail = 'retry@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-retry@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('error')

    const punchAfterFirst = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterFirst?.adpSyncStatus).toBe('error')
    expect(punchAfterFirst?.adpError).toBeDefined()

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('synced')

    const punchAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterSecond?.adpSyncStatus).toBe('synced')
    expect(punchAfterSecond?.adpError).toBeUndefined()

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.status).toBe('error')
    expect(events[1]?.status).toBe('success')
  })
})

describe('claimIntegrationEvent', () => {
  it('prevents overlapping claims and respects success', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_claim'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_claim',
      configureAdp: true,
    })

    const key = 'punch:claim-test'
    const first = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(first.type).toBe('claimed')

    const second = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(second.type).toBe('in_flight')

    await t.mutation(internal.adpSync.patchIntegrationEvent, {
      eventId: first.eventId,
      status: 'success',
      response: { adpPunchId: 'punch-123' },
      completedAt: new Date().toISOString(),
    })

    const third = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(third.type).toBe('already_synced')
  })
})

describe('sanitizeError', () => {
  it('redacts ADP env values, Basic/Bearer tokens, and generic tokens', () => {
    vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')

    const message =
      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

    const redacted = sanitizeError(new Error(message))

    expect(redacted).not.toContain('mock-client-id')
    expect(redacted).not.toContain('mock-client-secret')
    expect(redacted).not.toContain(
      'bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0',
    )
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_ID]')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_SECRET]')
    expect(redacted).toContain('Basic [REDACTED]')
    expect(redacted).toContain('Bearer [REDACTED]')

    vi.unstubAllEnvs()
  })
})

describe('adpInitialWorkerLoad', () => {
  it('matches existing profile by email and creates profile for new worker', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-existing',
          workerID: 'w-existing',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-new',
          workerID: 'w-new',
          displayName: 'New ADP Worker',
          email: 'new-adp@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load',
      configureAdp: true,
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(2)
    const matched = profiles.find((p) => p.email === 'existing@example.com')
    const created = profiles.find((p) => p.email === 'new-adp@example.com')

    expect(matched?.adpSyncStatus).toBe('matched')
    expect(matched?.adpAssociateOid).toBe('aoid-existing')
    expect(created?.adpSyncStatus).toBe('created')
    expect(created?.adpAssociateOid).toBe('aoid-new')
  })

  it('records failure and retries', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_retry'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load_retry',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('error')

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `initial_worker_load:${tenantId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('success')
  })

  it('is idempotent across reruns by AOID', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-rerun',
          workerID: 'w-rerun',
          displayName: 'Rerun Worker',
          email: 'rerun@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_rerun'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_rerun',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('success')
    expect(first.created).toBe(1)

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('already_synced')

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })
    expect(profiles).toHaveLength(1)
  })

  it('can be triggered by an admin through the public mutation', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-public',
          workerID: 'w-public',
          displayName: 'Public Load Worker',
          email: 'public@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_public_load'
    const adminId = 'user_admin_public_load'

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

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.adpSync.triggerInitialWorkerLoad,
      { clerkOrgId },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

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
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-public')
  })
})

describe('adpSyncWorker', () => {
  it('no-ops when profile already has an ADP associate OID', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_existing_aoid'
    const caregiverId = 'user_cg_existing_aoid'
    const caregiverEmail = 'existing-aoid@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-existing',
        adpSyncStatus: 'matched',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(result.status).toBe('already_synced')
    expect(mock.callCounts.createWorker).toBe(0)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBe('aoid-existing')
  })

  it('retries without creating duplicate workers using idempotency key', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker_retry'
    const caregiverId = 'user_cg_worker_retry'
    const caregiverEmail = 'worker-retry@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(first.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(second.status).toBe('synced')
    expect(second.adpAssociateOid).toBeDefined()

    const profileAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profileAfterSecond?.adpSyncStatus).toBe('synced')
    expect(profileAfterSecond?.adpError).toBeUndefined()

    expect(mock.workerCount()).toBe(1)
  })
})

describe('adpSyncWorker scheduled drain', () => {
  it('enqueues worker sync when caregiver is created and stores AOID', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker'
    const caregiverId = 'user_cg_adp_worker'
    const caregiverEmail = 'worker@example.com'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('enqueues worker sync when an existing member is promoted to caregiver', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_promote'
    const adminId = 'user_admin_promote'
    const caregiverId = 'user_cg_promote'

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
        clerkUserId: caregiverId,
        role: 'org:coordinator',
        displayName: 'Future Caregiver',
        email: 'promote@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asAdmin(t, adminId, clerkOrgId).mutation(api.members.updateRole, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('links new caregiver to ADP-loaded profile by email and name', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_profile'
    const caregiverId = 'user_cg_link_profile'
    const caregiverEmail = 'link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Link Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-link',
        adpSyncStatus: 'created',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Link Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-link')
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })

  it('links a caregiver to an existing profile by email even when display names differ', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_email_only'
    const caregiverId = 'user_cg_link_email_only'
    const caregiverEmail = 'email-link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Admin Entered Name',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Clerk Display Name',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.tenantMemberId).toBeDefined()
    expect(profiles[0]?.adpAssociateOid).toBeDefined()
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })
})
describe('adpDrainPendingRows', () => {
  it('drains pending time punches after ADP is configured', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_drain_punch'
    const caregiverId = 'user_cg_drain_punch'
    const caregiverEmail = 'drain-punch@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: false,
    })

    const punchResult = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )
    expect(punchResult.punchId).toBeDefined()

    const punchBefore = await t.run(async (ctx) => {
      return ctx.db.get(punchResult.punchId as Id<'timePunches'>)
    })
    expect(punchBefore?.adpSyncStatus).toBe('pending_credentials')

    // Configure ADP and add an employee profile with an AOID so the drain can
    // successfully post the pending punch.
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-drain-punch@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const drainResult = await t.action(internal.adpOutbound.adpDrainPendingRows, {
      tenantId,
    })
    expect(drainResult.status).toBe('draining')
    expect(drainResult.punchCount).toBe(1)
    expect(drainResult.profileCount).toBe(0)

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const punchAfter = await t.run(async (ctx) => {
      return ctx.db.get(punchResult.punchId as Id<'timePunches'>)
    })
    expect(punchAfter?.adpSyncStatus).toBe('synced')
    expect(punchAfter?.adpPunchId).toBeDefined()
  })

  it('drains pending employee profiles after ADP is configured', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_drain_profile'
    const adminId = 'user_admin_drain_profile'
    const caregiverEmail = 'drain-profile@example.com'

    const tenantId = await t.run(async (ctx) => {
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

      return tenantId
    })

    // Create a caregiver profile while ADP is not configured.
    const profileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Drain Profile',
        email: caregiverEmail,
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
    })

    const profileBefore = await t.run(async (ctx) => {
      return ctx.db.get(profileId)
    })
    expect(profileBefore?.adpSyncStatus).toBe('pending_credentials')

    // Configure ADP.
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const drainResult = await t.action(internal.adpOutbound.adpDrainPendingRows, {
      tenantId,
    })
    expect(drainResult.status).toBe('draining')
    expect(drainResult.punchCount).toBe(0)
    expect(drainResult.profileCount).toBe(1)

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profileAfter = await t.run(async (ctx) => {
      return ctx.db.get(profileId)
    })
    expect(profileAfter?.adpSyncStatus).toBe('synced')
    expect(profileAfter?.adpAssociateOid).toBeDefined()
  })

  it('returns pending_credentials when ADP is not configured', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_drain_unconfigured'
    const caregiverId = 'user_cg_drain_unconfigured'
    const caregiverEmail = 'drain-unconfigured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: false,
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.shifts.clockIn, {
      clerkOrgId,
      shiftId,
    })

    const drainResult = await t.action(internal.adpOutbound.adpDrainPendingRows, {
      tenantId,
    })
    expect(drainResult.status).toBe('pending_credentials')
    expect(drainResult.punchCount).toBe(0)
    expect(drainResult.profileCount).toBe(0)
  })

  it('exposes an admin mutation that queues the drain', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_drain_admin'
    const adminId = 'user_admin_drain_admin'
    const caregiverId = 'user_cg_drain_admin'
    const caregiverEmail = 'drain-admin@example.com'

    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const punchId = await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-drain-admin@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const queued = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.employeeProfiles.drainAdpPendingRows,
      { clerkOrgId },
    )
    expect(queued.status).toBe('queued')

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(punchId)
    })
    expect(punch).toBeDefined()
    expect(punch?.adpSyncStatus).toBe('synced')
    expect(punch?.adpPunchId).toBeDefined()
  })
})
