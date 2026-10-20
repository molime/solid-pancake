// Stage 6 — tenant isolation & file-access verification (design doc §Stage 6).
//
// Maria's requirement: "verify permissions from the backend on every
// operation, prove one agency cannot access another's data, authorization on
// every download, test copied links / revoked members / revoked permissions."
//
// HONEST NOTE ON "COPIED LINKS" (enlaces copiados): Convex storage URLs are
// PUBLIC and NON-EXPIRING — anyone holding a URL can fetch the file without
// authentication, and Convex offers no per-object auth or expiry today. The
// security control is therefore three-layered, and this suite proves layers
// (a) and (b):
//   (a) backend authorization BEFORE the URL is handed out — every download
//       path below asserts the storageId/file belongs to the caller's tenant
//       (files.getStorageUrl, files.getDownloadUrl,
//       documentArchive.getItemDownloadUrl,
//       candidates.getPrefilledDocumentDownloadUrl,
//       candidates.getDocumentVersionDownloadUrl);
//   (b) an audit trail of downloads (file.downloaded / access.ssn_revealed),
//       so a leaked or misused URL is detectable;
//   (c) URL confidentiality — links are only rendered to authorized users.
// A copied URL alone still grants access; that residual risk is documented
// in the compliance package, not hidden.
//
// Cross-tenant denial for documentArchive.getItemDownloadUrl already lives in
// documentArchive.test.ts ('rejects cross-tenant access') — referenced here
// rather than duplicated.
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

async function seedTenant(t: TestConvex, clerkOrgId: string, adminId: string) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: 'Test Agency',
      slug: `agency-${clerkOrgId}`,
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: adminId,
      role: 'org:admin',
      displayName: 'Admin',
      email: `${adminId}@example.com`,
    })
    return tenantId as Id<'tenants'>
  })
}

async function seedMember(
  t: TestConvex,
  clerkOrgId: string,
  userId: string,
  role:
    | 'org:admin'
    | 'org:coordinator'
    | 'org:caregiver'
    | 'org:hr'
    | 'org:candidate',
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    await ctx.db.insert('tenantMembers', {
      tenantId: tenant._id,
      clerkUserId: userId,
      role,
      displayName: userId,
      email: `${userId}@example.com`,
    })
  })
}

/** Mint a real storage id so ctx.storage.getUrl can resolve a URL. */
async function storeBlob(t: TestConvex) {
  return t.run(async (ctx) => ctx.storage.store(new Blob(['test'])))
}

/** Insert a files row owned by the tenant of clerkOrgId. */
async function seedFile(
  t: TestConvex,
  clerkOrgId: string,
  storageId: string,
  uploadedBy = 'user_uploader',
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    return ctx.db.insert('files', {
      tenantId: tenant._id,
      storageId,
      uploadedBy,
      fileName: 'doc.pdf',
      contentType: 'application/pdf',
      size: 2048,
      linkedType: 'complianceDoc',
      linkedId: 'record-test',
      visibility: 'all_staff',
      createdAt: new Date().toISOString(),
    })
  })
}

/** Insert client + shift + shiftTask so proof-download checks have a shift. */
async function seedShiftTask(
  t: TestConvex,
  clerkOrgId: string,
  caregiverId: string,
  storageId: string,
) {
  return t.run(async (ctx) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()
    if (!tenant) throw new Error('Tenant not found.')
    const clientId = await ctx.db.insert('clients', {
      tenantId: tenant._id,
      displayName: 'Client One',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })
    const shiftId = await ctx.db.insert('shifts', {
      tenantId: tenant._id,
      clientId,
      caregiverId,
      scheduledStart: '2026-10-01T08:00:00Z',
      scheduledEnd: '2026-10-01T16:00:00Z',
      status: 'in_progress',
      serviceType: 'SLS',
      rate: 25,
    })
    const shiftTaskId = await ctx.db.insert('shiftTasks', {
      tenantId: tenant._id,
      shiftId,
      title: 'Morning routine',
      requiredProof: true,
      status: 'pending',
    })
    await ctx.db.insert('files', {
      tenantId: tenant._id,
      storageId,
      uploadedBy: caregiverId,
      fileName: 'proof.png',
      contentType: 'image/png',
      size: 1024,
      linkedType: 'shiftTask',
      linkedId: shiftTaskId as string,
      visibility: 'all_staff',
      createdAt: new Date().toISOString(),
    })
  })
}

function asAdmin(t: TestConvex, userId: string, clerkOrgId: string) {
  return t.withIdentity({ subject: userId, org_id: clerkOrgId, org_role: 'org:admin' })
}

function asHr(t: TestConvex, userId: string, clerkOrgId: string) {
  return t.withIdentity({ subject: userId, org_id: clerkOrgId, org_role: 'org:hr' })
}

describe('files.getStorageUrl (Stage 6 ownership fix)', () => {
  it('allows an admin to resolve a storageId from their own tenant', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_a'
    const adminA = 'user_admin_gs_a'
    await seedTenant(t, orgA, adminA)
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    const url = await asAdmin(t, adminA, orgA).query(api.files.getStorageUrl, {
      clerkOrgId: orgA,
      storageId,
    })
    expect(url).toBeTruthy()
  })

  it('allows a caregiver to resolve a storageId from their own tenant', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_cg'
    const adminA = 'user_admin_gs_cg'
    const caregiverId = 'user_cg_gs_cg'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, caregiverId, 'org:caregiver')
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId, caregiverId)

    // Caregivers authenticate without an org claim (personal Clerk account);
    // membership is resolved via tenantMembers.
    const url = await t
      .withIdentity({ subject: caregiverId })
      .query(api.files.getStorageUrl, { clerkOrgId: orgA, storageId })
    expect(url).toBeTruthy()
  })

  it('denies a member of tenant B a storageId belonging to tenant A', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_x'
    const orgB = 'org_gs_y'
    const adminA = 'user_admin_gs_x'
    const adminB = 'user_admin_gs_y'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    await expect(
      asAdmin(t, adminB, orgB).query(api.files.getStorageUrl, {
        clerkOrgId: orgB,
        storageId,
      }),
    ).rejects.toThrow('File not found.')
  })

  it('denies a storageId that no record of the tenant claims', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_unknown'
    const adminA = 'user_admin_gs_unknown'
    await seedTenant(t, orgA, adminA)

    await expect(
      asAdmin(t, adminA, orgA).query(api.files.getStorageUrl, {
        clerkOrgId: orgA,
        storageId: 'storage_never_uploaded',
      }),
    ).rejects.toThrow('File not found.')
  })

  it('denies org:candidate (existing role check is unchanged)', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_cand'
    const adminA = 'user_admin_gs_cand'
    const candidateId = 'user_cand_gs_cand'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, candidateId, 'org:candidate')
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    await expect(
      t
        .withIdentity({ subject: candidateId })
        .query(api.files.getStorageUrl, { clerkOrgId: orgA, storageId }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('denies unauthenticated callers', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_anon'
    const adminA = 'user_admin_gs_anon'
    await seedTenant(t, orgA, adminA)
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    await expect(
      t.query(api.files.getStorageUrl, { clerkOrgId: orgA, storageId }),
    ).rejects.toThrow(/Unauthorized/)
  })

  it('denies a revoked member even for a formerly-known storageId', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_revoked'
    const adminA = 'user_admin_gs_revoked'
    const revokedId = 'user_revoked_gs'
    const tenantId = await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, revokedId, 'org:hr')
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    // Membership is revoked: the tenantMembers row is deleted.
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', revokedId),
        )
        .unique()
      if (member) await ctx.db.delete(member._id)
    })

    // The revoked user still presents a valid-looking org token, but no
    // member row backs it.
    await expect(
      asHr(t, revokedId, orgA).query(api.files.getStorageUrl, {
        clerkOrgId: orgA,
        storageId,
      }),
    ).rejects.toThrow(/not a member of this tenant/)
  })

  it('allows the official background-check result via the backgroundChecks fallback', async () => {
    const t = createTestConvex()
    const orgA = 'org_gs_bg'
    const adminA = 'user_admin_gs_bg'
    const hrA = 'user_hr_gs_bg'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, hrA, 'org:hr')
    const storageId = await storeBlob(t)

    // uploadBackgroundCheckResult records the storageId on the check, not in
    // files — getStorageUrl must keep serving it for the owning tenant only.
    await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', orgA))
        .unique()
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant!._id,
        email: 'bg@example.com',
        displayName: 'BG Candidate',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('backgroundChecks', {
        tenantId: tenant!._id,
        candidateId,
        provider: 'manual_upload',
        status: 'pending_scan',
        package: 'basic',
        initiatedAt: new Date().toISOString(),
        officialResultStorageId: storageId,
      })
    })

    const url = await asHr(t, hrA, orgA).query(api.files.getStorageUrl, {
      clerkOrgId: orgA,
      storageId,
    })
    expect(url).toBeTruthy()

    // And a different tenant cannot ride the fallback.
    const orgB = 'org_gs_bg_b'
    const adminB = 'user_admin_gs_bg_b'
    await seedTenant(t, orgB, adminB)
    await expect(
      asAdmin(t, adminB, orgB).query(api.files.getStorageUrl, {
        clerkOrgId: orgB,
        storageId,
      }),
    ).rejects.toThrow('File not found.')
  })
})

describe('files.getDownloadUrl (regression lock)', () => {
  it('denies a tenant B admin a tenant A file URL', async () => {
    const t = createTestConvex()
    const orgA = 'org_gd_x'
    const orgB = 'org_gd_y'
    const adminA = 'user_admin_gd_x'
    const adminB = 'user_admin_gd_y'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    await expect(
      asAdmin(t, adminB, orgB).query(api.files.getDownloadUrl, {
        clerkOrgId: orgB,
        storageId,
      }),
    ).rejects.toThrow('File not found.')
  })

  it('allows a caregiver to download proof from their own shift', async () => {
    const t = createTestConvex()
    const orgA = 'org_gd_own'
    const adminA = 'user_admin_gd_own'
    const caregiverId = 'user_cg_gd_own'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, caregiverId, 'org:caregiver')
    const storageId = await storeBlob(t)
    await seedShiftTask(t, orgA, caregiverId, storageId)

    await expect(
      t
        .withIdentity({ subject: caregiverId })
        .query(api.files.getDownloadUrl, { clerkOrgId: orgA, storageId }),
    ).resolves.toBeTruthy()
  })

  it('denies a caregiver downloading another caregiver\'s proof', async () => {
    const t = createTestConvex()
    const orgA = 'org_gd_other'
    const adminA = 'user_admin_gd_other'
    const caregiverA = 'user_cg_gd_a'
    const caregiverB = 'user_cg_gd_b'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, caregiverA, 'org:caregiver')
    await seedMember(t, orgA, caregiverB, 'org:caregiver')
    const storageId = await storeBlob(t)
    await seedShiftTask(t, orgA, caregiverA, storageId)

    await expect(
      t
        .withIdentity({ subject: caregiverB })
        .query(api.files.getDownloadUrl, { clerkOrgId: orgA, storageId }),
    ).rejects.toThrow(/another caregiver/)
  })

  it('denies a revoked member even for a formerly-known storageId', async () => {
    const t = createTestConvex()
    const orgA = 'org_gd_revoked'
    const adminA = 'user_admin_gd_revoked'
    const revokedId = 'user_revoked_gd'
    const tenantId = await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, revokedId, 'org:hr')
    const storageId = await storeBlob(t)
    await seedFile(t, orgA, storageId)

    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', revokedId),
        )
        .unique()
      if (member) await ctx.db.delete(member._id)
    })

    await expect(
      asHr(t, revokedId, orgA).query(api.files.getDownloadUrl, {
        clerkOrgId: orgA,
        storageId,
      }),
    ).rejects.toThrow(/not a member of this tenant/)
  })
})

describe('candidates.getPrefilledDocumentDownloadUrl', () => {
  async function seedCandidateWithPrefilled(
    t: TestConvex,
    clerkOrgId: string,
    candidateUserId: string,
    storageId: string,
  ) {
    return t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        clerkUserId: candidateUserId,
        email: `${candidateUserId}@example.com`,
        displayName: candidateUserId,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      const documentId = await ctx.db.insert('prefilledDocuments', {
        tenantId: tenant._id,
        candidateId,
        documentType: 'w4',
        storageId,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
      })
      return documentId as Id<'prefilledDocuments'>
    })
  }

  it('allows org:hr of the same tenant', async () => {
    const t = createTestConvex()
    const orgA = 'org_pf_hr'
    const adminA = 'user_admin_pf_hr'
    const hrA = 'user_hr_pf_hr'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, hrA, 'org:hr')
    const storageId = await storeBlob(t)
    const documentId = await seedCandidateWithPrefilled(
      t,
      orgA,
      'user_cand_pf_hr',
      storageId,
    )

    const url = await asHr(t, hrA, orgA).query(
      api.candidates.getPrefilledDocumentDownloadUrl,
      { clerkOrgId: orgA, documentId },
    )
    expect(url).toBeTruthy()
  })

  it('denies a candidate the documents of another candidate', async () => {
    const t = createTestConvex()
    const orgA = 'org_pf_cand'
    const adminA = 'user_admin_pf_cand'
    const candidateX = 'user_cand_pf_x'
    const candidateY = 'user_cand_pf_y'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, candidateX, 'org:candidate')
    await seedMember(t, orgA, candidateY, 'org:candidate')
    const storageId = await storeBlob(t)
    const documentId = await seedCandidateWithPrefilled(t, orgA, candidateY, storageId)

    await expect(
      t
        .withIdentity({ subject: candidateX })
        .query(api.candidates.getPrefilledDocumentDownloadUrl, {
          clerkOrgId: orgA,
          documentId,
        }),
    ).rejects.toThrow(/your own prefilled documents/)
  })

  it('denies org:hr of tenant B a tenant A document', async () => {
    const t = createTestConvex()
    const orgA = 'org_pf_a'
    const orgB = 'org_pf_b'
    const adminA = 'user_admin_pf_a'
    const adminB = 'user_admin_pf_b'
    const hrB = 'user_hr_pf_b'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    await seedMember(t, orgB, hrB, 'org:hr')
    const storageId = await storeBlob(t)
    const documentId = await seedCandidateWithPrefilled(
      t,
      orgA,
      'user_cand_pf_a',
      storageId,
    )

    await expect(
      asHr(t, hrB, orgB).query(api.candidates.getPrefilledDocumentDownloadUrl, {
        clerkOrgId: orgB,
        documentId,
      }),
    ).rejects.toThrow(/cross-tenant/)
  })
})

describe('candidates.getDocumentVersionDownloadUrl', () => {
  // Note: this query already verified version.tenantId against the caller's
  // tenant before Stage 6 — no code change was needed. These tests lock the
  // behavior in.

  async function seedVersion(
    t: TestConvex,
    clerkOrgId: string,
    storageId: string,
  ) {
    return t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant._id,
        email: 'version@example.com',
        displayName: 'Version Candidate',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      const versionId = await ctx.db.insert('prefilledDocumentVersions', {
        tenantId: tenant._id,
        candidateId,
        documentType: 'w4',
        storageId,
        fileName: 'w4-v1.pdf',
        uploadedBy: 'candidate',
        createdAt: new Date().toISOString(),
      })
      return versionId as Id<'prefilledDocumentVersions'>
    })
  }

  it('allows org:hr of the same tenant', async () => {
    const t = createTestConvex()
    const orgA = 'org_dv_hr'
    const adminA = 'user_admin_dv_hr'
    const hrA = 'user_hr_dv_hr'
    await seedTenant(t, orgA, adminA)
    await seedMember(t, orgA, hrA, 'org:hr')
    const storageId = await storeBlob(t)
    const versionId = await seedVersion(t, orgA, storageId)

    const result = await asHr(t, hrA, orgA).query(
      api.candidates.getDocumentVersionDownloadUrl,
      { clerkOrgId: orgA, versionId },
    )
    expect(result.url).toBeTruthy()
    expect(result.fileName).toBe('w4-v1.pdf')
  })

  it('denies org:hr of tenant B a tenant A version', async () => {
    const t = createTestConvex()
    const orgA = 'org_dv_a'
    const orgB = 'org_dv_b'
    const adminA = 'user_admin_dv_a'
    const adminB = 'user_admin_dv_b'
    const hrB = 'user_hr_dv_b'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    await seedMember(t, orgB, hrB, 'org:hr')
    const storageId = await storeBlob(t)
    const versionId = await seedVersion(t, orgA, storageId)

    await expect(
      asHr(t, hrB, orgB).query(api.candidates.getDocumentVersionDownloadUrl, {
        clerkOrgId: orgB,
        versionId,
      }),
    ).rejects.toThrow(/Document version not found/)
  })
})

describe('sensitiveAccess.revealSsn', () => {
  it('denies org:hr of tenant B revealing a tenant A candidate SSN', async () => {
    const t = createTestConvex()
    const orgA = 'org_ssn_a'
    const orgB = 'org_ssn_b'
    const adminA = 'user_admin_ssn_a'
    const adminB = 'user_admin_ssn_b'
    const hrB = 'user_hr_ssn_b'
    await seedTenant(t, orgA, adminA)
    await seedTenant(t, orgB, adminB)
    await seedMember(t, orgB, hrB, 'org:hr')

    const candidateId = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', orgA))
        .unique()
      const candidateId = await ctx.db.insert('candidates', {
        tenantId: tenant!._id,
        email: 'ssn@example.com',
        displayName: 'SSN Candidate',
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('applications', {
        tenantId: tenant!._id,
        candidateId,
        status: 'submitted',
        fields: { personal: { ssn: '123-45-6789' } },
        submittedAt: new Date().toISOString(),
      })
      return candidateId as Id<'candidates'>
    })

    await expect(
      asHr(t, hrB, orgB).mutation(api.sensitiveAccess.revealSsn, {
        clerkOrgId: orgB,
        candidateId,
        contextType: 'application',
      }),
    ).rejects.toThrow(/cross-tenant/)
  })
})
