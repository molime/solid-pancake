# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Phase 2 Candidate Onboarding Portal

### Summary

This diff contains substantial **backend** improvements (auth helpers, member queries, invitation bypass, scheduling audit fix, extensive test coverage) but is **missing the critical frontend changes** required by the task. The gates pass, but they are testing the existing code, not the required implementation.

---

### Critical Missing Changes (Blockers)

| Requirement | Expected File | Status in Diff |
|-------------|--------------|----------------|
| **AC-1: Upload URL fix** | `vite.config.ts` (dev proxy) + `src/shared/lib/upload.ts` (helper) | ❌ Not present |
| **AC-1: Upload protocol** | `src/features/onboarding/pages/DocumentUploadPage.tsx` (POST + JSON) | ❌ Not present |
| **AC-2: Router cleanup** | `src/app/router.tsx` (remove duplicate route) | ❌ Not present |
| **AC-4: Application form** | `src/features/onboarding/pages/ApplicationFormPage.tsx` (4 fields) | ❌ Not present |
| **AC-5: Task routing** | `src/features/onboarding/pages/CandidateOnboardingPage.tsx` (route by `task._id`) | ❌ Not present |
| **AC-6: Offer fields** | `src/features/hr/pages/ApplicationReviewPage.tsx` (add `expiresAt`, seed from `fields`) | ❌ Not present |
| **AC-7: Profile/status/training** | Multiple onboarding pages | ❌ Not present |

---

### What IS Correct in This Diff

1. **`convex/files.ts:42`** — Added `'org:candidate'` to `generateUploadUrl` allowed roles. ✅
2. **`convex/scheduling.ts:391-394`** — Fixed audit event to record BEFORE shift deletion (was reversed). ✅
3. **`convex/authHelpers.ts:134-172`** — Enhanced role resolution from `org_public_metadata`. ✅
4. **`convex/members.ts:80-103`** — Added `firstOrgAdmin` query with proper tenant role guards. ✅
5. **`convex/employeeProfiles.ts:196-209`** — Uses `firstOrgAdmin` for Clerk invitations (fixes inviter identity). ✅
6. **`convex/onboarding.test.ts:296-847`** — Comprehensive candidate-to-caregiver lifecycle tests (6 task types, submitApplication, sendOffer, acceptOffer, hireCandidate, training). ✅
7. **`convex/schema.ts:333-334`** — Added `invitationFailed`/`invitationError` fields for tracking. ✅
8. **`convex/invitations.ts:22-35`** — Added `isAllowListError` helper for bypass logic. ✅

---

### Security/PHI Review

| Area | Finding |
|------|---------|
| **Tenant isolation** | `firstOrgAdmin` requires `requireTenantRole` with org:admin/hr/coordinator — ✅ guarded |
| **Upload scoping** | `generateUploadUrl` allows `org:candidate` but still requires tenant verification — ✅ acceptable |
| **Audit trail** | `deleteShift` now records audit BEFORE deletion — ✅ fixed (was a regression risk) |
| **Internal mutations** | `createBypassMember` is `internalMutation` — ✅ not externally callable |
| **PHI exposure** | No changes to document visibility or download URL exposure — ✅ preserved |

---

### Test Coverage Assessment

| Test File | Coverage | Notes |
|-----------|----------|-------|
| `convex/onboarding.test.ts` | ✅ Comprehensive | 15 tests covering full candidate lifecycle |
| `convex/candidates.test.ts` | ✅ 30 tests | Task types, application, offer flow |
| `convex/scheduling.test.ts` | ✅ 21 tests | Caregiver restrictions, state guards, conflicts |
| `convex/authHelpers.test.ts` | ✅ 21 tests | Metadata role resolution |
| `convex/files.test.ts` | ✅ 6 tests | Upload URL role checks |
| Frontend component tests | ⚠️ Passing but stale | Tests exist but component changes missing from diff |

---

### Requested Changes

1. **Add `vite.config.ts` dev proxy** for `/api/storage` → `VITE_CONVEX_URL` to fix CORS/reachability in local dev.

2. **Create `src/shared/lib/upload.ts`** helper that:
   - Calls `generateUploadUrl`
   - Rewrites `127.0.0.1` origin to `window.location.origin` in dev
   - POSTs file and parses `{ storageId }` from JSON response

3. **Rewrite `DocumentUploadPage.tsx`** to:
   - Query `listCandidateTasks` and find task by `_id`
   - Use the new upload helper (POST + JSON)
   - Call `attachCandidateDocument` with `documentType: task.type`

4. **Rewrite `ApplicationFormPage.tsx`** to collect only `fullName`, `email`, `phone`, `position` per Figma frame 157:682.

5. **Update `CandidateOnboardingPage.tsx`** to route document tasks by `task._id` instead of type string.

6. **Update `ApplicationReviewPage.tsx`** to:
   - Add `expiresAt` input
   - Seed defaults from `application.fields`
   - Pass `expiresAt` to `sendOffer`

7. **Verify `src/app/router.tsx`** has no duplicate `/onboarding/documents` route (task explicitly requires this).

8. **Update `CandidateOnboardingIndex.tsx`** routing table for all candidate statuses.

---

### Verdict

The backend work is solid and well-tested, but the **core bug fix (upload URL)** and **required frontend page changes** are absent from this diff. The task cannot be considered complete without these changes.

VERDICT: CHANGES_REQUESTED