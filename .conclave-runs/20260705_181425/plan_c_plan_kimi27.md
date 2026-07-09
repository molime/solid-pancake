# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# Implementation Plan: Forms & Document Archive Backend

## 1. Restated Goal & Acceptance Criteria

Build two new Convex backend modules—`convex/forms.ts` and `convex/documentArchive.ts`—that provide a fully multi-tenant forms engine and a document archive for ATRIA-X. All functions must route authorization through `convex/authHelpers.ts`, reuse `convex/files.ts` for file metadata/storage, and make no ADP calls.

**Acceptance criteria**

- `convex/forms.ts` exposes:
  - `createFormDefinition` (admin/HR only)
  - `updateFormDefinition` (admin only, blocks edits if submissions exist)
  - `deactivateFormDefinition` (admin only)
  - `listFormDefinitions` (any tenant role; caregivers/candidates active-only; admin/HR optional `includeInactive`)
  - `submitForm` (candidate/caregiver only, validates required fields, completes pending `candidateTasks` of type `form_submission`)
  - `listFormSubmissions` (admin/HR only, requires `formDefinitionId` or `submittedBy`, joins form definition name)
  - `getFormSubmission` (any tenant role; caregivers/candidates own-only)

- `convex/documentArchive.ts` exposes:
  - `listDocumentArchive` (admin/HR only, filters by `linkedTo`, `status`, `documentType`, `expiringSoonDays`, joins file metadata, orders by `createdAt` desc, max 100)
  - `updateDocumentArchiveItem` (admin/HR only, sets status, `verifiedBy/verifiedAt` or `rejectionReason`, emits `document.status_updated` audit event)

- Schema additions for `formDefinitions`, `formSubmissions`, `documentArchive`, and `auditEvents` (plus any needed `candidateTasks` indexes) are created and `npx convex codegen` is run.
- Tests cover: missing required fields, cross-tenant form access, inactive form rejection, `listFormSubmissions` role guard, `getFormSubmission` own-only guard, `updateDocumentArchiveItem` caregiver block, and `expiringSoonDays` filtering.
- Gates pass: `npm run lint`, typecheck, tests, and `npx convex codegen`.

---

## 2. Discovery Notes

**Repo inspection is unavailable in this chat-only environment.** I am reasoning from the supplied context and shared memory. Before writing code, the implementer must open and verify:

- `convex/authHelpers.ts` — confirm exports such as `requireTenantRole`, `assertTenantDoc`, `requireTenantMembership`, and the shape of the returned auth context (`userId`, `orgId`, `tenantId`, `role`).
- `convex/schema.ts` — confirm schema DSL, existing tables, tenant-id conventions, and how indexes are declared.
- `convex/files.ts` — confirm exported helpers for fetching file metadata by `_id` and whether files are already tenant-scoped.
- `convex/tasks.ts` or `convex/candidateTasks.ts` — confirm the table name and fields for pending tasks, especially `type`, `relatedEntityId`, `userId`/`assigneeId`, and `status`.
- Existing test layout — whether Convex tests live under `convex/__tests__`, `src/__tests__`, or use `convex-test` with Vitest.
- `package.json` scripts — exact names for lint, typecheck, and test.

**Verified from context:**
- Stack: React 19 + Vite 8 + TypeScript, Tailwind 4, React Router 7, Clerk auth/orgs, Convex backend.
- Multi-tenancy is enforced via `authHelpers` guards; every tenant-data function must use them.
- Roles include at least `org:admin`, `org:coordinator`, `org:caregiver`; the task additionally references `org:hr` and `org:candidate`.
- Style: 2-space indent, single quotes, no semicolons.
- `convex/_generated` is never edited by hand; run `npx convex codegen` after schema changes.

---

## 3. Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Embed file metadata directly into `documentArchive` rows to avoid joins. | Violates “reuse `convex/files.ts`” and duplicates source of truth; file metadata can change. |
| Store audit events inline on the `documentArchive` document as an array. | Audit trails should be append-only and separately queryable; a dedicated `auditEvents` table is safer. |
| Hard-delete form definitions instead of deactivating. | Submissions would lose referential integrity; deactivation preserves history. |
| Allow `org:coordinator` to list all submissions. | Task restricts submission listing to admin/HR; coordinator is not listed, so keep coordinator at the same level as caregivers for submission visibility unless product says otherwise. |
| Use a single generic `tasks` table without a `type` field. | The task explicitly references `candidateTasks` of type `form_submission`; we must target that seam. |

**Chosen approach:** additive schema changes, tenant-first guards via `authHelpers`, join file metadata at read time, dedicated audit table, and surgical edits scoped only to the new modules and schema.

---

## 4. Exact Files to Create/Edit

### 4.1 Schema additions — `convex/schema.ts` (edit)

Add tables and indexes. Use the project’s existing schema DSL. Example shapes to declare:

- `formDefinitions`
  - `tenantId`
  - `name`
  - `description` (optional)
  - `fields`: array of `{ id, label, type, required, options? }`
  - `active`: boolean, default `true`
  - `createdBy`, `createdAt`, `updatedAt`
  - Indexes: `by_tenant`, `by_tenant_active`

- `formSubmissions`
  - `tenantId`
  - `formDefinitionId`
  - `submittedBy` (user id)
  - `data` (JSON object)
  - `submittedAt`
  - Indexes: `by_tenant`, `by_tenant_formDefinitionId`, `by_tenant_submittedBy`

- `documentArchive`
  - `tenantId`
  - `fileId` (reference to `files`)
  - `linkedTo` (e.g., `{ entityType, entityId }` or a string; match existing convention)
  - `documentType`
  - `status`: e.g., `pending`, `verified`, `rejected`
  - `expiresAt` (optional)
  - `rejectionReason` (optional)
  - `verifiedBy`, `verifiedAt` (optional)
  - `createdBy`, `createdAt`, `updatedAt`
  - Indexes: `by_tenant_createdAt` (for list order), `by_tenant_status`, `by_tenant_expiresAt`, `by_tenant_linkedTo`

- `auditEvents`
  - `tenantId`
  - `entityType`, `entityId`
  - `eventType`
  - `actorId`
  - `timestamp`
  - `payload` (JSON)

Also add or verify a `candidateTasks` index such as `by_tenant_user_type_related_status` to efficiently find pending `form_submission` tasks.

### 4.2 `convex/forms.ts` (create)

Export Convex queries/mutations with these exact behaviors:

- `createFormDefinition({ name, description?, fields })`
  - `requireTenantRole(ctx, ['org:admin', 'org:hr'])`
  - Validate `name` non-empty and `fields` is a non-empty array with valid shape.
  - Insert into `formDefinitions` with `active: true`, `tenantId`, `createdBy`, `createdAt`, `updatedAt`.

- `updateFormDefinition({ formDefinitionId, name?, description?, fields? })`
  - `requireTenantRole(ctx, ['org:admin'])`
  - `assertTenantDoc(ctx, 'formDefinitions', formDefinitionId)`
  - Throw if any `formSubmissions` exist for this `formDefinitionId` in the tenant.
  - Patch only provided fields; set `updatedAt`.

- `deactivateFormDefinition({ formDefinitionId })`
  - `requireTenantRole(ctx, ['org:admin'])`
  - `assertTenantDoc(ctx, 'formDefinitions', formDefinitionId)`
  - Patch `active: false`, `updatedAt`.

- `listFormDefinitions({ includeInactive? })`
  - Any tenant role (`requireTenantRole` with all roles, or a tenant-membership guard).
  - Admin/HR: if `includeInactive === true`, return all definitions in tenant; otherwise return `active: true` only.
  - All other roles (caregiver, candidate, coordinator): return `active: true` only, ignoring `includeInactive`.
  - Order by `createdAt` desc or `name` asc; pick a stable order and document it.

- `submitForm({ formDefinitionId, data })`
  - `requireTenantRole(ctx, ['org:candidate', 'org:caregiver'])`
  - `assertTenantDoc(ctx, 'formDefinitions', formDefinitionId)`
  - Throw if the form definition is not `active`.
  - Validate required fields: for every field with `required: true`, ensure `data[field.id]` is present and non-empty (string) / non-null.
  - Insert `formSubmission` with `tenantId`, `formDefinitionId`, `submittedBy`, `data`, `submittedAt`.
  - Query pending `candidateTasks` for current user where `type === 'form_submission'` and `relatedEntityId === formDefinitionId`; patch each to `status: 'completed'` with `completedAt`.

- `listFormSubmissions({ formDefinitionId?, submittedBy? })`
  - `requireTenantRole(ctx, ['org:admin', 'org:hr'])`
  - Throw if neither `formDefinitionId` nor `submittedBy` is provided.
  - If `formDefinitionId` is provided, `assertTenantDoc` on it.
  - Query `formSubmissions` filtered by tenant and the provided parameter(s).
  - Join `formDefinitions.name` for each submission (fetch by `formDefinitionId`).
  - Order by `submittedAt` desc; cap at a reasonable limit (e.g., 100) or paginate later.

- `getFormSubmission({ submissionId })`
  - Any tenant role.
  - `assertTenantDoc(ctx, 'formSubmissions', submissionId)`.
  - If current role is `org:candidate` or `org:caregiver`, throw if `submittedBy !== currentUserId`.
  - Return submission plus joined form definition name.

### 4.3 `convex/documentArchive.ts` (create)

- `listDocumentArchive({ linkedTo?, status?, documentType?, expiringSoonDays? })`
  - `requireTenantRole(ctx, ['org:admin', 'org:hr'])`
  - Query `documentArchive` by tenant.
  - Apply filters in memory:
    - `linkedTo` exact match if provided.
    - `status` exact match if provided.
    - `documentType` exact match if provided.
    - `expiringSoonDays`: include only items where `expiresAt` is defined and `expiresAt <= now + N days`.
  - Order by `createdAt` desc.
  - Take max 100.
  - Join file metadata via `convex/files.ts` helper for each `fileId`; include file fields such as `name`, `contentType`, `size`, `storageId` (or URL) in the returned payload.

- `updateDocumentArchiveItem({ itemId, status, rejectionReason? })`
  - `requireTenantRole(ctx, ['org:admin', 'org:hr'])`
  - `assertTenantDoc(ctx, 'documentArchive', itemId)`
  - Validate `status` is one of the allowed enum values.
  - If `status === 'verified'`, set `verifiedBy = currentUserId`, `verifiedAt = now`; clear `rejectionReason`.
  - If `status === 'rejected'`, require `rejectionReason` and set it; clear `verifiedBy`/`verifiedAt`.
  - If `status === 'pending'`, clear both `verifiedBy/verifiedAt` and `rejectionReason`.
  - Patch `status`, `updatedAt`, and the conditional fields.
  - Insert `auditEvents` row with `entityType: 'document_archive'`, `entityId: itemId`, `eventType: 'document.status_updated'`, `actorId`, `timestamp`, and payload containing new status and previous status.

### 4.4 `convex/files.ts` (edit only if necessary)

If `files.ts` does not already export a tenant-aware `getFileMetadata(ctx, fileId)` helper, add a minimal one that:
- Fetches the file document by `_id`.
- Asserts the file belongs to the current tenant (or matches the tenant of the calling archive item).
- Returns the metadata fields needed by `listDocumentArchive`.

Keep the change tiny and consistent with existing file helpers.

### 4.5 Tests (create)

Add focused tests in the project’s existing test directory:

- `convex/forms.test.ts` (or equivalent)
- `convex/documentArchive.test.ts` (or equivalent)

See section 6 for the exact test cases.

---

## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

| Concern | Mitigation |
|---|---|
| **Multi-tenancy** | Every read/write uses `assertTenantDoc` or `requireTenantRole` from `authHelpers`. No document is returned or mutated without verifying `tenantId` matches the caller’s org/tenant. |
| **Role mismatch** | `requireTenantRole` is called first in every function. Caregivers/candidates are blocked from admin/HR endpoints by role, not by custom checks. |
| **Cross-tenant formDefinition** | `submitForm`, `updateFormDefinition`, `deactivateFormDefinition`, and `getFormSubmission` all call `assertTenantDoc` on `formDefinitions` or `formSubmissions`. Tests must verify a tenant-B user cannot access tenant-A documents. |
| **Inactive form submission** | `submitForm` checks `active === true` after `assertTenantDoc` and throws a clear error if inactive. |
| **Missing required fields** | `submitForm` iterates `formDefinition.fields` and validates every `required` field in `data`. Type-specific validation (string, number, date) can be shallow for this pass; at minimum reject missing/empty values. |
| **Duplicate submissions** | Not explicitly forbidden by the task. Allow multiple submissions per user per form, but complete only pending `candidateTasks`; do not create new tasks. If product later requires one submission per user, add a unique index then. |
| **Submission ownership** | `getFormSubmission` enforces `submittedBy === currentUserId` for `org:candidate`/`org:caregiver`. Admin/HR/coordinator can view any submission in their tenant. |
| **Document archive PHI** | Only admin/HR can list or mutate archive items. File metadata is joined only inside these guarded endpoints. No direct file IDs are exposed to caregivers. |
| **Audit trail** | `updateDocumentArchiveItem` always writes an `auditEvents` record with actor, timestamp, previous and new status. This satisfies compliance/forensics needs for document status changes. |
| **Expiration filtering** | `expiringSoonDays` uses `Date.now() + days * 24*60*60*1000` (or Convex `now()`). Items with no `expiresAt` are excluded when the filter is active. |
| **Status transition consistency** | When status changes to `verified`, set `verifiedBy/verifiedAt` and clear `rejectionReason`. When changing to `rejected`, require `rejectionReason` and clear verification fields. When returning to `pending`, clear both. |
| **Idempotency of task completion** | `submitForm` finds pending tasks and patches them to `completed`. If already completed, the query returns nothing and no duplicate work is done. |
| **Role discrepancy (`org:hr`, `org:candidate`)** | The task references `org:hr` and `org:candidate`, while the context lists `org:admin`, `org:coordinator`, `org:caregiver`. Verify `authHelpers` accepts these role strings. If the type union does not include them, extend it as part of this change. |

---

## 6. Test Strategy

Write focused tests using the existing Vitest/Convex test harness. Each test should seed a tenant, users with specific roles, form definitions, submissions, archive items, and files.

### Forms tests

1. **Missing required fields**
   - Admin creates a form definition with one required text field.
   - Candidate submits `{}` or `{ fieldId: '' }`.
   - Expect an error indicating the missing/empty required field.

2. **Cross-tenant formDefinition**
   - Create `formDefinitionId` in tenant A.
   - As a caregiver in tenant B, call `submitForm` with that ID.
   - Expect `assertTenantDoc` to throw / return unauthorized.

3. **Inactive form rejected**
   - Admin creates and then deactivates a form definition.
   - Caregiver attempts `submitForm`.
   - Expect error that the form is inactive.

4. **listFormSubmissions role guard**
   - As a caregiver, call `listFormSubmissions`.
   - Expect `requireTenantRole` error.

5. **getFormSubmission own-only for caregiver**
   - Caregiver A submits a form.
   - Caregiver B (same tenant) calls `getFormSubmission` with A’s submission ID.
   - Expect forbidden/own-only error.

### Document archive tests

6. **updateDocumentArchiveItem blocked for caregiver**
   - Create an archive item as admin.
   - As a caregiver, call `updateDocumentArchiveItem`.
   - Expect role error.

7. **expiringSoonDays filter**
   - Seed archive items with `expiresAt` set to now+3d, now+10d, now+30d, and no expiration.
   - Admin calls `listDocumentArchive({ expiringSoonDays: 7 })`.
   - Expect only the now+3d item returned.

### Broad gates

After implementation, run in this order:

1. `npx convex codegen` — regenerate `_generated` types.
2. `npm run lint` — catch style/formatting issues.
3. `npm run typecheck` — catch TypeScript errors.
4. `npm run test` — run Vitest/Convex tests.
5. Manual smoke test in Convex dev dashboard (optional but recommended): create a form, submit, deactivate, list submissions, update archive status, and verify audit event.

---

## 7. Rollback / Verification Notes

- **Commit granularity:** Commit schema changes, then `forms.ts`, then `documentArchive.ts`, then tests, then codegen output. This makes bisection and revert easy.
- **Rollback:** If anything fails in staging/prod, revert the Git commit. Convex schema changes are additive, so dropping newly added tables is only needed if you want to clean up; reverting code is sufficient for rollback.
- **Verification checklist:**
  - [ ] `npx convex codegen` runs without error.
  - [ ] `npm run lint` passes.
  - [ ] `npm run typecheck` passes.
  - [ ] All new tests pass.
  - [ ] No hand-edited files in `convex/_generated`.
  - [ ] No ADP calls introduced.
  - [ ] Every new function uses `authHelpers` guards.
  - [ ] `documentArchive` reads file metadata through `convex/files.ts`.

---

**Next step for the implementer:** open the files listed in section 2, verify the exact `authHelpers` and schema DSL signatures, then apply the schema changes and run `npx convex codegen` before writing the function bodies.