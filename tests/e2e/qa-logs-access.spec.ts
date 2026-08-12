// QA verification spec for the Logs access restriction:
//   1. Dashboard no longer renders a "Quick Actions" button.
//   2. "Logs" sidebar nav item is visible for org:admin ONLY (not
//      coordinator, caregiver, or HR) and /logs redirects non-admins.
//   3. /audit renders the audit-readiness dashboard with KPI cards.
//   4. /logs renders the event log table.
//   5. "Download Audit Report" produces a CSV download.
//   6. All pre-existing admin routes still resolve (no routes dropped).
// Run with: node scripts/run-playwright-with-env.js qa-logs-access --project=chromium
import { test, expect, type Page } from '@playwright/test'
import {
  E2E_ORG_ID,
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_HR_EMAIL,
  E2E_HR_PASSWORD,
  signInWithClerk,
  assertE2ECredentialsConfigured,
} from './helpers/auth'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

function sidebarLink(page: Page, label: string) {
  return page
    .locator('aside nav')
    .getByRole('link', { name: label, exact: true })
}

// Routes an org:admin can reach, with the pathname each must settle on.
// /dashboard is an alias that redirects to /admin.
const ADMIN_ROUTES: Array<[string, RegExp]> = [
  ['/admin', /\/admin$/],
  ['/dashboard', /\/admin$/],
  ['/compliance', /\/compliance$/],
  ['/reports', /\/reports$/],
  ['/audit', /\/audit$/],
  ['/logs', /\/logs$/],
  ['/notifications', /\/notifications$/],
  ['/billing', /\/billing$/],
  ['/billing/payroll', /\/billing\/payroll$/],
  ['/clients', /\/clients$/],
  ['/team', /\/team$/],
  ['/hr', /\/hr$/],
  ['/hr/candidates', /\/hr\/candidates$/],
  ['/hr/employees', /\/hr\/employees$/],
  ['/hr/cases', /\/hr\/cases$/],
  ['/search', /\/search$/],
  ['/settings/geofence', /\/settings\/geofence$/],
  ['/settings/allowed-domains', /\/settings\/allowed-domains$/],
  ['/scheduling', /\/scheduling$/],
  ['/coordinator/review', /\/coordinator\/review$/],
]

test.describe('QA Logs access restriction', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test('admin: no Quick Actions, Logs nav, /audit KPIs, CSV download, /logs table, routes intact', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInWithClerk(
      page,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD,
      E2E_ORG_ID,
      'org:admin',
    )

    // --- Item 1: Quick Actions button is gone from the dashboard --------
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Quick Actions')).toHaveCount(0)

    // --- Item 2 (admin): Logs nav item visible with /logs href ----------
    const logsLink = sidebarLink(page, 'Logs')
    await expect(logsLink).toBeVisible({ timeout: 15000 })
    await expect(logsLink).toHaveAttribute('href', '/logs')

    // --- Item 3: /audit shows the audit-readiness dashboard -------------
    await page.goto('/audit')
    await expect(
      page.getByRole('heading', { name: 'Audit Trail' }),
    ).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText('Audit-readiness tool for California ILS/SLS compliance'),
    ).toBeVisible()
    for (const label of [
      'Personnel Compliance Rate',
      'Background Checks',
      'Training Completion',
      'Documentation Completeness',
    ]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 30000 })
    }

    // --- Item 5: Download Audit Report produces a CSV download ----------
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page
      .getByRole('button', { name: 'Download Audit Report' })
      .click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^audit-readiness-.*\.csv$/)

    // --- Item 4: /logs shows the event log table ------------------------
    await page.goto('/logs')
    await expect(page.getByText('Events', { exact: true })).toBeVisible({
      timeout: 15000,
    })
    // Wait for the query to settle, then require the table (the dev
    // deployment has recorded audit events from prior activity).
    await page
      .getByText('Loading audit events…')
      .waitFor({ state: 'detached', timeout: 30000 })
      .catch(() => {})
    const table = page.getByRole('table')
    await expect(table).toBeVisible({ timeout: 30000 })
    for (const column of ['When', 'Action', 'Actor', 'Role', 'Change']) {
      await expect(
        table.getByRole('columnheader', { name: column }),
      ).toBeVisible()
    }

    // --- Item 6: no routes dropped — every admin route still resolves ---
    for (const [path, expectedUrl] of ADMIN_ROUTES) {
      await page.goto(path)
      await expect(page).toHaveURL(expectedUrl, { timeout: 30000 })
    }
  })

  test('coordinator: Logs nav hidden and /logs redirects away', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInWithClerk(
      page,
      E2E_COORDINATOR_EMAIL,
      E2E_COORDINATOR_PASSWORD,
      E2E_ORG_ID,
      'org:coordinator',
    )

    await expect(
      page.locator('aside nav').first(),
    ).toBeVisible({ timeout: 15000 })
    await expect(sidebarLink(page, 'Logs')).toHaveCount(0)

    await page.goto('/logs')
    await expect(page).not.toHaveURL(/\/logs$/, { timeout: 15000 })
    await expect(page.getByText('Events', { exact: true })).toHaveCount(0)
  })

  test('caregiver: Logs nav hidden', async ({ page }) => {
    test.setTimeout(180_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInWithClerk(
      page,
      E2E_CAREGIVER_EMAIL,
      E2E_CAREGIVER_PASSWORD,
      E2E_ORG_ID,
      'org:caregiver',
    )

    await expect(
      page.locator('aside nav').first(),
    ).toBeVisible({ timeout: 15000 })
    await expect(sidebarLink(page, 'Logs')).toHaveCount(0)
    await expect(sidebarLink(page, 'Audit Trail')).toHaveCount(0)
  })

  test('hr: Logs nav hidden, Audit Trail nav kept, /logs redirects away', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInWithClerk(
      page,
      E2E_HR_EMAIL,
      E2E_HR_PASSWORD,
      E2E_ORG_ID,
      'org:hr',
    )

    await expect(
      page.locator('aside nav').first(),
    ).toBeVisible({ timeout: 15000 })
    await expect(sidebarLink(page, 'Logs')).toHaveCount(0)
    await expect(sidebarLink(page, 'Audit Trail')).toBeVisible()

    await page.goto('/logs')
    await expect(page).not.toHaveURL(/\/logs$/, { timeout: 15000 })
  })
})
