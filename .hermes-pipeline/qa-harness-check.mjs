// Harness-based QA for items 2 (ProgressSteps responsiveness) and 3 (SSN/ITIN label)
// against the mock-mode dev server on port 5174.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const results = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

try {
  // ---------- Item 2: ProgressSteps responsiveness ----------
  for (const vp of [
    { name: 'desktop', width: 1280, height: 900, labelsExpected: true },
    { name: 'mobile', width: 375, height: 800, labelsExpected: false },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))
    await page.goto(`${BASE}/dev/screenshots?view=candidate-application`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const nav = page.locator('nav[aria-label="Progress"]')
    const navVisible = await nav.isVisible().catch(() => false)
    const circles = nav.locator('li .rounded-full')
    const circleCount = await circles.count()
    let allCirclesVisible = circleCount > 0
    for (let i = 0; i < circleCount; i++) {
      if (!(await circles.nth(i).isVisible())) allCirclesVisible = false
    }
    record(
      `2a. ProgressSteps circles visible (${vp.name} ${vp.width}px)`,
      navVisible && allCirclesVisible,
      `nav=${navVisible} circles=${circleCount} allVisible=${allCirclesVisible}`,
    )

    const labels = nav.locator('li p.text-sm')
    const labelCount = await labels.count()
    let anyLabelVisible = false
    for (let i = 0; i < labelCount; i++) {
      if (await labels.nth(i).isVisible()) anyLabelVisible = true
    }
    record(
      `2b. Step labels ${vp.labelsExpected ? 'visible' : 'hidden'} (${vp.name} ${vp.width}px)`,
      anyLabelVisible === vp.labelsExpected,
      `labels=${labelCount} anyVisible=${anyLabelVisible}`,
    )
    await ctx.close()
  }

  // ---------- Item 3: SSN/ITIN dynamic label ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))
  // Personal info is step index 1; resume directly there.
  await page.addInitScript(() => sessionStorage.setItem('atriax.application.step', '1'))
  await page.goto(`${BASE}/dev/screenshots?view=candidate-application`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  const idType = page.locator('#idType')
  record('3a. ID type select present on application form', await idType.isVisible().catch(() => false))

  const ssnLabel = page.locator('label[for="ssn"]')
  const readLabel = async () => (await ssnLabel.textContent())?.trim()

  const initialLabel = await readLabel()
  record('3b. Default label is "SSN / ITIN"', initialLabel?.includes('SSN / ITIN') ?? false, `got "${initialLabel}"`)

  await idType.selectOption('ssn')
  await page.waitForTimeout(300)
  const labelAfterSsn = await readLabel()
  record(
    '3c. Selecting SSN changes label to "SSN"',
    labelAfterSsn === 'SSN' || labelAfterSsn === 'SSN *' || (labelAfterSsn?.startsWith('SSN') && !labelAfterSsn.includes('ITIN')) || false,
    `got "${labelAfterSsn}"`,
  )

  await idType.selectOption('itin')
  await page.waitForTimeout(300)
  const labelAfterItin = await readLabel()
  record(
    '3d. Selecting ITIN changes label to "ITIN"',
    labelAfterItin?.startsWith('ITIN') ?? false,
    `got "${labelAfterItin}"`,
  )
  await ctx.close()
} catch (err) {
  record('script completed without exception', false, String(err))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
process.exit(failed.length ? 1 : 0)
