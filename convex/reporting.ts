import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import { computeComplianceCounts } from './compliance'

function currentMonthRange(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths,
    1,
  ).toISOString()
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offsetMonths + 1,
    1,
  ).toISOString()
  return { start, end }
}

function humanizeAction(action: string) {
  const spaced = action.replace(/[._]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const getAdminDashboardSummary = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const { start, end } = currentMonthRange()

    const billingLines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) =>
        q.eq('tenantId', tenantId),
      )
      .collect()
    // Compliance-blocked lines are not billable, so they are excluded from
    // the ready-to-bill pool (same convention as billing.unexported).
    const unexportedLines = billingLines.filter(
      (line) =>
        line.exportBatchId === undefined && line.blockedReason === undefined,
    )
    const readyToBillAmount = unexportedLines.reduce(
      (sum, line) => sum + line.amount,
      0,
    )

    // documentArchiveItems status vocabulary: 'active' | 'verified' |
    // 'rejected' — 'active' means uploaded and awaiting HR review.
    const docItems = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    const docsAwaitingReview = docItems.filter(
      (item) => item.status === 'active',
    ).length
    const compliance = computeComplianceCounts(docItems)
    const complianceRate =
      compliance.total === 0
        ? 0
        : Math.round((compliance.compliant / compliance.total) * 100)

    const caregivers = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .collect()
    const shiftsThisMonth = shifts.filter(
      (s) => s.scheduledStart >= start && s.scheduledStart < end,
    )

    // Candidate status vocabulary (candidates.ts): 'invited' | 'applied' |
    // 'hired' | 'rejected' — anything not hired/rejected is still waiting.
    const candidates = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) => q.eq('tenantId', tenantId))
      .collect()
    const onboardingWaiting = candidates.filter(
      (c) => c.status !== 'hired' && c.status !== 'rejected',
    ).length

    return {
      readyToBill: unexportedLines.length,
      readyToBillAmount: Math.round(readyToBillAmount * 100) / 100,
      docsAwaitingReview,
      complianceRate,
      activeCaregivers: caregivers.length,
      exceptions: {
        // Shifts bounced back for correction cannot proceed to billing.
        billingBlocked: shifts.filter((s) => s.status === 'needs_correction')
          .length,
        complianceExpired: compliance.expired,
        onboardingWaiting,
      },
      monthly: {
        revenueBilled: Math.round(
          billingLines
            .filter(
              (line) =>
                line.createdAt >= start &&
                line.createdAt < end &&
                line.blockedReason === undefined,
            )
            .reduce((sum, line) => sum + line.amount, 0) * 100,
        ) / 100,
        visitsCompleted: shiftsThisMonth.filter(
          (s) => s.status === 'approved' || s.status === 'billing_ready',
        ).length,
      },
    }
  },
})

export const getAgencyReport = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const thisMonth = currentMonthRange()
    const lastMonth = currentMonthRange(-1)

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .collect()
    const billingLines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) =>
        q.eq('tenantId', tenantId),
      )
      .collect()
    const docItems = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .collect()
    const caregivers = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()

    const inRange = (iso: string, range: { start: string; end: string }) =>
      iso >= range.start && iso < range.end

    const monthShifts = shifts.filter((s) =>
      inRange(s.scheduledStart, thisMonth),
    )
    const compliance = computeComplianceCounts(docItems)

    // Simple week bucketing for the current month: days 1-7, 8-14, 15-21,
    // 22-28, 29-end.
    const visitsByWeek = [
      { label: 'Week 1', count: 0 },
      { label: 'Week 2', count: 0 },
      { label: 'Week 3', count: 0 },
      { label: 'Week 4', count: 0 },
      { label: 'Week 5', count: 0 },
    ]
    for (const shift of monthShifts) {
      const day = new Date(shift.scheduledStart).getDate()
      const bucket = Math.min(Math.floor((day - 1) / 7), 4)
      visitsByWeek[bucket].count += 1
    }

    const revenueIn = (range: { start: string; end: string }) =>
      Math.round(
        billingLines
          .filter((line) => inRange(line.createdAt, range))
          .reduce((sum, line) => sum + line.amount, 0) * 100,
      ) / 100

    return {
      visitsThisMonth: monthShifts.length,
      visitsLastMonth: shifts.filter((s) =>
        inRange(s.scheduledStart, lastMonth),
      ).length,
      revenueThisMonth: revenueIn(thisMonth),
      revenueLastMonth: revenueIn(lastMonth),
      complianceRate:
        compliance.total === 0
          ? 0
          : Math.round((compliance.compliant / compliance.total) * 100),
      activeCaregivers: caregivers.length,
      visitsByWeek,
    }
  },
})

/**
 * Notification feed for the current user. Reads the persisted notifications
 * table (scoped to the caller) when it has rows for them; falls back to the
 * legacy derived feed (auditEvents + reviewEvents) during the migration
 * period.
 */
export const listNotifications = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr'],
    )

    // Persisted rows are private to the recipient — never expose other
    // users' notifications tenant-wide.
    const persisted = await ctx.db
      .query('notifications')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .order('desc')
      .take(100)

    if (persisted.length > 0) {
      return persisted.map((row) => ({
        id: row._id as string,
        type: row.type,
        message: row.message,
        createdAt: row.createdAt,
        read: row.read,
      }))
    }

    const auditEvents = await ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(50)
    const reviewEvents = (
      await ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId))
        .collect()
    )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)

    const notifications = [
      ...auditEvents.map((event) => ({
        id: `audit:${event._id as string}`,
        type: 'audit',
        message: humanizeAction(event.action),
        createdAt: event.createdAt,
        read: false,
      })),
      ...reviewEvents.map((event) => ({
        id: `review:${event._id as string}`,
        type: 'review',
        message:
          event.decision === 'approved'
            ? 'Shift approved'
            : 'Shift correction requested',
        createdAt: event.createdAt,
        read: false,
      })),
    ]

    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return notifications
  },
})

function csvCell(value: unknown) {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

// Inclusive day-level range check; works for both date-only and full ISO
// inputs by comparing the YYYY-MM-DD prefix.
function inRangeDay(iso: string, startDate: string, endDate: string) {
  const day = iso.slice(0, 10)
  return day >= startDate.slice(0, 10) && day <= endDate.slice(0, 10)
}

/**
 * Builds a CSV export for the given report type and inclusive date range.
 * Mutation (not query) so the frontend can trigger it from a button click.
 */
export const exportReport = mutation({
  args: {
    clerkOrgId: v.string(),
    reportType: v.union(
      v.literal('agency'),
      v.literal('compliance'),
      v.literal('billing'),
    ),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
      'org:hr',
    ])

    if (args.reportType === 'agency') {
      const shifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      const clients = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      const members = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect()

      const clientName = new Map(clients.map((c) => [c._id as string, c.displayName]))
      const caregiverName = new Map(members.map((m) => [m.clerkUserId, m.displayName]))

      const rows = shifts
        .filter((s) => inRangeDay(s.scheduledStart, args.startDate, args.endDate))
        .map((s) => [
          s.scheduledStart.slice(0, 10),
          clientName.get(s.clientId as string) ?? 'Unknown client',
          caregiverName.get(s.caregiverId) ?? s.caregiverId,
          s.serviceType,
          s.status,
          s.rate,
        ])

      return toCsv(
        ['date', 'client', 'caregiver', 'serviceType', 'status', 'rate'],
        rows,
      )
    }

    if (args.reportType === 'compliance') {
      const items = await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
        .collect()
      const nowIso = new Date().toISOString()

      const rows = items.map((item) => [
        item.subjectId,
        item.category,
        item.status,
        item.expiresAt ?? '',
        item.expiresAt && item.expiresAt < nowIso ? 'expired' : 'current',
        item.overrideStatus ?? '',
        item.overrideReason ?? '',
      ])

      return toCsv(
        [
          'subjectId',
          'category',
          'status',
          'expiresAt',
          'computedStatus',
          'overrideStatus',
          'overrideReason',
        ],
        rows,
      )
    }

    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()
    const batches = await ctx.db
      .query('exportBatches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const invoiceNumber = new Map(
      batches.map((b) => [b._id as string, b.invoiceNumber ?? '']),
    )

    const rows = []
    for (const line of lines) {
      if (!inRangeDay(line.createdAt, args.startDate, args.endDate)) continue
      const shift = await ctx.db.get(line.shiftId)
      rows.push([
        line.createdAt.slice(0, 10),
        line.exportBatchId
          ? (invoiceNumber.get(line.exportBatchId as string) ?? '')
          : '',
        shift?.caregiverId ?? '',
        line.hours,
        line.rate,
        line.amount,
        line.blockedReason ?? '',
      ])
    }

    return toCsv(
      ['date', 'invoiceNumber', 'caregiverId', 'hours', 'rate', 'amount', 'blockedReason'],
      rows,
    )
  },
})
