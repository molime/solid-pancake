import { describe, expect, it, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import {
  SUPPORT_ALERT_RECIPIENTS,
  buildTicketCreatedEmail,
} from './supportTickets'

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

describe('support ticket email alerts', () => {
  it('alerts both Atria inboxes', () => {
    expect([...SUPPORT_ALERT_RECIPIENTS]).toEqual([
      'development@atriaxsolutions.com',
      'hello@atriaxsolutions.com',
    ])
  })

  it('builds an email with the ticket context and escapes HTML', () => {
    const { subject, html } = buildTicketCreatedEmail({
      subject: 'Cannot bill <script>alert(1)</script>',
      description: 'Line one\nLine "two" & more',
      category: 'billing',
      priority: 'high',
      createdByName: 'Samira <Owner>',
      tenantName: 'Golden Ages',
      ticketId: 'ticket_123',
    })
    expect(subject).toBe(
      '[ATRIA-X Support] New high ticket from Golden Ages: Cannot bill <script>alert(1)</script>',
    )
    expect(html).toContain('Golden Ages')
    expect(html).toContain('Samira &lt;Owner&gt;')
    expect(html).toContain('billing')
    expect(html).toContain('high')
    expect(html).toContain('ticket_123')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Line one<br>Line &quot;two&quot; &amp; more')
    expect(html).not.toContain('<script>')
  })

  it('creating a ticket schedules the alert sends without failing creation', async () => {
    const t = createTestConvex()
    await seedTenantWithMember(t, 'org_a', 'user_admin_a', 'org:admin')

    const ticketId = await t
      .withIdentity(asOrgUser('user_admin_a', 'org_a', 'org:admin'))
      .mutation(api.supportTickets.create, { clerkOrgId: 'org_a', ...createArgs })
    expect(ticketId).toBeTruthy()

    // The scheduled sendEmail actions run and hit the EMAIL_ENABLED gate
    // (skipped without email config) — they must drain without errors.
    await t.finishInProgressScheduledFunctions()
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


describe('supportTickets close notifications', () => {
  // A dedicated tenant so tenant-facing emails are distinguishable from the
  // ones other tests in this file schedule (existing tests close tickets too
  // and never drain their scheduled sends — those laggers fire during later
  // tests and are filtered out by recipient below).
  const ORG = 'org_close'
  const ORG_ADMIN = 'user_close_admin'
  const BILLING_EMAIL = 'billing@close.test'
  const TICKET_SUBJECT = 'Wrong total on October invoice'

  type EmailJob = { to: string; subject: string; html: string }

  // One fetch mock for the whole describe: repeated vi.stubGlobal calls do
  // not reliably re-bind fetch inside the convex-test runtime, so captures
  // route through a per-test pointer instead.
  let currentCalls: EmailJob[]
  let resendStatus: number

  beforeAll(() => {
    process.env.EMAIL_ENABLED = 'true'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'platform@atriax.test'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('api.resend.com')) {
          currentCalls.push(JSON.parse(String(init?.body)) as EmailJob)
          if (resendStatus !== 200) {
            return new Response(JSON.stringify({ error: 'boom' }), {
              status: resendStatus,
            })
          }
          return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
  })

  beforeEach(() => {
    currentCalls = []
    resendStatus = 200
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    delete process.env.EMAIL_ENABLED
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
  })

  /** Let queued runAfter(0, ...) callbacks fire and drain scheduled functions. */
  async function drain(t: ReturnType<typeof createTestConvex>) {
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await t.finishInProgressScheduledFunctions()
    }
  }

  /** Emails to THIS describe's recipients (laggers from other tests are to other addresses). */
  function myEmails(): EmailJob[] {
    const mine = new Set([BILLING_EMAIL, `${ORG_ADMIN}@example.com`])
    return currentCalls.filter((email) => mine.has(email.to))
  }

  async function seed(
    t: ReturnType<typeof createTestConvex>,
    options: { billingEmails?: string[] } = {},
  ) {
    await seedPlatformAdmin(t)
    await seedTenantWithMember(t, ORG, ORG_ADMIN, 'org:admin')
    if (options.billingEmails) {
      await t.run(async (ctx) => {
        const tenant = await ctx.db
          .query('tenants')
          .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', ORG))
          .unique()
        const now = new Date().toISOString()
        await ctx.db.insert('tenantSubscriptions', {
          tenantId: tenant!._id,
          planKey: 'growth',
          status: 'active',
          billingEmails: options.billingEmails!,
          currentPeriodStart: '2026-10-01',
          currentPeriodEnd: '2026-10-31',
          createdAt: now,
          updatedAt: now,
        })
      })
    }
    return await t
      .withIdentity(asOrgUser(ORG_ADMIN, ORG, 'org:admin'))
      .mutation(api.supportTickets.create, {
        clerkOrgId: ORG,
        ...createArgs,
        subject: TICKET_SUBJECT,
      })
  }

  async function notificationsFor(t: ReturnType<typeof createTestConvex>) {
    return await t.run(async (ctx) => ctx.db.query('notifications').collect())
  }

  it('notifies org:admins in-app and emails the billing contacts on close', async () => {
    const t = createTestConvex()
    const ticketId = await seed(t, { billingEmails: [BILLING_EMAIL] })
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    await asAdmin.mutation(api.supportTickets.addNote, {
      ticketId,
      note: 'Fixed the billing configuration.',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'in_progress',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'closed',
    })
    await drain(t)

    // One in-app notification for the org admin, with subject + resolution.
    const notifications = await notificationsFor(t)
    expect(notifications).toHaveLength(1)
    expect(notifications[0].clerkUserId).toBe(ORG_ADMIN)
    expect(notifications[0].type).toBe('support_ticket_resolved')
    expect(notifications[0].message).toContain(TICKET_SUBJECT)
    expect(notifications[0].message).toContain('Fixed the billing configuration.')

    // ONE email to the tenant's billing contacts with the resolution text.
    const emails = myEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(BILLING_EMAIL)
    expect(emails[0].subject).toBe(
      `Your support request has been resolved — ${TICKET_SUBJECT}`,
    )
    expect(emails[0].html).toContain('Fixed the billing configuration.')

    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.resolutionNotifiedAt).toBeTruthy()
  })

  it('notifies exactly once per ticket across resolve → close', async () => {
    const t = createTestConvex()
    const ticketId = await seed(t, { billingEmails: [BILLING_EMAIL] })
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

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
    await drain(t)

    // resolved notified once; the later closed transition did not re-notify.
    expect(await notificationsFor(t)).toHaveLength(1)
    expect(myEmails()).toHaveLength(1)

    // Same-status close is an idempotent no-op too.
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'closed',
    })
    await drain(t)
    expect(await notificationsFor(t)).toHaveLength(1)
    expect(myEmails()).toHaveLength(1)
  })

  it('adding a note alone does not notify the agency', async () => {
    const t = createTestConvex()
    const ticketId = await seed(t, { billingEmails: [BILLING_EMAIL] })

    await t
      .withIdentity(PLATFORM_ADMIN)
      .mutation(api.supportTickets.addNote, { ticketId, note: 'Investigating.' })
    await drain(t)

    expect(await notificationsFor(t)).toHaveLength(0)
    expect(myEmails()).toHaveLength(0)
  })

  it('uses a generic resolution line and admin emails when no notes/subscription exist', async () => {
    const t = createTestConvex()
    const ticketId = await seed(t)
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'in_progress',
    })
    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'resolved',
    })
    await drain(t)

    const emails = myEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(`${ORG_ADMIN}@example.com`)
    expect(emails[0].html).toContain('Your request has been resolved.')
    expect(await notificationsFor(t)).toHaveLength(1)
  })

  it('an email failure still closes the ticket', async () => {
    const t = createTestConvex()
    const ticketId = await seed(t, { billingEmails: [BILLING_EMAIL] })
    resendStatus = 500
    const asAdmin = t.withIdentity(PLATFORM_ADMIN)

    await asAdmin.mutation(api.supportTickets.setStatus, {
      ticketId,
      status: 'in_progress',
    })
    // The status change resolves normally; the failing email only breaks the
    // scheduled send, never the mutation.
    await expect(
      asAdmin.mutation(api.supportTickets.setStatus, {
        ticketId,
        status: 'closed',
      }),
    ).resolves.toBe(ticketId)

    // Let the scheduled send run (its failure is caught inside the
    // convex-test scheduler and never propagates to the mutation).
    await drain(t)

    // The close email was still attempted for the billing contact.
    const emails = myEmails()
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(BILLING_EMAIL)

    const ticket = await t.run(async (ctx) => ctx.db.get(ticketId))
    expect(ticket?.status).toBe('closed')
    // The in-app notification was still recorded.
    expect(await notificationsFor(t)).toHaveLength(1)
  })
})
