# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### What's present and correct

The diff delivers solid **backend infrastructure** for the candidate portal:

- **`convex/authHelpers.ts`** — Extends `getClerkOrganizationRole` to resolve `atriaRole` from `org_public_metadata`, compact `o.pub`, and dotted `o.pub`. This unblocks Clerk `org:member` users who carry an ATRIA role in public metadata. Tests cover the new paths.
- **`convex/files.ts`** — Adds `'org:candidate'` to `generateUploadUrl`'s allowed roles, a prerequisite for candidate document upload (AC-1 backend half).
- **`convex/members.ts`** — `firstOrgAdmin` query (used by `createCaregiver` to find an admin inviter), `createBypassMember` internal mutation for dev invite bypass, and `org:hr` added to `list` so HR can see the member roster.
- **`convex/invitations.ts`** — Exports `toClerkRole` and `isAllowListError` for the dev bypass flow.
- **`convex/employeeProfiles.ts`** — `createCaregiver` now resolves the first org admin as inviter instead of assuming the caller has Clerk admin privileges.
- **`convex/scheduling.ts`** — Fixes a real bug: `ctx.db.delete(shift._id)` was called *before* the audit record, meaning the audit referenced a deleted document. Reordered to audit-then-delete.
- **`convex/schema.ts`** — Adds `invitationFailed` / `invitationError` optional fields to `tenantMembers` for tracking Clerk invitation failures.
- **`convex/seed.ts`** — `seedE2ECandidateFixtures` / `resetE2ECandidateFixtures` mutations for deterministic E2E data.
- **`convex/onboarding.test.ts`** — 15 new tests covering the full candidate→caregiver lifecycle: task ordering (6 types), `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` (with Clerk membership stub), training idempotency, and candidate blocked from scheduling.
- **`convex/scheduling.test.ts`** — New tests for audit on shift creation, caregiver role restrictions, approved-shift edit guard, submitted-shift delete guard, and coverage conflict detection.
- **`convex/forms.test.ts`** — Tests for empty-string required-field rejection, `updateDocumentArchiveItem` verify/reject/caregiver-block.
- **`convex/members.test.ts`** — Tests for `firstOrgAdmin` (found, not found, auth guard).
- **Route guard / AppShell / SelectAgencyPage** — Add `org:candidate` handling so candidates can reach the onboarding portal.
- **E2E helpers** — Candidate and HR auth accounts, `isAllowListError`-aware invitation bypass.

All gate results (lint, typecheck, unit tests) pass. The backend work is well-structured and well-tested.

---

### Missed acceptance criteria (blockers)

The diff addresses backend prerequisites but **does not include the core frontend changes** that the task explicitly requires. The following ACs are unmet:

| AC | Requirement | Status |
|----|-------------|--------|
| **AC-1** | Upload regression fixed (Vite proxy, upload helper, POST+JSON `storageId`, origin rewrite) | **Missing.** No `vite.config.ts` proxy, no `src/shared/lib/upload.ts`, no `DocumentUploadPage.tsx` rewrite. Adding `org:candidate` to `generateUploadUrl` is necessary but not sufficient — the browser still gets a `127.0.0.1:3210` URL that fails with CORS/reachability. |
| **AC-2** | Remove duplicate `/onboarding/documents` route; wire `CandidateOnboardingIndex` routing | **Missing.** No changes to `src/app/router.tsx` or `CandidateOnboardingIndex.tsx`. |
| **AC-3** | Checklist maps six `CANDIDATE_TASK_TYPES` with correct labels/routes, routes document tasks by `_id` | **Missing.** No changes to `CandidateOnboardingPage.tsx`. |
| **AC-4** | Application form matches Figma entry (fullName, email, phone, position only) | **Missing.** Only the test file (`ApplicationFormPage.test.tsx`) was touched; the page component itself was not updated. |
| **AC-5** | Document upload queries `listCandidateTasks`, finds task by `_id`, uses shared upload helper, calls `attachCandidateDocument` with `documentType: task.type` | **Missing.** No changes to `DocumentUploadPage.tsx`. |
| **AC-6** | `ApplicationReviewPage` collects `expiresAt`, seeds defaults from `application.fields`, passes all offer fields to `sendOffer` | **Missing.** No changes to `ApplicationReviewPage.tsx`. |
| **AC-7** | Profile/status/training pages use `application.fields` correctly | **Partially addressed.** Only `CandidateProfilePage.tsx` was modified (48 insertions); `ApplicationStatusPage`, `TrainingPage`, `AcknowledgmentPage` are untouched. |

These are the **primary deliverables** of the task. Without them, the candidate portal cannot function end-to-end.

---

### Security / correctness issues in what *is* present

1. **`convex/files.ts` — no test for `org:candidate` role in `generateUploadUrl`.** The role was added but `convex/files.test.ts` is not in the diff. The plan explicitly called for a test that `generateUploadUrl` succeeds for `org:candidate` and rejects unknown/cross-tenant callers. **Missing test for touched behaviour.**

2. **`convex/authHelpers.ts` — `org_public_metadata.atriaRole` expands the trust boundary.** Clerk public metadata is server-set (requires secret key), so this is not exploitable by end users. However, the fallback chain now checks `org_public_metadata` *before* compact JWT claims, which could change behavior for orgs that have both. The tests cover the new paths, which is good. **Not a blocker, but worth a comment in code documenting the priority order.**

3. **`ATRIA_X_DEV_INVITE_BYPASS` has no runtime production guard.** The `.env.example` comment says "Never enable in production," but there is no code-level check (e.g., `if (process.env.NODE_ENV === 'production' && process.env.ATRIA_X_DEV_INVITE_BYPASS) throw …`). If someone accidentally sets this in a production env, the bypass would be active. **Low-severity but worth a defensive guard.**

4. **`convex/members.ts` — `list` now allows `org:hr`.** This is a new permission: HR can now list all org members. This is likely intentional for the candidate pipeline, but it should be verified that HR shouldn't see a filtered list (e.g., only candidates + caregivers). **Not a blocker, but verify intent.**

5. **`convex/hrCases.ts` — `createHrCase` now requires `title` and `createdAt`.** Any existing callers that don't pass these will break. Verify all callers are updated. **Not visible in diff; flag for verification.**

---

### Minor observations

- `convex/onboarding.test.ts` line ~310: `vi.useFakeTimers()` in `hireCandidate` test — if the test fails before `vi.useRealTimers()`, fake timers leak. Vitest isolates test files, so this is cosmetic.
- `convex/scheduling.ts` delete/audit reorder is a genuine bugfix — good catch.
- No test for `isAllowListError` (simple regex, low risk, but the plan called for it).
- No direct test for `createBypassMember` (tested indirectly via E2E).

---

### Verdict

The backend infrastructure is solid and well-tested, but **the core frontend changes that the task requires are absent from this diff**. The upload regression (the "immediate bug") is not fixed, the routing is not cleaned up, and none of the candidate-facing pages were updated. Additionally, the `org:candidate` role addition to `generateUploadUrl` lacks a corresponding test.

These are concrete missed ACs that block the portal from functioning end-to-end.

VERDICT: CHANGES_REQUESTED