import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { requireIdentity } from './authHelpers'
import type { UserIdentity } from 'convex/server'
import {
  clerkErrorMessage,
  createClerkUserAndJoinOrg,
} from './_utils/invitationBypass'
import { requireEnv } from './_utils/env'
import {
  computeInvoiceLineItems,
  countActiveSeats,
  generateInvoiceNumber,
  round2,
} from './platformBilling'

type PlatformCtx = QueryCtx | MutationCtx

async function requirePlatformAdmin(ctx: PlatformCtx) {
  const identity = await requireIdentity(ctx)
  const existing = await ctx.db
    .query('platformAdmins')
    .withIndex('by_clerk_user_id', (q) =>
      q.eq('clerkUserId', identity.subject),
    )
    .unique()
  if (!existing) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

/**
 * Platform-admin guard for public actions. Mirrors requirePlatformAdmin, but
 * actions have no ctx.db, so the platformAdmins lookup goes through an
 * internal query (same pattern as platformStripe.ts).
 */
async function requirePlatformAdminAction(
  ctx: ActionCtx,
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  const isAdmin: boolean = await ctx.runQuery(
    internal.platformStripe.isPlatformAdminInternal,
    { clerkUserId: identity.subject },
  )
  if (!isAdmin) {
    throw new ConvexError('Forbidden: platform admin access required.')
  }
  return identity
}

async function recordPlatformAudit(
  ctx: MutationCtx,
  identity: UserIdentity,
  tenantId: Id<'tenants'>,
  action: string,
  metadata?: Record<string, unknown>,
) {
  await ctx.db.insert('auditEvents', {
    tenantId,
    actorId: identity.subject,
    actorRole: 'platform_admin',
    action,
    kind: 'platform',
    metadata,
    createdAt: new Date().toISOString(),
  })
}

/** Escape user/tenant-supplied strings before interpolating into HTML emails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  return { start, end }
}

async function getTenantSubscriptionDoc(ctx: PlatformCtx, tenantId: Id<'tenants'>) {
  return ctx.db
    .query('tenantSubscriptions')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()
}

async function getPlanByKey(ctx: PlatformCtx, planKey: string) {
  return ctx.db
    .query('pricingPlans')
    .withIndex('by_key', (q) => q.eq('key', planKey))
    .unique()
}

/**
 * Build a minimal PDF invoice as a base64-encoded string.
 * Uses a hand-rolled PDF structure (no external deps in Convex actions).
 * Produces a clean, readable invoice with line items, totals, and payment link.
 */
export function buildInvoicePdf(
  tenantName: string,
  invoice: Doc<'platformInvoices'>,
): string {
  const lines: string[] = []

  // Helper to escape PDF text
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  let y = 720
  const lineHeight = 16

  const addText = (text: string, size = 10, font = 'F1') => {
    lines.push(`BT /${font} ${size} Tf 1 0 0 1 72 ${y} Tm (${esc(text)}) Tj ET`)
    y -= lineHeight
  }

  const addRight = (text: string, size = 10, font = 'F1') => {
    lines.push(`BT /${font} ${size} Tf 1 0 0 1 500 ${y} Tm (${esc(text)}) Tj ET`)
    y -= lineHeight
  }

  // Header
  addText('ATRIA-X Platform', 20, 'F2')
  addText('Platform Invoice', 12)
  y -= 10
  addText(`Invoice Number: ${invoice.invoiceNumber}`, 10)
  addText(`Agency: ${tenantName}`, 10)
  addText(`Billing Period: ${invoice.periodStart} - ${invoice.periodEnd}`, 10)
  addText(`Due Date: ${invoice.dueDate}`, 10)
  addText(`Status: ${invoice.status.toUpperCase()}`, 10)
  y -= 10

  // Table header
  addText('Description', 9, 'F2')
  addRight('Qty', 9, 'F2')
  addRight('Unit Price', 9, 'F2')
  addRight('Amount', 9, 'F2')
  y -= 4
  lines.push(`72 ${y} 468 1 re f`)
  y -= 10

  // Line items
  for (const item of invoice.lineItems) {
    const desc = item.description.length > 50 ? item.description.slice(0, 47) + '...' : item.description
    addText(desc, 9)
    // Need to re-add the right-aligned values at the same y
    y += lineHeight
    addRight(String(item.quantity), 9)
    y += lineHeight
    addRight(`$${item.unitPrice.toFixed(2)}`, 9)
    y += lineHeight
    addRight(`$${item.amount.toFixed(2)}`, 9)
  }

  y -= 10
  lines.push(`72 ${y} 468 1 re f`)
  y -= 15
  addRight(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 10, 'F2')
  y -= 5
  addRight(`Total: $${invoice.total.toFixed(2)}`, 12, 'F2')

  y -= 20
  if (invoice.stripeHostedInvoiceUrl) {
    addText('Pay online:', 10, 'F2')
    addText(invoice.stripeHostedInvoiceUrl.slice(0, 60), 8)
    addText('Card or bank transfer (ACH) accepted.', 9)
  } else {
    addText('You will receive a separate email with a payment link.', 9)
  }

  y -= 20
  addText('ATRIA-X Platform Billing', 9)

  // Build PDF structure
  const content = lines.join('\n')
  const contentBytes = content.length

  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >>',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `4 0 obj << /Length ${contentBytes} >>
stream
${content}
endstream`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ]

  const offsets: number[] = []
  let pdfStr = pdf[0] + '\n'
  for (let i = 1; i < pdf.length; i++) {
    offsets.push(pdfStr.length)
    pdfStr += pdf[i] + '\n'
  }
  const xrefOffset = pdfStr.length
  pdfStr += `xref\n0 ${pdf.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdfStr += String(offset).padStart(10, '0') + ' 00000 n \n'
  }
  pdfStr += `trailer\n<< /Size ${pdf.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  // Convert to base64
  return Buffer.from(pdfStr, 'latin1').toString('base64')
}

export function buildInvoiceEmailHtml(
  tenantName: string,
  invoice: Doc<'platformInvoices'>,
) {
  const rows = invoice.lineItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td>` +
        `<td>$${item.unitPrice.toFixed(2)}</td><td>$${item.amount.toFixed(2)}</td></tr>`,
    )
    .join('')
  return (
    `<h2>Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>` +
    `<p><strong>${escapeHtml(tenantName)}</strong></p>` +
    `<p>Billing period: ${escapeHtml(invoice.periodStart)} – ${escapeHtml(invoice.periodEnd)}<br/>` +
    `Due date: ${escapeHtml(invoice.dueDate)}</p>` +
    `<table border="1" cellpadding="6" cellspacing="0">` +
    `<thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `<p><strong>Total: $${invoice.total.toFixed(2)}</strong></p>` +
    (invoice.stripeHostedInvoiceUrl
      ? `<p>Pay online: <a href="${escapeHtml(invoice.stripeHostedInvoiceUrl)}">${escapeHtml(invoice.stripeHostedInvoiceUrl)}</a></p>` +
        `<p>You can pay by card or bank transfer (ACH). A PDF copy of this invoice is available for download on the payment page.</p>`
      : `<p>You will receive a separate email with a payment link shortly.</p>`) +
    `<p>— ATRIA-X Platform Billing</p>`
  )
}

/**
 * Shared send logic used by sendPlatformInvoice and createPlatformInvoice
 * (sendImmediately). Marks the invoice sent and audits; the actual email is
 * sent by the scheduled sendInvoiceEmailWithStripe action, which runs the
 * Stripe mirror first so the email can include the hosted payment link.
 * Returns the resolved recipients. Scheduling failures never roll back the
 * mutation.
 */
async function sendInvoiceNow(
  ctx: MutationCtx,
  identity: UserIdentity,
  invoice: Doc<'platformInvoices'>,
  sendTo?: string[],
): Promise<string[]> {
  let recipients = sendTo ?? invoice.sentTo
  if (!recipients || recipients.length === 0) {
    const subscription = await getTenantSubscriptionDoc(ctx, invoice.tenantId)
    recipients = subscription?.billingEmails
  }
  if (!recipients || recipients.length === 0) {
    throw new ConvexError('No billing recipients available for this invoice.')
  }

  const now = new Date().toISOString()
  await ctx.db.patch(invoice._id, {
    status: 'sent',
    sentAt: now,
    sentTo: recipients,
    updatedAt: now,
  })

  await recordPlatformAudit(ctx, identity, invoice.tenantId, 'invoice_sent', {
    invoiceId: invoice._id as string,
    invoiceNumber: invoice.invoiceNumber,
    sentTo: recipients,
  })

  return recipients
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('platformAdmins')
      .withIndex('by_clerk_user_id', (q) =>
        q.eq('clerkUserId', identity.subject),
      )
      .unique()
    return !!existing
  },
})

export const listTenants = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    const tenants = await ctx.db.query('tenants').collect()

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        const members = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const clients = await ctx.db
          .query('clients')
          .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const shifts = await ctx.db
          .query('shifts')
          .withIndex('by_tenant_status_start', (q) =>
            q.eq('tenantId', tenant._id),
          )
          .collect()

        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          clerkOrgId: tenant.clerkOrgId,
          createdAt: tenant.createdAt,
          memberCount: members.length,
          clientCount: clients.length,
          shiftCount: shifts.length,
        }
      }),
    )

    return results
  },
})

export const listTenantsWithUsage = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    const tenants = await ctx.db.query('tenants').collect()

    return await Promise.all(
      tenants.map(async (tenant) => {
        const members = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const clients = await ctx.db
          .query('clients')
          .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
          .collect()
        const shifts = await ctx.db
          .query('shifts')
          .withIndex('by_tenant_status_start', (q) =>
            q.eq('tenantId', tenant._id),
          )
          .collect()
        const seatCount = await countActiveSeats(ctx, tenant._id)
        const subscription = await getTenantSubscriptionDoc(ctx, tenant._id)
        const plan = subscription
          ? await getPlanByKey(ctx, subscription.planKey)
          : null
        const mrr =
          subscription &&
          (subscription.status === 'active' ||
            subscription.status === 'trialing')
            ? (plan?.basePrice ?? 0)
            : 0

        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          clerkOrgId: tenant.clerkOrgId,
          address: tenant.address,
          createdAt: tenant.createdAt,
          memberCount: members.length,
          clientCount: clients.length,
          shiftCount: shifts.length,
          seatCount,
          subscription: subscription ?? null,
          mrr,
        }
      }),
    )
  },
})

export const getTenantDetail = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)

    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }

    const { start, end } = currentMonthRange()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', args.tenantId))
      .collect()
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .collect()
    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', args.tenantId),
      )
      .collect()
    const docsThisMonth = await ctx.db
      .query('documentArchiveItems')
      .withIndex('by_tenant_created', (q) =>
        q.eq('tenantId', args.tenantId).gte('createdAt', start),
      )
      .collect()

    const subscription = await getTenantSubscriptionDoc(ctx, args.tenantId)
    const plan = subscription
      ? await getPlanByKey(ctx, subscription.planKey)
      : null

    const invoices = await ctx.db
      .query('platformInvoices')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .order('desc')
      .collect()

    const recentAudit = await ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) =>
        q.eq('tenantId', args.tenantId),
      )
      .order('desc')
      .take(10)

    const countRole = (role: string) =>
      members.filter((m) => m.role === role).length

    return {
      tenant,
      subscription: subscription ?? null,
      plan: plan ?? null,
      usage: {
        seatCount: await countActiveSeats(ctx, args.tenantId),
        caregiverCount: countRole('org:caregiver'),
        coordinatorCount: countRole('org:coordinator'),
        adminHrCount: countRole('org:admin') + countRole('org:hr'),
        candidateCount: countRole('org:candidate'),
        clientCount: clients.length,
        shiftCount: shifts.length,
        shiftsThisMonth: shifts.filter(
          (s) => s.scheduledStart >= start && s.scheduledStart < end,
        ).length,
        docsThisMonth: docsThisMonth.length,
      },
      invoices,
      recentAudit,
    }
  },
})

export const getPricingPlans = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    return ctx.db.query('pricingPlans').collect()
  },
})

export const getTenantSubscription = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const subscription = await getTenantSubscriptionDoc(ctx, args.tenantId)
    const plan = subscription
      ? await getPlanByKey(ctx, subscription.planKey)
      : null
    return { subscription: subscription ?? null, plan: plan ?? null }
  },
})

export const listPlatformInvoices = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    const invoices = await ctx.db
      .query('platformInvoices')
      .order('desc')
      .collect()
    return await Promise.all(
      invoices.map(async (invoice) => {
        const tenant = await ctx.db.get(invoice.tenantId)
        return { ...invoice, tenantName: tenant?.name ?? 'Unknown tenant' }
      }),
    )
  },
})

export const listTenantInvoices = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    return ctx.db
      .query('platformInvoices')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .order('desc')
      .collect()
  },
})

export const getPlatformInvoice = query({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    const tenant = await ctx.db.get(invoice.tenantId)
    return { ...invoice, tenantName: tenant?.name ?? 'Unknown tenant' }
  },
})

export const calculateInvoicePreview = query({
  args: {
    tenantId: v.id('tenants'),
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    // periodStart/periodEnd are accepted for API stability even though the
    // seat count is point-in-time (current active members).
    const { lineItems, seats, plan, subscription } =
      await computeInvoiceLineItems(ctx, args.tenantId)
    const subtotal = round2(
      lineItems.reduce((sum, item) => sum + item.amount, 0),
    )
    return {
      lineItems,
      seats,
      plan: {
        key: plan.key,
        label: plan.label,
        basePrice: plan.basePrice,
        includedSeats: plan.includedSeats,
        perSeatPrice: plan.perSeatPrice,
      },
      subtotal,
      total: subtotal,
      billingEmails: subscription.billingEmails,
    }
  },
})

export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    const tenants = await ctx.db.query('tenants').collect()
    const subscriptions = await ctx.db.query('tenantSubscriptions').collect()
    const { start, end } = currentMonthRange()

    let mrr = 0
    for (const subscription of subscriptions) {
      if (
        subscription.status === 'active' ||
        subscription.status === 'trialing'
      ) {
        const plan = await getPlanByKey(ctx, subscription.planKey)
        mrr += plan?.basePrice ?? 0
      }
    }

    const countStatus = (status: string) =>
      subscriptions.filter((s) => s.status === status).length

    return {
      totalAgencies: tenants.length,
      activeCount: countStatus('active'),
      trialingCount: countStatus('trialing'),
      pastDueCount: countStatus('past_due'),
      suspendedCount: countStatus('suspended'),
      mrr,
      newThisMonth: tenants.filter(
        (t) => t.createdAt >= start && t.createdAt < end,
      ).length,
    }
  },
})

export const getTenantHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    const tenants = await ctx.db.query('tenants').collect()

    return await Promise.all(
      tenants.map(async (tenant) => {
        const openCases = await ctx.db
          .query('hrCases')
          .withIndex('by_tenant_status', (q) =>
            q.eq('tenantId', tenant._id).eq('status', 'open'),
          )
          .collect()
        const errorConnections = (
          await ctx.db
            .query('integrationConnections')
            .withIndex('by_tenant_provider', (q) =>
              q.eq('tenantId', tenant._id),
            )
            .collect()
        ).filter((c) => c.status === 'error')
        const errorPunches = await ctx.db
          .query('timePunches')
          .withIndex('by_tenant_sync_status', (q) =>
            q.eq('tenantId', tenant._id).eq('adpSyncStatus', 'error'),
          )
          .collect()
        const lastAudit = await ctx.db
          .query('auditEvents')
          .withIndex('by_tenant_created_at', (q) =>
            q.eq('tenantId', tenant._id),
          )
          .order('desc')
          .first()
        const subscription = await getTenantSubscriptionDoc(ctx, tenant._id)

        const complianceAlerts = openCases.length
        const syncErrors = errorConnections.length + errorPunches.length
        const billingStatus = subscription?.status ?? 'none'
        const lastActive = lastAudit?.createdAt ?? tenant.createdAt

        let status: 'healthy' | 'warning' | 'critical' = 'healthy'
        if (
          billingStatus === 'past_due' ||
          billingStatus === 'suspended' ||
          syncErrors > 0
        ) {
          status = 'critical'
        } else if (complianceAlerts > 0) {
          status = 'warning'
        }

        return {
          tenantId: tenant._id,
          tenantName: tenant.name,
          complianceAlerts,
          syncErrors,
          billingStatus,
          lastActive,
          status,
        }
      }),
    )
  },
})

/**
 * Drill-down for the tenant health page: the actual open HR cases,
 * integration connection errors, and ADP punch sync errors behind the counts
 * returned by getTenantHealth.
 */
export const getTenantHealthDetail = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)

    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }

    const openCases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) =>
        q.eq('tenantId', args.tenantId).eq('status', 'open'),
      )
      .collect()

    const errorConnections = (
      await ctx.db
        .query('integrationConnections')
        .withIndex('by_tenant_provider', (q) => q.eq('tenantId', args.tenantId))
        .collect()
    ).filter((c) => c.status === 'error')

    const errorPunches = await ctx.db
      .query('timePunches')
      .withIndex('by_tenant_sync_status', (q) =>
        q.eq('tenantId', args.tenantId).eq('adpSyncStatus', 'error'),
      )
      .collect()

    const syncErrors = await Promise.all(
      errorPunches.map(async (punch) => {
        const member = await ctx.db
          .query('tenantMembers')
          .withIndex('by_tenant_user', (q) =>
            q
              .eq('tenantId', args.tenantId)
              .eq('clerkUserId', punch.caregiverId),
          )
          .first()
        return {
          _id: punch._id,
          employeeName: member?.displayName ?? punch.caregiverId,
          punchType: punch.punchType,
          at: punch.at,
          error: punch.adpError ?? null,
        }
      }),
    )

    return {
      tenant: { _id: tenant._id, name: tenant.name },
      openCases: openCases.map((c) => ({
        _id: c._id,
        category: c.category,
        title: c.title,
        flagType: c.flagType ?? null,
        status: c.status,
        createdAt: c.createdAt,
      })),
      integrationErrors: errorConnections.map((c) => ({
        _id: c._id,
        provider: c.provider,
        status: c.status,
        error: c.note ?? null,
        lastCheckedAt: c.lastCheckedAt ?? null,
      })),
      syncErrors,
    }
  },
})

export const listAuditEvents = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    const events = await ctx.db.query('auditEvents').order('desc').take(200)
    events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    // Resolve actor names: check tenantMembers, employeeProfiles, platformAdmins
    const actorIds = new Set(events.map((e) => e.actorId))
    const actorNames = new Map<string, string>()
    for (const actorId of actorIds) {
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', actorId))
        .unique()
      if (member) {
        actorNames.set(actorId, member.displayName)
        continue
      }
      const pa = await ctx.db
        .query('platformAdmins')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', actorId))
        .unique()
      if (pa) {
        actorNames.set(actorId, 'Platform Admin')
        continue
      }
    }

    return await Promise.all(
      events.map(async (event) => {
        const tenant = await ctx.db.get(event.tenantId)
        return {
          _id: event._id,
          actorId: event.actorId,
          actorName: actorNames.get(event.actorId) ?? event.actorId,
          actorRole: event.actorRole,
          action: event.action,
          kind: event.kind,
          metadata: event.metadata,
          createdAt: event.createdAt,
          tenantId: event.tenantId,
          tenantName: tenant?.name ?? 'Unknown tenant',
        }
      }),
    )
  },
})

export const upsertPricingPlan = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    basePrice: v.number(),
    includedSeats: v.number(),
    perSeatPrice: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)

    const existing = await getPlanByKey(ctx, args.key)
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        basePrice: args.basePrice,
        includedSeats: args.includedSeats,
        perSeatPrice: args.perSeatPrice,
        active: args.active,
      })
      return existing._id
    }

    return ctx.db.insert('pricingPlans', {
      key: args.key,
      label: args.label,
      basePrice: args.basePrice,
      includedSeats: args.includedSeats,
      perSeatPrice: args.perSeatPrice,
      active: args.active,
    })
  },
})

const DEFAULT_PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    basePrice: 199,
    includedSeats: 10,
    perSeatPrice: 20,
    active: true,
  },
  {
    key: 'professional',
    label: 'Professional',
    basePrice: 499,
    includedSeats: 25,
    perSeatPrice: 18,
    active: true,
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    basePrice: 999,
    includedSeats: 50,
    perSeatPrice: 15,
    active: true,
  },
]

export const seedPricingPlans = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)

    for (const plan of DEFAULT_PLANS) {
      const existing = await getPlanByKey(ctx, plan.key)
      if (!existing) {
        await ctx.db.insert('pricingPlans', plan)
      }
    }

    return ctx.db.query('pricingPlans').collect()
  },
})

export const setTenantSubscription = mutation({
  args: {
    tenantId: v.id('tenants'),
    planKey: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('trialing'),
      v.literal('past_due'),
      v.literal('suspended'),
      v.literal('canceled'),
    ),
    billingEmails: v.array(v.string()),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.string(),
    renewsAt: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const plan = await getPlanByKey(ctx, args.planKey)
    if (!plan) {
      throw new ConvexError(`Pricing plan '${args.planKey}' does not exist.`)
    }

    const now = new Date().toISOString()
    const existing = await getTenantSubscriptionDoc(ctx, args.tenantId)

    let subscriptionId
    if (existing) {
      await ctx.db.patch(existing._id, {
        planKey: args.planKey,
        status: args.status,
        billingEmails: args.billingEmails,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        renewsAt: args.renewsAt,
        trialEndsAt: args.trialEndsAt,
        updatedAt: now,
      })
      subscriptionId = existing._id
    } else {
      subscriptionId = await ctx.db.insert('tenantSubscriptions', {
        tenantId: args.tenantId,
        planKey: args.planKey,
        status: args.status,
        billingEmails: args.billingEmails,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        renewsAt: args.renewsAt,
        trialEndsAt: args.trialEndsAt,
        createdAt: now,
        updatedAt: now,
      })
    }

    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'subscription_updated',
      { planKey: args.planKey, status: args.status },
    )

    return subscriptionId
  },
})

export const suspendTenant = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const subscription = await getTenantSubscriptionDoc(ctx, args.tenantId)
    if (!subscription) {
      throw new ConvexError('Tenant has no subscription.')
    }
    await ctx.db.patch(subscription._id, {
      status: 'suspended',
      updatedAt: new Date().toISOString(),
    })
    await recordPlatformAudit(ctx, identity, args.tenantId, 'tenant_suspended')
    return subscription._id
  },
})

export const reactivateTenant = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const subscription = await getTenantSubscriptionDoc(ctx, args.tenantId)
    if (!subscription) {
      throw new ConvexError('Tenant has no subscription.')
    }
    await ctx.db.patch(subscription._id, {
      status: 'active',
      updatedAt: new Date().toISOString(),
    })
    await recordPlatformAudit(ctx, identity, args.tenantId, 'tenant_reactivated')
    return subscription._id
  },
})

const manualLineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  amount: v.number(),
})

export const createPlatformInvoice = mutation({
  args: {
    tenantId: v.id('tenants'),
    periodStart: v.string(),
    periodEnd: v.string(),
    dueDate: v.string(),
    mode: v.union(v.literal('auto'), v.literal('manual')),
    lineItems: v.optional(v.array(manualLineItemValidator)),
    sendTo: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    sendImmediately: v.optional(v.boolean()),
    chargeViaStripe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }

    // Idempotency: reject when a non-void invoice already exists for the same
    // tenant + period.
    const existingInvoices = await ctx.db
      .query('platformInvoices')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .collect()
    const duplicate = existingInvoices.find(
      (inv) =>
        inv.status !== 'void' &&
        inv.periodStart === args.periodStart &&
        inv.periodEnd === args.periodEnd,
    )
    if (duplicate) {
      throw new ConvexError(
        `A non-void invoice already exists for this period (${duplicate.invoiceNumber}).`,
      )
    }

    let lineItems: Doc<'platformInvoices'>['lineItems']
    if (args.mode === 'auto') {
      const computed = await computeInvoiceLineItems(ctx, args.tenantId)
      lineItems = computed.lineItems
    } else {
      if (!args.lineItems || args.lineItems.length === 0) {
        throw new ConvexError(
          'Manual mode requires a non-empty lineItems array.',
        )
      }
      lineItems = args.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: round2(item.quantity * item.unitPrice),
        source: 'manual' as const,
      }))
    }

    const subtotal = round2(
      lineItems.reduce((sum, item) => sum + item.amount, 0),
    )
    const total = subtotal
    const invoiceNumber = await generateInvoiceNumber(ctx)
    const now = new Date().toISOString()

    const invoiceId = await ctx.db.insert('platformInvoices', {
      tenantId: args.tenantId,
      invoiceNumber,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.dueDate,
      lineItems,
      subtotal,
      total,
      status: 'draft',
      sentTo: args.sendTo,
      notes: args.notes,
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    })

    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'invoice_created',
      { invoiceId: invoiceId as string, invoiceNumber, mode: args.mode },
    )

    if (args.sendImmediately) {
      const invoice = await ctx.db.get(invoiceId)
      if (invoice) {
        const recipients = await sendInvoiceNow(ctx, identity, invoice, args.sendTo)
        // The scheduled action runs the Stripe mirror first, then sends the
        // email with the hosted payment link. Scheduling failures never roll
        // back the mutation.
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.platformStripe.sendInvoiceEmailWithStripe,
            { invoiceId, recipients },
          )
        } catch (err) {
          console.warn('Failed to schedule invoice email:', err)
        }
      }
    } else {
      // Stripe is always on: schedule the mirror invoice (create + finalize +
      // send). Scheduling failures never roll back the mutation.
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.platformStripe.createAndSendStripeInvoice,
          { invoiceId },
        )
      } catch (err) {
        console.warn('Failed to schedule Stripe invoice:', err)
      }
    }

    return invoiceId
  },
})

const fullLineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  amount: v.number(),
  source: v.union(v.literal('auto'), v.literal('manual')),
})

export const updatePlatformInvoice = mutation({
  args: {
    invoiceId: v.id('platformInvoices'),
    lineItems: v.array(fullLineItemValidator),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    sendTo: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (invoice.status !== 'draft') {
      throw new ConvexError('Only draft invoices can be updated.')
    }

    const lineItems = args.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: round2(item.quantity * item.unitPrice),
      source: item.source,
    }))
    const subtotal = round2(
      lineItems.reduce((sum, item) => sum + item.amount, 0),
    )

    await ctx.db.patch(args.invoiceId, {
      lineItems,
      subtotal,
      total: subtotal,
      dueDate: args.dueDate ?? invoice.dueDate,
      notes: args.notes ?? invoice.notes,
      sentTo: args.sendTo ?? invoice.sentTo,
      updatedAt: new Date().toISOString(),
    })

    await recordPlatformAudit(
      ctx,
      identity,
      invoice.tenantId,
      'invoice_updated',
      { invoiceId: args.invoiceId as string, invoiceNumber: invoice.invoiceNumber },
    )

    return args.invoiceId
  },
})

export const sendPlatformInvoice = mutation({
  args: {
    invoiceId: v.id('platformInvoices'),
    sendTo: v.optional(v.array(v.string())),
    chargeViaStripe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (invoice.status === 'paid' || invoice.status === 'void') {
      throw new ConvexError(
        `Cannot send an invoice with status '${invoice.status}'.`,
      )
    }
    // 'draft' sends normally; 'sent' allows a resend (updates sentAt/sentTo).

    const recipients = await sendInvoiceNow(ctx, identity, invoice, args.sendTo)

    // Stripe is always on: the scheduled action runs the Stripe mirror first
    // (no-op when already linked), then sends the email with the hosted
    // payment link.
    try {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStripe.sendInvoiceEmailWithStripe,
        { invoiceId: args.invoiceId, recipients },
      )
    } catch (err) {
      console.warn('Failed to schedule invoice email:', err)
    }

    return args.invoiceId
  },
})

export const markInvoicePaid = mutation({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
      throw new ConvexError(
        `Cannot mark an invoice with status '${invoice.status}' as paid.`,
      )
    }

    const now = new Date().toISOString()
    await ctx.db.patch(args.invoiceId, {
      status: 'paid',
      paidAt: now,
      updatedAt: now,
    })

    await recordPlatformAudit(
      ctx,
      identity,
      invoice.tenantId,
      'invoice_paid',
      { invoiceId: args.invoiceId as string, invoiceNumber: invoice.invoiceNumber },
    )

    if (invoice.stripeInvoiceId) {
      // Mirror the manual mark-paid to Stripe. Failures are warn-logged in
      // the scheduled action and never roll back the platform-side change.
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.platformStripe.payStripeInvoiceInternal,
          { invoiceId: args.invoiceId },
        )
      } catch (err) {
        console.warn('Failed to schedule Stripe invoice payment:', err)
      }
    }

    return args.invoiceId
  },
})

export const voidInvoice = mutation({
  args: { invoiceId: v.id('platformInvoices') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)

    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) {
      throw new ConvexError('Invoice not found.')
    }
    if (
      invoice.status !== 'draft' &&
      invoice.status !== 'sent' &&
      invoice.status !== 'overdue'
    ) {
      throw new ConvexError(
        `Cannot void an invoice with status '${invoice.status}'.`,
      )
    }

    await ctx.db.patch(args.invoiceId, {
      status: 'void',
      updatedAt: new Date().toISOString(),
    })

    await recordPlatformAudit(
      ctx,
      identity,
      invoice.tenantId,
      'invoice_voided',
      { invoiceId: args.invoiceId as string, invoiceNumber: invoice.invoiceNumber },
    )

    if (invoice.stripeInvoiceId) {
      // Mirror the void to Stripe. Failures are warn-logged in the scheduled
      // action and never roll back the platform-side change.
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.platformStripe.voidStripeInvoiceInternal,
          { invoiceId: args.invoiceId },
        )
      } catch (err) {
        console.warn('Failed to schedule Stripe invoice void:', err)
      }
    }

    return args.invoiceId
  },
})

export const requestSupportAccess = mutation({
  args: {
    tenantId: v.id('tenants'),
    reason: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }
    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'support_access_requested',
      { reason: args.reason, durationMinutes: args.durationMinutes },
    )
    return args.tenantId
  },
})

export const endSupportAccess = mutation({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }
    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'support_access_ended',
    )
    return args.tenantId
  },
})

// ═══════════════════════════════════════════════════════════════
// Platform Admin Enhancement: tenant creation, info, users, pricing, limits
// ═══════════════════════════════════════════════════════════════

const tenantStaffRole = v.union(
  v.literal('org:admin'),
  v.literal('org:coordinator'),
  v.literal('org:hr'),
  v.literal('org:caregiver'),
)

function requireClerkSecretKey(): string {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new ConvexError('Server configuration is missing CLERK_SECRET_KEY.')
  }
  return secretKey
}

/** Tenant lookup for action contexts (no ctx.db in actions). */
export const getTenantInternal = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId)
  },
})

/** Insert a platform audit event from an action context. */
export const recordPlatformAuditInternal = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    actorId: v.string(),
    action: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('auditEvents', {
      tenantId: args.tenantId,
      actorId: args.actorId,
      actorRole: 'platform_admin',
      action: args.action,
      kind: 'platform',
      metadata: args.metadata,
      createdAt: new Date().toISOString(),
    })
  },
})

/**
 * Creates the Convex tenant + default subscription + audit event after the
 * Clerk org exists. Called only from the createTenant action.
 */
export const createTenantInternal = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    ein: v.optional(v.string()),
    address: v.optional(v.string()),
    planKey: v.string(),
    billingEmails: v.array(v.string()),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const plan = await getPlanByKey(ctx, args.planKey)
    if (!plan) {
      throw new ConvexError(`Pricing plan '${args.planKey}' does not exist.`)
    }

    const existing = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()
    if (existing) {
      throw new ConvexError('A tenant already exists for this Clerk org.')
    }

    const now = new Date()
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      ein: args.ein,
      address: args.address,
      createdAt: now.toISOString(),
    })

    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    await ctx.db.insert('tenantSubscriptions', {
      tenantId,
      planKey: args.planKey,
      status: 'active',
      billingEmails: args.billingEmails,
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      renewsAt: periodEnd.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })

    await ctx.db.insert('auditEvents', {
      tenantId,
      actorId: args.actorId,
      actorRole: 'platform_admin',
      action: 'tenant_created',
      kind: 'platform',
      metadata: {
        clerkOrgId: args.clerkOrgId,
        name: args.name,
        slug: args.slug,
        planKey: args.planKey,
      },
      createdAt: now.toISOString(),
    })

    return tenantId
  },
})

/**
 * Deletes a tenantMembers record + audit event. Called only from the
 * removeUserFromTenant action.
 */
export const removeTenantMemberInternal = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    await ctx.db.insert('auditEvents', {
      tenantId: args.tenantId,
      actorId: args.actorId,
      actorRole: 'platform_admin',
      action: 'tenant_user_removed',
      kind: 'platform',
      metadata: { clerkUserId: args.clerkUserId },
      createdAt: new Date().toISOString(),
    })
  },
})

export const createTenant = action({
  args: {
    name: v.string(),
    slug: v.string(),
    ein: v.optional(v.string()),
    address: v.optional(v.string()),
    planKey: v.optional(v.string()),
    billingEmails: v.array(v.string()),
    ownerEmail: v.optional(v.string()),
    ownerDisplayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdminAction(ctx)
    const secretKey = requireClerkSecretKey()
    const planKey = args.planKey ?? 'starter'

    // Create the Clerk organization first — if this fails, no tenant record
    // is created.
    const response = await fetch('https://api.clerk.com/v1/organizations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: args.name }),
    })

    if (!response.ok) {
      const payload = await response.json()
      throw new ConvexError(clerkErrorMessage(payload))
    }

    const org = (await response.json()) as { id: string }

    const tenantId: Id<'tenants'> = await ctx.runMutation(
      internal.platform.createTenantInternal,
      {
        clerkOrgId: org.id,
        name: args.name,
        slug: args.slug,
        ein: args.ein,
        address: args.address,
        planKey,
        billingEmails: args.billingEmails,
        actorId: identity.subject,
      },
    )

    // Seed default agency branches and products. Failures here leave the
    // tenant usable (they can be re-seeded from agency settings).
    try {
      await ctx.runMutation(internal.agencyConfig.seedDefaultBranchesInternal, {
        tenantId,
      })
      await ctx.runMutation(internal.agencyConfig.seedDefaultProductsInternal, {
        tenantId,
      })
    } catch (err) {
      console.warn('Failed to seed default branches/products:', err)
    }

    // Auto-create Stripe customer. Use billing email or owner email.
    // Non-blocking: if it fails, the tenant is still usable.
    const stripeEmail = args.billingEmails[0] ?? args.ownerEmail ?? ''
    if (stripeEmail) {
      try {
        const customer: { id: string } = await ctx.runAction(
          internal._utils.stripe.createStripeCustomer,
          { name: args.name, email: stripeEmail },
        )
        await ctx.runMutation(internal.platformStripe.saveStripeCustomerId, {
          tenantId,
          stripeCustomerId: customer.id,
        })
        await ctx.runMutation(internal.platform.recordPlatformAuditInternal, {
          tenantId,
          actorId: identity.subject,
          action: 'stripe_customer_auto_created',
          metadata: { stripeCustomerId: customer.id },
        })
      } catch (err) {
        // Log the failure as an audit event so it's visible in the platform admin
        await ctx.runMutation(internal.platform.recordPlatformAuditInternal, {
          tenantId,
          actorId: identity.subject,
          action: 'stripe_customer_creation_failed',
          metadata: {
            error: err instanceof Error ? err.message : String(err),
          },
        })
      }
    }

    // Create the agency owner user: Clerk user with org:admin role, verified
    // email, MFA disabled, and a welcome email with a magic sign-in link +
    // temporary password. Then record them as a tenant member.
    if (args.ownerEmail) {
      const owner = await createClerkUserAndJoinOrg({
        ctx: { scheduler: ctx.scheduler },
        secretKey,
        clerkOrgId: org.id,
        emailAddress: args.ownerEmail,
        displayName: args.ownerDisplayName || args.ownerEmail,
        role: 'org:admin',
        appBaseUrl: requireEnv('APP_URL'),
      })
      await ctx.runMutation(internal.members.createManualMember, {
        clerkOrgId: org.id,
        clerkUserId: owner.clerkUserId,
        role: 'org:admin',
        displayName: args.ownerDisplayName || args.ownerEmail,
        email: args.ownerEmail,
      })
      await ctx.runMutation(internal.platform.recordPlatformAuditInternal, {
        tenantId,
        actorId: identity.subject,
        action: 'tenant_user_created',
        metadata: {
          clerkUserId: owner.clerkUserId,
          email: args.ownerEmail,
          role: 'org:admin',
        },
      })
    }

    return tenantId
  },
})

export const updateTenantInfo = mutation({
  args: {
    tenantId: v.id('tenants'),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    ein: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }
    await ctx.db.patch(args.tenantId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.slug !== undefined ? { slug: args.slug } : {}),
      ...(args.ein !== undefined ? { ein: args.ein } : {}),
      ...(args.address !== undefined ? { address: args.address } : {}),
    })
    await recordPlatformAudit(ctx, identity, args.tenantId, 'tenant_updated', {
      name: args.name,
      slug: args.slug,
      ein: args.ein,
      address: args.address,
    })
    return args.tenantId
  },
})

export const listTenantMembers = query({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', args.tenantId))
      .collect()
    return members.map((member) => ({
      clerkUserId: member.clerkUserId,
      displayName: member.displayName,
      email: member.email,
      role: member.role,
    }))
  },
})

export const createUserForTenant = action({
  args: {
    tenantId: v.id('tenants'),
    email: v.string(),
    displayName: v.string(),
    role: tenantStaffRole,
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdminAction(ctx)
    const secretKey = requireClerkSecretKey()

    const tenant = await ctx.runQuery(internal.platform.getTenantInternal, {
      tenantId: args.tenantId,
    })
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }

    // Creates the Clerk user, verifies their email, disables MFA, joins the
    // org, and emails them a magic sign-in link + temporary password.
    const result = await createClerkUserAndJoinOrg({
      ctx: { scheduler: ctx.scheduler },
      secretKey,
      clerkOrgId: tenant.clerkOrgId,
      emailAddress: args.email,
      displayName: args.displayName,
      role: args.role,
      appBaseUrl: requireEnv('APP_URL'),
    })
    const clerkUserId = result.clerkUserId

    await ctx.runMutation(internal.members.createManualMember, {
      clerkOrgId: tenant.clerkOrgId,
      clerkUserId,
      role: args.role,
      displayName: args.displayName,
      email: args.email,
    })

    await ctx.runMutation(internal.platform.recordPlatformAuditInternal, {
      tenantId: args.tenantId,
      actorId: identity.subject,
      action: 'tenant_user_created',
      metadata: { clerkUserId, email: args.email, role: args.role },
    })

    return {
      success: true,
      clerkUserId,
      signInUrl: result.magicLink,
      tempPassword: result.initialPassword,
    }
  },
})

export const removeUserFromTenant = action({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdminAction(ctx)

    const tenant = await ctx.runQuery(internal.platform.getTenantInternal, {
      tenantId: args.tenantId,
    })
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }

    await ctx.runAction(internal.candidates.removeClerkOrgMembership, {
      clerkOrgId: tenant.clerkOrgId,
      clerkUserId: args.clerkUserId,
    })

    await ctx.runMutation(internal.platform.removeTenantMemberInternal, {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      actorId: identity.subject,
    })

    return { success: true }
  },
})

export const updateTenantMemberRole = mutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    role: tenantStaffRole,
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', args.tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()
    if (!existing) {
      throw new ConvexError('Member not found.')
    }
    await ctx.db.patch(existing._id, { role: args.role })
    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'tenant_member_role_updated',
      { clerkUserId: args.clerkUserId, role: args.role },
    )
    return existing._id
  },
})

export const setTenantCustomRate = mutation({
  args: {
    tenantId: v.id('tenants'),
    customRate: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }
    await ctx.db.patch(args.tenantId, {
      customMonthlyRate:
        args.customRate === null ? undefined : args.customRate,
    })
    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'tenant_custom_rate_updated',
      { customRate: args.customRate },
    )
    return args.tenantId
  },
})

export const setTenantLimits = mutation({
  args: {
    tenantId: v.id('tenants'),
    limits: v.union(
      v.object({
        maxSeats: v.optional(v.number()),
        maxCandidates: v.optional(v.number()),
        maxShiftsPerMonth: v.optional(v.number()),
      }),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requirePlatformAdmin(ctx)
    const tenant = await ctx.db.get(args.tenantId)
    if (!tenant) {
      throw new ConvexError('Tenant not found.')
    }
    await ctx.db.patch(args.tenantId, {
      limits: args.limits === null ? undefined : args.limits,
    })
    await recordPlatformAudit(
      ctx,
      identity,
      args.tenantId,
      'tenant_limits_updated',
      { limits: args.limits },
    )
    return args.tenantId
  },
})
