import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'

/**
 * One-off account migration: moves everything attached to one Clerk user
 * (the "from" account) onto another (the "to" account) within a tenant.
 *
 * Used 2026-09-23 to merge Oge's personal account (ubahoge2014@yahoo.com)
 * into her work account (supervisor@goldenagesinhomecare.com) in Golden
 * Ages. Records keyed by candidateId (tasks, document versions, prefilled
 * documents, applications, background checks) follow the candidate row
 * automatically once its clerkUserId is re-pointed.
 *
 * Safe to re-run: every step is a no-op when there is nothing left to move.
 */
export const migrateUserAccount = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    fromClerkUserId: v.string(),
    toClerkUserId: v.string(),
    toEmail: v.string(),
    toRole: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
      v.literal('org:hr'),
      v.literal('org:candidate'),
    ),
  },
  handler: async (ctx, args) => {
    const summary = {
      candidateMoved: false as boolean,
      toMemberRoleSet: false as boolean,
      fromMemberRemoved: false as boolean,
      notifications: 0,
      platformTrainingCompletions: 0,
      trainingStepCompletions: 0,
    }

    // 1. Candidate record (tasks, versions, prefilled docs, applications and
    //    background checks all key off candidateId, so they move with it).
    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.fromClerkUserId),
      )
      .unique()
    if (candidate) {
      await ctx.db.patch(candidate._id, {
        clerkUserId: args.toClerkUserId,
        email: args.toEmail.toLowerCase().trim(),
      })
      summary.candidateMoved = true
    }

    // 2. Membership: give the target account the source account's role, then
    //    remove the source membership so the old login loses tenant access.
    const toMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.toClerkUserId),
      )
      .unique()
    if (toMember && toMember.role !== args.toRole) {
      await ctx.db.patch(toMember._id, { role: args.toRole })
      summary.toMemberRoleSet = true
    }
    const fromMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.fromClerkUserId),
      )
      .unique()
    if (fromMember) {
      await ctx.db.delete(fromMember._id)
      summary.fromMemberRemoved = true
    }

    // 3-5. Rows keyed directly by clerkUserId.
    const rekey = async (
      table: 'notifications' | 'platformTrainingCompletions' | 'trainingStepCompletions',
    ) => {
      const rows = await ctx.db
        .query(table)
        .filter((q) =>
          q.and(
            q.eq(q.field('tenantId'), args.tenantId),
            q.eq(q.field('clerkUserId'), args.fromClerkUserId),
          ),
        )
        .collect()
      for (const row of rows) {
        await ctx.db.patch(row._id as Id<typeof table>, {
          clerkUserId: args.toClerkUserId,
        })
      }
      return rows.length
    }
    summary.notifications = await rekey('notifications')
    summary.platformTrainingCompletions = await rekey('platformTrainingCompletions')
    summary.trainingStepCompletions = await rekey('trainingStepCompletions')

    return summary
  },
})
