import { expect, type Page } from '@playwright/test'

export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
export const E2E_CAREGIVER_EMAIL = process.env.E2E_CAREGIVER_EMAIL ?? ''
export const E2E_CAREGIVER_PASSWORD = process.env.E2E_CAREGIVER_PASSWORD ?? ''
export const E2E_COORDINATOR_EMAIL = process.env.E2E_COORDINATOR_EMAIL ?? ''
export const E2E_COORDINATOR_PASSWORD = process.env.E2E_COORDINATOR_PASSWORD ?? ''

export function e2eCredentialsAvailable(): boolean {
  return Boolean(
    E2E_ORG_ID &&
      E2E_ADMIN_EMAIL &&
      E2E_ADMIN_PASSWORD &&
      E2E_CAREGIVER_EMAIL &&
      E2E_CAREGIVER_PASSWORD &&
      E2E_COORDINATOR_EMAIL &&
      E2E_COORDINATOR_PASSWORD,
  )
}

export function assertE2ECredentialsConfigured(): void {
  if (!e2eCredentialsAvailable()) {
    throw new Error(
      'E2E Clerk credentials are not configured. Set E2E_CLERK_ORG_ID, E2E_ADMIN_EMAIL/PASSWORD, E2E_CAREGIVER_EMAIL/PASSWORD, and E2E_COORDINATOR_EMAIL/PASSWORD.',
    )
  }
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
}

export async function signInWithClerk(
  page: Page,
  email: string,
  password: string,
  orgId: string,
) {
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)

  // Clerk sign-in flow: email -> continue -> password -> continue
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[inputmode="email"]').first()
  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)

  const continueButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await continueButton.click()

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
  await expect(passwordInput).toBeVisible({ timeout: 10000 })
  await passwordInput.fill(password)

  const submitButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await submitButton.click()

  // Wait for navigation away from sign-in
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')

  await selectOrgIfAsked(page, orgId)
}

export async function signOut(page: Page) {
  // Clear Clerk session state so the next sign-in starts fresh.
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')
}

async function extractClerkToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
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
      args: { clerkOrgId: E2E_ORG_ID },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`resetE2EShifts failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('resetE2EShifts result:', result)

  await signOut(page)
}
