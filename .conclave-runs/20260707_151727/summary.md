# Conclave run summary
- project: atriax
- result: **UNKNOWN** _(in progress)_
- run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_151727
- task: ATRIA-X Phase 2 comprehensive E2E and integration tests. (1) Playwright E2E candidate-to-caregiver flow in tests/e2e/onboarding.spec.ts (if missing, create it): seed one agency tenant, one org:hr user, one org:admin, one org:caregiver; use E2E_HR_EMAIL/E2E_HR_PASSWORD and E2E_CANDIDATE_EMAIL/E2E_CANDIDATE_PASSWORD env vars if available, otherwise use mock Clerk harness with role injection; test invite candidate → submitted → review → offer → accept → hire → training gate → complete training → /caregiver/today. (2) Playwright E2E scheduling flow in tests/e2e/scheduling.spec.ts: admin creates shift, conflict detection, caregiver availability, coverage request resolved. (3) Playwright E2E document archive in tests/e2e/documents.spec.ts: verify/reject/toggle expiring soon. (4) Integration tests in convex/onboarding.test.ts: candidateTasks order, submitApplication, reviewApplication, sendOffer, acceptOffer, hireCandidate creates employeeProfile + ADP sync pending_credentials, completePlatformTraining idempotency, hasPlatformTrainingCompleted, resetPlatformTraining, org:candidate cannot listShifts. (5) Integration tests convex/scheduling.test.ts: checkShiftConflict adjacent/overlap/excluded/completed, createShift audit, cross-caregiver conflict, caregiver role required, update/delete coverage guards. (6) Integration tests convex/forms.test.ts: submitForm missing/inactive fields, updateDocumentArchiveItem verifyBy/verifiedAt, org:caregiver cannot call. (7) Update convex/seed.ts idempotent Phase 2 fixtures: one candidate in 'submitted' with seeded application, one availability window, one coverage request 'open', one formDefinition with 3 fields (name required, experience required, notes optional), one documentArchiveItem pending_review. Style: single quotes, no semicolons, 2-space indent. Run and report pass/fail for npm run lint, typecheck, test, e2e (E2E_FULL=1), build; report actual counts. Do not edit the repo outside the pipeline.

## Stages
- {'stage': 'plan', 'how': 'synthesized by c_plan_agentic', 'chars': 23282, 'elapsed_s': 406.5}

## Stage timing
| Stage | Elapsed (s) |
|---|---|
| plan | 406.5 |
| **TOTAL** | **406.5** |