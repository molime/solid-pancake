import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { requireTenantRole } from './authHelpers'

const DEFAULT_TRAINING_ID = 'platform_training'

export const completePlatformTraining = mutation({
  args: {
    clerkOrgId: v.string(),
    trainingId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:caregiver',
      'org:candidate',
    ])

    const trainingId = args.trainingId ?? DEFAULT_TRAINING_ID

    const existing = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .filter((q) => q.eq(q.field('trainingId'), trainingId))
      .first()

    if (existing) {
      return existing
    }

    const completionId = await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: identity.subject,
      trainingId,
      completedAt: new Date().toISOString(),
      status: 'completed',
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'platform.training.completed',
      metadata: { trainingId, completionId: completionId as string },
    })

    return ctx.db.get(completionId)
  },
})

export const hasPlatformTrainingCompleted = query({
  args: {
    clerkOrgId: v.string(),
    trainingId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:caregiver',
      'org:candidate',
    ])

    const trainingId = args.trainingId ?? DEFAULT_TRAINING_ID

    const existing = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .filter((q) => q.eq(q.field('trainingId'), trainingId))
      .first()

    return !!existing
  },
})

export const resetPlatformTraining = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .filter((q) => q.eq(q.field('trainingId'), DEFAULT_TRAINING_ID))
      .first()

    if (!existing) {
      return { deleted: false }
    }

    await ctx.db.delete(existing._id)

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'platform.training.reset',
      metadata: {
        clerkUserId: args.clerkUserId,
        trainingId: DEFAULT_TRAINING_ID,
      },
    })

    return { deleted: true }
  },
})
