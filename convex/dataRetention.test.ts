import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

const DAY_MS = 24 * 60 * 60 * 1000

function createTestConvex() {
  return convexTest({ schema, modules })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

async function seedTenant(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Retention Agency',
      slug: `slug-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    return tenantId
  })
}

/** Offboarded caregiver member + linked employee profile + candidate/application/draft. */
async function seedOffboardedEmployee(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
  offboardedAt: string,
) {
  return t.run(async (ctx) => {
    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId,
      role: 'org:caregiver',
      displayName: 'Gone Caregiver',
      email: `${clerkUserId}@example.com`,
    })
    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId,
      clerkUserId,
      tenantMemberId: memberId,
      displayName: 'Gone Caregiver',
      email: `${clerkUserId}@example.com`,
      adpSyncStatus: 'synced',
      offboardedAt,
      createdAt: new Date(Date.now() - 7 * 365 * DAY_MS).toISOString(),
    })
    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      clerkUserId,
      email: `${clerkUserId}@example.com`,
      displayName: 'Gone Caregiver',
      status: 'hired',
      createdAt: new Date().toISOString(),
    })
    const applicationId = await ctx.db.insert('applications', {
      tenantId,
      candidateId,
      status: 'approved',
      fields: {
        personal: { firstName: 'Gone', lastName: 'Caregiver', ssn: '123-45-6789' },
        i9: { ssn: '123-45-6789', citizenshipStatus: 'citizen' },
        w4: { ssn: '123-45-6789', filingStatus: 'single' },
      },
    })
    const draftId = await ctx.db.insert('drafts', {
      tenantId,
      candidateId,
      formType: 'application',
      data: {
        personal: { firstName: 'Gone', ssn: '123-45-6789' },
        w4: { ssn: '123-45-6789' },
      },
      updatedAt: new Date().toISOString(),
    })
    return { memberId, profileId, candidateId, applicationId, draftId }
  })
}

async function seedFile(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  uploadedBy: string,
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('files', {
      tenantId,
      storageId: `storage-${uploadedBy}`,
      uploadedBy,
      fileName: 'proof.pdf',
      contentType: 'application/pdf',
      size: 1024,
      linkedType: 'shiftTask',
      linkedId: 'task-test',
      visibility: 'all_staff',
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedArchiveItem(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
  overrides: {
    subjectType?: string
    subjectId?: string
    retentionUntil?: string
    legalHold?: boolean
  } = {},
) {
  return t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      tenantId,
      storageId: `storage-archive-${Math.random().toString(36).slice(2)}`,
      uploadedBy: 'user_admin',
      fileName: 'credential.pdf',
      contentType: 'application/pdf',
      size: 2048,
      linkedType: 'complianceDoc',
      linkedId: 'doc-test',
      visibility: 'admins_coordinators',
      createdAt: new Date().toISOString(),
    })
    const itemId = await ctx.db.insert('documentArchiveItems', {
      tenantId,
      fileId,
      subjectType: overrides.subjectType ?? 'employee',
      subjectId: overrides.subjectId ?? 'employee-test',
      category: 'license',
      status: 'active',
      retentionUntil: overrides.retentionUntil,
      legalHold: overrides.legalHold,
      createdAt: new Date().toISOString(),
    })
    return { fileId, itemId }
  })
}

async function listDeletionEvents(
  t: ReturnType<typeof createTestConvex>,
  tenantId: Id<'tenants'>,
) {
  return t.run(async (ctx) => {
    return ctx.db
      .query('deletionEvents')
      .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
      .collect()
  })
}

describe('purgeOffboardedEmployee', () => {
  it('removes files and archive items, redacts SSN in applications and drafts, and writes deletionEvents', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_purge_basic', 'user_admin_purge_basic')
    const { profileId, applicationId, draftId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_purge_basic',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    await seedFile(t, tenantId, 'user_cg_purge_basic')
    await seedArchiveItem(t, tenantId, {
      subjectType: 'employee',
      subjectId: profileId as string,
    })

    const result = await t.mutation(
      internal.dataRetention.purgeOffboardedEmployee,
      {
        employeeProfileId: profileId,
        tenantId,
        actorId: 'user_admin_purge_basic',
      },
    )

    expect(result).toEqual({
      documentsPurged: 1,
      filesDeleted: 1,
      applicationsRedacted: 1,
      draftsRedacted: 1,
      legalHoldSkipped: 0,
    })

    // Files and archive rows are gone (storage objects deleted best-effort).
    const remaining = await t.run(async (ctx) => {
      const files = await ctx.db.query('files').collect()
      const items = await ctx.db.query('documentArchiveItems').collect()
      const application = await ctx.db.get(applicationId)
      const draft = await ctx.db.get(draftId)
      return { files, items, application, draft }
    })
    expect(remaining.files).toHaveLength(0)
    expect(remaining.items).toHaveLength(0)

    // SSN redacted, names kept for the legal record.
    const fields = remaining.application?.fields as Record<
      string,
      Record<string, unknown>
    >
    expect(fields.personal?.ssn).toBeNull()
    expect(fields.i9?.ssn).toBeNull()
    expect(fields.w4?.ssn).toBeNull()
    expect(fields.personal?.firstName).toBe('Gone')
    const draftData = remaining.draft?.data as Record<
      string,
      Record<string, unknown>
    >
    expect(draftData.personal?.ssn).toBeNull()
    expect(draftData.personal?.firstName).toBe('Gone')

    // The visible track.
    const events = await listDeletionEvents(t, tenantId)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      tenantId,
      actorId: 'user_admin_purge_basic',
      subjectType: 'offboarded_employee',
      subjectId: profileId as string,
      legalBasis: '17 CCR 54326 five-year retention',
      status: 'executed',
    })
    expect(events[0]?.executedAt).toBeDefined()
    expect(events[0]?.detail).toContain('1 archived document(s)')
    expect(events[0]?.detail).toContain('1 uploaded file(s)')
  })

  it('skips archive items under legal hold and records the skip', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_purge_hold', 'user_admin_purge_hold')
    const { profileId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_purge_hold',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    // Held item (by profile id) and a purgeable item (by clerk user id) —
    // both reference the same employee through the two supported id forms.
    const { itemId: heldItemId } = await seedArchiveItem(t, tenantId, {
      subjectType: 'employee',
      subjectId: profileId as string,
      legalHold: true,
    })
    await seedArchiveItem(t, tenantId, {
      subjectType: 'employee',
      subjectId: 'user_cg_purge_hold',
    })

    const result = await t.mutation(
      internal.dataRetention.purgeOffboardedEmployee,
      { employeeProfileId: profileId, tenantId, actorId: 'system' },
    )

    expect(result.legalHoldSkipped).toBe(1)
    expect(result.documentsPurged).toBe(1)

    const after = await t.run(async (ctx) => {
      const held = await ctx.db.get(heldItemId)
      const heldFile = held ? await ctx.db.get(held.fileId) : null
      return { held, heldFile }
    })
    expect(after.held).toBeDefined()
    expect(after.held?.legalHold).toBe(true)
    expect(after.heldFile).toBeDefined()

    const events = await listDeletionEvents(t, tenantId)
    const skip = events.find((e) => e.status === 'skipped_legal_hold')
    expect(skip).toBeDefined()
    expect(skip?.subjectType).toBe('offboarded_employee')
    expect(skip?.legalBasis).toBe('17 CCR 54326 five-year retention')
    const executed = events.find((e) => e.status === 'executed')
    expect(executed).toBeDefined()
    expect(executed?.detail).toContain('1 item(s) skipped under legal hold')
  })

  it('refuses to purge a profile from another tenant', async () => {
    const t = createTestConvex()
    const tenantA = await seedTenant(t, 'org_purge_ct_a', 'user_admin_purge_ct')
    const tenantB = await seedTenant(t, 'org_purge_ct_b', 'user_admin_purge_ct')
    const { profileId } = await seedOffboardedEmployee(
      t,
      tenantA,
      'user_cg_purge_ct',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )

    await expect(
      t.mutation(internal.dataRetention.purgeOffboardedEmployee, {
        employeeProfileId: profileId,
        tenantId: tenantB,
        actorId: 'system',
      }),
    ).rejects.toThrow(/cross-tenant/i)
  })
})

describe('purgeExpiredDocuments', () => {
  it('deletes only past-retention items that are not under legal hold', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, 'org_doc_purge', 'user_admin_doc_purge')
    const past = new Date(Date.now() - 365 * DAY_MS).toISOString()
    const future = new Date(Date.now() + 365 * DAY_MS).toISOString()

    const { itemId: dueItemId } = await seedArchiveItem(t, tenantId, {
      retentionUntil: past,
    })
    const { itemId: futureItemId } = await seedArchiveItem(t, tenantId, {
      retentionUntil: future,
    })
    const { itemId: heldItemId } = await seedArchiveItem(t, tenantId, {
      retentionUntil: past,
      legalHold: true,
    })
    // No retentionUntil at all — never due.
    const { itemId: noDeadlineItemId } = await seedArchiveItem(t, tenantId, {})

    const result = await t.mutation(internal.dataRetention.purgeExpiredDocuments, {
      tenantId,
      actorId: 'system',
      limit: 100,
    })
    expect(result).toEqual({ deleted: 1, remaining: 0 })

    const after = await t.run(async (ctx) => ({
      due: await ctx.db.get(dueItemId),
      future: await ctx.db.get(futureItemId),
      held: await ctx.db.get(heldItemId),
      noDeadline: await ctx.db.get(noDeadlineItemId),
    }))
    expect(after.due).toBeNull()
    expect(after.future).toBeDefined()
    expect(after.held).toBeDefined()
    expect(after.noDeadline).toBeDefined()

    const events = await listDeletionEvents(t, tenantId)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      actorId: 'system',
      subjectType: 'expired_document',
      subjectId: dueItemId as string,
      legalBasis: 'document retention schedule',
      status: 'executed',
    })
  })
})

describe('runRetentionSweep', () => {
  it('purges due records as system and notifies tenant admins; a second run is a no-op', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_sweep'
    const adminId = 'user_admin_sweep'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    const { profileId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_sweep',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    await seedFile(t, tenantId, 'user_cg_sweep')
    await seedArchiveItem(t, tenantId, {
      subjectType: 'employee',
      subjectId: profileId as string,
      retentionUntil: new Date(Date.now() - 365 * DAY_MS).toISOString(),
    })
    // A second, candidate-owned document past retention — deleted by the
    // document purge leg of the sweep rather than the employee purge.
    await seedArchiveItem(t, tenantId, {
      subjectType: 'candidate',
      subjectId: 'candidate-sweep',
      retentionUntil: new Date(Date.now() - 365 * DAY_MS).toISOString(),
    })

    const first = await t.action(internal.dataRetention.runRetentionSweep, {})
    expect(first).toEqual({ tenantsScanned: 1, tenantsPurged: 1, hasMore: false })

    // Purged as 'system'; the deletion log shows both subjects.
    const events = await listDeletionEvents(t, tenantId)
    expect(events.length).toBe(2)
    expect(events.every((e) => e.actorId === 'system')).toBe(true)
    expect(
      events.map((e) => e.subjectType).sort(),
    ).toEqual(['expired_document', 'offboarded_employee'])

    // One summary notification for the tenant admin, counts only.
    const notifications = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      tenantId,
      clerkUserId: adminId,
      type: 'data_retention_sweep',
      read: false,
    })
    expect(notifications[0]?.message).toContain('1 offboarded employee(s)')
    expect(notifications[0]?.message).toContain('1 expired document(s)')

    // Second run: nothing is due anymore, so no duplicate notification.
    const second = await t.action(internal.dataRetention.runRetentionSweep, {})
    expect(second.tenantsPurged).toBe(0)
    const notificationsAfter = await t.run(async (ctx) =>
      ctx.db.query('notifications').collect(),
    )
    expect(notificationsAfter).toHaveLength(1)
  })
})

describe('getPurgePreview', () => {
  it('lists due offboarded employees and expired documents for org:admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_preview'
    const adminId = 'user_admin_preview'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_preview_due',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_preview_recent',
      new Date(Date.now() - 30 * DAY_MS).toISOString(),
    )
    await seedArchiveItem(t, tenantId, {
      retentionUntil: new Date(Date.now() - 365 * DAY_MS).toISOString(),
    })

    const preview = await asAdmin(t, adminId, clerkOrgId).query(
      api.dataRetention.getPurgePreview,
      { clerkOrgId },
    )

    expect(preview.retentionYears).toBe(5)
    expect(preview.counts.offboardedEmployees).toBe(1)
    expect(preview.offboardedEmployees[0]?.email).toBe(
      'user_cg_preview_due@example.com',
    )
    expect(preview.counts.expiredDocuments).toBe(1)
    expect(preview.expiredDocuments[0]?.fileName).toBe('credential.pdf')
  })

  it('honors the per-tenant purgeRetentionYears override', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_preview_override'
    const adminId = 'user_admin_preview_override'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_preview_override',
      new Date(Date.now() - 2 * 365 * DAY_MS).toISOString(),
    )
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: {
          enabled: false,
          enforceClockIn: false,
          enforceClockOut: false,
          defaultRadiusMeters: 100,
          maxAccuracyMeters: 50,
        },
        purgeRetentionYears: 1,
      })
    })

    const preview = await asAdmin(t, adminId, clerkOrgId).query(
      api.dataRetention.getPurgePreview,
      { clerkOrgId },
    )
    expect(preview.retentionYears).toBe(1)
    expect(preview.counts.offboardedEmployees).toBe(1)
  })

  it('is denied for coordinators and caregivers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_preview_roles'
    const adminId = 'user_admin_preview_roles'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_coord_preview_roles',
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coord@example.com',
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_cg_preview_roles',
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    for (const userId of ['user_coord_preview_roles', 'user_cg_preview_roles']) {
      await expect(
        t
          .withIdentity({ subject: userId, org_id: clerkOrgId, org_role: 'org:coordinator' })
          .query(api.dataRetention.getPurgePreview, { clerkOrgId }),
      ).rejects.toThrow(/Forbidden/)
    }
  })

  it('never leaks another tenant into the preview', async () => {
    const t = createTestConvex()
    const tenantA = await seedTenant(t, 'org_preview_ta', 'user_admin_preview_ta')
    await seedTenant(t, 'org_preview_tb', 'user_admin_preview_tb')
    await seedOffboardedEmployee(
      t,
      tenantA,
      'user_cg_preview_ta',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )

    // Admin of tenant B sees only their own (empty) preview…
    const previewB = await asAdmin(t, 'user_admin_preview_tb', 'org_preview_tb').query(
      api.dataRetention.getPurgePreview,
      { clerkOrgId: 'org_preview_tb' },
    )
    expect(previewB.counts.offboardedEmployees).toBe(0)

    // …and cannot pass tenant A's org id from their own identity.
    await expect(
      asAdmin(t, 'user_admin_preview_tb', 'org_preview_tb').query(
        api.dataRetention.getPurgePreview,
        { clerkOrgId: 'org_preview_ta' },
      ),
    ).rejects.toThrow(/Forbidden|mismatch/i)
  })
})

describe('requestOffboardedPurge', () => {
  it('purges immediately with the admin as actor and audits data_lifecycle.purge_executed', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_manual_purge'
    const adminId = 'user_admin_manual_purge'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    const { profileId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_manual_purge',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    await seedFile(t, tenantId, 'user_cg_manual_purge')

    const result = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.dataRetention.requestOffboardedPurge,
      { clerkOrgId, employeeProfileId: profileId },
    )
    expect(result.filesDeleted).toBe(1)

    const events = await listDeletionEvents(t, tenantId)
    expect(events).toHaveLength(1)
    expect(events[0]?.actorId).toBe(adminId)
    expect(events[0]?.status).toBe('executed')

    // The audit trail records the manual purge with the data_lifecycle category.
    const auditEvents = await t.run(async (ctx) =>
      ctx.db
        .query('auditEvents')
        .withIndex('by_tenant_created_at', (q) => q.eq('tenantId', tenantId))
        .collect(),
    )
    const audit = auditEvents.find(
      (e) => e.action === 'data_lifecycle.purge_executed',
    )
    expect(audit).toBeDefined()
    expect(audit?.category).toBe('data_lifecycle')
    expect(audit?.metadata?.subjectType).toBe('offboarded_employee')
    expect(audit?.metadata?.subjectId).toBe(profileId as string)
  })

  it('is denied for non-admin roles', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_manual_purge_deny'
    const adminId = 'user_admin_manual_purge_deny'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    const { profileId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_manual_purge_deny',
      new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
    )
    await t.run(async (ctx) => {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_coord_manual_purge_deny',
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coord-deny@example.com',
      })
    })

    await expect(
      t
        .withIdentity({
          subject: 'user_coord_manual_purge_deny',
          org_id: clerkOrgId,
          org_role: 'org:coordinator',
        })
        .mutation(api.dataRetention.requestOffboardedPurge, {
          clerkOrgId,
          employeeProfileId: profileId,
        }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('members.remove offboarding', () => {
  it('sets offboardedAt on the linked employee profile when a member is removed', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_remove_offboard'
    const adminId = 'user_admin_remove_offboard'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    const { memberId, profileId } = await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_remove_offboard',
      // Value replaced below: the profile starts as an active employee.
      new Date().toISOString(),
    )
    // Simulate an active employee: no offboarding yet.
    await t.run(async (ctx) => {
      await ctx.db.patch(profileId, { offboardedAt: undefined })
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(api.members.remove, {
      clerkOrgId,
      clerkUserId: 'user_cg_remove_offboard',
    })

    const after = await t.run(async (ctx) => {
      const member = await ctx.db.get(memberId)
      const profile = await ctx.db.get(profileId)
      return { member, profile }
    })
    expect(after.member).toBeNull()
    expect(after.profile?.offboardedAt).toBeDefined()
  })

  it('surfaces the offboarded employee in the purge preview', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_remove_preview'
    const adminId = 'user_admin_remove_preview'
    const tenantId = await seedTenant(t, clerkOrgId, adminId)
    await seedOffboardedEmployee(
      t,
      tenantId,
      'user_cg_remove_preview',
      new Date().toISOString(),
    )

    // Immediately after removal the retention window has not passed.
    await asAdmin(t, adminId, clerkOrgId).mutation(api.members.remove, {
      clerkOrgId,
      clerkUserId: 'user_cg_remove_preview',
    })
    const fresh = await asAdmin(t, adminId, clerkOrgId).query(
      api.dataRetention.getPurgePreview,
      { clerkOrgId },
    )
    expect(fresh.counts.offboardedEmployees).toBe(0)

    // Wind the clock past the 5-year window.
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .unique()
      if (profile) {
        await ctx.db.patch(profile._id, {
          offboardedAt: new Date(Date.now() - 6 * 365 * DAY_MS).toISOString(),
        })
      }
    })
    const due = await asAdmin(t, adminId, clerkOrgId).query(
      api.dataRetention.getPurgePreview,
      { clerkOrgId },
    )
    expect(due.counts.offboardedEmployees).toBe(1)
  })
})
