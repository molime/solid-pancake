# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_144423\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 465.5s rc=0

• # ATRIA-X Phase 2 — E2E & Integration Test Plan

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Add comprehensive Phase 2 test coverage and idempotent seed fixtures for the candidate-to-caregiver, scheduling, document-archive, and forms flows, while keeping the repo style-compliant and the full pipeline green.

  | ID | Acceptance Criterion |
  |---|---|
  | **AC-1** | `tests/e2e/onboarding.spec.ts` is created and exercises the full candidate-to-caregiver flow: invite → submitted → review → offer → accept → hire → training gate → complete training → `/caregiver/today`. It uses live Clerk credentials when available and falls back to a mock-Clerk harness otherwise. |
  | **AC-2** | `tests/e2e/scheduling.spec.ts` is created and covers: admin creates a shift, conflict detection blocks overlaps and allows adjacent shifts, caregiver availability is honored, and a coverage request is created and resolved. |
  | **AC-3** | `tests/e2e/documents.spec.ts` is created and covers: verify a document, reject a document, and toggle/list expiring-soon documents. |
  | **AC-4** | `tests/e2e/helpers/auth.ts` and `tests/e2e/helpers/env.ts` are updated to support `E2E_HR_EMAIL/PASSWORD` and `E2E_CANDIDATE_EMAIL/PASSWORD`, plus a mock-Clerk fallback with role injection. |
  | **AC-5** | `convex/onboarding.test.ts` is expanded to cover: `candidateTasks` order, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` (asserts `employeeProfile` creation + ADP sync `pending_credentials`), `completePlatformTraining` idempotency, `hasPlatformTrainingCompleted`, `resetPlatformTraining`, and `org:candidate` cannot call `scheduling.listShifts`. |
  | **AC-6** | `convex/scheduling.test.ts` is expanded to cover: `checkShiftConflict` adjacent/overlap/excluded/completed cases, `createShift` audit event, cross-caregiver conflict, caregiver role requirement for admin-only ops, and update/delete coverage guards. |
  | **AC-7** | `convex/forms.test.ts` is expanded to cover: `submitForm` rejects missing required fields and inactive forms, `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt`, and `org:caregiver` cannot call the archive mutation. |
  | **AC-8** | `convex/seed.ts` is updated idempotently with Phase 2 fixtures: one candidate in `submitted` status with a seeded application, one availability window, one `open` coverage request, one `formDefinition` with fields `name` (required), `experience` (required), `notes` (optional), and one `documentArchiveItem` in `pending_review`. |
  | **AC-9** | All new code follows repo style: 2-space indent, single quotes, no semicolons. After any `convex/*` edit, run `npx convex codegen`; never edit `convex/_generated/*` by hand. |
  | **AC-10** | Pipeline gates are run and reported: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e`, `npm run build`. |

  ---

  ## 2. Discovery Notes

  Files were inspected directly. Key contracts found:

  ### Candidate / onboarding backend
  - **`convex/candidates.ts`**
    - Queries: `getCandidateProfile`, `listCandidates`, `getCandidateDetail`, `listCandidateTasks`, `listCandidateTasksForHR`.
    - Mutations: `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `rejectOffer`, `hireCandidate`, `addCandidateDocument`, `attachCandidateDocument`.
    - Action: `inviteCandidate`.
    - Internal: `updateClerkMembershipRole`, `insertInvitedCandidate`.
    - Status machine: `invited → applied → hr_review → offer_sent → accepted → hired`.
    - `CANDIDATE_TASK_TYPES = ['form_submission','document_upload','background_check','reference_check','platform_training']`.
    - `hireCandidate` upserts `tenantMembers` (role `org:caregiver`) and `employeeProfiles` with `adpSyncStatus: 'pending_credentials'`, then schedules `internal.candidates.updateClerkMembershipRole` and `internal.adpOutbound.adpSyncWorker`.
  - **`convex/onboarding.ts`**
    - `completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`.
    - `DEFAULT_TRAINING_ID = 'platform_training'`.
    - `completePlatformTraining` is idempotent: returns existing completion row for `(tenantId, clerkUserId, trainingId)`.
  - **`convex/platformTrainingCompletions.ts`**
    - `create` mutation for admin/coordinator/HR to create completion rows for any user.

  ### Scheduling backend
  - **`convex/scheduling.ts`**
    - Mutations: `createShift`, `updateShift`, `deleteShift`, `assignShift`, `requestCoverage`, `resolveCoverage`, `addAvailabilityWindow`, `updateAvailabilityWindow`, `deleteAvailabilityWindow`.
    - Queries: `listShifts`, `listCaregiverShifts`, `listMyAvailability`, `listAvailabilityForScheduling`, `listCoverageRequests`.
    - Helpers: `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`, `assertCaregiverMember`.
    - `NON_CONFLICT_STATUSES = ['scheduled','in_progress','submitted','approved']`.
    - `TERMINAL_STATUSES = ['submitted','approved','billing_ready']`.
    - Audit actions: `shift.created`, `shift.updated`, `shift.deleted`, `shift.reassigned`, `coverage.resolved`.

  ### Forms / documents backend
  - **`convex/forms.ts`**
    - `createFormDefinition`, `updateFormDefinition`, `deactivateFormDefinition`, `listFormDefinitions`, `submitForm`, `listFormSubmissions`, `getFormSubmission`.
    - `submitForm` validates required fields via `isFieldRequired`/`isValuePresent` and rejects inactive forms; auto-completes the `form_submission` candidate task.
  - **`convex/documentArchive.ts`**
    - `listDocumentArchive`, `updateDocumentArchiveItem`.
    - `ALLOWED_STATUSES = ['active','verified','rejected']`.
    - `verified` sets `verifiedBy`/`verifiedAt`; `rejected` requires `rejectionReason` and clears verified fields; `active` clears both.
    - Writes audit event `document.status_updated`.

  ### Auth / seed / E2E harness
  - **`convex/authHelpers.ts`**
    - `TenantRole = 'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr' | 'org:candidate'`.
    - Test identity shape: `{ subject, org_id, org_role }`.
  - **`convex/seed.ts`**
    - Exports `seedAgency`, `seedCaregiverShifts`, `seedE2E`, `resetE2EShifts`.
    - Uses deterministic `REF_TODAY = '2024-01-15'` and deletes/re-creates fixture shifts by `(clientId, caregiverId, scheduledStart)` for idempotency.
  - **`tests/e2e/helpers/auth.ts`**
    - `signInWithClerk(page, email, password, orgId)` via Clerk ticket API.
    - Currently supports admin/coordinator/caregiver env vars only.
  - **`tests/e2e/helpers/env.ts`**
    - `e2eCredentialsAvailable()` checks only admin/coordinator/caregiver credentials.
  - **`playwright.config.ts`**
    - `workers: 1`, `fullyParallel: false`, `@auth` tag inverted when `E2E_FULL` is not set or credentials are missing.
  - **`package.json`**
    - Scripts: `lint`, `typecheck`, `test`, `e2e`, `e2e:full`, `build`.

  ### UI routes / components
  - **`src/app/router.tsx`** exposes `/hr/candidates`, `/hr/candidates/:candidateId`, `/hr/candidates/:candidateId/hire`, `/scheduling`, `/caregiver/availability`, `/caregiver/today`, `/onboarding/application`, `/onboarding/training`.
  - Candidate onboarding pages (`/onboarding/offer`, `/onboarding/training`, `/onboarding/upload`, etc.) are currently stubs; only `ApplicationFormPage` is functional.
  - No dedicated document-archive admin page exists; archive items are shown only inside `EmployeeProfilePage`.
  - Only `CaregiverTodayPage` contains `data-testid` attributes; HR/scheduling/onboarding components currently have none.

  ### Existing test baseline
  - `convex/candidates.test.ts` already covers much of the candidate lifecycle, task ordering, and `hireCandidate` ADP side effects.
  - `convex/onboarding.test.ts` already covers training idempotency and reset guards.
  - `convex/scheduling.test.ts` already covers adjacent/overlap/billing-ready/exclude conflict cases, createShift roles, cross-tenant caregiver, and coverage lifecycle.
  - `convex/forms.test.ts` and `convex/documentArchive.test.ts` already cover submit-form validation, inactive forms, archive verify/reject, and caregiver role blocks.
  - Current baseline (verified on this branch):
    - `npm run lint`: pass
    - `npm run typecheck`: pass
    - `npm run test`: **404 passed / 55 files**
    - `npm run build`: pass (one non-fatal CSS warning)
    - `E2E_FULL=1 npm run e2e`: not run; `.env.e2e`/full credentials not present.

  ---

  ## 3. Alternatives Considered

  | Alternative | Why Not Chosen |
  |---|---|
  | **Real Clerk E2E only** | The repo currently has env vars only for admin/coordinator/caregiver. Adding real HR/candidate Clerk users is environment-dependent and would break local/CI runs. The chosen approach uses live credentials when `E2E_HR_EMAIL/E2E_CANDIDATE_EMAIL` are present, but falls back to a mock-Clerk harness. |
  | **Implement full candidate UI pages (offer acceptance, training, document upload) just to drive E2E** | Out of scope for a test task and would expand the blast radius. The chosen approach drives existing UI components and uses authenticated direct Convex mutations for stubbed pages. |
  | **Drive every E2E transition through direct Convex HTTP calls and only assert page URLs** | Fastest but not a true E2E test of the React UI. The chosen hybrid keeps browser navigation and UI assertions for implemented pages. |
  | **Create a separate `convex/seedPhase2.ts`** | Would duplicate idempotency utilities. The chosen approach extends the existing `convex/seed.ts` entry points and keeps `resetE2EShifts` available for E2E teardown. |

  **Chosen approach:** Hybrid browser E2E. Use real `signInWithClerk` when credentials exist; otherwise inject a fake `window.Clerk` identity and pre-seed the tenant. Interact with existing UI for invite, application form, review, hire, scheduling, availability, and caregiver today. For stubbed candidate-only pages (offer acceptance, training), advance state via authenticated direct Convex mutation calls, then assert the UI result (e.g., role change lands the user on `/caregiver/today`).

  ---

  ## 4. Files to Create / Modify

  | File | Change Type | What Changes |
  |---|---|---|
  | `tests/e2e/onboarding.spec.ts` | **Create** | Full candidate-to-caregiver Playwright flow with UI + direct-mutation fallback for stub pages. |
  | `tests/e2e/scheduling.spec.ts` | **Create** | Admin shift creation, conflict detection, availability, coverage request resolution. |
  | `tests/e2e/documents.spec.ts` | **Create** | Verify/reject and expiring-soon assertions (uses direct archive mutation if UI controls are absent). |
  | `tests/e2e/helpers/auth.ts` | **Modify** | Add `E2E_HR_EMAIL/PASSWORD`, `E2E_CANDIDATE_EMAIL/PASSWORD`, `signInAsHR`, `signInAsCandidate`, and a `mockSignInAsRole` fallback that stubs `window.Clerk`. |
  | `tests/e2e/helpers/env.ts` | **Modify** | Extend `e2eCredentialsAvailable()` to include HR/candidate; add `useMockE2E()` flag. |
  | `tests/e2e/helpers/seed.ts` | **Create** | Helper to call `seed:resetE2EShifts` and a new `seed:resetE2ECandidate` over HTTP. |
  | `tests/e2e/global-setup.ts` | **Modify** | When live credentials exist, upsert HR/candidate tenant members; in mock mode seed them deterministically. |
  | `convex/onboarding.test.ts` | **Modify** | Add lifecycle + training + role-guard cases from AC-5 that are not already covered. |
  | `convex/scheduling.test.ts` | **Modify** | Add createShift audit assertion, resolveCoverage conflict guard, and any missing coverage-request guard cases from AC-6. |
  | `convex/forms.test.ts` | **Modify** | Add submitForm required/inactive cases and a cross-module document-archive verify/reject role guard case from AC-7. |
  | `convex/seed.ts` | **Modify** | Add `seedPhase2Fixtures` / expose `resetE2ECandidate` mutation with idempotent Phase 2 fixtures. |
  | `src/features/hr/pages/CandidatePipelinePage.tsx` | **Modify** | Add minimal `data-testid` attributes on invite button and candidate row locators. |
  | `src/features/hr/pages/ApplicationReviewPage.tsx` | **Modify** | Add minimal `data-testid` attributes on decision buttons and document list. |
  | `src/features/hr/pages/HireConvertPage.tsx` | **Modify** | Add `data-testid="confirm-hire-button"`. |
  | `src/features/onboarding/pages/ApplicationFormPage.tsx` | **Modify** | Add `data-testid` attributes on form inputs if absent. |
  | `src/features/scheduling/pages/SchedulingPage.tsx` | **Modify** | Add `data-testid` on Add-shift button, shift cards, and coverage panel. |
  | `src/features/scheduling/components/ShiftEditorModal.tsx` | **Modify** | Add `data-testid` on save button and availability banner. |
  | `src/features/scheduling/components/ShiftPacketPanel.tsx` | **Modify** | Add `data-testid` on request-coverage button. |
  | `src/features/scheduling/components/CoverageRequestsPanel.tsx` | **Modify** | Add `data-testid` on assign select/button. |
  | `src/features/scheduling/pages/AvailabilityPage.tsx` | **Modify** | Add `data-testid` on day add/save controls. |
  | `convex/_generated/*` | **Regenerate only** | Run `npx convex codegen` after any `convex/*.ts` change; no hand edits. |

  *UI test-id additions are the minimum needed to make E2E locators stable; no product logic changes.*

  ---

  ## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

  - **Multi-tenancy:** Every backend call must pass `clerkOrgId` and go through `requireTenantRole`/`assertTenantDoc`. Tests must include cross-tenant negative cases (e.g., a candidate in org A cannot read candidate B in org B; `submitForm` with a foreign `formDefinitionId` throws).
  - **Role injection:** Integration tests use `t.withIdentity({ subject, org_id, org_role })`. E2E uses either real Clerk tickets or the mock harness; sessions must be cleared between role switches.
  - **Idempotency:** `seed.ts` must look up existing records by natural key before inserting. `inviteCandidate` must reuse an existing candidate row if the email already exists. `completePlatformTraining` must return the existing completion on duplicate calls. `hireCandidate` must patch an existing `employeeProfiles` row if one exists. `submitApplication` must update the most recent non-hired application.
  - **ADP / Clerk side effects:** `hireCandidate` schedules `internal.adpOutbound.adpSyncWorker` and `internal.candidates.updateClerkMembershipRole`. Integration tests must stub `fetch`, set `CLERK_SECRET_KEY`/`APP_URL`, and use `vi.useFakeTimers()` + `await t.finishAllScheduledFunctions(vi.runAllTimers)`.
  - **PHI / PII:** Use fake emails (`*.test`), fake names, and fake client addresses. No real credentials in test code.
  - **Candidate task ordering:** `candidateTasks` are sorted by the `order` field (0–4). Assertions must verify `type` order: `form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`.
  - **Shift conflict semantics:** `billing_ready` shifts are not conflicts; the current shift (via `excludeShiftId`) is skipped; adjacent start/end times are allowed.
  - **Coverage guards:** Only the assigned caregiver can `requestCoverage`; only `org:admin`/`org:coordinator` can `resolveCoverage`; resolving to a caregiver with a conflicting shift must throw.
  - **Form validation:** `submitForm` rejects empty-string required fields and inactive forms. `org:caregiver` cannot call `updateDocumentArchiveItem`.
  - **Document archive:** `verified` writes `verifiedBy`/`verifiedAt`; `rejected` requires `rejectionReason`; `active` clears both.

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
  E2E_FULL=1 npm run e2e:full   # requires .env.e2e and live dev server
  npm run build
  ```

  Report:
  - `lint`: pass / fail
  - `typecheck`: pass / fail
  - `test`: `<count> passed` / failures
  - `e2e`: `<count> passed` / failures (or skipped if credentials missing)
  - `build`: pass / fail

  ---

  ## 7. Rollback / Verification Notes

  - **Branch:** Create a feature branch (e.g., `feature/phase-2-tests`) before editing. The current working tree is on `feature/phase-2-worker-onboarding`.
  - **Convex codegen:** Any hand-edit to `convex/*.ts` must be followed by `npx convex codegen`. Do not edit `convex/_generated/*` by hand.
  - **E2E credentials:** If `.env.e2e` is missing, the `@auth` specs are automatically skipped; full E2E verification requires `E2E_HR_EMAIL`, `E2E_HR_PASSWORD`, `E2E_CANDIDATE_EMAIL`, `E2E_CANDIDATE_PASSWORD` in addition to the existing admin/coordinator/caregiver vars.
  - **Idempotency check:** Run `npx convex dev` (or `npx convex dev --once`) and invoke `seed:seedE2E` twice; the second run should report no duplicate candidates/forms/documents.
  - **Generated diff check:** After `npx convex codegen`, verify `git diff convex/_generated` contains only regenerated artifacts.
  - **Revert:** All changes are local file edits; revert with `git checkout -- <file>` or `git reset --hard` if uncommitted.

  ---

  ## 8. Current Baseline (verified on this branch)

  | Gate | Result | Notes |
  |---|---|---|
  | `npm run lint` | ✅ pass | No errors. |
  | `npm run typecheck` | ✅ pass | No TypeScript errors. |
  | `npm run test` | ✅ 404 passed / 55 files | Baseline before Phase 2 additions. |
  | `npm run build` | ✅ pass | One non-fatal CSS optimizer warning. |
  | `E2E_FULL=1 npm run e2e:full` | ⏭️ not run | `.env.e2e`/full Clerk credentials not present in this environment. |

  The implementer should apply the test and seed changes above, run `npx convex codegen`, then re-run all gates and replace these baseline numbers with the final counts.


[stderr]
• The user wants me to read a prompt file and carry out the instructions. Let me read the file first.The file is too large. Let me read it with a larger line count or read it in chunks. It has 82980 chars. Let me read it in parts.The output is exceeding the preview limit. I need to read using the output_path or directly from the file. Let me try reading via Bash with cat or head? Actually the instructions say prefer Read. The issue is the tool output is huge and being stored in a temp file. Let me use Bash to get line count and read sections. But the prompt says prefer dedicated tools. Let me try Read with line_offset 1 and n_lines maybe 100.The file has 823 lines. I need to read the whole thing. The output_path is the temp file where full output is stored. I can read that file in chunks. Let me use the output_path. Actually, I should just read the original file in chunks. Let me use Bash to output to a temp file or use Read to read line ranges. The issue is Read outputs too large. But if I read 200 lines at a time, it should be fine. Let me read lines 101-300.I need to read the rest of the prompt file. It has 823 lines. Let me continue reading chunks.The output includes a bunch of test output that seems to have been captured from a previous run in the prompt file? Actually lines 387-499 are part of the prompt file content? It appears the prompt file includes the candidate plan plus internal reasoning/output from previous agents. It seems huge. I need to read the rest to see if there are more candidate plans. The prompt file likely contains the entire transcript including the planner outputs. I need to read more.Need continue reading to line 823.Now I have read the entire prompt file. It contains instructions and three candidate plans (c_plan_agentic, c_plan_qwen, c_plan_kimi27). The task is to synthesize them into ONE coherent implementation plan. Also the discovery requirement says if backend is agentic CLI, we MUST open and read actual relevant files before writing plan. So I need to perform actual repo discovery, then synthesize plans. Since this is a planning task, not implementation, I need to inspect actual files and produce final plan. I have a lot of info from the candidate plan (c_plan_agentic) already did discovery. But I need to verify myself. The prompt says "do not reason from context description alone." So I must read actual files. I have already some from previous interactions but not all. I need to do actual exploration. Since this is large, I should use explore agent(s) to quickly gather actual file contents and function/type names. Then I can read key files. Need produce final plan. Need not write code. Need include baseline gate status. The prompt also says "Run and report pass/fail..." but as planner not implementer. However I can run baseline gates to include current counts. Actually the candidate plan c_plan_agentic included baseline: lint pass, typecheck fail (pre-existing ApplicationFormPage type error), test 404 pass. I should verify by reading relevant files and maybe run tests. Since I need to be accurate, I should run `npm run lint`, `npm run typecheck`, `npm run test`, maybe `npm run build`. But running tests takes ~150s. We can do that. Also need inspect actual files to cite names. Let's use explore agent to gather relevant files quickly, and in parallel run baseline commands. Then read key files. Then synthesize plan.

  Given the file path already provided, I can use Glob/Grep to find relevant files. But to save context, I should use an explore agent to map key files and return function/type names. Also I can use multiple parallel explore agents for independent areas: onboarding/candidates, scheduling, forms/documents, E2E harness/seed, schema/authHelpers. Then read key files. Since planning only, we don't need to read everything line-by-line, but enough to cite exact names. Let's spawn explore agents.

  But the user asked to carry out instructions completely and not ask questions. So proceed autonomously.

  Let's first start explore agents. Use Agent with subagent_type=explore. For each area, ask to read files and return exact function/type names and key contracts.

  Parallel agents:
  1. Explore onboarding/candidates: convex/candidates.ts, convex/onboarding.ts, convex/platformTrainingCompletions.ts, convex/candidates.test.ts, convex/onboarding.test.ts.
  2. Explore scheduling: convex/scheduling.ts, convex/scheduling.test.ts.
  3. Explore forms/documents: convex/forms.ts, convex/documentArchive.ts, convex/forms.test.ts, convex/documentArchive.test.ts.
  4. Explore auth/seed/E2E harness: convex/authHelpers.ts, convex/seed.ts, tests/e2e/helpers/auth.ts, tests/e2e/helpers/env.ts, tests/e2e/global-setup.ts, playwright.config.ts, package.json.
  5. Explore schema/UI routes: convex/schema.ts, src/app/router.tsx, relevant pages.

  This is 5 agents. Use AgentSwarm maybe. Or separate Agent calls. Since independent, parallel Agent calls. Use explore type. Need include thoroughness level.

  Let's do it.Great. We have detailed exploration. Now I need to synthesize and produce final plan. I should also run baseline gates to verify current state. The explore agent reported typecheck clean, but the candidate plan earlier said typecheck fails due to ApplicationFormPage `yearsExperience`. Need verify. Let's run lint, typecheck, test maybe in parallel. Also perhaps read the relevant files quickly for exact names if needed. But explore summaries are sufficient. However I should verify typecheck because conflicting info. Let's run `npm run typecheck` and `npm run lint` maybe. Test can take 150s but okay. Could run in parallel. Use Bash with timeout.
> mariatest@0.0.0 lint
> eslint .

---LINT-DONE---

> mariatest@0.0.0 typecheck
> tsc -b

---TYPECHECK-DONE---

> mariatest@0.0.0 test
> vitest run --configLoader native


 RUN  v4.1.6 C:/Users/pinol/Documents/Work/atriax/solid-pancake

 ✓ src/features/caregiver/components/ShiftDocumentationForm.test.tsx (12 tests) 5111ms
     ✓ advances through each wizard step after clock-in  1472ms
     ✓ calls clockOut with location when geofence is enabled and note is complete  516ms
     ✓ shows outside-radius server error in plain language  580ms
     ✓ disables the clock-out button and shows a loading label while submitting  548ms
     ✓ resumes the wizard after a correction and reuses the existing clock-out without requesting location  534ms
     ✓ calls onDone when returning home from the success screen  582ms
     ✓ autosaves draft note fields  441ms
 ✓ src/features/team/pages/TeamPage.test.tsx (12 tests) 3421ms
     ✓ creates caregiver invitations through the server redirect flow  692ms
     ✓ passes coordinator intent to the server invitation flow  578ms
     ✓ refreshes invitations list after sending an invite  390ms
     ✓ shows "already a member" message when invitee is already in the org  473ms
     ✓ adds a caregiver through the caregiver form  769ms
 ✓ src/app/router.test.tsx (15 tests) 1826ms
     ✓ renders SchedulingPage at /scheduling for org:admin  356ms
     ✓ renders CaregiverSchedulePage at /caregiver/schedule for org:caregiver  328ms
     ✓ renders AvailabilityPage at /caregiver/availability for org:caregiver  343ms
     ✓ renders HRDashboardPage at /hr for org:hr  314ms
     ✓ renders CandidatePipelinePage at /hr/candidates for org:hr  328ms
 ✓ src/features/clients/pages/ClientsPage.test.tsx (4 tests) 1502ms
     ✓ uses caregiver email as the scheduling dropdown label  445ms
     ✓ opens the address dialog and saves the service address  1028ms
 ✓ src/app/auth/SelectAgencyPage.test.tsx (8 tests) 1470ms
     ✓ retries once on transient token error, then succeeds  473ms
     ✓ shows JWT config error when retry also fails with missing org claim  471ms
 ✓ src/features/coordinator/components/ReviewDetail.test.tsx (4 tests) 987ms
     ✓ calls requestCorrection mutation after typing a comment  595ms
 ✓ src/features/scheduling/components/ShiftPacketPanel.test.tsx (5 tests) 951ms
     ✓ sends a coverage request from caregiver view  434ms
 ✓ src/features/settings/pages/GeofenceSettingsPage.test.tsx (3 tests) 840ms
     ✓ saves updated geofence settings  472ms
 ✓ src/features/scheduling/pages/AvailabilityPage.test.tsx (2 tests) 571ms
 ✓ src/features/hr/pages/HRCasesPage.test.tsx (2 tests) 499ms
     ✓ renders cases table  315ms
 ✓ src/features/hr/pages/CandidatePipelinePage.test.tsx (2 tests) 517ms
     ✓ renders tabs and candidate rows  421ms
 ✓ src/features/scheduling/components/ShiftEditorModal.test.tsx (2 tests) 519ms
     ✓ calls createShift with correct args  408ms
 ✓ src/features/scheduling/pages/SchedulingPage.test.tsx (4 tests) 466ms
stderr | src/features/hr/pages/HRDashboardPage.test.tsx > HRDashboardPage > opens invite candidate modal
An update to HRDashboardPage inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/features/hr/pages/HRDashboardPage.test.tsx (2 tests) 486ms
     ✓ renders title, KPIs, and candidate rows  304ms
 ✓ src/features/coordinator/pages/CoordinatorReviewPage.test.tsx (4 tests) 430ms
 ✓ src/features/scheduling/components/CoverageRequestsPanel.test.tsx (2 tests) 339ms
 ✓ src/app/shell/Sidebar.test.tsx (9 tests) 317ms
 ✓ src/shared/ui/sharedUi.test.tsx (18 tests) 332ms
 ✓ src/features/hr/pages/EmployeesPage.test.tsx (1 test) 269ms
 ✓ convex/adpSync.test.ts (21 tests) 205ms
 ✓ src/features/caregiver/components/ShiftClockOutScreen.test.tsx (4 tests) 196ms
 ✓ src/features/onboarding/ApplicationFormPage.test.tsx (1 test) 169ms
 ✓ convex/candidates.test.ts (19 tests) 154ms
 ✓ src/shared/testing/convexApi.test.ts (17 tests) 159ms
 ✓ src/app/providers.test.tsx (1 test) 86ms
 ✓ src/app/shell/RouteGuard.test.tsx (14 tests) 73ms
 ✓ convex/seed.test.ts (7 tests) 46ms
 ✓ convex/forms.test.ts (19 tests) 79ms
 ✓ convex/shiftClock.behavior.test.ts (13 tests) 70ms
 ✓ convex/scheduling.test.ts (16 tests) 62ms
 ✓ convex/employeeProfiles.test.ts (10 tests) 68ms
 ✓ convex/reviews.test.ts (6 tests) 62ms
 ✓ convex/platform.test.ts (1 test) 46ms
 ✓ convex/documentArchive.test.ts (8 tests) 49ms
 ✓ src/features/caregiver/hooks/useCaregiverLocation.test.ts (5 tests) 54ms
 ✓ convex/shiftClock.test.ts (28 tests) 52ms
 ✓ convex/onboarding.test.ts (5 tests) 48ms
 ✓ convex/hrCases.test.ts (5 tests) 53ms
 ✓ convex/session1Phase2Integration.test.ts (2 tests) 39ms
 ✓ convex/phase2Guards.test.ts (4 tests) 42ms
 ✓ convex/locationValidation.test.ts (16 tests) 11ms
 ✓ convex/members.test.ts (5 tests) 13ms
 ✓ src/features/caregiver/model/documentationDraft.test.ts (3 tests) 6ms
 ✓ convex/authHelpers.test.ts (18 tests) 9ms
 ✓ src/shared/domain/shiftRules.test.ts (4 tests) 8ms
 ✓ src/features/caregiver/model/documentationWizard.test.ts (6 tests) 7ms
 ✓ convex/timePunches.test.ts (8 tests) 7ms
 ✓ convex/shiftLifecycle.test.ts (3 tests) 5ms
 ✓ convex/files.test.ts (6 tests) 6ms
 ✓ src/features/billing/model/invoiceUtils.test.ts (4 tests) 6ms
 ✓ convex/tenantSettings.test.ts (4 tests) 5ms
 ✓ src/shared/search/embedding.test.ts (1 test) 5ms
 ✓ convex/shiftValidation.test.ts (3 tests) 7ms
 ✓ convex/integrations/adp/adpClient.test.ts (4 tests) 5ms
 ✓ src/app/reloadOnStaleAssets.test.ts (2 tests) 4ms

 Test Files  55 passed (55)
      Tests  404 passed (404)
   Start at  14:57:59
   Duration  153.98s (transform 2.51s, setup 12.04s, import 11.07s, tests 22.77s, environment 94.52s)

---TEST-DONE---
Great. Baseline: lint pass, typecheck pass, test 404 passed. The earlier typecheck error is fixed. Need maybe run build? Build might pass. Let's run build too. It may take time. But since baseline for plan. Use Bash.
> mariatest@0.0.0 build
> tsc -b && vite build --configLoader native

vite v8.0.13 building client environment for production...
[2Ktransforming...
Found 1 warning while optimizing generated CSS:

[2m│   }[22m
[2m│   .text-\[var\(\.\.\.\)\] {[22m
[2m│[22m     color: var(...);
[2m┆[22m                [33m[2m^--[22m Unexpected token Delim('.')[39m
[2m┆[22m
[2m│   }[22m
[2m│   .text-amber-500 {[22m

✓ 1979 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                    0.47 kB │ gzip:   0.30 kB
dist/assets/index-CVAxS55g.css                    58.28 kB │ gzip:  10.76 kB
dist/assets/check-BU4GTuDL.js                      0.11 kB │ gzip:   0.13 kB
dist/assets/chevron-left-DVLEaEz7.js               0.11 kB │ gzip:   0.13 kB
dist/assets/arrow-left-DD_8Zs6e.js                 0.15 kB │ gzip:   0.15 kB
dist/assets/arrow-right-MUZXuxYa.js                0.15 kB │ gzip:   0.15 kB
dist/assets/circle-check-RWxWS_Kw.js               0.16 kB │ gzip:   0.16 kB
dist/assets/Separator-C-XdA8fj.js                  0.17 kB │ gzip:   0.16 kB
dist/assets/circle-x-BEHfxS6I.js                   0.19 kB │ gzip:   0.17 kB
dist/assets/download-D28WmEkc.js                   0.22 kB │ gzip:   0.18 kB
dist/assets/triangle-alert-BfC_UB9_.js             0.25 kB │ gzip:   0.20 kB
dist/assets/user-plus-B7Ie-Bth.js                  0.29 kB │ gzip:   0.22 kB
dist/assets/upload-CaMHLkA1.js                     0.31 kB │ gzip:   0.23 kB
dist/assets/adpStatus-BrFjaQaH.js                  0.34 kB │ gzip:   0.18 kB
dist/assets/calendar-plus-CFYTgdNy.js              0.35 kB │ gzip:   0.23 kB
dist/assets/TrainingPage-DtL9nlnf.js               0.35 kB │ gzip:   0.25 kB
dist/assets/Checkbox-80X17nc1.js                   0.36 kB │ gzip:   0.25 kB
dist/assets/AcknowledgmentPage-CJOikLa2.js         0.36 kB │ gzip:   0.25 kB
dist/assets/DocumentUploadPage-Bh1llzqn.js         0.36 kB │ gzip:   0.25 kB
dist/assets/OfferAcceptancePage-C5lYSouF.js        0.36 kB │ gzip:   0.25 kB
dist/assets/CandidateProfilePage-9vNdocLT.js       0.36 kB │ gzip:   0.25 kB
dist/assets/ApplicationStatusPage-CdKZX4UU.js      0.37 kB │ gzip:   0.26 kB
dist/assets/CandidateOnboardingPage-BwiCMQ4X.js    0.37 kB │ gzip:   0.26 kB
dist/assets/Textarea-26rsbW1U.js                   0.54 kB │ gzip:   0.33 kB
dist/assets/Select-CTto5RbS.js                     0.55 kB │ gzip:   0.34 kB
dist/assets/Input-tFbcUrOH.js                      0.57 kB │ gzip:   0.35 kB
dist/assets/EmptyState-Cy8my_Ek.js                 0.72 kB │ gzip:   0.37 kB
dist/assets/FieldGroup-3-j89P3H.js                 0.79 kB │ gzip:   0.44 kB
dist/assets/candidateStatus-BKRy8CC5.js            0.88 kB │ gzip:   0.34 kB
dist/assets/ApplicationFormPage-D6yYgoz8.js        0.92 kB │ gzip:   0.54 kB
dist/assets/Table-C-Zy_VEJ.js                      1.02 kB │ gzip:   0.38 kB
dist/assets/Dialog-ByDH8I1k.js                     1.03 kB │ gzip:   0.45 kB
dist/assets/StatusBadge-Ci6BaLYf.js                1.04 kB │ gzip:   0.52 kB
dist/assets/format-CoI6Y2M9.js                     1.08 kB │ gzip:   0.53 kB
dist/assets/schedulingUtils-BFismAmK.js            1.35 kB │ gzip:   0.67 kB
dist/assets/useHrToast-CgctMnLY.js                 1.77 kB │ gzip:   0.82 kB
dist/assets/InviteCandidateModal-BRSVQ36v.js       1.82 kB │ gzip:   0.87 kB
dist/assets/EmployeesPage-DwHYvFJe.js              1.88 kB │ gzip:   0.84 kB
dist/assets/CaregiverSchedulePage-DC8NQLsY.js      2.87 kB │ gzip:   1.13 kB
dist/assets/PlatformAdminPage-DOmKZFau.js          3.02 kB │ gzip:   1.05 kB
dist/assets/CandidatePipelinePage-DPu64MrL.js      3.61 kB │ gzip:   1.48 kB
dist/assets/HireConvertPage-C5G3wAml.js            4.56 kB │ gzip:   1.78 kB
dist/assets/GeofenceSettingsPage-CFuG3evW.js       4.64 kB │ gzip:   1.45 kB
dist/assets/HRDashboardPage-BMZ0Yh6h.js            5.23 kB │ gzip:   1.79 kB
dist/assets/SearchPage-aTRlIydP.js                 5.32 kB │ gzip:   1.86 kB
dist/assets/EmployeeProfilePage-3JtrtBNu.js        5.59 kB │ gzip:   1.96 kB
dist/assets/HRCasesPage-C0gP2ceh.js                5.60 kB │ gzip:   2.08 kB
dist/assets/AvailabilityPage-DBPUKSjB.js           6.23 kB │ gzip:   2.27 kB
dist/assets/DashboardPage-CEqZdWvu.js              6.28 kB │ gzip:   2.17 kB
dist/assets/ApplicationReviewPage-BFTZzPvJ.js      7.71 kB │ gzip:   2.68 kB
dist/assets/ShiftPacketPanel-DomT4RJu.js           8.45 kB │ gzip:   2.82 kB
dist/assets/BillingPage-BiggAHi7.js               11.09 kB │ gzip:   3.54 kB
dist/assets/TeamPage-CsbhWTz0.js                  13.83 kB │ gzip:   4.08 kB
dist/assets/SchedulingPage-Cvg9l0tS.js            14.63 kB │ gzip:   4.54 kB
dist/assets/ClientsPage-DFYG7AKO.js               15.84 kB │ gzip:   3.48 kB
dist/assets/CoordinatorReviewPage-BCzpD00U.js     20.80 kB │ gzip:   5.70 kB
dist/assets/CaregiverTodayPage-CPWd4v8b.js        39.05 kB │ gzip:  10.30 kB
dist/assets/index-B16fzhID.js                    497.89 kB │ gzip: 145.60 kB

✓ built in 2.33s
---BUILD-DONE---
The user just provided a system reminder about TodoList. I should not mention it. I have all info needed. I should produce final plan. Need synthesize three candidate plans and actual repo discovery. The final answer should be a markdown plan with sections 1-7 (and baseline gate status). Need be concise but thorough. Need cite actual function/type names. Need not write code.

  I should ensure plan is coherent, de-duplicated, best-of-all. It should reflect actual repo state: baseline lint/typecheck/test/build all pass; no pre-existing type error. Candidate-to-caregiver E2E flow has stub pages, so plan must address that. Existing integration tests already cover many requested cases; plan should focus on gaps and avoid duplication. The prompt explicitly requests specific tests in specific files; plan should add them there but note existing coverage. Need include UI testid additions where necessary. Need include mock Clerk harness fallback. Need include idempotent seed fixtures. Need mention no manual edits to convex/_generated, run npx convex codegen.

  Need decide final structure. Use the 7 required sections. Add an optional current baseline section. Use tables.

  Let's craft carefully.

  Section 1: Restated goal & acceptance criteria.

  Goal: Add Phase 2 E2E (Playwright) and integration (Vitest/convex-test) coverage for candidate-to-caregiver, scheduling, document-archive, and forms flows, plus idempotent seed fixtures, while keeping repo style and full pipeline green.

  ACs:
  - AC-1 `tests/e2e/onboarding.spec.ts` created: full candidate-to-caregiver flow using live Clerk credentials when available, else mock Clerk harness; exercises UI where implemented and direct Convex transitions for stub pages; asserts final `/caregiver/today`.
  - AC-2 `tests/e2e/scheduling.spec.ts` created: admin creates shift, conflict detection (overlap blocked, adjacent allowed), caregiver availability honored, coverage request created and resolved.
  - AC-3 `tests/e2e/documents.spec.ts` created: verify/reject document and expiring-soon toggle; uses UI controls if present, otherwise authenticated direct Convex assertions.
  - AC-4 `tests/e2e/helpers/auth.ts` and `env.ts` updated: support `E2E_HR_EMAIL/PASSWORD` and `E2E_CANDIDATE_EMAIL/PASSWORD`; add `signInAsHR`, `signInAsCandidate`, and mock-Clerk fallback.
  - AC-5 `convex/onboarding.test.ts` expanded: candidateTasks order, submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate creates employeeProfile + ADP sync pending_credentials, completePlatformTraining idempotency, hasPlatformTrainingCompleted, resetPlatformTraining, org:candidate cannot listShifts.
  - AC-6 `convex/scheduling.test.ts` expanded: checkShiftConflict adjacent/overlap/excluded/completed, createShift audit event, cross-caregiver conflict, caregiver role required for admin ops, update/delete coverage guards.
  - AC-7 `convex/forms.test.ts` expanded: submitForm missing/inactive fields, updateDocumentArchiveItem verifyBy/verifiedAt, org:caregiver cannot call archive update.
  - AC-8 `convex/seed.ts` updated idempotently with Phase 2 fixtures: one candidate in 'submitted' with seeded application, one availability window, one coverage request 'open', one formDefinition with fields name/experience/notes, one documentArchiveItem pending_review.
  - AC-9 All new code follows repo style (2-space, single quotes, no semis); `npx convex codegen` run after convex changes; no hand edits to `convex/_generated`.
  - AC-10 Pipeline gates pass and are reported: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e`, `npm run build`.

  Section 2: Discovery notes. Mention files read, key contracts. Use exact names.

  - `convex/candidates.ts`: functions list, status machine, CANDIDATE_TASK_TYPES, idempotency, internal `updateClerkMembershipRole`, `insertInvitedCandidate`.
  - `convex/onboarding.ts`: `completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`, `DEFAULT_TRAINING_ID = 'platform_training'`.
  - `convex/platformTrainingCompletions.ts`: `create` for admin roles.
  - `convex/scheduling.ts`: functions, `NON_CONFLICT_STATUSES`, `TERMINAL_STATUSES`, `AVAILABILITY_WARNING`, audit actions (`shift.created`, etc.), `checkShiftConflict` semantics.
  - `convex/forms.ts`: functions, `isFieldRequired`, `submitForm` rejects missing/inactive, `completeCandidateTask`.
  - `convex/documentArchive.ts`: `ALLOWED_STATUSES`, `updateDocumentArchiveItem` audit `document.status_updated`, `listDocumentArchive` `expiringSoonDays`.
  - `convex/authHelpers.ts`: `TenantRole` union, identity shape.
  - `convex/seed.ts`: `seedAgency`, `seedCaregiverShifts`, `seedE2E`, `resetE2EShifts`, REF_TODAY idempotency.
  - E2E harness: `tests/e2e/helpers/auth.ts` `signInWithClerk`, `tests/e2e/helpers/env.ts` only admin/coordinator/caregiver vars; mock harness exists in `src/dev/mockClerkReact.tsx` but not wired in vite config.
  - UI routes and stub pages: list functional and stub pages. Only `CaregiverTodayPage` has data-testids; onboarding pages except ApplicationFormPage are stubs; no dedicated document-archive page.

  Section 3: Alternatives considered.

  - Real Clerk E2E only: rejected because credentials for HR/candidate missing and flaky; chosen approach uses env credentials when available, mock Clerk fallback otherwise.
  - Implement full candidate UI pages (offer, training, document upload): rejected out of scope for test task; chosen approach drives existing UI and uses direct backend calls for stubs.
  - Pure direct-API E2E: rejected not true E2E; chosen hybrid keeps browser navigation and UI assertions.
  - New `convex/seedPhase2.ts` vs extending `seed.ts`: chosen extend `seed.ts` to keep existing idempotency helpers and single entry point.

  Section 4: Files to create/modify table.

  Include:
  - tests/e2e/onboarding.spec.ts create
  - tests/e2e/scheduling.spec.ts create
  - tests/e2e/documents.spec.ts create
  - tests/e2e/helpers/auth.ts modify
  - tests/e2e/helpers/env.ts modify
  - tests/e2e/helpers/seed.ts create (optional) or use global-setup to call reset mutations
  - convex/onboarding.test.ts modify
  - convex/scheduling.test.ts modify
  - convex/forms.test.ts modify
  - convex/seed.ts modify
  - (maybe) src features add data-testid for E2E stability: CandidatePipelinePage, ApplicationReviewPage, HireConvertPage, SchedulingPage, ShiftEditorModal, ShiftPacketPanel, CoverageRequestsPanel, AvailabilityPage, ApplicationFormPage. But note minimal testids only.
  - playwright.config.ts maybe no change unless adding project.
  - package.json read-only.

  Section 5: Edge cases.

  - Multi-tenancy: every function uses requireTenantRole/assertTenantDoc; tests include cross-tenant negative cases.
  - Auth/role injection: integration tests use t.withIdentity; E2E uses real Clerk tickets or mock harness; sessions cleared between roles.
  - Idempotency: seed uses natural-key upsert; inviteCandidate reuses candidate; completePlatformTraining returns existing; submitApplication updates latest; hireCandidate upserts member/profile.
  - ADP/Clerk side effects: hireCandidate schedules internal.adpOutbound.adpSyncWorker and internal.candidates.updateClerkMembershipRole; integration tests stub fetch and env, use fake timers and finish scheduled functions.
  - PHI/PII: fake emails/names/addresses.
  - Shift conflict: adjacent allowed, overlap blocked, billing_ready excluded, excludeShiftId skips self.
  - Coverage guards: only assigned caregiver can requestCoverage; only admin/coordinator resolveCoverage; resolving to conflicting caregiver throws.
  - Form validation: missing required field, inactive form rejected; caregiver blocked from archive update.
  - Document archive: verified sets verifiedBy/verifiedAt; rejected requires reason and clears verified fields; active clears both.

  Section 6: Test strategy.

  - Integration: convex-test harness, schema+modules, identity injection, seed helpers, stub fetch/env, fake timers, finish scheduled functions.
  - E2E: Playwright workers=1, @auth tag, global setup seeds one Phase 2 tenant and role accounts; reset fixtures beforeEach; sign in per role; use data-testid locators; for stub pages call backend mutations directly and assert UI.
  - Gate commands: list with reporting. Mention E2E_FULL=1 requires .env.e2e and live dev server; if credentials missing, @auth specs skip.

  Section 7: Rollback/verification.

  - Create feature branch.
  - Run codegen after convex edits.
  - Verify generated diff only auto-generated.
  - Seed idempotency: run seedE2E/seedPhase2 twice, assert no duplicates.
  - Revert: git checkout or reset.

  Baseline gate status:
  - lint pass
  - typecheck pass
  - test 404 passed / 55 files
  - build pass (with CSS warning)
  - E2E not run (no .env.e2e/credentials).

  Need present final answer. It should be only the final plan markdown. The user asked to output final answer/verdict as requested. So final message is the plan. Need not mention tool usage.

  Let's compose. Keep it readable but detailed. Ensure no code snippets except maybe pseudo-test names. Do not write full code. Use tables.

  Need consider whether to include the file table for UI testids. The task didn't explicitly ask to modify UI, but for E2E stability it's necessary. Since plan is focused on what task requires, we can include minimal testid additions as necessary supporting changes. That's within pipeline. Include in files table with note "minimal data-testid additions only; no logic changes."

  Also note `convex/_generated/*` no manual edits, regenerate via codegen.

  Potential conflict: Existing tests cover a lot. In discovery notes, note which requested cases are already covered and which are gaps. In files table, for integration test files, specify "add missing cases" rather than create from scratch. For AC, phrase accordingly.

  Let's also note that `updateDocumentArchiveItem` is in `convex/documentArchive.ts`; the prompt says `convex/forms.test.ts`. We can add a cross-module test in `forms.test.ts` that imports `api.documentArchive.updateDocumentArchiveItem` or add it to `documentArchive.test.ts`. Since prompt explicitly says forms.test.ts, include it there but also note existing documentArchive.test.ts coverage.

  Need mention `convex/seed.ts` idempotent Phase 2 fixtures: candidate in 'submitted' with seeded application. Should be created by seed function `seedPhase2Fixtures` or extend `seedE2E`. It must be idempotent. Use deterministic natural keys.

  Need mention mock Clerk harness. Since existing mock harness not wired, plan to extend helpers/auth.ts with a `mockSignInAsRole(page, role, tenantId)` that stubs `window.Clerk` and pre-seeds tenant member via direct mutation. Or use `page.addInitScript` to set `window.Clerk` object and route to select-agency with org param. Need not detail code, just concept.

  Now produce final answer. Ensure language same as user (English).

To resume this session: kimi -r session_0f923a77-aaf0-43c6-80da-5bbd13f2a756
