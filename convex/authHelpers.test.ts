import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  assertTenantDoc,
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireActiveClerkOrganization,
  requireTenantRole,
} from './authHelpers'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

describe('assertTenantDoc', () => {
  it('does not throw when doc belongs to the tenant', () => {
    const tenantId = 'tenant_123' as Id<'tenants'>
    expect(() => assertTenantDoc({ tenantId }, tenantId)).not.toThrow()
  })

  it('throws when doc belongs to a different tenant', () => {
    const tenantId = 'tenant_123' as Id<'tenants'>
    const otherTenantId = 'tenant_456' as Id<'tenants'>
    expect(() => assertTenantDoc({ tenantId: otherTenantId }, tenantId)).toThrow(
      'cross-tenant access denied',
    )
  })

  it('accepts or rejects a candidate-shaped doc across tenants', () => {
    const tenantId = 'tenant_123' as Id<'tenants'>
    const otherTenantId = 'tenant_456' as Id<'tenants'>
    const candidate = {
      tenantId,
      email: 'candidate@example.com',
      displayName: 'Candidate',
      status: 'new',
      createdAt: '2024-01-01T00:00:00.000Z',
    }

    expect(() => assertTenantDoc(candidate, tenantId)).not.toThrow()
    expect(() => assertTenantDoc(candidate, otherTenantId)).toThrow(
      'cross-tenant access denied',
    )
  })
})

describe('getActiveClerkOrganizationId', () => {
  it('reads top-level org_id', () => {
    expect(getActiveClerkOrganizationId({ org_id: 'org_123' })).toBe('org_123')
  })

  it('reads compact org object id', () => {
    expect(getActiveClerkOrganizationId({ o: { id: 'org_123' } })).toBe(
      'org_123',
    )
  })

  it('reads flattened o.id claim', () => {
    expect(getActiveClerkOrganizationId({ 'o.id': 'org_123' })).toBe('org_123')
  })

  it('prefers top-level org_id over compact form', () => {
    expect(
      getActiveClerkOrganizationId({
        org_id: 'org_top',
        o: { id: 'org_compact' },
      }),
    ).toBe('org_top')
  })

  it('returns null when no org claim exists', () => {
    expect(getActiveClerkOrganizationId({ sub: 'user_123' })).toBeNull()
  })
})

describe('getClerkOrganizationRole', () => {
  it('reads top-level org_role', () => {
    expect(getClerkOrganizationRole({ org_role: 'org:admin' })).toBe(
      'org:admin',
    )
  })

  it('reads compact org object rol', () => {
    expect(getClerkOrganizationRole({ o: { rol: 'admin' } })).toBe('org:admin')
    expect(getClerkOrganizationRole({ o: { rol: 'coordinator' } })).toBe(
      'org:coordinator',
    )
    expect(getClerkOrganizationRole({ o: { rol: 'caregiver' } })).toBe(
      'org:caregiver',
    )
  })

  it('reads flattened o.rol claim', () => {
    expect(getClerkOrganizationRole({ 'o.rol': 'admin' })).toBe('org:admin')
  })

  it('normalizes bare role names to org: prefix', () => {
    expect(getClerkOrganizationRole({ org_role: 'admin' })).toBe('org:admin')
    expect(getClerkOrganizationRole({ org_role: 'coordinator' })).toBe(
      'org:coordinator',
    )
    expect(getClerkOrganizationRole({ org_role: 'caregiver' })).toBe(
      'org:caregiver',
    )
    expect(getClerkOrganizationRole({ org_role: 'hr' })).toBe('org:hr')
    expect(getClerkOrganizationRole({ org_role: 'candidate' })).toBe(
      'org:candidate',
    )
  })

  it('reads org:hr and org:candidate roles', () => {
    expect(getClerkOrganizationRole({ org_role: 'org:hr' })).toBe('org:hr')
    expect(getClerkOrganizationRole({ org_role: 'org:candidate' })).toBe(
      'org:candidate',
    )
    expect(getClerkOrganizationRole({ o: { rol: 'hr' } })).toBe('org:hr')
    expect(getClerkOrganizationRole({ o: { rol: 'candidate' } })).toBe(
      'org:candidate',
    )
  })

  it('returns null for unknown roles', () => {
    expect(getClerkOrganizationRole({ org_role: 'superuser' })).toBeNull()
    expect(getClerkOrganizationRole({})).toBeNull()
  })
})

describe('requireActiveClerkOrganization', () => {
  it('does not throw when org_id matches', () => {
    expect(() =>
      requireActiveClerkOrganization({ org_id: 'org_123' }, 'org_123'),
    ).not.toThrow()
  })

  it('throws when org_id is missing', () => {
    expect(() =>
      requireActiveClerkOrganization({ sub: 'user_123' }, 'org_123'),
    ).toThrow('missing from token')
  })

  it('throws when org_id does not match', () => {
    expect(() =>
      requireActiveClerkOrganization({ org_id: 'org_456' }, 'org_123'),
    ).toThrow('mismatch')
  })

  it('matches compact org object id', () => {
    expect(() =>
      requireActiveClerkOrganization({ o: { id: 'org_123' } }, 'org_123'),
    ).not.toThrow()
  })
})


describe('getClerkOrganizationRole with public metadata', () => {
  it('prefers atriaRole from org_public_metadata when Clerk role is org:member', () => {
    const role = getClerkOrganizationRole({
      org_id: 'org_123',
      org_role: 'org:member',
      org_public_metadata: { atriaRole: 'org:hr' },
    } as unknown as Parameters<typeof getClerkOrganizationRole>[0])
    expect(role).toBe('org:hr')
  })

  it('does not consult public_metadata when org_public_metadata is absent', () => {
    const role = getClerkOrganizationRole({
      org_id: 'org_123',
      org_role: 'org:member',
      public_metadata: { atriaRole: 'org:admin' },
    } as unknown as Parameters<typeof getClerkOrganizationRole>[0])
    expect(role).toBeNull()
  })

  it('still returns top-level org_role when it is already an ATRIA role', () => {
    const role = getClerkOrganizationRole({
      org_id: 'org_123',
      org_role: 'org:admin',
    } as unknown as Parameters<typeof getClerkOrganizationRole>[0])
    expect(role).toBe('org:admin')
  })
})

describe('requireTenantRole without Clerk org membership', () => {
  async function seedTenantWithMember(
    t: ReturnType<typeof createTestConvex>,
    clerkOrgId: string,
    clerkUserId: string,
    role: 'org:admin' | 'org:caregiver' | 'org:candidate',
  ) {
    return t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
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

  it('succeeds with no org_id when the user has a tenantMembers record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_no_org_success'
    const caregiverId = 'user_cg_no_org'
    await seedTenantWithMember(t, clerkOrgId, caregiverId, 'org:caregiver')

    const result = await t
      .withIdentity({ subject: caregiverId })
      .run(async (ctx) =>
        requireTenantRole(ctx, clerkOrgId, ['org:caregiver']),
      )

    expect(result.role).toBe('org:caregiver')
    expect(result.clerkOrgId).toBe(clerkOrgId)
    expect(result.member.clerkUserId).toBe(caregiverId)
  })

  it('throws with no org_id when the user has no tenantMembers record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_no_org_stranger'
    await seedTenantWithMember(t, clerkOrgId, 'user_admin_no_org', 'org:admin')

    await expect(
      t
        .withIdentity({ subject: 'user_stranger' })
        .run(async (ctx) =>
          requireTenantRole(ctx, clerkOrgId, ['org:caregiver']),
        ),
    ).rejects.toThrow('not a member of this tenant')
  })

  it('rejects cross-tenant access with no org_id when clerkOrgId does not match the member record', async () => {
    const t = createTestConvex()
    const caregiverId = 'user_cg_cross'
    await seedTenantWithMember(t, 'org_home_tenant', caregiverId, 'org:caregiver')
    await seedTenantWithMember(t, 'org_other_tenant', 'user_other_admin', 'org:admin')

    await expect(
      t
        .withIdentity({ subject: caregiverId })
        .run(async (ctx) =>
          requireTenantRole(ctx, 'org_other_tenant', ['org:caregiver']),
        ),
    ).rejects.toThrow('not a member of this tenant')
  })

  it('resolves the matching membership when the user belongs to multiple tenants', async () => {
    const t = createTestConvex()
    const caregiverId = 'user_cg_multi_tenant'
    await seedTenantWithMember(t, 'org_multi_a', caregiverId, 'org:caregiver')
    await seedTenantWithMember(t, 'org_multi_b', caregiverId, 'org:caregiver')

    // Accessing the second tenant must succeed: the no-org path matches the
    // membership whose tenant matches the requested clerkOrgId, regardless of
    // which record the by_clerk_user_id index would return first.
    const result = await t
      .withIdentity({ subject: caregiverId })
      .run(async (ctx) =>
        requireTenantRole(ctx, 'org_multi_b', ['org:caregiver']),
      )

    expect(result.clerkOrgId).toBe('org_multi_b')
    expect(result.role).toBe('org:caregiver')
    expect(result.member.clerkUserId).toBe(caregiverId)
  })

  it('still enforces allowedRoles on the no-org path', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_no_org_role'
    const caregiverId = 'user_cg_role'
    await seedTenantWithMember(t, clerkOrgId, caregiverId, 'org:caregiver')

    await expect(
      t
        .withIdentity({ subject: caregiverId })
        .run(async (ctx) => requireTenantRole(ctx, clerkOrgId, ['org:admin'])),
    ).rejects.toThrow('required one of')
  })

  it('keeps org-based behavior unchanged when org_id is present', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_with_org'
    const adminId = 'user_admin_with_org'
    await seedTenantWithMember(t, clerkOrgId, adminId, 'org:admin')

    const result = await t
      .withIdentity({ subject: adminId, org_id: clerkOrgId, org_role: 'org:admin' })
      .run(async (ctx) => requireTenantRole(ctx, clerkOrgId, ['org:admin']))
    expect(result.role).toBe('org:admin')

    await expect(
      t
        .withIdentity({ subject: adminId, org_id: 'org_elsewhere', org_role: 'org:admin' })
        .run(async (ctx) => requireTenantRole(ctx, clerkOrgId, ['org:admin'])),
    ).rejects.toThrow('mismatch')
  })

  it('lets a caregiver without org membership call members.me for their tenant', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_no_org_members_me'
    const caregiverId = 'user_cg_members_me'
    await seedTenantWithMember(t, clerkOrgId, caregiverId, 'org:caregiver')

    const member = await t
      .withIdentity({ subject: caregiverId })
      .query(api.members.me, { clerkOrgId })

    expect(member?.clerkUserId).toBe(caregiverId)
    expect(member?.role).toBe('org:caregiver')
  })
})

describe('getMyTenant', () => {
  it('resolves the tenant for a user without Clerk org membership', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_my_tenant'
    const caregiverId = 'user_cg_get_my_tenant'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Care Agency',
        slug: 'care-agency',
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

    const result = await t
      .withIdentity({ subject: caregiverId })
      .query(api.candidates.getMyTenant, {})

    expect(result).toEqual([
      {
        clerkOrgId,
        tenantName: 'Care Agency',
        role: 'org:caregiver',
      },
    ])
  })

  it('returns every tenant when the user belongs to multiple agencies', async () => {
    const t = createTestConvex()
    const caregiverId = 'user_cg_multi_agency'

    await t.run(async (ctx) => {
      for (const [clerkOrgId, name] of [
        ['org_multi_home_a', 'Agency A'],
        ['org_multi_home_b', 'Agency B'],
      ] as const) {
        const tenantId = await ctx.db.insert('tenants', {
          clerkOrgId,
          name,
          slug: `slug-${clerkOrgId}`,
          createdAt: new Date().toISOString(),
        })
        await ctx.db.insert('tenantMembers', {
          tenantId,
          clerkUserId: caregiverId,
          role: 'org:caregiver',
          displayName: 'Caregiver',
          email: 'caregiver@example.com',
        })
      }
    })

    const result = await t
      .withIdentity({ subject: caregiverId })
      .query(api.candidates.getMyTenant, {})

    expect(result).toHaveLength(2)
    expect(result?.map((tenant) => tenant.clerkOrgId).sort()).toEqual([
      'org_multi_home_a',
      'org_multi_home_b',
    ])
  })

  it('returns an empty array when the user has no tenantMembers record', async () => {
    const t = createTestConvex()

    const result = await t
      .withIdentity({ subject: 'user_nobody' })
      .query(api.candidates.getMyTenant, {})

    expect(result).toEqual([])
  })
})
