import { chromium } from '@playwright/test'

const ticket = process.env.PLATFORM_ADMIN_TICKET
const BASE_URL = 'http://127.0.0.1:5174'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForURL(/platform\/subscriptions/, { timeout: 20000 })
  await page.locator('table tbody tr').first().click()
  await page.waitForURL(/platform\/subscriptions\/.+/, { timeout: 10000 })
  await page.waitForSelector('text=Modules', { timeout: 10000 })
  const modules = await page.locator('h2:has-text("Modules") + p + div label span span').allTextContents()
  console.log('Modules found:', modules)
  await page.screenshot({ path: 'scripts/verify-training-module.png', fullPage: true })
  await browser.close()
}
main()
