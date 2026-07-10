# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## CODE REVIEW: Session 8 - Document Archive & Dynamic Form Renderer

### CRITICAL FINDING: TASK REQUIREMENTS NOT MET

The diff provided does **NOT** contain the core files required by Session 8's acceptance criteria. This is a fundamental mismatch between the task specification and the actual code changes.

---

### MISSING ACCEPTANCE CRITERIA (All 7 ACs Unaddressed)

| AC | Requirement | Status |
|---|---|---|
| AC-1 | `DocumentArchivePage.tsx` at `/documents` | ❌ **FILE NOT IN DIFF** |
| AC-2 | Verify/Reject actions with optimistic update + modal | ❌ **NOT IMPLEMENTED** |
| AC-3 | `DocumentDetailPanel.tsx` slide-in panel | ❌ **FILE NOT IN DIFF** |
| AC-4 | `DynamicFormRenderer.tsx` with 6 field types | ❌ **FILE NOT IN DIFF** |
| AC-5 | Form validation with red asterisk + inline errors | ❌ **NOT IMPLEMENTED** |
| AC-6 | Router gates for `/documents` and `/forms/:id` | ❌ **NO ROUTE CHANGES** |
| AC-7 | Sidebar 'Documents' nav item for admin/hr | ❌ **NO SIDEBAR CHANGES** |

---

### WHAT THE DIFF ACTUALLY CONTAINS

The changes are focused on **scheduling/coverage features** and **HR case improvements**, not Session 8's document archive and form renderer:

- `convex/hrCases.ts` - Subject validation, tenant isolation (good but off-topic)
- `src/features/scheduling/components/CoverageRequestsPanel.tsx` - Admin/caregiver mode split
- `src/features/scheduling/components/ShiftEditorModal.tsx` - Schedule conflict detection
- `src/dev/*` - Mock data harness updates for candidate onboarding views

---

### SECURITY/PHI CONCERNS IN EXISTING CHANGES

**`convex/files.ts` line 45:**
```typescript
'org:candidate',  // ADDED
```
Adding `org:candidate` to `generateUploadUrl` without corresponding access controls on document retrieval is a **PHI exposure risk**. Candidates should only upload their own documents, not access arbitrary upload URLs.

**`convex/hrCases.ts` line 23-47:**
The `resolveSubjectName` function properly validates tenant isolation with `assertTenantDoc`, which is good. However, this is HR case logic, not document archive logic.

---

### TEST COVERAGE GAP

While `convex/documentArchive.test.ts` shows 8 passing tests in the gate results, **the test file is not in the diff**. I cannot verify:
- Whether tests cover the `listDocumentArchive` query filters (type, status, expiringSoon, search)
- Whether tests verify multi-tenant isolation on document queries
- Whether tests cover the `updateDocumentArchiveItem` mutation with rejection reasons

---

### POSITIVE OBSERVATIONS (On What IS Present)

1. **`convex/hrCases.ts`** - Proper subject type validation and cross-tenant isolation tests (lines 307-407 in test file)
2. **`CoverageRequestsPanel.tsx`** - Clean admin/caregiver mode split with toast error handling (lines 200-350)
3. **`ShiftEditorModal.tsx`** - Schedule conflict detection before save (lines 105-120)
4. **All gates pass** - lint, typecheck, and 428 tests passing

---

### REQUIRED CHANGES

1. **Create all 5 missing feature files** for Document Archive and Dynamic Form Renderer
2. **Add router configuration** for `/documents` (admin/hr gate) and `/forms/:formDefinitionId` (all roles)
3. **Update Sidebar** with Documents nav item visible only to admin/hr
4. **Add PHI safeguards** - ensure `generateUploadUrl` for candidates is scoped to their own profile
5. **Add frontend tests** for `DynamicFormRenderer` validation and `DocumentArchivePage` actions
6. **Verify Convex functions exist** - `listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, `submitForm`

---

### BLOCKER ASSESSMENT

This diff **cannot be approved** because the primary Session 8 deliverables are completely absent. The scheduling improvements are valuable but represent different work. Deploying this would leave the document archive and form submission features non-functional, breaking the candidate onboarding flow that depends on them.

VERDICT: CHANGES_REQUESTED