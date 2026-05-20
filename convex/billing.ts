import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { api } from './_generated/api'

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
      assertTenantDoc(line, tenantId)
      const shift = await ctx.db.get(line.shiftId)
      if (shift) assertTenantDoc(shift, tenantId)
      const client = shift ? await ctx.db.get(shift.clientId) : null
      if (client) assertTenantDoc(client, tenantId)
      enriched.push({
        ...line,
        clientName: client?.displayName ?? 'Unknown',
        serviceType: shift?.serviceType ?? 'SLS',
        scheduledStart: shift?.scheduledStart ?? '',
      })
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
      assertTenantDoc(line, tenantId)
      const shift = await ctx.db.get(line.shiftId)
      if (shift) assertTenantDoc(shift, tenantId)
      const client = shift ? await ctx.db.get(shift.clientId) : null
      if (client) assertTenantDoc(client, tenantId)
      enriched.push({
        ...line,
        clientName: client?.displayName ?? 'Unknown',
        serviceType: shift?.serviceType ?? 'SLS',
        scheduledStart: shift?.scheduledStart ?? '',
      })
    }

    return enriched
  },
})

export const createExportBatch = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    lineIds: v.array(v.id('billingLines')),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator'],
    )

    const uniqueLineIds = Array.from(new Set(args.lineIds))

    if (uniqueLineIds.length === 0) {
      throw new Error('Select at least one billing line to export.')
    }

    const lines = []
    for (const lineId of uniqueLineIds) {
      const line = await ctx.db.get(lineId)
      if (!line) throw new Error('Billing line not found.')
      assertTenantDoc(line, tenantId)
      if (line.exportBatchId) {
        throw new Error(
          'One or more selected billing lines were already exported.',
        )
      }
      lines.push(line)
    }

    const batchId = await ctx.db.insert('exportBatches', {
      tenantId,
      name: args.name,
      exportedAt: new Date().toISOString(),
      exportedBy: identity.subject,
    })

    for (const line of lines) {
      await ctx.db.patch(line._id, { exportBatchId: batchId })
    }

    await ctx.runMutation(api.audit.record, {
      clerkOrgId: args.clerkOrgId,
      actorId: identity.subject,
      actorRole: role,
      action: 'billing_exported',
      metadata: { batchId: batchId as string, lineCount: uniqueLineIds.length },
    })

    return batchId
  },
})

export const exportBatches = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('exportBatches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(50)
  },
})
