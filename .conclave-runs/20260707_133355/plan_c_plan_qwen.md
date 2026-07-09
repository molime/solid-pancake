# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Fix Env Stubbing in `convex/candidates.test.ts`

## 1. Restated Goal & Acceptance Criteria
**Goal:** Isolate environment variable state in `convex/candidates.test.ts` to prevent leakage between tests, specifically ensuring missing key scenarios correctly trigger validation errors without interference from previously stubbed values.

**Acceptance Criteria:**
- AC-1: The test `throws a clear error when CLERK_SECRET_KEY is missing` includes `vi.stubEnv('CLERK_SECRET_KEY', '')` at the top of its block.
- AC-2: The test `throws a clear error when APP_URL is missing` includes `vi.stubEnv('APP_URL', '')` at the top of its block (verified or added).
- AC-3: Running `npm run test convex/candidates.test.ts` results in 0 failures for these specific cases.
- AC-4: No other test logic is modified; change is surgical to env stubbing only.

## 2. Discovery Notes
- **Limitation:** I am operating in a chat-only context without direct filesystem access (no `read_file` tool active in this turn). I am reasoning from the task description provided.
- **Assumed Structure:** Based on task description, `convex/candidates.test.ts` uses Vitest (`vi.stubEnv`).
- **Target Lines:** Task indicates lines 260-275 for the `CLERK_SECRET_KEY` test.
- **Context:** Atria-X uses Convex backend. Tests likely import helpers from `convex/_generated` or local auth helpers. Env vars are critical for Clerk auth initialization within Convex actions/queries.
- **Dependency:** Vitest environment cleanup must be reliable; explicit stubbing per test is safer than relying on `vi.unstubAllEnvs` in `afterEach` if tests run in parallel or if cleanup order is ambiguous.

## 3. Alternatives Considered
- **Alternative A: Global `afterEach` cleanup.**
  - *Pros:* Less boilerplate in each test.
  - *Cons:* Risky if one test fails before cleanup runs, leaking state to subsequent tests. Harder to debug specific test isolation.
- **Alternative B: `vi.unstubAllEnvs()` at start of each test.**
  - *Pros:* Clears everything.
  - *Cons:* Might clear vars needed for test setup (like `APP_URL` if generally required). Explicit stubbing to empty string is more declarative for "missing key" scenarios.
- **Chosen Approach: Explicit `vi.stubEnv` per test.**
  - *Reasoning:* Matches the existing pattern indicated in the task (`vi.stubEnv('APP_URL', ...)`). Ensures the specific variable under test is definitively empty regardless of prior test state. Safest for CI flakiness.

## 4. Files to Create/Modify
| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `convex/candidates.test.ts` | Modify | Add `vi.stubEnv('CLERK_SECRET_KEY', '')` to the CLERK missing test. Verify/Add `vi.stubEnv('APP_URL', '')` to the APP_URL missing test. |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases
- **Env Leakage:** Primary risk. If `CLERK_SECRET_KEY` leaks from a previous successful auth test, the "missing key" test will falsely pass (or hit real API). Explicit empty string stub prevents this.
- **Convex Codegen:** Not required for test logic changes, but if imports touch `_generated`, ensure no stale types. (Unlikely for env stubbing).
- **Multi-tenancy:** These tests validate system configuration, not tenant data access. No `authHelpers` guards need modification, but ensure the test setup doesn't inadvertently initialize a tenant context that persists.
- **Secrets:** Never commit actual keys. The stub ensures the test runs without real secrets.

## 6. Test Strategy
- **Command:** `npm run test convex/candidates.test.ts`
- **Verification:**
  - Grep output for `throws a clear error when CLERK_SECRET_KEY is missing`.
  - Grep output for `throws a clear error when APP_URL is missing`.
  - Ensure no "Resource not found" errors from mock Clerk API (indicates leak).
- **Gate:** PR cannot merge if this specific test file fails in CI.

## 7. Rollback / Verification Notes
- **Rollback:** `git checkout HEAD -- convex/candidates.test.ts`.
- **Verification:** If test still fails after change, check if `vi.stubEnv` is supported in the current Vitest version configured in `package.json` (requires Vitest 1.0+ or specific setup).
- **Post-Change:** No Convex deployment needed (`convex deploy`) as this is test-only code. No `convex codegen` required.