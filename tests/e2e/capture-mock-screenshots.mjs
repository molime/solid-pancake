import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'fs'

async function main() {
  console.log('Starting mock screenshot capture...')
  const screenshotDir = 'test-results/phase2-verification'
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844, deviceScaleFactor: 2 } })

  // Collect JS errors
  page.on('console', msg => console.log('CONSOLE:', msg.text()))
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  const views = [
    ['candidate-checklist', 'live-checklist'],
    ['candidate-application', 'live-application'],
    ['candidate-upload', 'live-document-upload'],
    ['candidate-acknowledgment', 'live-acknowledgment'],
    ['candidate-training', 'live-training'],
    ['candidate-profile', 'live-profile'],
    ['candidate-status', 'live-status'],
    ['candidate-success', 'live-success'],
    ['candidate-apply-entry', 'live-apply-entry'],
  ]

  for (const [view, name] of views) {
    try {
      const url = 'http://127.0.0.1:5173/screenshot-capture.html?view=' + view
      console.log('Navigating to:', url)
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.waitForTimeout(3000)
      
      // Check if root has content
      const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 100) || 'empty')
      console.log('Root content for ' + view + ':', rootHtml.substring(0, 50))
      
      const path = screenshotDir + '/' + name + '.png'
      await page.screenshot({ path, fullPage: true })
      console.log('Captured: ' + name)
    } catch (e) {
      console.log('Failed to capture ' + name + ': ' + e.message)
    }
  }

  await browser.close()
  console.log('Done!')
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
