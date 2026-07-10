# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Missing Acceptance Criteria**

| AC | Expected artifact | Current state (file/line) |
|----|-------------------|---------------------------|
| **AC‑1** – DocumentArchivePage (filter bar, table, empty state) | `src/features/documents/pages/DocumentArchivePage.tsx` | No such file added or modified in the diff. |
| **AC‑2** – Verify/Reject actions with optimistic UI, toast, rejection‑reason modal | Same file above & supporting modal component | Not present. |
| **AC‑3** – DocumentDetailPanel (slide‑in, metadata, status‑change buttons) | `src/features/documents/components/DocumentDetailPanel.tsx` | Not present. |
| **AC‑4** – DocumentArchiveRoute (lazy‑loaded wrapper with auth gate) | `src/features/documents/pages/DocumentArchiveRoute.tsx` | Not present. |
| **AC‑5** – DynamicFormRenderer (generic form engine, validation, UI components) | `src/features/forms/components/DynamicFormRenderer.tsx` | Not present. |
| **AC‑6** – FormSubmissionPage (route, fetch definition, submitForm mutation, navigation) | `src/features/forms/pages/FormSubmissionPage.tsx` | Not present. |
| **AC‑7** – Router updates (`/documents` gated to `org:admin|org:hr`; `/forms/:formDefinitionId` gated to all roles) | Router definition file (e.g. `src/routes.tsx` or similar) | No modifications shown. |
| **AC‑8** – Sidebar navigation item “Documents” visible only to admin/hr | `src/app/shell/Sidebar.tsx` (or equivalent) | No change adding the nav item. |
| **AC‑9** – Tests for the new components (DynamicFormRenderer, DocumentArchivePage actions, FormSubmissionPage) | New test files under `src/**/*.test.tsx` | No new tests added. |

**Consequences**

* The core functionality required for Session 8 is absent; the codebase builds and tests pass because the new features have not been implemented.
* Without the Document Archive UI and Dynamic Form renderer, the product cannot meet the described user flows (admin reviewing documents, candidates filling forms).
* Router and sidebar changes are also missing, so navigation to the new pages is impossible.
* No tests exist to verify the new behaviour, violating the “tests green” gate for the task.

**Requested Changes**

1. **Add Document Archive UI**
   * Create `src/features/documents/pages/DocumentArchivePage.tsx` implementing:
     * Filter bar with dropdowns for type & status, “Expiring soon” toggle, entity search input.
     * Table with columns **DOCUMENT / TYPE / LINKED TO / STATUS / EXPIRES / ACTIONS**.
     * StatusBadge component usage (pending_review, verified, rejected, expired) with correct colors.
     * “Verify” button → optimistic cache update via `updateDocumentArchiveItem`, toast on success/failure.
     * “Reject” button → opens a modal containing a textarea for rejectionReason; on submit calls `updateDocumentArchiveItem` with `status: 'rejected'` and reason.
     * Row click opens `DocumentDetailPanel`.
     * EmptyState component when the query returns no items.
   * Use `listDocumentArchive` query with filter parameters.

2. **Add DocumentDetailPanel**
   * Create `src/features/documents/components/DocumentDetailPanel.tsx`:
     * Slide‑in panel from the right.
     * Shows file name (download link if `url` present), document type, linked entity, status badge, expiry date, verifiedBy/verifiedAt (if verified), rejectionReason (if rejected).
     * “Verify” and “Reject” buttons (same behaviour as in the table) when status is not final.
     * Close button at top.

3. **Add DocumentArchiveRoute**
   * Create `src/features/documents/pages/DocumentArchiveRoute.tsx`:
     * Lazy‑load `DocumentArchivePage` via `React.lazy`.
     * Wrap with auth guard that allows only `org:admin` or `org:hr`. Use existing `TenantRouteGuard` or a new guard that checks `member.role`.

4. **Add DynamicFormRenderer**
   * Create `src/features/forms/components/DynamicFormRenderer.tsx`:
     * Props: `formDefinition`, `onSubmit`, `loading?`, `existingData?`.
     * Render fields in order, using shared UI components (`Input`, `Textarea`, `Select`, `Checkbox`, `Button`, `FieldGroup`).
     * Required fields show red asterisk; client‑side validation prevents submit and displays inline error messages.
     * Submit button shows loading state when `loading` is true.
     * No new dependencies.

5. **Add FormSubmissionPage**
   * Create `src/features/forms/pages/FormSubmissionPage.tsx`:
     * Route `/forms/:formDefinitionId`.
     * Guard for roles `org:candidate`, `org:caregiver`, `org:admin`, `org:hr`.
     * Fetch form definition via `listFormDefinitions` (or a `getFormDefinition` query) using the URL param.
     * Render `DynamicFormRenderer`; on valid submit call `submitForm` mutation.
     * On success: toast “Form submitted”, then navigate to `/onboarding` for candidates or `-1` (previous page) for other roles.

6. **Router Updates**
   * Add routes for `/documents` and `/forms/:formDefinitionId` with the appropriate role guards.
   * Ensure lazy loading and proper imports.

7. **Sidebar Update**
   * In `src/app/shell/Sidebar.tsx` (or equivalent) add a navigation item “Documents” that is rendered only when `member.role` is `org:admin` or `org:hr`.

8. **Tests**
   * **DynamicFormRenderer.test.tsx** – verify rendering of all field types, required‑field asterisk, validation errors, successful submit calls `onSubmit`.
   * **DocumentArchivePage.test.tsx** – render page with mock data, test filter UI, verify “Verify” triggers optimistic update and toast, test “Reject” opens modal and calls mutation with reason.
   * **FormSubmissionPage.test.tsx** – mock form definition fetch, submit, ensure toast and navigation.
   * Add any needed mock Convex/Clerk data for these tests.

9. **Security / Multi‑tenant Guard**
   * Ensure all Convex queries/mutations (`listDocumentArchive`, `updateDocumentArchiveItem`, `submitForm`) are called with `clerkOrgId` and that backend functions enforce tenant scoping via `requireTenantRole` (already present in other modules). Add similar guards if missing.

10. **Lint / Typecheck**
    * Run `npm run lint` and `npm run typecheck` after adding the files to confirm no new errors.

**Summary**

The current diff only modifies existing scheduling, HR, and dev mock files; it does **not** deliver the core Document Archive and Dynamic Form features required for Session 8. Implement the missing components, router updates, sidebar entry, and corresponding tests as outlined above before the change can be considered complete.

---

VERDICT: CHANGES_REQUESTED