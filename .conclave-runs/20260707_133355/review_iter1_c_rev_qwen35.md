# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Test Fix PR

### Acceptance Criteria Verification

| AC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | `CLERK_SECRET_KEY` test explicitly stubs to `''` | ✅ PASS | `convex/candidates.test.ts:261` |
| AC-2 | `APP_URL` test explicitly stubs to `''` | ✅ PASS | `convex/candidates.test.ts:281` |
| AC-3 | `npm run test convex/candidates.test.ts` passes | ✅ PASS | Gate shows 19/19 tests passed |
| AC-4 | No other production code changed; limited to `vi.stubEnv` calls | ❌ FAIL | `convex/candidates.ts:327-328` refactored to `requireEnv()` |

### Issues Requiring Changes

**1. Scope Creep - Unrelated Files Modified**

The diff contains significant changes unrelated to the test fix task:

| File | Lines Changed | Issue |
|------|---------------|-------|
| `src/app/router.tsx` | -119 lines | Onboarding routes removed entirely |
| `src/app/shell/AppShell.tsx` | +28 lines | Chrome hiding logic added |
| `convex/hrCases.ts` | +2 lines | Added `title` and `createdAt` fields |
| `convex/seed.ts` | -4 lines | Removed `scheduledStart` parameter |
| `package.json` | -1 line | Dev script changed |
| `src/features/onboarding/ApplicationFormPage.test.tsx` | -55 lines | Test file deleted |

These changes are **not** part of the task ("fix one failing unit test... Minimal change only") and should be separated into their own PRs.

**2. AC-4 Violation - Production Code Refactor**

`convex/candidates.ts:327-328` changed from inline env checks to `requireEnv()` helper:
```typescript
// Before (inline checks)
const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) { throw new ConvexError(...) }

// After (helper)
const secretKey = requireEnv('CLERK_SECRET_KEY')
```

While this is a reasonable refactor, it violates AC-4 ("No other... production code are changed"). This change should either be:
- Removed to meet the "minimal change" requirement, OR
- Documented as an intentional improvement with its own justification

**3. Auto-Generated File**

`convex/_generated/api.d.ts` was modified (auto-generated from Convex codegen). This is expected when touching `convex/*.ts` files, but the task explicitly states "No codegen/deploy needed: This is a test-only change."

### Security/Correctness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Test isolation | ✅ Good | Both env vars now explicitly stubbed |
| Multi-tenancy | ✅ Preserved | `authorizeOrgRole` guards unchanged |
| PHI handling | ✅ N/A | No PHI touched |
| Env validation | ✅ Improved | `requireEnv()` is more consistent |
| Gate results | ✅ All pass | lint/typecheck/unit all green |

### Requested Changes

1. **Remove unrelated file changes** from this PR (router, AppShell, hrCases, seed, package.json, test deletion). These should be separate PRs with their own justification.

2. **Either revert `convex/candidates.ts` changes** to meet AC-4, or update the task/ACs to acknowledge the `requireEnv()` refactor as intentional.

3. **Regenerate `_generated/` files** only after finalizing what production code changes are in scope.

---

VERDICT: CHANGES_REQUESTED