const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const baseUrl = 'http://localhost:5180/dev/screenshots'
const outDir = path.resolve(__dirname)

const views = [
  'scheduling',
  'shift-editor',
  'shift-packet',
  'coverage',
  'caregiver-schedule',
  'availability',
]

async function capture(page, view, device) {
  const url = `${baseUrl}?view=${view}`
  await page.goto(url, { waitUntil: 'networkidle' })
  // Give modals / lazy routes a beat to settle.
  await page.waitForTimeout(500)
  const suffix = device === 'desktop' ? 'desktop' : 'mobile'
  const fileName = `live-${view}-${suffix}.png`
  const filePath = path.join(outDir, fileName)
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`Captured ${fileName}`)
}

async function main() {
  const browser = await chromium.launch()

  for (const view of views) {
    const desktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    await capture(desktop, view, 'desktop')
    await desktop.close()

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    })
    await capture(mobile, view, 'mobile')
    await mobile.close()
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
