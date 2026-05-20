import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTenantRole } from './authHelpers'

export const record = mutation({
  args: {
    clerkOrgId: v.string(),
    actorId: v.string(),
    actorRole: v.string(),
    action: v.string(),
    shiftId: v.optional(v.id('shifts')),
    previousStatus: v.optional(v.string()),
    nextStatus: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
    ])

    return ctx.db.insert('auditEvents', {
      tenantId,
      actorId: args.actorId,
      actorRole: args.actorRole,
      action: args.action,
      shiftId: args.shiftId,
      previousStatus: args.previousStatus,
      nextStatus: args.nextStatus,
      metadata: args.metadata,
      createdAt: new Date().toISOString(),
    })
  },
})

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:caregiver',
    ])

    return ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(200)
  },
})
