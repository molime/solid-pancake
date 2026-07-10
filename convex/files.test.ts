import { describe, expect, it, afterEach } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import { assertCanEditProof } from './files'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
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

async function seedCandidate(
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
      displayName: 'Candidate',
      email: 'candidate@example.com',
    })
  })
}

function asCandidate(
  t: ReturnType<typeof createTestConvex>,
  candidateUserId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: candidateUserId,
    org_id: clerkOrgId,
    org_role: 'org:candidate',
  })
}

afterEach(() => {
  // convexTest isolates state per test file; no cleanup needed here.
})

describe('files authorization', () => {
  it('allows caregivers to edit proof on their own in-progress shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'in_progress' },
      }),
    ).not.toThrow()
  })

  it('allows caregivers to edit proof on their own needs_correction shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'needs_correction' },
      }),
    ).not.toThrow()
  })

  it('rejects caregiver editing another caregiver shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'in_progress' },
      }),
    ).toThrow('Forbidden: caregivers can only edit proof on their own shifts.')
  })

  it('rejects caregiver editing proof on submitted shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:caregiver',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-1', status: 'submitted' },
      }),
    ).toThrow('Forbidden: proof can only be edited for shifts in progress or needing correction.')
  })

  it('allows admin to edit proof on any shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:admin',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'submitted' },
      }),
    ).not.toThrow()
  })

  it('allows coordinator to edit proof on any shift', () => {
    expect(() =>
      assertCanEditProof({
        role: 'org:coordinator',
        identitySubject: 'user-1',
        shift: { caregiverId: 'user-2', status: 'billing_ready' },
      }),
    ).not.toThrow()
  })
})

describe('generateUploadUrl', () => {
  it('succeeds for org:candidate', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_upload_candidate'
    const adminId = 'user_admin_upload'
    const candidateUserId = 'user_candidate_upload'

    await seedTenant(t, clerkOrgId, adminId)
    await seedCandidate(t, clerkOrgId, candidateUserId)

    const result = await asCandidate(t, candidateUserId, clerkOrgId).mutation(
      api.files.generateUploadUrl,
      { clerkOrgId },
    )

    expect(result.url).toBeDefined()
    expect(result.tenantId).toBeDefined()
  })

  it('rejects callers with an unknown tenant role', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_upload_unknown'
    const adminId = 'user_admin_upload_unknown'

    await seedTenant(t, clerkOrgId, adminId)

    await expect(
      t
        .withIdentity({
          subject: 'user_unknown',
          org_id: clerkOrgId,
          org_role: 'org:member',
        })
        .mutation(api.files.generateUploadUrl, { clerkOrgId }),
    ).rejects.toThrow()
  })

  it('rejects cross-tenant callers', async () => {
    const t = createTestConvex()
    const orgA = 'org_upload_a'
    const orgB = 'org_upload_b'
    const adminA = 'user_admin_upload_a'
    const adminB = 'user_admin_upload_b'

    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)

    await expect(
      t.withIdentity({ subject: adminB, org_id: orgB, org_role: 'org:admin' }).mutation(
        api.files.generateUploadUrl,
        { clerkOrgId: orgA },
      ),
    ).rejects.toThrow()
  })
})
