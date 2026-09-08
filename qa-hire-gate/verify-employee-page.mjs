// QA: HR employee profile after the Golden Ages fixes.
// Verifies on /hr/employees/:memberId:
//  - the DE 34 panel (download prefilled + upload completed)
//  - the new "Hiring" tab showing the full application (I-9, W-4, banking,
//    acknowledgments, criminal record), uploaded documents, and generated
//    PDFs — i.e. nothing is lost when a candidate becomes an employee.
// Usage: node verify-employee-page.mjs <candidateEmail>
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5174'
const GA_CLERK_ORG = 'org_3DweCNe4Es2Ot5SuM3FCP1JcC34'
const HR_EMAIL = 'diego.molina.sieiro+hrqa1@gmail.com'
const CANDIDATE_EMAIL = process.argv[2]
const SCRIPT_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const REPO_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SHOTS = `${SCRIPT_DIR}/shots`
mkdirSync(SHOTS, { recursive: true })

if (!CANDIDATE_EMAIL) {
  console.error('usage: node verify-employee-page.mjs <candidateEmail>')
  process.exit(1)
}

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` (${extra})` : ''}`)
}

function clerkSecret() {
  const envText = readFileSync(`${REPO_ROOT}/.env.local`, 'utf-8')
  for (const line of envText.split(/\r?\n/)) {
    if (line.startsWith('CLERK_SECRET_KEY=')) return line.slice('CLERK_SECRET_KEY='.length)
  }
  throw new Error('CLERK_SECRET_KEY not found in .env.local')
}

async function ticketFor(email) {
  const sk = clerkSecret()
  const usersResp = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${sk}`, Accept: 'application/json' } },
  )
  const users = await usersResp.json()
  const user = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === email.toLowerCase()),
  )
  if (!user) throw new Error(`Clerk user not found for ${email}`)
  const ticketResp = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sk}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  })
  const ticket = await ticketResp.json()
  return ticket.token
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', (err) => console.log('PAGE ERROR:', String(err)))

  // Sign in as HR and pick the Golden Ages dev org if prompted.
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${await ticketFor(HR_EMAIL)}`)
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 45000 })
  await page.waitForLoadState('networkidle')
  const gaOrg = page.getByText('My Organization Test').first()
  if (await gaOrg.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gaOrg.click()
    await page.waitForLoadState('networkidle')
  }

  // Employees list → open the hired candidate via the row's View action.
  await page.goto(`${BASE}/hr/employees`)
  await page.waitForLoadState('networkidle')
  const row = page
    .locator('tr', { hasText: 'Golden Ages E2E Candidate' })
    .or(page.locator('div', { hasText: 'Golden Ages E2E Candidate' }).last())
  check('hired candidate listed in Employees', await row.first().isVisible({ timeout: 15000 }))
  await page
    .getByRole('link', { name: /View/i })
    .last()
    .click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // DE 34 panel above the tabs.
  check(
    'DE 34 panel visible',
    await page.getByText('New Hire Report (DE 34)').isVisible({ timeout: 15000 }),
  )
  check(
    'DE 34 prefilled download visible',
    await page.getByText('Download prefilled (partial)').isVisible(),
  )
  await page.screenshot({ path: `${SHOTS}/03-employee-profile-de34.png`, fullPage: true })

  // Hiring tab.
  await page.getByRole('button', { name: /Hiring/i }).click()
  await page.waitForTimeout(1500)
  for (const section of [
    'Personal information',
    'Employment history',
    'References',
    'Criminal record statement',
    'I-9',
    'W-4',
    'Disbursement (banking)',
    'Acknowledgments',
    'Documents submitted',
    'Generated documents',
  ]) {
    check(
      `Hiring tab shows: ${section}`,
      await page.getByText(section, { exact: false }).first().isVisible({ timeout: 10000 }),
    )
  }
  check(
    'applicant email visible',
    await page.getByText(CANDIDATE_EMAIL, { exact: false }).first().isVisible(),
  )
  check(
    'LIC 508 generated document listed',
    await page.getByText('Criminal Record (LIC 508)').isVisible(),
  )
  await page.screenshot({ path: `${SHOTS}/04-employee-profile-hiring.png`, fullPage: true })

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
