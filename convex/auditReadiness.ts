import { v } from 'convex/values'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireTenantRole } from './authHelpers'
import {
  computeComplianceCounts,
  computeComplianceGaps,
  EXPIRING_SOON_DAYS,
} from './compliance'
import { loadLineEvidence } from './evidence'
import { withSlaFields } from './incidents'
import { computeDueInfo } from './progressReports'

const AUDIT_ROLES: ('org:admin' | 'org:hr')[] = ['org:admin', 'org:hr']

const DAY_MS = 24 * 60 * 60 * 1000
const AUDIT_EVENT_WINDOW_DAYS = 30

function isBlank(value: string | undefined | null) {
  return !value || value.trim() === ''
}

/**
 * Aggregates everything the audit-readiness report needs for one tenant.
 * Shared by getReport (UI) and exportCsv (download) so both surfaces always
 * show identical numbers. Counts only — no row payloads beyond the
 * per-employee gaps list leave this function.
 *
 * Note on documentation: shifts carry no notes field, so shift documentation
 * is derived from progressNotes (a shift counts as documented when it has at
 * least one progress note with a non-blank narrative).
 */
export async function buildReport(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  tenant: Doc<'tenants'>,
) {
  const now = new Date()
  const nowIso = now.toISOString()
  const trainingExpiringCutoff = new Date(
    now.getTime() + EXPIRING_SOON_DAYS * DAY_MS,
  ).toISOString()
  const auditWindowStart = new Date(
    now.getTime() - AUDIT_EVENT_WINDOW_DAYS * DAY_MS,
  ).toISOString()

  const branches = await ctx.db
    .query('agencyBranches')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .collect()

  const archiveItems = await ctx.db
    .query('documentArchiveItems')
    .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
    .collect()

  const gaps = await computeComplianceGaps(ctx, tenantId)

  const checks = await ctx.db
    .query('backgroundChecks')
    .withIndex('by_tenant_candidate', (q) => q.eq('tenantId', tenantId))
    .collect()
  const backgroundChecks = { clear: 0, pending: 0, consider: 0, other: 0 }
  for (const check of checks) {
    if (check.status === 'clear') backgroundChecks.clear += 1
    else if (check.status === 'pending') backgroundChecks.pending += 1
    else if (check.status === 'consider') backgroundChecks.consider += 1
    else backgroundChecks.other += 1
  }

  const completions = await ctx.db
    .query('platformTrainingCompletions')
    .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
    .collect()
  const training = { completed: 0, pending: 0, expiring: 0 }
  for (const completion of completions) {
    const isExpired =
      !!completion.expiresAt && completion.expiresAt < nowIso
    if (completion.status === 'completed' && !isExpired) {
      training.completed += 1
      if (
        completion.expiresAt &&
        completion.expiresAt <= trainingExpiringCutoff
      ) {
        training.expiring += 1
      }
    } else {
      training.pending += 1
    }
  }

  const shifts = await ctx.db
    .query('shifts')
    .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
    .collect()
  let withNotes = 0
  for (const shift of shifts) {
    const notes = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', shift._id),
      )
      .collect()
    if (notes.some((note) => !isBlank(note.narrative))) withNotes += 1
  }

  const lines = await ctx.db
    .query('billingLines')
    .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
    .collect()
  const blockedBillingLines = lines.filter(
    (line) => !isBlank(line.blockedReason),
  ).length

  // Lineage spot check (docs/07 gap row B7): how many billing lines have a
  // complete evidence chain (clock-in + clock-out punches, a non-blank
  // progress note, and a review event). Shared definition with
  // evidence.loadLineEvidence so the dashboard and the lineage view agree.
  let evidenceCompleteLines = 0
  for (const line of lines) {
    const evidence = await loadLineEvidence(ctx, tenantId, line)
    if (evidence.complete) evidenceCompleteLines += 1
  }

  const events = await ctx.db
    .query('auditEvents')
    .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
    .collect()
  const recentEvents = events.filter(
    (event) => event.createdAt >= auditWindowStart,
  ).length

  return {
    agency: {
      name: tenant.name,
      ein: tenant.ein ?? null,
      address: tenant.address ?? null,
    },
    branches: branches
      .filter((branch) => branch.active)
      .map((branch) => branch.label),
    personnel: computeComplianceCounts(archiveItems, now),
    gaps,
    backgroundChecks: {
      ...backgroundChecks,
      total: checks.length,
    },
    training: {
      ...training,
      total: completions.length,
    },
    documentation: {
      total: shifts.length,
      withNotes,
      withoutNotes: shifts.length - withNotes,
    },
    blockedBillingLines,
    evidence: {
      complete: evidenceCompleteLines,
      total: lines.length,
    },
    auditEvents: {
      total: events.length,
      last30Days: recentEvents,
    },
  }
}

export const getReport = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      AUDIT_ROLES,
    )

    return buildReport(ctx, tenantId, tenant)
  },
})

/**
 * CSV cell escaping: every field is double-quoted, internal quotes are
 * doubled, embedded newlines are flattened to spaces, and values that start
 * with a formula character (= + - @) are prefixed with an apostrophe so
 * spreadsheet apps cannot execute them.
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

type AuditReport = Awaited<ReturnType<typeof buildReport>>

function buildCsv(report: AuditReport, generatedAt: string) {
  const rows: string[] = []

  rows.push(csvRow(['ATRIA-X Audit Readiness Report']))
  rows.push(csvRow(['Generated', generatedAt]))
  rows.push('')

  rows.push(csvRow(['Agency Information']))
  rows.push(csvRow(['Name', report.agency.name]))
  rows.push(csvRow(['EIN', report.agency.ein]))
  rows.push(csvRow(['Address', report.agency.address]))
  rows.push(csvRow(['Branches', report.branches.join('; ')]))
  rows.push('')

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

  rows.push(csvRow(['Background Checks']))
  rows.push(csvRow(['Status', 'Count']))
  rows.push(csvRow(['Clear', report.backgroundChecks.clear]))
  rows.push(csvRow(['Pending', report.backgroundChecks.pending]))
  rows.push(csvRow(['Consider', report.backgroundChecks.consider]))
  rows.push(csvRow(['Other', report.backgroundChecks.other]))
  rows.push('')

  rows.push(csvRow(['Training']))
  rows.push(csvRow(['Metric', 'Count']))
  rows.push(csvRow(['Completed', report.training.completed]))
  rows.push(csvRow(['Pending', report.training.pending]))
  rows.push(csvRow(['Expiring within 30 days', report.training.expiring]))
  rows.push('')

  rows.push(csvRow(['Documentation']))
  rows.push(csvRow(['Metric', 'Count']))
  rows.push(csvRow(['Total Shifts', report.documentation.total]))
  rows.push(csvRow(['Shifts With Notes', report.documentation.withNotes]))
  rows.push(
    csvRow(['Shifts Without Notes', report.documentation.withoutNotes]),
  )
  rows.push('')

  rows.push(csvRow(['Billing']))
  rows.push(csvRow(['Metric', 'Count']))
  rows.push(csvRow(['Blocked Billing Lines', report.blockedBillingLines]))
  rows.push(
    csvRow([
      'Evidence-Complete Billing Lines',
      `${report.evidence.complete} of ${report.evidence.total}`,
    ]),
  )
  rows.push('')

  rows.push(csvRow(['Compliance Gaps']))
  rows.push(csvRow(['Employee', 'Missing', 'Expired']))
  for (const gap of report.gaps) {
    if (gap.missing.length === 0 && gap.expired.length === 0) continue
    rows.push(
      csvRow([
        gap.displayName,
        gap.missing.join('; '),
        gap.expired.join('; '),
      ]),
    )
  }
  rows.push('')

  rows.push(csvRow(['Audit Events']))
  rows.push(csvRow(['Metric', 'Count']))
  rows.push(csvRow(['Total Events', report.auditEvents.total]))
  rows.push(csvRow(['Events Last 30 Days', report.auditEvents.last30Days]))

  return rows.join('\r\n')
}

export const exportCsv = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, tenant } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      AUDIT_ROLES,
    )

    const report = await buildReport(ctx, tenantId, tenant)
    return buildCsv(report, new Date().toISOString())
  },
})

// ---------------------------------------------------------------------------
// Fix list (docs/design-audit-simplification.md, stage 1): the plain-language,
// worst-first action list behind the simple /audit view. Derived from the
// SAME tables and helpers as the full view — buildReport gaps, the shared
// incidents.withSlaFields SLA math, and progressReports.computeDueInfo — so
// the traffic light can never disagree with the auditor-facing dashboard.
// ---------------------------------------------------------------------------

const FIX_SOON_DAYS = 30

type FixItem = {
  id: string
  severity: 'critical' | 'soon'
  title: string
  detail?: string
  // Null when the caller's role cannot open the target page (e.g. /billing
  // is admin/coordinator-only, so HR sees the item without a Fix button).
  linkTo: string | null
  dueAt?: string
}

function hoursUntil(iso: string, now: Date) {
  return Math.round((new Date(iso).getTime() - now.getTime()) / (60 * 60 * 1000))
}

function dueInDetail(iso: string, now: Date) {
  const hours = hoursUntil(iso, now)
  if (hours >= 48) {
    const days = Math.round(hours / 24)
    return `due in ${days} day${days === 1 ? '' : 's'}`
  }
  if (hours >= 1) return `due in ${hours} hour${hours === 1 ? '' : 's'}`
  return 'due in under an hour'
}

function overdueByDetail(iso: string, now: Date) {
  const hours = -hoursUntil(iso, now)
  if (hours >= 48) {
    const days = Math.round(hours / 24)
    return `overdue by ${days} day${days === 1 ? '' : 's'}`
  }
  if (hours >= 1) return `overdue by ${hours} hour${hours === 1 ? '' : 's'}`
  return 'overdue'
}

/** Strips statutory citations (e.g. "(WIC §4652.5)") from user-facing labels. */
function plainLabel(label: string) {
  return label.replace(/\s*\([^)]*\)/g, '').trim()
}

function compareFixItems(a: FixItem, b: FixItem) {
  if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
  if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1
  if (a.dueAt && !b.dueAt) return -1
  if (!a.dueAt && b.dueAt) return 1
  return a.title.localeCompare(b.title)
}

export const getFixList = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, tenant, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      AUDIT_ROLES,
    )

    const now = new Date()
    const nowIso = now.toISOString()
    const soonCutoff = new Date(
      now.getTime() + FIX_SOON_DAYS * DAY_MS,
    ).toISOString()
    const todayDateOnly = nowIso.slice(0, 10)
    const items: FixItem[] = []

    // Credential gaps — the exact same per-employee objects the full view
    // renders in its gaps table.
    const report = await buildReport(ctx, tenantId, tenant)
    for (const gap of report.gaps) {
      const subject = gap.clerkUserId ?? gap.displayName
      for (const label of gap.expired) {
        items.push({
          id: `credential-expired-${subject}-${label}`,
          severity: 'critical',
          title: `${gap.displayName}'s ${label} expired`,
          linkTo: '/compliance',
        })
      }
      for (const label of gap.missing) {
        items.push({
          id: `credential-missing-${subject}-${label}`,
          severity: 'critical',
          title: `${gap.displayName} is missing: ${label}`,
          linkTo: '/compliance',
        })
      }
    }

    // Credentials expiring inside the same 30-day window the compliance page
    // uses. Gaps only surface expired/missing, so expiring items are read
    // from documentArchiveItems directly with the same label resolution as
    // computeComplianceGaps.
    const requirements = await ctx.db
      .query('credentialRequirements')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()
    const labelByCategory = new Map(
      requirements.map((requirement) => [requirement.category, requirement.label]),
    )
    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const nameBySubject = new Map<string, string>()
    for (const profile of profiles) {
      nameBySubject.set(profile._id as string, profile.displayName)
      if (profile.clerkUserId) {
        nameBySubject.set(profile.clerkUserId, profile.displayName)
      }
    }
    const archiveItems = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    for (const item of archiveItems) {
      if (item.subjectType !== 'employee') continue
      if (item.overrideStatus === 'overridden') continue
      if (!item.expiresAt || item.expiresAt < nowIso || item.expiresAt > soonCutoff) {
        continue
      }
      const name = nameBySubject.get(item.subjectId) ?? 'A team member'
      const label = labelByCategory.get(item.category) ?? item.category
      const days = Math.max(1, Math.round(hoursUntil(item.expiresAt, now) / 24))
      items.push({
        id: `credential-expiring-${item._id}`,
        severity: 'soon',
        title: `${name}'s ${label} expires in ${days} day${days === 1 ? '' : 's'}`,
        linkTo: '/compliance',
        dueAt: item.expiresAt,
      })
    }

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const clientNames = new Map(
      clients.map((client) => [client._id as string, client.displayName]),
    )

    // SIR deadlines — the shared withSlaFields math, so the traffic light,
    // the timeliness pillar, and the SIR CSV always agree.
    const incidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    for (const incident of incidents) {
      if (incident.status === 'closed') continue
      const sla = withSlaFields(incident, nowIso)
      const clientName =
        clientNames.get(incident.clientId as string) ?? 'a client'
      const linkTo = `/incidents/${incident._id}`
      if (!incident.verbalReportedAt) {
        items.push(
          sla.verbalBreached
            ? {
                id: `sir-verbal-${incident._id}`,
                severity: 'critical',
                title: `${clientName}'s incident still needs the 24-hour call to the regional center`,
                detail: overdueByDetail(sla.verbalDueAt, now),
                linkTo,
                dueAt: sla.verbalDueAt,
              }
            : {
                id: `sir-verbal-${incident._id}`,
                severity: 'soon',
                title: `Call the regional center about ${clientName}'s incident`,
                detail: dueInDetail(sla.verbalDueAt, now),
                linkTo,
                dueAt: sla.verbalDueAt,
              },
        )
      }
      if (!incident.writtenSubmittedAt) {
        items.push(
          sla.writtenBreached
            ? {
                id: `sir-written-${incident._id}`,
                severity: 'critical',
                title: `${clientName}'s incident is missing its written report`,
                detail: overdueByDetail(sla.writtenDueAt, now),
                linkTo,
                dueAt: sla.writtenDueAt,
              }
            : {
                id: `sir-written-${incident._id}`,
                severity: 'soon',
                title: `${clientName}'s incident needs its written report`,
                detail: dueInDetail(sla.writtenDueAt, now),
                linkTo,
                dueAt: sla.writtenDueAt,
              },
        )
      }
    }

    // Agency obligations (insurance certificates, disclosures, …) — citations
    // stripped so the simple view never shows statute references.
    const obligations = await ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .collect()
    for (const obligation of obligations) {
      const label = plainLabel(obligation.label)
      if (obligation.dueAt < nowIso) {
        items.push({
          id: `obligation-${obligation._id}`,
          severity: 'critical',
          title: `${label} is overdue`,
          detail: overdueByDetail(obligation.dueAt, now),
          linkTo: '/compliance',
          dueAt: obligation.dueAt,
        })
      } else if (obligation.dueAt <= soonCutoff) {
        items.push({
          id: `obligation-${obligation._id}`,
          severity: 'soon',
          title: `${label} is due soon`,
          detail: dueInDetail(obligation.dueAt, now),
          linkTo: '/compliance',
          dueAt: obligation.dueAt,
        })
      }
    }

    // Progress reports — the same computeDueInfo math as
    // progressReports.getProgressReportSummary.
    for (const client of clients) {
      const clientReports = await ctx.db
        .query('progressReports')
        .withIndex('by_tenant_client_period', (q) =>
          q.eq('tenantId', tenantId).eq('clientId', client._id),
        )
        .collect()
      const objectives = await ctx.db
        .query('clientObjectives')
        .withIndex('by_tenant_client', (q) =>
          q.eq('tenantId', tenantId).eq('clientId', client._id),
        )
        .collect()
      const due = computeDueInfo(client, objectives, clientReports, todayDateOnly)
      const dueAt = due.nextDueAt ? `${due.nextDueAt}T00:00:00.000Z` : undefined
      if (due.dueStatus === 'overdue') {
        items.push({
          id: `progress-report-${client._id}`,
          severity: 'critical',
          title: `${client.displayName}'s ${due.periodType} progress report is overdue`,
          linkTo: `/clients/${client._id}`,
          dueAt,
        })
      } else if (due.dueStatus === 'due_soon') {
        items.push({
          id: `progress-report-${client._id}`,
          severity: 'soon',
          title: `${client.displayName}'s ${due.periodType} progress report is coming up`,
          detail: dueAt ? dueInDetail(dueAt, now) : undefined,
          linkTo: `/clients/${client._id}`,
          dueAt,
        })
      }
    }

    // Blocked billing lines. /billing is admin/coordinator-only, so HR sees
    // the item without a Fix button (linkTo: null).
    const canOpenBilling = role === 'org:admin'
    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()
    for (const line of lines) {
      if (isBlank(line.blockedReason)) continue
      const shift = await ctx.db.get(line.shiftId)
      const clientName = shift
        ? (clientNames.get(shift.clientId as string) ?? 'a client')
        : 'a client'
      items.push({
        id: `billing-${line._id}`,
        severity: 'critical',
        title: `A shift for ${clientName} can't be billed yet`,
        detail: line.blockedReason,
        linkTo: canOpenBilling ? '/billing' : null,
        dueAt: line.blockedAt ?? line.createdAt,
      })
    }

    items.sort(compareFixItems)

    const status: 'ready' | 'almost' | 'not_ready' = items.some(
      (item) => item.severity === 'critical',
    )
      ? 'not_ready'
      : items.length > 0
        ? 'almost'
        : 'ready'

    return { status, items }
  },
})

// ---------------------------------------------------------------------------
// Annual program evaluation (docs/07 §3.4, gap row B4; 17 CCR §58671(c)):
// a read-only aggregate of one fiscal year (CA state FY: July 1 – June 30,
// addressed by its end year). Computed on demand — never stored — so it can
// never go stale.
// ---------------------------------------------------------------------------

function shiftHours(shift: Doc<'shifts'>) {
  const start = shift.clockInAt ?? shift.scheduledStart
  const end = shift.clockOutAt ?? shift.scheduledEnd
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000
  return hours > 0 ? hours : 0
}

/** Current fiscal-year end year: FY runs July 1 – June 30. */
export function currentFiscalYearEnd(now: Date) {
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

function fiscalYearWindow(fiscalYearEnd: number) {
  return {
    startDate: `${fiscalYearEnd - 1}-07-01`,
    endDate: `${fiscalYearEnd}-06-30`,
  }
}

async function buildAnnualEvaluation(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  fiscalYearEnd: number,
) {
  const { startDate, endDate } = fiscalYearWindow(fiscalYearEnd)
  const startBound = `${startDate}T00:00:00.000Z`
  const endBound = `${endDate}T23:59:59.999Z`

  const shifts: Doc<'shifts'>[] = []
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
    shifts.push(...batch)
  }

  const servedClientIds = new Set<string>()
  let hoursDelivered = 0
  let withNotes = 0
  for (const shift of shifts) {
    servedClientIds.add(shift.clientId as string)
    hoursDelivered += shiftHours(shift)
    const notes = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', shift._id),
      )
      .collect()
    if (notes.some((note) => !isBlank(note.narrative))) withNotes += 1
  }

  const objectives = await ctx.db
    .query('clientObjectives')
    .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
    .collect()
  const objectiveCounts = { active: 0, achieved: 0, discontinued: 0 }
  for (const objective of objectives) {
    objectiveCounts[objective.status] += 1
  }

  const incidents = await ctx.db
    .query('specialIncidents')
    .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
    .collect()
  const incidentsByCategory: Record<string, number> = {}
  let incidentTotal = 0
  for (const incident of incidents) {
    const occurredDate = incident.occurredAt.slice(0, 10)
    if (occurredDate < startDate || occurredDate > endDate) continue
    incidentTotal += 1
    incidentsByCategory[incident.category] =
      (incidentsByCategory[incident.category] ?? 0) + 1
  }

  return {
    fiscalYearEnd,
    periodStart: startDate,
    periodEnd: endDate,
    clientsServed: servedClientIds.size,
    objectives: {
      ...objectiveCounts,
      total: objectives.length,
    },
    hoursDelivered: Math.round(hoursDelivered * 100) / 100,
    incidents: {
      total: incidentTotal,
      byCategory: incidentsByCategory,
    },
    documentation: {
      total: shifts.length,
      withNotes,
      withoutNotes: shifts.length - withNotes,
    },
  }
}

export const getAnnualEvaluation = query({
  args: { clerkOrgId: v.string(), fiscalYearEnd: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      AUDIT_ROLES,
    )
    const fiscalYearEnd = args.fiscalYearEnd ?? currentFiscalYearEnd(new Date())
    return buildAnnualEvaluation(ctx, tenantId, fiscalYearEnd)
  },
})

type AnnualEvaluation = Awaited<ReturnType<typeof buildAnnualEvaluation>>

function buildAnnualEvaluationCsv(
  evaluation: AnnualEvaluation,
  generatedAt: string,
) {
  const rows: string[] = []

  rows.push(csvRow(['ATRIA-X Annual Program Evaluation (17 CCR §58671(c))']))
  rows.push(csvRow(['Generated', generatedAt]))
  rows.push(
    csvRow([
      'Fiscal Year',
      `FY ${evaluation.fiscalYearEnd - 1}-${String(evaluation.fiscalYearEnd).slice(2)}`,
      'Period',
      `${evaluation.periodStart} to ${evaluation.periodEnd}`,
    ]),
  )
  rows.push('')

  rows.push(csvRow(['Service Delivery']))
  rows.push(csvRow(['Metric', 'Value']))
  rows.push(csvRow(['Clients Served', evaluation.clientsServed]))
  rows.push(csvRow(['Hours Delivered', evaluation.hoursDelivered]))
  rows.push('')

  rows.push(csvRow(['IPP/ISP Objectives']))
  rows.push(csvRow(['Status', 'Count']))
  rows.push(csvRow(['Active', evaluation.objectives.active]))
  rows.push(csvRow(['Achieved', evaluation.objectives.achieved]))
  rows.push(csvRow(['Discontinued', evaluation.objectives.discontinued]))
  rows.push(csvRow(['Total', evaluation.objectives.total]))
  rows.push('')

  rows.push(csvRow(['Special Incident Reports']))
  rows.push(csvRow(['Category', 'Count']))
  for (const category of Object.keys(evaluation.incidents.byCategory).sort()) {
    rows.push(csvRow([category, evaluation.incidents.byCategory[category]]))
  }
  rows.push(csvRow(['Total', evaluation.incidents.total]))
  rows.push('')

  rows.push(csvRow(['Documentation']))
  rows.push(csvRow(['Metric', 'Count']))
  rows.push(csvRow(['Total Shifts', evaluation.documentation.total]))
  rows.push(csvRow(['Shifts With Notes', evaluation.documentation.withNotes]))
  rows.push(
    csvRow(['Shifts Without Notes', evaluation.documentation.withoutNotes]),
  )

  return rows.join('\r\n')
}

export const exportAnnualEvaluationCsv = query({
  args: { clerkOrgId: v.string(), fiscalYearEnd: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      AUDIT_ROLES,
    )
    const fiscalYearEnd = args.fiscalYearEnd ?? currentFiscalYearEnd(new Date())
    const evaluation = await buildAnnualEvaluation(ctx, tenantId, fiscalYearEnd)
    return buildAnnualEvaluationCsv(evaluation, new Date().toISOString())
  },
})
