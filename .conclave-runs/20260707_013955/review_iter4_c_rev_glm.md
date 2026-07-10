# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### AC-1: `tests/e2e/scheduling.spec.ts` — MISSING

The diff does **not** include any changes to `tests/e2e/scheduling.spec.ts`. The file is absent from the 49-file diff entirely. AC-1 explicitly requires:

- The "Send request" coverage button scrolled into view before clicking, with a `force` fallback.
- No stale fixture shift causing a false conflict.

The component-level changes to `ShiftPacketPanel.tsx` and `CoverageRequestsPanel.tsx` may improve layout, but the E2E test itself must be hardened with `scrollIntoViewIfNeeded()` + `click()` (and `click({ force: true })` fallback) as the AC states. This is a concrete missed AC item.

### AC-2: `convex/onboarding.test.ts` — ✅ Covered

All lifecycle assertions are present:
- `inviteCandidate` → 5 tasks in order (`form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`)
- `submitApplication` → `form_submission` task status `complete`
- Full lifecycle `invited → applied → hr_review → offer_sent → accepted → hired`
- `hireCandidate` → `employeeProfileId` defined, `adpSyncStatus === 'pending_credentials'`
- `acceptOffer` idempotent
- `org:candidate` blocked from `scheduling.listShifts`

### AC-3: `convex/scheduling.test.ts` — ✅ Covered

New tests added:
- `checkShiftConflict` with `excludeShiftId` returns `null` (line ~325)
- Cross-caregiver overlapping shifts allowed (line ~490)
- `createShift` audit event recorded
- Non-caregiver `assignedCaregiver` blocked

### AC-4: `convex/forms.test.ts` — ✅ Covered

- Multiple missing required fields: test expects `Missing required fields: name, experience`
- `updateDocumentArchiveItem` sets `verifiedBy`/`verifiedAt` — test in `forms.test.ts`
- `org:caregiver` blocked from `updateDocumentArchiveItem` — test in `forms.test.ts`
- `getFormDefinition` tests added (bonus)

**Note on `forms.ts` error message change:** The singular `Missing required field: name` became plural `Missing required fields: name` even for a single field. This is a client-facing breaking change. Intentional per the task, but any API consumers parsing this string will break. Acceptable for now but worth a changelog entry.

### AC-5: `convex/seed.ts` Phase 2 fixtures — Partially verifiable

The diff is truncated at the `deleteFixtureCaregiverShifts` function body. The `E2EFixtureUserIds` type now includes `candidateUserId?: string`, and `seed.test.ts` has a new idempotency test verifying single-insert semantics for candidates, availability windows, coverage requests, forms, and documents. However, I cannot verify that `deleteFixtureCaregiverShifts` now matches both Clerk user ids **and** Convex `tenantMembers._id` values — the function body is in the truncated portion. The seed test passing gives some confidence, but the stale-shift conflict fix is the core of AC-1's second bullet.

### AC-6: Gate results — INCOMPLETE

Only `lint`, `typecheck`, and `test` (456 passed) results are shown. `npm run e2e` and `npm run build` results are missing. The task requires all five gates with real pass/fail counts.

### AC-7: No edits to `convex/_generated/`, no credentials — ✅

No changes to generated files. `.env.e2e.example` has placeholder values only.

### Security / Multi-tenancy / PHI

- **`files.ts`**: Adding `org:candidate` to `generateUploadUrl` is correct — candidates need to upload onboarding documents. Tenant guard via `requireTenantRole` prevents cross-tenant access. ✅
- **`hrCases.ts`**: `resolveSubjectName` validates subject existence and tenant ownership before case creation. `createHrCase` now validates `subjectType` against an allowlist. ✅
- **`candidates.ts`**: `updateClerkMembershipRole` now lists memberships before PATCHing, with idempotency check and retry-on-failure verification. The `catch` block re-lists to detect successful-but-unreported PATCHes — good resilience. ✅
- **`forms.ts`**: New `getFormDefinition` query checks tenant membership and asserts tenant ownership. ✅
- **`documentArchive.ts`**: `uploadedAt: item.createdAt` is derived from an existing field. No new PHI surface. ✅

### Minor observations (non-blocking)

1. **`onboarding.test.ts` fetch stub**: `seedInvitedCandidate` uses a single generic `fetch` stub that returns the same response for all request types. When `hireCandidate` calls `updateClerkMembershipRole` (which now does GET-then-PATCH), the stub returns the invite-style response, not the `{ data: [...] }` structure `listMemberships` expects. This works because `listMemberships` returns `body.data ?? []` on missing `data`, yielding an empty array, and `updateClerkMembershipRole` returns `{ updated: false, membershipId: null }`. `hireCandidate` doesn't check this return value, so the test passes — but it's not testing the Clerk role promotion path. Not a blocker, but worth noting for future test improvement.

2. **`candidates.test.ts`**: The `stubClerkMembershipUpdate` was correctly updated to handle both GET (list) and PATCH requests with URL differentiation. ✅

3. **`hrCases.ts` `createHrCase`**: `title` is `v.string()` (required). The `updateHrCase` mutation now also accepts optional `title`, `description`, `category` patches. The `createdAt` field is now explicitly set rather than relying on `_creationTime`. ✅

---

**Summary of blockers:**

1. **AC-1**: `tests/e2e/scheduling.spec.ts` is unmodified — the "Send request" scroll/force click fix and the stale-shift E2E assertion hardening are missing.
2. **AC-6**: `npm run e2e` and `npm run build` gate results are not reported.

VERDICT: CHANGES_REQUESTED