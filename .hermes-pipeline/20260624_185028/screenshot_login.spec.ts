import { test, devices } from '@playwright/test'

test('capture sign-in page at mobile width', async ({ page }) => {
  await page.setViewportSize(devices['iPhone 12'].viewport)
  await page.goto('http://127.0.0.1:5173/caregiver/today')
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: '.hermes-pipeline/20260624_185028/screenshots/login_redirect.png',
    fullPage: true,
  })
})
