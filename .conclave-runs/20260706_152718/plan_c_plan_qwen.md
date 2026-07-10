# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# SESSION 8: Document Archive & Dynamic Form Renderer — Implementation Plan

## 1. Restated Goal & Acceptance Criteria

**Goal:** Implement a secure, multi-tenant Document Archive browser for admin/hr roles and a generic Dynamic Form Renderer for candidates/caregivers, ensuring pixel-faithful adherence to Figma specs and strict Convex auth guards.

**Acceptance Criteria:**
- **AC-1 (Archive Page):** `DocumentArchivePage` renders at `/documents` with filter bar (type, status, expiring soon, search) and data table matching Figma columns (DOCUMENT, TYPE, LINKED TO, STATUS, EXPIRES, ACTIONS).
- **AC-2 (Archive Actions):** 'Verify' triggers optimistic update + toast. 'Reject' opens modal for reason, then calls `updateDocumentArchiveItem` with status='rejected' + reason.
- **AC-3 (Detail Panel):** `DocumentDetailPanel` slides in from right on row click, shows metadata (verifiedBy, expiry, rejectionReason), and allows status changes if not final.
- **AC-4 (Dynamic Form):** `DynamicFormRenderer` accepts `formDefinition` prop, renders all 6 field types (text, textarea, select, checkbox, date, number) using `src/shared/ui` components only.
- **AC-5 (Form Validation):** Required fields show red asterisk. Client-side validation prevents submit if empty, showing inline errors. Successful submit calls `onSubmit` + shows toast.
- **AC-6 (Routing & Auth):** `/documents` gated to `org:admin` | `org:hr`. `/forms/:id` accessible to all valid roles. Sidebar updated with 'Documents' link for admin/hr.
- **AC-7 (Quality):** Lint, typecheck, vitest, and build pass on branch `feature/phase-2-worker-onboarding`. No new dependencies added.

## 2. Discovery Notes

**Limitation Statement:** I am a chat-only model within the Conclave orchestration system. I **cannot** directly inspect the local filesystem (e.g., `src/shared/ui`, `convex/` functions, or Figma PNGs). I am reasoning from the task description and standard ATRIA-X architecture patterns provided in the context.

**Inferred Contracts (to be verified by implementer):**
- **Convex Queries:** `listDocumentArchive` (expects filters: `type`, `status`, `expiringSoon`, `search`), `listFormDefinitions` (expects `id`).
- **Convex Mutations:** `updateDocumentArchiveItem` (expects `id`, `status`, `rejectionReason?`), `submitForm` (expects `formDefinitionId`, `data`).
- **UI Components:** `src/shared/ui/{Input, Textarea, Select, Checkbox, Button, FieldGroup}` exist and accept standard props (`label`, `error`, `value`, `onChange`).
- **Auth Helpers:** `authHelpers` in Convex enforce multi-tenancy. Clerk `useAuth` + `authorize` wrappers used in frontend routes.
- **Figma Spec:** Source of truth is `.conclave-runs/20260706_152625/figma-docs-spec.md` and associated PNGs. Implementer must compare rendered output against these files.

## 3. Alternatives Considered

| Approach | Chosen? | Rationale |
| :--- | :--- | :--- |
| **Detail Page vs. Slide-in Panel** | **Slide-in Panel** | Preserves context on Archive page. Faster workflow for admins reviewing multiple docs without losing filter state. Matches Figma "DocumentDetailPanel" requirement. |
| **Server-side vs. Client-side Validation** | **Hybrid** | Client-side for immediate UX (required fields). Server-side (Convex) for security/PHI rules. Task explicitly requests client-side validation before `onSubmit`. |
| **Modal vs. Inline for Rejection** | **Modal** | Prevents accidental rejection. Forces deliberate input of `rejectionReason`. Matches task requirement "opens small modal". |
| **Generic Form vs. Hardcoded Forms** | **Generic Renderer** | Scalable for future onboarding forms. Decouples form schema (Convex) from UI logic. |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/features/documents/pages/DocumentArchivePage.tsx` | Create | Main archive view, filter state, table, optimistic updates, toast integration. |
| `src/features/documents/components/DocumentDetailPanel.tsx` | Create | Slide-in panel component, detail display, status action buttons, rejection modal logic. |
| `src/features/documents/pages/DocumentArchiveRoute.tsx` | Create | Lazy-loaded wrapper with auth gate (`org:admin` | `org:hr`). |
| `src/features/forms/components/DynamicFormRenderer.tsx` | Create | Generic form engine, field mapping, validation logic, error state management. |
| `src/features/forms/pages/FormSubmissionPage.tsx` | Create | Fetches form def, wraps renderer, handles `submitForm` mutation + navigation. |
| `src/routes.tsx` (or equivalent) | Modify | Add `/documents` and `/forms/:formDefinitionId` routes with guards. |
| `src/components/layout/Sidebar.tsx` (or equivalent) | Modify | Add 'Documents' nav item visible only to admin/hr roles. |
| `convex/documents.ts` (Verify Existence) | Check | Ensure `listDocumentArchive`, `updateDocumentArchiveItem` exist and match inferred types. |
| `convex/forms.ts` (Verify Existence) | Check | Ensure `listFormDefinitions`, `submitForm` exist and match inferred types. |

## 5. Data/Auth/Security/Edge Cases

- **Multi-tenancy:** All Convex queries (`listDocumentArchive`, `listFormDefinitions`) MUST use `authHelpers.getTenantId(ctx)` to scope data. Frontend relies on Clerk org selection; backend enforces it.
- **PHI/PII Security:** Document URLs (if any) must be signed/temporary. Do not expose raw S3 paths. `DocumentDetailPanel` should only show download link if `url` exists and is valid.
- **Role Gates:**
  - `/documents`: Strict gate. If user is `org:caregiver` or `org:candidate`, redirect to 403 or home.
  - `/forms`: Open to all org roles, but `submitForm` mutation must validate the user is associated with the target entity (e.g., candidate submitting their own form).
- **Optimistic Updates:** When verifying, update local cache immediately. If mutation fails, revert + show error toast. Handle race conditions if two admins edit same doc.
- **Expiring Soon Logic:** 'Expiring soon' toggle filters items where `expiryDate` is within `Date.now() + 30 days`. Ensure timezone handling matches Convex (UTC) vs Frontend (Local).
- **Form Idempotency:** `submitForm` should ideally prevent duplicate submissions for the same `formDefinitionId` + `userId` combo if business logic requires (check Convex schema).

## 6. Test Strategy

**Unit Tests (Vitest):**
- `DynamicFormRenderer.test.tsx`:
  - Renders all 6 field types correctly.
  - Shows red asterisk on required fields.
  - Blocks submit + shows inline error when required field empty.
  - Calls `onSubmit` with correct data structure when valid.
- `DocumentDetailPanel.test.tsx`:
  - Renders rejection reason only when status='rejected'.
  - Verify/Reject buttons hidden when status is final (verified/rejected/expired).

**Integration/E2E (Playwright):**
- `documents-archive.spec.ts`:
  - Admin logs in -> navigates to `/documents`.
  - Filters by status 'Pending'.
  - Clicks 'Verify' -> Toast appears -> Status updates to 'Verified'.
  - Clicks 'Reject' -> Modal opens -> Enter reason -> Submit -> Status updates.
  - Non-admin user attempts `/documents` -> Redirected.
- `form-submission.spec.ts`:
  - Candidate navigates to `/forms/:id`.
  - Fills form -> Submit -> Toast 'Form submitted' -> Redirects to `/onboarding`.

**Gate Commands:**
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7. Rollback / Verification Notes

- **Rollback:** `git revert` on branch `feature/phase-2-worker-onboarding`. Since no schema changes are described (assuming Convex functions exist), rollback is code-only. If Convex functions were modified, ensure `npx convex deploy` is reverted or compatible.
- **Verification:**
  - Confirm `npx convex codegen` runs successfully after any Convex changes.
  - Visually compare `DocumentArchivePage` and `DynamicFormRenderer` against `.conclave-runs/20260706_152625/figma/` PNGs.
  - Verify Clerk middleware protects routes server-side (not just UI hiding).
  - Check browser console for no CORS or 403 errors on Convex calls.