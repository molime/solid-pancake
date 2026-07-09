# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260705_181425\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 141.4s rc=0

• I’ll inspect the Convex backend seams and auth model first, then write the focused plan.# Plan: Forms & Document Archive Backend (Session 4)

  ## 1. Restated Goal & Acceptance Criteria

  Build two new Convex modules — `convex/forms.ts` and `convex/documentArchive.ts` — that expose the nine functions required for form definitions, form submissions, and HR document archive management. Every function must route through `convex/authHelpers.ts` for multi-tenant auth/role guards. No ADP integration; reuse `convex/files.ts` for file metadata. Run `npx convex codegen` after schema edits. Final gates must pass: `npm run lint`, `npm run typecheck`, `npm run test`.

  **Explicit acceptance criteria:**

  - `createFormDefinition` allows `org:admin` / `org:hr` to create a tenant-scoped form with `name`, optional `description`, and `fields`.
  - `updateFormDefinition` allows `org:admin` to patch `name` / `description` / `fields` only when no submissions exist.
  - `deactivateFormDefinition` allows `org:admin` to set `active: false`.
  - `listFormDefinitions` allows any tenant role; caregivers/candidates see only active forms; admins/HR see inactive forms only when `includeInactive: true`.
  - `submitForm` allows `org:candidate` / `org:caregiver`; validates required fields; inserts a submission; completes a pending `form_submission` candidate task when the submitter is a candidate.
  - `listFormSubmissions` allows `org:admin` / `org:hr`; requires exactly one of `formDefinitionId` or `submittedBy`; returns joined form definition name.
  - `getFormSubmission` allows any tenant role; caregivers/candidates may only read their own submissions.
  - `listDocumentArchive` allows `org:admin` / `org:hr`; supports filters `linkedTo`, `status`, `documentType`, `expiringSoonDays`; joins file metadata; orders newest first; caps at 100.
  - `updateDocumentArchiveItem` allows `org:admin` / `org:hr`; sets `status`, `verifiedBy`/`verifiedAt` when status is `verified`, `rejectionReason` when status is `rejected`; writes an `auditEvents` row with action `document.status_updated`.

  ---

  ## 2. Discovery Notes (repo inspection completed)

  Verified files and seams:

  - `convex/authHelpers.ts` — provides `requireTenantRole`, `assertTenantDoc`, `requireIdentity`, and `TenantRole` (includes `org:admin`, `org:coordinator`, `org:caregiver`, `org:hr`, `org:candidate`). All new functions should use these helpers.
  - `convex/schema.ts` — already declares `formDefinitions`, `formSubmissions`, and `documentArchiveItems`, but the shapes need small adjustments to match the task:
    - `formDefinitions` currently uses `status: v.string()`; task wants an `active` boolean.
    - `formDefinitions` has no `description` field.
    - `documentArchiveItems` has no `verifiedBy`, `verifiedAt`, `rejectionReason`, or `createdAt` fields.
  - `convex/files.ts` — is the existing file-storage seam. `documentArchiveItems.fileId` is a foreign key to `files._id`. `files` carries `fileName`, `contentType`, `size`, `storageId`, `uploadedBy`, `createdAt`.
  - `convex/candidates.ts` — already implements `completeCandidateTask` for `form_submission` / `document_upload` tasks. `forms.ts` will need equivalent inline logic to complete a pending `form_submission` candidate task after a candidate submission.
  - `convex/audit.ts` — exposes `internal.audit.record` for audit events. `documentArchive.ts` will call it for `document.status_updated`.
  - `package.json` — test command is `npm run test` (vitest run). `npm run lint` runs eslint, `npm run typecheck` runs `tsc -b`.
  - Test harness pattern in `convex/candidates.test.ts` and `convex/files.test.ts` uses `convex-test`, `import.meta.glob('./**/*.*s')`, identity stubs, and `asAdmin` / `asHR` / `asCandidate` helpers.

  ---

  ## 3. Alternatives Considered

  | Alternative | Why rejected |
  |---|---|
  | Keep `formDefinitions.status` as a string (`'active'` / `'inactive'`) | The task explicitly says `deactivateFormDefinition` sets `active:false`, so a boolean is the direct contract. |
  | Extract `completeCandidateTask` from `candidates.ts` into a shared helper | The task scope is limited to two new files; refactoring `candidates.ts` adds blast radius and risk. A small inline helper in `forms.ts` keeps the change surgical. |
  | Make `documentArchiveItems.createdAt` optional and derive from `files.createdAt` at read time | The task asks to “order createdAt desc” on the archive list. Adding `createdAt` to the archive table makes the ordering explicit and avoids a required join for sorting. |
  | Use an action for `submitForm` to call external validation | Unnecessary; all data lives in Convex and can be validated inside a mutation. |
  | Add a formal enum validator for `documentArchiveItems.status` | Convex unions require literal values. Because the task only implies statuses (`verified`, `rejected`, plus existing `active`), keep the column as `v.string()` and validate allowed values in the mutation to avoid over-restricting future statuses. |

  ---

  ## 4. Exact Files to Create/Edit

  ### 4.1 `convex/schema.ts` — edit

  Update the three relevant table definitions.

  - **`formDefinitions`**
    - Add `description: v.optional(v.string())`.
    - Replace `status: v.string()` with `active: v.boolean()`.
    - Keep `key` / `version` as `v.optional(v.string())` / `v.optional(v.number())` so existing rows (if any) are not broken; new code will not populate them.
    - Keep existing index `by_tenant_key_version`.

  - **`documentArchiveItems`**
    - Add `verifiedBy: v.optional(v.string())`.
    - Add `verifiedAt: v.optional(v.string())`.
    - Add `rejectionReason: v.optional(v.string())`.
    - Add `createdAt: v.string()` (set on insert by callers or default at insertion time).
    - Keep existing indexes.

  No other table changes are needed.

  ### 4.2 `convex/forms.ts` — create

  Exports (all `mutation` / `query` from `./_generated/server`):

  1. `createFormDefinition`
     - Args: `clerkOrgId`, `name`, `description?`, `fields`.
     - Roles: `['org:admin', 'org:hr']`.
     - Insert `{ tenantId, name, description, active: true, fields, createdBy: identity.subject, createdAt: now }`.

  2. `updateFormDefinition`
     - Args: `clerkOrgId`, `formDefinitionId`, `name?`, `description?`, `fields?`.
     - Role: `['org:admin']`.
     - Fetch form, `assertTenantDoc`.
     - Count existing `formSubmissions` for this `formDefinitionId` (index `by_formDefinition` is helpful; if missing, add index `by_formDefinition: ['formDefinitionId']` on `formSubmissions`).
     - If count > 0, throw `ConvexError('Cannot update a form that already has submissions.')`.
     - `ctx.db.patch` only provided fields.

  3. `deactivateFormDefinition`
     - Args: `clerkOrgId`, `formDefinitionId`.
     - Role: `['org:admin']`.
     - Fetch form, `assertTenantDoc`, patch `active: false`.

  4. `listFormDefinitions`
     - Args: `clerkOrgId`, `includeInactive?`.
     - Roles: any tenant role (`['org:admin','org:coordinator','org:caregiver','org:hr','org:candidate']`).
     - Query `formDefinitions` by `tenantId`.
     - If role is `org:caregiver` or `org:candidate`, filter `active === true`.
     - Else if `includeInactive` is not true, filter `active === true`.
     - Order by `createdAt` desc.

  5. `submitForm`
     - Args: `clerkOrgId`, `formDefinitionId`, `data`.
     - Roles: `['org:candidate', 'org:caregiver']`.
     - Fetch form, `assertTenantDoc`, ensure `active === true`.
     - Validate required fields: for each field object where `field.required === true`, ensure `data[field.id]` is present and not `null` / `undefined` / `''`. Throw `ConvexError('Missing required field: <id>')` on first failure.
     - Determine `subjectType` / `subjectId`:
       - If `org:candidate`: resolve own candidate via `getOwnCandidate` logic (lookup by `clerkUserId`, fallback by email). `subjectType = 'candidate'`, `subjectId = candidate._id`. Then complete pending `form_submission` candidate task.
       - If `org:caregiver`: `subjectType = 'caregiver'`, `subjectId = identity.subject`.
     - Insert `formSubmissions` row with `status: 'submitted'`, `answers: data`, `submittedBy: identity.subject`, `submittedAt: now`.

  6. `listFormSubmissions`
     - Args: `clerkOrgId`, `formDefinitionId?`, `submittedBy?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Validate: exactly one of `formDefinitionId` / `submittedBy` is provided; throw otherwise.
     - Query by `tenantId` + the provided filter.
     - For each row, fetch the related `formDefinition` and include `formDefinitionName` in the returned projection.
     - Order by `submittedAt` desc.

  7. `getFormSubmission`
     - Args: `clerkOrgId`, `submissionId`.
     - Roles: any tenant role.
     - Fetch submission, `assertTenantDoc`.
     - If role is `org:caregiver` or `org:candidate` and `submittedBy !== identity.subject`, throw `ConvexError('Forbidden: you can only view your own submissions.')`.

  ### 4.3 `convex/documentArchive.ts` — create

  Exports:

  1. `listDocumentArchive`
     - Args: `clerkOrgId`, `linkedTo?` (`{ subjectType, subjectId }`), `status?`, `documentType?`, `expiringSoonDays?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Query `documentArchiveItems` by `tenantId`.
     - Apply filters in code:
       - `linkedTo`: match `subjectType` and `subjectId`.
       - `status`: match `status`.
       - `documentType`: match `category`.
       - `expiringSoonDays`: if provided, parse as number, compute `cutoff = now + N days`, include only items with `expiresAt` defined and `expiresAt <= cutoff`.
     - Take up to 100 items ordered by `createdAt` desc (or `_creationTime` desc if `createdAt` is missing on legacy rows).
     - For each item, fetch the linked `files` row and project combined fields: archive fields + `{ fileName, contentType, size, storageId, uploadedBy, fileCreatedAt }`.

  2. `updateDocumentArchiveItem`
     - Args: `clerkOrgId`, `itemId`, `status`, `rejectionReason?`.
     - Roles: `['org:admin', 'org:hr']`.
     - Fetch item, `assertTenantDoc`.
     - Validate allowed statuses (`active`, `verified`, `rejected`). Throw if unknown.
     - Build patch object:
       - Always set `status`.
       - If `status === 'verified'`: set `verifiedBy: identity.subject`, `verifiedAt: now`, and clear `rejectionReason: undefined`.
       - If `status === 'rejected'`: require `rejectionReason`; set `rejectionReason`, and clear `verifiedBy`/`verifiedAt` to `undefined`.
       - If `status === 'active'`: clear `verifiedBy`, `verifiedAt`, `rejectionReason`.
     - Patch the item.
     - Call `ctx.runMutation(internal.audit.record, { clerkOrgId, action: 'document.status_updated', previousStatus, nextStatus: status, metadata: { itemId, rejectionReason } })`.

  ### 4.4 Indexes to add/edit in `convex/schema.ts`

  - `formSubmissions`: add `by_formDefinition: ['formDefinitionId']` and `by_submittedBy: ['submittedBy']` to support `listFormSubmissions` efficiently.
  - `formDefinitions`: keep `by_tenant_key_version`; optionally add `by_tenant_created: ['tenantId', 'createdAt']` for `listFormDefinitions` ordering, or use `.collect()` + sort (tenant scope is small enough; index is cleaner).
  - `documentArchiveItems`: existing indexes cover tenant + subject and tenant + category + status; `by_tenant_expires_at` already exists. Add `by_tenant_created: ['tenantId', 'createdAt']` for ordering.

  ### 4.5 Tests to create

  - `convex/forms.test.ts`
  - `convex/documentArchive.test.ts`

  Use the same `convexTest` setup as `candidates.test.ts`.

  ---

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  - **Cross-tenant reads/writes:** Every function starts with `requireTenantRole` and uses `assertTenantDoc` on any fetched `formDefinitions`, `formSubmissions`, or `documentArchiveItems` rows. This is the project’s established guard pattern.
  - **Role escalation:** `updateFormDefinition` and `deactivateFormDefinition` are `org:admin` only; HR can create forms but cannot mutate or retire them.
  - **Submission immutability:** `updateFormDefinition` blocks edits once submissions exist, preventing field shape changes that would invalidate collected data.
  - **Inactive form rejection:** `submitForm` checks `active === true` before accepting data.
  - **Own-data isolation:** `getFormSubmission` enforces `submittedBy === identity.subject` for `org:caregiver` and `org:candidate`.
  - **Candidate task completion idempotency:** `submitForm` looks up the first pending `form_submission` candidate task and marks it complete; if none exists, it no-ops. Re-submission is allowed at the form-submission level (new row), but only one task completion occurs because the task is no longer pending.
  - **Field validation:** Required-field check treats `null`, `undefined`, and empty string as missing. Optional fields are not validated.
  - **Document status audit:** `updateDocumentArchiveItem` records previous and next status, the actor, and optional rejection reason. This supports compliance/PHI traceability.
  - **Expired documents:** `expiringSoonDays` filter only returns items with a defined `expiresAt` within the window; it does not automatically mark them expired.
  - **Rejection/verification field hygiene:** When transitioning to `verified`, clear `rejectionReason`; when transitioning to `rejected`, clear `verifiedBy`/`verifiedAt`; when reverting to `active`, clear both.
  - **Idempotency of document status update:** Repeated calls with the same status are allowed and will overwrite timestamp fields; audit events are recorded each time.

  ---

  ## 6. Test Strategy

  ### Unit/integration tests in `convex/forms.test.ts`

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

  ### Unit/integration tests in `convex/documentArchive.test.ts`

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

  - **Schema rollback:** Revert the `formDefinitions` and `documentArchiveItems` table changes in `convex/schema.ts` and run `npx convex codegen`. Note that if the deployment has already been pushed to a shared Convex backend, column removals may require a migration; locally and in test this is safe.
  - **Code rollback:** Delete `convex/forms.ts`, `convex/forms.test.ts`, `convex/documentArchive.ts`, `convex/documentArchive.test.ts` and revert schema edits.
  - **Verification checklist after implementation:**
    - [ ] `npx convex codegen` exits 0.
    - [ ] `npm run lint` exits 0.
    - [ ] `npm run typecheck` exits 0.
    - [ ] `npm run test` exits 0 (or at least all tests pass; if pre-existing failures exist outside this scope, document them).
    - [ ] New `forms.test.ts` and `documentArchive.test.ts` each have green tests.
    - [ ] Cross-tenant access attempts throw `Forbidden: cross-tenant access denied.`
    - [ ] Role-guard violations throw `Forbidden: required one of [...]`.


[stderr]
• The user wants me to read a prompt file and carry out the instructions. Let me read the file first.This is a planning prompt. I need to do real discovery by inspecting the repo, then produce a premium implementation plan. Let me explore the relevant files: authHelpers.ts, files.ts, candidateTasks if exists, schema.ts or similar for data model.

• Good. Now I need to inspect schema.ts, audit.ts, files.test.ts, maybe candidateTasks or related files.Interesting - the schema already has formDefinitions, formSubmissions, and documentArchiveItems tables. I need to check candidates.ts to understand how candidateTasks and documentArchiveItems are already used, so I don't conflict. Also need to understand existing form definition patterns.Good, I have a lot of context. The schema already has the tables defined. I need to look at the existing schema carefully because the task says "insert formDefinitions" but the schema already has a `key`, `version`, `status`, `fields`. The task asks for `name`, `description`, `fields` and `active`. So the schema will need updates to match the task.

  Wait, the schema has formDefinitions with key, name, version, status, fields, createdBy, createdAt. The task says createFormDefinition({name, description?, fields}) - so I need to add description field and possibly use `active` boolean instead of `status` string. But existing schema uses `status: v.string()`. The task says deactivateFormDefinition sets active:false. So schema needs to change: add `description` and change `status` to `active` boolean? Or maybe `status` can be 'active'/'inactive'? The task explicitly says "set active:false" so boolean is expected.

  Also task says `createFormDefinition({name, description?, fields}) - requireTenantRole org:admin or org:hr`. But existing candidates.ts already has submitApplication that uses form_submission task completion. The task says submitForm should complete candidateTasks form_submission if pending. This is similar to submitApplication. But we need to build forms.ts with the functions.

  For documentArchive.ts, the table already exists with fileId, subjectType, subjectId, category, status, expiresAt, retentionUntil, source. The task wants listDocumentArchive with linkedTo, status, documentType, expiringSoonDays filters, and updateDocumentArchiveItem with status, rejectionReason, auditEvent document.status_updated.

  I need to inspect package.json to know test commands. Also check if there's a forms.ts or documentArchive.ts already.Good. Now I have enough information to write a comprehensive plan. I need to note that repo inspection was available. The plan should include:

  1. Restated goal and explicit acceptance criteria.
  2. Discovery notes.
  3. Alternatives considered.
  4. Exact files to create/edit.
  5. Edge cases.
  6. Test strategy.
  7. Rollback/verification.

  The prompt says "Do NOT write the full code; produce the plan a competent implementer will follow."

  However, the user instruction says "carry out those instructions completely" and "Output your final answer/verdict as requested." The prompt asks to produce a plan, not code. So I should produce the plan.

  But wait - the prompt says "Before writing the plan, do real discovery... open the obvious files, identify existing seams, and state what you verified." I've done that.

  Let me write the plan now. I need to be thorough but focused.

  Key observations:
  - authHelpers.ts has requireTenantRole, assertTenantDoc, TenantRole includes org:hr and org:candidate.
  - schema.ts already defines formDefinitions, formSubmissions, documentArchiveItems tables, but formDefinitions lacks `description` and uses `status` string instead of `active` boolean. Need to update schema.
  - files.ts is the existing file storage module; document archive should join to it.
  - candidates.ts has completeCandidateTask helper and uses form_submission tasks; forms.ts will need similar logic but should not duplicate - perhaps import a helper? But task says "reuse convex/files.ts" only, and build forms.ts and documentArchive.ts. It doesn't say to refactor candidates.ts. The form submission completion can be inline in forms.ts similar to candidates.ts.
  - audit.ts records auditEvents. documentArchive update should call internal.audit.record with action document.status_updated.
  - Tests should be in forms.test.ts and documentArchive.test.ts.
  - Need to run npx convex codegen after schema changes.

  I need to be careful about the schema change for formDefinitions. The existing table has:
  - tenantId
  - key: string
  - name: string
  - version: number
  - status: string
  - fields: array(any)
  - createdBy: string
  - createdAt: string

  Task says createFormDefinition takes name, description?, fields. No key/version mentioned. It says updateFormDefinition takes formDefinitionId, name?, description?, fields?. Deactivate sets active:false. List active only for caregivers/candidates, admin/hr see all if includeInactive.

  So schema should be updated to:
  - remove key, version? Or keep them optional? Since task doesn't mention, maybe remove or make optional. Better to keep them but make optional for backwards compat? But no data yet probably. Safer to add description and change status to active boolean. The task says "set active:false" so we need active: v.boolean().

  Actually the schema already exists, maybe from previous session. We should update it minimally:
  - add description: v.optional(v.string())
  - change status to active: v.boolean()
  - keep key/version? The task doesn't use them. Could remove them since no code references them yet. But removing columns is a schema change that may not be allowed if data exists. Since this is a dev project and no existing data, it's fine. But to be safe, keep key/version as optional.

  Actually, looking at task: "createFormDefinition({name, description?, fields}) - requireTenantRole org:admin or org:hr, insert formDefinitions." It doesn't mention key or version. So we can drop them or make them optional with defaults. I'll recommend making key and version optional to avoid migration issues, but the new code won't populate them.

  For formSubmissions schema:
  - tenantId
  - formDefinitionId
  - subjectType: string
  - subjectId: string
  - submittedBy: string
  - status: string
  - answers: record(string, any)
  - submittedAt: string

  Task says submitForm({formDefinitionId, data}) - org:candidate or org:caregiver, insert formSubmission. So we need to determine subjectType/subjectId. For candidate, subjectType='candidate', subjectId=candidate._id. For caregiver, subjectType='caregiver' or 'employeeProfile'? The task says "org:candidate or org:caregiver". Caregivers don't have candidates. We need to map caregiver to employeeProfile or tenantMember. Looking at employeeProfiles table, caregiverId is a string (clerkUserId). So for caregiver, subjectType='employeeProfile' and subjectId=employeeProfile._id? Or subjectType='caregiver' and subjectId=clerk user id. The documentArchive table uses subjectType/subjectId generically. For consistency, maybe subjectType='employeeProfile' if linked to employee profile. But task doesn't specify. I'll plan to use subjectType='candidate' for candidates and subjectType='caregiver' for caregivers with subjectId being identity.subject (clerk user id). This is simplest. Or perhaps look up employeeProfile by clerkUserId and use its _id. Hmm.

  The task says "complete candidateTasks form_submission if pending" - so for candidates we complete candidateTasks. For caregivers, there's no candidateTasks, so just insert submission.

  For listFormSubmissions({formDefinitionId?, submittedBy?}) - one param required. submittedBy is the clerk user id string. Join formDefinition name.

  For getFormSubmission({submissionId}) - any role, assertTenantDoc, own-only for caregiver/candidate. "own-only" means if role is caregiver or candidate, they can only see submissions where submittedBy === identity.subject.

  For documentArchive.ts:
  - listDocumentArchive({linkedTo?, status?, documentType?, expiringSoonDays?}) - org:admin or org:hr. linkedTo could be an object like {subjectType, subjectId} or just a string? Need to decide. Since documentArchiveItems has subjectType/subjectId, linkedTo should probably be {subjectType, subjectId}. But the task says "linkedTo?" without type. I'll define it as optional object {subjectType, subjectId} to be useful.
  - join file metadata: include fileName, contentType, size, storageId, uploadedBy from files table.
  - expiringSoonDays: filter expiresAt <= now+N days. Since expiresAt is optional, only include if provided.
  - order createdAt desc, max 100. But documentArchiveItems doesn't have createdAt. It has fileId. We can order by file's createdAt desc, or add createdAt to documentArchiveItems. To avoid schema change, order by _creationTime desc (system field). Or use file.createdAt. I'll use _creationTime desc.

  Actually, the task says "order createdAt desc". documentArchiveItems doesn't have createdAt. We can add it to schema, or use file.createdAt. Since we already join files, ordering by file.createdAt desc works. But if we want consistency, maybe add createdAt to documentArchiveItems. The schema already has it for files. To minimize schema changes, order by file.createdAt desc or _creationTime desc. I'll recommend adding createdAt to documentArchiveItems to match the requirement literally. But this is a schema change. Since documentArchiveItems is new-ish, adding createdAt is safe.

  - updateDocumentArchiveItem({itemId, status, rejectionReason?}) - org:admin or org:hr, assertTenantDoc, set status, verifiedBy/verifiedAt if verified, rejectionReason if rejected, auditEvent document.status_updated.

  Status values? documentArchiveItems.status is v.string(). Need to decide allowed statuses: 'active', 'verified', 'rejected', 'expired'? Task doesn't enumerate. I'll use 'active', 'verified', 'rejected'. When status='verified', set verifiedBy=identity.subject, verifiedAt=now. When status='rejected', set rejectionReason (required). Also clear the opposite field.

  But documentArchiveItems schema doesn't have verifiedBy/verifiedAt/rejectionReason fields. Need to add them. So schema changes for documentArchiveItems:
  - add status enum? Or keep string. I'll keep string but validate in code.
  - add verifiedBy: v.optional(v.string())
  - add verifiedAt: v.optional(v.string())
  - add rejectionReason: v.optional(v.string())
  - add createdAt: v.optional(v.string()) or v.string()

  Wait, task says updateDocumentArchiveItem sets "rejectionReason if rejected". So schema needs rejectionReason. Also "verifiedBy/verifiedAt if verified". So add those.

  Now for forms.ts, we need to determine validation of required fields. The task says "validate required fields". Fields schema is v.array(v.any()) in formDefinitions. We need a field shape like {id, label, required?, type?}. The task doesn't define exact shape. We'll assume fields have `id` and `required` boolean. Validate that data has all required field ids and non-empty values. "Missing required fields" test. We need to define what empty means: undefined, null, empty string. Plan to check.

  For tests, use convex-test similar to existing tests.

  Also note: the task says "Run npx convex codegen. Style: single quotes, no semicolons, 2-space indent. Gates: npm run lint, typecheck, test green."

  The prompt says produce plan, not code. So my final answer should be the plan. But the user says "carry out those instructions completely" - the instructions in the prompt are to produce a plan. So I will produce the plan. I should NOT write code files.

  Wait, let me re-read the user's message: "Read the prompt file at ... and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested."

  The prompt file's final request: "Produce a premium implementation plan... Do NOT write the full code; produce the plan a competent implementer will follow."

  So I should output the plan. That's the final answer.

  Let me structure it well. I should include the discovery notes from actual inspection.

  I'll write a markdown plan. Since this is the final answer, I should put it in the response directly. The prompt didn't ask to write to a file, just output the final answer. So I'll provide it as text.

  Actually, looking at the prompt context, this might be part of a Conclave multi-agent orchestration where "plan_c_plan_agentic.prompt.md" is asking me (as a planning agent) to produce a plan. So I should output the plan in my final response.

  Let me draft it.

To resume this session: kimi -r session_4560cefa-21bd-4865-9824-5ffa63d2e9aa
