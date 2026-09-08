import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { UserIdentity } from 'convex/server'
import { requireIdentity, requireTenantRole } from './authHelpers'

const ticketCategory = v.union(
  v.literal('billing'),
  v.literal('technical'),
  v.literal('account'),
  v.literal('feature'),
  v.literal('other'),
)

const ticketPriority = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
)

const ticketStatus = v.union(
  v.literal('open'),
  v.literal('in_progress'),
  v.literal('resolved'),
  v.literal('closed'),
)

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

// Forward lifecycle with reopen paths; terminal 'closed' never reopens.
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}

const SUBJECT_MAX = 200
const DESCRIPTION_MAX = 5000
const NOTE_MAX = 2000

// Platform-side guard + audit helpers mirror the (unexported) pattern in
// platform.ts — kept local to avoid a circular import.
async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx)
  const existing = await ctx.db
    .query('platformAdmins')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  if (!existing) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

async function recordPlatformAudit(
  ctx: MutationCtx,
  identity: UserIdentity,
  tenantId: Id<'tenants'>,
  action: string,
  metadata?: Record<string, unknown>,
) {
  await ctx.db.insert('auditEvents', {
    tenantId,
    actorId: identity.subject,
    actorRole: 'platform_admin',
    action,
    kind: 'platform',
    metadata,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Agency side: create a support ticket. Admins and coordinators only —
 * caregivers are rejected server-side (and see no ticket UI).
 */
export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    subject: v.string(),
    description: v.string(),
    category: ticketCategory,
    priority: ticketPriority,
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, member } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator'],
    )
    const subject = args.subject.trim()
    const description = args.description.trim()
    if (!subject || subject.length > SUBJECT_MAX) {
      throw new ConvexError(
        `Subject is required and must be at most ${SUBJECT_MAX} characters.`,
      )
    }
    if (!description || description.length > DESCRIPTION_MAX) {
      throw new ConvexError(
        `Description is required and must be at most ${DESCRIPTION_MAX} characters.`,
      )
    }
    const now = new Date().toISOString()
    const ticketId = await ctx.db.insert('supportTickets', {
      tenantId,
      createdByUserId: identity.subject,
      createdByName: member.displayName,
      subject,
      description,
      category: args.category,
      priority: args.priority,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: identity.subject,
      actorRole: member.role,
      action: 'support_ticket_created',
      kind: 'tenant',
      metadata: { ticketId: ticketId as string },
      createdAt: now,
    })
    return ticketId
  },
})

/** Agency side: the caller's own tenant tickets, newest first. */
export const listMine = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])
    const tickets = await ctx.db
      .query('supportTickets')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    return tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
})

/** Platform side: all tickets, optionally filtered by status. */
export const listAll = query({
  args: { status: v.optional(ticketStatus) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const tickets = args.status
      ? await ctx.db
          .query('supportTickets')
          .withIndex('by_status', (q) => q.eq('status', args.status!))
          .collect()
      : await ctx.db.query('supportTickets').collect()
    const results = []
    for (const ticket of tickets) {
      const tenant = await ctx.db.get(ticket.tenantId)
      results.push({
        ...ticket,
        tenantName: tenant?.name ?? 'Unknown',
        tenantSlug: tenant?.slug ?? '',
      })
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
})

/**
 * Platform side: one ticket by id, unfiltered — keeps an open detail dialog
 * alive when a status change drops the ticket out of the active list filter.
 */
export const get = query({
  args: { ticketId: v.id('supportTickets') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) {
      return null
    }
    const tenant = await ctx.db.get(ticket.tenantId)
    return {
      ...ticket,
      tenantName: tenant?.name ?? 'Unknown',
      tenantSlug: tenant?.slug ?? '',
    }
  },
})

/** Platform side: move a ticket through its status lifecycle. */
export const setStatus = mutation({
  args: {
    ticketId: v.id('supportTickets'),
    status: ticketStatus,
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) {
      throw new ConvexError('Support ticket not found.')
    }
    // Same-status is a no-op (idempotent retries); anything else must be a
    // valid lifecycle transition — e.g. closed → open is rejected.
    if (args.status === ticket.status) {
      return args.ticketId
    }
    const allowed = ALLOWED_TRANSITIONS[ticket.status as TicketStatus]
    if (!allowed.includes(args.status)) {
      throw new ConvexError(
        `Invalid status transition: ${ticket.status} → ${args.status}.`,
      )
    }
    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: new Date().toISOString(),
    })
    await recordPlatformAudit(
      ctx,
      identity,
      ticket.tenantId,
      'support_ticket_status_updated',
      {
        ticketId: args.ticketId as string,
        from: ticket.status,
        to: args.status,
      },
    )
    return args.ticketId
  },
})

/** Platform side: append an internal note to a ticket. */
export const addNote = mutation({
  args: {
    ticketId: v.id('supportTickets'),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const ticket = await ctx.db.get(args.ticketId)
    if (!ticket) {
      throw new ConvexError('Support ticket not found.')
    }
    const note = args.note.trim()
    if (!note || note.length > NOTE_MAX) {
      throw new ConvexError(
        `Note is required and must be at most ${NOTE_MAX} characters.`,
      )
    }
    const platformNotes = ticket.platformNotes
      ? `${ticket.platformNotes}\n${note}`
      : note
    await ctx.db.patch(args.ticketId, {
      platformNotes,
      updatedAt: new Date().toISOString(),
    })
    await recordPlatformAudit(
      ctx,
      identity,
      ticket.tenantId,
      'support_ticket_note_added',
      { ticketId: args.ticketId as string },
    )
    return args.ticketId
  },
})
