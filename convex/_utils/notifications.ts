import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { ActionCtx, MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

const SUBJECTS: Record<string, string> = {
  application_submitted: 'Your application has been submitted',
  application_reviewed: 'Your application is being reviewed',
  offer_sent: 'You have received an offer!',
  hired: 'Welcome to the team!',
  rejected: 'Your application status',
}

// Staff-facing notification subjects (notifications table + email).
// compliance_expiring gets a dynamic subject ("Your <credential> expires
// soon") via STAFF_DYNAMIC_SUBJECTS below.
const STAFF_SUBJECTS: Record<string, string> = {
  compliance_expiring: 'Your credential expires soon',
  billing_ready: 'Shift ready to bill',
  invoice_created: 'Invoice created',
  billing_blocked: 'Billing blocked by compliance',
  escalation: 'Escalation notice',
}

/** Escape user/tenant-supplied strings before interpolating into HTML emails. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const EMAIL_BODIES: Record<string, (name: string, agency: string) => string> = {
  application_submitted: (n, a) =>
    `<p>Hi ${n},</p><p>Your application to ${a} has been submitted successfully. Our hiring team will review it and contact you with next steps.</p><p>— ${a} Team</p>`,
  application_reviewed: (n, a) =>
    `<p>Hi ${n},</p><p>Your application to ${a} is now being reviewed by the hiring team. You can check your portal for updates.</p><p>— ${a} Team</p>`,
  offer_sent: (n, a) =>
    `<p>Hi ${n},</p><p>You have received an offer from ${a}! Please log in to your portal to review and accept it.</p><p>— ${a} Team</p>`,
  hired: (n, a) =>
    `<p>Congratulations ${n}!</p><p>You have been hired by ${a}. Please check your portal for next steps and training.</p><p>— ${a} Team</p>`,
  rejected: (n, a) =>
    `<p>Hi ${n},</p><p>Thank you for your interest in ${a}. We have decided not to move forward with your application at this time. We wish you the best in your job search.</p><p>— ${a} Team</p>`,
}

const SMS_BODIES: Record<string, (name: string, agency: string) => string> = {
  application_submitted: (_n, a) => `Your application to ${a} has been submitted. We will contact you with next steps.`,
  application_reviewed: (_n, a) => `Your application to ${a} is being reviewed. Check your portal for updates.`,
  offer_sent: (_n, a) => `You received an offer from ${a}! Log in to your portal to review and accept.`,
  hired: (_n, a) => `Congratulations! You've been hired by ${a}. Check your portal for next steps.`,
  rejected: (_n, a) => `Your application to ${a} was not selected at this time. We wish you the best.`,
}

/**
 * Internal action that sends both email and SMS notifications.
 * Called via ctx.scheduler.runAfter(0, ...) from candidate status mutations.
 */
export const sendNotification = internalAction({
  args: {
    clerkOrgId: v.string(),
    candidateEmail: v.string(),
    candidateName: v.string(),
    candidatePhone: v.optional(v.string()),
    agencyName: v.string(),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const subject = SUBJECTS[args.event] ?? 'ATRIA-X Update'
    const safeName = escapeHtml(args.candidateName)
    const safeAgency = escapeHtml(args.agencyName)
    const emailBody = EMAIL_BODIES[args.event]?.(safeName, safeAgency)
    const smsBody = SMS_BODIES[args.event]?.(args.candidateName, args.agencyName)

    if (emailBody) {
      await ctx.scheduler.runAfter(0, internal._utils.resend.sendEmail, {
        to: args.candidateEmail,
        subject,
        html: emailBody,
      })
    }

    if (smsBody && args.candidatePhone) {
      await ctx.scheduler.runAfter(0, internal._utils.twilio.sendSms, {
        to: args.candidatePhone,
        body: smsBody,
      })
    }

    // Persist a notifications-table row when the candidate has a portal
    // account (clerkUserId). Candidates without one only get email/SMS.
    const target = await ctx.runQuery(
      internal._utils.notifications.findNotificationTargetByEmail,
      { clerkOrgId: args.clerkOrgId, email: args.candidateEmail },
    )
    if (target) {
      await ctx.runMutation(internal._utils.notifications.insertNotification, {
        tenantId: target.tenantId,
        clerkUserId: target.clerkUserId,
        type: args.event,
        message: smsBody ?? subject,
      })
    }

    return { sent: true }
  },
})

type StaffMetadata = Record<string, unknown>

function metaString(metadata: StaffMetadata | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

// Dynamic subject overrides keyed on staff notification metadata. Falls back
// to the static STAFF_SUBJECTS map when no override applies.
const STAFF_DYNAMIC_SUBJECTS: Record<
  string,
  (m: StaffMetadata | undefined) => string
> = {
  compliance_expiring: (m) =>
    `Your ${metaString(m, 'credentialName') || 'credential'} expires soon`,
}

// Template bodies return null when the caller did not supply the metadata
// keys they interpolate; renderStaffEmail then falls back to the
// caller-supplied message instead of emailing a body full of blanks.
const STAFF_BODIES: Record<
  string,
  (m: StaffMetadata | undefined) => string | null
> = {
  compliance_expiring: (m) =>
    metaString(m, 'category') && metaString(m, 'expiresAt')
      ? `Your ${metaString(m, 'category')} credential expires on ${metaString(m, 'expiresAt')}. Please renew it to remain compliant.`
      : null,
  billing_ready: (m) =>
    metaString(m, 'clientName')
      ? `Shift for ${metaString(m, 'clientName')} is ready to bill.`
      : null,
  invoice_created: (m) =>
    metaString(m, 'invoiceNumber')
      ? `Invoice ${metaString(m, 'invoiceNumber')} has been created${metaString(m, 'amount') ? ` for $${metaString(m, 'amount')}` : ''}.`
      : null,
  billing_blocked: (m) =>
    metaString(m, 'reason')
      ? `Billing blocked for ${metaString(m, 'caregiverName')}: ${metaString(m, 'reason')}. Resolve or apply override.`
      : null,
  escalation: (m) =>
    metaString(m, 'reason')
      ? `Escalation (level ${metaString(m, 'escalationLevel')}): ${metaString(m, 'reason')}`
      : null,
}

function renderStaffEmail(
  type: string,
  message: string,
  metadata: StaffMetadata | undefined,
) {
  const subject =
    STAFF_DYNAMIC_SUBJECTS[type]?.(metadata) ??
    STAFF_SUBJECTS[type] ??
    'ATRIA-X Notification'
  const body = STAFF_BODIES[type]?.(metadata) ?? message
  return { subject, html: `<p>${escapeHtml(body)}</p>` }
}

/**
 * Shared delivery logic for staff notifications: ALWAYS persists a row in the
 * notifications table first, then best-effort emails the staff member when an
 * email address resolves. Email failures are swallowed so they never break
 * the durable in-app notification.
 */
async function deliverStaffNotification(
  ctx: ActionCtx,
  args: {
    tenantId: Id<'tenants'>
    clerkUserId: string
    type: string
    message: string
    metadata?: StaffMetadata
  },
): Promise<{ notificationId: Id<'notifications'> }> {
  const notificationId: Id<'notifications'> = await ctx.runMutation(
    internal.notifications.record,
    {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      type: args.type,
      message: args.message,
      metadata: args.metadata,
    },
  )

  try {
    const email = await ctx.runQuery(internal.notifications.resolveStaffEmail, {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
    })
    if (email) {
      const { subject, html } = renderStaffEmail(
        args.type,
        args.message,
        args.metadata,
      )
      await ctx.scheduler.runAfter(0, internal._utils.resend.sendEmail, {
        to: email,
        subject,
        html,
      })
    }
  } catch (error) {
    console.warn('Staff notification email delivery failed:', error)
  }

  return { notificationId }
}

/**
 * Staff notification entry point. Scheduled via ctx.scheduler.runAfter(0, ...)
 * from mutations. Always records the in-app notification; email is best-effort.
 */
export const sendStaffNotification = internalAction({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return deliverStaffNotification(ctx, {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      type: args.type,
      message: args.message,
      metadata: args.metadata,
    })
  },
})

/**
 * Records a compliance_expiring notification for a caregiver and sends the
 * expiring-credential email when an email address resolves.
 */
export const notifyComplianceExpiring = internalAction({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    credentialName: v.string(),
    category: v.string(),
    expiresAt: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata: StaffMetadata = {
      credentialName: args.credentialName,
      category: args.category,
      expiresAt: args.expiresAt,
    }
    const message =
      STAFF_BODIES.compliance_expiring(metadata) ??
      'Your credential expires soon. Please renew it to remain compliant.'
    return deliverStaffNotification(ctx, {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      type: 'compliance_expiring',
      message,
      metadata,
    })
  },
})

/**
 * Helper to schedule a notification from a mutation context.
 * Call this after a candidate status change.
 */
export async function notifyCandidate(
  ctx: MutationCtx,
  event: {
    clerkOrgId: string
    candidateEmail: string
    candidateName: string
    candidatePhone?: string
    agencyName: string
    event: string
  },
) {
  await ctx.scheduler.runAfter(0, internal._utils.notifications.sendNotification, event)
}

/**
 * Resolves a tenant + clerkUserId for a notification recipient by email.
 * Used by sendNotification to persist candidate notifications.
 */
export const findNotificationTargetByEmail = internalQuery({
  args: { clerkOrgId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()
    if (!tenant) return null

    const candidate = await ctx.db
      .query('candidates')
      .withIndex('by_tenant_email', (q) =>
        q.eq('tenantId', tenant._id).eq('email', args.email),
      )
      .first()
    if (candidate?.clerkUserId) {
      return { tenantId: tenant._id, clerkUserId: candidate.clerkUserId }
    }

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenant._id))
      .collect()
    const match = member.find((m) => m.email === args.email)
    if (match) {
      return { tenantId: tenant._id, clerkUserId: match.clerkUserId }
    }

    return null
  },
})

/** Persists a row in the notifications table (staff-facing feed). */
export const insertNotification = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('notifications', {
      tenantId: args.tenantId,
      clerkUserId: args.clerkUserId,
      type: args.type,
      message: args.message,
      metadata: args.metadata,
      read: false,
      createdAt: new Date().toISOString(),
    })
  },
})

/** Sends a plain staff notification email through the resend action. */
export const sendStaffEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal._utils.resend.sendEmail, {
      to: args.to,
      subject: args.subject,
      html: `<p>${escapeHtml(args.message)}</p>`,
    })
    return { sent: true }
  },
})

/**
 * Schedules a staff notification: inserts a notifications-table row and,
 * when an email address is known, sends the matching email. Fire-and-forget
 * via the scheduler so a retry of the calling mutation does not double-send.
 */
export async function notifyStaff(
  ctx: MutationCtx,
  event: {
    tenantId: Id<'tenants'>
    clerkUserId: string
    email?: string
    type: string
    message: string
    subject?: string
    metadata?: Record<string, unknown>
  },
) {
  await ctx.scheduler.runAfter(0, internal._utils.notifications.insertNotification, {
    tenantId: event.tenantId,
    clerkUserId: event.clerkUserId,
    type: event.type,
    message: event.message,
    metadata: event.metadata,
  })

  if (event.email) {
    await ctx.scheduler.runAfter(0, internal._utils.notifications.sendStaffEmail, {
      to: event.email,
      subject: event.subject ?? STAFF_SUBJECTS[event.type] ?? 'ATRIA-X notification',
      message: event.message,
    })
  }
}

/**
 * Notifies every tenant member holding one of the given roles (used for
 * billing events that concern the back office rather than one caregiver).
 */
export async function notifyTenantStaff(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  roles: ('org:admin' | 'org:coordinator' | 'org:hr')[],
  event: {
    type: string
    message: string
    subject?: string
    metadata?: Record<string, unknown>
  },
) {
  const notified = new Set<string>()
  for (const role of roles) {
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', role),
      )
      .collect()
    for (const member of members) {
      if (notified.has(member.clerkUserId)) continue
      notified.add(member.clerkUserId)
      await notifyStaff(ctx, {
        tenantId,
        clerkUserId: member.clerkUserId,
        email: member.email,
        type: event.type,
        message: event.message,
        subject: event.subject,
        metadata: event.metadata,
      })
    }
  }
}

/**
 * Schedules the compliance_expiring notification for a caregiver whose
 * credential is expiring or expired. Mutation-context helper counterpart of
 * the notifyComplianceExpiring internal action above.
 */
export async function scheduleComplianceExpiringNotification(
  ctx: MutationCtx,
  event: {
    tenantId: Id<'tenants'>
    clerkUserId: string
    email?: string
    credentialName: string
    category: string
    expiresAt: string
  },
) {
  await notifyStaff(ctx, {
    tenantId: event.tenantId,
    clerkUserId: event.clerkUserId,
    email: event.email,
    type: 'compliance_expiring',
    subject: `Your ${event.credentialName} expires soon`,
    message: `Your ${event.category} credential expires on ${event.expiresAt}. Please renew it to remain compliant.`,
    metadata: {
      category: event.category,
      expiresAt: event.expiresAt,
    },
  })
}
