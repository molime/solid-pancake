• I’ll inspect the actual repo files before synthesizing the final plan.# ATRIA-X Phase 2 E2E & Integration Tests — Synthesized Implementation Plan

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Add comprehensive Phase 2 E2E and integration test coverage for the candidate-to-caregiver onboarding, scheduling, and document-archive flows; ensure the existing idempotent Phase 2 seed fixtures are complete; and report the pipeline gate results.

  - **AC-1** — `tests/e2e/onboarding.spec.ts` exists and covers the candidate-to-caregiver flow: invite → submitted → review → offer → accept → hire → training gate → complete training → `/caregiver/today`. Where React pages are stubs, the spec may use direct Convex mutation calls to advance the state, then assert on the implemented pages (`/hr/candidates`, `/onboarding/application`, `/hr/candidates/:id/hire`, `/caregiver/today`).
  - **AC-2** — `tests/e2e/scheduling.spec.ts` exists and covers: admin creates a shift, conflict detection blocks an overlapping shift, caregiver availability warning appears, and a coverage request is created and resolved.
  - **AC-3** — `tests/e2e/documents.spec.ts` exists and covers: HR verifies a `pending_review` document, HR rejects a document with a reason, and the "expiring soon" filter works. Because no verify/reject UI currently exists, the spec will use direct `documentArchive.updateDocumentArchiveItem` calls and assert status through `documentArchive.listDocumentArchive` or the read-only Documents tab on `EmployeeProfilePage`.
  - **AC-4** — `convex/onboarding.test.ts` contains (or is verified to contain): `candidateTasks` order, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` creating `employeeProfile` with `adpSyncStatus: 'pending_credentials'`, `completePlatformTraining` idempotency, `hasPlatformTrainingCompleted`, `resetPlatformTraining`, and `org:candidate` blocked from `scheduling.listShifts`.
  - **AC-5** — `convex/scheduling.test.ts` contains (or is verified to contain): `checkShiftConflict` adjacent/overlap/excluded/completed, `createShift` audit, cross-caregiver conflict, caregiver role required for `createShift`/`updateShift`/`deleteShift`/`assignShift`, and update/delete coverage guards.
  - **AC-6** — `convex/forms.test.ts` contains (or is verified to contain): `submitForm` missing/inactive fields, `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt`, and `org:caregiver` cannot call `updateDocumentArchiveItem`.
  - **AC-7** — `convex/seed.ts` idempotent Phase 2 fixtures are complete and exported: one candidate in `submitted` status with seeded application, one availability window, one `open` coverage request, one `formDefinition` with 3 fields (`name` required, `experience` required, `notes` optional), one `documentArchiveItem` `pending_review`.
  - **AC-8** — All new code follows project style: single quotes, no semicolons, 2-space indent.
  - **AC-9** — `npx convex codegen` is run after any `convex/*.ts` edit.
  - **AC-10** — Gates are run and reported with actual counts: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e:full`, `npm run build`.

  ## 2. Discovery Notes

  Files were inspected directly; the following contracts were verified.

  ### Onboarding / candidates
  - `convex/candidates.ts` exports the full lifecycle: `inviteCandidate`, `insertInvitedCandidate`, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate`, `addCandidateDocument`, `listCandidateTasks`, `listCandidateTasksForHR`.
  - `CandidateStatus` = `'invited' | 'applied' | 'hr_review' | 'rejected' | 'offer_sent' | 'accepted' | 'hired' | 'withdrawn'`.
  - `CANDIDATE_TASK_TYPES` = `[form_submission, document_upload, background_check, reference_check, platform_training]`, ordered 0-4.
  - `hireCandidate` upserts `tenantMembers` with `role: 'org:caregiver'`, creates/upserts `employeeProfiles` with `adpSyncStatus: 'pending_credentials'`, and schedules `internal.candidates.updateClerkMembershipRole` plus `internal.adpOutbound.adpSyncWorker`.
  - `convex/onboarding.ts` exports `completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`. `completePlatformTraining` is idempotent by `(tenantId, clerkUserId, trainingId)`.
  - `convex/employeeProfiles.ts` exports `createCaregiverProfile`, `createCaregiver`, etc.

  ### Scheduling
  - `convex/scheduling.ts` exports `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`, `createShift`, `updateShift`, `deleteShift`, `assignShift`, `requestCoverage`, `resolveCoverage`, `listShifts`, availability CRUD.
  - `checkShiftConflict` ignores statuses not in `NON_CONFLICT_STATUSES` (`scheduled`, `in_progress`, `submitted`, `approved`) and detects overlap with `start < existing.scheduledEnd && end > existing.scheduledStart`.
  - `createShift` writes a `shift.created` audit event; `deleteShift` cascades to child `coverageRequests`.

  ### Forms / documents
  - `convex/forms.ts` exports `createFormDefinition`, `updateFormDefinition`, `deactivateFormDefinition`, `listFormDefinitions`, `submitForm`, `listFormSubmissions`, `getFormSubmission`. `submitForm` validates required fields and rejects inactive forms.
  - `convex/documentArchive.ts` exports `listDocumentArchive` and `updateDocumentArchiveItem`. The mutation sets `verifiedBy`/`verifiedAt` on `verified`, clears them on `rejected`/`active`, and requires `rejectionReason` for `rejected`.

  ### Auth
  - `convex/authHelpers.ts` exports `requireTenantRole`, `requireTenantRoleAction`, `assertTenantDoc`, `ensureTenantMember`.
  - `TenantRole` = `'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr' | 'org:candidate'`.

  ### Seed
  - `convex/seed.ts` already exports `resetE2ECandidate`, which is idempotent and seeds: 5 tenant members (admin/coordinator/caregiver/HR/candidate), a `Phase 2 Client`, a candidate `phase2-candidate@atriax.test` with status `applied`, a `submitted` application with fields `{name, experience, notes}`, a Monday `09:00-17:00` recurring availability window, a scheduled SLS shift with an `open` coverage request, a `Phase 2 Application` form definition with 3 fields, and a `pending_review` `documentArchiveItem` with category `phase2_fixture`.

  ### E2E harness
  - `tests/e2e/helpers/auth.ts` already reads `E2E_HR_EMAIL`, `E2E_HR_PASSWORD`, `E2E_CANDIDATE_EMAIL`, `E2E_CANDIDATE_PASSWORD`, and provides `signInAsHR`, `signInAsCandidate`, `mockSignInAsRole`, `extractClerkToken`.
  - `tests/e2e/helpers/seed.ts` already provides `resetE2ECandidate(page, userIds)` using the same token-extraction pattern as `resetE2EShifts`.
  - `tests/e2e/helpers/env.ts` already requires HR/candidate credentials when `E2E_FULL=1`, and auto-enables mock mode when credentials are missing or Convex is local.
  - `mockSignInAsRole` sets `window.__E2E_MOCK_ROLE__` and `window.__E2E_MOCK_ORG_ID__`, but no app-side code currently reads these globals, so mock mode is not yet functional end-to-end.

  ### UI pages
  - Implemented: `/hr/candidates`, `/hr/candidates/:candidateId`, `/hr/candidates/:candidateId/hire`, `/onboarding/application`, `/caregiver/today`, `/scheduling`, `/hr/employees/:memberId` (Documents tab is read-only).
  - Stubs: `/onboarding`, `/onboarding/status`, `/onboarding/upload/:taskId`, `/onboarding/acknowledgment`, `/onboarding/offer`, `/onboarding/training`, `/onboarding/profile`.
  - No dedicated document archive page exists; verify/reject actions are backend-only.

  ### Existing test coverage
  - `convex/onboarding.test.ts`, `convex/candidates.test.ts`, `convex/scheduling.test.ts`, `convex/forms.test.ts`, and `convex/documentArchive.test.ts` already cover most of the requested integration cases. The work is primarily verification and small gap-filling rather than writing entire suites from scratch.

  ## 3. Alternatives Considered

  | Approach | Pros | Cons | Chosen? |
  |---|---|---|---|
  | **A. Full live-Clerk E2E only** | Tests real auth/org flow; matches existing `@auth` specs. | Requires `.env.e2e` with HR/candidate seats; can be flaky without stable seed state. | Partial — primary path when credentials exist. |
  | **B. Build a Playwright mock Clerk harness with role injection** | Cheap, deterministic, no live Clerk dependency. | No app-side wiring exists today for `__E2E_MOCK_ROLE__`; would require invasive dev-mode auth changes. | No — out of scope for this test task. |
  | **C. Skip missing UI steps via direct Convex calls in E2E** | Works around stub pages and missing document UI; keeps E2E focused on backend-to-frontend contract. | Slightly less "pure" E2E, but acceptable for stubs. | Yes — for onboarding offer/accept/training and document verify/reject. |
  | **D. Only integration tests, no E2E** | Fast, no env burden. | Violates AC-1/2/3 and does not verify UI wiring. | No. |

  **Decision:** Use the existing live-Clerk harness when credentials are available (Approach A), fall back to mock mode detection already in `env.ts`, and use direct Convex mutation calls where the UI is a stub or absent (Approach C). Do not build new mock Clerk wiring.

  ## 4. Files to Create / Modify

  | File | Change type | What changes |
  |---|---|---|
  | `convex/onboarding.test.ts` | Verify / gap-fill | Ensure AC-4 cases all exist and pass; add any missing cases (e.g., explicit `resetPlatformTraining` admin-only guard, `org:candidate` cannot `listShifts`). |
  | `convex/scheduling.test.ts` | Verify / gap-fill | Ensure AC-5 cases all exist and pass; add any missing cases (e.g., `deleteShift` cascade of coverage requests, `resolveCoverage` non-open guard, `requestCoverage` status guard). |
  | `convex/forms.test.ts` | Verify / gap-fill | Ensure AC-6 cases exist and pass; add missing cases if needed (e.g., caregiver `submitForm` missing required field, `active` status clears verifier fields). |
  | `convex/seed.ts` | Verify / minor modify | Confirm `resetE2ECandidate` is exported and idempotent; optionally return `documentArchiveItemId` alongside existing return values if E2E needs it. No schema changes. |
  | `tests/e2e/helpers/env.ts` | Already complete | No changes required; already supports `E2E_HR_EMAIL/PASSWORD` and `E2E_CANDIDATE_EMAIL/PASSWORD`. |
  | `tests/e2e/helpers/auth.ts` | Already complete | No changes required; `signInAsHR`, `signInAsCandidate`, mock helpers already exist. |
  | `tests/e2e/helpers/seed.ts` | Already complete / minor modify | `resetE2ECandidate` already exists; verify it passes the correct user IDs and handles mock user IDs. |
  | `tests/e2e/onboarding.spec.ts` | Create | Full candidate-to-caregiver E2E flow; uses UI where implemented and direct Convex calls for stubbed steps. |
  | `tests/e2e/scheduling.spec.ts` | Create | Admin shift creation, conflict detection, availability warning, coverage request resolution. |
  | `tests/e2e/documents.spec.ts` | Create | Verify/reject document via direct mutation; assert status through query or read-only UI; test `expiringSoonDays` filter via direct query. |
  | `convex/_generated/*` | Generated | Run `npx convex codegen` after any `convex/*.ts` change. |

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  - **Multi-tenancy:** Every backend mutation/query uses `requireTenantRole` + `assertTenantDoc`. E2E helpers must call `resetE2ECandidate` within the correct `E2E_CLERK_ORG_ID`.
  - **Role guards:** `org:candidate` cannot call `scheduling.listShifts`; `org:caregiver` cannot call `updateDocumentArchiveItem`; `deleteShift` and `resetPlatformTraining` are admin-only.
  - **Idempotency:** `completePlatformTraining` must not duplicate completions; `hireCandidate` must upsert `employeeProfile`/`tenantMember`; `resetE2ECandidate` must be idempotent (verified in code).
  - **Candidate terminal states:** `submitApplication` rejects terminal statuses; `hireCandidate` requires `accepted`; `reviewApplication` only allows `applied`/`hr_review`/`application_draft`.
  - **Coverage guards:** Only the assigned caregiver can `requestCoverage`; only admin/coordinator can `resolveCoverage`; `resolveCoverage` must run `checkShiftConflict` for the new caregiver.
  - **PHI/PII:** E2E uses fake `@atriax.test` emails; no real PHI. Document archive fixtures use placeholder files.
  - **Audit:** `createShift`, `updateDocumentArchiveItem`, and candidate transitions write `auditEvents`. Tests should verify the explicitly requested `shift.created` audit and document status audit where applicable.

  ## 6. Test Strategy

  ### Integration tests
  Run with `npm run test`.

  - **onboarding.test.ts** — verify/pass:
    - `candidateTasks` ordered 0-4 with types `[form_submission, document_upload, background_check, reference_check, platform_training]`.
    - `submitApplication` creates `applications` row, sets candidate `applied`, completes `form_submission` task.
    - `reviewApplication`: `approved → hr_review`, `rejected → rejected`, `needs_correction → application_draft` requiring `hrNotes`.
    - `sendOffer`: `hr_review → offer_sent`.
    - `acceptOffer`: `offer_sent → accepted`.
    - `hireCandidate`: creates `employeeProfile` with `adpSyncStatus: 'pending_credentials'`, schedules Clerk/ADP updates.
    - `completePlatformTraining` idempotency; `hasPlatformTrainingCompleted`; `resetPlatformTraining` admin-only.
    - `org:candidate` rejected from `scheduling.listShifts`.

  - **scheduling.test.ts** — verify/pass:
    - Adjacent shifts do not conflict; overlapping shifts conflict.
    - `excludeShiftId` prevents self-conflict on `updateShift`.
    - Completed/`billing_ready` shifts excluded from conflict.
    - `createShift` writes `shift.created` audit event.
    - Cross-caregiver conflict in `resolveCoverage`.
    - Caregiver blocked from `createShift`, `updateShift`, `deleteShift`, `assignShift`.
    - `updateShift` blocked for `submitted`/`approved` statuses; `deleteShift` blocked for non-`scheduled` statuses.

  - **forms.test.ts** — verify/pass:
    - `submitForm` throws `Missing required field: <id>` for missing/empty required fields.
    - `submitForm` throws when form is inactive.
    - `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt`; rejection requires reason and clears verifier fields.
    - `org:caregiver` blocked from `updateDocumentArchiveItem`.

  ### E2E tests
  Run with `E2E_FULL=1 npm run e2e:full` when `.env.e2e` credentials are configured.

  - **onboarding.spec.ts** (`serial`, `@auth`):
    - `beforeEach`: sign in as admin, call `resetE2ECandidate(page)` to seed fixtures and capture fixture IDs.
    - HR signs in, navigates to `/hr/candidates`, opens the seeded candidate.
    - Candidate signs in, navigates to `/onboarding/application`, submits the `Phase 2 Application` form.
    - HR reviews on `ApplicationReviewPage` (`advance-button`), then sends offer.
    - If offer/accept pages are stubs, call `candidates.sendOffer` and `candidates.acceptOffer` directly via `callConvexMutation`.
    - HR navigates to `/hr/candidates/:id/hire` and confirms hire (`confirm-hire-button`).
    - Verify training gate: new caregiver signing in should be redirected to `/onboarding/training` until `onboarding.completePlatformTraining` is called.
    - Call `onboarding.completePlatformTraining` directly (training page is a stub).
    - Candidate/caregiver reaches `/caregiver/today`.

  - **scheduling.spec.ts** (`serial`, `@auth`):
    - Admin signs in, seeds fixtures, navigates to `/scheduling`.
    - Creates a shift for the seeded caregiver.
    - Attempts to create an overlapping shift for the same caregiver and asserts conflict error.
    - Adds an availability window and asserts warning when creating a shift outside it.
    - Caregiver signs in and requests coverage for the shift.
    - Admin/coordinator resolves coverage to another caregiver and asserts success.

  - **documents.spec.ts** (`serial`, `@auth`):
    - Sign in as admin, call `resetE2ECandidate(page)` to seed the `pending_review` document.
    - Use `callConvexMutation` to call `documentArchive.updateDocumentArchiveItem` with status `verified`; assert `verifiedBy`/`verifiedAt` via `documentArchive.listDocumentArchive`.
    - Reject a second fixture document with a reason; assert `rejected` status and cleared verifier fields.
    - Test `expiringSoonDays` filter by seeding/querying an item with a near `expiresAt` date through `documentArchive.listDocumentArchive`.

  ### Gate commands to run and report

  ```bash
  npm run lint
  npm run typecheck
  npm run test
  E2E_FULL=1 npm run e2e:full
  npm run build
  ```

  Report format for each command: command name, exit code, pass/fail, and counts (tests passed/failed/skipped, E2E specs passed/failed).

  ## 7. Rollback / Verification Notes

  - **Rollback:** All changes are additive test files plus minor seed-helper verification. If E2E credentials are missing, `playwright.config.ts` already skips `@auth` specs via `grepInvert`, so the default pipeline stays green.
  - **Codegen:** Run `npx convex codegen` after any `convex/*.ts` edit; never edit `convex/_generated/*` by hand.
  - **Lint/style:** Enforce 2-space indent, single quotes, no semicolons. Run `npm run lint` and `npm run typecheck` before final sign-off.
  - **Local E2E:** If live Clerk is unavailable, the existing `local-harness` project runs `convex/session1Phase2Integration.test.ts` via `npm run test:phase2`. Do not extend the mock Clerk harness for this task.
  - **Final sign-off:** All gates pass with counts reported, or any failures are explicitly triaged and explained.

  ---

  **Verdict:** Proceed. The integration-test backbone already exists; the main implementation work is creating the three E2E specs and adjusting them to the reality that several candidate-facing onboarding pages and the document verify/reject UI are stubs.


[stderr]
• Let me start by reading the prompt file to understand what needs to be done.The file was 429 lines, but the prompt content seems to include internal monologue of various agents that was captured in the prompt file. The actual instructions are at the top (lines 1-51). Then there are candidate plans from c_plan_agentic, c_plan_qwen, and c_plan_kimi27 (which appears incomplete in this file).

  The user wants me to read the prompt file and carry out those instructions completely. The instructions are to "Synthesize them into ONE coherent, de-duplicated, best-of-all implementation plan" and output the final plan as markdown. This is a planning task, not implementation.

  So I need to:
  1. Read the actual relevant files before writing the plan (since I'm an agentic CLI backend)
  2. Synthesize the candidate plans into one coherent plan
  3. Output only the final plan as markdown

  Let me explore the repo thoroughly. I need to discover the actual files. I should launch explore agents in parallel for different areas, but I can also do direct reads since I have the paths.

  Actually, I should be efficient. Let me launch parallel explore agents to investigate:
  - Onboarding flow (convex/candidates.ts, convex/onboarding.ts)
  - Scheduling flow (convex/scheduling.ts)
  - Forms/Documents flow (convex/forms.ts, convex/documentArchive.ts)
  - Auth/Seed/Test harness (convex/authHelpers.ts, convex/seed.ts, tests/e2e/helpers/*)
  - Existing tests (convex/*.test.ts, tests/e2e/*.spec.ts)

  But since the user said "Do not ask questions" and auto mode is active, I should just proceed. Let me launch explore agents in parallel to get a comprehensive view, then synthesize the plan.

  Actually, the explore agents can do the heavy lifting. Let me launch 4-5 agents in parallel to cover different aspects. Then I can synthesize.

  Wait, but I can also read directly. Let me use a mix - launch explore agents for independent areas, and do some key direct reads myself.

  Let me first do a quick glob of key files to know what exists.

• The page.tsx glob didn't match because the project might use .tsx or a different structure. Let me explore in parallel. I'll launch explore agents to deeply investigate:
  1. Onboarding + candidates + auth + seed
  2. Scheduling 
  3. Forms + documents
  4. E2E harness + existing specs
  5. UI pages/routes

  Then I'll synthesize. Let me do this with Agent tool in parallel.Excellent, I have comprehensive exploration results. Now I need to synthesize a single coherent implementation plan. I have actual file/function/type names. 

  Key findings:
  1. Integration tests for onboarding, scheduling, forms largely already exist and cover most ACs. Some small gaps exist.
  2. E2E specs for onboarding/scheduling/documents don't exist yet.
  3. Seed.ts has resetE2ECandidate already with Phase 2 fixtures.
  4. Mock Clerk harness exists partially (globals set but app doesn't read them), so E2E mock mode is not fully functional.
  5. Several candidate onboarding pages are stubs, so E2E must use direct Convex mutation calls for stubbed steps.
  6. Document verify/reject UI doesn't exist - it's read-only in EmployeeProfilePage. So documents E2E must use direct Convex calls.
  7. The prompt asks to "carry out those instructions completely" but the instructions say produce a plan, not full code. So deliverable is the plan.

  I need to write a premium implementation plan with 7 sections, synthesizing the three candidate plans. Let me produce this as markdown.

  I should also do some direct verification of key findings to ensure accuracy, but the explore agents have done thorough work. I might read a couple of key files to confirm critical details like the seed function signature and auth helpers.

  Actually, I have enough. But let me quickly verify the seed.ts resetE2ECandidate signature and the E2E auth helpers to make sure the plan is accurate. Let me read those specific files.Good, I confirmed the auth helpers already support E2E_HR_EMAIL and E2E_CANDIDATE_EMAIL, and mock mode exists but the app doesn't read the mock globals. Let me check the rest of seed.ts for resetE2ECandidate.Let me read the resetE2ECandidate function and the seedE2ECandidateFixtures to verify the exact fixture details.I have all the information needed. Now I need to synthesize a coherent implementation plan.

  Key observations to incorporate:
  1. Integration tests already exist and cover most requested cases. The plan should emphasize gap-filling/verification rather than wholesale creation.
  2. E2E auth helpers already support HR/candidate credentials and mock mode, but mock mode isn't wired into the app.
  3. Seed.ts already has resetE2ECandidate with all required fixtures.
  4. UI pages: onboarding stubs exist, documents verify/reject UI doesn't exist, scheduling UI exists.
  5. The plan should be realistic: E2E specs will use a mix of UI navigation and direct Convex mutation calls where UI is missing.

  I need to produce a markdown plan with:
  1. Restated goal + numbered ACs
  2. Discovery notes (with actual function/type names)
  3. Alternatives considered
  4. Files to create/modify table
  5. Edge cases
  6. Test strategy
  7. Rollback/verification notes

  I should also note that this is a plan only, not full code, per the prompt instructions.

  Let me write the final plan.

To resume this session: kimi -r session_f891c33f-ebb4-43e4-a0ad-2589fb122493
