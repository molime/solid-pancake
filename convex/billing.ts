import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import {
  createInvoiceRecord,
  enrichInvoice,
  enrichLine,
  listInvoices,
} from './billingHelpers'

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
      .filter((q) => q.eq(q.field('exportBatchId'), undefined))
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
