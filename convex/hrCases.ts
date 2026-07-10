import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'


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

    return ctx.db.insert('hrCases', {
      tenantId,
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
        subjectType: c.subjectType,
        subjectId: c.subjectId,
        subjectName,
        category: c.category,
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

    return {
      inPipeline,
      activeEmployees,
      expiringCredentials: 0,
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
