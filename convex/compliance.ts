import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

const COMPLIANCE_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

export const EXPIRING_SOON_DAYS = 30

/**
 * Shared counting math for document compliance, built on documentArchiveItems
 * (status vocabulary: 'active' | 'verified' | 'rejected' — see
 * documentArchive.ts). Expiration is derived from expiresAt:
 * - expired:  expiresAt in the past
 * - expiring: expiresAt within the next 30 days (and not expired)
 * - compliant: status 'verified' and not expired
 * - blocked:  status 'rejected' or expired
 */
export function computeComplianceCounts(
  items: Pick<Doc<'documentArchiveItems'>, 'status' | 'expiresAt'>[],
  now = new Date(),
) {
  const nowIso = now.toISOString()
  const expiringCutoff = new Date(
    now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  let compliant = 0
  let expiring = 0
  let expired = 0
  let blocked = 0

  for (const item of items) {
    const isExpired = !!item.expiresAt && item.expiresAt < nowIso
    const isExpiring =
      !isExpired && !!item.expiresAt && item.expiresAt <= expiringCutoff
    if (isExpired) expired += 1
    if (isExpiring) expiring += 1
    if (item.status === 'verified' && !isExpired) compliant += 1
    if (item.status === 'rejected' || isExpired) blocked += 1
  }

  return { compliant, expiring, expired, blocked, total: items.length }
}

export const getComplianceOverview = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      COMPLIANCE_ROLES,
    )

    const items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()

    return computeComplianceCounts(items)
  },
})

export const listComplianceItems = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      COMPLIANCE_ROLES,
    )

    const items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    // subjectId may reference employeeProfiles or candidates — resolve the
    // display name best-effort, falling back to the raw subjectId.
    const employeeProfiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()

    const names = new Map<string, string>()
    // Also index by clerkUserId and tenantMembers for robust name resolution
    const tenantMembers = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()
    for (const member of tenantMembers) {
      if (member.clerkUserId) names.set(member.clerkUserId, member.displayName)
    }
    for (const profile of employeeProfiles) {
      names.set(profile._id as string, profile.displayName); if (profile.clerkUserId) names.set(profile.clerkUserId, profile.displayName)
    }
    for (const candidate of candidates) {
      names.set(candidate._id as string, candidate.displayName)
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const expiringCutoff = new Date(
      now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    return items.map((item) => {
      let computedStatus: 'compliant' | 'expiring' | 'expired' = 'compliant'
      if (item.expiresAt && item.expiresAt < nowIso) {
        computedStatus = 'expired'
      } else if (item.expiresAt && item.expiresAt <= expiringCutoff) {
        computedStatus = 'expiring'
      }

      return {
        itemId: item._id,
        subjectName: names.get(item.subjectId) ?? item.subjectId,
        category: item.category,
        status: item.status,
        expiresAt: item.expiresAt,
        computedStatus,
      }
    })
  },
})

/**
 * Determines whether a caregiver is blocked from billing by compliance issues.
 *
 * documentArchiveItems for employees use subjectType 'employee' with
 * subjectId = employeeProfiles doc id (matching listComplianceItems name
 * resolution). A caregiver with NO employeeProfiles row therefore has zero
 * archive items and can only be blocked by the missing-required-credential
 * branch below.
 */
export async function checkComplianceBlocked(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const profile = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()

  let items = profile
    ? await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_subject', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('subjectType', 'employee')
            .eq('subjectId', profile._id as string),
        )
        .collect()
    : []
  // Also try by clerkUserId (some archive items use that instead of profile._id)
  if (profile?.clerkUserId) {
    const itemsByClerkId = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_subject', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('subjectType', 'employee')
          .eq('subjectId', profile.clerkUserId!),
      )
      .collect()
    items = [...items, ...itemsByClerkId]
  }

  const nowIso = new Date().toISOString()

  for (const item of items) {
    if (item.overrideStatus === 'overridden') continue
    if (item.status === 'rejected') {
      return { blocked: true, reason: `Rejected credential: ${item.category}` }
    }
    if (item.expiresAt && item.expiresAt < nowIso) {
      return { blocked: true, reason: `Expired credential: ${item.category}` }
    }
  }

  const requirements = await ctx.db
    .query('credentialRequirements')
    .withIndex('by_tenant_role', (q) =>
      q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
    )
    .collect()

  const categories = new Set(items.map((item) => item.category))
  for (const requirement of requirements) {
    if (requirement.isRequired && !categories.has(requirement.category)) {
      return {
        blocked: true,
        reason: `Missing required credential: ${requirement.label}`,
      }
    }
  }

  return { blocked: false }
}

export const overrideComplianceBlock = mutation({
  args: {
    clerkOrgId: v.string(),
    documentArchiveItemId: v.id('documentArchiveItems'),
    reason: v.string(),
    newExpiry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:hr'],
    )

    const item = await ctx.db.get(args.documentArchiveItemId)
    if (!item) throw new ConvexError('Document archive item not found.')
    assertTenantDoc(item, tenantId)

    if (!args.reason.trim()) {
      throw new ConvexError('An override reason is required.')
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.documentArchiveItemId, {
      overrideStatus: 'overridden',
      overrideReason: args.reason,
      overrideBy: identity.subject,
      overrideAt: now,
      ...(args.newExpiry ? { expiresAt: args.newExpiry } : {}),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'compliance_override_applied',
      metadata: {
        documentArchiveItemId: args.documentArchiveItemId as string,
        reason: args.reason,
        newExpiry: args.newExpiry,
      },
    })

    return args.documentArchiveItemId
  },
})

/**
 * Shared per-employee compliance-gap logic, used by the complianceGaps query
 * and by auditReadiness.getReport/exportCsv (Convex queries cannot call other
 * queries, so the aggregation lives in this plain function).
 */
export async function computeComplianceGaps(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId?: string,
) {
  let profiles = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .collect()

  if (clerkUserId) {
    profiles = profiles.filter((p) => p.clerkUserId === clerkUserId)
  }

  const requirements = await ctx.db
    .query('credentialRequirements')
    .withIndex('by_tenant_role', (q) =>
      q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
    )
    .collect()
  const labelByCategory = new Map(
    requirements.map((r) => [r.category, r.label]),
  )

  const nowIso = new Date().toISOString()

  const gaps = []
  for (const profile of profiles) {
    const items = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_subject', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('subjectType', 'employee')
          .eq('subjectId', profile._id as string),
      )
      .collect()
    // Also try by clerkUserId (some archive items use that instead of profile._id)
    const profileClerkUserId = profile.clerkUserId
    const itemsByClerkId = profileClerkUserId
      ? await ctx.db
          .query('documentArchiveItems')
          .withIndex('by_tenant_subject', (q) =>
            q
              .eq('tenantId', tenantId)
              .eq('subjectType', 'employee')
              .eq('subjectId', profileClerkUserId),
          )
          .collect()
      : []
    const allItems = [...items, ...itemsByClerkId]

    const categories = new Set(allItems.map((item) => item.category))
    const missing = requirements
      .filter((r) => r.isRequired && !categories.has(r.category))
      .map((r) => r.label)
    const expired = allItems
      .filter(
        (item) =>
          item.overrideStatus !== 'overridden' &&
          item.expiresAt &&
          item.expiresAt < nowIso,
      )
      .map((item) => labelByCategory.get(item.category) ?? item.category)
    const overridden = allItems
      .filter((item) => item.overrideStatus === 'overridden')
      .map((item) => labelByCategory.get(item.category) ?? item.category)
    // Raw categories alongside the display labels so clients can reliably
    // match overridden items against listComplianceItems rows (labels are
    // requirement-defined and cannot be reconstructed client-side).
    const overriddenCategories = allItems
      .filter((item) => item.overrideStatus === 'overridden')
      .map((item) => item.category)

    gaps.push({
      clerkUserId: profile.clerkUserId ?? null,
      displayName: profile.displayName,
      missing,
      expired,
      overridden,
      overriddenCategories,
    })
  }

  return gaps
}

export const complianceGaps = query({
  args: { clerkOrgId: v.string(), clerkUserId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      COMPLIANCE_ROLES,
    )

    return computeComplianceGaps(ctx, tenantId, args.clerkUserId)
  },
})

export const listCredentialRequirements = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      COMPLIANCE_ROLES,
    )

    return ctx.db
      .query('credentialRequirements')
      .withIndex('by_tenant_role', (q) => q.eq('tenantId', tenantId))
      .collect()
  },
})

export const upsertCredentialRequirement = mutation({
  args: {
    clerkOrgId: v.string(),
    requirementId: v.optional(v.id('credentialRequirements')),
    role: v.string(),
    category: v.string(),
    label: v.string(),
    isRequired: v.boolean(),
    expiryMonths: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (args.requirementId) {
      const existing = await ctx.db.get(args.requirementId)
      if (!existing) throw new ConvexError('Credential requirement not found.')
      assertTenantDoc(existing, tenantId)
      await ctx.db.patch(args.requirementId, {
        role: args.role,
        category: args.category,
        label: args.label,
        isRequired: args.isRequired,
        expiryMonths: args.expiryMonths,
      })
      return args.requirementId
    }

    return ctx.db.insert('credentialRequirements', {
      tenantId,
      role: args.role,
      category: args.category,
      label: args.label,
      isRequired: args.isRequired,
      expiryMonths: args.expiryMonths,
    })
  },
})

export const deleteCredentialRequirement = mutation({
  args: {
    clerkOrgId: v.string(),
    requirementId: v.id('credentialRequirements'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db.get(args.requirementId)
    if (!existing) throw new ConvexError('Credential requirement not found.')
    assertTenantDoc(existing, tenantId)

    await ctx.db.delete(args.requirementId)
    return args.requirementId
  },
})
