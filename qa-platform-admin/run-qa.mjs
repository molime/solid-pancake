// E2E QA of the platform-admin agency management features on http://localhost:5174.
// Signs in via Clerk ticket as the E2E admin (already a platformAdmins row).
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
function finding(severity, area, text) {
  findings.push({ severity, area, text })
  console.log(`[${severity}] (${area}) ${text}`)
}
function note(area, text) {
  findings.push({ severity: 'note', area, text })
  console.log(`[note] (${area}) ${text}`)
}
function pass(area, text) {
  findings.push({ severity: 'PASS', area, text })
  console.log(`[PASS] (${area}) ${text}`)
}
function fail(area, text) {
  findings.push({ severity: 'FAIL', area, text })
  console.log(`[FAIL] (${area}) ${text}`)
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
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('clerk')) {
      ;(consoleLog[currentPage] ??= []).push({ type: 'http', text: `${res.status()} ${res.url().slice(0, 200)}` })
    }
  })

  async function shot(name) {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
  }
  async function go(name, path) {
    currentPage = name
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((e) => finding('bug', name, `navigation failed: ${e.message}`))
    await page.waitForTimeout(1500)
    await shot(name)
  }
  const bodyText = () => page.locator('body').innerText()

  // ---------- sign in ----------
  const ticket = await clerkTicket()
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForLoadState('networkidle')
  note('auth', `signed in, landed on ${page.url()}`)

  // ---------- 1. agencies list ----------
  await go('agencies-list', '/platform/agencies')
  let body = await bodyText()
  const createBtn = page.getByRole('link', { name: 'Create Agency' })
  if (await createBtn.isVisible().catch(() => false)) pass('agencies-list', '"Create Agency" button visible')
  else fail('agencies-list', '"Create Agency" button NOT visible')
  const firstTenantLink = page.locator('table a[href^="/platform/agencies/"]').first()
  let tenantHref = null
  if (await firstTenantLink.isVisible().catch(() => false)) {
    tenantHref = await firstTenantLink.getAttribute('href')
    pass('agencies-list', `agencies table rendered, first tenant href: ${tenantHref}`)
  } else {
    fail('agencies-list', `no tenant rows in agencies table. body: ${body.slice(0, 200)}`)
  }

  // ---------- 2. create agency form ----------
  await createBtn.click().catch(() => {})
  await page.waitForTimeout(1500)
  currentPage = 'agency-create'
  await shot('agency-create')
  if (page.url().includes('/platform/agencies/create')) pass('agency-create', `navigated to ${page.url()}`)
  else fail('agency-create', `unexpected URL after clicking Create Agency: ${page.url()}`)
  body = await bodyText()
  for (const label of ['Agency name', 'Slug', 'EIN', 'Address', 'Initial plan', 'Billing emails']) {
    if (body.includes(label)) pass('agency-create', `field present: ${label}`)
    else fail('agency-create', `field missing: ${label}`)
  }
  // slug auto-generation
  const nameInput = page.locator('input[placeholder="Sunrise Home Care"]')
  const slugInput = page.locator('input[placeholder="sunrise-home-care"]')
  await nameInput.fill('QA Test Agency LLC')
  await page.waitForTimeout(300)
  const slugVal = await slugInput.inputValue()
  if (slugVal === 'qa-test-agency-llc') pass('agency-create', `slug auto-generated: "${slugVal}"`)
  else fail('agency-create', `slug not auto-generated correctly, got "${slugVal}"`)
  await shot('agency-create-filled')

  // ---------- 3. agency detail page ----------
  if (tenantHref) {
    await go('agency-detail', tenantHref)
    body = await bodyText()
    for (const section of ['Active seats', 'Candidates', 'Shifts this month', 'MRR', 'Subscription', 'Custom Pricing', 'Limits', 'Users', 'Recent invoices']) {
      if (body.includes(section)) pass('agency-detail', `section present: ${section}`)
      else fail('agency-detail', `section missing: ${section}`)
    }
    if (page.locator('h1').first()) {
      const h1 = await page.locator('h1').first().innerText().catch(() => '')
      note('agency-detail', `header agency name: "${h1}"`)
    }

    // ---------- 4. Add User graceful failure ----------
    currentPage = 'agency-detail-adduser'
    const addUserBtn = page.getByRole('button', { name: 'Add User' })
    if (await addUserBtn.isVisible().catch(() => false)) {
      await addUserBtn.click()
      await page.waitForTimeout(500)
      await page.locator('input[placeholder="user@agency.com"]').fill('qa-noexist@example.com')
      await page.locator('input[placeholder="Jane Doe"]').fill('QA Noexist')
      await shot('agency-detail-adduser-dialog')
      // click the dialog's primary submit button (last "Add User" button = dialog submit)
      const dialogSubmit = page.locator('button', { hasText: /^Add User$/ }).last()
      await dialogSubmit.click()
      await page.waitForTimeout(4000)
      await shot('agency-detail-adduser-result')
      body = await bodyText()
      const h1still = await page.locator('h1').first().innerText().catch(() => '')
      if (h1still && !/something went wrong/i.test(body)) {
        // look for an error message in the dialog
        const errVisible = await page.locator('text=/failed|error|unable|not configured|secret|taken/i').first().isVisible().catch(() => false)
        if (errVisible) pass('add-user', 'action failed gracefully with visible error message (no crash)')
        else fail('add-user', `no error message visible after failed Add User. body excerpt: ${body.slice(0, 400)}`)
      } else {
        fail('add-user', 'page appears to have crashed after Add User failure')
      }
      // close dialog
      await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
    } else {
      fail('add-user', 'Add User button not visible')
    }

    // ---------- 5. custom rate ----------
    currentPage = 'agency-detail-customrate'
    const rateInput = page.locator('input[placeholder="499.00"]')
    if (await rateInput.isVisible().catch(() => false)) {
      await rateInput.fill('499')
      await page.getByRole('button', { name: 'Apply' }).click()
      await page.waitForTimeout(2500)
      body = await bodyText()
      const m = body.match(/Custom monthly rate\s*\n?\s*\$?([\d,.]+)/)
      if (m && m[1].startsWith('499')) pass('custom-rate', `Custom monthly rate row updated: $${m[1]}`)
      else fail('custom-rate', `Custom monthly rate row did not update. excerpt: ${body.slice(0, 600)}`)
      if (body.includes('Custom rate')) pass('custom-rate', 'MRR hint "Custom rate" visible')
      else fail('custom-rate', 'MRR hint "Custom rate" not visible')
      await shot('agency-detail-customrate')
      // reload and verify persistence
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      body = await bodyText()
      const m2 = body.match(/Custom monthly rate\s*\n?\s*\$?([\d,.]+)/)
      if (m2 && m2[1].startsWith('499')) pass('custom-rate-persist', `persists after reload: $${m2[1]}`)
      else fail('custom-rate-persist', 'custom rate did NOT persist after reload')
      await shot('agency-detail-customrate-reloaded')
      // cleanup: clear custom rate
      const clearBtn = page.getByRole('button', { name: 'Clear custom rate' })
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click()
        await page.waitForTimeout(2000)
        note('custom-rate', 'cleared custom rate (cleanup)')
      }
    } else {
      fail('custom-rate', 'custom rate input not found')
    }

    // ---------- 6. limits + over-limit badge ----------
    currentPage = 'agency-detail-limits'
    body = await bodyText()
    const seatsMatch = body.match(/Active seats\s*\n?\s*(\d+)/)
    const seatCount = seatsMatch ? Number(seatsMatch[1]) : 0
    note('limits', `current seat count: ${seatCount}`)
    const maxSeatsInput = page.locator('label:has-text("Max seats") + input').first()
    if (await maxSeatsInput.isVisible().catch(() => false)) {
      const limitValue = Math.max(0, seatCount - 1)
      await maxSeatsInput.fill(String(limitValue))
      await page.getByRole('button', { name: 'Save Limits' }).click()
      await page.waitForTimeout(2500)
      body = await bodyText()
      await shot('agency-detail-limits')
      if (seatCount > 0 && limitValue < seatCount) {
        if (body.includes('Over limit')) pass('limits', `"Over limit" warning badge shown (seats ${seatCount} > max ${limitValue})`)
        else fail('limits', `"Over limit" badge NOT shown despite seats ${seatCount} > max ${limitValue}`)
      } else {
        note('limits', 'seat count is 0; cannot trigger over-limit badge with seats')
      }
      // progress bar rendered?
      const bars = await page.locator('div.h-2.rounded-full').count()
      if (bars > 0) pass('limits', `progress bars rendered (${bars} bar segments)`)
      else fail('limits', 'no progress bars found')
      // cleanup: clear limits
      await maxSeatsInput.fill('')
      await page.getByRole('button', { name: 'Save Limits' }).click()
      await page.waitForTimeout(2000)
      note('limits', 'cleared limits (cleanup)')
    } else {
      fail('limits', 'Max seats input not found')
    }

    // ---------- 7. Edit Info dialog ----------
    currentPage = 'agency-detail-editinfo'
    const editBtn = page.getByRole('button', { name: 'Edit Info' })
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click()
      await page.waitForTimeout(600)
      await shot('agency-detail-editinfo-dialog')
      body = await bodyText()
      if (body.includes('Edit agency info')) pass('edit-info', 'Edit Info dialog opened')
      else fail('edit-info', 'Edit Info dialog did not open')
      await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {})
    } else {
      fail('edit-info', 'Edit Info button not visible')
    }

    // ---------- cleanup: remove leftover QA member if present ----------
    currentPage = 'agency-detail-cleanup'
    const qaRow = page.locator('tr', { hasText: 'QA Noexist' }).first()
    if (await qaRow.isVisible().catch(() => false)) {
      await qaRow.getByRole('button', { name: 'Remove' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Remove', exact: true }).last().click()
      await page.waitForTimeout(3000)
      const stillThere = await page.locator('tr', { hasText: 'QA Noexist' }).first().isVisible().catch(() => false)
      note('cleanup', stillThere ? 'QA Noexist member still present after remove attempt' : 'QA Noexist member removed (cleanup)')
      await shot('agency-detail-cleanup')
    } else {
      note('cleanup', 'no QA Noexist member to clean up')
    }
  }

  // ---------- 8b. invalid tenant id ----------
  await go('agency-detail-invalid', '/platform/agencies/invalid-id')
  await page.waitForTimeout(1500)
  body = await bodyText().catch(() => '')
  await shot('agency-detail-invalid-after')
  note('invalid-id', `body length: ${body.length}; excerpt: ${body.slice(0, 300).replace(/\n/g, ' | ')}`)
  const invalidErrors = (consoleLog['agency-detail-invalid'] ?? []).filter((e) => e.type === 'pageerror' || e.type === 'error')
  note('invalid-id', `console errors on invalid id page: ${invalidErrors.length}`)
  for (const e of invalidErrors.slice(0, 5)) note('invalid-id', `${e.type}: ${e.text.slice(0, 300)}`)
  if (body.trim().length === 0) fail('invalid-id', 'BLANK PAGE for invalid tenant id (bug)')
  else if (/not found/i.test(body)) pass('invalid-id', 'graceful "not found" state rendered')
  else note('invalid-id', 'page rendered something else; see screenshot')

  // ---------- results ----------
  writeFileSync('qa-platform-admin/results.json', JSON.stringify({ findings, consoleLog }, null, 2))
  const fails = findings.filter((f) => f.severity === 'FAIL').length
  const passes = findings.filter((f) => f.severity === 'PASS').length
  console.log(`\n==== ${passes} PASS, ${fails} FAIL ====`)
  await browser.close()
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
