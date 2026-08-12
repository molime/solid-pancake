// Focused verification of the SubscriptionDetail error-boundary fix.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const SHOTS = 'qa-platform-admin/shots'
mkdirSync(SHOTS, { recursive: true })

function loadEnv(path) {
  const out = {}
  try {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.replace(/\r$/, '')
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {}
  return out
}
const local = loadEnv('.env.local')
const e2e = loadEnv('.env.e2e')
const CLERK_SECRET = local.CLERK_SECRET_KEY
const ADMIN_EMAIL = e2e.E2E_ADMIN_EMAIL

const findings = []
const consoleLog = {}
let currentPage = 'boot'
function pass(area, text) { findings.push({ severity: 'PASS', area, text }); console.log(`[PASS] (${area}) ${text}`) }
function fail(area, text) { findings.push({ severity: 'FAIL', area, text }); console.log(`[FAIL] (${area}) ${text}`) }
function note(area, text) { findings.push({ severity: 'note', area, text }); console.log(`[note] (${area}) ${text}`) }

async function clerkTicket() {
  const headers = { Authorization: `Bearer ${CLERK_SECRET}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(ADMIN_EMAIL)}`, { headers })
  const users = await res.json()
  const user = users.find((u) => u.email_addresses.some((e) => e.email_address.toLowerCase() === ADMIN_EMAIL.toLowerCase()))
  if (!user) throw new Error('clerk user not found')
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: ${tokRes.status}`)
  return (await tokRes.json()).token
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      ;(consoleLog[currentPage] ??= []).push({ type: msg.type(), text: msg.text().slice(0, 500) })
    }
  })
  page.on('pageerror', (err) => {
    ;(consoleLog[currentPage] ??= []).push({ type: 'pageerror', text: String(err).slice(0, 800) })
  })

  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
  async function go(name, path) {
    currentPage = name
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((e) => fail(name, `navigation failed: ${e.message}`))
    await page.waitForTimeout(1800)
    await shot(name)
  }
  const bodyText = () => page.locator('body').innerText()

  const ticket = await clerkTicket()
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  note('auth', `signed in, landed on ${page.url()}`)

  // grab a real tenant id from the agencies list
  await go('agencies-list', '/platform/agencies')
  const firstTenantLink = page.locator('table a[href^="/platform/agencies/"]').first()
  const tenantHref = await firstTenantLink.getAttribute('href')
  const tenantId = tenantHref.split('/').pop()
  note('setup', `using tenant id: ${tenantId}`)

  // ---------- 1. invalid subscription id ----------
  await go('sub-detail-invalid', '/platform/subscriptions/invalid-id')
  let body = await bodyText()
  if (body.trim().length === 0) {
    fail('sub-detail-invalid', 'BLANK PAGE for invalid subscription id')
  } else if (/Agency not found/i.test(body) && /Back to subscriptions/i.test(body)) {
    pass('sub-detail-invalid', 'graceful "Agency not found" fallback rendered with "Back to subscriptions" link')
  } else {
    fail('sub-detail-invalid', `unexpected content: ${body.slice(0, 300).replace(/\n/g, ' | ')}`)
  }
  // "Back to subscriptions" link navigates
  const backLink = page.getByRole('link', { name: 'Back to subscriptions' })
  if (await backLink.isVisible().catch(() => false)) {
    await backLink.click()
    await page.waitForTimeout(1500)
    if (page.url().endsWith('/platform/subscriptions')) pass('sub-detail-invalid', `back link navigates to ${page.url()}`)
    else fail('sub-detail-invalid', `back link landed on ${page.url()}`)
  }
  const invalidErrs = (consoleLog['sub-detail-invalid'] ?? []).filter((l) => l.type === 'pageerror')
  if (invalidErrs.length === 0) pass('sub-detail-invalid', 'no pageerrors (only dev console logging of the caught query error)')
  else note('sub-detail-invalid', `pageerrors: ${JSON.stringify(invalidErrs).slice(0, 300)}`)

  // ---------- 2. valid subscription detail ----------
  await go('sub-detail-valid', `/platform/subscriptions/${tenantId}`)
  body = await bodyText()
  if (body.trim().length === 0) {
    fail('sub-detail-valid', 'BLANK PAGE for valid tenant — regression from refactor')
  } else if (/Agency not found/i.test(body)) {
    fail('sub-detail-valid', 'valid tenant incorrectly shows "Agency not found" — regression')
  } else {
    const h1 = await page.locator('h1').first().innerText().catch(() => '')
    note('sub-detail-valid', `header: "${h1}"`)
    if (h1.trim().length > 0) pass('sub-detail-valid', `valid tenant detail renders (header "${h1}")`)
    else fail('sub-detail-valid', `no h1 rendered. excerpt: ${body.slice(0, 300).replace(/\n/g, ' | ')}`)
  }
  const validErrs = (consoleLog['sub-detail-valid'] ?? []).filter((l) => l.type === 'pageerror' || (l.type === 'error' && !l.text.includes('development keys')))
  if (validErrs.length === 0) pass('sub-detail-valid', 'no console errors/pageerrors on valid page')
  else fail('sub-detail-valid', `errors on valid page: ${JSON.stringify(validErrs).slice(0, 400)}`)

  // ---------- 3. agencies invalid id (earlier fix regression check) ----------
  await go('agency-detail-invalid', '/platform/agencies/invalid-id')
  body = await bodyText()
  if (/Agency not found/i.test(body) && /Back to agencies/i.test(body)) {
    pass('agency-detail-invalid', 'earlier agencies fix still works')
  } else {
    fail('agency-detail-invalid', body.trim().length === 0 ? 'BLANK PAGE — agencies fix regressed' : `unexpected: ${body.slice(0, 200).replace(/\n/g, ' | ')}`)
  }

  writeFileSync('qa-platform-admin/verify-subscription-results.json', JSON.stringify({ findings, consoleLog }, null, 2))
  const fails = findings.filter((f) => f.severity === 'FAIL').length
  const passes = findings.filter((f) => f.severity === 'PASS').length
  console.log(`\n==== ${passes} PASS, ${fails} FAIL ====`)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
