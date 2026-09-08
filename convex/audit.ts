import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
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
      ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr', 'org:candidate'],
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
  args: {
    clerkOrgId: v.string(),
    action: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    actorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    // Date-only end bounds are treated as inclusive end-of-day.
    const endBound =
      args.endDate !== undefined
        ? args.endDate.length === 10
          ? `${args.endDate}T23:59:59.999Z`
          : args.endDate
        : undefined

    // Scan the date-bounded index in 500-row batches until 200 matching
    // events are collected (or the window is exhausted). Filtering
    // action/actorId after a single .take(500) could silently drop older
    // matching events. Convex allows only one .paginate() call per function,
    // so each batch is a fresh range query that walks the inclusive upper
    // bound backwards; `seen` skips the previous batch's boundary row.
    const events: Doc<'auditEvents'>[] = []
    const seen = new Set<string>()
    let upperBound = endBound
    // The iteration cap guards the pathological case where more than 500
    // rows share the exact same createdAt and the bound cannot advance.
    for (let batch = 0; events.length < 200 && batch < 20; batch++) {
      const rows = await ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => {
          const base = q.eq('tenantId', tenantId)
          if (args.startDate && upperBound) {
            return base.gte('createdAt', args.startDate).lte('createdAt', upperBound)
          }
          if (args.startDate) return base.gte('createdAt', args.startDate)
          if (upperBound) return base.lte('createdAt', upperBound)
          return base
        })
        .order('desc')
        .take(500)
      if (rows.length === 0) break
      for (const event of rows) {
        if (seen.has(event._id)) continue
        seen.add(event._id)
        if (args.action && event.action !== args.action) continue
        if (args.actorId && event.actorId !== args.actorId) continue
        events.push(event)
        if (events.length === 200) break
      }
      if (rows.length < 500) break
      upperBound = rows[rows.length - 1].createdAt
    }

    // Resolve actorId (Clerk user ID) to display name for the UI.
    // Check tenantMembers, employeeProfiles, and platformAdmins.
    // For platform admins (who have no tenantMember record), fall back
    // to a "Platform Admin" label so the UI never shows a raw user ID.
    const actorIds = new Set(events.map((e) => e.actorId))
    const names = new Map<string, string>()
    for (const actorId of actorIds) {
      // 1. Check tenantMembers — scoped to THIS tenant: a user can belong to
      // several tenants (qa/admin accounts especially), so an unscoped
      // by_clerk_user_id unique() crashes with "more than one result".
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', actorId),
        )
        .unique()
      if (member) {
        names.set(actorId, member.displayName)
        continue
      }
      // 2. Check employeeProfiles
      const profile = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', actorId),
        )
        .unique()
      if (profile) {
        names.set(actorId, profile.displayName)
        continue
      }
      // 3. Check platformAdmins — no displayName stored, use a label
      const platformAdmin = await ctx.db
        .query('platformAdmins')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', actorId))
        .unique()
      if (platformAdmin) {
        names.set(actorId, 'Platform Admin')
        continue
      }
    }

    return events.map((event) => ({
      ...event,
      actorName: names.get(event.actorId) ?? 'Unknown user',
    }))
  },
})
