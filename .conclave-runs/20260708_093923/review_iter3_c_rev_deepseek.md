# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Code Review: Phase 2 Candidate Onboarding Portal

### Summary

The diff contains **40 files** with **2,369 insertions** and **177 deletions**. The changes are heavily backend‑ and test‑focused: new Convex mutations/queries, extensive integration tests for the candidate lifecycle, scheduling, forms, and seeding. However, **the core frontend pages that make up the candidate portal are almost entirely absent from the diff**. The immediate bug (document upload “Failed to fetch” due to `127.0.0.1:3210` origin) is **not addressed**. The acceptance criteria from the plan are largely unmet.

---

### Acceptance Criteria Check

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| **AC‑1** | Upload regression fixed (Vite proxy + upload helper) | ❌ **Not satisfied** | No `vite.config.ts` changes, no `src/shared/lib/upload.ts` created. The only storage‑related change is adding `'org:candidate'` to `convex/files.ts` line 42. The `127.0.0.1` origin issue remains. |
| **AC‑2** | Routing cleaned up (no duplicate `/onboarding/documents`) | ✅ Likely satisfied | `src/app/router.tsx` shows 10 lines removed. Without seeing the actual diff content, we assume the duplicate was removed. |
| **AC‑3** | Checklist matches backend task types | ❌ **Not satisfied** | `CandidateOnboardingPage.tsx` is **not modified** in the diff. Only its test file (`CandidateOnboardingPage.test.tsx`) appears. The page still uses old routing by type string, not by `task._id`. |
| **AC‑4** | Application form matches Figma entry | ❌ **Not satisfied** | `ApplicationFormPage.tsx` is **not modified**. Only its test file (`ApplicationFormPage.test.tsx`) is updated. The form still collects extra fields (dob, address, etc.) instead of the four‑field entry form. |
| **AC‑5** | Document upload completes the correct task | ❌ **Not satisfied** | `DocumentUploadPage.tsx` is **not modified**. Only its test file (`DocumentUploadPage.test.tsx`) appears. The page still uses `PUT` + URL‑path parsing and does not query `listCandidateTasks`. |
| **AC‑6** | HR can send offer with all fields (including `expiresAt`) | ❌ **Not satisfied** | `ApplicationReviewPage.tsx` is **not modified**. The diff changes `CandidatePipelinePage.tsx` and `HireConvertPage.tsx`, but the review page that sends the offer is untouched. No `expiresAt` input added. |
| **AC‑7** | Profile/status/training use `application.fields` correctly | ⚠️ **Partially satisfied** | `CandidateProfilePage.tsx` is modified (48 lines). But `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, and `AcknowledgmentPage.tsx` are **not modified**. |
| **AC‑8** | Security/tenancy preserved | ✅ Satisfied | `authHelpers.ts` improved role resolution from Clerk metadata. `files.ts` allows `org:candidate`. `createBypassMember` is internal only. No new cross‑tenant leaks. |
| **AC‑9** | Gates green | ✅ Satisfied | Lint, typecheck, unit tests all pass (469 tests). |

---

### Concrete Issues / Missed Requirements

1. **Upload URL reachability not fixed**  
   The diff does not include the Vite dev proxy for `/api/storage` or the upload helper that rewrites the origin. Without this, the “Failed to fetch” error will persist in local dev.  
   *Required:* Create `src/shared/lib/upload.ts` and add `server.proxy` to `vite.config.ts`.

2. **Frontend pages for the candidate portal are missing**  
   The following pages were supposed to be rewritten or modified per the plan, but are **absent from the diff**:
   - `src/features/onboarding/pages/ApplicationFormPage.tsx`
   - `src/features/onboarding/pages/DocumentUploadPage.tsx`
   - `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
   - `src/features/onboarding/pages/ApplicationStatusPage.tsx`
   - `src/features/onboarding/pages/OfferAcceptancePage.tsx`
   - `src/features/onboarding/pages/TrainingPage.tsx`
   - `src/features/onboarding/pages/AcknowledgmentPage.tsx`
   - `src/features/hr/pages/ApplicationReviewPage.tsx`

   Only `CandidateProfilePage.tsx` was updated. The rest are unchanged, meaning the portal does not function end‑to‑end.

3. **Checklist still uses type‑string routing**  
   `CandidateOnboardingPage.tsx` (not in diff) routes document tasks by type string (`/onboarding/upload/photo_id`) instead of by `task._id`. This breaks the per‑task upload flow and prevents the page from showing the correct task title.

4. **Document upload still uses `PUT` + URL‑path parsing**  
   `DocumentUploadPage.tsx` (not in diff) does not use the new upload helper and does not query `listCandidateTasks`. It will fail to attach the correct `documentType` and will not handle the `POST` + JSON response.

5. **Application form still collects extra fields**  
   `ApplicationFormPage.tsx` (not in diff) still collects `dob`, `address`, `experience`, etc. The Figma entry frame requires only `fullName`, `email`, `phone`, `position`. The test file was updated but the page itself was not.

6. **Offer flow missing `expiresAt`**  
   `ApplicationReviewPage.tsx` (not in diff) does not have an `expiresAt` input and does not pass it to `sendOffer`. The `OfferAcceptancePage.tsx` (not in diff) may read `offerExpiresAt` but the field is never set.

7. **Status, training, acknowledgment pages not updated**  
   These pages are not in the diff, so they do not match the Figma frames or use `application.fields` correctly.

---

### Security / PHI / Edge‑Case Observations

- **`createBypassMember`** is an internal mutation, so it cannot be called directly from the client. This is safe.
- **`getClerkOrganizationRole`** now reads `org_public_metadata` and `o.pub`. This is a reasonable extension for Clerk’s metadata‑based role assignment.
- **`convex/employeeProfiles.ts`** now uses `admin.clerkUserId` as the inviter instead of `identity.subject`. This prevents invitation failures when the caller is not an admin. Good.
- **`convex/scheduling.ts`** fixes a bug where `deleteShift` deleted the shift before recording the audit event. Now the audit is recorded first. Good.
- **`convex/schema.ts`** adds `invitationFailed` and `invitationError` fields to candidates. This improves error handling for failed Clerk invitations.
- **`convex/seed.ts`** adds `seedE2ECandidateFixtures` which cleans up stale candidate/employee data. This is good for E2E determinism.
- **No PHI exposure** – document archive items still use `visibility: 'admins_coordinators'` and candidates never receive download URLs.
- **Idempotency** – `completeCandidateTask` finds the first pending task by type and patches it; duplicate calls are no‑ops. `completeForCandidate` inserts a new row each time, but the frontend uses a `Set` to avoid duplicates. Acceptable.

---

### Test Coverage

The diff adds **extensive backend integration tests**:
- `convex/onboarding.test.ts` (573 lines) – candidate lifecycle, task ordering, submitApplication, review, offer, accept, hire, training.
- `convex/forms.test.ts` (156 lines) – document archive item updates, empty‑string validation.
- `convex/members.test.ts` (115 lines) – `firstOrgAdmin` query.
- `convex/scheduling.test.ts` (239 lines) – shift creation, caregiver restrictions, update/delete guards, coverage conflicts.
- `convex/seed.test.ts` – seed fixtures.

Frontend tests are minimal:
- `ApplicationFormPage.test.tsx` (66 lines) – updated mock.
- `CandidateOnboardingPage.test.tsx` (1 test) – likely insufficient.
- `DocumentUploadPage.test.tsx` (1 test) – likely insufficient.

**Missing tests** for the pages that were not changed (OfferAcceptancePage, ApplicationStatusPage, TrainingPage, AcknowledgmentPage, ApplicationReviewPage). The plan required focused Vitest tests for each.

---

### Verdict

The diff **does not satisfy the acceptance criteria** for the Phase 2 candidate onboarding portal. The core frontend pages are missing, the upload bug is unfixed, and the application form, document upload, checklist, offer flow, status, training, and acknowledgment pages are not updated. While the backend and test infrastructure are significantly improved, the frontend implementation is incomplete.

**Changes required:**
1. Implement the upload helper and Vite proxy (AC‑1).
2. Rewrite `ApplicationFormPage.tsx` to match Figma entry (AC‑4).
3. Rewrite `DocumentUploadPage.tsx` to use task query and new upload helper (AC‑5).
4. Update `CandidateOnboardingPage.tsx` to route by `task._id` (AC‑3).
5. Update `ApplicationReviewPage.tsx` to add `expiresAt` and seed defaults (AC‑6).
6. Update `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, `AcknowledgmentPage.tsx` to match Figma and use `application.fields` (AC‑7).
7. Add/update frontend tests for all changed pages.

Without these changes, the portal will not function end‑to‑end and the original bug will persist.

VERDICT: CHANGES_REQUESTED