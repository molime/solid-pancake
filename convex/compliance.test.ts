import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { checkComplianceBlocked } from './compliance'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_compliance_test'
const ADMIN_ID = 'user_admin_compliance'
const COORDINATOR_ID = 'user_coordinator_compliance'
const CAREGIVER_ID = 'user_caregiver_compliance'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Compliance Agency',
      slug: 'compliance-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN_ID,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: COORDINATOR_ID,
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coordinator@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    const employeeProfileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId: CAREGIVER_ID,
      displayName: 'Caregiver One',
      email: 'caregiver@example.com',
      adpSyncStatus: 'synced',
      createdAt: new Date().toISOString(),
    })

    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: 'storage_1',
      uploadedBy: ADMIN_ID,
      fileName: 'doc.pdf',
      linkedType: 'complianceDoc',
      linkedId: 'link_1',
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })

    return { tenantId, employeeProfileId, fileId }
  })
}

async function seedArchiveItem(
  t: TestConvex,
  seed: { tenantId: Id<'tenants'>; employeeProfileId: Id<'employeeProfiles'>; fileId: Id<'files'> },
  overrides: { status?: string; category?: string; expiresAt?: string; overrideStatus?: string },
) {
  return t.run(async (ctx) =>
    ctx.db.insert('documentArchiveItems', {
      tenantId: seed.tenantId,
      fileId: seed.fileId,
      subjectType: 'employee',
      subjectId: seed.employeeProfileId as string,
      category: overrides.category ?? 'license',
      status: overrides.status ?? 'verified',
      expiresAt: overrides.expiresAt,
      overrideStatus: overrides.overrideStatus,
      createdAt: new Date().toISOString(),
    }),
  )
}

async function seedRequirement(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  overrides: { category?: string; label?: string; isRequired?: boolean },
) {
  return t.run(async (ctx) =>
    ctx.db.insert('credentialRequirements', {
      tenantId,
      role: 'org:caregiver',
      category: overrides.category ?? 'license',
      label: overrides.label ?? 'Driver License',
      isRequired: overrides.isRequired ?? true,
    }),
  )
}

async function seedSubmittedShift(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) => {
    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: CAREGIVER_ID,
      scheduledStart: '2026-01-01T08:00:00.000Z',
      scheduledEnd: '2026-01-01T16:00:00.000Z',
      status: 'submitted',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '08:00',
      endTime: '12:00',
      servicesProvided: 'Personal care',
      clientResponse: 'Cooperative',
      narrative: 'Shift completed as planned.',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload proof',
      requiredProof: true,
      status: 'complete',
      proofName: 'proof.pdf',
    })

    return { clientId, shiftId }
  })
}

function asAdmin(t: TestConvex) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:admin',
  })
}

function asCoordinator(t: TestConvex) {
  return t.withIdentity({
    subject: COORDINATOR_ID,
    org_id: CLERK_ORG_ID,
    org_role: 'org:coordinator',
  })
}

describe('checkComplianceBlocked', () => {
  it('blocks on a rejected item', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedArchiveItem(t, seed, { status: 'rejected', category: 'license' })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, seed.tenantId, CAREGIVER_ID),
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('license')
  })

  it('blocks on an expired item', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedArchiveItem(t, seed, {
      status: 'verified',
      category: 'cpr',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, seed.tenantId, CAREGIVER_ID),
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('cpr')
  })

  it('does not block on an overridden expired item', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedArchiveItem(t, seed, {
      status: 'verified',
      expiresAt: '2020-01-01T00:00:00.000Z',
      overrideStatus: 'overridden',
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, seed.tenantId, CAREGIVER_ID),
    )

    expect(result.blocked).toBe(false)
  })

  it('blocks on a missing required credential', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedRequirement(t, seed.tenantId, {
      category: 'tb_test',
      label: 'TB Test',
      isRequired: true,
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, seed.tenantId, CAREGIVER_ID),
    )

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('TB Test')
  })

  it('does not block on a missing non-required category', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedRequirement(t, seed.tenantId, {
      category: 'training',
      label: 'Optional Training',
      isRequired: false,
    })

    const result = await t.run(async (ctx) =>
      checkComplianceBlocked(ctx, seed.tenantId, CAREGIVER_ID),
    )

    expect(result.blocked).toBe(false)
  })
})

describe('reviews.approve compliance gating', () => {
  it('blocked without override creates a blocked billing line, keeps billing_ready, audits, and does not throw', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedRequirement(t, seed.tenantId, {
      category: 'license',
      label: 'Driver License',
      isRequired: true,
    })
    const { shiftId } = await seedSubmittedShift(t, seed.tenantId)

    const result = await asAdmin(t).mutation(api.reviews.approve, {
      clerkOrgId: CLERK_ORG_ID,
      shiftId,
      comment: 'Looks good',
    })

    expect(typeof result).toBe('string')
    expect(result as string).toContain('Billing blocked')

    const state = await t.run(async (ctx) => {
      const shift = await ctx.db.get(shiftId)
      const lines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', seed.tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', seed.tenantId),
        )
        .collect()
      return { shift, lines, audits }
    })

    expect(state.shift?.status).toBe('billing_ready')
    expect(state.lines).toHaveLength(1)
    expect(state.lines[0]?.blockedReason).toContain('Driver License')
    expect(state.lines[0]?.blockedAt).toBeTruthy()
    expect(
      state.audits.some((a) => a.action === 'billing_blocked_compliance'),
    ).toBe(true)
  })

  it('blocked with override by a coordinator throws', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedRequirement(t, seed.tenantId, {
      category: 'license',
      label: 'Driver License',
      isRequired: true,
    })
    const { shiftId } = await seedSubmittedShift(t, seed.tenantId)

    await expect(
      asCoordinator(t).mutation(api.reviews.approve, {
        clerkOrgId: CLERK_ORG_ID,
        shiftId,
        comment: 'Looks good',
        complianceOverride: true,
        complianceOverrideReason: 'Verified in person',
      }),
    ).rejects.toThrow('only org:admin')
  })

  it('blocked with override by an admin creates a clean line and records override fields', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    await seedRequirement(t, seed.tenantId, {
      category: 'license',
      label: 'Driver License',
      isRequired: true,
    })
    const { shiftId } = await seedSubmittedShift(t, seed.tenantId)

    const result = await asAdmin(t).mutation(api.reviews.approve, {
      clerkOrgId: CLERK_ORG_ID,
      shiftId,
      comment: 'Looks good',
      complianceOverride: true,
      complianceOverrideReason: 'Verified in person',
    })

    expect(result).toBe(shiftId)

    const state = await t.run(async (ctx) => {
      const lines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', seed.tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const events = await ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', seed.tenantId).eq('shiftId', shiftId),
        )
        .collect()
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', seed.tenantId),
        )
        .collect()
      return { lines, events, audits }
    })

    expect(state.lines).toHaveLength(1)
    expect(state.lines[0]?.blockedReason).toBeUndefined()
    expect(state.events).toHaveLength(1)
    expect(state.events[0]?.complianceOverride).toBe(true)
    expect(state.events[0]?.complianceOverrideReason).toBe(
      'Verified in person',
    )
    expect(
      state.audits.some((a) => a.action === 'compliance_override_applied'),
    ).toBe(true)
  })
})

describe('reviews.escalateToSupervisor', () => {
  it('sets shifts.escalatedTo to the tenant admin and audits the escalation', async () => {
    const t = createTestConvex()
    const seed = await seedTenant(t)
    const { shiftId } = await seedSubmittedShift(t, seed.tenantId)

    const result = await asCoordinator(t).mutation(
      api.reviews.escalateToSupervisor,
      {
        clerkOrgId: CLERK_ORG_ID,
        shiftId,
        reason: 'Caregiver dispute over hours',
      },
    )

    expect(result).toBe(shiftId)

    const state = await t.run(async (ctx) => {
      const shift = await ctx.db.get(shiftId)
      const audits = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', seed.tenantId),
        )
        .collect()
      return { shift, audits }
    })

    expect(state.shift?.escalatedTo).toBe(ADMIN_ID)
    expect(state.audits.some((a) => a.action === 'shift_escalated')).toBe(true)
  })
})
