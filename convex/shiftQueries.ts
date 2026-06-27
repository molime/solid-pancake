import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertTenantDoc,
  requireTenant,
  requireTenantRole,
} from './authHelpers'

function assertShiftReadableByRole(
  shift: { caregiverId: string },
  role: string,
  clerkUserId: string,
) {
  if (role === 'org:caregiver' && shift.caregiverId !== clerkUserId) {
    throw new ConvexError(
      'Forbidden: caregivers can only view assigned shifts.',
    )
  }
}

export const listMyShifts = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
      )
      .order('desc')
      .take(100)

    const clients = await Promise.all(
      shifts.map((shift) => ctx.db.get(shift.clientId)),
    )

    clients.forEach((client) => {
      if (client) assertTenantDoc(client, tenantId)
    })

    return shifts.map((shift, index) => ({
      shift,
      client: clients[index],
    }))
  },
})

export const listForReview = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const submitted = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'submitted'),
      )
      .order('desc')
      .take(100)

    const needsCorrection = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'needs_correction'),
      )
      .order('desc')
      .take(100)

    return [...submitted, ...needsCorrection]
  },
})

export const listBillingReady = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'billing_ready'),
      )
      .order('desc')
      .take(200)
  },
})

export const listAll = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(200)
  },
})

export const get = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)
    return shift
  },
})

export const getWithDetails = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)

    const [client, note, tasks, reviews, punches] = await Promise.all([
      ctx.db.get(shift.clientId),
      ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique(),
      ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
      ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .order('desc')
        .collect(),
      ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
    ])

    if (client) assertTenantDoc(client, tenantId)
    if (note) assertTenantDoc(note, tenantId)
    for (const task of tasks) assertTenantDoc(task, tenantId)
    for (const review of reviews) assertTenantDoc(review, tenantId)
    for (const punch of punches) assertTenantDoc(punch, tenantId)

    const clockIn = punches.find((p) => p.punchType === 'clock_in')
    const clockOut = punches.find((p) => p.punchType === 'clock_out')
    const locationMatched = Boolean(
      clockIn?.location && clockIn.location.withinGeofence === true,
    )
    const submittedOnSite = Boolean(
      clockOut?.location && clockOut.location.withinGeofence === true,
    )

    return {
      shift,
      client,
      note,
      tasks,
      reviews,
      verification: { locationMatched, submittedOnSite },
    }
  },
})

export const dashboardStats = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const all = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .collect()

    const billingLines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()
    const oldestSubmitted = all
      .filter((shift) => shift.status === 'submitted')
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    return {
      inProgress: all.filter((shift) => shift.status === 'in_progress').length,
      submitted: all.filter((shift) => shift.status === 'submitted').length,
      needsCorrection: all.filter(
        (shift) => shift.status === 'needs_correction',
      ).length,
      billingReady: all.filter((shift) => shift.status === 'billing_ready')
        .length,
      dollarsAtRisk:
        Math.round(
          billingLines.reduce(
            (sum, line) => sum + (line.exportBatchId ? 0 : line.amount),
            0,
          ) * 100,
        ) / 100,
      oldestSubmittedAge: oldestSubmitted
        ? Math.floor(
            (Date.now() - new Date(oldestSubmitted.scheduledStart).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0,
    }
  },
})
