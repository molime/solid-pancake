import { describe, expect, it, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { categoryForAction } from './_utils/auditCategories'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

type TestConvex = ReturnType<typeof createTestConvex>

const ORG_A = 'org_audit_cat_a'
const ORG_B = 'org_audit_cat_b'
const ADMIN_ID = 'user_admin_audit_cat'
const ACTOR_ID = 'user_actor_audit_cat'

function asAdmin(t: TestConvex, clerkOrgId = ORG_A, subject = ADMIN_ID) {
  return t.withIdentity({
    subject,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

async function seedTenant(
  t: TestConvex,
  clerkOrgId: string,
  name: string,
  members: Array<{
    clerkUserId: string
    role: 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr' | 'org:candidate'
    displayName: string
  }> = [],
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: ADMIN_ID,
      role: 'org:admin',
      displayName: 'Admin',
      email: 'admin@example.com',
    })
    for (const m of members) {
      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: m.clerkUserId,
        role: m.role,
        displayName: m.displayName,
        email: `${m.clerkUserId}@example.com`,
      })
    }
    return tenantId
  })
}

async function insertAuditEvent(
  t: TestConvex,
  tenantId: Id<'tenants'>,
  action: string,
  createdAt = new Date().toISOString(),
) {
  return t.run(async (ctx) => {
    return ctx.db.insert('auditEvents', {
      tenantId,
      actorId: ACTOR_ID,
      actorRole: 'org:admin',
      action,
      category: categoryForAction(action),
      createdAt,
    })
  })
}

describe('categoryForAction', () => {
  it.each([
    ['shift.created', 'shifts'],
    ['shift_clocked_in', 'shifts'],
    ['timeclock_synced', 'shifts'],
    ['invoice_created', 'billing'],
    ['billing_exported', 'billing'],
    ['payroll_exported_csv', 'billing'],
    ['candidate.hired', 'candidates'],
    ['candidate_invited', 'candidates'],
    ['compliance_override_applied', 'compliance'],
    ['credential_pack_applied', 'compliance'],
    ['legal_hold_updated', 'compliance'],
    ['incident_created', 'incidents'],
    ['grievance_filed', 'incidents'],
    ['hrCase.status_updated', 'hr'],
    ['member.role_changed', 'hr'],
    ['member.removed', 'hr'],
    ['file.downloaded', 'files'],
    ['data.exported', 'exports'],
    ['support_access_requested', 'access'],
    ['tenant_created', 'platform'],
    ['invoice_paid', 'billing'],
    ['access_control.role_granted', 'access_control'],
    ['data_lifecycle.purge_executed', 'data_lifecycle'],
    ['agency_settings_updated', 'platform'],
    ['something_unmapped', 'other'],
  ])('maps %s to %s', (action, expected) => {
    expect(categoryForAction(action)).toBe(expected)
  })

  it('is case-insensitive', () => {
    expect(categoryForAction('Shift_Approved')).toBe('shifts')
  })
})

describe('audit.record category', () => {
  it('derives the category from the action', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A')

    await asAdmin(t).mutation(internal.audit.record, {
      clerkOrgId: ORG_A,
      action: 'shift.created',
    })

    const events = await asAdmin(t).query(api.audit.list, { clerkOrgId: ORG_A })
    expect(events).toHaveLength(1)
    expect(events[0]?.category).toBe('shifts')
  })

  it('honors an explicit category override', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A')

    await asAdmin(t).mutation(internal.audit.record, {
      clerkOrgId: ORG_A,
      action: 'custom.thing',
      category: 'compliance',
    })

    const events = await asAdmin(t).query(api.audit.list, { clerkOrgId: ORG_A })
    expect(events[0]?.category).toBe('compliance')
  })
})

describe('audit.list filters', () => {
  it('filters by category', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A')
    await insertAuditEvent(t, tenantId, 'shift.created')
    await insertAuditEvent(t, tenantId, 'invoice_created')
    await insertAuditEvent(t, tenantId, 'invoice_paid')

    const events = await asAdmin(t).query(api.audit.list, {
      clerkOrgId: ORG_A,
      category: 'billing',
    })
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.category === 'billing')).toBe(true)
  })

  it('filters by actorName (case-insensitive substring)', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A', [
      { clerkUserId: ACTOR_ID, role: 'org:caregiver', displayName: 'Samira Care' },
    ])
    await insertAuditEvent(t, tenantId, 'shift.created')

    const events = await asAdmin(t).query(api.audit.list, {
      clerkOrgId: ORG_A,
      actorName: 'samira',
    })
    expect(events).toHaveLength(1)

    const none = await asAdmin(t).query(api.audit.list, {
      clerkOrgId: ORG_A,
      actorName: 'nobody',
    })
    expect(none).toHaveLength(0)
  })
})

describe('file.downloaded audit event', () => {
  it('writes a file.downloaded event via recordFileDownload', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A')

    // The download-URL generators are read-only queries, so the frontend
    // records the download from the click handler via this mutation.
    await asAdmin(t).mutation(api.audit.recordFileDownload, {
      clerkOrgId: ORG_A,
      fileName: 'proof.pdf',
      contentType: 'application/pdf',
      linkedType: 'shiftTask',
      linkedId: 'task-1',
    })

    const events = await asAdmin(t).query(api.audit.list, {
      clerkOrgId: ORG_A,
      category: 'files',
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.action).toBe('file.downloaded')
    expect(events[0]?.metadata?.fileName).toBe('proof.pdf')
    expect(events[0]?.metadata?.linkedType).toBe('shiftTask')
  })
})

describe('member audit events', () => {
  it('writes member.role_changed with old and new roles', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A', [
      { clerkUserId: ACTOR_ID, role: 'org:coordinator', displayName: 'Samira' },
    ])

    await asAdmin(t).mutation(api.members.updateRole, {
      clerkOrgId: ORG_A,
      clerkUserId: ACTOR_ID,
      role: 'org:hr',
    })

    const events = await asAdmin(t).query(api.audit.list, {
      clerkOrgId: ORG_A,
      category: 'hr',
    })
    const roleChange = events.find((e) => e.action === 'member.role_changed')
    expect(roleChange).toBeDefined()
    expect(roleChange?.metadata?.oldRole).toBe('org:coordinator')
    expect(roleChange?.metadata?.newRole).toBe('org:hr')
  })

  it('writes member.removed with member email', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A', [
      { clerkUserId: ACTOR_ID, role: 'org:caregiver', displayName: 'Samira' },
    ])

    await asAdmin(t).mutation(api.members.remove, {
      clerkOrgId: ORG_A,
      clerkUserId: ACTOR_ID,
    })

    const events = await asAdmin(t).query(api.audit.list, { clerkOrgId: ORG_A })
    const removed = events.find((e) => e.action === 'member.removed')
    expect(removed).toBeDefined()
    expect(removed?.metadata?.email).toBe(`${ACTOR_ID}@example.com`)
  })

  it('still denies cross-tenant admins', async () => {
    const t = createTestConvex()
    await seedTenant(t, ORG_A, 'Agency A')
    const adminB = 'user_admin_audit_cat_b'
    await seedTenant(t, ORG_B, 'Agency B', [
      { clerkUserId: adminB, role: 'org:admin', displayName: 'Admin B' },
    ])

    await expect(
      asAdmin(t, ORG_A, adminB).query(api.audit.list, { clerkOrgId: ORG_A }),
    ).rejects.toThrow('Forbidden')
  })
})

describe('securityMonitoring.checkSuspiciousActivity', () => {
  async function countSecurityAlerts(
    t: TestConvex,
    tenantId: Id<'tenants'>,
  ): Promise<number> {
    return t.run(async (ctx) => {
      const rows = await ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect()
      return rows.filter((r) => r.type === 'security_alert').length
    })
  }

  // notifyTenantStaff delivers via the scheduler, so the tests advance
  // fake timers and drain all scheduled functions (convex-test pattern).
  async function runMonitoring(t: TestConvex) {
    vi.useFakeTimers()
    try {
      const result = await t.mutation(
        internal.securityMonitoring.checkSuspiciousActivity,
        {},
      )
      await t.finishAllScheduledFunctions(() => vi.runAllTimers())
      return result
    } finally {
      vi.useRealTimers()
    }
  }

  it('notifies org:admin when override events spike, then dedupes', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A')
    await insertAuditEvent(t, tenantId, 'compliance_override_applied')
    await insertAuditEvent(t, tenantId, 'billing_block_override_applied')
    await insertAuditEvent(t, tenantId, 'compliance_override')

    const first = await runMonitoring(t)
    expect(first.notified).toBe(1)
    expect(await countSecurityAlerts(t, tenantId)).toBe(1)

    // Second run the same day is deduped.
    const second = await runMonitoring(t)
    expect(second.notified).toBe(0)
    expect(await countSecurityAlerts(t, tenantId)).toBe(1)
  })

  it('stays silent below thresholds', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A')
    // Two overrides (< 3), no support access, no exports.
    await insertAuditEvent(t, tenantId, 'compliance_override_applied')
    await insertAuditEvent(t, tenantId, 'billing_block_override_applied')
    // Ordinary events never trigger.
    await insertAuditEvent(t, tenantId, 'shift.created')
    await insertAuditEvent(t, tenantId, 'invoice_created')

    const result = await runMonitoring(t)
    expect(result.notified).toBe(0)
    expect(await countSecurityAlerts(t, tenantId)).toBe(0)
  })

  it('notifies on support access events and export bursts', async () => {
    const t = createTestConvex()
    const tenantId = await seedTenant(t, ORG_A, 'Agency A')
    await insertAuditEvent(t, tenantId, 'support_access_requested')
    for (let i = 0; i < 5; i++) {
      await insertAuditEvent(t, tenantId, 'data.exported')
    }

    const result = await runMonitoring(t)
    expect(result.notified).toBe(1)

    const alerts = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query('notifications')
        .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
        .collect()
      return rows.filter((r) => r.type === 'security_alert')
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.clerkUserId).toBe(ADMIN_ID)
    expect(alerts[0]?.message).toContain('support access')
    expect(alerts[0]?.message).toContain('data export')
  })
})
