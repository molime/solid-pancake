# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: Phase 2 E2E + Integration Tests

### AC-1: `tests/e2e/scheduling.spec.ts` — **MISSED**

The plan explicitly requires scrolling the "Send request" button into view before clicking (with a `force` fallback) in `tests/e2e/scheduling.spec.ts`. This file **does not appear in the diff at all** (it is absent from the 48-file changelist). The viewport/overlay issue that caused Playwright to report the button as "outside of the viewport" remains unfixed in the test. The `deleteFixtureCaregiverShifts` hardening in `seed.ts` addresses the stale-shift conflict, but the click fix is missing.

**Action needed:** Add `scrollIntoViewIfNeeded()` + click (or `click({ force: true })` fallback) to the "Send request" button interaction in `tests/e2e/scheduling.spec.ts`.

---

### AC-2: `convex/onboarding.test.ts` — ✅ Satisfied

New `candidate lifecycle` describe block covers:
- `inviteCandidate` seeds 5 candidate tasks in order (`form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`)
- `submitApplication` → `form_submission` task status `complete`
- `reviewApplication` → status `hr_review`
- `sendOffer` → `offer_sent`
- `acceptOffer` → `accepted` (plus idempotency test)
- `hireCandidate` → `employeeProfileId` defined, `adpSyncStatus === 'pending_credentials'`, member role `org:caregiver`
- `org:candidate` blocked from `scheduling.listShifts`

---

### AC-3: `convex/scheduling.test.ts` — ✅ Satisfied

New tests added:
- `checkShiftConflict returns null when excluding the only shift` — direct `excludeShiftId` test
- `allows overlapping shifts for different caregivers` — cross-caregiver no-conflict
- `blocks a non-caregiver assignedCaregiver`
- `rejects an overlapping shift for the same caregiver`
- `records a shift.created audit event`

---

### AC-4: `convex/forms.test.ts` — ✅ Satisfied

- `throws when multiple required fields are missing and lists them` — verifies error message contains `Missing required fields: name, experience`
- `sampleFields` updated: `experience` now `required: true`, `notes` added as optional
- `forms.ts` collects all missing fields before throwing (lines 223–232)
- `documentArchive.test.ts` gains a `pending_review fixture` test verifying `verifiedBy`/`verifiedAt` and audit event

**Minor note:** When exactly one field is missing, the message reads `"Missing required fields: name"` (plural "fields" for a single item). Grammatically awkward but not a blocker.

---

### AC-5: `convex/seed.ts` Phase 2 fixtures — ✅ Satisfied

All five fixtures are idempotent (delete-before-insert):
- `seedPhase2Candidate` — candidate at `hr_review` with application + 5 completed tasks
- `seedPhase2AvailabilityWindow` — recurring window for seeded caregiver
- `seedPhase2CoverageRequest` — open coverage request + fixture shift
- `seedPhase2FormDefinition` — 3-field form (name req, experience req, notes opt)
- `seedPhase2DocumentArchiveItems` — 2 pending_review items

`seed.test.ts` has an idempotency test verifying double-seed produces count = 1 (2 for documents).

`deleteFixtureCaregiverShifts` now matches both Clerk user IDs **and** Convex `tenantMembers._id`, plus includes admin/coordinator/candidate IDs for robustness. This addresses the stale-shift conflict.

---

### AC-6: Gate results — Partially met

Lint ✅, typecheck ✅, unit tests ✅ (449 passed, 65 files). **E2E and build gate results are not provided.** The task requires all five gates with real pass/fail counts.

---

### AC-7: No manual edits to `convex/_generated/`, no credentials — ✅

No generated files touched. `.env.e2e.example` adds placeholder entries only.

---

### Other observations (non-blocking)

1. **`authHelpers.ts` role priority inversion** — `getClerkOrganizationRole` now checks compact roles (`o.rol`, `o.rol`) before top-level `org_role`, while `getActiveClerkOrganizationId` checks top-level `org_id` first. The comment says "top-level claim is authoritative," but the role function now prefers compact. If both are present and disagree, behavior changed. Likely intentional for Clerk JWT format, but worth a comment noting the deliberate difference.

2. **`candidates.ts` `updateClerkMembershipRole`** — Now lists memberships first, then PATCHes by membership ID. Returns `{ updated, membershipId }` instead of `{ updated }`. Additive return type is backward-compatible. The fallback when no membership exists returns `{ updated: false, membershipId: null }` — callers should handle this.

3. **`hrCases.ts` `createHrCase`** — `title` is now a required arg. Any existing caller not passing `title` will get a runtime validation error. Typecheck passing confirms all current callers are updated.

4. **`forms.ts` error format change** — `"Missing required field: X"` → `"Missing required fields: X, Y"`. Any frontend code or E2E test matching the old singular format will break. Unit tests are updated; E2E tests are not in the diff so cannot verify.

---

### Verdict

The only **blocking** issue is the missing `tests/e2e/scheduling.spec.ts` fix for the "Send request" button (AC-1). All other ACs are satisfied. The stale-shift cleanup is properly hardened, but the Playwright click fix was not applied.

VERDICT: CHANGES_REQUESTED