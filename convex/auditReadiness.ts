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
async function buildReport(
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
