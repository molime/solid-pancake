// Verify the QA fixes in the browser on http://localhost:5174.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const SHOTS = 'qa-stripe-e2e/shots'
mkdirSync(SHOTS, { recursive: true })
const TENANT_ID = 'kh71kxcqmggcnz0r4r0k9dpcvs871b2w' // My Organization Test (subscribed)
const SENT_INVOICE_ID = 'pn7fm1gmwxr02dkypnp481bdrs8bxkhv' // PLAT-2026-0001 (sent, no Stripe link)
const DRAFT_INVOICE_ID = 'pn7epk79eam0s78676z8exapv18bw6zv' // PLAT-2026-0002 (draft)

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

const findings = []
const note = (a, t) => { findings.push({ s: 'note', a, t }); console.log(`[note] (${a}) ${t}`) }
const bug = (a, t) => { findings.push({ s: 'BUG', a, t }); console.log(`[BUG] (${a}) ${t}`) }

async function clerkTicket() {
  const headers = { Authorization: `Bearer ${local.CLERK_SECRET_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
  const res = await fetch(`https://api.clerk.com/v1/users?query=${encodeURIComponent(e2e.E2E_ADMIN_EMAIL)}`, { headers })
  const users = await res.json()
  const user = users.find((u) => u.email_addresses.some((x) => x.email_address.toLowerCase() === e2e.E2E_ADMIN_EMAIL.toLowerCase()))
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', { method: 'POST', headers, body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }) })
  return (await tokRes.json()).token
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const bodyText = () => page.locator('body').innerText()

const ticket = await clerkTicket()
await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
await page.waitForLoadState('networkidle')

// --- 1. billing emails field in Change plan dialog ---
await page.goto(`${BASE}/platform/subscriptions/${TENANT_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.locator('button:has-text("Change plan")').click()
await page.waitForTimeout(600)
const emailInput = page.locator('input[placeholder*="billing@agency.com"]')
if (await emailInput.isVisible().catch(() => false)) {
  note('billing-emails', 'billing emails input present in Change plan dialog')
  await emailInput.fill('billing@myorgtest.example.com')
  await page.locator('input[type="radio"][name="plan"]').first().check()
  await page.locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(2500)
  const body = await bodyText()
  if (body.includes('billing@myorgtest.example.com')) note('billing-emails', 'billing email saved and shown on detail page')
  else bug('billing-emails', 'billing email not shown after save')
} else {
  bug('billing-emails', 'billing emails input MISSING from Change plan dialog')
}
await page.screenshot({ path: `${SHOTS}/fix-billing-emails.png` })

// --- 2. Setup Stripe Customer now shows clean sanitized error ---
await page.locator('button:has-text("Setup Stripe Customer")').click()
await page.waitForTimeout(5000)
let body = await bodyText()
const errMatch = body.match(/Stripe[^\n]*|STRIPE[^\n]*/g)
await page.screenshot({ path: `${SHOTS}/fix-stripe-setup-error.png` })
if (/Request ID|Uncaught|at handler|\[CONVEX/.test(body)) bug('sanitize', 'error still shows raw Convex wrapper/stack')
else if (/not configured|Stripe|API key/i.test(body)) note('sanitize', `clean error shown: ${(errMatch ?? []).join(' | ').slice(0, 160)}`)
else bug('sanitize', 'no error visible after Setup Stripe Customer click')

// --- 3. sent invoice: Charge via Stripe retry button + clean error ---
await page.goto(`${BASE}/platform/billing/${SENT_INVOICE_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const chargeBtn = page.locator('button:has-text("Charge via Stripe")')
if (await chargeBtn.isVisible().catch(() => false)) {
  note('retry-button', 'Charge via Stripe button visible on sent invoice without Stripe link')
  await chargeBtn.click()
  await page.waitForTimeout(6000)
  body = await bodyText()
  await page.screenshot({ path: `${SHOTS}/fix-charge-via-stripe-error.png` })
  if (/Request ID|Uncaught|at handler|\[CONVEX/.test(body)) bug('retry-button', 'error still shows raw Convex wrapper/stack')
  else if (/not configured|Stripe|key/i.test(body)) note('retry-button', 'Charge via Stripe failed with clean visible error (expected without keys)')
  else bug('retry-button', `no feedback after Charge via Stripe: ${body.slice(0, 150)}`)
} else {
  bug('retry-button', 'Charge via Stripe button NOT visible on sent invoice')
}

// --- 4. audit log shows stripe_invoice_failed ---
await page.goto(`${BASE}/platform/audit`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
body = await bodyText()
if (body.includes('stripe_invoice_failed')) note('audit', 'stripe_invoice_failed visible in audit log')
else bug('audit', 'stripe_invoice_failed NOT in audit log')
await page.screenshot({ path: `${SHOTS}/fix-audit-stripe-failed.png` })

// --- 5. draft invoice: send with override email, mark paid, void hidden ---
await page.goto(`${BASE}/platform/billing/${DRAFT_INVOICE_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
body = await bodyText()
const statusIs = (s) => new RegExp(`\\b${s}\\b`, 'i').test(body.split('Details')[0])
if (!statusIs('draft')) note('paid-flow', `invoice status no longer draft (already advanced) — body excerpt: ${body.slice(0, 120)}`)
await page.locator('input[placeholder*="Leave empty"]').fill('qa-stripe-e2e@example.com')
await page.locator('button:has-text("Send")').first().click()
await page.waitForTimeout(3000)
body = await bodyText()
if (new RegExp('\\bsent\\b', 'i').test(body.split('Details')[0])) note('paid-flow', 'send with override email succeeded, status = sent')
else bug('paid-flow', 'send with override email failed: ' + body.slice(0, 200))
const markPaid = page.locator('button:has-text("Mark as paid")')
if (await markPaid.isVisible().catch(() => false)) {
  await markPaid.click()
  await page.waitForTimeout(2500)
  body = await bodyText()
  if (new RegExp('\\bpaid\\b', 'i').test(body.split('Details')[0])) note('paid-flow', 'invoice marked paid')
  const voidVisible = await page.locator('button:has-text("Void invoice")').isVisible().catch(() => false)
  if (voidVisible) bug('edge-void', 'Void invoice button visible on PAID invoice')
  else note('edge-void', 'Void button hidden on paid invoice (edge case 4 OK)')
  await page.screenshot({ path: `${SHOTS}/fix-paid-no-void.png` })
} else {
  bug('paid-flow', 'Mark as paid missing after send')
}

// --- 6. checkbox explanation gating ---
await page.goto(`${BASE}/platform/billing/create`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.locator('select').first().selectOption({ label: 'My Organization Test' })
await page.locator('button:has-text("Continue")').click()
await page.waitForTimeout(300)
await page.locator('input[type="date"]').nth(0).fill('2026-05-01')
await page.locator('input[type="date"]').nth(1).fill('2026-05-31')
await page.locator('input[type="date"]').nth(2).fill('2026-06-14')
await page.locator('button:has-text("Continue")').click()
await page.waitForTimeout(2500)
body = await bodyText()
if (body.includes('no active subscription')) bug('wizard', 'subscription lost for My Organization Test')
await page.locator('button:has-text("Continue")').click()
await page.waitForTimeout(600)
const expl = page.locator('text=Stripe will email the agency')
const beforeCheck = await expl.isVisible().catch(() => false)
await page.locator('input[type="checkbox"]').check()
await page.waitForTimeout(300)
const afterCheck = await expl.isVisible().catch(() => false)
if (!beforeCheck && afterCheck) note('checkbox', 'explanation text now hidden until checkbox is checked')
else bug('checkbox', `gating wrong: before=${beforeCheck} after=${afterCheck}`)
await page.screenshot({ path: `${SHOTS}/fix-checkbox-gated.png` })

await browser.close()
writeFileSync('qa-stripe-e2e/verify-results.json', JSON.stringify(findings, null, 2))
console.log('==== VERIFY DONE ====')
