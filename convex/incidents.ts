import { v, ConvexError } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Management roles: everyone who can see the incident log and drive the
// reporting workflow. Caregivers can FILE an incident (createIncident) but
// can never list or view incidents.
const INCIDENT_MANAGE_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const INCIDENT_CREATE_ROLES: (
  | 'org:admin'
  | 'org:coordinator'
  | 'org:caregiver'
  | 'org:hr'
)[] = ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr']

const DAY_MS = 24 * 60 * 60 * 1000
const TIMELINESS_WINDOW_DAYS = 90

const incidentCategoryValidator = v.union(
  v.literal('death'),
  v.literal('serious_injury'),
  v.literal('hospitalization'),
  v.literal('emergency_room_visit'),
  v.literal('medication_error'),
  v.literal('suspected_abuse'),
  v.literal('suspected_exploitation'),
  v.literal('suspected_neglect'),
  v.literal('victim_of_crime'),
  v.literal('missing_person'),
  v.literal('unauthorized_absence'),
  v.literal('aggressive_act'),
  v.literal('rights_violation'),
  v.literal('other'),
)

const agencyNotifiedValidator = v.union(
  v.literal('aps'),
  v.literal('cps'),
  v.literal('ccl'),
  v.literal('law_enforcement'),
  v.literal('ombudsman'),
  v.literal('dph'),
  v.literal('other'),
)

type Incident = Doc<'specialIncidents'>

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString()
}

// 17 CCR §54327: verbal report to the regional center within 24 hours of
// learning of the incident; written report within 48 hours.
export function verbalDueAt(incident: Pick<Incident, 'learnedAt'>) {
  return addHours(incident.learnedAt, 24)
}

export function writtenDueAt(incident: Pick<Incident, 'learnedAt'>) {
  return addHours(incident.learnedAt, 48)
}

/**
 * A report breaches its SLA when it is still missing past the deadline, or
 * when it was filed late. Exactly at the deadline the report is on time.
 */
function isBreached(reportedAt: string | undefined, dueAt: string, nowIso: string) {
  return reportedAt ? reportedAt > dueAt : nowIso > dueAt
}

export function withSlaFields(incident: Incident, nowIso: string) {
  const vDue = verbalDueAt(incident)
  const wDue = writtenDueAt(incident)
  return {
    ...incident,
    verbalDueAt: vDue,
    writtenDueAt: wDue,
    verbalBreached: isBreached(incident.verbalReportedAt, vDue, nowIso),
    writtenBreached: isBreached(incident.writtenSubmittedAt, wDue, nowIso),
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

function requireChronology(occurredAt: string, learnedAt: string) {
  if (learnedAt < occurredAt) {
    throw new ConvexError(
      'The date/time learned must be on or after the date/time the incident occurred.',
    )
  }
}

export const createIncident = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    category: incidentCategoryValidator,
    occurredAt: v.string(),
    learnedAt: v.string(),
    location: v.string(),
    description: v.string(),
    treatmentProvided: v.optional(v.string()),
    witnesses: v.optional(v.string()),
    allegedPerpetrator: v.optional(v.string()),
    actionsTaken: v.string(),
    agenciesNotified: v.array(agencyNotifiedValidator),
    familyContacted: v.optional(
      v.object({
        who: v.string(),
        at: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_CREATE_ROLES,
    )

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new ConvexError('Client not found.')
    assertTenantDoc(client, tenantId)

    requireNonBlank(args.location, 'Location')
    requireNonBlank(args.description, 'Description')
    requireNonBlank(args.actionsTaken, 'Actions taken')
    requireValidIso(args.occurredAt, 'Occurred at')
    requireValidIso(args.learnedAt, 'Learned at')
    requireChronology(args.occurredAt, args.learnedAt)

    const now = new Date().toISOString()
    const incidentId = await ctx.db.insert('specialIncidents', {
      tenantId,
      clientId: args.clientId,
      category: args.category,
      occurredAt: args.occurredAt,
      learnedAt: args.learnedAt,
      location: args.location.trim(),
      description: args.description,
      treatmentProvided: args.treatmentProvided,
      witnesses: args.witnesses,
      allegedPerpetrator: args.allegedPerpetrator,
      actionsTaken: args.actionsTaken,
      agenciesNotified: args.agenciesNotified,
      familyContacted: args.familyContacted,
      status: 'draft',
      createdBy: identity.subject,
      createdAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'incident_created',
      metadata: {
        incidentId: incidentId as string,
        clientId: args.clientId as string,
        category: args.category,
      },
    })

    return incidentId
  },
})

async function loadIncident(
  ctx: QueryCtx | MutationCtx,
  incidentId: Id<'specialIncidents'>,
  tenantId: Id<'tenants'>,
) {
  const incident = await ctx.db.get(incidentId)
  if (!incident) throw new ConvexError('Incident not found.')
  assertTenantDoc(incident, tenantId)
  return incident
}

export const markVerbalReported = mutation({
  args: { clerkOrgId: v.string(), incidentId: v.id('specialIncidents') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )
    const incident = await loadIncident(ctx, args.incidentId, tenantId)

    if (incident.status === 'closed') {
      throw new ConvexError('This incident is closed.')
    }
    if (incident.verbalReportedAt) {
      throw new ConvexError('The verbal report was already recorded.')
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.incidentId, {
      verbalReportedAt: now,
      status: incident.status === 'draft' ? 'verbal_reported' : incident.status,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'incident_verbal_reported',
      previousStatus: incident.status,
      nextStatus:
        incident.status === 'draft' ? 'verbal_reported' : incident.status,
      metadata: { incidentId: args.incidentId as string },
    })

    return args.incidentId
  },
})

export const markWrittenSubmitted = mutation({
  args: { clerkOrgId: v.string(), incidentId: v.id('specialIncidents') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )
    const incident = await loadIncident(ctx, args.incidentId, tenantId)

    if (incident.status === 'closed') {
      throw new ConvexError('This incident is closed.')
    }
    if (incident.writtenSubmittedAt) {
      throw new ConvexError('The written report was already recorded.')
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.incidentId, {
      writtenSubmittedAt: now,
      status: 'written_submitted',
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'incident_written_submitted',
      previousStatus: incident.status,
      nextStatus: 'written_submitted',
      metadata: { incidentId: args.incidentId as string },
    })

    return args.incidentId
  },
})

export const closeIncident = mutation({
  args: { clerkOrgId: v.string(), incidentId: v.id('specialIncidents') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )
    const incident = await loadIncident(ctx, args.incidentId, tenantId)

    if (incident.status === 'closed') {
      throw new ConvexError('This incident is already closed.')
    }

    await ctx.db.patch(args.incidentId, { status: 'closed' })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'incident_closed',
      previousStatus: incident.status,
      nextStatus: 'closed',
      metadata: { incidentId: args.incidentId as string },
    })

    return args.incidentId
  },
})

export const addIncidentUpdate = mutation({
  args: {
    clerkOrgId: v.string(),
    incidentId: v.id('specialIncidents'),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )
    const incident = await loadIncident(ctx, args.incidentId, tenantId)

    if (incident.status === 'closed') {
      throw new ConvexError('This incident is closed.')
    }
    requireNonBlank(args.note, 'Update note')

    const updateId = await ctx.db.insert('specialIncidentUpdates', {
      tenantId,
      incidentId: args.incidentId,
      note: args.note,
      addedBy: identity.subject,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'incident_update_added',
      metadata: {
        incidentId: args.incidentId as string,
        updateId: updateId as string,
      },
    })

    return updateId
  },
})

/**
 * Lightweight client picker for the incident form. clients.list is
 * admin/coordinator-only and returns full client records; caregivers filing
 * an incident only need id + displayName.
 */
export const listIncidentClientOptions = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_CREATE_ROLES,
    )

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    return clients.map((client) => ({
      clientId: client._id,
      displayName: client.displayName,
    }))
  },
})

export const listIncidents = query({
  args: {
    clerkOrgId: v.string(),
    clientId: v.optional(v.id('clients')),
    category: v.optional(incidentCategoryValidator),
    status: v.optional(
      v.union(
        v.literal('draft'),
        v.literal('verbal_reported'),
        v.literal('written_submitted'),
        v.literal('closed'),
      ),
    ),
    startDate: v.optional(v.string()), // ISO, occurredAt >= startDate
    endDate: v.optional(v.string()), // ISO, occurredAt <= endDate
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )

    let incidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    if (args.clientId) {
      incidents = incidents.filter((i) => i.clientId === args.clientId)
    }
    if (args.category) {
      incidents = incidents.filter((i) => i.category === args.category)
    }
    if (args.status) {
      incidents = incidents.filter((i) => i.status === args.status)
    }
    if (args.startDate) {
      incidents = incidents.filter((i) => i.occurredAt >= args.startDate!)
    }
    if (args.endDate) {
      incidents = incidents.filter((i) => i.occurredAt <= args.endDate!)
    }

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clientNames = new Map(
      clients.map((client) => [client._id as string, client.displayName]),
    )

    const nowIso = new Date().toISOString()
    return incidents.map((incident) => ({
      ...withSlaFields(incident, nowIso),
      clientName: clientNames.get(incident.clientId as string) ?? 'Unknown',
    }))
  },
})

export const getIncident = query({
  args: { clerkOrgId: v.string(), incidentId: v.id('specialIncidents') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )
    const incident = await loadIncident(ctx, args.incidentId, tenantId)

    const client = await ctx.db.get(incident.clientId)

    const updates = await ctx.db
      .query('specialIncidentUpdates')
      .withIndex('by_tenant_incident', (q) =>
        q.eq('tenantId', tenantId).eq('incidentId', args.incidentId),
      )
      .order('asc')
      .collect()

    // Resolve addedBy clerkUserIds to display names, best-effort.
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()
    const memberNames = new Map(
      members.map((member) => [member.clerkUserId, member.displayName]),
    )

    const nowIso = new Date().toISOString()
    return {
      ...withSlaFields(incident, nowIso),
      clientName: client?.displayName ?? 'Unknown',
      updates: updates.map((update) => ({
        ...update,
        addedByName: memberNames.get(update.addedBy) ?? 'Unknown user',
      })),
    }
  },
})

/**
 * Tenant-level SIR timeliness for the audit-readiness dashboard: incidents
 * created in the last 90 days, split into on-time / breached / pending for
 * both the 24h verbal and 48h written deadlines.
 */
export const getIncidentTimeliness = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )

    const windowStart = new Date(
      Date.now() - TIMELINESS_WINDOW_DAYS * DAY_MS,
    ).toISOString()

    const incidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) =>
        q.eq('tenantId', tenantId).gte('createdAt', windowStart),
      )
      .collect()

    const nowIso = new Date().toISOString()
    const counts = {
      windowDays: TIMELINESS_WINDOW_DAYS,
      total: incidents.length,
      verbalOnTime: 0,
      verbalBreached: 0,
      verbalPending: 0,
      writtenOnTime: 0,
      writtenBreached: 0,
      writtenPending: 0,
    }

    for (const incident of incidents) {
      const sla = withSlaFields(incident, nowIso)
      if (incident.verbalReportedAt) {
        if (sla.verbalBreached) counts.verbalBreached += 1
        else counts.verbalOnTime += 1
      } else if (sla.verbalBreached) {
        counts.verbalBreached += 1
      } else {
        counts.verbalPending += 1
      }
      if (incident.writtenSubmittedAt) {
        if (sla.writtenBreached) counts.writtenBreached += 1
        else counts.writtenOnTime += 1
      } else if (sla.writtenBreached) {
        counts.writtenBreached += 1
      } else {
        counts.writtenPending += 1
      }
    }

    return counts
  },
})

/**
 * CSV cell escaping: every field is double-quoted, internal quotes are
 * doubled, embedded newlines are flattened to spaces, and values that start
 * with a formula character (= + - @) are prefixed with an apostrophe so
 * spreadsheet apps cannot execute them. Same conventions as
 * auditReadiness.ts.
 */
function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  text = text.replace(/\r?\n/g, ' ')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function csvRow(cells: (string | number | null | undefined)[]) {
  return cells.map(csvCell).join(',')
}

export const exportIncidentsCsv = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      INCIDENT_MANAGE_ROLES,
    )

    let incidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    if (args.startDate) {
      incidents = incidents.filter((i) => i.occurredAt >= args.startDate!)
    }
    if (args.endDate) {
      incidents = incidents.filter((i) => i.occurredAt <= args.endDate!)
    }

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clientNames = new Map(
      clients.map((client) => [client._id as string, client.displayName]),
    )

    const nowIso = new Date().toISOString()
    const rows: string[] = []
    rows.push(csvRow(['ATRIA-X Special Incident Report Log']))
    rows.push(csvRow(['Generated', nowIso]))
    rows.push('')
    rows.push(
      csvRow([
        'Client',
        'Category',
        'Occurred At',
        'Learned At',
        'Location',
        'Status',
        'Verbal Due',
        'Verbal Reported',
        'Verbal Breached',
        'Written Due',
        'Written Submitted',
        'Written Breached',
        'Agencies Notified',
        'Description',
        'Actions Taken',
      ]),
    )
    for (const incident of incidents) {
      const sla = withSlaFields(incident, nowIso)
      rows.push(
        csvRow([
          clientNames.get(incident.clientId as string) ?? 'Unknown',
          incident.category,
          incident.occurredAt,
          incident.learnedAt,
          incident.location,
          incident.status,
          sla.verbalDueAt,
          incident.verbalReportedAt,
          sla.verbalBreached ? 'yes' : 'no',
          sla.writtenDueAt,
          incident.writtenSubmittedAt,
          sla.writtenBreached ? 'yes' : 'no',
          incident.agenciesNotified.join('; '),
          incident.description,
          incident.actionsTaken,
        ]),
      )
    }

    return rows.join('\r\n')
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
 * Daily cron: find incidents past the 24h/48h §54327 deadlines with the
 * corresponding report still missing and open one deduplicated HR case per
 * incident (flagType 'sir_overdue', same dedup pattern as hrCases.ts), plus a
 * notifications row for every org:admin/org:hr member.
 */
export const checkOverdueIncidents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowIso = new Date().toISOString()
    const year = new Date().getFullYear()
    let created = 0

    const tenants = await ctx.db.query('tenants').collect()

    for (const tenant of tenants) {
      const openStatuses = ['draft', 'verbal_reported', 'written_submitted']
      const incidents: Incident[] = []
      for (const status of openStatuses) {
        const batch = await ctx.db
          .query('specialIncidents')
          .withIndex('by_tenant_status', (q) =>
            q.eq('tenantId', tenant._id).eq('status', status as Incident['status']),
          )
          .collect()
        incidents.push(...batch)
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

      for (const incident of incidents) {
        const sla = withSlaFields(incident, nowIso)
        const overdueParts: string[] = []
        if (!incident.verbalReportedAt && sla.verbalBreached) {
          overdueParts.push(`24h verbal report (due ${sla.verbalDueAt})`)
        }
        if (!incident.writtenSubmittedAt && sla.writtenBreached) {
          overdueParts.push(`48h written report (due ${sla.writtenDueAt})`)
        }
        if (overdueParts.length === 0) continue

        if (hasOpenFlag(openCases, incident._id, 'sir_overdue')) continue

        const client = await ctx.db.get(incident.clientId)
        const clientName = client?.displayName ?? 'Unknown client'

        sequence += 1
        await ctx.db.insert('hrCases', {
          tenantId: tenant._id,
          caseNumber: `HR-${year}-${String(sequence).padStart(3, '0')}`,
          subjectType: 'incident',
          subjectId: incident._id,
          category: 'compliance',
          title: `SIR overdue: ${incident.category} incident for ${clientName}`,
          status: 'open',
          description: `Special incident report (${incident.category}, occurred ${incident.occurredAt}) is past the 17 CCR §54327 deadline. Missing: ${overdueParts.join('; ')}. Submit the report to the regional center and record it on the incident.`,
          flagType: 'sir_overdue',
          autoCreatedAt,
          createdAt: autoCreatedAt,
        })
        openCases.push({
          subjectId: incident._id,
          flagType: 'sir_overdue',
        })
        created += 1

        for (const member of adminAndHr) {
          await ctx.db.insert('notifications', {
            tenantId: tenant._id,
            clerkUserId: member.clerkUserId,
            type: 'sir_overdue',
            message: `SIR overdue for ${clientName}: missing ${overdueParts.join(' and ')}.`,
            metadata: { incidentId: incident._id as string },
            read: false,
            createdAt: autoCreatedAt,
          })
        }
      }
    }

    return { created }
  },
})
