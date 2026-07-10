# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_144423\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 610.0s rc=0

• # ATRIA-X Phase 2 E2E & Integration Test Plan

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Add comprehensive, idempotent Phase 2 test coverage for the candidate-to-caregiver, scheduling, document-archive, and forms flows, plus the supporting E2E auth/seed infrastructure, while keeping all changes inside the pipeline and preserving the existing single-quote / no-semicolon / 2-space style.

  | ID | Acceptance Criterion |
  |---|---|
  | **AC-1** | `tests/e2e/onboarding.spec.ts` exists and exercises the full candidate-to-caregiver flow: invite → application submitted → HR review → offer → accept → hire → training gate → complete training → lands on `/caregiver/today`. |
  | **AC-2** | `tests/e2e/scheduling.spec.ts` exists and covers: admin creates a shift, conflict detection blocks an overlapping shift, caregiver availability is reflected, and a coverage request is opened and resolved. |
  | **AC-3** | `tests/e2e/documents.spec.ts` exists and covers: verify a document, reject a document with reason, and toggle/list expiring-soon documents. |
  | **AC-4** | `tests/e2e/helpers/auth.ts` and `tests/e2e/helpers/env.ts` support `org:hr` and `org:candidate` sign-ins, plus a mock-Clerk fallback when live credentials are unavailable. |
  | **AC-5** | `convex/onboarding.test.ts` adds coverage for: candidate task ordering, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` (creates `employeeProfile` with `adpSyncStatus: 'pending_credentials'`), `completePlatformTraining` idempotency, `hasPlatformTrainingCompleted`, `resetPlatformTraining`, and `org:candidate` cannot call `scheduling.listShifts`. |
  | **AC-6** | `convex/scheduling.test.ts` adds coverage for: `checkShiftConflict` adjacent/overlap/excluded/completed cases, `createShift` writes an audit event, cross-tenant caregiver conflict, caregiver role is rejected for admin/coordinator-only scheduling ops, and update/delete/coverage-request guards. |
  | **AC-7** | `convex/forms.test.ts` adds coverage for: `submitForm` rejects missing required fields and inactive forms, `updateDocumentArchiveItem` writes `verifiedBy`/`verifiedAt`, and `org:caregiver` cannot call archive update. |
  | **AC-8** | `convex/seed.ts` adds idempotent Phase 2 fixtures: one candidate in `submitted` status with a seeded application, one availability window, one `open` coverage request, one active `formDefinition` with fields `name` (required), `experience` (required), `notes` (optional), and one `documentArchiveItem` in `pending_review` / `active` status. |
  | **AC-9** | All Convex edits are followed by `npx convex codegen`; code style remains single quotes, no semicolons, 2-space indent. |
  | **AC-10** | Gates run and reported: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e:full` (or `npm run e2e` with `.env.e2e`), `npm run build`. Actual pass/fail and test counts are included in the PR / final report. |

  ---

  ## 2. Discovery Notes

  Files were inspected directly. Key contracts found:

  ### Candidate / onboarding backend
  - `convex/candidates.ts`
    - `inviteCandidate` (action), `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate`, `addCandidateDocument`, `listCandidateTasks`, `listCandidateTasksForHR`.
    - Status machine: `invited → applied → hr_review → offer_sent → accepted → hired`.
    - `hireCandidate` upserts a `tenantMembers` row with `role: 'org:caregiver'`, upserts an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`, schedules `internal.candidates.updateClerkMembershipRole`, and schedules `internal.adpOutbound.adpSyncWorker`.
  - `convex/onboarding.ts`
    - `completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`.
    - Default training id is `'platform_training'`.
  - `convex/authHelpers.ts`
    - `requireTenantRole`, `requireTenantRoleAction`, `assertTenantDoc`, `ensureTenantMember`, `TenantRole` union.
    - Identity injection shape for tests: `{ subject, org_id, org_role }`.

  ### Scheduling backend
  - `convex/scheduling.ts`
    - `createShift`, `updateShift`, `deleteShift`, `assignShift`, `listShifts`, `listCaregiverShifts`.
    - Availability: `addAvailabilityWindow`, `updateAvailabilityWindow`, `deleteAvailabilityWindow`, `listMyAvailability`, `listAvailabilityForScheduling`.
    - Coverage: `requestCoverage`, `resolveCoverage`, `listCoverageRequests`.
    - Conflict helper: `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`.
    - `NON_CONFLICT_STATUSES = ['scheduled','in_progress','submitted','approved']`; terminal/`billing_ready` shifts are excluded from conflict detection.

  ### Forms / documents backend
  - `convex/forms.ts`
    - `createFormDefinition`, `updateFormDefinition`, `deactivateFormDefinition`, `submitForm`, `listFormSubmissions`, `getFormSubmission`.
    - `submitForm` validates `field.required` and rejects inactive forms.
  - `convex/documentArchive.ts`
    - `listDocumentArchive`, `updateDocumentArchiveItem`.
    - Allowed statuses: `active`, `verified`, `rejected`; rejected requires `rejectionReason`; `verified` writes `verifiedBy`/`verifiedAt`.

  ### Seed / E2E harness
  - `convex/seed.ts`
    - Exports `seedAgency`, `seedCaregiverShifts`, `seedE2E`, `resetE2EShifts`.
    - Uses deterministic fixture date `REF_TODAY = '2024-01-15'` and deletes/re-creates fixture shifts by `(clientId, caregiverId, scheduledStart)` for idempotency.
  - `tests/e2e/helpers/auth.ts`
    - `signInWithClerk(page, email, password, orgId)` via Clerk ticket API.
    - `resetE2EShifts(page)` calls `seed:resetE2EShifts` over HTTP with an admin token.
  - `tests/e2e/helpers/env.ts`
    - `e2eCredentialsAvailable()` checks only admin/coordinator/caregiver env vars; no HR/candidate support yet.
  - `playwright.config.ts`
    - `workers: 1`, `fullyParallel: false`, `@auth` tag inverted when `E2E_FULL` is not set or credentials are missing.

  ### UI routes / components inspected
  - `src/app/router.tsx`: `/hr/candidates`, `/hr/candidates/:candidateId`, `/hr/candidates/:candidateId/hire`, `/scheduling`, `/caregiver/availability`, `/caregiver/today`, `/onboarding/application`, `/onboarding/training`.
  - `CandidatePipelinePage`, `ApplicationReviewPage`, `HireConvertPage`, `SchedulingPage`, `ShiftEditorModal`, `ShiftPacketPanel`, `CoverageRequestsPanel`, `AvailabilityPage`, `CaregiverTodayPage`, `ApplicationFormPage`, `InviteCandidateModal`.
  - No `data-testid` attributes exist in `src/features/hr`, `src/features/onboarding`, or `src/features/scheduling` components; existing E2E-friendly IDs are only in Phase 1 caregiver components (`shift-card-*`, `clock-in-start-button`, etc.).

  ### Existing test baseline (verified by running gates)
  - `npm run lint`: passes.
  - `npm run typecheck`: **fails** with a pre-existing error in `src/features/onboarding/pages/ApplicationFormPage.tsx(19,38)`: `Property 'yearsExperience' does not exist on type 'Doc<"candidates">'` (the field is not in `convex/schema.ts`). This blocks `npm run build` and must be fixed as a prerequisite.
  - `npm run test`: **404 tests pass / 55 files pass** (baseline before any changes).

  ---

  ## 3. Alternatives Considered

  | Approach | Why it was rejected / not chosen |
  |---|---|
  | **Pure live-Clerk E2E for candidate/HR flows** | The repo only has env vars for admin/coordinator/caregiver. Adding real Clerk HR/candidate users is environment-dependent and would break local/CI runs. |
  | **Implement full UI for offer acceptance, training, and document archive just to drive E2E** | Out of scope for a test task and would expand the blast radius. |
  | **Drive every transition through direct Convex HTTP calls and assert page URLs** | Fastest but not a true E2E test of the React UI. |

  **Chosen approach:** **Hybrid browser E2E**.
  - Use real `signInWithClerk` when `E2E_HR_EMAIL/E2E_CANDIDATE_EMAIL` are present; otherwise use a new mock-Clerk harness that injects a fake `window.Clerk` identity and pre-seeds the tenant.
  - Interact with existing UI for invite, application form, review, hire, scheduling, availability, and caregiver today.
  - For stubbed candidate-only pages (`/onboarding/offer`, `/onboarding/training`), use authenticated direct Convex mutation calls to advance state, then assert the UI result (e.g., role change lands the user on `/caregiver/today`). This gives end-to-end coverage without building new pages.

  ---

  ## 4. Files to Create / Modify

  | File | Change Type | What Changes |
  |---|---|---|
  | `tests/e2e/onboarding.spec.ts` | Create | Full candidate-to-caregiver flow with UI + direct mutation fallback for stub pages. |
  | `tests/e2e/scheduling.spec.ts` | Create | Admin creates shift, conflict blocked, availability reflected, coverage requested/resolved. |
  | `tests/e2e/documents.spec.ts` | Create | Verify/reject and expiring-soon assertions (uses direct archive mutation if UI controls absent). |
  | `tests/e2e/helpers/auth.ts` | Modify | Add `E2E_HR_EMAIL/PASSWORD`, `E2E_CANDIDATE_EMAIL/PASSWORD`, `signInAsHR`, `signInAsCandidate`, and a `mockSignInAsRole` fallback that stubs `window.Clerk`. |
  | `tests/e2e/helpers/env.ts` | Modify | Extend `e2eCredentialsAvailable()` to include HR/candidate; add `useMockE2E()` flag. |
  | `tests/e2e/global-setup.ts` | Modify | When live credentials exist, extract HR/candidate Clerk user ids and upsert `tenantMembers`; in mock mode seed them deterministically. |
  | `tests/e2e/helpers/seed.ts` (new) | Create | Small helper to call `seed:resetE2EShifts` and a new `seed:resetE2ECandidate` over HTTP. |
  | `convex/onboarding.test.ts` | Modify | Add lifecycle + training + guard cases listed in AC-5. |
  | `convex/scheduling.test.ts` | Modify | Add conflict/audit/coverage-guard cases listed in AC-6. |
  | `convex/forms.test.ts` | Modify | Add submit-form validation and archive-metadata cases listed in AC-7. |
  | `convex/seed.ts` | Modify | Add `seedPhase2Fixtures` / expose `resetE2ECandidate` mutation with idempotent Phase 2 fixtures. |
  | `src/features/onboarding/pages/ApplicationFormPage.tsx` | Modify | Fix `candidate.yearsExperience` type error (remove or cast) so `typecheck`/`build` pass. |
  | `src/features/hr/pages/ApplicationReviewPage.tsx` | Modify | Add minimal `data-testid` attributes on the document list and decision buttons for E2E. |
  | `src/features/hr/pages/CandidatePipelinePage.tsx` | Modify | Add `data-testid="invite-candidate-button"` and row locators. |
  | `src/features/hr/pages/HireConvertPage.tsx` | Modify | Add `data-testid="confirm-hire-button"`. |
  | `src/features/scheduling/pages/SchedulingPage.tsx` | Modify | Add `data-testid` on Add-shift button, shift cards, and coverage panel. |
  | `src/features/scheduling/components/ShiftEditorModal.tsx` | Modify | Add `data-testid` on save button and availability banner. |
  | `src/features/scheduling/components/CoverageRequestsPanel.tsx` | Modify | Add `data-testid` on assign select/button. |
  | `src/features/scheduling/pages/AvailabilityPage.tsx` | Modify | Add `data-testid` on day add/save controls. |

  *Note: UI test-id additions are the minimum needed to make E2E locators stable; no product logic changes.*

  ---

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  - **Multi-tenancy:** Every backend call must pass `clerkOrgId` and go through `requireTenantRole`/`assertTenantDoc`. Tests must include cross-tenant negative cases (e.g., candidate A in org A cannot read candidate B in org B; `submitForm` with a foreign `formDefinitionId` throws `Forbidden: cross-tenant access denied.`).
  - **Role injection:** Integration tests use `t.withIdentity({ subject, org_id, org_role })`. E2E uses either real Clerk tickets or the mock harness; sessions must be cleared between role switches.
  - **Idempotency:** `seed.ts` must look up existing records by natural key before inserting. `completePlatformTraining` must return the existing completion on duplicate calls. `hireCandidate` must patch an existing `employeeProfiles` row if one exists. `inviteCandidate` must reuse an existing candidate row if the email already exists and is not active.
  - **ADP / Clerk side effects:** `hireCandidate` schedules `internal.adpOutbound.adpSyncWorker` and `internal.candidates.updateClerkMembershipRole`. Integration tests must stub `fetch`, set ADP env vars, use `vi.useFakeTimers()`, and call `t.finishAllScheduledFunctions(vi.runAllTimers)`.
  - **PHI / PII:** Use fake emails (`*.test`), fake names, fake client addresses. No real credentials in test code.
  - **Candidate task ordering:** `candidateTasks` are sorted by the `order` field (0–4). Assertions must verify `type` order: `form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`.
  - **Shift conflict semantics:** `billing_ready` shifts are not conflicts; the current shift (via `excludeShiftId`) is skipped; adjacent start/end times are allowed.
  - **Coverage guards:** Only the assigned caregiver can `requestCoverage`; only `org:admin`/`org:coordinator` can `resolveCoverage`; coverage can only be requested for `scheduled` shifts; resolving a filled request or reassigning to a conflicting caregiver must throw.

  ---

  ## 6. Test Strategy

  ### Integration tests (Vitest + `convex-test`)
  - Pattern per file:
    ```ts
    const modules = import.meta.glob('./**/*.*s')
    function createTestConvex() { return convexTest({ schema, modules }) }
    function asAdmin(t, id, org) { return t.withIdentity({ subject: id, org_id: org, org_role: 'org:admin' }) }
    ```
  - Seed helpers create a `tenants` row, `tenantMembers`, and any child rows inside `t.run`.
  - For actions that call Clerk/ADP:
    - `vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')`
    - `vi.stubEnv('APP_URL', 'http://localhost')`
    - `vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ... }) })))`
    - `vi.stubEnv('ADP_MOCK_ADAPTER', 'true')` and related ADP vars.
    - `vi.useFakeTimers()` + `await t.finishAllScheduledFunctions(vi.runAllTimers)`.

  ### E2E tests (Playwright)
  - Tag specs with `@auth` so Playwright inverts them when credentials are missing.
  - Each spec calls `test.beforeEach` to reset fixtures via `resetE2EShifts` and a new `resetE2ECandidate`.
  - Sign in per role using `signInWithClerk` or `mockSignInAsRole`; always call `signOut` between roles.
  - Use deterministic selectors: add `data-testid` attributes rather than text-based locators.
  - For stubbed candidate pages, advance state with an authenticated fetch to `candidates.acceptOffer` / `onboarding.completePlatformTraining`, then reload/verify the UI.

  ### Gate commands
  Run after all changes and after `npx convex codegen`:

  ```bash
  npm run lint
  npm run typecheck
  npm run test
  E2E_FULL=1 npm run e2e:full   # requires .env.e2e
  npm run build
  ```

  Report:
  - `lint`: pass / fail
  - `typecheck`: pass / fail
  - `test`: `<count> passed` / failures
  - `e2e`: `<count> passed` / failures
  - `build`: pass / fail

  ---

  ## 7. Rollback / Verification Notes

  - **Branch:** Create a feature branch (e.g., `feature/phase-2-tests`) before editing. The current working tree is on `feature/phase-2-worker-onboarding`.
  - **Convex codegen:** Any hand-edit to `convex/*.ts` must be followed by `npx convex codegen`. Do not edit `convex/_generated/*` by hand.
  - **Prerequisite fix:** `src/features/onboarding/pages/ApplicationFormPage.tsx` has a type error that blocks `typecheck` and `build`. Fix it before declaring Phase 2 complete.
  - **E2E credentials:** If `.env.e2e` is missing, the `@auth` specs are automatically skipped; full E2E verification requires `E2E_HR_EMAIL`, `E2E_HR_PASSWORD`, `E2E_CANDIDATE_EMAIL`, `E2E_CANDIDATE_PASSWORD` in addition to the existing admin/coordinator/caregiver vars.
  - **Idempotency check:** Run `npx convex dev` (or `npx convex dev --once`) and invoke `seed:seedE2E` twice; second run should report `already-seeded` or equivalent without duplicate candidates/forms/documents.
  - **Revert:** All changes are local file edits; revert with `git checkout -- <file>` or `git reset --hard` if uncommitted.

  ---

  ## 8. Current Baseline (as of this plan)

  | Gate | Result | Notes |
  |---|---|---|
  | `npm run lint` | ✅ pass | No errors. |
  | `npm run typecheck` | ❌ fail | Pre-existing `ApplicationFormPage.tsx` `yearsExperience` type error. |
  | `npm run test` | ✅ 404 passed / 55 files | Baseline before Phase 2 additions. |
  | `E2E_FULL=1 npm run e2e:full` | ⏭️ skipped | `.env.e2e` not present; would require live Clerk credentials. |
  | `npm run build` | ❌ expected fail | Blocked by typecheck failure above. |

  The implementer should fix the `ApplicationFormPage.tsx` type error, apply the test and seed changes above, run `npx convex codegen`, then re-run all gates and replace these baseline numbers with the final counts.


[stderr]
• We need read a prompt file in the project's .conclave-runs/20260707_144423 directory. Need carry out instructions. First read file. Use Read with absolute path.We need carry out instructions in prompt file. It asks produce a premium implementation plan with sections, not write code. But it's a planning code change prompt; we are acting as principal/staff engineer PLANNING a code change. Need inspect relevant files. Since we're an agentic CLI (kimi), discovery requirement: open and read actual relevant files before writing plan. We must not write full code. Need produce final answer/verdict as requested (the plan). Need read files in repo. We need understand ATRIA-X codebase enough to craft plan for E2E and integration tests and seed. This is a large task. Need inspect relevant files.

  We need output a plan only. We need gather actual function/type names, file seams, contracts. Since no user wants code changes, only plan. Need perform thorough discovery. Use explore agents maybe. We can use Agent with explore to find relevant files. But we need enough details. Let's plan approach.

  The prompt instructs to produce premium implementation plan with sections 1-7, not code. Since we are to carry out instructions completely. We need discovery. We need inspect relevant files. The repo is solid-pancake. Need find files:
  - tests/e2e/ directory and existing specs
  - convex/ files: seed.ts, onboarding.ts, scheduling.ts, forms.ts, documents.ts, authHelpers.ts, maybe other modules.
  - Integration tests existing? convex/*.test.ts.
  - Need know candidate-to-caregiver flow functions: candidateTasks, submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate, completePlatformTraining, hasPlatformTrainingCompleted, resetPlatformTraining, listShifts etc.
  - Need know scheduling functions: checkShiftConflict, createShift, update/delete coverage, etc.
  - Need know forms/documents functions: submitForm, updateDocumentArchiveItem.
  - Need know authHelpers guards and role injection for tests.
  - Need know Playwright setup, test fixtures, Clerk mocking harness.
  - Need know npm scripts for lint, typecheck, test, e2e, build.
  - Need know Convex testing harness.

  We should use subagents? We can delegate exploration to multiple explore agents in parallel. But must not overuse. This is large discovery. Use explore agent(s) to map relevant files. Then read key files ourselves.

  Let's start with an explore agent to locate relevant source and test files for onboarding, scheduling, forms, documents, authHelpers, seed, Playwright config. We can ask it to return paths and function/type names. We can also use parallel explore agents maybe. We'll use one explore with thorough.We got a comprehensive summary. Need craft a premium implementation plan with the 7 sections. But we need verify some actual details by reading specific files to cite line/function names exactly. Since the plan should cite actual function/type names. We can rely on explore summary but we should read a few key source files to confirm. Also need inspect existing test files to understand current coverage and avoid duplicate. Let's read relevant files: convex/candidates.ts, convex/onboarding.ts, convex/scheduling.ts, convex/forms.ts, convex/documentArchive.ts, convex/authHelpers.ts, convex/seed.ts, maybe tests/e2e helpers, package.json, playwright config. Also existing tests: convex/onboarding.test.ts, convex/scheduling.test.ts, convex/forms.test.ts, convex/documentArchive.test.ts, convex/candidates.test.ts. Need understand what already exists so plan can be focused on adding missing tests, not duplicate. The prompt tasks list specific tests. Let's read existing integration tests to see if they already cover some; plan likely says add missing cases.

  Need keep plan focused only on task requires. Do not write full code. Need include sections 1-7.

  Let's read in parallel as many files as possible. Use Read. Need absolute paths.Need read rest of candidates.ts (lines 1000-1163). Also read authHelpers.ts, seed.ts, existing tests, e2e helpers, playwright config, package.json. Let's do parallel reads.We have lots. Need existing test files to understand current state and avoid duplicate. Let's read convex/onboarding.test.ts, scheduling.test.ts, forms.test.ts, documentArchive.test.ts, candidates.test.ts maybe. Also tests/e2e/helpers/auth.ts and env.ts. Also maybe schema.ts for data model. Let's read these.Need read rest of candidates.test.ts lines 1000-1079. Also need see schema.ts for data model fields, especially employeeProfiles, candidates, candidateTasks, etc. Also maybe frontend pages routes for E2E. Also need understand members.ts (me query). And adpOutbound/adpsync maybe. Also need any existing e2e spec pattern to follow. Let's read candidates.test.ts remainder, schema.ts, router.tsx maybe.We have enough to write plan. Need produce plan with sections 1-7. We should also note existing coverage so plan is focused on missing. The prompt wants comprehensive E2E and integration tests. We can map existing integration tests vs requested and identify gaps. Also seed.ts update.

  Need understand data-testids for UI maybe. Need inspect frontend pages for HR pipeline etc maybe data-testids to know E2E feasibility. The prompt mentions E2E candidate-to-caregiver flow through UI. However some pages are stubs. Since it's a plan, we can note UI dependencies and recommend using direct Convex calls for unimplemented parts or mock Clerk harness. Need maybe read onboarding pages to see if they have testids. Could explore quickly. But plan can state that E2E UI requires data-testid additions; if not present, tests will be brittle. But as plan we can outline tests with locator strategies and note required testids.

  Need know if E2E_HR_EMAIL etc exists in env. The prompt says use E2E_HR_EMAIL/E2E_HR_PASSWORD and E2E_CANDIDATE_EMAIL/E2E_CANDIDATE_PASSWORD if available. Current auth helpers have admin/coordinator/caregiver. We may need to add HR and candidate credentials to helpers/env.ts and global setup. Plan should include that.

  Need know how to mock Clerk harness if env not available. The codebase uses real Clerk. There's no mock harness. For E2E plan, propose adding mock mode via a custom page context that sets window.Clerk user with role injection (like stubbing `window.Clerk`). Or use existing local harness project? There is a `session1-phase2-schema.spec.ts` local harness. Need maybe inspect that and run-playwright scripts. But maybe not necessary.

  Let's inspect `tests/e2e/session1-phase2-schema.spec.ts` to see local harness pattern. Also `run-playwright-with-env.js`.Need also inspect members.ts (api.members.me) used in actions. And maybe platformTrainingCompletions.ts. Also need check existing e2e phase1-lifecycle.spec.ts for patterns, maybe sign in etc. But not critical. Let's read members.ts quickly.We have enough details. Need produce a premium implementation plan. Since user says "Read the prompt file ... and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested." The requested output is the plan itself, not actually implementing code. We need follow instructions: produce premium implementation plan with sections 1-7. It says "Do NOT write the full code." So final answer is plan. We must include discovery notes with actual verified files and function names. We should be thorough.

  Need consider that this is a planning task. Need include acceptance criteria, discovery notes, alternatives, files table, edge cases, test strategy, rollback/verification notes. Also probably mention gate commands and report pass/fail. Since not actually implementing, cannot report actual counts, but can include the commands to run. The prompt says "Run and report pass/fail for npm run lint, typecheck, test, e2e (E2E_FULL=1), build; report actual counts." But since this is plan only, we can note that implementer must run these and report counts. However user asks "carry out those instructions completely." But instructions include produce plan; it also says do not write full code. Running tests would be part of acceptance criteria but would be after implementation. Since we are not writing code, we can't run tests meaningfully (except current state). We can run current tests maybe to baseline counts. Should we run lint/typecheck/test/e2e now? The plan is pre-implementation. The prompt is for a planning agent. It expects plan. It explicitly says "Produce a premium implementation plan..." and "Do NOT write the full code." So we don't need to run tests now. But we can include in verification notes the commands.

  However the final line says "Output your final answer/verdict as requested." Maybe the prompt expects a plan, so final answer is plan. Need cite actual file/function names.

  Let's craft plan carefully.

  Need acceptance criteria numbered AC-1... Should map to tasks.

  Restated goal: Add Phase 2 E2E and integration test coverage and idempotent seed fixtures for ATRIA-X candidate-to-caregiver, scheduling, documents, and forms flows, with all tests passing lint/typecheck/test/e2e/build gates.

  Acceptance criteria:
  - AC-1 E2E onboarding spec exists at tests/e2e/onboarding.spec.ts and exercises candidate-to-caregiver flow using either live credentials or a mock Clerk harness; seeds one agency tenant, one org:hr user, one org:admin, one org:caregiver; tests invite → submitted → review → offer → accept → hire → training gate → complete training → /caregiver/today.
  - AC-2 E2E scheduling spec exists at tests/e2e/scheduling.spec.ts covering admin creates shift, conflict detection, caregiver availability, coverage request resolved.
  - AC-3 E2E documents spec exists at tests/e2e/documents.spec.ts covering verify/reject/toggle expiring soon.
  - AC-4 Integration tests in convex/onboarding.test.ts cover candidateTasks order, submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate creates employeeProfile + ADP sync pending_credentials, completePlatformTraining idempotency, hasPlatformTrainingCompleted, resetPlatformTraining, org:candidate cannot listShifts.
  - AC-5 Integration tests in convex/scheduling.test.ts cover checkShiftConflict adjacent/overlap/excluded/completed, createShift audit, cross-caregiver conflict, caregiver role required, update/delete coverage guards.
  - AC-6 Integration tests in convex/forms.test.ts cover submitForm missing/inactive fields, updateDocumentArchiveItem verifyBy/verifiedAt, org:caregiver cannot call.
    Wait updateDocumentArchiveItem belongs in documents not forms. The prompt groups it under forms.test.ts. Need note that the existing documentArchive.test.ts already covers updateDocumentArchiveItem; consider moving/adding to forms.test.ts or keep. AC should align.
  - AC-7 convex/seed.ts updated idempotently with Phase 2 fixtures: candidate in 'submitted' with seeded application, one availability window, one coverage request 'open', one formDefinition with 3 fields (name required, experience required, notes optional), one documentArchiveItem pending_review.
  - AC-8 Code style single quotes, no semicolons, 2-space indent.
  - AC-9 After changes run `npx convex codegen`.
  - AC-10 Gates pass: npm run lint, typecheck, test, e2e (E2E_FULL=1), build; report actual counts.

  Need discovery notes with actual function/type names. We can note verified files. Provide citations.

  Alternatives: use real Clerk E2E credentials vs mock Clerk harness. Chosen approach: extend existing live Clerk harness for full E2E when credentials available; add a local mock harness fallback that injects a fake `window.Clerk` with roles and uses direct Convex seed mutations so tests can run in CI without Clerk. Because current env doesn't have candidate/HR credentials. Or use direct API calls in E2E to bypass UI? The task says Playwright E2E. But given stub pages, maybe use UI for available pages and direct Convex mutation for missing UI. We can propose hybrid: sign in as needed roles, navigate where UI exists, call backend directly where UI is stub. Need mention safest/simplest.

  Files to create/modify table:
  - tests/e2e/onboarding.spec.ts (create)
  - tests/e2e/scheduling.spec.ts (create)
  - tests/e2e/documents.spec.ts (create)
  - tests/e2e/helpers/auth.ts (modify: add E2E_HR_EMAIL/PASSWORD, E2E_CANDIDATE_EMAIL/PASSWORD, signInAsHR, signInAsCandidate, mock harness)
  - tests/e2e/helpers/env.ts (modify: add credentials check for HR/candidate, mock mode flag)
  - tests/e2e/global-setup.ts (modify: seed candidate and HR fixture members if credentials available; or mock harness)
  - convex/onboarding.test.ts (modify: add missing tests: candidateTasks order? Actually candidates.test.ts has candidateTasks order; onboarding.test.ts needs candidate-to-caregiver lifecycle? The prompt specifically says convex/onboarding.test.ts for candidateTasks order etc. But existing candidates.test.ts already covers much. Need decide plan: add the missing cases to onboarding.test.ts as requested, maybe duplicating but focused on onboarding module. Could also consolidate. Since prompt explicitly says tests in convex/onboarding.test.ts, we should add them there. Need note some overlap with candidates.test.ts but keep per prompt.
  - convex/scheduling.test.ts (modify: add missing coverage cases)
  - convex/forms.test.ts (modify: add submitForm missing/inactive fields, updateDocumentArchiveItem verifyBy/verifiedAt, org:caregiver cannot call)
  - convex/seed.ts (modify: add Phase 2 fixtures)
  - convex/_generated/* (auto via codegen)
  - playwright.config.ts maybe modify to add mock-harness project? Could keep. Add environment variable for mock mode. Could use `test.slow`, tags. Not necessarily.

  Edge cases: multi-tenancy (cross-tenant IDs rejected), role guards, idempotent seed (don't duplicate), ADP scheduler in hireCandidate uses vi.runAllTimers, mock fetch for Clerk membership update, training idempotency, inactive form rejection, document rejection reason required, expiring-soon cutoff, shift conflict excludes billing_ready and current shift, coverage only for own scheduled shifts, PHI? Not much.

  Test strategy: specific unit/integration/e2e cases and gate commands.

  Rollback/verification notes: git branch, codegen, run gates.

  Need ensure we don't ask questions. Output final plan.

  Need be concise but thorough. Use markdown. No code. Cite exact function names and file paths. Mention verified actual files.

  Let's also maybe run a quick check for existing data-testids on HR pages to inform E2E. We could grep in src/features/hr. But maybe enough to mention that pages may lack testids; plan to add them if needed. However the task says do not edit repo outside pipeline. Since plan is not code, we can note required UI testids. But maybe we should inspect to be accurate. Let's quickly search for data-testid in HR and scheduling pages.No data-testids in HR, onboarding, scheduling features. So E2E tests will be brittle. The plan should recommend adding `data-testid` attributes to relevant UI components as part of the E2E work (this is editing repo but within pipeline). Since the prompt's task includes E2E tests; UI testids are necessary. We can note that. But the plan should focus only on what task requires. We can include a table entry for UI files to add testids. However the prompt says "Do not edit the repo outside the pipeline." UI testids are within pipeline. We can recommend minimal testid additions.

  Need also note that onboarding pages CandidateOnboardingPage and OfferAcceptancePage are stubs; E2E cannot fully exercise UI. So propose using direct Convex API calls for those transitions or implementing stubs. Since plan only, mention.

  Maybe inspect current features to see what's available. Use explore agent quickly? But we have enough. Could inspect CandidatePipelinePage, ApplicationReviewPage, HireConvertPage, SchedulingPage, AvailabilityPage, Document archive page? There may be no document archive page. Hmm. The documents E2E spec might need UI page; maybe not present. Need check if there is a documents archive UI. Let's search for document archive page.Need consider TodoList? We are just producing plan; not multi-step implementation. Not needed.

  Need inspect a few UI pages to know if they are stubs and what testids might be needed. Let's read CandidatePipelinePage, ApplicationReviewPage, HireConvertPage, ApplicationFormPage, TrainingPage, SchedulingPage, AvailabilityPage, CaregiverTodayPage maybe. But plan can be high-level. However for E2E test strategy, we need know what UI interactions exist. Let's read them quickly.Need inspect SchedulingPage, AvailabilityPage, CaregiverTodayPage for E2E. Also maybe InviteCandidateModal. Let's read.We have enough to produce plan. Need note that ApplicationFormPage currently submits fields {fullName, dateOfBirth, homeAddress, yearsExperience}; the backend submitApplication stores fields as-is. For E2E, can fill those inputs.

  Need note that OfferAcceptancePage and CandidateOnboardingPage are stubs; training page stub. So E2E full candidate-to-caregiver flow through UI cannot be completed without UI work. Plan should propose either implementing minimal UI pages or using direct Convex API calls for stubbed transitions. Since task is tests, maybe use direct API calls to transition statuses where UI missing, while testing UI parts that exist (invite, application, review, hire, caregiver today). But prompt says "test invite candidate → submitted → review → offer → accept → hire → training gate → complete training → /caregiver/today." It might expect using UI where possible. We can plan to add minimal data-testids and, for stub pages, call backend directly (or implement stubs). The plan should state this clearly.

  Need consider documents E2E. There is no document archive UI for admin to verify/reject. There is ApplicationReviewPage showing documents list but no verify/reject buttons. So E2E documents spec may need to add UI controls or use direct API. Plan should note.

  Need scheduling E2E: SchedulingPage has Add shift button, ShiftEditorModal, ShiftPacketPanel, CoverageRequestsPanel. Need inspect those modals to know testability. We can read ShiftEditorModal, CoverageRequestsPanel maybe. But plan can mention adding testids to modal. Let's quickly inspect.Need also inspect ShiftPacketPanel to see if it has request coverage button.Now we have a good understanding. Need write plan.

  Need be careful with ACs: The prompt asks (1) Playwright E2E candidate-to-caregiver flow; (2) scheduling flow; (3) documents archive; (4) integration tests in convex/onboarding.test.ts; (5) scheduling.test.ts; (6) forms.test.ts; (7) update seed.ts. We should create AC for each.

  Also need include the "Do not edit repo outside pipeline" constraint. The plan should respect that.

  Potential conflicts: Existing tests already cover many requested integration cases. We can note existing coverage and plan to add missing ones. For convex/onboarding.test.ts, existing tests cover training idempotency, has, reset, role blocks. Missing: candidateTasks order (but that's in candidates.test.ts), submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate creates employeeProfile + ADP sync pending_credentials, completePlatformTraining idempotency, hasPlatformTrainingCompleted, resetPlatformTraining, org:candidate cannot listShifts. The prompt lumps candidate-to-caregiver integration tests in onboarding.test.ts. Since candidates.test.ts already has many, but we can add duplicates or migrate. We should plan to add them to onboarding.test.ts per prompt, but maybe avoid exact duplicates; add focused cases where not already covered. However the implementer may decide to consolidate. Plan can say: add to convex/onboarding.test.ts the lifecycle cases (or if already in candidates.test.ts, ensure they remain and reference them). But prompt explicitly says tests in convex/onboarding.test.ts; we should add them there. We can note that candidates.test.ts already has overlapping coverage, but to satisfy prompt we will add onboarding-specific suite.

  Need forms.test.ts: submitForm missing/inactive fields already covered. updateDocumentArchiveItem verifyBy/verifiedAt belongs in documentArchive.test.ts (already covered). org:caregiver cannot call updateDocumentArchiveItem already covered. So maybe the prompt is not fully aware. Plan can say add any missing assertions; forms.test.ts may need to test org:caregiver cannot call submitForm? Actually submitForm allowed for caregiver. "org:caregiver cannot call" likely refers to updateDocumentArchiveItem. We'll include it in forms.test.ts as requested, or better add a cross-reference.

  Scheduling.test.ts: missing tests? Existing covers adjacent, overlap, same start, completed not conflict, exclude, helper, createShift roles, cross-tenant caregiver, availability warning, update submitted block, delete in progress block, request coverage wrong caregiver, availability owner, listShifts rejects caregiver/joins names, coverage lifecycle. Missing specifically: "createShift audit" maybe verify audit event; "cross-caregiver conflict" (caregiverId from other tenant already covered), "caregiver role required" (createShift rejects caregiver), "update/delete coverage guards" (update/delete coverage? coverage request status guards? resolveCoverage non-open? requestCoverage non-scheduled? caregiver role required for requestCoverage? Might add. checkShiftConflict excluded/completed already covered. So plan to add audit event assertion and coverage guards.

  Documents E2E: Need admin UI to verify/reject. There is no archive page; ApplicationReviewPage shows docs but no verify/reject. We can plan to either add minimal verify/reject buttons in ApplicationReviewPage document list or use direct Convex API in E2E. Since prompt says E2E, use UI if possible. But adding UI is beyond tests. Plan can include adding `data-testid` and verify/reject buttons? The prompt didn't ask for UI features. It says verify/reject/toggle expiring soon. We can test via direct API call in E2E. Or note that if document actions UI not present, E2E will call `documentArchive.updateDocumentArchiveItem` directly. But "E2E" usually means through browser; direct API is integration. We'll be pragmatic: use Playwright page with an admin signed in, call a small page function that invokes Convex via window? Simpler: use the same fetch pattern as resetE2EShifts but authenticated. That's an API call, not UI. We can frame as "backend-driven E2E assertions over HTTP" because UI controls don't exist yet.

  But the prompt mentions "Playwright E2E document archive" maybe expects UI. We can plan to add minimal admin document-review controls to `ApplicationReviewPage` or a new `DocumentArchivePage`. But scope creep. The plan should be focused. We can recommend adding a minimal document archive page under `/hr/documents` with verify/reject and expiring-soon toggle, because without it E2E can't meaningfully test. But that is UI work. However to test verify/reject/toggle expiring soon, we need UI. Could also add `data-testid` and actions on ApplicationReviewPage document list. That is smaller. We'll include as a file modification: add verify/reject buttons and expiring-soon filter to `ApplicationReviewPage` (or new page). But the prompt didn't ask for UI; maybe better to note dependency and propose minimal additions.

  Candidate-to-caregiver E2E similarly requires OfferAcceptancePage and CandidateOnboardingPage and training UI. To avoid large UI work, plan can use direct Convex transitions for those stubbed pages and validate final `/caregiver/today` load. But "training gate → complete training" can use TrainingPage stub? It has no complete button. Could call `onboarding.completePlatformTraining` via direct API. Plan should state.

  Since we are to produce plan, we can present options. The chosen approach: hybrid E2E — navigate and interact with existing UI components (invite modal, application form, review page, hire page, scheduling page, availability page, caregiver today page), and for stubbed candidate-only pages (offer acceptance, training) use authenticated direct Convex mutation calls to advance state. Also add minimal `data-testid` attributes to UI components touched. This keeps changes minimal while meeting test coverage.

  Need include data/auth/security/multi-tenant/PHI/idempotency edge cases:
  - Multi-tenancy: every Convex call uses `clerkOrgId` and `requireTenantRole`; tests should include cross-tenant negative cases.
  - Auth: E2E must not share sessions; sign out between roles; use unique candidate emails to avoid Clerk invitation collisions.
  - PHI: no real PII in tests; use fake emails, names.
  - Idempotency: seed.ts must skip existing fixtures; inviteCandidate is idempotent; completePlatformTraining returns existing completion; submitApplication updates latest application.
  - ADP: hireCandidate schedules `internal.adpOutbound.adpSyncWorker`; integration tests must stub env and finish scheduled functions.
  - Clerk membership update: hireCandidate schedules `internal.candidates.updateClerkMembershipRole`; stub fetch.

  Test strategy:
  - Unit/integration: vitest with convex-test harness; identity injection via `t.withIdentity({ subject, org_id, org_role })`; seed helper per file; stub `fetch` for Clerk and ADP; use `vi.useFakeTimers` + `t.finishAllScheduledFunctions`.
  - E2E: Playwright with `workers:1`; use `@auth` tag; live credentials vs mock harness; helper `signInWithClerk` or `mockSignInAsRole`; reset fixtures between scenarios via `resetE2EShifts` / new `resetE2ECandidate`; use page object helpers.
  - Gate commands: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e:full`, `npm run build`. Also `npx convex codegen` after convex changes.

  Rollback: branch off, commit before changes; if E2E credentials missing, skip `@auth` specs; no production deploy.

  Need final answer as plan. Should we run any tests to baseline? We can run `npm run test` maybe but not needed. The prompt wants plan. We can mention we inspected files. Should we output actual counts? Since not implementing, cannot. But maybe we can run current test counts to include baseline. It could be useful. We can run `npm run test` quickly? Might be long but okay. Also `npm run lint` and `typecheck`. But since not modifying code, baseline pass/fail. The prompt says "Run and report pass/fail ... report actual counts" as part of task. Since we are producing plan, maybe we should run them to give baseline. But these commands could be slow; we have 60s default. We can run `npm run test` maybe 120s. Also `npm run lint` etc. Could run in parallel with background? But we need results for final answer. We could run them. However the instruction "Run and report pass/fail" likely applies to after implementation. But we can run baseline to show current state. It may not be necessary, but thorough. We must be careful about time. Let's run tests and lint/typecheck in parallel maybe. But we have to consider if environment has dependencies. It may take time. We can run `npm run lint`, `npm run typecheck`, `npm run test` in parallel. Use Bash with timeout. e2e full requires .env.e2e and dev server; skip. build maybe. Let's run baseline.
> mariatest@0.0.0 lint
> eslint .


> mariatest@0.0.0 typecheck
> tsc -b

src/features/onboarding/pages/ApplicationFormPage.tsx(19,38): error TS2339: Property 'yearsExperience' does not exist on type '{ _id: Id<"candidates">; _creationTime: number; clerkUserId?: string | undefined; source?: string | undefined; phone?: string | undefined; invitationId?: string | undefined; createdAt: string; tenantId: Id<...>; displayName: string; email: string; status: string; }'.

> mariatest@0.0.0 test
> vitest run --configLoader native


 RUN  v4.1.6 C:/Users/pinol/Documents/Work/atriax/solid-pancake

 ✓ src/features/caregiver/components/ShiftDocumentationForm.test.tsx (12 tests) 5120ms
     ✓ advances through each wizard step after clock-in  1545ms
     ✓ calls clockOut with location when geofence is enabled and note is complete  502ms
     ✓ shows outside-radius server error in plain language  563ms
     ✓ disables the clock-out button and shows a loading label while submitting  518ms
     ✓ resumes the wizard after a correction and reuses the existing clock-out without requesting location  548ms
     ✓ calls onDone when returning home from the success screen  598ms
     ✓ autosaves draft note fields  437ms
 ✓ src/features/team/pages/TeamPage.test.tsx (12 tests) 3495ms
     ✓ creates caregiver invitations through the server redirect flow  735ms
     ✓ passes coordinator intent to the server invitation flow  578ms
     ✓ refreshes invitations list after sending an invite  382ms
     ✓ shows "already a member" message when invitee is already in the org  441ms
     ✓ adds a caregiver through the caregiver form  789ms
 ✓ src/app/router.test.tsx (15 tests) 1875ms
     ✓ renders SchedulingPage at /scheduling for org:admin  359ms
     ✓ renders CaregiverSchedulePage at /caregiver/schedule for org:caregiver  331ms
     ✓ renders AvailabilityPage at /caregiver/availability for org:caregiver  344ms
     ✓ renders HRDashboardPage at /hr for org:hr  335ms
     ✓ renders CandidatePipelinePage at /hr/candidates for org:hr  328ms
 ✓ src/features/clients/pages/ClientsPage.test.tsx (4 tests) 1429ms
     ✓ uses caregiver email as the scheduling dropdown label  444ms
     ✓ opens the address dialog and saves the service address  955ms
 ✓ src/app/auth/SelectAgencyPage.test.tsx (8 tests) 1510ms
     ✓ retries once on transient token error, then succeeds  503ms
     ✓ shows JWT config error when retry also fails with missing org claim  454ms
 ✓ src/features/coordinator/components/ReviewDetail.test.tsx (4 tests) 925ms
     ✓ calls requestCorrection mutation after typing a comment  563ms
 ✓ src/features/scheduling/components/ShiftPacketPanel.test.tsx (5 tests) 945ms
     ✓ sends a coverage request from caregiver view  405ms
 ✓ src/features/settings/pages/GeofenceSettingsPage.test.tsx (3 tests) 911ms
     ✓ saves updated geofence settings  491ms
 ✓ src/features/scheduling/pages/AvailabilityPage.test.tsx (2 tests) 775ms
     ✓ renders the weekly availability list  303ms
     ✓ calls addAvailabilityWindow when a new window is saved  467ms
 ✓ src/features/hr/pages/CandidatePipelinePage.test.tsx (2 tests) 523ms
     ✓ renders tabs and candidate rows  429ms
 ✓ src/features/scheduling/components/ShiftEditorModal.test.tsx (2 tests) 539ms
     ✓ calls createShift with correct args  422ms
 ✓ src/features/hr/pages/HRCasesPage.test.tsx (2 tests) 472ms
 ✓ src/features/scheduling/pages/SchedulingPage.test.tsx (4 tests) 440ms
stderr | src/features/hr/pages/HRDashboardPage.test.tsx > HRDashboardPage > opens invite candidate modal
An update to HRDashboardPage inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/features/hr/pages/HRDashboardPage.test.tsx (2 tests) 433ms
     ✓ renders title, KPIs, and candidate rows  301ms
 ✓ src/features/coordinator/pages/CoordinatorReviewPage.test.tsx (4 tests) 428ms
 ✓ src/features/scheduling/components/CoverageRequestsPanel.test.tsx (2 tests) 359ms
 ✓ src/app/shell/Sidebar.test.tsx (9 tests) 325ms
 ✓ src/shared/ui/sharedUi.test.tsx (18 tests) 325ms
 ✓ src/features/hr/pages/EmployeesPage.test.tsx (1 test) 262ms
 ✓ convex/adpSync.test.ts (21 tests) 193ms
 ✓ src/features/caregiver/components/ShiftClockOutScreen.test.tsx (4 tests) 189ms
 ✓ src/shared/testing/convexApi.test.ts (17 tests) 144ms
 ✓ src/features/onboarding/ApplicationFormPage.test.tsx (1 test) 163ms
 ✓ convex/candidates.test.ts (19 tests) 129ms
 ✓ convex/session1Phase2Integration.test.ts (2 tests) 37ms
 ✓ convex/shiftClock.behavior.test.ts (13 tests) 76ms
 ✓ src/app/providers.test.tsx (1 test) 81ms
 ✓ src/app/shell/RouteGuard.test.tsx (14 tests) 71ms
 ✓ convex/forms.test.ts (19 tests) 75ms
 ✓ convex/employeeProfiles.test.ts (10 tests) 71ms
 ✓ convex/scheduling.test.ts (16 tests) 86ms
 ✓ src/features/caregiver/hooks/useCaregiverLocation.test.ts (5 tests) 69ms
 ✓ convex/documentArchive.test.ts (8 tests) 50ms
 ✓ convex/seed.test.ts (7 tests) 46ms
 ✓ convex/platform.test.ts (1 test) 46ms
 ✓ convex/reviews.test.ts (6 tests) 45ms
 ✓ convex/hrCases.test.ts (5 tests) 42ms
 ✓ convex/shiftClock.test.ts (28 tests) 44ms
 ✓ convex/onboarding.test.ts (5 tests) 42ms
 ✓ convex/phase2Guards.test.ts (4 tests) 36ms
 ✓ convex/members.test.ts (5 tests) 15ms
 ✓ convex/locationValidation.test.ts (16 tests) 11ms
 ✓ convex/authHelpers.test.ts (18 tests) 9ms
 ✓ src/shared/domain/shiftRules.test.ts (4 tests) 7ms
 ✓ src/features/caregiver/model/documentationWizard.test.ts (6 tests) 8ms
 ✓ convex/timePunches.test.ts (8 tests) 7ms
 ✓ convex/shiftLifecycle.test.ts (3 tests) 6ms
 ✓ convex/files.test.ts (6 tests) 6ms
 ✓ src/features/billing/model/invoiceUtils.test.ts (4 tests) 5ms
 ✓ src/features/caregiver/model/documentationDraft.test.ts (3 tests) 6ms
 ✓ src/shared/search/embedding.test.ts (1 test) 5ms
 ✓ convex/shiftValidation.test.ts (3 tests) 5ms
 ✓ convex/tenantSettings.test.ts (4 tests) 5ms
 ✓ convex/integrations/adp/adpClient.test.ts (4 tests) 4ms
 ✓ src/app/reloadOnStaleAssets.test.ts (2 tests) 4ms

 Test Files  55 passed (55)
      Tests  404 passed (404)
   Start at  14:50:47
   Duration  149.02s (transform 2.36s, setup 11.48s, import 10.90s, tests 22.93s, environment 90.87s)

Baseline: lint passes, typecheck fails due to ApplicationFormPage.tsx property 'yearsExperience' not on candidate type. This is a pre-existing bug. We should mention it in plan: must fix or the change will fail typecheck. Since plan only, but note that typecheck currently fails. Build would also fail. Should we run build? It will fail due to typecheck. Maybe not. We can mention baseline counts: test 404 passed. Lint pass. Typecheck 1 error. E2E not run due to missing .env.e2e. This informs plan.

  Need possibly run build to confirm? No need, typecheck fails. We can note.

  Need include this in discovery notes: pre-existing type error in ApplicationFormPage.tsx accessing `candidate.yearsExperience` which is not in schema. This will block build; should be fixed (remove or cast). Since we are planning, include as a prerequisite. But the task didn't ask to fix; however it's blocking gates. We can propose minimal fix: cast or remove.

  Need plan includes files to modify: maybe include `src/features/onboarding/pages/ApplicationFormPage.tsx` to fix type error (remove yearsExperience or add optional field). But task says update seed and tests. However to pass gates, need fix. We can include it as a necessary prerequisite in rollback/verification notes.

  Now craft final plan.

  Need ensure we don't write code. Use prose and tables.

  Let's structure final answer:

  Title: ATRIA-X Phase 2 E2E & Integration Test Plan

  1. Restated Goal & Acceptance Criteria
  2. Discovery Notes
  3. Alternatives Considered
  4. Files to Create/Modify
  5. Edge Cases
  6. Test Strategy
  7. Rollback / Verification Notes
  8. Baseline Gate Status (optional)

  Need cite actual function/type names. Include file paths.

  Let's compose with careful detail. Keep it readable.

  Potential issue: The prompt says "Do not edit the repo outside the pipeline." In plan, mention all edits inside pipeline.

  Need mention "After editing convex/* run npx convex codegen". Include in verification.

  Need mention style: single quotes, no semicolons, 2-space indent.

  Let's write final answer.

  Need be concise but thorough. Use bullet lists and tables.

  Let's think about acceptance criteria numbering. AC-1 through AC-10 maybe.

  AC-1: tests/e2e/onboarding.spec.ts created and covers candidate-to-caregiver flow end-to-end.
  AC-2: tests/e2e/scheduling.spec.ts created and covers shift creation, conflict, availability, coverage resolution.
  AC-3: tests/e2e/documents.spec.ts created and covers verify/reject/expiring-soon.
  AC-4: tests/e2e/helpers/auth.ts and env.ts updated to support HR/candidate roles and mock harness.
  AC-5: convex/onboarding.test.ts expanded with candidate lifecycle + training + role guard cases.
  AC-6: convex/scheduling.test.ts expanded with conflict/aduit/coverage guard cases.
  AC-7: convex/forms.test.ts expanded with submitForm validation, document archive verify/reject metadata, role guards.
  AC-8: convex/seed.ts idempotent Phase 2 fixtures added.
  AC-9: Style/formatting and codegen run.
  AC-10: All gates pass with counts reported.

  Discovery notes: list files and functions verified.

  Files table: include UI components for testids maybe.

  Edge cases: multi-tenant, role injection, idempotency, ADP/Clerk scheduling, PHI.

  Test strategy: integration harness details, E2E harness details, gate commands.

  Rollback: branch, git status, etc.

  Baseline: lint pass, typecheck fail pre-existing, tests 404 pass.

  Need not include code snippets. But can include pseudo-test names.

  Let's produce final answer.

To resume this session: kimi -r session_b4d602c5-53f3-4bf1-baaa-d2fc3a9678f3
