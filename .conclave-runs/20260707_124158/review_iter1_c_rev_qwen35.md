# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Review: AppShell Sidebar Fix + Additional Changes

### Acceptance Criteria Verification

| AC | Status | Notes |
|---|---|---|
| AC-1: AppShell className updated | ⚠️ **Cannot Verify** | Diff shows `src/app/shell/AppShell.tsx | 52 ++-` but actual line change is truncated. Need to confirm the exact `lg:ml-[240px]` addition. |
| AC-2: Margin only when hideChrome=false | ⚠️ **Cannot Verify** | Same as above - truncated diff. |
| AC-3: Chromeless routes unaffected | ⚠️ **Cannot Verify** | Depends on AC-1 implementation. |
| AC-4: Mobile unaffected (lg: prefix) | ⚠️ **Cannot Verify** | Depends on AC-1 implementation. |
| AC-5: No other files modified | ❌ **FAILED** | **49 files changed, 3266 insertions**. Massive scope creep beyond AppShell.tsx. |
| AC-6: npm run typecheck | ✅ PASS | Shown in gate results. |
| AC-7: npm run test | ✅ PASS | 65 files, 456 tests passed. |
| AC-8: E2E_FULL=1 npm run e2e | ❌ **MISSING** | Gate results not provided. Required per plan. |
| AC-9: npm run build | ❌ **MISSING** | Gate results not provided. Required per plan. |

---

### Critical Issues

#### 1. Missing Required Gate Results (Blocker)
The plan explicitly states: **"All four gates (`typecheck`, `test`, `e2e`, `build`) must pass before considering the task complete."**

Only 3 of 4 gates are shown:
- ✅ lint: PASS
- ✅ typecheck: PASS  
- ✅ unit: PASS (456 tests)
- ❌ **E2E: NOT SHOWN**
- ❌ **build: NOT SHOWN**

Cannot approve without confirming E2E and build pass.

#### 2. Massive Scope Violation (AC-5 Failure)
Task instruction: **"Do not change anything else unless tests fail."**

The diff includes **49 files** with extensive backend changes:
- `convex/candidates.ts` (+90 lines) - Clerk membership retry logic
- `convex/hrCases.ts` (+171 lines) - Subject validation, audit events
- `convex/forms.ts` (+32 lines) - New `getFormDefinition` query
- `convex/seed.ts` (+401 lines) - Phase 2 E2E fixtures
- `convex/onboarding.test.ts` (+318 lines) - Candidate lifecycle tests
- Multiple other Convex functions and tests

These are **not** related to the AppShell sidebar fix. If these were necessary due to gate failures, that should be documented. If not, this violates the surgical, scope-controlled requirement.

#### 3. Security/Idempotency Concerns in Convex Changes

**`convex/candidates.ts` (lines 171-238):**
```typescript
// Retry logic after PATCH failure
const current = await listMemberships()
const verified = current.find((m) => membershipHasRole(m, args.role))
if (verified) {
  return { updated: true, membershipId: verified.id }
}
throw err
```
- ⚠️ This retry-after-failure pattern could mask transient errors. The comment acknowledges this but there's no rate-limiting or max-retry guard.
- ⚠️ No audit event recorded for membership role changes (unlike `hrCases.createHrCase` which has audit logging).

**`convex/hrCases.ts` (lines 59-95):**
```typescript
const subjectName = await resolveSubjectName(ctx, tenantId, args.subjectType, args.subjectId)
// ... insert hrCase ...
await ctx.runMutation(internal.audit.record, {...})
```
- ✅ Good: Tenant isolation via `assertTenantDoc` in `resolveSubjectName`
- ✅ Good: Audit event recorded
- ⚠️ `resolveSubjectName` does a DB lookup per case in `listHrCases` (N+1 pattern acknowledged in comment at line 134). Acceptable for now but should be monitored.

**`convex/authHelpers.ts` (lines 114-150):**
```typescript
// New JWT claim handling for org_id and org_role
if (typeof identity.org_id === 'string') return identity.org_id
const compactOrg = identity.o
```
- ✅ Comments explain the precedence (top-level claim is authoritative)
- ⚠️ This changes auth behavior across all Convex functions. Should have explicit regression tests for existing roles (`org:admin`, `org:coordinator`, `org:caregiver`).

#### 4. Test Coverage Gaps

**Missing tests for new functionality:**
- `convex/candidates.ts` retry logic has no dedicated test (only existing `candidates.test.ts` updated)
- `convex/forms.ts` new `getFormDefinition` query has tests (lines 885-997 in forms.test.ts) ✅
- `convex/hrCases.ts` subject validation has tests (lines 314-389 in hrCases.test.ts) ✅

**E2E tests:**
- `tests/e2e/helpers/auth.ts` modified (+147 lines) - new candidate auth helpers
- `.env.e2e.example` adds `E2E_CANDIDATE_EMAIL/PASSWORD`
- But actual E2E spec changes are minimal (`geofence.spec.ts`, `phase1-lifecycle.spec.ts` only +14/+33 lines)
- No new E2E specs for candidate lifecycle despite extensive Convex changes

---

### Recommendations

1. **Run and report E2E and build gates** - Cannot approve without these results.

2. **Justify or revert scope creep** - Either:
   - Document why 48 additional files were changed (e.g., "E2E gate failed, required backend fixes"), OR
   - Revert all non-AppShell changes to a separate PR

3. **Add audit event for membership role changes** - `updateClerkMembershipRole` should record audit events like `hrCases.createHrCase` does.

4. **Add regression test for authHelpers JWT changes** - Ensure existing role checks still work with both JWT formats.

---

### Verdict

Cannot approve due to:
1. Missing E2E and build gate results (required per plan)
2. AC-5 violation (49 files changed instead of 1)
3. Unverified AppShell.tsx change (diff truncated)

VERDICT: CHANGES_REQUESTED