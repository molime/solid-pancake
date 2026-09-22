import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const ORG = 'org_doc_versions'
const ADMIN = { subject: 'user_dv_admin' }
const CANDIDATE = { subject: 'user_dv_candidate' }
const OUTSIDER = { subject: 'user_dv_outsider' }

async function seedTenantWithCandidate(t: ReturnType<typeof createTestConvex>) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: ORG,
      name: 'Version Agency',
      slug: 'version-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN.subject,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: CANDIDATE.subject,
      role: 'org:candidate',
      displayName: 'Candidate',
      email: 'candidate@example.com',
    })
    const candidateId = await ctx.db.insert('candidates', {
      tenantId,
      clerkUserId: CANDIDATE.subject,
      displayName: 'Candidate',
      email: 'candidate@example.com',
      status: 'applied',
      source: 'invitation',
      createdAt: new Date().toISOString(),
    })
    return { tenantId, candidateId }
  })
}

describe('document versions', () => {
  it('candidate uploads versions of their own document and history grows', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t)

    await t.withIdentity(CANDIDATE).mutation(api.candidates.uploadDocumentVersion, {
      clerkOrgId: ORG,
      candidateId,
      documentType: 'soc_341a',
      storageId: 'storage_v1',
      fileName: 'soc341a_v1.pdf',
    })
    await t.withIdentity(CANDIDATE).mutation(api.candidates.uploadDocumentVersion, {
      clerkOrgId: ORG,
      candidateId,
      documentType: 'soc_341a',
      storageId: 'storage_v2',
      fileName: 'soc341a_v2.pdf',
    })

    const versions = await t.withIdentity(CANDIDATE).query(
      api.candidates.listDocumentVersions,
      { clerkOrgId: ORG, candidateId, documentType: 'soc_341a' },
    )
    expect(versions).toHaveLength(2)
    expect(versions[0].storageId).toBe('storage_v2')
    expect(versions[0].uploadedBy).toBe('candidate')
    expect(versions[1].storageId).toBe('storage_v1')

    // The latest upload is mirrored onto prefilledDocuments.
    const tenantId = await t.run(async (ctx) => (await ctx.db.get(candidateId))!.tenantId)
    const prefilled = await t.run(async (ctx) =>
      ctx.db
        .query('prefilledDocuments')
        .withIndex('by_tenant_candidate_type', (q) =>
          q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('documentType', 'soc_341a' as never),
        )
        .unique(),
    )
    expect(prefilled?.uploadedSignedStorageId).toBe('storage_v2')
  })

  it('HR can upload a version on behalf of a candidate, marked uploadedBy hr', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t)

    await t.withIdentity(ADMIN).mutation(api.candidates.uploadDocumentVersion, {
      clerkOrgId: ORG,
      candidateId,
      documentType: 'lic_501',
      storageId: 'storage_hr1',
      fileName: 'lic501_hr.pdf',
    })

    const versions = await t.withIdentity(ADMIN).query(
      api.candidates.listDocumentVersions,
      { clerkOrgId: ORG, candidateId },
    )
    expect(versions).toHaveLength(1)
    expect(versions[0].uploadedBy).toBe('hr')
  })

  it('rejects self-upload for another candidate and rejects outsiders', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t)

    // Candidate trying to upload for... themselves is fine, but an outsider
    // with no role must be rejected.
    await expect(
      t.withIdentity(OUTSIDER).mutation(api.candidates.uploadDocumentVersion, {
        clerkOrgId: ORG,
        candidateId,
        documentType: 'soc_341a',
        storageId: 'storage_x',
        fileName: 'x.pdf',
      }),
    ).rejects.toThrow()

    // Candidate cannot list another candidate's versions.
    const tenantId2 = await t.run(async (ctx) => (await ctx.db.get(candidateId))!.tenantId)
    const otherCandidateId = await t.run(async (ctx) =>
      ctx.db.insert('candidates', {
        tenantId: tenantId2,
        clerkUserId: 'user_other_person',
        displayName: 'Other',
        email: 'other@example.com',
        status: 'applied',
        source: 'invitation',
        createdAt: new Date().toISOString(),
      }),
    )
    await expect(
      t.withIdentity(CANDIDATE).query(api.candidates.listDocumentVersions, {
        clerkOrgId: ORG,
        candidateId: otherCandidateId,
      }),
    ).rejects.toThrow()
  })

  it('getDocumentVersionDownloadUrl returns the storage url with access rules', async () => {
    const t = createTestConvex()
    const { candidateId } = await seedTenantWithCandidate(t)

    const realStorageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(['fake-pdf-bytes'], { type: 'application/pdf' })),
    )
    const versionId = await t.withIdentity(CANDIDATE).mutation(
      api.candidates.uploadDocumentVersion,
      {
        clerkOrgId: ORG,
        candidateId,
        documentType: 'i9_form',
        storageId: realStorageId,
        fileName: 'i9.pdf',
      },
    )

    const result = await t.withIdentity(CANDIDATE).query(
      api.candidates.getDocumentVersionDownloadUrl,
      { clerkOrgId: ORG, versionId: versionId as Id<'prefilledDocumentVersions'> },
    )
    expect(result.fileName).toBe('i9.pdf')
    expect(result.uploadedBy).toBe('candidate')
    expect(typeof result.url).toBe('string')

    await expect(
      t.withIdentity(OUTSIDER).query(api.candidates.getDocumentVersionDownloadUrl, {
        clerkOrgId: ORG,
        versionId: versionId as Id<'prefilledDocumentVersions'>,
      }),
    ).rejects.toThrow()
  })
})
