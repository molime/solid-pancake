import { test, expect } from '@playwright/test'

test.describe('training redirect preservation', () => {
  test('visiting /training while signed out redirects to sign-in with redirect param', async ({
    page,
  }) => {
    const response = await page.goto('/training')
    expect(response?.status()).toBeLessThan(500)

    // The app should land on the sign-in page and preserve the original target.
    await expect(page).toHaveURL(/\/sign-in/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/training')
  })

  test('visiting /training/admin while signed out redirects to sign-in with redirect param', async ({
    page,
  }) => {
    const response = await page.goto('/training/admin')
    expect(response?.status()).toBeLessThan(500)

    await expect(page).toHaveURL(/\/sign-in/)
    const url = new URL(page.url())
    expect(url.searchParams.get('redirect')).toBe('/training/admin')
  })
})
