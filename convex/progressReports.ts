import { v, ConvexError } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'

// Quarterly SLS / semi-annual ILS progress reports toward IPP/ISP objectives
// (docs/07 §3.4, gap row B3; 17 CCR §58680 + regional-center contract;
// ACRC ILS procedure). Reports are generated deterministically from Stage-3
// objective-linked shift documentation — no AI calls.

const PROGRESS_REPORT_ROLES: ('org:admin' | 'org:coordinator' | 'org:hr')[] = [
  'org:admin',
  'org:coordinator',
  'org:hr',
]

const DUE_SOON_DAYS = 14
const SERVICES_SUMMARY_MAX = 500
const DAY_MS = 24 * 60 * 60 * 1000

const periodTypeValidator = v.union(
  v.literal('quarterly'),
  v.literal('semiannual'),
)

type Client = Doc<'clients'>
type Objective = Doc<'clientObjectives'>
type Report = Doc<'progressReports'>

export function cadenceMonthsFor(serviceType: Client['serviceType']) {
  return serviceType === 'SLS' ? 3 : 6
}

export function periodTypeFor(
  serviceType: Client['serviceType'],
): 'quarterly' | 'semiannual' {
  return serviceType === 'SLS' ? 'quarterly' : 'semiannual'
}

function daysInMonthUtc(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

/** Adds months to an ISO date-only string, clamping to the end of the
 *  target month (e.g. 2026-03-31 + 3 months → 2026-06-30). */
export function addMonthsDateOnly(iso: string, months: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const targetMonthIndex = month - 1 + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12
  const clampedDay = Math.min(day, daysInMonthUtc(targetYear, normalizedMonth))
  return `${targetYear}-${pad2(normalizedMonth + 1)}-${pad2(clampedDay)}`
}

function addDaysDateOnly(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`)
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

function validateDateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ConvexError(`${label} must be an ISO date (yyyy-mm-dd).`)
  }
}

export type DueInfo = {
  clientId: Id<'clients'>
  clientName: string
  serviceType: Client['serviceType']
  periodType: 'quarterly' | 'semiannual'
  lastSubmittedPeriodEnd: string | null
  nextDueAt: string | null
  dueStatus: 'overdue' | 'due_soon' | 'on_track' | 'no_baseline'
  suggestedPeriodStart: string | null
  suggestedPeriodEnd: string | null
}

/**
 * Next-due math for one client. With a submitted report on file, the next
 * report is due one cadence after its periodEnd. Without one, the earliest
 * active objective's createdAt anchors the first period; with no objectives
 * there is nothing to report (nextDueAt null).
 */
export function computeDueInfo(
  client: Client,
  objectives: Objective[],
  reports: Report[],
  todayDateOnly: string,
): DueInfo {
  const cadence = cadenceMonthsFor(client.serviceType)
  const periodType = periodTypeFor(client.serviceType)

  let lastSubmittedPeriodEnd: string | null = null
  for (const report of reports) {
    if (report.status !== 'submitted') continue
    if (!lastSubmittedPeriodEnd || report.periodEnd > lastSubmittedPeriodEnd) {
      lastSubmittedPeriodEnd = report.periodEnd
    }
  }

  let anchor: string | null = null
  if (lastSubmittedPeriodEnd) {
    anchor = lastSubmittedPeriodEnd
  } else {
    const active = objectives.filter((o) => o.status === 'active')
    for (const objective of active) {
      const created = objective.createdAt.slice(0, 10)
      if (!anchor || created < anchor) anchor = created
    }
  }

  const nextDueAt = anchor ? addMonthsDateOnly(anchor, cadence) : null

  let dueStatus: DueInfo['dueStatus'] = 'no_baseline'
  if (nextDueAt) {
    const dueSoonBoundary = addDaysDateOnly(todayDateOnly, DUE_SOON_DAYS)
    if (nextDueAt < todayDateOnly) dueStatus = 'overdue'
    else if (nextDueAt <= dueSoonBoundary) dueStatus = 'due_soon'
    else dueStatus = 'on_track'
  }

  let suggestedPeriodStart: string | null = null
  let suggestedPeriodEnd: string | null = null
  if (anchor) {
    suggestedPeriodStart = lastSubmittedPeriodEnd
      ? addDaysDateOnly(lastSubmittedPeriodEnd, 1)
      : anchor
    suggestedPeriodEnd = addDaysDateOnly(
      addMonthsDateOnly(suggestedPeriodStart, cadence),
      -1,
    )
  }

  return {
    clientId: client._id,
    clientName: client.displayName,
    serviceType: client.serviceType,
    periodType,
    lastSubmittedPeriodEnd,
    nextDueAt,
    dueStatus,
    suggestedPeriodStart,
    suggestedPeriodEnd,
  }
}

async function loadClient(
  ctx: QueryCtx | MutationCtx,
  clientId: Id<'clients'>,
  tenantId: Id<'tenants'>,
) {
  const client = await ctx.db.get(clientId)
  if (!client) throw new ConvexError('Client not found.')
  assertTenantDoc(client, tenantId)
  return client
}

async function loadReport(
  ctx: QueryCtx | MutationCtx,
  reportId: Id<'progressReports'>,
  tenantId: Id<'tenants'>,
) {
  const report = await ctx.db.get(reportId)
  if (!report) throw new ConvexError('Progress report not found.')
  assertTenantDoc(report, tenantId)
  return report
}

async function listClientObjectives(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
) {
  return ctx.db
    .query('clientObjectives')
    .withIndex('by_tenant_client', (q) =>
      q.eq('tenantId', tenantId).eq('clientId', clientId),
    )
    .collect()
}

async function listClientReports(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
) {
  return ctx.db
    .query('progressReports')
    .withIndex('by_tenant_client_period', (q) =>
      q.eq('tenantId', tenantId).eq('clientId', clientId),
    )
    .collect()
}

function shiftHours(shift: Doc<'shifts'>) {
  const start = shift.clockInAt ?? shift.scheduledStart
  const end = shift.clockOutAt ?? shift.scheduledEnd
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000
  return hours > 0 ? hours : 0
}

/**
 * Builds one report entry per active objective: hours from approved/
 * billing_ready shifts in the period that carry at least one progress note
 * linked to the objective, and a services summary concatenated (distinct,
 * oldest first, truncated) from those notes' servicesProvided text.
 */
async function buildEntries(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  clientId: Id<'clients'>,
  periodStart: string,
  periodEnd: string,
): Promise<Report['entries']> {
  const objectives = (await listClientObjectives(ctx, tenantId, clientId))
    .filter((objective) => objective.status === 'active')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const startBound = `${periodStart}T00:00:00.000Z`
  const endBound = `${periodEnd}T23:59:59.999Z`
  const counted: Doc<'shifts'>[] = []
  for (const status of ['approved', 'billing_ready'] as const) {
    const batch = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('status', status)
          .gte('scheduledStart', startBound)
          .lte('scheduledStart', endBound),
      )
      .collect()
    counted.push(...batch.filter((shift) => shift.clientId === clientId))
  }
  counted.sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

  const notesByObjective = new Map<string, Doc<'progressNotes'>[]>()
  for (const shift of counted) {
    const notes = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', shift._id),
      )
      .collect()
    for (const note of notes) {
      if (!note.objectiveId) continue
      const list = notesByObjective.get(note.objectiveId) ?? []
      list.push(note)
      notesByObjective.set(note.objectiveId, list)
    }
  }

  const entries: Report['entries'] = []
  for (const objective of objectives) {
    const linkedNotes = notesByObjective.get(objective._id) ?? []
    const linkedShiftIds = new Set(linkedNotes.map((note) => note.shiftId))

    let hours = 0
    for (const shift of counted) {
      if (linkedShiftIds.has(shift._id)) hours += shiftHours(shift)
    }

    const seen = new Set<string>()
    const parts: string[] = []
    for (const note of linkedNotes) {
      const text = note.servicesProvided.trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      parts.push(text)
    }
    let servicesSummary = parts.join('; ')
    if (servicesSummary.length > SERVICES_SUMMARY_MAX) {
      servicesSummary = `${servicesSummary.slice(0, SERVICES_SUMMARY_MAX - 1)}…`
    }

    entries.push({
      objectiveId: objective._id,
      objectiveTitle: objective.title,
      servicesSummary,
      progressSummary: '',
      barriers: '',
      planForward: '',
      hoursDelivered: Math.round(hours * 100) / 100,
    })
  }

  return entries
}

export const generateProgressReport = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    periodType: periodTypeValidator,
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )
    const client = await loadClient(ctx, args.clientId, tenantId)

    validateDateOnly(args.periodStart, 'Period start')
    validateDateOnly(args.periodEnd, 'Period end')
    if (args.periodStart > args.periodEnd) {
      throw new ConvexError('Period start must be on or before period end.')
    }
    const expectedPeriodType = periodTypeFor(client.serviceType)
    if (args.periodType !== expectedPeriodType) {
      throw new ConvexError(
        `${client.serviceType} clients use ${expectedPeriodType} reports.`,
      )
    }

    const entries = await buildEntries(
      ctx,
      tenantId,
      args.clientId,
      args.periodStart,
      args.periodEnd,
    )

    const existing = await ctx.db
      .query('progressReports')
      .withIndex('by_tenant_client_period', (q) =>
        q
          .eq('tenantId', tenantId)
          .eq('clientId', args.clientId)
          .eq('periodStart', args.periodStart),
      )
      .first()

    let reportId: Id<'progressReports'>
    if (existing) {
      if (existing.status === 'submitted') {
        throw new ConvexError(
          'A submitted report already exists for this period and is locked.',
        )
      }
      await ctx.db.patch(existing._id, {
        periodType: args.periodType,
        periodEnd: args.periodEnd,
        entries,
        generatedBy: identity.subject,
      })
      reportId = existing._id
    } else {
      reportId = await ctx.db.insert('progressReports', {
        tenantId,
        clientId: args.clientId,
        periodType: args.periodType,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        entries,
        status: 'draft',
        generatedBy: identity.subject,
        createdAt: new Date().toISOString(),
      })
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'report_generated',
      metadata: {
        reportId: reportId as string,
        clientId: args.clientId as string,
        periodType: args.periodType,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        regenerated: existing ? 'yes' : 'no',
      },
    })

    return reportId
  },
})

const editableEntryValidator = v.object({
  objectiveId: v.id('clientObjectives'),
  servicesSummary: v.string(),
  progressSummary: v.string(),
  barriers: v.string(),
  planForward: v.string(),
})

export const updateProgressReportEntries = mutation({
  args: {
    clerkOrgId: v.string(),
    reportId: v.id('progressReports'),
    entries: v.array(editableEntryValidator),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )
    const report = await loadReport(ctx, args.reportId, tenantId)

    if (report.status !== 'draft') {
      throw new ConvexError('Only draft reports can be edited.')
    }

    // Validate every incoming objective belongs to this report's client, then
    // merge text fields onto the stored entries so hoursDelivered and
    // objectiveTitle always keep their server-computed values.
    const incoming = new Map(
      args.entries.map((entry) => [entry.objectiveId as string, entry]),
    )
    for (const entry of args.entries) {
      const objective = await ctx.db.get(entry.objectiveId)
      if (!objective) throw new ConvexError('Client objective not found.')
      assertTenantDoc(objective, tenantId)
      if (objective.clientId !== report.clientId) {
        throw new ConvexError(
          'Objective belongs to a different client than this report.',
        )
      }
    }

    const entries = report.entries.map((entry) => {
      const edit = incoming.get(entry.objectiveId as string)
      if (!edit) return entry
      return {
        ...entry,
        servicesSummary: edit.servicesSummary,
        progressSummary: edit.progressSummary,
        barriers: edit.barriers,
        planForward: edit.planForward,
      }
    })

    await ctx.db.patch(args.reportId, { entries })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'report_updated',
      metadata: {
        reportId: args.reportId as string,
        clientId: report.clientId as string,
      },
    })

    return args.reportId
  },
})

export const submitProgressReport = mutation({
  args: {
    clerkOrgId: v.string(),
    reportId: v.id('progressReports'),
    submittedTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )
    const report = await loadReport(ctx, args.reportId, tenantId)

    if (report.status !== 'draft') {
      throw new ConvexError('This report has already been submitted.')
    }

    const client = await ctx.db.get(report.clientId)
    const submittedTo =
      args.submittedTo?.trim() || client?.serviceCoordinatorEmail || undefined

    const now = new Date().toISOString()
    await ctx.db.patch(args.reportId, {
      status: 'submitted',
      submittedAt: now,
      submittedTo,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'report_submitted',
      previousStatus: 'draft',
      nextStatus: 'submitted',
      metadata: {
        reportId: args.reportId as string,
        clientId: report.clientId as string,
        submittedTo: submittedTo ?? '',
      },
    })

    return args.reportId
  },
})

export const listProgressReports = query({
  args: {
    clerkOrgId: v.string(),
    clientId: v.optional(v.id('clients')),
    status: v.optional(v.union(v.literal('draft'), v.literal('submitted'))),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )

    const allClients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clients = args.clientId
      ? allClients.filter((client) => client._id === args.clientId)
      : allClients
    if (args.clientId && clients.length === 0) {
      throw new ConvexError('Client not found.')
    }

    const todayDateOnly = new Date().toISOString().slice(0, 10)
    const reports: (Report & { clientName: string })[] = []
    const due: DueInfo[] = []

    for (const client of clients) {
      const clientReports = await listClientReports(ctx, tenantId, client._id)
      const objectives = await listClientObjectives(ctx, tenantId, client._id)

      due.push(computeDueInfo(client, objectives, clientReports, todayDateOnly))

      for (const report of clientReports) {
        if (args.status && report.status !== args.status) continue
        reports.push({ ...report, clientName: client.displayName })
      }
    }

    reports.sort((a, b) => b.periodStart.localeCompare(a.periodStart))

    return { reports, due }
  },
})

/**
 * Tenant-level progress-report summary for the audit-readiness dashboard
 * (program-integrity pillar): clients grouped by due status plus report
 * counts. Computed from the same computeDueInfo math as listProgressReports
 * and the due-date cron, so all three surfaces agree.
 */
export const getProgressReportSummary = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const todayDateOnly = new Date().toISOString().slice(0, 10)
    const summary = {
      clients: clients.length,
      overdue: 0,
      dueSoon: 0,
      onTrack: 0,
      noBaseline: 0,
      submittedReports: 0,
      draftReports: 0,
    }

    for (const client of clients) {
      const clientReports = await listClientReports(ctx, tenantId, client._id)
      const objectives = await listClientObjectives(ctx, tenantId, client._id)
      const due = computeDueInfo(client, objectives, clientReports, todayDateOnly)
      if (due.dueStatus === 'overdue') summary.overdue += 1
      else if (due.dueStatus === 'due_soon') summary.dueSoon += 1
      else if (due.dueStatus === 'on_track') summary.onTrack += 1
      else summary.noBaseline += 1
      for (const report of clientReports) {
        if (report.status === 'submitted') summary.submittedReports += 1
        else summary.draftReports += 1
      }
    }

    return summary
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

export const exportReportCsv = query({
  args: { clerkOrgId: v.string(), reportId: v.id('progressReports') },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PROGRESS_REPORT_ROLES,
    )
    const report = await loadReport(ctx, args.reportId, tenantId)
    const client = await ctx.db.get(report.clientId)

    const rows: string[] = []
    rows.push(csvRow(['ATRIA-X Client Progress Report']))
    rows.push(csvRow(['Generated', new Date().toISOString()]))
    rows.push('')
    rows.push(csvRow(['Client', client?.displayName ?? 'Unknown']))
    rows.push(csvRow(['Service type', client?.serviceType ?? '']))
    rows.push(csvRow(['UCI', client?.uci ?? '']))
    rows.push(
      csvRow([
        'Period',
        `${report.periodStart} to ${report.periodEnd}`,
        'Type',
        report.periodType === 'quarterly' ? 'Quarterly' : 'Semi-annual',
      ]),
    )
    rows.push(csvRow(['Status', report.status]))
    rows.push(csvRow(['Submitted to', report.submittedTo ?? '']))
    rows.push(csvRow(['Submitted at', report.submittedAt ?? '']))
    rows.push('')
    rows.push(
      csvRow([
        'Objective',
        'Services Provided',
        'Progress',
        'Barriers',
        'Plan Forward',
        'Hours Delivered',
      ]),
    )
    for (const entry of report.entries) {
      rows.push(
        csvRow([
          entry.objectiveTitle,
          entry.servicesSummary,
          entry.progressSummary,
          entry.barriers,
          entry.planForward,
          entry.hoursDelivered,
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
 * Daily cron: clients whose next progress report is due within 14 days or
 * already past due get one deduplicated HR case (flagType
 * 'progress_report_due', same dedup pattern as hrCases.ts) plus one
 * notifications row per org:admin/org:coordinator member.
 */
export const checkProgressReportsDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const todayDateOnly = new Date().toISOString().slice(0, 10)
    const dueSoonBoundary = addDaysDateOnly(todayDateOnly, DUE_SOON_DAYS)
    const year = new Date().getFullYear()
    let created = 0

    const tenants = await ctx.db.query('tenants').collect()

    for (const tenant of tenants) {
      const clients = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
      if (clients.length === 0) continue

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
      const adminAndCoordinator = staff.filter(
        (member) =>
          member.role === 'org:admin' || member.role === 'org:coordinator',
      )

      let sequence = allCases.length
      const autoCreatedAt = new Date().toISOString()

      for (const client of clients) {
        const objectives = await listClientObjectives(ctx, tenant._id, client._id)
        const reports = await listClientReports(ctx, tenant._id, client._id)
        const due = computeDueInfo(client, objectives, reports, todayDateOnly)

        if (!due.nextDueAt || due.nextDueAt > dueSoonBoundary) continue
        if (hasOpenFlag(openCases, client._id, 'progress_report_due')) continue

        const isOverdue = due.nextDueAt < todayDateOnly
        const cadenceLabel =
          due.periodType === 'quarterly' ? 'Quarterly' : 'Semi-annual'

        sequence += 1
        await ctx.db.insert('hrCases', {
          tenantId: tenant._id,
          caseNumber: `HR-${year}-${String(sequence).padStart(3, '0')}`,
          subjectType: 'client',
          subjectId: client._id,
          category: 'compliance',
          title: `${cadenceLabel} progress report ${isOverdue ? 'overdue' : 'due soon'}: ${client.displayName}`,
          status: 'open',
          description: `The ${cadenceLabel.toLowerCase()} ${client.serviceType} progress report for ${client.displayName} is due ${due.nextDueAt} (17 CCR §58680 + regional-center contract). Generate and submit it from the client record.`,
          flagType: 'progress_report_due',
          autoCreatedAt,
          createdAt: autoCreatedAt,
        })
        openCases.push({
          subjectId: client._id,
          flagType: 'progress_report_due',
        })
        created += 1

        for (const member of adminAndCoordinator) {
          await ctx.db.insert('notifications', {
            tenantId: tenant._id,
            clerkUserId: member.clerkUserId,
            type: 'progress_report_due',
            message: `${cadenceLabel} progress report ${isOverdue ? 'overdue' : 'due'} for ${client.displayName} (due ${due.nextDueAt}).`,
            metadata: { clientId: client._id as string },
            read: false,
            createdAt: autoCreatedAt,
          })
        }
      }
    }

    return { created }
  },
})
