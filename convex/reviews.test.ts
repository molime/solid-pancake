import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

async function seedSubmittedShift(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    coordinatorId: string
    caregiverId: string
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.coordinatorId,
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coordinator@example.com',
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'submitted',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '08:00',
      endTime: '16:00',
      servicesProvided: 'Bathing',
      clientResponse: 'All good',
      narrative: 'Completed visit.',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Documentation',
      requiredProof: false,
      status: 'complete',
    })

    await ctx.db.insert('timePunches', {
      tenantId,
      shiftId,
      caregiverId: options.caregiverId,
      punchType: 'clock_in',
      at: '2020-01-01T08:00:00Z',
      source: 'atriax',
      adpSyncStatus: 'pending_credentials',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('timePunches', {
      tenantId,
      shiftId,
      caregiverId: options.caregiverId,
      punchType: 'clock_out',
      at: '2020-01-01T16:00:00Z',
      source: 'atriax',
      adpSyncStatus: 'pending_credentials',
      createdAt: new Date().toISOString(),
    })

    return { tenantId, clientId, shiftId }
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  coordinatorId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: coordinatorId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
  })
}

describe('reviews', () => {
  it('rejects requestCorrection with an empty comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_empty'
    const coordinatorId = 'user_coordinator_empty'
    const caregiverId = 'user_cg_empty'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.requestCorrection,
        {
          clerkOrgId,
          shiftId,
          comment: '',
        },
      ),
    ).rejects.toThrow('A comment is required to request a correction.')
  })

  it('rejects requestCorrection with a whitespace-only comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_ws'
    const coordinatorId = 'user_coordinator_ws'
    const caregiverId = 'user_cg_ws'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.requestCorrection,
        {
          clerkOrgId,
          shiftId,
          comment: '   ',
        },
      ),
    ).rejects.toThrow('A comment is required to request a correction.')
  })

  it('accepts requestCorrection with a non-empty comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_ok'
    const coordinatorId = 'user_coordinator_ok'
    const caregiverId = 'user_cg_ok'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.requestCorrection,
      {
        clerkOrgId,
        shiftId,
        comment: 'Please add the missing proof.',
      },
    )

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('needs_correction')
  })

  it('rejects approval when documentation is incomplete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_incomplete'
    const coordinatorId = 'user_coordinator_approve_incomplete'
    const caregiverId = 'user_cg_approve_incomplete'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await t.run(async (ctx) => {
      const note = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      if (note) {
        await ctx.db.patch(note._id, { narrative: '' })
      }
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.approve,
        { clerkOrgId, shiftId, comment: 'Looks good' },
      ),
    ).rejects.toThrow('Incomplete documentation')

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('submitted')
  })

  it('approves a complete shift and creates a billing line', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_complete'
    const coordinatorId = 'user_coordinator_approve_complete'
    const caregiverId = 'user_cg_approve_complete'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.approve,
      { clerkOrgId, shiftId, comment: 'Complete and accurate.' },
    )

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('billing_ready')

    const billingLines = await t.run(async (ctx) => {
      return ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
    })
    expect(billingLines).toHaveLength(1)
    expect(billingLines[0]?.amount).toBeGreaterThan(0)
  })

  it('allows caregiver resubmission after correction and returns shift to review queue', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_resubmit'
    const coordinatorId = 'user_coordinator_resubmit'
    const caregiverId = 'user_cg_resubmit'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.requestCorrection,
      { clerkOrgId, shiftId, comment: 'Fix the narrative.' },
    )

    const shiftedToCorrection = await t.run(async (ctx) =>
      ctx.db.get(shiftId as Id<'shifts'>),
    )
    expect(shiftedToCorrection?.status).toBe('needs_correction')

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.updateProgressNote,
      {
        clerkOrgId,
        shiftId,
        narrative: 'Updated narrative with sufficient detail for resubmission.',
      },
    )

    const note = await t.run(async (ctx) => {
      return ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
    })

    const tasks = await t.run(async (ctx) => {
      return ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.submitDocumentation,
      {
        clerkOrgId,
        shiftId,
        note: {
          startTime: note?.startTime ?? '08:00',
          endTime: note?.endTime ?? '16:00',
          servicesProvided: note?.servicesProvided ?? 'Bathing',
          clientResponse: note?.clientResponse ?? 'All good',
          narrative: note?.narrative ?? 'Updated narrative.',
        },
        tasks: tasks.map((task) => ({
          taskId: task._id,
          status: 'complete' as const,
        })),
      },
    )

    const resubmitted = await t.run(async (ctx) =>
      ctx.db.get(shiftId as Id<'shifts'>),
    )
    expect(resubmitted?.status).toBe('submitted')
  })
})
