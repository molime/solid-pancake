import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

const OBLIGATION_READ_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const OBLIGATION_MANAGE_ROLES: ('org:admin' | 'org:hr')[] = [
  'org:admin',
  'org:hr',
]

const obligationKeyValidator = v.union(
  v.literal('ds1891_disclosure'),
  v.literal('hcbs_agreement_ds1896'),
  v.literal('insurance_general_liability'),
  v.literal('insurance_workers_comp'),
  v.literal('insurance_auto'),
  v.literal('cpa_audit_or_review'),
  v.literal('conflict_of_interest'),
  v.literal('whistleblower_policy'),
  v.literal('program_design'),
)

type ObligationKey = Doc<'agencyObligations'>['key']

type ObligationTemplate = {
  key: ObligationKey
  label: string
  cadenceMonths: number
}

/**
 * Standard recurring agency-level obligations for a California ILS/SLS vendor
 * (docs/07 §3.5, gap rows D2/D6): DS 1891 applicant/vendor disclosure every 2
 * years (17 CCR §54311(c)), DS 1896 HCBS Provider Agreement, annual insurance
 * certificates (GL / workers' comp / auto), the WIC §4652.5 CPA audit-or-review
 * window (tracked annually), conflict-of-interest statements (§§54500–54535),
 * whistleblower-policy acknowledgement, and the approved program design.
 */
export const STANDARD_CA_OBLIGATIONS: ObligationTemplate[] = [
  {
    key: 'ds1891_disclosure',
    label: 'DS 1891 applicant/vendor disclosure statement',
    cadenceMonths: 24,
  },
  {
    key: 'hcbs_agreement_ds1896',
    label: 'DS 1896 HCBS Provider Agreement',
    cadenceMonths: 24,
  },
  {
    key: 'insurance_general_liability',
    label: 'General liability insurance certificate',
    cadenceMonths: 12,
  },
  {
    key: 'insurance_workers_comp',
    label: "Workers' compensation insurance certificate",
    cadenceMonths: 12,
  },
  {
    key: 'insurance_auto',
    label: 'Commercial auto insurance certificate',
    cadenceMonths: 12,
  },
  {
    key: 'cpa_audit_or_review',
    label: 'Independent CPA audit or review (WIC §4652.5)',
    cadenceMonths: 12,
  },
  {
    key: 'conflict_of_interest',
    label: 'Conflict-of-interest statements',
    cadenceMonths: 12,
  },
  {
    key: 'whistleblower_policy',
    label: 'Whistleblower-protection policy acknowledgement',
    cadenceMonths: 12,
  },
  {
    key: 'program_design',
    label: 'Approved program design review',
    cadenceMonths: 12,
  },
]

/** Calendar-month addition on ISO timestamps (clamped to end-of-month). */
export function addMonths(iso: string, months: number): string {
  const date = new Date(iso)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString()
}

async function loadObligation(
  ctx: QueryCtx | MutationCtx,
  obligationId: Id<'agencyObligations'>,
  tenantId: Id<'tenants'>,
) {
  const obligation = await ctx.db.get(obligationId)
  if (!obligation) throw new ConvexError('Agency obligation not found.')
  assertTenantDoc(obligation, tenantId)
  return obligation
}

export const listObligations = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBLIGATION_READ_ROLES,
    )

    return ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .collect()
  },
})

/**
 * Seeds the standard CA ILS/SLS agency obligations. Idempotent by tenant+key:
 * obligations that already exist are skipped. Default due dates are one full
 * cadence out from seeding — a freshly vendored agency's first cycle.
 */
export const seedObligations = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .collect()
    const existingKeys = new Set(existing.map((o) => o.key))

    const now = new Date().toISOString()
    let created = 0
    let skipped = 0
    for (const template of STANDARD_CA_OBLIGATIONS) {
      if (existingKeys.has(template.key)) {
        skipped += 1
        continue
      }
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: template.key,
        label: template.label,
        cadenceMonths: template.cadenceMonths,
        dueAt: addMonths(now, template.cadenceMonths),
        createdAt: now,
      })
      created += 1
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'agency_obligations_seeded',
      metadata: { created, skipped },
    })

    return {
      status: created > 0 ? ('seeded' as const) : ('already-seeded' as const),
      message:
        created > 0
          ? `Seeded ${created} standard CA obligation${created !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} already existed)` : ''}.`
          : `All ${skipped} standard obligations already exist — nothing to do.`,
      counts: { created, skipped },
    }
  },
})

/**
 * Marks an obligation complete: stamps completedAt, optionally links an
 * existing documentArchiveItems row as evidence, and rolls dueAt forward by
 * the obligation's cadence. The completion date is the rollover base so an
 * overdue obligation never lands on a still-past due date.
 */
export const completeObligation = mutation({
  args: {
    clerkOrgId: v.string(),
    obligationId: v.id('agencyObligations'),
    evidenceItemId: v.optional(v.id('documentArchiveItems')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBLIGATION_MANAGE_ROLES,
    )
    const obligation = await loadObligation(ctx, args.obligationId, tenantId)

    if (args.evidenceItemId) {
      const item = await ctx.db.get(args.evidenceItemId)
      if (!item) throw new ConvexError('Evidence document not found.')
      assertTenantDoc(item, tenantId)
    }

    const now = new Date().toISOString()
    const nextDueAt = addMonths(now, obligation.cadenceMonths)
    await ctx.db.patch(args.obligationId, {
      completedAt: now,
      dueAt: nextDueAt,
      evidenceItemId: args.evidenceItemId ?? obligation.evidenceItemId,
      notes: args.notes ?? obligation.notes,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'agency_obligation_completed',
      metadata: {
        obligationId: args.obligationId as string,
        key: obligation.key,
        nextDueAt,
        evidenceItemId: args.evidenceItemId as string | undefined,
      },
    })

    return args.obligationId
  },
})

/** Snoozes or corrects an obligation's due date. */
export const updateDueDate = mutation({
  args: {
    clerkOrgId: v.string(),
    obligationId: v.id('agencyObligations'),
    dueAt: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      OBLIGATION_MANAGE_ROLES,
    )
    const obligation = await loadObligation(ctx, args.obligationId, tenantId)

    if (Number.isNaN(new Date(args.dueAt).getTime())) {
      throw new ConvexError('Due date must be a valid date.')
    }

    await ctx.db.patch(args.obligationId, { dueAt: args.dueAt })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'agency_obligation_due_date_updated',
      metadata: {
        obligationId: args.obligationId as string,
        key: obligation.key,
        previousDueAt: obligation.dueAt,
        nextDueAt: args.dueAt,
      },
    })

    return args.obligationId
  },
})

// Re-exported for cron/test validation of keys.
export { obligationKeyValidator }
