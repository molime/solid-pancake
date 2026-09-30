import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

async function seed(t: ReturnType<typeof createTestConvex>) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: 'org_perf',
      name: 'Perf Agency',
      slug: 'perf-agency',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: 'user_admin_perf',
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: 'user_coord_perf',
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coord@example.com',
    })
    return { tenantId }
  })
}

describe('reporting.getEmployeePerformance', () => {
  it('returns per-coordinator visit, rounds and caseload stats', async () => {
    const t = createTestConvex()
    const { tenantId } = await seed(t)
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: 'user_cg_perf',
        displayName: 'Caregiver',
        email: 'cg@example.com',
        adpSyncStatus: 'pending_credentials',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('supervisionRecords', {
        tenantId,
        employeeProfileId: profileId,
        kind: 'supervision',
        occurredAt: new Date().toISOString(),
        summary: 'Check-in visit',
        recordedBy: 'user_coord_perf',
        createdAt: new Date().toISOString(),
      })
      const fileId = await ctx.db.insert('files', {
        tenantId,
        storageId: 'st_1',
        uploadedBy: 'user_cg_perf',
        fileName: 'cpr.pdf',
        contentType: 'application/pdf',
        size: 100,
        linkedType: 'complianceDoc',
        linkedId: profileId as string,
        visibility: 'admins_coordinators',
        createdAt: new Date().toISOString(),
      })
      await ctx.db.insert('documentArchiveItems', {
        tenantId,
        fileId,
        subjectType: 'employee',
        subjectId: profileId as string,
        category: 'cpr_certificate',
        status: 'verified',
        createdAt: new Date().toISOString(),
      })
    })

    const rows = await t
      .withIdentity({ subject: 'user_admin_perf', org_id: 'org_perf', org_role: 'org:admin' })
      .query(api.reporting.getEmployeePerformance, { clerkOrgId: 'org_perf' })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Coordinator')
    expect(rows[0].roundsThisMonth).toBe(1)
    expect(rows[0].caseloadSize).toBe(1)
    expect(rows[0].caseloadCompliance).toBe(100)
    expect(rows[0].weeklyVisits).toHaveLength(4)
  })
})
