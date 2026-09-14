// QA regression spec for the round-2 training-hub corrections:
//   1. /account renders the Clerk UserProfile for every signed-in role.
//   2. The sidebar exposes an "Account" nav item.
//   3. The topbar and training hub have no horizontal overflow at 390px.
// Run with: node scripts/run-playwright-with-env.js qa-account-mobile --project=chromium
import { test, expect } from '@playwright/test'
import { signInAsHR } from './helpers/auth'

test.describe('round-2 account & mobile @auth', () => {
  test('account settings page renders Clerk UserProfile', async ({ page }) => {
    await signInAsHR(page)
    await page.goto('/account')
    await expect(
      page.getByText('Manage your profile, password, and sign-in security.'),
    ).toBeVisible({ timeout: 20000 })
    // Clerk UserProfile renders its own sections.
    await expect(page.getByText('Profile details').first()).toBeVisible({
      timeout: 20000,
    })
  })

  test('sidebar shows Account item', async ({ page }) => {
    await signInAsHR(page)
    await page.goto('/hr')
    await expect(
      page.getByRole('link', { name: 'Account' }).first(),
    ).toBeVisible({ timeout: 20000 })
  })

  test('topbar has no horizontal overflow at 390px', async ({ page }) => {
    await signInAsHR(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/hr')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })

  test('training hub renders at 390px without overflow', async ({ page }) => {
    await signInAsHR(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/training')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})
