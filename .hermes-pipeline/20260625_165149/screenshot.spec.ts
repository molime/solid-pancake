import { test, expect, type Page } from '@playwright/test'

const baseURL = 'http://127.0.0.1:5185'
const outDir = '.hermes-pipeline/20260625_165149/screenshots'

const states = [
  {
    name: 'dashboard',
    path: '/?state=dashboard',
    assert: async (page: Page) =>
      await expect(page.locator('body')).toContainText('Good afternoon, Carla'),
  },
  {
    name: 'queue',
    path: '/coordinator/review?state=queue',
    assert: async (page: Page) =>
      await expect(page.locator('body')).toContainText(
        'Documentation to review',
      ),
  },
  {
    name: 'detail',
    path: '/coordinator/review/detail?state=detail&shift=shift_screenshot',
    assert: async (page: Page) =>
      await expect(page.locator('body')).toContainText(
        "Ana Silva's shift notes",
      ),
  },
]

test.use({
  baseURL,
  viewport: { width: 1440, height: 1024 },
})

for (const { name, path, assert } of states) {
  test(`screenshot ${name}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await assert(page)
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `${outDir}/app-coordinator-${name}.png`,
      fullPage: false,
    })
  })
}
