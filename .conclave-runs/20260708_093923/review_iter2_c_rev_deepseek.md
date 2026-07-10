# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the working-tree diff

### Summary

The diff contains a large set of changes, but **the core Phase 2 candidate onboarding portal work is missing**. The task explicitly requires:

- Fixing the document upload “Failed to fetch” regression (AC-1)
- Cleaning up routing (AC-2)
- Updating the checklist to match the six backend task types (AC-3)
- Rewriting the application form to match the Figma entry frame (AC-4)
- Rewriting the document upload page to use the correct upload protocol and task routing (AC-5)
- Updating `ApplicationReviewPage` to pass all offer fields including `expiresAt` (AC-6)
- Ensuring offer/acceptance/profile/training pages use `application.fields` correctly (AC-7)

**None of the frontend files that implement these ACs appear in the diff.**  
Specifically, the diff does **not** touch:

- `src/features/onboarding/pages/ApplicationFormPage.tsx`
- `src/features/onboarding/pages/DocumentUploadPage.tsx`
- `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
- `src/features/onboarding/pages/ApplicationStatusPage.tsx`
- `src/features/onboarding/pages/TrainingPage.tsx`
- `src/features/onboarding/pages/AcknowledgmentPage.tsx`
- `src/features/hr/pages/ApplicationReviewPage.tsx`
- `src/app/router.tsx`
- `src/shared/lib/upload.ts` (new file)
- `vite.config.ts` (no proxy added)

The only onboarding frontend file changed is `CandidateProfilePage.tsx` (48 lines), which partially addresses AC-7. The test file `ApplicationFormPage.test.tsx` is updated, but the corresponding page is not.

### Missed acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 (upload fix) | ❌ | No upload helper, no Vite proxy, no change to `DocumentUploadPage.tsx` |
| AC-2 (routing) | ❌ | No change to `router.tsx` |
| AC-3 (checklist) | ❌ | No change to `CandidateOnboardingPage.tsx` |
| AC-4 (application form) | ❌ | No change to `ApplicationFormPage.tsx` |
| AC-5 (document upload) | ❌ | No change to `DocumentUploadPage.tsx` |
| AC-6 (offer fields) | ❌ | No change to `ApplicationReviewPage.tsx` |
| AC-7 (profile/status/training) | ⚠️ Partial | `CandidateProfilePage.tsx` changed, but `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, `OfferAcceptancePage.tsx` untouched |
| AC-8 (security/tenancy) | ✅ | `authHelpers.ts`, `files.ts`, `members.ts` changes preserve tenancy; candidate role added to `generateUploadUrl` |
| AC-9 (gates) | ✅ | Lint, typecheck, unit tests all pass |

### Security / edge-case observations

- **`ATRIA_X_DEV_INVITE_BYPASS`** (`.env.example` line 11) and the `isAllowListError` function in `invitations.ts` suggest a dev-only bypass for Clerk allow-list restrictions. The diff does **not** show the actual bypass logic or any guard that prevents it from being used in production. This is a potential security risk if the bypass is ever enabled on a production deployment. The code should explicitly check `process.env.NODE_ENV !== 'production'` or similar.
- **`createBypassMember`** (`convex/members.ts` line 292) is an `internalMutation` that creates tenant members without authentication. It is only callable by other mutations, so it is safe as long as no public mutation calls it. The diff does not introduce any public mutation that calls it, so this is acceptable.
- **`firstOrgAdmin`** (`convex/members.ts` line 89) is a query that returns the first `org:admin` for a tenant. It is guarded by `requireTenantRole` with roles `org:admin`, `org:hr`, `org:coordinator`. This is fine.
- **`generateUploadUrl`** now allows `org:candidate` (line 39 of `files.ts`). This is necessary for candidate document upload and is properly scoped.
- **`getClerkOrganizationRole`** now reads `org_public_metadata` and compact metadata. This improves role resolution for Clerk orgs that use metadata. No security regression.

### Missing tests for touched behaviour

- The diff adds extensive backend tests (`onboarding.test.ts`, `members.test.ts`, `scheduling.test.ts`, `forms.test.ts`), but **no frontend tests** for the missing pages. The only frontend test updated is `ApplicationFormPage.test.tsx`, which tests a page that was not changed. This is insufficient.

### Conclusion

The diff does **not** implement the required Phase 2 candidate onboarding portal changes. The core ACs (1–6) are completely unaddressed. The changes that are present (authHelpers, members, seed, scheduling, etc.) appear to be auxiliary or from other workstreams. The upload regression, routing cleanup, checklist alignment, application form rewrite, document upload rewrite, and offer field update are all missing.

**Changes are required** to satisfy the task.

VERDICT: CHANGES_REQUESTED