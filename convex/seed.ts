import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import type { Id } from './_generated/dataModel'

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

// Deterministic E2E fixtures. Idempotent by clerkOrgId, member user id, and
// scheduled start time. Geofence is disabled by default so the lifecycle
// flow can run without location. A second client with coordinates is provided
// for geofence scenarios.
export const seedE2E = mutation({
  args: {
    clerkOrgId: v.string(),
    adminUserId: v.string(),
    coordinatorUserId: v.string(),
    caregiverUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    // Fixed fixture date so seeded shifts are always in the past and clock-in is
    // allowed regardless of the actual UTC time the tests run.
    const fixtureDate = REF_TODAY

    const members = [
      {
        clerkUserId: args.adminUserId,
        role: 'org:admin' as const,
        displayName: 'E2E Admin',
        email: 'e2e-admin@atriax.test',
      },
      {
        clerkUserId: args.coordinatorUserId,
        role: 'org:coordinator' as const,
        displayName: 'E2E Coordinator',
        email: 'e2e-coordinator@atriax.test',
      },
      {
        clerkUserId: args.caregiverUserId,
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
    const defaultGeofence = {
      enabled: false,
      enforceClockIn: false,
      enforceClockOut: false,
      defaultRadiusMeters: 100,
      maxAccuracyMeters: 50,
    }
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
    } else {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: defaultGeofence,
      })
    }

    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    const resetShift = async (shiftId: Id<'shifts'>) => {
      await ctx.db.patch(shiftId, {
        status: 'scheduled',
        clockInAt: undefined,
        clockOutAt: undefined,
        serviceLocationOverride: undefined,
      })

      const existingNote = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      if (existingNote) {
        await ctx.db.patch(existingNote._id, {
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
          submittedBy: undefined,
          submittedAt: undefined,
        })
      } else {
        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        })
      }

      const existingTasks = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      for (const task of existingTasks) {
        await ctx.db.delete(task._id)
      }
      await ctx.db.insert('shiftTasks', {
        tenantId,
        shiftId,
        title: 'Upload shift documentation proof',
        requiredProof: true,
        status: 'pending',
      })

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

    let lifecycleShiftId: Id<'shifts'>
    const lifecycleStart = `${fixtureDate}T09:00:00Z`
    const lifecycleShift = await findShift(lifecycleStart)
    if (!lifecycleShift) {
      lifecycleShiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId: lifecycleClientId,
        caregiverId: args.caregiverUserId,
        scheduledStart: lifecycleStart,
        scheduledEnd: `${fixtureDate}T13:00:00Z`,
        status: 'scheduled',
        serviceType: 'ILS',
        rate: 30,
      })
    } else {
      lifecycleShiftId = lifecycleShift._id
      await ctx.db.patch(lifecycleShiftId, { caregiverId: args.caregiverUserId })
    }
    await resetShift(lifecycleShiftId)

    let geofenceShiftId: Id<'shifts'>
    const geofenceStart = `${fixtureDate}T14:00:00Z`
    const geofenceShift = await findShift(geofenceStart)
    if (!geofenceShift) {
      geofenceShiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId: geofenceClientId,
        caregiverId: args.caregiverUserId,
        scheduledStart: geofenceStart,
        scheduledEnd: `${fixtureDate}T18:00:00Z`,
        status: 'scheduled',
        serviceType: 'SLS',
        rate: 28.5,
      })
    } else {
      geofenceShiftId = geofenceShift._id
      await ctx.db.patch(geofenceShiftId, { caregiverId: args.caregiverUserId })
    }
    await resetShift(geofenceShiftId)

    return {
      status: 'seeded' as const,
      tenantId,
      memberIds,
      lifecycleShiftId,
      geofenceShiftId,
    }
  },
})

// Resets the two deterministic E2E fixture shifts back to a clean scheduled
// state and disables geofence. Used between serial e2e scenarios so each test
// starts from the same fixture baseline.
export const resetE2EShifts = mutation({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    // Use the same fixed fixture date as seedE2E so reset finds the rows.
    const fixtureDate = REF_TODAY

    const existingSettings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()
    const defaultGeofence = {
      enabled: false,
      enforceClockIn: false,
      enforceClockOut: false,
      defaultRadiusMeters: 100,
      maxAccuracyMeters: 50,
    }
    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
    }

    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    const resetShift = async (shiftId: Id<'shifts'>) => {
      await ctx.db.patch(shiftId, {
        status: 'scheduled',
        clockInAt: undefined,
        clockOutAt: undefined,
        serviceLocationOverride: undefined,
      })

      const existingNote = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      if (existingNote) {
        await ctx.db.patch(existingNote._id, {
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
          submittedBy: undefined,
          submittedAt: undefined,
        })
      }

      const existingTasks = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      for (const task of existingTasks) {
        await ctx.db.delete(task._id)
      }
      await ctx.db.insert('shiftTasks', {
        tenantId,
        shiftId,
        title: 'Upload shift documentation proof',
        requiredProof: true,
        status: 'pending',
      })

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

    const lifecycleShift = await findShift(`${fixtureDate}T09:00:00Z`)
    if (lifecycleShift) {
      await resetShift(lifecycleShift._id)
    }

    const geofenceShift = await findShift(`${fixtureDate}T14:00:00Z`)
    if (geofenceShift) {
      await resetShift(geofenceShift._id)
    }

    return {
      status: 'reset' as const,
      lifecycleShiftId: lifecycleShift?._id ?? null,
      geofenceShiftId: geofenceShift?._id ?? null,
    }
  },
})
