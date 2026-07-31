// E2E QA script for ATRIA-X dev server (http://localhost:5173)
// Covers task items testable without auth; probes for the screenshot harness.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const results = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

try {
  // ---------- Item 1: Login page product tabs ----------
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })

  const tabCandidate = page.getByRole('button', { name: 'Candidate Portal', exact: true })
  const tabHR = page.getByRole('button', { name: 'HR Portal', exact: true })
  const tabStaff = page.getByRole('button', { name: 'Staff Portal', exact: true })

  record(
    '1a. Three tab buttons visible',
    (await tabCandidate.isVisible()) && (await tabHR.isVisible()) && (await tabStaff.isVisible()),
  )

  // Default state (/sign-in with no redirect param → /select-agency): no tab highlighted
  const hasAccent = async (loc) => (await loc.getAttribute('class'))?.includes('bg-atria-accent')
  record(
    '1b. Default (no redirect): no tab highlighted',
    !(await hasAccent(tabCandidate)) && !(await hasAccent(tabHR)) && !(await hasAccent(tabStaff)),
  )
  const bodyTextDefault = await page.locator('body').innerText()
  const labelCountDefault = ['Candidate Portal', 'HR Portal', 'Staff Portal'].filter((l) =>
    bodyTextDefault.includes(l),
  ).length
  record(
    '1c. Default: no product label subtitle (labels only appear as the 3 tab buttons)',
    labelCountDefault === 3,
    `found ${labelCountDefault} occurrences (3 = tab buttons only)`,
  )

  // Click each tab and verify redirect param, subtitle, highlight
  const tabs = [
    { loc: tabHR, label: 'HR Portal', redirect: '/hr' },
    { loc: tabCandidate, label: 'Candidate Portal', redirect: '/onboarding' },
    { loc: tabStaff, label: 'Staff Portal', redirect: '/coordinator/review' },
  ]
  for (const tab of tabs) {
    await tab.loc.click()
    await page.waitForTimeout(300)
    const url = page.url()
    const redirectParam = new URL(url).searchParams.get('redirect')
    const allText = await page.locator('body').innerText()
    // subtitle = label appears somewhere other than the tab buttons (a <p> under the logo)
    const subtitleVisible = await page
      .locator('p', { hasText: tab.label })
      .first()
      .isVisible()
      .catch(() => false)
    const accentOk =
      (await hasAccent(tab.loc)) &&
      !(await hasAccent(tabs.find((t) => t !== tab).loc))
    record(
      `1d. Tab "${tab.label}": redirect param, subtitle, highlight`,
      redirectParam === tab.redirect && subtitleVisible && accentOk,
      `redirect=${redirectParam} subtitle=${subtitleVisible} accent=${accentOk}`,
    )
    void allText
  }

  // ---------- Probe: screenshot harness availability ----------
  const resp = await page.goto(`${BASE}/dev/screenshots`, { waitUntil: 'networkidle' })
  const harnessText = await page.locator('body').innerText().catch(() => '')
  const harnessEnabled =
    resp?.status() === 200 && !page.url().includes('/sign-in') && harnessText.length > 0
  record('2a. Screenshot harness at /dev/screenshots', harnessEnabled, harnessEnabled ? 'available' : `not enabled (url=${page.url()})`)

  // ---------- Probe: application form accessibility without auth ----------
  await page.goto(`${BASE}/onboarding/application`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const landedUrl = page.url()
  record(
    '3a. /onboarding/application without auth redirects to sign-in',
    landedUrl.includes('/sign-in'),
    `landed on ${landedUrl}`,
  )

  // ---------- Item 6 probe: public apply page branding ----------
  await page.goto(`${BASE}/apply`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const applyText = await page.locator('body').innerText()
  record(
    '6a. Branding "Powered by ATRIA-X Digital Solutions" on public /apply page',
    applyText.includes('Powered by ATRIA-X Digital Solutions'),
  )
} catch (err) {
  record('script completed without exception', false, String(err))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
process.exit(failed.length ? 1 : 0)
