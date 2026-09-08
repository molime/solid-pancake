import { chromium } from 'playwright'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5174'
const slug = process.argv[2] || 'my-organization-test-1779197430198727447'
const out = process.argv[3] || 'qa-hire-gate/shots/ga-apply-footer.png'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${base}/apply?agency=${slug}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const footer = page.locator('text=Powered by ATRIA-X Digital Solutions')
const img = page.locator('img[alt="Agency logo"]')
const src = (await img.count()) ? await img.getAttribute('src') : null
console.log('agency logo src:', src)
await footer.scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
const box = await footer.boundingBox()
if (box) {
  await page.screenshot({ path: out, clip: { x: 0, y: Math.max(0, box.y - 140), width: 1280, height: 260 } })
  console.log('saved', out)
}
await browser.close()
