# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

1. **Restated goal** and **numbered acceptance criteria**
  Goal: Implement Phase 2 test coverage for Atria-X covering onboarding, scheduling, and document compliance, ensuring multi-tenant security and data integrity before release
  AC-1: `tests/e2e/onboarding.spec.ts` exists and passes full candidate-to-caregiver flow including training gate
  AC-2: `tests/e2e/scheduling.spec.ts` exists and passes shift creation, conflict detection, and coverage resolution
  AC-3: `tests/e2e/documents.spec.ts` exists and passes verify/reject/expiring soon workflows
  AC-4: `convex/onboarding.test.ts` covers state transitions, ADP sync pending, and role guards for candidates
  AC-5: `convex/scheduling.test.ts` covers conflict logic (adjacent/overlap/excluded), audit logs, and role guards
  AC-6: `convex/forms.test.ts` covers field validation, document archive updates, and caregiver role restrictions
  AC-7: `convex/seed.ts` updated with idempotent Phase 2 fixtures without breaking Phase 1 data
  AC-8: Pipeline passes `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run build` with zero failures

2. **Discovery notes**
  Limitation: I am a chat-only backend and have not inspected the actual repository files or filesystem
  Assumption: Based on task description, I assume standard Convex + Clerk + Playwright structure
  Assumed contracts:
    - `convex/authHelpers.ts`: Contains `requireRole`, `getUserId`, `getOrgId` guards
    - `convex/_generated/api.js`: Auto-generated Convex client types
    - `convex/onboarding.ts`: Contains `submitApplication`, `reviewApplication`, `hireCandidate`
    - `convex/scheduling.ts`: Contains `createShift`, `checkShiftConflict`, `requestCoverage`
    - `convex/forms.ts`: Contains `submitForm`, `updateDocumentArchiveItem`
    - `tests/utils/auth.ts`: Likely exists for Clerk mocking in E2E
  Risk: If `authHelpers` naming differs, guards will fail compilation until adjusted

3. **Alternatives considered**
  Option A: Unit test Convex functions in isolation without `convex-test` harness
    - Rejected: Loses transactional integrity checks and auth context simulation
  Option B: Use real Clerk test keys for E2E
    - Rejected: Flaky due to external dependency and email delivery latency; mock harness preferred
  Option C: Merge all E2E into one `main.spec.ts`
    - Rejected: Violates separation of concerns; harder to parallelize and debug failures
  Chosen approach: Dedicated spec files per domain + `convex-test` harness for integration tests ensures speed, isolation, and accurate auth simulation

4. **Files to create/modify**
  | File | Change type | What changes |
  | --- | --- | --- |
  | `tests/e2e/onboarding.spec.ts` | Create | Playwright flow: invite -> hire -> training -> dashboard |
  | `tests/e2e/scheduling.spec.ts` | Create | Playwright flow: shift create -> conflict -> coverage |
  | `tests/e2e/documents.spec.ts` | Create | Playwright flow: upload -> verify -> expire warning |
  | `convex/onboarding.test.ts` | Create | Vitest suite for onboarding mutations and state machine |
  | `convex/scheduling.test.ts` | Create | Vitest suite for conflict logic and audit trails |
  | `convex/forms.test.ts` | Create | Vitest suite for form validation and archive guards |
  | `convex/seed.ts` | Modify | Add Phase 2 fixtures (candidate, availability, coverage, form, doc) idempotently |

5. **Data/auth/security/multi-tenant/PHI/idempotency edge cases**
  Multi-tenancy: Every Convex test must seed a unique `orgId` and assert cross-org data leakage is impossible
  Auth guards: Verify `org:candidate` cannot call `listShifts` and `org:caregiver` cannot call `updateDocumentArchiveItem`
  Idempotency: `completePlatformTraining` must be safe to call twice without resetting progress or duplicating records
  PHI/Security: Document archive tests must ensure only `org:admin` or `org:hr` can verify sensitive documents
  Race conditions: Scheduling conflicts must be tested with overlapping start/end times exactly on the minute boundary
  Seed idempotency: `convex/seed.ts` must check existence before creating fixtures to prevent duplicate data on re-run

6. **Test strategy**
  Unit/Integration: Use `convex-test` to instantiate isolated backend instances per test file
  E2E: Use Playwright with `E2E_HR_EMAIL` env vars or mock Clerk session injection via cookie storage
  Commands to run:
    - `npm run lint`: Verify eslint rules (2-space, single quotes, no semis)
    - `npm run typecheck`: Verify TypeScript strictness
    - `npm run test`: Run Vitest integration tests
    - `npm run e2e`: Run Playwright suites (use `E2E_FULL=1` for full suite)
    - `npm run build`: Verify production build integrity
  Gate: CI blocks merge if any command returns non-zero exit code
  Reporting: Report actual pass/fail counts for each command in the final summary

7. **Rollback / verification notes**
  Rollback: Revert git commit affecting `convex/` and `tests/`; run `npx convex codegen` to restore types
  Verification: After merge, run `convex/seed.ts` on staging to ensure fixtures load without errors
  Monitoring: Watch Convex function logs for `authHelpers` rejection spikes post-deploy
  Data cleanup: Ensure test runs do not pollute production Convex database (use separate project key for E2E)