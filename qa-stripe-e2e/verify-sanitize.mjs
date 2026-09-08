// Re-verify sanitized error display after the sanitizer fix.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const TENANT_ID = 'kh71kxcqmggcnz0r4r0k9dpcvs871b2w'
const SENT_INVOICE_ID = 'pn7fm1gmwxr02dkypnp481bdrs8bxkhv'

function loadEnv(path) {
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.replace(/\r$/, '')
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  return out
}
const local = loadEnv('.env.local')
const e2e = loadEnv('.env.e2e')

const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(e2e.E2E_ADMIN_EMAIL)}`, { headers })
const users = await res.json()
const user = users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === e2e.E2E_ADMIN_EMAIL.toLowerCase()))
const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
const ticket = (await tokRes.json()).token

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForLoadState('networkidle')

async function checkError(label, trigger) {
  await trigger()
  await page.waitForTimeout(5000)
  const errEl = page.locator('p').filter({ hasText: /Stripe|STRIPE|Failed|error/i }).first()
  const text = (await errEl.innerText().catch(() => '')).trim()
  console.log(`[${label}] displayed: "${text}"`)
  const clean = text.length > 0 && text.length < 120 && !/Request ID|Uncaught|\[CONVEX|at handler|Server Error/i.test(text)
  console.log(`[${label}] ${clean ? 'CLEAN' : 'STILL RAW'}`)
  return clean
}

await page.goto(`${BASE}/platform/subscriptions/${TENANT_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const ok1 = await checkError('setup-stripe', () => page.locator('button:has-text("Setup Stripe Customer")').click())
await page.screenshot({ path: 'qa-stripe-e2e/shots/fix2-setup-error.png' })

await page.goto(`${BASE}/platform/billing/${SENT_INVOICE_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const ok2 = await checkError('charge-via-stripe', () => page.locator('button:has-text("Charge via Stripe")').click())
await page.screenshot({ path: 'qa-stripe-e2e/shots/fix2-charge-error.png' })

await browser.close()
console.log(ok1 && ok2 ? 'SANITIZE VERIFY PASSED' : 'SANITIZE VERIFY FAILED')
