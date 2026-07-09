# Implementation Plan: Session 8 — Document Archive & Dynamic Form Renderer

## 1. Restated Goal & Acceptance Criteria
**Goal:** Implement a secure, multi-tenant Document Archive browser for admin/hr roles and a generic Dynamic Form Renderer for candidate/caregiver onboarding, adhering strictly to Figma specs and ATRIA-X architectural standards (Convex guards, React 19, Tailwind 4).

**Acceptance Criteria:**
- **AC-1:** `DocumentArchivePage` renders at `/documents` with filter bar (Type, Status, Expiring Soon, Search) and data table matching Figma columns/spacing.
- **AC-2:** Archive actions work: 'Verify' triggers optimistic update + toast; 'Reject' opens modal for reason before calling `updateDocumentArchiveItem`.
- **AC-3:** `DocumentDetailPanel` slides in on row click, displays metadata (verifiedBy, expiry, etc.), and allows status changes if not final.
- **AC-4:** `DynamicFormRenderer` renders all 6 field types (text, textarea, select, checkbox, date, number) with required asterisks and client-side validation (inline errors).
- **AC-5:** `FormSubmissionPage` at `/forms/:id` fetches definition, renders form, calls `submitForm`, and redirects based on role (candidate -> `/onboarding`).
- **AC-6:** Router gates enforced: `/documents` (admin/hr only), `/forms/:id` (all valid roles). Sidebar updated for admin/hr.
- **AC-7:** All tests pass (Vitest unit, Playwright E2E), lint/typecheck clean, build succeeds on branch `feature/phase-2-worker-onboarding`.

## 2. Discovery Notes
**Limitation:** I am a chat-only backend. I **cannot** open local files (`C:\Users\pinol\...`) or inspect the repo directly. I am reasoning from the task description and standard ATRIA-X patterns provided in the context.

**Assumptions & Contracts to Verify:**
- **Convex Functions:** Verify existence and signatures of:
  - `listDocumentArchive` (params: filters, returns: array of doc items)
  - `updateDocumentArchiveItem` (params: id, status, rejectionReason?)
  - `listFormDefinitions` (params: id lookup)
  - `submitForm` (params: formDefinitionId, data)
- **Auth Helpers:** Confirm `authHelpers` exports from `convex/authHelpers` for role guards.
- **UI Components:** Confirm existence of `src/shared/ui/{Input, Textarea, Select, Checkbox, Button, FieldGroup}`.
- **Figma Specs:** Implementer **MUST** open `C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260706_154646\figma-docs-spec.md` for exact pixel values (padding, font sizes, colors).
- **Router:** Confirm React Router 7 lazy loading pattern used in `src/main.tsx` or `src/routes.tsx`.

## 3. Alternatives Considered
- **Form Validation:**
  - *Alternative:* Use `react-hook-form` + `zod`.
  - *Decision:* Task specifies "validate all required fields client-side (non-empty check)" and "No new deps". Use manual state validation to keep bundle size low and adhere to constraints.
- **Document Detail View:**
  - *Alternative:* Separate route `/documents/:id`.
  - *Decision:* Task specifies `DocumentDetailPanel` (slide-in). Keeps context of list view, faster interaction for admins processing queues.
- **Optimistic Updates:**
  - *Alternative:* Wait for server response before UI change.
  - *Decision:* Task requires optimistic update on Verify for perceived performance. Must handle rollback on error.

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/features/documents/pages/DocumentArchivePage.tsx` | Create | Main table, filter state, Convex query integration, action handlers. |
| `src/features/documents/components/DocumentDetailPanel.tsx` | Create | Slide-over panel, detail display, reject modal logic, status update mutations. |
| `src/features/documents/pages/DocumentArchiveRoute.tsx` | Create | Lazy wrapper exporting component for router. |
| `src/features/forms/components/DynamicFormRenderer.tsx` | Create | Generic field mapper, validation logic, submit handling. |
| `src/features/forms/pages/FormSubmissionPage.tsx` | Create | Fetches form def by ID, wraps renderer, handles success redirect. |
| `src/routes.tsx` (or equivalent) | Modify | Add `/documents` (gated) and `/forms/:formDefinitionId` routes. |
| `src/components/layout/Sidebar.tsx` | Modify | Add 'Documents' link visible only to admin/hr roles. |
| `convex/documents.ts` | Verify | Ensure `listDocumentArchive`, `updateDocumentArchiveItem` exist + auth guards. |
| `convex/forms.ts` | Verify | Ensure `listFormDefinitions`, `submitForm` exist + auth guards. |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases
- **Multi-Tenancy:** All Convex queries/mutations must implicitly scope data to `auth.userId`'s organization. Verify `authHelpers` are used in Convex functions to prevent cross-org data leakage.
- **Role Gates:** Frontend routing must check Clerk roles (`org:admin`, `org:hr`) before rendering `/documents`. Backend must re-verify roles (never trust client).
- **PHI/PII:** Document URLs must be signed/temporary if stored externally. Do not expose raw S3 URLs in frontend unless signed.
- **Optimistic Rollback:** If `updateDocumentArchiveItem` fails after optimistic UI update, revert state and show error toast.
- **Form Race Conditions:** Disable submit button while `loading=true` to prevent double submission.
- **Expired Sessions:** Handle Convex auth expiration gracefully (redirect to login).

## 6. Test Strategy
**Unit Tests (Vitest):**
- `DynamicFormRenderer.test.tsx`:
  - Renders all 6 field types correctly.
  - Shows red asterisk on required fields.
  - Submit blocked + inline errors shown when required fields empty.
  - Submit calls `onSubmit` when valid.
- `DocumentArchivePage.test.tsx`:
  - Filter state updates table query params.
  - Verify button calls mutation with `status: 'verified'`.

**E2E Tests (Playwright):**
- `documents-archive.spec.ts`:
  - Admin logs in -> visits `/documents` -> sees table.
  - Filter by 'Pending' -> table updates.
  - Click row -> Panel slides in.
  - Click Verify -> Toast appears, status updates green.
  - Click Reject -> Modal opens -> Enter reason -> Submit -> Status updates red.
- `form-submission.spec.ts`:
  - Candidate logs in -> visits `/forms/:id` -> fills form -> submits -> redirects to `/onboarding`.

**Gate Commands:**
```bash
git checkout feature/phase-2-worker-onboarding
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## 7. Rollback / Verification Notes
- **Rollback:** If issues arise, revert commit on `feature/phase-2-worker-onboarding` via `git revert HEAD`. Do not force push.
- **Verification:**
  - Confirm `npx convex codegen` ran after any backend verification/changes.
  - Verify Sidebar 'Documents' link does **not** appear for `org:caregiver` or `org:candidate`.
  - Check Network tab: Ensure Convex calls include auth tokens and no 403 errors occur for authorized roles.
  - Visual Regression: Compare rendered pages against Figma PNGs in `.hermes-pipeline/.../figma/` folder.
- **Post-Merge:** Monitor Convex function logs for any auth guard failures during initial user traffic.