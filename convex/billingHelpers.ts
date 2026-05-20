import { api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { assertTenantDoc, requireTenantRole } from './authHelpers'

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
  const { tenantId, identity, role } = await requireTenantRole(
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
  for (const lineId of uniqueLineIds) {
    const line = await ctx.db.get(lineId)
    if (!line) throw new Error('Billing line not found.')
    assertTenantDoc(line, tenantId)
    if (line.exportBatchId) {
      throw new Error(
        'One or more selected billing lines were already invoiced.',
      )
    }

    const shift = await ctx.db.get(line.shiftId)
    if (!shift) throw new Error('Shift not found for billing line.')
    assertTenantDoc(shift, tenantId)
    if (args.caregiverId && shift.caregiverId !== args.caregiverId) {
      throw new Error('Selected lines must match the invoice caregiver filter.')
    }
    caregiverIds.add(shift.caregiverId)
    lines.push(line)
  }

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
    caregiverId: singleCaregiverId,
    caregiverName: caregiver?.displayName ?? caregiver?.email,
    caregiverEmail: caregiver?.email,
    lineCount: uniqueLineIds.length,
    totalAmount,
  })

  await ctx.db.patch(invoiceId, {
    invoiceNumber: `ATRIA-${now.slice(0, 10).replace(/-/g, '')}-${String(
      invoiceId,
    )
      .slice(-6)
      .toUpperCase()}`,
  })

  for (const line of lines) {
    await ctx.db.patch(line._id, { exportBatchId: invoiceId })
  }

  await ctx.runMutation(api.audit.record, {
    clerkOrgId: args.clerkOrgId,
    actorId: identity.subject,
    actorRole: role,
    action: 'invoice_created',
    metadata: {
      invoiceId: invoiceId as string,
      lineCount: uniqueLineIds.length,
      totalAmount,
    },
  })

  return invoiceId
}
