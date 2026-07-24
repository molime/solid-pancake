import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
} from './authHelpers'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

describe('Convex members exports', () => {
  it('exports list, me, sync, updateRole, and remove', async () => {
    const mod = await import('./members')
    expect(mod).toHaveProperty('list')
    expect(mod).toHaveProperty('me')
    expect(mod).toHaveProperty('sync')
    expect(mod).toHaveProperty('updateRole')
    expect(mod).toHaveProperty('remove')
  })
})

describe('members.sync role resolution', () => {
  it('reads org:admin from Clerk token with top-level org_role', () => {
    const identity = { org_id: 'org_123', org_role: 'org:admin' }
    expect(getClerkOrganizationRole(identity)).toBe('org:admin')
  })

  it('returns null for Clerk org:member (not an ATRIA-X role)', () => {
    const identity = { org_id: 'org_123', org_role: 'org:member' }
    expect(getClerkOrganizationRole(identity)).toBeNull()
  })

  it('reads admin from compact Clerk token o.rol', () => {
    const identity = { o: { id: 'org_123', rol: 'admin' } }
    expect(getClerkOrganizationRole(identity)).toBe('org:admin')
  })

  it('reads org_id from compact Clerk token o.id', () => {
    const identity = { o: { id: 'org_123', rol: 'member' } }
    expect(getActiveClerkOrganizationId(identity)).toBe('org_123')
  })

  // The sync mutation uses:
  //   const roleFromClerk = getClerkOrganizationRole(identity)
  //   const role = roleFromClerk ?? existing?.role ?? 'org:caregiver'
  //
  // This means:
  // - For org:admin in Clerk → role becomes org:admin
  // - For org:member in Clerk, existing member → keeps existing Convex role
  // - For org:member in Clerk, new member → defaults to org:caregiver
})


describe('members.firstOrgAdmin', () => {
  it('returns the first org:admin for a tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_first_admin'
    const adminId = 'user_admin_first'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'First Admin Agency',
        slug: 'first-admin-agency',
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
        clerkUserId: 'user_hr_first',
        role: 'org:hr',
        displayName: 'HR',
        email: 'hr@example.com',
      })
    })

    const result = await t
      .withIdentity({
        subject: 'user_hr_first',
        org_id: clerkOrgId,
        org_role: 'org:hr',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.members.firstOrgAdmin, { clerkOrgId })
      })

    expect(result).toEqual({ clerkUserId: adminId })
  })

  it('returns null when no org:admin exists', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_no_admin'
    const hrId = 'user_hr_no_admin'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'No Admin Agency',
        slug: 'no-admin-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: hrId,
        role: 'org:hr',
        displayName: 'HR',
        email: 'hr@example.com',
      })
    })

    const result = await t
      .withIdentity({
        subject: hrId,
        org_id: clerkOrgId,
        org_role: 'org:hr',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.members.firstOrgAdmin, { clerkOrgId })
      })

    expect(result).toBeNull()
  })

  it('rejects callers who are not tenant members', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_first_admin_auth'
    const adminId = 'user_admin_first_auth'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Auth Admin Agency',
        slug: 'auth-admin-agency',
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
      t.run(async (ctx) => {
        return ctx.runQuery(api.members.firstOrgAdmin, { clerkOrgId })
      }),
    ).rejects.toThrow('Unauthorized: authentication required')
  })
})


describe('members.listManagers', () => {
  it('returns only admin, coordinator, and hr members', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_managers'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Managers Agency',
        slug: 'managers-agency',
        createdAt: new Date().toISOString(),
      })
      const members: Array<{ clerkUserId: string; role: 'org:caregiver' | 'org:coordinator' | 'org:admin' | 'org:hr'; displayName: string }> = [
        { clerkUserId: 'u_caregiver', role: 'org:caregiver', displayName: 'Caregiver A' },
        { clerkUserId: 'u_coordinator', role: 'org:coordinator', displayName: 'Coordinator B' },
        { clerkUserId: 'u_admin', role: 'org:admin', displayName: 'Admin C' },
        { clerkUserId: 'u_hr', role: 'org:hr', displayName: 'Hr D' },
      ]
      for (const m of members) {
        await ctx.db.insert('tenantMembers', {
          tenantId,
          clerkUserId: m.clerkUserId,
          role: m.role,
          displayName: m.displayName,
          email: `${m.clerkUserId}@example.com`,
        })
      }
    })

    const managers = await t
      .withIdentity({
        subject: 'u_hr',
        org_id: clerkOrgId,
        org_role: 'org:hr',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.members.listManagers, { clerkOrgId })
      })

    expect(managers.map((m) => ({ clerkUserId: m.clerkUserId, role: m.role }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clerkUserId: 'u_coordinator', role: 'org:coordinator' }),
        expect.objectContaining({ clerkUserId: 'u_admin', role: 'org:admin' }),
        expect.objectContaining({ clerkUserId: 'u_hr', role: 'org:hr' }),
      ]),
    )
    expect(managers.some((m) => m.clerkUserId === 'u_caregiver')).toBe(false)
    expect(managers).toHaveLength(3)
  })
})

describe('members.checkMembership without Clerk org membership', () => {
  async function seedTenantWithMember(
    t: ReturnType<typeof createTestConvex>,
    clerkOrgId: string,
    clerkUserId: string,
    role: 'org:admin' | 'org:caregiver',
  ) {
    return t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Check Membership Agency',
        slug: `slug-${clerkOrgId}`,
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId,
        role,
        displayName: 'Member',
        email: 'member@example.com',
      })
      return tenantId
    })
  }

  it('returns true for a caregiver with no org_id but a tenantMembers record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_check_no_org'
    const caregiverId = 'user_cg_check_no_org'
    await seedTenantWithMember(t, clerkOrgId, caregiverId, 'org:caregiver')

    const result = await t
      .withIdentity({ subject: caregiverId })
      .query(api.members.checkMembership, { clerkOrgId })

    expect(result).toBe(true)
  })

  it('returns false with no org_id when clerkOrgId does not match the member record', async () => {
    const t = createTestConvex()
    const caregiverId = 'user_cg_check_cross'
    await seedTenantWithMember(t, 'org_check_home', caregiverId, 'org:caregiver')
    await seedTenantWithMember(t, 'org_check_other', 'user_check_admin', 'org:admin')

    const result = await t
      .withIdentity({ subject: caregiverId })
      .query(api.members.checkMembership, { clerkOrgId: 'org_check_other' })

    expect(result).toBe(false)
  })

  it('returns true for the matching tenant when the user belongs to multiple tenants', async () => {
    const t = createTestConvex()
    const caregiverId = 'user_cg_check_multi'
    await seedTenantWithMember(t, 'org_check_multi_a', caregiverId, 'org:caregiver')
    await seedTenantWithMember(t, 'org_check_multi_b', caregiverId, 'org:caregiver')

    // The second tenant must match even if the by_clerk_user_id index would
    // return the first membership record.
    const result = await t
      .withIdentity({ subject: caregiverId })
      .query(api.members.checkMembership, { clerkOrgId: 'org_check_multi_b' })

    expect(result).toBe(true)
  })

  it('returns false with no org_id and no tenantMembers record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_check_stranger'
    await seedTenantWithMember(t, clerkOrgId, 'user_check_admin2', 'org:admin')

    const result = await t
      .withIdentity({ subject: 'user_check_stranger' })
      .query(api.members.checkMembership, { clerkOrgId })

    expect(result).toBe(false)
  })

  it('keeps org-based behavior unchanged when org_id is present', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_check_with_org'
    const adminId = 'user_check_with_org'
    await seedTenantWithMember(t, clerkOrgId, adminId, 'org:admin')

    const matching = await t
      .withIdentity({ subject: adminId, org_id: clerkOrgId, org_role: 'org:admin' })
      .query(api.members.checkMembership, { clerkOrgId })
    expect(matching).toBe(true)

    const mismatched = await t
      .withIdentity({ subject: adminId, org_id: 'org_check_elsewhere', org_role: 'org:admin' })
      .query(api.members.checkMembership, { clerkOrgId })
    expect(mismatched).toBe(false)
  })
})
