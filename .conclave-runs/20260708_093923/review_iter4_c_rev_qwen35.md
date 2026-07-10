# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Code Review: Phase 2 Candidate Onboarding Portal

## Summary

This diff contains substantial **backend infrastructure** for the Phase 2 candidate onboarding portal, but the **critical frontend implementation is missing** from this change set. The backend changes are well-tested and secure, but without the corresponding frontend code, AC-1 (upload regression fix) and AC-4/AC-5 (application form and document upload pages) cannot be satisfied.

---

## Acceptance Criteria Assessment

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 Upload regression fixed | ❌ **NOT IMPLEMENTED** | No `src/shared/lib/upload.ts` created; no `vite.config.ts` proxy added |
| AC-2 Routing cleaned up | ⚠️ **UNCLEAR** | No `src/app/router.tsx` changes in diff |
| AC-3 Checklist matches backend task types | ✅ **BACKEND READY** | `convex/files.ts:45` adds `'org:candidate'`; `convex/onboarding.test.ts:296-347` validates 6 task types in order |
| AC-4 Application form matches Figma | ❌ **NOT IMPLEMENTED** | No `ApplicationFormPage.tsx` changes in diff |
| AC-5 Document upload completes correct task | ❌ **NOT IMPLEMENTED** | No `DocumentUploadPage.tsx` changes; no upload helper |
| AC-6 HR can send offer with all fields | ⚠️ **UNCLEAR** | No `ApplicationReviewPage.tsx` changes in diff |
| AC-7 Profile/status/training use data correctly | ⚠️ **PARTIAL** | `CandidateProfilePage.tsx:48 lines changed` but content not visible in truncated diff |
| AC-8 Security/tenancy preserved | ✅ **VERIFIED** | `convex/authHelpers.ts:134-172` enhances role resolution; `convex/members.ts:80-101` adds `firstOrgAdmin` with `requireTenantRole` |
| AC-9 Gates green | ✅ **PASS** | lint/typecheck/unit all pass (469 tests) |

---

## Critical Missing Items

### 1. Upload Helper Not Created (Blocks AC-1, AC-5)

The plan requires `src/shared/lib/upload.ts` to:
- Call `generateUploadUrl`
- Rewrite `127.0.0.1` origin to `window.location.origin` in dev
- POST file and parse `{ storageId }` from JSON response

**This file does not exist in the diff.** Without it, the "Failed to fetch" error on `http://127.0.0.1:3210/api/storage/upload` will persist.

### 2. Vite Dev Proxy Not Configured (Blocks AC-1)

The plan requires `vite.config.ts` to add:
```ts
server: {
  proxy: {
    '/api/storage': {
      target: process.env.VITE_CONVEX_URL || 'http://127.0.0.1:3210',
      changeOrigin: true,
    },
  },
}
```

**No `vite.config.ts` changes appear in the diff.** The CORS/reachability issue will not be resolved.

### 3. Onboarding Pages Not Modified (Blocks AC-4, AC-5, AC-6)

The following files show **no changes** in the diff:
- `src/features/onboarding/pages/ApplicationFormPage.tsx` — should be rewritten to 4-field Figma entry form
- `src/features/onboarding/pages/DocumentUploadPage.tsx` — should use task query + upload helper
- `src/features/onboarding/pages/CandidateOnboardingPage.tsx` — should route upload tasks by `task._id`
- `src/features/hr/pages/ApplicationReviewPage.tsx` — should add `expiresAt` input seeded from `application.fields`

The test files (`ApplicationFormPage.test.tsx`, `CandidateOnboardingPage.test.tsx`) show as modified, but without the corresponding page implementations, these tests cannot validate the new behavior.

### 4. Router Changes Not Visible (Blocks AC-2)

The plan requires verifying/removing duplicate `/onboarding/documents` route in `src/app/router.tsx`. **No router changes appear in the diff.**

---

## Security & Correctness Observations

### ✅ Positive Findings

1. **Tenant isolation preserved**: `convex/members.ts:82-86` and `convex/members.ts:103-107` use `requireTenantRole` for all new queries.

2. **Candidate role properly scoped**: `convex/files.ts:45` adds `'org:candidate'` to `generateUploadUrl` allowed roles, and `convex/onboarding.test.ts:823-834` verifies `org:candidate` cannot access scheduling APIs.

3. **Idempotency tested**: `convex/onboarding.test.ts:720-748` validates `completePlatformTraining` is idempotent (only 1 completion row created).

4. **Invitation bypass safe**: `convex/members.ts:295-340` creates `createBypassMember` as `internalMutation` (not exposed to frontend), and `convex/invitations.ts:26-37` adds `isAllowListError` helper for dev-only bypass.

5. **Audit trail maintained**: `convex/scheduling.ts:391-394` ensures audit record is written **before** shift deletion (fixes potential audit gap).

### ⚠️ Concerns

1. **Schema change without migration note**: `convex/schema.ts:333-334` adds `invitationFailed` and `invitationError` fields to `invitations` table. This is additive and safe, but should be documented.

2. **Test coverage gap**: While `convex/onboarding.test.ts` has 15 tests, there's no test verifying `attachCandidateDocument` completes the correct task type (photo_id vs cpr_certificate). The plan specifically called for this.

3. **CandidateProfilePage changes opaque**: The diff shows 48 lines changed in `CandidateProfilePage.tsx`, but the content is truncated. Cannot verify it correctly reads `application.application.fields`.

---

## Required Changes

### BLOCKERS (Must Fix Before Merge)

1. **Create `src/shared/lib/upload.ts`** with dev origin rewrite and POST + JSON parsing pattern (matching `ShiftTaskList.tsx` caregiver upload).

2. **Add Vite proxy to `vite.config.ts`** for `/api/storage` → Convex backend.

3. **Include frontend page modifications** for:
   - `ApplicationFormPage.tsx` (4-field Figma entry form)
   - `DocumentUploadPage.tsx` (task query + upload helper integration)
   - `CandidateOnboardingPage.tsx` (route by `task._id` for uploads)
   - `ApplicationReviewPage.tsx` (add `expiresAt` input, seed from `application.fields`)

4. **Include `src/app/router.tsx` changes** or confirm no duplicate `/onboarding/documents` route exists.

### RECOMMENDED (Should Fix)

5. **Add test for `attachCandidateDocument` task completion** in `convex/candidates.test.ts` verifying `photo_id` and `cpr_certificate` tasks are marked complete after upload.

6. **Document schema changes** in a changelog or migration note for `invitationFailed`/`invitationError` fields.

---

## Gate Results

| Gate | Status | Notes |
|------|--------|-------|
| lint | ✅ PASS | 13.7s |
| typecheck | ✅ PASS | 12.2s |
| unit tests | ✅ PASS | 469 tests, 58 files |
| build | ⚠️ NOT RUN | Not shown in gate output |
| E2E | ⚠️ NOT RUN | Not shown in gate output |

**Note:** The gate output does not show `npm run build` or `npm run e2e` results. These are required per AC-9.

---

## Verdict

The backend infrastructure is solid and well-tested, but the **frontend implementation required to fix the upload regression and complete the onboarding flow is missing from this diff**. Without the upload helper, Vite proxy, and page modifications, candidates cannot upload documents in local dev (AC-1 fails), and the application form/document upload flow does not match the Figma specs (AC-4, AC-5 fail).

VERDICT: CHANGES_REQUESTED