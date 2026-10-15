import { describe, it, expect } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  slug: string,
  name: string,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert('tenants', {
      clerkOrgId: `org_${slug}`,
      name,
      slug,
      createdAt: new Date().toISOString(),
    })
  })
}

describe('getPublicAgencyBySubdomain', () => {
  it('finds the agency whose slug normalizes to the subdomain', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'golden-ages-home-care', 'Golden Ages Home Care')
    await seedTenant(t, 'individuals-choice-inc', 'Individuals Choice')

    const ga = await t.query(api.agencyConfig.getPublicAgencyBySubdomain, {
      subdomain: 'goldenages',
    })
    expect(ga?.name).toBe('Golden Ages Home Care')

    const ic = await t.query(api.agencyConfig.getPublicAgencyBySubdomain, {
      subdomain: 'individualschoice',
    })
    expect(ic?.name).toBe('Individuals Choice')
  })

  it('returns null for unknown or empty subdomains', async () => {
    const t = createTestConvex()
    await seedTenant(t, 'golden-ages-home-care', 'Golden Ages Home Care')

    expect(
      await t.query(api.agencyConfig.getPublicAgencyBySubdomain, {
        subdomain: 'nope',
      }),
    ).toBeNull()
    expect(
      await t.query(api.agencyConfig.getPublicAgencyBySubdomain, {
        subdomain: '',
      }),
    ).toBeNull()
  })
})
