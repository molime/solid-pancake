# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 8 — Document Archive & Dynamic Form Renderer

### Critical Finding: Task Deliverables Missing from Diff

The diff provided does **NOT** contain the core files specified in the Session 8 task. This is a fundamental blocker.

| Required File (per Task) | Status in Diff |
|--------------------------|----------------|
| `src/features/documents/pages/DocumentArchivePage.tsx` | ❌ **MISSING** |
| `src/features/documents/components/DocumentDetailPanel.tsx` | ❌ **MISSING** |
| `src/features/documents/pages/DocumentArchiveRoute.tsx` | ❌ **MISSING** |
| `src/features/forms/components/DynamicFormRenderer.tsx` | ❌ **MISSING** |
| `src/features/forms/pages/FormSubmissionPage.tsx` | ❌ **MISSING** |
| Router updates for `/documents` and `/forms/:id` | ❌ **NOT VISIBLE** |
| Sidebar 'Documents' nav item | ❌ **NOT VISIBLE** |

### Acceptance Criteria Status

| AC | Requirement | Status |
|----|-------------|--------|
| AC-1 | DocumentArchivePage with filters/table | ❌ Not implemented in diff |
| AC-2 | Verify/Reject actions with optimistic update | ❌ Not implemented in diff |
| AC-3 | DocumentDetailPanel slide-in | ❌ Not implemented in diff |
| AC-4 | DynamicFormRenderer (6 field types + validation) | ❌ Not implemented in diff |
| AC-5 | FormSubmissionPage with redirect logic | ❌ Not implemented in diff |
| AC-6 | Router gates + Sidebar update | ❌ Not implemented in diff |
| AC-7 | Tests pass, lint/typecheck clean | ✅ Gates pass (but wrong files tested) |

### Issues in Files That ARE Present

**1. `convex/hrCases.ts` — Subject Resolution Query Pattern**
- Lines 23-44: `resolveSubjectName` function makes DB queries inside a loop in `listHrCases` (line 124: `Promise.all` with `resolveSubjectName` per case). This is an N+1 query pattern that could cause performance issues at scale. Consider batching candidate/employee lookups.

**2. `src/features/scheduling/components/CoverageRequestsPanel.tsx` — Mode Prop Not Typed Strictly**
- Line 47: `mode?: 'admin' | 'caregiver'` defaults to `'admin'` but the prop is optional. This could lead to ambiguous behavior if caller omits mode intentionally.

**3. `src/dev/mockConvexReact.tsx` — Duplicate Type**
- Line 25: `role: 'org:coordinator' | 'org:caregiver' | 'org:candidate' | 'org:candidate'` — `'org:candidate'` appears twice (harmless but indicates copy-paste error).

**4. `convex/files.ts` — Role Addition Without Full Context**
- Line 45: Added `'org:candidate'` to `generateUploadUrl` allowed roles. This is correct for document upload flows, but ensure the frontend gates candidate uploads to onboarding contexts only (not general archive).

### Security/Multi-Tenancy Observations

**Positive:**
- `convex/hrCases.ts` line 172: `requireTenantRole` is called in `updateHrCase` with proper tenant isolation.
- New test `convex/hrCases.test.ts` lines 307-407: Cross-tenant isolation test validates that admin from orgB cannot update orgA's case.

**Concern:**
- The document archive functionality (which handles PHI-adjacent documents like IDs, certifications) is not visible in this diff. Cannot verify that `listDocumentArchive` and `updateDocumentArchiveItem` have proper `authHelpers` guards.

### Test Coverage Gap

The test file `convex/documentArchive.test.ts` shows 8 tests passing (gate log), but the corresponding Convex functions (`convex/documents.ts` or similar) are **not in the diff**. This means:
1. Either the backend already existed (pre-Session 8), or
2. The tests are for stubbed/mock implementations

Without seeing the actual Convex mutations, I cannot verify:
- Multi-tenant scoping on document queries
- Role guards on `updateDocumentArchiveItem` (verify/reject actions)
- Audit logging on status changes (PHI compliance)

### What IS Good in This Diff

- `CoverageRequestsPanel` split into admin/caregiver modes with proper Toast integration (lines 199-349)
- `ShiftEditorModal` now shows schedule conflicts with Toast instead of inline error div (lines 188-203)
- HR Cases subject validation tests (lines 317-407 in `hrCases.test.ts`) properly test candidate vs employee subjects
- Mock data expanded for candidate onboarding flows (`src/dev/mockData.ts` lines 280-367)

---

## Required Changes

1. **Add all Session 8 deliverable files** to the diff:
   - `src/features/documents/pages/DocumentArchivePage.tsx`
   - `src/features/documents/components/DocumentDetailPanel.tsx`
   - `src/features/documents/pages/DocumentArchiveRoute.tsx`
   - `src/features/forms/components/DynamicFormRenderer.tsx`
   - `src/features/forms/pages/FormSubmissionPage.tsx`

2. **Show router updates** for `/documents` (admin/hr gate) and `/forms/:formDefinitionId` (all roles)

3. **Show Sidebar modification** adding 'Documents' nav item visible only to admin/hr

4. **Show Convex function signatures** for `listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, `submitForm` with auth guard verification

5. **Fix duplicate type** in `src/dev/mockConvexReact.tsx` line 25

6. **Add N+1 mitigation** in `convex/hrCases.ts` `listHrCases` — batch candidate/employee lookups instead of per-row resolution

---

VERDICT: CHANGES_REQUESTED