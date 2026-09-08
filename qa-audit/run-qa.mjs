// Stage 1-6 audit functionality render sweep.
// Signs in per role via Clerk sign_in_tokens, visits every new surface,
// records console errors / pageerrors / HTTP>=400, probes stage markers.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5180'
const SHOTS = 'qa-audit/shots'
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

async function clerkTicket(email) {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`, { headers })
  const users = await res.json()
  const user = Array.isArray(users)
    ? users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === email.toLowerCase()))
    : null
  if (!user) throw new Error(`clerk user not found: ${email}`)
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST', headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

const ROLE_ROUTES = {
  admin: [
    '/incidents',
    '/incidents/new',
    '/compliance',
    '/audit',
    '/evv',
    '/clients',
    '/hr/employees',
    '/hr/cases',
    '/reports',
  ],
  coordinator: ['/incidents', '/incidents/new', '/compliance', '/audit', '/evv', '/clients'],
  hr: ['/incidents', '/compliance', '/audit', '/evv', '/hr/employees', '/hr/cases'],
  caregiver: ['/incidents', '/incidents/new', '/audit', '/compliance'],
}

const PROBES = {
  '/incidents': { heading: /incident/i, csv: /csv|download/i, newBtn: /new|file|report/i },
  '/incidents/new': { category: /category/i, occurred: /occurred/i, description: /description/i },
  '/compliance': { obligations: /obligation/i, credential: /credential/i },
  '/audit': { pillar1: /service delivery/i, pillar2: /personnel/i, pillar3: /incidents? & rights|incidents and rights/i, pillar4: /program integrity/i, pillar5: /agency & vendor|agency and vendor/i, packet: /audit packet/i, retention: /retention/i, checklist: /self-inspection|vendor-file review/i, cap: /corrective action/i },
  '/evv': { evv: /evv|electronic visit/i, export: /export|csv|download/i },
  '/clients': { clients: /client/i },
  '/hr/employees': { employees: /employee/i },
  '/hr/cases': { cases: /case/i },
  '/reports': { report: /report/i },
}

const ROLE_EMAIL = {
  admin: e2e.E2E_ADMIN_EMAIL,
  coordinator: e2e.E2E_COORDINATOR_EMAIL,
  hr: e2e.E2E_HR_EMAIL,
  caregiver: e2e.E2E_CAREGIVER_EMAIL,
}

const results = {}

async function signInContext(browser, role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const ticket = await clerkTicket(ROLE_EMAIL[role])
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(4000)
  console.log(`[auth:${role}] landed on ${page.url()}`)
  await page.close().catch(() => {})
  return ctx
}

async function visit(ctx, role, route) {
  const key = `${role} ${route}`
  const rec = (results[key] = { events: [] })
  const page = await ctx.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') rec.events.push({ type: 'console.error', text: msg.text().slice(0, 600) })
  })
  page.on('pageerror', (err) => rec.events.push({ type: 'pageerror', text: String(err).slice(0, 600) }))
  page.on('response', (res) => {
    if (res.status() >= 400) rec.events.push({ type: 'http', text: `${res.status()} ${res.url().slice(0, 200)}` })
  })
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    rec.httpStatus = resp?.status()
  } catch (e) {
    rec.navError = e.message.slice(0, 300)
  }
  let body = ''
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000)
    body = await page.locator('body').innerText().catch(() => '')
    const t = body.trim()
    if (t.length > 50 && !/Loading \.\.\.|Loading [a-z ]+\.\.\.|Preparing workspace|Securing agency workspace|Opening agency workspace/i.test(t)) break
  }
  rec.finalUrl = page.url()
  rec.bodyLength = body.trim().length
  rec.bodyExcerpt = body.trim().slice(0, 500).replace(/\n+/g, ' | ')
  rec.stillLoading = /Loading [a-z ]*\.\.\.|Preparing workspace|Securing agency workspace/i.test(body)
  rec.blank = body.trim().length === 0
  rec.probes = {}
  for (const [k, re] of Object.entries(PROBES[route] ?? {})) rec.probes[k] = re.test(body)
  const name = (role + '_' + route).replace(/[^\w]+/g, '_')
  try {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 10000 })
  } catch {}
  const seen = new Set()
  rec.events = rec.events.filter((ev) => {
    const k = ev.type + '|' + ev.text
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  console.log(`[route] ${key} -> ${rec.finalUrl} (body ${rec.bodyLength}, loading=${rec.stillLoading}, events ${rec.events.length}, probes ${JSON.stringify(rec.probes)})`)
  await page.close().catch(() => {})
}

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--js-flags=--max-old-space-size=512'],
  })
  for (const role of Object.keys(ROLE_ROUTES)) {
    let ctx
    try {
      ctx = await signInContext(browser, role)
    } catch (e) {
      console.log(`[auth:${role}] FAILED: ${e.message}`)
      results[`${role} AUTH`] = { error: e.message }
      continue
    }
    for (const route of ROLE_ROUTES[role]) {
      try {
        await visit(ctx, role, route)
      } catch (e) {
        results[`${role} ${route}`] = { fatal: e.message.slice(0, 300) }
      }
    }
    await ctx.close().catch(() => {})
  }
  writeFileSync('qa-audit/results.json', JSON.stringify(results, null, 2))
  await browser.close()
  console.log('done -> qa-audit/results.json')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
