import { expect, type Page } from '@playwright/test'
import { e2eCredentialsAvailable } from './env'

export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
export const E2E_CAREGIVER_EMAIL = process.env.E2E_CAREGIVER_EMAIL ?? ''
export const E2E_CAREGIVER_PASSWORD = process.env.E2E_CAREGIVER_PASSWORD ?? ''
export const E2E_COORDINATOR_EMAIL = process.env.E2E_COORDINATOR_EMAIL ?? ''
export const E2E_COORDINATOR_PASSWORD = process.env.E2E_COORDINATOR_PASSWORD ?? ''

export function assertE2ECredentialsConfigured(): void {
  if (!e2eCredentialsAvailable()) {
    throw new Error(
      'E2E Clerk credentials are not configured. Set E2E_CLERK_ORG_ID, E2E_ADMIN_EMAIL/PASSWORD, E2E_CAREGIVER_EMAIL/PASSWORD, and E2E_COORDINATOR_EMAIL/PASSWORD.',
    )
  }
}

type ClerkEmail = {
  id: string
  email_address: string
}

type ClerkUser = {
  id: string
  email_addresses: ClerkEmail[]
}

type ClerkSignInToken = {
  token: string
}


function clerkApiHeaders(secretKey: string) {
  return {
    Authorization: `Bearer ${secretKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function findClerkUserId(email: string): Promise<string> {
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

async function createSignInTicket(email: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null

  const tokenResponse = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: clerkApiHeaders(secretKey),
    body: JSON.stringify({
      user_id: await findClerkUserId(email),
      expires_in_seconds: 600,
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error(
      `Could not create Clerk E2E sign-in ticket for ${email}: ${tokenResponse.status}`,
    )
  }

  const signInToken = (await tokenResponse.json()) as ClerkSignInToken
  return signInToken.token
}

async function selectOrgIfAsked(page: Page, orgId: string) {
  // Clerk's organization switcher may appear after sign-in. Try to select the
  // expected org by its id or name, or just wait for the app to settle.
  const orgButton = page.locator(`[data-testid="organization-button-${orgId}"]`).or(
    page.locator(`button:has-text("${orgId}")`),
  )
  if (await orgButton.isVisible().catch(() => false)) {
    await orgButton.click()
    await page.waitForLoadState('networkidle')
  }

  // ATRIA-X then shows its own agency picker. Opening the agency here lets
  // ensureSelectedAgency bootstrap the tenant before seed mutations run.
  if (page.url().includes('/select-agency')) {
    const agencyButton = page.locator('button', { hasText: /Role:/ }).first()
    if (await agencyButton.isVisible().catch(() => false)) {
      await agencyButton.click()
      await expect(page).not.toHaveURL(/select-agency/, { timeout: 20000 })
      await page.waitForLoadState('networkidle')
    }
  }
}

export async function signInWithClerk(
  page: Page,
  email: string,
  password: string,
  orgId: string,
) {
  await page.goto('/sign-in').catch(() => {})
  await page.evaluate(async () => {
    const clerk = (window as unknown as Record<string, unknown>).Clerk as
      | { session?: unknown; signOut?: () => Promise<void> }
      | undefined
    if (clerk?.session && clerk.signOut) {
      await clerk.signOut().catch(() => {})
    }
    localStorage.clear()
    sessionStorage.clear()
    if ('indexedDB' in window && 'databases' in indexedDB) {
      const databases = await indexedDB.databases()
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(name)
                request.onsuccess = () => resolve()
                request.onerror = () => resolve()
                request.onblocked = () => resolve()
              }),
          ),
      )
    }
  }).catch(() => {})
  await page.context().clearCookies()

  const ticket = await createSignInTicket(email)
  if (ticket) {
    await page.goto(`/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
    await page.waitForLoadState('networkidle')
    await selectOrgIfAsked(page, orgId)
    await page.getByText('Opening agency workspace').waitFor({
      state: 'detached',
      timeout: 20000,
    }).catch(() => {})
    await page.waitForLoadState('networkidle')
    return
  }

  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)

  // Clerk sign-in flow fallback: email -> continue -> password -> continue.
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[inputmode="email"]').first()
  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)

  const continueButton = page
    .locator('button:has-text("Continue"):visible, button[type="submit"]:visible')
    .first()
  await continueButton.click()

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
  await expect(passwordInput).toBeVisible({ timeout: 10000 })
  await passwordInput.fill(password)

  const submitButton = page
    .locator('button:has-text("Continue"):visible, button[type="submit"]:visible')
    .first()
  await submitButton.click()

  // Wait for navigation away from sign-in
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')

  await selectOrgIfAsked(page, orgId)
}

export async function signOut(page: Page) {
  // Clear Clerk session state so the next sign-in starts fresh.
  try {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  } catch {
    // Some contexts (e.g. about:blank or sandboxed frames) deny storage access.
  }
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')
}

async function extractClerkToken(page: Page): Promise<string | null> {
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

export async function resetE2EShifts(page: Page) {
  assertE2ECredentialsConfigured()

  // Ensure a clean session before signing in as admin; the caller may still be
  // signed in as a caregiver or coordinator.
  await signOut(page)
  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot reset e2e fixtures.')
  }

  const token = await extractClerkToken(page)
  if (!token) {
    throw new Error('Could not extract Clerk session token; cannot reset e2e fixtures.')
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'seed:resetE2EShifts',
      args: {
        clerkOrgId: E2E_ORG_ID,
        adminUserId: await findClerkUserId(E2E_ADMIN_EMAIL),
        coordinatorUserId: await findClerkUserId(E2E_COORDINATOR_EMAIL),
        caregiverUserId: await findClerkUserId(E2E_CAREGIVER_EMAIL),
      },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`resetE2EShifts failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('resetE2EShifts result:', result)
  if (result.status !== 'success') {
    throw new Error(`resetE2EShifts failed: ${JSON.stringify(result)}`)
  }

  await signOut(page)
}
