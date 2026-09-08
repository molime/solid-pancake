// Stage 6 EVV supplement: the E2E tenant ("Diego's Agency") has no shifts in
// submitted/approved/billing_ready, so the EVV table was empty. This script:
//  1. seeds E2E fixture shifts (seed:resetE2EShifts, admin token),
//  2. clocks the SLS fixture shift in/out with a full note (caregiver token)
//     so it lands in status 'submitted' — an EVV-qualifying visit,
//  3. re-verifies the /evv page: visit row with six elements, CSV data row,
//     excluded-count label.
// Auth: Clerk sign_in_tokens for browser; session token reused for direct
// Convex HTTP calls (same pattern as tests/e2e/helpers/seed.ts).
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
const CONVEX_URL = local.VITE_CONVEX_URL
const ORG_ID = e2e.E2E_CLERK_ORG_ID

const clerkHeaders = {
  Authorization: `Bearer ${local.CLERK_SECRET_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function clerkUserId(email) {
  const res = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    { headers: clerkHeaders },
  )
  const users = await res.json()
  const user = Array.isArray(users)
    ? users.find((u) =>
        u.email_addresses.some(
          (x) => x.email_address.toLowerCase() === email.toLowerCase(),
        ),
      )
    : null
  if (!user) throw new Error(`clerk user not found: ${email}`)
  return user.id
}

async function clerkTicket(userId) {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: clerkHeaders,
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  })
  if (!res.ok) throw new Error(`sign_in_tokens failed: HTTP ${res.status}`)
  return (await res.json()).token
}

async function signInAndGetToken(browser, userId) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const ticket = await clerkTicket(userId)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(5000)
  const token = await page.evaluate(async () => {
    const clerk = window.Clerk
    if (!clerk?.session) return null
    return clerk.session.getToken()
  })
  if (!token) throw new Error('could not extract Clerk session token')
  return { ctx, page, token }
}

async function callConvex(kind, token, path, args) {
  const res = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path, args, format: 'json' }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 400)}`)
  const json = JSON.parse(text)
  if (json.status === 'error') throw new Error(`${path} error: ${json.errorMessage?.slice(0, 400)}`)
  return json.value ?? json
}

const results = []
function record(check, pass, evidence = '') {
  results.push({ check, pass: !!pass, evidence })
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${check} ${evidence ? `— ${evidence}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
  })

  const adminId = await clerkUserId(e2e.E2E_ADMIN_EMAIL)
  const coordinatorId = await clerkUserId(e2e.E2E_COORDINATOR_EMAIL)
  const caregiverId = await clerkUserId(e2e.E2E_CAREGIVER_EMAIL)

  // 1. seed fixtures as admin
  const admin = await signInAndGetToken(browser, adminId)
  const seed = await callConvex('mutation', admin.token, 'seed:resetE2EShifts', {
    clerkOrgId: ORG_ID,
    adminUserId: adminId,
    coordinatorUserId: coordinatorId,
    caregiverUserId: caregiverId,
  })
  const shiftId = seed.geofenceShiftId // SLS, Maya Torres, 2024-01-15 14:00-18:00
  console.log('seeded fixture shift:', shiftId)
  record('seed fixture SLS shift created', !!shiftId)

  // 2. caregiver clock in/out with full note
  const caregiver = await signInAndGetToken(browser, caregiverId)
  const loc = { latitude: 44.9778, longitude: -93.265, accuracyMeters: 5 }
  await callConvex('mutation', caregiver.token, 'shifts:clockIn', {
    clerkOrgId: ORG_ID,
    shiftId,
    location: loc,
  })
  const details = await callConvex('query', caregiver.token, 'shiftQueries:getWithDetails', {
    clerkOrgId: ORG_ID,
    shiftId,
  })
  const tasks = (details.tasks ?? []).map((t) => ({
    taskId: t._id,
    status: 'complete',
    proofUrl: 'https://example.com/proof.txt',
    proofName: 'proof.txt',
  }))
  await callConvex('mutation', caregiver.token, 'shifts:clockOut', {
    clerkOrgId: ORG_ID,
    shiftId,
    location: loc,
    note: {
      startTime: '14:00',
      endTime: '18:00',
      servicesProvided: 'Bathing, meal preparation',
      clientResponse: 'Engaged and cooperative',
      narrative: 'QA Stage 6 EVV visit: assisted with bathing and dinner prep.',
    },
    tasks,
  })
  const after = await callConvex('query', caregiver.token, 'shiftQueries:get', {
    clerkOrgId: ORG_ID,
    shiftId,
  })
  record('fixture shift reached submitted status', after.status === 'submitted', `status=${after.status}`)
  await caregiver.ctx.close().catch(() => {})

  // 3. verify EVV page as admin
  const page = admin.page
  await page.goto(`${BASE}/evv`, { waitUntil: 'domcontentloaded' })
  const deadline = Date.now() + 45000
  let body = ''
  while (Date.now() < deadline) {
    body = await page.locator('body').innerText().catch(() => '')
    if (/EVV visit export/.test(body) && !/Loading/i.test(body)) break
    await page.waitForTimeout(1000)
  }
  const start = page.getByLabel('Start date')
  await start.click()
  await start.fill('01012024')
  await start.blur()
  const end = page.getByLabel('End date')
  await end.click()
  await end.fill('12312024')
  await end.blur()

  while (Date.now() < deadline) {
    body = await page.locator('body').innerText().catch(() => '')
    if (/Maya Torres/.test(body) || /No visits in range/.test(body)) break
    await page.waitForTimeout(1000)
  }
  const rows = page.locator('table tbody tr')
  const rowCount = await rows.count()
  record('EVV visit row renders for submitted shift', rowCount > 0 && /Maya Torres/.test(body), `rows=${rowCount}`)
  const visitRow = page.locator('table tbody tr', { hasText: 'Maya Torres' }).first()
  if (rowCount > 0) {
    for (let i = 0; i < rowCount; i++) {
      console.log('    row', i, (await rows.nth(i).innerText()).replace(/\t/g, ' | ').slice(0, 200))
    }
    const rowText = (await visitRow.innerText()).replace(/\t/g, ' | ')
    record(
      'six elements present (service/recipient/date/begin/end/location/provider)',
      /SLS/.test(rowText) &&
        /Maya Torres/.test(rowText) &&
        /\d{2}\/\d{2}\/\d{4}/.test(rowText) &&
        /\d{1,2}:\d{2} [AP]M/.test(rowText) &&
        /E2E Caregiver/.test(rowText),
      rowText.slice(0, 220),
    )
    // punch matched the client geofence target, so targetLabel wins over raw
    // coords in the documented fallback chain
    record('location resolved from punch target label', /123 Hennepin Ave/.test(rowText))
  }
  const m = body.match(/(\d+) live-in exempt visits? excluded/)
  record('excluded-count label still renders', !!m, m?.[0])

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: /Download CSV/i }).click(),
  ])
  const csv = readFileSync(await download.path(), 'utf8')
  const dataRows = csv.split('\r\n').filter((l) => /^"(SLS|ILS)"/.test(l))
  record('CSV contains visit data row', dataRows.length > 0, dataRows[0]?.slice(0, 220))
  record(
    'CSV row has all six elements for fixture visit',
    dataRows.some(
      (l) =>
        l.includes('"SLS"') &&
        l.includes('Maya Torres') &&
        /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(l) &&
        l.includes('123 Hennepin Ave') &&
        l.includes('E2E Caregiver'),
    ),
  )

  await page.screenshot({ path: `${SHOTS}/stage6_evv_with_visits.png` }).catch(() => {})
  await admin.ctx.close().catch(() => {})
  await browser.close()

  const failed = results.filter((r) => !r.pass)
  writeFileSync(
    'qa-audit/results-stage6-evv.json',
    JSON.stringify({ passed: results.length - failed.length, total: results.length, results }, null, 2),
  )
  console.log(`\n${results.length - failed.length}/${results.length} passed -> qa-audit/results-stage6-evv.json`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
