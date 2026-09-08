import { ConvexError } from 'convex/values'
import type { Scheduler } from 'convex/server'
import { internal } from '../_generated/api'
import { disableClerkUserMfa, verifyClerkUserEmail } from './clerkUserManagement'
import { assertEmailDomainAllowed } from '../invitations'


interface CreateClerkUserAndJoinOrgArgs {
  ctx: { scheduler: Scheduler }
  secretKey: string
  clerkOrgId: string
  emailAddress: string
  displayName: string
  role: string
  appBaseUrl: string
  allowedEmailDomains?: string[] | null
  // Optional role-aware welcome email overrides. When accountType is set the
  // subject/body name the account type; absent keeps the legacy generic copy.
  accountType?: string
  agencyName?: string
  // One-time payment-setup link (owners at agency creation) — when present a
  // setup paragraph/button is added to the welcome email.
  paymentSetupUrl?: string
}

interface CreateClerkUserAndJoinOrgResult {
  clerkUserId: string
  invitationId: string
  magicLink: string
  initialPassword: string
}

const CLERK_ERROR_MAP: Array<[string, string]> = [
  [
    'Given password is not strong enough.',
    'Your password is not strong enough. Please use a mix of uppercase and lowercase letters, numbers, and symbols. Avoid common passwords.',
  ],
  [
    'That email address is already in use.',
    'An account with this email already exists. Please sign in instead.',
  ],
  [
    'That phone number is invalid.',
    'Please enter a valid 10-digit phone number.',
  ],
  [
    'That email address is invalid.',
    'Please enter a valid email address.',
  ],
  [
    // Clerk instance-level allowlist rejection (a dashboard restriction, not
    // something the applicant can fix) — seen on prod when the instance
    // allowlist blocked public applications.
    'not allowed to access this application',
    'This email address is not allowed by email restrictions. Please contact the agency.',
  ],
  [
    // Duplicate-email variant Clerk returns on POST /users.
    'email address is taken',
    'An account with this email already exists. Please sign in instead.',
  ],
  [
    'not found',
    'Account not found. Please check your email or use the sign-in link.',
  ],
  [
    'identification_exists',
    'An account with this email already exists.',
  ],
]

export function friendlyClerkMessage(message: string): string {
  const haystack = message.toLowerCase()
  for (const [needle, friendly] of CLERK_ERROR_MAP) {
    if (haystack.includes(needle.toLowerCase())) return friendly
  }
  // Unmapped error: return the original message with any Convex wrapper
  // suffix ('at async handler…', 'Called by client') stripped.
  return message
    .replace(/\s+at async handler[\s\S]*$/, '')
    .replace(/\s*Called by client\.?\s*$/, '')
    .trim()
}

export function clerkErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    Array.isArray((payload as { errors: unknown[] }).errors)
  ) {
    const first = (payload as { errors: Array<Record<string, unknown>> }).errors[0]
    const message = first?.long_message ?? first?.message
    if (typeof message === 'string') return friendlyClerkMessage(message)
  }
  return 'Clerk request failed.'
}

function toClerkRole(role: string) {
  return role === 'org:admin' ? 'org:admin' : 'org:member'
}

/** Human label for the account type named in role-aware welcome emails. */
export function accountTypeLabel(role: string): string {
  if (role === 'org:admin' || role === 'owner') return 'owner'
  if (role === 'org:coordinator') return 'coordinator'
  if (role === 'org:caregiver') return 'employee'
  return 'ATRIA-X'
}

function parseName(displayName: string) {
  const parts = displayName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' ') ?? '',
  }
}

export async function createClerkUserAndJoinOrg(
  args: CreateClerkUserAndJoinOrgArgs,
): Promise<CreateClerkUserAndJoinOrgResult> {
  assertEmailDomainAllowed(args.emailAddress, args.allowedEmailDomains)

  const { firstName, lastName } = parseName(args.displayName)

  const initialPassword = generateTemporaryPassword()

  const createRes = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [args.emailAddress],
      first_name: firstName,
      last_name: lastName,
      password: initialPassword,
      skip_password_checks: true,
      public_metadata: { atriaRole: args.role },
    }),
  })

  if (!createRes.ok) {
    const payload = await createRes.json()
    throw new ConvexError(clerkErrorMessage(payload))
  }

  const user = (await createRes.json()) as {
    id: string
    email_addresses: Array<{ id: string; email_address: string }>
  }
  const clerkUserId = user.id

  // Mark the candidate's email as verified and strip any MFA methods so the
  // magic-link/ticket sign-in does not prompt for email verification or 2FA
  // in dev/QA environments.
  const primaryEmail = user.email_addresses[0]
  if (primaryEmail) {
    await verifyClerkUserEmail(args.secretKey, clerkUserId, primaryEmail.id)
  }
  await disableClerkUserMfa(args.secretKey, clerkUserId)

  const membershipRes = await fetch(
    `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/memberships`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: clerkUserId,
        role: toClerkRole(args.role),
        public_metadata: { atriaRole: args.role },
      }),
    },
  )

  if (!membershipRes.ok) {
    const payload = await membershipRes.json()
    throw new ConvexError(clerkErrorMessage(payload))
  }

  const ticket = await generateClerkSignInTicket({
    secretKey: args.secretKey,
    clerkUserId,
  })

  const url = new URL(args.appBaseUrl)
  const magicLink = `${url.origin}/sign-in?__clerk_ticket=${ticket}`
  const invitationId = `manual:${clerkUserId}`

  const subject = args.accountType
    ? `Your ${args.accountType} account is ready`
    : 'Your ATRIA-X account is ready'

  await args.ctx.scheduler.runAfter(0, internal._utils.resend.sendEmail, {
    to: args.emailAddress,
    subject,
    html: candidateWelcomeEmailHtml({
      firstName,
      email: args.emailAddress,
      magicLink,
      initialPassword,
      appUrl: url.origin,
      accountType: args.accountType,
      agencyName: args.agencyName,
      paymentSetupUrl: args.paymentSetupUrl,
    }),
    text: candidateWelcomeEmailText({
      firstName,
      email: args.emailAddress,
      magicLink,
      initialPassword,
      appUrl: url.origin,
      accountType: args.accountType,
      agencyName: args.agencyName,
      paymentSetupUrl: args.paymentSetupUrl,
    }),
  })

  return {
    clerkUserId,
    invitationId,
    magicLink,
    initialPassword,
  }
}

export async function generateClerkSignInTicket({
  secretKey,
  clerkUserId,
}: {
  secretKey: string
  clerkUserId: string
}): Promise<string> {
  const response = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: clerkUserId,
      expires_in_seconds: 604800,
    }),
  })

  if (!response.ok) {
    const payload = await response.json()
    throw new ConvexError(clerkErrorMessage(payload))
  }

  const data = (await response.json()) as { token: string }
  return data.token
}

export async function updateClerkUserPassword({
  secretKey,
  clerkUserId,
  password,
}: {
  secretKey: string
  clerkUserId: string
  password: string
}): Promise<void> {
  const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password,
      skip_password_checks: false,
    }),
  })

  if (!response.ok) {
    const payload = await response.json()
    throw new ConvexError(clerkErrorMessage(payload))
  }
}

export function generateTemporaryPassword(length = 12): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  return Array.from({ length }, () =>
    alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
  ).join('')
}


export function isDevInvitationBypassEnabled(): boolean {
  return false
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function candidateWelcomeEmailHtml(args: {
  firstName?: string
  email: string
  magicLink: string
  initialPassword: string
  appUrl: string
  accountType?: string
  agencyName?: string
  paymentSetupUrl?: string
}): string {
  const greeting = args.firstName ? `Hi ${escapeHtml(args.firstName)},` : 'Hi,'
  const accountLine = args.accountType
    ? `\n    <p>Your ${escapeHtml(args.accountType)} account${args.agencyName ? ` for ${escapeHtml(args.agencyName)}` : ''} is ready.</p>`
    : ''
  const paymentSetup = args.paymentSetupUrl
    ? `\n    <p>To finish setting up your agency, <a href="${escapeHtml(args.paymentSetupUrl)}">set up your payment method</a> (one-time, secure Stripe page).</p>`
    : ''
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <p>${greeting}</p>${accountLine}
    <p>Your ATRIA-X account has been created. Use the information below to sign in for the first time:</p>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(args.email)}</li>
      <li><strong>Temporary password:</strong> ${escapeHtml(args.initialPassword)}</li>
      <li><strong>Magic sign-in link:</strong> <a href="${escapeHtml(args.magicLink)}">Sign in</a></li>
    </ul>${paymentSetup}
    <p>For security, you will be asked to change your password after your first sign-in.</p>
    <p>If you have trouble, contact ATRIA-X support at hello@atriaxsolutions.com.</p>
  </body>
</html>
  `
}

function candidateWelcomeEmailText(args: {
  firstName?: string
  email: string
  magicLink: string
  initialPassword: string
  appUrl: string
  accountType?: string
  agencyName?: string
  paymentSetupUrl?: string
}): string {
  const greeting = args.firstName ? `Hi ${args.firstName},` : 'Hi,'
  const accountLine = args.accountType
    ? `\nYour ${args.accountType} account${args.agencyName ? ` for ${args.agencyName}` : ''} is ready.\n`
    : ''
  const paymentSetup = args.paymentSetupUrl
    ? `\nTo finish setting up your agency, set up your payment method here: ${args.paymentSetupUrl}\n`
    : ''
  return `${greeting}
${accountLine}
Your ATRIA-X account has been created. Use the information below to sign in for the first time:

Email: ${args.email}
Temporary password: ${args.initialPassword}
Magic sign-in link: ${args.magicLink}
${paymentSetup}
For security, you will be asked to change your password after your first sign-in.

If you have trouble, contact ATRIA-X support at hello@atriaxsolutions.com.
`
}