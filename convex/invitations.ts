import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { api } from './_generated/api'

declare const process: { env: Record<string, string | undefined> }

const roleValidator = v.union(
  v.literal('org:admin'),
  v.literal('org:coordinator'),
  v.literal('org:caregiver'),
)

type InviteRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

function toClerkRole(role: InviteRole) {
  return role === 'org:admin' ? 'org:admin' : 'org:member'
}

function invitationRedirectUrl(appBaseUrl: string) {
  const url = new URL(appBaseUrl)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new ConvexError('Invitation redirect URL must use HTTPS.')
  }
  return `${url.origin}/accept-invitation`
}

function clerkErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    Array.isArray((payload as { errors: unknown[] }).errors)
  ) {
    const first = (payload as { errors: Array<Record<string, unknown>> })
      .errors[0]
    const message = first?.long_message ?? first?.message
    if (typeof message === 'string') return message
  }
  return 'Clerk invitation request failed.'
}

function normalizeCreatedAt(value: unknown) {
  if (typeof value === 'number') {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString()
  }
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date().toISOString()
}

export const create = action({
  args: {
    clerkOrgId: v.string(),
    emailAddress: v.string(),
    role: roleValidator,
    appBaseUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (member?.role !== 'org:admin') {
      throw new ConvexError('Forbidden: only agency admins can invite users.')
    }

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new ConvexError(
        'Server invitation configuration is missing CLERK_SECRET_KEY.',
      )
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviter_user_id: identity.subject,
          email_address: args.emailAddress.trim(),
          role: toClerkRole(args.role),
          redirect_url: invitationRedirectUrl(args.appBaseUrl),
          public_metadata: { atriaRole: args.role },
        }),
      },
    )

    const payload = await response.json()
    if (!response.ok) {
      throw new ConvexError(clerkErrorMessage(payload))
    }

    const record = payload as Record<string, unknown>
    return {
      id: String(record.id ?? ''),
      emailAddress: String(record.email_address ?? args.emailAddress),
      role: String(record.role ?? toClerkRole(args.role)),
      roleName: String(record.role_name ?? toClerkRole(args.role)),
      status: String(record.status ?? 'pending'),
      createdAt: normalizeCreatedAt(record.created_at),
    }
  },
})
