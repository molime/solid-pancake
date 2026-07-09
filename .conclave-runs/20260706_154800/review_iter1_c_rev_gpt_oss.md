# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Summary of what was changed**

| File | Main change |
|------|-------------|
| `convex/files.ts` | Added `org:candidate` to the list of roles allowed to generate an upload URL. |
| `convex/hrCases.test.ts` | Added a lot of new test cases for employee‑subject validation, cross‑tenant isolation, etc. |
| `convex/hrCases.ts` | Introduced `subjectType` validation, a new `resolveSubjectName` helper, added audit logging, changed the shape of `hrCases` (new fields `title`, `createdAt`), updated `listHrCases` to resolve subject names dynamically, expanded `updateHrCase` mutation signature. |
| `src/app/shell/AppShell.tsx` | Re‑worked the shell: added routing‑level auth loading, training gate, dynamic sidebar visibility, toast loader, etc. |
| `src/dev/*` | Added many onboarding‑related mock pages, mock data for candidate tasks/profile, extended mock API/Clerk/Convex helpers to support candidate role, added new view options to the screenshot harness. |
| `src/features/scheduling/components/CoverageRequestsPanel.tsx` | Refactored into admin & caregiver modes, added toast UI, added a full caregiver‑flow UI (back link, shift preview, eligible coworker list, request‑coverage mutation). |
| `src/features/scheduling/components/ShiftEditorModal.tsx` | Added toast handling, richer UI (labels, hints), schedule‑conflict detection, availability query, improved error handling, added icons, etc. |
| Various test files | Updated tests for the new HR‑case logic, coverage‑panel, shift‑editor, etc. |
| Minor UI component tweaks (`src/shared/ui/*`) | Adjusted imports, added a missing export, tiny style changes. |
| `vite.config.ts` | Minor config tweak. |

**What the task required (acceptance criteria)**  

1. **Document Archive page** (`src/features/documents/pages/DocumentArchivePage.tsx`) with filter bar, table, actions, optimistic verify, reject‑modal, empty state.  
2. **DocumentDetailPanel** (`src/features/documents/components/DocumentDetailPanel.tsx`) slide‑in panel with full metadata and status‑change buttons.  
3. **DocumentArchiveRoute** lazy‑loaded wrapper.  
4. **DynamicFormRenderer** component handling all field types, required‑field validation, loading state, using only the shared UI primitives.  
5. **FormSubmissionPage** (`src/features/forms/pages/FormSubmissionPage.tsx`) that fetches a form definition, renders the renderer, calls `submitForm`, redirects appropriately.  
6. **Router updates** to expose `/documents` (admin/hr) and `/forms/:formDefinitionId` (all roles).  
7. **Sidebar update** to add a “Documents” navigation item for admin/hr.  
8. **Tests** covering the new UI components and actions.  

**Missing pieces / regressions**

| Missing AC | Evidence |
|------------|----------|
| Document Archive page & related components | No new files `DocumentArchivePage.tsx`, `DocumentDetailPanel.tsx`, `DocumentArchiveRoute.tsx` appear in the diff. |
| DynamicFormRenderer | No file `DynamicFormRenderer.tsx` added. |
| FormSubmissionPage | No file `FormSubmissionPage.tsx` added. |
| Router changes for `/documents` and `/forms/:formDefinitionId` | No modifications to `src/routes.tsx` (or equivalent) are present. |
| Sidebar navigation entry for “Documents” | `src/app/shell/Sidebar.tsx` was not touched; no new nav item added. |
| Tests for the new document‑archive UI, dynamic form renderer, form submission page | No new test files for those components exist. |
| Convex backend for document archive | The only Convex changes are unrelated (file upload role, HR case logic). No `documentArchive` queries/mutations were added or verified. |
| Auth guards for the new routes | Not added; existing `TenantRouteGuard` remains unchanged. |
| Toast / error handling for document actions | Not present because the UI components themselves are missing. |

**Potential side‑effects / security concerns**

* The added `org:candidate` role to `generateUploadUrl` (in `convex/files.ts`) widens the set of users who can obtain a signed upload URL. This is intentional for candidate document uploads, but the change is not gated by any additional validation (e.g., ensuring the candidate is allowed to upload a specific document type). If the rest of the onboarding flow is not yet in place, this could expose a storage bucket to unauthorized uploads. A guard should verify the candidate’s identity and the intended document purpose before issuing the URL.

* The new `resolveSubjectName` helper in `convex/hrCases.ts` performs a `ctx.db.get` on a candidate ID without first confirming that the candidate belongs to the tenant. It does call `assertTenantDoc(candidate, tenantId)`, which is good, but the helper is also used for employee subjects where the query is a `query('employeeProfiles')` with an index. The index lookup is correctly scoped, but the function still throws a generic `ConvexError` if not found – this is acceptable.

* The expanded `updateHrCase` mutation now accepts optional `title`, `description`, `category`. Existing callers (e.g., UI) may not be passing these fields, which is fine because they are optional, but the mutation now silently ignores them if undefined. No regression here.

* The UI changes (e.g., `CoverageRequestsPanel` caregiver mode) introduce new network calls (`requestCoverage`) that were not previously covered by tests for error handling. The test suite does include a mock for `requestCoverage`, but there is no test for the failure path (toast on error). Adding a negative test would improve robustness.

* The `ShiftEditorModal` now performs schedule‑conflict detection using a query that fetches all shifts for the selected caregiver on the selected date. This query could be heavy for large datasets; however, it is limited to a single day and caregiver, so impact is minimal. No security issue.

**Missing tests for newly introduced behaviour**

* No unit or integration tests for the **document archive** UI (filters, verify/reject actions, optimistic updates, empty state).  
* No tests for **DynamicFormRenderer** (field rendering, required‑field validation, loading state).  
* No tests for **FormSubmissionPage** (fetching definition, calling `submitForm`, redirect logic).  
* No tests for the **router guards** that enforce role‑based access to the new routes.  
* No tests for the **sidebar navigation** change.  

**Conclusion**

The submitted diff addresses a different set of features (HR case subject handling, onboarding mock data, coverage request UI, shift editor enhancements) but does **not** implement any of the core deliverables required by the task (document archive UI, dynamic form renderer, form submission page, routing, sidebar, and associated tests). Therefore the acceptance criteria are not met.

**Requested changes**

1. Add the missing components:
   * `src/features/documents/pages/DocumentArchivePage.tsx`
   * `src/features/documents/components/DocumentDetailPanel.tsx`
   * `src/features/documents/pages/DocumentArchiveRoute.tsx`
   * `src/features/forms/components/DynamicFormRenderer.tsx`
   * `src/features/forms/pages/FormSubmissionPage.tsx`
2. Update the router (e.g., `src/routes.tsx`) to expose `/documents` (admin/hr) and `/forms/:formDefinitionId` (all roles) with proper Convex guards.
3. Modify `src/app/shell/Sidebar.tsx` to include a “Documents” navigation item visible only to `org:admin` and `org:hr`.
4. Ensure Convex backend has the required queries/mutations (`listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, `submitForm`) with appropriate tenant and role guards.
5. Add unit tests for:
   * DocumentArchivePage (filter UI, table rendering, verify/reject actions, empty state).
   * DocumentDetailPanel (slide‑in behavior, metadata display, status change buttons).
   * DynamicFormRenderer (all field types, required validation, loading state).
   * FormSubmissionPage (definition fetch, submit handling, redirects).
   * Router guard tests for the new routes.
   * Sidebar navigation visibility tests.
6. Add negative test cases for error handling in the new UI components (e.g., reject mutation failure, form submit failure).
7. Review the added `org:candidate` permission on `generateUploadUrl` – ensure it is intentional and that any future document‑upload flow validates the candidate’s permission before issuing the URL.

Once these items are implemented and the corresponding tests pass, the feature set will satisfy the original task.

VERDICT: CHANGES_REQUESTED