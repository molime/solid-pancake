// Focused QA verification spec for HR-portal items 7-11:
//   7. Session cleanup: HR signs out -> sign-in page; candidate then signs in
//      and lands on the candidate flow, NOT the HR portal.
//   8. HR sidebar AtriaLogo renders at h-14 (~56px), large and prominent.
//   9. HR Cases: "View →" opens the case detail modal, it STAYS OPEN, shows
//      all case fields, and the in-modal status dropdown fires the mutation.
//  10. HR Cases table actions column has only "View →" — no status Select.
//  11. Agency branding ("Powered by ATRIA-X Digital Solutions" + agency logo
//      when the tenant has one) at the bottom of HR dashboard and HR cases.
// Item 12 (SelectAgencyPage admin filtering) is verified by the unit tests in
// src/app/auth/SelectAgencyPage.test.tsx.
// Run with: node scripts/run-playwright-with-env.js qa-hr-portal --project=chromium
import { test, expect, type Page } from '@playwright/test'
import {
  signInAsHR,
  signInAsCandidate,
  assertE2ECredentialsConfigured,
} from './helpers/auth'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

async function clickSidebarNav(page: Page, label: string) {
  await page
    .locator('aside nav')
    .getByRole('link', { name: label })
    .first()
    .click()
}

test.describe('QA HR portal items 7-11', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  test('items 7, 8, 11: HR session cleanup, sidebar logo size, branding', async ({ page }) => {
    test.setTimeout(300_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInAsHR(page)
    console.log('QA 7/8/11: signed in as HR, url =', page.url())
    expect(page.url()).not.toMatch(/sign-in/)

    // --- Item 8: sidebar logo size --------------------------------------
    const sidebarLogo = page
      .locator('aside')
      .getByRole('img', { name: 'ATRIA-X' })
      .first()
    await expect(sidebarLogo).toBeVisible({ timeout: 15000 })
    const logoBox = await sidebarLogo.boundingBox()
    console.log('QA item 8: sidebar logo rendered height =', logoBox?.height)
    expect(logoBox).not.toBeNull()
    expect(logoBox!.height).toBeGreaterThanOrEqual(50)
    expect(logoBox!.height).toBeLessThanOrEqual(80)

    // --- Item 11 (dashboard): branding at bottom -------------------------
    // The HR dashboard lives at /hr (the HR sidebar has no "Dashboard" link).
    await page.goto('/hr')
    await expect(page).toHaveURL(/\/hr$/, { timeout: 15000 })
    await expect(
      page.getByText('Powered by ATRIA-X Digital Solutions').first(),
    ).toBeVisible({ timeout: 15000 })
    const dashAgencyLogo = page.getByRole('img', { name: 'Agency logo' }).first()
    const dashLogoVisible = await dashAgencyLogo.isVisible().catch(() => false)
    console.log('QA item 11: dashboard agency logo visible =', dashLogoVisible)

    // --- Navigate around HR pages ---------------------------------------
    await clickSidebarNav(page, 'Cases')
    await expect(page).toHaveURL(/\/hr\/cases/, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: 'HR Cases' }),
    ).toBeVisible({ timeout: 15000 })

    // --- Item 11 (cases page): branding at bottom ------------------------
    await expect(
      page.getByText('Powered by ATRIA-X Digital Solutions').first(),
    ).toBeVisible({ timeout: 15000 })

    await clickSidebarNav(page, 'Employees')
    await expect(page).toHaveURL(/\/hr\/employees/, { timeout: 15000 })

    // --- Item 7: sign out -> sign-in page --------------------------------
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/sign-in/, { timeout: 30000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    console.log('QA item 7: after HR sign out, url =', page.url())

    // --- Item 7: candidate sign-in must land on candidate flow -----------
    await signInAsCandidate(page)
    const candidateUrl = page.url()
    console.log('QA item 7: after candidate sign in, url =', candidateUrl)
    expect(candidateUrl).toMatch(/\/onboarding/)
    expect(candidateUrl).not.toMatch(/\/hr\//)
    // Stale-session bug check: no HR sidebar nav for the candidate.
    await expect(
      page.locator('aside nav').getByRole('link', { name: 'Cases' }),
    ).toHaveCount(0)
  })

  test('items 9, 10: HR cases modal stays open, fields, status dropdown; no Select in table', async ({ page }) => {
    test.setTimeout(300_000)
    if (mockE2EEnabled()) {
      test.skip(true, 'Requires a live Clerk-backed session.')
    }

    await signInAsHR(page)
    await page.goto('/hr/cases')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(
      page.getByRole('heading', { name: 'HR Cases' }),
    ).toBeVisible({ timeout: 30000 })

    // --- Seed a case via the UI if the table is empty --------------------
    const noCases = await page
      .getByText('No cases yet')
      .isVisible()
      .catch(() => false)
    if (noCases) {
      console.log('QA item 9: no seeded cases — creating one via New case modal')
      await page.getByRole('button', { name: /New case/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10000 })

      const subjectSelect = dialog.locator('#case-subject')
      await expect(subjectSelect).toBeVisible()
      // Wait for subjects to load, then pick the first real option.
      await expect
        .poll(async () => subjectSelect.locator('option').count(), {
          timeout: 15000,
        })
        .toBeGreaterThan(1)
      const subjectValue = await subjectSelect
        .locator('option')
        .nth(1)
        .getAttribute('value')
      await subjectSelect.selectOption(subjectValue)
      await dialog.locator('#case-title').fill('QA E2E case — modal verification')
      await dialog
        .locator('#case-description')
        .fill('Created by qa-hr-portal.spec.ts to verify the case detail modal.')
      await dialog.getByRole('button', { name: /Create case/i }).click()
      await expect(dialog).not.toBeVisible({ timeout: 15000 })
      await page.waitForLoadState('networkidle').catch(() => {})
    }

    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 15000 })
    const firstRow = table.locator('tbody tr').first()

    // --- Item 10: actions column has only "View →", no Select ------------
    await expect(firstRow.getByText('View →')).toBeVisible()
    expect(await firstRow.locator('select').count()).toBe(0)
    expect(await table.locator('tbody select').count()).toBe(0)
    console.log('QA item 10: no status Select in table rows; only View →')

    // --- Item 9: open the modal and verify it stays open -----------------
    await firstRow.getByText('View →').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    // Regression guard: the modal must not close itself immediately.
    await page.waitForTimeout(2000)
    await expect(dialog).toBeVisible()
    console.log('QA item 9: modal still open after 2s')

    // --- Item 9: all case fields visible ---------------------------------
    for (const label of [
      'CASE ID',
      'CATEGORY',
      'STATUS',
      'SUBJECT',
      'ASSIGNED TO',
      'OPENED',
      'DESCRIPTION',
    ]) {
      await expect(
        dialog.getByText(label, { exact: true }),
      ).toBeVisible({ timeout: 15000 })
    }
    // Title is rendered as the dialog heading.
    await expect(dialog.locator('h3')).not.toHaveText('Case details', {
      timeout: 15000,
    })
    const caseTitle = await dialog.locator('h3').textContent()
    console.log('QA item 9: modal title =', caseTitle)

    // --- Item 9: status dropdown fires the mutation without error --------
    const statusSelect = dialog.locator('select')
    await expect(statusSelect).toBeVisible()
    const originalStatus = await statusSelect.inputValue()
    console.log('QA item 9: original status =', originalStatus)
    const targetStatus = originalStatus === 'open' ? 'in_review' : 'open'

    await statusSelect.selectOption(targetStatus)
    // Success toast fires on mutation success; no error text in the dialog.
    await expect(page.getByText('Case updated')).toBeVisible({ timeout: 15000 })
    await expect(dialog.locator('p.text-atria-danger')).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await expect(statusSelect).toHaveValue(targetStatus)
    console.log('QA item 9: status changed to', targetStatus)

    // Restore the original status.
    await statusSelect.selectOption(originalStatus)
    await expect(page.getByText('Case updated').last()).toBeVisible({
      timeout: 15000,
    })
    await expect(statusSelect).toHaveValue(originalStatus)
    console.log('QA item 9: status restored to', originalStatus)

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10000 })
  })
})
