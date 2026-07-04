import { test, expect, devices, type Page } from '@playwright/test'

const states = [
  { name: 'today', query: 'today', assert: async (page: Page) => await expect(page.getByText('Your visit today')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'clock_in', query: 'clockIn', assert: async (page: Page) => await expect(page.getByRole('button', { name: /Clock in now/i })).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'clock_in_geofence', query: 'clockInGeofence', assert: async (page: Page) => await expect(page.getByText('Checking your location')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step1_when', query: 'step1', assert: async (page: Page) => await expect(page.getByText('When were you there')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step2_what', query: 'step2', assert: async (page: Page) => await expect(page.getByText('What did you help with')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step3_how', query: 'step3', assert: async (page: Page) => await expect(page.getByText('How did the visit go')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step4_goal', query: 'step4', assert: async (page: Page) => await expect(page.getByText('Did you work on her goals')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step5_issues', query: 'step5', assert: async (page: Page) => await expect(page.getByText('Anything we should know')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'step6_done', query: 'step6', assert: async (page: Page) => await expect(page.getByText('One last look')).toBeVisible(), time: '2026-06-25T15:02:00Z' },
  { name: 'clock_out', query: 'clockOut', assert: async (page: Page) => await expect(page.getByRole('button', { name: /Clock out now/i })).toBeVisible(), time: '2026-06-25T19:04:00Z' },
  { name: 'success', query: 'success', assert: async (page: Page) => await expect(page.getByText('All done')).toBeVisible(), time: '2026-06-25T19:04:00Z' },
]

const baseURL = 'http://127.0.0.1:5178'
const outDir = '.hermes-pipeline/20260624_185028/screenshots'

test.use({
  ...devices['iPhone 13'],
  baseURL,
})

for (const { name, query, assert, time } of states) {
  test(`screenshot ${name}`, async ({ page }) => {
    await page.clock.install({ time: new Date(time).getTime() })
    await page.goto(`/?state=${query}`)
    await page.waitForLoadState('networkidle')
    await assert(page)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
  })
}
