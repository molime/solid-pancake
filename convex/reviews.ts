import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import {
  calculateDocumentedHours,
  roundCurrency,
  validateShiftDocumentation,
} from './shiftValidation'

export const approve = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (shift.status !== 'submitted') {
      throw new Error('Only submitted shifts can be approved.')
    }

    const note = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .unique()

    if (!note) throw new Error('Progress note not found.')
    assertTenantDoc(note, tenantId)

    const tasks = await ctx.db
      .query('shiftTasks')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .collect()

    for (const task of tasks) assertTenantDoc(task, tenantId)

    const blockers = validateShiftDocumentation(note, tasks)
    if (blockers.length > 0) {
      throw new Error(
        `Incomplete documentation cannot be approved: ${blockers.join(' ')}`,
      )
    }

    const hours = calculateDocumentedHours(note.startTime, note.endTime)
    if (hours === null) {
      throw new Error('Valid documented hours are required before approval.')
    }

    await ctx.db.patch(args.shiftId, { status: 'billing_ready' })

    await ctx.db.insert('reviewEvents', {
      tenantId,
      shiftId: args.shiftId,
      reviewerId: identity.subject,
      decision: 'approved',
      comment: args.comment,
      createdAt: new Date().toISOString(),
    })

    const amount = roundCurrency(hours * shift.rate)

    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId: args.shiftId,
      hours,
      rate: shift.rate,
      amount,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_approved',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'billing_ready',
    })

    return args.shiftId
  },
})

export const requestCorrection = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (!args.comment || args.comment.trim().length === 0) {
      throw new Error('A comment is required to request a correction.')
    }

    if (shift.status !== 'submitted' && shift.status !== 'billing_ready') {
      throw new Error(
        'Can only return submitted or approved shifts for correction.',
      )
    }

    if (shift.status === 'billing_ready') {
      const billingLines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
        )
        .collect()

      for (const line of billingLines) {
        assertTenantDoc(line, tenantId)
        if (line.exportBatchId) {
          throw new Error(
            'Invoiced billing lines cannot be returned for correction without a reversal.',
          )
        }
        await ctx.db.delete(line._id)
      }
    }

    await ctx.db.patch(args.shiftId, { status: 'needs_correction' })

    await ctx.db.insert('reviewEvents', {
      tenantId,
      shiftId: args.shiftId,
      reviewerId: identity.subject,
      decision: 'correction_requested',
      comment: args.comment,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_correction_requested',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'needs_correction',
    })

    return args.shiftId
  },
})
