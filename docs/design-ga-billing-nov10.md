# Golden Ages billing and access recovery

Date: 2026-11-10 to 2026-11-11
Scope: Golden Ages Home Care subscription billing, payment reminders, recurring card setup, and tenant access. Phase 4 is explicitly out of scope.

## Reported problems

- Golden Ages was suspended and shown the full-screen `Access suspended` notice even though Samira had paid.
- Samira received a reminder that implied a 14-day payment window. The agreed rule is invoices due on the 1st, with suspension only after the 5th.
- Paying an old hosted invoice did not establish a reusable default payment method for later automatic charges.
- Old invoices and Stripe drafts made it difficult to tell which balance was real.

## Evidence and reproduction

1. Stripe live invoice `in_1UYyIyLa0L3ZQ9PICjh9P4bt` confirms the current $249 payment was completed on 2026-11-09. Convex invoice `PLAT-2026-0009` is also `paid`.
2. `PLAT-2026-0002` ($199, due 2026-09-01) and `PLAT-2026-0004` ($249, due 2026-10-15) were stale unpaid records. They were voided during the production cleanup.
3. The daily overdue query selected invoices by `dueDate` and positive `total`, but did not exclude `paid` or `void`. It then rewrote every selected row to `overdue` and moved the subscription back to `past_due`. This means voiding the old invoices without patching the cron would not stop the next suspension cycle.
4. The new regression test `never revives past-due paid or void invoices` failed before the patch with `processed: 1`; it passes after the terminal-status guard.
5. A second reproduction showed that a late `invoice.payment_failed` event for a void invoice could also dun the tenant. The new webhook regression test failed before its guard and passes after it.
6. Stripe shows no attached payment methods and no customer default payment method for Golden Ages. The one-off card used for the November payment is detached and cannot be assumed reusable. Convex held a stale local reference to that card.
7. `SMOKE_ONLY=agency-admin SMOKE_AUTH=ticket node scripts/prod-smoke.mjs` passed the real production admin login after reactivation.
8. The repeat-notice regression reproduced one mocked Resend call for an already-suspended tenant. After treating both `past_due` and `suspended` as already in dunning, the focused suite passes without a notice for that tenant.

## Root causes

- The overdue cron treated terminal invoices as collectible, allowing old paid or void rows to re-enter dunning and suspension.
- A suspended subscription was not treated as already in dunning for notification purposes, so the daily overdue pass could send repeat reminders.
- The failure webhook calculated its window from each failure event rather than anchoring it to the invoice due date, allowing retries to move the final payment deadline.
- Monthly invoice creation used Net-14 due dates rather than the agreed first-of-month rule.
- The local subscription recorded a default card that Stripe did not have attached or configured as default.
- A one-off hosted invoice payment is not a reliable recurring-card setup. The hosted Checkout setup flow is the correct path because it attaches the method, sets it as the Stripe customer default, and only then saves it in Convex.

## Considered solutions

### Option 1: production data cleanup only

Reactivate Golden Ages, void stale invoices, and manually clear the stale card reference.

- Advantages: smallest immediate change.
- Rejected: the next overdue cron would revive the void invoices and suspend the tenant again. It also leaves the Net-14 behavior and future data consistency risks unchanged.

### Option 2: minimal lifecycle guards plus targeted reconciliation

Keep the existing invoice and subscription architecture. Add terminal-status guards, use the agreed due dates, clear only the observed stale card reference, and use the existing Stripe setup-link flow for recurring billing.

- Advantages: fixes the actual recurrence paths, preserves existing behavior for valid unpaid invoices, requires no schema change, and is covered by focused regression tests.
- Chosen.

A full rewrite to native Stripe Subscriptions was rejected as unnecessary and too risky for this incident.

## Implementation stages and task list

### Stage 1: reproduce and lock down the lifecycle rules

- [x] Reconcile Golden Ages invoices in Convex and Stripe.
- [x] Reproduce paid and void invoices being revived by the overdue cron.
- [x] Reproduce a void invoice entering dunning through a late failure event.
- [x] Add regression coverage for both paths.
- [x] Keep valid past-due sent invoices and unmirrored positive drafts covered by the existing tests.

### Stage 2: apply minimal backend fixes

- [x] Skip `paid` and `void` invoices in `checkOverdueSubscriptionInvoices`.
- [x] Ignore `invoice.payment_failed` for `paid` and `void` invoices.
- [x] Suppress repeat overdue notices for subscriptions already in `past_due` or `suspended`.
- [x] Set monthly due dates to the subscription period end, which is the 1st of the next month.
- [x] Store those due dates as `YYYY-MM-DD` even when the subscription period uses a full ISO timestamp. A direct `runMonthlyBilling` regression failed before the normalization and passes after it.
- [x] Anchor both webhook and cron dunning dates to the invoice due date, using four full days after its end-of-day. Repeated failures cannot extend the maximum payment date beyond the 5th.
- [x] Add a compare-and-clear internal mutation for stale local card references. The expected-value check prevents it from deleting a newly configured card if the setup webhook completes first.

### Stage 3: repair Golden Ages production data

- [x] Mark the real November payment as paid in Convex.
- [x] Void the stale `PLAT-2026-0002` and `PLAT-2026-0004` invoices.
- [x] Reactivate Golden Ages.
- [x] Send a fresh hosted Stripe payment-setup request to the existing billing contact. No repeated reminder emails are part of testing.
- [x] Clear the stale local card reference with the guarded mutation. The mutation returned `true`, confirming that it cleared the observed stale value.
- [x] Delete only the two verified obsolete, unlinked Stripe draft invoices. Stripe confirmed both deletions, and its remaining Golden Ages invoices are two paid invoices and one void invoice.

Until Samira completes the setup link, recurring automatic charging is not considered verified. With the stale reference cleared, the next invoice safely uses the normal hosted-invoice email flow instead of attempting to charge a detached card. Completing the link attaches the new method, sets the Stripe default, saves it in Convex, and enables automatic charging for later invoices.

### Stage 4: verification and rollout

- [x] Run the focused Stripe and platform regression suites: 46 plus 60 tests passed.
- [x] Run TypeScript type checking, lint, the secret scan, and the frontend production build.
- [x] Run the complete unit suite: 150 files and 1,560 tests passed. The final date-normalization change was also covered by the separate 60-test platform run above.
- [x] Run the production smoke checks after the final backend deploy: the targeted admin run passed 3 of 3 checks and the all-role run passed 5 of 5.
- [x] Run the overdue and suspension mutations once in production. The overdue pass skipped the three terminal Golden Ages invoices, and the suspension pass returned `suspended: 0`.
- [x] Verify the final Golden Ages records: subscription `active`, both stale invoices `void`, both genuine payments `paid`, and no stale card reference.
- [x] Verify in a real browser after the cron runs that neither `Access suspended` nor `Payment required` appears and the admin workspace renders.
- [x] Commit only the scoped backend, test, and documentation changes, push as `molime`, deploy Convex production, and verify the final live state.

## Expected behavior after rollout

- Old paid or void invoices cannot create a new overdue state, reminder, or suspension.
- New monthly invoices are due on the 1st. Suspension can occur only after the payment window ending on the 5th has expired.
- A valid unpaid invoice still follows the existing banner, dunning, and suspension flow.
- Paying a valid overdue invoice still restores access automatically.
- Golden Ages remains active because its genuine current invoice is paid and its stale invoices are void.
- Recurring auto-charge starts only after a valid payment method is attached through the hosted setup flow. No claim of completed recurring setup is made before that external step occurs.

## Files changed in this final fix

- `convex/platform.ts`: monthly due dates normalized to `YYYY-MM-DD`.
- `convex/platform.test.ts`: direct monthly-cron coverage for ISO subscription periods.
- `convex/platformStripe.ts`: terminal-invoice guards, fixed dunning dates, repeat-notice suppression, and guarded stale-card cleanup.
- `convex/stripe.test.ts`: regression tests for cron, webhook, reminder, and compare-and-clear behavior.
- `convex/crons.ts` and `convex/http.ts`: billing-rule comments aligned with the implementation.
- `src/app/shell/BillingNoticeBanner.tsx` and its test: suspension copy aligned with the 5th-of-month rule.
- `src/features/support/faqData.ts`: support answer aligned with the same rule.
- `docs/design-ga-billing-nov10.md`: this design and verification record.

Earlier commits in the same incident changed `convex/platform.ts` for first-of-month due dates and fixed Stripe invoice creation by removing the invalid `payment_settings[save_default_payment_method]` parameter.
