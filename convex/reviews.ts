import { v, ConvexError } from 'convex/values'
import { mutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { checkComplianceBlocked } from './compliance'
import { notifyTenantStaff } from './_utils/notifications'
import {
  calculateDocumentedHours,
  roundCurrency,
  validateShiftDocumentation,
} from './shiftValidation'

/** Best-effort display name for a caregiver clerkUserId within a tenant. */
async function resolveCaregiverName(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
) {
  const profile = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
  if (profile) return profile.displayName

  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
  return member?.displayName ?? clerkUserId
}

export const approve = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    comment: v.string(),
    complianceOverride: v.optional(v.boolean()),
    complianceOverrideReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
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

    const compliance = await checkComplianceBlocked(
      ctx,
      tenantId,
      shift.caregiverId,
    )

    if (
      compliance.blocked &&
      args.complianceOverride === true &&
      role !== 'org:admin'
    ) {
      throw new ConvexError(
        'Forbidden: only org:admin can approve with a compliance override.',
      )
    }

    const blocked = compliance.blocked && args.complianceOverride !== true
    const now = new Date().toISOString()

    await ctx.db.patch(args.shiftId, { status: 'billing_ready' })

    await ctx.db.insert('reviewEvents', {
      tenantId,
      shiftId: args.shiftId,
      reviewerId: identity.subject,
      decision: 'approved',
      comment: args.comment,
      ...(compliance.blocked && args.complianceOverride === true
        ? {
            complianceOverride: true,
            complianceOverrideReason: args.complianceOverrideReason,
          }
        : {}),
      createdAt: now,
    })

    const amount = roundCurrency(hours * shift.rate)

    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId: args.shiftId,
      hours,
      rate: shift.rate,
      amount,
      ...(blocked
        ? { blockedReason: compliance.reason, blockedAt: now }
        : {}),
      createdAt: now,
    })

    if (blocked) {
      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'billing_blocked_compliance',
        shiftId: args.shiftId,
        previousStatus: shift.status,
        nextStatus: 'billing_ready',
        metadata: { reason: compliance.reason },
      })

      const caregiverName = await resolveCaregiverName(
        ctx,
        tenantId,
        shift.caregiverId,
      )
      const warning = `Billing blocked for ${caregiverName}: ${compliance.reason}. Resolve or apply override.`

      // Overrides are admin/hr-only, so the actionable notification goes to
      // the back office — the caregiver cannot resolve or override the block.
      await notifyTenantStaff(ctx, tenantId, ['org:admin', 'org:coordinator'], {
        type: 'billing_blocked',
        message: warning,
        metadata: {
          shiftId: args.shiftId as string,
          caregiverName,
          reason: compliance.reason,
        },
      })

      // Return-shape note: approve normally resolves to the shift id (a
      // string at runtime); a compliance-blocked approval resolves to a
      // human-readable warning string instead of throwing.
      return warning
    }

    if (compliance.blocked) {
      // Blocked but an org:admin applied a compliance override.
      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'compliance_override_applied',
        shiftId: args.shiftId,
        previousStatus: shift.status,
        nextStatus: 'billing_ready',
        metadata: {
          complianceReason: compliance.reason,
          overrideReason: args.complianceOverrideReason,
        },
      })

      return args.shiftId
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_approved',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'billing_ready',
    })

    const client = await ctx.db.get(shift.clientId)
    const clientName = client?.displayName ?? 'client'

    await ctx.scheduler.runAfter(
      0,
      internal._utils.notifications.sendStaffNotification,
      {
        tenantId,
        clerkUserId: shift.caregiverId,
        type: 'billing_ready',
        message: `Shift for ${clientName} is ready to bill.`,
        metadata: { shiftId: args.shiftId as string },
      },
    )

    return args.shiftId
  },
})

export const escalateToSupervisor = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:coordinator',
      'org:admin',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    const admin = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:admin'),
      )
      .first()

    // Fallback when the tenant has no org:admin member: store the role
    // literal so the escalation is still recorded and routable.
    const escalatedTo = admin?.clerkUserId ?? 'org:admin'

    await ctx.db.patch(args.shiftId, { escalatedTo })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_escalated',
      shiftId: args.shiftId,
      metadata: { reason: args.reason, escalatedTo },
    })

    await ctx.scheduler.runAfter(
      0,
      internal._utils.notifications.sendStaffNotification,
      {
        tenantId,
        clerkUserId: escalatedTo,
        type: 'escalation',
        message: `Shift ${args.shiftId} escalated to supervisor: ${args.reason}`,
        metadata: { shiftId: args.shiftId as string },
      },
    )

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
