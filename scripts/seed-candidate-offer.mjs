import { chromium } from 'playwright'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ORG_ID = process.env.E2E_CLERK_ORG_ID
const CONVEX_URL = process.env.VITE_CONVEX_URL
const CANDIDATE_EMAIL = process.argv[2] || 'phase2-candidate@atriax.example.com'

async function extractConvexToken(page) {
  for (let i = 0; i < 30; i++) {
    const token = await page.evaluate(() => {
      const clerk = window.Clerk
      return clerk?.session?.getToken({ template: 'convex' }).catch(() => null) || null
    })
    if (token) return token
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Could not extract Convex token')
}

async function callConvexMutation(token, path, args) {
  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ path, args, format: 'json' }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} failed: ${response.status} ${text}`)
  }
  return response.json()
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`http://localhost:5173/sign-in?org_id=${ORG_ID}`)
  await page.waitForSelector('input[name=identifier]', { timeout: 10000 })
  await page.fill('input[name=identifier]', ADMIN_EMAIL)
  await page.click('button[type=submit]')
  await page.waitForSelector('input[name=password]', { timeout: 10000 })
  await page.fill('input[name=password]', ADMIN_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard|\//, { timeout: 20000 })

  await page.waitForFunction(() => window.Clerk?.session, { timeout: 15000 })

  const token = await extractConvexToken(page)
  console.log('TOKEN OK', token.slice(0, 20) + '...')

  const result = await callConvexMutation(token, 'seed:seedCandidateOffer', {
    clerkOrgId: ORG_ID,
    candidateEmail: CANDIDATE_EMAIL,
  })
  console.log('seedCandidateOffer result:', JSON.stringify(result, null, 2))

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
