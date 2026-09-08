// Stage 5 interactive flow: audit packet export, audit report export,
// retention card + legal hold, and role gates (HR allowed, coordinator not).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { ConvexHttpClient } from 'convex/browser'

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

const results = { steps: [], bugs: [] }
function step(name, pass, detail) {
  results.steps.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function clerkTicket(email) {
  const headers = {
    Authorization: `Bearer ${local.CLERK_SECRET_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const res = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    { headers },
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
  const tokRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  if (!tokRes.ok) throw new Error(`sign_in_tokens failed: HTTP ${tokRes.status}`)
  return (await tokRes.json()).token
}

async function signIn(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err).slice(0, 300)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 300))
  })
  const ticket = await clerkTicket(email)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForURL((u) => !u.pathname.includes('sign-in'), { timeout: 30000 })
  await page.waitForTimeout(3000)
  return { ctx, page, errors }
}

async function waitForContent(page, re, timeoutMs = 60000) {
  const start = Date.now()
  let body = ''
  while (Date.now() - start < timeoutMs) {
    body = await page.locator('body').innerText().catch(() => '')
    const t = body.trim()
    if (
      t.length > 50 &&
      !/Opening agency workspace|Securing agency workspace|Preparing workspace|Loading audit-readiness report/i.test(t) &&
      re.test(t)
    ) {
      return body
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(`timed out waiting for ${re}; last body: ${body.slice(0, 300)}`)
}

async function convexClientFor(page) {
  const { token, orgId } = await page.evaluate(async () => {
    const session = window.Clerk?.session
    if (!session) throw new Error('no clerk session')
    return {
      token: await session.getToken({ skipCache: true }),
      orgId: window.Clerk.organization?.id,
    }
  })
  const client = new ConvexHttpClient(CONVEX_URL)
  client.setAuth(token)
  return { client, orgId }
}

async function clickAndCapture(page, buttonName, outName) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: buttonName }).click(),
  ])
  const path = `${SHOTS}/${outName}`
  await download.saveAs(path)
  const content = readFileSync(path, 'utf8')
  return { fileName: download.suggestedFilename(), content }
}

const PACKET_SECTIONS = [
  'ATRIA-X Audit Evidence Packet',
  'Agency Information',
  'Agency Obligations',
  'Personnel Roster',
  'Training Matrix',
  'Background Checks',
  'Special Incident Report Log',
  'Progress Reports',
  'Documentation Completeness',
  'Billing Exceptions',
  'Audit Events',
]

async function main() {
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=512'],
  })

  // ---------- Admin ----------
  const admin = await signIn(browser, e2e.E2E_ADMIN_EMAIL)
  const { page, errors } = admin
  await page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' })
  const body = await waitForContent(page, /Audit Trail/i)
  console.log('[page] /audit loaded (admin)')
  const { client, orgId } = await convexClientFor(page)

  // Wait for async cards (retention etc.) to resolve.
  await waitForContent(page, /Record retention/i)
  const settledBody = await page.locator('body').innerText()

  // Page numbers for cross-checking.
  const personnelDetail =
    settledBody.match(/(\d+) of (\d+) credentials verified/) ?? null
  const blockedLine = settledBody.match(/(\d+) billing lines blocked/) ?? null
  const docLine =
    settledBody.match(/(\d+) of (\d+) shifts have progress notes/) ?? null
  step('audit: dashboard numbers captured', !!(personnelDetail && blockedLine && docLine),
    `personnel=${personnelDetail?.[0]}, blocked=${blockedLine?.[0]}, docs=${docLine?.[0]}`)

  // ---- Flow 3a: audit packet ----
  const packet = await clickAndCapture(page, /download audit packet/i, 'audit-packet.csv')
  step('packet: downloads as CSV', packet.content.length > 500 && /audit-packet.*\.csv/.test(packet.fileName),
    `${packet.fileName}, ${packet.content.length} bytes`)
  const missingSections = PACKET_SECTIONS.filter((s) => !packet.content.includes(s))
  step('packet: all documented sections present', missingSections.length === 0,
    missingSections.length ? `missing: ${missingSections.join(', ')}` : 'all 11 sections')

  // Cross-check dashboard numbers vs packet numbers.
  const csvNum = (label) => {
    const m = packet.content.match(new RegExp(`"${label}","(\\d+)"`))
    return m ? Number(m[1]) : null
  }
  const csvBlocked = csvNum('Blocked Billing Lines')
  step('packet: blocked billing lines matches dashboard',
    csvBlocked !== null && blockedLine && csvBlocked === Number(blockedLine[1]),
    `csv=${csvBlocked} page=${blockedLine?.[1]}`)
  const csvTotalShifts = csvNum('Total Shifts')
  const csvWithNotes = csvNum('Shifts With Notes')
  step('packet: documentation completeness matches dashboard',
    csvTotalShifts === Number(docLine?.[2]) && csvWithNotes === Number(docLine?.[1]),
    `csv=${csvWithNotes}/${csvTotalShifts} page=${docLine?.[1]}/${docLine?.[2]}`)
  // Personnel roster data rows should equal the gaps list length.
  const rosterSection = packet.content.split('"Personnel Roster"')[1]?.split('"Training Matrix"')[0] ?? ''
  const rosterRows = rosterSection.split('\r\n').filter((l) => l.startsWith('"') && !l.startsWith('"Name"') && l !== '""').length
  const report = await client.query('auditReadiness:getReport', { clerkOrgId: orgId })
  step('packet: personnel roster rows == dashboard gaps',
    rosterRows === report.gaps.length && report.personnel.total >= 0,
    `csv rows=${rosterRows} gaps=${report.gaps.length}; dashboard personnel=${personnelDetail?.[1]} of ${personnelDetail?.[2]} vs report ${report.personnel.compliant} of ${report.personnel.total}`)
  step('packet: personnel counts match dashboard',
    report.personnel.compliant === Number(personnelDetail?.[1]) &&
      report.personnel.total === Number(personnelDetail?.[2]))

  // ---- Flow 3b: audit report ----
  const auditReport = await clickAndCapture(page, /download audit report/i, 'audit-readiness.csv')
  step('report: downloads as CSV', auditReport.content.length > 200 && /audit-readiness.*\.csv/.test(auditReport.fileName),
    `${auditReport.fileName}, ${auditReport.content.length} bytes`)

  // ---- Flow 4: retention card + legal hold ----
  const retentionCard = /Record retention \(17 CCR §54326\(a\)\(3\)\)/.test(settledBody)
  step('retention: card renders with record-type counts', retentionCard &&
    /Archived documents: .* total/.test(settledBody),
    settledBody.match(/Archived documents:[^\n]*/)?.[0])
  const holdsBefore = Number(
    settledBody.match(/Archived documents:.*?(\d+) under legal hold/)?.[1] ?? '0',
  )

  // No legal-hold UI exists anywhere in src/ (grep: setLegalHold only in
  // convex/documentArchive.ts) — exercise the backend mutation instead.
  const archive = await client.query('documentArchive:listDocumentArchive', { clerkOrgId: orgId })
  const target = archive[0]
  if (target) {
    await client.mutation('documentArchive:setLegalHold', {
      clerkOrgId: orgId,
      table: 'documentArchiveItems',
      recordId: target._id,
      legalHold: true,
    })
    await page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' })
    const after = await waitForContent(page, /Record retention/i)
    const holdsAfter = Number(
      after.match(/Archived documents:.*?(\d+) under legal hold/)?.[1] ?? '0',
    )
    step('retention: legal hold reflected in card (backend-only mutation)',
      holdsAfter === holdsBefore + 1, `before=${holdsBefore} after=${holdsAfter}`)
    await page.screenshot({ path: `${SHOTS}/stage5_retention_legal_hold.png` })
    // Clean up: clear the hold again so other QA is unaffected.
    await client.mutation('documentArchive:setLegalHold', {
      clerkOrgId: orgId,
      table: 'documentArchiveItems',
      recordId: target._id,
      legalHold: false,
    })
    console.log('[cleanup] legal hold cleared')
  } else {
    step('retention: legal hold reflected in card (backend-only mutation)', false,
      'no archive items to hold')
  }

  await page.screenshot({ path: `${SHOTS}/stage5_audit_admin.png` })
  step('admin: no pageerrors/console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await admin.ctx.close().catch(() => {})

  // ---------- HR ----------
  const hr = await signIn(browser, e2e.E2E_HR_EMAIL)
  try {
    await hr.page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' })
    await waitForContent(hr.page, /Audit Trail/i)
    step('hr: /audit renders', hr.page.url().includes('/audit'), hr.page.url())
    const hrPacket = await clickAndCapture(hr.page, /download audit packet/i, 'audit-packet-hr.csv')
    const hrMissing = PACKET_SECTIONS.filter((s) => !hrPacket.content.includes(s))
    step('hr: packet download works with all sections', hrMissing.length === 0,
      `${hrPacket.fileName}, ${hrPacket.content.length} bytes`)
    await hr.page.screenshot({ path: `${SHOTS}/stage5_audit_hr.png` })
  } catch (e) {
    step('hr: /audit renders', false, e.message.slice(0, 200))
  }
  await hr.ctx.close().catch(() => {})

  // ---------- Coordinator (not allowed) ----------
  const coord = await signIn(browser, e2e.E2E_COORDINATOR_EMAIL)
  try {
    await coord.page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' })
    await coord.page.waitForTimeout(8000)
    const url = coord.page.url()
    const cBody = await coord.page.locator('body').innerText().catch(() => '')
    const blocked =
      !url.includes('/audit') ||
      /don't have access|not authorized|permission/i.test(cBody)
    step('coordinator: /audit blocked (redirect or denied)', blocked,
      `url=${url}`)
    await coord.page.screenshot({ path: `${SHOTS}/stage5_audit_coordinator.png` })
  } catch (e) {
    step('coordinator: /audit blocked (redirect or denied)', false, e.message.slice(0, 200))
  }
  await coord.ctx.close().catch(() => {})

  writeFileSync('qa-audit/flow-audit-packet-results.json', JSON.stringify(results, null, 2))
  await browser.close()
  const failed = results.steps.filter((s) => !s.pass)
  console.log(`\n${results.steps.length - failed.length}/${results.steps.length} steps passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  writeFileSync('qa-audit/flow-audit-packet-results.json', JSON.stringify(results, null, 2))
  process.exit(1)
})
