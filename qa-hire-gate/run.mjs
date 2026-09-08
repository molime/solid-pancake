// QA: post-hire HCS 501 personnel-record gate.
// Phase 1: create a real candidate via the public Golden Ages apply link.
// Phase 2: bootstrap the candidate to the exact post-hire state
//          (seed:hireCandidateForGate) without the full offer pipeline.
// Phase 3: sign in as the hired caregiver and verify the dashboard gate
//          redirects to /personnel-record, then upload a dummy PDF and
//          verify dashboard access is restored.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const SCRIPT_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const REPO_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const BASE = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5174'
const GA_SLUG = 'my-organization-test-1779197430198727447'
const GA_CLERK_ORG = 'org_3DweCNe4Es2Ot5SuM3FCP1JcC34'
const SHOTS = `${SCRIPT_DIR}/shots`
const STATE_FILE = `${SCRIPT_DIR}/state.json`
mkdirSync(SHOTS, { recursive: true })

const TS = Date.now()
const DEFAULT_EMAIL = `hire.gate.${TS}@gmail.com`
const PASSWORD = process.env.QA_HIRE_GATE_PASSWORD
if (!PASSWORD) {
  throw new Error('Set QA_HIRE_GATE_PASSWORD in the environment before running this script.')
}
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` (${extra})` : ''}`)
}

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  : {}
const EMAIL = process.env.QA_EMAIL ?? state.email ?? DEFAULT_EMAIL
function saveState(patch) {
  writeFileSync(STATE_FILE, JSON.stringify({ email: EMAIL, ...state, ...patch }, null, 2))
}

function phase2() {
  const cmd = `npx convex run seed:hireCandidateForGate ${JSON.stringify(
    JSON.stringify({ clerkOrgId: GA_CLERK_ORG, email: EMAIL }),
  )} --no-push`
  const out = execSync(cmd, { encoding: 'utf-8', cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  console.log('bootstrap:', out.trim())
  saveState({ bootstrapped: true })
}

async function applyAsCandidate() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text())
  })
  await page.goto(`${BASE}/apply?agency=${GA_SLUG}`)
  await page.waitForLoadState('networkidle')

  await page.getByLabel('Full name').fill('Hire Gate QA')
  await page.getByLabel('Email address').fill(EMAIL)
  await page.getByLabel('Phone number').fill('555-555-0100')

  const branchSelect = page.locator('select').filter({ hasText: /Branch|Location/i }).first()
  if (await branchSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await branchSelect.locator('option').count()
    if (options > 1) await branchSelect.selectOption({ index: 1 })
  }
  const positionSelect = page.locator('select').filter({ hasText: /Position/i }).first()
  if (await positionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await positionSelect.locator('option').count()
    if (options > 1) await positionSelect.selectOption({ index: 1 })
  }

  await page.getByRole('button', { name: /Apply|Submit|Start/i }).click()
  await page.getByText('Application started!').waitFor({ timeout: 45000 })

  await page.locator('#newPassword').fill(PASSWORD)
  await page.locator('#confirmPassword').fill(PASSWORD)
  await page.getByRole('button', { name: /Set password and continue/i }).click()
  await page.waitForURL(/onboarding/, { timeout: 45000 })
  await page.waitForLoadState('networkidle')
  console.log('candidate created:', EMAIL)
  await browser.close()
}

async function createSignInTicket() {
  const envText = readFileSync(`${REPO_ROOT}/.env.local`, 'utf-8')
  let secretKey = ''
  for (const line of envText.split(/\r?\n/)) {
    if (line.startsWith('CLERK_SECRET_KEY=')) secretKey = line.slice('CLERK_SECRET_KEY='.length)
  }
  const usersResp = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(EMAIL)}`,
    { headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' } },
  )
  const users = await usersResp.json()
  const user = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === EMAIL.toLowerCase()),
  )
  if (!user) throw new Error(`Clerk user not found for ${EMAIL}`)
  const ticketResp = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  const ticket = await ticketResp.json()
  return ticket.token
}

async function signInAsHiredCaregiver() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  const ticket = await createSignInTicket()
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 45000 })
  await page.waitForLoadState('networkidle')

  // If an agency picker appears (multiple tenants), pick the GA dev org.
  const agencyOption = page.getByText('My Organization Test').first()
  if (await agencyOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await agencyOption.click()
    await page.waitForLoadState('networkidle')
  }

  // The candidate portal checklist must also bounce a hiree without the
  // uploaded personnel record.
  await page.goto(`${BASE}/onboarding/checklist`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const checklistUrl = new URL(page.url())
  check(
    'candidate checklist redirects to /personnel-record',
    checklistUrl.pathname === '/personnel-record',
    checklistUrl.pathname,
  )

  // Now hit the dashboard — the personnel-record gate should intercept.
  await page.goto(`${BASE}/caregiver/today`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  const url = new URL(page.url())
  check('dashboard redirects to /personnel-record', url.pathname === '/personnel-record', url.pathname)
  await page.screenshot({ path: `${SHOTS}/01-personnel-record-gate.png`, fullPage: true })

  if (url.pathname === '/personnel-record') {
    const downloadLink = page.locator('a[download="hcs_501_personnel_record.pdf"]')
    check('blank HCS 501 download link visible', await downloadLink.isVisible())

    // Upload a dummy completed form.
    const dummyPdf = `${SHOTS}/dummy-hcs501.pdf`
    writeFileSync(
      dummyPdf,
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\n%%EOF',
    )
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(dummyPdf)
    await page.getByRole('button', { name: /Submit completed form|Replace uploaded form/i }).click()
    await page.waitForURL(/caregiver\/today/, { timeout: 30000 })
    check('after upload, dashboard is accessible', true, page.url())

    // Re-visit: gate must now let the caregiver through.
    await page.goto(`${BASE}/caregiver/today`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    check('gate lifted after upload', new URL(page.url()).pathname === '/caregiver/today', page.url())
    await page.screenshot({ path: `${SHOTS}/02-dashboard-after-upload.png`, fullPage: true })
  }

  const relevant = errors.filter((e) => !/favicon|DevTools|extension|Clerk: Clerk has been loaded/i.test(e))
  if (relevant.length > 0) {
    console.log('console errors:', relevant.slice(0, 10))
  }
  await browser.close()
}

async function main() {
  if (process.env.QA_EMAIL) {
    console.log('Phase 1: skipped (QA_EMAIL override', EMAIL + ')')
    console.log('Phase 2: re-run bootstrap (idempotent) for', EMAIL)
    phase2()
  } else {
    if (!state.email) {
      console.log('Phase 1: apply as candidate')
      await applyAsCandidate()
      saveState({})
    } else {
      console.log('Phase 1: skipped (existing candidate', EMAIL + ')')
    }
    if (!state.bootstrapped) {
      console.log('Phase 2: bootstrap post-hire state')
      phase2()
    } else {
      console.log('Phase 2: skipped (already bootstrapped)')
    }
  }
  console.log('Phase 3: sign in as hired caregiver')
  await signInAsHiredCaregiver()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
