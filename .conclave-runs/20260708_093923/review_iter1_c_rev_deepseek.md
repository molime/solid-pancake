# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the Phase 2 Candidate Onboarding Portal Diff

### Summary

The diff introduces substantial backend infrastructure (role metadata resolution, dev invite bypass, E2E fixtures, scheduling guards, and extensive tests) but **fails to deliver the core frontend changes required by the acceptance criteria**. The plan’s AC‑1 through AC‑7 are largely unmet because the critical onboarding portal pages, upload helper, Vite proxy, and routing cleanup are absent from this diff.

### Acceptance Criteria Check

| AC | Status | Evidence |
|----|--------|----------|
| **AC‑1** Upload regression fixed | ❌ | No `src/shared/lib/upload.ts` created, no Vite proxy added in `vite.config.ts`, no changes to `DocumentUploadPage.tsx`. The only upload‑related change is `convex/files.ts` adding `org:candidate` to `generateUploadUrl` – necessary but insufficient. |
| **AC‑2** Routing cleaned up | ❌ | No changes to `src/app/router.tsx`. Duplicate `/onboarding/documents` route (if present) not removed. |
| **AC‑3** Checklist matches backend task types | ❌ | No changes to `CandidateOnboardingPage.tsx`. The test `convex/onboarding.test.ts` still seeds old task types (`reference_check`, `document_upload`) instead of the six new types (`photo_id`, `cpr_certificate`, etc.) – this will break once the backend is updated. |
| **AC‑4** Application form matches Figma entry | ❌ | Only the test file `ApplicationFormPage.test.tsx` is updated; the actual page source is not in the diff. The test expects `fullName, email, phone, position` but the backend test still uses `name, experience`. |
| **AC‑5** Document upload completes correct task | ❌ | No changes to `DocumentUploadPage.tsx`. The page still uses `PUT` + URL‑path parsing instead of `POST` + JSON. |
| **AC‑6** HR can send offer with all fields | ❌ | No changes to `ApplicationReviewPage.tsx`. `expiresAt` input and field seeding are missing. |
| **AC‑7** Profile/status/training use fields correctly | ⚠️ Partial | `CandidateProfilePage.tsx` is updated to read `application?.application?.fields`. But `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, `AcknowledgmentPage.tsx` are untouched. |
| **AC‑8** Security/tenancy preserved | ✅ | `authHelpers.ts` role resolution improved, `generateUploadUrl` allows `org:candidate`, `createBypassMember` is internal. No new cross‑tenant leaks. |
| **AC‑9** Gates green | ✅ | Lint, typecheck, unit tests all pass (58 files, 469 tests). |

### Concrete Blockers

1. **Missing frontend pages** – The following files required by the plan are not present in the diff:
   - `src/features/onboarding/pages/DocumentUploadPage.tsx`
   - `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
   - `src/features/onboarding/pages/ApplicationFormPage.tsx` (only test changed)
   - `src/features/onboarding/pages/ApplicationStatusPage.tsx`
   - `src/features/onboarding/pages/OfferAcceptancePage.tsx`
   - `src/features/onboarding/pages/TrainingPage.tsx`
   - `src/features/onboarding/pages/AcknowledgmentPage.tsx`
   - `src/features/hr/pages/ApplicationReviewPage.tsx`
   - `src/app/router.tsx`
   - `src/shared/lib/upload.ts`
   - `vite.config.ts` (proxy addition)

   Without these, the candidate portal cannot function end‑to‑end.

2. **Backend test uses stale task types** – `convex/onboarding.test.ts` (lines 293–540) seeds tasks with `reference_check` and `document_upload` instead of the six new types. This test will fail once `convex/candidates.ts` is updated to the new `CANDIDATE_TASK_TYPES`. The test must be updated to match the current backend contract.

3. **Inconsistent field shapes** – The frontend test (`ApplicationFormPage.test.tsx`) expects `fullName, email, phone, position`, but the backend test (`onboarding.test.ts` line 330) uses `name, experience`. This mismatch will cause integration failures.

4. **Upload protocol still broken** – Even if `generateUploadUrl` allows candidates, the frontend `DocumentUploadPage.tsx` (not in diff) still uses `PUT` and URL‑path parsing. The plan requires a `POST` + JSON helper. Without the helper and Vite proxy, the “Failed to fetch” error will persist.

### Security / PHI / Edge Cases

- The `ATRIA_X_DEV_INVITE_BYPASS` env var and `createBypassMember` internal mutation are acceptable for dev only.
- `firstOrgAdmin` query correctly restricts to tenant members.
- No new PHI exposure; document archive visibility remains `admins_coordinators`.
- Idempotency of `completePlatformTraining` is tested and verified.

### Test Coverage

The diff adds many backend tests (onboarding lifecycle, scheduling guards, role resolution) which are valuable. However, the missing frontend pages have no corresponding component tests in this diff. The plan required tests for `DocumentUploadPage`, `CandidateOnboardingPage`, `OfferAcceptancePage`, etc. – none are present.

### Verdict

The diff does **not** satisfy the task. The core onboarding portal frontend changes are absent, the upload fix is incomplete, and the backend tests are inconsistent with the planned task types. Concrete changes are required to meet the acceptance criteria.

**VERDICT: CHANGES_REQUESTED**