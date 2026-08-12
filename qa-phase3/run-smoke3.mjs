// Third pass: corrected route paths (from src/app/router.tsx) + longer settle waits.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-phase3/shots'
mkdirSync(SHOTS, { recursive: true })

const ROUTES = [
  '/compliance',
  '/coordinator/billing',
  '/coordinator/billing/payroll',
  '/notifications',
  '/audit',
  '/reporting',
]
const PROBES = {
  '/compliance': { gaps: /gap/i, override: /override/i, exportCsv: /export csv/i },
  '/coordinator/billing': { perPatientInvoice: /per[- ]patient/i, invoice: /invoice/i, createInvoice: /create|new invoice/i },
  '/coordinator/billing/payroll': { payroll: /payroll/i, adp: /adp/i },
  '/notifications': { markAsRead: /mark.*read/i },
  '/audit': { audit: /audit/i, filters: /filter/i },
  '/reporting': { export: /export/i, report: /report/i },
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

async function clerkTicket() {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(e2e.E2E_ADMIN_EMAIL)}`, { headers })
  const users = await res.json()
  const user = Array.isArray(users)
    ? users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === e2e.E2E_ADMIN_EMAIL.toLowerCase()))
    : null
  if (!user) throw new Error('clerk user not found')
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
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--js-flags=--max-old-space-size=512'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

  let authed = false
  const authPage = await ctx.newPage()
  try {
    const ticket = await clerkTicket()
    await authPage.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await authPage.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
    await authPage.waitForTimeout(4000)
    authed = true
    console.log(`[auth] signed in, landed on ${authPage.url()}`)
  } catch (e) {
    console.log(`[auth] FAILED: ${e.message}`)
  }
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
    // wait up to 25s for loading indicators to clear
    let body = ''
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000)
      body = await page.locator('body').innerText().catch(() => '')
      const t = body.trim()
      if (t.length > 50 && !/Loading \.\.\.|Loading [a-z ]+\.\.\.|Preparing workspace|Securing agency workspace|Opening agency workspace/i.test(t)) break
    }
    rec.finalUrl = page.url()
    rec.bodyLength = body.trim().length
    rec.bodyExcerpt = body.trim().slice(0, 400).replace(/\n+/g, ' | ')
    rec.stillLoading = /Loading [a-z ]*\.\.\.|Preparing workspace|Securing agency workspace/i.test(body)
    rec.blank = body.trim().length === 0
    rec.probes = {}
    for (const [k, re] of Object.entries(PROBES[r] ?? {})) rec.probes[k] = re.test(body)
    const name = 'v3' + r.replace(/\//g, '_')
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 10000 })
    } catch (e) {
      rec.screenshotError = e.message.split('\n')[0]
    }
    const seen = new Set()
    rec.events = rec.events.filter((ev) => {
      const key = ev.type + '|' + ev.text
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    console.log(`[route] ${r} -> ${rec.finalUrl} (body ${rec.bodyLength}, stillLoading=${rec.stillLoading}, events ${rec.events.length}, probes ${JSON.stringify(rec.probes)})`)
    await page.close().catch(() => {})
  }

  writeFileSync('qa-phase3/results3.json', JSON.stringify({ authed, results }, null, 2))
  await browser.close()
  console.log('done -> qa-phase3/results3.json')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
