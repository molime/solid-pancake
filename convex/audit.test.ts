import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const ORG_A = 'org_audit_list_a'
const ORG_B = 'org_audit_list_b'
const ADMIN_ID = 'user_admin_audit_list'
const ACTOR_ID = 'user_actor_audit_list'

function asAdmin(t: TestConvex) {
  return t.withIdentity({
    subject: ADMIN_ID,
    org_id: ORG_A,
    org_role: 'org:admin',
  })
}

async function seedTenant(t: TestConvex, clerkOrgId: string, name: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN_ID,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

describe('audit.list', () => {
  it('resolves actor names when the actor belongs to multiple tenants', async () => {
    const t = createTestConvex()
    const tenantA = await seedTenant(t, ORG_A, 'Agency A')
    const tenantB = await seedTenant(t, ORG_B, 'Agency B')

    // The same person is a member of both tenants — an unscoped unique()
    // lookup on tenantMembers used to crash here.
    await t.run(async (ctx) => {
      for (const tenantId of [tenantA, tenantB]) {
        await ctx.db.insert('tenantMembers', {
          tenantId,
          clerkUserId: ACTOR_ID,
          role: 'org:caregiver',
          displayName: 'Shared Actor',
          email: 'actor@example.com',
        })
      }
      await ctx.db.insert('auditEvents', {
        tenantId: tenantA,
        actorId: ACTOR_ID,
        actorRole: 'org:caregiver',
        action: 'shift_submitted',
        createdAt: new Date().toISOString(),
      })
    })

    const events = await asAdmin(t).query(api.audit.list, { clerkOrgId: ORG_A })
    expect(events).toHaveLength(1)
    expect(events[0]?.actorName).toBe('Shared Actor')
  })

  it('rejects non-admin/hr roles', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A')
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: ACTOR_ID,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })
    })
    const asCoordinator = t.withIdentity({
      subject: ACTOR_ID,
      org_id: ORG_A,
      org_role: 'org:coordinator',
    })
    await expect(
      asCoordinator.query(api.audit.list, { clerkOrgId: ORG_A }),
    ).rejects.toThrow('Forbidden')
  })
})
