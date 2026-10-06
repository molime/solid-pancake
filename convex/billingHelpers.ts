import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import { notifyTenantStaff } from './_utils/notifications'
import { validateShiftDocumentation } from './shiftValidation'

type BillingLine = Doc<'billingLines'>
type ExportBatch = Doc<'exportBatches'>

export async function enrichLine(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  line: BillingLine,
) {
  assertTenantDoc(line, tenantId)
  const shift = await ctx.db.get(line.shiftId)
  if (shift) assertTenantDoc(shift, tenantId)
  const client = shift ? await ctx.db.get(shift.clientId) : null
  if (client) assertTenantDoc(client, tenantId)
  const caregiver = shift
    ? await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', shift.caregiverId),
        )
        .unique()
    : null

  return {
    ...line,
    clientName: client?.displayName ?? 'Unknown client',
    serviceType: shift?.serviceType ?? 'SLS',
    scheduledStart: shift?.scheduledStart ?? '',
    scheduledEnd: shift?.scheduledEnd ?? '',
    caregiverId: shift?.caregiverId ?? '',
    caregiverName: caregiver?.displayName ?? caregiver?.email ?? 'Unknown user',
    caregiverEmail: caregiver?.email ?? '',
  }
}

export async function enrichInvoice(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
  invoice: ExportBatch,
) {
  assertTenantDoc(invoice, tenantId)
  const lines = await ctx.db
    .query('billingLines')
    .withIndex('by_tenant_export_batch', (q) =>
      q.eq('tenantId', tenantId).eq('exportBatchId', invoice._id),
    )
    .collect()
  const totalAmount =
    invoice.totalAmount ??
    Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100

  return {
    ...invoice,
    invoiceNumber:
      invoice.invoiceNumber ??
      `ATRIA-${invoice.exportedAt.slice(0, 10).replace(/-/g, '')}`,
    lineCount: invoice.lineCount ?? lines.length,
    totalAmount,
    // Migration fallback: exportBatches rows written before the status field
    // existed read as 'draft'.
    status: invoice.status ?? 'draft',
  }
}

export async function listInvoices(ctx: QueryCtx, tenantId: Id<'tenants'>) {
  const invoices = await ctx.db
    .query('exportBatches')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .order('desc')
    .take(50)

  const enriched = []
  for (const invoice of invoices) {
    enriched.push(await enrichInvoice(ctx, tenantId, invoice))
  }
  return enriched
}

/**
 * Billing-line block check (client-requested billing rules): professional
 * credentials must NOT block billing — only (a) a missing/incomplete progress
 * note and (b) an hours mismatch against the client's approved hours do.
 *
 * Approved hours come from clients.authorizationHours (the monthly service
 * authorization the agency gets from the payer, e.g. Sark). The check sums
 * the client's delivered hours for the shift's month (approved/billing_ready
 * shifts, GPS punches when present, else the scheduled window) plus this
 * shift's documented hours and blocks when that exceeds the authorization.
 */
export async function checkBillingBlocked(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  shift: Doc<'shifts'>,
  documentedHours: number,
): Promise<{ blocked: boolean; reason?: string }> {
  const note = await ctx.db
    .query('progressNotes')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shift._id),
    )
    .unique()
  if (!note) {
    return { blocked: true, reason: 'Missing progress note.' }
  }
  const tasks = await ctx.db
    .query('shiftTasks')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shift._id),
    )
    .collect()
  if (validateShiftDocumentation(note, tasks).length > 0) {
    return { blocked: true, reason: 'Progress note is incomplete.' }
  }

  const client = await ctx.db.get(shift.clientId)
  if (client && client.authorizationHours != null) {
    const month = shift.scheduledStart.slice(0, 7)
    const [year, monthIndex] = month.split('-').map(Number)
    const startIso = new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString()
    const endIso = new Date(Date.UTC(year, monthIndex, 1)).toISOString()

    let deliveredHours = 0
    for (const status of ['approved', 'billing_ready'] as const) {
      const monthShifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('status', status)
            .gte('scheduledStart', startIso)
            .lt('scheduledStart', endIso),
        )
        .collect()
      for (const other of monthShifts) {
        if (other.clientId !== shift.clientId || other._id === shift._id) {
          continue
        }
        const start = other.clockInAt ?? other.scheduledStart
        const end = other.clockOutAt ?? other.scheduledEnd
        const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000
        if (hours > 0) deliveredHours += hours
      }
    }

    const totalHours = Math.round((deliveredHours + documentedHours) * 100) / 100
    if (totalHours > client.authorizationHours) {
      return {
        blocked: true,
        reason: `Hours exceed the client's approved hours: ${totalHours}h delivered vs ${client.authorizationHours}h approved for ${month}.`,
      }
    }
  }

  return { blocked: false }
}

export async function createInvoiceRecord(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    name: string
    lineIds: Id<'billingLines'>[]
    periodStart?: string
    periodEnd?: string
    caregiverId?: string
  },
) {
  const { tenantId, identity } = await requireTenantRole(
    ctx,
    args.clerkOrgId,
    ['org:admin', 'org:coordinator'],
  )

  const uniqueLineIds = Array.from(new Set(args.lineIds))
  if (uniqueLineIds.length === 0) {
    throw new Error('Select at least one billing line to invoice.')
  }

  const lines = []
  const caregiverIds = new Set<string>()
  const clientIds = new Set<string>()
  for (const lineId of uniqueLineIds) {
    const line = await ctx.db.get(lineId)
    if (!line) throw new Error('Billing line not found.')
    assertTenantDoc(line, tenantId)
    if (line.exportBatchId) {
      throw new Error(
        'One or more selected billing lines were already invoiced.',
      )
    }
    // Blocked lines are excluded from invoicing (skipped, not fatal).
    if (line.blockedReason) {
      continue
    }

    const shift = await ctx.db.get(line.shiftId)
    if (!shift) throw new Error('Shift not found for billing line.')
    assertTenantDoc(shift, tenantId)
    if (args.caregiverId && shift.caregiverId !== args.caregiverId) {
      throw new Error('Selected lines must match the invoice caregiver filter.')
    }
    caregiverIds.add(shift.caregiverId)
    clientIds.add(shift.clientId as string)
    lines.push(line)
  }

  if (lines.length === 0) {
    throw new Error('All selected billing lines are blocked from invoicing.')
  }

  // One invoice per client: line items from different clients can never be
  // mixed into a single invoice (client-requested guard).
  if (clientIds.size > 1) {
    throw new Error(
      'Selected billing lines belong to different clients. Create one invoice per client.',
    )
  }
  const singleClientId = Array.from(clientIds)[0] as Id<'clients'>

  const singleCaregiverId =
    caregiverIds.size === 1 ? Array.from(caregiverIds)[0] : undefined
  const caregiver = singleCaregiverId
    ? await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', singleCaregiverId),
        )
        .unique()
    : null

  const now = new Date().toISOString()
  const totalAmount =
    Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
  const invoiceId = await ctx.db.insert('exportBatches', {
    tenantId,
    name: args.name,
    exportedAt: now,
    exportedBy: identity.subject,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    clientId: singleClientId,
    caregiverId: singleCaregiverId,
    caregiverName: caregiver?.displayName ?? caregiver?.email,
    caregiverEmail: caregiver?.email,
    lineCount: lines.length,
    totalAmount,
  })

  const invoiceNumber = `ATRIA-${now.slice(0, 10).replace(/-/g, '')}-${String(
    invoiceId,
  )
    .slice(-6)
    .toUpperCase()}`
  await ctx.db.patch(invoiceId, { invoiceNumber })

  for (const line of lines) {
    await ctx.db.patch(line._id, { exportBatchId: invoiceId })
  }

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: 'invoice_created',
    metadata: {
      invoiceId: invoiceId as string,
      lineCount: lines.length,
      totalAmount,
    },
  })

  await notifyTenantStaff(ctx, tenantId, ['org:admin', 'org:coordinator'], {
    type: 'invoice_created',
    message: `Invoice ${invoiceNumber} has been created for $${totalAmount}.`,
    metadata: {
      invoiceId: invoiceId as string,
      invoiceNumber,
      amount: totalAmount,
    },
  })

  return invoiceId
}
