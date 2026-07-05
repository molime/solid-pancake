import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubClerkInvitation() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  vi.stubEnv('APP_URL', 'http://localhost')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_test',
            email_address: 'candidate@example.com',
            role: 'org:member',
            role_name: 'Member',
            status: 'pending',
            created_at: Date.now(),
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

function stubClerkMembershipUpdate() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
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

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
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

function asHR(
  t: ReturnType<typeof createTestConvex>,
  hrId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: hrId,
    org_id: clerkOrgId,
    org_role: 'org:hr',
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

async function seedHR(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  hrId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: hrId,
      role: 'org:hr',
      displayName: 'HR Person',
      email: 'hr@example.com',
    })
  })
}

describe('inviteCandidate', () => {
  it('seeds 5 tasks in order', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_candidate'
    const adminId = 'user_admin_invite'

    await seedTenant(t, clerkOrgId, adminId)

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.candidates.inviteCandidate,
      {
        clerkOrgId,
        displayName: 'Candidate One',
        email: 'candidate@example.com',
      },
    )

    expect(result.candidateId).toBeDefined()
    expect(result.invitationId).toBe('inv_test')

    const candidate = await t.run(async (ctx) => {
      return ctx.db.get(result.candidateId as Id<'candidates'>)
    })
    expect(candidate?.status).toBe('invited')
    expect(candidate?.email).toBe('candidate@example.com')

    const tasks = await t.run(async (ctx) => {
      return ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', candidate?.tenantId as Id<'tenants'>).eq('candidateId', result.candidateId as Id<'candidates'>),
        )
        .collect()
    })

    expect(tasks).toHaveLength(5)
    expect(tasks.map((t) => t.type)).toEqual([
      'form_submission',
      'document_upload',
      'background_check',
      'reference_check',
      'platform_training',
    ])
    expect(tasks.map((t) => t.order)).toEqual([0, 1, 2, 3, 4])
    expect(tasks.every((t) => t.status === 'pending')).toBe(true)
  })

  it('is allowed for org:hr', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_hr'
    const adminId = 'user_admin_invite_hr'
    const hrId = 'user_hr_invite'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const result = await asHR(t, hrId, clerkOrgId).action(
      api.candidates.inviteCandidate,
      {
        clerkOrgId,
        displayName: 'Candidate HR',
        email: 'candidate.hr@example.com',
      },
    )

    expect(result.candidateId).toBeDefined()
  })

  it('blocks org:caregiver callers', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_caregiver'
    const adminId = 'user_admin_invite_cg'
    const caregiverId = 'user_cg_invite'

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
      t.withIdentity({
        subject: caregiverId,
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      }).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'Candidate One',
        email: 'candidate@example.com',
      }),
    ).rejects.toThrow()
  })
})

describe('getCandidateProfile', () => {
  it('returns own row by clerkUserId', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_profile_by_user'
    const adminId = 'user_admin_profile'
    const candidateUserId = 'user_candidate_profile'

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
        displayName: 'Linked Candidate',
        email: 'candidate@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Linked Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    const profile = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.candidates.getCandidateProfile,
      { clerkOrgId },
    )

    expect(profile?.displayName).toBe('Linked Candidate')
  })

  it('falls back to email when clerkUserId is missing', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_profile_by_email'
    const adminId = 'user_admin_profile_email'
    const candidateUserId = 'user_candidate_profile_email'

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
        displayName: 'Candidate Member',
        email: 'fallback@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'fallback@example.com',
        displayName: 'Unlinked Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    const profile = await t
      .withIdentity({
        subject: candidateUserId,
        org_id: clerkOrgId,
        org_role: 'org:candidate',
        email: 'fallback@example.com',
      })
      .query(api.candidates.getCandidateProfile, { clerkOrgId })

    expect(profile?.displayName).toBe('Unlinked Candidate')
  })
})

describe('submitApplication', () => {
  it('creates application and marks form_submission task complete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_app'
    const adminId = 'user_admin_submit'
    const candidateUserId = 'user_candidate_submit'

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
        displayName: 'Applicant',
        email: 'submit@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'submit@example.com',
        displayName: 'Applicant',
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
        fields: { name: 'Applicant', experience: '5 years' },
      },
    )

    const [candidate, application, tasks] = await t.run(async (ctx) => {
      const c = await ctx.db.get(candidateId)
      const apps = await ctx.db
        .query('applications')
        .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
        .collect()
      const taskList = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      return [c, apps, taskList]
    })

    expect(candidate?.status).toBe('applied')
    expect(application).toHaveLength(1)
    expect(application[0]?.fields).toEqual({
      name: 'Applicant',
      experience: '5 years',
    })
    const formTask = tasks.find((t) => t.type === 'form_submission')
    expect(formTask?.status).toBe('complete')
  })

  it('updates the most recent application when multiple exist', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_submit_app_upsert'
    const adminId = 'user_admin_submit_upsert'
    const candidateUserId = 'user_candidate_submit_upsert'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'>
    let tenantId: Id<'tenants'>
    let olderAppId: Id<'applications'>
    let newerAppId: Id<'applications'>
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
        displayName: 'Applicant',
        email: 'submit.upsert@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'submit.upsert@example.com',
        displayName: 'Applicant',
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
      olderAppId = await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt: new Date('2024-01-01').toISOString(),
        fields: { version: 'old' },
      })
      newerAppId = await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt: new Date('2024-06-01').toISOString(),
        fields: { version: 'new' },
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { version: 'updated' },
      },
    )

    const [olderApp, newerApp] = await t.run(async (ctx) => {
      return [
        await ctx.db.get(olderAppId),
        await ctx.db.get(newerAppId),
      ]
    })

    expect(olderApp?.fields).toEqual({ version: 'old' })
    expect(newerApp?.fields).toEqual({ version: 'updated' })
  })
})

describe('reviewApplication and offer lifecycle', () => {
  it('transitions candidate through approved -> offer -> accepted -> hired', async () => {
    stubAdpEnv()
    stubClerkMembershipUpdate()
    const t = createTestConvex()
    const clerkOrgId = 'org_lifecycle'
    const adminId = 'user_admin_lifecycle'
    const candidateUserId = 'user_candidate_lifecycle'

    await seedTenant(t, clerkOrgId, adminId)
    vi.useFakeTimers()

    let tenantId: Id<'tenants'>
    let candidateId: Id<'candidates'>

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
        displayName: 'Lifecycle Candidate',
        email: 'lifecycle@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'lifecycle@example.com',
        displayName: 'Lifecycle Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
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

    let candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('hr_review')

    await asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.sendOffer, {
      clerkOrgId,
      candidateId,
    })

    candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('offer_sent')

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.acceptOffer,
      { clerkOrgId },
    )

    candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('accepted')

    const hireResult = await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.hireCandidate,
      { clerkOrgId, candidateId },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('hired')

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(hireResult.employeeProfileId as Id<'employeeProfiles'>)
    })
    expect(profile?.adpSyncStatus).toBe('pending_credentials')
    expect(profile?.email).toBe('lifecycle@example.com')

    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const membershipCall = calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes(`/organizations/${clerkOrgId}/memberships/${candidateUserId}`),
    )
    expect(membershipCall).toBeDefined()
  })

  it('rejects application and blocks offer from non-hr_review status', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_reject'
    const adminId = 'user_admin_reject'
    const candidateUserId = 'user_candidate_reject'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'>

    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'reject@example.com',
        displayName: 'Reject Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
    })

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.reviewApplication,
      {
        clerkOrgId,
        candidateId,
        decision: 'rejected',
      },
    )

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('rejected')

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.sendOffer, {
        clerkOrgId,
        candidateId,
      }),
    ).rejects.toThrow()
  })
})

describe('listCandidates and getCandidateDetail', () => {
  it('lists and filters candidates for HR', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list'
    const adminId = 'user_admin_list'
    const hrId = 'user_hr_list'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'applied@example.com',
        displayName: 'Applied',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'invited@example.com',
        displayName: 'Invited',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    const allCandidates = await asHR(t, hrId, clerkOrgId).query(
      api.candidates.listCandidates,
      { clerkOrgId },
    )
    expect(allCandidates).toHaveLength(2)

    const invited = await asHR(t, hrId, clerkOrgId).query(
      api.candidates.listCandidates,
      { clerkOrgId, status: 'invited' },
    )
    expect(invited).toHaveLength(1)
    expect(invited[0]?.status).toBe('invited')
  })

  it('blocks org:candidate from listing candidates', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_block'
    const adminId = 'user_admin_list_block'
    const candidateUserId = 'user_candidate_list_block'

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

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(
        api.candidates.listCandidates,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })

  it('returns applications, tasks, and documents in detail view', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_detail'
    const adminId = 'user_admin_detail'

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
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        email: 'detail@example.com',
        displayName: 'Detail Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId,
        candidateId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'complete',
        order: 0,
        completedAt: new Date().toISOString(),
      })
    })

    const detail = await asAdmin(t, adminId, clerkOrgId).query(
      api.candidates.getCandidateDetail,
      { clerkOrgId, candidateId },
    )

    expect(detail.candidate.status).toBe('applied')
    expect(detail.applications).toHaveLength(1)
    expect(detail.tasks).toHaveLength(1)
    expect(detail.documents).toHaveLength(0)
  })
})

describe('addCandidateDocument', () => {
  it('marks document_upload task complete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_doc'
    const adminId = 'user_admin_doc'
    const candidateUserId = 'user_candidate_doc'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'>
    let tenantId: Id<'tenants'>
    let fileId: Id<'files'>

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
        displayName: 'Doc Candidate',
        email: 'doc@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'doc@example.com',
        displayName: 'Doc Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'document_upload',
        status: 'pending',
        order: 1,
      })
      fileId = await ctx.db.insert('files', {
        tenantId,
        storageId: 'storage-1',
        uploadedBy: candidateUserId,
        fileName: 'license.pdf',
        contentType: 'application/pdf',
        size: 1024,
        linkedType: 'shiftTask',
        linkedId: 'task-1',
        visibility: 'all_staff',
        createdAt: new Date().toISOString(),
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.addCandidateDocument,
      {
        clerkOrgId,
        fileId,
        documentType: 'license',
        label: 'Driver License',
      },
    )

    const [documents, tasks] = await t.run(async (ctx) => {
      const docs = await ctx.db
        .query('documentArchiveItems')
        .withIndex('by_tenant_subject', (q) =>
          q.eq('tenantId', tenantId).eq('subjectType', 'candidate').eq('subjectId', candidateId as string),
        )
        .collect()
      const taskList = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      return [docs, taskList]
    })

    expect(documents).toHaveLength(1)
    expect(documents[0]?.category).toBe('license')
    const docTask = tasks.find((t) => t.type === 'document_upload')
    expect(docTask?.status).toBe('complete')
  })
})

describe('listCandidateTasks', () => {
  it('returns ordered tasks for candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_tasks'
    const adminId = 'user_admin_tasks'
    const candidateUserId = 'user_candidate_tasks'

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
        displayName: 'Task Candidate',
        email: 'tasks@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'tasks@example.com',
        displayName: 'Task Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'platform_training',
        status: 'pending',
        order: 4,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
    })

    const tasks = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.candidates.listCandidateTasks,
      { clerkOrgId },
    )

    expect(tasks.map((t) => t.type)).toEqual(['form_submission', 'platform_training'])
  })

  it('returns ordered tasks for HR target candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_tasks_hr'
    const adminId = 'user_admin_tasks_hr'
    const hrId = 'user_hr_tasks_hr'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
    let candidateId: Id<'candidates'>
    let tenantId: Id<'tenants'>

    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      tenantId = tenant._id
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        email: 'tasks.hr@example.com',
        displayName: 'HR Task Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'document_upload',
        status: 'pending',
        order: 1,
      })
    })

    const tasks = await asHR(t, hrId, clerkOrgId).query(
      api.candidates.listCandidateTasksForHR,
      { clerkOrgId, candidateId },
    )

    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.type).toBe('document_upload')
  })
})

describe('role guard regression', () => {
  it('blocks org:candidate from calling listShifts', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_shifts_block'
    const adminId = 'user_admin_list_shifts_block'
    const candidateUserId = 'user_candidate_list_shifts_block'

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

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(api.scheduling.listShifts, {
        clerkOrgId,
      }),
    ).rejects.toThrow()
  })
})
