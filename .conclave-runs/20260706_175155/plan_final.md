• I inspected the actual ATRIA-X repo files and synthesized the three candidate plans into one grounded implementation plan.

  **Final plan written to:**  
  `.conclave-runs/20260706_175155/plan_c_plan_kimi-code.md`

  **Key decisions:**
  - **Extend existing integration tests** rather than replace them (`convex/onboarding.test.ts`, `scheduling.test.ts`, `forms.test.ts`, `documentArchive.test.ts` already exist and cover much of the requested behavior).
  - **Create three new Playwright E2E specs:** `tests/e2e/onboarding.spec.ts`, `scheduling.spec.ts`, and `documents.spec.ts`.
  - **Add a real Clerk candidate E2E user** (`E2E_CANDIDATE_EMAIL`/`PASSWORD`) to match the existing credential-based harness, with graceful skip when credentials are absent.
  - **Seed the 5 candidate tasks as complete** for the E2E onboarding flow, because `ApplicationReviewPage` blocks "Advance to next stage" until `allTasksComplete`.
  - **Add idempotent Phase 2 fixtures** to `convex/seed.ts`: submitted candidate + application, caregiver availability window, open coverage request, 3-field form definition, and pending-review document archive item.

  The plan includes all seven required sections: restated goal with numbered ACs, discovery notes citing real functions/types, alternatives considered, files table, edge-case analysis, test strategy with gate commands, and rollback/verification notes.


[stderr]
• I need to read the prompt file and carry out the instructions. Let me start by reading the file.The prompt asks me to synthesize the three candidate plans into ONE coherent, de-duplicated, best-of-all implementation plan. The discovery requirement says if I'm an agentic CLI, I must open and read actual relevant files. I am Kimi Code CLI, so I need to inspect the repo.

  The candidate plans include one from c_plan_agentic that claims to have inspected and written a plan, but the actual plan file content wasn't shown - only metadata. c_plan_qwen explicitly says it's chat-only and didn't inspect files. c_plan_kimi27 starts exploring but the file cut off.

  I need to do my own repo inspection and produce a synthesized plan. I should read the actual files.

  Let me start by reading key files in parallel. Based on the prompt, I need to inspect:
  - convex/onboarding.ts, convex/onboarding.test.ts
  - convex/candidates.ts
  - convex/scheduling.ts, convex/scheduling.test.ts
  - convex/forms.ts, convex/forms.test.ts
  - convex/documentArchive.ts, convex/documentArchive.test.ts
  - convex/seed.ts
  - convex/authHelpers.ts
  - convex/schema.ts
  - tests/e2e/global-setup.ts, existing e2e specs
  - src/app/router.tsx
  - package.json
  - playwright config

  Let me start with parallel reads of these files.Good, I have a lot of the core files. Now I need to read more files to complete the discovery:
  - candidates.ts lines 1000+ (attachCandidateDocument, etc.)
  - src/app/router.tsx
  - tests/e2e/helpers/auth.ts
  - tests/e2e/helpers/env.ts
  - playwright config
  - Existing e2e specs for patterns
  - Frontend pages: ApplicationReviewPage, CandidateOnboardingPage, TrainingPage, PlatformTrainingWizard, CaregiverTodayPage, SchedulingPage, AvailabilityPage, CaregiverSchedulePage, DocumentArchivePage, FormSubmissionPage, InviteCandidateModal, CandidatePipelinePage, HireConvertPage, OfferAcceptancePage, ApplicationFormPage

  Let me read these in parallel.I need a few more files to complete the discovery. Let me read:
  - trainingSteps model
  - CaregiverTodayPage
  - SchedulingPage
  - AvailabilityPage
  - CaregiverSchedulePage
  - DocumentArchiveRoute/Page
  - FormSubmissionPage
  - ApplicationFormPage
  - OfferAcceptancePage
  - HireConvertPage
  - CandidatePipelinePage
  - InviteCandidateModal
  - members.ts
  - invitations.ts
  - audit.ts
  - shifts.ts (if needed for scheduling mutations)
  - session1Phase2Integration.test.ts

  Let me read the most important ones.I have a comprehensive view now. Let me also check:
  - DocumentArchivePage (the actual page)
  - ShiftEditorModal and CoverageRequestsPanel (for E2E interactions)
  - DynamicFormRenderer (for form interactions)
  - session1Phase2Integration.test.ts
  - audit.ts
  - invitations.ts

  These will help complete the discovery notes.I now have enough information to write a comprehensive plan. Let me also quickly check the ShiftPacketPanel for coverage request UI and the DocumentDetailPanel for verify/reject actions, to make E2E notes precise.I now have comprehensive information. Let me create a todo list and write the plan. The plan should synthesize the three candidate plans, but since I did my own repo inspection, I'll produce a grounded plan that de-duplicates and improves upon them.

  Key findings:
  1. Existing integration tests already cover many required cases. The task is to EXTEND them, not replace.
  2. onboarding.test.ts exists but only covers training completions. Need to add candidate lifecycle tests.
  3. scheduling.test.ts exists with many tests. Need to add: createShift audit event, cross-caregiver conflict (currently only cross-tenant), caregiver role required for assignedCaregiver (via createShift/updateShift/assignShift).
  4. forms.test.ts exists. Need to align sample fields to task spec (name required, experience required, notes optional). Most required tests already exist.
  5. documentArchive.test.ts exists. Pending review verify/reject and expiring soon already tested. Need maybe a pending_review fixture-specific test.
  6. seed.ts needs Phase 2 fixtures.
  7. E2E files don't exist. Need to create onboarding.spec.ts, scheduling.spec.ts, documents.spec.ts.
  8. E2E harness currently only has admin/coordinator/caregiver. Candidate onboarding E2E needs either a real candidate user or a mock harness.

  The task specifically says "Output your final answer/verdict as requested." and "Produce a premium implementation plan with ALL of the following sections." It doesn't specify a file path. Looking at the directory, there are plan files like plan_c_plan_qwen.md and plan_c_plan_kimi27.md. I should write my plan to a new file in that directory, maybe plan_c_plan_kimi-code.md or plan_c_plan_kimi.md. Since the user asked me to carry out the instructions and output the final answer, I'll write it to a file and also provide a summary in the chat.

  Let me create the todo list and write the plan.Now I need to write the plan. Let me structure it carefully with all 7 required sections. I should be specific and cite actual function/type names from my inspection.

  Plan structure:
  1. Restated goal and numbered acceptance criteria
  2. Discovery notes - files/seams/contracts verified
  3. Alternatives considered
  4. Files to create/modify table
  5. Edge cases
  6. Test strategy
  7. Rollback/verification notes

  Let me draft the content carefully.

  Restated goal: Implement comprehensive E2E (Playwright) and integration (convex-test/Vitest) tests for ATRIA-X Phase 2 candidate-to-caregiver onboarding, scheduling, documents, and forms; plus idempotent Phase 2 fixtures in convex/seed.ts.

  AC:
  AC-1: tests/e2e/onboarding.spec.ts covers full candidate-to-caregiver flow: HR invites candidate, candidate accepts invitation, submits application, HR reviews and advances to offer, candidate accepts offer, HR hires, then as caregiver completes 5-step platform training and lands on /caregiver/today with hasPlatformTrainingCompleted true.
  AC-2: tests/e2e/scheduling.spec.ts covers admin adds shift, conflict detection, caregiver sees shift, sets recurring availability, requests coverage, admin resolves coverage.
  AC-3: tests/e2e/documents.spec.ts covers pending review document verify/reject and expiring soon filter.
  AC-4: convex/onboarding.test.ts extends with inviteCandidate seeds 5 candidateTasks, submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate, completePlatformTraining, hasPlatformTrainingCompleted, resetPlatformTraining, and role guard org:candidate cannot listShifts.
  AC-5: convex/scheduling.test.ts extends with checkShiftConflict adjacent/overlap/excludeId/completed (some exist), createShift audit event, cross-caregiver conflict, caregiver role required for assignedCaregiver, updateShift blocked on submitted, deleteShift blocked on in_progress, requestCoverage rejected for wrong caregiver.
  AC-6: convex/forms.test.ts aligns sample fields to name required/experience required/notes optional and tests submitForm missing required fields, inactive form rejection, and org:caregiver cannot call updateDocumentArchiveItem (actually in documentArchive.test.ts).
  Wait, the task says "Convex integration tests forms.test.ts: ... updateDocumentArchiveItem verifiedBy/verifiedAt, org:caregiver cannot call updateDocumentArchiveItem." But updateDocumentArchiveItem is in documentArchive.ts. So the task likely means these should be tested somewhere, and documentArchive.test.ts already covers them. I should note this in the plan: keep/extend documentArchive.test.ts for archive item tests, not forms.test.ts.
  AC-7: convex/seed.ts updated with idempotent Phase 2 fixtures: candidate in submitted status with application, one availability window for seeded caregiver, one open coverage request, one formDefinition with 3 fields, one documentArchiveItem pending_review.
  AC-8: All gates pass: npm run typecheck, npm run test, npm run e2e (or e2e:full for auth specs), npm run lint.

  Discovery notes:
  - convex/schema.ts defines candidates, applications, candidateTasks, availabilityWindows, coverageRequests, formDefinitions, formSubmissions, documentArchiveItems, platformTrainingCompletions, shifts.
  - convex/candidates.ts has CANDIDATE_TASK_TYPES = [form_submission, document_upload, background_check, reference_check, platform_training]; inviteCandidate action calls insertInvitedCandidate internal mutation which creates 5 candidateTasks; submitApplication, reviewApplication, sendOffer, acceptOffer, rejectOffer, hireCandidate mutations; hireCandidate requires candidate.clerkUserId and patches tenantMember role to org:caregiver.
  - convex/onboarding.ts has completePlatformTraining (idempotent, roles org:caregiver/org:candidate), hasPlatformTrainingCompleted, resetPlatformTraining (admin only).
  - convex/scheduling.ts has createShift/updateShift/deleteShift/assignShift/listShifts/listCaregiverShifts; add/update/deleteAvailabilityWindow; requestCoverage/resolveCoverage/listCoverageRequests; checkShiftConflict helper; assertCaregiverMember; createShift records audit event via internal.audit.record with action 'shift.created'.
  - convex/forms.ts has createFormDefinition (admin/hr), updateFormDefinition (admin only, blocks if submissions), deactivateFormDefinition, listFormDefinitions, submitForm (candidate/caregiver, checks active and required fields), listFormSubmissions, getFormSubmission, getFormDefinition.
  - convex/documentArchive.ts has listDocumentArchive (admin/hr) and updateDocumentArchiveItem (admin/hr) which sets verifiedBy/verifiedAt and rejectionReason, records audit event 'document.status_updated'.
  - convex/authHelpers.ts has requireTenantRole, assertTenantDoc, ensureTenantMember.
  - convex/seed.ts has seedE2EFixtures currently seeding admin/coordinator/caregiver and shifts; no Phase 2 candidate/availability/coverage/form/document fixtures.
  - src/app/router.tsx routes: /hr/candidates, /hr/candidates/:candidateId, /hr/candidates/:candidateId/hire, /onboarding, /onboarding/application, /onboarding/status, /onboarding/offer, /onboarding/training, /caregiver/today, /scheduling, /caregiver/schedule, /caregiver/availability, /documents, /forms/:formDefinitionId.
  - ApplicationReviewPage requires allTasksComplete before sendOffer.
  - PlatformTrainingWizard has 5 steps, scroll progress, minReadSeconds timer; completes via completePlatformTraining and redirects caregiver to /caregiver/today.
  - Existing e2e harness in tests/e2e/global-setup.ts and helpers/auth.ts supports admin/coordinator/caregiver Clerk sign-in tickets; no candidate E2E user.
  - playwright.config.ts skips @auth specs when credentials missing or local Convex.

  Alternatives:
  - Replace existing integration tests vs extend: choose extend to avoid duplication and preserve existing coverage.
  - Create separate new test files vs modify existing named files: task names match existing files (onboarding.test.ts, scheduling.test.ts, forms.test.ts), so extend existing; documentArchive.test.ts already exists. For E2E, create new spec files.
  - Mock Clerk in E2E vs real candidate user: choose real Clerk candidate credentials for production-like auth, with fallback to skip when env vars missing (consistent with existing harness). Add E2E_CANDIDATE_EMAIL/PASSWORD to env.
  - Programmatically complete candidate tasks in E2E via direct DB seed vs UI: use UI for application/training, but seed can pre-create tasks. However ApplicationReviewPage requires all tasks complete; need to either complete all tasks in E2E or add a test-only helper. Since the task flow mentions only application and training, but the code requires all 5 tasks, the E2E must complete document upload, background check acknowledgment, and reference check acknowledgment too, OR seed must mark them complete. The plan should note this seam and recommend completing all tasks through UI or a seed helper.

  Files table:
  | File | Change type | What changes |
  | tests/e2e/onboarding.spec.ts | Create | Full candidate-to-caregiver E2E flow with training mock |
  | tests/e2e/scheduling.spec.ts | Create | Admin shift creation, conflict, availability, coverage E2E |
  | tests/e2e/documents.spec.ts | Create | Document verify/reject and expiring soon filter E2E |
  | tests/e2e/helpers/auth.ts | Modify | Add E2E_CANDIDATE_EMAIL/PASSWORD exports and credential check |
  | tests/e2e/helpers/env.ts | Modify | Add candidate credentials to availability check |
  | .env.e2e.example | Modify | Document E2E_CANDIDATE_EMAIL/PASSWORD |
  | playwright.config.ts | Modify | Include candidate credentials in skipAuthSpecs logic if needed |
  | convex/onboarding.test.ts | Modify | Add candidate lifecycle and guard tests |
  | convex/scheduling.test.ts | Modify | Add audit, cross-caregiver conflict, caregiver-assign guard tests |
  | convex/forms.test.ts | Modify | Align sampleFields to name required/experience required/notes optional |
  | convex/documentArchive.test.ts | Modify | Ensure pending_review fixture test and org:caregiver block |
  | convex/seed.ts | Modify | Add Phase 2 idempotent fixtures |
  | convex/seed.test.ts | Modify | Add assertions for Phase 2 fixtures |
  | package.json | Verify | Test scripts unchanged |

  Edge cases:
  - Multi-tenancy: all Convex functions use requireTenantRole + assertTenantDoc; tests must use cross-tenant negative cases.
  - Role guards: org:candidate cannot call listShifts (scheduling.test.ts already has org:caregiver block; add org:candidate). org:caregiver cannot call updateDocumentArchiveItem (already tested). Caregiver role required for assignedCaregiver in createShift/updateShift/assignShift.
  - PHI/PII: candidate documents and application fields should only be visible to candidate, admin, hr.
  - Idempotency: completePlatformTraining returns existing completion; insertInvitedCandidate reuses withdrawn/incomplete rows; seed functions use find-by-key upsert.
  - State machines: candidate status transitions enforced (cannot sendOffer unless hr_review, cannot hire unless accepted, hire requires clerkUserId). Shift status blocks (updateShift on submitted, deleteShift only scheduled). Coverage only for scheduled shifts.
  - Training mock: PlatformTrainingWizard requires scroll to bottom and timer; Playwright can use page.evaluate to scroll contentRef and fake timers.

  Test strategy:
  - Unit/Integration: run `npm run test` (vitest run). Use convexTest with schema/modules. Use withIdentity to simulate roles.
  - E2E: run `npm run e2e` (excludes @auth if creds missing) or `npm run e2e:full` for full run. Use @auth tag for authenticated specs.
  - Gates: npm run lint, npm run typecheck, npm run test, npm run e2e, npm run build.

  Rollback:
  - Revert git commit. No production code changes.
  - After seed.ts changes, run `npx convex codegen` to regenerate types.
  - If E2E creates Clerk invitation/candidate user, clean up in afterAll or use disposable candidate account.

  Let me write this to a file. I'll use Write to create the plan file.Now I should update the todo list and provide the final summary. The plan is written to the file. I should mention the file path and give a concise high-level summary.Now provide the final summary and mark the todo done.The user wants me to carry out the instructions in the prompt file and output the final answer/verdict. I've written the plan to a file. Now I should provide the final answer as a concise summary.

To resume this session: kimi -r session_4e4a7f45-620e-448a-b4e8-bd4710ef91ba
