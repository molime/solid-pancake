import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { api } from './_generated/api'
import { mergeTaskUpdates, validateShiftDocumentation } from './shiftValidation'
import {
  initialShiftStatusForStart,
  isScheduledStartDue,
} from './shiftLifecycle'
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

    await ctx.runMutation(api.audit.record, {
      clerkOrgId: args.clerkOrgId,
      actorId: identity.subject,
      actorRole: role,
      action: 'shift_started',
      shiftId: args.shiftId,
      previousStatus: 'scheduled',
      nextStatus: 'in_progress',
    })

    return args.shiftId
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
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only submit their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be submitted.')
    }

    const existingNote = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .unique()

    if (!existingNote) throw new Error('Progress note not found.')
    assertTenantDoc(existingNote, tenantId)

    const existingTasks = await ctx.db
      .query('shiftTasks')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .collect()

    for (const task of existingTasks) assertTenantDoc(task, tenantId)

    const mergedTasks = mergeTaskUpdates(existingTasks, args.tasks)
    const blockers = validateShiftDocumentation(args.note, mergedTasks)
    if (blockers.length > 0) {
      throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
    }

    await ctx.db.patch(existingNote._id, {
      startTime: args.note.startTime,
      endTime: args.note.endTime,
      servicesProvided: args.note.servicesProvided,
      clientResponse: args.note.clientResponse,
      narrative: args.note.narrative,
      submittedBy: identity.subject,
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

    await ctx.runMutation(api.audit.record, {
      clerkOrgId: args.clerkOrgId,
      actorId: identity.subject,
      actorRole: role,
      action: 'shift_submitted',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'submitted',
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
