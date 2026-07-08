import { expect, type Page } from '@playwright/test'
import { e2eCredentialsAvailable, mockE2EEnabled } from './env'

export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
export const E2E_CAREGIVER_EMAIL = process.env.E2E_CAREGIVER_EMAIL ?? ''
export const E2E_CAREGIVER_PASSWORD = process.env.E2E_CAREGIVER_PASSWORD ?? ''
export const E2E_COORDINATOR_EMAIL = process.env.E2E_COORDINATOR_EMAIL ?? ''
export const E2E_COORDINATOR_PASSWORD = process.env.E2E_COORDINATOR_PASSWORD ?? ''
export const E2E_HR_EMAIL = process.env.E2E_HR_EMAIL ?? ''
export const E2E_HR_PASSWORD = process.env.E2E_HR_PASSWORD ?? ''
export const E2E_CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL ?? ''
export const E2E_CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD ?? ''

export const MOCK_ADMIN_USER_ID = 'e2e-mock-admin'
export const MOCK_COORDINATOR_USER_ID = 'e2e-mock-coordinator'
export const MOCK_CAREGIVER_USER_ID = 'e2e-mock-caregiver'
export const MOCK_HR_USER_ID = 'e2e-mock-hr'
export const MOCK_CANDIDATE_USER_ID = 'e2e-mock-candidate'

const MOCK_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtbW9jay11c2VyIiwib3JnX2lkIjoiZTJlLW1vY2stb3JnIiwib3JnX3JvbGUiOiJvcmc6YWRtaW4iLCJlbWFpbCI6ImUyZS1tb2NrQGF0cmlheC50ZXN0IiwiaWF0IjoxNzA0MDY0MDAwfQ.mock-signature'

export function assertE2ECredentialsConfigured(): void {
  if (!e2eCredentialsAvailable()) {
    throw new Error(
      'E2E Clerk credentials are not configured. Set E2E_CLERK_ORG_ID, E2E_ADMIN_EMAIL/PASSWORD, E2E_CAREGIVER_EMAIL/PASSWORD, E2E_COORDINATOR_EMAIL/PASSWORD, E2E_HR_EMAIL/PASSWORD, and E2E_CANDIDATE_EMAIL/PASSWORD.',
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

  const normalized = email.toLowerCase()

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
  const user = users.find((candidate) =>
    candidate.email_addresses.some(
      (entry) => entry.email_address.toLowerCase() === normalized,
    ),
  )
  if (user) return user.id

  // Fallback: search organization memberships when the global user query
  // does not return the fixture account.
  const membershipsResponse = await fetch(
    `https://api.clerk.com/v1/organizations/${E2E_ORG_ID}/memberships?limit=100`,
    { headers: clerkApiHeaders(secretKey) },
  )
  if (membershipsResponse.ok) {
    const payload = (await membershipsResponse.json()) as {
      data?: Array<{
        public_user_data?: {
          user_id?: string
          identifier?: string
        }
      }>
    }
    const membership = payload.data?.find(
      (m) => m.public_user_data?.identifier?.toLowerCase() === normalized,
    )
    if (membership?.public_user_data?.user_id) {
      return membership.public_user_data.user_id
    }
  }

  throw new Error(`Clerk E2E user ${email} was not found.`)
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

function roleLabel(role?: string) {
  if (!role) return undefined
  return role.replace(/^org:/, '').toLowerCase()
}

async function waitForWorkspaceReady(page: Page) {
  await page.getByText('Opening agency workspace').waitFor({
    state: 'detached',
    timeout: 20000,
  }).catch(() => {})
  await page.getByText('Preparing workspace').waitFor({
    state: 'detached',
    timeout: 20000,
  }).catch(() => {})
  await page.waitForLoadState('networkidle')
}

async function selectOrgIfAsked(page: Page, orgId: string, role?: string) {
  // Clerk's organization switcher may appear after sign-in. Try to select the
  // expected org by its id or name, or just wait for the app to settle.
  const orgButton = page.locator(`[data-testid="organization-button-${orgId}"]`).or(
    page.locator(`button:has-text("${orgId}")`),
  )
  if (await orgButton.isVisible().catch(() => false)) {
    await orgButton.click()
    await page.waitForLoadState('networkidle')
  }

  // ATRIA-X then shows its own agency picker. Users with multiple roles in the
  // same org see one card per role, so select the card matching the requested
  // role (or the first one when no role is supplied).
  if (!page.url().includes('/select-agency')) return

  const expectedLabel = roleLabel(role)
  const agencyButton = expectedLabel
    ? page.locator('button', { hasText: new RegExp(`Role:\\s*${expectedLabel}`, 'i') }).first()
    : page.locator('button', { hasText: /Role:/ }).first()

  // Prefer selecting by role label, but fall back to the first agency card
  // because the Clerk React SDK may expose a generic role such as org:member.
  const fallbackAgencyButton = page
    .locator('button', { hasText: /Diego's Agency/ })
    .first()
  const effectiveAgencyButton = (await agencyButton.isVisible().catch(() => false))
    ? agencyButton
    : fallbackAgencyButton

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!page.url().includes('/select-agency')) break
    if (await effectiveAgencyButton.isVisible().catch(() => false)) {
      await effectiveAgencyButton.click()
      // Give Clerk a moment to persist the active-org selection; if the page
      // does not navigate away, reload so the app boots with the org already
      // active.
      try {
        await expect(page).not.toHaveURL(/select-agency/, { timeout: 8000 })
        break
      } catch {
        if (page.url().includes('/select-agency')) {
          await page.waitForTimeout(1500)
          if (page.url().includes('/select-agency')) {
            await page.reload()
            await page.waitForLoadState('networkidle')
          }
        }
      }
    } else {
      break
    }
  }

  if (page.url().includes('/select-agency')) {
    await expect(page).not.toHaveURL(/select-agency/, { timeout: 30000 })
  }
  await waitForWorkspaceReady(page)
}

export async function signInWithClerk(
  page: Page,
  email: string,
  password: string,
  orgId: string,
  role?: string,
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
    await selectOrgIfAsked(page, orgId, role)
    await waitForWorkspaceReady(page)
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

  await selectOrgIfAsked(page, orgId, role)
  await waitForWorkspaceReady(page)
}

export async function signInAsHR(page: Page) {
  if (mockE2EEnabled()) {
    await mockSignInAsRole(page, 'org:hr', E2E_ORG_ID)
  } else {
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID)
  }
}

export async function signInAsCandidate(page: Page) {
  if (mockE2EEnabled()) {
    await mockSignInAsRole(page, 'org:candidate', E2E_ORG_ID)
  } else {
    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
    )
  }
}

export async function mockSignInAsRole(
  page: Page,
  role: string,
  clerkOrgId: string,
) {
  await page.evaluate(async () => {
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

  await page.addInitScript(
    ({ role, clerkOrgId }) => {
      ;(window as unknown as Record<string, unknown>).__E2E_MOCK_ROLE__ = role
      ;(window as unknown as Record<string, unknown>).__E2E_MOCK_ORG_ID__ =
        clerkOrgId
    },
    { role, clerkOrgId },
  )

  await page.goto('/select-agency')
  await page.waitForLoadState('networkidle')
}

export async function signOut(page: Page) {
  // Clear Clerk session state so the next sign-in starts fresh.
  try {
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
    })
  } catch {
    // Some contexts (e.g. about:blank or sandboxed frames) deny storage access.
  }
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')
}

export async function extractClerkToken(page: Page): Promise<string | null> {
  return page.evaluate(async (mockJwt) => {
    const isMock =
      typeof (window as unknown as Record<string, unknown>).__E2E_MOCK_ROLE__ ===
      'string'
    if (isMock) {
      return mockJwt
    }

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
  }, MOCK_JWT)
}

export { resetE2EShifts, resetE2ECandidate } from './seed'
