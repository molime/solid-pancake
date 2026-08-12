// Smoke test: verify key routes render without crashing on http://localhost:5180.
// Attempts Clerk sign-in via sign_in_token (same pattern as qa-platform-admin/run-qa.mjs);
// falls back to unauthenticated run if the E2E user is gone.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-phase3/shots'
mkdirSync(SHOTS, { recursive: true })

const ROUTES = ['/compliance', '/billing', '/billing/payroll', '/notifications', '/audit', '/reports']

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

const results = {}
let currentRoute = 'boot'
const events = {} // route -> [{type, text}]
function log(type, text) {
  ;(events[currentRoute] ??= []).push({ type, text: String(text).slice(0, 800) })
}

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

async function main() {
  // 0. raw HTTP reachability per route (SPA: expect 200 for all)
  for (const r of ROUTES) {
    const res = await fetch(BASE + r, { redirect: 'manual' }).catch((e) => ({ status: `ERR ${e.message}` }))
    ;(results[r] ??= {}).httpStatus = res.status
  }

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') log('console.error', msg.text())
  })
  page.on('pageerror', (err) => log('pageerror', err))
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('clerk')) log('http', `${res.status()} ${res.url().slice(0, 200)}`)
  })

  // 1. try auth
  let authed = false
  try {
    const ticket = await clerkTicket()
    await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
    await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
    await page.waitForLoadState('networkidle')
    authed = true
    console.log(`[auth] signed in as ${ADMIN_EMAIL}, landed on ${page.url()}`)
  } catch (e) {
    console.log(`[auth] FAILED, running unauthenticated: ${e.message}`)
  }
  await page.screenshot({ path: `${SHOTS}/00-after-auth.png` }).catch((e) => console.log(`[shot] after-auth failed: ${e.message.split('\n')[0]}`))

  // 2. visit each route
  for (const r of ROUTES) {
    currentRoute = r
    const rec = results[r] ??= {}
    rec.authenticated = authed
    try {
      await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (e) {
      rec.navError = e.message.slice(0, 300)
      await page.waitForTimeout(2000)
    }
    await page.waitForTimeout(1500)
    rec.finalUrl = page.url()
    const body = await page.locator('body').innerText().catch(() => '')
    rec.bodyLength = body.trim().length
    rec.bodyExcerpt = body.trim().slice(0, 300).replace(/\n+/g, ' | ')
    rec.blank = body.trim().length === 0
    const name = r.replace(/\//g, '_').replace(/^_/, '') || 'root'
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 10000 })
    } catch (e) {
      rec.screenshotError = e.message.split('\n')[0]
      console.log(`[shot] ${name} failed: ${rec.screenshotError}`)
    }
    rec.events = events[r] ?? []
    console.log(`[route] ${r} -> ${rec.finalUrl} (body ${rec.bodyLength} chars, ${rec.events.length} events)`)
  }

  writeFileSync('qa-phase3/results.json', JSON.stringify({ authed, results }, null, 2))
  await browser.close()
  console.log('done -> qa-phase3/results.json')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
