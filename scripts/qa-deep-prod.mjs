/**
 * Deep prod QA (2026-10-17): real sign-ins + real page loads on the pages
 * that were failing for DB-only accounts (Billing, Payroll, management).
 * Fails on stuck loaders ("Securing agency workspace" still up after the
 * settle window), error boundaries, and missing content markers.
 * Read-only: no data mutations.
 *
 * Usage: node scripts/qa-deep-prod.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const SHOTS = 'test-results/deep-prod-qa'
mkdirSync(SHOTS, { recursive: true })

const envText = readFileSync(new URL('../.env.prod', import.meta.url), 'utf-8')
const env = {}
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx <= 0) continue
  env[line.slice(0, idx)] = line.slice(idx + 1)
}
const secretKey = env.CLERK_SECRET_KEY
if (!secretKey?.startsWith('sk_live')) {
  console.error('CLERK_SECRET_KEY (sk_live) not found in .env.prod')
  process.exit(1)
}

async function clerk(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}`)
  return res.json()
}

async function createTicketForEmail(email) {
  const users = await clerk('GET', `/users?email_address=${encodeURIComponent(email)}`)
  if (!users.length) throw new Error(`No Clerk user for ${email}`)
  const data = await clerk('POST', '/sign_in_tokens', { user_id: users[0].id })
  return new URL(data.url).searchParams.get('__clerk_ticket')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ROUTES = {
  adminFull: [
    ['/', /good |dashboard|needs attention|compliance/i],
    ['/hr', /candidate pipeline|active candidates|HR/i],
    ['/hr/candidates', /candidate|invite/i],
    ['/hr/employees', /employee|caregiver/i],
    ['/hr/cases', /case/i],
    ['/billing', /ready to invoice|invoice|billing/i],
    ['/billing/payroll', /payroll|pay period/i],
    ['/clients', /client/i],
    ['/compliance', /compliance|credential/i],
    ['/incidents', /incident/i],
    ['/support', /support|ticket/i],
    ['/team', /team|member/i],
    ['/scheduling', /schedule|shift/i],
    ['/coordinator/review', /review|pending|compliance/i],
    ['/audit', /audit/i],
  ],
  gaAdmin: [
    ['/', /good |dashboard|needs attention|compliance/i],
    ['/hr', /candidate pipeline|active candidates|HR/i],
    ['/hr/candidates', /candidate|invite/i],
    ['/hr/employees', /employee|caregiver/i],
    ['/compliance', /compliance|credential/i],
    ['/support', /support|ticket/i],
  ],
  gaCoordinator: [
    ['/compliance', /compliance|credential/i],
    ['/coordinator/review', /review|pending|compliance/i],
  ],
}

const ACCOUNTS = [
  {
    label: 'maria-test-agency-admin',
    email: 'hello+admin@atriaxsolutions.com',
    host: 'goldenages.atriaxsolutions.com', // any-subdomain sign-in must work
    routes: ROUTES.adminFull,
  },
  {
    label: 'ga-admin',
    email: 'admin@goldenagesinhomecare.com',
    host: 'goldenages.atriaxsolutions.com',
    routes: ROUTES.gaAdmin,
  },
  {
    label: 'ga-coordinator',
    email: 'supervisor@goldenagesinhomecare.com',
    host: 'goldenages.atriaxsolutions.com',
    routes: ROUTES.gaCoordinator,
  },
]

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  } catch {
    return chromium.launch({ headless: true })
  }
}

const results = []

async function runAccount(acct) {
  let browser
  try {
    const jwt = await createTicketForEmail(acct.email)
    browser = await launchBrowser()
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

    await page.goto(`https://${acct.host}/sign-in?__clerk_ticket=${jwt}`, { timeout: 90000 })
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      const url = new URL(page.url())
      if (!url.searchParams.has('__clerk_ticket') && !url.pathname.includes('/sign-in')) break
      await sleep(2000)
    }
    // Auto-select/picker: if a real picker is showing, pick the first card.
    if (page.url().includes('/select-agency')) {
      await sleep(3000)
      const cards = page.locator('[data-testid^="agency-card-"] button')
      if ((await cards.count()) > 0) await cards.first().click()
    }
    await sleep(4000)

    for (const [route, marker] of acct.routes) {
      await page.goto(`https://${acct.host}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      let text = ''
      let stuck = false
      const settleDeadline = Date.now() + 25000
      while (Date.now() < settleDeadline) {
        await sleep(2000)
        text = await page.locator('body').innerText().catch(() => '')
        const loading = /Securing agency workspace/i.test(text)
        const ready = marker.test(text) && !loading
        if (ready) break
        if (Date.now() + 2000 >= settleDeadline && loading) stuck = true
      }
      const errorBoundary = /something went wrong|error boundary|unexpected error/i.test(text)
      const notice = /This workspace belongs to/i.test(text)
      const pass = !stuck && !errorBoundary && !notice && marker.test(text)
      const shot = `${SHOTS}/${acct.label}${route.replace(/\//g, '_')}.png`
      if (!pass) await page.screenshot({ path: shot })
      results.push({ acct: acct.label, route, pass, stuck, errorBoundary, notice, pageErrors: pageErrors.length })
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${acct.label} ${route}${stuck ? ' (stuck loader)' : ''}${errorBoundary ? ' (error boundary)' : ''}${notice ? ' (wrong-workspace notice)' : ''}${!pass ? ` -> ${shot}` : ''}`)
    }
    if (pageErrors.length) console.log(`  [${acct.label}] pageErrors: ${pageErrors.slice(0, 3).join(' | ')}`)
  } catch (err) {
    results.push({ acct: acct.label, route: '(sign-in)', pass: false, error: String(err).slice(0, 200) })
    console.log(`FAIL  ${acct.label} sign-in: ${String(err).slice(0, 200)}`)
  } finally {
    await browser?.close()
  }
}

for (const acct of ACCOUNTS) await runAccount(acct)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
