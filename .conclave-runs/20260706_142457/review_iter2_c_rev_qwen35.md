# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 7 HR Screens Implementation

### Summary
The diff shows **partial implementation** of the HR screens task. Backend HR cases logic is present and well-tested, but **critical frontend deliverables are missing from this diff**. Additionally, there are scope creep changes unrelated to the HR task.

---

### ✅ What's Correct

1. **convex/hrCases.ts** (lines 1-229): 
   - Proper tenant isolation via `requireTenantRole(ctx, args.clerkOrgId, HR_ROLES)`
   - Subject validation with `isValidSubjectType()` and `resolveSubjectName()` with `assertTenantDoc()`
   - Audit logging on case creation (lines 89-98)
   - Cross-tenant update protection in `updateHrCase`

2. **convex/hrCases.test.ts** (lines 307-407):
   - Tests for unknown employee subject rejection
   - Tests for candidate subject resolution
   - Cross-tenant isolation test for `updateHrCase`

3. **Quality gates**: All 428 tests pass, lint/typecheck pass.

---

### 🚨 Critical Issues (CHANGES_REQUESTED)

#### 1. Missing Router Configuration (AC-1)
**File:** `src/app/router.tsx` — **NOT IN DIFF**

The plan requires 7 HR routes with `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}`. The diff shows `AppShell.tsx` changes but no `router.tsx` modifications. Without these routes, the HR pages are inaccessible.

**Request:** Add the router.tsx changes showing all `/hr/*` routes with proper guards.

#### 2. Missing Sidebar Navigation (AC-2)
**File:** `src/app/shell/Sidebar.tsx` — **NOT IN DIFF**

The plan requires `Candidates`, `Employees`, and `Cases` nav items visible to `org:admin`/`org:hr`. This is not in the diff.

**Request:** Add Sidebar.tsx changes showing HR nav items.

#### 3. Missing HR Page Components (AC-3 through AC-12)
**Files:** `src/features/hr/pages/*.tsx` — **NOT IN DIFF**

The following pages are required but not visible:
- `HRDashboardPage.tsx` (AC-3)
- `CandidatePipelinePage.tsx` (AC-5)
- `ApplicationReviewPage.tsx` (AC-7)
- `HireConvertPage.tsx` (AC-9)
- `EmployeesPage.tsx` (AC-10)
- `EmployeeProfilePage.tsx` (AC-11)
- `HRCasesPage.tsx` (AC-12)
- `InviteCandidateModal.tsx` (AC-4)
- `NewCaseModal.tsx` (AC-12)

Test files reference these pages (test results show them passing), but the actual implementations are not in this diff for review.

**Request:** Provide the page component diffs for security/correctness review.

#### 4. Missing Backend Schema Changes (AC-8)
**Files:** `convex/schema.ts`, `convex/candidates.ts` — **NOT IN DIFF**

The plan requires:
- `applications.decision` union widened to include `'needs_correction'`
- `reviewApplication` mutation extended to accept `decision:'needs_correction'`
- `by_tenant_member` index on `employeeProfiles`

These are not in the diff. Without them, AC-8 (Application review correction flow) cannot function.

**Request:** Add schema.ts and candidates.ts changes.

#### 5. Scope Creep: Unrelated Scheduling Changes
**Files:** `src/features/scheduling/components/CoverageRequestsPanel.tsx`, `ShiftEditorModal.tsx`, etc.

The diff includes ~800 lines of scheduling component changes (coverage requests, shift editor) that are **not part of the HR screens task**. This increases review surface area and risk without justification.

**Request:** Either justify these changes as dependencies, or separate them into a different PR.

#### 6. Role Addition Without Justification
**File:** `convex/files.ts` (line 45)
```typescript
'org:candidate',
```

Adding `org:candidate` to `generateUploadUrl` is not in the task scope. This expands upload permissions to a new role without documented security review.

**Request:** Justify this change or revert if not required for HR onboarding.

---

### 🔒 Security Observations

1. **Tenant isolation in hrCases.ts is correct** — `assertTenantDoc` is called after fetching subjects (lines 33-46).

2. **PHI concern** — The plan notes that DOB/SSN should not be displayed without encryption. Since the page components aren't in the diff, I cannot verify this is respected.

3. **Audit logging** — Present on `createHrCase` but should also be on `updateHrCase` for complete audit trail.

---

### 📋 Missing Tests for Touched Behavior

1. **`updateHrCase` audit logging** — No audit event recorded on case updates (lines 165-195 of hrCases.ts).

2. **`reviewApplication` with `needs_correction`** — No test visible in diff (plan AC-8 requires this).

3. **HR route guard tests** — `router.test.tsx` modifications not in diff.

---

### Verdict

The backend HR cases module is well-implemented, but the **core frontend deliverables (pages, router, sidebar) are missing from this diff**, making it impossible to verify AC-1 through AC-12. Additionally, unrelated scheduling changes introduce unnecessary risk.

VERDICT: CHANGES_REQUESTED