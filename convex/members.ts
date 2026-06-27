import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireIdentity,
  requireMatchingClerkOrganization,
  requireTenant,
  requireTenantRole,
} from './authHelpers'
import { ensureCaregiverEmployeeProfile } from './employeeProfiles'

export const checkMembership = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const activeOrgId = getActiveClerkOrganizationId(identity)
    if (!activeOrgId || activeOrgId !== clerkOrgId) return false

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()

    if (!tenant) return false

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
      )
      .unique()

    return !!member
  },
})

export const me = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
    return ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    return members
  },
})

export const listCaregivers = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()

    return members
  },
})

export const sync = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
    displayName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    requireMatchingClerkOrganization(identity, args.clerkOrgId)

    if (args.clerkUserId !== identity.subject) {
      throw new Error('Members can only self-sync from Clerk.')
    }

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()

    if (!tenant) throw new Error('Tenant not found.')

    const tenantId = tenant._id

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    const roleFromClerk = getClerkOrganizationRole(identity)
    const role = roleFromClerk ?? existing?.role ?? 'org:caregiver'

    if (existing) {
      await ctx.db.patch(existing._id, {
        role,
        displayName: args.displayName,
        email: args.email,
      })
      if (role === 'org:caregiver') {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          { ...existing, role, displayName: args.displayName, email: args.email },
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
      return existing._id
    }

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: args.clerkUserId,
      role,
      displayName: args.displayName,
      email: args.email,
    })

    if (role === 'org:caregiver') {
      const newMember = await ctx.db.get(memberId)
      if (newMember) {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          newMember,
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
    }

    return memberId
  },
})

export const updateRole = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (args.clerkUserId === identity.subject) {
      throw new Error('Cannot change your own role.')
    }

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (!existing) {
      throw new Error('Member not found.')
    }

    await ctx.db.patch(existing._id, { role: args.role })

    if (args.role === 'org:caregiver') {
      const updatedMember = { ...existing, role: args.role }
      const employeeProfileId = await ensureCaregiverEmployeeProfile(
        ctx,
        tenantId,
        updatedMember,
      )
      if (employeeProfileId) {
        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
          employeeProfileId,
        })
      }
    }

    return existing._id
  },
})

export const remove = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
