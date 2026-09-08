import { chromium } from '@playwright/test'

const PLATFORM_ADMIN_TICKET = process.env.PLATFORM_ADMIN_TICKET
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5174'
const TARGET_EMAIL = 'diego.molina.sieiro+caregiver01@gmail.com'

if (!PLATFORM_ADMIN_TICKET) {
  console.error('Set PLATFORM_ADMIN_TICKET to the platform admin Clerk ticket.')
  process.exit(1)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(PLATFORM_ADMIN_TICKET)}`)
    await page.waitForURL(/platform\/subscriptions/, { timeout: 20000 })
    console.log('Signed in as platform admin.')

    // Click the first agency row.
    await page.locator('table tbody tr').first().click()
    await page.waitForURL(/platform\/subscriptions\/.+/, { timeout: 10000 })
    console.log('Opened agency detail.')

    // Scroll to the Testing presets section and delete progress.
    const deleteInput = page.locator('input[type="email"]').last()
    await deleteInput.fill(TARGET_EMAIL)
    await page.locator('button:has-text("Delete progress")').click()

    await page.waitForSelector('text=Deleted', { timeout: 15000 })
    const message = await page.locator('text=/Deleted \\d+ platform completion/i').textContent()
    console.log('Success:', message?.trim())
  } catch (err) {
    console.error('Failed:', err.message)
    await page.screenshot({ path: 'scripts/delete-caregiver01-training-error.png' })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
