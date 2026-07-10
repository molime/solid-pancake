# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 E2E + Integration Tests

### Summary

This is a substantial changeset (48 files, ~3000 lines added) implementing Phase 2 worker onboarding integration tests, seed fixtures, and related backend improvements. The unit test gate shows 65 files / 451 tests passing. However, there are **critical acceptance criterion gaps** that must be addressed before approval.

---

### Acceptance Criterion Verification

| AC | Status | Evidence |
|---|---|---|
| **AC-1** `scheduling.spec.ts` passes reliably | ❌ **NOT VERIFIED** | `tests/e2e/scheduling.spec.ts` is **not in the diff**. Cannot verify the "Send request" scroll/force click fix was implemented. |
| **AC-2** `onboarding.test.ts` lifecycle assertions | ✅ **SATISFIED** | Lines 425-520 show `form_submission` task completion check and `employeeProfile.adpSyncStatus === 'pending_credentials'` assertion. |
| **AC-3** `scheduling.test.ts` cross-caregiver + excludeShiftId | ✅ **SATISFIED** | Lines 326-356 show `checkShiftConflict returns null when excluding the only shift`. Lines 477-513 show `allows overlapping shifts for different caregivers`. |
| **AC-4** `forms.test.ts` multiple missing fields + archive item | ✅ **SATISFIED** | Lines 533-562 show "throws when multiple required fields are missing and lists them". Lines 876-926 show `updateDocumentArchiveItem` verifiedBy/verifiedAt and caregiver block tests. |
| **AC-5** `seed.ts` Phase 2 fixtures idempotent | ✅ **SATISFIED** | Lines 920-1183 show `seedPhase2Candidate` (hr_review status), `seedPhase2AvailabilityWindow`, `seedPhase2CoverageRequest`, `seedPhase2FormDefinition` (name/experience required, notes optional), `seedPhase2DocumentArchiveItems`. All use lookup-before-insert. |
| **AC-6** All 5 gates pass with real counts | ❌ **FAILED** | Only 3 gates shown: lint (PASS), typecheck (PASS), unit (451 tests PASS). **E2E and Build gate results are MISSING.** |
| **AC-7** No `_generated/` edits, no credentials committed | ✅ **SATISFIED** | No `convex/_generated/` changes. `.env.e2e.example` contains placeholder values only. |

---

### Critical Blockers

#### 1. E2E Test Files Missing from Diff (AC-1 Gap)

The plan explicitly required modifying `tests/e2e/scheduling.spec.ts` to fix the "Send request" viewport issue:

> **File:** `tests/e2e/scheduling.spec.ts` | **Change Type:** Modify | **What Changes:** Scroll the "Send request" button into view before clicking; add `force: true` fallback.

This file is **not present** in the diff. The E2E helper `tests/e2e/helpers/auth.ts` (147 lines added) likely contains cleanup logic, but the actual spec fix is not visible. Without this, AC-1 cannot be verified.

**Required:** Include `tests/e2e/scheduling.spec.ts`, `tests/e2e/onboarding.spec.ts`, and `tests/e2e/documents.spec.ts` in the diff, or confirm they require no changes and explain why.

#### 2. E2E and Build Gate Results Missing (AC-6 Failure)

The plan required:

> **AC-6** All gates run and report actual pass/fail counts: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `npm run build`

Only 3 gates are shown in the results:
- ✅ lint: PASS
- ✅ typecheck: PASS  
- ✅ unit: 451 tests PASS
- ❌ **e2e: NOT SHOWN**
- ❌ **build: NOT SHOWN**

This is a **hard acceptance criterion failure**. The E2E gate is the primary deliverable for this session.

**Required:** Run and report results for:
```bash
npm run e2e
npm run build
```

Include actual Playwright pass/fail counts from `test-results/.last-run.json`.

---

### Secondary Concerns (Non-Blocking)

#### 3. `convex/forms.ts` Error Message Change

**File:** `convex/forms.ts` | **Lines:** 220-234

The error message changed from:
```ts
throw new ConvexError(`Missing required field: ${field.id}`)
```
to:
```ts
throw new ConvexError(`Missing required fields: ${missing.join(', ')}`)
```

This is **intentional per the brief** (AC-4 requires listing all missing fields). However, any frontend code parsing this error message will need to handle the plural form. Verify no client-side code depends on the singular format.

#### 4. `convex/candidates.ts` Membership Resolution

**File:** `convex/candidates.ts` | **Lines:** 158-199

The `updateClerkMembershipRole` function now resolves the membership ID before PATCHing. This is more robust but adds an extra API call. The return value changed from `{ updated: true }` to `{ updated: true, membershipId: string | null }`. Verify callers handle the new return shape (the diff shows `convex/candidates.test.ts` line 583-586 was updated to match).

#### 5. `convex/hrCases.ts` Subject Resolution

**File:** `convex/hrCases.ts` | **Lines:** 14-44

New `resolveSubjectName` helper queries `candidates` or `employeeProfiles` tables. This is sound, but note the `listHrCases` query (lines 116-165) now does N+1 queries via `Promise.all` with `resolveSubjectName`. For large case lists, this could be a performance concern. Consider batching subject lookups if case counts grow.

---

### Security / PHI / Multi-Tenancy Review

| Area | Status | Notes |
|---|---|---|
| **Multi-tenancy guards** | ✅ | All new mutations use `requireTenantRole` and `assertTenantDoc`. |
| **PHI handling** | ✅ | `documentArchiveItems` tests verify `org:caregiver` is blocked from `updateDocumentArchiveItem`. |
| **Idempotency** | ✅ | Phase 2 seed functions use lookup-before-insert/delete. `deleteFixtureCaregiverShifts` (lines 568-637) now matches both Clerk user id AND Convex member `_id`. |
| **Auth** | ✅ | E2E uses Clerk test credentials from `.env.local`. Integration tests use `convex-test` identities. |
| **Credentials** | ✅ | `.env.e2e.example` contains placeholders only. |

---

### Test Coverage Gaps

1. **E2E scheduling flow** - Cannot verify without `scheduling.spec.ts` in diff.
2. **Build gate** - No TypeScript/ bundling verification shown.
3. **Cross-tenant isolation for hrCases** - Added in `convex/hrCases.test.ts` lines 369-400 ✅.
4. **ADP sync worker queue** - Tested indirectly via `adpSyncStatus === 'pending_credentials'` ✅.

---

### Required Changes

1. **Include E2E spec files** in the diff or provide explicit confirmation they require no changes and why.
2. **Run and report E2E gate** (`npm run e2e`) with actual Playwright pass/fail counts.
3. **Run and report Build gate** (`npm run build`) with exit code.
4. **Verify `scheduling.spec.ts` "Send request" fix** - Either show the scroll/force click change or confirm the issue was resolved via helper changes alone.

---

### Verdict

The integration test additions are comprehensive and well-structured. The seed fixture idempotency is properly implemented. However, the **primary deliverable (E2E tests) cannot be verified** without seeing the spec file changes and actual E2E gate results. This is a hard acceptance criterion failure per AC-1 and AC-6.

VERDICT: CHANGES_REQUESTED