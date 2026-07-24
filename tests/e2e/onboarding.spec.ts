import { test, expect } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CANDIDATE_EMAIL,
  E2E_CANDIDATE_PASSWORD,
  E2E_HR_EMAIL,
  E2E_HR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  extractClerkToken,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import {
  callConvexMutation,
  callConvexQuery,
  resetE2ECandidate,
} from './helpers/seed'

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


async function recreateE2ECandidate() {
  const email = E2E_CANDIDATE_EMAIL
  const password = E2E_CANDIDATE_PASSWORD
  if (!email || !password) return

  const search = await clerkFetch(`/users?query=${encodeURIComponent(email)}`)
  let userId: string | null = null
  if (search.ok && Array.isArray(search.json)) {
    const normalized = email.toLowerCase()
    const found = search.json.find((u: { email_addresses?: Array<{ email_address: string }> }) =>
      u.email_addresses?.some((e) => e.email_address.toLowerCase() === normalized),
    )
    if (found) userId = found.id
  }

  if (!userId) {
    const create = await clerkFetch('/users', 'POST', {
      email_address: [email],
      password,
      skip_password_checks: true,
      skip_password_requirement: true,
      public_metadata: { atriaRole: 'candidate' },
    })
    if (!create.ok) {
      const errorText = typeof create.json === 'string'
        ? create.json
        : JSON.stringify(create.json)
      throw new Error(
        `Could not recreate E2E candidate user: ${create.status} ${errorText}`,
      )
    }
    userId = create.json.id as string
  }

  const memberships = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships?limit=100`)
  const existing = memberships.json?.data?.find(
    (m: { public_user_data?: { user_id: string } }) => m.public_user_data?.user_id === userId,
  )
  if (!existing) {
    let add = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships`, 'POST', {
      user_id: userId,
      role: 'org:member',
      public_metadata: { atriaRole: 'candidate' },
    })
    if (!add.ok && add.status === 422) {
      // Clerk org quota hit; free one seat by removing the oldest non-admin member.
      const current = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships?limit=100`)
      const removable = current.json?.data?.find(
        (m: { role: string; id: string }) => m.role !== 'org:admin',
      )
      if (removable) {
        await clerkFetch(
          `/organizations/${E2E_ORG_ID}/memberships/${removable.id}`,
          'DELETE',
        )
        add = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships`, 'POST', {
          user_id: userId,
          role: 'org:member',
          public_metadata: { atriaRole: 'candidate' },
        })
      }
    }
    if (!add.ok) throw new Error('Could not recreate E2E candidate membership')
  }
}

async function deleteClerkUserByEmail(email: string) {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return

  const search = await fetch(
    `https://api.clerk.com/v1/users?query=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!search.ok) return

  const users = (await search.json()) as Array<{
    id: string
    email_addresses: Array<{ email_address: string }>
  }>
  const normalized = email.toLowerCase()
  const user = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === normalized),
  )
  if (!user) return

  await fetch(`https://api.clerk.com/v1/users/${user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secretKey}` },
  })
}


test.describe('onboarding candidate-to-caregiver', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    assertE2ECredentialsConfigured()
    // Ensure the fixture candidate Clerk user exists; the bypass test removes
    // it to free a Clerk org membership slot and this describe runs second.
    await recreateE2ECandidate()
  })

  let fixtureIds: Awaited<ReturnType<typeof resetE2ECandidate>>

  test.beforeEach(async ({ page }) => {
    fixtureIds = await resetE2ECandidate(page)
  })

  test('full lifecycle from submitted application to caregiver today', async ({
    page,
  }) => {
    // The seed already provides a candidate with a submitted application.
    // HR reviews and sends an offer.
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
    const hrToken = await extractClerkToken(page)
    if (!hrToken) throw new Error('Could not extract HR session token.')

    await callConvexMutation(hrToken, 'candidates:reviewApplication', {
      clerkOrgId: E2E_ORG_ID,
      candidateId: fixtureIds.candidateId,
      decision: 'approved',
      hrNotes: 'Approved for Phase 2 onboarding.',
    })

    await callConvexMutation(hrToken, 'candidates:sendOffer', {
      clerkOrgId: E2E_ORG_ID,
      candidateId: fixtureIds.candidateId,
    })

    const candidateAfterOffer = (await callConvexQuery(
      hrToken,
      'candidates:getCandidateDetail',
      { clerkOrgId: E2E_ORG_ID, candidateId: fixtureIds.candidateId },
    )) as { candidate?: { status: string } } | undefined
    expect(candidateAfterOffer?.candidate?.status).toBe('offer_sent')

    await signOut(page)

    // Candidate accepts the offer.
    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:candidate',
    )
    const candidateToken = await extractClerkToken(page)
    if (!candidateToken) {
      throw new Error('Could not extract candidate session token.')
    }
    await callConvexMutation(candidateToken, 'candidates:acceptOffer', {
      clerkOrgId: E2E_ORG_ID,
    })

    await signOut(page)

    // HR converts the accepted candidate to a caregiver.
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')
    const hireToken = await extractClerkToken(page)
    if (!hireToken) throw new Error('Could not extract HR session token.')
    const preHire = await callConvexQuery(hireToken, 'candidates:getCandidateDetail', {
      clerkOrgId: E2E_ORG_ID,
      candidateId: fixtureIds.candidateId,
    })

    await callConvexMutation(hireToken, 'candidates:hireCandidate', {
      clerkOrgId: E2E_ORG_ID,
      candidateId: fixtureIds.candidateId,
    })

    // Wait for the scheduled Clerk membership-role sync so the candidate token
    // reflects the new caregiver role before navigating to /caregiver/today.
    const candidateClerkUserId = (preHire as { candidate?: { clerkUserId?: string } } | undefined)
      ?.candidate?.clerkUserId
    if (!candidateClerkUserId) {
      throw new Error('Seeded candidate is missing clerkUserId.')
    }

    let roleSynced = false
    for (let i = 0; i < 60; i++) {
      const members = (await callConvexQuery(hireToken, 'members:list', {
        clerkOrgId: E2E_ORG_ID,
      })) as Array<{ clerkUserId: string; role: string }> | undefined
      if (
        Array.isArray(members) &&
        members.find(
          (m) =>
            m.clerkUserId === candidateClerkUserId &&
            m.role === 'org:caregiver',
        )
      ) {
        roleSynced = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    expect(roleSynced).toBe(true)

    await signOut(page)

    // The new caregiver completes platform training and lands on Today.
    await signInWithClerk(
      page,
      E2E_CANDIDATE_EMAIL,
      E2E_CANDIDATE_PASSWORD,
      E2E_ORG_ID,
      'org:caregiver',
    )
    // Bust any Convex React Query cache from the earlier candidate session so
    // members.me returns the new caregiver role.
    await page.reload()
    await page.waitForLoadState('networkidle')

    const trainingToken = await extractClerkToken(page)
    if (!trainingToken) {
      throw new Error('Could not extract caregiver session token.')
    }

    const beforeTraining = await callConvexQuery(
      trainingToken,
      'onboarding:hasPlatformTrainingCompleted',
      { clerkOrgId: E2E_ORG_ID },
    )
    expect(beforeTraining).toBe(false)

    await callConvexMutation(
      trainingToken,
      'onboarding:completePlatformTraining',
      { clerkOrgId: E2E_ORG_ID },
    )

    const afterTraining = await callConvexQuery(
      trainingToken,
      'onboarding:hasPlatformTrainingCompleted',
      { clerkOrgId: E2E_ORG_ID },
    )
    expect(afterTraining).toBe(true)

    await page.goto('/caregiver/today')
    await expect(page).toHaveURL(/caregiver\/today/)
    await page.waitForLoadState('networkidle')
    await expect(
      page
        .locator('text=No shifts assigned')
        .or(page.locator('text=Your visit today')),
    ).toBeVisible({ timeout: 15000 })
  })
})

test.describe('dev invitation bypass for restricted emails', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    assertE2ECredentialsConfigured()
    // The dev invitation bypass now frees a Clerk org membership seat automatically
    // when the 5-member quota is hit, so the fixture candidate is left in place.
  })

  const timestamp = Date.now()
  const bypassEmail = `e2e.bypass.candidate.${timestamp}@gmail.com`

  test.afterAll(async () => {
    await deleteClerkUserByEmail(bypassEmail)
  })

  test('invites a gmail.com candidate via dev bypass and signs in as candidate', async ({
    page,
    browser,
  }) => {
    await signInWithClerk(page, E2E_HR_EMAIL, E2E_HR_PASSWORD, E2E_ORG_ID, 'org:hr')

    await page.goto('/hr/candidates')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('invite-candidate-button').click()

    await page.getByTestId('candidate-name-input').fill('E2E Bypass Candidate')
    await page.getByTestId('candidate-email-input').fill(bypassEmail)
    await page.getByTestId('send-invitation-button').click()

    // Restricted (gmail) domains fall back to manual account setup; the modal
    // then shows the shareable sign-in link card.
    const manualCard = page.getByTestId('manual-setup-card')
    await expect(manualCard).toBeVisible({ timeout: 15000 })

    const magicLink = await manualCard.locator('a[href*="__clerk_ticket"]').getAttribute('href')
    if (!magicLink) {
      throw new Error('Manual account setup did not return a magic link.')
    }

    await signOut(page)
    await page.goto(magicLink)
    await page.waitForLoadState('networkidle')

    // Clerk may land on the agency selector after ticket redemption; choose the
    // seeded agency so onboarding can proceed.
    if (await page.locator('text=Select Agency').isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Diego's Agency/i }).click()
      await page.waitForLoadState('networkidle')
    }

    await expect(page).toHaveURL(/onboarding/)

    // The dev bypass adds the user as org:member; promote to org:candidate for portal access.
    const searchAfter = await clerkFetch(`/users?query=${encodeURIComponent(bypassEmail)}`)
    const bypassUserId =
      searchAfter.json?.find(
        (u: { email_addresses?: Array<{ email_address: string }>; id: string }) =>
          u.email_addresses?.some(
            (e) => e.email_address.toLowerCase() === bypassEmail.toLowerCase(),
          ),
      )?.id ?? null

    const membershipsAfter = await clerkFetch(`/organizations/${E2E_ORG_ID}/memberships?limit=100`)
    const bypassMembership = membershipsAfter.json?.data?.find(
      (m: { public_user_data?: { user_id: string }; id: string }) =>
        m.public_user_data?.user_id === bypassUserId,
    )
    if (bypassMembership) {
      await clerkFetch(
        `/organizations/${E2E_ORG_ID}/memberships/${bypassMembership.id}`,
        'PATCH',
        { role: 'org:candidate' },
      )
    }

    // Allow Convex member role cache to sync.
    await page.waitForTimeout(2500)

    // Seed realistic application/offer details for visual regression via a
    // separate admin browser context so the candidate session stays intact.
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await signInWithClerk(adminPage, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
    const adminToken = await adminPage.evaluate(async () => {
      const clerk = (window as unknown as { Clerk?: { session?: { getToken: (o: { template: string }) => Promise<string | null | undefined> } } }).Clerk
      if (!clerk?.session) throw new Error('No Clerk session')
      const t = await clerk.session.getToken({ template: 'convex' })
      if (!t) throw new Error('No Convex token')
      return t
    })
    await callConvexMutation(adminToken, 'seed:seedCandidateOffer', {
      clerkOrgId: E2E_ORG_ID,
      candidateEmail: bypassEmail,
    })
    await adminContext.close()
    await page.waitForTimeout(1000)

    // Visual capture using client-side navigation so we don't lose Clerk session state.
    const capture = async (url: string, name: string) => {
      await page.evaluate((u) => {
        window.history.pushState({}, '', u)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, url)
      await page.waitForTimeout(800)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: `test-results/${name}.png`, fullPage: true })
    }

    await capture('/onboarding/checklist', 'candidate-checklist')
    await capture('/apply', 'candidate-application')
    await capture('/onboarding/status', 'candidate-status')
    await capture('/onboarding/upload/photo_id', 'candidate-documents')
    await capture('/onboarding/acknowledgment', 'candidate-acknowledgment')
    await capture('/onboarding/offer', 'candidate-offer')
    await capture('/onboarding/training', 'candidate-training')
    await capture('/onboarding/profile', 'candidate-profile')
  })
})
