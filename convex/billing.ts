import { ConvexError, v } from 'convex/values'
import {
  action,
  internalMutation,
  internalQuery,
  query,
  mutation,
  type MutationCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  assertTenantDoc,
  requireTenantRole,
  requireTenantRoleAction,
} from './authHelpers'
import {
  createInvoiceRecord,
  enrichInvoice,
  enrichLine,
  listInvoices,
} from './billingHelpers'

const BILLING_ROLES: ('org:admin' | 'org:coordinator')[] = [
  'org:admin',
  'org:coordinator',
]

// Invoice status machine: a missing status counts as 'draft'.
// 'paid' and 'void' are terminal.
const INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
}

export const ledger = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(200)

    const enriched = []
    for (const line of lines) {
      enriched.push(await enrichLine(ctx, tenantId, line))
    }
    return enriched
  },
})

export const unexported = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field('exportBatchId'), undefined),
          q.eq(q.field('blockedReason'), undefined),
        ),
      )
      .take(200)

    const enriched = []
    for (const line of lines) {
      enriched.push(await enrichLine(ctx, tenantId, line))
    }
    return enriched
  },
})

export const createInvoice = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    lineIds: v.array(v.id('billingLines')),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    caregiverId: v.optional(v.string()),
  },
  handler: async (ctx, args) => createInvoiceRecord(ctx, args),
})

export const createExportBatch = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    lineIds: v.array(v.id('billingLines')),
  },
  handler: async (ctx, args) => createInvoiceRecord(ctx, args),
})

export const invoices = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])
    return listInvoices(ctx, tenantId)
  },
})

export const exportBatches = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])
    return listInvoices(ctx, tenantId)
  },
})

export const invoiceDetails = query({
  args: { clerkOrgId: v.string(), invoiceId: v.id('exportBatches') },
  handler: async (ctx, { clerkOrgId, invoiceId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const invoice = await ctx.db.get(invoiceId)
    if (!invoice) throw new Error('Invoice not found.')
    const enrichedInvoice = await enrichInvoice(ctx, tenantId, invoice)
    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) =>
        q.eq('tenantId', tenantId).eq('exportBatchId', invoiceId),
      )
      .collect()

    const enrichedLines = []
    for (const line of lines) {
      enrichedLines.push(await enrichLine(ctx, tenantId, line))
    }

    return { invoice: enrichedInvoice, lines: enrichedLines }
  },
})

export const createPerPatientInvoices = mutation({
  args: {
    clerkOrgId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    payerType: v.optional(v.string()),
  },
  handler: async (ctx, { clerkOrgId, startDate, endDate, payerType }) => {
    const { tenantId, tenant, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      BILLING_ROLES,
    )

    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field('exportBatchId'), undefined),
          q.eq(q.field('blockedReason'), undefined),
          q.gte(q.field('createdAt'), startDate),
          // Date-only end bounds are treated as inclusive end-of-day.
          q.lte(
            q.field('createdAt'),
            endDate.length === 10 ? `${endDate}T23:59:59.999Z` : endDate,
          ),
        ),
      )
      .collect()

    const groups = new Map<
      string,
      {
        clientId: Id<'clients'>
        coordinatorId?: string
        lines: Doc<'billingLines'>[]
      }
    >()
    for (const line of lines) {
      const shift = await ctx.db.get(line.shiftId)
      if (!shift) continue
      assertTenantDoc(shift, tenantId)
      const key = shift.clientId as string
      const group = groups.get(key) ?? { clientId: shift.clientId, lines: [] }
      group.lines.push(line)
      if (!group.coordinatorId && shift.coordinatorId) {
        group.coordinatorId = shift.coordinatorId
      }
      groups.set(key, group)
    }

    const now = new Date().toISOString()
    const yyyymm = startDate.slice(0, 7).replace('-', '')
    let count = 0

    // Invoice numbers already issued for this tenant, so a repeat run in the
    // same month cannot reuse a number for the same client.
    const existingNumbers = new Set(
      (
        await ctx.db
          .query('exportBatches')
          .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
          .collect()
      ).map((batch) => batch.invoiceNumber),
    )

    for (const group of groups.values()) {
      const client = await ctx.db.get(group.clientId)
      if (!client) continue
      assertTenantDoc(client, tenantId)

      const lastName =
        (client.displayName.trim().split(/\s+/).pop() ?? 'Client').replace(
          /[^A-Za-z0-9]/g,
          '',
        ) || 'Client'
      const totalAmount =
        Math.round(
          group.lines.reduce((sum, line) => sum + line.amount, 0) * 100,
        ) / 100

      const invoiceId = await ctx.db.insert('exportBatches', {
        tenantId,
        name: `${client.displayName} ${yyyymm}`,
        clientId: group.clientId,
        payerType: payerType ?? 'medicaid',
        status: 'draft',
        exportedAt: now,
        exportedBy: identity.subject,
        periodStart: startDate,
        periodEnd: endDate,
        lineCount: group.lines.length,
        totalAmount,
      })
      let invoiceNumber = `INV-${tenant.slug}-${lastName}-${yyyymm}`
      for (let seq = 2; existingNumbers.has(invoiceNumber); seq++) {
        invoiceNumber = `INV-${tenant.slug}-${lastName}-${yyyymm}-${seq}`
      }
      existingNumbers.add(invoiceNumber)
      await ctx.db.patch(invoiceId, { invoiceNumber })

      for (const line of group.lines) {
        await ctx.db.patch(line._id, { exportBatchId: invoiceId })
      }

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId,
        action: 'invoice_created',
        metadata: {
          invoiceId: invoiceId as string,
          invoiceNumber,
          clientId: group.clientId as string,
          lineCount: group.lines.length,
          totalAmount,
        },
      })

      // Notify the responsible coordinator when one is resolvable from the
      // group's shifts; otherwise skip without blocking invoice creation.
      if (group.coordinatorId) {
        const coordinator = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_user', (q) =>
            q
              .eq('tenantId', tenantId)
              .eq('clerkUserId', group.coordinatorId as string),
          )
          .unique()
        if (coordinator) {
          await ctx.scheduler.runAfter(
            0,
            internal._utils.notifications.sendStaffNotification,
            {
              tenantId,
              clerkUserId: coordinator.clerkUserId,
              type: 'invoice_created',
              message: `Invoice ${invoiceNumber} created for ${client.displayName}.`,
              metadata: { invoiceId: invoiceId as string, invoiceNumber },
            },
          )
        }
      }

      count++
    }

    return { count }
  },
})

export const releaseBillingBlock = mutation({
  args: {
    clerkOrgId: v.string(),
    billingLineId: v.id('billingLines'),
    reason: v.string(),
  },
  handler: async (ctx, { clerkOrgId, billingLineId, reason }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, BILLING_ROLES)

    const line = await ctx.db.get(billingLineId)
    if (!line) throw new ConvexError('Billing line not found.')
    assertTenantDoc(line, tenantId)

    await ctx.db.patch(billingLineId, {
      blockedReason: undefined,
      blockedAt: undefined,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId,
      action: 'billing_block_released',
      metadata: { billingLineId: billingLineId as string, reason },
    })

    return { released: true }
  },
})

async function transitionInvoice(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    invoiceId: Id<'exportBatches'>
    nextStatus: 'sent' | 'paid' | 'void'
  },
) {
  const { tenantId } = await requireTenantRole(
    ctx,
    args.clerkOrgId,
    BILLING_ROLES,
  )

  const invoice = await ctx.db.get(args.invoiceId)
  if (!invoice) throw new ConvexError('Invoice not found.')
  assertTenantDoc(invoice, tenantId)

  const currentStatus = invoice.status ?? 'draft'
  const allowed = INVOICE_TRANSITIONS[currentStatus] ?? []
  if (!allowed.includes(args.nextStatus)) {
    throw new ConvexError(
      `Cannot move invoice from '${currentStatus}' to '${args.nextStatus}'.`,
    )
  }

  await ctx.db.patch(args.invoiceId, { status: args.nextStatus })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: 'invoice_status_changed',
    previousStatus: currentStatus,
    nextStatus: args.nextStatus,
    metadata: {
      invoiceId: args.invoiceId as string,
      invoiceNumber: invoice.invoiceNumber ?? '',
    },
  })

  return { status: args.nextStatus }
}

export const markInvoiceSent = mutation({
  args: { clerkOrgId: v.string(), invoiceId: v.id('exportBatches') },
  handler: async (ctx, args) =>
    transitionInvoice(ctx, { ...args, nextStatus: 'sent' }),
})

export const markInvoicePaid = mutation({
  args: { clerkOrgId: v.string(), invoiceId: v.id('exportBatches') },
  handler: async (ctx, args) =>
    transitionInvoice(ctx, { ...args, nextStatus: 'paid' }),
})

export const voidInvoice = mutation({
  args: { clerkOrgId: v.string(), invoiceId: v.id('exportBatches') },
  handler: async (ctx, args) => {
    const result = await transitionInvoice(ctx, { ...args, nextStatus: 'void' })

    // Voiding returns the invoice's lines to the unexported pool so they can
    // be re-invoiced (same mental model as requestCorrection).
    const { tenantId } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      BILLING_ROLES,
    )
    const lines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) =>
        q.eq('tenantId', tenantId).eq('exportBatchId', args.invoiceId),
      )
      .collect()
    for (const line of lines) {
      await ctx.db.patch(line._id, { exportBatchId: undefined })
    }

    return result
  },
})

export const createPayPeriod = mutation({
  args: {
    clerkOrgId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { clerkOrgId, startDate, endDate }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, BILLING_ROLES)

    if (startDate > endDate) {
      throw new ConvexError('startDate must be on or before endDate.')
    }

    // Overlap is checked against ALL periods, not just open ones: punches
    // are selected purely by date range at export time, so a new period
    // overlapping an already-exported one would export the same hours twice.
    const existingPeriods = await ctx.db
      .query('payPeriods')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .collect()

    const overlaps = existingPeriods.some(
      (period) => period.startDate <= endDate && period.endDate >= startDate,
    )
    if (overlaps) {
      throw new ConvexError('A pay period overlaps these dates.')
    }

    return ctx.db.insert('payPeriods', {
      tenantId,
      startDate,
      endDate,
      status: 'open',
    })
  },
})

export const listPayPeriods = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, BILLING_ROLES)

    return ctx.db
      .query('payPeriods')
      .withIndex('by_tenant_dates', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()
  },
})

export const loadPayrollExportData = internalQuery({
  args: { tenantId: v.id('tenants'), payPeriodId: v.id('payPeriods') },
  handler: async (ctx, { tenantId, payPeriodId }) => {
    const period = await ctx.db.get(payPeriodId)
    if (!period) throw new ConvexError('Pay period not found.')
    assertTenantDoc(period, tenantId)

    // Date-only end bounds are treated as inclusive end-of-day (same
    // convention as createPerPatientInvoices and audit.list), otherwise
    // punches on the final day of the pay period would be excluded.
    const endBound =
      period.endDate.length === 10
        ? `${period.endDate}T23:59:59.999Z`
        : period.endDate

    const punches = await ctx.db
      .query('timePunches')
      .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId))
      .filter((q) =>
        q.and(
          q.gte(q.field('at'), period.startDate),
          q.lte(q.field('at'), endBound),
        ),
      )
      .collect()

    // Pair clock_in/clock_out punches per shift (sorted by time) and sum the
    // paired durations into per-caregiver hours.
    const punchesByShift = new Map<string, Doc<'timePunches'>[]>()
    for (const punch of punches) {
      const key = punch.shiftId as string
      const list = punchesByShift.get(key) ?? []
      list.push(punch)
      punchesByShift.set(key, list)
    }

    const hoursByCaregiver = new Map<string, number>()
    for (const shiftPunches of punchesByShift.values()) {
      shiftPunches.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      let openPunch: Doc<'timePunches'> | null = null
      for (const punch of shiftPunches) {
        if (punch.punchType === 'clock_in') {
          if (!openPunch) openPunch = punch
        } else if (openPunch) {
          const hours =
            (new Date(punch.at).getTime() - new Date(openPunch.at).getTime()) /
            3_600_000
          if (hours > 0) {
            hoursByCaregiver.set(
              openPunch.caregiverId,
              (hoursByCaregiver.get(openPunch.caregiverId) ?? 0) + hours,
            )
          }
          openPunch = null
        }
      }
    }

    const entries = []
    for (const [caregiverId, hours] of hoursByCaregiver) {
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
        )
        .unique()
      entries.push({
        caregiverId,
        caregiverName: member?.displayName ?? member?.email ?? caregiverId,
        hours: Math.round(hours * 100) / 100,
      })
    }
    entries.sort((a, b) => (a.caregiverId < b.caregiverId ? -1 : 1))

    return {
      period,
      entries,
      punches: punches.map((punch) => ({
        timePunchId: punch._id,
        caregiverId: punch.caregiverId,
        punchType: punch.punchType,
        at: punch.at,
      })),
    }
  },
})

export const completePayrollExport = internalMutation({
  args: {
    clerkOrgId: v.string(),
    payPeriodId: v.id('payPeriods'),
    path: v.union(v.literal('adp'), v.literal('csv')),
    csv: v.optional(v.string()),
  },
  handler: async (ctx, { clerkOrgId, payPeriodId, path, csv }) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      clerkOrgId,
      BILLING_ROLES,
    )

    const period = await ctx.db.get(payPeriodId)
    if (!period) throw new ConvexError('Pay period not found.')
    assertTenantDoc(period, tenantId)
    // Re-export is blocked: punches are selected purely by date range at
    // export time, so exporting an already-exported period would pay the
    // same hours twice (same rationale as the createPayPeriod overlap check).
    if (period.status === 'exported') {
      throw new ConvexError('This pay period has already been exported.')
    }
    await ctx.db.patch(payPeriodId, {
      status: 'exported',
      exportedAt: new Date().toISOString(),
      exportedBy: identity.subject,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId,
      action: path === 'adp' ? 'payroll_exported' : 'payroll_exported_csv',
      metadata: {
        payPeriodId: payPeriodId as string,
        startDate: period.startDate,
        endDate: period.endDate,
        ...(csv !== undefined ? { csv } : {}),
      },
    })

    return { status: 'exported' }
  },
})

// exportPayroll is an ACTION (not a mutation) because it must await the ADP
// internal action synchronously to implement the failure -> CSV fallback;
// mutations cannot call ctx.runAction.
export const exportPayroll = action({
  args: { clerkOrgId: v.string(), payPeriodId: v.id('payPeriods') },
  // Explicit return type breaks an inference cycle through the generated
  // fullApi types (this file references its own internal.billing.* functions).
  handler: async (
    ctx,
    { clerkOrgId, payPeriodId },
  ): Promise<{
    status: string
    path: string
    caregiverCount: number
    csv?: string
  }> => {
    const { member } = await requireTenantRoleAction(
      ctx,
      clerkOrgId,
      BILLING_ROLES,
    )
    const tenantId = member.tenantId

    const data = await ctx.runQuery(internal.billing.loadPayrollExportData, {
      tenantId,
      payPeriodId,
    })
    const adpConfigured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )

    if (adpConfigured) {
      const result = await ctx.runAction(
        internal.adpOutbound.exportPayrollToAdp,
        {
          tenantId,
          payPeriodId,
          entries: data.entries,
          punches: data.punches,
        },
      )
      if (result.success) {
        await ctx.runMutation(internal.billing.completePayrollExport, {
          clerkOrgId,
          payPeriodId,
          path: 'adp',
        })
        return {
          status: 'exported',
          path: 'adp',
          caregiverCount: data.entries.length,
        }
      }
      // ADP export failed — fall through to the CSV fallback path.
    }

    // CSV fallback. Agency scale keeps this bounded, but the CSV is stored in
    // the audit event metadata, so very large agencies risk oversized
    // metadata payloads.
    const csvRows = ['caregiver_id,caregiver_name,hours']
    for (const entry of data.entries) {
      csvRows.push(
        `${entry.caregiverId},${entry.caregiverName.replace(/,/g, ' ')},${entry.hours.toFixed(2)}`,
      )
    }
    const csv = csvRows.join('\n')

    await ctx.runMutation(internal.billing.completePayrollExport, {
      clerkOrgId,
      payPeriodId,
      path: 'csv',
      csv,
    })

    return {
      status: 'exported',
      path: 'csv',
      caregiverCount: data.entries.length,
      csv,
    }
  },
})
