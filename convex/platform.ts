import { query } from './_generated/server'
import { requireIdentity } from './authHelpers'
import { ConvexError } from 'convex/values'

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('platformAdmins')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
    return !!existing
  },
})

export const listTenants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('platformAdmins')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()

    if (!existing) {
      throw new ConvexError('Forbidden: platform admin access required.')
    }

    const tenants = await ctx.db.query('tenants').collect()

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const members = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const clients = await ctx.db
          .query('clients')
          .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const shifts = await ctx.db
          .query('shifts')
          .withIndex('by_tenant_status_start', (q) =>
            q.eq('tenantId', tenant._id),
          )
          .collect()

        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          clerkOrgId: tenant.clerkOrgId,
          createdAt: tenant.createdAt,
          memberCount: members.length,
          clientCount: clients.length,
          shiftCount: shifts.length,
        }
      }),
    )

    return results
  },
})
