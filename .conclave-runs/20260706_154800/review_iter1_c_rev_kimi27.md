# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

## Review: Session 8 — Document Archive & Dynamic Form Renderer

### Summary
The working-tree diff does **not** contain the core Session 8 deliverables. The changed-file list (`convex/files.ts`, `convex/hrCases.*`, scheduling components, `src/app/shell/AppShell.tsx`, dev mocks, `src/main.tsx`, shared UI tweaks, etc.) shows a lot of unrelated work, but none of the required document-archive or form-renderer files are present, and the Sidebar is not updated. The unit-test run also shows no tests for `DocumentArchivePage`, `DynamicFormRenderer`, or `FormSubmissionPage`.

### Concrete blockers

1. **Missing Session 8 files (AC-1 through AC-5 not implemented)**
   - `src/features/documents/pages/DocumentArchivePage.tsx` — not in diff.
   - `src/features/documents/components/DocumentDetailPanel.tsx` — not in diff.
   - `src/features/documents/pages/DocumentArchiveRoute.tsx` — not in diff.
   - `src/features/forms/components/DynamicFormRenderer.tsx` — not in diff.
   - `src/features/forms/pages/FormSubmissionPage.tsx` — not in diff.
   Without these files the `/documents` and `/forms/:formDefinitionId` routes cannot render the requested UI.

2. **Missing router and Sidebar updates (AC-6)**
   - `src/components/layout/Sidebar.tsx` is **not** in the changed-file list, so the “Documents” nav item for `org:admin`/`org:hr` has not been added.
   - `src/main.tsx` is modified, but the truncated diff does not show the new `/documents` and `/forms/:formDefinitionId` route definitions or their role gates. Need to confirm those routes exist and are guarded to `org:admin`/`org:hr` and all valid roles respectively.

3. **Missing tests for touched/new behaviour**
   - No `DynamicFormRenderer.test.tsx` covering the six field types, required-field validation, inline errors, and valid `onSubmit`.
   - No `DocumentArchivePage.test.tsx` covering filters, Verify optimistic update, and Reject modal flow.
   - No `FormSubmissionPage.test.tsx` covering definition fetch and `submitForm` call.
   The latest gate output lists 62 test files but none of the above.

4. **Auth-shell regression risk (`src/app/shell/AppShell.tsx`)**
   - Lines 1–47 remove `TenantRouteGuard` and replace it with a local org/user check plus `TrainingGate`.
   - `role` is cast to `'org:caregiver' | 'org:candidate' | undefined`, but `members.me` can return `org:admin`, `org:coordinator`, `org:hr`, etc. That type cast is incorrect and may cause `TrainingGate` to mis-handle admins/coordinators/HR.
   - If `TrainingGate` does not enforce role-based route protection, removing `TenantRouteGuard` could let any org member reach admin-only routes unless every route has its own guard. Please verify `TrainingGate` behaviour or keep the existing route guard.

5. **Convex contracts not verified in this diff**
   - The task depends on `listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, and `submitForm`. The diff does not touch `convex/documents.ts` or `convex/forms.ts`, so I cannot confirm the signatures, auth guards, or multi-tenant scoping for the new pages. Ensure these functions exist and use `authHelpers` before the frontend calls them.

### Non-blocking notes
- `convex/files.ts` adding `org:candidate` to `generateUploadUrl` is consistent with the task.
- `convex/hrCases.ts` improvements (subject validation, cross-tenant `assertTenantDoc`, audit logging) look correct.
- `src/dev/mockConvexReact.tsx` has a redundant union member `'org:candidate' | 'org:candidate'`; harmless but worth cleaning up.

### Required before approval
Create the five missing components/pages, wire the routes and Sidebar, add the specified unit tests, and verify the underlying Convex queries/mutations. Also confirm that the `AppShell` auth change does not weaken role gating for `/documents`.

VERDICT: CHANGES_REQUESTED