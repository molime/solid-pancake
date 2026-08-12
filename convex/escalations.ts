import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { ConvexError } from 'convex/values'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'

const MANAGER_ROLES: Array<'org:admin' | 'org:coordinator' | 'org:hr'> = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Dedup helper shared by createEscalation and checkEscalations (a mutation
 * cannot runMutation an internal mutation, so the logic lives in a plain
 * function both call).
 */
async function findUnresolvedEscalation(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  subjectId: string,
  escalationLevel: number,
): Promise<Doc<'escalations'> | undefined> {
  const atLevel = await ctx.db
    .query('escalations')
    .withIndex('by_tenant_level', (q) =>
      q.eq('tenantId', tenantId).eq('escalationLevel', escalationLevel),
    )
    .collect()
  return atLevel.find((e) => e.subjectId === subjectId && !e.resolvedAt)
}

/**
 * Any escalation (resolved or not) for the subject at the level. The cron
 * uses this so a resolved escalation is not re-created on the next daily run
 * while the underlying case is still open — resolving would otherwise be
 * undone every 24 hours.
 */
async function findAnyEscalation(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  subjectId: string,
  escalationLevel: number,
): Promise<Doc<'escalations'> | undefined> {
  const atLevel = await ctx.db
    .query('escalations')
    .withIndex('by_tenant_level', (q) =>
      q.eq('tenantId', tenantId).eq('escalationLevel', escalationLevel),
    )
    .collect()
  return atLevel.find((e) => e.subjectId === subjectId)
}

export const createEscalation = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    subjectType: v.string(),
    subjectId: v.string(),
    escalationLevel: v.number(),
    escalatedTo: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await findUnresolvedEscalation(
      ctx,
      args.tenantId,
      args.subjectId,
      args.escalationLevel,
    )
    if (existing) return existing._id

    return ctx.db.insert('escalations', {
      tenantId: args.tenantId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      escalationLevel: args.escalationLevel,
      escalatedTo: args.escalatedTo,
      reason: args.reason,
      createdAt: new Date().toISOString(),
    })
  },
})

export const listEscalations = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, MANAGER_ROLES)

    // by_tenant_unresolved indexes resolvedAt, which is absent on unresolved
    // rows (Convex excludes missing fields from indexes), so unresolved rows
    // are selected by tenant prefix and filtered in memory instead.
    const escalations = await ctx.db
      .query('escalations')
      .withIndex('by_tenant_level', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    return escalations.filter((e) => !e.resolvedAt)
  },
})

export const resolveEscalation = mutation({
  args: {
    clerkOrgId: v.string(),
    escalationId: v.id('escalations'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      MANAGER_ROLES,
    )

    const escalation = await ctx.db.get(args.escalationId)
    if (!escalation) throw new ConvexError('Escalation not found.')
    assertTenantDoc(escalation, tenantId)

    if (!escalation.resolvedAt) {
      await ctx.db.patch(args.escalationId, {
        resolvedAt: new Date().toISOString(),
      })

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'escalation_resolved',
        metadata: {
          escalationId: args.escalationId as string,
          subjectType: escalation.subjectType,
          subjectId: escalation.subjectId,
          escalationLevel: escalation.escalationLevel,
        },
      })
    }
    return args.escalationId
  },
})

/**
 * Daily cron entry point. Walks every tenant's unresolved HR cases and
 * escalates by age: 7+ days -> level 1 to org:coordinator, 14+ days ->
 * level 2 to org:admin, 30+ days -> level 3 to org:hr.
 *
 * escalatedTo stores the ROLE string (not a clerkUserId) because the cron
 * has no specific user in mind; when a concrete tenant member holding that
 * role exists, the first match also receives a staff notification.
 */
export const checkEscalations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const tenants = await ctx.db.query('tenants').collect()
    let created = 0

    for (const tenant of tenants) {
      const cases = await ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenant._id))
        .collect()
      const openCases = cases.filter(
        (c) => c.status === 'open' || c.status === 'in_review',
      )

      for (const hrCase of openCases) {
        const ageDays = Math.floor(
          (now - new Date(hrCase.createdAt).getTime()) / DAY_MS,
        )

        let escalationLevel: number | null = null
        let escalatedTo: string | null = null
        if (ageDays >= 30) {
          escalationLevel = 3
          escalatedTo = 'org:hr'
        } else if (ageDays >= 14) {
          escalationLevel = 2
          escalatedTo = 'org:admin'
        } else if (ageDays >= 7) {
          escalationLevel = 1
          escalatedTo = 'org:coordinator'
        }
        if (escalationLevel === null || escalatedTo === null) continue

        const existing = await findAnyEscalation(
          ctx,
          tenant._id,
          hrCase._id as string,
          escalationLevel,
        )
        if (existing) continue

        const reason = `HR case ${hrCase.caseNumber ?? hrCase._id} ('${hrCase.title}') unresolved for ${ageDays} days.`
        const createdAt = new Date().toISOString()
        const escalationId = await ctx.db.insert('escalations', {
          tenantId: tenant._id,
          subjectType: 'hrCase',
          subjectId: hrCase._id as string,
          escalationLevel,
          escalatedTo,
          reason,
          createdAt,
        })
        created += 1

        // Recorded directly (not via internal.audit.record, which requires an
        // authenticated identity this cron context does not have).
        await ctx.db.insert('auditEvents', {
          tenantId: tenant._id,
          actorId: 'system',
          actorRole: 'system',
          action: 'escalation_created',
          metadata: {
            escalationId: escalationId as string,
            hrCaseId: hrCase._id as string,
            escalationLevel,
            escalatedTo,
          },
          createdAt,
        })

        // Notify a concrete member holding the target role when one resolves;
        // otherwise the escalation row + audit event above are the record.
        const target = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_role', (q) =>
            q
              .eq('tenantId', tenant._id)
              .eq('role', escalatedTo as 'org:coordinator' | 'org:admin' | 'org:hr'),
          )
          .first()
        if (target) {
          await ctx.scheduler.runAfter(
            0,
            internal._utils.notifications.sendStaffNotification,
            {
              tenantId: tenant._id,
              clerkUserId: target.clerkUserId,
              type: 'escalation',
              message: reason,
              metadata: {
                escalationId: escalationId as string,
                hrCaseId: hrCase._id as string,
                escalationLevel,
              },
            },
          )
        }
      }
    }

    return { created }
  },
})
