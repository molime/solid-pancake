# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### Core fix — ✅ Correct

The two new test cases in `convex/candidates.test.ts` (lines 259–293) properly isolate environment variables:

- **CLERK_SECRET_KEY test** (line 261): `vi.stubEnv('CLERK_SECRET_KEY', '')` — correctly stubs to empty, preventing helper leakage.
- **APP_URL test** (line 280): `vi.stubEnv('APP_URL', '')` — correctly stubs to empty, matching AC-2.

Both tests pass (19/19 in `convex/candidates.test.ts`, 403/403 full suite). AC-1, AC-2, and AC-3 are satisfied.

### Concerns beyond the core fix

**1. Removed onboarding routes — concrete regression**

`src/app/router.tsx` removes all 8 onboarding routes (`/onboarding`, `/onboarding/application`, `/onboarding/status`, etc.) without adding them elsewhere. This breaks user navigation to the entire onboarding flow. Meanwhile, `src/app/shell/AppShell.tsx` adds `/onboarding` to the hide-chrome list — contradictory, since those routes no longer exist.

**2. Deleted test file — reduced coverage**

`src/features/onboarding/ApplicationFormPage.test.tsx` is deleted entirely (55 lines). This removes test coverage for the application form page with no replacement.

**3. Missing file from diff — `convex/_utils/env.ts`**

The `requireEnv` import in `convex/candidates.ts` (line 21) and the new module registration in `convex/_generated/api.d.ts` reference `convex/_utils/env.ts`, but this file is not included in the diff. Its implementation cannot be reviewed for correctness (e.g., does it handle whitespace-only values the same way the original `if (!secretKey)` check did?).

**4. `convex/seed.ts` — behavioral change**

`findFixtureShifts` no longer filters by `scheduledStart` (lines 680–688). It now returns **all** shifts for a client+caregiver pair, which could cause the seed cleanup to delete more shifts than intended.

**5. AC-4 violation**

The task requires "Minimal change only" and AC-4 states changes should be limited to `vi.stubEnv` calls. The diff modifies production code in `candidates.ts`, `hrCases.ts`, `seed.ts`, `router.tsx`, `AppShell.tsx`, `package.json`, and deletes a test file — well beyond the minimal scope.

### Verdict

The core test fix is correct and all gates pass, but the removed onboarding routes are a concrete regression (broken navigation), the deleted test file removes coverage, and the `requireEnv` module is unreviewable. These need to be addressed before merging.

VERDICT: CHANGES_REQUESTED