# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Phase 2 Candidate Onboarding Portal

### Summary
This diff contains substantial backend infrastructure changes for candidate lifecycle management, auth role resolution, and E2E test fixtures. However, several critical acceptance criteria from the plan are **not visibly addressed** in the diff.

---

### ✅ What's Good

1. **Backend role permissions** — `convex/files.ts:45` correctly adds `'org:candidate'` to `generateUploadUrl` allowed roles.

2. **Auth helpers hardened** — `convex/authHelpers.ts:131-172` now checks `org_public_metadata` for `atriaRole`, supporting the metadata-based role resolution pattern.

3. **Tenant isolation preserved** — `convex/members.ts:81-103` (`firstOrgAdmin`) uses `requireTenantRole` with proper role guards (`org:admin`, `org:hr`, `org:coordinator`).

4. **Test coverage** — `convex/onboarding.test.ts:296-848` adds comprehensive candidate-to-caregiver lifecycle tests (6 task types, submitApplication, sendOffer, acceptOffer, hireCandidate). All 469 unit tests pass.

5. **Audit ordering fix** — `convex/scheduling.ts:391-394` correctly moves `ctx.db.delete(shift._id)` to after the audit record is written, preventing audit loss on delete.

6. **Routing cleanup** — `src/app/router.tsx` shows 10 lines removed (likely duplicate route removal).

---

### ❌ Critical Gaps vs. Plan Acceptance Criteria

| AC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| **AC-1** | Upload regression fixed (Vite proxy + upload helper) | **MISSING** | No `src/shared/lib/upload.ts` created; no `vite.config.ts` proxy config in diff |
| **AC-6** | ApplicationReviewPage passes offer fields (incl. expiresAt) | **MISSING** | `src/features/hr/pages/ApplicationReviewPage.tsx` not in diff |
| **AC-4** | ApplicationFormPage reduced to 4 fields (fullName, email, phone, position) | **UNVERIFIED** | Test file modified but page implementation not visible |
| **AC-9** | Build gate | **NOT SHOWN** | Gate results show lint/typecheck/unit but no `npm run build` output |

---

### Security & PHI Concerns

1. **`createBypassMember` is `internalMutation`** — `convex/members.ts:295-347` — This is correct (not exposed to frontend), but ensure it's only called from trusted server-side code (e.g., seed/invitation flows).

2. **Document visibility** — No changes to `files.visibility` or `documentArchiveItems` in this diff. Existing code keeps `visibility: 'admins_coordinators'` for candidate documents, which is correct (candidates should not receive download URLs).

3. **`invitationFailed` / `invitationError` fields** — `convex/schema.ts:333-334` adds optional fields to `tenantMembers`. Ensure these are never exposed to candidates via any query.

---

### Requested Changes

1. **Add upload helper and Vite proxy** — The plan explicitly requires `src/shared/lib/upload.ts` with dev origin rewrite and `vite.config.ts` proxy for `/api/storage`. Without this, the "Failed to fetch" regression on `127.0.0.1:3210` is not fixed.

2. **Include ApplicationReviewPage changes** — The task requires updating `ApplicationReviewPage` to collect `expiresAt` and seed defaults from `application.fields`. This file must be in the diff.

3. **Show build gate result** — Add `npm run build` output to confirm no TypeScript/ bundling errors.

4. **Verify ApplicationFormPage implementation** — Confirm the page collects only 4 fields (not the previous longer form). The test change alone doesn't prove the implementation matches.

---

### Verdict

The backend infrastructure and tests are solid, but critical frontend pieces from the plan (upload helper, Vite proxy, ApplicationReviewPage offer fields) are missing from the diff. These are not polish items—they are explicit task requirements and acceptance criteria.

VERDICT: CHANGES_REQUESTED