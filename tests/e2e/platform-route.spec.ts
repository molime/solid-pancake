import { test, expect } from '@playwright/test'

test('platform page loads without server error', async ({ page }) => {
  const response = await page.goto('/platform')
  expect(response?.status()).toBeLessThan(500)
  // Unauthenticated users are redirected — page should not crash
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})

test('platform billing page loads without server error', async ({ page }) => {
  const response = await page.goto('/platform/billing')
  expect(response?.status()).toBeLessThan(500)
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})

test('platform agencies page loads without server error', async ({ page }) => {
  const response = await page.goto('/platform/agencies')
  expect(response?.status()).toBeLessThan(500)
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})
