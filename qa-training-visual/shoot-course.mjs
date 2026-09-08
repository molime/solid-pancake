import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5174'
const signin = process.argv[2]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

await page.goto(signin, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(6000)
console.log('after sign-in:', page.url())

await page.goto(`${BASE}/training`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)

const startBtn = page
  .getByRole('button', { name: /Start course/i })
  .or(page.getByRole('link', { name: /Start course/i }))
  .first()
await startBtn.click({ timeout: 15000 })
await page.waitForTimeout(6000)
console.log('course url:', page.url())
await page.screenshot({ path: 'qa-training-visual/02-onboarding-first-step.png', fullPage: true })

const bodyText = await page.locator('body').innerText()
const hourLines = [...new Set(bodyText.split('\n').filter(l => l.includes('Hour')).map(l => l.trim()).filter(Boolean))]
console.log('hour lines found:', hourLines.slice(0, 25))

const imgInfo = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')]
  return imgs.map(i => ({ src: (i.getAttribute('src') || '').slice(0, 90), w: i.naturalWidth }))
})
console.log('images:', JSON.stringify(imgInfo))

await browser.close()
