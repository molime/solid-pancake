import { ConvexError, v } from 'convex/values'
import { query, mutation, internalMutation, type MutationCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireIdentity,
  requireMatchingClerkOrganization,
  requireTenantRole,
} from './authHelpers'
import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
import { normalizeEmail } from './adpSync'

async function linkCandidateClerkUserId(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
  email: string,
  role: string,
) {
  if (role !== 'org:candidate') return
  const candidate = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_email', (q) =>
      q.eq('tenantId', tenantId).eq('email', normalizeEmail(email)),
    )
    .unique()
  if (candidate && !candidate.clerkUserId) {
    await ctx.db.patch(candidate._id, { clerkUserId })
  }
}

export const checkMembership = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const activeOrgId = getActiveClerkOrganizationId(identity)

    // Caregiver/candidate path: no Clerk org membership, so the JWT carries
    // no org claim. The tenantMembers record is what authorizes them. A user
    // may belong to multiple tenants, so match against ALL their records —
    // taking only .first() could falsely reject a valid membership.
    if (!activeOrgId) {
      const noOrgMembers = await ctx.db
        .query('tenantMembers')
        .withIndex('by_clerk_user_id', (q) =>
          q.eq('clerkUserId', identity.subject),
        )
        .collect()
      for (const noOrgMember of noOrgMembers) {
        const noOrgTenant = await ctx.db.get(noOrgMember.tenantId)
        if (noOrgTenant && noOrgTenant.clerkOrgId === clerkOrgId) return true
      }
      return false
    }

    if (activeOrgId !== clerkOrgId) return false

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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) return null
    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
      )
      .unique()
    return member ?? null
  },
})

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    return members
  },
})

export const firstOrgAdmin = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) return null

    const admin = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenant._id).eq('role', 'org:admin'),
      )
      .first()

    return admin ? { clerkUserId: admin.clerkUserId } : null
  },
})

export const listCaregivers = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
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

const MANAGER_ROLES = ['org:admin', 'org:coordinator', 'org:hr']

export const listManagers = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) => q.eq('tenantId', tenantId))
      .collect()

    return members.filter((m) => MANAGER_ROLES.includes(m.role))
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
      v.literal('org:hr'),
      v.literal('org:candidate'),
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
      await linkCandidateClerkUserId(
        ctx,
        tenantId,
        args.clerkUserId,
        args.email,
        role,
      )
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

    await linkCandidateClerkUserId(
      ctx,
      tenantId,
      args.clerkUserId,
      args.email,
      role,
    )

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
      v.literal('org:hr'),
      v.literal('org:candidate'),
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

export const createManualMember = internalMutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
      v.literal('org:hr'),
      v.literal('org:candidate'),
    ),
    displayName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()
    if (!tenant) {
      throw new ConvexError('Tenant not found for manual member creation.')
    }

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenant._id).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        displayName: args.displayName,
        email: args.email,
      })
      return existing._id
    }

    return await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: args.clerkUserId,
      role: args.role,
      displayName: args.displayName,
      email: args.email,
    })
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
