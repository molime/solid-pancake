import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { mergeTaskUpdates, validateShiftDocumentation } from './shiftValidation'
import {
  initialShiftStatusForStart,
  isScheduledStartDue,
} from './shiftLifecycle'
import {
  resolveShiftServiceTarget,
  validatePunchLocation,
  type LocationInput,
} from './locationValidation'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'
import type { Id } from './_generated/dataModel'

const DEFAULT_REQUIRED_PROOF_TASK = 'Upload shift documentation proof'
const MAX_BULK_SHIFTS = 500

async function assertCaregiverMember(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  caregiverId: string,
) {
  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
    )
    .unique()

  if (!member || member.role !== 'org:caregiver') {
    throw new Error(
      'Selected caregiver must be an active caregiver in this agency.',
    )
  }
}

function validateShiftTimes(scheduledStart: string, scheduledEnd: string) {
  if (scheduledEnd <= scheduledStart) {
    throw new Error('Shift end time must be after start time.')
  }
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be greater than zero.')
  }
}

async function loadShift(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const shift = await ctx.db.get(shiftId)
  if (!shift) throw new Error('Shift not found.')
  assertTenantDoc(shift, tenantId)
  return shift
}

async function loadProgressNote(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const note = await ctx.db
    .query('progressNotes')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .unique()

  if (!note) throw new Error('Progress note not found.')
  assertTenantDoc(note, tenantId)
  return note
}

async function loadShiftTasks(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const tasks = await ctx.db
    .query('shiftTasks')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()

  for (const task of tasks) assertTenantDoc(task, tenantId)
  return tasks
}

async function findPunch(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
  punchType: 'clock_in' | 'clock_out',
) {
  return ctx.db
    .query('timePunches')
    .withIndex('by_tenant_shift_type', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', punchType),
    )
    .unique()
}

async function assertClockInPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_in')
  if (!existing) {
    throw new Error(
      'You must clock in before you can document or submit this shift.',
    )
  }
}

async function assertClockOutPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_out')
  if (!existing) {
    throw new Error(
      'You must clock out before this shift can be submitted.',
    )
  }
}

async function getShiftGeofence(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
) {
  const settings = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()

  return settings?.shiftGeofence ?? DEFAULT_SHIFT_GEOFENCE
}

async function validateClockPunchLocation(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shift: {
    clientId: Id<'clients'>
    serviceLocationOverride?: {
      label: string
      latitude: number
      longitude: number
      radiusMeters?: number
    } | null
  },
  location: LocationInput | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  const geofence = await getShiftGeofence(ctx, tenantId)
  const required =
    geofence.enabled &&
    (punchType === 'clock_in'
      ? geofence.enforceClockIn
      : geofence.enforceClockOut)

  const client = await ctx.db.get(shift.clientId)
  if (!client) throw new Error('Client not found.')
  assertTenantDoc(client, tenantId)

  const target = resolveShiftServiceTarget(shift, client, geofence)

  return validatePunchLocation({
    location,
    target,
    required,
    maxAccuracyMeters: geofence.maxAccuracyMeters,
  })
}

async function submitShift(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    note: {
      startTime: string
      endTime: string
      servicesProvided: string
      clientResponse: string
      narrative: string
      objectiveId?: Id<'clientObjectives'>
    }
    tasks: {
      taskId: Id<'shiftTasks'>
      status: 'pending' | 'complete'
      proofUrl?: string
      proofName?: string
    }[]
  },
  actor: { subject: string; role: string },
) {
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)

  if (actor.role === 'org:caregiver' && shift.caregiverId !== actor.subject) {
    throw new Error('Caregivers can only submit their assigned shifts.')
  }

  if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
    throw new Error('Only in-progress or corrected shifts can be submitted.')
  }

  await assertClockInPunchExists(ctx, tenantId, args.shiftId)
  await assertClockOutPunchExists(ctx, tenantId, args.shiftId)

  const existingNote = await loadProgressNote(ctx, tenantId, args.shiftId)
  const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)

  const mergedTasks = mergeTaskUpdates(existingTasks, args.tasks)
  const blockers = validateShiftDocumentation(args.note, mergedTasks)
  if (blockers.length > 0) {
    throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
  }

  if (args.note.objectiveId !== undefined) {
    await assertObjectiveUsableForShift(
      ctx,
      tenantId,
      args.note.objectiveId,
      shift.clientId,
    )
  }

  await ctx.db.patch(existingNote._id, {
    startTime: args.note.startTime,
    endTime: args.note.endTime,
    servicesProvided: args.note.servicesProvided,
    clientResponse: args.note.clientResponse,
    narrative: args.note.narrative,
    ...(args.note.objectiveId !== undefined
      ? { objectiveId: args.note.objectiveId }
      : {}),
    submittedBy: actor.subject,
    submittedAt: new Date().toISOString(),
  })

  for (const task of mergedTasks) {
    await ctx.db.patch(task._id, {
      status: task.status,
      proofUrl: task.proofUrl,
      proofName: task.proofName,
    })
  }

  await ctx.db.patch(args.shiftId, { status: 'submitted' })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: 'shift_submitted',
    shiftId: args.shiftId,
    previousStatus: shift.status,
    nextStatus: 'submitted',
  })

  return args.shiftId
}

async function recordClockPunch(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    caregiverId: string
    punchType: 'clock_in' | 'clock_out'
    location?: LocationInput
  },
) {
  const now = new Date().toISOString()
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)
  const locationEvidence = await validateClockPunchLocation(
    ctx,
    tenantId,
    shift,
    args.location,
    args.punchType,
  )

  const existing = await findPunch(ctx, tenantId, args.shiftId, args.punchType)
  if (existing) {
    return existing._id
  }

  const punchId = await ctx.db.insert('timePunches', {
    tenantId,
    shiftId: args.shiftId,
    caregiverId: args.caregiverId,
    punchType: args.punchType,
    at: now,
    source: 'atriax',
    location: locationEvidence,
    adpSyncStatus: 'pending_credentials',
    createdAt: now,
  })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: `shift_${args.punchType === 'clock_in' ? 'clocked_in' : 'clocked_out'}`,
    shiftId: args.shiftId,
    metadata: {
      punchId: punchId as string,
      withinGeofence: locationEvidence?.withinGeofence ?? null,
      distanceMeters: locationEvidence?.distanceMeters ?? null,
    },
  })

  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
    timePunchId: punchId,
  })

  return punchId
}

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)
    validateShiftTimes(args.scheduledStart, args.scheduledEnd)
    validateRate(args.rate)

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId: args.clientId,
      caregiverId: args.caregiverId,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      status: initialShiftStatusForStart(args.scheduledStart),
      serviceType: args.serviceType,
      rate: args.rate,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: DEFAULT_REQUIRED_PROOF_TASK,
      requiredProof: true,
      status: 'pending',
    })

    return shiftId
  },
})

export const createMany = mutation({
  args: {
    clerkOrgId: v.string(),
    clientIds: v.array(v.id('clients')),
    caregiverId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const uniqueClientIds = Array.from(
      new Set(args.clientIds),
    ) as Id<'clients'>[]

    if (uniqueClientIds.length === 0) {
      throw new Error('Select at least one client.')
    }
    if (args.endDate < args.startDate) {
      throw new Error('End date must be on or after start date.')
    }
    if (args.endTime <= args.startTime) {
      throw new Error('End time must be after start time.')
    }
    validateRate(args.rate)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)

    const clients: Array<{
      _id: Id<'clients'>
      serviceType: 'SLS' | 'ILS'
    }> = []
    for (const clientId of uniqueClientIds) {
      const client = await ctx.db.get(clientId)
      if (!client) throw new Error('Client not found.')
      assertTenantDoc(client, tenantId)
      clients.push({ _id: client._id, serviceType: client.serviceType })
    }

    const createdShiftIds: Id<'shifts'>[] = []
    const cursor = new Date(`${args.startDate}T00:00:00Z`)
    const end = new Date(`${args.endDate}T00:00:00Z`)
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date range.')
    }

    const dayCount =
      Math.floor((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalShiftCount = dayCount * clients.length
    if (totalShiftCount > MAX_BULK_SHIFTS) {
      throw new Error(`Bulk schedule is limited to ${MAX_BULK_SHIFTS} shifts.`)
    }

    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      for (const client of clients) {
        const scheduledStart = `${date}T${args.startTime}:00Z`
        const scheduledEnd = `${date}T${args.endTime}:00Z`
        const shiftId = await ctx.db.insert('shifts', {
          tenantId,
          clientId: client._id,
          caregiverId: args.caregiverId,
          scheduledStart,
          scheduledEnd,
          status: initialShiftStatusForStart(scheduledStart),
          serviceType: client.serviceType,
          rate: args.rate,
        })

        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        })

        await ctx.db.insert('shiftTasks', {
          tenantId,
          shiftId,
          title: DEFAULT_REQUIRED_PROOF_TASK,
          requiredProof: true,
          status: 'pending',
        })

        createdShiftIds.push(shiftId)
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return { created: createdShiftIds.length, shiftIds: createdShiftIds }
  },
})

export const startDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only start their assigned shifts.')
    }

    if (shift.status !== 'scheduled') {
      throw new Error('Only scheduled shifts can be opened for documentation.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be documented before their scheduled start.',
      )
    }

    await ctx.db.patch(args.shiftId, { status: 'in_progress' })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_started',
      shiftId: args.shiftId,
      previousStatus: 'scheduled',
      nextStatus: 'in_progress',
    })

    return args.shiftId
  },
})

async function assertObjectiveUsableForShift(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  objectiveId: Id<'clientObjectives'>,
  clientId: Id<'clients'>,
) {
  const objective = await ctx.db.get(objectiveId)
  if (!objective) throw new Error('Client objective not found.')
  assertTenantDoc(objective, tenantId)
  if (objective.clientId !== clientId) {
    throw new Error('Objective belongs to a different client.')
  }
}

export const updateProgressNote = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    servicesProvided: v.optional(v.string()),
    clientResponse: v.optional(v.string()),
    narrative: v.optional(v.string()),
    objectiveId: v.optional(v.id('clientObjectives')),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only update their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be updated.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const note = await loadProgressNote(ctx, tenantId, args.shiftId)
    const patch: Record<string, string> = {}
    if (args.startTime !== undefined) patch.startTime = args.startTime
    if (args.endTime !== undefined) patch.endTime = args.endTime
    if (args.servicesProvided !== undefined) {
      patch.servicesProvided = args.servicesProvided
    }
    if (args.clientResponse !== undefined) patch.clientResponse = args.clientResponse
    if (args.narrative !== undefined) patch.narrative = args.narrative
    if (args.objectiveId !== undefined) {
      await assertObjectiveUsableForShift(
        ctx,
        tenantId,
        args.objectiveId,
        shift.clientId,
      )
      patch.objectiveId = args.objectiveId
    }

    await ctx.db.patch(note._id, patch)
    return note._id
  },
})

export const submitDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    note: v.object({
      startTime: v.string(),
      endTime: v.string(),
      servicesProvided: v.string(),
      clientResponse: v.string(),
      narrative: v.string(),
    }),
    tasks: v.array(
      v.object({
        taskId: v.id('shiftTasks'),
        status: v.union(v.literal('pending'), v.literal('complete')),
        proofUrl: v.optional(v.string()),
        proofName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:caregiver',
      'org:coordinator',
      'org:admin',
    ])

    return submitShift(ctx, args, { subject: identity.subject, role })
  },
})

export const clockIn = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock in to their assigned shifts.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be clocked in before their scheduled start.',
      )
    }

    if (shift.status !== 'scheduled' && shift.status !== 'in_progress') {
      throw new Error(
        'This shift has already been submitted or completed and cannot be clocked in again.',
      )
    }

    const existing = await findPunch(ctx, tenantId, args.shiftId, 'clock_in')
    if (existing) {
      return { punchId: existing._id, clockInAt: shift.clockInAt }
    }

    const punchId = await recordClockPunch(ctx, {
      clerkOrgId: args.clerkOrgId,
      shiftId: args.shiftId,
      caregiverId: shift.caregiverId,
      punchType: 'clock_in',
      location: args.location,
    })

    const now = new Date().toISOString()
    await ctx.db.patch(args.shiftId, {
      status: 'in_progress',
      clockInAt: now,
    })

    return { punchId, clockInAt: now }
  },
})

export const clockOut = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
    note: v.optional(
      v.object({
        startTime: v.string(),
        endTime: v.string(),
        servicesProvided: v.string(),
        clientResponse: v.string(),
        narrative: v.string(),
        objectiveId: v.optional(v.id('clientObjectives')),
      }),
    ),
    tasks: v.optional(
      v.array(
        v.object({
          taskId: v.id('shiftTasks'),
          status: v.union(v.literal('pending'), v.literal('complete')),
          proofUrl: v.optional(v.string()),
          proofName: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock out of their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be clocked out.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)
    const note = args.note ??
      (await loadProgressNote(ctx, tenantId, args.shiftId))
    const mergedTasks = args.tasks
      ? mergeTaskUpdates(existingTasks, args.tasks)
      : existingTasks
    const blockers = validateShiftDocumentation(note, mergedTasks)
    if (blockers.length > 0) {
      throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
    }

    const existingClockOut = await findPunch(
      ctx,
      tenantId,
      args.shiftId,
      'clock_out',
    )

    let punchId: Id<'timePunches'>
    let clockOutAt: string

    if (existingClockOut) {
      punchId = existingClockOut._id
      clockOutAt = shift.clockOutAt ?? existingClockOut.at
    } else {
      const locationEvidence = await validateClockPunchLocation(
        ctx,
        tenantId,
        shift,
        args.location,
        'clock_out',
      )

      const now = new Date().toISOString()

      punchId = await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: args.shiftId,
        caregiverId: shift.caregiverId,
        punchType: 'clock_out',
        at: now,
        source: 'atriax',
        location: locationEvidence,
        adpSyncStatus: 'pending_credentials',
        createdAt: now,
      })

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'shift_clocked_out',
        shiftId: args.shiftId,
        metadata: {
          punchId: punchId as string,
          withinGeofence: locationEvidence?.withinGeofence ?? null,
          distanceMeters: locationEvidence?.distanceMeters ?? null,
        },
      })

      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
        timePunchId: punchId,
      })

      await ctx.db.patch(args.shiftId, { clockOutAt: now })
      clockOutAt = now
    }

    await submitShift(
      ctx,
      {
        clerkOrgId: args.clerkOrgId,
        shiftId: args.shiftId,
        note: {
          startTime: note.startTime,
          endTime: note.endTime,
          servicesProvided: note.servicesProvided,
          clientResponse: note.clientResponse,
          narrative: note.narrative,
          objectiveId: note.objectiveId,
        },
        tasks: mergedTasks.map((task) => ({
          taskId: task._id,
          status: task.status,
          proofUrl: task.proofUrl,
          proofName: task.proofName,
        })),
      },
      { subject: identity.subject, role },
    )

    return { punchId, clockOutAt }
  },
})

export const updateServiceLocationOverride = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    serviceLocationOverride: v.optional(
      v.object({
        label: v.string(),
        addressLine: v.optional(v.string()),
        latitude: v.number(),
        longitude: v.number(),
        radiusMeters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    await loadShift(ctx, tenantId, args.shiftId)

    if (args.serviceLocationOverride !== undefined) {
      if (
        !Number.isFinite(args.serviceLocationOverride.latitude) ||
        args.serviceLocationOverride.latitude < -90 ||
        args.serviceLocationOverride.latitude > 90
      ) {
        throw new Error('latitude must be between -90 and 90.')
      }

      if (
        !Number.isFinite(args.serviceLocationOverride.longitude) ||
        args.serviceLocationOverride.longitude < -180 ||
        args.serviceLocationOverride.longitude > 180
      ) {
        throw new Error('longitude must be between -180 and 180.')
      }

      if (
        args.serviceLocationOverride.radiusMeters !== undefined &&
        (!Number.isFinite(args.serviceLocationOverride.radiusMeters) ||
          args.serviceLocationOverride.radiusMeters <= 0)
      ) {
        throw new Error('radiusMeters must be greater than zero.')
      }
    }

    await ctx.db.patch(args.shiftId, {
      serviceLocationOverride: args.serviceLocationOverride,
    })

    return args.shiftId
  },
})

export const updateStatus = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    status: v.union(v.literal('scheduled'), v.literal('in_progress')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    await ctx.db.patch(args.shiftId, { status: args.status })
    return args.shiftId
  },
})
