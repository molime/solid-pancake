# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Atria-X Session 4 (Forms & Document Archive)

## 1. Goal and Acceptance Criteria
**Goal:** Implement backend logic for form management and document archival within the Convex backend, enforcing strict multi-tenancy and role-based access control (RBAC) via `authHelpers`.

**Acceptance Criteria:**
- Create `convex/forms.ts` with 6 functions (create, update, deactivate, list definitions, submit, list submissions, get submission).
- Create `convex/documentArchive.ts` with 2 functions (list, update status).
- All functions must use `convex/authHelpers.ts` for tenant/role guards.
- Reuse `convex/files.ts` for file metadata; no direct ADP calls.
- `submitForm` must validate required fields and complete pending `candidateTasks` if applicable.
- `updateDocumentArchiveItem` must log `auditEvent` on status change.
- Code style: 2-space indent, single quotes, no semicolons.
- Gates: `npm run lint`, `npm run typecheck`, `npm run test` must pass.
- Run `npx convex codegen` after schema/logic changes.

## 2. Discovery Notes
**Limitation:** I cannot inspect the local repository files (`convex/*.ts`, `schema.ts`, etc.) directly. I am reasoning from the provided task context and standard Convex patterns.

**Assumptions & Inferred Contracts:**
- **Schema:** Tables `formDefinitions`, `formSubmissions`, and `documentArchive` exist or need to be added to `convex/schema.ts`.
- **Auth Helpers:** `authHelpers.ts` exports:
  - `requireTenantRole(ctx, roles[])`: Throws if user lacks role.
  - `assertTenantDoc(ctx, table, id)`: Returns doc if owned by tenant, throws otherwise.
  - `getUserId(ctx)`: Returns current user ID.
- **Files:** `files.ts` exports `getFileMetadata(ctx, fileId)` for joining file info in archive lists.
- **Tasks:** `tasks.ts` (or similar) exports `completeCandidateTask(ctx, taskId)` for form submission completion.
- **Audit:** `audit.ts` exports `logEvent(ctx, event)` for document status changes.
- **Validation:** Form fields are stored as JSON in `formDefinitions.fields`. Validation logic must parse this schema against submitted `data`.

## 3. Alternatives Considered
- **Inline Auth vs. Helper Functions:**
  - *Alternative:* Write tenant checks inline in every function.
  - *Decision:* Use `authHelpers` as mandated. Centralizes security logic, reduces drift, and ensures consistent multi-tenancy enforcement.
- **Generic "Documents" Table vs. Specific "DocumentArchive":**
  - *Alternative:* Use a single `documents` table for all file types.
  - *Decision:* Use `documentArchive` specifically for compliance/HR documents. Allows specific status flows (verified/rejected) and expiration tracking without bloating generic file metadata.
- **JSON Validation vs. JSON Schema Library:**
  - *Alternative:* Import `ajv` for robust validation.
  - *Decision:* Use lightweight custom validation for required fields to minimize dependency bloat and cost (Diego's constraint), unless complex schema enforcement is required later. For now, check `field.required` flags.

## 4. Files to Create/Edit

### `convex/schema.ts` (Verification/Update)
- **Action:** Verify tables exist. If not, add:
  - `formDefinitions`: `{ name, description, fields, active, tenantId }`
  - `formSubmissions`: `{ formDefinitionId, submittedBy, data, submittedAt, tenantId }`
  - `documentArchive`: `{ fileId, linkedTo, status, expiresAt, verifiedBy, rejectionReason, tenantId }`
- **Constraint:** Never edit `convex/_generated`. Run `npx convex codegen` after changes.

### `convex/forms.ts` (New)
- **`createFormDefinition`**:
  - Guard: `requireTenantRole(['org:admin', 'org:hr'])`.
  - Insert into `formDefinitions` with `active: true`.
- **`updateFormDefinition`**:
  - Guard: `requireTenantRole(['org:admin'])`.
  - Check: `assertTenantDoc`.
  - Gate: Query `formSubmissions` for this ID. If count > 0, throw `Error('Cannot update form with submissions')`.
  - Update fields.
- **`deactivateFormDefinition`**:
  - Guard: `requireTenantRole(['org:admin'])`.
  - Check: `assertTenantDoc`.
  - Update `active: false`.
- **`listFormDefinitions`**:
  - Guard: `requireTenantRole(['org:admin', 'org:hr', 'org:caregiver', 'org:candidate'])`.
  - Filter: If `includeInactive` false or user is caregiver/candidate, filter `active: true`.
- **`submitForm`**:
  - Guard: `requireTenantRole(['org:candidate', 'org:caregiver'])`.
  - Check: `assertTenantDoc` on `formDefinitionId`. Verify `active: true`.
  - Validate: Iterate `formDefinition.fields`. If `required: true` and missing in `data`, throw.
  - Insert: `formSubmissions`.
  - Side Effect: Query `candidateTasks` for pending task linked to this form. If found, call `tasks.completeTask`.
- **`listFormSubmissions`**:
  - Guard: `requireTenantRole(['org:admin', 'org:hr'])`.
  - Param: Require `formDefinitionId` OR `submittedBy`.
  - Join: Map `formDefinitionId` to `name` via internal lookup.
- **`getFormSubmission`**:
  - Guard: Any role.
  - Check: `assertTenantDoc`.
  - Gate: If role is `caregiver` or `candidate`, ensure `submittedBy === userId`.

### `convex/documentArchive.ts` (New)
- **`listDocumentArchive`**:
  - Guard: `requireTenantRole(['org:admin', 'org:hr'])`.
  - Filters: `linkedTo`, `status`, `documentType` (via file metadata join).
  - Expiry: If `expiringSoonDays` provided, filter `expiresAt <= now + days`.
  - Sort: `createdAt` desc. Limit: 100.
  - Join: Call `files.getFileMetadata` for each item to enrich response.
- **`updateDocumentArchiveItem`**:
  - Guard: `requireTenantRole(['org:admin', 'org:hr'])`.
  - Check: `assertTenantDoc`.
  - Update: `status`, `verifiedBy/At` (if verified), `rejectionReason` (if rejected).
  - Audit: Call `audit.logEvent({ type: 'document.status_updated', itemId, newStatus })`.

### `convex/forms.test.ts` & `convex/documentArchive.test.ts` (New)
- **Action:** Create Vitest suites mirroring the task test requirements.

## 5. Data/Auth/Security Edge Cases
- **Multi-Tenancy:** Every query/mutation must pass `tenantId` implicitly via `authHelpers`. Never trust client-supplied `tenantId`.
- **PHI Data:** Form data may contain Protected Health Information. Ensure no logging of `data` payload in audit trails. Convex encrypts at rest, but access control is critical.
- **Role Escalation:** `updateFormDefinition` is admin-only. Ensure `requireTenantRole` checks exact match, not subset.
- **Inactive Forms:** `submitForm` must reject if `active: false`. Prevents submitting to deprecated forms.
- **Immutable Submissions:** Once submitted, `formSubmissions` should not be editable via these functions (no update function provided).
- **Document Ownership:** `getFormSubmission` allows any role but restricts data visibility for non-admins to own records only.
- **File Integrity:** `documentArchive` links to `files`. If a file is deleted in `files.ts`, archive item should ideally handle gracefully (or prevent deletion). For this session, assume file lifecycle is separate but metadata join must handle missing files.
- **Idempotency:** `submitForm` is not idempotent by default. If double-clicked, two submissions occur. Acceptable for now, but note for future deduplication.

## 6. Test Strategy
**Unit/Integration (Vitest + Convex Test Helpers):**
- **`forms.test.ts`**:
  - `createFormDefinition`: Asserts tenant ID is set correctly.
  - `updateFormDefinition`: Fails if submissions exist (seed DB with submission).
  - `submitForm`: Fails on missing required field (mock definition with `required: true`).
  - `submitForm`: Rejects inactive form definition.
  - `listFormSubmissions`: Fails for `org:caregiver` role.
  - `getFormSubmission`: Returns data for owner, throws for other caregiver.
- **`documentArchive.test.ts`**:
  - `listDocumentArchive`: Verifies `expiringSoonDays` filter logic (seed items with specific `expiresAt`).
  - `updateDocumentArchiveItem`: Fails for `org:caregiver`.
  - `updateDocumentArchiveItem`: Verifies audit event logged (mock audit module).
- **Cross-Tenant Security**:
  - Seed two tenants. User A tries to access User B's form definition. Assert throw.

**Gates:**
- `npm run lint`: Enforce single quotes, no semis, 2-space.
- `npm run typecheck`: Ensure Convex types match schema.
- `npm run test`: All vitest suites pass.

## 7. Rollback and Verification
- **Rollback:**
  - Git revert the commit containing `forms.ts`, `documentArchive.ts`, and `schema.ts` changes.
  - Run `npx convex deploy` to revert backend state (Convex supports schema evolution, but removing tables requires care). If tables were added, data loss may occur on revert; coordinate with DB admin if production.
- **Verification:**
  - Post-deploy: Run a smoke test script against staging environment.
  - Check Convex Dashboard: Verify functions appear and error rates are 0.
  - Check Logs: Ensure no `assertTenantDoc` failures for legitimate users.

## 8. Execution Steps
1.  Verify `convex/schema.ts` has required tables. Add if missing.
2.  Implement `convex/authHelpers.ts` guards if not fully present (verify `requireTenantRole` supports multiple roles).
3.  Write `convex/forms.ts` functions 1-7.
4.  Write `convex/documentArchive.ts` functions 8-9.
5.  Write tests in `convex/*.test.ts`.
6.  Run `npx convex codegen`.
7.  Run `npm run lint && npm run typecheck && npm run test`.
8.  Commit changes with message `feat: forms and document archive backend`.