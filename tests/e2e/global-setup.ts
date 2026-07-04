import { chromium, type FullConfig } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import { e2eCredentialsAvailable, isLocalConvexUrl } from './helpers/env'

type RoleCredentials = {
  email: string
  password: string
}

async function extractClerkUserId(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const clerk = (window as unknown as Record<string, unknown>).Clerk as
      | { user?: { id: string } }
      | undefined
    return clerk?.user?.id ?? null
  })
}

async function seedE2EFixtures(
  authToken: string,
  userIds: {
    adminUserId: string
    coordinatorUserId: string
    caregiverUserId: string
  },
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot seed e2e fixtures.')
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      path: 'seed:seedE2E',
      args: {
        clerkOrgId: E2E_ORG_ID,
        adminUserId: userIds.adminUserId,
        coordinatorUserId: userIds.coordinatorUserId,
        caregiverUserId: userIds.caregiverUserId,
      },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`seedE2E failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('seedE2E result:', result)
}

async function extractClerkToken(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(async () => {
    const clerk = (window as unknown as Record<string, unknown>).Clerk as
      | { session?: { getToken: () => Promise<string | null> } }
      | undefined
    const sessionToken = await clerk?.session?.getToken()
    if (sessionToken) return sessionToken

    const keys = ['__clerk_client_jwt', '__session', '__clerk_session_jwt']
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value) return value
    }
    return null
  })
}

export default async function globalSetup(config: FullConfig) {
  if (!e2eCredentialsAvailable() || isLocalConvexUrl()) {
    console.log('Skipping global E2E seed: local Convex backend or missing credentials.')
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({
    baseURL: config.projects[0]?.use.baseURL,
  })

  try {
    const roles: Record<string, RoleCredentials> = {
      admin: { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
      coordinator: { email: E2E_COORDINATOR_EMAIL, password: E2E_COORDINATOR_PASSWORD },
      caregiver: { email: E2E_CAREGIVER_EMAIL, password: E2E_CAREGIVER_PASSWORD },
    }

    const userIds: Record<string, string> = {}
    for (const [role, credentials] of Object.entries(roles)) {
      await signInWithClerk(page, credentials.email, credentials.password, E2E_ORG_ID)
      const userId = await extractClerkUserId(page)
      if (!userId) {
        throw new Error(`Could not extract Clerk user id for ${role}.`)
      }
      userIds[role] = userId
      await signOut(page)
    }

    // Sign back in as admin so we can call the seed mutation with an admin token.
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

    // Bootstrap the tenant if this is the first run against this org.
    await page.goto('/select-agency')
    await page.waitForLoadState('networkidle')

    const token = await extractClerkToken(page)
    if (!token) {
      throw new Error('Could not extract Clerk session token; cannot seed e2e fixtures.')
    }

    await seedE2EFixtures(token, {
      adminUserId: userIds.admin,
      coordinatorUserId: userIds.coordinator,
      caregiverUserId: userIds.caregiver,
    })
  } finally {
    await browser.close()
  }
}
