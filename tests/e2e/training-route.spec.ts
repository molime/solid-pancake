import { test, expect } from '@playwright/test'

test('training hub route loads without server error', async ({ page }) => {
  const response = await page.goto('/training')
  expect(response?.status()).toBeLessThan(500)
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})

test('training admin route loads without server error', async ({ page }) => {
  const response = await page.goto('/training/admin')
  expect(response?.status()).toBeLessThan(500)
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})
