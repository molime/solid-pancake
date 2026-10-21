import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Helper for the blocking staff-policy acknowledgment modal
 * (src/shared/legal/PolicyAcknowledgmentModal.tsx, mounted in AppShell).
 *
 * DOM facts this helper relies on (no data-testids exist on the component,
 * so selectors are role/text/class based):
 * - One modal per pending policy, shown sequentially inside a single
 *   role="dialog" whose aria-label is "{policy title} acknowledgment".
 * - The scroll gate listens ONLY on the inner policy-text container
 *   (the div with class `max-h-[45vh] overflow-y-auto`, the component's
 *   scrollRef). Scrolling the outer `flex-1 overflow-y-auto` container
 *   does not lift the gate.
 * - The agreement checkbox is the single `input[type="checkbox"]` in the
 *   dialog, wrapped in a label with the "I have read and understood…" text.
 * - The agree button is the dialog's only button matching
 *   /I have read and agree/ ("…— next policy" for all but the last policy).
 * - Acknowledging the final pending policy unmounts the modal once the
 *   pending query refetches to an empty list.
 *
 * Known app bug this helper tolerates (reported, do not "fix" here):
 * the component tracks progress by INDEX into the live `pending` array,
 * which shrinks as each acknowledgment commits. With 3 policies, acking
 * policy 1 refetches pending to [2,3] while `index` is already 1, so the
 * modal shows policy 3 and skips policy 2; acking "policy 2 of 2" then
 * unmounts the modal with policy 2 still pending. It resurfaces on the
 * next full page load. The reload-and-recheck cycle below works around it
 * in tests; once the app tracks acknowledged policy KEYS instead of the
 * index (or snapshots the pending list), the extra reload is harmless.
 */

const MAX_MOUNTED_ACKS = 10
const MAX_RELOAD_CYCLES = 4

export function policyAcknowledgmentDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: / acknowledgment$/ })
}

/**
 * Acknowledges every pending staff policy when the blocking modal is up.
 * Safe to call unconditionally: it is a no-op when the modal is absent
 * (e.g. candidates on /onboarding, public routes, platform admin routes,
 * or users who already acknowledged every policy at its current version).
 */
export async function acknowledgePoliciesIfPresent(page: Page): Promise<void> {
  let sawModal = await acknowledgeMountedPolicies(page, 8000)
  if (!sawModal) {
    // The landing page may not mount the agency shell at all — platform
    // admins are bounced to /platform/* and candidates to /onboarding, while
    // the modal only renders inside the agency shell. Check the agency home
    // once before concluding there is nothing to acknowledge.
    const onAgencyHome = new URL(page.url()).pathname === '/'
    if (!onAgencyHome) {
      await page.goto('/').catch(() => {})
      await page.waitForLoadState('networkidle').catch(() => {})
      sawModal = await acknowledgeMountedPolicies(page, 5000)
    }
  }
  if (!sawModal) return // never saw a modal: pure no-op

  // The modal was up: verify the acknowledgment stuck. Because of the
  // index-into-shrinking-list bug documented above it can unmount with
  // policies still pending; reload so any remainder resurfaces and gets
  // acknowledged in the next cycle.
  for (let cycle = 0; cycle < MAX_RELOAD_CYCLES; cycle++) {
    await page.reload()
    await page.waitForLoadState('networkidle')
    const again = await acknowledgeMountedPolicies(page, 5000)
    if (!again) return
  }
  throw new Error(
    'Policy acknowledgment modal still present after reload cycles.',
  )
}

/**
 * Acknowledges every policy the currently mounted modal sequences through.
 * Returns true if any modal dialog appeared.
 */
async function acknowledgeMountedPolicies(
  page: Page,
  firstDetectionTimeoutMs: number,
): Promise<boolean> {
  for (let i = 0; i < MAX_MOUNTED_ACKS; i++) {
    const dialog = policyAcknowledgmentDialog(page).first()
    // First detection gets a longer window: the pending-acknowledgments query
    // may still be in flight right after landing; subsequent iterations only
    // wait for the next policy to render.
    const isPresent = await dialog
      .waitFor({
        state: 'visible',
        timeout: i === 0 ? firstDetectionTimeoutMs : 3000,
      })
      .then(() => true)
      .catch(() => false)
    if (!isPresent) return i > 0

    // Lift the scroll gate by jumping the inner policy-text container to the
    // bottom; the component's scroll listener then drops the scroll hint.
    const scrollBox = dialog.locator('div[class*="max-h-[45vh]"]').first()
    await scrollBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    // The "Scroll to read" hint only renders while the gate is down; it
    // detaching is the signal the scroll requirement lifted. Short policies
    // that need no scrolling render no hint at all, so this passes instantly.
    await expect(
      dialog.getByText('Scroll to read the full document'),
    ).toHaveCount(0, { timeout: 10000 })

    await dialog.getByRole('checkbox').check()
    const agreeButton = dialog.getByRole('button', {
      name: /I have read and agree/,
    })
    await expect(agreeButton).toBeEnabled({ timeout: 10000 })

    // Record the "Policy N of M" subtitle so we can tell the transition to the
    // next policy apart from the modal unmounting after the final policy.
    const progress = dialog.getByText(/Policy \d+ of \d+/)
    const before = await progress.textContent().catch(() => null)

    await agreeButton.click()

    await expect
      .poll(
        async () => {
          const current = policyAcknowledgmentDialog(page).first()
          if (!(await current.isVisible().catch(() => false))) return 'gone'
          return (await progress.textContent().catch(() => null)) ?? 'unknown'
        },
        { timeout: 15000 },
      )
      .not.toBe(before)
      .catch(() => {
        // If the poll times out (e.g. the click did not register), the loop
        // re-detects the modal state below instead of hanging forever.
      })
  }
  throw new Error(
    'Policy acknowledgment modal did not clear after maximum attempts.',
  )
}
