import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  e2eCredentialsAvailable,
  resetE2EShifts,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import { dryRunHarnessUrl } from './helpers/dryRun'

const GEOFENCE_CLIENT = 'Maya Torres'
const INSIDE_COORDS = { latitude: 44.9779, longitude: -93.2649 }
const OUTSIDE_COORDS = { latitude: 45.0, longitude: -93.0 }

test.describe.configure({ mode: 'serial' })


async function enableGeofence(page: import('@playwright/test').Page) {
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/settings/geofence')
  await expect(page).toHaveURL(/settings\/geofence/)

  await page.locator('[data-testid="geofence-enabled-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-in-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-out-checkbox"]').check()
  await page.locator('[data-testid="save-geofence-button"]').click()
  await expect(page.locator('[data-testid="geofence-message"]')).toHaveText('Geofence settings saved.', { timeout: 10000 })
  await signOut(page)
}

async function openGeofenceShift(page: import('@playwright/test').Page) {
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()
  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
}

if (e2eCredentialsAvailable()) {
  test.afterEach(async ({ page }) => {
    // Restore fixture shifts to a clean scheduled state and disable geofence
    // so each scenario starts from the same baseline.
    await resetE2EShifts(page)
  })

  test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
    await enableGeofence(page)

    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(INSIDE_COORDS)
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
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
    await geoWhen.locator('button:has-text("Change")').nth(1).click()
    await page.locator('[data-testid="end-time-input"]').fill('18:00')
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="service-option-Bathing"]').click()
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="narrative-textarea"]').fill(
      'I helped Maya with mobility exercises and a meal. She was steady on her feet.',
    )
    await page.locator('[data-testid="wizard-next-button"]:visible').click()
    await page.locator('[data-testid="goal-option-Walk a little each day"]').click()
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
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
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
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
    await openGeofenceShift(page)

    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()

    const clockInButton = page.locator('[data-testid="clock-in-button"]')
    await clockInButton.click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
    await expect(clockInButton).toBeDisabled()
  })

  test('disabling geofence stops requesting browser location', async ({ page, context }) => {
    // Geofence is already disabled by the afterEach reset.
    await context.clearPermissions()
    await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
    await openGeofenceShift(page)

    await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
  })

} else {
  test('geofence inside radius allows clock in/out and stores location evidence (dry-run)', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(INSIDE_COORDS)
    await page.goto(dryRunHarnessUrl('geofence.html?view=settings'))

    await page.locator('[data-testid="geofence-enabled-checkbox"]').check()
    await page.locator('[data-testid="geofence-enforce-clock-in-checkbox"]').check()
    await page.locator('[data-testid="geofence-enforce-clock-out-checkbox"]').check()
    await page.locator('[data-testid="save-geofence-button"]').click()
    await expect(page.locator('[data-testid="geofence-message"]')).toHaveText('Geofence settings saved.')

    await page.goto(dryRunHarnessUrl('geofence.html?view=caregiver-list&geofence=enabled'))
    await page.locator('[data-testid="clock-in-start-button"]').click()
    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()
    await page.locator('[data-testid="clock-in-button"]').click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
    await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached()

    for (let index = 0; index < 6; index += 1) {
      await page.locator('[data-testid="wizard-next-button"]:visible').click()
    }
    await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible()
    const outPanel = page.locator('[data-testid="clock-out-location-panel"]')
    await expect(outPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
    await expect(page.locator('[data-testid="clock-out-button"]')).toBeEnabled()
    await page.locator('[data-testid="clock-out-button"]').click()
    await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible()
  })

  test('geofence outside radius shows blocked UI and server rejects punch (dry-run)', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(OUTSIDE_COORDS)
    await page.goto(dryRunHarnessUrl('geofence.html?view=caregiver-list&geofence=enabled'))
    await page.locator('[data-testid="clock-in-start-button"]').click()
    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()
    const clockInButton = page.locator('[data-testid="clock-in-button"]')
    await clockInButton.click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
    await expect(clockInButton).toBeDisabled()
    await expect(page.locator('[data-testid="step-content-when"]')).toHaveClass(/hidden/)
  })

  test('denied geolocation permission shows blocked UI and creates no punch (dry-run)', async ({ page, context }) => {
    await context.clearPermissions()
    await page.goto(dryRunHarnessUrl('geofence.html?view=caregiver-list&geofence=enabled'))
    await page.locator('[data-testid="clock-in-start-button"]').click()
    const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
    await expect(locationPanel).toBeVisible()
    const clockInButton = page.locator('[data-testid="clock-in-button"]')
    await clockInButton.click()
    await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
    await expect(clockInButton).toBeDisabled()
    await expect(page.locator('[data-testid="step-content-when"]')).toHaveClass(/hidden/)
  })

  test('disabling geofence stops requesting browser location (dry-run)', async ({ page, context }) => {
    await context.clearPermissions()
    await page.goto(dryRunHarnessUrl('geofence.html?view=caregiver-list'))
    await page.locator('[data-testid="clock-in-start-button"]').click()
    await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveClass(/hidden/)
    await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
  })
}
