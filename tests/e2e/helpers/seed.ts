import { type Page } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CANDIDATE_EMAIL,
  E2E_CAREGIVER_EMAIL,
  E2E_COORDINATOR_EMAIL,
  E2E_HR_EMAIL,
  E2E_ORG_ID,
  MOCK_ADMIN_USER_ID,
  MOCK_CANDIDATE_USER_ID,
  MOCK_CAREGIVER_USER_ID,
  MOCK_COORDINATOR_USER_ID,
  MOCK_HR_USER_ID,
  extractClerkToken,
  mockSignInAsRole,
  signInWithClerk,
  signOut,
} from './auth'
import { e2eCredentialsAvailable, mockE2EEnabled } from './env'

type ClerkEmail = {
  id: string
  email_address: string
}

type ClerkUser = {
  id: string
  email_addresses: ClerkEmail[]
}

function clerkApiHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

export async function findClerkUserId(email: string): Promise<string> {
  if (mockE2EEnabled()) {
    switch (email) {
      case E2E_ADMIN_EMAIL:
        return MOCK_ADMIN_USER_ID
      case E2E_COORDINATOR_EMAIL:
        return MOCK_COORDINATOR_USER_ID
      case E2E_CAREGIVER_EMAIL:
        return MOCK_CAREGIVER_USER_ID
      case E2E_HR_EMAIL:
        return MOCK_HR_USER_ID
      case E2E_CANDIDATE_EMAIL:
        return MOCK_CANDIDATE_USER_ID
      default:
        return `e2e-mock-${email.replace(/[^a-zA-Z0-9]/g, '-')}`
    }
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required for live Clerk E2E user lookup.')
  }

  const usersResponse = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    { headers: clerkApiHeaders(secretKey) },
  )

  if (!usersResponse.ok) {
    throw new Error(
      `Could not look up Clerk E2E user ${email}: ${usersResponse.status}`,
    )
  }

  const users = (await usersResponse.json()) as ClerkUser[]
  const normalized = email.toLowerCase()
  const user = users.find((candidate) =>
    candidate.email_addresses.some(
      (entry) => entry.email_address.toLowerCase() === normalized,
    ),
  )
  if (!user) {
    throw new Error(`Clerk E2E user ${email} was not found.`)
  }
  return user.id
}

export async function getE2EUserIds(): Promise<{
  adminUserId: string
  coordinatorUserId: string
  caregiverUserId: string
  hrUserId: string
  candidateUserId: string
}> {
  return {
    adminUserId: await findClerkUserId(E2E_ADMIN_EMAIL),
    coordinatorUserId: await findClerkUserId(E2E_COORDINATOR_EMAIL),
    caregiverUserId: await findClerkUserId(E2E_CAREGIVER_EMAIL),
    hrUserId: await findClerkUserId(E2E_HR_EMAIL),
    candidateUserId: await findClerkUserId(E2E_CANDIDATE_EMAIL),
  }
}

export async function callConvexMutation(
  token: string,
  path: string,
  args: Record<string, unknown>,
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot call Convex mutation.')
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path,
      args,
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log(`${path} result:`, result)
  if (
    result.status !== undefined &&
    result.status !== 'success' &&
    result.status !== 'seeded' &&
    result.status !== 'reset'
  ) {
    throw new Error(`${path} failed: ${JSON.stringify(result)}`)
  }
  return result
}

export async function callConvexQuery(
  token: string,
  path: string,
  args: Record<string, unknown>,
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot call Convex query.')
  }

  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path,
      args,
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  return (result as { value?: unknown }).value ?? result
}

export async function callConvexAction(
  token: string,
  path: string,
  args: Record<string, unknown>,
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot call Convex action.')
  }

  const response = await fetch(`${convexUrl}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path,
      args,
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} failed: ${response.status} ${text}`)
  }

  return response.json()
}

async function signInAsAdminForSeed(page: Page) {
  if (mockE2EEnabled()) {
    await mockSignInAsRole(page, 'org:admin', E2E_ORG_ID)
  } else {
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
  }
}

export async function resetE2EShifts(page: Page) {
  if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
    throw new Error(
      'E2E Clerk credentials are not configured and mock mode is not enabled.',
    )
  }

  await signOut(page)
  await signInAsAdminForSeed(page)

  const userIds = await getE2EUserIds()
  const token = await extractClerkToken(page)
  if (!token) {
    throw new Error('Could not extract session token; cannot reset e2e shifts.')
  }

  await callConvexMutation(token, 'seed:resetE2EShifts', {
    clerkOrgId: E2E_ORG_ID,
    adminUserId: userIds.adminUserId,
    coordinatorUserId: userIds.coordinatorUserId,
    caregiverUserId: userIds.caregiverUserId,
  })

  await signOut(page)
}

export async function resetE2ECandidate(
  page: Page,
  userIds?: {
    adminUserId: string
    coordinatorUserId: string
    caregiverUserId: string
    hrUserId: string
    candidateUserId: string
  },
) {
  if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
    throw new Error(
      'E2E Clerk credentials are not configured and mock mode is not enabled.',
    )
  }

  await signOut(page)
  await signInAsAdminForSeed(page)

  const ids = userIds ?? (await getE2EUserIds())
  const token = await extractClerkToken(page)
  if (!token) {
    throw new Error(
      'Could not extract session token; cannot reset e2e candidate fixtures.',
    )
  }

  const result = await callConvexMutation(token, 'seed:resetE2ECandidate', {
    clerkOrgId: E2E_ORG_ID,
    adminUserId: ids.adminUserId,
    coordinatorUserId: ids.coordinatorUserId,
    caregiverUserId: ids.caregiverUserId,
    hrUserId: ids.hrUserId,
    candidateUserId: ids.candidateUserId,
  })

  await signOut(page)
  const value = (result as { value?: Record<string, string> }).value ?? result
  return value as {
    tenantId: string
    candidateId: string
    coverageShiftId: string
    coverageRequestId: string
    formDefinitionId: string
    fileId: string
    documentArchiveItemId: string
  }
}
