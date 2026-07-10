# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Code Review: Phase 2 Candidate Onboarding Portal

## Summary

This diff contains substantial **backend** work for the candidate onboarding system, including auth helpers, member management, invitation handling, and comprehensive test coverage. However, **critical frontend implementation files are missing from this diff**, which prevents verification of the primary acceptance criteria.

---

## ✅ What's Correct

### Backend Security & Auth
- **`convex/files.ts` (line 41-44)**: Added `'org:candidate'` to `generateUploadUrl` allowed roles — correct for candidate document uploads.
- **`convex/authHelpers.ts` (lines 134-173)**: Enhanced `getClerkOrganizationRole` to check `org_public_metadata` and `public_metadata` for `atriaRole` — supports candidate role resolution.
- **`convex/members.ts`**: 
  - Added `firstOrgAdmin` query (lines 80-104) for invitation fallback.
  - Added `createBypassMember` internal mutation (lines 295-345) for dev environments.
  - Updated `list` query to include `'org:hr'` (line 80).
- **`convex/invitations.ts`**: Exported `toClerkRole` and added `isAllowListError` helper (lines 22-37) for graceful invitation failures.
- **`convex/employeeProfiles.ts` (line 196-201)**: Uses `firstOrgAdmin` to find an admin for Clerk invitations — avoids using candidate identity as inviter.

### Test Coverage
- **`convex/onboarding.test.ts`**: 15 tests covering candidate-to-caregiver lifecycle, task ordering, `submitApplication`, `sendOffer`, `acceptOffer`, `hireCandidate`, and training completion.
- **`convex/forms.test.ts`**: Tests for `updateDocumentArchiveItem` verification/rejection flow (lines 880-963).
- **`convex/members.test.ts`**: Tests for `firstOrgAdmin` query (lines 58-158).
- **Frontend unit tests passing**: `ApplicationFormPage.test.tsx`, `DocumentUploadPage.test.tsx`, `CandidateOnboardingPage.test.tsx` all green.

### Schema & Seed
- **`convex/schema.ts` (lines 333-334)**: Added `invitationFailed` and `invitationError` fields to `tenantMembers` — supports invitation retry tracking.
- **`convex/seed.ts`**: Comprehensive E2E fixture seeding for Phase 2 candidate flow.

---

## ❌ Critical Gaps (Blockers)

### AC-1: Upload Regression Fix — NOT VERIFIED
The task states: *"candidate document upload fails with 'Failed to fetch' because the generated upload URL is http://127.0.0.1:3210..."*

**Missing from diff:**
- `src/shared/lib/upload.ts` — The shared upload helper that rewrites dev origins and uses POST + JSON response.
- `vite.config.ts` — Dev proxy for `/api/storage` to Convex backend.

The backend `generateUploadUrl` now allows candidates, but without the frontend helper and Vite proxy, the CORS/reachability issue will persist in local dev.

### AC-2: Routing Cleanup — NOT VERIFIED
The task states: *"Remove duplicate /onboarding/documents route in src/app/router.tsx"*

**Missing from diff:**
- `src/app/router.tsx` — No changes shown. Cannot verify duplicate route removal or routing table updates.

### AC-3 to AC-7: Frontend Page Implementations — NOT VERIFIED
The task requires updates to:
- `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
- `src/features/onboarding/pages/ApplicationFormPage.tsx`
- `src/features/onboarding/pages/DocumentUploadPage.tsx`
- `src/features/hr/pages/ApplicationReviewPage.tsx`
- `src/features/onboarding/pages/OfferAcceptancePage.tsx`
- `src/features/onboarding/pages/CandidateProfilePage.tsx`
- `src/features/onboarding/pages/TrainingPage.tsx`

**None of these files appear in the diff.** While the unit tests pass (suggesting implementations exist somewhere), I cannot verify:
- Application form collects only `fullName`, `email`, `phone`, `position` (AC-4)
- Document upload queries tasks by `_id` and uses correct `documentType` (AC-5)
- ApplicationReviewPage passes `expiresAt` to `sendOffer` (AC-6)
- Pages use `application.fields` correctly (AC-7)

### AC-9: Gate Completeness
Lint, typecheck, and unit tests pass. However:
- **No E2E test results shown** — The plan requires `npm run e2e:local` verification.
- **No build output shown** — `npm run build` gate not confirmed in logs.

---

## Security & Edge Case Notes

| Concern | Status | Notes |
|---------|--------|-------|
| Tenant isolation | ✅ | All mutations use `requireTenantRole` |
| Candidate scoping | ✅ | `attachCandidateDocument` uses `getOwnCandidate` |
| Upload URL auth | ⚠️ | Backend allows candidates, but frontend proxy not verified |
| Task completion idempotency | ✅ | Tests verify idempotent training completion |
| PHI handling | ✅ | Document archive items have `visibility: 'admins_coordinators'` |
| Invitation bypass | ✅ | `ATRIA_X_DEV_INVITE_BYPASS` env flag added, backend guard in place |

---

## Required Changes

1. **Include frontend implementation files in the diff** — Specifically:
   - `src/shared/lib/upload.ts` (new)
   - `vite.config.ts` (modify for `/api/storage` proxy)
   - `src/app/router.tsx` (verify/remove duplicate routes)
   - All onboarding page files listed above

2. **Confirm E2E gate** — Run `npm run e2e:local` and include results showing Phase 2 candidate flow works end-to-end.

3. **Confirm build gate** — Run `npm run build` and confirm exit code 0.

4. **Verify ApplicationReviewPage** — Ensure `expiresAt` input exists and is passed to `sendOffer` mutation.

---

## Verdict

The backend work is solid and well-tested. However, the **primary user-facing fixes (upload regression, routing, page implementations) cannot be verified** because the frontend files are absent from this diff. This is a concrete blocker for AC-1, AC-2, AC-4, AC-5, AC-6, and AC-7.

VERDICT: CHANGES_REQUESTED