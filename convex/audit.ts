import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'

export const record = internalMutation({
  args: {
    clerkOrgId: v.string(),
    action: v.string(),
    kind: v.optional(v.string()),
    shiftId: v.optional(v.id('shifts')),
    previousStatus: v.optional(v.string()),
    nextStatus: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver'],
    )

    if (args.shiftId) {
      const shift = await ctx.db.get(args.shiftId)
      if (!shift) throw new Error('Shift not found.')
      assertTenantDoc(shift, tenantId)
    }

    return ctx.db.insert('auditEvents', {
      tenantId,
      actorId: identity.subject,
      actorRole: role,
      action: args.action,
      kind: args.kind,
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
