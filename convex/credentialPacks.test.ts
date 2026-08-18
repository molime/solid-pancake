import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { CA_ILS_SLS_CAREGIVER_PACK } from './credentialPacks'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const CLERK_ORG_ID = 'org_credential_packs_test'
const ADMIN_ID = 'user_admin_packs'
const COORDINATOR_ID = 'user_coordinator_packs'

async function seedTenant(t: TestConvex) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: CLERK_ORG_ID,
      name: 'Packs Agency',
      slug: 'packs-agency',
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
    return { tenantId }
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

async function listRequirements(t: TestConvex, tenantId: Id<'tenants'>) {
  return t.run(async (ctx) =>
    ctx.db
      .query('credentialRequirements')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect(),
  )
}

describe('credentialPacks.applyCredentialPack', () => {
  it('creates every pack requirement for a fresh tenant and audits it', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    const result = await asAdmin(t).mutation(
      api.credentialPacks.applyCredentialPack,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(result.status).toBe('applied')
    expect(result.counts.created).toBe(CA_ILS_SLS_CAREGIVER_PACK.length)
    expect(result.counts.skipped).toBe(0)

    const requirements = await listRequirements(t, tenantId)
    expect(requirements).toHaveLength(CA_ILS_SLS_CAREGIVER_PACK.length)
    for (const entry of CA_ILS_SLS_CAREGIVER_PACK) {
      const match = requirements.find((r) => r.category === entry.category)
      expect(match, entry.category).toBeDefined()
      expect(match?.label).toBe(entry.label)
      expect(match?.isRequired).toBe(entry.isRequired)
      expect(match?.expiryMonths).toBe(entry.expiryMonths)
    }

    const audits = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) =>
          q.eq('tenantId', tenantId),
        )
        .collect(),
    )
    expect(
      audits.some((a) => a.action === 'credential_pack_applied'),
    ).toBe(true)
  })

  it('is idempotent — re-applying skips every existing category', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    await asAdmin(t).mutation(api.credentialPacks.applyCredentialPack, {
      clerkOrgId: CLERK_ORG_ID,
    })
    const second = await asAdmin(t).mutation(
      api.credentialPacks.applyCredentialPack,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(second.status).toBe('already-applied')
    expect(second.counts.created).toBe(0)
    expect(second.counts.skipped).toBe(CA_ILS_SLS_CAREGIVER_PACK.length)

    const requirements = await listRequirements(t, tenantId)
    expect(requirements).toHaveLength(CA_ILS_SLS_CAREGIVER_PACK.length)
  })

  it('skips only the categories that already exist', async () => {
    const t = createTestConvex()
    const { tenantId } = await seedTenant(t)

    await t.run(async (ctx) =>
      ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'live_scan',
        label: 'Custom Live Scan label',
        isRequired: true,
      }),
    )

    const result = await asAdmin(t).mutation(
      api.credentialPacks.applyCredentialPack,
      { clerkOrgId: CLERK_ORG_ID },
    )

    expect(result.counts.created).toBe(CA_ILS_SLS_CAREGIVER_PACK.length - 1)
    expect(result.counts.skipped).toBe(1)

    const requirements = await listRequirements(t, tenantId)
    expect(requirements).toHaveLength(CA_ILS_SLS_CAREGIVER_PACK.length)
    // The pre-existing row is untouched — never overwritten by the pack.
    expect(
      requirements.find((r) => r.category === 'live_scan')?.label,
    ).toBe('Custom Live Scan label')
  })

  it('rejects non-admin roles', async () => {
    const t = createTestConvex()
    await seedTenant(t)

    await expect(
      asCoordinator(t).mutation(api.credentialPacks.applyCredentialPack, {
        clerkOrgId: CLERK_ORG_ID,
      }),
    ).rejects.toThrow('org:admin')
  })
})
