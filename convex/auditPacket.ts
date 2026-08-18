import { v, ConvexError } from 'convex/values'
import { query } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import { buildReport } from './auditReadiness'
import { verbalDueAt, writtenDueAt } from './incidents'

// One-click audit evidence packet (docs/07 §5 pillar E, build-order item 5):
// a single multi-section CSV covering what a regional-center auditor asks for
// in a biennial vendor-file review (17 CCR §54332(b)). Dashboard-metric
// sections reuse auditReadiness.buildReport so packet numbers always match
// the on-screen audit dashboard; log sections are filtered to the requested
// date range.

const PACKET_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

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

function validateDateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ConvexError(`${label} must be an ISO date (yyyy-mm-dd).`)
  }
}

function isBreached(
  reportedAt: string | undefined,
  dueAt: string,
  nowIso: string,
) {
  return reportedAt ? reportedAt > dueAt : nowIso > dueAt
}

export const exportPacketCsv = query({
  args: {
    clerkOrgId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      PACKET_ROLES,
    )

    validateDateOnly(args.startDate, 'Start date')
    validateDateOnly(args.endDate, 'End date')
    if (args.startDate > args.endDate) {
      throw new ConvexError('Start date must be on or before the end date.')
    }

    const startBound = `${args.startDate}T00:00:00.000Z`
    const endBound = `${args.endDate}T23:59:59.999Z`
    const nowIso = new Date().toISOString()

    // Shared dashboard computation — identical numbers to the Audit page.
    const report = await buildReport(ctx, tenantId, tenant)

    const obligations = await ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()
    const memberNames = new Map(
      members.map((member) => [member.clerkUserId, member.displayName]),
    )

    const completions = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const checks = await ctx.db
      .query('backgroundChecks')
      .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId))
      .collect()
    const candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()
    const candidateNames = new Map(
      candidates.map((candidate) => [candidate._id as string, candidate.displayName]),
    )

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clientNames = new Map(
      clients.map((client) => [client._id as string, client.displayName]),
    )

    const incidents = (
      await ctx.db
        .query('specialIncidents')
        .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
        .collect()
    ).filter(
      (incident) =>
        incident.occurredAt >= startBound && incident.occurredAt <= endBound,
    )

    const progressReports = (
      await ctx.db
        .query('progressReports')
        .withIndex('by_tenant_client_period', (q) => q.eq('tenantId', tenantId))
        .collect()
    ).filter(
      (progressReport) =>
        progressReport.periodStart >= args.startDate &&
        progressReport.periodStart <= args.endDate,
    )

    const blockedLines = (
      await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
        .collect()
    ).filter(
      (line) =>
        line.blockedReason &&
        line.createdAt >= startBound &&
        line.createdAt <= endBound,
    )

    const events = await ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) =>
        q
          .eq('tenantId', tenantId)
          .gte('createdAt', startBound)
          .lte('createdAt', endBound),
      )
      .collect()
    const eventsByAction: Record<string, number> = {}
    for (const event of events) {
      eventsByAction[event.action] = (eventsByAction[event.action] ?? 0) + 1
    }

    const rows: string[] = []

    rows.push(csvRow(['ATRIA-X Audit Evidence Packet']))
    rows.push(csvRow(['Generated', nowIso]))
    rows.push(csvRow(['Period', `${args.startDate} to ${args.endDate}`]))
    rows.push('')

    // 1. Agency info + obligations status.
    rows.push(csvRow(['Agency Information']))
    rows.push(csvRow(['Name', report.agency.name]))
    rows.push(csvRow(['EIN', report.agency.ein]))
    rows.push(csvRow(['Address', report.agency.address]))
    rows.push(csvRow(['Branches', report.branches.join('; ')]))
    rows.push('')
    rows.push(csvRow(['Agency Obligations']))
    rows.push(csvRow(['Obligation', 'Due', 'Completed', 'Status']))
    for (const obligation of obligations) {
      rows.push(
        csvRow([
          obligation.label,
          obligation.dueAt.slice(0, 10),
          obligation.completedAt?.slice(0, 10),
          obligation.dueAt < nowIso ? 'Overdue' : 'Current',
        ]),
      )
    }
    rows.push('')

    // 2. Personnel roster with credential status and gaps.
    rows.push(csvRow(['Personnel Roster']))
    rows.push(
      csvRow([
        'Name',
        'Credential Status',
        'Missing Credentials',
        'Expired Credentials',
        'Overridden Credentials',
      ]),
    )
    for (const gap of report.gaps) {
      const status =
        gap.missing.length === 0 && gap.expired.length === 0
          ? 'Compliant'
          : 'Action Needed'
      rows.push(
        csvRow([
          gap.displayName,
          status,
          gap.missing.join('; '),
          gap.expired.join('; '),
          gap.overridden.join('; '),
        ]),
      )
    }
    rows.push('')

    // 3. Training matrix.
    rows.push(csvRow(['Training Matrix']))
    rows.push(
      csvRow(['Employee', 'Training', 'Status', 'Completed At', 'Expires At']),
    )
    for (const completion of completions) {
      rows.push(
        csvRow([
          memberNames.get(completion.clerkUserId) ?? completion.clerkUserId,
          completion.trainingId,
          completion.status,
          completion.completedAt,
          completion.expiresAt,
        ]),
      )
    }
    rows.push('')

    // 4. Background checks.
    rows.push(csvRow(['Background Checks']))
    rows.push(
      csvRow([
        'Candidate',
        'Provider',
        'Package',
        'Status',
        'Initiated At',
        'Completed At',
      ]),
    )
    for (const check of checks) {
      rows.push(
        csvRow([
          candidateNames.get(check.candidateId as string) ?? 'Unknown',
          check.provider,
          check.package,
          check.status,
          check.initiatedAt,
          check.completedAt,
        ]),
      )
    }
    rows.push('')

    // 5. SIR log with 24h/48h timeliness columns (17 CCR §54327).
    rows.push(csvRow(['Special Incident Report Log (17 CCR §54327)']))
    rows.push(
      csvRow([
        'Client',
        'Category',
        'Occurred At',
        'Learned At',
        'Verbal Due (24h)',
        'Verbal Reported',
        'Verbal Breached',
        'Written Due (48h)',
        'Written Submitted',
        'Written Breached',
        'Agencies Notified',
        'Status',
      ]),
    )
    for (const incident of incidents) {
      const vDue = verbalDueAt(incident)
      const wDue = writtenDueAt(incident)
      rows.push(
        csvRow([
          clientNames.get(incident.clientId as string) ?? 'Unknown',
          incident.category,
          incident.occurredAt,
          incident.learnedAt,
          vDue,
          incident.verbalReportedAt,
          isBreached(incident.verbalReportedAt, vDue, nowIso) ? 'yes' : 'no',
          wDue,
          incident.writtenSubmittedAt,
          isBreached(incident.writtenSubmittedAt, wDue, nowIso) ? 'yes' : 'no',
          incident.agenciesNotified.join('; '),
          incident.status,
        ]),
      )
    }
    rows.push('')

    // 6. Progress reports (17 CCR §58680).
    rows.push(csvRow(['Progress Reports']))
    rows.push(
      csvRow([
        'Client',
        'Period Type',
        'Period Start',
        'Period End',
        'Status',
        'Submitted At',
        'Submitted To',
      ]),
    )
    for (const progressReport of progressReports) {
      rows.push(
        csvRow([
          clientNames.get(progressReport.clientId as string) ?? 'Unknown',
          progressReport.periodType,
          progressReport.periodStart,
          progressReport.periodEnd,
          progressReport.status,
          progressReport.submittedAt,
          progressReport.submittedTo,
        ]),
      )
    }
    rows.push('')

    // 7. Documentation completeness (same numbers as the dashboard).
    rows.push(csvRow(['Documentation Completeness']))
    rows.push(csvRow(['Metric', 'Count']))
    rows.push(csvRow(['Total Shifts', report.documentation.total]))
    rows.push(csvRow(['Shifts With Notes', report.documentation.withNotes]))
    rows.push(
      csvRow(['Shifts Without Notes', report.documentation.withoutNotes]),
    )
    rows.push('')

    // 8. Billing exceptions.
    rows.push(csvRow(['Billing Exceptions']))
    rows.push(csvRow(['Metric', 'Count']))
    rows.push(csvRow(['Blocked Billing Lines', report.blockedBillingLines]))
    rows.push(
      csvRow([
        'Evidence-Complete Billing Lines',
        `${report.evidence.complete} of ${report.evidence.total}`,
      ]),
    )
    rows.push('')
    rows.push(
      csvRow(['Client', 'Caregiver', 'Amount', 'Blocked Reason', 'Blocked At']),
    )
    for (const line of blockedLines) {
      const shift = await ctx.db.get(line.shiftId)
      const client = shift ? await ctx.db.get(shift.clientId) : null
      rows.push(
        csvRow([
          client?.displayName ?? 'Unknown',
          shift
            ? (memberNames.get(shift.caregiverId) ?? shift.caregiverId)
            : '',
          line.amount,
          line.blockedReason,
          line.blockedAt,
        ]),
      )
    }
    rows.push('')

    // 9. Audit events summary.
    rows.push(csvRow(['Audit Events']))
    rows.push(csvRow(['Action', 'Count']))
    for (const action of Object.keys(eventsByAction).sort()) {
      rows.push(csvRow([action, eventsByAction[action]]))
    }
    rows.push(csvRow(['Total', events.length]))

    return rows.join('\r\n')
  },
})
