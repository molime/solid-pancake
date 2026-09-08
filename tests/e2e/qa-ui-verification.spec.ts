// Unauthenticated browser-level QA for recent UI changes:
//   1. Sign-in page: AtriaLogo, 3 portal pill tabs, redirect-param-driven subtitle
//   2. Tab clicks update ?redirect= and the subtitle, active tab gets bg-atria-accent
//   3. /apply: invalid-link state without ?agency=, full form with a real agency,
//      sessionStorage 'atriax_apply_position' written on submit and surviving
//      navigation to the sign-in page
//   4. ProgressSteps: only rendered on /onboarding/application (auth-gated), so it
//      is skipped here with an explicit reason.
// NOT tagged @auth — runs without Clerk E2E credentials.
import { test, expect } from '@playwright/test'

// Public apply link for an agency seeded in the dev Convex deployment with two
// branches (ILS/SLS), so both the branch picker and the position select render.
// Discovered via the public agencyConfig:getPublicAgencyInfo query.
const AGENCY_SLUG = 'diego-s-agency-1779273753437877327'

function redirectParam(url: string): string | null {
  return new URL(url).searchParams.get('redirect')
}

test.describe('QA UI verification (unauthenticated)', () => {
  test('sign-in page renders logo, 3 portal tabs, and no subtitle by default', async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await expect(page.getByRole('img', { name: 'ATRIA-X' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Candidate Portal', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'HR Portal', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Staff Portal', exact: true }),
    ).toBeVisible()

    // Default redirect is /select-agency, which maps to no product label, so
    // no subtitle paragraph and no active tab.
    await expect(page.locator('p', { hasText: 'Portal' })).toHaveCount(0)
    for (const label of ['Candidate Portal', 'HR Portal', 'Staff Portal']) {
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).not.toHaveClass(/bg-atria-accent/)
    }
  })

  test('portal tabs update redirect param, subtitle, and active styling', async ({
    page,
  }) => {
    await page.goto('/sign-in')

    const cases = [
      { label: 'HR Portal', redirect: '/hr' },
      { label: 'Staff Portal', redirect: '/coordinator/review' },
      { label: 'Candidate Portal', redirect: '/onboarding' },
    ]

    for (const { label, redirect } of cases) {
      const tab = page.getByRole('button', { name: label, exact: true })
      await tab.click()
      await expect(page).toHaveURL(/redirect=/)
      expect(redirectParam(page.url())).toBe(redirect)
      // Subtitle paragraph under the logo (tabs are <button>, subtitle is <p>).
      await expect(
        page.locator('p').filter({ hasText: new RegExp(`^${label}$`) }),
      ).toBeVisible()
      await expect(tab).toHaveClass(/bg-atria-accent/)
      await expect(tab).toHaveClass(/text-atria-on-accent/)
    }
  })

  test('/apply without agency param shows invalid-link state', async ({
    page,
  }) => {
    await page.goto('/apply')
    await expect(
      page.getByRole('heading', { name: 'Invalid application link' }),
    ).toBeVisible()
    await expect(page.getByRole('img', { name: 'ATRIA-X' })).toBeVisible()
    // clearSessionData() runs on load.
    const position = await page.evaluate(() =>
      window.sessionStorage.getItem('atriax_apply_position'),
    )
    expect(position).toBeNull()
  })

  test('/apply form writes atriax_apply_position on submit; key survives navigation', async ({
    page,
  }) => {
    await page.goto(`/apply?agency=${AGENCY_SLUG}`)
    await expect(
      page.getByRole('heading', { name: /Apply to join/i }),
    ).toBeVisible({ timeout: 30000 })

    await page.locator('#fullName').fill('QA UI Verify')
    await page.locator('#email').fill('qa.ui.verify@atriax.example.com')
    await page.locator('#phone').fill('(555) 123-4567')

    // Two branches are configured, so pick one to reveal the position select.
    await page
      .locator(
        'xpath=//p[contains(.,"Which branch are you applying to?")]/following-sibling::div//button[1]',
      )
      .click()

    const positionSelect = page.locator('#applyPosition')
    await expect(positionSelect).toBeVisible({ timeout: 15000 })
    const positionValue = await positionSelect
      .locator('option')
      .nth(1)
      .getAttribute('value')
    expect(positionValue).toBeTruthy()
    await positionSelect.selectOption(positionValue!)

    // Abort the Convex action so no real candidate account is created; the
    // sessionStorage keys are written synchronously before the network call.
    await page.route('**/api/action*', (route) => route.abort())

    await page.getByRole('button', { name: /Start application/i }).click()

    await expect
      .poll(async () =>
        page.evaluate(() =>
          window.sessionStorage.getItem('atriax_apply_position'),
        ),
      )
      .toBe(positionValue)
    const slug = await page.evaluate(() =>
      window.sessionStorage.getItem('atriax_apply_slug'),
    )
    expect(slug).toBe(AGENCY_SLUG)

    // sessionStorage persists per-tab across same-origin navigations.
    await page.goto('/sign-in')
    await expect(page.getByRole('img', { name: 'ATRIA-X' })).toBeVisible()
    const persisted = await page.evaluate(() =>
      window.sessionStorage.getItem('atriax_apply_position'),
    )
    expect(persisted).toBe(positionValue)
  })

  test('ProgressSteps layout checks', async ({ page }, testInfo) => {
    // ProgressSteps (src/shared/ui/ProgressSteps.tsx) is only used by
    // ApplicationFormPage at /onboarding/application, which sits behind
    // TenantRoleRouteGuard (org:candidate) — unauthenticated visitors are
    // redirected to /sign-in, so the stepper is unreachable without Clerk
    // E2E credentials. The 32px circle / overflow-x-auto checks live in the
    // @auth-tagged tests/e2e/qa-candidate-portal.spec.ts (QA item 3).
    testInfo.annotations.push({
      type: 'skip-reason',
      description:
        'ProgressSteps only renders on auth-gated /onboarding/application; not reachable unauthenticated.',
    })
    test.skip(
      true,
      'ProgressSteps only renders on auth-gated /onboarding/application; not reachable unauthenticated.',
    )
    await page.goto('/')
  })
})
