# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

1. **Restated Goal and Acceptance Criteria**

Goal: Stabilize Phase 2 worker onboarding test suite by fixing E2E flakiness in scheduling, ensuring comprehensive integration test coverage for onboarding/scheduling/forms logic, and verifying idempotent seeding. All CI gates must pass green.

AC-1: `tests/e2e/scheduling.spec.ts` passes consistently without viewport errors or stale shift conflicts
AC-2: Integration tests (`convex/*.test.ts`) cover all specified business logic paths (onboarding state machine, shift conflicts, form validation)
AC-3: `convex/seed.ts` creates Phase 2 fixtures idempotently and cleans up shifts by matching both Clerk user ID and Convex member ID
AC-4: `ShiftPacketPanel.tsx` regression verified (no crash on missing client phone)
AC-5: All gates pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run build`


2. **Discovery Notes**

Limitation: I am a chat-only model and cannot directly inspect files at `C:/Users/pinol/Documents/Work/atriax/solid-pancake`. I am reasoning from the provided task context and shared memory.

Key Inferences from Context:
- `tests/e2e/scheduling.spec.ts`: Failure mode is Playwright visibility check vs actual DOM presence (overlay/viewport issue) and data contamination (stale shifts)
- `convex/seed.ts`: Existing `deleteFixtureCaregiverShifts` likely filters by `caregiverId` but shifts might store `memberId` (Convex _id) or `clerkUserId`
- `convex/onboarding.test.ts`: Needs to verify state transitions (candidate -> hired -> trained) and idempotency of training completion
- `convex/scheduling.test.ts`: Needs to verify conflict logic (adjacent vs overlapping) and role guards (caregiver vs admin)
- `convex/forms.test.ts`: Needs to verify required field enforcement and role-based write access (caregiver cannot verify)
- `ShiftPacketPanel.tsx`: Previous patch addressed `client?.phone` crash; needs regression check during E2E


3. **Alternatives Considered**

- **Stale Shift Cleanup Strategy**
  - Option A: Generate unique test dates per run
    - Pro: No cleanup needed
    - Con: Makes assertions harder (dynamic dates), doesn't solve underlying ID mismatch
  - Option B: Enhance cleanup to match both Clerk ID and Convex Member ID
    - Pro: Solves root cause, keeps test data deterministic
    - Con: Requires querying members table to map Clerk ID to Convex ID
    - Decision: Option B. Robustness > convenience. Ensures clean state regardless of previous run failures

- **Playwright Click Strategy**
  - Option A: `force: true` on click
    - Pro: Bypasses viewport check
    - Con: Ignores real UI issues (overlays)
    - Decision: Use `scrollIntoViewIfNeeded()` then click. If still fails, use `force: true` as fallback. This balances realism with stability

- **Integration Test Framework**
  - Option A: Mock Convex functions
    - Pro: Fast
    - Con: Doesn't test actual Convex logic/security rules
  - Option B: Use `convex-test` harness
    - Pro: Tests actual function logic + auth guards
    - Con: Slightly slower
    - Decision: Option B. Required for verifying auth guards and DB side effects


4. **Files to Create/Modify**

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `tests/e2e/scheduling.spec.ts` | Modify | Add `scrollIntoViewIfNeeded()` before coverage request click; enhance cleanup to query shifts by member ID |
| `convex/seed.ts` | Modify | Add Phase 2 fixtures (candidate status, availability, coverage request, form def, doc archive); make all inserts idempotent (check existence) |
| `convex/onboarding.test.ts` | Modify/Create | Add tests for state machine transitions, ADP sync queue, training idempotency, role guards on listShifts |
| `convex/scheduling.test.ts` | Modify/Create | Add tests for conflict logic (overlap vs adjacent), audit logs, role guards on create/update/delete |
| `convex/forms.test.ts` | Modify/Create | Add tests for required field validation, inactive form rejection, archive verification guards |
| `src/components/ShiftPacketPanel.tsx` | Verify | Confirm `client?.phone` optional chaining is present; add test case if missing |
| `convex/authHelpers.ts` | Verify | Ensure `requireRole` guards are used in all modified convex functions |


5. **Data/Auth/Security/Multi-Tenant/PHI/Idempotency Edge Cases**

- **Multi-Tenancy**: All Convex functions must use `authHelpers.getOrgId(ctx)` or similar to scope data. Tests must assert that Org A cannot see Org B shifts
- **Auth Roles**: Integration tests must explicitly set auth context (admin vs caregiver vs candidate). `org:candidate` must fail `listShifts`
- **Idempotency**: `seed.ts` must use `ctx.db.query(...).unique()` before insert. `completePlatformTraining` must return existing status if already done
- **ID Mismatch**: Shift cleanup must resolve Clerk `user_id` -> Convex `members._id` before deleting shifts, as shifts likely reference Convex IDs
- **PHI/Data Privacy**: Ensure test seeds do not use real PII. Use generated fixtures (e.g., `test-caregiver-<timestamp>`)
- **Race Conditions**: E2E tests should await specific UI states (e.g., `getByText('Conflict resolved')`) rather than fixed timeouts


6. **Test Strategy**

- **Unit/Integration**:
  - Command: `npm run test`
  - Focus: `convex/*.test.ts` using `convex-test` harness
  - Coverage: Verify all AC-2 requirements (state transitions, conflict logic, form validation)

- **E2E**:
  - Command: `npm run e2e`
  - Focus: `tests/e2e/scheduling.spec.ts` and `tests/e2e/onboarding.spec.ts`
  - Config: Ensure `vite.config.ts` has HMR overlay disabled for CI
  - Auth: Use `solid-pancake/.env.local` E2E_* credentials (do not commit)

- **Gates**:
  - `npm run lint`: Ensure no new ESLint errors
  - `npm run typecheck`: Ensure TypeScript strictness passes
  - `npm run build`: Ensure production build succeeds
  - `npx convex codegen`: Run after any `convex/` changes to regenerate types

- **Reporting**:
  - Check `test-results/` for Playwright HTML report
  - Report exact pass/fail counts in session summary


7. **Rollback / Verification Notes**

- **Rollback**:
  - Git branch `feature/phase-2-worker-onboarding` is isolated
  - If `convex/` schema changes occur (unlikely for tests), revert via `git checkout`
  - If seed data corrupts dev DB, run `npx convex run seed:reset` (if available) or manually clear test fixtures

- **Verification**:
  - Confirm `convex/_generated` is not manually edited (git ignore check)
  - Confirm `.env.local` is not committed
  - Verify `ShiftPacketPanel.tsx` renders without console errors when client phone is null
  - After changes, run `npx convex codegen` locally to ensure type sync before pushing

- **Post-Merge**:
  - Monitor Conclave orchestration logs for any model swap issues during test runs (Diego's context)
  - Ensure shared memory (`memory.json`) updates reflect test completion status