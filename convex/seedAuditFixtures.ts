import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'

// Full audit fixture seed for ATRIA-X QA.
// Run via:
//   npx convex run seedAuditFixtures:seedFullAuditOrg '{"clerkOrgId":"org_...","roleUsers":{"admin":{"clerkUserId":"user_...","email":"...","displayName":"..."},...}}'
//
// Idempotent: re-running skips existing records keyed by displayName, email,
// scheduledStart, caseNumber, invoiceNumber, etc.

const ROLE_USERS_DEFAULT: Record<
  string,
  { clerkUserId: string; email: string; displayName: string }
> = {
  platformAdmin: {
    clerkUserId: 'user_3HVipcnw6xgUlQT6lG6g2LvbmpZ',
    email: 'diego.molina.sieiro+platformadmin@gmail.com',
    displayName: 'Platform Admin',
  },
  admin: {
    clerkUserId: 'user_3GII04BD20mNIvU4G3JMITWpT8d',
    email: 'diego.molina.sieiro+admin05082601@gmail.com',
    displayName: 'QA Agency Admin',
  },
  hr: {
    clerkUserId: 'user_3GII06bjLVcbsYIR3BMwVGLfKoR',
    email: 'diego.molina.sieiro+hrqa1@gmail.com',
    displayName: 'QA HR',
  },
  coordinator: {
    clerkUserId: 'user_3GII007QJxPx91x6z2i8dAHf1Ha',
    email: 'diego.molina.sieiro+coordinator01@gmail.com',
    displayName: 'QA Coordinator',
  },
  caregiver: {
    clerkUserId: 'user_3DxeIizPy6cH9Qu2I1i8dAHf1Ha',
    email: 'diego.molina.sieiro+caregiver01@gmail.com',
    displayName: 'QA Caregiver One',
  },
  caregiver2: {
    clerkUserId: 'user_3Dxclk1PlQdeRuZAR6ZOnNVPheu',
    email: 'diego.molina.sieiro+caregiver@gmail.com',
    displayName: 'QA Caregiver Two',
  },
  candidate: {
    clerkUserId: 'user_3HVpJ9abcdefgh1234567890',
    email: 'phase2-candidate@atriax.example.com',
    displayName: 'QA Candidate',
  },
}

function genEmbedding(text: string): number[] {
  const DIM = 32
  const vector = Array.from({ length: DIM }, () => 0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  tokens.forEach((token, index) => {
    let hash = 2166136261
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const slot = Math.abs(hash + index) % DIM
    const sign = hash % 2 === 0 ? 1 : -1
    vector[slot] += sign * (1 + token.length / 12)
  })
  const mag = Math.sqrt(vector.reduce((s, v) => s + v ** 2, 0))
  return mag === 0 ? vector : vector.map((v) => Number((v / mag).toFixed(6)))
}

function isoDate(d: Date) {
  return d.toISOString()
}

function dateOnly(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

export const seedFullAuditOrg = internalMutation({
  args: {
    clerkOrgId: v.string(),
    roleUsers: v.optional(
      v.record(
        v.string(),
        v.object({
          clerkUserId: v.string(),
          email: v.string(),
          displayName: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date()
    const nowIso = isoDate(now)
    const today = dateOnly(now)
    const yesterday = dateOnly(addDays(now, -1))
    const lastWeek = dateOnly(addDays(now, -7))
    const lastMonth = dateOnly(addDays(now, -30))
    const nextWeek = dateOnly(addDays(now, 7))
    const nextMonth = dateOnly(addDays(now, 30))
    const lastYear = dateOnly(addDays(now, -365))

    const results: string[] = []

    const roleUsers = { ...ROLE_USERS_DEFAULT, ...(args.roleUsers ?? {}) }

    // -------------------------------------------------------------------------
    // 1. Tenant
    // -------------------------------------------------------------------------
    let tenantId: Id<'tenants'>
    const existingTenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .first()
    if (existingTenant) {
      tenantId = existingTenant._id
      results.push(`Tenant found: ${existingTenant.name}`)
    } else {
      tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: args.clerkOrgId,
        name: 'ATRIA-X Audit QA Agency',
        slug: `audit-qa-${args.clerkOrgId.slice(-8)}`,
        ein: '12-3456789',
        address: '750 N Capitol Ave, Ste A3, San Jose, CA 95133',
        allowedEmailDomains: [],
        createdAt: nowIso,
      })
      results.push(`Tenant created: ${tenantId}`)
    }

    // -------------------------------------------------------------------------
    // 2. Tenant settings
    // -------------------------------------------------------------------------
    const existingSettings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    if (!existingSettings) {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
      })
      results.push('Tenant settings created')
    }

    // -------------------------------------------------------------------------
    // 3. Agency branches
    // -------------------------------------------------------------------------
    const existingBranches = await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingBranches.length === 0) {
      await ctx.db.insert('agencyBranches', {
        tenantId,
        branchType: 'SLS',
        label: 'Supported Living Services',
        isPredefined: true,
        order: 0,
        active: true,
      })
      await ctx.db.insert('agencyBranches', {
        tenantId,
        branchType: 'ILS',
        label: 'Independent Living Services',
        isPredefined: true,
        order: 1,
        active: true,
      })
      results.push('Agency branches created')
    }

    // -------------------------------------------------------------------------
    // 4. Products + agency products
    // -------------------------------------------------------------------------
    const existingProducts = await ctx.db.query('products').take(1)
    if (existingProducts.length === 0) {
      await ctx.db.insert('products', {
        key: 'scheduling',
        label: 'Shift Scheduling',
        description: 'Shift scheduling and time tracking',
        active: true,
      })
      await ctx.db.insert('products', {
        key: 'hr',
        label: 'HR & Onboarding',
        description: 'Candidate onboarding and HR management',
        active: true,
      })
      await ctx.db.insert('products', {
        key: 'compliance',
        label: 'Compliance',
        description: 'Document compliance and credential tracking',
        active: true,
      })
      await ctx.db.insert('products', {
        key: 'billing',
        label: 'Billing',
        description: 'Agency billing and payroll export',
        active: true,
      })
      results.push('Products created')
    }

    const existingAgencyProducts = await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingAgencyProducts.length === 0) {
      for (const key of ['scheduling', 'hr', 'compliance', 'billing']) {
        await ctx.db.insert('agencyProducts', {
          tenantId,
          productKey: key,
          active: true,
        })
      }
      results.push('Agency products subscribed')
    }

    // -------------------------------------------------------------------------
    // 5. Pricing plans + subscription
    // -------------------------------------------------------------------------
    const plans = [
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
    for (const plan of plans) {
      const existing = await ctx.db
        .query('pricingPlans')
        .withIndex('by_key', (q) => q.eq('key', plan.key))
        .first()
      if (!existing) {
        await ctx.db.insert('pricingPlans', plan)
      }
    }

    const existingSub = await ctx.db
      .query('tenantSubscriptions')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    if (!existingSub) {
      await ctx.db.insert('tenantSubscriptions', {
        tenantId,
        planKey: 'professional',
        status: 'active',
        billingEmails: [roleUsers.admin?.email ?? 'admin@atriax.test'],
        currentPeriodStart: lastMonth,
        currentPeriodEnd: nextMonth,
        renewsAt: nextMonth,
        createdAt: lastMonth,
        updatedAt: nowIso,
      })
      results.push('Tenant subscription created')
    }

    // -------------------------------------------------------------------------
    // 6. Platform invoices
    // -------------------------------------------------------------------------
    const existingInv = await ctx.db
      .query('platformInvoices')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingInv.length === 0) {
      await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'INV-2024-001',
        periodStart: lastMonth,
        periodEnd: today,
        dueDate: nextWeek,
        lineItems: [
          {
            description: 'Professional Plan - Monthly Base',
            quantity: 1,
            unitPrice: 499,
            amount: 499,
            source: 'auto',
          },
          {
            description: 'Additional Seats (3 @ $18)',
            quantity: 3,
            unitPrice: 18,
            amount: 54,
            source: 'auto',
          },
        ],
        subtotal: 553,
        total: 553,
        status: 'sent',
        sentTo: [roleUsers.admin?.email ?? 'admin@atriax.test'],
        sentAt: `${lastWeek}T10:00:00Z`,
        createdBy: 'system',
        createdAt: `${lastWeek}T10:00:00Z`,
        updatedAt: `${lastWeek}T10:00:00Z`,
      })
      await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'INV-2024-002',
        periodStart: today,
        periodEnd: nextMonth,
        dueDate: dateOnly(addDays(now, 14)),
        lineItems: [
          {
            description: 'Professional Plan - Monthly Base',
            quantity: 1,
            unitPrice: 499,
            amount: 499,
            source: 'auto',
          },
        ],
        subtotal: 499,
        total: 499,
        status: 'draft',
        createdBy: 'system',
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      await ctx.db.insert('platformInvoices', {
        tenantId,
        invoiceNumber: 'INV-2024-000',
        periodStart: dateOnly(addDays(now, -60)),
        periodEnd: lastMonth,
        dueDate: lastMonth,
        lineItems: [
          {
            description: 'Professional Plan - Monthly Base',
            quantity: 1,
            unitPrice: 499,
            amount: 499,
            source: 'auto',
          },
          {
            description: 'Additional Seats (2 @ $18)',
            quantity: 2,
            unitPrice: 18,
            amount: 36,
            source: 'auto',
          },
        ],
        subtotal: 535,
        total: 535,
        status: 'paid',
        sentTo: [roleUsers.admin?.email ?? 'admin@atriax.test'],
        sentAt: isoDate(addDays(now, -55)),
        paidAt: isoDate(addDays(now, -50)),
        paymentMethod: 'card',
        createdBy: 'system',
        createdAt: isoDate(addDays(now, -55)),
        updatedAt: isoDate(addDays(now, -50)),
      })
      results.push('Platform invoices created')
    }

    // -------------------------------------------------------------------------
    // 7. Platform admin record
    // -------------------------------------------------------------------------
    const platformAdminUserId = roleUsers.platformAdmin?.clerkUserId
    if (platformAdminUserId) {
      const existingPA = await ctx.db
        .query('platformAdmins')
        .withIndex('by_clerk_user_id', (q) =>
          q.eq('clerkUserId', platformAdminUserId),
        )
        .first()
      if (!existingPA) {
        await ctx.db.insert('platformAdmins', {
          clerkUserId: platformAdminUserId,
          createdAt: nowIso,
        })
        results.push('Platform admin record created')
      }
    }

    // -------------------------------------------------------------------------
    // 8. Tenant members + employee profiles for test roles
    // -------------------------------------------------------------------------
    const roleToAtriaRole: Record<string, string> = {
      admin: 'org:admin',
      hr: 'org:hr',
      coordinator: 'org:coordinator',
      caregiver: 'org:caregiver',
      caregiver2: 'org:caregiver',
      candidate: 'org:candidate',
    }

    for (const [roleKey, user] of Object.entries(roleUsers)) {
      if (roleKey === 'platformAdmin') continue
      const atriaRole = roleToAtriaRole[roleKey]
      if (!atriaRole) continue

      const tenant = await ctx.db.get(tenantId)
      if (!tenant) continue

      const existingMember = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', user.clerkUserId),
        )
        .unique()
      if (existingMember) {
        await ctx.db.patch(existingMember._id, {
          role: atriaRole as
            | 'org:admin'
            | 'org:coordinator'
            | 'org:caregiver'
            | 'org:hr'
            | 'org:candidate',
          displayName: user.displayName,
          email: user.email,
        })
      } else {
        await ctx.db.insert('tenantMembers', {
          tenantId,
          clerkUserId: user.clerkUserId,
          role: atriaRole as
            | 'org:admin'
            | 'org:coordinator'
            | 'org:caregiver'
            | 'org:hr'
            | 'org:candidate',
          displayName: user.displayName,
          email: user.email,
        })
      }

      // Employee profiles for caregivers so compliance gaps work
      if (atriaRole === 'org:caregiver') {
        const existingProfile = await ctx.db
          .query('employeeProfiles')
          .withIndex('by_tenant_clerk_user', (q) =>
            q.eq('tenantId', tenantId).eq('clerkUserId', user.clerkUserId),
          )
          .unique()
        if (!existingProfile) {
          await ctx.db.insert('employeeProfiles', {
            tenantId,
            clerkUserId: user.clerkUserId,
            displayName: user.displayName,
            email: user.email,
            adpSyncStatus: 'synced',
            createdAt: nowIso,
          })
        }
      }
    }
    results.push('Tenant members + employee profiles upserted')

    // -------------------------------------------------------------------------
    // 9. Clients
    // -------------------------------------------------------------------------
    const findClient = async (displayName: string) => {
      const all = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((c) => c.displayName === displayName) ?? null
    }

    let client1Id: Id<'clients'>
    const client1 = await findClient('Alex Rivera')
    if (!client1) {
      client1Id = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Alex Rivera',
        serviceType: 'SLS',
        authorizationHours: 40,
        riskFlags: ['mobility'],
        serviceAddress: {
          line1: '123 Main St',
          city: 'San Jose',
          state: 'CA',
          postalCode: '95112',
        },
        uci: 'UC-12345',
        dob: '1985-03-15',
        regionalCenter: 'San Andreas Regional Center',
        serviceCoordinatorName: 'Maria Garcia',
        serviceCoordinatorEmail: 'maria.garcia@regionalcenter.example',
        vendorNumber: 'VN-001',
        serviceCode: '896',
      })
      results.push('Client 1 created: Alex Rivera')
    } else {
      client1Id = client1._id
    }

    let client2Id: Id<'clients'>
    const client2 = await findClient('Jordan Chen')
    if (!client2) {
      client2Id = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jordan Chen',
        serviceType: 'ILS',
        authorizationHours: 30,
        riskFlags: [],
        serviceAddress: {
          line1: '456 Oak Ave',
          city: 'San Jose',
          state: 'CA',
          postalCode: '95110',
        },
        uci: 'UC-67890',
        dob: '1990-07-22',
        regionalCenter: 'San Andreas Regional Center',
        serviceCoordinatorName: 'David Lee',
        serviceCoordinatorEmail: 'david.lee@regionalcenter.example',
        vendorNumber: 'VN-002',
        serviceCode: '520',
      })
      results.push('Client 2 created: Jordan Chen')
    } else {
      client2Id = client2._id
    }

    let client3Id: Id<'clients'>
    const client3 = await findClient('Sam Patel')
    if (!client3) {
      client3Id = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Sam Patel',
        serviceType: 'SLS',
        authorizationHours: 35,
        riskFlags: ['behavioral'],
        serviceAddress: {
          line1: '789 Elm Dr',
          city: 'Santa Clara',
          state: 'CA',
          postalCode: '95050',
        },
        uci: 'UC-11111',
        dob: '1988-11-03',
        regionalCenter: 'San Andreas Regional Center',
        serviceCoordinatorName: 'Sarah Johnson',
        serviceCoordinatorEmail: 'sarah.johnson@regionalcenter.example',
        vendorNumber: 'VN-003',
        serviceCode: '896',
      })
      results.push('Client 3 created: Sam Patel')
    } else {
      client3Id = client3._id
    }

    // -------------------------------------------------------------------------
    // 10. Client objectives
    // -------------------------------------------------------------------------
    const findObjective = async (clientId: Id<'clients'>, title: string) => {
      const all = await ctx.db
        .query('clientObjectives')
        .withIndex('by_tenant_client', (q) =>
          q.eq('tenantId', tenantId).eq('clientId', clientId),
        )
        .collect()
      return all.find((o) => o.title === title) ?? null
    }

    async function ensureObjective(
      clientId: Id<'clients'>,
      title: string,
      status: 'active' | 'achieved' | 'discontinued',
    ) {
      const existing = await findObjective(clientId, title)
      if (existing) return existing._id
      return ctx.db.insert('clientObjectives', {
        tenantId,
        clientId,
        title,
        description: `${title} objective`,
        source: 'ipp',
        targetDate: nextMonth,
        hoursPerMonth: 10,
        status,
        createdAt: nowIso,
      })
    }

    const objective1 = await ensureObjective(client1Id, 'Community integration', 'active')
    const objective2 = await ensureObjective(client2Id, 'Independent meal planning', 'active')
    await ensureObjective(client2Id, 'Budgeting skills', 'achieved')
    results.push('Client objectives ready')

    // -------------------------------------------------------------------------
    // 11. Shifts + child records
    // -------------------------------------------------------------------------
    const caregiver1Id = roleUsers.caregiver?.clerkUserId ?? 'cg-demo-1'
    const caregiver2Id = roleUsers.caregiver2?.clerkUserId ?? 'cg-demo-2'
    const adminId = roleUsers.admin?.clerkUserId ?? 'admin-demo'

    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    async function ensureShift(
      config: {
        clientId: Id<'clients'>
        caregiverId: string
        scheduledStart: string
        scheduledEnd: string
        status:
          | 'scheduled'
          | 'in_progress'
          | 'submitted'
          | 'needs_correction'
          | 'approved'
          | 'billing_ready'
        serviceType: 'SLS' | 'ILS'
        rate: number
        clockInAt?: string
        clockOutAt?: string
      },
      children: {
        note?: {
          startTime: string
          endTime: string
          servicesProvided: string
          clientResponse: string
          narrative: string
          objectiveId?: Id<'clientObjectives'>
        }
        tasks?: Array<{
          title: string
          requiredProof: boolean
          status: 'pending' | 'complete'
          proofName?: string
          objectiveId?: Id<'clientObjectives'>
        }>
        review?: {
          reviewerId: string
          decision: 'approved' | 'correction_requested'
          comment: string
          createdAt: string
        }
        billing?: {
          hours: number
          rate: number
          amount: number
          createdAt: string
          blockedReason?: string
          blockedAt?: string
        }
        punches?: Array<{ type: 'clock_in' | 'clock_out'; at: string }>
      },
    ) {
      let shiftId: Id<'shifts'>
      const existing = await findShift(config.scheduledStart)
      if (!existing) {
        shiftId = await ctx.db.insert('shifts', {
          tenantId,
          clientId: config.clientId,
          caregiverId: config.caregiverId,
          scheduledStart: config.scheduledStart,
          scheduledEnd: config.scheduledEnd,
          clockInAt: config.clockInAt,
          clockOutAt: config.clockOutAt,
          status: config.status,
          serviceType: config.serviceType,
          rate: config.rate,
        })
      } else {
        shiftId = existing._id
        await ctx.db.patch(shiftId, {
          status: config.status,
          clockInAt: config.clockInAt,
          clockOutAt: config.clockOutAt,
        })
      }

      if (children.note) {
        const existingNote = await ctx.db
          .query('progressNotes')
          .withIndex('by_tenant_shift', (q) =>
            q.eq('tenantId', tenantId).eq('shiftId', shiftId),
          )
          .unique()
        if (!existingNote) {
          await ctx.db.insert('progressNotes', {
            tenantId,
            shiftId,
            startTime: children.note.startTime,
            endTime: children.note.endTime,
            servicesProvided: children.note.servicesProvided,
            clientResponse: children.note.clientResponse,
            narrative: children.note.narrative,
            objectiveId: children.note.objectiveId,
            submittedBy: config.caregiverId,
            submittedAt: config.scheduledEnd,
          })
        }
      }

      if (children.tasks) {
        const existingTasks = await ctx.db
          .query('shiftTasks')
          .withIndex('by_tenant_shift', (q) =>
            q.eq('tenantId', tenantId).eq('shiftId', shiftId),
          )
          .collect()
        const existingTitles = new Set(existingTasks.map((t) => t.title))
        for (const task of children.tasks) {
          if (!existingTitles.has(task.title)) {
            await ctx.db.insert('shiftTasks', {
              tenantId,
              shiftId,
              title: task.title,
              requiredProof: task.requiredProof,
              status: task.status,
              proofName: task.proofName,
              objectiveId: task.objectiveId,
            })
          }
        }
      }

      if (children.review) {
        const existingReviews = await ctx.db
          .query('reviewEvents')
          .withIndex('by_tenant_shift', (q) =>
            q.eq('tenantId', tenantId).eq('shiftId', shiftId),
          )
          .collect()
        if (existingReviews.length === 0) {
          await ctx.db.insert('reviewEvents', {
            tenantId,
            shiftId,
            reviewerId: children.review.reviewerId,
            decision: children.review.decision,
            comment: children.review.comment,
            createdAt: children.review.createdAt,
          })
        }
      }

      if (children.billing) {
        const existingBilling = await ctx.db
          .query('billingLines')
          .withIndex('by_tenant_shift', (q) =>
            q.eq('tenantId', tenantId).eq('shiftId', shiftId),
          )
          .collect()
        if (existingBilling.length === 0) {
          await ctx.db.insert('billingLines', {
            tenantId,
            shiftId,
            hours: children.billing.hours,
            rate: children.billing.rate,
            amount: children.billing.amount,
            createdAt: children.billing.createdAt,
            blockedReason: children.billing.blockedReason,
            blockedAt: children.billing.blockedAt,
          })
        }
      }

      if (children.punches) {
        const existingPunches = await ctx.db
          .query('timePunches')
          .withIndex('by_tenant_shift', (q) =>
            q.eq('tenantId', tenantId).eq('shiftId', shiftId),
          )
          .collect()
        const existingTypes = new Set(existingPunches.map((p) => p.punchType))
        for (const punch of children.punches) {
          if (!existingTypes.has(punch.type)) {
            await ctx.db.insert('timePunches', {
              tenantId,
              shiftId,
              caregiverId: config.caregiverId,
              punchType: punch.type,
              at: punch.at,
              source: 'atriax',
              adpSyncStatus: 'synced',
              createdAt: punch.at,
            })
          }
        }
      }

      return shiftId
    }

    // Shift 1: scheduled today
    await ensureShift(
      {
        clientId: client1Id,
        caregiverId: caregiver1Id,
        scheduledStart: `${today}T09:00:00Z`,
        scheduledEnd: `${today}T13:00:00Z`,
        status: 'scheduled',
        serviceType: 'SLS',
        rate: 28.5,
      },
      {
        note: {
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        },
        tasks: [
          {
            title: 'Medication support observed',
            requiredProof: true,
            status: 'pending',
          },
          {
            title: 'Community access activity',
            requiredProof: false,
            status: 'pending',
            objectiveId: objective1,
          },
        ],
      },
    )

    // Shift 2: in_progress today
    await ensureShift(
      {
        clientId: client2Id,
        caregiverId: caregiver2Id,
        scheduledStart: `${today}T14:00:00Z`,
        scheduledEnd: `${today}T18:00:00Z`,
        status: 'in_progress',
        serviceType: 'ILS',
        rate: 32,
        clockInAt: `${today}T14:05:00Z`,
      },
      {
        tasks: [
          {
            title: 'ILS coaching session',
            requiredProof: false,
            status: 'pending',
            objectiveId: objective2,
          },
          {
            title: 'Meal planning documentation',
            requiredProof: true,
            status: 'pending',
          },
        ],
        punches: [{ type: 'clock_in', at: `${today}T14:05:00Z` }],
      },
    )

    // Shift 3: submitted yesterday
    const shift3Id = await ensureShift(
      {
        clientId: client1Id,
        caregiverId: caregiver1Id,
        scheduledStart: `${yesterday}T08:00:00Z`,
        scheduledEnd: `${yesterday}T12:00:00Z`,
        status: 'submitted',
        serviceType: 'SLS',
        rate: 28.5,
        clockInAt: `${yesterday}T08:03:00Z`,
        clockOutAt: `${yesterday}T12:01:00Z`,
      },
      {
        note: {
          startTime: '08:00',
          endTime: '12:00',
          servicesProvided: 'Community integration, medication reminders',
          clientResponse: 'Engaged well with group activity.',
          narrative: 'Supported client through morning routine and community outing.',
        },
        tasks: [
          {
            title: 'Medication support observed',
            requiredProof: true,
            status: 'complete',
            proofName: 'med_log.jpg',
          },
          {
            title: 'Community access activity',
            requiredProof: false,
            status: 'complete',
          },
        ],
        punches: [
          { type: 'clock_in', at: `${yesterday}T08:03:00Z` },
          { type: 'clock_out', at: `${yesterday}T12:01:00Z` },
        ],
      },
    )

    // Shift 4: billing_ready yesterday
    const shift4Id = await ensureShift(
      {
        clientId: client2Id,
        caregiverId: caregiver2Id,
        scheduledStart: `${yesterday}T09:00:00Z`,
        scheduledEnd: `${yesterday}T13:00:00Z`,
        status: 'billing_ready',
        serviceType: 'ILS',
        rate: 32,
        clockInAt: `${yesterday}T09:02:00Z`,
        clockOutAt: `${yesterday}T13:05:00Z`,
      },
      {
        note: {
          startTime: '09:00',
          endTime: '13:00',
          servicesProvided: 'ILS coaching, budgeting practice',
          clientResponse: 'Practiced meal planning independently.',
          narrative: 'Client showed improvement in independent living skills.',
          objectiveId: objective2,
        },
        tasks: [
          {
            title: 'ILS coaching session',
            requiredProof: false,
            status: 'complete',
            objectiveId: objective2,
          },
          {
            title: 'Budgeting worksheet',
            requiredProof: true,
            status: 'complete',
            proofName: 'budget_sheet.pdf',
          },
        ],
        review: {
          reviewerId: adminId,
          decision: 'approved',
          comment: 'Documentation complete and accurate.',
          createdAt: `${yesterday}T14:00:00Z`,
        },
        billing: {
          hours: 4,
          rate: 32,
          amount: 128,
          createdAt: `${yesterday}T14:00:00Z`,
        },
        punches: [
          { type: 'clock_in', at: `${yesterday}T09:02:00Z` },
          { type: 'clock_out', at: `${yesterday}T13:05:00Z` },
        ],
      },
    )

    // Shift 5: approved yesterday (no billing line yet — invoice creation flow)
    const shift5Id = await ensureShift(
      {
        clientId: client3Id,
        caregiverId: caregiver1Id,
        scheduledStart: `${yesterday}T10:00:00Z`,
        scheduledEnd: `${yesterday}T14:00:00Z`,
        status: 'approved',
        serviceType: 'SLS',
        rate: 28.5,
        clockInAt: `${yesterday}T10:05:00Z`,
        clockOutAt: `${yesterday}T14:02:00Z`,
      },
      {
        note: {
          startTime: '10:00',
          endTime: '14:00',
          servicesProvided: 'Behavioral support, community access',
          clientResponse: 'Calm and engaged throughout shift.',
          narrative: 'Provided 1:1 behavioral support during community outing.',
        },
        tasks: [
          {
            title: 'Behavioral support documentation',
            requiredProof: true,
            status: 'complete',
            proofName: 'behavior_note.pdf',
          },
        ],
        review: {
          reviewerId: adminId,
          decision: 'approved',
          comment: 'Approved for billing.',
          createdAt: `${yesterday}T15:00:00Z`,
        },
        punches: [
          { type: 'clock_in', at: `${yesterday}T10:05:00Z` },
          { type: 'clock_out', at: `${yesterday}T14:02:00Z` },
        ],
      },
    )

    // Shift 6: needs_correction yesterday
    const shift6Id = await ensureShift(
      {
        clientId: client1Id,
        caregiverId: caregiver2Id,
        scheduledStart: `${yesterday}T15:00:00Z`,
        scheduledEnd: `${yesterday}T19:00:00Z`,
        status: 'needs_correction',
        serviceType: 'SLS',
        rate: 28.5,
      },
      {
        note: {
          startTime: '15:00',
          endTime: '19:00',
          servicesProvided: '',
          clientResponse: '',
          narrative: 'Incomplete documentation.',
        },
        tasks: [
          {
            title: 'Medication support observed',
            requiredProof: true,
            status: 'pending',
          },
        ],
        review: {
          reviewerId: adminId,
          decision: 'correction_requested',
          comment: 'Missing medication proof and client response.',
          createdAt: `${yesterday}T20:00:00Z`,
        },
      },
    )

    // Shift 7: blocked billing line
    await ensureShift(
      {
        clientId: client2Id,
        caregiverId: caregiver1Id,
        scheduledStart: `${lastWeek}T09:00:00Z`,
        scheduledEnd: `${lastWeek}T13:00:00Z`,
        status: 'billing_ready',
        serviceType: 'ILS',
        rate: 32,
        clockInAt: `${lastWeek}T09:00:00Z`,
        clockOutAt: `${lastWeek}T13:00:00Z`,
      },
      {
        note: {
          startTime: '09:00',
          endTime: '13:00',
          servicesProvided: 'ILS coaching',
          clientResponse: 'Participated well.',
          narrative: 'Completed budgeting worksheet and reviewed goals.',
        },
        tasks: [
          {
            title: 'ILS coaching session',
            requiredProof: false,
            status: 'complete',
          },
        ],
        review: {
          reviewerId: adminId,
          decision: 'approved',
          comment: 'Approved.',
          createdAt: `${lastWeek}T14:00:00Z`,
        },
        billing: {
          hours: 4,
          rate: 32,
          amount: 128,
          createdAt: `${lastWeek}T14:00:00Z`,
          blockedReason: 'Missing authorization on file',
          blockedAt: `${lastWeek}T15:00:00Z`,
        },
        punches: [
          { type: 'clock_in', at: `${lastWeek}T09:00:00Z` },
          { type: 'clock_out', at: `${lastWeek}T13:00:00Z` },
        ],
      },
    )

    results.push('Shifts + child records ready')

    // -------------------------------------------------------------------------
    // 12. Compliance docs
    // -------------------------------------------------------------------------
    const findDoc = async (title: string) => {
      const all = await ctx.db
        .query('complianceDocs')
        .withIndex('by_tenant_category', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((d) => d.title === title) ?? null
    }

    if (!(await findDoc('SLS Documentation Requirements'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'SLS Documentation Requirements',
        body: 'All SLS shifts require progress notes with start/end times, services provided, and client response. Proof of medication support must be attached when applicable.',
        category: 'documentation',
        visibility: 'all_staff',
        embedding: genEmbedding(
          'SLS Documentation Requirements progress notes medication support proof',
        ),
      })
    }
    if (!(await findDoc('ILS Billing Guidelines'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'ILS Billing Guidelines',
        body: 'ILS services are billed at the authorized rate per hour. Documentation must show measurable skill acquisition.',
        category: 'billing',
        visibility: 'all_staff',
        embedding: genEmbedding(
          'ILS Billing Guidelines authorized rate per hour skill acquisition',
        ),
      })
    }
    if (!(await findDoc('Caregiver Credential Policy'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'Caregiver Credential Policy',
        body: 'All caregivers must maintain current CPR/First Aid certification and TB test results. Expired credentials block shift assignment.',
        category: 'credentialing',
        visibility: 'admins_coordinators',
        embedding: genEmbedding(
          'Caregiver Credential Policy CPR First Aid TB test certification expired',
        ),
      })
    }
    results.push('Compliance docs ready')

    // -------------------------------------------------------------------------
    // 13. Credential requirements
    // -------------------------------------------------------------------------
    const existingReqs = await ctx.db
      .query('credentialRequirements')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()
    if (existingReqs.length === 0) {
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'cpr_cert',
        label: 'CPR certificate',
        isRequired: true,
        expiryMonths: 24,
      })
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'first_aid',
        label: 'First Aid certificate',
        isRequired: true,
        expiryMonths: 24,
      })
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'tb_test',
        label: 'TB test',
        isRequired: true,
        expiryMonths: 12,
      })
      await ctx.db.insert('credentialRequirements', {
        tenantId,
        role: 'org:caregiver',
        category: 'background_check',
        label: 'Background check',
        isRequired: true,
      })
      results.push('Credential requirements created')
    }

    // -------------------------------------------------------------------------
    // 14. Document archive items
    // -------------------------------------------------------------------------
    const findDocItem = async (category: string, subjectId: string) => {
      const all = await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_subject', (q) =>
          q
            .eq('tenantId', tenantId)
            .eq('subjectType', 'employee')
            .eq('subjectId', subjectId),
        )
        .collect()
      return all.find((d) => d.category === category) ?? null
    }

    const insertFile = async (name: string) => {
      return ctx.db.insert('files', {
        tenantId,
        storageId: 'seed-' + Math.random().toString(36).slice(2),
        uploadedBy: adminId,
        fileName: name,
        contentType: 'application/pdf',
        size: 1024,
        linkedType: 'complianceDoc',
        linkedId: 'seed',
        visibility: 'admins_coordinators',
        createdAt: nowIso,
      })
    }

    // Get employee profile IDs for caregivers
    const caregiverProfiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const cg1Profile = caregiverProfiles.find(
      (p) => p.clerkUserId === caregiver1Id,
    )
    const cg2Profile = caregiverProfiles.find(
      (p) => p.clerkUserId === caregiver2Id,
    )

    const cg1SubjectId = cg1Profile?._id ?? caregiver1Id
    const cg2SubjectId = cg2Profile?._id ?? caregiver2Id

    // CG1: verified CPR
    if (!(await findDocItem('cpr_cert', cg1SubjectId))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId: await insertFile('cpr_cert.pdf'),
        subjectType: 'employee',
        subjectId: cg1SubjectId,
        category: 'cpr_cert',
        status: 'verified',
        expiresAt: isoDate(addDays(now, 120)),
        createdAt: nowIso,
        verifiedBy: adminId,
        verifiedAt: nowIso,
      })
    }
    // CG1: expiring soon TB
    if (!(await findDocItem('tb_test', cg1SubjectId))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId: await insertFile('tb_test.pdf'),
        subjectType: 'employee',
        subjectId: cg1SubjectId,
        category: 'tb_test',
        status: 'verified',
        expiresAt: isoDate(addDays(now, 15)),
        createdAt: nowIso,
        verifiedBy: adminId,
        verifiedAt: nowIso,
      })
    }
    // CG2: expired First Aid
    if (!(await findDocItem('first_aid', cg2SubjectId))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId: await insertFile('first_aid.pdf'),
        subjectType: 'employee',
        subjectId: cg2SubjectId,
        category: 'first_aid',
        status: 'verified',
        expiresAt: isoDate(addDays(now, -10)),
        createdAt: nowIso,
        verifiedBy: adminId,
        verifiedAt: isoDate(addDays(now, -20)),
      })
    }
    // CG2: rejected background check
    if (!(await findDocItem('background_check', cg2SubjectId))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId: await insertFile('background_check.pdf'),
        subjectType: 'employee',
        subjectId: cg2SubjectId,
        category: 'background_check',
        status: 'rejected',
        rejectionReason: 'Document illegible - please re-upload clear scan',
        createdAt: nowIso,
      })
    }
    // CG1: overridden credential
    if (!(await findDocItem('live_scan', cg1SubjectId))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId: await insertFile('live_scan.pdf'),
        subjectType: 'employee',
        subjectId: cg1SubjectId,
        category: 'live_scan',
        status: 'verified',
        expiresAt: isoDate(addDays(now, -5)),
        createdAt: nowIso,
        overrideStatus: 'overridden',
        overrideReason: 'Pending DOJ response; manager approved temporary override.',
        overrideBy: adminId,
        overrideAt: nowIso,
      })
    }
    results.push('Document archive items ready')

    // -------------------------------------------------------------------------
    // 15. Background checks
    // -------------------------------------------------------------------------
    const candidateUser = roleUsers.candidate
    const existingCandidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenantId).eq('email', candidateUser?.email ?? ''),
      )
      .unique()
    let candidateId: Id<'candidates'> | undefined
    if (!existingCandidate) {
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUser?.clerkUserId,
        email: candidateUser?.email ?? 'phase2-candidate@atriax.example.com',
        displayName: candidateUser?.displayName ?? 'QA Candidate',
        status: 'applied',
        createdAt: nowIso,
      })
    } else {
      candidateId = existingCandidate._id
    }

    if (candidateId) {
      const existingChecks = await ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      if (existingChecks.length === 0) {
        await ctx.db.insert('backgroundChecks', {
          tenantId,
          candidateId,
          provider: 'mock',
          status: 'clear',
          package: 'basic',
          initiatedAt: isoDate(addDays(now, -10)),
          completedAt: isoDate(addDays(now, -8)),
          officialResultStorageId: 'seed-clear-bg',
          officialResultUploadedAt: isoDate(addDays(now, -8)),
          officialResultUploadedBy: adminId,
        })
        await ctx.db.insert('backgroundChecks', {
          tenantId,
          candidateId,
          provider: 'mock',
          status: 'pending',
          package: 'standard',
          initiatedAt: isoDate(addDays(now, -2)),
        })
        await ctx.db.insert('backgroundChecks', {
          tenantId,
          candidateId,
          provider: 'mock',
          status: 'consider',
          package: 'premium',
          initiatedAt: isoDate(addDays(now, -15)),
          completedAt: isoDate(addDays(now, -12)),
        })
        results.push('Background checks created')
      }
    }

    // -------------------------------------------------------------------------
    // 16. Training completions
    // -------------------------------------------------------------------------
    const existingTraining = await ctx.db
      .query('platformTrainingCompletions')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', caregiver1Id),
      )
      .collect()
    if (existingTraining.length === 0) {
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: caregiver1Id,
        trainingId: 'platform_training',
        completedAt: isoDate(addDays(now, -30)),
        status: 'completed',
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId,
        clerkUserId: caregiver2Id,
        trainingId: 'platform_training',
        completedAt: isoDate(addDays(now, -400)),
        status: 'completed',
        expiresAt: isoDate(addDays(now, -35)),
      })
      results.push('Training completions created')
    }

    // -------------------------------------------------------------------------
    // 17. Special Incident Reports
    // -------------------------------------------------------------------------
    const existingIncidents = await ctx.db
      .query('specialIncidents')
      .withIndex('by_tenant_created', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingIncidents.length === 0) {
      // On-time verbal + written
      await ctx.db.insert('specialIncidents', {
        tenantId,
        clientId: client1Id,
        category: 'medication_error',
        occurredAt: `${lastWeek}T10:00:00Z`,
        learnedAt: `${lastWeek}T10:30:00Z`,
        location: 'Client home',
        description: 'Client missed a scheduled medication dose.',
        treatmentProvided: 'Monitoring provided, no adverse effects.',
        actionsTaken: 'Caregiver notified nurse; dose rescheduled.',
        agenciesNotified: ['aps'],
        verbalReportedAt: `${lastWeek}T11:00:00Z`,
        writtenSubmittedAt: `${lastWeek}T12:00:00Z`,
        status: 'closed',
        createdBy: adminId,
        createdAt: `${lastWeek}T10:30:00Z`,
      })
      // Pending written (verbal on time)
      await ctx.db.insert('specialIncidents', {
        tenantId,
        clientId: client2Id,
        category: 'serious_injury',
        occurredAt: `${yesterday}T09:00:00Z`,
        learnedAt: `${yesterday}T09:15:00Z`,
        location: 'Community center',
        description: 'Client fell while transferring to a chair.',
        treatmentProvided: 'No injuries observed.',
        actionsTaken: 'Incident documented, family notified.',
        agenciesNotified: [],
        verbalReportedAt: `${yesterday}T10:00:00Z`,
        status: 'verbal_reported',
        createdBy: adminId,
        createdAt: `${yesterday}T09:15:00Z`,
      })
      // Breached verbal
      await ctx.db.insert('specialIncidents', {
        tenantId,
        clientId: client3Id,
        category: 'suspected_abuse',
        occurredAt: `${lastWeek}T08:00:00Z`,
        learnedAt: `${lastWeek}T08:00:00Z`,
        location: 'Group home',
        description: 'Observed unexplained bruising.',
        treatmentProvided: 'Photographs taken, client assessed.',
        actionsTaken: 'Reported to APS.',
        agenciesNotified: ['aps', 'law_enforcement'],
        status: 'draft',
        createdBy: adminId,
        createdAt: `${lastWeek}T08:00:00Z`,
      })
      results.push('Special incident reports created')
    }

    // -------------------------------------------------------------------------
    // 18. Agency obligations
    // -------------------------------------------------------------------------
    const existingObligations = await ctx.db
      .query('agencyObligations')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .collect()
    if (existingObligations.length === 0) {
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'insurance_general_liability',
        label: 'General liability insurance certificate',
        cadenceMonths: 12,
        dueAt: isoDate(addDays(now, 60)),
        createdAt: nowIso,
      })
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'insurance_workers_comp',
        label: "Workers' compensation insurance certificate",
        cadenceMonths: 12,
        dueAt: isoDate(addDays(now, 45)),
        createdAt: nowIso,
      })
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'ds1891_disclosure',
        label: 'DS 1891 applicant/vendor disclosure statement',
        cadenceMonths: 24,
        dueAt: isoDate(addDays(now, 300)),
        createdAt: nowIso,
      })
      await ctx.db.insert('agencyObligations', {
        tenantId,
        key: 'cpa_audit_or_review',
        label: 'CPA audit or review',
        cadenceMonths: 12,
        dueAt: isoDate(addDays(now, -15)),
        createdAt: isoDate(addDays(now, -380)),
      })
      results.push('Agency obligations created')
    }

    // -------------------------------------------------------------------------
    // 19. Progress reports
    // -------------------------------------------------------------------------
    const existingReports = await ctx.db
      .query('progressReports')
      .withIndex('by_tenant_client_period', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingReports.length === 0) {
      await ctx.db.insert('progressReports', {
        tenantId,
        clientId: client1Id,
        periodType: 'quarterly',
        periodStart: lastMonth,
        periodEnd: today,
        entries: [
          {
            objectiveId: objective1,
            objectiveTitle: 'Community integration',
            servicesSummary: 'Community outings twice weekly.',
            progressSummary: 'Increased independence in public settings.',
            barriers: 'Transportation delays.',
            planForward: 'Continue weekly outings.',
            hoursDelivered: 20,
          },
        ],
        status: 'submitted',
        generatedBy: adminId,
        submittedTo: 'Maria Garcia',
        submittedAt: `${today}T09:00:00Z`,
        createdAt: `${today}T09:00:00Z`,
      })
      await ctx.db.insert('progressReports', {
        tenantId,
        clientId: client2Id,
        periodType: 'semiannual',
        periodStart: lastMonth,
        periodEnd: today,
        entries: [
          {
            objectiveId: objective2,
            objectiveTitle: 'Independent meal planning',
            servicesSummary: 'Meal planning and grocery shopping.',
            progressSummary: 'Client plans a full week independently.',
            barriers: 'Budgeting remains challenging.',
            planForward: 'Add budgeting module.',
            hoursDelivered: 24,
          },
        ],
        status: 'draft',
        generatedBy: adminId,
        createdAt: `${today}T09:00:00Z`,
      })
      await ctx.db.insert('progressReports', {
        tenantId,
        clientId: client3Id,
        periodType: 'quarterly',
        periodStart: lastYear,
        periodEnd: lastMonth,
        entries: [
          {
            objectiveId: objective1,
            objectiveTitle: 'Behavioral self-regulation',
            servicesSummary: 'Behavioral support sessions.',
            progressSummary: 'Improved coping strategies.',
            barriers: 'None noted.',
            planForward: 'Maintain current supports.',
            hoursDelivered: 30,
          },
        ],
        status: 'submitted',
        generatedBy: adminId,
        submittedTo: 'Sarah Johnson',
        submittedAt: `${lastMonth}T09:00:00Z`,
        createdAt: `${lastMonth}T09:00:00Z`,
      })
      results.push('Progress reports created')
    }

    // -------------------------------------------------------------------------
    // 20. Grievances
    // -------------------------------------------------------------------------
    const existingGrievances = await ctx.db
      .query('grievances')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingGrievances.length === 0) {
      await ctx.db.insert('grievances', {
        tenantId,
        clientId: client1Id,
        filedAt: `${lastWeek}T10:00:00Z`,
        filedBy: 'Authorized representative',
        description: 'Concern about schedule changes.',
        status: 'open',
        createdAt: `${lastWeek}T10:00:00Z`,
      })
      await ctx.db.insert('grievances', {
        tenantId,
        clientId: client2Id,
        filedAt: `${lastMonth}T10:00:00Z`,
        filedBy: 'Client',
        description: 'Request for additional community hours.',
        status: 'resolved',
        resolutionNote: 'Approved additional Saturday hours.',
        proposedAt: `${lastMonth}T12:00:00Z`,
        resolvedAt: `${lastWeek}T09:00:00Z`,
        createdAt: `${lastMonth}T10:00:00Z`,
      })
      results.push('Grievances created')
    }

    // -------------------------------------------------------------------------
    // 21. Corrective actions
    // -------------------------------------------------------------------------
    const existingCorrective = await ctx.db
      .query('correctiveActions')
      .withIndex('by_tenant_due', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingCorrective.length === 0) {
      await ctx.db.insert('correctiveActions', {
        tenantId,
        source: 'internal',
        finding: 'Documentation completeness below 95% for two consecutive weeks.',
        dueAt: isoDate(addDays(now, 15)),
        status: 'open',
        createdAt: nowIso,
      })
      await ctx.db.insert('correctiveActions', {
        tenantId,
        source: 'regional_center',
        finding: 'Missing signed service coordinator communication logs.',
        dueAt: isoDate(addDays(now, -5)),
        status: 'submitted',
        createdAt: isoDate(addDays(now, -35)),
      })
      results.push('Corrective actions created')
    }

    // -------------------------------------------------------------------------
    // 22. HR cases
    // -------------------------------------------------------------------------
    const existingCases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingCases.length === 0) {
      await ctx.db.insert('hrCases', {
        tenantId,
        caseNumber: 'CASE-001',
        subjectType: 'compliance',
        subjectId: cg2SubjectId,
        category: 'expired_credential',
        title: 'Expired First Aid Certification',
        status: 'open',
        description:
          'Caregiver First Aid certification expired. Shift assignment blocked until renewed.',
        flagType: 'expired_credential',
        autoCreatedAt: `${yesterday}T08:00:00Z`,
        createdAt: `${yesterday}T08:05:00Z`,
      })
      await ctx.db.insert('hrCases', {
        tenantId,
        caseNumber: 'CASE-002',
        subjectType: 'compliance',
        subjectId: cg1SubjectId,
        category: 'expiring_credential',
        title: 'TB Test Expiring Soon',
        status: 'open',
        description: 'TB test expires in 15 days. Action needed to renew.',
        flagType: 'expiring_credential',
        autoCreatedAt: `${yesterday}T09:00:00Z`,
        createdAt: `${yesterday}T09:05:00Z`,
      })
      results.push('HR cases created')
    }

    // -------------------------------------------------------------------------
    // 23. Escalations
    // -------------------------------------------------------------------------
    const existingEsc = await ctx.db
      .query('escalations')
      .withIndex('by_tenant_level', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingEsc.length === 0) {
      await ctx.db.insert('escalations', {
        tenantId,
        subjectType: 'document',
        subjectId: 'first_aid',
        escalationLevel: 1,
        escalatedTo: adminId,
        reason:
          'First Aid certification expired 10 days ago. Shift assignment blocked.',
        createdAt: `${yesterday}T08:00:00Z`,
      })
      await ctx.db.insert('escalations', {
        tenantId,
        subjectType: 'document',
        subjectId: 'tb_test',
        escalationLevel: 2,
        escalatedTo: adminId,
        reason:
          'TB test expiring in 15 days. Level 2 escalation after no action on level 1.',
        createdAt: `${yesterday}T09:00:00Z`,
      })
      results.push('Escalations created')
    }

    // -------------------------------------------------------------------------
    // 24. Pay periods
    // -------------------------------------------------------------------------
    const existingPP = await ctx.db
      .query('payPeriods')
      .withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingPP.length === 0) {
      await ctx.db.insert('payPeriods', {
        tenantId,
        startDate: lastWeek,
        endDate: yesterday,
        status: 'open',
      })
      await ctx.db.insert('payPeriods', {
        tenantId,
        startDate: lastMonth,
        endDate: lastWeek,
        status: 'exported',
        exportedAt: `${lastWeek}T17:00:00Z`,
        exportedBy: adminId,
      })
      results.push('Pay periods created')
    }

    // -------------------------------------------------------------------------
    // 25. Notifications
    // -------------------------------------------------------------------------
    const existingNotifs = await ctx.db
      .query('notifications')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', adminId),
      )
      .take(1)
    if (existingNotifs.length === 0) {
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: adminId,
        type: 'compliance_alert',
        message:
          'Caregiver First Aid certification has expired. Shift assignment blocked.',
        metadata: { subjectId: cg2SubjectId, category: 'first_aid' },
        read: false,
        createdAt: `${yesterday}T08:00:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: adminId,
        type: 'compliance_warning',
        message:
          'TB test for caregiver expires in 15 days. Please renew before expiration.',
        metadata: { subjectId: cg1SubjectId, category: 'tb_test' },
        read: false,
        createdAt: `${yesterday}T09:00:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: adminId,
        type: 'shift_submitted',
        message: 'Shift submitted by caregiver for review.',
        metadata: { shiftId: shift3Id },
        read: true,
        createdAt: `${yesterday}T12:30:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId,
        clerkUserId: adminId,
        type: 'billing_ready',
        message: 'Shift approved and ready for billing export.',
        metadata: { shiftId: shift4Id },
        read: true,
        createdAt: `${yesterday}T14:00:00Z`,
      })
      if (roleUsers.hr?.clerkUserId) {
        await ctx.db.insert('notifications', {
          tenantId,
          clerkUserId: roleUsers.hr.clerkUserId,
          type: 'candidate_application',
          message: 'New candidate application submitted and pending review.',
          metadata: { candidateEmail: candidateUser?.email },
          read: false,
          createdAt: `${lastWeek}T09:30:00Z`,
        })
        await ctx.db.insert('notifications', {
          tenantId,
          clerkUserId: roleUsers.hr.clerkUserId,
          type: 'document_rejected',
          message:
            'Background check document rejected. Candidate needs to re-upload.',
          metadata: { subjectId: cg2SubjectId, category: 'background_check' },
          read: false,
          createdAt: `${yesterday}T10:00:00Z`,
        })
      }
      results.push('Notifications created')
    }

    // -------------------------------------------------------------------------
    // 26. Audit events
    // -------------------------------------------------------------------------
    const existingAudit = await ctx.db
      .query('auditEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .take(1)
    if (existingAudit.length === 0) {
      const auditEntries = [
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'shift_approved',
          kind: 'shift_review',
          shiftId: shift4Id,
          previousStatus: 'submitted',
          nextStatus: 'billing_ready',
          createdAt: `${yesterday}T14:00:00Z`,
        },
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'shift_approved',
          kind: 'shift_review',
          shiftId: shift5Id,
          previousStatus: 'submitted',
          nextStatus: 'approved',
          createdAt: `${yesterday}T15:30:00Z`,
        },
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'shift_correction_requested',
          kind: 'shift_review',
          shiftId: shift6Id,
          previousStatus: 'submitted',
          nextStatus: 'needs_correction',
          createdAt: `${yesterday}T20:00:00Z`,
        },
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'compliance_override_applied',
          kind: 'compliance',
          metadata: {
            reason: 'Document pending verification from provider',
            shiftId: shift3Id,
          },
          createdAt: `${yesterday}T10:00:00Z`,
        },
        {
          actorId: roleUsers.hr?.clerkUserId ?? adminId,
          actorRole: 'org:hr',
          action: 'candidate_invited',
          kind: 'candidate',
          metadata: { email: candidateUser?.email },
          createdAt: `${lastWeek}T09:00:00Z`,
        },
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'billing_exported',
          kind: 'billing',
          metadata: { lineCount: 4, totalAmount: 512 },
          createdAt: `${lastWeek}T16:00:00Z`,
        },
        {
          actorId: adminId,
          actorRole: 'org:admin',
          action: 'agency_settings_updated',
          kind: 'settings',
          metadata: { field: 'shiftGeofence', value: 'enabled' },
          createdAt: `${lastMonth}T11:00:00Z`,
        },
      ]
      for (const a of auditEntries) {
        await ctx.db.insert('auditEvents', {
          tenantId,
          actorId: a.actorId,
          actorRole: a.actorRole,
          action: a.action,
          kind: a.kind,
          shiftId: (a as { shiftId?: Id<'shifts'> }).shiftId,
          previousStatus: (a as { previousStatus?: string }).previousStatus,
          nextStatus: (a as { nextStatus?: string }).nextStatus,
          metadata: a.metadata,
          createdAt: a.createdAt,
        })
      }
      results.push('Audit events created')
    }

    return { tenantId, results }
  },
})
