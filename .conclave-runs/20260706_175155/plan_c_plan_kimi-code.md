# ATRIA-X Phase 2 — E2E & Integration Test Implementation Plan

## 1. Restated Goal and Acceptance Criteria

**Goal:** Add comprehensive Phase 2 test coverage for the candidate-to-caregiver onboarding, scheduling, documents, and forms flows. Extend existing Convex integration tests where they already exist, create missing Playwright E2E specs, and add idempotent Phase 2 fixtures to `convex/seed.ts`.

**Acceptance Criteria:**

- **AC-1:** `tests/e2e/onboarding.spec.ts` exists and covers the full candidate-to-caregiver flow: HR invites a candidate, the candidate accepts the invitation and submits an application, HR reviews and advances to offer, the candidate accepts the offer, HR hires the candidate, and the new caregiver completes the 5-step platform training and lands on `/caregiver/today` with `hasPlatformTrainingCompleted` true.
- **AC-2:** `tests/e2e/scheduling.spec.ts` exists and covers: admin adds a shift, the UI detects a schedule conflict, a caregiver sees the shift, the caregiver sets a recurring availability window, the caregiver requests coverage for the shift, and an admin resolves the coverage request by reassigning it.
- **AC-3:** `tests/e2e/documents.spec.ts` exists and covers: opening a pending-review document, verifying it, opening another pending-review document, rejecting it with a reason, and toggling the "Expiring soon" filter.
- **AC-4:** `convex/onboarding.test.ts` is extended to verify: `inviteCandidate` seeds 5 `candidateTasks`; `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` advance the candidate status machine; `completePlatformTraining` / `hasPlatformTrainingCompleted` / `resetPlatformTraining` behave correctly; and an `org:candidate` caller is blocked from `listShifts`.
- **AC-5:** `convex/scheduling.test.ts` is extended to verify: `checkShiftConflict` handles adjacent, overlap, `excludeId`, and completed-shift cases; `createShift` writes an audit event and rejects cross-caregiver conflicts; `createShift` / `updateShift` / `assignShift` reject a non-caregiver `assignedCaregiver`; `updateShift` is blocked on `submitted`; `deleteShift` is blocked on `in_progress`; and `requestCoverage` is rejected when called for a shift assigned to another caregiver.
- **AC-6:** `convex/forms.test.ts` uses a sample form definition with `name` required, `experience` required, and `notes` optional, and verifies `submitForm` rejects missing required fields and inactive forms. `convex/documentArchive.test.ts` verifies `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt` and rejects `org:caregiver` callers.
- **AC-7:** `convex/seed.ts` gains idempotent Phase 2 fixtures: one candidate in `submitted` status with an application; one recurring `availabilityWindows` row for the seeded caregiver; one `coverageRequests` row in `open` status; one `formDefinitions` row with three fields (`name` required, `experience` required, `notes` optional); and one `documentArchiveItems` row in `pending_review` status.
- **AC-8:** All quality gates pass: `npm run typecheck`, `npm run test`, `npm run e2e` (or `npm run e2e:full` for the auth specs), `npm run lint`, and `npm run build`.

## 2. Discovery Notes

Repo inspection was performed on the actual files. Verified contracts and seams:

- **Schema (`convex/schema.ts`):** Tables for `candidates`, `applications`, `candidateTasks`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`, `platformTrainingCompletions`, and `shifts`.
- **Candidate lifecycle (`convex/candidates.ts`):**
  - `CANDIDATE_TASK_TYPES` = `['form_submission', 'document_upload', 'background_check', 'reference_check', 'platform_training']`.
  - `inviteCandidate` action calls `internal.candidates.insertInvitedCandidate`, which inserts 5 `candidateTasks`.
  - `submitApplication` requires `org:candidate` and sets candidate status to `applied`.
  - `reviewApplication` (admin/hr) transitions to `hr_review`, `rejected`, or `application_draft`.
  - `sendOffer` requires candidate status `hr_review`.
  - `acceptOffer` requires `offer_sent` and sets `accepted`.
  - `hireCandidate` requires `accepted` and a linked `clerkUserId`; it patches the `tenantMembers` role to `org:caregiver`, creates/updates an `employeeProfiles` row, and schedules `updateClerkMembershipRole` and `adpOutbound.adpSyncWorker`.
- **Training (`convex/onboarding.ts`):** `completePlatformTraining` is idempotent and allows `org:caregiver` or `org:candidate`; `hasPlatformTrainingCompleted` returns boolean; `resetPlatformTraining` is admin-only.
- **Scheduling (`convex/scheduling.ts`):**
  - `checkShiftConflict` skips `billing_ready` and excludes `excludeShiftId`.
  - `createShift` calls `internal.audit.record` with `action: 'shift.created'`.
  - `assertCaregiverMember` enforces that `assignedCaregiver` must have role `org:caregiver`.
  - `updateShift` rejects terminal statuses (`submitted`, `approved`, `billing_ready`).
  - `deleteShift` only allows `scheduled` status.
  - `requestCoverage` only allows the assigned caregiver on a `scheduled` shift.
- **Forms (`convex/forms.ts`):** `submitForm` rejects inactive forms and missing required fields; `createFormDefinition` allows admin/hr; `updateFormDefinition` is admin-only and blocks when submissions exist.
- **Documents (`convex/documentArchive.ts`):** `listDocumentArchive` is admin/hr only; `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt` for `verified`, requires `rejectionReason` for `rejected`, records `document.status_updated` audit event.
- **Auth helpers (`convex/authHelpers.ts`):** `requireTenantRole`, `assertTenantDoc`, and `ensureTenantMember` enforce multi-tenancy and role checks.
- **Seed (`convex/seed.ts`):** `seedE2EFixtures` currently creates admin/coordinator/caregiver members and two fixture shifts. It does not yet create Phase 2 candidate/availability/coverage/form/document fixtures.
- **Frontend routes (`src/app/router.tsx`):** `/hr/candidates`, `/hr/candidates/:candidateId`, `/hr/candidates/:candidateId/hire`, `/onboarding`, `/onboarding/application`, `/onboarding/status`, `/onboarding/offer`, `/onboarding/training`, `/caregiver/today`, `/scheduling`, `/caregiver/schedule`, `/caregiver/availability`, `/documents`, `/forms/:formDefinitionId`.
- **Frontend seams:**
  - `ApplicationReviewPage` disables "Advance to next stage" until `allTasksComplete` (all 5 tasks `complete` or `waived`).
  - `PlatformTrainingWizard` has 5 steps, requires scrolling to the bottom (`scrollProgress >= 99.9`) and a per-step `minReadSeconds` countdown before enabling "Complete training".
  - `SchedulingPage` uses `ShiftEditorModal` for add/edit and `CoverageRequestsPanel` for resolving coverage.
  - `CaregiverSchedulePage` lets caregivers open a shift packet and request coverage.
  - `AvailabilityPage` lets caregivers add recurring or one-off availability windows.
  - `DocumentArchivePage` has "Expiring soon" toggle and `DocumentDetailPanel` with Verify/Reject actions.
- **E2E harness:** `tests/e2e/helpers/auth.ts` uses Clerk sign-in tickets for admin/coordinator/caregiver. `playwright.config.ts` skips `@auth` specs when credentials are missing or Convex is local. No candidate credentials exist yet.

## 3. Alternatives Considered

| Approach | Decision | Rationale |
| --- | --- | --- |
| Replace existing integration tests with new files | **Rejected** | `convex/onboarding.test.ts`, `scheduling.test.ts`, `forms.test.ts`, and `documentArchive.test.ts` already exist and cover large portions of the requested behavior. Replacing them would lose existing assertions and create churn. |
| Extend existing integration test files | **Chosen** | Matches the task's exact file names, preserves prior coverage, and only adds missing cases. |
| Create a mock Clerk harness for all E2E | **Rejected** | The existing harness uses real Clerk credentials and sign-in tickets. A mock harness would require broad plumbing changes and would not validate the actual invitation/acceptance flow. |
| Add a real Clerk candidate E2E user | **Chosen** | Keeps the existing real-credential pattern. Add `E2E_CANDIDATE_EMAIL/PASSWORD` and skip `@auth` specs gracefully when unavailable. |
| Complete only application/training in E2E | **Rejected** | `ApplicationReviewPage` blocks "Advance to next stage" until `allTasksComplete`. The E2E must either complete all 5 candidate tasks through the UI or seed the remaining tasks as complete. |
| Seed candidate tasks as complete + complete application/training in UI | **Chosen** | Balances realistic UI coverage with the hard `allTasksComplete` guard. The seed fixture can mark document upload, background check, and reference check tasks complete so the UI flow focuses on application and training. |

## 4. Files to Create / Modify

| File | Change Type | What Changes |
| --- | --- | --- |
| `tests/e2e/onboarding.spec.ts` | Create | Playwright spec for full candidate-to-caregiver flow with training scroll/timer mock. |
| `tests/e2e/scheduling.spec.ts` | Create | Playwright spec for admin shift creation, conflict detection, caregiver availability, coverage request/resolution. |
| `tests/e2e/documents.spec.ts` | Create | Playwright spec for pending-review verify/reject and expiring-soon filter. |
| `tests/e2e/helpers/auth.ts` | Modify | Add `E2E_CANDIDATE_EMAIL`/`E2E_CANDIDATE_PASSWORD` exports and update `assertE2ECredentialsConfigured`. |
| `tests/e2e/helpers/env.ts` | Modify | Include candidate credentials in `e2eCredentialsAvailable()`. |
| `.env.e2e.example` | Modify | Document `E2E_CANDIDATE_EMAIL` and `E2E_CANDIDATE_PASSWORD`. |
| `playwright.config.ts` | Modify | Include candidate credentials in the skip-auth logic if needed (mirrors `helpers/env.ts`). |
| `convex/onboarding.test.ts` | Modify | Add tests for `inviteCandidate` → 5 tasks, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate`, role guard `org:candidate` cannot `listShifts`. Keep existing training tests. |
| `convex/scheduling.test.ts` | Modify | Add `createShift` audit event assertion, cross-caregiver conflict test, caregiver-role-required test for `assignedCaregiver`. Existing tests already cover adjacent/overlap/excludeId/completed, submitted update block, in_progress delete block, and wrong-caregiver coverage rejection. |
| `convex/forms.test.ts` | Modify | Update `sampleFields` to `[{ id: 'name', required: true }, { id: 'experience', required: true }, { id: 'notes', required: false }]`. Keep existing required-field and inactive-form tests. |
| `convex/documentArchive.test.ts` | Modify | Ensure a `pending_review` fixture-specific test and `org:caregiver` block for `updateDocumentArchiveItem` exist (already present; align with seed fixture). |
| `convex/seed.ts` | Modify | Add idempotent Phase 2 fixtures to `seedE2EFixtures`: submitted candidate + application, caregiver availability window, open coverage request, 3-field form definition, pending-review document archive item. |
| `convex/seed.test.ts` | Modify | Add assertions that Phase 2 fixtures are created/skipped idempotently. |
| `package.json` | Verify | No script changes required; `test`, `test:phase2`, `e2e`, `e2e:full`, `e2e:local`, `lint`, `typecheck`, and `build` already exist. |

## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

- **Multi-tenancy:** Every Convex function uses `requireTenantRole(ctx, clerkOrgId, [...])` plus `assertTenantDoc`. Tests must include cross-tenant negative cases (e.g., `orgA` caller cannot access `orgB` candidate/shift/document).
- **Role guards:**
  - `org:candidate` must be rejected from `scheduling.listShifts`.
  - `org:caregiver` must be rejected from `documentArchive.updateDocumentArchiveItem`.
  - `createShift` / `updateShift` / `assignShift` must reject an `assignedCaregiver` that is not a member with role `org:caregiver`.
- **Candidate state machine:** Tests must enforce ordering: cannot `sendOffer` unless status is `hr_review`; cannot `hireCandidate` unless status is `accepted` and `clerkUserId` is set.
- **Shift state machine:** `updateShift` is blocked for `submitted`/`approved`/`billing_ready`; `deleteShift` only allowed for `scheduled`; `requestCoverage` only for `scheduled` and assigned caregiver.
- **PHI/PII:** Candidate application fields and documents are only visible to the candidate themselves, `org:admin`, and `org:hr`. Form submissions are restricted to own submission for caregiver/candidate.
- **Idempotency:**
  - `completePlatformTraining` returns existing completion on duplicate call.
  - `insertInvitedCandidate` reuses withdrawn/incomplete invited rows and deletes old tasks before recreating them.
  - Seed helpers use find-by-key (`findClient`, `findShift`, etc.) before insert and repair child records rather than duplicating them.
- **Training mock seam:** `PlatformTrainingWizard` uses `scrollHeight - clientHeight` scroll progress and a real `setInterval` timer. In Playwright, use `page.evaluate` to scroll the `data-testid="training-content"` element to the bottom and stub `Date.now`/timers so the countdown reaches zero quickly.
- **E2E candidate cleanup:** The onboarding spec creates a Clerk invitation and possibly a new Clerk user. Use a disposable candidate mailbox/account or clean up the invited candidate via the Clerk API in `test.afterAll` to avoid org pollution.

## 6. Test Strategy

**Integration tests (Vitest + `convex-test`):**

- Run gate: `npm run test`.
- Use `convexTest({ schema, modules })` and `t.withIdentity({ subject, org_id, org_role })`.
- Each test seeds its own tenant with deterministic `clerkOrgId` to avoid cross-test leakage.
- Onboarding tests:
  - Seed tenant + admin + HR member.
  - Call `api.candidates.inviteCandidate` and assert 5 `candidateTasks` of the expected types exist.
  - Seed a candidate member, link it to the candidate row, and call `submitApplication`.
  - As admin, call `reviewApplication` with `approved`, then `sendOffer`, then as candidate call `acceptOffer`, then as admin call `hireCandidate` and assert the member role becomes `org:caregiver` and an `employeeProfiles` row exists.
  - As candidate/caregiver call `completePlatformTraining`, query `hasPlatformTrainingCompleted`, and as admin call `resetPlatformTraining`.
  - As `org:candidate`, assert `api.scheduling.listShifts` throws with role guard message.
- Scheduling tests:
  - Keep existing conflict/state tests.
  - Add audit assertion: after `createShift`, query `api.audit.list` and find `shift.created` with the new shift id.
  - Add cross-caregiver conflict: create a shift for `caregiverA`, then attempt to create an overlapping shift also assigned to `caregiverA` and assert rejection.
  - Add caregiver-role guard: attempt `createShift` with `assignedCaregiver` set to an `org:coordinator` member and assert `assertCaregiverMember` throws.
- Forms tests:
  - Use the updated 3-field sample definition.
  - Assert `submitForm` fails when `name` or `experience` is missing.
  - Assert `submitForm` fails after `deactivateFormDefinition`.
- Document archive tests:
  - Keep existing verify/reject/audit/block tests; add one test seeded from the new `pending_review` fixture if not already covered.

**E2E tests (Playwright):**

- Run gate: `npm run e2e` skips `@auth` specs when credentials are missing; `npm run e2e:full` runs them unconditionally.
- All E2E specs use `{ tag: '@auth' }` and `test.describe.configure({ mode: 'serial' })`.
- `onboarding.spec.ts`:
  - `beforeAll` asserts credentials, signs in as admin, resets Phase 2 E2E fixtures.
  - HR signs in, opens `/hr/candidates`, clicks "Invite candidate", fills the modal, sends invitation.
  - Candidate signs in via invitation/acceptance flow (or uses pre-seeded candidate credentials), lands on `/onboarding`.
  - Candidate completes `/onboarding/application` (fills full name, DOB, address, experience) → status page.
  - HR reviews candidate at `/hr/candidates/:candidateId`, clicks "Advance to next stage" (fixture ensures all tasks complete).
  - Candidate visits `/onboarding/offer`, accepts offer.
  - HR visits `/hr/candidates/:candidateId/hire`, clicks "Confirm & hire".
  - New caregiver signs in, is redirected to training gate, visits `/onboarding/training`, mocks scroll/timer through all 5 steps, clicks "Complete training".
  - Assert URL is `/caregiver/today` and `api.onboarding.hasPlatformTrainingCompleted` returns true (via window-level Convex query or by checking UI state).
- `scheduling.spec.ts`:
  - Admin signs in, opens `/scheduling`, clicks "Add shift", selects client/caregiver/date/time, saves.
  - Attempts to add an overlapping shift for the same caregiver and asserts a conflict toast/message.
  - Caregiver signs in, opens `/caregiver/schedule`, sees the shift.
  - Caregiver opens `/caregiver/availability`, adds a recurring window.
  - Caregiver opens the shift packet, clicks "Request Coverage", enters reason, sends request.
  - Admin opens `/scheduling`, sees open coverage request in `CoverageRequestsPanel`, selects another caregiver, clicks "Assign".
  - Assert coverage request status becomes `filled` and shift caregiver changes.
- `documents.spec.ts`:
  - Admin signs in, opens `/documents`.
  - Clicks "View" on the seeded pending-review item, clicks "Verify", asserts status changes to "Valid".
  - Clicks "View" on another pending-review item, clicks "Reject", enters reason, confirms, asserts status changes to "Rejected".
  - Toggles "Expiring soon" filter and asserts only items with `expiresAt` within 30 days remain visible.

## 7. Rollback / Verification Notes

- **Rollback:** Revert the commit containing the new test files and seed changes. No production code is modified, so rollback is low-risk.
- **Codegen:** After any change to `convex/*` (including `seed.ts`), run `npx convex codegen` before `npm run typecheck`/`npm run test`.
- **Verification steps:**
  1. `npm run typecheck` — TypeScript must be clean.
  2. `npm run test` — all Vitest tests pass.
  3. `npm run e2e` — non-auth specs pass; `@auth` specs skip cleanly if credentials are absent.
  4. With credentials configured, `npm run e2e:full` — all E2E specs pass.
  5. `npm run lint` — no lint errors.
  6. `npm run build` — production build succeeds.
- **E2E environment checklist:** Set `E2E_CLERK_ORG_ID`, `E2E_ADMIN_EMAIL/PASSWORD`, `E2E_COORDINATOR_EMAIL/PASSWORD`, `E2E_CAREGIVER_EMAIL/PASSWORD`, and new `E2E_CANDIDATE_EMAIL/PASSWORD`.
- **Clerk org hygiene:** The onboarding spec may create invitations and candidate users. Verify after a full run that the E2E org does not accumulate unused candidate members; add cleanup in `test.afterAll` if necessary.
