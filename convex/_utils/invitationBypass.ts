import { ConvexError } from 'convex/values'
import { toClerkRole } from '../invitations'

declare const process: { env: Record<string, string | undefined> }

export function isDevInvitationBypassEnabled(opts?: {
  appBaseUrl?: string
  devBypassEnabled?: boolean
}): boolean {
  if (opts?.devBypassEnabled) return true

  const appUrl = opts?.appBaseUrl ?? process.env.APP_URL ?? ''
  const flag = process.env.ATRIA_X_DEV_INVITE_BYPASS ?? ''

  if (!appUrl) return flag === '1' || flag.toLowerCase() === 'true'

  const isLocalhost =
    appUrl.startsWith('http://localhost') ||
    appUrl.startsWith('https://localhost') ||
    appUrl.startsWith('http://127.0.0.1') ||
    appUrl.startsWith('https://127.0.0.1') ||
    new URL(appUrl).hostname === 'localhost' ||
    new URL(appUrl).hostname === '127.0.0.1'

  const flagEnabled = flag === '1' || flag.toLowerCase() === 'true'

  return isLocalhost || flagEnabled
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function generatePassword(): string {
  return `dev-${randomToken()}`
}

function generateBypassInvitationId(): string {
  return `bypass:${randomToken()}`
}

function clerkErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    Array.isArray((payload as { errors: unknown[] }).errors)
  ) {
    const first = (payload as { errors: Array<Record<string, unknown>> })
      .errors[0]
    const message = first?.long_message ?? first?.message
    if (typeof message === 'string') return message
  }
  return 'Clerk bypass request failed.'
}

async function clerkFetch(args: {
  secretKey: string
  path: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
}) {
  const response = await fetch(`https://api.clerk.com/v1${args.path}`, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${args.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, payload }
}

async function findClerkUserByEmail(args: {
  secretKey: string
  emailAddress: string
}) {
  const encoded = encodeURIComponent(args.emailAddress.trim())
  const { ok, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: `/users?email_address=${encoded}`,
    method: 'GET',
  })

  if (!ok) return null

  const list = payload as Array<Record<string, unknown>> | undefined
  const record = list?.find(
    (u) =>
      Array.isArray(u.email_addresses) &&
      u.email_addresses.some(
        (e: Record<string, unknown>) =>
          typeof e.email_address === 'string' &&
          e.email_address.toLowerCase() === args.emailAddress.trim().toLowerCase(),
      ),
  )

  return record && typeof record.id === 'string' ? record.id : null
}

async function createClerkUser(args: {
  secretKey: string
  emailAddress: string
  password: string
  displayName: string
  role: string
}) {
  const firstName = args.displayName.split(' ')[0] ?? args.displayName
  const lastName = args.displayName.split(' ').slice(1).join(' ') || undefined

  const { ok, status, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: '/users',
    method: 'POST',
    body: {
      email_address: [args.emailAddress.trim()],
      password: args.password,
      first_name: firstName,
      last_name: lastName,
      public_metadata: { atriaRole: args.role, atriaBypass: true },
    },
  })

  if (ok && payload && typeof payload === 'object' && typeof payload.id === 'string') {
    return payload.id as string
  }

  // The user may already exist; try to look them up before giving up.
  if (status === 409 || status === 422) {
    const existingId = await findClerkUserByEmail({
      secretKey: args.secretKey,
      emailAddress: args.emailAddress,
    })
    if (existingId) return existingId
  }

  throw new ConvexError(clerkErrorMessage(payload))
}

async function listClerkOrgMemberships(args: {
  secretKey: string
  clerkOrgId: string
}) {
  const { ok, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: `/organizations/${args.clerkOrgId}/memberships?limit=100`,
    method: 'GET',
  })
  if (!ok) return []
  const list = Array.isArray(payload)
    ? (payload as Array<Record<string, unknown>>)
    : (Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: Array<Record<string, unknown>> }).data)
        : [])
  return list
}

function getMembershipUserId(membership: Record<string, unknown>): string | undefined {
  const publicUserData = membership.public_user_data as Record<string, unknown> | undefined
  if (typeof publicUserData?.user_id === 'string') return publicUserData.user_id
  return undefined
}

async function deleteClerkOrgMembership(args: {
  secretKey: string
  clerkOrgId: string
  userId: string
}) {
  const { ok, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: `/organizations/${args.clerkOrgId}/memberships/${args.userId}`,
    method: 'DELETE',
  })
  if (ok) return true
  const firstError = (payload as { errors?: Array<Record<string, unknown>> })?.errors?.[0]
  return firstError?.code === 'resource_not_found'
}

async function addClerkOrgMembership(args: {
  secretKey: string
  clerkOrgId: string
  clerkUserId: string
  role: string
}) {
  const { ok, status, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: `/organizations/${args.clerkOrgId}/memberships`,
    method: 'POST',
    body: {
      user_id: args.clerkUserId,
      role: toClerkRole(args.role as Parameters<typeof toClerkRole>[0]),
      public_metadata: { atriaRole: args.role, atriaBypass: true },
    },
  })

  if (ok || status === 409) {
    return { created: ok }
  }

  throw new ConvexError(clerkErrorMessage(payload))
}

function getProtectedFixtureEmails(): Set<string> {
  const emails = [
    process.env.E2E_ADMIN_EMAIL,
    process.env.E2E_HR_EMAIL,
    process.env.E2E_CAREGIVER_EMAIL,
    process.env.E2E_COORDINATOR_EMAIL,
  ].filter((e): e is string => typeof e === 'string' && e.length > 0)
  return new Set(emails.map((e) => e.toLowerCase()))
}

function isProtectedFixtureSetComplete(): boolean {
  return Boolean(
    process.env.E2E_ADMIN_EMAIL &&
      process.env.E2E_HR_EMAIL &&
      process.env.E2E_CAREGIVER_EMAIL &&
      process.env.E2E_COORDINATOR_EMAIL,
  )
}

function getMembershipEmail(membership: Record<string, unknown>): string | undefined {
  const publicUserData = membership.public_user_data as Record<string, unknown> | undefined
  const identifier = publicUserData?.identifier ?? publicUserData?.email_address
  if (typeof identifier === 'string') return identifier.toLowerCase()
  return undefined
}

function getMembershipCreatedAt(membership: Record<string, unknown>): string {
  if (typeof membership.created_at === 'string') return membership.created_at
  if (typeof membership.created_at === 'number') {
    return new Date(
      membership.created_at > 10_000_000_000 ? membership.created_at : membership.created_at * 1000,
    ).toISOString()
  }
  return new Date().toISOString()
}

function isBypassTagged(membership: Record<string, unknown>): boolean {
  const meta = membership.public_metadata as Record<string, unknown> | undefined
  return meta?.atriaBypass === true
}

export function selectMembershipToRemove(args: {
  memberships: Array<Record<string, unknown>>
  protectedEmails: Set<string>
  candidateEmail?: string
  allowNonEssentialFallback?: boolean
}): Record<string, unknown> | null {
  const sorted = [...args.memberships].sort(
    (a, b) =>
      new Date(getMembershipCreatedAt(a)).getTime() - new Date(getMembershipCreatedAt(b)).getTime(),
  )

  const bypassMember = sorted.find((m) => {
    const email = getMembershipEmail(m)
    return isBypassTagged(m) && !(email && args.protectedEmails.has(email))
  })
  if (bypassMember) return bypassMember

  if (args.candidateEmail) {
    const candidateNormalized = args.candidateEmail.toLowerCase()
    const candidateMember = sorted.find((m) => getMembershipEmail(m) === candidateNormalized)
    if (candidateMember) return candidateMember
  }

  if (args.allowNonEssentialFallback) {
    const nonEssential = sorted.find((m) => {
      const email = getMembershipEmail(m)
      return !email || !args.protectedEmails.has(email)
    })
    if (nonEssential) return nonEssential
  }

  return null
}

export async function addClerkOrgMembershipWithQuotaCleanup(args: {
  secretKey: string
  clerkOrgId: string
  clerkUserId: string
  role: string
}) {
  try {
    return await addClerkOrgMembership(args)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    const isQuota =
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('limit of') ||
      message.toLowerCase().includes('organization memberships')

    if (!isQuota) throw err

    const protectedEmails = getProtectedFixtureEmails()
    const candidateEmail = process.env.E2E_CANDIDATE_EMAIL
    const memberships = await listClerkOrgMemberships({
      secretKey: args.secretKey,
      clerkOrgId: args.clerkOrgId,
    })

    const victim = selectMembershipToRemove({
      memberships,
      protectedEmails,
      candidateEmail,
      allowNonEssentialFallback: isProtectedFixtureSetComplete(),
    })

    if (!victim || typeof victim.id !== 'string') throw err
    const victimUserId = getMembershipUserId(victim)
    if (!victimUserId) throw err

    const deleted = await deleteClerkOrgMembership({
      secretKey: args.secretKey,
      clerkOrgId: args.clerkOrgId,
      userId: victimUserId,
    })

    if (!deleted) throw err

    return await addClerkOrgMembership(args)
  }
}

export async function generateClerkSignInTicket(args: {
  secretKey: string
  clerkUserId: string
}) {
  const { ok, payload } = await clerkFetch({
    secretKey: args.secretKey,
    path: '/sign_in_tokens',
    method: 'POST',
    body: {
      user_id: args.clerkUserId,
      expires_in_seconds: 600,
    },
  })

  if (!ok || !payload || typeof payload !== 'object' || typeof payload.token !== 'string') {
    throw new ConvexError(clerkErrorMessage(payload))
  }

  return payload.token as string
}

export async function createClerkUserAndJoinOrg(args: {
  secretKey: string
  clerkOrgId: string
  emailAddress: string
  displayName: string
  role: string
  appBaseUrl: string
}) {
  if (!isDevInvitationBypassEnabled()) {
    throw new ConvexError('Dev invitation bypass is not enabled.')
  }

  const password = generatePassword()
  const invitationId = generateBypassInvitationId()

  const clerkUserId = await createClerkUser({
    secretKey: args.secretKey,
    emailAddress: args.emailAddress,
    password,
    displayName: args.displayName,
    role: args.role,
  })

  await addClerkOrgMembershipWithQuotaCleanup({
    secretKey: args.secretKey,
    clerkOrgId: args.clerkOrgId,
    clerkUserId,
    role: args.role,
  })

  const ticket = await generateClerkSignInTicket({
    secretKey: args.secretKey,
    clerkUserId,
  })

  const url = new URL(args.appBaseUrl)
  const magicLink = `${url.origin}/sign-in?__clerk_ticket=${ticket}`

  return {
    clerkUserId,
    invitationId,
    manualPassword: password,
    magicLink,
  }
}
