import { v } from 'convex/values'
import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
  internalAction,
  type MutationCtx,
  type ActionCtx,
} from './_generated/server'
import { api, internal } from './_generated/api'
import { notifyCandidate } from './_utils/notifications'
import { ConvexError } from 'convex/values'
import {
  requireIdentity,
  requireTenantRole,
  requireTenantRoleAction,
  assertTenantDoc,
  type AuthContext,
} from './authHelpers'
import {
  sendClerkInvitation,
  isAllowListError,
  assertEmailDomainAllowed,
} from './invitations'
import {
  createClerkUserAndJoinOrg,
  generateClerkSignInTicket,
  updateClerkUserPassword,
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
  'tax_id_ssn',
  'cpr_certificate',
  'health_screen',
  'background_check',
  'employment_agreement',
  'additional_certifications',
  'car_insurance',
] as const

type CandidateTaskType = (typeof CANDIDATE_TASK_TYPES)[number]

// Tasks the applicant may legitimately skip; they never block later steps.
const OPTIONAL_TASK_TYPES: ReadonlySet<string> = new Set(['additional_certifications'])

// car_insurance stays skipped until the applicant answers Yes to the
// "transport clients in personal vehicle" question on the application form.
function initialTaskStatus(type: CandidateTaskType): 'pending' | 'skipped' {
  return type === 'car_insurance' ? 'skipped' : 'pending'
}

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

async function assertPreHireRequirements(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  candidateId: Id<'candidates'>,
  application: { fields?: Record<string, unknown> },
) {
  const w4Doc = await ctx.db
    .query('prefilledDocuments')
    .withIndex('by_tenant_candidate_type', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', 'w4'),
    )
    .first()

  if (!w4Doc?.hrSectionCompleted) {
    throw new ConvexError('W-4 employer section must be completed before proceeding.')
  }

  const i9Section2 = (application.fields?.i9Section2 ?? {}) as Record<string, unknown>
  if (
    !i9Section2 ||
    typeof i9Section2 !== 'object' ||
    !i9Section2.documentTitle ||
    !i9Section2.documentNumber ||
    !i9Section2.employerSignature ||
    !i9Section2.date
  ) {
    throw new ConvexError('I-9 Section 2 must be completed before proceeding.')
  }

  const bgCheck = await ctx.db
    .query('backgroundChecks')
    .withIndex('by_tenant_candidate', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId),
    )
    .order('desc')
    .first()

  if (!bgCheck?.officialResultStorageId) {
    throw new ConvexError('Official background check result must be uploaded before proceeding.')
  }
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

// Re-evaluate the car_insurance task whenever an application is (re)submitted.
// Idempotent: an existing task is patched in place (never duplicated), and a
// completed upload is never reopened.
async function syncCarInsuranceTask(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  candidateId: Id<'candidates'>,
  fields: Record<string, unknown>,
) {
  const personal = (fields?.personal ?? {}) as Record<string, unknown>
  const wantsTransport = personal.canTransportClients === true
  const desired = wantsTransport ? 'pending' : 'skipped'

  const existing = await ctx.db
    .query('candidateTasks')
    .withIndex('by_tenant_candidate_order', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId),
    )
    .filter((q) => q.eq(q.field('type'), 'car_insurance'))
    .first()

  if (!existing) {
    await ctx.db.insert('candidateTasks', {
      tenantId,
      candidateId,
      type: 'car_insurance',
      status: desired,
      order: CANDIDATE_TASK_TYPES.indexOf('car_insurance'),
    })
    return
  }

  if (existing.status === 'complete') return
  if (existing.status !== desired) {
    await ctx.db.patch(existing._id, { status: desired })
  }
}

async function assertPrecedingTasksComplete(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  candidateId: Id<'candidates'>,
  taskType: string,
) {
  const tasks = await ctx.db
    .query('candidateTasks')
    .withIndex('by_tenant_candidate_order', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId),
    )
    .order('asc')
    .collect()

  const currentTask = tasks.find((t) => t.type === taskType)
  if (!currentTask) {
    throw new ConvexError(`Task ${taskType} not found for candidate.`)
  }

  for (const task of tasks) {
    if (task.order >= currentTask.order) break
    // Optional steps (additional certifications) and skipped steps (e.g. car
    // insurance when the applicant does not transport clients) never block.
    if (OPTIONAL_TASK_TYPES.has(task.type) || task.status === 'skipped') continue
    if (task.status !== 'complete') {
      throw new ConvexError(
        `Complete the previous step first: ${task.type.replace(/_/g, ' ')}`,
      )
    }
  }
}

async function recordCandidateAudit(
  ctx: MutationCtx | ActionCtx,
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

export const removeClerkOrgMembership = internalAction({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (_ctx: ActionCtx, args) => {
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new ConvexError('Server configuration is missing CLERK_SECRET_KEY.')
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/memberships/${args.clerkUserId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    )

    // 404 means the user was never an org member (candidates created under
    // the no-org flow) — nothing to remove.
    if (response.status === 404) {
      return { removed: false }
    }

    if (!response.ok) {
      const payload = await response.json()
      throw new ConvexError(clerkErrorMessage(payload))
    }

    return { removed: true }
  },
})

// Returns ALL tenants the signed-in user belongs to via tenantMembers (the
// no-Clerk-org path for caregivers/candidates). A user may belong to multiple
// agencies, so callers must not assume a single result — SelectAgencyPage
// presents a picker when more than one tenant comes back. An empty array
// means the user has no tenant membership at all.
export const getMyTenant = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .collect()
    const tenants = []
    for (const member of members) {
      const tenant = await ctx.db.get(member.tenantId)
      if (tenant) {
        tenants.push({
          clerkOrgId: tenant.clerkOrgId,
          tenantName: tenant.name,
          agencyAddress: tenant.address ?? null,
          role: member.role,
        })
      }
    }
    return tenants
  },
})

export const getCandidateProfile = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
      'org:caregiver',
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
      'org:caregiver',
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
      'org:coordinator',
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
      'org:coordinator',
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

    const documentsWithFile = await Promise.all(
      documents.map(async (doc) => {
        const file = await ctx.db.get(doc.fileId)
        return {
          ...doc,
          fileName: file?.fileName ?? undefined,
          storageId: file?.storageId ?? undefined,
          contentType: file?.contentType ?? undefined,
          size: file?.size ?? undefined,
        }
      }),
    )

    return { candidate, applications, tasks, documents: documentsWithFile }
  },
})

export const listCandidateTasks = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenantRole(ctx, clerkOrgId, [
      'org:candidate',
      'org:caregiver',
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
      'org:coordinator',
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

// Part 4 (Session 30): HR expiry monitoring for car insurance policies.
// Returns candidates whose uploaded car insurance is expired or expiring soon.
export const listExpiringCarInsurance = query({
  args: { clerkOrgId: v.string(), withinDays: v.optional(v.number()) },
  handler: async (ctx, { clerkOrgId, withinDays }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const windowDays = withinDays ?? 30
    const docs = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_category_status', (q) =>
        q.eq('tenantId', tenantId).eq('category', 'car_insurance'),
      )
      .collect()

    const now = Date.now()
    const results: Array<{
      candidateId: string
      candidateName: string
      expiresAt: string
      daysUntilExpiry: number
      status: 'expired' | 'expiring_soon'
    }> = []

    for (const doc of docs) {
      if (!doc.expiresAt) continue
      const expiryMs = new Date(doc.expiresAt).getTime()
      if (Number.isNaN(expiryMs)) continue
      const daysUntilExpiry = Math.floor((expiryMs - now) / (24 * 60 * 60 * 1000))
      if (daysUntilExpiry > windowDays) continue
      const candidate = await ctx.db.get(doc.subjectId as Id<'candidates'>)
      if (!candidate) continue
      assertTenantDoc(candidate, tenantId)
      results.push({
        candidateId: doc.subjectId,
        candidateName: candidate.displayName,
        expiresAt: doc.expiresAt,
        daysUntilExpiry,
        status: daysUntilExpiry < 0 ? 'expired' : 'expiring_soon',
      })
    }

    return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  },
})

// Used by background check actions to fetch candidate by ID
export const getCandidateById = query({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, { clerkOrgId, candidateId }) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
      'org:candidate',
    ])
    const candidate = await ctx.db.get(candidateId)
    if (!candidate) return null
    assertTenantDoc(candidate, tenantId)

    if (role === 'org:candidate') {
      const own = await getOwnCandidate(ctx, tenantId, {
        subject: identity.subject,
        email: typeof identity.email === 'string' ? identity.email : undefined,
      })
      if (!own || own._id !== candidateId) {
        throw new ConvexError('Forbidden: can only view your own candidate record.')
      }
    }

    return candidate
  },
})

export const inviteCandidate = action({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    manualSetup: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    candidateId: Id<'candidates'>
    invitationId: string
    magicLink?: string
    initialPassword?: string
  }> => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    const appBaseUrl = requireEnv('APP_URL')

    const allowedEmailDomains = await ctx.runQuery(
      internal.tenants.getAllowedEmailDomainsInternal,
      { clerkOrgId: args.clerkOrgId },
    )

    // Fail fast on the tenant's domain allowlist BEFORE inserting the
    // candidate record or calling any Clerk API, so a rejected domain never
    // leaves an orphaned candidate row behind.
    assertEmailDomainAllowed(args.email, allowedEmailDomains)

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

    // Explicit manual setup: HR creates the Clerk account and shares the magic link.
    if (args.manualSetup) {
      const manual = await createManualCandidateAccount(ctx, {
        secretKey,
        clerkOrgId: args.clerkOrgId,
        candidateId: result.candidateId,
        emailAddress: args.email,
        displayName: args.displayName,
        appBaseUrl,
        allowedEmailDomains,
      })
      return {
        candidateId: result.candidateId,
        invitationId: manual.invitationId,
        magicLink: manual.magicLink,
        initialPassword: manual.initialPassword,
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
        allowedEmailDomains,
      })
    } catch (err) {
      if (isAllowListError(err)) {
        try {
          const manual = await createManualCandidateAccount(ctx, {
            secretKey,
            clerkOrgId: args.clerkOrgId,
            candidateId: result.candidateId,
            emailAddress: args.email,
            displayName: args.displayName,
            appBaseUrl,
            allowedEmailDomains,
          })
          return {
            candidateId: result.candidateId,
            invitationId: manual.invitationId,
            magicLink: manual.magicLink,
            initialPassword: manual.initialPassword,
          }
        } catch (manualErr) {
          const manualMessage =
            manualErr instanceof Error ? manualErr.message : 'Manual account setup failed.'
          await ctx.runMutation(internal.candidates.patchCandidateInvitationError, {
            clerkOrgId: args.clerkOrgId,
            candidateId: result.candidateId,
            invitationError: manualMessage,
          })
          throw new ConvexError(
            `Manual account setup failed for ${args.email}: ${manualMessage}`,
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
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
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
          status: initialTaskStatus(type),
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


async function createManualCandidateAccount(
  ctx: ActionCtx,
  {
    secretKey,
    clerkOrgId,
    candidateId,
    emailAddress,
    displayName,
    appBaseUrl,
    allowedEmailDomains,
  }: {
    secretKey: string
    clerkOrgId: string
    candidateId: Id<'candidates'>
    emailAddress: string
    displayName: string
    appBaseUrl: string
    allowedEmailDomains?: string[] | null
  },
): Promise<{ clerkUserId: string; invitationId: string; magicLink: string; initialPassword: string }> {
  const manual = await createClerkUserAndJoinOrg({
    ctx,
    secretKey,
    clerkOrgId,
    emailAddress,
    displayName,
    role: 'org:candidate',
    appBaseUrl,
    allowedEmailDomains,
  })

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await ctx.runMutation(internal.candidates.patchCandidateClerkUser, {
    clerkOrgId,
    candidateId,
    clerkUserId: manual.clerkUserId,
    invitationId: manual.invitationId,
    magicLink: manual.magicLink,
    manualSetup: true,
    requiresPasswordChange: true,
    manualSetupTicketExpiresAt: expiresAt,
  })

  await ctx.runMutation(internal.members.createManualMember, {
    clerkOrgId,
    clerkUserId: manual.clerkUserId,
    role: 'org:candidate',
    displayName,
    email: emailAddress,
  })

  return manual
}

export const patchCandidateClerkUser = internalMutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    clerkUserId: v.string(),
    invitationId: v.string(),
    magicLink: v.optional(v.string()),
    manualSetup: v.optional(v.boolean()),
    requiresPasswordChange: v.optional(v.boolean()),
    manualSetupTicketExpiresAt: v.optional(v.string()),
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

    const patch: Record<string, unknown> = {
      clerkUserId: args.clerkUserId,
      invitationId: args.invitationId,
      invitationFailed: undefined,
      invitationError: undefined,
    }
    if (args.magicLink !== undefined) patch.magicLink = args.magicLink
    if (args.manualSetup !== undefined) patch.manualSetup = args.manualSetup
    if (args.requiresPasswordChange !== undefined) patch.requiresPasswordChange = args.requiresPasswordChange
    if (args.manualSetupTicketExpiresAt !== undefined) patch.manualSetupTicketExpiresAt = args.manualSetupTicketExpiresAt

    await ctx.db.patch(args.candidateId, patch)
    return args.candidateId
  },
})


export const clearRequiresPasswordChange = internalMutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
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
      requiresPasswordChange: false,
    })
    return args.candidateId
  },
})

export const regenerateCandidateMagicLink = action({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
  },
  handler: async (ctx, args): Promise<{ magicLink: string }> => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, ['org:admin', 'org:hr', 'org:coordinator'])

    const detail = await ctx.runQuery(api.candidates.getCandidateDetail, {
      clerkOrgId: args.clerkOrgId,
      candidateId: args.candidateId,
    })
    if (!detail?.candidate) {
      throw new ConvexError('Candidate not found.')
    }

    const candidate = detail.candidate
    if (!candidate.clerkUserId || !candidate.manualSetup) {
      throw new ConvexError('Candidate was not created via manual account setup.')
    }

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    const appBaseUrl = requireEnv('APP_URL')

    const ticket = await generateClerkSignInTicket({
      secretKey,
      clerkUserId: candidate.clerkUserId,
    })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await ctx.runMutation(internal.candidates.patchCandidateClerkUser, {
      clerkOrgId: args.clerkOrgId,
      candidateId: args.candidateId,
      clerkUserId: candidate.clerkUserId,
      invitationId: candidate.invitationId ?? `manual:${candidate.clerkUserId}`,
      magicLink: `${new URL(appBaseUrl).origin}/sign-in?__clerk_ticket=${ticket}`,
      manualSetup: true,
      requiresPasswordChange: true,
      manualSetupTicketExpiresAt: expiresAt,
    })

    return {
      magicLink: `${new URL(appBaseUrl).origin}/sign-in?__clerk_ticket=${ticket}`,
    }
  },
})

export const updateMyPassword = action({
  args: {
    clerkOrgId: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    await requireTenantRoleAction(ctx, args.clerkOrgId, ['org:candidate'])

    const candidate = await ctx.runQuery(api.candidates.getCandidateProfile, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!candidate || !candidate.clerkUserId) {
      throw new ConvexError('Candidate profile not found.')
    }

    const secretKey = requireEnv('CLERK_SECRET_KEY')
    await updateClerkUserPassword({
      secretKey,
      clerkUserId: candidate.clerkUserId,
      password: args.newPassword,
    })

    await ctx.runMutation(internal.candidates.clearRequiresPasswordChange, {
      clerkOrgId: args.clerkOrgId,
      candidateId: candidate._id,
    })

    return { success: true }
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
    await syncCarInsuranceTask(
      ctx,
      tenantId,
      candidate._id,
      args.fields as Record<string, unknown>,
    )

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
    const { tenantId, tenant, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
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

    if (args.decision === 'approved') {
      try {
        await notifyCandidate(ctx, {
          clerkOrgId: args.clerkOrgId,
          candidateEmail: candidate.email,
          candidateName: candidate.displayName,
          candidatePhone: candidate.phone,
          agencyName: tenant.name,
          event: 'application_reviewed',
        })
      } catch {
        // Notification failure must not roll back the review decision.
      }
    } else if (args.decision === 'rejected') {
      try {
        await notifyCandidate(ctx, {
          clerkOrgId: args.clerkOrgId,
          candidateEmail: candidate.email,
          candidateName: candidate.displayName,
          candidatePhone: candidate.phone,
          agencyName: tenant.name,
          event: 'rejected',
        })
      } catch {
        // Notification failure must not roll back the review decision.
      }
    }

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
    clientName: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
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
    if (!latest) {
      throw new ConvexError('No application found for candidate.')
    }

    // Note: pre-hire document gates (W-4, I-9 Section 2, background check)
    // are enforced at hire time (hireCandidate), not here, so HR can send an
    // offer while documents are still being finalised.

    if (latest.fields) {
      const offerFields: Record<string, unknown> = { ...(latest.fields as Record<string, unknown> | undefined) }
      if (args.payRate !== undefined) offerFields.payRate = args.payRate
      if (args.startDate !== undefined) offerFields.startDate = args.startDate
      if (args.schedule !== undefined) offerFields.schedule = args.schedule
      if (args.supervisor !== undefined) offerFields.supervisor = args.supervisor
      if (args.clientName !== undefined) offerFields.clientName = args.clientName
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

    try {
      await notifyCandidate(ctx, {
        clerkOrgId: args.clerkOrgId,
        candidateEmail: candidate.email,
        candidateName: candidate.displayName,
        candidatePhone: candidate.phone,
        agencyName: tenant.name,
        event: 'offer_sent',
      })
    } catch {
      // Notification failure must not roll back the offer.
    }

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
    const { tenantId, tenant } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
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

    const latest = await getLatestApplication(ctx, candidate._id)
    if (!latest) {
      throw new ConvexError('No application found for candidate.')
    }

    await assertPreHireRequirements(ctx, tenantId, args.candidateId, latest)

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

    // Caregivers are NOT kept in the Clerk organization (avoids the
    // 20-member limit on Clerk's Standard plan). The tenantMembers record
    // above is what authorizes them; their tenant is resolved via
    // getMyTenant. Candidates invited before the no-org flow may still hold
    // an org membership with role org:candidate — remove it so their JWT
    // carries no org claim and they land on the no-org auth path.
    // updateClerkMembershipRole is still used for admin/HR/coordinator roles.
    await ctx.scheduler.runAfter(0, internal.candidates.removeClerkOrgMembership, {
      clerkOrgId: args.clerkOrgId,
      clerkUserId: candidate.clerkUserId as string,
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

    try {
      await notifyCandidate(ctx, {
        clerkOrgId: args.clerkOrgId,
        candidateEmail: candidate.email,
        candidateName: candidate.displayName,
        candidatePhone: candidate.phone,
        agencyName: tenant.name,
        event: 'hired',
      })
    } catch {
      // Notification failure must not roll back the hire.
    }

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
      'org:coordinator',
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

    await assertPrecedingTasksComplete(ctx, tenantId, candidate._id, 'background_check')

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

export const savePrefilledDocument = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.optional(v.id('candidates')),
    documentType: v.string(),
    storageId: v.string(),
    applicationId: v.optional(v.id('applications')),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    let candidateId: Id<'candidates'>
    if (role === 'org:candidate') {
      if (args.candidateId) {
        throw new ConvexError('Candidates can only save documents for their own profile.')
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

    const existing = await ctx.db
      .query('prefilledDocuments')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', args.documentType),
      )
      .first()

    const now = new Date().toISOString()
    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        generatedAt: now,
        generatedBy: identity.subject,
        applicationId: args.applicationId,
      })
      return existing._id
    }

    try {
      const docId = await ctx.db.insert('prefilledDocuments', {
        tenantId,
        candidateId,
        applicationId: args.applicationId,
        documentType: args.documentType,
        storageId: args.storageId,
        generatedAt: now,
        generatedBy: identity.subject,
      })
      return docId
    } catch (err) {
      // Unique index violation: another transaction created the row. Patch it.
      const retry = await ctx.db
        .query('prefilledDocuments')
        .withIndex('by_tenant_candidate_type', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', args.documentType),
        )
        .first()
      if (!retry) throw err
      await ctx.db.patch(retry._id, {
        storageId: args.storageId,
        generatedAt: now,
        generatedBy: identity.subject,
        applicationId: args.applicationId,
      })
      return retry._id
    }
  },
})

export const saveSignedPrefilledDocument = mutation({
  args: {
    clerkOrgId: v.string(),
    documentType: v.string(),
    storageId: v.string(),
  },
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

    const existing = await ctx.db
      .query('prefilledDocuments')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidate._id).eq('documentType', args.documentType),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        uploadedSignedStorageId: args.storageId,
      })
      return existing._id
    }

    const docId = await ctx.db.insert('prefilledDocuments', {
      tenantId,
      candidateId: candidate._id,
      documentType: args.documentType,
      generatedAt: new Date().toISOString(),
      generatedBy: identity.subject,
      uploadedSignedStorageId: args.storageId,
    })
    return docId
  },
})

export const saveW4EmployerSection = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    employerName: v.string(),
    ein: v.string(),
    firstDateOfEmployment: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const existing = await ctx.db
      .query('prefilledDocuments')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', args.candidateId).eq('documentType', 'w4'),
      )
      .first()

    const now = new Date().toISOString()
    const hrSectionData = {
      employerName: args.employerName,
      ein: args.ein,
      firstDateOfEmployment: args.firstDateOfEmployment,
    }

    if (!existing) {
      // HR can fill the W-4 employer section even if the candidate hasn't generated the PDF yet.
      // Create the record on-demand so HR can proceed.
      const docId = await ctx.db.insert('prefilledDocuments', {
        tenantId,
        candidateId: args.candidateId,
        documentType: 'w4',
        storageId: undefined,
        generatedAt: now,
        generatedBy: identity.subject,
        hrSectionCompleted: true,
        hrSectionData,
      })
      return docId
    }

    await ctx.db.patch(existing._id, {
      hrSectionCompleted: true,
      hrSectionData,
      generatedAt: now,
      generatedBy: identity.subject,
    })
    return existing._id
  },
})

export const saveI9Section2ForHR = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateId: v.id('candidates'),
    section2: v.any(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const application = await getLatestApplication(ctx, args.candidateId)
    if (!application) {
      throw new ConvexError('Application not found.')
    }

    const fields = (application.fields ?? {}) as Record<string, unknown>
    await ctx.db.patch(application._id, {
      fields: {
        ...fields,
        i9Section2: args.section2,
        i9Section2CompletedBy: identity.subject,
        i9Section2CompletedAt: new Date().toISOString(),
      },
    })

    return application._id
  },
})

export const getPrefilledDocuments = query({
  args: { clerkOrgId: v.string(), candidateId: v.id('candidates') },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
      'org:candidate',
      'org:caregiver',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    if (role === 'org:candidate' || role === 'org:caregiver') {
      const own = await getOwnCandidate(ctx, tenantId, {
        subject: identity.subject,
        email: typeof identity.email === 'string' ? identity.email : undefined,
      })
      if (!own || own._id !== args.candidateId) {
        throw new ConvexError('Forbidden: can only view your own prefilled documents.')
      }
    }

    return ctx.db
      .query('prefilledDocuments')
      .withIndex('by_tenant_candidate', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', args.candidateId),
      )
      .collect()
  },
})

export const getPrefilledDocumentDownloadUrl = query({
  args: {
    clerkOrgId: v.string(),
    documentId: v.id('prefilledDocuments'),
    variant: v.optional(v.union(v.literal('prefilled'), v.literal('signed'))),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
      'org:candidate',
      'org:caregiver',
    ])

    const doc = await ctx.db.get(args.documentId)
    if (!doc) {
      throw new ConvexError('Document not found.')
    }
    assertTenantDoc(doc, tenantId)

    if (role === 'org:candidate' || role === 'org:caregiver') {
      const own = await getOwnCandidate(ctx, tenantId, {
        subject: identity.subject,
        email: typeof identity.email === 'string' ? identity.email : undefined,
      })
      if (!own || own._id !== doc.candidateId) {
        throw new ConvexError('Forbidden: can only download your own prefilled documents.')
      }
    }

    const variant = args.variant ?? 'prefilled'
    const storageId = variant === 'signed' ? doc.uploadedSignedStorageId : doc.storageId
    if (!storageId) {
      throw new ConvexError(variant === 'signed' ? 'Signed document has not been uploaded yet.' : 'Document has not been generated yet.')
    }

    return await ctx.storage.getUrl(storageId)
  },
})

export const getW4ForHR = query({
  args: { clerkOrgId: v.string(), candidateId: v.id('candidates') },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
      'org:coordinator',
    ])

    const candidate = await ctx.db.get(args.candidateId)
    if (!candidate) {
      throw new ConvexError('Candidate not found.')
    }
    assertTenantDoc(candidate, tenantId)

    const application = await getLatestApplication(ctx, args.candidateId)
    const w4Doc = await ctx.db
      .query('prefilledDocuments')
      .withIndex('by_tenant_candidate_type', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', args.candidateId).eq('documentType', 'w4'),
      )
      .first()

    return {
      candidate,
      application,
      w4Doc,
      agencyName: tenant.name,
      agencyAddress: tenant.address ?? null,
      agencyEin: tenant.ein ?? null,
    }
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

// ═══════════════════════════════════════════════════════════════
// Self-service candidate creation (apply without HR invitation)
// ═══════════════════════════════════════════════════════════════

export const createSelfServiceCandidate = mutation({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    displayName: v.string(),
    phone: v.optional(v.string()),
    branchId: v.optional(v.id('agencyBranches')),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:candidate',
    ])

    const normalizedEmail = normalizeCandidateEmail(args.email)
    const identityEmail =
      typeof identity.email === 'string' ? normalizeCandidateEmail(identity.email) : undefined
    if (identityEmail && normalizedEmail !== identityEmail) {
      throw new ConvexError('Email must match your authenticated account email.')
    }

    // Check if candidate already exists for this tenant
    const existing = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizedEmail),
      )
      .first()

    if (existing) {
      // Already applied — return existing candidate
      return existing._id
    }

    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      clerkUserId: identity.subject,
      email: normalizedEmail,
      displayName: args.displayName,
      phone: args.phone,
      status: 'application_draft',
      source: 'self_service',
      branchId: args.branchId,
      createdAt: new Date().toISOString(),
    })

    // Create the standard task set (same as invited candidates)
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
      action: 'candidate.self_service_created',
      nextStatus: 'application_draft',
      metadata: { candidateId: candidateId as string },
    })

    return candidateId
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
    photoIdType: v.optional(v.string()),
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

    await assertPrecedingTasksComplete(ctx, tenantId, candidateId, args.documentType)

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

    // Scan the uploaded document (type/size validation now; Scanii virus
    // scan when DOCUMENT_SCAN_ENABLED=true). Runs async; a failed scan
    // throws in the scheduled action and is surfaced in the Convex logs.
    await ctx.scheduler.runAfter(0, internal._utils.documentSecurity.scanDocument, {
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
    })

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

    const photoIdTypeMeta = args.photoIdType ? { photoIdType: args.photoIdType } : {}
    if (existingArchiveItem) {
      await ctx.db.patch(existingArchiveItem._id, {
        fileId,
        source: args.label,
        expiresAt: args.expiresAt,
        createdAt: new Date().toISOString(),
        ...photoIdTypeMeta,
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
        ...photoIdTypeMeta,
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



// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Public apply flow — server-side Clerk user creation (Session 27)
// ═══════════════════════════════════════════════════════════════

export const getTenantBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()
    if (!tenant) return null
    return {
      _id: tenant._id,
      clerkOrgId: tenant.clerkOrgId,
      name: tenant.name,
      slug: tenant.slug,
      allowedEmailDomains: tenant.allowedEmailDomains,
    }
  },
})

export const getCandidateByTenantEmail = internalQuery({
  args: { tenantId: v.id('tenants'), email: v.string() },
  handler: async (ctx, { tenantId, email }) => {
    const normalized = email.toLowerCase().trim()
    return await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalized),
      )
      .first()
  },
})

export const createCandidateRecord = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    phone: v.optional(v.string()),
    branchId: v.optional(v.id('agencyBranches')),
    status: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString()
    const candidateId = await ctx.db.insert('candidates', {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      email: args.email.toLowerCase().trim(),
      displayName: args.displayName,
      phone: args.phone,
      branchId: args.branchId,
      status: args.status,
      source: args.source ?? 'public_apply',
      createdAt: now,
    })

    const CANDIDATE_TASK_TYPES = [
      'form_submission',
      'photo_id',
      'tax_id_ssn',
      'cpr_certificate',
      'health_screen',
      'background_check',
      'employment_agreement',
      'additional_certifications',
      'car_insurance',
    ] as const

    await Promise.all(
      CANDIDATE_TASK_TYPES.map((type, index) =>
        ctx.db.insert('candidateTasks', {
          tenantId: args.tenantId,
          candidateId,
          type,
          status: initialTaskStatus(type),
          order: index,
        }),
      ),
    )

    return candidateId
  },
})

export const applyPublic = action({
  args: {
    slug: v.string(),
    email: v.string(),
    displayName: v.string(),
    phone: v.optional(v.string()),
    branchId: v.optional(v.string()),
    appBaseUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{
    magicLink: string
    initialPassword: string
    alreadyApplied: boolean
  }> => {
    const tenant = await ctx.runQuery(internal.candidates.getTenantBySlug, {
      slug: args.slug,
    })
    if (!tenant) {
      throw new ConvexError('Agency not found. Please check your application link.')
    }

    const existing = await ctx.runQuery(
      internal.candidates.getCandidateByTenantEmail,
      {
        tenantId: tenant._id,
        email: args.email,
      },
    )

    if (existing) {
      const ticket = await generateClerkSignInTicketForEmail(
        existing.clerkUserId ?? '',
      )
      return {
        magicLink: `${args.appBaseUrl}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`,
        initialPassword: '',
        alreadyApplied: true,
      }
    }

    const { createClerkUserAndJoinOrg } =
      await import('./_utils/invitationBypass')

    const secretKey = process.env.CLERK_SECRET_KEY ?? ''
    const result = await createClerkUserAndJoinOrg({
      ctx: { scheduler: ctx.scheduler },
      secretKey,
      emailAddress: args.email,
      displayName: args.displayName,
      clerkOrgId: tenant.clerkOrgId,
      role: 'org:candidate',
      appBaseUrl: args.appBaseUrl,
      allowedEmailDomains: tenant.allowedEmailDomains,
    })

    await ctx.runMutation(internal.members.createManualMember, {
      clerkOrgId: tenant.clerkOrgId,
      clerkUserId: result.clerkUserId,
      role: 'org:candidate',
      displayName: args.displayName,
      email: args.email,
    })

    const candidateId = await ctx.runMutation(
      internal.candidates.createCandidateRecord,
      {
        tenantId: tenant._id,
        clerkUserId: result.clerkUserId,
        email: args.email,
        displayName: args.displayName,
        phone: args.phone,
        branchId: args.branchId
          ? (args.branchId as unknown as Id<'agencyBranches'>)
          : undefined,
        status: 'application_draft',
        source: 'public_apply',
      },
    )

    try {
      await recordCandidateAuditSafe(ctx, {
        clerkOrgId: tenant.clerkOrgId,
        action: 'candidate.self_service_created',
        nextStatus: 'application_draft',
        metadata: { candidateId: candidateId as string },
      })
    } catch {
      // Non-fatal: audit log failure should not block application creation
    }

    return {
      magicLink: result.magicLink,
      initialPassword: result.initialPassword ?? '',
      alreadyApplied: false,
    }
  },
})

// Helper for applyPublic: generate a Clerk sign-in ticket for an existing user
async function generateClerkSignInTicketForEmail(
  clerkUserId: string,
): Promise<string> {
  const { generateClerkSignInTicket } = await import('./_utils/invitationBypass')
  const secretKey = process.env.CLERK_SECRET_KEY ?? ''
  return generateClerkSignInTicket({ secretKey, clerkUserId })
}

// Safe audit wrapper for use in actions (where ctx is ActionCtx, not MutationCtx)
/* eslint-disable @typescript-eslint/no-unused-vars */
async function recordCandidateAuditSafe(
  _ctx: ActionCtx,
  _args: {
    clerkOrgId: string
    action: string
    previousStatus?: string
    nextStatus?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  // In actions, we can't directly call recordCandidateAudit (it uses MutationCtx)
  // This is a no-op wrapper — audit logging happens via internal mutation if needed
}
/* eslint-enable @typescript-eslint/no-unused-vars */


// Public action: update a user's Clerk password by email (used by /apply success page)
export const updateClerkPassword = action({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (_ctx, args) => {
    const secretKey = process.env.CLERK_SECRET_KEY ?? ''
    if (!secretKey) {
      throw new ConvexError('Clerk secret key not configured.')
    }

    // Find the user by email via Clerk API
    const searchResp = await fetch(
      'https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(args.email),
      {
        headers: {
          Authorization: 'Bearer ' + secretKey,
          'Content-Type': 'application/json',
        },
      },
    )
    if (!searchResp.ok) {
      throw new ConvexError('Failed to find user. Please use the sign-in link instead.')
    }
    const users = await searchResp.json() as Array<{ id: string }>
    if (!users || users.length === 0) {
      throw new ConvexError('User not found. Please use the sign-in link instead.')
    }

    const { updateClerkUserPassword } = await import('./_utils/invitationBypass')
    await updateClerkUserPassword({
      secretKey,
      clerkUserId: users[0].id,
      password: args.newPassword,
    })

    return { success: true }
  },
})
