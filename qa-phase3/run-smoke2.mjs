// Robust variant of run-smoke.mjs: memory-constrained machine (~2GB free).
// - conservative chromium flags, no networkidle, fresh page per route
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-phase3/shots'
mkdirSync(SHOTS, { recursive: true })

const ROUTES = ['/compliance', '/billing', '/billing/payroll', '/notifications', '/audit', '/reports']

// UI probes per route: label -> regex to find in body text
const PROBES = {
  '/compliance': { gaps: /gap/i, override: /override/i },
  '/billing': { perPatientInvoice: /per[- ]patient|invoice/i },
  '/billing/payroll': { payroll: /payroll/i },
  '/notifications': { markAsRead: /mark.*read|mark all/i },
  '/audit': { audit: /audit/i },
  '/reports': { export: /export/i },
}

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

async function clerkTicket() {
  if (!CLERK_SECRET || !ADMIN_EMAIL) throw new Error('missing CLERK_SECRET_KEY or E2E_ADMIN_EMAIL')
  const headers = { Authorization: `Bearer ${CLERK_SECRET}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(ADMIN_EMAIL)}`, { headers })
  const users = await res.json()
  const user = Array.isArray(users)
    ? users.find((u) => u.email_addresses.some((e) => e.email_address.toLowerCase() === ADMIN_EMAIL.toLowerCase()))
    : null
  if (!user) throw new Error('clerk user not found (E2E test user likely deleted)')
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

const results = {}

async function main() {
  const browser = await chromium.launch({
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--js-flags=--max-old-space-size=512',
    ],
  })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  // auth
  let authed = false
  const authPage = await ctx.newPage()
  try {
    const ticket = await clerkTicket()
    await authPage.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await authPage.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
    await authPage.waitForTimeout(3000)
    authed = true
    console.log(`[auth] signed in as ${ADMIN_EMAIL}, landed on ${authPage.url()}`)
  } catch (e) {
    console.log(`[auth] FAILED, running unauthenticated: ${e.message}`)
  }
  await authPage.screenshot({ path: `${SHOTS}/00-after-auth.png` }).catch((e) => console.log(`[shot] after-auth failed: ${e.message.split('\n')[0]}`))
  await authPage.close().catch(() => {})

  for (const r of ROUTES) {
    const rec = (results[r] = { authenticated: authed, events: [] })
    const page = await ctx.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') rec.events.push({ type: 'console.error', text: msg.text().slice(0, 600) })
    })
    page.on('pageerror', (err) => rec.events.push({ type: 'pageerror', text: String(err).slice(0, 600) }))
    page.on('response', (res) => {
      if (res.status() >= 400) rec.events.push({ type: 'http', text: `${res.status()} ${res.url().slice(0, 200)}` })
    })
    try {
      const resp = await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 30000 })
      rec.httpStatus = resp?.status()
    } catch (e) {
      rec.navError = e.message.slice(0, 300)
    }
    // give lazy chunks + convex time; poll for settled content up to 15s
    let body = ''
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000)
      body = await page.locator('body').innerText().catch(() => '')
      if (body.trim().length > 50 && !/Loading|Opening agency workspace/i.test(body.trim().slice(0, 400))) break
    }
    rec.finalUrl = page.url()
    rec.bodyLength = body.trim().length
    rec.bodyExcerpt = body.trim().slice(0, 300).replace(/\n+/g, ' | ')
    rec.blank = body.trim().length === 0
    rec.probes = {}
    for (const [k, re] of Object.entries(PROBES[r] ?? {})) rec.probes[k] = re.test(body)
    const name = r.replace(/\//g, '_').replace(/^_/, '') || 'root'
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 10000 })
    } catch (e) {
      rec.screenshotError = e.message.split('\n')[0]
      console.log(`[shot] ${name} failed: ${rec.screenshotError}`)
    }
    // dedupe events
    const seen = new Set()
    rec.events = rec.events.filter((ev) => {
      const key = ev.type + '|' + ev.text
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    console.log(`[route] ${r} -> ${rec.finalUrl} (body ${rec.bodyLength}, ${rec.events.length} unique events, probes ${JSON.stringify(rec.probes)})`)
    await page.close().catch(() => {})
  }

  writeFileSync('qa-phase3/results2.json', JSON.stringify({ authed, results }, null, 2))
  await browser.close()
  console.log('done -> qa-phase3/results2.json')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
