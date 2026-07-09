# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

I've inspected the full diff against the acceptance criteria. The backend hardening is solid, but several AC-critical frontend changes are absent from this changeset.

---

### What's correct and valuable

**Auth / role resolution** (`convex/authHelpers.ts`): `getClerkOrganizationRole` now reads `atriaRole` from `org_public_metadata` (and compact/dotted variants). Precedence is correct — explicit `org_role` wins, then metadata. This unblocks `org:candidate` without Clerk custom roles. Tests cover the new paths.

**Candidate lifecycle tests** (`convex/onboarding.test.ts`): 15 tests covering task ordering (6 types), `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` (including ADP sync status and Clerk membership update), training idempotency, and `org:candidate` being blocked from `scheduling.listShifts`. Thorough.

**`generateUploadUrl` role gate** (`convex/files.ts` line 45): `org:candidate` added to allowed roles. Necessary for candidates to obtain upload URLs.

**`createCaregiver` inviter fix** (`convex/employeeProfiles.ts`): Uses `firstOrgAdmin` instead of `identity.subject` as the Clerk invitation inviter. Correct — a candidate (org:member in Clerk) cannot send invitations; any org admin can. The null-check with `ConvexError` is appropriate.

**`deleteShift` audit ordering** (`convex/scheduling.ts` lines 387–392): Audit record is now written *before* the shift is deleted. Correct — prevents orphaned shifts if audit fails, and the audit can reference the still-existing shift document.

**`createBypassMember`** (`convex/members.ts`): Internal-only mutation, cannot be called from client. Acceptable for dev bypass.

**`isAllowListError`** (`convex/invitations.ts`): Regex-based Clerk error detection is fragile but scoped to dev bypass — acceptable.

**Route cleanup** (`src/app/router.tsx`): 10 lines removed — the duplicate `/onboarding/documents` route is gone.

**E2E infrastructure**: New env vars (`E2E_HR_*`, `E2E_CANDIDATE_*`), updated auth helpers, and comprehensive seed fixtures in `convex/seed.ts` (including candidate task creation with the six current types).

---

### Blockers — missing AC-critical changes

The following files are **not in this diff** but are required by the plan's acceptance criteria:

| AC | Required change | Missing file(s) |
|----|----------------|-----------------|
| **AC-1** | Upload regression fix — Vite dev proxy for `/api/storage`, shared upload helper that rewrites `127.0.0.1` origin to `window.location.origin` in dev, and `DocumentUploadPage` rewrite from PUT+URL-path to POST+JSON-body | `vite.config.ts`, `src/shared/lib/upload.ts`, `src/features/onboarding/pages/DocumentUploadPage.tsx` |
| **AC-3** | Checklist routes document tasks by `task._id` (not type string) | `src/features/onboarding/pages/CandidateOnboardingPage.tsx` |
| **AC-4** | Application form rewritten to Figma entry frame (fullName, email, phone, position only) | `src/features/onboarding/pages/ApplicationFormPage.tsx` |
| **AC-5** | Document upload page queries `listCandidateTasks`, finds task by `_id`, passes `task.type` as `documentType` | `src/features/onboarding/pages/DocumentUploadPage.tsx` |
| **AC-6** | `ApplicationReviewPage` adds `expiresAt` input, seeds defaults from `application.fields`, passes all offer fields to `sendOffer` | `src/features/hr/pages/ApplicationReviewPage.tsx` |
| **AC-7** | Status/profile/training pages use `application.fields` correctly | `ApplicationStatusPage.tsx`, `TrainingPage.tsx`, `AcknowledgmentPage.tsx` |

The `org:candidate` role addition in `files.ts` is necessary but **not sufficient** for AC-1. The "Failed to fetch" error is a CORS/network issue caused by the browser at `localhost:5173` trying to `POST` to `127.0.0.1:3210`. Without the Vite proxy and origin-rewrite helper, the upload will still fail in local dev.

The test suite passing is expected — `DocumentUploadPage.test.tsx` mocks the Convex backend and never exercises the real upload URL flow. It cannot catch the dev-environment regression.

---

### Non-blocking observations

1. **`convex/authHelpers.ts` line 145–155**: The new `getAtriaRoleFromMetadata` helper and the expanded `getClerkOrganizationRole` are correct. One subtle ordering note: `org_public_metadata.atriaRole` is checked *before* `o.rol`. Since these represent the same data in expanded vs. compact JWT form, the precedence is harmless in practice, but worth a comment for future readers.

2. **`convex/employeeProfiles.ts` lines 196–204**: `firstOrgAdmin` is queried *inside* the `createCaregiver` action. If the calling admin is the only admin and is also the subject of the hire (self-hire edge case), this still works because `firstOrgAdmin` returns any admin. Good.

3. **`convex/onboarding.test.ts` line 322**: `hireCandidate` test stubs `fetch` globally. The stub returns a fixed Clerk response. This is fine for unit tests but won't catch Clerk API contract changes. Acceptable for now.

4. **`convex/seed.ts`** (truncated in diff): The E2E fixture seeding cleans up stale candidates/employees before inserting — idempotent. Good.

5. **`src/features/onboarding/ApplicationFormPage.test.tsx`** (66 lines changed): Test updated, but the page file itself is not in the diff. If the page wasn't also updated, the test may be asserting against stale behavior. Needs verification.

---

### Verdict

The backend changes are correct, secure, and well-tested. However, **AC-1 (upload regression), AC-3 (checklist routing), AC-4 (application form), AC-5 (document upload), AC-6 (offer expiresAt), and AC-7 (field usage in status/profile/training)** all require frontend file changes that are absent from this diff. The core bug — "Failed to fetch" on document upload in dev — is not fixed.

VERDICT: CHANGES_REQUESTED