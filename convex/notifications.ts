import { ConvexError, v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { requireTenantRole } from './authHelpers'

const MEMBER_ROLES: Array<
  'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr'
> = ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr']

/**
 * Inserts a staff notification row. Internal-only: called from the staff
 * notification actions in _utils/notifications.ts (actions cannot write to
 * the database directly).
 */
export const record = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('notifications', {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      type: args.type,
      message: args.message,
      metadata: args.metadata,
      read: false,
      createdAt: new Date().toISOString(),
    })
  },
})

/**
 * Resolves a staff member's email address for notification delivery.
 * Prefers the tenantMembers record, falls back to the employeeProfiles
 * record. Returns null when no email resolves — callers must degrade
 * gracefully.
 */
export const resolveStaffEmail = internalQuery({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    if (member?.email) return member.email

    const profile = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    return profile?.email ?? null
  },
})

/**
 * The caller's own notifications for their tenant, newest first.
 * Any authenticated tenant member may list their own notifications.
 */
export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      MEMBER_ROLES,
    )

    return ctx.db
      .query('notifications')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .order('desc')
      .take(100)
  },
})

export const unreadCount = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      MEMBER_ROLES,
    )

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_tenant_user_read', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clerkUserId', identity.subject)
          .eq('read', false),
      )
      .collect()

    return unread.length
  },
})

export const markRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.notificationId)
    if (!row) throw new ConvexError('Notification not found.')

    const tenant = await ctx.db.get(row.tenantId)
    if (!tenant) throw new ConvexError('Tenant not found.')

    // Establishes the caller is a member of the row's tenant and yields the
    // caller identity for the ownership check below.
    const { identity } = await requireTenantRole(
      ctx,
      tenant.clerkOrgId,
      MEMBER_ROLES,
    )

    if (row.clerkUserId !== identity.subject) {
      throw new ConvexError(
        'Forbidden: cannot modify another user\'s notification.',
      )
    }

    if (!row.read) {
      await ctx.db.patch(args.notificationId, { read: true })
    }
    return args.notificationId
  },
})

export const markAllRead = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      MEMBER_ROLES,
    )

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_tenant_user_read', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clerkUserId', identity.subject)
          .eq('read', false),
      )
      .collect()

    for (const row of unread) {
      await ctx.db.patch(row._id, { read: true })
    }

    return { marked: unread.length }
  },
})
