# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the code change

### Summary

The diff contains a substantial set of backend hardening, test additions, and infrastructure changes (authHelpers metadata resolution, `firstOrgAdmin` query, `createBypassMember` internal mutation, invitation bypass logic, candidate lifecycle tests, seed fixtures, scheduling tests, etc.). These are valuable improvements that lay groundwork for the Phase 2 candidate portal. **However, the core frontend portal changes required by the task are missing.** The acceptance criteria from the plan are not satisfied.

### Missed acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| **AC-1** – Upload regression fixed | ❌ | No upload helper, no Vite proxy, no `DocumentUploadPage` rewrite. The `"Failed to fetch"` bug remains. |
| **AC-2** – Routing cleaned up | ❌ | No changes to `src/app/router.tsx` or `CandidateOnboardingIndex.tsx`. |
| **AC-3** – Checklist matches backend task types | ❌ | `CandidateOnboardingPage.tsx` not updated to route by `task._id`. |
| **AC-4** – Application form matches Figma entry | ❌ | `ApplicationFormPage.tsx` not rewritten (only its test file changed). |
| **AC-5** – Document upload completes correct task | ❌ | `DocumentUploadPage.tsx` not rewritten. |
| **AC-6** – HR can send offer with all fields | ❌ | `ApplicationReviewPage.tsx` not updated (no `expiresAt` input, no field seeding). |
| **AC-7** – Profile/status/training use data correctly | ⚠️ Partial | `CandidateProfilePage.tsx` has changes (48 lines) but the diff does not show the actual content; `ApplicationStatusPage`, `TrainingPage`, `AcknowledgmentPage` are untouched. |
| **AC-8** – Security/tenancy preserved | ✅ | Auth metadata resolution, internal mutations, role guards all appear sound. |
| **AC-9** – Gates green | ✅ | Lint, typecheck, unit tests all pass. |

### Concrete blockers

1. **Upload fix not implemented** – The diff adds `'org:candidate'` to `generateUploadUrl` (convex/files.ts:42) but does not address the origin rewrite or the `PUT`→`POST` protocol change. The `DocumentUploadPage` still uses the broken pattern. Without the upload helper and Vite proxy, the candidate document upload will still fail in dev.

2. **No frontend portal pages updated** – The following pages required by the plan have zero changes in this diff:
   - `ApplicationFormPage.tsx` (must be rewritten to match Figma entry frame)
   - `DocumentUploadPage.tsx` (must use `listCandidateTasks` and the new upload helper)
   - `CandidateOnboardingPage.tsx` (must route upload tasks by `task._id`)
   - `ApplicationStatusPage.tsx` (must match Figma timeline)
   - `OfferAcceptancePage.tsx` (no changes)
   - `TrainingPage.tsx` (no changes)
   - `AcknowledgmentPage.tsx` (no changes)
   - `ApplicationReviewPage.tsx` (no changes)

3. **Routing not cleaned** – No changes to `src/app/router.tsx` to verify/remove the duplicate `/onboarding/documents` route (though none was found in inspection, the task explicitly requires this step).

4. **Missing tests for touched frontend behaviour** – Only `ApplicationFormPage.test.tsx` was updated. No tests for `DocumentUploadPage`, `CandidateOnboardingPage`, `OfferAcceptancePage`, `ApplicationStatusPage`, `TrainingPage`, `AcknowledgmentPage`, or `ApplicationReviewPage` are present.

### Security observations

- The `getClerkOrganizationRole` changes (convex/authHelpers.ts) add metadata-based role resolution. This is acceptable because Clerk metadata is server-controlled.
- `createBypassMember` is an internal mutation, safe from direct client calls.
- `firstOrgAdmin` query is properly guarded.
- The `ATRIA_X_DEV_INVITE_BYPASS` env var is dev-only and documented as such.
- No new PHI exposure or cross-tenant leaks were introduced.

### Conclusion

The diff provides necessary backend infrastructure but **does not complete the Phase 2 candidate onboarding portal**. The core frontend changes that implement the Figma designs, fix the upload bug, wire the checklist, and complete the offer/acceptance flow are entirely absent. The task’s acceptance criteria are not met.

**Verdict: CHANGES_REQUESTED**