import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5174'
const signin = process.argv[2]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

// Sign in as caregiver via ticket link.
await page.goto(signin, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(6000)
console.log('after sign-in url:', page.url())

// Go to training hub.
await page.goto(`${BASE}/training`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: 'qa-training-visual/01-training-hub.png', fullPage: true })
console.log('hub url:', page.url())

// Open the onboarding course.
const courseBtn = page.getByRole('link', { name: /Golden Ages Home Care Onboarding/i }).or(page.getByText('Golden Ages Home Care Onboarding').first())
if (await courseBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
  await courseBtn.click()
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'qa-training-visual/02-onboarding-first-step.png', fullPage: true })
  console.log('course url:', page.url())
} else {
  console.log('onboarding course not found on hub')
}

await browser.close()
