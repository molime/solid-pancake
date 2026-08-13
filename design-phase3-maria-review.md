# ATRIA-X Phase 3 — Maria's Review Corrections (meeting 2026-08-10)

Design doc for the 8 corrections. Source: Diego's notes `Correcciones Maria fase 3` + Gemini meeting notes.
Stack: React 19 + Vite 8 + TS, Tailwind 4, React Router 7, Clerk, Convex, Stripe (raw REST helpers, no SDK), Resend.

Guiding principles: surgical, additive, backward-compatible. All schema changes are optional fields or new tables — no data migration. No drive-by refactors. Multi-tenancy invariant: every Convex function touching tenant data goes through `authHelpers.ts` guards; platform functions go through `requirePlatformAdmin`.

---

## Stage plan (each stage ends with `npx convex codegen` + affected gates)

- **Stage 0 — this design doc.**
- **Stage 1 — schema deltas** (all additive changes in one pass).
- **Stage 2 — Item 1:** role-aware invitation emails.
- **Stage 3 — Item 2:** pricing plan models (flat / per-item / tiered) + soft-limit alerts.
- **Stage 4 — Item 3:** automatic recurring billing + one-time payment-setup link + dunning.
- **Stage 5 — Item 4:** remove platform-admin user CRUD.
- **Stage 6 — Items 5+6:** tenant health = technical errors only; Reports → Lost agencies + churn reason.
- **Stage 7 — Items 7+8:** nav consolidation + support tickets + FAQ groundwork.
- **Stage 8 — full gates:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npx convex codegen`.

---

## Item 1 — Invitation emails state the account/role type

Two send paths exist today:

1. `convex/invitations.ts` `create` — staff invites go through Clerk's own invitation email (`sendClerkInvitation`), whose copy is not controllable in code.
2. `convex/_utils/invitationBypass.ts` `createClerkUserAndJoinOrg` — platform-created users get a Resend email with fixed subject "Your ATRIA-X account is ready" (`candidateWelcomeEmailHtml`).

**Decision:** route staff invitations (coordinator, caregiver/employee) through the already-proven `createClerkUserAndJoinOrg` + Resend path with a role parameter, same as owner creation. This unifies all invite emails into one code-controlled template and avoids confusing double emails (Clerk invite + supplementary Resend email).

- `accountTypeLabel(role)` → "owner" / "coordinator" / "employee".
- Subject: `Your {label} account is ready`; body gets an explicit line: "Your {label} account for {agencyName} is ready."
- Owner emails additionally include the one-time payment-setup link (Item 3) when present.
- Candidate invitation path unchanged (out of scope for this correction).

---

## Item 2 — Custom pricing plans: per-item pricing, flat fee, tiers, limit alerts

### Data model (additive, `convex/schema.ts` `pricingPlans`)

- `model?: 'flat' | 'per_item' | 'tiered'` — absent = `flat` (current behavior, backward compatible).
- `perItemRates?: { perCandidate?: number, perShift?: number, perApplication?: number }` (dollars).
- `tiers?: Array<{ upTo: number, monthlyPrice: number }>` — evaluated in order by active-seat volume; first tier whose `upTo >= seats` wins; last tier is the catch-all.
- `alertThreshold?: number` — optional absolute usage threshold (seats) that triggers a soft alert.

`tenants.limits { maxSeats, maxCandidates, maxShiftsPerMonth }` already exists and is documented "soft — warnings only" but is read nowhere. This phase makes limits live as **soft caps**: reaching a limit notifies, never blocks.

### Billing math (`convex/platformBilling.ts` `computeInvoiceLineItems`)

- `flat` (default): current behavior — base = `customMonthlyRate ?? plan.basePrice`, plus per-seat overage beyond `includedSeats`.
- `per_item`: line items = period counts of candidates / shifts / applications × respective rates (only rates that are set produce lines; zero usage → zero lines).
- `tiered`: monthly price = tier lookup by active-seat count.

### Limit alerts

- New helper `computeLimitAlerts` (usage vs `tenants.limits` + plan `alertThreshold`).
- When usage crosses a configured limit/threshold: insert a deduped in-app `notifications` row for agency admins (dedupe per tenant + period via metadata check), and surface breach badges to platform admins in health/usage queries (computed on read). No emails, no hard blocks.

### UI

- `PlatformCreateAgencyPage`: plan model select, conditional rate/tier fields, alert threshold, allowed-payment-method radio (Item 3).
- Plan edit/manage later: existing `upsertPricingPlan` extended with the new fields (platform-admin only; self-service deferred).

**Addendum (2026-08-12, Diego's review):** the "Initial plan" picker was removed from agency creation — with per-agency pricing models it no longer made sense. Creation now upserts a per-agency plan keyed `agency-<slug>` (label `<name> plan`) before `createTenant` runs, carrying exactly the model chosen: flat → `basePrice` = the monthly flat fee asked in the form (no seat overage; `computeInvoiceLineItems` now skips the overage line when `perSeatPrice` is 0), per_item → the entered rates, tiered → the entered tiers. Shared plans (starter/professional/enterprise) are never rewritten at creation time, and later plan edits on the agency detail page only affect that agency's own plan.

---

## Item 3 — Automatic recurring billing + one-time payment setup + dunning

### Key decisions

- **Recurring billing:** keep `computeInvoiceLineItems` + `platformInvoices` as the source of truth. A monthly Convex cron creates the platform invoice per active subscription and, when a default payment method exists, creates the Stripe invoice with `collection_method: 'charge_automatically'` so Stripe auto-charges with zero Maria input. Stripe-native Subscriptions were rejected: per-item usage/tier pricing can't live in Stripe cleanly and it would fork the audit trail. Subscriptions without a payment method fall back to today's `send_invoice` email flow.
- **Payment setup:** hosted Stripe Checkout Session `mode=setup` — zero new frontend surface, `payment_method_types` restricted server-side to exactly the method Maria picked (`card` OR `us_bank_account`). SetupIntent + custom return page rejected as more surface for no gain.

### Data model (additive)

- `tenants`: `+ paymentMethodAllowed?: 'card' | 'us_bank_account'`, `+ churnedAt?: number`, `+ churnReason?: string` (churn fields used by Item 6).
- `tenantSubscriptions`: `+ stripeDefaultPaymentMethod?: string`, `+ pastDueSince?: number`, `+ graceUntil?: number`.

### Setup-link flow (agency creation)

```
Maria (platform UI)          Convex                         Stripe
      |  createTenant(plan, paymentMethodAllowed)
      |------------------->  createTenant action
      |                      creates Clerk org, tenant, seeds,
      |                      Stripe customer (best effort)
      |                      createPaymentSetupSession ------>  Checkout Session
      |                                                       mode=setup
      |                                                       payment_method_types=[allowed]
      |                      owner welcome email (Resend)
      |                      includes session.url
Owner clicks link ----------------------------------------->  hosted page: card or ACH
Stripe --------------- webhook checkout.session.completed ->  convex/http.ts
                              retrieve setup_intent.payment_method
                              setCustomerDefaultPaymentMethod
                              tenantSubscriptions.stripeDefaultPaymentMethod = pm_...
```

### Monthly auto-charge flow

```
crons.ts (monthly, 1st ~06:00 UTC)
  -> internal platform.runMonthlyBilling
       for each tenantSubscriptions status in (active, trialing)
         AND currentPeriodEnd <= now (period ended => due):
         createMonthlyPlatformInvoice:
           createPlatformInvoiceDoc (duplicate-period guard => idempotent)
           on success: roll subscription to next monthly period
             (currentPeriodStart = billed periodEnd,
              currentPeriodEnd = +1 month, renewsAt = new periodEnd)
             => next month's run bills the next period; same-day re-runs
                find the advanced (still-running) period and skip
         if stripeDefaultPaymentMethod:
           createAndSendStripeInvoice(collection_method='charge_automatically',
                                      default_payment_method=pm)
           Stripe finalizes + auto-charges
         else:
           existing send_invoice email flow (unchanged)
```

### Dunning flow (failed payments)

```
Stripe retries automatically (Smart Retries / account dunning settings)
  |
  |-- invoice.payment_failed --> convex/http.ts
  |      applyStripeInvoiceFailed:
  |        platformInvoice.status = 'overdue'
  |        subscription.status = 'past_due'
  |        pastDueSince = now, graceUntil = now + 7d   (recomputed, never stacked)
  |        platform audit entry
  |        Resend email to agency owner (failure notice, no PHI)
  |
  |-- invoice.paid --> existing applyStripeInvoicePaid
         + restore subscription 'active', clear pastDueSince/graceUntil
```

### Failed-payment / grace-period policy (documented)

- **Day 0:** charge fails → owner email via Resend; subscription `past_due`; invoice `overdue`.
- **Stripe Smart Retries** handle all retry attempts (configured in Stripe Dashboard — environment config, not code).
- **Day 7 (graceUntil):** grace window ends; tenant flagged prominently in platform UI (past-due state already renders via `PlatformStatusPill`; health/subscription views show the badge).
- **Day 14:** platform-admin flag for manual review. **Suspension stays manual** — Maria decides; no automatic suspension this phase (per "keep it simple").
- **Recovery:** any `invoice.paid` restores `active` and clears dunning dates. Out-of-order webhook delivery is guarded: a redelivered `invoice.payment_failed` arriving after `invoice.paid` is a no-op (never re-duns a paid invoice).

### Why invoices are currently not being sent — investigation result

`createAndSendStripeInvoice` (convex/platformStripe.ts:264) only ever uses `collection_method: 'send_invoice'` and is only invoked manually; there is no scheduler creating platform invoices at all, and `createPlatformInvoice` accepts but ignores `chargeViaStripe`. `invoice.payment_failed` (convex/http.ts:153) is a bare `console.warn`. Fixes in this phase: monthly cron + auto-charge branch + real dunning handler. Webhook signature verification and the `stripeWebhookEvents` idempotency table already exist and stay unchanged; new event types (`checkout.session.completed`) follow the same claim-before-process pattern and are safe in either deploy order (old handler records and no-ops).

### ACH note (config, not code)

`us_bank_account` must be enabled on the Stripe account (Dashboard → Payment methods). If it isn't, Stripe rejects session creation; the error surfaces in the create-agency form. **TODO (environment config):** enable ACH debits on the Stripe account; no workaround code is added.

---

## Item 4 — Remove agency-user creation/administration from platform admin

- UI: remove the Users-section CRUD (Add User dialog, per-row role select, Remove) from `PlatformAgencyDetailPage`; keep the read-only owner contact view.
- Server: `createUserForTenant`, `removeUserFromTenant`, `updateTenantMemberRole` (convex/platform.ts) throw a clear "platform user management is disabled" error for public calls. `createTenant`'s internal owner creation path is preserved.
- Guard-throw chosen over deletion so qa/bootstrap scripts fail loudly instead of silently misbehaving; scripts/tests that call these are updated.

---

## Item 5 — Tenant health = technical errors only

- `getTenantHealth` / `getTenantHealthDetail` (convex/platform.ts) drop the open-HR-cases inputs — HR cases are agency business, not platform telemetry.
- `PlatformHealthPage` loses the "Open HR Cases" section; keeps integration/sync/technical errors.
- Limit-alert badges (Item 2) surface here for platform visibility.
- Support tickets list lives in the platform Support section (Item 8), not in health.

---

## Item 6 — Reports: "Past due" → "Lost agencies" + churn reason

- `tenants`: `churnedAt?`, `churnReason?` (optional string — free text keeps it minimal).
- New `offboardTenant(tenantId, reason?)` platform mutation: sets churn fields, cancels the subscription, audits `tenant_churned`. New `listChurnedTenants` query.
- `PlatformReportsPage`: the "Past due" KPI becomes "Lost agencies" (count) with a churn-reason breakdown when reasons exist.
- Offboard dialog with optional reason field added to `PlatformAgencyDetailPage`.

---

## Item 7 — Navigation consolidation

Final platform sidebar (7 items, routes unchanged): **Subscriptions, Agencies, Tenant Health, Reports, Support, Audit Log, Billing.**

- Tenant Health absorbs the tenant-metric widgets currently on Reports (agencies-by-seats, top agencies/MRR) — final state per the meeting: health view = technical errors + tenant-health metrics.
- Reports becomes the lost-agencies/churn view.
- "Support Access" relabeled "Support"; hosts support access + support tickets together (Item 8).

---

## Item 8 — Support ticketing + FAQ chatbot groundwork

### Data model (new table)

`supportTickets`: `tenantId`, `createdByUserId`, `createdByName`, `subject`, `description`, `category` ('billing'|'technical'|'account'|'feature'|'other'), `priority` ('low'|'normal'|'high'|'urgent'), `status` ('open'|'in_progress'|'resolved'|'closed'), `platformNotes?`, `createdAt`, `updatedAt`. Indexes: `by_tenant`, `by_status`.

### Permissions

- Agency side: `org:admin` and `org:coordinator` only — `requireTenantRole(ctx, clerkOrgId, ['org:admin','org:coordinator'])`. Caregivers see no ticket UI (Sidebar role filter) and are rejected server-side.
- Platform side: `requirePlatformAdmin` for list/update status/add note. All mutations audited.
- PHI: ticket form carries a "do not include client PHI" hint; ticket emails/notifications contain no tenant data beyond agency name.

### UI

- New agency-side `src/features/support/` page: FAQ section (static `faqData.ts`) + ticket list + create dialog; Sidebar nav item with roles `['org:admin','org:coordinator']`; RouteGuard + server guard both enforced.
- Platform `PlatformSupportPage`: tickets list/detail/status controls next to the existing support-access tooling.

### FAQ chatbot groundwork (research note only — no vendor integration this phase)

Static FAQ data module (`src/features/support/faqData.ts`) + placeholder FAQ section in the support UI, structured so a chatbot can later consume the same entries.

**Provider shortlist to evaluate later:**

| Provider | Notes | Fit |
|---|---|---|
| Intercom Fin | Mature support-suite AI answers, per-resolution pricing | High polish; needs Intercom helpdesk adoption |
| Chatbase | Train a bot on custom content/URLs, embed widget | Fast path over our FAQ module; cheap |
| Crisp | Chat widget + chatbot scenarios, flat pricing | Budget-friendly, less AI-native |
| Custom RAG over FAQ | Embeddings + LLM over `faqData.ts`, own Convex action | Full control, most build effort |

Evaluation criteria when picked up: PHI/compliance posture (BAA, data residency), embed effort in React 19, per-conversation cost, ability to escalate into the support-ticket system, and multi-tenant isolation.

---

## Failure handling, idempotency, security, multi-tenancy

- **Idempotency:** webhook handlers keep `stripeWebhookEvents` claim-before-process, including `checkout.session.completed` (re-attaching the same default PM is a no-op). Monthly cron: only ended periods are billed (`currentPeriodEnd <= now`), and a successful invoice rolls the subscription to the next monthly period — a same-day re-run sees the still-running new period and skips, and a stale re-use of the old period hits the duplicate-period guard. `offboardTenant` is idempotent (repeat calls keep the original `churnedAt`/reason and do not duplicate audit events). Limit-alert notifications deduped per tenant+period (the period now advances monthly, so an over-limit agency is re-notified once per period).
- **Dunning state machine:** `past_due` entered only from `active`/`trialing` on `payment_failed`; exit only via `invoice.paid` or manual `reactivateTenant`. Grace dates recomputed, never stacked, on repeated failures.
- **Security:** Stripe signature verification unchanged; Checkout Session built server-side with a fixed `payment_method_types` list (owner cannot swap card↔ACH); no client-supplied redirect URLs beyond the configured app URL. `paymentMethodAllowed` validated by union validator.
- **Multi-tenancy:** ticket mutations via `requireTenantRole`; every read filters by `tenantId`; platform reads via `requirePlatformAdmin` only. Limit metering queries strictly tenant-scoped. UI guard + server guard both updated.
- **Email gating:** all new emails go through `resend.sendEmail`, which no-ops when `EMAIL_ENABLED !== 'true'` — **dunning and limit emails are silent without it** (existing behavior, not a regression; flagged for ops).
- **Rollback:** all schema changes additive/optional → old code runs against new schema; rollback = revert commit, no migration. New webhook event types are additive and safe in either deploy order.

## Deferred (stated explicitly)

- Automatic suspension after grace period (manual this phase).
- Live chatbot vendor integration (groundwork + shortlist only).
- Self-serve plan management for agencies (platform-admin only this phase).
- Stripe Dashboard config: ACH enablement, Smart Retries settings (environment config, not code).
