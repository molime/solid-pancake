# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

# Implementation Plan: Fix Environment Stub Isolation in `convex/candidates.test.ts`

## 1. Restated Goal & Acceptance Criteria

**Goal:** Ensure the `inviteCandidate` error-path tests in `convex/candidates.test.ts` are fully isolated from environment values set by earlier tests or helpers, so missing-variable assertions are deterministic and do not accidentally call mock Clerk APIs.

**Acceptance Criteria:**
- **AC-1:** The test `throws a clear error when CLERK_SECRET_KEY is missing` explicitly stubs `CLERK_SECRET_KEY` to an empty string at the top of its block.
- **AC-2:** The test `throws a clear error when APP_URL is missing` explicitly stubs `APP_URL` to an empty string at the top of its block.
- **AC-3:** Running `npm run test convex/candidates.test.ts` passes with no failures.
- **AC-4:** No other test logic, assertions, or production code are changed; the change is limited to `vi.stubEnv` calls.

## 2. Discovery Notes

I inspected the actual repository files before writing this plan.

- **`convex/candidates.test.ts`**: Uses Vitest (`vi.stubEnv`, `vi.unstubAllEnvs`, `vi.unstubAllGlobals`). The relevant test block is inside the `inviteCandidate` `describe`.
- **Line 261**: `it('throws a clear error when CLERK_SECRET_KEY is missing', ...)` already contains `vi.stubEnv('CLERK_SECRET_KEY', '')` as the first statement, next to `vi.stubEnv('APP_URL', 'http://localhost')`.
- **Lines 279–294**: `it('throws a clear error when APP_URL is missing', ...)` stubs `CLERK_SECRET_KEY` to `'sk_test_clerk'` but does **not** explicitly stub `APP_URL` to empty. It relies on `afterEach` cleanup (`vi.unstubAllEnvs()`) or an unset default.
- **Helper functions**: `stubClerkInvitation()` and `stubClerkMembershipUpdate()` both set `vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')`. `stubClerkInvitation()` also sets `APP_URL` to `'http://localhost'`.
- **Cleanup**: `afterEach` at lines 69–73 calls `vi.unstubAllEnvs()` and `vi.unstubAllGlobals()`.
- **`package.json`**: Test command is `vitest run --configLoader native`, invoked as `npm run test convex/candidates.test.ts`.
- **Current verification**: `npm run test convex/candidates.test.ts` passes (19/19 tests), but the `APP_URL` missing test remains implicitly dependent on cleanup ordering. Adding the explicit stub removes that fragility.

## 3. Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|-------------|------|------|---------|
| **A. Rely solely on `afterEach` `vi.unstubAllEnvs()`** | No test changes | If cleanup order changes or a test fails mid-run, stubs leak; the exact failure described in the task is caused by such leakage. | Rejected |
| **B. Add `vi.unstubAllEnvs()` at the start of each error-path test** | Guaranteed clean slate | Clears everything, including values the test itself wants to set (e.g., `CLERK_SECRET_KEY` for the APP_URL case), requiring re-stubbing anyway. Less declarative. | Rejected |
| **C. Explicit `vi.stubEnv('<VAR>', '')` in each missing-variable test** | Declarative, self-documenting, robust against ordering or helper leakage, minimal diff | Two extra lines of boilerplate | **Chosen** |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
|------|-------------|--------------|
| `convex/candidates.test.ts` | Modify | Add `vi.stubEnv('APP_URL', '')` at the top of the `throws a clear error when APP_URL is missing` test (lines 279–294). Verify `vi.stubEnv('CLERK_SECRET_KEY', '')` remains at the top of the `throws a clear error when CLERK_SECRET_KEY is missing` test. |

## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

- **Environment leakage (primary risk):** A leftover `CLERK_SECRET_KEY` from `stubClerkInvitation()` or `stubClerkMembershipUpdate()` can cause the missing-key test to reach the mock Clerk API and throw `Resource not found` instead of the expected validation error. Explicit empty-string stubs prevent this.
- **APP_URL leakage:** A leftover `APP_URL` from `stubClerkInvitation()` would cause the missing-APP_URL test to falsely pass or hit the mock API. Explicit stubbing removes the dependency on cleanup.
- **Secrets:** No real secrets are introduced; values remain mock/test strings.
- **Multi-tenancy / PHI:** These tests exercise system configuration validation, not tenant data access. No `authHelpers` guards or tenant authorization logic change. No PHI is involved.
- **Idempotency:** The change is stateless test setup; rerunning the file produces identical results.

## 6. Test Strategy

- **Gate command:** `npm run test convex/candidates.test.ts`
- **Expected result:** `19 passed` with no failures.
- **Focused assertions to confirm:**
  - Test name `throws a clear error when CLERK_SECRET_KEY is missing` reports pass and the error message contains `CLERK_SECRET_KEY`.
  - Test name `throws a clear error when APP_URL is missing` reports pass and the error message contains `APP_URL`.
  - No `Resource not found` errors from mock Clerk API calls.
- **Regression guard:** Run the full file once; if CI runs tests in parallel, verify this file still passes in isolation (`npm run test convex/candidates.test.ts`) and as part of the full suite (`npm run test`).

## 7. Rollback / Verification Notes

- **Rollback:** `git checkout HEAD -- convex/candidates.test.ts`
- **Post-change verification:** Run `npm run test convex/candidates.test.ts` and confirm all 19 tests pass.
- **No codegen/deploy needed:** This is a test-only change. Do not run `npx convex codegen` or `convex deploy` for this diff.
- **If the test still fails after adding the stub:** Check whether another test or helper stubs globals (e.g., `fetch`) that leak across tests despite `vi.unstubAllGlobals()`. The fix in that case would be to move the global stub into the specific tests that need it, but that is out of scope for this task.

VERDICT: APPROVED