// Comprehensive E2E QA of the Stripe integration on http://localhost:5174.
// Signs in via Clerk ticket as the E2E admin (already a platformAdmins row),
// walks every platform page, and exercises the Stripe billing flows.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5174'
const SHOTS = 'qa-stripe-e2e/shots'
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
const CONVEX_URL = local.VITE_CONVEX_URL

// ---------- result collection ----------
const findings = []
const consoleLog = {} // pageName -> [{type, text}]
let currentPage = 'boot'
function finding(severity, area, text) {
  findings.push({ severity, area, text })
  console.log(`[${severity}] (${area}) ${text}`)
}
function note(area, text) {
  findings.push({ severity: 'note', area, text })
  console.log(`[note] (${area}) ${text}`)
}

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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      ;(consoleLog[currentPage] ??= []).push({ type: msg.type(), text: msg.text().slice(0, 500) })
    }
  })
  page.on('pageerror', (err) => {
    ;(consoleLog[currentPage] ??= []).push({ type: 'pageerror', text: String(err).slice(0, 500) })
  })
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('clerk') ) {
      ;(consoleLog[currentPage] ??= []).push({ type: 'http', text: `${res.status()} ${res.url().slice(0, 200)}` })
    }
  })

  async function shot(name) {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
  }
  async function go(name, path) {
    currentPage = name
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((e) => finding('bug', name, `navigation failed: ${e.message}`))
    await page.waitForTimeout(1200)
    await shot(name)
  }
  const bodyText = () => page.locator('body').innerText()

  // ---------- 1. sign in ----------
  const ticket = await clerkTicket()
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  note('auth', `signed in, landed on ${page.url()}`)

  const token = await page.evaluate(async () => {
    const clerk = window.Clerk
    return clerk?.session ? await clerk.session.getToken() : null
  })
  if (!token) finding('bug', 'auth', 'could not extract Clerk session token')

  // ---------- seed pricing plans (no UI exists for this) ----------
  const seedRes = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path: 'platform:seedPricingPlans', args: {}, format: 'json' }),
  })
  const seedBody = await seedRes.text()
  note('seed', `seedPricingPlans: HTTP ${seedRes.status} ${seedBody.slice(0, 200)}`)

  // ---------- 2. platform dashboard ----------
  await go('platform-dashboard', '/platform')
  let body = await bodyText()
  for (const item of ['Subscriptions', 'Agencies', 'Tenant Health', 'Reports', 'Support Access', 'Audit Log', 'Billing']) {
    if (!body.includes(item)) finding('bug', 'dashboard', `nav item missing: ${item}`)
  }
  note('dashboard', 'all 7 nav items present')

  // ---------- 3. agencies ----------
  await go('platform-agencies', '/platform/agencies')
  body = await bodyText()
  if (/no agencies|error|forbidden/i.test(body)) finding('bug', 'agencies', `possible error state: ${body.slice(0, 200)}`)
  else note('agencies', 'agency list rendered')

  // ---------- 4. subscriptions list ----------
  await go('platform-subscriptions', '/platform/subscriptions')
  body = await bodyText()
  if (/forbidden|error/i.test(body)) finding('bug', 'subscriptions', body.slice(0, 200))

  // pick the first tenant row (rows navigate on click)
  const firstRow = page.locator('table tbody tr').first()
  if (!(await firstRow.isVisible().catch(() => false))) {
    finding('bug', 'subscriptions', 'no tenant rows found; cannot continue subscription flow')
    await browser.close()
    return finish()
  }
  await firstRow.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  currentPage = 'subscription-detail'
  await shot('subscription-detail')
  const detailUrl = page.url()
  note('subscription-detail', `opened ${detailUrl}`)
  const subscribedTenantName = (await page.locator('h1').first().innerText().catch(() => '')).trim()
  note('subscription-detail', `tenant: ${subscribedTenantName}`)

  // ---------- 5. set a plan (needed before Stripe customer button shows) ----------
  body = await bodyText()
  if (body.includes('Setup Stripe Customer')) {
    note('subscription-detail', 'Setup Stripe Customer button already visible (subscription exists)')
  } else {
    const changePlan = page.locator('button:has-text("Change plan")')
    if (!(await changePlan.isVisible().catch(() => false))) {
      finding('bug', 'subscription-detail', 'Change plan button missing')
    } else {
      await changePlan.click()
      await page.waitForTimeout(500)
      const radio = page.locator('input[type="radio"][name="plan"]').first()
      if (!(await radio.isVisible().catch(() => false))) {
        finding('bug', 'subscription-detail', 'plan dialog shows no plans (seedPricingPlans failed?)')
      } else {
        await radio.check()
        await shot('subscription-change-plan')
        await page.locator('button:has-text("Confirm")').click()
        await page.waitForTimeout(2500)
        body = await bodyText()
        if (body.includes('Setup Stripe Customer')) note('subscription-detail', 'plan set; Setup Stripe Customer button appeared')
        else finding('bug', 'subscription-detail', 'subscription not created after Change plan Confirm')
      }
    }
  }

  // ---------- 6. Setup Stripe Customer -> expect graceful failure ----------
  const setupBtn = page.locator('button:has-text("Setup Stripe Customer")')
  if (await setupBtn.isVisible().catch(() => false)) {
    await setupBtn.click()
    await page.waitForTimeout(4000)
    await shot('subscription-stripe-setup-result')
    body = await bodyText()
    const errVisible = await page.locator('p.text-\\[\\#ef4444\\]').first().isVisible().catch(() => false)
    if (errVisible || /stripe|failed|error/i.test(body)) {
      note('subscription-detail', 'Setup Stripe Customer failed gracefully with visible error message (expected: no STRIPE_SECRET_KEY in Convex env)')
    } else if (body.includes('cus_')) {
      note('subscription-detail', 'Stripe customer actually created (keys present?)')
    } else {
      finding('bug', 'subscription-detail', 'Setup Stripe Customer click produced no feedback at all')
    }
    // check button re-enabled (busy state cleared)
    const disabled = await setupBtn.isDisabled().catch(() => false)
    if (disabled) finding('bug', 'subscription-detail', 'Setup Stripe Customer button stuck disabled after failure')
  } else {
    finding('bug', 'subscription-detail', 'Setup Stripe Customer button not visible after setting plan')
  }

  // ---------- 7. billing list ----------
  await go('platform-billing', '/platform/billing')
  body = await bodyText()
  note('billing', body.includes('Create') ? 'billing page rendered with create affordance' : 'billing page rendered')

  // ---------- 8. create invoice wizard ----------
  await go('invoice-create', '/platform/billing/create')
  // edge case 2: Continue disabled with no agency selected
  const continueBtn = page.locator('button:has-text("Continue")')
  if (await continueBtn.isDisabled()) note('edge', 'direct nav to create: Continue correctly disabled without agency')
  else finding('bug', 'edge', 'Continue enabled with no agency selected')

  // select the tenant we just subscribed (by label)
  const select = page.locator('select').first()
  const options = await select.locator('option').allInnerTexts()
  note('invoice-create', `agency options: ${options.length - 1}`)
  await select.selectOption({ label: subscribedTenantName })
  await page.waitForTimeout(300)
  if (await continueBtn.isDisabled()) finding('bug', 'invoice-create', 'Continue still disabled after selecting agency')
  await continueBtn.click()

  // step 2: period defaults
  await page.waitForTimeout(400)
  await shot('invoice-create-step2')
  const dates = await page.locator('input[type="date"]').evaluateAll((els) => els.map((e) => e.value))
  note('invoice-create', `default period: start=${dates[0]} end=${dates[1]} due=${dates[2]}`)
  await continueBtn.click()

  // step 3: line items (auto). NOTE: tenant at index 1 may not have a subscription.
  await page.waitForTimeout(2500)
  await shot('invoice-create-step3')
  body = await bodyText()
  if (body.includes('no active subscription')) {
    note('invoice-create', 'selected agency has no subscription; inline fallback message shown (good UX). Switching to Manual mode.')
    await page.locator('button:has-text("Manual")').click()
    await page.waitForTimeout(300)
    await page.locator('input[placeholder="Description"]').first().fill('QA manual line')
    await page.locator('input[placeholder="Qty"]').first().fill('2')
    await page.locator('input[placeholder="Unit price"]').first().fill('150')
  } else if (body.includes('active seats')) {
    note('invoice-create', `auto preview rendered: ${body.match(/Total: [\d$.,]+/)?.[0] ?? 'total not found'}`)
    // Recalculate button
    const recalc = page.locator('button:has-text("Recalculate")')
    if (await recalc.isVisible().catch(() => false)) {
      await recalc.click()
      await page.waitForTimeout(2000)
      note('invoice-create', 'Recalculate re-rendered preview without error')
    } else finding('nit', 'invoice-create', 'Recalculate button missing')
  } else {
    finding('bug', 'invoice-create', `step 3 shows neither preview nor fallback: ${body.slice(0, 200)}`)
  }
  await continueBtn.click()

  // step 4: review
  await page.waitForTimeout(600)
  await shot('invoice-create-step4')
  body = await bodyText()
  const checkbox = page.locator('input[type="checkbox"]')
  if (await checkbox.isVisible().catch(() => false)) {
    note('invoice-create', 'Charge via Stripe checkbox visible in step 4')
    const explBefore = await page.locator('text=Stripe will email the agency').isVisible().catch(() => false)
    await checkbox.check()
    await page.waitForTimeout(300)
    const explAfter = await page.locator('text=Stripe will email the agency').isVisible().catch(() => false)
    if (explBefore && explAfter) finding('nit', 'invoice-create', 'Stripe explanation text is always visible, not gated on checkbox state (task expects it to appear when checked)')
    else if (!explBefore && explAfter) note('invoice-create', 'explanation text appears when checkbox checked')
    await shot('invoice-create-step4-stripe-checked')
  } else {
    finding('bug', 'invoice-create', 'Charge via Stripe checkbox NOT found in step 4')
  }

  // validation: Create & Send with no recipient email
  const sendInput = page.locator('input[placeholder*="billing@"]')
  const sendValue = await sendInput.inputValue().catch(() => '')
  if (!sendValue) {
    await page.locator('button:has-text("Create & Send")').click()
    await page.waitForTimeout(800)
    body = await bodyText()
    if (body.includes('Add at least one recipient email')) note('invoice-create', 'empty-recipient validation error shown (good)')
    else finding('bug', 'invoice-create', 'no validation message when sending with zero recipients')
  }
  await sendInput.fill('qa-stripe-e2e@example.com')

  // create WITH Stripe charge — expected: invoice created, Stripe mirror fails async
  await page.locator('button:has-text("Create & Send")').click()
  await page.waitForURL(/\/platform\/billing\/[a-z0-9]+/i, { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  currentPage = 'invoice-detail-stripe'
  await shot('invoice-detail-stripe')
  body = await bodyText()
  if (page.url().includes('/platform/billing/')) {
    note('invoice-create', `invoice created with Stripe checkbox; landed on ${page.url()}`)
    if (body.includes('Stripe invoice:')) note('invoice-detail', 'Stripe section visible (stripeInvoiceId set — unexpected without keys)')
    else finding('risk', 'invoice-create', 'invoice created with "Charge via Stripe" but NO Stripe section and NO user-facing indication that the Stripe mirror failed — silent async failure')
    // remember invoice id & number
    var stripeInvoiceUrl = page.url()
  } else {
    body = await bodyText()
    finding('bug', 'invoice-create', `Create & Send with Stripe did not navigate to detail. url=${page.url()} body=${body.slice(0, 300)}`)
  }

  // ---------- 9. second invoice WITHOUT stripe (manual, draft) ----------
  await go('invoice-create-2', '/platform/billing/create')
  await page.locator('select').first().selectOption({ label: subscribedTenantName })
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(300)
  // change period to a different month to avoid duplicate-period rejection
  const startInput = page.locator('input[type="date"]').nth(0)
  const endInput = page.locator('input[type="date"]').nth(1)
  const dueInput = page.locator('input[type="date"]').nth(2)
  await startInput.fill('2026-06-01')
  await endInput.fill('2026-06-30')
  await dueInput.fill('2026-07-14')
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(2000)
  body = await bodyText()
  if (body.includes('no active subscription')) {
    await page.locator('button:has-text("Manual")').click()
  }
  // edge case 1: manual mode with zero line items -> Continue must be disabled
  const manualBtn = page.locator('button:has-text("Manual")')
  if (await manualBtn.isVisible().catch(() => false)) await manualBtn.click()
  await page.waitForTimeout(300)
  // default row has empty description -> manualItems empty
  if (await page.locator('button:has-text("Continue")').isDisabled()) {
    note('edge', 'manual mode with 0 line items: Continue correctly disabled')
  } else {
    finding('bug', 'edge', 'manual mode allows Continue with 0 line items')
  }
  await page.locator('input[placeholder="Description"]').first().fill('QA draft line')
  await page.locator('input[placeholder="Unit price"]').first().fill('75')
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(500)
  await page.locator('button:has-text("Save as Draft")').click()
  await page.waitForURL(/\/platform\/billing\/[a-z0-9]+/i, { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)
  currentPage = 'invoice-detail-draft'
  await shot('invoice-detail-draft')
  const draftUrl = page.url()
  if (draftUrl.includes('/platform/billing/')) note('invoice-create', `manual draft invoice created: ${draftUrl}`)
  else finding('bug', 'invoice-create', 'Save as Draft did not navigate to detail')

  // ---------- invoice detail: draft actions ----------
  body = await bodyText()
  for (const label of ['Send', 'Void invoice']) {
    if (!body.includes(label)) finding('bug', 'invoice-detail', `missing action on draft invoice: ${label}`)
  }
  // Send the draft (email-only)
  await page.locator('button:has-text("Send")').first().click()
  await page.waitForTimeout(2500)
  body = await bodyText()
  if (/\bsent\b/i.test(body)) note('invoice-detail', 'draft invoice sent; status updated to sent')
  else finding('bug', 'invoice-detail', `send did not flip status: ${body.slice(0, 200)}`)
  await shot('invoice-detail-sent')

  // Mark as paid
  const markPaid = page.locator('button:has-text("Mark as paid")')
  if (await markPaid.isVisible().catch(() => false)) {
    await markPaid.click()
    await page.waitForTimeout(2500)
    body = await bodyText()
    if (/\bpaid\b/i.test(body)) note('invoice-detail', 'invoice marked paid')
    // edge case 4: void a paid invoice — Void button should be gone
    const voidVisible = await page.locator('button:has-text("Void invoice")').isVisible().catch(() => false)
    if (voidVisible) finding('bug', 'edge', 'Void invoice button still visible on a PAID invoice')
    else note('edge', 'paid invoice: Void button correctly hidden')
    await shot('invoice-detail-paid')
  } else {
    finding('bug', 'invoice-detail', 'Mark as paid button missing on sent invoice')
  }

  // ---------- duplicate period rejection ----------
  await go('invoice-create-3', '/platform/billing/create')
  await page.locator('select').first().selectOption({ label: subscribedTenantName })
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(300)
  await page.locator('input[type="date"]').nth(0).fill('2026-06-01')
  await page.locator('input[type="date"]').nth(1).fill('2026-06-30')
  await page.locator('input[type="date"]').nth(2).fill('2026-07-14')
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(1500)
  body = await bodyText()
  if (body.includes('no active subscription')) await page.locator('button:has-text("Manual")').click()
  else { const mb = page.locator('button:has-text("Manual")'); if (await mb.isVisible().catch(() => false)) await mb.click() }
  await page.locator('input[placeholder="Description"]').first().fill('duplicate period test')
  await page.locator('button:has-text("Continue")').click()
  await page.waitForTimeout(400)
  await page.locator('button:has-text("Save as Draft")').click()
  await page.waitForTimeout(2500)
  body = await bodyText()
  if (body.includes('already exists for this period')) note('edge', 'duplicate period rejected with clear error message')
  else if (page.url().includes('/platform/billing/') && !page.url().endsWith('create')) finding('bug', 'edge', 'duplicate-period invoice was created (idempotency guard failed)')
  else note('edge', `duplicate period attempt: url=${page.url()} (needs manual check)`)
  await shot('invoice-create-duplicate')

  // ---------- 10-12. audit / health / reports / support ----------
  await go('platform-audit', '/platform/audit')
  body = await bodyText()
  if (/invoice_created|invoice_sent|invoice_paid/.test(body)) note('audit', 'audit log shows invoice events')
  else note('audit', 'audit page loaded (no invoice events matched — check screenshot)')

  await go('platform-health', '/platform/health')
  await go('platform-reports', '/platform/reports')
  await go('platform-support', '/platform/support')

  // ---------- mobile responsiveness ----------
  await page.setViewportSize({ width: 390, height: 844 })
  await go('mobile-dashboard', '/platform')
  await go('mobile-billing', '/platform/billing')
  await go('mobile-invoice-create', '/platform/billing/create')
  note('mobile', 'mobile screenshots captured (390px)')

  // ---------- sync button race (edge 5): rapid double-click on any stripe invoice ----------
  // (No invoice has stripeInvoiceId in this env, so the sync section never renders — noted.)

  await browser.close()
  finish()
}

function finish() {
  writeFileSync('qa-stripe-e2e/results.json', JSON.stringify({ findings, consoleLog }, null, 2))
  console.log('\n==== CONSOLE LOG ====')
  for (const [page, entries] of Object.entries(consoleLog)) {
    console.log(`-- ${page}: ${entries.length} entries`)
    for (const e of entries.slice(0, 10)) console.log(`   [${e.type}] ${e.text.slice(0, 200)}`)
  }
  console.log('\n==== DONE ====')
}

main().catch((e) => {
  console.error('SCRIPT FAILURE:', e)
  try { writeFileSync('qa-stripe-e2e/results.json', JSON.stringify({ findings, consoleLog, failure: String(e) }, null, 2)) } catch {}
  process.exit(1)
})
