import {
  internalMutation,
  mutation,
  query,
} from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import {
  requireIdentity,
  requireTenantRole,
  assertTenantDoc,
} from './authHelpers'
import { categoryForAction } from './_utils/auditCategories'
import { notifyStaff, notifyTenantStaff } from './_utils/notifications'
import { checkRateLimit } from './_utils/rateLimit'

type SupportCtx = QueryCtx | MutationCtx

// Support access approval flow (compliance mini-phase, Stage 3): a platform
// admin's support session becomes an owner-approved, expiring, fully audited
// grant. IMPORTANT: the grant is an authorization/traceability record, not a
// permission object — actual dashboard access is the platform admin's
// existing platform role, which nothing here gates. Approval therefore
// activates the grant immediately (status 'active'); there is no separate
// permission to flip. Expiry is enforced by the hourly expireDueGrants cron.

async function requirePlatformAdmin(ctx: SupportCtx) {
  const identity = await requireIdentity(ctx)
  const existing = await ctx.db
    .query('platformAdmins')
    .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', identity.subject))
    .unique()
  if (!existing) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

/** Display name for a platform admin identity (fall back to id/email). */
function requesterNameFor(identity: {
  name?: string
  email?: string
  subject: string
}) {
  return identity.name ?? identity.email ?? identity.subject
}

async function insertAudit(
  ctx: MutationCtx,
  args: {
    tenantId: Id<'tenants'>
    actorId: string
    actorRole: string
    kind: 'platform' | 'tenant'
    action: string
    metadata?: Record<string, unknown>
  },
) {
  await ctx.db.insert('auditEvents', {
    tenantId: args.tenantId,
    actorId: args.actorId,
    actorRole: args.actorRole,
    action: args.action,
    category: categoryForAction(args.action),
    kind: args.kind,
    metadata: args.metadata,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Shared request logic, also called directly from platform.ts's
 * requestSupportAccess wrapper (plain function import — avoids the circular
 * api-type reference a ctx.runMutation(api...) delegation would create).
 * Creates a pending grant, writes the (existing) `support_access_requested`
 * audit event, and asks the tenant's org:admins to approve or reject.
 */
export async function createSupportAccessRequest(
  ctx: MutationCtx,
  identity: { subject: string; name?: string; email?: string },
  args: { tenantId: Id<'tenants'>; reason: string; durationMinutes: number },
) {
  const tenant = await ctx.db.get(args.tenantId)
  if (!tenant) {
    throw new ConvexError('Tenant not found.')
  }

  const now = new Date().toISOString()
  const requesterName = requesterNameFor(identity)
  const grantId = await ctx.db.insert('supportAccessGrants', {
    tenantId: args.tenantId,
    requestedBy: identity.subject,
    requesterName,
    reason: args.reason,
    durationMinutes: args.durationMinutes,
    status: 'pending',
    createdAt: now,
  })

  await insertAudit(ctx, {
    tenantId: args.tenantId,
    actorId: identity.subject,
    actorRole: 'platform_admin',
    kind: 'platform',
    action: 'support_access_requested',
    metadata: {
      reason: args.reason,
      durationMinutes: args.durationMinutes,
      grantId: grantId as string,
    },
  })

  await notifyTenantStaff(ctx, args.tenantId, ['org:admin'], {
    type: 'support_access_requested',
    subject: 'Support access approval requested',
    message: `${requesterName} (ATRIA platform) requests support access: "${args.reason}" for ${args.durationMinutes} minutes. Approve or reject from the Admin Dashboard.`,
    metadata: {
      grantId: grantId as string,
      reason: args.reason,
      durationMinutes: args.durationMinutes,
      requestedBy: identity.subject,
    },
  })

  return grantId
}

/**
 * Platform admin requests support access for a tenant. Delegated to by
 * platform.requestSupportAccess, which keeps the public api path stable.
 */
export const request = mutation({
  args: {
    tenantId: v.id('tenants'),
    reason: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    // Stage 5 (rate limiting): at most 5 support-access requests per minute
    // per platform admin.
    if (!checkRateLimit(`supportReq:${identity.subject}`, 5, 60_000).allowed) {
      throw new ConvexError('Rate limit exceeded. Try again later.')
    }
    return createSupportAccessRequest(ctx, identity, args)
  },
})

/** org:admin approves a pending grant for their own tenant. */
export const approve = mutation({
  args: {
    clerkOrgId: v.string(),
    grantId: v.id('supportAccessGrants'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin'],
    )

    const grant = await ctx.db.get(args.grantId)
    if (!grant) {
      throw new ConvexError('Support access grant not found.')
    }
    assertTenantDoc(grant, tenantId)
    if (grant.status !== 'pending') {
      throw new ConvexError(
        `Cannot approve a grant with status '${grant.status}'.`,
      )
    }

    const now = new Date().toISOString()
    // Approval activates immediately: the grant is an audited authorization
    // record; actual access is the platform admin's dashboard access (see
    // module comment), so there is no intermediate 'approved' waiting state.
    await ctx.db.patch(grant._id, {
      status: 'active',
      approvedBy: identity.subject,
      decidedAt: now,
      startedAt: now,
    })

    await insertAudit(ctx, {
      tenantId,
      actorId: identity.subject,
      actorRole: role,
      kind: 'tenant',
      action: 'support_access_approved',
      metadata: {
        grantId: grant._id as string,
        reason: grant.reason,
        durationMinutes: grant.durationMinutes,
        approvedBy: identity.subject,
      },
    })

    await notifyRequesterOfDecision(ctx, grant, 'approved')

    return grant._id
  },
})

/** org:admin rejects a pending grant for their own tenant. */
export const reject = mutation({
  args: {
    clerkOrgId: v.string(),
    grantId: v.id('supportAccessGrants'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin'],
    )

    const grant = await ctx.db.get(args.grantId)
    if (!grant) {
      throw new ConvexError('Support access grant not found.')
    }
    assertTenantDoc(grant, tenantId)
    if (grant.status !== 'pending') {
      throw new ConvexError(
        `Cannot reject a grant with status '${grant.status}'.`,
      )
    }

    const now = new Date().toISOString()
    await ctx.db.patch(grant._id, {
      status: 'rejected',
      approvedBy: identity.subject,
      decidedAt: now,
    })

    await insertAudit(ctx, {
      tenantId,
      actorId: identity.subject,
      actorRole: role,
      kind: 'tenant',
      action: 'support_access_rejected',
      metadata: {
        grantId: grant._id as string,
        reason: grant.reason,
        durationMinutes: grant.durationMinutes,
        approvedBy: identity.subject,
      },
    })

    await notifyRequesterOfDecision(ctx, grant, 'rejected')

    return grant._id
  },
})

// Notifies the requesting platform admin of an approve/reject decision. The
// in-app notification row always lands in the tenant's notifications table;
// email only resolves when the requester also has a member/profile row in
// this tenant (platform admins usually do not), in which case it is skipped.
async function notifyRequesterOfDecision(
  ctx: MutationCtx,
  grant: {
    _id: Id<'supportAccessGrants'>
    tenantId: Id<'tenants'>
    requestedBy: string
    reason: string
    durationMinutes: number
  },
  decision: 'approved' | 'rejected',
) {
  await notifyStaff(ctx, {
    tenantId: grant.tenantId,
    clerkUserId: grant.requestedBy,
    type: `support_access_${decision}`,
    subject: `Support access ${decision}`,
    message: `Your support access request ("${grant.reason}", ${grant.durationMinutes} min) was ${decision} by the agency owner.`,
    metadata: {
      grantId: grant._id as string,
      reason: grant.reason,
      durationMinutes: grant.durationMinutes,
      decision,
    },
  })
}

/** Platform admin ends an active (or approved) grant, e.g. after a session. */
export const end = mutation({
  args: { grantId: v.id('supportAccessGrants') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const grant = await ctx.db.get(args.grantId)
    if (!grant) {
      throw new ConvexError('Support access grant not found.')
    }
    return endGrant(ctx, identity, grant)
  },
})

async function endGrant(
  ctx: MutationCtx,
  identity: { subject: string },
  grant: {
    _id: Id<'supportAccessGrants'>
    tenantId: Id<'tenants'>
    status: string
  },
) {
  if (grant.status !== 'active' && grant.status !== 'approved') {
    throw new ConvexError(
      `Cannot end a grant with status '${grant.status}'.`,
    )
  }

  const now = new Date().toISOString()
  await ctx.db.patch(grant._id, { status: 'ended', endedAt: now })

  await insertAudit(ctx, {
    tenantId: grant.tenantId,
    actorId: identity.subject,
    actorRole: 'platform_admin',
    kind: 'platform',
    action: 'support_access_ended',
    metadata: { grantId: grant._id as string },
  })

  return grant._id
}

/**
 * Ends the tenant's most recent active/approved grant. Shared by
 * endLatestForTenant and platform.ts's endSupportAccess wrapper (plain
 * function import — see createSupportAccessRequest). Throws when there is no
 * active grant to end.
 */
export async function endLatestActiveGrant(
  ctx: MutationCtx,
  identity: { subject: string },
  tenantId: Id<'tenants'>,
) {
  const tenant = await ctx.db.get(tenantId)
  if (!tenant) {
    throw new ConvexError('Tenant not found.')
  }

  const grants = await ctx.db
    .query('supportAccessGrants')
    .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
    .order('desc')
    .take(50)
  const latest = grants.find(
    (g) => g.status === 'active' || g.status === 'approved',
  )
  if (!latest) {
    throw new ConvexError('No active support access grant for this tenant.')
  }

  return endGrant(ctx, identity, latest)
}

/**
 * Platform admin ends the tenant's most recent active/approved grant.
 * Delegated to by platform.endSupportAccess to keep the public api path
 * stable; throws when there is no active grant to end.
 */
export const endLatestForTenant = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    return endLatestActiveGrant(ctx, identity, args.tenantId)
  },
})

/**
 * Hourly cron: grants whose duration has elapsed since they started become
 * 'expired' (audited, tenant-visible). Runs inside the same transaction per
 * grant so a failure leaves earlier expirations intact.
 */
export const expireDueGrants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const active = await ctx.db
      .query('supportAccessGrants')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
    // 'approved' is a legacy/possible state too (see module comment); expire
    // any started grant regardless of which of the two labels it carries.
    const approved = await ctx.db
      .query('supportAccessGrants')
      .withIndex('by_status', (q) => q.eq('status', 'approved'))
      .collect()

    let expired = 0
    for (const grant of [...active, ...approved]) {
      const startedAt = grant.startedAt ? Date.parse(grant.startedAt) : NaN
      if (!Number.isFinite(startedAt)) continue
      if (now - startedAt < grant.durationMinutes * 60 * 1000) continue

      const nowIso = new Date(now).toISOString()
      await ctx.db.patch(grant._id, { status: 'expired', endedAt: nowIso })
      await ctx.db.insert('auditEvents', {
        tenantId: grant.tenantId,
        actorId: 'system',
        actorRole: 'system',
        action: 'support_access_expired',
        category: categoryForAction('support_access_expired'),
        kind: 'platform',
        metadata: {
          grantId: grant._id as string,
          durationMinutes: grant.durationMinutes,
        },
        createdAt: nowIso,
      })
      expired += 1
    }

    return expired
  },
})

/** org:admin lists their tenant's grants, newest first, optional status filter. */
export const listForTenant = query({
  args: {
    clerkOrgId: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const grants = await ctx.db
      .query('supportAccessGrants')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(100)
    return args.status
      ? grants.filter((g) => g.status === args.status)
      : grants
  },
})

/** org:admin lists pending grants awaiting their decision. */
export const listPendingForTenant = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])
    const grants = await ctx.db
      .query('supportAccessGrants')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(100)
    return grants.filter((g) => g.status === 'pending')
  },
})

/** Platform admin lists recent grants across tenants (newest first). */
export const listForPlatform = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    const grants = await ctx.db.query('supportAccessGrants').collect()
    return grants.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },
})
