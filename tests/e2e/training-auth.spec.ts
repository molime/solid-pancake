import { test, expect } from '@playwright/test'
import { extractClerkToken, signInWithClerk } from './helpers/auth'

const PLATFORM_ADMIN_EMAIL = 'diego.molina.sieiro+platformadmin@gmail.com'
const AGENCY_ADMIN_EMAIL = 'diego.molina.sieiro+admin05082601@gmail.com'

// The script under test seeds memberships for these Clerk organizations.
const TEST_ORG_IDS = new Set([
  'org_3Dz8teqlLdIf7bWcDrAN4DtVKWA',
  'org_3HVpIs1zJlejyYQ4Z1MMSP8HkZO',
  'org_3GII008i2F6bzk1HbgkY8qODZad',
])

async function callConvex(
  path: string,
  args: Record<string, unknown>,
  token: string,
  kind: 'query' | 'mutation' = 'query',
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set')
  }
  const response = await fetch(`${convexUrl}/api/${kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Convex ${kind} ${path} failed: ${response.status} ${text}`)
  }
  const result = await response.json()
  if ('error' in result) {
    throw new Error(`Convex ${kind} ${path} error: ${JSON.stringify(result.error)}`)
  }
  return result.value
}

async function findClerkUserIdByEmail(email: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not set')
  }
  const response = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Clerk user lookup failed: ${response.status}`)
  }
  const users = (await response.json()) as Array<{
    id: string
    email_addresses: Array<{ email_address: string }>
  }>
  const normalized = email.toLowerCase()
  const user = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === normalized),
  )
  if (!user) {
    throw new Error(`Clerk user not found: ${email}`)
  }
  return user.id
}

async function createSignInTicket(email: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not set')
  }
  const userId = await findClerkUserIdByEmail(email)
  const response = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  })
  if (!response.ok) {
    throw new Error(`Clerk ticket creation failed: ${response.status}`)
  }
  const data = (await response.json()) as { token: string }
  return data.token
}

async function signInAndGetToken(
  page: import('@playwright/test').Page,
  email: string,
): Promise<string> {
  const ticket = await createSignInTicket(email)
  await page.goto(`/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await page.waitForLoadState('networkidle')

  // Wait for Clerk to establish a session. The platform admin lands on
  // /platform/subscriptions; agency users land on /select-agency or /.
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForFunction(() => {
    const clerk = (window as unknown as Record<string, unknown>).Clerk as
      | { session?: unknown }
      | undefined
    return Boolean(clerk?.session)
  })

  const token = await extractClerkToken(page)
  if (!token) {
    throw new Error('Could not extract Clerk session token.')
  }
  return token
}

async function enableTrainingForTestTenant(
  browser: import('@playwright/test').Browser,
): Promise<{ clerkOrgId: string; name: string }> {
  const platformContext = await browser.newContext()
  const platformPage = await platformContext.newPage()
  try {
    const token = await signInAndGetToken(platformPage, PLATFORM_ADMIN_EMAIL)

    const tenants = (await callConvex(
      'platform:listTenantsWithUsage',
      {},
      token,
      'query',
    )) as Array<{ _id: string; clerkOrgId: string; name: string }>

    const targetTenant = tenants.find((t) => TEST_ORG_IDS.has(t.clerkOrgId))
    if (!targetTenant) {
      throw new Error(
        `No tenant found for test orgs: ${JSON.stringify(tenants.map((t) => ({ name: t.name, clerkOrgId: t.clerkOrgId })))}`,
      )
    }

    await callConvex(
      'platform:setTenantProduct',
      { tenantId: targetTenant._id, productKey: 'training', active: true },
      token,
      'mutation',
    )

    await callConvex(
      'training:seedDefaultCourses',
      { clerkOrgId: targetTenant.clerkOrgId },
      token,
      'mutation',
    )

    // Ensure the agency admin account has the org:admin role in Convex so the
    // route guard allows access to /training/admin. Previous sign-ins may have
    // created a tenantMembers row with a default caregiver role.
    const agencyAdminUserId = await findClerkUserIdByEmail(AGENCY_ADMIN_EMAIL)
    await callConvex(
      'members:updateRole',
      {
        clerkOrgId: targetTenant.clerkOrgId,
        clerkUserId: agencyAdminUserId,
        role: 'org:admin',
      },
      token,
      'mutation',
    ).catch((err) => {
      // If the member row doesn't exist yet, the sign-in bootstrap will create
      // it using the Clerk membership role; ignore the update failure.
      console.warn('Could not pre-set agency admin role:', err)
    })

    return { clerkOrgId: targetTenant.clerkOrgId, name: targetTenant.name }
  } finally {
    await platformContext.close()
  }
}

async function switchToOrgById(
  page: import('@playwright/test').Page,
  orgId: string,
) {
  await page.goto('/select-agency')
  await page.waitForLoadState('networkidle')

  if (!page.url().includes('/select-agency')) {
    return
  }

  const card = page.locator(`[data-testid="agency-card-${orgId}"]`).locator('button').first()
  await expect(card).toBeVisible({ timeout: 10000 })
  await card.click()

  await expect(page).not.toHaveURL(/select-agency/, { timeout: 30000 })
  await page.waitForLoadState('networkidle')
}

test.describe('@auth training module', () => {
  test('admin can open the training admin page after training is enabled', async ({
    browser,
    page,
  }) => {
    test.slow()
    const consoleLogs: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    const targetTenant = await enableTrainingForTestTenant(browser)

    await signInWithClerk(page, AGENCY_ADMIN_EMAIL, 'dummy', targetTenant.clerkOrgId, 'org:admin')
    await switchToOrgById(page, targetTenant.clerkOrgId)

    await page.goto('/training/admin')
    await page.waitForLoadState('networkidle')

    try {
      await expect(page.locator('body')).toContainText('Training Admin', {
        timeout: 15000,
      })
      await expect(page.locator('body')).toContainText('New course')
    } catch (err) {
      const url = page.url()
      const bodyText = await page.locator('body').innerText().catch(() => '<no body>')
      throw new Error(
        `Training admin assertion failed. URL: ${url}\nBody: ${bodyText}\nConsole: ${consoleLogs.join('\n')}\nPage errors: ${pageErrors.join('\n')}`,
        { cause: err },
      )
    }
  })
})
