import { chromium } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:5174'
const slug = 'my-organization-test-1779197430198727447'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/apply?agency=${encodeURIComponent(slug)}`)
  try {
    await page.waitForFunction(() => {
      const h1 = document.querySelector('h1')
      return h1 && !h1.textContent?.includes('our agency')
    }, { timeout: 15000 })
  } catch {}
  const heading = await page.locator('h1').textContent()
  console.log('Apply page heading:', heading?.trim())
  await page.screenshot({ path: 'scripts/verify-apply-link.png' })
  await browser.close()
}
main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
