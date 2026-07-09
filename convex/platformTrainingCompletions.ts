import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, ensureTenantMember } from './authHelpers'

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    trainingId: v.string(),
    completedAt: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const member = await ensureTenantMember(ctx, tenantId, args.clerkUserId)
    if (!member) {
      throw new ConvexError(
        'Forbidden: user is not a member of this tenant.',
      )
    }

    return ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: args.clerkUserId,
      trainingId: args.trainingId,
      completedAt: args.completedAt,
      status: args.status,
      expiresAt: args.expiresAt,
    })
  },
})

export const completeForCandidate = mutation({
  args: {
    clerkOrgId: v.string(),
    trainingId: v.string(),
    completedAt: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
      'org:caregiver',
    ])
    const clerkUserId = identity.subject

    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
      )
      .unique()
    if (candidate) {
      const task = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_status', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('status', 'pending'),
        )
        .filter((q) => q.eq(q.field('type'), 'platform_training'))
        .first()
      if (task) {
        await ctx.db.patch(task._id, {
          status: 'complete',
          completedAt: new Date().toISOString(),
        })
      }
    }

    return ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId,
      trainingId: args.trainingId,
      completedAt: args.completedAt,
      status: args.status,
      expiresAt: args.expiresAt,
    })
  },
})

export const listMyCompletions = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
      'org:caregiver',
    ])
    return ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .collect()
  },
})
