# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 E2E + Integration Tests

### Summary

This is a substantial code change adding integration tests, seed fixtures, and backend improvements. However, **critical acceptance criteria are not satisfied** based on the provided diff and gate results.

---

### Acceptance Criteria Verification

| AC | Status | Evidence |
|---|---|---|
| AC-1: `scheduling.spec.ts` scroll/force fix | ❌ **MISSING** | File not in diff (49 files listed, `tests/e2e/scheduling.spec.ts` absent) |
| AC-2: `onboarding.test.ts` lifecycle assertions | ✅ PASS | Lines 424-429 (form_submission complete), 478-483 (adpSyncStatus) |
| AC-3: `scheduling.test.ts` cross-caregiver + excludeShiftId | ✅ PASS | Lines 326-357 (excludeShiftId), 462-497 (cross-caregiver overlap) |
| AC-4: `forms.test.ts` multiple missing fields + archive item | ✅ PASS | Lines 533-561 (multiple missing), 876-936 (updateDocumentArchiveItem) |
| AC-5: `seed.ts` idempotent Phase 2 fixtures | ⚠️ **PARTIAL** | Test at lines 402-476 verifies idempotency, but full seed.ts diff truncated |
| AC-6: All 5 gates with real counts | ❌ **MISSING** | Only lint/typecheck/unit shown. **E2E and build gates not reported** |
| AC-7: No `_generated/` edits, no credentials | ✅ PASS | No `_generated/` files in diff; `.env.e2e.example` is template only |

---

### Critical Blockers

#### 1. Missing `tests/e2e/scheduling.spec.ts` Fix (AC-1)

The primary task was to fix the "Send request" click failure in `scheduling.spec.ts`. The diff shows:
- `tests/e2e/geofence.spec.ts` (14 lines changed)
- `tests/e2e/phase1-lifecycle.spec.ts` (33 lines changed)
- `tests/e2e/helpers/auth.ts` (147 lines changed)

**But `tests/e2e/scheduling.spec.ts` is NOT in the diff.** The scroll-into-view + force fallback fix was the core deliverable for stabilizing E2E tests. Without this file, AC-1 cannot be verified.

#### 2. Missing E2E and Build Gate Results (AC-6)

The plan explicitly required:
```bash
npm run e2e    # Report real Playwright pass/fail counts
npm run build  # Exit 0
```

The gate results provided only show:
- `npm run lint` — PASS
- `npm run typecheck` — PASS  
- `npm run test` — PASS (65 files, 456 tests)

**E2E and build results are completely absent.** This is a critical gap because:
- The scheduling.spec.ts fix cannot be validated without E2E results
- Build failures could indicate TypeScript or bundling regressions not caught by `tsc -b`

#### 3. Truncated `convex/seed.ts` Diff

The `convex/seed.ts` diff is truncated at 60000 chars. While the test at lines 402-476 verifies idempotency, I cannot verify:
- The full `deleteFixtureCaregiverShifts` implementation (lines 568+) matches both Clerk user id AND Convex `_id`
- All Phase 2 fixture helpers (`seedPhase2Candidate`, `seedPhase2AvailabilityWindow`, etc.) are present and idempotent

---

### Positive Findings

1. **`convex/candidates.ts`** (lines 171-238): Excellent retry/idempotency logic in `updateClerkMembershipRole` — re-lists memberships after PATCH failure to verify state, preventing Convex/Clerk drift.

2. **`convex/hrCases.ts`** (lines 17-50): New `resolveSubjectName` validates subject existence before creating HR cases, preventing orphaned references.

3. **`convex/forms.ts`** (lines 220-233): Collects all missing required fields before throwing, satisfying the brief's requirement to "list them."

4. **Test coverage is comprehensive**: 456 unit/integration tests across 65 files, including new tests for files.ts, hrCases.ts, documentArchive.ts.

5. **No `_generated/` edits**: Convex codegen artifacts are untouched.

---

### Minor Issues (Non-Blocking)

1. **Error message pluralization** (`convex/forms.ts` line 230): When only ONE field is missing, the error says "Missing required fields" (plural). This is a minor UX inconsistency but acceptable given the brief's explicit requirement.

2. **`convex/forms.ts` line 356**: Extra blank line before `getFormDefinition` export (style nit).

---

### Required Changes

1. **Include `tests/e2e/scheduling.spec.ts`** with the scroll-into-view + force fallback fix for the "Send request" button.

2. **Run and report `npm run e2e`** with real Playwright pass/fail counts from `test-results/.last-run.json`.

3. **Run and report `npm run build`** exit status.

4. **Provide complete `convex/seed.ts` diff** or confirm the `deleteFixtureCaregiverShifts` function matches both `clerkUserId` and `tenantMembers._id` for fixture cleanup.

---

### Security/PHI Review

- **Multi-tenancy guards**: All new mutations use `requireTenantRole` and `assertTenantDoc` ✓
- **Document archive**: `updateDocumentArchiveItem` restricted to org:admin/org:hr; org:caregiver blocked ✓
- **File uploads**: `generateUploadUrl` now allows org:candidate but validates tenant match ✓
- **HR cases**: Subject validation prevents creating cases for non-existent employees/candidates ✓

No PHI handling regressions detected. No additive writes without success gates.

---

### Verdict

The integration test additions are high-quality and the backend improvements are solid. However, the **core E2E stabilization work (scheduling.spec.ts fix) is missing from the diff**, and **E2E/build gate results were not reported** as required by AC-6. These are concrete blockers preventing verification that the task is complete.

VERDICT: CHANGES_REQUESTED