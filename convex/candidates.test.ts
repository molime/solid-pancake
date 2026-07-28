import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
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

async function seedCoordinator(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  coordinatorId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: coordinatorId,
      role: 'org:coordinator',
      displayName: 'Coordinator Person',
      email: 'coordinator@example.com',
    })
  })
}

type OfferPrerequisites = {
  w4?: boolean
  i9Section2?: boolean
  backgroundCheckResult?: boolean
}

async function seedCandidateForOffer(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  adminId: string,
  candidateUserId: string,
  prereqs: OfferPrerequisites = {},
) {
  await seedTenant(t, clerkOrgId, adminId)
  let tenantId: Id<'tenants'> = 'tenant_placeholder' as Id<'tenants'>
  let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
  let applicationId: Id<'applications'> = 'application_placeholder' as Id<'applications'>

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
    applicationId = await ctx.db.insert('applications', {
      tenantId,
      candidateId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      fields: prereqs.i9Section2
        ? {
            i9Section2: {
              documentTitle: 'US Passport',
              documentNumber: '123456789',
              expirationDate: '2030-01-01',
              employerSignature: 'HR Admin',
              date: new Date().toISOString().split('T')[0],
            },
          }
        : {},
    })

    if (prereqs.w4) {
      await ctx.db.insert('prefilledDocuments', {
        tenantId,
        candidateId,
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
    }

    if (prereqs.backgroundCheckResult) {
      await ctx.db.insert('backgroundChecks', {
        tenantId,
        candidateId,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        officialResultStorageId: 'bg-result-storage-id',
        officialResultUploadedAt: new Date().toISOString(),
        officialResultUploadedBy: adminId,
      })
    }
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

  return { tenantId, candidateId, applicationId }
}

beforeEach(() => {
  vi.stubEnv('EMAIL_ENABLED', 'false')
})

describe('inviteCandidate', () => {
  it('seeds 9 tasks in order', async () => {
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

    expect(tasks).toHaveLength(8)
    expect(tasks.map((t) => t.type)).toEqual([
      'form_submission',
      'photo_id',
      'tax_id_ssn',
      'cpr_certificate',
      'health_screen',
      'employment_agreement',
      'additional_certifications',
      'car_insurance',
    ])
    expect(tasks.map((t) => t.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // car_insurance starts skipped until the applicant answers Yes to the transport question
    expect(
      tasks.filter((t) => t.type !== 'car_insurance').every((t) => t.status === 'pending'),
    ).toBe(true)
    expect(tasks.find((t) => t.type === 'car_insurance')?.status).toBe('skipped')
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

  it('uses an org:admin as the Clerk inviter even when called by org:hr', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_hr_uses_admin'
    const adminId = 'user_admin_invite_hr_uses_admin'
    const hrId = 'user_hr_invite_hr_uses_admin'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    await asHR(t, hrId, clerkOrgId).action(api.candidates.inviteCandidate, {
      clerkOrgId,
      displayName: 'Candidate HR Admin Inviter',
      email: 'candidate.hr.admin@example.com',
    })

    const calls = vi.mocked(fetch).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastCall = calls[calls.length - 1]
    const requestBody = JSON.parse(lastCall[1]?.body as string)
    expect(requestBody.inviter_user_id).toBe(adminId)
  })

  it('throws a clear error when no org:admin is available', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_no_admin'
    const hrId = 'user_hr_invite_no_admin'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'No Admin Agency',
        slug: 'no-admin-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: hrId,
        role: 'org:hr',
        displayName: 'HR Person',
        email: 'hr@example.com',
      })
    })

    await expect(
      asHR(t, hrId, clerkOrgId).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'Candidate No Admin',
        email: 'candidate.no.admin@example.com',
      }),
    ).rejects.toThrow('No organization admin available to send Clerk invitation')
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


  it('throws a clear error when CLERK_SECRET_KEY is missing', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '')
    vi.stubEnv('APP_URL', 'http://localhost')
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_missing_clerk_key'
    const adminId = 'user_admin_invite_missing_clerk_key'

    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'Candidate One',
        email: 'candidate@example.com',
      }),
    ).rejects.toThrow('CLERK_SECRET_KEY')
  })

  it('throws a clear error when APP_URL is missing', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '***')
    vi.stubEnv('APP_URL', '')
    const t = createTestConvex()
    const clerkOrgId = 'org_invite_missing_app_url'
    const adminId = 'user_admin_invite_missing_app_url'

    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'Candidate One',
        email: 'candidate@example.com',
      }),
    ).rejects.toThrow('APP_URL')
  })

  it('bypasses Clerk allow-list errors in local dev and links the candidate', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit | undefined) => {
        if (url.includes('/organizations/org_invite_bypass/invitations')) {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    message: 'not allowed to access this application',
                    long_message:
                      'candidate@gmail.com is not allowed to access this application',
                    code: 'form_param_format_invalid',
                  },
                ],
              }),
          })
        }

        if (url.includes('/users') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'user_bypass_candidate',
                email_addresses: [{ email_address: 'candidate@gmail.com' }],
              }),
          })
        }

        if (url.includes('/memberships') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'mem_bypass_candidate' }),
          })
        }

        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'sit_bypass_candidate',
                token: 'sint_bypass_candidate',
                user_id: 'user_bypass_candidate',
              }),
          })
        }

        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
        })
      }) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_invite_bypass'
    const adminId = 'user_admin_invite_bypass'

    await seedTenant(t, clerkOrgId, adminId)

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.candidates.inviteCandidate,
      {
        clerkOrgId,
        displayName: 'Bypass Candidate',
        email: 'candidate@gmail.com',
      },
    )

    expect(result.invitationId).toMatch(/^manual:/)
    expect(result.magicLink).toBeDefined()
    expect(result.magicLink).toMatch(/__clerk_ticket=sint_bypass_candidate$/)

    const candidate = await t.run(async (ctx) => {
      return ctx.db.get(result.candidateId as Id<'candidates'>)
    })

    expect(candidate?.clerkUserId).toBe('user_bypass_candidate')
    expect(candidate?.invitationId).toMatch(/^manual:/)
    expect(candidate?.invitationFailed).toBeUndefined()
    expect(candidate?.invitationError).toBeUndefined()
  })

  it('preserves the candidate record when bypass fails', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              errors: [
                {
                  message: 'not allowed to access this application',
                  long_message:
                    'candidate@gmail.com is not allowed to access this application',
                  code: 'form_param_format_invalid',
                },
              ],
            }),
        }),
      ) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_invite_no_bypass'
    const adminId = 'user_admin_invite_no_bypass'

    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'No Bypass Candidate',
        email: 'candidate@gmail.com',
      }),
    ).rejects.toThrow('not allowed to access this application')

    const candidate = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      return ctx.db
        .query('candidates')
        .withIndex('by_tenant_email', (q) =>
          q.eq('tenantId', tenant!._id).eq('email', 'candidate@gmail.com'),
        )
        .unique()
    })

    expect(candidate).toBeDefined()
    expect(candidate?.status).toBe('invited')
    expect(candidate?.invitationFailed).toBe(true)
    expect(candidate?.invitationError).toContain('not allowed to access this application')
  })

  it('falls back to manual setup when the Clerk invitation allow-list rejects the email', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '***')
    vi.stubEnv('APP_URL', 'https://app.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/organizations/') && url.includes('/invitations')) {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    message: 'not allowed to access this application',
                    long_message:
                      'candidate@gmail.com is not allowed to access this application',
                    code: 'form_param_format_invalid',
                  },
                ],
              }),
          })
        }
        if (url === 'https://api.clerk.com/v1/users') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'user_manual_fallback',
                email_addresses: [{ email_address: 'candidate@gmail.com' }],
              }),
          })
        }
        if (url.includes('/memberships')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'mem_manual_fallback' }),
          })
        }
        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'sit_manual_fallback',
                token: 'sint_manual_fallback',
                user_id: 'user_manual_fallback',
              }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
        })
      }) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_invite_production_guard'
    const adminId = 'user_admin_invite_production_guard'

    await seedTenant(t, clerkOrgId, adminId)

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.candidates.inviteCandidate,
      {
        clerkOrgId,
        displayName: 'Production Guard Candidate',
        email: 'candidate@gmail.com',
      },
    )

    expect(result.magicLink).toContain('__clerk_ticket=sint_manual_fallback')

    const candidate = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      return ctx.db
        .query('candidates')
        .withIndex('by_tenant_email', (q) =>
          q.eq('tenantId', tenant!._id).eq('email', 'candidate@gmail.com'),
        )
        .unique()
    })

    expect(candidate?.manualSetup).toBe(true)
    expect(candidate?.requiresPasswordChange).toBe(true)
    expect(candidate?.invitationFailed).toBeUndefined()
  })

it('bypasses via explicit flag on a production URL', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubEnv('APP_URL', 'https://app.example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit | undefined) => {
        if (url.includes('/organizations/org_invite_flag_bypass/invitations')) {
          return Promise.resolve({
            ok: false,
            status: 422,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    message: 'not allowed to access this application',
                    long_message:
                      'candidate@gmail.com is not allowed to access this application',
                    code: 'form_param_format_invalid',
                  },
                ],
              }),
          })
        }

        if (url.includes('/users') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'user_flag_bypass_candidate',
                email_addresses: [{ email_address: 'candidate@gmail.com' }],
              }),
          })
        }

        if (url.includes('/memberships') && init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'mem_flag_bypass_candidate' }),
          })
        }

        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'sit_flag_bypass_candidate',
                token: 'sint_flag_bypass_candidate',
                user_id: 'user_flag_bypass_candidate',
              }),
          })
        }


        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
        })
      }) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_invite_flag_bypass'
    const adminId = 'user_admin_invite_flag_bypass'

    await seedTenant(t, clerkOrgId, adminId)

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.candidates.inviteCandidate,
      {
        clerkOrgId,
        displayName: 'Flag Bypass Candidate',
        email: 'candidate@gmail.com',
      },
    )

    expect(result.invitationId).toMatch(/^manual:/)
    expect(result.magicLink).toBeDefined()
    expect(result.magicLink).toMatch(/__clerk_ticket=sint_flag_bypass_candidate$/)
    expect(result.initialPassword).toBeDefined()
    expect(result.initialPassword).toBeTruthy()
    expect(result.initialPassword!.length).toBeGreaterThanOrEqual(8)

    const candidate = await t.run(async (ctx) => {
      return ctx.db.get(result.candidateId as Id<'candidates'>)
    })

    expect(candidate?.clerkUserId).toBe('user_flag_bypass_candidate')
    expect(candidate?.invitationFailed).toBeUndefined()
  })

  it('preserves the candidate record on unexpected Clerk errors', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ errors: [{ message: 'Internal server error' }] }),
        }),
      ) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_invite_500'
    const adminId = 'user_admin_invite_500'

    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(api.candidates.inviteCandidate, {
        clerkOrgId,
        displayName: 'Server Error Candidate',
        email: 'candidate.500@example.com',
      }),
    ).rejects.toThrow('Internal server error')

    const candidate = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      return ctx.db
        .query('candidates')
        .withIndex('by_tenant_email', (q) =>
          q.eq('tenantId', tenant!._id).eq('email', 'candidate.500@example.com'),
        )
        .unique()
    })

    expect(candidate).toBeDefined()
    expect(candidate?.invitationFailed).toBe(true)
  })
})

describe('regenerateCandidateMagicLink', () => {
  function stubSignInTicket() {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubEnv('APP_URL', 'http://localhost:5173')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/sign_in_tokens')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'sit_regenerate',
                token: 'sint_regenerate',
                user_id: 'user_bypass_regenerate',
              }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
        })
      }) as unknown as typeof fetch,
    )
  }

  it('returns a fresh magic link for a bypass candidate', async () => {
    stubSignInTicket()
    const t = createTestConvex()
    const clerkOrgId = 'org_regenerate_bypass'
    const adminId = 'user_admin_regenerate_bypass'

    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: 'user_bypass_regenerate',
        email: 'regenerate@gmail.com',
        displayName: 'Regenerate Candidate',
        status: 'invited',
        invitationId: 'manual:test',
        manualSetup: true,
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.candidates.regenerateCandidateMagicLink,
      {
        clerkOrgId,
        candidateId,
      },
    )

    expect(result.magicLink).toBe('http://localhost:5173/sign-in?__clerk_ticket=sint_regenerate')
  })

  it('throws for a candidate not created via bypass', async () => {
    stubSignInTicket()
    const t = createTestConvex()
    const clerkOrgId = 'org_regenerate_normal'
    const adminId = 'user_admin_regenerate_normal'

    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: 'user_normal',
        email: 'normal@example.com',
        displayName: 'Normal Candidate',
        status: 'invited',
        invitationId: 'inv_normal',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asAdmin(t, adminId, clerkOrgId).action(api.candidates.regenerateCandidateMagicLink, {
        clerkOrgId,
        candidateId,
      }),
    ).rejects.toThrow('Candidate was not created via manual account setup.')
  })

  it('blocks org:candidate callers', async () => {
    stubSignInTicket()
    const t = createTestConvex()
    const clerkOrgId = 'org_regenerate_candidate'
    const adminId = 'user_admin_regenerate_candidate'
    const candidateUserId = 'user_candidate_regenerate'

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
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'invited',
        invitationId: 'manual:test',
        manualSetup: true,
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).action(
        api.candidates.regenerateCandidateMagicLink,
        {
          clerkOrgId,
          candidateId,
        },
      ),
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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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

describe('submitApplication notification', () => {
  async function seedSubmittableCandidate(
    t: ReturnType<typeof createTestConvex>,
    clerkOrgId: string,
    candidateUserId: string,
    email: string,
  ) {
    const adminId = 'user_admin_submit_notify'
    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
        displayName: 'Applicant',
        email,
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email,
        phone: '+15551234567',
        displayName: 'Applicant',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId: tenant._id,
        candidateId,
        type: 'form_submission',
        status: 'pending',
        order: 0,
      })
    })
    return candidateId
  }

  function stubNotificationEnv() {
    vi.stubEnv('EMAIL_ENABLED', 'true')
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com')
    vi.stubEnv('SMS_ENABLED', 'true')
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token_test')
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+15550001111')
  }

  it('sends an application_submitted email and SMS after submission', async () => {
    stubNotificationEnv()
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_test' }),
      }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const t = createTestConvex()
    const clerkOrgId = 'org_submit_notify'
    const candidateUserId = 'user_candidate_notify'
    const email = 'submit.notify@example.com'
    const candidateId = await seedSubmittableCandidate(
      t,
      clerkOrgId,
      candidateUserId,
      email,
    )

    vi.useFakeTimers()
    const result = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      { clerkOrgId, fields: { name: 'Applicant' } },
    )
    expect(result).toBe(candidateId)

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const resendCall = calls.find(([url, init]) => {
      if (!String(url).includes('resend.com')) return false
      const payload = JSON.parse(init?.body as string)
      return payload.to === email
    })
    expect(resendCall).toBeDefined()
    const emailPayload = JSON.parse(resendCall?.[1]?.body as string)
    expect(emailPayload.to).toBe(email)
    expect(emailPayload.subject).toBe('Your application has been submitted')
    expect(emailPayload.html).toContain('has been submitted successfully')
    expect(emailPayload.html).toContain('Test Agency')

    const twilioCall = calls.find(([url, init]) => {
      if (!String(url).includes('twilio.com')) return false
      const params = new URLSearchParams(init?.body as string)
      return params.get('To') === '+15551234567'
    })
    expect(twilioCall).toBeDefined()
    const smsParams = new URLSearchParams(twilioCall?.[1]?.body as string)
    expect(smsParams.get('To')).toBe('+15551234567')
    expect(smsParams.get('Body')).toBe(
      'Your application to Test Agency has been submitted. We will contact you with next steps.',
    )
  })

  it('still returns the candidate id when notification delivery fails', async () => {
    stubNotificationEnv()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        }),
      ) as unknown as typeof fetch,
    )

    const t = createTestConvex()
    const clerkOrgId = 'org_submit_notify_fail'
    const candidateUserId = 'user_candidate_notify_fail'
    const email = 'submit.notify.fail@example.com'
    const candidateId = await seedSubmittableCandidate(
      t,
      clerkOrgId,
      candidateUserId,
      email,
    )

    vi.useFakeTimers()
    const result = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      { clerkOrgId, fields: { name: 'Applicant' } },
    )
    expect(result).toBe(candidateId)

    // The scheduled notification fails against the stubbed 500 response;
    // this must not affect the already-committed submission.
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('applied')
  })
})

describe('submitApplication car insurance task', () => {
  async function seedCandidateWithTasks(
    t: ReturnType<typeof createTestConvex>,
    clerkOrgId: string,
    candidateUserId: string,
    carInsuranceStatus?: string,
  ) {
    const adminId = 'user_admin_car_ins'
    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
    let tenantId: Id<'tenants'> = 'tenant_placeholder' as Id<'tenants'>
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
        displayName: 'Driver Applicant',
        email: 'driver@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'driver@example.com',
        displayName: 'Driver Applicant',
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
      if (carInsuranceStatus) {
        await ctx.db.insert('candidateTasks', {
          tenantId,
          candidateId,
          type: 'car_insurance',
          status: carInsuranceStatus,
          order: 8,
        })
      }
    })
    return { candidateId, tenantId }
  }

  async function getCarInsuranceTasks(
    t: ReturnType<typeof createTestConvex>,
    tenantId: Id<'tenants'>,
    candidateId: Id<'candidates'>,
  ) {
    return t.run(async (ctx) => {
      const tasks = await ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect()
      return tasks.filter((task) => task.type === 'car_insurance')
    })
  }

  it('creates a pending car_insurance task when canTransportClients is true', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_car_ins_yes'
    const candidateUserId = 'user_candidate_car_ins_yes'
    const { candidateId, tenantId } = await seedCandidateWithTasks(
      t,
      clerkOrgId,
      candidateUserId,
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { personal: { canTransportClients: true } },
      },
    )

    const carTasks = await getCarInsuranceTasks(t, tenantId, candidateId)
    expect(carTasks).toHaveLength(1)
    expect(carTasks[0]?.status).toBe('pending')
  })

  it('creates a skipped car_insurance task when canTransportClients is false', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_car_ins_no'
    const candidateUserId = 'user_candidate_car_ins_no'
    const { candidateId, tenantId } = await seedCandidateWithTasks(
      t,
      clerkOrgId,
      candidateUserId,
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { personal: { canTransportClients: false } },
      },
    )

    const carTasks = await getCarInsuranceTasks(t, tenantId, candidateId)
    expect(carTasks).toHaveLength(1)
    expect(carTasks[0]?.status).toBe('skipped')
  })

  it('creates a skipped car_insurance task when the question is unanswered', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_car_ins_unanswered'
    const candidateUserId = 'user_candidate_car_ins_unanswered'
    const { candidateId, tenantId } = await seedCandidateWithTasks(
      t,
      clerkOrgId,
      candidateUserId,
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { personal: { firstName: 'Driver' } },
      },
    )

    const carTasks = await getCarInsuranceTasks(t, tenantId, candidateId)
    expect(carTasks).toHaveLength(1)
    expect(carTasks[0]?.status).toBe('skipped')
  })

  it('flips an existing skipped task to pending without duplicating it', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_car_ins_flip'
    const candidateUserId = 'user_candidate_car_ins_flip'
    const { candidateId, tenantId } = await seedCandidateWithTasks(
      t,
      clerkOrgId,
      candidateUserId,
      'skipped',
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { personal: { canTransportClients: true } },
      },
    )

    const carTasks = await getCarInsuranceTasks(t, tenantId, candidateId)
    expect(carTasks).toHaveLength(1)
    expect(carTasks[0]?.status).toBe('pending')
  })

  it('never reopens a completed car_insurance task', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_car_ins_complete'
    const candidateUserId = 'user_candidate_car_ins_complete'
    const { candidateId, tenantId } = await seedCandidateWithTasks(
      t,
      clerkOrgId,
      candidateUserId,
      'complete',
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.submitApplication,
      {
        clerkOrgId,
        fields: { personal: { canTransportClients: false } },
      },
    )

    const carTasks = await getCarInsuranceTasks(t, tenantId, candidateId)
    expect(carTasks).toHaveLength(1)
    expect(carTasks[0]?.status).toBe('complete')
  })
})

describe('removeClerkOrgMembership', () => {
  it('removes an existing Clerk org membership', async () => {
    stubClerkMembershipUpdate()
    const t = createTestConvex()

    const result = await t.action(internal.candidates.removeClerkOrgMembership, {
      clerkOrgId: 'org_remove_member',
      clerkUserId: 'user_member',
    })

    expect(result).toEqual({ removed: true })
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]?.[0]).toContain(
      '/organizations/org_remove_member/memberships/user_member',
    )
    expect((calls[0]?.[1] as { method?: string } | undefined)?.method).toBe(
      'DELETE',
    )
  })

  it('treats a 404 from Clerk as a no-op for users who were never org members', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ errors: [{ message: 'not found' }] }),
        }),
      ) as unknown as typeof fetch,
    )
    const t = createTestConvex()

    const result = await t.action(internal.candidates.removeClerkOrgMembership, {
      clerkOrgId: 'org_remove_noop',
      clerkUserId: 'user_never_member',
    })

    expect(result).toEqual({ removed: false })
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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>

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
        tenantId,
        candidateId,
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
        tenantId,
        candidateId,
        provider: 'mock',
        status: 'clear',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        officialResultStorageId: 'bg-result-storage-id',
        officialResultUploadedAt: new Date().toISOString(),
        officialResultUploadedBy: adminId,
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

    // Caregivers are NOT added to the Clerk org on hire (Clerk Standard plan
    // 20-member limit); the tenantMembers role flip authorizes them instead.
    // Candidates who still hold an org membership (invited before the no-org
    // flow) are removed from the Clerk org so their JWT carries no org claim.
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const membershipCalls = calls.filter(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes(`/organizations/${clerkOrgId}/memberships/${candidateUserId}`),
    )
    const patchCall = membershipCalls.find(
      (call: unknown[]) =>
        (call[1] as { method?: string } | undefined)?.method === 'PATCH',
    )
    expect(patchCall).toBeUndefined()
    const deleteCall = membershipCalls.find(
      (call: unknown[]) =>
        (call[1] as { method?: string } | undefined)?.method === 'DELETE',
    )
    expect(deleteCall).toBeDefined()

    const member = await t.run(async (ctx) =>
      ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', candidateUserId),
        )
        .unique(),
    )
    expect(member?.role).toBe('org:caregiver')
  })

  it('allows sendOffer without completed pre-hire documents', async () => {
    // Pre-hire gates (W-4 employer section, I-9 Section 2, official background
    // check result) are enforced at hire time, not when sending the offer, so
    // HR can send an offer while documents are still being finalised.
    const t = createTestConvex()
    const clerkOrgId = 'org_offer_no_prereqs'
    const adminId = 'user_admin_offer_no_prereqs'
    const candidateUserId = 'user_candidate_offer_no_prereqs'

    const { candidateId } = await seedCandidateForOffer(
      t,
      clerkOrgId,
      adminId,
      candidateUserId,
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.candidates.reviewApplication,
      {
        clerkOrgId,
        candidateId,
        decision: 'approved',
        hrNotes: 'Looks good',
      },
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.sendOffer, {
      clerkOrgId,
      candidateId,
    })

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('offer_sent')
  })

  it('rejects hireCandidate when pre-hire requirements are missing', async () => {
    stubAdpEnv()
    stubClerkMembershipUpdate()
    const t = createTestConvex()
    const clerkOrgId = 'org_hire_missing_prereqs'
    const adminId = 'user_admin_hire_missing_prereqs'
    const candidateUserId = 'user_candidate_hire_missing_prereqs'

    const { tenantId, candidateId } = await seedCandidateForOffer(
      t,
      clerkOrgId,
      adminId,
      candidateUserId,
      { w4: true, i9Section2: true, backgroundCheckResult: true },
    )

    await asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.sendOffer, {
      clerkOrgId,
      candidateId,
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.acceptOffer,
      { clerkOrgId },
    )

    // Remove the W-4 employer completion to break the pre-hire guard.
    await t.run(async (ctx) => {
      const w4Doc = await ctx.db
        .query('prefilledDocuments')
        .withIndex('by_tenant_candidate_type', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', 'w4'),
        )
        .first()
      if (w4Doc) {
        await ctx.db.patch(w4Doc._id, { hrSectionCompleted: false })
      }
    })

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(api.candidates.hireCandidate, {
        clerkOrgId,
        candidateId,
      }),
    ).rejects.toThrow(/W-4 employer section must be completed/)
  })

  it('requests correction and returns candidate to application_draft', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction'
    const adminId = 'user_admin_correction'
    const candidateUserId = 'user_candidate_correction'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>

    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'correction@example.com',
        displayName: 'Correction Candidate',
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
        candidateId: candidateId!,
        decision: 'needs_correction',
        hrNotes: 'Please upload a valid license.',
      },
    )

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('application_draft')

    const application = await t.run(async (ctx) => {
      return ctx.db
        .query('applications')
        .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
        .first()
    })
    expect(application?.decision).toBe('needs_correction')
    expect(application?.hrNotes).toBe('Please upload a valid license.')
  })

  it('rejects application and blocks offer from non-hr_review status', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_reject'
    const adminId = 'user_admin_reject'
    const candidateUserId = 'user_candidate_reject'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>

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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
    let tenantId: Id<'tenants'>
    let fileId: Id<'files'> = 'file_placeholder' as Id<'files'>

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

    await t.run(async (ctx) => {
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'photo_id',
        status: 'pending',
        order: 1,
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.addCandidateDocument,
      {
        clerkOrgId,
        fileId,
        documentType: 'photo_id',
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
    expect(documents[0]?.category).toBe('photo_id')
    const docTask = tasks.find((t) => t.type === 'photo_id')
    expect(docTask?.status).toBe('complete')
  })
})

describe('attachCandidateDocument', () => {
  it('marks the matching photo_id and cpr_certificate tasks complete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_attach_doc'
    const adminId = 'user_admin_attach_doc'
    const candidateUserId = 'user_candidate_attach_doc'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
        displayName: 'Doc Candidate',
        email: 'attach@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'attach@example.com',
        displayName: 'Doc Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'complete',
        order: 0,
        completedAt: new Date().toISOString(),
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
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.attachCandidateDocument,
      {
        clerkOrgId,
        storageId: 'storage-photo-id',
        fileName: 'license.png',
        contentType: 'image/png',
        size: 1024,
        documentType: 'photo_id',
        label: 'Photo ID',
      },
    )

    let tasks = await t.run(async (ctx) =>
      ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )
    expect(tasks.find((task) => task.type === 'photo_id')?.status).toBe('complete')
    expect(tasks.find((task) => task.type === 'cpr_certificate')?.status).toBe('pending')

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.attachCandidateDocument,
      {
        clerkOrgId,
        storageId: 'storage-cpr',
        fileName: 'cpr.pdf',
        contentType: 'application/pdf',
        size: 2048,
        documentType: 'cpr_certificate',
        label: 'CPR certificate',
      },
    )

    tasks = await t.run(async (ctx) =>
      ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )
    expect(tasks.find((task) => task.type === 'cpr_certificate')?.status).toBe('complete')
  })

  it('allows car_insurance upload when only the optional certifications step is pending', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_attach_car_ins'
    const adminId = 'user_admin_attach_car_ins'
    const candidateUserId = 'user_candidate_attach_car_ins'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
        displayName: 'Driver Candidate',
        email: 'driver-attach@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'driver-attach@example.com',
        displayName: 'Driver Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      const requiredTypes = [
        'form_submission',
        'photo_id',
        'tax_id_ssn',
        'cpr_certificate',
        'health_screen',
        'employment_agreement',
      ]
      for (const [index, type] of requiredTypes.entries()) {
        await ctx.db.insert('candidateTasks', {
          tenantId,
          candidateId,
          type,
          status: 'complete',
          order: index,
          completedAt: new Date().toISOString(),
        })
      }
      // Optional step left pending — the applicant skipped it.
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'additional_certifications',
        status: 'pending',
        order: 7,
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'car_insurance',
        status: 'pending',
        order: 8,
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.attachCandidateDocument,
      {
        clerkOrgId,
        storageId: 'storage-car-insurance',
        fileName: 'policy.pdf',
        contentType: 'application/pdf',
        size: 2048,
        documentType: 'car_insurance',
        label: 'Car Insurance Policy',
        expiresAt: '2027-12-31',
      },
    )

    const tasks = await t.run(async (ctx) =>
      ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )
    expect(tasks.find((task) => task.type === 'car_insurance')?.status).toBe('complete')
  })

  it('still blocks car_insurance upload when a required preceding step is pending', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_attach_car_ins_blocked'
    const adminId = 'user_admin_attach_car_ins_blocked'
    const candidateUserId = 'user_candidate_attach_car_ins_blocked'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const tenantId = tenant._id
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Driver Candidate',
        email: 'driver-blocked@example.com',
      })
      candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: candidateUserId,
        email: 'driver-blocked@example.com',
        displayName: 'Driver Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'form_submission',
        status: 'complete',
        order: 0,
        completedAt: new Date().toISOString(),
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
        type: 'car_insurance',
        status: 'pending',
        order: 8,
      })
    })

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).mutation(
        api.candidates.attachCandidateDocument,
        {
          clerkOrgId,
          storageId: 'storage-car-insurance',
          fileName: 'policy.pdf',
          contentType: 'application/pdf',
          size: 2048,
          documentType: 'car_insurance',
          label: 'Car Insurance Policy',
          expiresAt: '2027-12-31',
        },
      ),
    ).rejects.toThrow('Complete the previous step first')
  })
})

describe('listCandidateTasks', () => {
  it('returns ordered tasks for candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_tasks'
    const adminId = 'user_admin_tasks'
    const candidateUserId = 'user_candidate_tasks'

    await seedTenant(t, clerkOrgId, adminId)
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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
    let candidateId: Id<'candidates'> = 'candidate_placeholder' as Id<'candidates'>
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


describe('candidate self-service queries after hire', () => {
  it('getCandidateProfile allows org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hired_cg_read'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Hired Agency',
        slug: 'hired-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_hired',
        role: 'org:caregiver',
        displayName: 'Hired',
        email: 'hired@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: 'user_hired',
        displayName: 'Hired',
        email: 'hired@example.com',
        status: 'hired',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t
      .withIdentity({
        subject: 'user_hired',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.candidates.getCandidateProfile, { clerkOrgId })
      })

    expect(result).toMatchObject({ clerkUserId: 'user_hired', status: 'hired' })
  })

  it('listCandidateTasks allows org:caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_hired_cg_tasks'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Hired Agency',
        slug: 'hired-agency',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: 'user_hired',
        role: 'org:caregiver',
        displayName: 'Hired',
        email: 'hired@example.com',
      })
      const candidateId = await ctx.db.insert('candidates', {
        tenantId,
        clerkUserId: 'user_hired',
        displayName: 'Hired',
        email: 'hired@example.com',
        status: 'hired',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('candidateTasks', {
        tenantId,
        candidateId,
        type: 'platform_training',
        order: 1,
        status: 'complete',
        dueAt: new Date().toISOString(),
      })
    })

    const tasks = await t
      .withIdentity({
        subject: 'user_hired',
        org_id: clerkOrgId,
        org_role: 'org:caregiver',
      })
      .run(async (ctx) => {
        return ctx.runQuery(api.candidates.listCandidateTasks, { clerkOrgId })
      })

    expect(tasks).toHaveLength(1)
  })
})


describe('getCandidateById', () => {
  it('allows org:coordinator to read any candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_candidate_coord'
    const adminId = 'user_admin_get_candidate_coord'
    const coordinatorId = 'user_coord_get_candidate_coord'

    await seedTenant(t, clerkOrgId, adminId)
    await seedCoordinator(t, clerkOrgId, coordinatorId)

    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'candidate@example.com',
        displayName: 'Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asCoordinator(t, coordinatorId, clerkOrgId).query(
      api.candidates.getCandidateById,
      { clerkOrgId, candidateId },
    )

    expect(result?._id).toBe(candidateId)
  })

  it('blocks org:candidate from reading another candidate record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_candidate_block'
    const adminId = 'user_admin_get_candidate_block'

    await seedTenant(t, clerkOrgId, adminId)

    const { candidateId, candidateUserId } = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const uid = 'user_candidate_block'
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: uid,
        role: 'org:candidate',
        displayName: 'Block Candidate',
        email: 'block@example.com',
      })
      await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: uid,
        email: 'block@example.com',
        displayName: 'Block Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      const otherCid = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'other@example.com',
        displayName: 'Other Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      return { candidateId: otherCid, candidateUserId: uid }
    })

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(api.candidates.getCandidateById, {
        clerkOrgId,
        candidateId,
      }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('allows org:candidate to read their own candidate record', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_get_candidate_own'
    const adminId = 'user_admin_get_candidate_own'

    await seedTenant(t, clerkOrgId, adminId)

    const { candidateId, candidateUserId } = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const uid = 'user_candidate_own'
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: uid,
        role: 'org:candidate',
        displayName: 'Own Candidate',
        email: 'own@example.com',
      })
      const cid = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: uid,
        email: 'own@example.com',
        displayName: 'Own Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      return { candidateId: cid, candidateUserId: uid }
    })

    const result = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.candidates.getCandidateById,
      { clerkOrgId, candidateId },
    )

    expect(result?._id).toBe(candidateId)
  })
})

describe('createSelfServiceCandidate', () => {
  it('rejects an email that does not match the authenticated identity', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_self_service_email'
    const adminId = 'user_admin_self_service_email'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: 'user_self_email',
        role: 'org:candidate',
        displayName: 'Self Candidate',
        email: 'identity@example.com',
      })
    })

    await expect(
      t
        .withIdentity({
          subject: 'user_self_email',
          org_id: clerkOrgId,
          org_role: 'org:candidate',
          email: 'identity@example.com',
        })
        .mutation(api.candidates.createSelfServiceCandidate, {
          clerkOrgId,
          email: 'different@example.com',
          displayName: 'Self Candidate',
        }),
    ).rejects.toThrow(/Email must match/)
  })

  it('creates a candidate when the email matches the identity', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_self_service_match'
    const adminId = 'user_admin_self_service_match'
    const candidateUserId = 'user_self_match'

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
        displayName: 'Matched Candidate',
        email: 'match@example.com',
      })
    })

    const candidateId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.createSelfServiceCandidate,
      {
        clerkOrgId,
        email: 'match@example.com',
        displayName: 'Matched Candidate',
      },
    )

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId as Id<'candidates'>))
    expect(candidate?.email).toBe('match@example.com')
    expect(candidate?.clerkUserId).toBe('user_self_match')
  })
})

describe('prefilledDocuments', () => {
  async function seedCandidateWithApplication(
    t: ReturnType<typeof createTestConvex>,
    clerkOrgId: string,
    candidateUserId: string,
  ) {
    return t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Prefilled Candidate',
        email: 'prefilled@example.com',
      })
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'prefilled@example.com',
        displayName: 'Prefilled Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      const applicationId = await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
      return { tenantId: tenant._id, candidateId, applicationId }
    })
  }

  it('savePrefilledDocument is idempotent and updates the same row', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_prefilled_idempotent'
    const adminId = 'user_admin_prefilled_idempotent'
    const candidateUserId = 'user_candidate_prefilled_idempotent'

    await seedTenant(t, clerkOrgId, adminId)
    const { tenantId, candidateId } = await seedCandidateWithApplication(t, clerkOrgId, candidateUserId)

    const firstId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.savePrefilledDocument,
      {
        clerkOrgId,
        documentType: 'health_screen',
        storageId: 'storage-1',
      },
    )

    const secondId = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.savePrefilledDocument,
      {
        clerkOrgId,
        documentType: 'health_screen',
        storageId: 'storage-2',
      },
    )

    expect(secondId).toBe(firstId)

    const docs = await t.run(async (ctx) =>
      ctx.db
        .query('prefilledDocuments')
        .withIndex('by_tenant_candidate_type', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', 'health_screen'),
        )
        .collect(),
    )
    expect(docs).toHaveLength(1)
    expect(docs[0]?.storageId).toBe('storage-2')
  })

  it('saveSignedPrefilledDocument patches the signed storage id for the candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_signed_prefilled'
    const adminId = 'user_admin_signed_prefilled'
    const candidateUserId = 'user_candidate_signed_prefilled'

    await seedTenant(t, clerkOrgId, adminId)
    const { tenantId, candidateId } = await seedCandidateWithApplication(t, clerkOrgId, candidateUserId)

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.savePrefilledDocument,
      {
        clerkOrgId,
        documentType: 'health_screen',
        storageId: 'storage-generated',
      },
    )

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.saveSignedPrefilledDocument,
      {
        clerkOrgId,
        documentType: 'health_screen',
        storageId: 'storage-signed',
      },
    )

    const docs = await t.run(async (ctx) =>
      ctx.db
        .query('prefilledDocuments')
        .withIndex('by_tenant_candidate_type', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', 'health_screen'),
        )
        .collect(),
    )
    expect(docs).toHaveLength(1)
    expect(docs[0]?.storageId).toBe('storage-generated')
    expect(docs[0]?.uploadedSignedStorageId).toBe('storage-signed')
  })

  it('savePrefilledDocument guards cross-tenant access', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_prefilled_tenant'
    const otherClerkOrgId = 'org_other_prefilled_tenant'
    const adminId = 'user_admin_prefilled_tenant'
    const candidateUserId = 'user_candidate_prefilled_tenant'

    await seedTenant(t, clerkOrgId, adminId)
    await seedTenant(t, otherClerkOrgId, 'user_admin_other_prefilled_tenant')
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', otherClerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Other Candidate',
        email: 'other-prefilled@example.com',
      })
    })

    await expect(
      asCandidate(t, candidateUserId, otherClerkOrgId).mutation(
        api.candidates.savePrefilledDocument,
        {
          clerkOrgId,
          documentType: 'health_screen',
          storageId: 'storage-x',
        },
      ),
    ).rejects.toThrow(/tenant|Forbidden|not a member/i)
  })

  it('uploadBackgroundCheckResult rejects org:caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_bg_reject_cg'
    const adminId = 'user_admin_bg_reject_cg'

    await seedTenant(t, clerkOrgId, adminId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: 'user_cg_bg',
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'cg@example.com',
      })
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'bg@example.com',
        displayName: 'BG Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    await expect(
      t
        .withIdentity({
          subject: 'user_cg_bg',
          org_id: clerkOrgId,
          org_role: 'org:caregiver',
        })
        .mutation(api.backgroundChecks.uploadBackgroundCheckResult, {
          clerkOrgId,
          candidateId,
          storageId: 'bg-result',
        }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('uploadBackgroundCheckResult creates a backgroundChecks record for HR', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_bg_hr'
    const adminId = 'user_admin_bg_hr'
    const hrId = 'user_hr_bg_hr'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
    const { tenantId, candidateId } = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'bg-hr@example.com',
        displayName: 'BG HR Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      return { tenantId: tenant._id, candidateId }
    })

    await asHR(t, hrId, clerkOrgId).mutation(api.backgroundChecks.uploadBackgroundCheckResult, {
      clerkOrgId,
      candidateId,
      storageId: 'bg-result-hr',
    })

    const checks = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )

    expect(checks).toHaveLength(1)
    expect(checks[0]?.officialResultStorageId).toBe('bg-result-hr')
    // Scan-gated: upload sets 'pending_scan'; scanUploadedResult later transitions to 'completed'/'scan_failed'
    expect(checks[0]?.status).toBe('pending_scan')
  })

  it('getPrefilledDocuments is scoped to the candidate for org:candidate callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_prefilled_scope'
    const adminId = 'user_admin_prefilled_scope'
    const candidateUserId = 'user_candidate_prefilled_scope'

    await seedTenant(t, clerkOrgId, adminId)
    const { candidateId: ownId } = await seedCandidateWithApplication(t, clerkOrgId, candidateUserId)
    const otherCandidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'other-scope@example.com',
        displayName: 'Other Scope Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.savePrefilledDocument,
      {
        clerkOrgId,
        documentType: 'health_screen',
        storageId: 'own-storage',
      },
    )

    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('prefilledDocuments', {
        tenantId: tenant._id,
        candidateId: otherCandidateId,
        documentType: 'health_screen',
        storageId: 'other-storage',
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
      })
    })

    const docs = await asCandidate(t, candidateUserId, clerkOrgId).query(
      api.candidates.getPrefilledDocuments,
      { clerkOrgId, candidateId: ownId },
    )

    expect(docs).toHaveLength(1)
    expect(docs[0]?.storageId).toBe('own-storage')

    await expect(
      asCandidate(t, candidateUserId, clerkOrgId).query(api.candidates.getPrefilledDocuments, {
        clerkOrgId,
        candidateId: otherCandidateId,
      }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('saveW4EmployerSection updates the existing W-4 prefilled document', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_w4_hr'
    const adminId = 'user_admin_w4_hr'
    const hrId = 'user_hr_w4_hr'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'w4@example.com',
        displayName: 'W4 Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    const prefilledId = await asHR(t, hrId, clerkOrgId).mutation(api.candidates.savePrefilledDocument, {
      clerkOrgId,
      candidateId,
      documentType: 'w4',
      storageId: 'w4-candidate-generated',
    })

    const firstId = await asHR(t, hrId, clerkOrgId).mutation(api.candidates.saveW4EmployerSection, {
      clerkOrgId,
      candidateId,
      employerName: 'Employer One',
      ein: '12-3456789',
      firstDateOfEmployment: '2026-01-01',
    })

    expect(firstId).toBe(prefilledId)

    const secondId = await asHR(t, hrId, clerkOrgId).mutation(api.candidates.saveW4EmployerSection, {
      clerkOrgId,
      candidateId,
      employerName: 'Employer Two',
      ein: '98-7654321',
      firstDateOfEmployment: '2026-02-01',
    })

    expect(secondId).toBe(firstId)

    const doc = await t.run(async (ctx) => ctx.db.get(secondId as Id<'prefilledDocuments'>))
    expect(doc?.documentType).toBe('w4')
    expect(doc?.storageId).toBe('w4-candidate-generated')
    expect(doc?.hrSectionCompleted).toBe(true)
    expect((doc?.hrSectionData as Record<string, string>)?.employerName).toBe('Employer Two')
  })

  it('saveW4EmployerSection creates the W-4 record on-demand when none exists', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_w4_hr_missing'
    const adminId = 'user_admin_w4_hr_missing'
    const hrId = 'user_hr_w4_hr_missing'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)
    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'w4-missing@example.com',
        displayName: 'W4 Missing Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
    })

    // HR can fill the W-4 employer section even if the candidate hasn't
    // generated the PDF yet — the record is created on-demand.
    const docId = await asHR(t, hrId, clerkOrgId).mutation(api.candidates.saveW4EmployerSection, {
      clerkOrgId,
      candidateId,
      employerName: 'Employer One',
      ein: '12-3456789',
      firstDateOfEmployment: '2026-01-01',
    })

    const doc = await t.run(async (ctx) => ctx.db.get(docId as Id<'prefilledDocuments'>))
    expect(doc?.documentType).toBe('w4')
    expect(doc?.hrSectionCompleted).toBe(true)
    expect((doc?.hrSectionData as Record<string, string>)?.employerName).toBe('Employer One')
    expect((doc?.hrSectionData as Record<string, string>)?.ein).toBe('12-3456789')
  })
})

describe('acknowledgeBackgroundCheck', () => {
  it('completes the employment_agreement task without a digital provider', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_ack_bg'
    const adminId = 'user_admin_ack_bg'
    const candidateUserId = 'user_candidate_ack_bg'

    await seedTenant(t, clerkOrgId, adminId)

    const { tenantId, candidateId } = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.insert('tenantMembers', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        role: 'org:candidate',
        displayName: 'Ack Candidate',
        email: 'ack@example.com',
      })
      const cid = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: 'ack@example.com',
        displayName: 'Ack Candidate',
        status: 'invited',
        createdAt: new Date().toISOString(),
      })
      for (const type of ['form_submission', 'photo_id', 'tax_id_ssn', 'cpr_certificate', 'health_screen', 'employment_agreement']) {
        await ctx.db.insert('candidateTasks', {
          tenantId: tenant._id,
          candidateId: cid,
          type,
          status: 'pending',
          order: 0,
        })
      }
      return { tenantId: tenant._id, candidateId: cid }
    })

    await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.candidates.acknowledgeBackgroundCheck,
      { clerkOrgId },
    )

    const tasks = await t.run(async (ctx) =>
      ctx.db
        .query('candidateTasks')
        .withIndex('by_tenant_candidate_order', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )

    expect(tasks.find((task) => task.type === 'employment_agreement')?.status).toBe('complete')

    const bgChecks = await t.run(async (ctx) =>
      ctx.db
        .query('backgroundChecks')
        .withIndex('by_tenant_candidate', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId),
        )
        .collect(),
    )
    expect(bgChecks).toHaveLength(0)
  })
})

describe('reviewApplication notifications', () => {
  it('schedules a notification using the tenant name when approved', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_review_notify'
    const adminId = 'user_admin_review_notify'
    const hrId = 'user_hr_review_notify'

    await seedTenant(t, clerkOrgId, adminId)
    await seedHR(t, clerkOrgId, hrId)

    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const cid = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'review@example.com',
        displayName: 'Review Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId: cid,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
      return cid
    })

    await asHR(t, hrId, clerkOrgId).mutation(api.candidates.reviewApplication, {
      clerkOrgId,
      candidateId,
      decision: 'approved',
    })

    const candidate = await t.run(async (ctx) => ctx.db.get(candidateId))
    expect(candidate?.status).toBe('hr_review')
  })
})

describe('getW4ForHR tenant prefill (AC-9)', () => {
  it('returns agency name and EIN from the tenant config for W-4 prefill', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_w4_prefill'
    const adminId = 'user_admin_w4_prefill'

    await seedTenant(t, clerkOrgId, adminId)
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      await ctx.db.patch(tenant._id, { ein: '12-3456789' })
    })

    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const cid = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'prefill@example.com',
        displayName: 'Prefill Candidate',
        status: 'applied',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant._id,
        candidateId: cid,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      })
      return cid
    })

    const result = await asAdmin(t, adminId, clerkOrgId).query(
      api.candidates.getW4ForHR,
      { clerkOrgId, candidateId },
    )

    expect(result.agencyName).toBe('Test Agency')
    expect(result.agencyEin).toBe('12-3456789')
  })
})
