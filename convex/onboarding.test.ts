import { describe, expect, it, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

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

function asCandidate(
  t: ReturnType<typeof createTestConvex>,
  candidateId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: candidateId,
    org_id: clerkOrgId,
    org_role: 'org:candidate',
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
      name: 'Test Agency',
      slug: 'test-agency',
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

function stubClerkMembershipUpdate() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  vi.stubEnv('APP_URL', 'http://localhost')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'mem_test',
            role: 'org:member',
            public_metadata: { atriaRole: 'org:caregiver' },
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

describe('completePlatformTraining', () => {
  it('is idempotent for caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_idempotent'
    const adminId = 'user_admin_training'
    const caregiverId = 'user_cg_training'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )
    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const completions = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('platformTrainingCompletions')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .collect()
    })

    expect(completions).toHaveLength(1)
    expect(completions[0]?.status).toBe('completed')
  })

  it('works for candidate role', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_candidate'
    const adminId = 'user_admin_training_cand'
    const candidateId = 'user_candidate_training'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
    })

    await asCandidate(t, candidateId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const completed = await asCandidate(t, candidateId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(completed).toBe(true)
  })
})

describe('hasPlatformTrainingCompleted', () => {
  it('returns false before completion and true after', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_has'
    const adminId = 'user_admin_training_has'
    const caregiverId = 'user_cg_training_has'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    const before = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(before).toBe(false)

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const after = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(true)
  })
})

describe('resetPlatformTraining', () => {
  it('deletes completion for admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_reset'
    const adminId = 'user_admin_training_reset'
    const caregiverId = 'user_cg_training_reset'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        trainingId: 'platform_training',
        completedAt: new Date().toISOString(),
        status: 'completed',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.onboarding.resetPlatformTraining,
      { clerkOrgId, clerkUserId: caregiverId },
    )
    expect(result.deleted).toBe(true)

    const after = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(false)
  })

  it('blocks non-admin callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_training_reset_block'
    const adminId = 'user_admin_training_reset_block'
    const caregiverId = 'user_cg_training_reset_block'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.onboarding.resetPlatformTraining,
        { clerkOrgId, clerkUserId: caregiverId },
      ),
    ).rejects.toThrow()
  })
})

describe('candidate-to-caregiver lifecycle', () => {
  it('candidateTasks are ordered 0-5 with the six current types', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_tasks_order'
    const adminId = 'user_admin_lifecycle_tasks_order'
    const candidateUserId = 'user_candidate_lifecycle_tasks_order'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'>
    let tenantId: Id<'tenants'>
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      tenantId = tenant._id
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'platform_training',
        status: 'pending',
        order: 5,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'photo_id',
        status: 'pending',
        order: 1,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'cpr_certificate',
        status: 'pending',
        order: 2,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'background_check',
        status: 'pending',
        order: 3,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'employment_agreement',
        status: 'pending',
        order: 4,
      })
    })

    const tasks = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.candidates.listCandidateTasks,
      { clerkOrgId },
    )

    expect(tasks).toHaveLength(6)
    expect(tasks.map((task) => task.type)).toEqual([
      'form_submission',
      'photo_id',
      'cpr_certificate',
      'background_check',
      'employment_agreement',
      'platform_training',
    ])
    expect(tasks.map((task) => task.order)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('submitApplication creates application and completes form_submission task', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_submit'
    const adminId = 'user_admin_lifecycle_submit'
    const candidateUserId = 'user_candidate_lifecycle_submit'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'>
    let tenantId: Id<'tenants'>
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      tenantId = tenant._id
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: {
          fullName: 'Candidate',
          email: 'candidate@example.com',
          phone: '555-123-4567',
          position: 'Caregiver',
        },
      },
    )

    const [candidate, applications, tasks] = await t.run(async (ctx) => {
      return [
        await ctx.db.get(candidateId),
        await ctx.db
          .query('applications')
          .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
          .collect(),
        await ctx.db
          .query('candidateTasks')
          .withIndex('by_tenant_candidate_order', (q) =>
            q.eq('tenantId', tenantId).eq('candidateId', candidateId),
          )
          .collect(),
      ]
    })

    expect(candidate?.status).toBe('applied')
    expect(applications).toHaveLength(1)
    expect(applications[0]?.fields).toEqual({
      fullName: 'Candidate',
      email: 'candidate@example.com',
      phone: '555-123-4567',
      position: 'Caregiver',
    })
    const formTask = tasks.find((task) => task.type === 'form_submission')
    expect(formTask?.status).toBe('complete')
  })

  it('reviewApplication transitions applied -> hr_review', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_review'
    const adminId = 'user_admin_lifecycle_review'
    const candidateUserId = 'user_candidate_lifecycle_review'

    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      const id = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId: id,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
      return id
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.reviewApplication,
      {
        clerkOrgId,
        candidateId,
        decision: 'approved',
        hrNotes: 'Looks good',
      },
    )

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('hr_review')
  })

  it('sendOffer transitions hr_review -> offer_sent', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_offer'
    const adminId = 'user_admin_lifecycle_offer'
    const candidateUserId = 'user_candidate_lifecycle_offer'

    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      const id = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'hr_review',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId: id,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        fields: {
          i9Section2: {
            documentTitle: 'US Passport',
            documentNumber: '123456789',
            expirationDate: '2030-01-01',
            employerSignature: 'HR Admin',
            date: new Date().toISOString().split('T')[0],
          },
        },
      })
      await ctx.db.insert('prefilledDocuments', {
        tenantId: tenant._id,
        candidateId: id,
        documentType: 'w4',
        storageId: 'w4-storage-id',
        generatedAt: new Date().toISOString(),
        generatedBy: adminId,
        hrSectionCompleted: true,
        hrSectionData: {
          employerName: 'Test Agency',
          ein: '12-3456789',
          firstDateOfEmployment: new Date().toISOString().split('T')[0],
        },
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId: tenant._id,
        candidateId: id,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        officialResultStorageId: 'bg-result-storage-id',
        officialResultUploadedAt: new Date().toISOString(),
        officialResultUploadedBy: adminId,
      })
      return id
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.sendOffer, {
      clerkOrgId,
      candidateId,
    })

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('offer_sent')
  })

  it('acceptOffer transitions offer_sent -> accepted', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_accept'
    const adminId = 'user_admin_lifecycle_accept'
    const candidateUserId = 'user_candidate_lifecycle_accept'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'offer_sent',
        createdAt: new Date().toISOString(),
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.acceptOffer,
      { clerkOrgId },
    )

    const candidate = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('candidates')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', candidateUserId),
        )
        .unique()
    })
    expect(candidate?.status).toBe('accepted')
  })

  it('hireCandidate creates employeeProfile with adpSyncStatus pending_credentials and schedules ADP/Clerk updates', async () => {
    stubClerkMembershipUpdate()
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_hire'
    const adminId = 'user_admin_lifecycle_hire'
    const candidateUserId = 'user_candidate_lifecycle_hire'

    await seedTenant(t, clerkOrgId, adminId)
    vi.useFakeTimers()

    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'hire@example.com',
      })
      const id = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'hire@example.com',
        displayName: 'Hire Candidate',
        status: 'accepted',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId: id,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        fields: {
          i9Section2: {
            documentTitle: 'US Passport',
            documentNumber: '123456789',
            expirationDate: '2030-01-01',
            employerSignature: 'HR Admin',
            date: new Date().toISOString().split('T')[0],
          },
        },
      })
      await ctx.db.insert('prefilledDocuments', {
        tenantId: tenant._id,
        candidateId: id,
        documentType: 'w4',
        storageId: 'w4-storage-id',
        generatedAt: new Date().toISOString(),
        generatedBy: adminId,
        hrSectionCompleted: true,
        hrSectionData: {
          employerName: 'Test Agency',
          ein: '12-3456789',
          firstDateOfEmployment: new Date().toISOString().split('T')[0],
        },
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId: tenant._id,
        candidateId: id,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        officialResultStorageId: 'bg-result-storage-id',
        officialResultUploadedAt: new Date().toISOString(),
        officialResultUploadedBy: adminId,
      })
      return id
    })

    const hireResult = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.hireCandidate,
      { clerkOrgId, candidateId },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('hired')

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(hireResult.employeeProfileId as Id<'employeeProfiles'>)
    })
    expect(profile?.adpSyncStatus).toBe('pending_credentials')
    expect(profile?.email).toBe('hire@example.com')

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const membershipCall = calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes(
          `/organizations/${clerkOrgId}/memberships/${candidateUserId}`,
        ),
    )
    expect(membershipCall).toBeDefined()
    vi.useRealTimers()
  })

  it('completePlatformTraining is idempotent', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_training_idempotent'
    const adminId = 'user_admin_lifecycle_training_idempotent'
    const candidateUserId = 'user_candidate_lifecycle_training_idempotent'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )
    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const completions = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('platformTrainingCompletions')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', candidateUserId),
        )
        .collect()
    })

    expect(completions).toHaveLength(1)
    expect(completions[0]?.status).toBe('completed')
  })

  it('hasPlatformTrainingCompleted returns false then true', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_training_has'
    const adminId = 'user_admin_lifecycle_training_has'
    const candidateUserId = 'user_candidate_lifecycle_training_has'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
    })

    const before = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(before).toBe(false)

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.onboarding.completePlatformTraining,
      { clerkOrgId },
    )

    const after = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(true)
  })

  it('resetPlatformTraining deletes completion for admin', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_training_reset'
    const adminId = 'user_admin_lifecycle_training_reset'
    const candidateUserId = 'user_candidate_lifecycle_training_reset'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      await ctx.db.insert('platformTrainingCompletions', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        trainingId: 'platform_training',
        completedAt: new Date().toISOString(),
        status: 'completed',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.onboarding.resetPlatformTraining,
      { clerkOrgId, clerkUserId: candidateUserId },
    )
    expect(result.deleted).toBe(true)

    const after = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.onboarding.hasPlatformTrainingCompleted,
      { clerkOrgId },
    )
    expect(after).toBe(false)
  })

  it('org:candidate cannot call scheduling.listShifts', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle_scheduling_block'
    const adminId = 'user_admin_lifecycle_scheduling_block'
    const candidateUserId = 'user_candidate_lifecycle_scheduling_block'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Candidate',
        email: 'candidate@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(
        api.scheduling.listShifts,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})
