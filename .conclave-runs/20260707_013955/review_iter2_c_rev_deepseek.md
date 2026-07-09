# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of Code Change for SESSION 9 — Phase 2 E2E + Integration Tests

### AC-1: `tests/e2e/scheduling.spec.ts` passes reliably

**MISSED.** The diff contains **no changes** to `tests/e2e/scheduling.spec.ts`. The plan explicitly required:
- Scrolling the "Send request" button into view before clicking (with `force` fallback)
- Preserving all existing assertions

The stale-shift cleanup is addressed in `convex/seed.ts` (new `deleteFixtureCaregiverShifts` function), but the click fix is absent. Without this change, the E2E scheduling test will continue to fail with the "outside of the viewport" error. This is a **concrete blocker** — the primary goal of the session is not met.

### AC-2: `convex/onboarding.test.ts` adds explicit lifecycle assertions

**SATISFIED.** The new `candidate lifecycle` describe block (lines 362–592) includes:
- After `submitApplication`: asserts `form_submission` task status is `'complete'` (line ~470)
- After `hireCandidate`: asserts `employeeProfileId` is defined and `adpSyncStatus` is `'pending_credentials'` (lines ~520–530)

### AC-3: `convex/scheduling.test.ts` adds cross-caregiver and excludeShiftId tests

**SATISFIED.** Two new tests:
- `checkShiftConflict returns null when excluding the only shift` (lines 323–355)
- `allows overlapping shifts for different caregivers` (lines 400–430)

### AC-4: `convex/forms.test.ts` adds multiple missing fields and updateDocumentArchiveItem tests

**SATISFIED.**
- `throws when multiple required fields are missing and lists them` (lines 530–560) — requires the `forms.ts` change to collect all missing fields (done, lines 220–230)
- Two `updateDocumentArchiveItem` wrapper tests (lines 873–926) — call `api.documentArchive.updateDocumentArchiveItem` and verify `verifiedBy`/`verifiedAt` and caregiver block

### AC-5: `convex/seed.ts` Phase 2 fixtures idempotent

**SATISFIED.** New functions `seedPhase2Candidate`, `seedPhase2AvailabilityWindow`, `seedPhase2CoverageRequest`, `seedPhase2FormDefinition`, `seedPhase2DocumentArchiveItems` all delete existing records before inserting. The candidate is seeded at `hr_review` with a completed application and all 5 tasks. The form definition has 3 fields (`name` required, `experience` required, `notes` optional). The `seed.test.ts` idempotency test passes.

### AC-6: All gates run and report real pass/fail counts

**PARTIALLY SATISFIED.** The provided logs show:
- `npm run lint` — PASS (rc=0)
- `npm run typecheck` — PASS (rc=0)
- `npm run test` — PASS (65 files, 451 tests passed)

**Missing:** `npm run e2e` and `npm run build` results are not reported. Given that `scheduling.spec.ts` was not fixed, the E2E gate will fail. The build result is unknown.

### AC-7: No manual edits to `convex/_generated/`, no credentials committed

**SATISFIED.** No changes to `convex/_generated/`. The `.env.e2e.example` is an example file, not real credentials.

---

### Additional Issues (touched behaviour without tests)

1. **`convex/forms.ts` — new `getFormDefinition` query (lines 353–377)**  
   This is a new public query exposed to multiple roles (`org:admin`, `org:coordinator`, `org:caregiver`, `org:hr`, `org:candidate`). It has **no test** in `forms.test.ts`. Missing tests for touched behaviour — should be added.

2. **`convex/files.ts` — added `'org:candidate'` to allowed roles for `generateUploadUrl` (line 45)**  
   This is a security-relevant change allowing candidates to upload files. The existing `files.test.ts` does not test candidate uploads. Missing test for touched behaviour.

3. **`convex/documentArchive.ts` — added `uploadedAt: item.createdAt` to list output (line 70)**  
   The `listDocumentArchive` query now returns an `uploadedAt` field. The existing tests in `documentArchive.test.ts` do not assert this field. Minor, but it's a contract change without test coverage.

---

### Verdict

The code change is largely correct and satisfies most acceptance criteria, but **one critical AC is missed** (AC-1 — the E2E scheduling test fix is absent), and two new public APIs lack tests. The E2E gate will fail as a result.

**Requested changes:**
1. **Fix `tests/e2e/scheduling.spec.ts`** — scroll the "Send request" button into view before clicking (with `force` fallback). This is the primary blocker.
2. **Add tests for `getFormDefinition`** in `convex/forms.test.ts` (at minimum a positive case for each allowed role and a cross-tenant rejection).
3. **Add a test for candidate file upload** in `convex/files.test.ts` (or extend an existing test) to cover the new `'org:candidate'` role.

Once these are addressed, re-run all five gates and report the results.

VERDICT: CHANGES_REQUESTED