import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import type { Id } from './_generated/dataModel'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'

// Fixed reference dates for deterministic, idempotent seeds across days
const REF_TODAY = '2024-01-15'
const REF_YESTERDAY = '2024-01-14'

export const seedAgency = mutation({
  args: {
    clerkOrgId: v.string(),
    caregiverIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const counts = {
      clientsCreated: 0,
      clientsSkipped: 0,
      shiftsCreated: 0,
      shiftsSkipped: 0,
      shiftsRepaired: 0,
      docsCreated: 0,
      docsSkipped: 0,
    }

    // Helper: find client by displayName within tenant
    const findClient = async (displayName: string) => {
      const all = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((c) => c.displayName === displayName) ?? null
    }

    // Upsert clients
    let clientSlsId: Id<'clients'>
    const clientSls = await findClient('Alex Rivera')
    if (!clientSls) {
      clientSlsId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Alex Rivera',
        serviceType: 'SLS',
        authorizationHours: 40,
        riskFlags: ['mobility'],
      })
      counts.clientsCreated++
    } else {
      clientSlsId = clientSls._id
      counts.clientsSkipped++
    }

    let clientIlsId: Id<'clients'>
    const clientIls = await findClient('Jordan Chen')
    if (!clientIls) {
      clientIlsId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jordan Chen',
        serviceType: 'ILS',
        authorizationHours: 30,
        riskFlags: [],
      })
      counts.clientsCreated++
    } else {
      clientIlsId = clientIls._id
      counts.clientsSkipped++
    }

    const cg1 = args.caregiverIds[0] ?? 'cg-demo-1'
    const cg2 = args.caregiverIds[1] ?? 'cg-demo-2'

    // Helper: find shift by scheduledStart within tenant
    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q.eq('tenantId', tenantId),
        )
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    // Helper: repair missing child records for a shift
    const repairShiftChildren = async (
      shiftId: Id<'shifts'>,
      config: {
        note?: { startTime: string; endTime: string; servicesProvided: string; clientResponse: string; narrative: string; submittedBy?: string; submittedAt?: string }
        tasks: Array<{ title: string; requiredProof: boolean; status: 'pending' | 'complete'; proofName?: string }>
        review?: { reviewerId: string; decision: 'approved' | 'correction_requested'; comment: string; createdAt: string }
        billing?: { hours: number; rate: number; amount: number; createdAt: string }
      },
    ) => {
      let repaired = false

      const existingNote = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
        .unique()
      if (!existingNote && config.note) {
        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: config.note.startTime,
          endTime: config.note.endTime,
          servicesProvided: config.note.servicesProvided,
          clientResponse: config.note.clientResponse,
          narrative: config.note.narrative,
          submittedBy: config.note.submittedBy,
          submittedAt: config.note.submittedAt,
        })
        repaired = true
      }

      const existingTasks = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
        .collect()
      const existingTaskTitles = new Set(existingTasks.map((t) => t.title))
      for (const task of config.tasks) {
        if (!existingTaskTitles.has(task.title)) {
          await ctx.db.insert('shiftTasks', {
            tenantId,
            shiftId,
            title: task.title,
            requiredProof: task.requiredProof,
            status: task.status,
            proofName: task.proofName,
          })
          repaired = true
        }
      }

      if (config.review) {
        const existingReviews = await ctx.db
          .query('reviewEvents')
          .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
          .collect()
        if (existingReviews.length === 0) {
          await ctx.db.insert('reviewEvents', {
            tenantId,
            shiftId,
            reviewerId: config.review.reviewerId,
            decision: config.review.decision,
            comment: config.review.comment,
            createdAt: config.review.createdAt,
          })
          repaired = true
        }
      }

      if (config.billing) {
        const existingBilling = await ctx.db
          .query('billingLines')
          .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
          .collect()
        if (existingBilling.length === 0) {
          await ctx.db.insert('billingLines', {
            tenantId,
            shiftId,
            hours: config.billing.hours,
            rate: config.billing.rate,
            amount: config.billing.amount,
            createdAt: config.billing.createdAt,
          })
          repaired = true
        }
      }

      return repaired
    }

    // Shift 1: in_progress today
    let shift1Id: Id<'shifts'>
    const shift1 = await findShift(`${REF_TODAY}T09:00:00Z`)
    if (!shift1) {
      shift1Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientSlsId,
        caregiverId: cg1,
        scheduledStart: `${REF_TODAY}T09:00:00Z`,
        scheduledEnd: `${REF_TODAY}T13:00:00Z`,
        status: 'in_progress',
        serviceType: 'SLS',
        rate: 28.5,
      })
      counts.shiftsCreated++
    } else {
      shift1Id = shift1._id
      counts.shiftsSkipped++
    }
    const shift1Repaired = await repairShiftChildren(shift1Id, {
      note: { startTime: '', endTime: '', servicesProvided: '', clientResponse: '', narrative: '' },
      tasks: [
        { title: 'Medication support observed', requiredProof: true, status: 'pending' },
        { title: 'Community access activity', requiredProof: false, status: 'pending' },
      ],
    })
    if (shift1Repaired) counts.shiftsRepaired++

    // Shift 2: in_progress yesterday
    let shift2Id: Id<'shifts'>
    const shift2 = await findShift(`${REF_YESTERDAY}T14:00:00Z`)
    if (!shift2) {
      shift2Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientIlsId,
        caregiverId: cg2,
        scheduledStart: `${REF_YESTERDAY}T14:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T18:00:00Z`,
        status: 'in_progress',
        serviceType: 'ILS',
        rate: 32.0,
      })
      counts.shiftsCreated++
    } else {
      shift2Id = shift2._id
      counts.shiftsSkipped++
    }
    const shift2Repaired = await repairShiftChildren(shift2Id, {
      note: { startTime: '', endTime: '', servicesProvided: '', clientResponse: '', narrative: '' },
      tasks: [
        { title: 'ILS coaching session', requiredProof: false, status: 'pending' },
        { title: 'Meal planning documentation', requiredProof: true, status: 'pending' },
      ],
    })
    if (shift2Repaired) counts.shiftsRepaired++

    // Shift 3: submitted yesterday
    let shift3Id: Id<'shifts'>
    const shift3 = await findShift(`${REF_YESTERDAY}T08:00:00Z`)
    if (!shift3) {
      shift3Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientSlsId,
        caregiverId: cg1,
        scheduledStart: `${REF_YESTERDAY}T08:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T12:00:00Z`,
        status: 'submitted',
        serviceType: 'SLS',
        rate: 28.5,
      })
      counts.shiftsCreated++
    } else {
      shift3Id = shift3._id
      counts.shiftsSkipped++
    }
    const shift3Repaired = await repairShiftChildren(shift3Id, {
      note: {
        startTime: '08:00',
        endTime: '12:00',
        servicesProvided: 'Community integration, medication reminders',
        clientResponse: 'Engaged well with group activity.',
        narrative: 'Supported client through morning routine and community outing.',
        submittedBy: cg1,
        submittedAt: `${REF_YESTERDAY}T12:30:00Z`,
      },
      tasks: [
        { title: 'Medication support observed', requiredProof: true, status: 'complete', proofName: 'med_log.jpg' },
        { title: 'Community access activity', requiredProof: false, status: 'complete' },
      ],
    })
    if (shift3Repaired) counts.shiftsRepaired++

    // Shift 4: billing_ready yesterday
    let shift4Id: Id<'shifts'>
    const shift4 = await findShift(`${REF_YESTERDAY}T09:00:00Z`)
    if (!shift4) {
      shift4Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientIlsId,
        caregiverId: cg2,
        scheduledStart: `${REF_YESTERDAY}T09:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T13:00:00Z`,
        status: 'billing_ready',
        serviceType: 'ILS',
        rate: 32.0,
      })
      counts.shiftsCreated++
    } else {
      shift4Id = shift4._id
      counts.shiftsSkipped++
    }
    const hours = 4
    const amount = Math.round(hours * 32.0 * 100) / 100
    const shift4Repaired = await repairShiftChildren(shift4Id, {
      note: {
        startTime: '09:00',
        endTime: '13:00',
        servicesProvided: 'ILS coaching, budgeting practice',
        clientResponse: 'Practiced meal planning independently.',
        narrative: 'Client showed improvement in independent living skills.',
        submittedBy: cg2,
        submittedAt: `${REF_YESTERDAY}T13:15:00Z`,
      },
      tasks: [
        { title: 'ILS coaching session', requiredProof: false, status: 'complete' },
        { title: 'Budgeting worksheet', requiredProof: true, status: 'complete', proofName: 'budget_sheet.pdf' },
      ],
      review: {
        reviewerId: 'co-demo-1',
        decision: 'approved',
        comment: 'Documentation complete and accurate.',
        createdAt: `${REF_YESTERDAY}T14:00:00Z`,
      },
      billing: {
        hours,
        rate: 32.0,
        amount,
        createdAt: `${REF_YESTERDAY}T14:00:00Z`,
      },
    })
    if (shift4Repaired) counts.shiftsRepaired++

    // Upsert compliance docs
    const findDoc = async (title: string) => {
      const all = await ctx.db
        .query('complianceDocs')
        .withIndex('by_tenant_category', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((d) => d.title === title) ?? null
    }

    const doc1 = await findDoc('SLS Documentation Requirements')
    if (!doc1) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'SLS Documentation Requirements',
        body: 'All SLS shifts require progress notes with start/end times, services provided, and client response. Proof of medication support must be attached when applicable.',
        category: 'documentation',
        visibility: 'all_staff',
        embedding: generateEmbedding('SLS Documentation Requirements progress notes medication support proof'),
      })
      counts.docsCreated++
    } else {
      counts.docsSkipped++
    }

    const doc2 = await findDoc('ILS Billing Guidelines')
    if (!doc2) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'ILS Billing Guidelines',
        body: 'ILS services are billed at the authorized rate per hour. Documentation must show measurable skill acquisition.',
        category: 'billing',
        visibility: 'all_staff',
        embedding: generateEmbedding('ILS Billing Guidelines authorized rate per hour skill acquisition'),
      })
      counts.docsCreated++
    } else {
      counts.docsSkipped++
    }

    const totalCreated =
      counts.clientsCreated +
      counts.shiftsCreated +
      counts.docsCreated
    const totalSkipped =
      counts.clientsSkipped +
      counts.shiftsSkipped +
      counts.docsSkipped

    if (totalCreated === 0 && totalSkipped > 0 && counts.shiftsRepaired === 0) {
      return {
        status: 'already-seeded' as const,
        message: `All demo data already exists (${totalSkipped} items skipped).`,
        counts,
      }
    }

    if (counts.shiftsRepaired > 0) {
      return {
        status: 'seeded' as const,
        message: `Repaired ${counts.shiftsRepaired} shift${counts.shiftsRepaired !== 1 ? 's' : ''} with missing records. ${totalCreated > 0 ? `Created ${totalCreated} new items.` : ''}`,
        counts,
      }
    }

    return {
      status: 'seeded' as const,
      message: `Seeded ${totalCreated} new items. ${totalSkipped > 0 ? `${totalSkipped} existing items skipped.` : ''}`,
      counts,
    }
  },
})

export const seedCaregiverShifts = mutation({
  args: {
    clerkOrgId: v.string(),
    caregiverId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .take(10)

    if (clients.length === 0) {
      throw new Error('No clients found. Seed agency data first.')
    }

    const today = new Date().toISOString().split('T')[0]
    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q.eq('tenantId', tenantId),
        )
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    const counts = { created: 0, skipped: 0 }

    // Demo shift 1: scheduled for today morning
    const start1 = `${today}T09:00:00Z`
    if (!(await findShift(start1))) {
      const client = clients[0]
      await ctx.db.insert('shifts', {
        tenantId,
        clientId: client._id,
        caregiverId: args.caregiverId,
        scheduledStart: start1,
        scheduledEnd: `${today}T13:00:00Z`,
        status: 'scheduled',
        serviceType: client.serviceType,
        rate: 28.5,
      })
      counts.created++
    } else {
      counts.skipped++
    }

    // Demo shift 2: scheduled for today afternoon
    const start2 = `${today}T14:00:00Z`
    if (!(await findShift(start2))) {
      const client = clients.length > 1 ? clients[1] : clients[0]
      await ctx.db.insert('shifts', {
        tenantId,
        clientId: client._id,
        caregiverId: args.caregiverId,
        scheduledStart: start2,
        scheduledEnd: `${today}T18:00:00Z`,
        status: 'scheduled',
        serviceType: client.serviceType,
        rate: 30.0,
      })
      counts.created++
    } else {
      counts.skipped++
    }

    return {
      status: counts.created > 0 ? ('seeded' as const) : ('already-seeded' as const),
      message:
        counts.created > 0
          ? `Created ${counts.created} demo shift${counts.created !== 1 ? 's' : ''} for caregiver.`
          : `All demo shifts already exist (${counts.skipped} skipped).`,
      counts,
    }
  },
})

function generateEmbedding(text: string): number[] {
  const DIMENSIONS = 32
  const vector = Array.from({ length: DIMENSIONS }, () => 0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  tokens.forEach((token, index) => {
    const hash = hashToken(`${token}:${index}`)
    const slot = Math.abs(hash) % DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[slot] += sign * (1 + token.length / 12)
  })

  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value ** 2, 0),
  )
  return magnitude === 0
    ? vector
    : vector.map((value) => Number((value / magnitude).toFixed(6)))
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash
}

type E2EFixtureUserIds = {
  adminUserId: string
  coordinatorUserId: string
  caregiverUserId: string
}

async function deleteShiftChildren(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const notes = await ctx.db
    .query('progressNotes')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()
  for (const note of notes) {
    await ctx.db.delete(note._id)
  }

  const tasks = await ctx.db
    .query('shiftTasks')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()
  for (const task of tasks) {
    await ctx.db.delete(task._id)
  }

  const reviews = await ctx.db
    .query('reviewEvents')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()
  for (const review of reviews) {
    await ctx.db.delete(review._id)
  }

  const billingLines = await ctx.db
    .query('billingLines')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()
  for (const line of billingLines) {
    await ctx.db.delete(line._id)
  }

  const punches = await ctx.db
    .query('timePunches')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()
  for (const punch of punches) {
    await ctx.db.delete(punch._id)
  }
}

async function seedE2EFixtures(
  ctx: MutationCtx,
  clerkOrgId: string,
  userIds: E2EFixtureUserIds,
) {
  const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])

  // Fixed fixture date so seeded shifts are always in the past and clock-in is
  // allowed regardless of the actual UTC time the tests run.
  const fixtureDate = REF_TODAY

  const members = [
    {
      clerkUserId: userIds.adminUserId,
      role: 'org:admin' as const,
      displayName: 'E2E Admin',
      email: 'e2e-admin@atriax.test',
    },
    {
      clerkUserId: userIds.coordinatorUserId,
      role: 'org:coordinator' as const,
      displayName: 'E2E Coordinator',
      email: 'e2e-coordinator@atriax.test',
    },
    {
      clerkUserId: userIds.caregiverUserId,
      role: 'org:caregiver' as const,
      displayName: 'E2E Caregiver',
      email: 'e2e-caregiver@atriax.test',
    },
  ]

  const memberIds: Record<string, Id<'tenantMembers'>> = {}
  for (const member of members) {
    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
      )
      .unique()
    if (existing) {
      memberIds[member.clerkUserId] = existing._id
    } else {
      memberIds[member.clerkUserId] = await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        displayName: member.displayName,
        email: member.email,
      })
    }
  }

  const findClient = async (displayName: string) => {
    const all = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    return all.find((c) => c.displayName === displayName) ?? null
  }

  // The fixture caregiver is an active caregiver: mark platform training
  // complete so the TrainingRouteGuard lets them reach /caregiver/today.
  const existingTraining = await ctx.db
    .query('platformTrainingCompletions')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', userIds.caregiverUserId),
    )
    .filter((q) => q.eq(q.field('trainingId'), 'platform_training'))
    .first()
  if (!existingTraining) {
    await ctx.db.insert('platformTrainingCompletions', {
      tenantId,
      clerkUserId: userIds.caregiverUserId,
      trainingId: 'platform_training',
      completedAt: new Date().toISOString(),
      status: 'completed',
    })
  }

  let lifecycleClientId: Id<'clients'>
  const lifecycleClient = await findClient('Sam Lee')
  if (!lifecycleClient) {
    lifecycleClientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Sam Lee',
      serviceType: 'ILS',
      authorizationHours: 30,
      riskFlags: [],
    })
  } else {
    lifecycleClientId = lifecycleClient._id
  }

  let geofenceClientId: Id<'clients'>
  const geofenceClient = await findClient('Maya Torres')
  if (!geofenceClient) {
    geofenceClientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Maya Torres',
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: ['mobility'],
      serviceAddress: {
        line1: '123 Hennepin Ave',
        city: 'Minneapolis',
        state: 'MN',
        postalCode: '55401',
        latitude: 44.9778,
        longitude: -93.265,
      },
    })
  } else {
    geofenceClientId = geofenceClient._id
  }

  // Reset geofence to disabled so lifecycle tests never prompt for location.
  const existingSettings = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()
  if (existingSettings) {
    await ctx.db.patch(existingSettings._id, {
      shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
    })
  } else {
    await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
    })
  }

  const findFixtureShifts = async (
    clientId: Id<'clients'>,
    caregiverId: string,
    scheduledStart: string,
  ) => {
    const all = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', caregiverId),
      )
      .collect()
    return all.filter(
      (s) => s.clientId === clientId && s.scheduledStart === scheduledStart,
    )
  }

  const createCleanShift = async (
    clientId: Id<'clients'>,
    scheduledStart: string,
    scheduledEnd: string,
    serviceType: 'ILS' | 'SLS',
    rate: number,
  ): Promise<Id<'shifts'>> => {
    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: userIds.caregiverUserId,
      scheduledStart,
      scheduledEnd,
      status: 'scheduled',
      serviceType,
      rate,
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
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: 'pending',
    })

    return shiftId
  }

  // Destroy only the intended fixture shifts (matched by client, caregiver, and
  // scheduled start) so that each E2E reset creates fresh documents with new IDs
  // without touching unrelated tenant shifts that happen to share the same start
  // time. This prevents the React/Convex client from reusing stale
  // query/component state keyed by the same shift ID across serial scenarios.
  const lifecycleStart = `${fixtureDate}T09:00:00Z`
  const existingLifecycleShifts = await findFixtureShifts(
    lifecycleClientId,
    userIds.caregiverUserId,
    lifecycleStart,
  )
  for (const shift of existingLifecycleShifts) {
    await deleteShiftChildren(ctx, tenantId, shift._id)
    await ctx.db.delete(shift._id)
  }

  const geofenceStart = `${fixtureDate}T14:00:00Z`
  const existingGeofenceShifts = await findFixtureShifts(
    geofenceClientId,
    userIds.caregiverUserId,
    geofenceStart,
  )
  for (const shift of existingGeofenceShifts) {
    await deleteShiftChildren(ctx, tenantId, shift._id)
    await ctx.db.delete(shift._id)
  }

  const lifecycleShiftId = await createCleanShift(
    lifecycleClientId,
    lifecycleStart,
    `${fixtureDate}T13:00:00Z`,
    'ILS',
    30,
  )

  const geofenceShiftId = await createCleanShift(
    geofenceClientId,
    geofenceStart,
    `${fixtureDate}T18:00:00Z`,
    'SLS',
    28.5,
  )

  return {
    tenantId,
    memberIds,
    lifecycleShiftId,
    geofenceShiftId,
  }
}

// Deterministic E2E fixtures. Each call deletes the existing fixture shifts
// and inserts fresh ones, so serial E2E scenarios never reuse stale shift IDs.
// Geofence is disabled by default so the lifecycle flow can run without
// location. A second client with coordinates is provided for geofence scenarios.
export const seedE2E = mutation({
  args: {
    clerkOrgId: v.string(),
    adminUserId: v.string(),
    coordinatorUserId: v.string(),
    caregiverUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await seedE2EFixtures(ctx, args.clerkOrgId, {
      adminUserId: args.adminUserId,
      coordinatorUserId: args.coordinatorUserId,
      caregiverUserId: args.caregiverUserId,
    })

    return {
      status: 'seeded' as const,
      ...result,
    }
  },
})

// Resets the E2E fixture shifts back to a clean scheduled state by recreating
// them with fresh IDs and disabling geofence. Used between serial e2e scenarios
// so each test starts from an isolated fixture baseline.
export const resetE2EShifts = mutation({
  args: {
    clerkOrgId: v.string(),
    adminUserId: v.string(),
    coordinatorUserId: v.string(),
    caregiverUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await seedE2EFixtures(ctx, args.clerkOrgId, {
      adminUserId: args.adminUserId,
      coordinatorUserId: args.coordinatorUserId,
      caregiverUserId: args.caregiverUserId,
    })

    return {
      status: 'reset' as const,
      ...result,
    }
  },
})

type E2ECandidateFixtureUserIds = {
  adminUserId: string
  coordinatorUserId: string
  caregiverUserId: string
  hrUserId: string
  candidateUserId: string
}

async function seedE2ECandidateFixtures(
  ctx: MutationCtx,
  clerkOrgId: string,
  userIds: E2ECandidateFixtureUserIds,
) {
  const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])

  const now = new Date().toISOString()
  const fixtureDate = REF_TODAY

  const members = [
    {
      clerkUserId: userIds.adminUserId,
      role: 'org:admin' as const,
      displayName: 'E2E Admin',
      email: 'e2e-admin@atriax.test',
    },
    {
      clerkUserId: userIds.coordinatorUserId,
      role: 'org:coordinator' as const,
      displayName: 'E2E Coordinator',
      email: 'e2e-coordinator@atriax.test',
    },
    {
      clerkUserId: userIds.caregiverUserId,
      role: 'org:caregiver' as const,
      displayName: 'E2E Caregiver',
      email: 'e2e-caregiver@atriax.test',
    },
    {
      clerkUserId: userIds.hrUserId,
      role: 'org:hr' as const,
      displayName: 'E2E HR',
      email: 'e2e-hr@atriax.test',
    },
    {
      clerkUserId: userIds.candidateUserId,
      role: 'org:candidate' as const,
      displayName: 'E2E Candidate',
      email: 'phase2-candidate@atriax.test',
    },
  ]

  for (const member of members) {
    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: member.role,
        displayName: member.displayName,
        email: member.email,
      })
    } else {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: member.clerkUserId,
        role: member.role,
        displayName: member.displayName,
        email: member.email,
      })
    }
  }

  const findClient = async (displayName: string) => {
    const all = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    return all.find((c) => c.displayName === displayName) ?? null
  }

  let clientId: Id<'clients'>
  const phase2Client = await findClient('Phase 2 Client')
  if (!phase2Client) {
    clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Phase 2 Client',
      serviceType: 'SLS',
      authorizationHours: 40,
      riskFlags: [],
    })
  } else {
    clientId = phase2Client._id
  }

  const candidateEmail = 'phase2-candidate@atriax.test'

  // Remove any existing candidate rows for this fixture email/Clerk user so
  // the E2E flow always targets a single, deterministic candidate.
  const byEmail = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_email', (q) =>
      q.eq('tenantId', tenantId).eq('email', candidateEmail),
    )
    .collect()
  const byClerkUser = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', userIds.candidateUserId),
    )
    .collect()
  const toDelete = new Set([...byEmail, ...byClerkUser].map((c) => c._id))
  for (const staleId of toDelete) {
    await ctx.db.delete(staleId)
    // Remove the stale candidate's task rows so they do not pile up across runs.
    const staleTasks = await ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', staleId),
      )
      .collect()
    for (const task of staleTasks) {
      await ctx.db.delete(task._id)
    }
  }

  // Clean up any stale employee profiles tied to the fixture candidate so
  // hireCandidate does not hit a non-unique email conflict.
  const staleEmployeeProfiles = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .filter((q) => q.eq(q.field('email'), candidateEmail))
    .collect()
  for (const profile of staleEmployeeProfiles) {
    await ctx.db.delete(profile._id)
  }

  const candidateId = await ctx.db.insert('candidates', {
    tenantId,
    clerkUserId: userIds.candidateUserId,
    email: candidateEmail,
    displayName: 'Phase 2 Candidate',
    status: 'applied',
    createdAt: now,
  })

  // Standard onboarding task set (mirrors createCandidateRecord): the fixture
  // candidate already submitted an application, so form_submission is complete
  // and car_insurance stays skipped until the applicant answers Yes to the
  // transport question on a fresh application.
  const E2E_CANDIDATE_TASK_TYPES = [
    'form_submission',
    'photo_id',
    'tax_id_ssn',
    'cpr_certificate',
    'health_screen',
    'background_check',
    'employment_agreement',
    'additional_certifications',
    'car_insurance',
  ] as const
  await Promise.all(
    E2E_CANDIDATE_TASK_TYPES.map((type, index) =>
      ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type,
        status:
          type === 'form_submission'
            ? 'complete'
            : type === 'car_insurance'
              ? 'skipped'
              : 'pending',
        order: index,
        completedAt: type === 'form_submission' ? now : undefined,
      }),
    ),
  )

  // Reset any stale platform-training completion so the onboarding E2E can
  // assert the before/after training state deterministically.
  const existingTraining = await ctx.db
    .query('platformTrainingCompletions')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', userIds.candidateUserId),
    )
    .filter((q) => q.eq(q.field('trainingId'), 'platform_training'))
    .first()
  if (existingTraining) {
    await ctx.db.delete(existingTraining._id)
  }

  const existingApplication = await ctx.db
    .query('applications')
    .withIndex('by_candidate_submittedAt', (q) => q.eq('candidateId', candidateId))
    .order('desc')
    .first()
  const applicationFields = {
    name: 'Phase 2 Candidate',
    experience: '2 years',
    notes: 'Seeded fixture application',
    // Pre-hire gate: I-9 Section 2 completed by HR.
    i9Section2: {
      documentTitle: "Driver's License",
      documentNumber: 'D1234567',
      employerSignature: 'E2E HR',
      date: '2026-07-18',
    },
  }
  let seededApplicationId: Id<'applications'>
  if (existingApplication) {
    await ctx.db.patch(existingApplication._id, {
      status: 'submitted',
      submittedAt: now,
      fields: applicationFields,
    })
    seededApplicationId = existingApplication._id
  } else {
    seededApplicationId = await ctx.db.insert('applications', {
      tenantId,
      candidateId,
      status: 'submitted',
      submittedAt: now,
      fields: applicationFields,
    })
  }

  // Pre-hire gates: W-4 employer section completed and an official background
  // check result on file, so hireCandidate can proceed in the lifecycle E2E.
  await ctx.db.insert('prefilledDocuments', {
    tenantId,
    candidateId,
    applicationId: seededApplicationId,
    documentType: 'w4',
    generatedAt: now,
    generatedBy: userIds.hrUserId,
    hrSectionCompleted: true,
    hrSectionData: {
      employerName: "Diego's Agency",
      ein: '12-3456789',
      firstDateOfEmployment: '2026-08-01',
    },
  })
  await ctx.db.insert('backgroundChecks', {
    tenantId,
    candidateId,
    provider: 'mock',
    status: 'clear',
    package: 'basic',
    initiatedAt: now,
    completedAt: now,
    officialResultStorageId: 'phase2-fixture-bg-result',
    officialResultUploadedAt: now,
    officialResultUploadedBy: userIds.hrUserId,
  })

  const availabilityWindows = await ctx.db
    .query('availabilityWindows')
    .withIndex('by_tenant_caregiver', (q) =>
      q.eq('tenantId', tenantId).eq('caregiverId', userIds.caregiverUserId),
    )
    .collect()
  const mondayWindow = availabilityWindows.find(
    (w) =>
      w.kind === 'recurring' &&
      w.dayOfWeek === 1 &&
      w.startTime === '09:00' &&
      w.endTime === '17:00',
  )
  if (mondayWindow) {
    await ctx.db.patch(mondayWindow._id, { available: true })
  } else {
    await ctx.db.insert('availabilityWindows', {
      tenantId,
      caregiverId: userIds.caregiverUserId,
      kind: 'recurring',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
      available: true,
      createdAt: now,
    })
  }

  // Clean up any shifts previously created for this caregiver by earlier E2E
  // runs so scheduling specs start from a known, conflict-free state.
  const existingCaregiverShifts = await ctx.db
    .query('shifts')
    .withIndex('by_tenant_caregiver_status', (q) =>
      q.eq('tenantId', tenantId).eq('caregiverId', userIds.caregiverUserId),
    )
    .collect()
  for (const shift of existingCaregiverShifts) {
    const relatedCoverage = await ctx.db
      .query('coverageRequests')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', shift._id),
      )
      .collect()
    for (const request of relatedCoverage) {
      await ctx.db.delete(request._id)
    }
    await ctx.db.delete(shift._id)
  }

  const findShift = async (
    clientIdArg: Id<'clients'>,
    caregiverId: string,
    scheduledStart: string,
  ) => {
    const all = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', caregiverId),
      )
      .collect()
    return (
      all.find(
        (s) =>
          s.clientId === clientIdArg && s.scheduledStart === scheduledStart,
      ) ?? null
    )
  }

  const coverageStart = `${fixtureDate}T10:00:00Z`
  const coverageEnd = `${fixtureDate}T14:00:00Z`
  let coverageShiftId: Id<'shifts'>
  const existingShift = await findShift(
    clientId,
    userIds.caregiverUserId,
    coverageStart,
  )
  if (!existingShift) {
    coverageShiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: userIds.caregiverUserId,
      scheduledStart: coverageStart,
      scheduledEnd: coverageEnd,
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 28.5,
    })
  } else {
    coverageShiftId = existingShift._id
  }

  const existingCoverage = await ctx.db
    .query('coverageRequests')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', coverageShiftId),
    )
    .unique()
  let coverageRequestId: Id<'coverageRequests'>
  if (existingCoverage) {
    coverageRequestId = existingCoverage._id
    await ctx.db.patch(coverageRequestId, {
      status: 'open',
      requesterId: userIds.caregiverUserId,
      reason: 'Phase 2 fixture coverage',
      reassignedTo: undefined,
      resolvedBy: undefined,
      resolvedAt: undefined,
    })
  } else {
    coverageRequestId = await ctx.db.insert('coverageRequests', {
      tenantId,
      shiftId: coverageShiftId,
      requesterId: userIds.caregiverUserId,
      reason: 'Phase 2 fixture coverage',
      status: 'open',
      createdAt: now,
    })
  }

  const formDefinitions = await ctx.db
    .query('formDefinitions')
    .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
    .collect()
  const phase2Form = formDefinitions.find(
    (f) => f.name === 'Phase 2 Application',
  )
  const formFields = [
    { id: 'name', label: 'Name', type: 'text', required: true },
    { id: 'experience', label: 'Experience', type: 'text', required: true },
    { id: 'notes', label: 'Notes', type: 'text', required: false },
  ]
  let formDefinitionId: Id<'formDefinitions'>
  if (phase2Form) {
    formDefinitionId = phase2Form._id
    await ctx.db.patch(formDefinitionId, { active: true, fields: formFields })
  } else {
    formDefinitionId = await ctx.db.insert('formDefinitions', {
      tenantId,
      name: 'Phase 2 Application',
      active: true,
      fields: formFields,
      createdBy: userIds.adminUserId,
      createdAt: now,
    })
  }

  const existingArchiveItems = await ctx.db
    .query('documentArchiveItems')
    .withIndex('by_tenant_subject', (q) =>
      q
        .eq('tenantId', tenantId)
        .eq('subjectType', 'candidate')
        .eq('subjectId', candidateId as string),
    )
    .filter((q) => q.eq(q.field('category'), 'phase2_fixture'))
    .collect()
  for (const item of existingArchiveItems) {
    await ctx.db.delete(item.fileId)
    await ctx.db.delete(item._id)
  }

  const fixtureFileId = await ctx.db.insert('files', {
    tenantId,
    storageId: 'phase2-fixture-document',
    uploadedBy: userIds.candidateUserId,
    fileName: 'phase2-document.pdf',
    contentType: 'application/pdf',
    size: 1024,
    linkedType: 'complianceDoc',
    linkedId: candidateId as string,
    visibility: 'all_staff',
    createdAt: now,
  })

  const documentArchiveItemId = await ctx.db.insert('documentArchiveItems', {
    tenantId,
    fileId: fixtureFileId,
    subjectType: 'candidate',
    subjectId: candidateId as string,
    category: 'phase2_fixture',
    status: 'pending_review',
    source: 'Phase 2 fixture',
    createdAt: now,
  })

  return {
    tenantId,
    candidateId,
    coverageShiftId,
    coverageRequestId,
    formDefinitionId,
    fileId: fixtureFileId,
    documentArchiveItemId,
  }
}

// Idempotent Phase 2 E2E fixtures. Seeds a candidate with a submitted
// application, an availability window, an open coverage request, a form
// definition, and a pending-review document archive item.
export const resetE2ECandidate = mutation({
  args: {
    clerkOrgId: v.string(),
    adminUserId: v.string(),
    coordinatorUserId: v.string(),
    caregiverUserId: v.string(),
    hrUserId: v.string(),
    candidateUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const result = await seedE2ECandidateFixtures(ctx, args.clerkOrgId, {
      adminUserId: args.adminUserId,
      coordinatorUserId: args.coordinatorUserId,
      caregiverUserId: args.caregiverUserId,
      hrUserId: args.hrUserId,
      candidateUserId: args.candidateUserId,
    })

    return {
      status: 'seeded' as const,
      ...result,
    }
  },
})


// Idempotent helper to promote a fixture candidate to the offer_sent state
// with realistic application and offer details for visual regression testing.
export const seedCandidateOffer = mutation({
  args: {
    clerkOrgId: v.string(),
    candidateEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const normalizedEmail = args.candidateEmail.toLowerCase().trim()
    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', normalizedEmail),
      )
      .unique()

    if (!candidate) {
      return { status: 'not_found' as const, candidateId: null }
    }

    const now = new Date().toISOString()
    const candidateId = candidate._id

    const applicationFields = {
      fullName: candidate.displayName || 'Phase 2 Candidate',
      email: candidate.email,
      phone: candidate.phone || '(555) 123-4567',
      position: 'Caregiver',
      yearsExperience: '2-5',
      dob: '1990-06-15',
      address: '123 Main Street, Los Angeles, CA 90012',
      payRate: '$22.50 / hr',
      startDate: '2026-07-15',
      schedule: 'Full-time, flexible shifts',
      supervisor: 'Maria Gonzalez, Scheduling Coordinator',
    }

    const existingApplication = await ctx.db
      .query('applications')
      .withIndex('by_candidate_submittedAt', (q) => q.eq('candidateId', candidateId))
      .order('desc')
      .first()

    let applicationId: Id<'applications'>
    if (existingApplication) {
      await ctx.db.patch(existingApplication._id, {
        status: 'submitted',
        submittedAt: now,
        fields: applicationFields,
      })
      applicationId = existingApplication._id
    } else {
      applicationId = await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt: now,
        fields: applicationFields,
      })
    }

    // Move to hr_review then offer_sent
    await ctx.db.patch(applicationId, {
      decision: 'approved',
      reviewedBy: 'seed',
      decisionAt: now,
      status: 'hr_review',
    })
    await ctx.db.patch(candidateId, {
      status: 'hr_review',
      phone: candidate.phone || '(555) 123-4567',
    })

    await ctx.db.patch(applicationId, { status: 'offer_sent' })
    await ctx.db.patch(candidateId, { status: 'offer_sent' })

    // Mark earlier onboarding tasks complete so the checklist shows offer as next
    const tasks = await ctx.db
      .query('candidateTasks')
      .withIndex('by_tenant_candidate_order', (q) =>
        q.eq('tenantId', tenantId).eq('candidateId', candidateId),
      )
      .collect()

    for (const task of tasks) {
      if (
        task.type === 'form_submission' ||
        task.type === 'photo_id' ||
        task.type === 'cpr_certificate' ||
        task.type === 'background_check' ||
        task.type === 'employment_agreement'
      ) {
        if (task.status !== 'complete') {
          await ctx.db.patch(task._id, { status: 'complete', completedAt: now })
        }
      }
    }

    return { status: 'seeded' as const, candidateId: candidateId as string, applicationId: applicationId as string }
  },
})
