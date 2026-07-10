# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

1. **Restated goal** and **numbered acceptance criteria**
Goal: Implement comprehensive Phase 2 test coverage for Atria-X onboarding, scheduling, and documents, ensuring multi-tenant security and data integrity across Convex backend and React frontend.

- AC-1: Playwright E2E `tests/e2e/onboarding.spec.ts` covers full candidate-to-caregiver lifecycle (invite → hire → training → `/caregiver/today`) using env vars or mock Clerk harness
- AC-2: Playwright E2E `tests/e2e/scheduling.spec.ts` validates shift creation, conflict detection, availability checks, and coverage resolution
- AC-3: Playwright E2E `tests/e2e/documents.spec.ts` verifies document archive actions (verify/reject/toggle expiring) with role guards
- AC-4: Integration tests `convex/onboarding.test.ts` cover task order, application submission, offer flow, hiring (employeeProfile + ADP sync), training idempotency, and role-based access control (org:candidate cannot listShifts)
- AC-5: Integration tests `convex/scheduling.test.ts` cover shift conflicts (adjacent/overlap/excluded/completed), audit logs, cross-caregiver conflicts, and coverage guards
- AC-6: Integration tests `convex/forms.test.ts` cover form submission validation, document archive updates (verifyBy/verifiedAt), and caregiver role restrictions
- AC-7: `convex/seed.ts` updated with idempotent Phase 2 fixtures (candidate, availability, coverage request, formDefinition, documentArchiveItem) and all pipelines (lint, typecheck, test, e2e, build) pass with reported counts

2. **Discovery notes**
- Backend inspection unavailable: I am a chat-only model and cannot open local files in the Atria-X repo
- Inferred structure based on task description and standard Convex/Clerk patterns:
  - Convex functions likely reside in `convex/onboarding.ts`, `convex/scheduling.ts`, `convex/forms.ts`
  - Auth guards expected in `convex/authHelpers.ts` enforcing `org:admin`, `org:coordinator`, `org:caregiver`
  - Generated types available at `convex/_generated/api` and `convex/_generated/dataModel`
  - Playwright config likely at `playwright.config.ts` with `tests/e2e` directory
  - Seed logic expected at `convex/seed.ts` using `ctx.db.insert`
- Key function names cited from task: `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate`, `completePlatformTraining`, `checkShiftConflict`, `updateDocumentArchiveItem`

3. **Alternatives considered**
- Option A: Full Clerk E2E with real emails
  - Rejected: Slow, flaky, requires external SMTP setup, violates cost-conscious constraint
- Option B: Mock Clerk harness with role injection
  - Selected: Faster, deterministic, aligns with 'E2E_HR_EMAIL' env var fallback strategy, keeps tests local
- Option C: Unit tests only for Convex functions
  - Rejected: Misses integration points (auth guards, multi-tenancy checks); Integration tests (Vitest + Convex test helper) preferred for backend logic
- Option D: Manual seed data
  - Rejected: Not reproducible; idempotent `seed.ts` ensures clean state for every test run

4. **Files to create/modify**
| File | Change type | What changes |
| :--- | :--- | :--- |
| `tests/e2e/onboarding.spec.ts` | Create | E2E flow: invite → hire → training → dashboard |
| `tests/e2e/scheduling.spec.ts` | Create | E2E flow: shift create → conflict → coverage |
| `tests/e2e/documents.spec.ts` | Create | E2E flow: doc verify/reject/expiring toggle |
| `convex/onboarding.test.ts` | Create | Vitest suite for onboarding mutations and queries |
| `convex/scheduling.test.ts` | Create | Vitest suite for shift logic and conflict detection |
| `convex/forms.test.ts` | Create | Vitest suite for forms and document archive guards |
| `convex/seed.ts` | Modify | Add Phase 2 fixtures (candidate, availability, coverage, form, doc) |
| `package.json` | Verify | Ensure scripts for `lint`, `typecheck`, `test`, `e2e`, `build` exist |

5. **Data/auth/security/multi-tenant/PHI/idempotency edge cases**
- Multi-tenancy: Every Convex test must assert `authHelpers` prevent cross-org data access; seed data must belong to specific `orgId`
- PHI/Security: Document archive tests must ensure only `org:admin` or `org:coordinator` can verify; caregivers cannot bypass
- Idempotency: `completePlatformTraining` must be safe to call multiple times without duplicating records or resetting progress
- Race conditions: Scheduling tests must handle adjacent shift boundaries (end time of A == start time of B) correctly
- Role escalation: Ensure `org:candidate` cannot access `listShifts` even if they guess the function name
- ADP Sync: `hireCandidate` must set `pending_credentials` flag correctly without blocking the transaction

6. **Test strategy**
- Unit/Integration: Use `convex-test` helper to wrap Convex context; mock external APIs (ADP) via spies
- E2E: Use Playwright with `E2E_FULL=1` for full suite; default to mock Clerk for speed
- Commands to run and report:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test` (Vitest)
  - `npm run e2e` (Playwright)
  - `npm run build`
- Gate: CI pipeline fails if any command exits non-zero or test count drops below expected baseline
- Reporting: Output pass/fail status and actual test counts for each command in the final report

7. **Rollback / verification notes**
- Rollback: Revert git commit; run `npx convex seed` to reset DB to pre-Phase 2 state if seed modified production-like data
- Verification: Confirm `convex/_generated` files are not manually edited; run `npx convex codegen` after any convex/* change
- Clean up: Ensure `seed.ts` is idempotent so repeated runs do not duplicate fixtures
- Shared Memory: Log test results to `C:/Users/pinol/.agent-memory/memory.json` via MCP if available, noting pass/fail counts for Diego's review