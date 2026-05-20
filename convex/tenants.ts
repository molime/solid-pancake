import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import {
  getClerkOrganizationRole,
  requireIdentity,
  requireActiveClerkOrganization,
  requireTenantRole,
  type TenantRole,
} from './authHelpers'
import type { Id } from './_generated/dataModel'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const memberships = await ctx.db
      .query('tenantMembers')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .collect()

    const tenants = []
    for (const m of memberships) {
      const tenant = await ctx.db.get(m.tenantId)
      if (tenant) {
        tenants.push({ ...tenant, role: m.role })
      }
    }
    return tenants
  },
})

export const get = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenant, role } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
    ])
    return { ...tenant, role }
  },
})

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { clerkOrgId, name, slug }) => {
    const identity = await requireIdentity(ctx)
    requireActiveClerkOrganization(identity, clerkOrgId)

    const existing = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()

    if (existing) {
      throw new Error('Tenant already exists for this organization.')
    }

    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name,
      slug,
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: identity.subject,
      role: getClerkOrganizationRole(identity) ?? 'org:admin',
      displayName: identity.name ?? identity.email ?? 'User',
      email: identity.email ?? '',
    })

    return tenantId
  },
})

export const ensureSelectedAgency = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    displayName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { clerkOrgId, name, slug, displayName, email }) => {
    const identity = await requireIdentity(ctx)
    requireActiveClerkOrganization(identity, clerkOrgId)

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()

    let tenantId: Id<'tenants'>
    let isNewTenant = false

    if (!tenant) {
      tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name,
        slug,
        createdAt: new Date().toISOString(),
      })
      isNewTenant = true
    } else {
      tenantId = tenant._id
    }

    const existingMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()

    if (existingMember) {
      await ctx.db.patch(existingMember._id, {
        displayName,
        email,
      })
      return { tenantId, memberId: existingMember._id, isNewTenant }
    }

    const roleFromClerk = getClerkOrganizationRole(identity)
    const role: TenantRole = isNewTenant
      ? 'org:admin'
      : roleFromClerk ?? 'org:caregiver'

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: identity.subject,
      role,
      displayName,
      email,
    })

    return { tenantId, memberId, isNewTenant }
  },
})

export const updateBillingSettings = mutation({
  args: {
    clerkOrgId: v.string(),
    defaultRate: v.number(),
    exportFormat: v.union(v.literal('csv'), v.literal('json')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])
    await ctx.db.patch(tenantId, {
      billingSettings: {
        defaultRate: args.defaultRate,
        exportFormat: args.exportFormat,
      },
    })
  },
})
