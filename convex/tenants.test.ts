import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

async function seedTenantWithMember(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  clerkUserId: string,
  role: 'org:admin' | 'org:coordinator' | 'org:caregiver',
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

describe('setAllowedEmailDomains', () => {
  it('lets an admin set the allowed email domains', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_domains_admin'
    const tenantId = await seedTenantWithMember(
      t,
      clerkOrgId,
      'user_admin',
      'org:admin',
    )

    const result = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId })
      .mutation(api.tenants.setAllowedEmailDomains, {
        clerkOrgId,
        domains: ['Example.COM', ' gmail.com ', 'gmail.com'],
      })

    expect(result).toEqual(['example.com', 'gmail.com'])

    const tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.allowedEmailDomains).toEqual(['example.com', 'gmail.com'])
  })

  it('denies non-admin roles', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_domains_denied'
    await seedTenantWithMember(t, clerkOrgId, 'user_coord', 'org:coordinator')

    await expect(
      t
        .withIdentity({ subject: 'user_coord', org_id: clerkOrgId })
        .mutation(api.tenants.setAllowedEmailDomains, {
          clerkOrgId,
          domains: ['example.com'],
        }),
    ).rejects.toThrow('required one of')
  })

  it('clears the restriction when set to an empty array', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_domains_clear'
    const tenantId = await seedTenantWithMember(
      t,
      clerkOrgId,
      'user_admin',
      'org:admin',
    )

    await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId })
      .mutation(api.tenants.setAllowedEmailDomains, {
        clerkOrgId,
        domains: ['example.com'],
      })

    const result = await t
      .withIdentity({ subject: 'user_admin', org_id: clerkOrgId })
      .mutation(api.tenants.setAllowedEmailDomains, {
        clerkOrgId,
        domains: [],
      })

    expect(result).toEqual([])
    const tenant = await t.run((ctx) => ctx.db.get(tenantId))
    expect(tenant?.allowedEmailDomains).toEqual([])
  })
})
