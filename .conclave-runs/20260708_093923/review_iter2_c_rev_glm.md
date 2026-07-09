# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### What's good

The backend changes are solid and well-structured:

- **Auth role resolution** (`convex/authHelpers.ts`): The `org_public_metadata.atriaRole` fallback is correct for candidates who receive `org:member` from Clerk but need `org:candidate` in ATRIA. The `getAtriaRoleFromMetadata` helper is clean and the test coverage in `authHelpers.test.ts` (lines 148–176) is thorough.

- **Candidate upload access** (`convex/files.ts` line 39): Adding `org:candidate` to `generateUploadUrl` is necessary and properly gated through `requireTenantRole`.

- **Invitation bypass** (`convex/invitations.ts`, `convex/members.ts`): `isAllowListError` and `createBypassMember` are correctly scoped — the mutation is `internalMutation` (not client-callable), and the env var `ATRIA_X_DEV_INVITE_BYPASS` is documented as never for production (`.env.example` lines 8–10).

- **`firstOrgAdmin` query** (`convex/members.ts` lines 92–113): Correctly handles the case where candidates need an admin to send the Clerk invitation (`convex/employeeProfiles.ts` lines 196–204). The null check with `ConvexError` is good.

- **Backend lifecycle tests** (`convex/onboarding.test.ts` lines 296–847): Comprehensive coverage of the six task types, `submitApplication`, `reviewApplication`, `sendOffer`/`acceptOffer`, `hireCandidate`, and training idempotency. The `org:candidate` scheduling block test (line 823) is a good security guard.

- **Shift delete ordering fix** (`convex/scheduling.ts` lines 387–394): Moving `ctx.db.delete(shift._id)` after audit recording prevents a data integrity gap if the audit write fails.

- **Schema additions** (`convex/schema.ts` lines 332–333): `invitationFailed`/`invitationError` on candidates is minimal and useful for tracking Clerk allow-list failures.

- **All gates pass**: lint, typecheck, and 469 unit tests green.

### Blocking issues — missed ACs

The diff is missing the **core frontend changes** that the task requires. Five of nine acceptance criteria are unaddressed, and two more are only partially visible:

| AC | Status | Missing from diff |
|----|--------|-------------------|
| AC-1 Upload regression | ❌ | No `src/shared/lib/upload.ts`, no `vite.config.ts` proxy, no `DocumentUploadPage.tsx` fix (still uses PUT + URL-path parsing instead of POST + JSON `storageId`) |
| AC-2 Routing cleanup | ❌ | No `src/app/router.tsx` change to remove duplicate `/onboarding/documents` |
| AC-3 Checklist alignment | ❌ | No `CandidateOnboardingPage.tsx` change to route document tasks by `task._id` instead of type string |
| AC-4 Application form | ❌ | No `ApplicationFormPage.tsx` change — only the test file is in the diff, not the page itself |
| AC-5 Document upload | ❌ | No `DocumentUploadPage.tsx` change to query `listCandidateTasks`, match by `_id`, and call `attachCandidateDocument` with `documentType: task.type` |
| AC-6 Offer fields | ⚠️ | `CandidatePipelinePage.tsx` has 67 lines changed (content truncated), but `ApplicationReviewPage.tsx` is absent — no `expiresAt` input, no seeded defaults from `application.fields` |
| AC-7 Profile/status/training | ⚠️ | `CandidateProfilePage.tsx` has 48 lines changed (truncated), but `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, `AcknowledgmentPage.tsx` are absent |
| AC-8 Security | ✅ | Backend auth/tenancy guards are correct |
| AC-9 Gates | ✅ | Lint/typecheck/unit pass; build/E2E not shown but unit green |

The upload bug (AC-1) is the **immediate bug** called out in the task. Without the upload helper and Vite proxy, candidates still get "Failed to fetch" when uploading documents in local dev because the browser POSTs to `http://127.0.0.1:3210/api/storage/upload?token=...` which fails on CORS/reachability.

### Non-blocking issues

1. **`convex/files.ts` line 39**: `contentType` and `size` args are declared but unused in the handler. If these are for future validation, add a comment; otherwise remove them to avoid confusion.

2. **`convex/onboarding.test.ts` line ~760**: `vi.useFakeTimers()` in the `hireCandidate` test has no corresponding `vi.useRealTimers()`. Vitest restores timers between tests, but explicit cleanup is safer practice.

3. **`convex/seed.ts`**: The `seedE2ECandidateFixtures` function is 500+ lines. Consider extracting sub-functions (seedMembers, seedCandidate, seedShifts, etc.) for readability.

### Required changes

1. **Create `src/shared/lib/upload.ts`** — helper that calls `generateUploadUrl`, rewrites the upload URL origin to `window.location.origin` in dev, POSTs the file, and returns `storageId` from the JSON response.

2. **Add Vite dev proxy** in `vite.config.ts` for `/api/storage` → Convex backend URL with `changeOrigin: true`.

3. **Rewrite `DocumentUploadPage.tsx`** to use the new upload helper, query `listCandidateTasks` to find the task by `_id` route param, derive `documentType` from `task.type`, and call `attachCandidateDocument`.

4. **Update `CandidateOnboardingPage.tsx`** to route document tasks to `/onboarding/upload/${task._id}` instead of `/onboarding/upload/photo_id`.

5. **Update `ApplicationFormPage.tsx`** to collect only `fullName`, `email`, `phone`, `position` per Figma frame 157:682 and redirect to `/onboarding/status`.

6. **Update `ApplicationReviewPage.tsx`** to add an `expiresAt` input and seed `payRate`/`startDate`/`schedule`/`supervisor`/`expiresAt` defaults from `application.fields`.

7. **Verify and remove any duplicate `/onboarding/documents` route** in `router.tsx`.

8. **Update `ApplicationStatusPage.tsx`**, `TrainingPage.tsx`, `AcknowledgmentPage.tsx` to match Figma frames and use `application.fields` correctly.

VERDICT: CHANGES_REQUESTED