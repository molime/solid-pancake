import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { STAFF_POLICIES, STAFF_POLICY_VERSIONS } from './_utils/staffPolicies'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

function asOrgUser(
  t: TestConvex,
  userId: string,
  clerkOrgId: string,
  role: 'org:admin' | 'org:hr' | 'org:coordinator' | 'org:caregiver',
) {
  return t.withIdentity({ subject: userId, org_id: clerkOrgId, org_role: role })
}

async function seedTenant(
  t: TestConvex,
  clerkOrgId: string,
  members: Array<{
    clerkUserId: string
    role: 'org:admin' | 'org:hr' | 'org:coordinator' | 'org:caregiver'
    displayName: string
  }>,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: `Agency ${clerkOrgId}`,
      slug: `slug-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    for (const member of members) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        displayName: member.displayName,
        email: `${member.clerkUserId}@example.com`,
      })
    }
    return tenantId
  })
}

async function acksFor(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('policyAcknowledgments')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

async function auditEvents(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect(),
  )
}

describe('policies.acknowledge', () => {
  it('writes the acknowledgment row and a policy.acknowledged audit event with metadata', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])

    await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.policies.acknowledge,
      { clerkOrgId: 'org_a', policyKey: 'privacy_policy', policyVersion: 1 },
    )

    const acks = await acksFor(t, tenantId)
    expect(acks).toHaveLength(1)
    expect(acks[0]).toMatchObject({
      userId: 'admin_a',
      policyKey: 'privacy_policy',
      policyVersion: 1,
    })
    expect(acks[0]?.acknowledgedAt).toBeTruthy()

    const events = await auditEvents(t, tenantId)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      action: 'policy.acknowledged',
      category: 'policy',
      actorId: 'admin_a',
      metadata: { policyKey: 'privacy_policy', policyVersion: 1 },
    })
  })

  it('is idempotent: a second identical call does not duplicate the row or the audit event', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])
    const args = {
      clerkOrgId: 'org_a',
      policyKey: 'acceptable_use',
      policyVersion: 1,
    }

    const firstId = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.policies.acknowledge,
      args,
    )
    const secondId = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').mutation(
      api.policies.acknowledge,
      args,
    )

    expect(secondId).toBe(firstId)
    expect(await acksFor(t, tenantId)).toHaveLength(1)
    const events = await auditEvents(t, tenantId)
    expect(
      events.filter((e) => e.action === 'policy.acknowledged'),
    ).toHaveLength(1)
  })

  it('rejects unknown policy keys and versions above the current version', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])
    const asAdmin = () =>
      asOrgUser(t, 'admin_a', 'org_a', 'org:admin')

    await expect(
      asAdmin().mutation(api.policies.acknowledge, {
        clerkOrgId: 'org_a',
        policyKey: 'not_a_policy',
        policyVersion: 1,
      }),
    ).rejects.toThrow(/Unknown policy key/)
    await expect(
      asAdmin().mutation(api.policies.acknowledge, {
        clerkOrgId: 'org_a',
        policyKey: 'privacy_policy',
        policyVersion: 99,
      }),
    ).rejects.toThrow(/Invalid version/)
    expect(await acksFor(t, (await tenantIdOf(t, 'org_a'))!)).toHaveLength(0)
  })

  it('denies users who are not members of the tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])

    // Authenticated against org_a but with no member record.
    await expect(
      asOrgUser(t, 'stranger', 'org_a', 'org:admin').mutation(
        api.policies.acknowledge,
        { clerkOrgId: 'org_a', policyKey: 'privacy_policy', policyVersion: 1 },
      ),
    ).rejects.toThrow(/not a member/)

    // Member of a different tenant using org_a's id.
    await seedTenant(t, 'org_b', [
      { clerkUserId: 'admin_b', role: 'org:admin', displayName: 'Admin B' },
    ])
    await expect(
      asOrgUser(t, 'admin_b', 'org_b', 'org:admin').mutation(
        api.policies.acknowledge,
        { clerkOrgId: 'org_a', policyKey: 'privacy_policy', policyVersion: 1 },
      ),
    ).rejects.toThrow(/mismatch/)
  })
})

describe('policies.getPendingAcknowledgments', () => {
  it('a new member sees all current policies; acknowledging one drops it from pending', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'cg1', role: 'org:caregiver', displayName: 'Caregiver One' },
    ])
    const asCaregiver = () =>
      asOrgUser(t, 'cg1', 'org_a', 'org:caregiver')

    const pending = await asCaregiver().query(
      api.policies.getPendingAcknowledgments,
      { clerkOrgId: 'org_a' },
    )
    expect(pending.map((p) => p.key).sort()).toEqual(
      STAFF_POLICIES.map((p) => p.key).sort(),
    )
    for (const p of pending) {
      expect(p.version).toBe(STAFF_POLICY_VERSIONS[p.key])
      expect(p.title).toBeTruthy()
    }

    await asCaregiver().mutation(api.policies.acknowledge, {
      clerkOrgId: 'org_a',
      policyKey: 'confidentiality_hipaa',
      policyVersion: STAFF_POLICY_VERSIONS['confidentiality_hipaa']!,
    })

    const after = await asCaregiver().query(
      api.policies.getPendingAcknowledgments,
      { clerkOrgId: 'org_a' },
    )
    expect(after.map((p) => p.key)).not.toContain('confidentiality_hipaa')
    expect(after).toHaveLength(STAFF_POLICIES.length - 1)
  })

  it('acknowledging a stale version does not satisfy the pending check (version-bump re-surface)', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'cg1', role: 'org:caregiver', displayName: 'Caregiver One' },
    ])
    const asCaregiver = () =>
      asOrgUser(t, 'cg1', 'org_a', 'org:caregiver')

    // Acknowledge version 0 (older than the current version 1): the row is
    // written, but the policy still shows as pending against the current
    // version — this is exactly what happens to every user when a policy
    // version is bumped in code.
    await asCaregiver().mutation(api.policies.acknowledge, {
      clerkOrgId: 'org_a',
      policyKey: 'privacy_policy',
      policyVersion: 0,
    })

    const pending = await asCaregiver().query(
      api.policies.getPendingAcknowledgments,
      { clerkOrgId: 'org_a' },
    )
    expect(pending.map((p) => p.key)).toContain('privacy_policy')
    expect(pending).toHaveLength(STAFF_POLICIES.length)

    // Acknowledging the CURRENT version clears it.
    await asCaregiver().mutation(api.policies.acknowledge, {
      clerkOrgId: 'org_a',
      policyKey: 'privacy_policy',
      policyVersion: STAFF_POLICY_VERSIONS['privacy_policy']!,
    })
    const after = await asCaregiver().query(
      api.policies.getPendingAcknowledgments,
      { clerkOrgId: 'org_a' },
    )
    expect(after.map((p) => p.key)).not.toContain('privacy_policy')
  })

  it('denies non-members', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])
    await expect(
      asOrgUser(t, 'stranger', 'org_a', 'org:caregiver').query(
        api.policies.getPendingAcknowledgments,
        { clerkOrgId: 'org_a' },
      ),
    ).rejects.toThrow(/not a member/)
  })
})

describe('policies.listAcknowledgmentStatus', () => {
  it('denies coordinators, allows admins, and scopes results to the caller tenant', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
      { clerkUserId: 'coord_a', role: 'org:coordinator', displayName: 'Coord A' },
      { clerkUserId: 'cg_a', role: 'org:caregiver', displayName: 'Caregiver A' },
    ])
    await seedTenant(t, 'org_b', [
      { clerkUserId: 'admin_b', role: 'org:admin', displayName: 'Admin B' },
    ])

    // Coordinator denied.
    await expect(
      asOrgUser(t, 'coord_a', 'org_a', 'org:coordinator').query(
        api.policies.listAcknowledgmentStatus,
        { clerkOrgId: 'org_a' },
      ),
    ).rejects.toThrow(/Forbidden/)

    // Caregiver acknowledges one policy in tenant A.
    await asOrgUser(t, 'cg_a', 'org_a', 'org:caregiver').mutation(
      api.policies.acknowledge,
      { clerkOrgId: 'org_a', policyKey: 'acceptable_use', policyVersion: 1 },
    )

    // Admin sees the tenant A roster.
    const status = await asOrgUser(t, 'admin_a', 'org_a', 'org:admin').query(
      api.policies.listAcknowledgmentStatus,
      { clerkOrgId: 'org_a' },
    )
    expect(status).toHaveLength(STAFF_POLICIES.length)
    for (const policy of status) {
      expect(policy.members).toHaveLength(3)
    }
    const acceptableUse = status.find((p) => p.key === 'acceptable_use')!
    const cgRow = acceptableUse.members.find((m) => m.clerkUserId === 'cg_a')!
    expect(cgRow.status).toBe('current')
    expect(cgRow.acknowledgedVersion).toBe(1)
    expect(cgRow.acknowledgedAt).toBeTruthy()
    const coordRow = acceptableUse.members.find(
      (m) => m.clerkUserId === 'coord_a',
    )!
    expect(coordRow.status).toBe('pending')

    // Tenant B admin sees only tenant B's roster (just themselves, all pending).
    const statusB = await asOrgUser(t, 'admin_b', 'org_b', 'org:admin').query(
      api.policies.listAcknowledgmentStatus,
      { clerkOrgId: 'org_b' },
    )
    for (const policy of statusB) {
      expect(policy.members).toHaveLength(1)
      expect(policy.members[0]?.clerkUserId).toBe('admin_b')
      expect(policy.members[0]?.status).toBe('pending')
    }
  })

  it('denies a member of another tenant (cross-tenant)', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'org_a', [
      { clerkUserId: 'admin_a', role: 'org:admin', displayName: 'Admin A' },
    ])
    await seedTenant(t, 'org_b', [
      { clerkUserId: 'admin_b', role: 'org:admin', displayName: 'Admin B' },
    ])
    await expect(
      asOrgUser(t, 'admin_b', 'org_b', 'org:admin').query(
        api.policies.listAcknowledgmentStatus,
        { clerkOrgId: 'org_a' },
      ),
    ).rejects.toThrow(/mismatch/)
  })
})

async function tenantIdOf(t: TestConvex, clerkOrgId: string) {
  return t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('tenants')
          .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
          .unique()
      )?._id ?? null,
  )
}
