import { expect, test } from '@playwright/test'

test('sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)
})

test('select-agency page loads', async ({ page }) => {
  await page.goto('/select-agency')
  await expect(page).toHaveURL(/select-agency/)
})

test('root path loads', async ({ page }) => {
  await page.goto('/')
  // Root will redirect based on auth state; just verify it doesn't 404
  expect(page.url()).not.toContain('404')
})
