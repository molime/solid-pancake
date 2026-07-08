import { v } from 'convex/values'
import { ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Id, Doc } from './_generated/dataModel'
import type { AuthContext } from './authHelpers'
import {
  requireTenantRole,
  assertTenantDoc,
  ensureTenantMember,
} from './authHelpers'

const NON_CONFLICT_STATUSES = [
  'scheduled',
  'in_progress',
  'submitted',
  'approved',
] as const

const TERMINAL_STATUSES = ['submitted', 'approved', 'billing_ready'] as const

type ShiftStatus =
  | 'scheduled'
  | 'in_progress'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'billing_ready'

const serviceLocationOverrideValidator = v.optional(
  v.object({
    label: v.string(),
    addressLine: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    radiusMeters: v.optional(v.number()),
  }),
)

export async function assertCaregiverMember(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  caregiverId: string,
) {
  const member = await ensureTenantMember(ctx, tenantId, caregiverId)
  if (!member || member.role !== 'org:caregiver') {
    throw new ConvexError(
      'Selected caregiver must be an active caregiver in this agency.',
    )
  }
}

export async function checkShiftConflict(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  caregiverId: string,
  start: string,
  end: string,
  excludeShiftId?: Id<'shifts'>,
) {
  const shifts = await ctx.db
    .query('shifts')
    .withIndex('by_tenant_caregiver_status', (q) =>
      q.eq('tenantId', tenantId).eq('caregiverId', caregiverId),
    )
    .collect()

  return (
    shifts.find((existing) => {
      if (excludeShiftId && existing._id === excludeShiftId) return false
      if (
        !NON_CONFLICT_STATUSES.includes(
          existing.status as (typeof NON_CONFLICT_STATUSES)[number],
        )
      ) {
        return false
      }
      return start < existing.scheduledEnd && end > existing.scheduledStart
    }) ?? null
  )
}

function toISODate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function getUTCDayOfWeek(iso: string): number {
  return new Date(iso).getUTCDay()
}

function formatUTCTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const AVAILABILITY_WARNING = 'Caregiver availability does not cover this slot.'

async function checkAvailabilityWarning(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  caregiverId: string,
  scheduledStart: string,
  scheduledEnd: string,
): Promise<string | null> {
  const shiftDate = toISODate(scheduledStart)
  const shiftDayOfWeek = getUTCDayOfWeek(scheduledStart)
  const shiftStartTime = formatUTCTime(scheduledStart)
  const shiftEndTime = formatUTCTime(scheduledEnd)

  const windows = await ctx.db
    .query('availabilityWindows')
    .withIndex('by_tenant_caregiver', (q) =>
      q.eq('tenantId', tenantId).eq('caregiverId', caregiverId),
    )
    .collect()

  const matching = windows.filter(
    (w) =>
      (w.kind === 'recurring' && w.dayOfWeek === shiftDayOfWeek) ||
      (w.kind === 'one-off' && w.date === shiftDate),
  )

  if (matching.length === 0) return null

  const available = matching.filter((w) => w.available)
  if (available.length === 0) return AVAILABILITY_WARNING

  const intervals = available
    .map((w) => ({
      start: timeToMinutes(w.startTime),
      end: timeToMinutes(w.endTime),
    }))
    .sort((a, b) => a.start - b.start)

  const shiftStartMin = timeToMinutes(shiftStartTime)
  const shiftEndMin = timeToMinutes(shiftEndTime)
  let coveredUntil = shiftStartMin

  for (const interval of intervals) {
    if (interval.start > coveredUntil) return AVAILABILITY_WARNING
    coveredUntil = Math.max(coveredUntil, interval.end)
    if (coveredUntil >= shiftEndMin) return null
  }

  return AVAILABILITY_WARNING
}

async function buildShiftWithNames(ctx: AuthContext, shift: Doc<'shifts'>) {
  const [client, caregiver] = await Promise.all([
    ctx.db.get(shift.clientId),
    ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', shift.tenantId).eq('clerkUserId', shift.caregiverId),
      )
      .unique(),
  ])

  return {
    ...shift,
    clientDisplayName: client?.displayName ?? '',
    caregiverDisplayName: caregiver?.displayName ?? '',
  }
}

function validateShiftTimes(scheduledStart: string, scheduledEnd: string) {
  if (scheduledEnd <= scheduledStart) {
    throw new ConvexError('Shift end time must be after start time.')
  }
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ConvexError('Rate must be greater than zero.')
  }
}

export const createShift = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
    serviceLocationOverride: serviceLocationOverrideValidator,
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    validateShiftTimes(args.scheduledStart, args.scheduledEnd)
    validateRate(args.rate)

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new ConvexError('Client not found.')
    assertTenantDoc(client, tenantId)

    await assertCaregiverMember(ctx, tenantId, args.caregiverId)

    const conflict = await checkShiftConflict(
      ctx,
      tenantId,
      args.caregiverId,
      args.scheduledStart,
      args.scheduledEnd,
    )
    if (conflict) {
      throw new ConvexError(
        `Shift conflicts with ${conflict._id} (${conflict.scheduledStart} - ${conflict.scheduledEnd})`,
      )
    }

    const availabilityWarning = await checkAvailabilityWarning(
      ctx,
      tenantId,
      args.caregiverId,
      args.scheduledStart,
      args.scheduledEnd,
    )

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId: args.clientId,
      caregiverId: args.caregiverId,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      status: 'scheduled',
      serviceType: args.serviceType,
      rate: args.rate,
      serviceLocationOverride: args.serviceLocationOverride,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift.created',
      kind: 'shift.created',
      shiftId,
    })

    return { shiftId, availabilityWarning }
  },
})

export const updateShift = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    clientId: v.optional(v.id('clients')),
    caregiverId: v.optional(v.string()),
    scheduledStart: v.optional(v.string()),
    scheduledEnd: v.optional(v.string()),
    serviceType: v.optional(v.union(v.literal('SLS'), v.literal('ILS'))),
    rate: v.optional(v.number()),
    serviceLocationOverride: serviceLocationOverrideValidator,
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new ConvexError('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (
      TERMINAL_STATUSES.includes(
        shift.status as (typeof TERMINAL_STATUSES)[number],
      )
    ) {
      throw new ConvexError(
        'Cannot edit a shift that is submitted or approved',
      )
    }

    const patch: Partial<Doc<'shifts'>> = {}

    if (args.clientId !== undefined) {
      const client = await ctx.db.get(args.clientId)
      if (!client) throw new ConvexError('Client not found.')
      assertTenantDoc(client, tenantId)
      patch.clientId = args.clientId
    }

    if (args.caregiverId !== undefined) {
      await assertCaregiverMember(ctx, tenantId, args.caregiverId)
      patch.caregiverId = args.caregiverId
    }

    if (args.scheduledStart !== undefined) {
      patch.scheduledStart = args.scheduledStart
    }
    if (args.scheduledEnd !== undefined) {
      patch.scheduledEnd = args.scheduledEnd
    }
    if (patch.scheduledStart !== undefined || patch.scheduledEnd !== undefined) {
      const start = patch.scheduledStart ?? shift.scheduledStart
      const end = patch.scheduledEnd ?? shift.scheduledEnd
      validateShiftTimes(start, end)
    }

    if (args.serviceType !== undefined) {
      patch.serviceType = args.serviceType
    }
    if (args.rate !== undefined) {
      validateRate(args.rate)
      patch.rate = args.rate
    }
    if (args.serviceLocationOverride !== undefined) {
      patch.serviceLocationOverride = args.serviceLocationOverride
    }

    const newCaregiverId = patch.caregiverId ?? shift.caregiverId
    if (
      args.scheduledStart !== undefined ||
      args.scheduledEnd !== undefined ||
      args.caregiverId !== undefined
    ) {
      const conflict = await checkShiftConflict(
        ctx,
        tenantId,
        newCaregiverId,
        patch.scheduledStart ?? shift.scheduledStart,
        patch.scheduledEnd ?? shift.scheduledEnd,
        shift._id,
      )
      if (conflict) {
        throw new ConvexError(
          `Shift conflicts with ${conflict._id} (${conflict.scheduledStart} - ${conflict.scheduledEnd})`,
        )
      }
    }

    await ctx.db.patch(shift._id, patch)

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift.updated',
      kind: 'shift.updated',
      shiftId: shift._id,
    })

    return { shiftId: shift._id }
  },
})

export const deleteShift = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new ConvexError('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (shift.status !== 'scheduled') {
      throw new ConvexError('Only scheduled shifts can be deleted.')
    }

    const coverageRequests = await ctx.db
      .query('coverageRequests')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', shift._id),
      )
      .collect()

    for (const request of coverageRequests) {
      await ctx.db.delete(request._id)
    }

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift.deleted',
      kind: 'shift.deleted',
      shiftId: shift._id,
    })

    await ctx.db.delete(shift._id)

    return { shiftId: shift._id }
  },
})

export const assignShift = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    caregiverId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new ConvexError('Shift not found.')
    assertTenantDoc(shift, tenantId)

    await assertCaregiverMember(ctx, tenantId, args.caregiverId)

    const conflict = await checkShiftConflict(
      ctx,
      tenantId,
      args.caregiverId,
      shift.scheduledStart,
      shift.scheduledEnd,
      shift._id,
    )
    if (conflict) {
      throw new ConvexError(
        `Shift conflicts with ${conflict._id} (${conflict.scheduledStart} - ${conflict.scheduledEnd})`,
      )
    }

    await ctx.db.patch(shift._id, { caregiverId: args.caregiverId })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift.reassigned',
      kind: 'shift.reassigned',
      shiftId: shift._id,
      metadata: {
        previousCaregiverId: shift.caregiverId,
        newCaregiverId: args.caregiverId,
      },
    })

    return { shiftId: shift._id }
  },
})

export const listShifts = query({
  args: {
    clerkOrgId: v.string(),
    status: v.optional(
      v.union(
        v.literal('scheduled'),
        v.literal('in_progress'),
        v.literal('submitted'),
        v.literal('needs_correction'),
        v.literal('approved'),
        v.literal('billing_ready'),
      ),
    ),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    caregiverId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const caregiverId = args.caregiverId
    const status = args.status
    let shifts: Doc<'shifts'>[]

    if (caregiverId && status) {
      shifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_caregiver_status_start', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('caregiverId', caregiverId)
            .eq('status', status),
        )
        .order('desc')
        .take(100)
    } else if (status) {
      shifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q.eq('tenantId', tenantId).eq('status', status),
        )
        .order('desc')
        .take(100)
    } else if (caregiverId) {
      shifts = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_caregiver_status', (q) =>
          q.eq('tenantId', tenantId).eq('caregiverId', caregiverId),
        )
        .collect()
    } else {
      const allStatuses: ShiftStatus[] = [
        'scheduled',
        'in_progress',
        'submitted',
        'needs_correction',
        'approved',
        'billing_ready',
      ]
      const byStatus = await Promise.all(
        allStatuses.map((status) =>
          ctx.db
            .query('shifts')
            .withIndex('by_tenant_status_start', (q) =>
              q.eq('tenantId', tenantId).eq('status', status),
            )
            .order('desc')
            .take(100)
            .then((page) => ({ status, page })),
        ),
      )
      shifts = byStatus.flatMap((s) => s.page)
    }

    if (args.startDate) {
      const lower = `${args.startDate}T00:00:00.000Z`
      shifts = shifts.filter((s) => s.scheduledStart >= lower)
    }
    if (args.endDate) {
      const upper = `${args.endDate}T23:59:59.999Z`
      shifts = shifts.filter((s) => s.scheduledStart <= upper)
    }

    shifts = shifts
      .sort((a, b) => (a.scheduledStart > b.scheduledStart ? -1 : 1))
      .slice(0, 100)

    const items = await Promise.all(
      shifts.map((shift) => buildShiftWithNames(ctx, shift)),
    )

    return { items, hasMore: false, nextCursor: null }
  },
})

export const listCaregiverShifts = query({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
      )
      .collect()

    shifts.sort((a, b) => (a.scheduledStart > b.scheduledStart ? -1 : 1))

    const items = await Promise.all(
      shifts.slice(0, 100).map((shift) => buildShiftWithNames(ctx, shift)),
    )

    return items
  },
})

export const addAvailabilityWindow = mutation({
  args: {
    clerkOrgId: v.string(),
    kind: v.union(v.literal('recurring'), v.literal('one-off')),
    dayOfWeek: v.optional(v.number()),
    date: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    available: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    if (args.kind === 'recurring' && args.dayOfWeek === undefined) {
      throw new ConvexError('dayOfWeek is required for recurring windows.')
    }
    if (args.kind === 'one-off' && args.date === undefined) {
      throw new ConvexError('date is required for one-off windows.')
    }
    if (args.endTime <= args.startTime) {
      throw new ConvexError('End time must be after start time.')
    }

    const windowId = await ctx.db.insert('availabilityWindows', {
      tenantId,
      caregiverId: identity.subject,
      kind: args.kind,
      dayOfWeek: args.dayOfWeek,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      available: args.available,
      note: args.note,
      createdAt: new Date().toISOString(),
    })

    return { windowId }
  },
})

export const updateAvailabilityWindow = mutation({
  args: {
    clerkOrgId: v.string(),
    windowId: v.id('availabilityWindows'),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    available: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const window = await ctx.db.get(args.windowId)
    if (!window) throw new ConvexError('Availability window not found.')
    assertTenantDoc(window, tenantId)

    if (window.caregiverId !== identity.subject) {
      throw new ConvexError(
        'You can only update your own availability windows.',
      )
    }

    const patch: Partial<Doc<'availabilityWindows'>> = {}
    if (args.startTime !== undefined) patch.startTime = args.startTime
    if (args.endTime !== undefined) patch.endTime = args.endTime
    if (args.available !== undefined) patch.available = args.available
    if (args.note !== undefined) patch.note = args.note

    if (patch.startTime !== undefined || patch.endTime !== undefined) {
      const start = patch.startTime ?? window.startTime
      const end = patch.endTime ?? window.endTime
      if (end <= start) {
        throw new ConvexError('End time must be after start time.')
      }
    }

    await ctx.db.patch(window._id, patch)

    return { windowId: window._id }
  },
})

export const deleteAvailabilityWindow = mutation({
  args: {
    clerkOrgId: v.string(),
    windowId: v.id('availabilityWindows'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const window = await ctx.db.get(args.windowId)
    if (!window) throw new ConvexError('Availability window not found.')
    assertTenantDoc(window, tenantId)

    if (window.caregiverId !== identity.subject) {
      throw new ConvexError(
        'You can only delete your own availability windows.',
      )
    }

    await ctx.db.delete(window._id)

    return { windowId: window._id }
  },
})

export const listMyAvailability = query({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    return ctx.db
      .query('availabilityWindows')
      .withIndex('by_tenant_caregiver', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
      )
      .collect()
  },
})

export const listAvailabilityForScheduling = query({
  args: {
    clerkOrgId: v.string(),
    caregiverId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('availabilityWindows')
      .withIndex('by_tenant_caregiver', (q) => {
        const b = q.eq('tenantId', tenantId)
        return args.caregiverId
          ? b.eq('caregiverId', args.caregiverId)
          : b
      })
      .collect()
  },
})

export const requestCoverage = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new ConvexError('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (shift.caregiverId !== identity.subject) {
      throw new ConvexError(
        'You can only request coverage for your assigned shifts.',
      )
    }
    if (shift.status !== 'scheduled') {
      throw new ConvexError('Coverage can only be requested for scheduled shifts.')
    }

    const coverageRequestId = await ctx.db.insert('coverageRequests', {
      tenantId,
      shiftId: shift._id,
      requesterId: identity.subject,
      reason: args.reason,
      status: 'open',
      createdAt: new Date().toISOString(),
    })

    return { coverageRequestId }
  },
})

export const resolveCoverage = mutation({
  args: {
    clerkOrgId: v.string(),
    coverageRequestId: v.id('coverageRequests'),
    reassignedTo: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:admin', 'org:coordinator'],
    )

    const request = await ctx.db.get(args.coverageRequestId)
    if (!request) throw new ConvexError('Coverage request not found.')
    assertTenantDoc(request, tenantId)

    if (request.status !== 'open') {
      throw new ConvexError('Coverage request is no longer open.')
    }

    const shift = await ctx.db.get(request.shiftId)
    if (!shift) throw new ConvexError('Shift not found.')
    assertTenantDoc(shift, tenantId)

    await assertCaregiverMember(ctx, tenantId, args.reassignedTo)

    const conflict = await checkShiftConflict(
      ctx,
      tenantId,
      args.reassignedTo,
      shift.scheduledStart,
      shift.scheduledEnd,
      shift._id,
    )
    if (conflict) {
      throw new ConvexError(
        `Shift conflicts with ${conflict._id} (${conflict.scheduledStart} - ${conflict.scheduledEnd})`,
      )
    }

    await ctx.db.patch(shift._id, { caregiverId: args.reassignedTo })

    const now = new Date().toISOString()
    await ctx.db.patch(request._id, {
      status: 'filled',
      reassignedTo: args.reassignedTo,
      resolvedBy: identity.subject,
      resolvedAt: now,
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'coverage.resolved',
      kind: 'coverage.resolved',
      shiftId: shift._id,
      metadata: {
        coverageRequestId: request._id,
        reassignedTo: args.reassignedTo,
      },
    })

    return { shiftId: shift._id, coverageRequestId: request._id }
  },
})

export const listCoverageRequests = query({
  args: {
    clerkOrgId: v.string(),
    status: v.optional(
      v.union(
        v.literal('open'),
        v.literal('filled'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const requests = await ctx.db
      .query('coverageRequests')
      .withIndex('by_tenant_status', (q) => {
        const b = q.eq('tenantId', tenantId)
        return args.status ? b.eq('status', args.status) : b
      })
      .collect()

    const items = await Promise.all(
      requests.map(async (request) => {
        const shift = await ctx.db.get(request.shiftId)
        const client = shift ? await ctx.db.get(shift.clientId) : null
        return {
          ...request,
          shift,
          clientName: client?.displayName ?? '',
        }
      }),
    )

    return items
  },
})
