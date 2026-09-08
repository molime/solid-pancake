import { v, ConvexError } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Client grievances (WIC §4705; 17 CCR §58615(b)(6), §58631(d) — docs/07 §3.3,
// gap row A5). The agency must propose a resolution within 5 business days of
// filing; the SLA is computed (never stored) and overdue grievances are
// surfaced as deduplicated HR cases by the daily cron.
const GRIEVANCE_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

export const GRIEVANCE_SLA_BUSINESS_DAYS = 5

type Grievance = Doc<'grievances'>

/**
 * Adds business days (Mon–Fri, UTC) to an ISO timestamp: the day after
 * `fromIso` is day one. Returns end-of-day (23:59:59.999Z) of the resulting
 * business day.
 */
export function addBusinessDays(fromIso: string, businessDays: number) {
  const date = new Date(fromIso)
  let remaining = businessDays
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  date.setUTCHours(23, 59, 59, 999)
  return date.toISOString()
}

export function grievanceSlaDueAt(grievance: Pick<Grievance, 'filedAt'>) {
  return addBusinessDays(grievance.filedAt, GRIEVANCE_SLA_BUSINESS_DAYS)
}

/**
 * The SLA anchors on the first resolution signal (proposal, or a direct
 * resolution). Breached when that signal landed past the deadline or is still
 * missing past the deadline. Exactly at the deadline is on time.
 */
function isBreached(
  grievance: Pick<Grievance, 'proposedAt' | 'resolvedAt'>,
  dueAt: string,
  nowIso: string,
) {
  const anchor = grievance.proposedAt ?? grievance.resolvedAt
  return anchor ? anchor > dueAt : nowIso > dueAt
}

function withSlaFields(grievance: Grievance, nowIso: string) {
  const slaDueAt = grievanceSlaDueAt(grievance)
  return {
    ...grievance,
    slaDueAt,
    slaBreached: isBreached(grievance, slaDueAt, nowIso),
  }
}

function requireNonBlank(value: string, label: string) {
  if (!value.trim()) throw new ConvexError(`${label} is required.`)
}

function requireValidIso(value: string, label: string) {
  if (Number.isNaN(new Date(value).getTime())) {
    throw new ConvexError(`${label} must be a valid date/time.`)
  }
}

async function loadGrievance(
  ctx: QueryCtx | MutationCtx,
  grievanceId: Id<'grievances'>,
  tenantId: Id<'tenants'>,
) {
  const grievance = await ctx.db.get(grievanceId)
  if (!grievance) throw new ConvexError('Grievance not found.')
  assertTenantDoc(grievance, tenantId)
  return grievance
}

export const fileGrievance = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    filedAt: v.string(), // ISO
    filedBy: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new ConvexError('Client not found.')
    assertTenantDoc(client, tenantId)

    requireNonBlank(args.filedBy, 'Filed by')
    requireNonBlank(args.description, 'Description')
    requireValidIso(args.filedAt, 'Filed at')

    const now = new Date().toISOString()
    const grievanceId = await ctx.db.insert('grievances', {
      tenantId,
      clientId: args.clientId,
      filedAt: args.filedAt,
      filedBy: args.filedBy.trim(),
      description: args.description,
      status: 'open',
      createdAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'grievance_filed',
      metadata: {
        grievanceId: grievanceId as string,
        clientId: args.clientId as string,
      },
    })

    return grievanceId
  },
})

export const proposeResolution = mutation({
  args: {
    clerkOrgId: v.string(),
    grievanceId: v.id('grievances'),
    resolutionNote: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )
    const grievance = await loadGrievance(ctx, args.grievanceId, tenantId)

    if (grievance.status === 'resolved') {
      throw new ConvexError('This grievance is already resolved.')
    }
    if (grievance.status === 'resolution_proposed') {
      throw new ConvexError('A resolution was already proposed.')
    }
    requireNonBlank(args.resolutionNote, 'Resolution note')

    const now = new Date().toISOString()
    await ctx.db.patch(args.grievanceId, {
      status: 'resolution_proposed',
      resolutionNote: args.resolutionNote,
      proposedAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'grievance_resolution_proposed',
      previousStatus: grievance.status,
      nextStatus: 'resolution_proposed',
      metadata: { grievanceId: args.grievanceId as string },
    })

    return args.grievanceId
  },
})

export const resolveGrievance = mutation({
  args: {
    clerkOrgId: v.string(),
    grievanceId: v.id('grievances'),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )
    const grievance = await loadGrievance(ctx, args.grievanceId, tenantId)

    if (grievance.status === 'resolved') {
      throw new ConvexError('This grievance is already resolved.')
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.grievanceId, {
      status: 'resolved',
      resolutionNote: args.resolutionNote ?? grievance.resolutionNote,
      resolvedAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'grievance_resolved',
      previousStatus: grievance.status,
      nextStatus: 'resolved',
      metadata: { grievanceId: args.grievanceId as string },
    })

    return args.grievanceId
  },
})

export const escalateGrievance = mutation({
  args: {
    clerkOrgId: v.string(),
    grievanceId: v.id('grievances'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )
    const grievance = await loadGrievance(ctx, args.grievanceId, tenantId)

    if (grievance.status === 'resolved') {
      throw new ConvexError('This grievance is already resolved.')
    }
    if (grievance.status === 'escalated') {
      throw new ConvexError('This grievance is already escalated.')
    }

    await ctx.db.patch(args.grievanceId, { status: 'escalated' })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'grievance_escalated',
      previousStatus: grievance.status,
      nextStatus: 'escalated',
      metadata: { grievanceId: args.grievanceId as string },
    })

    return args.grievanceId
  },
})

export const listGrievances = query({
  args: {
    clerkOrgId: v.string(),
    clientId: v.optional(v.id('clients')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )

    let grievances: Grievance[]
    const clientId = args.clientId
    if (clientId) {
      grievances = await ctx.db
        .query('grievances')
        .withIndex('by_tenant_client', (q) =>
          q.eq('tenantId', tenantId).eq('clientId', clientId),
        )
        .order('desc')
        .collect()
    } else {
      grievances = await ctx.db
        .query('grievances')
        .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
        .order('desc')
        .collect()
    }

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clientNames = new Map(
      clients.map((client) => [client._id as string, client.displayName]),
    )

    const nowIso = new Date().toISOString()
    return grievances.map((grievance) => ({
      ...withSlaFields(grievance, nowIso),
      clientName: clientNames.get(grievance.clientId as string) ?? 'Unknown',
    }))
  },
})

/** Counts for the audit-readiness count card: unresolved vs. SLA-overdue. */
export const getGrievanceSummary = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      GRIEVANCE_ROLES,
    )

    const grievances = await ctx.db
      .query('grievances')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .collect()

    const nowIso = new Date().toISOString()
    let open = 0
    let overdue = 0
    for (const grievance of grievances) {
      if (grievance.status === 'resolved') continue
      open += 1
      if (withSlaFields(grievance, nowIso).slaBreached) overdue += 1
    }

    return { open, overdue }
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
 * Daily cron: unresolved grievances past the 5-business-day SLA open one
 * deduplicated HR case per grievance (flagType 'grievance_overdue', same
 * dedup pattern as hrCases.ts / incidents.ts), plus a notifications row for
 * every org:admin/org:hr member.
 */
export const checkOverdueGrievances = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowIso = new Date().toISOString()
    const year = new Date().getFullYear()
    let created = 0

    const tenants = await ctx.db.query('tenants').collect()

    for (const tenant of tenants) {
      const grievances: Grievance[] = []
      for (const status of ['open', 'resolution_proposed', 'escalated'] as const) {
        const batch = await ctx.db
          .query('grievances')
          .withIndex('by_tenant_status', (q) =>
            q.eq('tenantId', tenant._id).eq('status', status),
          )
          .collect()
        grievances.push(...batch)
      }

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

      for (const grievance of grievances) {
        const sla = withSlaFields(grievance, nowIso)
        if (!sla.slaBreached) continue

        if (hasOpenFlag(openCases, grievance._id, 'grievance_overdue')) continue

        const client = await ctx.db.get(grievance.clientId)
        const clientName = client?.displayName ?? 'Unknown client'

        sequence += 1
        await ctx.db.insert('hrCases', {
          tenantId: tenant._id,
          caseNumber: `HR-${year}-${String(sequence).padStart(3, '0')}`,
          subjectType: 'grievance',
          subjectId: grievance._id,
          category: 'compliance',
          title: `Grievance overdue: no resolution proposed for ${clientName}`,
          status: 'open',
          description: `The grievance filed by ${grievance.filedBy} on ${grievance.filedAt} for ${clientName} is past the 5-business-day resolution-proposal SLA (due ${sla.slaDueAt}, WIC §4705). Propose a resolution on the client record.`,
          flagType: 'grievance_overdue',
          autoCreatedAt,
          createdAt: autoCreatedAt,
        })
        openCases.push({
          subjectId: grievance._id,
          flagType: 'grievance_overdue',
        })
        created += 1

        for (const member of adminAndHr) {
          await ctx.db.insert('notifications', {
            tenantId: tenant._id,
            clerkUserId: member.clerkUserId,
            type: 'grievance_overdue',
            message: `Grievance for ${clientName} is past the 5-business-day resolution SLA.`,
            metadata: { grievanceId: grievance._id as string },
            read: false,
            createdAt: autoCreatedAt,
          })
        }
      }
    }

    return { created }
  },
})
