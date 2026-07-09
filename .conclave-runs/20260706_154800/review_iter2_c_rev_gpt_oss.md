# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Missing Acceptance Criteria**

| AC | Expected artifact | Status in diff |
|----|-------------------|----------------|
| **AC‑1** | `src/features/documents/pages/DocumentArchivePage.tsx` – filter bar, table, actions, empty state, optimistic verify, reject modal, row click opens detail panel. | **Not present** – no new file added. |
| **AC‑2** | `src/features/documents/components/DocumentDetailPanel.tsx` – slide‑in panel with metadata, status buttons, close button. | **Not present** – no new file added. |
| **AC‑3** | `src/features/documents/pages/DocumentArchiveRoute.tsx` – lazy‑loaded wrapper for routing. | **Not present** – no new file added. |
| **AC‑4** | `src/features/forms/components/DynamicFormRenderer.tsx` – renders all field types, required asterisk, client‑side validation, loading state, uses only shared UI components. | **Not present** – no new file added. |
| **AC‑5** | `src/features/forms/pages/FormSubmissionPage.tsx` – fetches form definition, renders `DynamicFormRenderer`, calls `submitForm`, toast & navigation logic. | **Not present** – no new file added. |
| **AC‑6** | Router updates: `/documents` gated to `org:admin`/`org:hr`; `/forms/:formDefinitionId` gated to all valid roles. | **Router file unchanged** – no new routes or guards added. |
| **AC‑7** | Sidebar navigation: add “Documents” link visible only for admin/hr. | **Sidebar unchanged** – no new nav item. |
| **AC‑8** | Tests covering the new components (field rendering, validation, verify/reject actions, form submission, routing). | **No new tests** – existing test suite passes but does not cover the required features. |

**Other Observations**

1. **Unrelated Changes** – The diff introduces many modifications unrelated to the task (e.g., `convex/hrCases.ts`, `AppShell.tsx`, `CoverageRequestsPanel`, `ShiftEditorModal`). While these changes pass the current test suite, they do not address the requested feature set.

2. **Security / Multi‑tenant Guarding**  
   - No new Convex functions (`listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, `submitForm`) are referenced or guarded. The required auth‑helper usage is missing, which could allow cross‑tenant data leakage once the UI is added.  
   - The router currently does not enforce role checks for the new routes; this would be a security regression if added later without proper guards.

3. **Potential UI Inconsistencies**  
   - The new UI components must use the shared UI library (`Input`, `Textarea`, `Select`, `Checkbox`, `Button`, `FieldGroup`) and follow the 2‑space, single‑quote, no‑semicolon style. Since the components are absent, style compliance cannot be verified.

4. **Missing Optimistic Update Logic**  
   - AC‑1 requires optimistic UI updates on “Verify”. No implementation exists, so the optimistic pattern is absent.

5. **Missing Toast / Modal Implementations**  
   - The reject flow must open a modal with a textarea for the rejection reason. No modal component or state handling is present.

6. **Form Renderer Edge Cases**  
   - Required‑field validation, inline error display, and loading state on submit are all missing. Without tests, regression risk is high.

7. **Navigation & Post‑Submit Redirects**  
   - AC‑5 specifies role‑based navigation after successful form submission (candidate → `/onboarding`). No routing logic exists.

**Required Changes**

1. **Add the five new files** (`DocumentArchivePage.tsx`, `DocumentDetailPanel.tsx`, `DocumentArchiveRoute.tsx`, `DynamicFormRenderer.tsx`, `FormSubmissionPage.tsx`) implementing the UI and logic per the spec, using only the allowed shared UI components and adhering to the formatting rules.

2. **Update routing** (likely `src/routes.tsx` or equivalent) to include:
   - `<Route path="/documents" element={<DocumentArchiveRoute />} />` with a guard that checks `member.role` includes `org:admin` or `org:hr`.
   - `<Route path="/forms/:formDefinitionId" element={<FormSubmissionPage />} />` with a guard allowing all defined roles.

3. **Update `src/app/shell/Sidebar.tsx`** to render a “Documents” navigation item conditionally on `member.role` being admin or hr.

4. **Ensure Convex backend functions** (`listDocumentArchive`, `updateDocumentArchiveItem`, `listFormDefinitions`, `submitForm`) exist, are exported, and use `requireTenantRole` (or similar) to enforce multi‑tenant access. If they already exist, import them in the UI; otherwise add them.

5. **Write unit tests**:
   - `DynamicFormRenderer.test.tsx` covering rendering of each field type, required asterisk, validation errors, successful submit callback.
   - `DocumentArchivePage.test.tsx` covering filter state, table rendering, verify action (optimistic update + toast), reject modal flow, opening detail panel.
   - `FormSubmissionPage.test.tsx` covering fetching of form definition, rendering of `DynamicFormRenderer`, submit handling, toast and navigation.

6. **Write integration/E2E tests** (Playwright) for the document archive verify/reject flows and form submission redirects.

7. **Add any necessary UI utilities** (e.g., a `StatusBadge` component for document status if not already present) and ensure they are used consistently.

8. **Run lint, typecheck, and all tests** to confirm no regressions.

Only after these concrete items are added and verified should the PR be considered for approval.

---

**Verdict:** CHANGES_REQUESTED