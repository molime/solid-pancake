import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } })
await page.goto('http://127.0.0.1:5185/?state=dashboard')
await page.waitForTimeout(3000)
const text = await page.locator('body').innerText()
console.log('--- body text ---')
console.log(text.slice(0, 3000))
const logs = await page.evaluate(() => {
  // We can't read console logs directly, but we can capture errors from window
  return (window.__errors || []).join('\n')
})
console.log('--- errors ---')
console.log(logs)
await browser.close()
