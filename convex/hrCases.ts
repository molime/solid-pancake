import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'


const HR_ROLES: Array<'org:admin' | 'org:hr'> = ['org:admin', 'org:hr']

const CASE_STATUSES = ['open', 'in_review', 'resolved', 'closed'] as const
type CaseStatus = (typeof CASE_STATUSES)[number]

function isValidCaseStatus(status: string): status is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(status)
}

export const createHrCase = mutation({
  args: {
    clerkOrgId: v.string(),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, member } = await requireTenantRole(ctx, args.clerkOrgId, HR_ROLES)

    const existingCases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .collect()
    const year = new Date().getFullYear()
    const caseNumber = `HR-${year}-${String(existingCases.length + 1).padStart(3, '0')}`

    return ctx.db.insert('hrCases', {
      tenantId,
      caseNumber,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      category: args.category,
      title: args.title,
      status: 'open',
      ownerMemberId: member._id,
      description: args.description,
      createdAt: new Date().toISOString(),
    })
  },
})

export const listHrCases = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, HR_ROLES)

    const cases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const profileByClerkUserId = new Map(profiles.map((p) => [p.clerkUserId ?? '', p]))
    const candidateById = new Map(candidates.map((c) => [c._id as string, c]))
    const memberById = new Map(members.map((m) => [m._id as string, m]))

    return cases.map((c) => {
      let subjectName = 'Unknown'
      if (c.subjectType === 'employee') {
        const profile = profileByClerkUserId.get(c.subjectId)
        if (profile) subjectName = profile.displayName
      } else if (c.subjectType === 'candidate') {
        const candidate = candidateById.get(c.subjectId)
        if (candidate) subjectName = candidate.displayName
      }

      const owner = c.ownerMemberId ? memberById.get(c.ownerMemberId as string) : undefined

      return {
        _id: c._id,
        caseNumber: c.caseNumber,
        subjectType: c.subjectType,
        subjectId: c.subjectId,
        subjectName,
        category: c.category,
        title: c.title,
        status: c.status,
        ownerMemberId: c.ownerMemberId,
        ownerName: owner?.displayName ?? 'Unassigned',
        description: c.description,
        createdAt: c._creationTime
          ? new Date(c._creationTime).toISOString()
          : new Date().toISOString(),
      }
    })
  },
})

export const getHrCase = query({
  args: { clerkOrgId: v.string(), caseId: v.id('hrCases') },
  handler: async (ctx, { clerkOrgId, caseId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, HR_ROLES)
    const hrCase = await ctx.db.get(caseId)
    if (!hrCase) throw new ConvexError('Case not found.')
    assertTenantDoc(hrCase, tenantId)

    // Resolve subject name
    let subjectName = 'Unknown'
    if (hrCase.subjectType === 'employee') {
      const profiles = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      const profile = profiles.find((p) => p.clerkUserId === hrCase.subjectId)
      if (profile) subjectName = profile.displayName
    } else if (hrCase.subjectType === 'candidate') {
      const candidate = await ctx.db.get(hrCase.subjectId as Id<'candidates'>)
      if (candidate) subjectName = candidate.displayName
    }

    // Resolve owner name
    let ownerName = 'Unassigned'
    if (hrCase.ownerMemberId) {
      const owner = await ctx.db.get(hrCase.ownerMemberId)
      if (owner) ownerName = owner.displayName
    }

    return { ...hrCase, subjectName, ownerName }
  },
})

export const updateHrCase = mutation({
  args: {
    clerkOrgId: v.string(),
    caseId: v.id('hrCases'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, HR_ROLES)

    const hrCase = await ctx.db.get(args.caseId)
    if (!hrCase) {
      throw new ConvexError('Case not found.')
    }
    assertTenantDoc(hrCase, tenantId)

    if (!isValidCaseStatus(args.status)) {
      throw new ConvexError(
        `Invalid status. Must be one of: ${CASE_STATUSES.join(', ')}.`,
      )
    }

    const patch: { status: CaseStatus; resolvedAt?: string } = { status: args.status }
    if (args.status === 'resolved' || args.status === 'closed') {
      patch.resolvedAt = new Date().toISOString()
    }

    await ctx.db.patch(args.caseId, patch)

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'hrCase.status_updated',
      previousStatus: hrCase.status,
      nextStatus: args.status,
      metadata: { caseId: args.caseId as string },
    })

    return args.caseId
  },
})

export const hrDashboardStats = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, HR_ROLES)

    const candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()

    const pipelineStatuses = new Set([
      'invited',
      'application_draft',
      'applied',
      'submitted',
      'hr_review',
    ])
    const inPipeline = candidates.filter((c) => pipelineStatuses.has(c.status)).length

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()
    const activeEmployees = members.length

    const cases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .collect()
    const openCases = cases.filter((c) => c.status === 'open').length

    const docs = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_expires_at', (q) => q.eq('tenantId', tenantId))
      .collect()
    const now = Date.now()
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000
    const expiringCredentials = docs.filter((d) => {
      if (!d.expiresAt) return false
      const expiryMs = new Date(d.expiresAt).getTime()
      return expiryMs <= thirtyDaysFromNow
    }).length

    return {
      inPipeline,
      activeEmployees,
      expiringCredentials,
      openCases,
    }
  },
})

export const listHrCasesForSubject = query({
  args: {
    clerkOrgId: v.string(),
    subjectType: v.string(),
    subjectId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, HR_ROLES)

    const cases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    return cases.filter(
      (c) => c.subjectType === args.subjectType && c.subjectId === args.subjectId,
    )
  },
})

export const checkExpiringCredentials = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000
    const year = new Date().getFullYear()

    const tenants = await ctx.db.query('tenants').collect()

    for (const tenant of tenants) {
      const docs = await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_expires_at', (q) => q.eq('tenantId', tenant._id))
        .collect()

      // Dedup on the same open-case flag used by checkAndFlagIssues so the
      // two daily crons never create a second case for the same document,
      // regardless of which one runs first.
      const allCases = await ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenant._id))
        .collect()
      const openCases: OpenCaseRef[] = allCases.filter(
        (c) => c.status === 'open' || c.status === 'in_review',
      )

      let sequence = allCases.length
      const autoCreatedAt = new Date().toISOString()

      for (const doc of docs) {
        if (!doc.expiresAt) continue
        const expiryMs = new Date(doc.expiresAt).getTime()
        if (expiryMs > thirtyDaysFromNow) continue

        if (hasOpenFlag(openCases, doc.subjectId, 'expiring_document')) {
          continue
        }

        const isExpired = expiryMs < now
        const daysUntilExpiry = Math.ceil(
          Math.abs(expiryMs - now) / (24 * 60 * 60 * 1000),
        )

        sequence += 1
        const caseNumber = `HR-${year}-${String(sequence).padStart(3, '0')}`

        await ctx.db.insert('hrCases', {
          tenantId: tenant._id,
          caseNumber,
          subjectType: doc.subjectType,
          subjectId: doc.subjectId,
          category: 'credentialing',
          title: `${doc.category} ${isExpired ? 'expired' : 'expiring soon'} (${daysUntilExpiry} days)`,
          status: 'open',
          description: `The ${doc.category} for this employee ${isExpired ? 'expired' : 'will expire'} on ${doc.expiresAt}. Please follow up to renew.`,
          flagType: 'expiring_document',
          autoCreatedAt,
          createdAt: autoCreatedAt,
        })
        openCases.push({
          subjectId: doc.subjectId,
          flagType: 'expiring_document',
        })

        // Best-effort caregiver notification for the expiring credential.
        // subjectId may reference an employeeProfiles/candidates doc id or a
        // clerkUserId directly (the repo uses both conventions); resolve the
        // clerkUserId behind it. When no clerkUserId resolves, case creation
        // is unaffected and no notification is sent.
        let clerkUserId: string | undefined
        if (doc.subjectType === 'employee') {
          const profile = await ctx.db.get(
            doc.subjectId as Id<'employeeProfiles'>,
          )
          clerkUserId = profile?.clerkUserId
        } else if (doc.subjectType === 'candidate') {
          const candidate = await ctx.db.get(doc.subjectId as Id<'candidates'>)
          clerkUserId = candidate?.clerkUserId
        }
        if (!clerkUserId) {
          const member = await ctx.db
            .query('tenantMembers')
            .withIndex('by_tenant_user', (q) =>
              q.eq('tenantId', tenant._id).eq('clerkUserId', doc.subjectId),
            )
            .unique()
          clerkUserId = member?.clerkUserId
        }
        if (clerkUserId) {
          await ctx.scheduler.runAfter(
            0,
            internal._utils.notifications.notifyComplianceExpiring,
            {
              tenantId: tenant._id,
              clerkUserId,
              credentialName: doc.category,
              category: doc.category,
              expiresAt: doc.expiresAt,
            },
          )
        }
      }
    }
  },
})

const DAY_MS = 24 * 60 * 60 * 1000

type OpenCaseRef = Pick<Doc<'hrCases'>, 'subjectId' | 'flagType'>

type CaseDraft = {
  subjectType: string
  subjectId: string
  category: string
  title: string
  description: string
  flagType: string
}

function hasOpenFlag(
  existingOpenCases: OpenCaseRef[],
  subjectId: string,
  flagType: string,
) {
  return existingOpenCases.some(
    (c) => c.subjectId === subjectId && c.flagType === flagType,
  )
}

function daysSince(isoDate: string, now: number) {
  return Math.floor((now - new Date(isoDate).getTime()) / DAY_MS)
}

async function checkExpiringDocuments(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const thirtyDaysFromNow = now + 30 * DAY_MS
  const drafts: CaseDraft[] = []

  const docs = await ctx.db
    .query('documentArchiveItems')
    .withIndex('by_tenant_expires_at', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const doc of docs) {
    if (!doc.expiresAt) continue
    const expiryMs = new Date(doc.expiresAt).getTime()
    if (expiryMs > thirtyDaysFromNow) continue
    if (hasOpenFlag(existingOpenCases, doc.subjectId, 'expiring_document')) {
      continue
    }

    const isExpired = expiryMs < now
    const daysUntilExpiry = Math.ceil(Math.abs(expiryMs - now) / DAY_MS)
    drafts.push({
      subjectType: doc.subjectType,
      subjectId: doc.subjectId,
      category: 'credentialing',
      title: `${doc.category} ${isExpired ? 'expired' : 'expiring soon'} (${daysUntilExpiry} days)`,
      description: `The ${doc.category} for this ${doc.subjectType} ${isExpired ? 'expired' : 'will expire'} on ${doc.expiresAt}. Please follow up to renew.`,
      flagType: 'expiring_document',
    })
  }

  return drafts
}

async function checkExpiringTraining(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const thirtyDaysFromNow = now + 30 * DAY_MS
  const drafts: CaseDraft[] = []

  const completions = await ctx.db
    .query('platformTrainingCompletions')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const completion of completions) {
    if (!completion.expiresAt) continue
    const expiryMs = new Date(completion.expiresAt).getTime()
    if (expiryMs > thirtyDaysFromNow) continue
    if (
      hasOpenFlag(existingOpenCases, completion.clerkUserId, 'training_expiry')
    ) {
      continue
    }

    const isExpired = expiryMs < now
    const daysUntilExpiry = Math.ceil((expiryMs - now) / DAY_MS)
    drafts.push({
      subjectType: 'employee',
      subjectId: completion.clerkUserId,
      category: 'training',
      title: `Training '${completion.trainingId}' ${isExpired ? 'expired' : 'expiring soon'} (${daysUntilExpiry} days)`,
      description: `The training '${completion.trainingId}' completed on ${completion.completedAt} ${isExpired ? 'expired' : 'will expire'} on ${completion.expiresAt}. Please schedule recertification.`,
      flagType: 'training_expiry',
    })
  }

  return drafts
}

const BG_CHECK_PROBLEM_STATUSES = [
  'consider',
  'suspended',
  'expired',
  'error',
  'scan_failed',
]

async function checkBackgroundCheckIssues(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const drafts: CaseDraft[] = []

  const checks = await ctx.db
    .query('backgroundChecks')
    .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const check of checks) {
    if (!BG_CHECK_PROBLEM_STATUSES.includes(check.status)) continue
    if (hasOpenFlag(existingOpenCases, check.candidateId, 'bg_check_concern')) {
      continue
    }

    drafts.push({
      subjectType: 'candidate',
      subjectId: check.candidateId,
      category: 'credentialing',
      title: `Background check flagged: ${check.status}`,
      description: `The background check (provider: ${check.provider}, package: ${check.package}) for this candidate has status '${check.status}' and needs HR review.`,
      flagType: 'bg_check_concern',
    })
  }

  return drafts
}

const PIPELINE_STALL_THRESHOLDS_DAYS: Record<string, number> = {
  invited: 7,
  application_draft: 14,
  submitted: 5,
  hr_review: 5,
}

async function checkCandidatePipelineStalls(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const drafts: CaseDraft[] = []

  const candidates = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const candidate of candidates) {
    const thresholdDays = PIPELINE_STALL_THRESHOLDS_DAYS[candidate.status]
    if (thresholdDays === undefined) continue
    const daysInStatus = daysSince(candidate.createdAt, now)
    if (daysInStatus <= thresholdDays) continue
    if (hasOpenFlag(existingOpenCases, candidate._id, 'pipeline_stall')) {
      continue
    }

    drafts.push({
      subjectType: 'candidate',
      subjectId: candidate._id,
      category: 'recruitment',
      title: `Candidate stuck in '${candidate.status}' for ${daysInStatus} days`,
      description: `${candidate.displayName} (${candidate.email}) has been in status '${candidate.status}' for ${daysInStatus} days (threshold: ${thresholdDays} days). Please follow up.`,
      flagType: 'pipeline_stall',
    })
  }

  return drafts
}

async function checkApplicationRejections(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const drafts: CaseDraft[] = []

  const applications = await ctx.db
    .query('applications')
    .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const application of applications) {
    if (
      hasOpenFlag(
        existingOpenCases,
        application.candidateId,
        'application_rejection',
      )
    ) {
      continue
    }

    if (application.decision === 'rejected' && !application.hrNotes) {
      drafts.push({
        subjectType: 'candidate',
        subjectId: application.candidateId,
        category: 'recruitment',
        title: 'Application rejected without HR notes',
        description: `This application was rejected${application.decisionAt ? ` on ${application.decisionAt}` : ''} but has no HR notes explaining the decision. Please document the rejection reason.`,
        flagType: 'application_rejection',
      })
      continue
    }

    if (application.decision === 'needs_correction') {
      const pendingSince = application.decisionAt ?? application.submittedAt
      if (!pendingSince) continue
      const daysPending = daysSince(pendingSince, now)
      if (daysPending <= 7) continue
      drafts.push({
        subjectType: 'candidate',
        subjectId: application.candidateId,
        category: 'recruitment',
        title: `Application correction pending for ${daysPending} days`,
        description: `This application has been in 'needs_correction' for ${daysPending} days (since ${pendingSince}). Please follow up with the candidate.`,
        flagType: 'application_rejection',
      })
    }
  }

  return drafts
}

async function checkShiftIssues(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const drafts: CaseDraft[] = []

  const shifts = await ctx.db
    .query('shifts')
    .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const shift of shifts) {
    if (hasOpenFlag(existingOpenCases, shift._id, 'shift_issue')) continue

    if (shift.status === 'needs_correction') {
      const daysPending = daysSince(shift.scheduledStart, now)
      if (daysPending > 3) {
        drafts.push({
          subjectType: 'shift',
          subjectId: shift._id,
          category: 'scheduling',
          title: `Shift needs correction for ${daysPending} days`,
          description: `The shift scheduled ${shift.scheduledStart} - ${shift.scheduledEnd} for caregiver ${shift.caregiverId} has been in 'needs_correction' for ${daysPending} days. Please resolve the correction.`,
          flagType: 'shift_issue',
        })
        continue
      }
    }

    const scheduledEndMs = new Date(shift.scheduledEnd).getTime()
    if (scheduledEndMs >= now) continue

    if (shift.status === 'scheduled' && !shift.clockInAt) {
      drafts.push({
        subjectType: 'shift',
        subjectId: shift._id,
        category: 'scheduling',
        title: 'Missed clock-in for past shift',
        description: `The shift scheduled ${shift.scheduledStart} - ${shift.scheduledEnd} for caregiver ${shift.caregiverId} ended without a clock-in. Please verify whether the shift took place.`,
        flagType: 'shift_issue',
      })
    } else if (shift.status === 'in_progress' && !shift.clockOutAt) {
      drafts.push({
        subjectType: 'shift',
        subjectId: shift._id,
        category: 'scheduling',
        title: 'Missed clock-out for past shift',
        description: `The shift scheduled ${shift.scheduledStart} - ${shift.scheduledEnd} for caregiver ${shift.caregiverId} ended without a clock-out. Please follow up to complete the time record.`,
        flagType: 'shift_issue',
      })
    }
  }

  return drafts
}

async function checkUnverifiedDocuments(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  existingOpenCases: OpenCaseRef[],
): Promise<CaseDraft[]> {
  const now = Date.now()
  const drafts: CaseDraft[] = []

  const docs = await ctx.db
    .query('documentArchiveItems')
    .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
    .collect()

  for (const doc of docs) {
    if (doc.status !== 'pending') continue
    const daysPending = daysSince(doc.createdAt, now)
    if (daysPending <= 7) continue
    if (hasOpenFlag(existingOpenCases, doc.subjectId, 'unverified_doc')) {
      continue
    }

    drafts.push({
      subjectType: doc.subjectType,
      subjectId: doc.subjectId,
      category: 'documentation',
      title: `Document pending verification for ${daysPending} days (${doc.category})`,
      description: `The ${doc.category} for this ${doc.subjectType} was uploaded on ${doc.createdAt} and has been pending verification for ${daysPending} days. Please verify or reject it.`,
      flagType: 'unverified_doc',
    })
  }

  return drafts
}

async function flagIssuesForTenant(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
): Promise<number> {
  const year = new Date().getFullYear()
  let created = 0

  const allCases = await ctx.db
    .query('hrCases')
    .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
    .collect()
  const openCases: OpenCaseRef[] = allCases.filter(
    (c) => c.status === 'open' || c.status === 'in_review',
  )

  const drafts: CaseDraft[] = [
    ...(await checkExpiringDocuments(ctx, tenantId, openCases)),
    ...(await checkExpiringTraining(ctx, tenantId, openCases)),
    ...(await checkBackgroundCheckIssues(ctx, tenantId, openCases)),
    ...(await checkCandidatePipelineStalls(ctx, tenantId, openCases)),
    ...(await checkApplicationRejections(ctx, tenantId, openCases)),
    ...(await checkShiftIssues(ctx, tenantId, openCases)),
    ...(await checkUnverifiedDocuments(ctx, tenantId, openCases)),
  ]

  let sequence = allCases.length
  const autoCreatedAt = new Date().toISOString()
  for (const draft of drafts) {
    if (hasOpenFlag(openCases, draft.subjectId, draft.flagType)) continue
    sequence += 1
    await ctx.db.insert('hrCases', {
      tenantId,
      caseNumber: `HR-${year}-${String(sequence).padStart(3, '0')}`,
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      category: draft.category,
      title: draft.title,
      status: 'open',
      description: draft.description,
      flagType: draft.flagType,
      autoCreatedAt,
      createdAt: autoCreatedAt,
    })
    openCases.push({
      subjectId: draft.subjectId,
      flagType: draft.flagType,
    })
    created += 1
  }

  return created
}

export const triggerFlagCheck = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, HR_ROLES)
    const created = await flagIssuesForTenant(ctx, tenantId)
    return { created }
  },
})

export const checkAndFlagIssues = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db.query('tenants').collect()
    let created = 0

    for (const tenant of tenants) {
      created += await flagIssuesForTenant(ctx, tenant._id)
    }

    return { created }
  },
})
