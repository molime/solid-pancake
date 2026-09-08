import { chromium } from '@playwright/test'

const ticket = process.env.PLATFORM_ADMIN_TICKET
const BASE_URL = 'http://127.0.0.1:5174'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForURL(/platform\/subscriptions/, { timeout: 30000 })
  await page.waitForTimeout(3000)
  const rows = await page.locator('table tbody tr').all()
  console.log(`Found ${rows.length} agencies`)
  if (rows.length === 0) {
    await page.screenshot({ path: 'scripts/get-agency-slugs-empty.png', fullPage: true })
    console.log('Screenshot saved to scripts/get-agency-slugs-empty.png')
    await browser.close()
    return
  }
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const row = rows[i]
    const cells = await row.locator('td').allTextContents()
    console.log(`Row ${i + 1}: ${cells.join(' | ')}`)
    await row.click()
    await page.waitForURL(/platform\/subscriptions\/.+/, { timeout: 10000 })
    const slugText = await page.locator('p:has-text("·")').textContent().catch(() => '')
    console.log(`  Detail: ${slugText?.trim()}`)
    await page.goto(`${BASE_URL}/platform/subscriptions`)
    await page.waitForSelector('table tbody tr', { timeout: 10000 })
    await page.waitForTimeout(1000)
  }
  await browser.close()
}
main().catch(async (err) => {
  console.error(err.message)
  process.exit(1)
})
