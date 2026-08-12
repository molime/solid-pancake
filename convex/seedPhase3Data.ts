// Temporary Phase 3 seed script — run via:
//   npx convex run seedPhase3Data:seed '{\"clerkOrgId\":\"org_3GII008i2F6bzk1HbgkY8qODZad\"}'
// Then remove this file.
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

function genEmbedding(text: string): number[] {
  const DIM = 32
  const vector = Array.from({ length: DIM }, () => 0)
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
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

export const seed = internalMutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date()
    const nowIso = now.toISOString()
    const today = nowIso.split('T')[0]
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const lastWeek = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const lastMonth = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const nextMonth = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]

    const results: string[] = []

    // 1. Find or create tenant
    let tenantId: Id<'tenants'>
    const existingTenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .first()

    if (existingTenant) {
      tenantId = existingTenant._id
      results.push(`Tenant found: ${existingTenant.name} (${tenantId})`)
    } else {
      tenantId = await ctx.db.insert('tenants', {
        clerkOrgId: args.clerkOrgId,
        name: 'ATRIA-X QA Agency',
        slug: 'atriax-qa',
        createdAt: nowIso,
      })
      results.push(`Tenant created: ${tenantId}`)
    }

    // 2. Upsert tenant settings
    const existingSettings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    if (!existingSettings) {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: {
          enabled: true,
          enforceClockIn: true,
          enforceClockOut: true,
          defaultRadiusMeters: 200,
          maxAccuracyMeters: 100,
        },
      })
      results.push('Tenant settings created')
    }

    // 3. Upsert clients
    const findClient = async (name: string) => {
      const all = await ctx.db.query('clients').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).collect()
      return all.find((c) => c.displayName === name) ?? null
    }

    const client1 = await findClient('Alex Rivera')
    const client1Id = client1?._id ?? await ctx.db.insert('clients', {
      tenantId, displayName: 'Alex Rivera', serviceType: 'SLS', authorizationHours: 40, riskFlags: ['mobility'],
      serviceAddress: { line1: '123 Main St', city: 'San Jose', state: 'CA', postalCode: '95112' },
    })

    const client2 = await findClient('Jordan Chen')
    const client2Id = client2?._id ?? await ctx.db.insert('clients', {
      tenantId, displayName: 'Jordan Chen', serviceType: 'ILS', authorizationHours: 30, riskFlags: [],
      serviceAddress: { line1: '456 Oak Ave', city: 'San Jose', state: 'CA', postalCode: '95110' },
    })

    const client3 = await findClient('Sam Patel')
    if (!client3) await ctx.db.insert('clients', {
      tenantId, displayName: 'Sam Patel', serviceType: 'SLS', authorizationHours: 35, riskFlags: ['behavioral'],
      serviceAddress: { line1: '789 Elm Dr', city: 'Santa Clara', state: 'CA', postalCode: '95050' },
    })

    results.push(`Clients ready: Alex Rivera, Jordan Chen, Sam Patel`)

    // 4. Upsert shifts with various statuses
    const cg1 = 'user_3DxeIizPy6cH9Qu2I1i8dAHf1Ha' // caregiver01
    const cg2 = 'user_3Dxclk1PlQdeRuZAR6ZOnNVPheu' // caregiver
    const adminId = 'user_3GII04BD20mNIvU4G3JMITWpT8d' // qa-admin
    const hrId = 'user_3GII06bjLVcbsYIR3BMwVGLfKoR' // qa-hr

    const findShift = async (start: string) => {
      const all = await ctx.db.query('shifts').withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId)).collect()
      return all.find((s) => s.scheduledStart === start) ?? null
    }

    // Shift 1: scheduled today
    const s1Start = `${today}T09:00:00Z`
    const s1 = await findShift(s1Start)
    if (!s1) {
      await ctx.db.insert('shifts', {
        tenantId, clientId: client1Id, caregiverId: cg1,
        scheduledStart: s1Start, scheduledEnd: `${today}T13:00:00Z`,
        status: 'scheduled', serviceType: 'SLS', rate: 28.5,
      })
      results.push('Shift 1 created: scheduled today')
    } else {
      results.push('Shift 1 already exists')
    }

    // Shift 2: in_progress today
    const s2Start = `${today}T14:00:00Z`
    const s2 = await findShift(s2Start)
    if (!s2) {
      await ctx.db.insert('shifts', {
        tenantId, clientId: client2Id, caregiverId: cg2,
        scheduledStart: s2Start, scheduledEnd: `${today}T18:00:00Z`,
        clockInAt: `${today}T14:05:00Z`,
        status: 'in_progress', serviceType: 'ILS', rate: 32.0,
      })
      results.push('Shift 2 created: in_progress today')
    } else {
      results.push('Shift 2 already exists')
    }

    // Shift 3: submitted yesterday
    const s3Start = `${yesterday}T08:00:00Z`
    let shift3Id: Id<'shifts'>
    const s3 = await findShift(s3Start)
    if (!s3) {
      shift3Id = await ctx.db.insert('shifts', {
        tenantId, clientId: client1Id, caregiverId: cg1,
        scheduledStart: s3Start, scheduledEnd: `${yesterday}T12:00:00Z`,
        clockInAt: `${yesterday}T08:03:00Z`, clockOutAt: `${yesterday}T12:01:00Z`,
        status: 'submitted', serviceType: 'SLS', rate: 28.5,
      })
      results.push('Shift 3 created: submitted yesterday')
    } else {
      shift3Id = s3._id
      results.push('Shift 3 already exists')
    }

    // Shift 4: billing_ready yesterday (approved)
    const s4Start = `${yesterday}T09:00:00Z`
    let shift4Id: Id<'shifts'>
    const s4 = await findShift(s4Start)
    if (!s4) {
      shift4Id = await ctx.db.insert('shifts', {
        tenantId, clientId: client2Id, caregiverId: cg2,
        scheduledStart: s4Start, scheduledEnd: `${yesterday}T13:00:00Z`,
        clockInAt: `${yesterday}T09:02:00Z`, clockOutAt: `${yesterday}T13:05:00Z`,
        status: 'billing_ready', serviceType: 'ILS', rate: 32.0,
      })
      results.push('Shift 4 created: billing_ready yesterday')
    } else {
      shift4Id = s4._id
      results.push('Shift 4 already exists')
    }

    // Billing lines for shift 4 and shift 3 (approved shifts -> billing_ready)
    const existingBL4 = await ctx.db.query('billingLines').withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shift4Id)).collect()
    if (existingBL4.length === 0) {
      await ctx.db.insert('billingLines', {
        tenantId, shiftId: shift4Id, hours: 4, rate: 32.0, amount: 128.0, createdAt: nowIso,
      })
      results.push('Billing line created for shift 4')
    }

    // Also make shift 3 billing_ready and add a billing line for it
    const s3Doc = await ctx.db.get(shift3Id)
    if (s3Doc && s3Doc.status !== 'billing_ready') {
      await ctx.db.patch(shift3Id, { status: 'billing_ready' })
    }
    const existingBL3 = await ctx.db.query('billingLines').withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shift3Id)).collect()
    if (existingBL3.length === 0) {
      await ctx.db.insert('billingLines', {
        tenantId, shiftId: shift3Id, hours: 4, rate: 28.5, amount: 114.0, createdAt: nowIso,
      })
      results.push('Billing line created for shift 3')
    }

    // Add a review event for shift 3 (needs approval before billing)
    const existingRev3 = await ctx.db.query('reviewEvents').withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shift3Id)).collect()
    if (existingRev3.length === 0) {
      await ctx.db.insert('reviewEvents', {
        tenantId, shiftId: shift3Id, reviewerId: adminId,
        decision: 'approved', comment: 'All documentation complete.',
        createdAt: `${yesterday}T15:00:00Z`,
      })
      results.push('Review event created for shift 3')
    }

    // Review event for shift 4
    const existingRev = await ctx.db.query('reviewEvents').withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shift4Id)).collect()
    if (existingRev.length === 0) {
      await ctx.db.insert('reviewEvents', {
        tenantId, shiftId: shift4Id, reviewerId: adminId,
        decision: 'approved', comment: 'Documentation complete and accurate.',
        createdAt: `${yesterday}T14:00:00Z`,
      })
      results.push('Review event created for shift 4')
    }

    // Progress note for shift 3
    const existingNote3 = await ctx.db.query('progressNotes').withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shift3Id)).unique()
    if (!existingNote3) {
      await ctx.db.insert('progressNotes', {
        tenantId, shiftId: shift3Id, startTime: '08:00', endTime: '12:00',
        servicesProvided: 'Community integration, medication reminders',
        clientResponse: 'Engaged well with group activity.',
        narrative: 'Supported client through morning routine and community outing.',
        submittedBy: cg1, submittedAt: `${yesterday}T12:30:00Z`,
      })
      results.push('Progress note created for shift 3')
    }

    // 5. Compliance docs
    const findDoc = async (title: string) => {
      const all = await ctx.db.query('complianceDocs').withIndex('by_tenant_category', (q) => q.eq('tenantId', tenantId)).collect()
      return all.find((d) => d.title === title) ?? null
    }

    if (!(await findDoc('SLS Documentation Requirements'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId, title: 'SLS Documentation Requirements',
        body: 'All SLS shifts require progress notes with start/end times, services provided, and client response. Proof of medication support must be attached when applicable.',
        category: 'documentation', visibility: 'all_staff',
        embedding: genEmbedding('SLS Documentation Requirements progress notes medication support proof'),
      })
      results.push('Compliance doc 1 created')
    }

    if (!(await findDoc('ILS Billing Guidelines'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId, title: 'ILS Billing Guidelines',
        body: 'ILS services are billed at the authorized rate per hour. Documentation must show measurable skill acquisition.',
        category: 'billing', visibility: 'all_staff',
        embedding: genEmbedding('ILS Billing Guidelines authorized rate per hour skill acquisition'),
      })
      results.push('Compliance doc 2 created')
    }

    if (!(await findDoc('Caregiver Credential Policy'))) {
      await ctx.db.insert('complianceDocs', {
        tenantId, title: 'Caregiver Credential Policy',
        body: 'All caregivers must maintain current CPR/First Aid certification and TB test results. Expired credentials block shift assignment.',
        category: 'credentialing', visibility: 'admins_coordinators',
        embedding: genEmbedding('Caregiver Credential Policy CPR First Aid TB test certification expired'),
      })
      results.push('Compliance doc 3 created')
    }

    // 6. Document archive items (for compliance counts)
    const findDocItem = async (category: string, subjectId: string) => {
      const all = await ctx.db.query('documentArchiveItems').withIndex('by_tenant_subject', (q) => q.eq('tenantId', tenantId).eq('subjectType', 'employee').eq('subjectId', subjectId)).collect()
      return all.find((d) => d.category === category) ?? null
    }
    // Helper to create real file records for document archive items
    const insertFile = async (name: string) => {
      return await ctx.db.insert('files', {
        tenantId, storageId: 'seed-' + Math.random().toString(36).slice(2),
        uploadedBy: 'system', fileName: name,
        linkedType: 'complianceDoc', linkedId: 'seed',
        visibility: 'admins_coordinators', createdAt: nowIso,
      })
    }


    // Verified/compliant doc
    if (!(await findDocItem('cpr_cert', cg1))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId, fileId: await insertFile("cpr_cert.pdf"),
        subjectType: 'employee', subjectId: cg1,
        category: 'cpr_cert', status: 'verified',
        expiresAt: new Date(now.getTime() + 120 * 86400000).toISOString(),
        createdAt: nowIso,
      })
      results.push('Document archive: CPR cert verified (compliant)')
    }

    // Expiring soon doc
    if (!(await findDocItem('tb_test', cg1))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId, fileId: await insertFile("tb_test.pdf"),
        subjectType: 'employee', subjectId: cg1,
        category: 'tb_test', status: 'verified',
        expiresAt: new Date(now.getTime() + 15 * 86400000).toISOString(),
        createdAt: nowIso,
      })
      results.push('Document archive: TB test expiring soon')
    }

    // Expired doc
    if (!(await findDocItem('first_aid', cg2))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId, fileId: await insertFile("first_aid.pdf"),
        subjectType: 'employee', subjectId: cg2,
        category: 'first_aid', status: 'verified',
        expiresAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        createdAt: nowIso,
      })
      results.push('Document archive: First Aid expired')
    }

    // Rejected doc
    if (!(await findDocItem('background_check', cg2))) {
      await ctx.db.insert('documentArchiveItems', {
        tenantId, fileId: await insertFile("background_check.pdf"),
        subjectType: 'employee', subjectId: cg2,
        category: 'background_check', status: 'rejected',
        rejectionReason: 'Document illegible - please re-upload clear scan',
        createdAt: nowIso,
      })
      results.push('Document archive: Background check rejected')
    }

    // 7. Audit events
    const existingAudit = await ctx.db.query('auditEvents').withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId)).take(1)
    if (existingAudit.length === 0) {
      const auditEntries = [
        { actorId: adminId, actorRole: 'org:admin', action: 'shift_approved', kind: 'shift_review', shiftId: shift4Id, previousStatus: 'submitted', nextStatus: 'billing_ready', createdAt: `${yesterday}T14:00:00Z` },
        { actorId: adminId, actorRole: 'org:admin', action: 'compliance_override', kind: 'compliance', metadata: { reason: 'Document pending verification from provider', shiftId: shift3Id }, createdAt: `${yesterday}T10:00:00Z` },
        { actorId: hrId, actorRole: 'org:hr', action: 'candidate_invited', kind: 'candidate', metadata: { email: 'new.candidate@example.com' }, createdAt: `${lastWeek}T09:00:00Z` },
        { actorId: adminId, actorRole: 'org:admin', action: 'billing_exported', kind: 'billing', metadata: { lineCount: 4, totalAmount: 512.0 }, createdAt: `${lastWeek}T16:00:00Z` },
        { actorId: adminId, actorRole: 'org:admin', action: 'agency_settings_updated', kind: 'settings', metadata: { field: 'shiftGeofence', value: 'enabled' }, createdAt: `${lastMonth}T11:00:00Z` },
      ]
      for (const a of auditEntries) {
        await ctx.db.insert('auditEvents', { tenantId, ...a })
      }
      results.push(`5 audit events created`)
    } else {
      results.push('Audit events already exist')
    }

    // 8. Notifications
    const existingNotifs = await ctx.db.query('notifications').withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId).eq('clerkUserId', adminId)).take(1)
    if (existingNotifs.length === 0) {
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: adminId, type: 'compliance_alert',
        message: 'Caregiver First Aid certification has expired. Shift assignment blocked.',
        metadata: { subjectId: cg2, category: 'first_aid' },
        read: false, createdAt: `${yesterday}T08:00:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: adminId, type: 'compliance_warning',
        message: 'TB test for caregiver expires in 15 days. Please renew before expiration.',
        metadata: { subjectId: cg1, category: 'tb_test' },
        read: false, createdAt: `${yesterday}T09:00:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: adminId, type: 'shift_submitted',
        message: 'Shift submitted by caregiver for review.',
        metadata: { shiftId: shift3Id },
        read: true, createdAt: `${yesterday}T12:30:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: adminId, type: 'billing_ready',
        message: 'Shift approved and ready for billing export.',
        metadata: { shiftId: shift4Id },
        read: true, createdAt: `${yesterday}T14:00:00Z`,
      })

      // HR notifications
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: hrId, type: 'candidate_application',
        message: 'New candidate application submitted and pending review.',
        metadata: { candidateEmail: 'new.candidate@example.com' },
        read: false, createdAt: `${lastWeek}T09:30:00Z`,
      })
      await ctx.db.insert('notifications', {
        tenantId, clerkUserId: hrId, type: 'document_rejected',
        message: 'Background check document rejected. Candidate needs to re-upload.',
        metadata: { subjectId: cg2, category: 'background_check' },
        read: false, createdAt: `${yesterday}T10:00:00Z`,
      })

      results.push('6 notifications created (4 admin, 2 HR)')
    } else {
      results.push('Notifications already exist')
    }

    // 9. Escalations
    const existingEsc = await ctx.db.query('escalations').withIndex('by_tenant_level', (q) => q.eq('tenantId', tenantId).eq('escalationLevel', 1)).take(1)
    if (existingEsc.length === 0) {
      await ctx.db.insert('escalations', {
        tenantId, subjectType: 'document', subjectId: 'first_aid',
        escalationLevel: 1, escalatedTo: adminId,
        reason: 'First Aid certification expired 10 days ago. Shift assignment blocked.',
        createdAt: `${yesterday}T08:00:00Z`,
      })
      await ctx.db.insert('escalations', {
        tenantId, subjectType: 'document', subjectId: 'tb_test',
        escalationLevel: 2, escalatedTo: adminId,
        reason: 'TB test expiring in 15 days. Level 2 escalation after no action on level 1.',
        createdAt: `${yesterday}T09:00:00Z`,
      })
      results.push('2 escalations created')
    } else {
      results.push('Escalations already exist')
    }

    // 10. HR Cases
    const existingCases = await ctx.db.query('hrCases').withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId).eq('status', 'open')).take(1)
    if (existingCases.length === 0) {
      await ctx.db.insert('hrCases', {
        tenantId, caseNumber: 'CASE-001',
        subjectType: 'compliance', subjectId: cg2,
        category: 'expired_credential', title: 'Expired First Aid Certification',
        status: 'open', ownerMemberId: undefined,
        description: 'Caregiver First Aid certification expired. Shift assignment blocked until renewed.',
        flagType: 'expired_credential', autoCreatedAt: `${yesterday}T08:00:00Z`,
        createdAt: `${yesterday}T08:05:00Z`,
      })
      await ctx.db.insert('hrCases', {
        tenantId, caseNumber: 'CASE-002',
        subjectType: 'compliance', subjectId: cg1,
        category: 'expiring_credential', title: 'TB Test Expiring Soon',
        status: 'open', ownerMemberId: undefined,
        description: 'TB test expires in 15 days. Action needed to renew.',
        flagType: 'expiring_credential', autoCreatedAt: `${yesterday}T09:00:00Z`,
        createdAt: `${yesterday}T09:05:00Z`,
      })
      results.push('2 HR cases created')
    } else {
      results.push('HR cases already exist')
    }

    // 11. Employee profiles (for HR employees page)
    const existingEmp = await ctx.db.query('employeeProfiles').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).take(1)
    if (existingEmp.length === 0) {
      await ctx.db.insert('employeeProfiles', {
        tenantId, clerkUserId: cg1, displayName: 'Caregiver One',
        email: 'diego.molina.sieiro+caregiver01@gmail.com',
        adpSyncStatus: 'synced', createdAt: nowIso,
      })
      await ctx.db.insert('employeeProfiles', {
        tenantId, clerkUserId: cg2, displayName: 'Caregiver Two',
        email: 'diego.molina.sieiro+caregiver@gmail.com',
        adpSyncStatus: 'pending_credentials', createdAt: nowIso,
      })
      results.push('2 employee profiles created')
    } else {
      results.push('Employee profiles already exist')
    }

    // 12. Pay periods
    const existingPP = await ctx.db.query('payPeriods').withIndex('by_tenant_status', (q) => q.eq('tenantId', tenantId).eq('status', 'open')).take(1)
    if (existingPP.length === 0) {
      await ctx.db.insert('payPeriods', {
        tenantId, startDate: lastWeek, endDate: yesterday,
        status: 'open',
      })
      await ctx.db.insert('payPeriods', {
        tenantId, startDate: lastMonth, endDate: lastWeek,
        status: 'exported', exportedAt: `${lastWeek}T17:00:00Z`, exportedBy: adminId,
      })
      results.push('2 pay periods created')
    } else {
      results.push('Pay periods already exist')
    }

    // === PLATFORM-LEVEL DATA ===

    // 13. Pricing plans
    const plans = [
      { key: 'starter', label: 'Starter', basePrice: 199, includedSeats: 10, perSeatPrice: 20, active: true },
      { key: 'professional', label: 'Professional', basePrice: 499, includedSeats: 25, perSeatPrice: 18, active: true },
      { key: 'enterprise', label: 'Enterprise', basePrice: 999, includedSeats: 50, perSeatPrice: 15, active: true },
    ]
    for (const plan of plans) {
      const existing = await ctx.db.query('pricingPlans').withIndex('by_key', (q) => q.eq('key', plan.key)).first()
      if (!existing) {
        await ctx.db.insert('pricingPlans', plan)
      }
    }
    results.push('Pricing plans ready')

    // 14. Tenant subscription
    const existingSub = await ctx.db.query('tenantSubscriptions').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).first()
    if (!existingSub) {
      await ctx.db.insert('tenantSubscriptions', {
        tenantId, planKey: 'professional', status: 'active',
        billingEmails: ['hello+qa-admin@atriaxsolutions.com'],
        currentPeriodStart: lastMonth, currentPeriodEnd: nextMonth,
        renewsAt: nextMonth,
        createdAt: lastMonth, updatedAt: nowIso,
      })
      results.push('Tenant subscription created (Professional plan)')
    } else {
      results.push('Tenant subscription already exists')
    }

    // 15. Platform invoices (various statuses)
    const existingInv = await ctx.db.query('platformInvoices').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).take(1)
    if (existingInv.length === 0) {
      await ctx.db.insert('platformInvoices', {
        tenantId, invoiceNumber: 'INV-2024-001',
        periodStart: lastMonth, periodEnd: today, dueDate: nextWeek,
        lineItems: [
          { description: 'Professional Plan - Monthly Base', quantity: 1, unitPrice: 499, amount: 499, source: 'auto' },
          { description: 'Additional Seats (3 @ $18)', quantity: 3, unitPrice: 18, amount: 54, source: 'auto' },
        ],
        subtotal: 553, total: 553, status: 'sent',
        sentTo: ['hello+qa-admin@atriaxsolutions.com'],
        sentAt: `${lastWeek}T10:00:00Z`,
        createdBy: 'system', createdAt: `${lastWeek}T10:00:00Z`, updatedAt: `${lastWeek}T10:00:00Z`,
      })
      results.push(`Platform invoice 1 created: INV-2024-001 (sent, $553)`)

      await ctx.db.insert('platformInvoices', {
        tenantId, invoiceNumber: 'INV-2024-002',
        periodStart: today, periodEnd: nextMonth, dueDate: new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0],
        lineItems: [
          { description: 'Professional Plan - Monthly Base', quantity: 1, unitPrice: 499, amount: 499, source: 'auto' },
        ],
        subtotal: 499, total: 499, status: 'draft',
        createdBy: 'system', createdAt: nowIso, updatedAt: nowIso,
      })
      results.push('Platform invoice 2 created: INV-2024-002 (draft, $499)')

      await ctx.db.insert('platformInvoices', {
        tenantId, invoiceNumber: 'INV-2024-000',
        periodStart: new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0], periodEnd: lastMonth,
        dueDate: lastMonth,
        lineItems: [
          { description: 'Professional Plan - Monthly Base', quantity: 1, unitPrice: 499, amount: 499, source: 'auto' },
          { description: 'Additional Seats (2 @ $18)', quantity: 2, unitPrice: 18, amount: 36, source: 'auto' },
        ],
        subtotal: 535, total: 535, status: 'paid',
        sentTo: ['hello+qa-admin@atriaxsolutions.com'],
        sentAt: new Date(now.getTime() - 55 * 86400000).toISOString(),
        paidAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
        paymentMethod: 'card',
        createdBy: 'system', createdAt: new Date(now.getTime() - 55 * 86400000).toISOString(), updatedAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
      })
      results.push('Platform invoice 3 created: INV-2024-000 (paid, $535)')
    } else {
      results.push('Platform invoices already exist')
    }

    // 16. Platform admin record
    const platformAdminUserId = 'user_3HVipcnw6xgUlQT6lG6g2LvbmpZ' // diego+platformadmin
    const existingPA = await ctx.db.query('platformAdmins').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', platformAdminUserId)).first()
    if (!existingPA) {
      await ctx.db.insert('platformAdmins', {
        clerkUserId: platformAdminUserId, createdAt: nowIso,
      })
      results.push('Platform admin record created')
    } else {
      results.push('Platform admin already exists')
    }

    // 17. Agency branches
    const existingBranches = await ctx.db.query('agencyBranches').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).take(1)
    if (existingBranches.length === 0) {
      await ctx.db.insert('agencyBranches', { tenantId, branchType: 'SLS', label: 'Supported Living Services', isPredefined: true, order: 0, active: true })
      await ctx.db.insert('agencyBranches', { tenantId, branchType: 'ILS', label: 'Independent Living Services', isPredefined: true, order: 1, active: true })
      results.push('Agency branches created')
    }

    // 18. Products + agency products
    const existingProducts = await ctx.db.query('products').take(1)
    if (existingProducts.length === 0) {
      await ctx.db.insert('products', { key: 'scheduling', label: 'Shift Scheduling', description: 'Shift scheduling and time tracking', active: true })
      await ctx.db.insert('products', { key: 'hr', label: 'HR & Onboarding', description: 'Candidate onboarding and HR management', active: true })
      await ctx.db.insert('products', { key: 'compliance', label: 'Compliance', description: 'Document compliance and credential tracking', active: true })
      await ctx.db.insert('products', { key: 'billing', label: 'Billing', description: 'Agency billing and payroll export', active: true })
      results.push('Products created')
    }

    const existingAgencyProducts = await ctx.db.query('agencyProducts').withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).take(1)
    if (existingAgencyProducts.length === 0) {
      await ctx.db.insert('agencyProducts', { tenantId, productKey: 'scheduling', active: true })
      await ctx.db.insert('agencyProducts', { tenantId, productKey: 'hr', active: true })
      await ctx.db.insert('agencyProducts', { tenantId, productKey: 'compliance', active: true })
      await ctx.db.insert('agencyProducts', { tenantId, productKey: 'billing', active: true })
      results.push('Agency products subscribed')
    }

    return { results, tenantId }
  },
})