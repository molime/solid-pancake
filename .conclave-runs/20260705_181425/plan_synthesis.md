# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260705_181425\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 140.0s rc=0

• # Implementation Plan: Forms & Document Archive Backend (Session 4)

  ## 1. Restated Goal & Acceptance Criteria

  Build two new Convex modules — `convex/forms.ts` and `convex/documentArchive.ts` — plus the minimal schema adjustments they need, to power a multi-tenant form engine and HR document archive. Every function must route through `convex/authHelpers.ts`. No ADP calls. Reuse `convex/files.ts` for file metadata.

  **Acceptance criteria**

  - `createFormDefinition({ name, description?, fields })` — `org:admin` or `org:hr`.
  - `updateFormDefinition({ formDefinitionId, name?, description?, fields? })` — `org:admin` only; blocks edits if any submissions exist.
  - `deactivateFormDefinition({ formDefinitionId })` — `org:admin` only; sets `active: false`.
  - `listFormDefinitions({ includeInactive? })` — any tenant role; caregivers/candidates see active forms only; admins/HR may request inactive ones.
  - `submitForm({ formDefinitionId, data })` — `org:candidate` or `org:caregiver`; validates required fields; rejects inactive forms; inserts submission; completes a pending `form_submission` candidate task when the submitter is a candidate.
  - `listFormSubmissions({ formDefinitionId?, submittedBy? })` — `org:admin` or `org:hr`; requires exactly one filter; joins form definition name.
  - `getFormSubmission({ submissionId })` — any tenant role; caregivers/candidates may only read their own submission.
  - `listDocumentArchive({ linkedTo?, status?, documentType?, expiringSoonDays? })` — `org:admin` or `org:hr`; joins file metadata; filters as specified; orders newest first; caps at 100.
  - `updateDocumentArchiveItem({ itemId, status, rejectionReason? })` — `org:admin` or `org:hr`; sets status with verification/rejection fields; writes a `document.status_updated` audit event.

  **Gates:** `npx convex codegen`, `npm run lint`, `npm run typecheck`, `npm run test` all green.

  ---

  ## 2. Discovery Notes (repo inspection completed)

  Verified files and contracts:

  - `convex/authHelpers.ts`
    - `requireTenantRole(ctx, clerkOrgId, allowedRoles)` returns `{ tenantId, tenant, clerkOrgId, identity, member, role }`.
    - `assertTenantDoc(doc, tenantId)` throws `Forbidden: cross-tenant access denied.`
    - `TenantRole` already includes `org:admin`, `org:coordinator`, `org:caregiver`, `org:hr`, `org:candidate`.
    - `requireIdentity` returns the Clerk identity (`subject`, `email`, etc.).

  - `convex/schema.ts`
    - `formDefinitions` exists with `tenantId`, `key`, `name`, `version`, `status`, `fields`, `createdBy`, `createdAt`.
    - `formSubmissions` exists with `tenantId`, `formDefinitionId`, `subjectType`, `subjectId`, `submittedBy`, `status`, `answers`, `submittedAt`.
    - `documentArchiveItems` exists with `tenantId`, `fileId`, `subjectType`, `subjectId`, `category`, `status`, `expiresAt`, `retentionUntil`, `source`.
    - `files` carries `tenantId`, `storageId`, `uploadedBy`, `fileName`, `contentType`, `size`, `linkedType`, `linkedId`, `visibility`, `createdAt`.
    - `candidateTasks` carries `tenantId`, `candidateId`, `applicationId`, `type`, `status`, `order`, `dueAt`, `completedAt`.
    - `auditEvents` carries `tenantId`, `actorId`, `actorRole`, `action`, `kind`, `shiftId`, `previousStatus`, `nextStatus`, `metadata`, `createdAt`.

  - `convex/files.ts`
    - Currently only handles shift-task proof uploads/downloads; it does **not** export a generic file-metadata helper. We will add a tiny helper for archive reuse rather than bypassing the module.

  - `convex/candidates.ts`
    - `getOwnCandidate` resolves a candidate by `clerkUserId`, falling back to email.
    - `completeCandidateTask(ctx, tenantId, candidateId, type)` finds the first pending task of that type and marks it `complete`.
    - `recordCandidateAudit` calls `internal.audit.record`.
    - `addCandidateDocument` already inserts `documentArchiveItems` with `subjectType: 'candidate'`.

  - `convex/audit.ts`
    - Exposes `internal.audit.record` accepting `clerkOrgId`, `action`, `kind`, `shiftId`, `previousStatus`, `nextStatus`, `metadata`.

  - `package.json`
    - `npm run lint` → `eslint .`
    - `npm run typecheck` → `tsc -b`
    - `npm run test` → `vitest run --configLoader native`

  - Test harness
    - `convex/candidates.test.ts` uses `convexTest({ schema, modules })`, `import.meta.glob('./**/*.*s')`, `asAdmin/asHR/asCandidate` identity stubs, and `seedTenant`.

  No `forms.ts` or `documentArchive.ts` files exist yet.

  ---

  ## 3. Alternatives Considered

  | Alternative | Why rejected |
  |---|---|
  | Keep `formDefinitions.status` as a string (`'active'`/`'inactive'`) | Task explicitly says `deactivateFormDefinition` sets `active:false`; a boolean is the direct contract. |
  | Extract `getOwnCandidate` / `completeCandidateTask` into a shared helper module | Would require editing `candidates.ts` and possibly exporting internals. The task scope is the two new files; a small, focused inline equivalent in `forms.ts` keeps blast radius minimal. |
  | Derive `documentArchiveItems` ordering from `files.createdAt` at read time | Task says “order createdAt desc” on the archive list. Adding `createdAt` to the archive table makes ordering explicit and avoids requiring a join just to sort. |
  | Store file metadata redundantly inside `documentArchiveItems` | Violates “reuse `convex/files.ts`” and creates a second source of truth. |
  | Use an action for `submitForm` to call external validation | All data lives in Convex; a mutation is sufficient and cheaper. |
  | Add a formal enum validator for `documentArchiveItems.status` | Convex unions require literal values. The task implies statuses (`active`, `verified`, `rejected`) but does not enumerate them. Keep `v.string()` and validate allowed values in the mutation to avoid over-restricting future HR workflows. |

  ---

  ## 4. Exact Files to Create/Edit

  ### 4.1 `convex/schema.ts` — edit

  Update the three relevant tables only.

  **`formDefinitions`**
  - Add `description: v.optional(v.string())`.
  - Replace `status: v.string()` with `active: v.boolean()`.
  - Keep `key` and `version` but make them `v.optional(v.string())` and `v.optional(v.number())` so any pre-existing rows remain valid; new code will not populate them.
  - Keep existing index `by_tenant_key_version`.
  - Add `by_tenant_created: ['tenantId', 'createdAt']` for ordered listing.

  **`formSubmissions`**
  - Add index `by_formDefinition: ['formDefinitionId']`.
  - Add index `by_submittedBy: ['submittedBy']`.
  - Keep existing `by_tenant_subject`.

  **`documentArchiveItems`**
  - Add `verifiedBy: v.optional(v.string())`.
  - Add `verifiedAt: v.optional(v.string())`.
  - Add `rejectionReason: v.optional(v.string())`.
  - Add `createdAt: v.string()`.
  - Add index `by_tenant_created: ['tenantId', 'createdAt']` for ordered listing.
  - Keep existing indexes (`by_tenant_subject`, `by_tenant_category_status`, `by_tenant_expires_at`).

  No other table changes.

  ### 4.2 `convex/files.ts` — tiny edit

  Add one exported helper so `documentArchive.ts` can reuse the files module:

  ```ts
  export async function getFileMetadata(ctx: AuthContext, fileId: Id<'files'>) {
    return ctx.db.get(fileId)
  }
  ```

  The caller will still assert the file belongs to the same tenant.

  ### 4.3 `convex/forms.ts` — create

  All exports are standard `mutation` / `query` from `./_generated/server`.

  1. **`createFormDefinition`**
     - Args: `clerkOrgId`, `name`, `description?`, `fields`.
     - Roles: `['org:admin', 'org:hr']`.
     - Validate `name` non-empty and `fields` is a non-empty array.
     - Insert `{ tenantId, name, description, active: true, fields, createdBy: identity.subject, createdAt: now }`.

  2. **`updateFormDefinition`**
     - Args: `clerkOrgId`, `formDefinitionId`, `name?`, `description?`, `fields?`.
     - Role: `['org:admin']`.
     - Fetch form, `assertTenantDoc(form, tenantId)`.
     - Count `formSubmissions` for this `formDefinitionId` using `by_formDefinition`.
     - If count > 0, throw `ConvexError('Cannot update a form that already has submissions.')`.
     - `ctx.db.patch` only provided fields.

  3. **`deactivateFormDefinition`**
     - Args: `clerkOrgId`, `formDefinitionId`.
     - Role: `['org:admin']`.
     - Fetch form, `assertTenantDoc`, patch `active: false`.

  4. **`listFormDefinitions`**
     - Args: `clerkOrgId`, `includeInactive?`.
     - Roles: any tenant role.
     - Query `formDefinitions` by `tenantId` using `by_tenant_created` (or collect + sort).
     - If role is `org:caregiver` or `org:candidate`, filter `active === true`.
     - Else if `includeInactive` is not true, filter `active === true`.
     - Order by `createdAt` desc.

  5. **`submitForm`**
     - Args: `clerkOrgId`, `formDefinitionId`, `data`.
     - Roles: `['org:candidate', 'org:caregiver']`.
     - Fetch form, `assertTenantDoc`, ensure `active === true`.
     - Validate required fields: for each field where `field.required === true`, ensure `data[field.id]` is present and not `null` / `undefined` / `''`.
     - Determine `subjectType` / `subjectId`:
       - If `org:candidate`: resolve own candidate via the same lookup pattern used in `candidates.ts` (`by_tenant_clerk_user`, then `by_tenant_email`). `subjectType = 'candidate'`, `subjectId = candidate._id`. Then complete the first pending `form_submission` candidate task.
       - If `org:caregiver`: `subjectType = 'caregiver'`, `subjectId = identity.subject`.
     - Insert `formSubmissions` row with `status: 'submitted'`, `answers: data`, `submittedBy: identity.subject`, `submittedAt: now`.

  6. **`listFormSubmissions`**
     - Args: `clerkOrgId`, `formDefinitionId?`, `submittedBy?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Validate exactly one of `formDefinitionId` / `submittedBy` is provided.
     - Query `formSubmissions` by `tenantId` + the provided filter (`by_formDefinition` or `by_submittedBy`).
     - For each row, fetch the related `formDefinition` and include `formDefinitionName` in the projection.
     - Order by `submittedAt` desc.

  7. **`getFormSubmission`**
     - Args: `clerkOrgId`, `submissionId`.
     - Roles: any tenant role.
     - Fetch submission, `assertTenantDoc`.
     - If role is `org:caregiver` or `org:candidate` and `submittedBy !== identity.subject`, throw `ConvexError('Forbidden: you can only view your own submissions.')`.
     - Return submission plus joined `formDefinition.name`.

  ### 4.4 `convex/documentArchive.ts` — create

  1. **`listDocumentArchive`**
     - Args: `clerkOrgId`, `linkedTo?` (`{ subjectType, subjectId }`), `status?`, `documentType?`, `expiringSoonDays?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Query `documentArchiveItems` by `tenantId`.
     - Apply filters in code:
       - `linkedTo`: match `subjectType` and `subjectId`.
       - `status`: match `status`.
       - `documentType`: match `category`.
       - `expiringSoonDays`: parse as number, compute `cutoff = now + N days`, include only items with `expiresAt` defined and `expiresAt <= cutoff`.
     - Take up to 100 items ordered by `createdAt` desc.
     - For each item, call `getFileMetadata` from `files.ts` and project combined fields: archive fields + `{ fileName, contentType, size, storageId, uploadedBy, fileCreatedAt }`. Handle a missing file gracefully.

  2. **`updateDocumentArchiveItem`**
     - Args: `clerkOrgId`, `itemId`, `status`, `rejectionReason?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Fetch item, `assertTenantDoc`.
     - Validate allowed statuses: `'active'`, `'verified'`, `'rejected'`.
     - Build patch object:
       - Always set `status`.
       - If `status === 'verified'`: set `verifiedBy: identity.subject`, `verifiedAt: now`, clear `rejectionReason`.
       - If `status === 'rejected'`: require `rejectionReason`; set it; clear `verifiedBy`/`verifiedAt`.
       - If `status === 'active'`: clear `verifiedBy`, `verifiedAt`, `rejectionReason`.
     - Patch the item.
     - Call `ctx.runMutation(internal.audit.record, { clerkOrgId, action: 'document.status_updated', previousStatus, nextStatus: status, metadata: { itemId, rejectionReason } })`.

  ### 4.5 Tests to create

  - `convex/forms.test.ts`
  - `convex/documentArchive.test.ts`

  Use the same `convexTest` setup as `convex/candidates.test.ts`.

  ---

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  - **Cross-tenant reads/writes:** Every function starts with `requireTenantRole` and uses `assertTenantDoc` on fetched `formDefinitions`, `formSubmissions`, and `documentArchiveItems` rows.
  - **Role escalation:** `updateFormDefinition`, `deactivateFormDefinition`, `listFormSubmissions`, and archive mutations are restricted to admin/HR as specified. HR can create forms but cannot mutate or retire them.
  - **Submission immutability:** `updateFormDefinition` blocks edits once submissions exist, preventing field shape changes that would invalidate collected data.
  - **Inactive form rejection:** `submitForm` checks `active === true` before accepting data.
  - **Own-data isolation:** `getFormSubmission` enforces `submittedBy === identity.subject` for caregivers/candidates.
  - **Candidate task completion idempotency:** `submitForm` looks up the first pending `form_submission` candidate task and marks it complete; if none exists, it no-ops. Re-submission creates a new submission row but does not duplicate task completion.
  - **Field validation:** Required-field check treats `null`, `undefined`, and empty string as missing.
  - **Document status audit:** `updateDocumentArchiveItem` records previous and next status, actor, and optional rejection reason. Supports compliance/PHI traceability.
  - **Expired documents:** `expiringSoonDays` filter only returns items with a defined `expiresAt` within the window; it does not automatically mark them expired.
  - **Rejection/verification field hygiene:** When transitioning to `verified`, clear `rejectionReason`; when transitioning to `rejected`, clear `verifiedBy`/`verifiedAt`; when reverting to `active`, clear both.
  - **PHI:** Form answers and archive metadata are tenant-scoped and role-gated; audit events should not include the full form answer payload.
  - **File deletion safety:** If a linked file is missing, `listDocumentArchive` should return the archive item with `file: null` rather than throwing, so a file lifecycle change does not break the archive UI.

  ---

  ## 6. Test Strategy

  ### `convex/forms.test.ts`

  1. `createFormDefinition` works for `org:admin` and `org:hr`.
  2. `createFormDefinition` blocked for `org:caregiver`.
  3. `updateFormDefinition` patches name/description/fields.
  4. `updateFormDefinition` throws when submissions exist.
  5. `deactivateFormDefinition` sets `active: false`.
  6. `listFormDefinitions`:
     - Candidate/caregiver sees only active forms.
     - Admin/HR sees active only by default.
     - Admin/HR sees inactive with `includeInactive: true`.
  7. `submitForm`:
     - Throws when required field missing.
     - Throws for cross-tenant `formDefinitionId`.
     - Throws when form is inactive.
     - Candidate submission inserts row and completes pending `form_submission` task.
     - Caregiver submission inserts row with `subjectType: 'caregiver'`.
  8. `listFormSubmissions`:
     - Requires exactly one filter.
     - Blocked for `org:candidate` / `org:caregiver`.
     - Joins `formDefinition.name`.
  9. `getFormSubmission`:
     - Any role can read own tenant submission.
     - Caregiver/candidate blocked from another user’s submission.

  ### `convex/documentArchive.test.ts`

  1. `listDocumentArchive` returns archive items joined with file metadata.
  2. `listDocumentArchive` filters by `linkedTo`, `status`, `documentType`.
  3. `expiringSoonDays` filter includes only items with `expiresAt <= cutoff`.
  4. `listDocumentArchive` blocked for `org:caregiver`.
  5. `updateDocumentArchiveItem`:
     - Sets `verifiedBy`/`verifiedAt` for `verified`.
     - Sets `rejectionReason` for `rejected` and requires it.
     - Writes `document.status_updated` audit event.
     - Blocked for `org:caregiver`.

  ### Broad gates

  Run in order:

  ```bash
  npx convex codegen
  npm run lint
  npm run typecheck
  npm run test
  ```

  If schema changes cause unrelated tests to fail because they insert `formDefinitions` with the old `status` string, update those test seeds to use `active: boolean`.

  ---

  ## 7. Rollback / Verification Notes

  - **Schema rollback:** Revert the `formDefinitions` and `documentArchiveItems` table changes in `convex/schema.ts` and run `npx convex codegen`. If the deployment has already been pushed to a shared Convex backend and rows contain the old `status` string, a migration will be required before type narrowing; locally and in test this is safe.
  - **Code rollback:** Delete `convex/forms.ts`, `convex/forms.test.ts`, `convex/documentArchive.ts`, `convex/documentArchive.test.ts`, revert the tiny helper in `convex/files.ts`, and revert schema edits.
  - **Verification checklist after implementation:**
    - [ ] `npx convex codegen` exits 0.
    - [ ] `npm run lint` exits 0.
    - [ ] `npm run typecheck` exits 0.
    - [ ] `npm run test` exits 0 (or all tests pass; document any pre-existing failures outside this scope).
    - [ ] New `forms.test.ts` and `documentArchive.test.ts` each have green tests.
    - [ ] Cross-tenant access attempts throw `Forbidden: cross-tenant access denied.`
    - [ ] Role-guard violations throw `Forbidden: required one of [...]`.
    - [ ] No hand-edited files in `convex/_generated`.
    - [ ] No ADP calls introduced.


[stderr]
• I need to read the prompt file and carry out its instructions. Let me start by reading the file.The file is large (64KB). I need to read the full content. Let me use Read with output_path to page through it.The output_path itself has the full content. Let me read it with line offsets. First, I need to know how many lines. Let me use Bash to get line count.861 C:/Users/pinol/Documents/Work/atriax/solid-pancake/.conclave-runs/20260705_181425/plan_synthesis.prompt.md
861 lines. Read is capped at 1000 lines, so I can read the whole file directly if I use a large n_lines. Let me read it directly from the source path with n_lines=1000.The Read tool is returning a preview only because of output size. I need to use the output_path to read it, but that also returns preview only. Let me use Bash to read the file in chunks, or use the output_path file. Actually, the Read tool says to use Read with output_path to page through. Let me try reading the output_path with line_offset and n_lines.Good, I can read the output_path in chunks. Let me continue reading from line 301 onwards.Continue reading.Now I understand the prompt. It's asking me to act as a principal/staff engineer planning a code change. I need to:

  1. Do real discovery by inspecting the repo files
  2. Synthesize the three candidate plans into one coherent implementation plan
  3. Output only the final plan as markdown

  The prompt explicitly says "Do NOT write the full code; produce the plan a competent implementer will follow."

  But the user says "carry out those instructions completely." So I need to follow the prompt instructions: do discovery, then produce the premium implementation plan.

  Wait, but I'm also Kimi Code CLI, and the user is asking me to carry out the instructions in the prompt file. The prompt file's instructions are to produce a plan. However, as a coding agent, should I actually implement the code? Let me re-read carefully.

  The prompt says: "You are a principal/staff engineer PLANNING a code change." and "Produce a premium implementation plan... Do NOT write the full code; produce the plan a competent implementer will follow."

  The user's instruction says "carry out those instructions completely" and "Output your final answer/verdict as requested."

  So I should produce the plan, not implement the code. The "final answer/verdict" is the plan.

  But wait - I should also do real discovery. The candidate plans include some discovery notes, but one of them says "Repo inspection is unavailable in this chat-only environment." Since I have access to tools, I should do real discovery.

  Let me do the discovery by reading the relevant files:
  1. convex/authHelpers.ts
  2. convex/schema.ts
  3. convex/files.ts
  4. convex/candidates.ts (for candidateTasks)
  5. convex/audit.ts
  6. package.json
  7. Existing test files

  Then I'll synthesize a coherent plan.

  This is a non-trivial task. Let me set up a TodoList and possibly use subagents. But actually, I can do the discovery myself with parallel reads. Then I'll write the plan.

  Given the instruction "Do not ask questions" and auto permission mode, I should just proceed.

  Let me read the key files in parallel.Now let me read the relevant files. I'll do parallel reads for authHelpers, schema, files, candidates, audit, package.json, and maybe a test file.I have most of the key files. I need to look at test patterns. Let me read a test file like candidates.test.ts and files.test.ts to understand the harness.Good. I have enough context. Let me also check if there are existing forms.ts or documentArchive.ts files, and maybe look at the rest of candidates.ts to see the helper functions.Now I have comprehensive discovery. Let me also check if there's a test helper or test harness file. Actually, I already saw candidates.test.ts setup. That's enough.

  Now I need to synthesize a unified plan. The prompt asks me to output only the final plan as markdown. Since I have real discovery data, my plan should reflect actual verified file contents.

  Key verified facts:
  1. `authHelpers.ts` has `requireTenantRole(ctx, clerkOrgId, allowedRoles)`, `assertTenantDoc(doc, tenantId)`, `requireIdentity`, and TenantRole includes all 5 roles.
  2. `schema.ts` has:
     - `formDefinitions`: tenantId, key (string), name (string), version (number), status (string), fields (array any), createdBy (string), createdAt (string). Index: by_tenant_key_version.
     - `formSubmissions`: tenantId, formDefinitionId, subjectType, subjectId, submittedBy, status, answers (record string->any), submittedAt. Index: by_tenant_subject.
     - `documentArchiveItems`: tenantId, fileId, subjectType, subjectId, category, status, expiresAt, retentionUntil, source. Indexes: by_tenant_subject, by_tenant_category_status, by_tenant_expires_at.
     - `files`: tenantId, storageId, uploadedBy, fileName, contentType, size, linkedType, linkedId, visibility, createdAt. Indexes by_tenant_linked, by_tenant_uploaded, by_tenant_storage.
     - `candidateTasks`: tenantId, candidateId, applicationId, type, status, order, dueAt, completedAt. Indexes by_tenant_candidate_status, by_tenant_candidate_order.
     - `auditEvents`: tenantId, actorId, actorRole, shiftId, previousStatus, nextStatus, action, kind, metadata, createdAt. Index by_tenant_created_at.
  3. `files.ts` has no generic helper for arbitrary file metadata; it handles shiftTask-linked files only. We may need a small helper or query file directly in documentArchive.ts.
  4. `candidates.ts` has `getOwnCandidate`, `completeCandidateTask`, `recordCandidateAudit` helpers. `completeCandidateTask` finds pending task by type and patches to 'complete'. `recordCandidateAudit` calls `internal.audit.record`.
  5. `audit.ts` exposes `internal.audit.record` with args clerkOrgId, action, kind, shiftId, previousStatus, nextStatus, metadata.
  6. package.json: lint, typecheck, test scripts.

  Now I need to produce the plan. Since the user says "carry out those instructions completely" and the instructions are to produce a plan (not implement code), I should produce the plan. However, there's an ambiguity: the user might want me to actually implement the code based on the prompt. But the prompt explicitly says "Do NOT write the full code; produce the plan a competent implementer will follow." And "Output your final answer/verdict as requested." The requested output is the plan.

  Wait, re-reading the user's message: "Read the prompt file at ... and carry out those instructions completely." The instructions in the prompt file are to produce a plan. So I should produce the plan.

  Actually, looking at the prompt file more carefully, it's a "plan_synthesis.prompt.md" file. It seems to be part of an agent orchestration where different agents produce candidate plans and a synthesizer agent (me) produces the final plan. So yes, I should output the final synthesized plan.

  Let me update the todo list and write the plan.

  I should make the plan coherent, de-duplicated, and best-of-all. I'll incorporate the real discovery findings.

  Structure:
  1. Restated Goal & Acceptance Criteria
  2. Discovery Notes (with verified files)
  3. Alternatives Considered
  4. Exact Files to Create/Edit
  5. Data/Auth/Security/Multi-tenant/PHI/Idempotency Edge Cases
  6. Test Strategy
  7. Rollback/Verification Notes

  Let me write this. I need to be careful and precise. Since it's a plan, no code, but precise behavioral descriptions.

  One key decision: schema changes. The task says deactivate sets active:false, so we need to change `formDefinitions.status` to `formDefinitions.active` boolean. Also add `description`. For documentArchiveItems, add `verifiedBy`, `verifiedAt`, `rejectionReason`, and possibly `createdAt`. The task says "order createdAt desc" for listDocumentArchive, but documentArchiveItems doesn't have createdAt. We could either add it or order by file.createdAt. Since the task explicitly says order by document archive createdAt desc, add `createdAt: v.string()` to documentArchiveItems.

  Also need indexes:
  - formSubmissions: add by_formDefinition, by_submittedBy.
  - formDefinitions: add by_tenant_created or use collect+sort.
  - documentArchiveItems: add by_tenant_created for ordering.

  For file metadata joining: files.ts doesn't export generic getFileMetadata. We can either add a small helper or query files directly in documentArchive.ts. To follow "reuse convex/files.ts", we should add a small exported helper like `getFileMetadata(ctx, fileId)` to files.ts. But the task says "No ADP calls; reuse convex/files.ts." Reuse could mean using the files table, not necessarily adding a new export. To be safe and surgical, I'll recommend adding a minimal helper to files.ts.

  For submitForm subjectType: for caregiver, should we use 'caregiver' or 'employeeProfile'? The schema formSubmissions.subjectType is v.string(). documentArchiveItems already uses 'candidate' for candidates. For consistency with existing code, for caregiver we could use 'caregiver' and subjectId = identity.subject (clerk user id). Or we could look up employeeProfile by clerkUserId. The simpler approach is 'caregiver' with identity.subject. But if we want to link to employee profile, we might use 'employeeProfile'. Looking at candidates.ts addCandidateDocument uses 'candidate' and candidate._id. So for caregivers, maybe the equivalent is employeeProfiles._id. But the task doesn't mention employeeProfiles. I'll use 'caregiver' and identity.subject to keep it simple, but note that if future needs require employeeProfile linkage, it can be changed.

  Actually, for documentArchive list linkedTo filter, subjectType/subjectId are used. If caregiver document archive items are stored with subjectType='caregiver' and subjectId=clerkUserId, then listDocumentArchive linkedTo would need to match that. That's fine.

  For candidate task completion in submitForm: use getOwnCandidate logic (from candidates.ts). Since it's a private helper in candidates.ts, we should either export it or duplicate minimal logic. The task scope says build forms.ts and documentArchive.ts. To avoid modifying candidates.ts, I'll recommend duplicating the minimal getOwnCandidate logic in forms.ts. But we could also export it. Let me think about what's cleanest. The candidate plans suggested inline helper or export. Since the task says "Build convex/forms.ts and convex/documentArchive.ts" and doesn't mention editing candidates.ts, but also says "complete candidateTasks form_submission if pending", we need access to candidate lookup. The cleanest is to export `getOwnCandidate` from candidates.ts. But that requires editing candidates.ts. Alternatively, duplicate a small helper. I think exporting is better for DRY, but the task says scope-controlled. I'll recommend a minimal inline helper in forms.ts that mirrors getOwnCandidate, to avoid touching candidates.ts. This is surgical.

  Actually, looking at the existing code, `completeCandidateTask` is also private. We'd need to either export it or duplicate it. Again, duplicating is more surgical for scope.

  For audit: documentArchive.ts can call `ctx.runMutation(internal.audit.record, ...)`.

  For listDocumentArchive file join: since files.ts doesn't export generic helper, either add `getFileMetadata` to files.ts or query directly. I'll recommend adding a small `getFileMetadata` helper to files.ts.

  Now, let me write the plan. I'll make it comprehensive but focused.

  Wait - one more thing. The user said "Output your final answer/verdict as requested." This suggests maybe they want a verdict on the candidate plans? But the prompt says synthesize into one coherent plan. So final answer = the synthesized plan.

  Let me also consider whether I should write the plan to a file. The prompt doesn't specify a file output; it says "output only the final plan as markdown." So I'll output it in my response.

  But the user said "carry out those instructions completely." The instructions include doing real discovery, which I've done. Now I need to synthesize.

  Let me also verify the existing formDefinitions schema. It has `key` and `version`. The task doesn't mention these. I'll recommend keeping them but making optional so existing rows (if any) aren't broken. Actually, changing key from required to optional is a schema change. If there's no data, it's fine. If there is data, making optional is safe (narrowing? Actually making required optional is backwards-compatible). Changing status to active boolean is a type change that would break existing rows if any. Since this is dev/test and likely no data, it's fine. I'll note the risk.

  Actually, in Convex, changing a column type from string to boolean isn't automatically migratory. Existing rows with string status would fail validation. Since this is a new feature and likely no production data, we can do it. But I should note in rollback that if data exists, a migration is needed.

  For documentArchiveItems, adding optional fields is safe.

  Now, writing the plan. I'll do it in my response as markdown.

  But wait - I realize that as an agent, I might need to actually implement the code because the user said "carry out those instructions completely." Let me reconsider.

  The prompt file title is "plan_synthesis.prompt.md". The instructions are:
  - "You are a principal/staff engineer PLANNING a code change."
  - "Produce a premium implementation plan..."
  - "Do NOT write the full code; produce the plan a competent implementer will follow."

  So the task is explicitly planning, not coding. The user wants me to carry out these instructions. So I produce the plan.

  If the user wanted code implementation, the prompt file would be different. Also, the file is in `.conclave-runs/.../plan_synthesis.prompt.md`, suggesting it's a synthesis step in a Conclave run.

  OK, I'll produce the plan.

  Let me update todos and write the final plan.Now I'll write the final plan. I need to make sure it's the best synthesis of the candidate plans, with real discovery notes. I'll produce it as markdown in my final response. Let me mark todos and output.Now I'll write the final plan as my response. I should make it comprehensive and include all the required sections. I'll keep it focused and precise.

To resume this session: kimi -r session_aba080d6-6518-4288-942c-41a936b576a1
