# ATRIA-X Phase 1 Session 8 — Implementation Plan

## Goal

Implement and verify end-to-end and integration test coverage for the complete caregiver-to-billing shift lifecycle, geofence enforcement, and ADP mock integration contracts.

## Acceptance Criteria

- `npm run e2e` covers the full seeded lifecycle with geofence disabled:
  - Caregiver clocks in.
  - Completes the 6-step note.
  - Clock Out disabled until note complete, then enabled.
  - Clock Out submits the shift.
  - Coordinator requests a correction.
  - Caregiver fixes and resubmits.
  - Coordinator approves → shift becomes billing-ready.
  - Each lifecycle state asserts both status word and status color.

- Geofence coverage verifies:
  - Inside radius allows clock in/out and stores location evidence.
  - Outside radius shows blocked UI and server rejects the punch.
  - Denied geolocation shows blocked UI and creates no punch.
  - Disabling geofence prevents location requests.

- ADP contract/integration tests verify:
  - Unconfigured tenant keeps app usable and marks punches `pending_credentials`.
  - Configured mock ADP sync posts queued punches exactly once.
  - `adpPunchId` stored and statuses become `synced`.
  - Initial worker load matches existing profiles by email and creates missing profiles with `adpAssociateOid`.
  - `createCaregiver` enqueues worker sync and drains to `synced`.
  - No secrets/raw credentials appear in `integrationEvents` or logs.
  - Location evidence is not sent in ADP punch payloads.

- Required gates genuinely green:
  - `npx convex codegen` if Convex API/schema changed
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run e2e`

## Stages

### Stage 1 — Fixtures & selectors

- [x] Inspect existing auth, route guards, seed helpers, and test setup.
- [x] Update `convex/seed.ts` with deterministic e2e fixtures:
  - `seedE2E` mutation that creates/updates a test tenant, members (admin, coordinator, caregiver), clients with service addresses, and shifts for lifecycle + geofence scenarios.
  - Accepts the real Clerk user IDs for the configured test accounts instead of hard-coding placeholder IDs.
  - Resets fixture shifts, reviews, billing lines, time punches, and tasks to a clean scheduled baseline on every run.
  - Resets geofence settings to disabled on every run.
  - `resetE2EShifts` mutation for serial e2e scenarios to restore the baseline between tests.
- [x] Add `data-testid` attributes to key UI surfaces:
  - `CaregiverTodayPage` shift cards and "Clock in & start" button.
  - `ShiftClockInScreen`, `ShiftClockOutScreen`, `LocationStatusPanel`.
  - `ShiftNoteStep` step navigation and inputs.
  - `CoordinatorReviewPage` queue rows and filter tabs.
  - `ReviewDetail` approve / request-correction buttons and comment field.
  - `GeofenceSettingsPage` toggles and save button.

### Stage 2 — Server-side tests

- [x] `convex/shiftClock.test.ts`: add convex-test cases for geofence disabled, inside radius, outside radius, missing/denied location, disabled setting, and verify no punch is created on rejection.
- [x] `convex/reviews.test.ts`: add cases for correction request, resubmission returning to queue, and approval marking billing-ready only when documentation is complete.
- [x] `convex/adpSync.test.ts`: verify unconfigured tenant behavior, configured mock sync idempotency, secret redaction, and location evidence omission from ADP payloads.
- [x] `convex/employeeProfiles.test.ts`: verify `adpInitialWorkerLoad` matching/creation and `createCaregiver` enqueue + drain.

### Stage 3 — E2E specs

- [x] `tests/e2e/phase1-lifecycle.spec.ts`: full lifecycle using seeded data with geofence disabled.
  - Conditional auth via Clerk sign-in using `E2E_*` environment variables.
  - Required specs now fail with a clear error when credentials are unavailable instead of being skipped, so the gate is honest.
  - Added assertions: Clock Out / submit button disabled before confirmation, status word + color for correction/resubmission/approval, and `data-shift-status="billing_ready"` after approval.
- [x] `tests/e2e/geofence.spec.ts`: inside radius, outside radius, denied permission, and disable-setting flows.
  - Outside/denied scenarios now click Clock In so location is actually requested and the blocked state is exercised.
  - Each geofence test that needs enforcement enables it explicitly.
  - `afterEach` calls `seed:resetE2EShifts` so serial tests always start from the scheduled fixture baseline.
- [x] `tests/e2e/helpers/auth.ts`: shared Clerk sign-in helper, credential guard, and `resetE2EShifts` test helper.

### Stage 4 — Reviewer fixes (Iteration 2)

- [x] Fix lifecycle e2e interactions:
  - Click `Change` before filling start/end time inputs in `phase1-lifecycle.spec.ts` and `geofence.spec.ts`.
  - Advance through each wizard step in the correction flow instead of jumping to `done`.
- [x] Make geofence cleanup session-safe by signing out in `resetE2EShifts` before admin sign-in.
- [x] Prevent ADP side effects when caregiver invitation fails:
  - Validate `CLERK_SECRET_KEY` before creating the employee profile.
  - Delete the profile if the Clerk invitation fails.
  - Add unit tests for missing secret key and failed invitation cleanup.

### Stage 5 — Gates & summary

- [x] Run `npx convex codegen` if Convex files changed.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test`.
- [x] Run `npm run e2e`.
- [x] Write real pass/fail results to `.hermes-pipeline/20260626_161701/summary.md`.

### Stage 6 — Reviewer fixes (Iteration 3)

- [x] Make E2E fixtures deterministic across time:
  - Replace the current-UTC date in `seedE2E`/`resetE2EShifts` with the fixed `REF_TODAY` constant.
  - Ensure seeded lifecycle and geofence shifts are always in the past so `clockIn` cannot be rejected for "future shift".
- [x] Run `npx convex codegen` against the local `anonymous-agent` backend and report the real PASS result.
- [x] Document the required `E2E_*` credential variables in `.env.example`.
- [ ] E2E lifecycle/geofence specs still require real Clerk test-account credentials to turn green.

## Files To Create / Modify

Create:

- `.hermes-pipeline/20260626_161701/implementation-plan.md`
- `.hermes-pipeline/20260626_161701/summary.md`
- `tests/e2e/phase1-lifecycle.spec.ts`
- `tests/e2e/geofence.spec.ts`
- `tests/e2e/helpers/auth.ts`

Modify:

- `convex/seed.ts`
- `src/features/coordinator/pages/CoordinatorReviewPage.tsx`
- `src/features/dashboard/pages/DashboardPage.tsx`
- `tests/e2e/global-setup.ts`
- `convex/_generated/*` (via `npx convex codegen`, never by hand)

## Risks & Mitigations

- **Auth dependency for e2e**: Real Clerk sign-in requires test accounts. Mitigation: global setup seeds fixtures only when credentials are present; required specs fail fast with a clear message when credentials are missing so the gate cannot be green by skipping.
- **Multi-tenancy**: All backend helpers use `authHelpers` guards; no changes that weaken tenant isolation.
- **HIPAA/privacy**: Location evidence stays internal; ADP payload assertions ensure no leakage.
- **Secret leakage**: ADP mock creds are stubbed via `vi.stubEnv` and redacted by `sanitizeError`; assertions verify they do not appear in events/logs.
- **Billing invariant**: Approval only reaches `billing_ready` when documentation is complete; enforced by `reviews.approve` and verified by tests.
