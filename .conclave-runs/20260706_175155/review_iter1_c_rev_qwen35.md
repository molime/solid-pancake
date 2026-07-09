# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 E2E + Integration Tests

### Summary
This change implements substantial Convex integration test coverage and seed fixtures for Phase 2, but **critically misses the Playwright E2E spec files** required by the task acceptance criteria.

---

### ✅ What's Correct

**Convex Integration Tests (AC-4, AC-5, AC-6 partially):**
- `convex/onboarding.test.ts`: Candidate lifecycle tests added (lines 362-573) including `inviteCandidate` seeding 5 tasks, full hire flow, `acceptOffer` idempotency, and `org:candidate` blocked from `listShifts`
- `convex/scheduling.test.ts`: Added non-caregiver `assignedCaregiver` block (lines 371-385), overlap conflict detection (lines 387-414), and `shift.created` audit event test (lines 416-439)
- `convex/forms.test.ts`: Updated `sampleFields` to match spec (name required, experience required, notes optional) at lines 164-167
- `convex/documentArchive.test.ts`: Added `pending_review` fixture verify test with audit event verification (lines 370-419)

**Seed Fixtures (AC-7):**
- `convex/seed.ts`: Added idempotent Phase 2 fixtures via helper functions:
  - `seedPhase2Candidate` (lines 837-889): candidate in `hr_review` status with application + 5 completed tasks
  - `seedPhase2AvailabilityWindow` (lines 891-913): recurring availability for seeded caregiver
  - `seedPhase2CoverageRequest` (lines 915-962): open coverage request tied to fixture shift
  - `seedPhase2FormDefinition` (lines 964-988): 3-field form (name required, experience required, notes optional)
  - `seedPhase2DocumentArchiveItems` (lines 990-1038): pending_review document archive items
- `convex/seed.test.ts`: Added idempotency assertion test (lines 403-476)

**Infrastructure:**
- `.env.e2e.example`: Added `E2E_CANDIDATE_EMAIL`/`PASSWORD` (lines 17-18)
- `playwright.config.ts`: Updated `e2eCredentialsAvailable()` to check candidate credentials (lines 22-24)
- `convex/files.ts`: Added `org:candidate` role to `generateUploadUrl` (line 45)
- `convex/forms.ts`: Added `getFormDefinition` query with candidate access (lines 350-373)
- `src/app/router.tsx`: Added `/documents` and `/forms/:formDefinitionId` routes (lines 150-179)
- `src/app/shell/Sidebar.tsx`: Added Documents nav item for admin/hr (lines 88-93)

**Gate Results:** All 446 unit/integration tests pass, lint and typecheck pass.

---

### ❌ Critical Missing Items (Blockers)

**AC-1, AC-2, AC-3: Playwright E2E Spec Files NOT Present**

The task explicitly requires three new E2E spec files:
1. `tests/e2e/onboarding.spec.ts` - Full candidate-to-caregiver flow with training mock
2. `tests/e2e/scheduling.spec.ts` - Admin shift creation, conflict, availability, coverage flow
3. `tests/e2e/documents.spec.ts` - Document verify/reject and expiring soon filter

**These files are completely absent from the diff.** Only the helper files were updated (`tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/env.ts`), but no actual E2E specs were created.

The gate results show `npm run test` passing (unit + integration), but there's no `npm run e2e` result in the logs, confirming E2E specs don't exist or weren't executed.

**Impact:** Without E2E tests, the full browser-level user flows (HR invites → candidate accepts → application → offer → hire → training → caregiver dashboard) are untested. This is a core Phase 2 deliverable.

---

### ⚠️ Security/Correctness Concerns

**1. `convex/files.ts` line 45 - Candidate Upload Access**
```typescript
'org:candidate',  // Added role
```
This allows candidates to generate upload URLs. While needed for document upload during onboarding, ensure `attachCandidateDocument` in `convex/candidates.ts` properly validates the candidate owns the document being attached. The diff doesn't show `candidates.ts` changes, so this may be safe if existing guards apply.

**2. `convex/forms.ts` lines 356-362 - Form Definition Access**
```typescript
await requireTenantRole(ctx, args.clerkOrgId, [
  'org:admin',
  'org:coordinator',
  'org:caregiver',
  'org:hr',
  'org:candidate',  // Added
])
```
Candidates can now read form definitions. This is appropriate for onboarding forms they need to submit, but verify no sensitive internal forms are exposed. The query returns the full form definition including all fields.

**3. `convex/documentArchive.ts` line 70 - `uploadedAt` Field**
```typescript
uploadedAt: item.createdAt,  // Added
```
This is a minor schema extension for the list response. Ensure the `DocumentArchiveItem` type in schema.ts includes this field or it's marked optional, otherwise typecheck may fail on stricter builds.

**4. `convex/hrCases.ts` - Subject Resolution**
The `resolveSubjectName` function (lines 23-50) queries candidate/employee data. Ensure multi-tenant isolation via `assertTenantDoc` is applied (it is, at lines 37 and 47). However, the `listHrCases` query (lines 116-162) now calls `resolveSubjectName` for each case in a `Promise.all`, which could be a performance concern with large case lists. Consider batching or caching.

---

### 📋 Test Coverage Gaps

1. **E2E specs missing** (critical - see above)
2. **`updateDocumentArchiveItem` caregiver block**: The task AC-6 mentions "org:caregiver cannot call updateDocumentArchiveItem" but this is tested in `documentArchive.test.ts`, not `forms.test.ts`. The existing test at lines 300-330 covers this, but the task description was slightly misaligned.
3. **`deleteShift` blocked on `in_progress`**: Task AC-5 mentions this guard, but I don't see a specific test for it in `scheduling.test.ts`. The diff shows tests for `updateShift` blocked on `submitted` but not `deleteShift` on `in_progress`.
4. **`requestCoverage` rejected for wrong caregiver**: Task AC-5 mentions this, but I don't see a specific test in the diff. The existing `CoverageRequestsPanel.test.tsx` changes may cover UI behavior, but Convex-level guard test is missing.

---

### Recommendations

1. **CREATE the three E2E spec files** (`tests/e2e/onboarding.spec.ts`, `scheduling.spec.ts`, `documents.spec.ts`) with full flow coverage as specified in AC-1, AC-2, AC-3
2. **Add missing Convex guard tests**: `deleteShift` blocked on `in_progress`, `requestCoverage` rejected for wrong caregiver
3. **Run `npm run e2e` gate** and include results in future submissions
4. **Verify `convex codegen` was run** after `seed.ts` changes (task requirement states "After editing convex/* run npx convex codegen")

---

### Verdict

The integration test and seed fixture work is solid, but the **missing E2E spec files are a critical blocker** against the task acceptance criteria. The task explicitly requires three Playwright E2E specs that do not exist in this change.

VERDICT: CHANGES_REQUESTED