import { v, ConvexError } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Corrective action plans (docs/07 §3.6, gap row E3): findings from regional
// center / DDS audits or internal review move open → submitted → verified on a
// 30-day cycle. 'overdue' is computed (dueAt < now && status 'open'), never
// stored; overdue CAPs are surfaced as deduplicated HR cases by the daily cron.
const CAP_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

export const CAP_DEFAULT_DUE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

const capSourceValidator = v.union(
  v.literal('regional_center'),
  v.literal('dds'),
  v.literal('internal'),
)

type CorrectiveAction = Doc<'correctiveActions'>

function isOverdue(cap: Pick<CorrectiveAction, 'dueAt' | 'status'>, nowIso: string) {
  return cap.status === 'open' && cap.dueAt < nowIso
}

function requireNonBlank(value: string, label: string) {
  if (!value.trim()) throw new ConvexError(`${label} is required.`)
}

async function loadCorrectiveAction(
  ctx: QueryCtx | MutationCtx,
  correctiveActionId: Id<'correctiveActions'>,
  tenantId: Id<'tenants'>,
) {
  const cap = await ctx.db.get(correctiveActionId)
  if (!cap) throw new ConvexError('Corrective action not found.')
  assertTenantDoc(cap, tenantId)
  return cap
}

export const createCorrectiveAction = mutation({
  args: {
    clerkOrgId: v.string(),
    source: capSourceValidator,
    finding: v.string(),
    dueAt: v.optional(v.string()), // ISO — defaults to now + 30 days
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, CAP_ROLES)

    requireNonBlank(args.finding, 'Finding')
    const now = new Date().toISOString()
    const dueAt =
      args.dueAt ?? new Date(Date.now() + CAP_DEFAULT_DUE_DAYS * DAY_MS).toISOString()
    if (Number.isNaN(new Date(dueAt).getTime())) {
      throw new ConvexError('Due date must be a valid date.')
    }

    const capId = await ctx.db.insert('correctiveActions', {
      tenantId,
      source: args.source,
      finding: args.finding,
      dueAt,
      status: 'open',
      createdAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'corrective_action_created',
      metadata: {
        correctiveActionId: capId as string,
        source: args.source,
        dueAt,
      },
    })

    return capId
  },
})

/**
 * Marks the CAP's response as submitted to the finding source, optionally
 * linking an archived document as evidence.
 */
export const submitCorrectiveActionEvidence = mutation({
  args: {
    clerkOrgId: v.string(),
    correctiveActionId: v.id('correctiveActions'),
    evidenceItemId: v.optional(v.id('documentArchiveItems')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, CAP_ROLES)
    const cap = await loadCorrectiveAction(ctx, args.correctiveActionId, tenantId)

    if (cap.status === 'verified') {
      throw new ConvexError('This corrective action is already verified.')
    }
    if (cap.status === 'submitted') {
      throw new ConvexError('This corrective action was already submitted.')
    }

    if (args.evidenceItemId) {
      const item = await ctx.db.get(args.evidenceItemId)
      if (!item) throw new ConvexError('Evidence document not found.')
      assertTenantDoc(item, tenantId)
    }

    await ctx.db.patch(args.correctiveActionId, {
      status: 'submitted',
      evidenceItemId: args.evidenceItemId ?? cap.evidenceItemId,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'corrective_action_submitted',
      previousStatus: cap.status,
      nextStatus: 'submitted',
      metadata: {
        correctiveActionId: args.correctiveActionId as string,
        evidenceItemId: args.evidenceItemId as string | undefined,
      },
    })

    return args.correctiveActionId
  },
})

export const verifyCorrectiveAction = mutation({
  args: {
    clerkOrgId: v.string(),
    correctiveActionId: v.id('correctiveActions'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      CAP_ROLES,
    )
    const cap = await loadCorrectiveAction(ctx, args.correctiveActionId, tenantId)

    if (cap.status === 'verified') {
      throw new ConvexError('This corrective action is already verified.')
    }
    if (cap.status !== 'submitted') {
      throw new ConvexError(
        'Submit the corrective action response before verifying it.',
      )
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.correctiveActionId, {
      status: 'verified',
      verifiedBy: identity.subject,
      verifiedAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'corrective_action_verified',
      previousStatus: cap.status,
      nextStatus: 'verified',
      metadata: { correctiveActionId: args.correctiveActionId as string },
    })

    return args.correctiveActionId
  },
})

export const listCorrectiveActions = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, CAP_ROLES)

    const caps = await ctx.db
      .query('correctiveActions')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .collect()

    const nowIso = new Date().toISOString()
    return Promise.all(
      caps.map(async (cap) => {
        let evidenceFileName: string | null = null
        if (cap.evidenceItemId) {
          const item = await ctx.db.get(cap.evidenceItemId)
          const file = item ? await ctx.db.get(item.fileId) : null
          evidenceFileName = file?.fileName ?? null
        }
        return {
          ...cap,
          overdue: isOverdue(cap, nowIso),
          evidenceFileName,
        }
      }),
    )
  },
})

type OpenCaseRef = Pick<Doc<'hrCases'>, 'subjectId' | 'flagType'>

function hasOpenFlag(
  existingOpenCases: OpenCaseRef[],
  subjectId: string,
  flagType: string,
) {
  return existingOpenCases.some(
    (c) => c.subjectId === subjectId && c.flagType === flagType,
  )
}

/**
 * Daily cron: open CAPs past their due date open one deduplicated HR case per
 * CAP (flagType 'cap_overdue', same dedup pattern as hrCases.ts /
 * incidents.ts), plus a notifications row for every org:admin/org:hr member.
 */
export const checkOverdueCaps = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowIso = new Date().toISOString()
    const year = new Date().getFullYear()
    let created = 0

    const tenants = await ctx.db.query('tenants').collect()

    for (const tenant of tenants) {
      const caps = await ctx.db
        .query('correctiveActions')
        .withIndex('by_tenant_due', (q) =>
          q.eq('tenantId', tenant._id).lt('dueAt', nowIso),
        )
        .collect()

      const allCases = await ctx.db
        .query('hrCases')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenant._id))
        .collect()
      const openCases: OpenCaseRef[] = allCases.filter(
        (c) => c.status === 'open' || c.status === 'in_review',
      )

      const staff = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
        .collect()
      const adminAndHr = staff.filter(
        (member) => member.role === 'org:admin' || member.role === 'org:hr',
      )

      let sequence = allCases.length
      const autoCreatedAt = new Date().toISOString()

      for (const cap of caps) {
        if (!isOverdue(cap, nowIso)) continue

        if (hasOpenFlag(openCases, cap._id, 'cap_overdue')) continue

        sequence += 1
        await ctx.db.insert('hrCases', {
          tenantId: tenant._id,
          caseNumber: `HR-${year}-${String(sequence).padStart(3, '0')}`,
          subjectType: 'corrective_action',
          subjectId: cap._id,
          category: 'compliance',
          title: `Corrective action overdue: ${cap.source} finding`,
          status: 'open',
          description: `The corrective action for the ${cap.source} finding "${cap.finding.slice(0, 120)}" was due ${cap.dueAt} and is still open. Submit the response and evidence on the Audit page.`,
          flagType: 'cap_overdue',
          autoCreatedAt,
          createdAt: autoCreatedAt,
        })
        openCases.push({
          subjectId: cap._id,
          flagType: 'cap_overdue',
        })
        created += 1

        for (const member of adminAndHr) {
          await ctx.db.insert('notifications', {
            tenantId: tenant._id,
            clerkUserId: member.clerkUserId,
            type: 'cap_overdue',
            message: `Corrective action (${cap.source}) is past its due date.`,
            metadata: { correctiveActionId: cap._id as string },
            read: false,
            createdAt: autoCreatedAt,
          })
        }
      }
    }

    return { created }
  },
})
