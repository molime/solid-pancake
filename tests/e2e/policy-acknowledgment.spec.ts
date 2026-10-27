import { expect, test, type Page } from '@playwright/test'
import {
  E2E_CANDIDATE_EMAIL,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
} from './helpers/auth'
import { callConvexMutation, callConvexQuery } from './helpers/seed'
import {
  acknowledgePoliciesIfPresent,
  policyAcknowledgmentDialog,
} from './helpers/policyModal'

/**
 * Coverage for the blocking staff-policy acknowledgment modal
 * (src/shared/legal/PolicyAcknowledgmentModal.tsx).
 *
 * Acknowledgments persist per (tenant, user, policy version) in the shared
 * dev Convex deployment, and every other @auth spec acknowledges the fixture
 * staff users before this file runs (alphabetical order, workers: 1). To keep
 * "the modal appears" deterministic, this spec logs in as a FRESH Clerk admin
 * user (guaranteed to have all 4 policies pending), provisions its tenant
 * membership through the app's own public `members:sync` mutation, and cleans
 * the Clerk user up afterwards.
 */

const POLICY_ADMIN_EMAIL = `e2e.policy.admin.${Date.now()}@gmail.com`
const POLICY_ADMIN_PASSWORD = 'e2e-policy-admin-pass-123'

let policyAdminUserId: string | null = null
let evictedCandidateMembership = false

async function clerkFetch(path: string, method = 'GET', body?: object) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('CLERK_SECRET_KEY not set')
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const responseText = await response.text()
  let json
  try {
    json = JSON.parse(responseText)
  } catch {
    json = responseText
  }
  return { ok: response.ok, status: response.status, json }
}

async function listOrgMemberships() {
  const res = await clerkFetch(
    `/organizations/${E2E_ORG_ID}/memberships?limit=100`,
  )
  return (res.json as { data?: Array<{ id: string; role: string; public_user_data?: { identifier?: string; user_id?: string } }> })
    .data ?? []
}

async function evictOneOrgSeat() {
  // Free a Clerk org seat, preferring stale users left by interrupted runs of
  // this spec; fall back to the fixture candidate membership, which is
  // restored in afterAll (the candidate auth path also works with no org
  // membership, via its tenantMembers record).
  const memberships = await listOrgMemberships()
  const stale = memberships.find((m) =>
    (m.public_user_data?.identifier ?? '').includes('e2e.policy.admin.'),
  )
  const candidate = memberships.find(
    (m) =>
      (m.public_user_data?.identifier ?? '').toLowerCase() ===
      E2E_CANDIDATE_EMAIL.toLowerCase(),
  )
  const victim = stale ?? candidate
  if (!victim) throw new Error('No evictable org membership to free a seat.')
  const del = await clerkFetch(
    `/organizations/${E2E_ORG_ID}/memberships/${victim.id}`,
    'DELETE',
  )
  if (!del.ok) throw new Error(`Could not evict org membership: ${del.status}`)
  if (victim === candidate) evictedCandidateMembership = true
}

async function createPolicyAdminUser() {
  const create = await clerkFetch('/users', 'POST', {
    email_address: [POLICY_ADMIN_EMAIL],
    password: POLICY_ADMIN_PASSWORD,
    skip_password_checks: true,
    skip_password_requirement: true,
    public_metadata: { atriaRole: 'admin' },
  })
  if (!create.ok) {
    throw new Error(
      `Could not create policy admin user: ${create.status} ${JSON.stringify(create.json)}`,
    )
  }
  policyAdminUserId = (create.json as { id: string }).id

  let add = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships`, 'POST', {
    user_id: policyAdminUserId,
    role: 'org:admin',
  })
  if (!add.ok && add.status === 422) {
    // Clerk dev orgs cap at 5 members; free one seat and retry.
    await evictOneOrgSeat()
    add = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships`, 'POST', {
      user_id: policyAdminUserId,
      role: 'org:admin',
    })
  }
  if (!add.ok) {
    throw new Error(
      `Could not add policy admin to org: ${add.status} ${JSON.stringify(add.json)}`,
    )
  }
}

async function signInAsPolicyAdmin(page: Page) {
  const token = await clerkFetch('/sign_in_tokens', 'POST', {
    user_id: policyAdminUserId,
    expires_in_seconds: 600,
  })
  if (!token.ok) {
    throw new Error(`Could not create sign-in ticket: ${token.status}`)
  }
  const ticket = (token.json as { token: string }).token
  await page.goto(`/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`)
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

test.describe('staff policy acknowledgment modal', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    assertE2ECredentialsConfigured()
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is required for this spec.')
    }
    await createPolicyAdminUser()
  })

  test.afterAll(async () => {
    // Deleting the user also frees its org membership seat.
    if (policyAdminUserId) {
      await clerkFetch(`/users/${policyAdminUserId}`, 'DELETE').catch(() => {})
      policyAdminUserId = null
    }
    if (evictedCandidateMembership) {
      const users = await clerkFetch(
        `/users?query=${encodeURIComponent(E2E_CANDIDATE_EMAIL)}`,
      )
      const normalized = E2E_CANDIDATE_EMAIL.toLowerCase()
      const candidate = Array.isArray(users.json)
        ? (
            users.json as Array<{
              id: string
              email_addresses?: Array<{ email_address: string }>
            }>
          ).find((u) =>
            u.email_addresses?.some(
              (e) => e.email_address.toLowerCase() === normalized,
            ),
          )
        : undefined
      if (candidate) {
        await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships`, 'POST', {
          user_id: candidate.id,
          role: 'org:member',
          public_metadata: { atriaRole: 'candidate' },
        }).catch(() => {})
      }
      evictedCandidateMembership = false
    }
  })

  test('modal blocks the app until all policies are acknowledged and stays away after reload', async ({
    page,
  }) => {
    test.setTimeout(300_000)

    await signInAsPolicyAdmin(page)

    // Provision the tenant membership through the app's own public mutation
    // (same path a real newly invited org member uses), then land on the app.
    const convexToken = await extractClerkToken(page)
    if (!convexToken) throw new Error('Could not extract session token.')
    await callConvexMutation(convexToken, 'members:sync', {
      clerkOrgId: E2E_ORG_ID,
      clerkUserId: policyAdminUserId,
      role: 'org:admin',
      displayName: 'E2E Policy Admin',
      email: POLICY_ADMIN_EMAIL,
    })

    const pendingBefore = (await callConvexQuery(
      convexToken,
      'policies:getPendingAcknowledgments',
      { clerkOrgId: E2E_ORG_ID },
    )) as Array<{ key: string }>
    expect(pendingBefore).toHaveLength(4)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The blocking modal appears for the fresh staff admin.
    const dialog = policyAcknowledgmentDialog(page)
    await expect(dialog).toBeVisible({ timeout: 20000 })
    await expect(
      dialog.getByRole('heading', { name: 'Policy update — please review' }),
    ).toBeVisible()
    await expect(dialog.getByText('Policy 1 of 4')).toBeVisible()
    await expect(dialog.getByRole('checkbox')).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /I have read and agree/ }),
    ).toBeVisible()

    // Acknowledge all four policies through the gated flow.
    await acknowledgePoliciesIfPresent(page)

    // Modal is gone and the dashboard is usable.
    await expect(dialog).toHaveCount(0, { timeout: 20000 })
    const pendingAfter = (await callConvexQuery(
      convexToken,
      'policies:getPendingAcknowledgments',
      { clerkOrgId: E2E_ORG_ID },
    )) as Array<{ key: string }>
    expect(pendingAfter).toHaveLength(0)
    await expect(
      page.getByRole('button', { name: 'Sign out' }).first(),
    ).toBeVisible({ timeout: 20000 })

    // A full reload does not resurface the modal.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await expect(policyAcknowledgmentDialog(page)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Sign out' }).first(),
    ).toBeVisible({ timeout: 20000 })
  })
})
