import { v } from 'convex/values'
import {
  action,
  internalMutation,
  query,
  type MutationCtx,
} from './_generated/server'
import { internal, api } from './_generated/api'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import type { Doc, Id } from './_generated/dataModel'
import { normalizeEmail } from './adpSync'
import { sendClerkInvitation } from './invitations'

export async function ensureCaregiverEmployeeProfile(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  member: Doc<'tenantMembers'>,
) {
  if (member.role !== 'org:caregiver') return null

  const existingByClerkUserId = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
    )
    .unique()

  if (existingByClerkUserId) {
    if (!existingByClerkUserId.tenantMemberId) {
      await ctx.db.patch(existingByClerkUserId._id, { tenantMemberId: member._id })
    }
    return existingByClerkUserId._id
  }

  const normalizedEmail = normalizeEmail(member.email)
  const existingByEmail = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .filter((q) => q.eq(q.field('email'), normalizedEmail))
    .unique()

  if (existingByEmail) {
    if (
      existingByEmail.clerkUserId &&
      existingByEmail.clerkUserId !== member.clerkUserId
    ) {
      return existingByEmail._id
    }

    await ctx.db.patch(existingByEmail._id, {
      clerkUserId: member.clerkUserId,
      tenantMemberId: member._id,
      displayName: member.displayName,
      email: normalizedEmail,
    })
    return existingByEmail._id
  }

  return ctx.db.insert('employeeProfiles', {
    tenantId,
    clerkUserId: member.clerkUserId,
    tenantMemberId: member._id,
    displayName: member.displayName,
    email: member.email,
    adpSyncStatus: 'queued',
    createdAt: new Date().toISOString(),
  })
}

export const createCaregiverProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    displayName: v.string(),
    email: v.string(),
    adpSyncStatus: v.optional(v.union(
      v.literal('pending_credentials'),
      v.literal('queued'),
    )),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email)
    const trimmedName = args.displayName.trim()
    const initialStatus = args.adpSyncStatus ?? 'queued'

    const existing = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .filter((q) => q.eq(q.field('email'), normalizedEmail))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: trimmedName,
        email: normalizedEmail,
      })
      if (initialStatus === 'queued') {
        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
          employeeProfileId: existing._id,
        })
      }
      return existing._id
    }

    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId: args.tenantId,
      displayName: trimmedName,
      email: normalizedEmail,
      adpSyncStatus: initialStatus,
      createdAt: new Date().toISOString(),
    })

    if (initialStatus === 'queued') {
      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
        employeeProfileId: profileId,
      })
    }

    return profileId
  },
})

export const deleteCaregiverProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    employeeProfileId: v.id('employeeProfiles'),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) return
    assertTenantDoc(profile, args.tenantId)
    await ctx.db.delete(args.employeeProfileId)
  },
})

export const createCaregiver = action({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    appBaseUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    profileId: Id<'employeeProfiles'>
    invitationId: string
    emailAddress: string
    role: string
    status: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can create caregivers.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
    }

    const adpConfigured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId: tenant._id },
    )

    const profileId: Id<'employeeProfiles'> = await ctx.runMutation(
      internal.employeeProfiles.createCaregiverProfile,
      {
        tenantId: tenant._id,
        displayName: args.displayName,
        email: args.email,
        adpSyncStatus: adpConfigured ? 'queued' : 'pending_credentials',
      },
    )

    let invitation
    try {
      invitation = await sendClerkInvitation({
        secretKey,
        inviterUserId: identity.subject,
        clerkOrgId: args.clerkOrgId,
        emailAddress: args.email,
        role: 'org:caregiver',
        appBaseUrl: args.appBaseUrl,
      })
    } catch (err) {
      // Avoid leaving an orphaned employee profile / queued ADP worker for a
      // caregiver who was never invited.
      await ctx.runMutation(internal.employeeProfiles.deleteCaregiverProfile, {
        tenantId: tenant._id,
        employeeProfileId: profileId,
      })
      throw err
    }

    return {
      profileId,
      invitationId: invitation.id,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: invitation.status,
    }
  },
})

export const listEmployeeProfiles = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const memberById = new Map(members.map((m) => [m._id, m]))

    return profiles.map((profile) => {
      const member = profile.tenantMemberId
        ? memberById.get(profile.tenantMemberId)
        : undefined
      return {
        _id: profile._id,
        displayName: profile.displayName,
        email: profile.email,
        role: member?.role ?? 'org:caregiver',
        adpSyncStatus: profile.adpSyncStatus,
      }
    })
  },
})

export const runAdpInitialWorkerLoad = action({
  args: { clerkOrgId: v.string() },
  handler: async (
    ctx,
    { clerkOrgId },
  ): Promise<{
    status: string
    processed: number
    matched: number
    created: number
    errors: number
    error?: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, { clerkOrgId })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can run ADP load.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, { clerkOrgId })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const result: {
      status: string
      processed?: number
      matched?: number
      created?: number
      errors?: number
      error?: string
    } = await ctx.runAction(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId: tenant._id,
    })

    return {
      status: result.status,
      processed: result.processed ?? 0,
      matched: result.matched ?? 0,
      created: result.created ?? 0,
      errors: result.errors ?? 0,
      error: result.error,
    }
  },
})
