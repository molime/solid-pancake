import { test, expect } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
} from './helpers/auth'

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? ''

interface ConvexHttpResult {
  status: 'success' | 'error'
  value?: unknown
  errorMessage?: string
}

async function callConvex(
  page: import('@playwright/test').Page,
  kind: 'query' | 'mutation' | 'action',
  path: string,
  args: Record<string, unknown>,
): Promise<ConvexHttpResult> {
  const token = await extractClerkToken(page)
  expect(token).toBeTruthy()
  const response = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path, args, format: 'json' }),
  })
  expect(response.ok).toBeTruthy()
  return (await response.json()) as ConvexHttpResult
}

test.describe('allowed email domains', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(assertE2ECredentialsConfigured)

  test.afterEach(async ({ page }) => {
    // Always leave the E2E tenant in open-enrollment mode so other specs are
    // unaffected by the domain allowlist.
    await page.goto('about:blank')
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
    await callConvex(page, 'mutation', 'tenants:setAllowedEmailDomains', {
      clerkOrgId: E2E_ORG_ID,
      domains: [],
    })
  })

  test('admin manages domains via settings UI and disallowed invitations are blocked before Clerk', async ({
    page,
  }) => {
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

    await page.goto('/settings/allowed-domains')
    const input = page.locator('[data-testid="allowed-domains-input"]')
    await expect(input).toBeVisible({ timeout: 15000 })

    // Set an allowlist via the UI.
    await input.fill('example.com')
    await page.locator('[data-testid="save-allowed-domains-button"]').click()
    await expect(
      page.locator('[data-testid="allowed-domains-message"]'),
    ).toHaveText('Allowed email domains saved.')

    // The setting persists across reloads.
    await page.reload()
    await expect(
      page.locator('[data-testid="allowed-domains-input"]'),
    ).toHaveValue('example.com', { timeout: 15000 })

    // An invitation to a disallowed domain is rejected before any Clerk API
    // call, with an isAllowListError-compatible message.
    const blocked = await callConvex(page, 'action', 'invitations:create', {
      clerkOrgId: E2E_ORG_ID,
      emailAddress: 'blocked@other.com',
      role: 'org:candidate',
      appBaseUrl: 'http://localhost:5173',
    })
    expect(blocked.status).toBe('error')
    expect(blocked.errorMessage ?? '').toMatch(/email domain is not allowed/i)

    // Clearing the list restores open enrollment (backward compatible).
    await page.goto('/settings/allowed-domains')
    await page.locator('[data-testid="allowed-domains-input"]').fill('')
    await page.locator('[data-testid="save-allowed-domains-button"]').click()
    await expect(
      page.locator('[data-testid="allowed-domains-message"]'),
    ).toHaveText(/Domain restriction cleared/)

    const tenant = await callConvex(page, 'query', 'tenants:get', {
      clerkOrgId: E2E_ORG_ID,
    })
    expect(tenant.status).toBe('success')
    const value = tenant.value as { allowedEmailDomains?: string[] }
    expect(value.allowedEmailDomains ?? []).toEqual([])
  })

  test('non-admin roles cannot set allowed email domains', async ({ page }) => {
    await signInWithClerk(
      page,
      E2E_COORDINATOR_EMAIL,
      E2E_COORDINATOR_PASSWORD,
      E2E_ORG_ID,
      'org:coordinator',
    )

    const result = await callConvex(
      page,
      'mutation',
      'tenants:setAllowedEmailDomains',
      {
        clerkOrgId: E2E_ORG_ID,
        domains: ['example.com'],
      },
    )
    expect(result.status).toBe('error')
    expect(result.errorMessage ?? '').toMatch(/required one of/i)

    // The settings page itself is guarded for admins only.
    await page.goto('/settings/allowed-domains')
    await expect(
      page.locator('[data-testid="allowed-domains-input"]'),
    ).toHaveCount(0)
  })
})
