import { internalAction } from '../_generated/server'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'

const SUBJECTS: Record<string, string> = {
  application_submitted: 'Your application has been submitted',
  application_reviewed: 'Your application is being reviewed',
  offer_sent: 'You have received an offer!',
  hired: 'Welcome to the team!',
  rejected: 'Your application status',
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

    return { sent: true }
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
