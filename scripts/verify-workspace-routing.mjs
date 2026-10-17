/**
 * Verify workspace routing on PROD (2026-10-17):
 *
 * From any URL, on any agency subdomain, signing in must take the user to
 * THEIR OWN org + role home — never a wrong-workspace block:
 *
 *  1. A Test Agency admin logging in on the Golden Ages URL lands in their
 *     own (Test Agency) workspace.
 *  2. The same account on the Individuals Choice URL — same outcome.
 *  3. A Golden Ages admin logging in on the IC URL lands in the GA workspace.
 *  4. Platform staff can use the platform portal from any agency subdomain.
 *
 * Read-only: Clerk sign-in tickets + page loads, zero data mutations.
 *
 * Usage: node scripts/verify-workspace-routing.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const SHOTS = 'test-results/workspace-routing'
mkdirSync(SHOTS, { recursive: true })

// --- secrets: parse .env.prod (never print) ---
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
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${await res.text()}`)
  return res.json()
}

async function resolveUserIdByEmail(email) {
  const users = await clerk('GET', `/users?email_address=${encodeURIComponent(email)}`)
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error(`No Clerk user found for ${email}`)
  }
  return users[0].id
}

async function createTicket(userId) {
  const data = await clerk('POST', '/sign_in_tokens', { user_id: userId })
  return new URL(data.url).searchParams.get('__clerk_ticket')
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Sign `email` into `host` via a Clerk ticket and report what rendered.
 * Returns { finalUrl, sawNotice, markers, shot }.
 */
async function check({ label, email, host, expectNotice, markers }) {
  const result = { label, pass: false, finalUrl: '', detail: '' }
  let browser
  try {
    const userId = await resolveUserIdByEmail(email)
    const jwt = await createTicket(userId)
    browser = await launchBrowser()
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 200)))

    await page.goto(`https://${host}/sign-in?__clerk_ticket=${jwt}`, { timeout: 90000 })

    // Wait until the ticket is consumed and we are off /sign-in.
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      const url = new URL(page.url())
      if (url.hostname === host && !url.searchParams.has('__clerk_ticket') && !url.pathname.includes('/sign-in')) break
      await sleep(2000)
    }

    // From /select-agency, pick the agency that matches the host (or the
    // single membership) so the tenant guard runs.
    if (page.url().includes('/select-agency')) {
      const cards = page.locator('[data-testid^="agency-card-"] button')
      if ((await cards.count()) > 0) await cards.first().click()
    }

    // Wait for the outcome: wrong-workspace notice or the app shell.
    const noticeText = page.getByText('This workspace belongs to', { exact: false })
    const goBtn = page.getByRole('button', { name: /Go to my workspace/i })
    const nav = page.locator('nav, [data-testid="sidebar"], aside').first()

    let sawNotice = false
    let sawShell = false
    const outcomeDeadline = Date.now() + 60000
    while (Date.now() < outcomeDeadline) {
      if ((await noticeText.count()) > 0) { sawNotice = true; break }
      if ((await nav.count()) > 0) { sawShell = true; break }
      await sleep(1500)
    }

    let markerHits = []
    if (sawShell && markers?.length) {
      await sleep(4000)
      for (const m of markers) {
        if ((await page.getByText(m, { exact: false }).count()) > 0) markerHits.push(m)
      }
    }

    result.finalUrl = page.url()
    const shot = `${SHOTS}/${label}.png`
    await page.screenshot({ path: shot, fullPage: false })

    if (expectNotice) {
      const hasGo = (await goBtn.count()) > 0
      result.pass = sawNotice && hasGo
      result.detail = `notice=${sawNotice} goButton=${hasGo}`
    } else {
      result.pass = sawShell && !sawNotice && markerHits.length === (markers?.length ?? 0)
      result.detail = `shell=${sawShell} notice=${sawNotice} markers=[${markerHits.join(', ')}]`
    }
    if (pageErrors.length) result.detail += ` pageErrors=${pageErrors.length}`
    result.shot = shot
  } catch (err) {
    result.detail = String(err).slice(0, 300)
  } finally {
    await browser?.close()
  }
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${label}\n     ${result.detail}\n     ${result.finalUrl}`)
  return result
}

const cases = [
  {
    // Maria's account is a Test Agency admin (prod). Logging in on the
    // Golden Ages URL must take her to HER OWN workspace — never a block.
    label: 'maria-on-goldenages-lands-own-workspace',
    email: 'hello+admin@atriaxsolutions.com',
    host: 'goldenages.atriaxsolutions.com',
    expectNotice: false,
    markers: ['HR Home'],
  },
  {
    // Same on the Individuals Choice URL: her own org + role, no notice.
    label: 'maria-on-individualschoice-lands-own-workspace',
    email: 'hello+admin@atriaxsolutions.com',
    host: 'individualschoice.atriaxsolutions.com',
    expectNotice: false,
    markers: ['HR Home'],
  },
  {
    // GA admin logging in on the IC URL lands in the GA workspace.
    label: 'ga-admin-on-individualschoice-lands-ga',
    email: 'admin@goldenagesinhomecare.com',
    host: 'individualschoice.atriaxsolutions.com',
    expectNotice: false,
    markers: ['HR Home'],
  },
  {
    // Platform staff can use the platform portal from any agency subdomain.
    label: 'platform-admin-on-goldenages-ok',
    email: 'diego.molina.sieiro+admin@gmail.com',
    host: 'goldenages.atriaxsolutions.com',
    expectNotice: false,
    markers: ['Subscriptions'],
  },
]

const results = []
for (const c of cases) results.push(await check(c))
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
