import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  resetE2EShifts,
  signInWithClerk,
  signOut,
} from './helpers/auth'

const GEOFENCE_CLIENT = 'Maya Torres'
const INSIDE_COORDS = { latitude: 44.9779, longitude: -93.2649, accuracy: 20 }
const OUTSIDE_COORDS = { latitude: 45.0, longitude: -93.0, accuracy: 20 }

test.describe('geofence scenarios', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(assertE2ECredentialsConfigured)

  async function setGeofenceViaConvex(
    page: import('@playwright/test').Page,
    enabled: boolean,
  ) {
    await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID, 'org:coordinator')
    const token = await page.evaluate(async () => {
      const clerk = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk
      return clerk?.session?.getToken() ?? null
    })
    expect(token).toBeTruthy()

    const response = await fetch(`${process.env.VITE_CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: 'tenantSettings:updateShiftGeofence',
        args: {
          clerkOrgId: E2E_ORG_ID,
          enabled,
          enforceClockIn: enabled,
          enforceClockOut: enabled,
          defaultRadiusMeters: 150,
          maxAccuracyMeters: 100,
        },
        format: 'json',
      }),
    })
    expect(response.ok).toBeTruthy()
    const result = await response.json()
    expect(result.status).toBe('success')
    await page.waitForTimeout(1000)
    await signOut(page)
  }

  async function enableGeofence(page: import('@playwright/test').Page) {
    await setGeofenceViaConvex(page, true)
  }

  async function openGeofenceShift(page: import('@playwright/test').Page) {
    // Hard navigate through about:blank to clear any in-app cache/state from
    // prior serial tests before loading the caregiver today view.
    await page.goto('about:blank')
    await page.goto('/caregiver/today')
    if (page.url().includes('/sign-in')) {
      await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
      await page.goto('/caregiver/today')
    }
    await expect(page).toHaveURL(/caregiver\/today/)

    const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
    await expect(shiftCard).toBeVisible({ timeout: 15000 })
    const shiftSection = shiftCard.locator('xpath=..')
    await shiftSection.locator('[data-testid="clock-in-start-button"]:visible').first().click()
    await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
  }

  test.afterEach(async ({ page }) => {
    // Restore fixture shifts to a clean scheduled state and disable geofence
    // so each scenario starts from the same baseline.
    await resetE2EShifts(page)
  })

  test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
    await enableGeofence(page)

    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(INSIDE_COORDS)
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
    await openGeofenceShift(page)

    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()

    await page.locator('[data-testid="clock-in-button"]').click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
    await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

    // Fill note quickly and clock out
    const geoWhen = page.locator('[data-testid="step-content-when"]')
    await geoWhen.locator('button:has-text("Change")').first().click()
    await page.locator('[data-testid="start-time-input"]').fill('14:00')
    await geoWhen.locator('button:has-text("Change")').first().click()
    await page.locator('[data-testid="end-time-input"]').fill('18:00')
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="service-option-Bathing"]').click()
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="narrative-textarea"]').fill(
      'I helped Maya with mobility exercises and a meal. She was steady on her feet.',
    )
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="goal-option-Walk a little each day"]').click({ force: true })
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="issue-choice-no"]').click()
    await page.locator('[data-testid^="task-complete-checkbox-"]').first().check()
    await page.locator('[data-testid^="task-proof-input-"]').first().setInputFiles({
      name: 'geo-proof.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('geofence proof'),
    })
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="confirm-checkbox"]').check()
    await page.locator('[data-testid="wizard-next-button"]:visible').click()

    await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
    const outPanel = page.locator('[data-testid="clock-out-location-panel"]')
    await expect(outPanel).toBeVisible()
    await expect(outPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
    await expect(page.locator('[data-testid="clock-out-button"]')).toBeEnabled()
    await page.locator('[data-testid="clock-out-button"]').click()
    await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })
  })

  test('geofence outside radius shows blocked UI and server rejects punch', async ({ page, context }) => {
    await enableGeofence(page)

    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(OUTSIDE_COORDS)
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
    await openGeofenceShift(page)

    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()

    const clockInButton = page.locator('[data-testid="clock-in-button"]')
    await clockInButton.click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
    await expect(clockInButton).toBeDisabled()
  })

  test('denied geolocation permission shows blocked UI and creates no punch', async ({ page, context }) => {
    await enableGeofence(page)

    await context.clearPermissions()
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
    await openGeofenceShift(page)

    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()

    const clockInButton = page.locator('[data-testid="clock-in-button"]')
    await clockInButton.click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
    await expect(clockInButton).toBeDisabled()
  })

  test('disabling geofence stops requesting browser location', async ({ page, context }) => {
    await setGeofenceViaConvex(page, false)
    await context.clearPermissions()
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID, 'org:caregiver')
    await openGeofenceShift(page)

    await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
  })
})
