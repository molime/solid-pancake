import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

const PLATFORM_ADMIN = { subject: 'platform_admin_1' }

async function seedPlatformAdmin(t: ReturnType<typeof createTestConvex>) {
  await t.run(async (ctx) => {
    await ctx.db.insert('platformAdmins', {
      clerkUserId: PLATFORM_ADMIN.subject,
      createdAt: new Date().toISOString(),
    })
  })
}

async function seedTenantWithMember(
  t: ReturnType<typeof createTestConvex>,
  clerkOrgId: string,
  clerkUserId: string,
  role: 'org:admin' | 'org:coordinator' | 'org:caregiver',
) {
  return await t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId,
      name: `Agency ${clerkOrgId}`,
      slug: clerkOrgId,
      createdAt: new Date().toISOString(),
    })
    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId,
      role,
      displayName: `User ${clerkUserId}`,
      email: `${clerkUserId}@example.com`,
    })
    return tenantId
  })
}

function asOrgUser(clerkUserId: string, clerkOrgId: string, role: string) {
  return { subject: clerkUserId, org_id: clerkOrgId, org_role: role }
}

const createArgs = {
  subject: 'Cannot bill client',
  description: 'The invoice total looks wrong.',
  category: 'billing' as const,
  priority: 'normal' as const,
}

describe('supportTickets.create', () => {
  it('lets an org admin create a ticket stamped open', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')

    const ticketId = await t
      .withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
      .mutation(api.supportTickets.create, { clerkOrgId: 'org_a', ...createArgs })

    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.status).toBe('open')
    expect(ticket?.createdByUserId).toBe('user_admin_a')
    expect(ticket?.createdByName).toBe('User user_admin_a')
    expect(ticket?.createdAt).toBeTruthy()
    expect(ticket?.updatedAt).toBe(ticket?.createdAt)

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    const created = audits.filter(
      (event) => event.action === 'support_ticket_created',
    )
    expect(created).toHaveLength(1)
    expect(created[0].metadata?.ticketId).toBe(ticketId)
  })

  it('lets a coordinator create a ticket', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_coord_a', 'org:coordinator')

    await t
      .withIdentity(asOrgUser('user_coord_a', 'org_a', 'org:coordinator'))
      .mutation(api.supportTickets.create, { clerkOrgId: 'org_a', ...createArgs })

    const tickets = await t.run(async (ctx) =>
      ctx.db.query('supportTickets').collect(),
    )
    expect(tickets).toHaveLength(1)
  })

  it('rejects caregivers server-side', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_cg_a', 'org:caregiver')

    await expect(
      t
        .withIdentity(asOrgUser('user_cg_a', 'org_a', 'org:caregiver'))
        .mutation(api.supportTickets.create, {
          clerkOrgId: 'org_a',
          ...createArgs,
        }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('supportTickets.listMine', () => {
  it('returns only the caller tenant tickets, newest first', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')
    await seedTenantWithMember(t, 'org_b', 'user_admin_b', 'org:admin')

    const asA = t.withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
    await t.run(async (ctx) => {
      const tenantA = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', 'org_a'))
        .unique()
      const tenantB = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', 'org_b'))
        .unique()
      const base = {
        subject: 'x',
        description: 'y',
        category: 'other' as const,
        priority: 'low' as const,
        status: 'open' as const,
        createdByUserId: 'user_admin_a',
        createdByName: 'A',
      }
      await ctx.db.insert('supportTickets', {
        ...base,
        tenantId: tenantA!._id,
        subject: 'older',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      })
      await ctx.db.insert('supportTickets', {
        ...base,
        tenantId: tenantA!._id,
        subject: 'newer',
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      })
      await ctx.db.insert('supportTickets', {
        ...base,
        tenantId: tenantB!._id,
        subject: 'other tenant',
        createdAt: '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-08-03T00:00:00.000Z',
      })
    })

    const mine = await asA.query(api.supportTickets.listMine, {
      clerkOrgId: 'org_a',
    })
    expect(mine.map((ticket) => ticket.subject)).toEqual(['newer', 'older'])
  })

  it('rejects cross-tenant reads', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')
    await seedTenantWithMember(t, 'org_b', 'user_admin_b', 'org:admin')

    // Active org is org_a but the request targets org_b.
    await expect(
      t
        .withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
        .query(api.supportTickets.listMine, { clerkOrgId: 'org_b' }),
    ).rejects.toThrow(/Forbidden/)

    // Caregivers cannot list either.
    await seedTenantWithMember(t, 'org_c', 'user_cg_c', 'org:caregiver')
    await expect(
      t
        .withIdentity(asOrgUser('user_cg_c', 'org_c', 'org:caregiver'))
        .query(api.supportTickets.listMine, { clerkOrgId: 'org_c' }),
    ).rejects.toThrow(/Forbidden/)
  })
})

describe('supportTickets platform side', () => {
  async function seedTicket(t: ReturnType<typeof createTestConvex>) {
    await seedPlatformAdmin(t)
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')
    return await t
      .withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
      .mutation(api.supportTickets.create, { clerkOrgId: 'org_a', ...createArgs })
  }

  it('listAll requires platform admin and joins tenant info', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)

    await expect(
      t
        .withIdentity({ subject: 'user_admin_a' })
        .query(api.supportTickets.listAll, {}),
    ).rejects.toThrow(/platform admin access required/i)

    const all = await t
      .withIdentity(PLATFORM_ADMIN)
      .query(api.supportTickets.listAll, {})
    expect(all).toHaveLength(1)
    expect(all[0]._id).toBe(ticketId)
    expect(all[0].tenantName).toBe('Agency org_a')
    expect(all[0].tenantSlug).toBe('org_a')

    const openOnly = await t
      .withIdentity(PLATFORM_ADMIN)
      .query(api.supportTickets.listAll, { status: 'open' })
    expect(openOnly).toHaveLength(1)
    const resolvedOnly = await t
      .withIdentity(PLATFORM_ADMIN)
      .query(api.supportTickets.listAll, { status: 'resolved' })
    expect(resolvedOnly).toHaveLength(0)
  })

  it('setStatus transitions the ticket and audits', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    // Ensure the updatedAt timestamp is distinguishable from createdAt.
    await new Promise((resolve) => setTimeout(resolve, 5))
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'in_progress',
    })
    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.status).toBe('in_progress')
    expect(ticket?.updatedAt).not.toBe(ticket?.createdAt)

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      audits.some(
        (event) => event.action === 'support_ticket_status_updated',
      ),
    ).toBe(true)
  })

  it('setStatus rejects invalid status values and non-admins', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)

    await expect(
      t.withIdentity(PLATFORM_ADMIN).mutation(api.supportTickets.setStatus, {
        ticketId,
        // Argument validation rejects values outside the status union.
        status: 'bogus' as never,
      }),
    ).rejects.toThrow()

    await expect(
      t
        .withIdentity({ subject: 'user_admin_a' })
        .mutation(api.supportTickets.setStatus, {
          ticketId,
          status: 'resolved',
        }),
    ).rejects.toThrow(/platform admin access required/i)
  })

  it('setStatus enforces the lifecycle and rejects invalid transitions', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    // open → resolved skips in_progress: rejected.
    await expect(
      asAdmin.mutation(api.supportTickets.setStatus, {
        ticketId,
        status: 'resolved',
      }),
    ).rejects.toThrow(/invalid status transition/i)

    // Same-status is an idempotent no-op.
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'open',
    })

    // Valid forward path: open → in_progress → resolved → closed.
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'in_progress',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'resolved',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'closed',
    })

    // closed is terminal: closed → open is rejected.
    await expect(
      asAdmin.mutation(api.supportTickets.setStatus, {
        ticketId,
        status: 'open',
      }),
    ).rejects.toThrow(/invalid status transition/i)

    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.status).toBe('closed')
  })

  it('setStatus allows the documented reopen paths and direct close', async () => {
    const t = createTestConvex()
    await seedPlatformAdmin(t)
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)
    const asA = t.withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
    const makeTicket = () =>
      asA.mutation(api.supportTickets.create, { clerkOrgId: 'org_a', ...createArgs })

    // in_progress → open (reopen) and open → closed (direct close).
    const directClose = await makeTicket()
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: directClose,
      status: 'in_progress',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: directClose,
      status: 'open',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: directClose,
      status: 'closed',
    })

    // resolved → in_progress (reopen after resolution).
    const reopenResolved = await makeTicket()
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: reopenResolved,
      status: 'in_progress',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: reopenResolved,
      status: 'resolved',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId: reopenResolved,
      status: 'in_progress',
    })

    const tickets = await t.run(async (ctx) =>
      ctx.db.query('supportTickets').collect(),
    )
    const byId = new Map(tickets.map((ticket) => [ticket._id, ticket.status]))
    expect(byId.get(directClose)).toBe('closed')
    expect(byId.get(reopenResolved)).toBe('in_progress')
  })

  it('create enforces subject/description length limits', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')
    const asA = t.withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))

    await expect(
      asA.mutation(api.supportTickets.create, {
        clerkOrgId: 'org_a',
        ...createArgs,
        subject: '   ',
      }),
    ).rejects.toThrow(/subject/i)

    await expect(
      asA.mutation(api.supportTickets.create, {
        clerkOrgId: 'org_a',
        ...createArgs,
        subject: 'x'.repeat(201),
      }),
    ).rejects.toThrow(/subject/i)

    await expect(
      asA.mutation(api.supportTickets.create, {
        clerkOrgId: 'org_a',
        ...createArgs,
        description: 'x'.repeat(5001),
      }),
    ).rejects.toThrow(/description/i)
  })

  it('addNote enforces the note length limit', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    await expect(
      asAdmin.mutation(api.supportTickets.addNote, {
        ticketId,
        note: '  ',
      }),
    ).rejects.toThrow(/note/i)

    await expect(
      asAdmin.mutation(api.supportTickets.addNote, {
        ticketId,
        note: 'x'.repeat(2001),
      }),
    ).rejects.toThrow(/note/i)
  })

  it('addNote appends platform notes and audits', async () => {
    const t = createTestConvex()
    const ticketId = await seedTicket(t)
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    await asAdmin.mutation(api.supportTickets.addNote, {
      ticketId,
      note: 'Called the agency.',
    })
    await asAdmin.mutation(api.supportTickets.addNote, {
      ticketId,
      note: 'Waiting on their reply.',
    })

    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.platformNotes).toBe('Called the agency.\nWaiting on their reply.')

    const audits = await t.run(async (ctx) =>
      ctx.db.query('auditEvents').collect(),
    )
    expect(
      audits.filter((event) => event.action === 'support_ticket_note_added'),
    ).toHaveLength(2)
  })
})
