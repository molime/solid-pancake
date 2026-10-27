import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import type { UserIdentity } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireIdentity, requireTenantRole } from './authHelpers'
import { categoryForAction } from './_utils/auditCategories'
import { notifyTenantStaff } from './_utils/notifications'
import { checkRateLimit } from './_utils/rateLimit'
import { clerkErrorMessage } from './_utils/invitationBypass'

// Email reassignment flow (client-requested): an employee registered with an
// email they no longer control. Agency admins/HR manage Clerk org membership
// but cannot change a user's LOGIN email (Clerk org admins hold no user
// credentials), so the flow is:
//
//   1. Agency admin/HR files a request here (`request`) — validated,
//      rate-limited, audited into the tenant trail, and surfaced to the
//      tenant's org:admins.
//   2. An ATRIA platform admin reviews the pending queue (`listPending`) and
//      either rejects it (`reject`) or executes it (`execute`).
//   3. `execute` performs the Clerk Backend API swap (create verified email →
//      set primary → delete old email) and then `markExecutedInternal`
//      updates the request, tenantMembers/employeeProfiles rows, audit trail,
//      and notifies the tenant's org:admins.
//
// Users who can still sign in are expected to self-serve via Clerk's
// UserProfile in /account — NO code is involved in that path.
//
// SECURITY NOTE: `execute` is the ONLY code path in this codebase that
// changes a user's login email. It is gated to platform admins, and the new
// email is always created verified because the agency vouches for the
// employee's control of it. Audit metadata intentionally never includes the
// OLD email on the request event (the swap events reference only the new
// email and ids) — the old email stays in the request row itself.

type EmailChangesCtx = QueryCtx | MutationCtx

async function requirePlatformAdmin(ctx: EmailChangesCtx) {
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

/**
 * Platform-admin guard for public actions. Mirrors requirePlatformAdmin, but
 * actions have no ctx.db, so the platformAdmins lookup goes through an
 * internal query (same pattern as platformStripe.ts).
 */
async function requirePlatformAdminAction(
  ctx: ActionCtx,
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  const isAdmin: boolean = await ctx.runQuery(
    internal.platformStripe.isPlatformAdminInternal,
    { clerkUserId: identity.subject },
  )
  if (!isAdmin) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

function requireClerkSecretKey(): string {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new ConvexError('Server configuration is missing CLERK_SECRET_KEY.')
  }
  return secretKey
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Agency admin/HR files an email reassignment request for a tenant member.
 * The request is validated, audited (`member.email_change_requested`), and
 * the tenant's org:admins are notified that ATRIA will execute the change.
 */
export const request = mutation({
  args: {
    clerkOrgId: v.string(),
    memberClerkUserId: v.string(),
    newEmail: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    // At most 5 email-change requests per minute per requester.
    if (!checkRateLimit(`emailReq:${identity.subject}`, 5, 60_000).allowed) {
      throw new ConvexError('Rate limit exceeded. Try again later.')
    }

    const newEmail = args.newEmail.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(newEmail)) {
      throw new ConvexError('Please enter a valid email address.')
    }
    const reason = args.reason.trim()
    if (!reason) {
      throw new ConvexError('A reason is required.')
    }

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.memberClerkUserId),
      )
      .unique()
    if (!member) {
      throw new ConvexError('That person is not a member of this agency.')
    }
    if (member.email.trim().toLowerCase() === newEmail) {
      throw new ConvexError('The new email is the same as the current email.')
    }

    const pending = await ctx.db
      .query('emailChangeRequests')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
    if (
      pending.some(
        (r) =>
          r.tenantId === tenantId &&
          r.memberClerkUserId === args.memberClerkUserId,
      )
    ) {
      throw new ConvexError(
        'An email change request is already pending for this member.',
      )
    }

    const requesterName = identity.name ?? identity.email ?? identity.subject
    const requestId = await ctx.db.insert('emailChangeRequests', {
      tenantId,
      memberClerkUserId: args.memberClerkUserId,
      memberName: member.displayName,
      oldEmail: member.email,
      newEmail,
      reason,
      status: 'pending',
      requestedBy: identity.subject,
      requesterName,
      createdAt: new Date().toISOString(),
    })

    // Tenant-visible audit. Metadata deliberately excludes the old email —
    // see the module security note.
    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'member.email_change_requested',
      kind: 'tenant',
      metadata: {
        memberClerkUserId: args.memberClerkUserId,
        newEmail,
        reason,
      },
    })

    await notifyTenantStaff(ctx, tenantId, ['org:admin'], {
      type: 'member.email_change_requested',
      subject: 'Email change requested',
      message: `${requesterName} requested an email change for ${member.displayName}. ATRIA will review the request and execute the change.`,
      metadata: {
        requestId: requestId as string,
        memberClerkUserId: args.memberClerkUserId,
        newEmail,
      },
    })

    return requestId
  },
})

/** org:admin/org:hr list their tenant's requests, newest first. */
export const listForTenant = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    return ctx.db
      .query('emailChangeRequests')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(100)
  },
})

/**
 * Platform admin lists all pending requests across tenants, joined with the
 * tenant name. `refreshKey` is ignored by the handler; the platform UI bumps
 * it after running the `execute` ACTION to force a reactive refetch (actions
 * do not invalidate queries the way mutations do).
 */
export const listPending = query({
  args: { refreshKey: v.optional(v.number()) },
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    const requests = await ctx.db
      .query('emailChangeRequests')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect()
    const sorted = requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    const withTenantNames = []
    for (const request of sorted) {
      const tenant = await ctx.db.get(request.tenantId)
      withTenantNames.push({ ...request, tenantName: tenant?.name ?? '—' })
    }
    return withTenantNames
  },
})

/** Platform admin rejects a pending request; the tenant is audited and its org:admins notified. */
export const reject = mutation({
  args: { requestId: v.id('emailChangeRequests') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    // At most 5 decisions per minute per platform admin.
    if (!checkRateLimit(`emailRej:${identity.subject}`, 5, 60_000).allowed) {
      throw new ConvexError('Rate limit exceeded. Try again later.')
    }

    const request = await ctx.db.get(args.requestId)
    if (!request) {
      throw new ConvexError('Email change request not found.')
    }
    if (request.status !== 'pending') {
      throw new ConvexError(
        `Cannot reject a request with status '${request.status}'.`,
      )
    }

    const now = new Date().toISOString()
    await ctx.db.patch(request._id, {
      status: 'rejected',
      executedBy: identity.subject,
      executedAt: now,
    })

    await ctx.db.insert('auditEvents', {
      tenantId: request.tenantId,
      actorId: identity.subject,
      actorRole: 'platform_admin',
      action: 'member.email_change_rejected',
      category: categoryForAction('member.email_change_rejected'),
      kind: 'platform',
      metadata: {
        requestId: request._id as string,
        memberClerkUserId: request.memberClerkUserId,
        newEmail: request.newEmail,
      },
      createdAt: now,
    })

    await notifyTenantStaff(ctx, request.tenantId, ['org:admin'], {
      type: 'member.email_change_rejected',
      subject: 'Email change request rejected',
      message: `The email change request for ${request.memberName} (${request.newEmail}) was rejected by ATRIA support.`,
      metadata: {
        requestId: request._id as string,
        memberClerkUserId: request.memberClerkUserId,
        newEmail: request.newEmail,
      },
    })

    return request._id
  },
})

/** Loads a request for the execute action (actions have no ctx.db). */
export const getRequestInternal = internalQuery({
  args: { requestId: v.id('emailChangeRequests') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.requestId)
  },
})

/**
 * Platform admin executes a pending request: swaps the member's login email
 * in Clerk (this is the ONLY code path that changes login emails — see the
 * module security note), then records the outcome in Convex via
 * markExecutedInternal. Clerk call sequence:
 *
 *   1. GET    /v1/users/{id}                     — capture the current
 *      primary email address id (must happen BEFORE the primary is switched)
 *   2. POST   /v1/users/{id}/email_addresses     — create the new email,
 *      pre-verified (the agency vouches for the employee). 422 = email taken.
 *   3. PATCH  /v1/users/{id}                     — set the new email primary
 *   4. DELETE /v1/users/{id}/email_addresses/{old} — best effort; a failure
 *      here only warns (the old address stays on the account, unlinked)
 */
export const execute = action({
  args: { requestId: v.id('emailChangeRequests') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdminAction(ctx)
    const secretKey = requireClerkSecretKey()

    const request: Doc<'emailChangeRequests'> | null = await ctx.runQuery(
      internal.emailChanges.getRequestInternal,
      {
        requestId: args.requestId,
      },
    )
    if (!request) {
      throw new ConvexError('Email change request not found.')
    }
    if (request.status !== 'pending') {
      throw new ConvexError(
        `Cannot execute a request with status '${request.status}'.`,
      )
    }

    const baseUrl = 'https://api.clerk.com/v1'
    const headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    }

    // 1. Capture the current primary email address id before switching.
    const userResponse = await fetch(`${baseUrl}/users/${request.memberClerkUserId}`, {
      headers,
    })
    if (!userResponse.ok) {
      const payload = await userResponse.json()
      throw new ConvexError(
        `Clerk request failed: could not load the user. ${clerkErrorMessage(payload)}`,
      )
    }
    const clerkUser = (await userResponse.json()) as {
      primary_email_address_id: string | null
      email_addresses: Array<{ id: string; email_address: string }>
    }
    const oldEmailId =
      clerkUser.primary_email_address_id ??
      clerkUser.email_addresses.find((e) => e.email_address === request.oldEmail)
        ?.id ??
      null

    // 2. Create the new (verified) email address. 422 = already taken.
    const createResponse = await fetch(
      `${baseUrl}/users/${request.memberClerkUserId}/email_addresses`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email_address: request.newEmail,
          verified: true,
        }),
      },
    )
    if (createResponse.status === 422) {
      const payload = await createResponse.json()
      throw new ConvexError(
        `That email address cannot be used (${clerkErrorMessage(payload)}). Ask the agency for a different email.`,
      )
    }
    if (!createResponse.ok) {
      const payload = await createResponse.json()
      throw new ConvexError(clerkErrorMessage(payload))
    }
    const createdEmail = (await createResponse.json()) as { id: string }

    // 3. Make the new email the primary login.
    const patchResponse = await fetch(
      `${baseUrl}/users/${request.memberClerkUserId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          primary_email_address_id: createdEmail.id,
        }),
      },
    )
    if (!patchResponse.ok) {
      const payload = await patchResponse.json()
      throw new ConvexError(
        `Clerk request failed while setting the primary email. ${clerkErrorMessage(payload)}`,
      )
    }

    // 4. Remove the old address. Best effort: the swap is already complete,
    // so a failure here must not roll anything back — only warn.
    if (oldEmailId && oldEmailId !== createdEmail.id) {
      const deleteResponse = await fetch(
        `${baseUrl}/users/${request.memberClerkUserId}/email_addresses/${oldEmailId}`,
        { method: 'DELETE', headers },
      )
      if (!deleteResponse.ok) {
        console.warn(
          `Could not delete old email address ${oldEmailId} for Clerk user ${request.memberClerkUserId} (status ${deleteResponse.status}). The old address remains on the account.`,
        )
      }
    }

    const executedId: Id<'emailChangeRequests'> = await ctx.runMutation(
      internal.emailChanges.markExecutedInternal,
      {
        requestId: request._id,
        executedBy: identity.subject,
      },
    )

    return executedId
  },
})

/**
 * Records the executed swap in Convex: patches the request and the member's
 * tenantMembers/employeeProfiles rows, writes the tenant-visible
 * `member.email_changed` audit event, and notifies the tenant's org:admins.
 * Called only from the execute action after the Clerk calls succeeded.
 */
export const markExecutedInternal = internalMutation({
  args: {
    requestId: v.id('emailChangeRequests'),
    executedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    if (!request) {
      throw new ConvexError('Email change request not found.')
    }
    if (request.status !== 'pending') {
      throw new ConvexError(
        `Cannot execute a request with status '${request.status}'.`,
      )
    }

    const now = new Date().toISOString()
    await ctx.db.patch(request._id, {
      status: 'executed',
      executedBy: args.executedBy,
      executedAt: now,
    })

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', request.tenantId).eq('clerkUserId', request.memberClerkUserId),
      )
      .unique()
    if (member) {
      await ctx.db.patch(member._id, { email: request.newEmail })
    }

    const profile = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', request.tenantId).eq('clerkUserId', request.memberClerkUserId),
      )
      .first()
    if (profile) {
      await ctx.db.patch(profile._id, { email: request.newEmail })
    }

    await ctx.db.insert('auditEvents', {
      tenantId: request.tenantId,
      actorId: args.executedBy,
      actorRole: 'platform_admin',
      action: 'member.email_changed',
      category: categoryForAction('member.email_changed'),
      kind: 'platform',
      metadata: {
        memberClerkUserId: request.memberClerkUserId,
        newEmail: request.newEmail,
        requestId: request._id as string,
      },
      createdAt: now,
    })

    await notifyTenantStaff(ctx, request.tenantId, ['org:admin'], {
      type: 'member.email_changed',
      subject: 'Email change complete',
      message: `The email change for ${request.memberName} is complete. They should sign in with their new email address (${request.newEmail}).`,
      metadata: {
        requestId: request._id as string,
        memberClerkUserId: request.memberClerkUserId,
        newEmail: request.newEmail,
      },
    })

    return request._id
  },
})
