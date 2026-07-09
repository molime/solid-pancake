import { v } from 'convex/values'
import {
  query,
  mutation,
  action,
  internalMutation,
  internalAction,
  type MutationCtx,
  type ActionCtx,
} from './_generated/server'
import { api, internal } from './_generated/api'
import { ConvexError } from 'convex/values'
import {
  requireTenantRole,
  requireTenantRoleAction,
  assertTenantDoc,
  type AuthContext,
} from './authHelpers'
import { sendClerkInvitation, isAllowListError } from './invitations'
import {
  isDevInvitationBypassEnabled,
  createClerkUserAndJoinOrg,
  generateClerkSignInTicket,
} from './_utils/invitationBypass'
import { normalizeEmail } from './adpSync'
import { requireEnv } from './_utils/env'
import type { Id } from './_generated/dataModel'

declare const process: { env: Record<string, string | undefined> }

type CandidateStatus =
  | 'invited'
  | 'applied'
  | 'hr_review'
  | 'rejected'
  | 'offer_sent'
  | 'accepted'
  | 'hired'
  | 'withdrawn'

const CANDIDATE_TASK_TYPES = [
  'form_submission',
  'photo_id',
  'cpr_certificate',
  'background_check',
  'employment_agreement',
] as const

const TERMINAL_STATUSES: CandidateStatus[] = ['hired', 'withdrawn']

function normalizeCandidateEmail(email: string) {
  return normalizeEmail(email)
}

async function getOwnCandidate(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  identity: { subject: string; email?: string },
) {
  const byClerkUser = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
    )
    .unique()
  if (byClerkUser) return byClerkUser

  if (identity.email) {
    const email = identity.email
    return ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizeCandidateEmail(email)),
      )
      .unique()
  }
  return null
}

async function getLatestApplication(
  ctx: AuthContext,
  candidateId: Id<'candidates'>,
) {
  return ctx.db
    .query('applications')
    .withIndex('by_candidate_submittedAt', (q) =>
      q.eq('candidateId', candidateId),
    )
    .order('desc')
    .first()
}

async function completeCandidateTask(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  candidateId: Id<'candidates'>,
  type: string,
) {
  const task = await ctx.db
    .query('candidateTasks')
    .withIndex('by_tenant_candidate_status', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('status', 'pending'),
    )
    .filter((q) => q.eq(q.field('type'), type))
    .first()
  if (task) {
    await ctx.db.patch(task._id, {
      status: 'complete',
      completedAt: new Date().toISOString(),
    })
  }
  return task
}

async function recordCandidateAudit(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    action: string
    kind?: string
    previousStatus?: string
    nextStatus?: string
    metadata?: Record<string, unknown>
  },
) {
  return ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: args.action,
    kind: args.kind,
    previousStatus: args.previousStatus,
    nextStatus: args.nextStatus,
    metadata: args.metadata,
  })
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
  return 'Clerk request failed.'
}

function toClerkRole(role: string) {
  return role === 'org:admin' ? 'org:admin' : 'org:member'
}

export const updateClerkMembershipRole = internalAction({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.string(),
  },
  handler: async (_ctx: ActionCtx, args) => {
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new ConvexError('Server configuration is missing CLERK_SECRET_KEY.')
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/memberships/${args.clerkUserId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: toClerkRole(args.role),
          public_metadata: { atriaRole: args.role },
        }),
      },
    )

    if (!response.ok) {
      const payload = await response.json()
      throw new ConvexError(clerkErrorMessage(payload))
    }

    return { updated: true }
  },
})

export const getCandidateProfile = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])
    return getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
  },
})

export const getMyApplication = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])
    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }
    const application = await getLatestApplication(ctx, candidate._id)
    const tasks = await ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id),
      )
      .order('asc')
      .collect()
    return { candidate, application, tasks }
  },
})

export const listCandidates = query({
  args: { clerkOrgId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, { clerkOrgId, status }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    let candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()

    if (status !== undefined) {
      candidates = candidates.filter((c) => c.status === status)
    }

    return candidates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  },
})

export const getCandidateDetail = query({
  args: { clerkOrgId: v.string(), candidateId: v.id('candidates') },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const applications = await ctx.db
      .query('applications')
      .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
      .collect()

    const tasks = await ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId),
      )
      .order('asc')
      .collect()

    const documents = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_subject', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('subjectType', 'candidate')
          .eq('subjectId', candidateId as string),
      )
      .collect()

    return { candidate, applications, tasks, documents }
  },
})

export const listCandidateTasks = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])
    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    return ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id),
      )
      .order('asc')
      .collect()
  },
})

export const listCandidateTasksForHR = query({
  args: { clerkOrgId: v.string(), candidateId: v.id('candidates') },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    return ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId),
      )
      .order('asc')
      .collect()
  },
})

export const inviteCandidate = action({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    devBypassEnabled: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    candidateId: Id<'candidates'>
    invitationId: string
    manualPassword?: string
    magicLink?: string
  }> => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    const appBaseUrl = requireEnv('APP_URL')

    const result = await ctx.runMutation(internal.candidates.insertInvitedCandidate, {
      clerkOrgId: args.clerkOrgId,
      displayName: args.displayName,
      email: args.email,
      phone: args.phone,
    })

    if (result.invitationId) {
      return {
        candidateId: result.candidateId,
        invitationId: result.invitationId,
      }
    }

    const admin = await ctx.runQuery(api.members.firstOrgAdmin, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!admin) {
      throw new ConvexError(
        'No organization admin available to send Clerk invitation.',
      )
    }

    let invitation
    try {
      invitation = await sendClerkInvitation({
        secretKey,
        inviterUserId: admin.clerkUserId,
        clerkOrgId: args.clerkOrgId,
        emailAddress: args.email,
        role: 'org:candidate',
        appBaseUrl,
      })
    } catch (err) {
      if (isDevInvitationBypassEnabled({ appBaseUrl, devBypassEnabled: args.devBypassEnabled }) && isAllowListError(err)) {
        try {
          const bypass = await createClerkUserAndJoinOrg({
            secretKey,
            clerkOrgId: args.clerkOrgId,
            emailAddress: args.email,
            displayName: args.displayName,
            role: 'org:candidate',
            appBaseUrl,
          })

          await ctx.runMutation(internal.candidates.patchCandidateClerkUser, {
            clerkOrgId: args.clerkOrgId,
            candidateId: result.candidateId,
            clerkUserId: bypass.clerkUserId,
            invitationId: bypass.invitationId,
          })

          await ctx.runMutation(internal.members.createBypassMember, {
            clerkOrgId: args.clerkOrgId,
            clerkUserId: bypass.clerkUserId,
            role: 'org:candidate',
            displayName: args.displayName,
            email: args.email,
          })

          return {
            candidateId: result.candidateId,
            invitationId: bypass.invitationId,
            manualPassword: bypass.manualPassword,
            magicLink: bypass.magicLink,
          }
        } catch (bypassErr) {
          const bypassMessage =
            bypassErr instanceof Error ? bypassErr.message : 'Dev bypass failed.'
          await ctx.runMutation(internal.candidates.patchCandidateInvitationError, {
            clerkOrgId: args.clerkOrgId,
            candidateId: result.candidateId,
            invitationError: bypassMessage,
          })
          throw new ConvexError(
            `Dev invitation bypass failed for ${args.email}: ${bypassMessage}`,
          )
        }
      }

      await ctx.runMutation(internal.candidates.patchCandidateInvitationError, {
        clerkOrgId: args.clerkOrgId,
        candidateId: result.candidateId,
        invitationError:
          err instanceof Error ? err.message : 'Invitation request failed.',
      })
      throw err
    }

    await ctx.runMutation(internal.candidates.patchCandidateInvitationId, {
      candidateId: result.candidateId,
      invitationId: invitation.id,
    })

    return {
      candidateId: result.candidateId,
      invitationId: invitation.id,
    }
  },
})

export const insertInvitedCandidate = internalMutation({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    devBypassEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const normalizedEmail = normalizeCandidateEmail(args.email)

    const existing = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizedEmail),
      )
      .unique()

    // Idempotent: a candidate already linked to a Clerk invitation is returned as-is.
    if (existing?.invitationId) {
      return {
        candidateId: existing._id,
        invitationId: existing.invitationId,
        isNew: false,
      }
    }

    // Block any active, non-withdrawn, non-incomplete-invite row.
    if (
      existing &&
      existing.status !== 'withdrawn' &&
      !(existing.status === 'invited' && !existing.invitationId)
    ) {
      throw new ConvexError('An active candidate with this email already exists.')
    }

    let candidateId: Id<'candidates'>
    let isNew: boolean

    if (existing) {
      // Re-use the withdrawn or incomplete invited row; refresh details and reset tasks.
      await ctx.db.patch(existing._id, {
        email: normalizedEmail,
        displayName: args.displayName,
        phone: args.phone,
        status: 'invited',
        source: 'clerk_invite',
      })
      candidateId = existing._id
      isNew = false

      const oldTasks = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      await Promise.all(oldTasks.map((task) => ctx.db.delete(task._id)))
    } else {
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        email: normalizedEmail,
        displayName: args.displayName,
        phone: args.phone,
        status: 'invited',
        source: 'clerk_invite',
        createdAt: new Date().toISOString(),
      })
      isNew = true
    }

    await Promise.all(
      CANDIDATE_TASK_TYPES.map((type, index) =>
        ctx.db.insert('candidateTasks', {
          tenantId,
          candidateId,
          type,
          status: 'pending',
          order: index,
        }),
      ),
    )

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.invited',
      previousStatus: existing?.status,
      nextStatus: 'invited',
      metadata: { candidateId: candidateId as string },
    })

    return { candidateId, isNew }
  },
})

export const patchCandidateInvitationId = internalMutation({
  args: {
    candidateId: v.id('candidates'),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    await ctx.db.patch(args.candidateId, { invitationId: args.invitationId })
    return args.candidateId
  },
})

export const patchCandidateInvitationError = internalMutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    invitationError: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }

    const tenant = await ctx.db.get(candidate.tenantId)
    if (!tenant || tenant.clerkOrgId !== args.clerkOrgId) {
      throw new ConvexError('Forbidden: cross-tenant access denied.')
    }

    await ctx.db.patch(args.candidateId, {
      invitationFailed: true,
      invitationError: args.invitationError,
    })
    return args.candidateId
  },
})

export const patchCandidateClerkUser = internalMutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    clerkUserId: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }

    const tenant = await ctx.db.get(candidate.tenantId)
    if (!tenant || tenant.clerkOrgId !== args.clerkOrgId) {
      throw new ConvexError('Forbidden: cross-tenant access denied.')
    }

    await ctx.db.patch(args.candidateId, {
      clerkUserId: args.clerkUserId,
      invitationId: args.invitationId,
      invitationFailed: undefined,
      invitationError: undefined,
    })
    return args.candidateId
  },
})

export const regenerateBypassSignInTicket = action({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, args): Promise<{ magicLink: string }> => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, ['org:admin', 'org:hr'])

    if (!isDevInvitationBypassEnabled()) {
      throw new ConvexError('Dev invitation bypass is not enabled.')
    }

    const detail = await ctx.runQuery(api.candidates.getCandidateDetail, {
      clerkOrgId: args.clerkOrgId,
      candidateId: args.candidateId,
    })
    if (!detail?.candidate) {
      throw new ConvexError('Candidate not found.')
    }

    const candidate = detail.candidate
    if (!candidate.clerkUserId || !candidate.invitationId?.startsWith('bypass:')) {
      throw new ConvexError('Candidate was not created via dev bypass.')
    }

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    const appBaseUrl = requireEnv('APP_URL')

    const ticket = await generateClerkSignInTicket({
      secretKey,
      clerkUserId: candidate.clerkUserId,
    })

    const url = new URL(appBaseUrl)
    return {
      magicLink: `${url.origin}/sign-in?__clerk_ticket=${ticket}`,
    }
  },
})

export const submitApplication = mutation({
  args: { clerkOrgId: v.string(), fields: v.any() },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    if (TERMINAL_STATUSES.includes(candidate.status as CandidateStatus)) {
      throw new ConvexError('Cannot submit application for a terminal candidate.')
    }

    const latest = await getLatestApplication(ctx, candidate._id)
    const now = new Date().toISOString()

    if (latest && latest.status !== 'hired') {
      await ctx.db.patch(latest._id, {
        fields: args.fields,
        status: 'submitted',
        submittedAt: now,
      })
    } else {
      await ctx.db.insert('applications', {
        tenantId,
        candidateId: candidate._id,
        status: 'submitted',
        fields: args.fields,
        submittedAt: now,
      })
    }

    await ctx.db.patch(candidate._id, { status: 'applied' })
    await completeCandidateTask(ctx, tenantId, candidate._id, 'form_submission')

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.application.submitted',
      previousStatus: candidate.status,
      nextStatus: 'applied',
      metadata: { candidateId: candidate._id as string },
    })

    return candidate._id
  },
})

export const reviewApplication = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    decision: v.union(
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('needs_correction'),
    ),
    hrNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const allowedStatuses = ['applied', 'hr_review', 'application_draft']
    if (!allowedStatuses.includes(candidate.status)) {
      throw new ConvexError(
        'Candidate must be in applied, hr_review, or application_draft status.',
      )
    }

    if (args.decision === 'needs_correction') {
      const notes = args.hrNotes?.trim() ?? ''
      if (!notes) {
        throw new ConvexError('HR notes are required when requesting a correction.')
      }
    }

    const latest = await getLatestApplication(ctx, candidate._id)
    if (!latest) {
      throw new ConvexError('No application found for candidate.')
    }

    const now = new Date().toISOString()
    const nextStatus =
      args.decision === 'approved'
        ? 'hr_review'
        : args.decision === 'rejected'
          ? 'rejected'
          : 'application_draft'

    await ctx.db.patch(latest._id, {
      decision: args.decision,
      hrNotes: args.hrNotes,
      reviewedBy: identity.subject,
      decisionAt: now,
      status: nextStatus,
    })

    await ctx.db.patch(candidate._id, { status: nextStatus })

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.application.reviewed',
      previousStatus: candidate.status,
      nextStatus,
      metadata: { candidateId: candidate._id as string, decision: args.decision },
    })

    return candidate._id
  },
})

export const sendOffer = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    payRate: v.optional(v.string()),
    startDate: v.optional(v.string()),
    schedule: v.optional(v.string()),
    supervisor: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    if (candidate.status !== 'hr_review') {
      throw new ConvexError('Candidate must be in hr_review status to send offer.')
    }

    const latest = await getLatestApplication(ctx, candidate._id)
    if (latest && latest.fields) {
      const offerFields: Record<string, unknown> = { ...(latest.fields as Record<string, unknown> | undefined) }
      if (args.payRate !== undefined) offerFields.payRate = args.payRate
      if (args.startDate !== undefined) offerFields.startDate = args.startDate
      if (args.schedule !== undefined) offerFields.schedule = args.schedule
      if (args.supervisor !== undefined) offerFields.supervisor = args.supervisor
      if (args.expiresAt !== undefined) offerFields.offerExpiresAt = args.expiresAt
      await ctx.db.patch(latest._id, { fields: offerFields })
    }

    await ctx.db.patch(candidate._id, { status: 'offer_sent' })

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.offer.sent',
      previousStatus: candidate.status,
      nextStatus: 'offer_sent',
      metadata: { candidateId: candidate._id as string },
    })

    return candidate._id
  },
})

export const acceptOffer = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    if (candidate.status === 'accepted') {
      return candidate._id
    }

    if (candidate.status !== 'offer_sent') {
      throw new ConvexError('No pending offer to accept.')
    }

    await ctx.db.patch(candidate._id, { status: 'accepted' })

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.offer.accepted',
      previousStatus: candidate.status,
      nextStatus: 'accepted',
      metadata: { candidateId: candidate._id as string },
    })

    return candidate._id
  },
})

export const rejectOffer = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
    ])

    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    if (candidate.status !== 'offer_sent') {
      throw new ConvexError('No pending offer to reject.')
    }

    await ctx.db.patch(candidate._id, { status: 'withdrawn' })

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.offer.rejected',
      previousStatus: candidate.status,
      nextStatus: 'withdrawn',
      metadata: { candidateId: candidate._id as string },
    })

    return candidate._id
  },
})

export const hireCandidate = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    startDate: v.optional(v.string()),
    payRate: v.optional(v.string()),
    supervisor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    if (candidate.status !== 'accepted') {
      throw new ConvexError('Candidate must have accepted the offer to be hired.')
    }
    if (!candidate.clerkUserId) {
      throw new ConvexError('Candidate has not completed identity linkage.')
    }

    const normalizedEmail = normalizeCandidateEmail(candidate.email)

    const existingMember = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', candidate.clerkUserId as string),
      )
      .unique()

    let tenantMemberId: Id<'tenantMembers'>
    if (existingMember) {
      await ctx.db.patch(existingMember._id, { role: 'org:caregiver' })
      tenantMemberId = existingMember._id
    } else {
      tenantMemberId = await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: candidate.clerkUserId as string,
        role: 'org:caregiver',
        displayName: candidate.displayName,
        email: normalizedEmail,
      })
    }

    await ctx.scheduler.runAfter(0, internal.candidates.updateClerkMembershipRole, {
      clerkOrgId: args.clerkOrgId,
      clerkUserId: candidate.clerkUserId as string,
      role: 'org:caregiver',
    })

    let employeeProfileId: Id<'employeeProfiles'>
    const existingByClerkUser = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', candidate.clerkUserId as string),
      )
      .unique()

    if (existingByClerkUser) {
      await ctx.db.patch(existingByClerkUser._id, {
        tenantMemberId,
        displayName: candidate.displayName,
        email: normalizedEmail,
        adpSyncStatus: 'pending_credentials',
      })
      employeeProfileId = existingByClerkUser._id
    } else {
      const existingByEmail = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .filter((q) => q.eq(q.field('email'), normalizedEmail))
        .unique()

      if (
        existingByEmail &&
        (!existingByEmail.clerkUserId ||
          existingByEmail.clerkUserId === candidate.clerkUserId)
      ) {
        await ctx.db.patch(existingByEmail._id, {
          clerkUserId: candidate.clerkUserId as string,
          tenantMemberId,
          displayName: candidate.displayName,
          email: normalizedEmail,
          adpSyncStatus: 'pending_credentials',
        })
        employeeProfileId = existingByEmail._id
      } else {
        employeeProfileId = await ctx.db.insert('employeeProfiles', {
          tenantId,
          clerkUserId: candidate.clerkUserId as string,
          tenantMemberId,
          displayName: candidate.displayName,
          email: normalizedEmail,
          adpSyncStatus: 'pending_credentials',
          createdAt: new Date().toISOString(),
        })
      }
    }

    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })

    const leftoverTrainingTasks = await ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_status', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('status', 'pending'),
      )
      .filter((q) => q.eq(q.field('type'), 'platform_training'))
      .collect()
    await Promise.all(leftoverTrainingTasks.map((task) => ctx.db.delete(task._id)))

    await ctx.db.patch(candidate._id, { status: 'hired' })

    const latest = await getLatestApplication(ctx, candidate._id)
    if (latest) {
      const hiringDetails: Record<string, unknown> = {}
      if (args.startDate) hiringDetails.startDate = args.startDate
      if (args.payRate) hiringDetails.payRate = args.payRate
      if (args.supervisor) hiringDetails.supervisor = args.supervisor

      await ctx.db.patch(latest._id, {
        hiredEmployeeProfileId: employeeProfileId,
        ...(Object.keys(hiringDetails).length > 0 && {
          fields: {
            ...(latest.fields ?? {}),
            ...hiringDetails,
          },
        }),
      })
    }

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.hired',
      previousStatus: candidate.status,
      nextStatus: 'hired',
      metadata: {
        candidateId: candidate._id as string,
        employeeProfileId: employeeProfileId as string,
      },
    })

    return { candidateId: candidate._id, employeeProfileId }
  },
})

export const addCandidateDocument = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.optional(v.id('candidates')),
    fileId: v.id('files'),
    documentType: v.string(),
    label: v.string(),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
      'org:admin',
      'org:hr',
    ])

    let candidateId: Id<'candidates'>

    if (role === 'org:candidate') {
      if (args.candidateId) {
        throw new ConvexError('Candidates can only add documents to their own profile.')
      }
      const own = await getOwnCandidate(ctx, tenantId, {
        subject: identity.subject,
        email: typeof identity.email === 'string' ? identity.email : undefined,
      })
      if (!own) {
        throw new ConvexError('Candidate profile not found.')
      }
      candidateId = own._id
    } else {
      if (!args.candidateId) {
        throw new ConvexError('candidateId is required for admin/HR uploads.')
      }
      const candidate = await ctx.db.get(args.candidateId)
      if (!candidate) {
        throw new ConvexError('Candidate not found.')
      }
      assertTenantDoc(candidate, tenantId)
      candidateId = args.candidateId
    }

    const file = await ctx.db.get(args.fileId)
    if (!file) {
      throw new ConvexError('File not found.')
    }
    assertTenantDoc(file, tenantId)

    await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId: args.fileId,
      subjectType: 'candidate',
      subjectId: candidateId as string,
      category: args.documentType,
      status: 'active',
      expiresAt: args.expiresAt,
      source: args.label,
      createdAt: new Date().toISOString(),
    })

    await completeCandidateTask(ctx, tenantId, candidateId, args.documentType)

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.document.added',
      metadata: {
        candidateId: candidateId as string,
        documentType: args.documentType,
      },
    })

    return candidateId
  },
})


export const acknowledgeBackgroundCheck = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
    ])
    const candidate = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!candidate) {
      throw new ConvexError('Candidate profile not found.')
    }

    await recordCandidateAudit(ctx, {
      clerkOrgId,
      action: 'candidate.acknowledgment.signed',
      metadata: { candidateId: candidate._id as string },
    })

    await completeCandidateTask(ctx, tenantId, candidate._id, 'background_check')
    await completeCandidateTask(ctx, tenantId, candidate._id, 'employment_agreement')

    return candidate._id
  },
})

/**
 * @deprecated Use getCandidateDetail for HR/admin views or getCandidateProfile
 * for self-service candidate lookup instead.
 */
export const get = query({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    const candidate = await ctx.db.get(candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    return candidate
  },
})

/**
 * @deprecated Use inviteCandidate to create candidates through the Clerk
 * invitation workflow instead.
 */
export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    displayName: v.string(),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    return ctx.db.insert('candidates', {
      tenantId,
      email: normalizeCandidateEmail(args.email),
      displayName: args.displayName,
      phone: args.phone,
      source: args.source,
      status: 'new',
      createdAt: new Date().toISOString(),
    })
  },
})

/**
 * @deprecated Use the lifecycle-specific mutations (reviewApplication, sendOffer,
 * acceptOffer, rejectOffer, hireCandidate) instead of direct status updates.
 */
export const update = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    status: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
      'org:candidate',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    if (identity.role === 'org:candidate') {
      const candidate = await ctx.db.get(args.candidateId)
      if (!candidate || candidate.clerkUserId !== identity.subject) {
        throw new ConvexError('You can only edit your own profile.')
      }
      if (args.status !== undefined) {
        throw new ConvexError('Candidates cannot change their status.')
      }
    }

    await ctx.db.patch(args.candidateId, {
      ...(args.status !== undefined && { status: args.status }),
      ...(args.displayName !== undefined && { displayName: args.displayName }),
      ...(args.email !== undefined && { email: args.email }),
      ...(args.phone !== undefined && { phone: args.phone }),
    })

    return args.candidateId
  },
})

const CANDIDATE_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]
const MAX_CANDIDATE_DOCUMENT_BYTES = 10 * 1024 * 1024

export const attachCandidateDocument = mutation({
  args: {
    clerkOrgId: v.string(),
    storageId: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    documentType: v.string(),
    label: v.string(),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
    ])

    const own = await getOwnCandidate(ctx, tenantId, {
      subject: identity.subject,
      email: typeof identity.email === 'string' ? identity.email : undefined,
    })
    if (!own) {
      throw new ConvexError('Candidate profile not found.')
    }
    const candidateId = own._id

    if (
      args.contentType &&
      !CANDIDATE_DOCUMENT_TYPES.includes(args.contentType)
    ) {
      throw new ConvexError(
        'Invalid file type. Only JPG, PNG, WebP, and PDF are allowed.',
      )
    }
    if (args.size && args.size > MAX_CANDIDATE_DOCUMENT_BYTES) {
      throw new ConvexError('File exceeds 10 MB limit.')
    }

    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: args.storageId,
      uploadedBy: identity.subject,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      linkedType: 'complianceDoc',
      linkedId: candidateId as string,
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })

    const existingArchiveItem = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_subject', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('subjectType', 'candidate')
          .eq('subjectId', candidateId as string),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field('category'), args.documentType),
          q.eq(q.field('status'), 'active'),
        ),
      )
      .first()

    if (existingArchiveItem) {
      await ctx.db.patch(existingArchiveItem._id, {
        fileId,
        source: args.label,
        expiresAt: args.expiresAt,
        createdAt: new Date().toISOString(),
      })
    } else {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId,
        subjectType: 'candidate',
        subjectId: candidateId as string,
        category: args.documentType,
        status: 'active',
        expiresAt: args.expiresAt,
        source: args.label,
        createdAt: new Date().toISOString(),
      })
    }

    await completeCandidateTask(ctx, tenantId, candidateId, args.documentType)

    await recordCandidateAudit(ctx, {
      clerkOrgId: args.clerkOrgId,
      action: 'candidate.document.attached',
      metadata: {
        candidateId: candidateId as string,
        documentType: args.documentType,
        fileId: fileId as string,
      },
    })

    return fileId
  },
})

