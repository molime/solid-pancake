import { expect, test, type Page } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  signInWithClerk,
  signOut,
} from './helpers/auth'
import { e2eCredentialsAvailable, mockE2EEnabled } from './helpers/env'

// Feature-level QA for the final batch (HR home KPI links, recruiter-notes
// persistence, account page email + dark Clerk card, ARC breadcrumb/sidebar
// rename, photo-ID type labels on the candidate review page). Serial — the
// notes test leaves and restores shared candidate state.

const AUTH_TIMEOUT = 300_000

async function signInAsAdmin(page: Page) {
  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID, 'org:admin')
}

test.describe('final batch QA', { tag: '@auth' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!e2eCredentialsAvailable() && !mockE2EEnabled()) {
      assertE2ECredentialsConfigured()
    }
  })

  // ---- 1. HR Home: KPI card links + wide pipeline card ----------------------
  test('hr home: KPI cards link to their consoles, pipeline card spans wide', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/hr')
    await expect(page.getByText('Candidate pipeline')).toBeVisible({ timeout: 30000 })

    const kpis: Array<{ label: string; href: string }> = [
      { label: 'In pipeline', href: '/hr/candidates' },
      { label: 'Active employees', href: '/hr/employees' },
      { label: 'Expiring credentials', href: '/compliance' },
      { label: 'Open cases', href: '/hr/cases' },
    ]
    for (const kpi of kpis) {
      const link = page.getByRole('link', { name: new RegExp(kpi.label) }).first()
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', kpi.href)
    }
    // Click-through one of them to prove the navigation works.
    await page.getByRole('link', { name: /In pipeline/ }).first().click()
    await expect(page).toHaveURL(/\/hr\/candidates/, { timeout: 15000 })
    await page.goto('/hr')

    // The pipeline card spans two columns at desktop width: check the
    // col-span class and that it is measurably wider than a KPI card.
    const pipelineCard = page
      .getByText('Candidate pipeline')
      .first()
      .locator('xpath=ancestor::*[contains(@class,"col-span")][1]')
    await expect(pipelineCard).toHaveClass(/col-span-2/)
    const kpiCard = page.getByRole('link', { name: /In pipeline/ }).first()
    const [pipelineBox, kpiBox] = await Promise.all([
      pipelineCard.boundingBox(),
      kpiCard.boundingBox(),
    ])
    expect(pipelineBox).toBeTruthy()
    expect(kpiBox).toBeTruthy()
    expect(pipelineBox!.width).toBeGreaterThan(kpiBox!.width * 1.5)
    await signOut(page)
  })

  // ---- 2. Recruiter notes CRUD ----------------------------------------------
  test('recruiter notes: save via button, persists across navigation, delete works', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/hr/candidates')

    const firstRow = page.locator('[data-testid^="candidate-row-"]').first()
    await expect(firstRow).toBeVisible({ timeout: 30000 })
    await firstRow.locator('a[href^="/hr/candidates/"]:not([href$="/hire"])').first().click()
    await expect(page).toHaveURL(/\/hr\/candidates\/[^/]+$/, { timeout: 15000 })
    const reviewUrl = page.url()

    const notesCard = page.getByTestId('candidate-notes')
    await expect(notesCard).toBeVisible({ timeout: 30000 })

    const noteText = `QA final-batch note ${Date.now()}`
    await page.getByTestId('new-note-input').fill(noteText)
    await page.getByTestId('save-note-button').click()
    // The new note appears in the list (explicit save, no autosave).
    const savedNote = notesCard.locator('li', { hasText: noteText })
    await expect(savedNote).toBeVisible({ timeout: 15000 })

    await page.goto('/hr/candidates')
    await page.goto(reviewUrl)
    await expect(notesCard).toBeVisible({ timeout: 30000 })
    await expect(notesCard.locator('li', { hasText: noteText })).toBeVisible({ timeout: 15000 })

    // Delete it (leaves clean state).
    const noteId = (await savedNote.getAttribute('data-testid'))!.replace('candidate-note-', '')
    await page.getByTestId(`delete-note-${noteId}`).click()
    const confirm = page.getByRole('button', { name: /delete/i }).last()
    await expect(confirm).toBeVisible({ timeout: 10000 })
    await confirm.click()
    await expect(notesCard.locator('li', { hasText: noteText })).toHaveCount(0, { timeout: 15000 })
    await signOut(page)
  })

  // ---- 3. Account page: email card + dark Clerk UserProfile ------------------
  test('account page shows the signed-in email and a dark-themed Clerk profile', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/account')
    await expect(page.getByTestId('account-email')).toHaveText(E2E_ADMIN_EMAIL, { timeout: 30000 })

    // Clerk's UserProfile renders asynchronously; it must pick up the Atria
    // dark theme (colorBackground #11171a, colorText #f2f6f7), not Clerk's
    // default white card. Probe computed styles — class names vary between
    // Clerk versions, so walk up from a known heading to the themed card.
    const profileHeading = page.getByRole('heading', { name: 'Profile details' })
    await expect(profileHeading).toBeVisible({ timeout: 45000 })
    const probe = await profileHeading.evaluate((el) => {
      const headingColor = getComputedStyle(el).color
      let node: HTMLElement | null = el.parentElement
      let cardBg = ''
      while (node) {
        const bg = getComputedStyle(node).backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          cardBg = bg
          break
        }
        node = node.parentElement
      }
      return { headingColor, cardBg }
    })
    expect(probe.headingColor).toBe('rgb(242, 246, 247)')
    expect(probe.cardBg).toBe('rgb(17, 23, 26)')
    await signOut(page)
  })

  // ---- 4. ARC breadcrumb + sidebar label --------------------------------------
  test('ARC rename: topbar breadcrumb and sidebar both read Audit Ready Center', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)
    await page.goto('/audit')
    await expect(page.getByRole('heading', { name: 'Audit Ready Center' })).toBeVisible({ timeout: 30000 })

    // Breadcrumb lives in the topbar (header[role=banner]).
    const breadcrumb = page.getByRole('banner').getByText('Audit Ready Center', { exact: true })
    await expect(breadcrumb).toBeVisible()
    // And it must not still say the old bare "Audit" crumb.
    await expect(
      page.getByRole('banner').getByText('Audit', { exact: true }),
    ).toHaveCount(0)

    const sidebarLink = page.getByRole('link', { name: 'Audit Ready Center', exact: true })
    await expect(sidebarLink).toBeVisible()
    await signOut(page)
  })

  // ---- 5. Passport label on the review page -----------------------------------
  test('candidate review: photo-ID row shows its type label or the plain fallback', async ({ page }) => {
    test.setTimeout(AUTH_TIMEOUT)
    await signInAsAdmin(page)

    // Dev data: no candidate photo_id carries photoIdType (verified in the
    // documentArchiveItems table), so this exercises the plain fallback. The
    // candidate id below ("Juan Sancho", applied) has a photo_id document.
    // If dev data changes, the typed branch asserts the type label instead.
    await page.goto('/hr/candidates/mx7adspwkvsc7935c5z0xkvptn8bhj0a')
    await expect(page.getByTestId('candidate-notes')).toBeVisible({ timeout: 45000 })

    const typedLabel = page.getByText(/Photo identification — (Passport|Driver's License|Foreign Passport)/)
    const plainLabel = page.getByText('Photo identification', { exact: true })
    if (await typedLabel.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.warn(`Photo-ID type label rendered: ${(await typedLabel.first().textContent())?.trim()}`)
    } else if (await plainLabel.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.warn('Note: no dev candidate photo-ID carries photoIdType — verified the plain "Photo identification" fallback renders instead (data-dependent).')
    } else {
      throw new Error('Neither the typed photo-ID label nor the plain fallback rendered on the review page.')
    }
    await signOut(page)
  })
})
