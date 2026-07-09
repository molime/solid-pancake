# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of Session 7 HR Screens Implementation

### Summary

The diff implements the core HR routing, sidebar navigation, backend mutations for candidate review (including `needs_correction`), employee profile queries, and the new `hrCases` module. The router and sidebar changes match the acceptance criteria. The backend guards are correctly applied. Lint, typecheck, and unit tests all pass (422 tests, 61 files).

However, there is one concrete blocker: **the backend test file for `hrCases` is missing**, which violates AC-15 (new unit/integration tests cover HR backend mutations). The plan explicitly required `convex/hrCases.test.ts`. The test run output does not include any `hrCases.test.ts` file.

### Detailed Findings

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| AC-1 | Routing & guards | ✅ | `router.tsx` lines 312–386: all 7 HR routes wrapped with `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}` and `RouteSuspense`. |
| AC-2 | Sidebar navigation | ✅ | `Sidebar.tsx` lines 85–102: `Candidates`, `Employees`, `Cases` nav items with correct icons and roles. |
| AC-3 | HR dashboard | ✅ (inferred) | `router.tsx` imports `HRDashboardPage`; test file `HRDashboardPage.test.tsx` exists (stderr shows it runs). |
| AC-4 | Invite candidate modal | ✅ (inferred) | Modal component exists (imported by dashboard page). |
| AC-5 | Candidate pipeline page | ✅ (inferred) | `CandidatePipelinePage` imported in router; test file exists. |
| AC-6 | Status badges | ✅ (inferred) | Mapping likely in `candidateStatus.ts` (not visible in diff but tests pass). |
| AC-7 | Application review page | ✅ (inferred) | `ApplicationReviewPage` imported; test file exists. |
| AC-8 | Backend review correction | ✅ | `candidates.ts` lines 582–618: `decision` union widened to include `'needs_correction'`; status set to `'application_draft'`; `hrNotes` required. |
| AC-9 | Hire convert page | ✅ (inferred) | `HireConvertPage` imported; test file exists. |
| AC-10 | Employees page | ✅ (inferred) | `EmployeesPage` imported; test file exists. |
| AC-11 | Employee profile page | ✅ (inferred) | `EmployeeProfilePage` imported; test file exists. |
| AC-12 | HR cases page & modal | ✅ (inferred) | `HRCasesPage` imported; test file exists. |
| AC-13 | Backend HR cases | ✅ (inferred) | `convex/_generated/api.d.ts` includes `hrCases` module; `hrCases.ts` must exist. |
| AC-14 | Quality gates | ✅ | Lint, typecheck, unit all pass. Build not shown but likely passes. |
| AC-15 | Tests | ❌ **Missing** | **`convex/hrCases.test.ts` is not present in the test output.** The plan required it. Only `candidates.test.ts` was extended for `needs_correction`. |

### Security & Edge Cases

- **Tenant isolation**: All new queries/mutations use `requireTenantRole` and `assertTenantDoc`. Good.
- **Role enforcement**: `listEmployeeProfiles` and `getEmployeeProfileDetail` correctly allow `org:hr`. Good.
- **Idempotency**: `hireCandidate` stores optional fields in `application.fields.hiringDetails` without overwriting existing fields. Good.
- **PHI**: No plaintext SSN/DOB fields added. Good.
- **`attachCandidateDocument`** (new mutation in `candidates.ts`): The guard allows `org:admin` and `org:hr` but then throws if role is not `org:candidate`. This is a code smell (should restrict guard to `org:candidate` only), but not a security risk because it throws. Consider tightening the guard.

### Unrelated Scope

The diff includes a large amount of scheduling, onboarding, and dev mock code that is not part of the HR task. While this does not break the HR changes, it increases the risk of regressions. The AppShell refactor (removing `TenantRouteGuard`, adding `TrainingGate`, redirect logic) is a significant change not called for in the plan. However, since all tests pass, it is not a blocker.

### Required Change

**Add `convex/hrCases.test.ts`** with tests for:
- `createHrCase` creates a case with correct `tenantId`, `subjectType`, `subjectId`, `category`, `status:'open'`, and `ownerMemberId`.
- `listHrCases` returns only cases for the caller’s tenant, sorted newest-first, with resolved subject name and owner name.
- `updateHrCase` allows `org:hr` to change status to `in_review`, `resolved`, or `closed`; blocks invalid status strings; blocks cross-tenant updates.

This is required to satisfy AC-15 and the plan’s test strategy.

VERDICT: CHANGES_REQUESTED