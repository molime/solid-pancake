# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# ATRIA-X Phase 2 Test Implementation Plan

## 1. Restated Goal and Acceptance Criteria

**Goal:** Implement comprehensive E2E and integration test coverage for ATRIA-X Phase 2 features (onboarding, scheduling, documents, forms) ensuring multi-tenancy security, role-based access control (RBAC), and data integrity before release.

**Acceptance Criteria:**
- **AC-1:** `tests/e2e/onboarding.spec.ts` passes full candidate-to-caregiver flow including 5-step training mock and redirect verification.
- **AC-2:** `tests/e2e/scheduling.spec.ts` passes shift creation, conflict detection, availability, and coverage request/resolution flow.
- **AC-3:** `tests/e2e/documents.spec.ts` passes document verification/rejection and expiring soon filter validation.
- **AC-4:** `convex/onboarding.test.ts` verifies all mutation functions (invite, apply, offer, hire, training) and enforces `org:candidate` cannot access `listShifts`.
- **AC-5:** `convex/scheduling.test.ts` verifies conflict logic (adjacent/overlap), audit logs, role guards, and state blockers (submitted/in_progress).
- **AC-6:** `convex/forms.test.ts` verifies form validation, inactive form rejection, document archive updates, and `org:caregiver` restriction on archive updates.
- **AC-7:** `convex/seed.ts` updated with idempotent Phase 2 fixtures (candidate, availability, coverage request, form definition, pending document).
- **AC-8:** All gates pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run build`.

## 2. Discovery Notes

**Limitation:** I am a chat-only backend. I have **not inspected the actual files** in the repository. I am reasoning from the provided task context, standard Convex + Clerk + Playwright patterns, and the ATRIA-X stack description.

**Inferred Contracts & Seams:**
- **Auth:** Clerk middleware likely wraps Convex actions. E2E will need `E2E_HR_EMAIL`/`E2E_CANDIDATE_EMAIL` env vars or a mock harness injecting `org:admin`/`org:candidate` roles.
- **Convex Guards:** Functions likely use `authHelpers.getUserId(ctx)` and `authHelpers.getOrgRole(ctx)` to enforce multi-tenancy.
- **Generated Types:** `convex/_generated/api.d.ts` will provide types for function calls in integration tests.
- **Training Mock:** The 5-step training likely involves a client-side state machine (React) interacting with a Convex mutation `completePlatformTraining`.
- **Seed Idempotency:** `convex/seed.ts` likely checks for existence before creating records to avoid duplicates on repeated runs.

## 3. Alternatives Considered

| Approach | Why Rejected/Chosen |
| :--- | :--- |
| **Cypress vs Playwright** | **Chosen Playwright.** Task explicitly specifies Playwright. Better multi-tab/context support for admin/caregiver flows. |
| **Mock Clerk vs Real Credentials** | **Hybrid.** E2E specs requiring live sign-in will fail fast if creds absent (security). Mock harness used for unit/integration where auth flow is not the test subject. |
| **Manual DB Setup vs Seed Script** | **Chosen Seed Script.** `convex/seed.ts` ensures reproducible state for integration tests without manual DB manipulation. |
| **Full E2E for Logic vs Integration** | **Split.** Complex logic (conflict detection, role guards) tested in Convex integration tests (fast, isolated). UI flows tested in E2E (slow, realistic). |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `tests/e2e/onboarding.spec.ts` | Create | Playwright spec: Invite → Apply → Offer → Hire → Training → Redirect. |
| `tests/e2e/scheduling.spec.ts` | Create | Playwright spec: Shifts, conflicts, availability, coverage requests. |
| `tests/e2e/documents.spec.ts` | Create | Playwright spec: Document review workflow and filters. |
| `convex/onboarding.test.ts` | Create | Vitest integration: Seed tasks, flow mutations, role guard verification. |
| `convex/scheduling.test.ts` | Create | Vitest integration: Conflict logic, audit trails, state blockers. |
| `convex/forms.test.ts` | Create | Vitest integration: Form validation, archive updates, role restrictions. |
| `convex/seed.ts` | Modify | Add idempotent Phase 2 fixtures (candidate, availability, coverage, form, doc). |
| `.env.example` | Modify | Document required E2E Clerk credentials vars. |
| `package.json` | Verify | Ensure `test`, `e2e`, `lint`, `typecheck`, `build` scripts exist. |

## 5. Data/Auth/Security/Multi-Tenant/PHI Edge Cases

- **Multi-Tenancy:** Every Convex function call in integration tests must simulate a specific `orgId`. Tests must verify that User A (Org 1) cannot access User B (Org 2) data.
- **Role Guards:** Explicitly test negative cases (e.g., `org:candidate` calling `listShifts` must throw 403).
- **PHI/PII:** Document tests must ensure sensitive data is only visible to `org:admin` or `org:coordinator`, not `org:caregiver` unless assigned.
- **Race Conditions:** Scheduling conflict tests must simulate overlapping requests to ensure database constraints or transactional logic prevents double-booking.
- **Idempotency:** `convex/seed.ts` must use `upsert` or check-exist-before-create patterns to prevent test flakiness on re-runs.
- **State Machines:** Hiring flow must enforce order (cannot hire before offer accepted). Training gate must block `/caregiver/today` access until `hasPlatformTrainingCompleted` is true.

## 6. Test Strategy

**Unit/Integration (Convex):**
- Run via `npm run test`.
- Use `convex-test` helper to mock auth context.
- **Onboarding:** Verify `inviteCandidate` creates 5 `candidateTasks`. Verify `hireCandidate` sets role to `org:caregiver`.
- **Scheduling:** Test `checkShiftConflict` with adjacent (ok), overlap (fail), excludeId (ok), completed (ok).
- **Forms:** Test `submitForm` with missing required fields (fail). Test `updateDocumentArchiveItem` with `org:caregiver` (fail).

**E2E (Playwright):**
- Run via `npm run e2e`.
- **Auth:** Check for `E2E_HR_EMAIL`. If missing, skip authenticated specs or use mock harness.
- **Onboarding:** Assert URL changes to `/caregiver/today`. Assert `hasPlatformTrainingCompleted` in Convex DB after training.
- **Scheduling:** Visually verify conflict error messages. Verify coverage request status change.
- **Documents:** Verify filter shows only "expiring soon" items.

**Gates:**
1. `npm run lint` (ESLint)
2. `npm run typecheck` (TSC)
3. `npm run test` (Vitest Convex integration)
4. `npm run e2e` (Playwright)
5. `npm run build` (Vite production build)

## 7. Rollback / Verification Notes

- **Rollback:** Revert git commit containing test files and seed changes. No production code is modified, so risk is low.
- **Seed Cleanup:** If `convex/seed.ts` creates persistent test data, ensure tests clean up after themselves or use isolated test orgs to prevent pollution.
- **Verification:**
  - Confirm `npm run e2e` exits with code 0.
  - Confirm Convex dashboard shows new test documents created during integration run.
  - Confirm no TypeScript errors in `convex/_generated` after `npm run convex codegen`.
- **Post-Merge:** Monitor Convex function logs for 403 errors indicating potential regression in auth guards during real usage.