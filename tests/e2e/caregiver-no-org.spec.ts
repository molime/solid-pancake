import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
} from './helpers/auth'
import {
  callConvexQuery,
  findClerkUserId,
  resetE2ECandidate,
} from './helpers/seed'
import { mockE2EEnabled } from './helpers/env'

// Caregivers must NOT be Clerk org members (Clerk's Standard plan caps orgs
// at 20 members). Remove the fixture caregiver's org membership so their JWT
// carries no org_id and the app must resolve their tenant via tenantMembers.
async function removeCaregiverFromClerkOrg(): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to manage E2E org membership.')
  }
  const caregiverUserId = await findClerkUserId(E2E_CAREGIVER_EMAIL)
  const response = await fetch(
    `https://api.clerk.com/v1/organizations/${E2E_ORG_ID}/memberships/${caregiverUserId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json',
      },
    },
  )
  // 404 means the caregiver is already not a member — the desired state.
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Could not remove caregiver from Clerk org: ${response.status}`,
    )
  }
}

test.describe('caregiver auth without Clerk org membership', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(assertE2ECredentialsConfigured)

  test.beforeEach(async ({ page }) => {
    test.skip(
      mockE2EEnabled(),
      'Requires live Clerk org membership semantics.',
    )
    // Seed the tenantMembers record (org:caregiver) and completed platform
    // training, then strip the caregiver's Clerk org membership.
    await resetE2ECandidate(page)
    await removeCaregiverFromClerkOrg()
  })

  test('caregiver with no org membership signs in and lands on the Today page', async ({
    page,
  }) => {
    await signInWithClerk(
      page,
      E2E_CAREGIVER_EMAIL,
      E2E_CAREGIVER_PASSWORD,
      E2E_ORG_ID,
      'org:caregiver',
    )

    // The root route redirects caregivers to their Today page; the tenant is
    // resolved from tenantMembers (getMyTenant), not from a Clerk org claim.
    await page.goto('/')
    await expect(page).toHaveURL(/caregiver\/today/, { timeout: 30000 })
    await expect(page).not.toHaveURL(/select-agency/)
    await expect(
      page.getByText(/Good (morning|afternoon|evening)|No shifts assigned/),
    ).toBeVisible({ timeout: 30000 })
  })

  test('caregiver with no org membership cannot read another tenant', async ({
    page,
  }) => {
    await signInWithClerk(
      page,
      E2E_CAREGIVER_EMAIL,
      E2E_CAREGIVER_PASSWORD,
      E2E_ORG_ID,
      'org:caregiver',
    )

    const token = await extractClerkToken(page)
    if (!token) {
      throw new Error('Could not extract caregiver session token.')
    }

    // The tenant resolves from the tenantMembers record, not the JWT.
    // getMyTenant returns every tenant the user belongs to (array).
    const myTenants = (await callConvexQuery(
      token,
      'candidates:getMyTenant',
      {},
    )) as Array<{ clerkOrgId?: string }> | null
    expect(myTenants?.[0]?.clerkOrgId).toBe(E2E_ORG_ID)

    // Requests scoped to another tenant are rejected: the member record's
    // tenant does not match the requested clerkOrgId.
    const crossTenant = (await callConvexQuery(token, 'members:me', {
      clerkOrgId: 'org_some_other_tenant',
    })) as { status?: string; errorMessage?: string }
    expect(crossTenant.status).toBe('error')
    expect(crossTenant.errorMessage ?? '').toContain(
      'not a member of this tenant',
    )
  })
})
