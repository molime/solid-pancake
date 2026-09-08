import { chromium } from '@playwright/test'

const PLATFORM_ADMIN_TICKET = process.env.PLATFORM_ADMIN_TICKET
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5174'
const PRESETS = ['golden_ages', 'individuals_choice']

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

    await page.waitForSelector('table tbody tr', { timeout: 10000 })
    const rows = await page.locator('table tbody tr').all()
    console.log(`Found ${rows.length} agency row(s).`)

    for (let i = 0; i < Math.min(rows.length, PRESETS.length); i++) {
      const preset = PRESETS[i]
      // Re-query rows because the DOM refreshes after navigation.
      const currentRows = await page.locator('table tbody tr').all()
      await currentRows[i].click()
      await page.waitForURL(/platform\/subscriptions\/.+/, { timeout: 10000 })

      const buttonText = preset === 'golden_ages' ? 'Seed Golden Ages preset' : 'Seed Individuals Choice preset'
      await page.locator(`button:has-text("${buttonText}")`).click()
      await page.waitForSelector('text=/Seeded/i', { timeout: 30000 })
      const message = await page.locator('text=/Seeded .* for/i').last().textContent()
      console.log(message?.trim())

      await page.goto(`${BASE_URL}/platform/subscriptions`)
      await page.waitForURL(/platform\/subscriptions/, { timeout: 10000 })
      await page.waitForSelector('table tbody tr', { timeout: 10000 })
    }

    console.log('Done seeding test agencies.')
  } catch (err) {
    console.error('Failed:', err.message)
    await page.screenshot({ path: 'scripts/seed-test-agencies-error.png' })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
