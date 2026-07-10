# SESSION 3 Implementation Plan — Candidate & Onboarding Backend + Platform Training Gate

## 1. Restated Goal & Acceptance Criteria

Build the backend for ATRIA-X candidate onboarding and the platform-training gate, entirely inside `convex/candidates.ts` (candidate lifecycle) and `convex/onboarding.ts` (training). Every function must route through `convex/authHelpers.ts` for tenant + role enforcement.

### Functional requirements (16 endpoints)

1. `inviteCandidate({ clerkOrgId, displayName, email, phone? })` — mutation; requires `org:admin` or `org:hr`; sends a Clerk invitation with role `org:candidate`; inserts a `candidates` row with `status: 'invited'` and seeds exactly 5 ordered `candidateTasks`.
2. `getCandidateProfile({ clerkOrgId })` — query; requires `org:candidate`; returns the caller's own `candidates` row.
3. `submitApplication({ clerkOrgId, fields })` — mutation; requires `org:candidate`; upserts one `applications` row for the caller, marks the `form_submission` candidate task completed, records an audit event.
4. `listCandidates({ clerkOrgId, status? })` — query; requires `org:admin` or `org:hr`; lists candidates for the tenant, optionally filtered by `status`.
5. `getCandidateDetail({ clerkOrgId, candidateId })` — query; requires `org:admin` or `org:hr`; returns the candidate + their applications + candidate tasks + documents.
6. `reviewApplication({ clerkOrgId, candidateId, decision, hrNotes? })` — mutation; requires `org:admin` or `org:hr`; transitions the candidate to `hr_review` and records the decision on the latest application.
7. `sendOffer({ clerkOrgId, candidateId })` — mutation; requires `org:admin` or `org:hr`; valid only from `hr_review`, transitions candidate to `offer_sent`.
8. `acceptOffer({ clerkOrgId })` — mutation; requires `org:candidate`; valid only from `offer_sent`, transitions caller's candidate to `accepted`.
9. `rejectOffer({ clerkOrgId })` — mutation; requires `org:candidate`; valid only from `offer_sent`, transitions caller's candidate to `withdrawn`.
10. `hireCandidate({ clerkOrgId, candidateId })` — mutation; requires `org:admin` or `org:hr`; valid only from `accepted`; upserts a `tenantMembers` row with role `org:caregiver`, creates/updates an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`, schedules `internal.adpOutbound.adpSyncWorker`, sets candidate status to `hired`, records an audit event.
11. `completePlatformTraining({ clerkOrgId, trainingId? })` — mutation; requires `org:caregiver` or `org:candidate`; idempotent; inserts a `platformTrainingCompletions` row if absent, keyed by tenant + clerk user + training.
12. `hasPlatformTrainingCompleted({ clerkOrgId, trainingId? })` — query; requires `org:caregiver` or `org:candidate`; returns boolean.
13. `resetPlatformTraining({ clerkOrgId, clerkUserId })` — mutation; requires `org:admin`; deletes the matching completion row.
14. `addCandidateDocument({ clerkOrgId, candidateId?, fileId, documentType, label, expiresAt? })` — mutation; requires `org:candidate`, `org:admin`, or `org:hr`; inserts a `documentArchiveItems` row and marks the matching `document_upload` candidate task completed.
15. `listCandidateTasks({ clerkOrgId })` — query; requires `org:candidate`; returns caller's own tasks ordered.
16. `listCandidateTasksForHR({ clerkOrgId, candidateId })` — query; requires `org:admin` or `org:hr`; returns tasks for the given candidate.

### Acceptance criteria

- All 16 functions are exported from the two modules and compile after `npx convex codegen`.
- Every function rejects cross-tenant access and rejects callers without the required role.
- `inviteCandidate` seeds 5 tasks in a deterministic order; `listCandidateTasks` returns them in that order.
- `hireCandidate` produces a caregiver member, an employee profile with `adpSyncStatus: 'pending_credentials'`, and schedules `adpSyncWorker`.
- `completePlatformTraining` is idempotent; calling it twice does not create duplicate rows.
- `submitApplication` marks the `form_submission` task completed and writes an audit event.
- `npm run lint`, `npm run typecheck`, and `npm run test` are green.

---

## 2. Discovery Notes

Repo inspection was performed. Verified seams/contracts:

- **`convex/authHelpers.ts`** — Provides `requireTenantRole(ctx, clerkOrgId, allowedRoles)`, `assertTenantDoc(doc, tenantId)`, `ensureTenantMember(ctx, tenantId, clerkUserId)`, and `requireIdentity`. `TenantRole` already includes `org:hr` and `org:candidate`.
- **`convex/invitations.ts`** — Exports `sendClerkInvitation({ secretKey, inviterUserId, clerkOrgId, emailAddress, role, appBaseUrl })`. The existing `create` action is admin-only and not suitable here; call the helper directly from our mutation.
- **`convex/adpOutbound.ts`** — Exports `internalAction` `adpSyncWorker({ employeeProfileId })`. Internal scheduling path is `internal.adpOutbound.adpSyncWorker`.
- **`convex/adpSync.ts`** — Exports `normalizeEmail`, `idempotencyKey`, status validators. `patchWorkerAdpStatus` is internal; our mutation will write the profile directly with `adpSyncStatus: 'pending_credentials'` and schedule the worker.
- **`convex/employeeProfiles.ts`** — Has `ensureCaregiverEmployeeProfile` and `createCaregiverProfile`, but these default status to `queued`. For hired candidates we want explicit `pending_credentials` (per task) and then schedule the worker, so we will upsert directly in the hire mutation rather than reuse those helpers.
- **`convex/audit.ts`** — Exports `record` internalMutation, but its role allow-list is `['org:admin', 'org:coordinator', 'org:caregiver']` and does not include `org:hr`. We must either extend the allow-list in `audit.ts` to include `org:hr`, or create a new internal mutation for candidate-audit events. Candidate flows are owned by HR, so the cleanest fix is to add `'org:hr'` to `audit.ts`'s `record` allow-list.
- **`convex/schema.ts`** — Already defines the tables we need:
  - `candidates` (tenantId, clerkUserId, email, phone, displayName, status, source, createdAt)
  - `applications` (tenantId, candidateId, status, submittedAt, reviewedBy, decisionAt, hiredEmployeeProfileId)
  - `candidateTasks` (tenantId, candidateId, applicationId, type, status, dueAt, completedAt)
  - `documentArchiveItems` (tenantId, fileId, subjectType, subjectId, category, status, expiresAt, retentionUntil, source)
  - `platformTrainingCompletions` (tenantId, clerkUserId, trainingId, completedAt, status, expiresAt)
- **`convex/candidates.ts`** — Already exists with `get`, `create`, `update` for admin/coordinator/hr. We will replace/extend it with the new API.
- **`convex/platformTrainingCompletions.ts`** — Already exists with an admin-only `create`. We will either extend it or fold training logic into `convex/onboarding.ts` as required by the task.
- **Test harness** — Existing tests use `convex-test` + Vitest (see `members.test.ts`, `authHelpers.test.ts`, `employeeProfiles.test.ts`).

---

## 3. Alternatives Considered

| Decision | Option A (chosen) | Option B (rejected) | Why |
|----------|-------------------|---------------------|-----|
| Reuse Clerk invitation helper | Call `sendClerkInvitation` from a mutation | Reuse `invitations.create` action | The action is admin-only and returns only invitation metadata; we need to insert a candidate and tasks atomically in the same mutation. |
| Candidate-task ordering | Add explicit `order` field to `candidateTasks` table | Order by `_creationTime` | `_creationTime` works but is implicit; an explicit `order` integer makes the UI contract stable and tests deterministic. |
| Hire flow employee profile | Upsert directly with `adpSyncStatus: 'pending_credentials'` | Reuse `ensureCaregiverEmployeeProfile` | The helper defaults to `queued`, but the task explicitly requires `pending_credentials` for new hires. We can still reuse its lookup logic inline. |
| Audit for HR actions | Add `org:hr` to `audit.ts`'s allow-list | Create a parallel `auditCandidateEvent` internal mutation | Keeping one audit table keeps reporting simple; HR is a legitimate audit actor. |
| Training module location | Put training mutations/queries in `convex/onboarding.ts` | Extend `convex/platformTrainingCompletions.ts` | The task explicitly names `convex/onboarding.ts` for training. We will create it and may deprecate the old module later. |
| Application upsert | One active application per candidate | Many applications per candidate | The task says "upsert applications row", implying one active row; implement as replace-latest (patch existing unsubmitted/rejected, or insert if none). |

---

## 4. Exact Files to Create/Edit

### A. Schema extension — `convex/schema.ts` (edit)

1. Add an `order` field to `candidateTasks` for deterministic ordering:
   ```ts
   candidateTasks: defineTable({
     tenantId: v.id('tenants'),
     candidateId: v.id('candidates'),
     applicationId: v.optional(v.id('applications')),
     type: v.string(),
     status: v.string(),
     order: v.number(),           // <-- add
     dueAt: v.optional(v.string()),
     completedAt: v.optional(v.string()),
   })
     .index('by_tenant_candidate_status', ['tenantId', 'candidateId', 'status'])
     .index('by_tenant_candidate_order', ['tenantId', 'candidateId', 'order']), // <-- add
   ```

2. Add `status` literals to `applications` (optional but recommended) and add `hrNotes`/`decision` fields if not present. The current schema has `status: v.string()`. Keep it string-based to avoid a broad migration, but validate against the allowed set in code.

### B. Audit fix — `convex/audit.ts` (edit)

Change the allow-list in `record` from:
```ts
['org:admin', 'org:coordinator', 'org:caregiver']
```
to:
```ts
['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr']
```

### C. Candidate lifecycle — `convex/candidates.ts` (replace/extend)

Remove the existing `get`/`create`/`update` exports or repurpose their names to avoid conflicts. Recommended final exports:

- `inviteCandidate`
- `getCandidateProfile`
- `submitApplication`
- `listCandidates`
- `getCandidateDetail`
- `reviewApplication`
- `sendOffer`
- `acceptOffer`
- `rejectOffer`
- `hireCandidate`
- `addCandidateDocument`
- `listCandidateTasks`
- `listCandidateTasksForHR`

Implementation notes per function:

1. **`inviteCandidate`**
   - Validate role `['org:admin', 'org:hr']`.
   - Read `CLERK_SECRET_KEY` and `process.env.VITE_CLERK_PUBLISHABLE_KEY`/`APP_BASE_URL` (use a sensible env var for the redirect base URL; fallback to `window.location.origin` is not available on the server — use `process.env.PUBLIC_APP_URL` or derive from request). For this task, accept `appBaseUrl` as an arg or read `process.env.PUBLIC_APP_URL`.
   - Normalize email with `normalizeEmail`.
   - Guard against duplicate active candidate by email (`by_tenant_email` index).
   - Call `sendClerkInvitation({ secretKey, inviterUserId: identity.subject, clerkOrgId, emailAddress, role: 'org:candidate', appBaseUrl })`.
   - Insert `candidates` row: `tenantId`, `email`, `displayName`, `phone`, `status: 'invited'`, `source: 'clerk_invite'`, `createdAt`.
   - Seed 5 `candidateTasks` rows with `type` values: `['form_submission', 'document_upload', 'background_check', 'reference_check', 'platform_training']`, `status: 'pending'`, `order: 0..4`.
   - Return `{ candidateId, invitationId }`.

2. **`getCandidateProfile`**
   - Role `['org:candidate']`.
   - Look up `candidates` by `tenantId` + `identity.subject` using a new index or filter (schema currently lacks `by_tenant_clerk_user`). Add index: `index('by_tenant_clerk_user', ['tenantId', 'clerkUserId'])` to `candidates` table.
   - Return the row or `null`.

3. **`submitApplication`**
   - Role `['org:candidate']`.
   - Find own candidate row; require `status` in `['invited', 'hr_review']`? Actually allow submission from `invited` and maybe `hr_review` if resubmitting. Simpler: allow if status is not `hired`/`withdrawn`.
   - Upsert `applications` row: if an existing application for this candidate exists and is not `accepted`/`hired`, patch it; otherwise insert.
   - If inserting, set `status: 'submitted'`, `submittedAt: now`.
   - Mark the `form_submission` candidate task completed (`status: 'complete'`, `completedAt: now`).
   - Record audit event via `internal.audit.record` with action `candidate_application_submitted`.

4. **`listCandidates`**
   - Role `['org:admin', 'org:hr']`.
   - Query `candidates` by `tenantId`; optional `status` filter.
   - Order by `createdAt` desc.

5. **`getCandidateDetail`**
   - Role `['org:admin', 'org:hr']`.
   - Fetch candidate, assert tenant.
   - Fetch applications by `candidateId` (use `by_tenant_status` then filter, or add `index('by_candidate', ['candidateId'])`).
   - Fetch candidate tasks by `tenantId` + `candidateId` ordered by `order`.
   - Fetch `documentArchiveItems` with `subjectType: 'candidate'` and `subjectId: candidateId` (use `by_tenant_subject` index).
   - Return `{ candidate, applications, tasks, documents }`.

6. **`reviewApplication`**
   - Role `['org:admin', 'org:hr']`.
   - Require candidate status `submitted` or `hr_review`.
   - Patch latest application with `status: decision` (`approved`/`rejected`), `reviewedBy: identity.subject`, `decisionAt: now`, `hrNotes`.
   - Set candidate status to `hr_review` if approved; keep `hr_review` or set `rejected` if rejected? Task says "reviewApplication" with decision; safest: approved → `hr_review`, rejected → `rejected`.
   - Audit action `candidate_application_reviewed`.

7. **`sendOffer`**
   - Role `['org:admin', 'org:hr']`.
   - Require candidate status `hr_review`.
   - Set status `offer_sent`.
   - Audit action `candidate_offer_sent`.

8. **`acceptOffer`**
   - Role `['org:candidate']`.
   - Find own candidate; require status `offer_sent`.
   - Set status `accepted`.
   - Audit action `candidate_offer_accepted`.

9. **`rejectOffer`**
   - Role `['org:candidate']`.
   - Find own candidate; require status `offer_sent`.
   - Set status `withdrawn`.
   - Audit action `candidate_offer_rejected`.

10. **`hireCandidate`**
    - Role `['org:admin', 'org:hr']`.
    - Fetch candidate; require status `accepted`.
    - Normalize email.
    - Upsert `tenantMembers` row: query `by_tenant_user` for candidate's `clerkUserId`; if exists, patch role to `org:caregiver`; else insert with role `org:caregiver`, `displayName`, `email`.
    - Upsert `employeeProfiles`:
      - Look up by `tenantId` + `clerkUserId`; if exists, patch `tenantMemberId`, `displayName`, `email`, `adpSyncStatus: 'pending_credentials'`.
      - Else look up by email within tenant; if exists, patch `clerkUserId`, `tenantMemberId`, `displayName`, `adpSyncStatus: 'pending_credentials'`.
      - Else insert new profile with `tenantId`, `clerkUserId`, `tenantMemberId`, `displayName`, `email`, `adpSyncStatus: 'pending_credentials'`, `createdAt`.
    - Schedule `ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, { employeeProfileId })`.
    - Patch candidate status to `hired`.
    - Patch latest application with `hiredEmployeeProfileId`.
    - Audit action `candidate_hired` with metadata `{ employeeProfileId }`.

11. **`addCandidateDocument`**
    - Role `['org:candidate', 'org:admin', 'org:hr']`.
    - Resolve candidate: if caller is candidate, use own row; else require `candidateId` arg and fetch it.
    - Validate the `fileId` belongs to tenant (fetch `files` row, `assertTenantDoc`).
    - Insert `documentArchiveItems` with `subjectType: 'candidate'`, `subjectId: candidateId`, `category: documentType`, `status: 'active'`, `expiresAt`, `source: label`.
    - Mark matching `document_upload` candidate task completed (or a type-specific task if `documentType` maps to a task type).
    - Audit action `candidate_document_added`.

12. **`listCandidateTasks`** / **`listCandidateTasksForHR`**
    - Candidate version finds own candidate and returns tasks ordered by `order` asc.
    - HR version receives `candidateId`, asserts tenant, returns tasks ordered by `order` asc.

### D. Platform training — create `convex/onboarding.ts`

Exports:

- `completePlatformTraining({ clerkOrgId, trainingId? })`
  - Role `['org:caregiver', 'org:candidate']`.
  - Default `trainingId` to `'platform_training'` if not provided.
  - Query `platformTrainingCompletions` by `by_tenant_user` for this clerk user; filter by `trainingId`.
  - If a completion exists, return existing row (idempotent).
  - If not, insert `{ tenantId, clerkUserId: identity.subject, trainingId, completedAt: now, status: 'completed' }`.

- `hasPlatformTrainingCompleted({ clerkOrgId, trainingId? })`
  - Role `['org:caregiver', 'org:candidate']`.
  - Default `trainingId` to `'platform_training'`.
  - Return boolean based on existence of a completion row.

- `resetPlatformTraining({ clerkOrgId, clerkUserId })`
  - Role `['org:admin']`.
  - Find completion row(s) for tenant + `clerkUserId` + default training.
  - Delete the row. Return `{ deleted: boolean }`.

### E. Generated API surface — run `npx convex codegen`

After all edits, run `npx convex codegen` so `_generated/api` includes the new exports.

---

## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

- **Multi-tenancy**: Every query uses `requireTenantRole` or `requireTenant` to resolve the tenant from `clerkOrgId`. All fetched documents must pass `assertTenantDoc` before mutation.
- **Candidate self-ownership**: Candidate-scoped functions (`getCandidateProfile`, `submitApplication`, `acceptOffer`, `rejectOffer`, `listCandidateTasks`, `completePlatformTraining`, `hasPlatformTrainingCompleted`) resolve the candidate by `identity.subject` and never accept a `candidateId` from the caller, preventing horizontal privilege escalation.
- **Role guards**: `requireTenantRole` throws `Forbidden: required one of [...]`. `org:coordinator` is intentionally not given HR candidate powers per the task.
- **Status-machine integrity**: Each state-changing mutation validates the current candidate status and rejects invalid transitions with a clear `ConvexError`. This prevents, e.g., hiring from `offer_sent`.
- **Duplicate candidate invites**: `inviteCandidate` checks `by_tenant_email` for an existing active candidate (status !== `withdrawn`) and rejects duplicates to avoid duplicate Clerk invitations and task rows.
- **Idempotent training completion**: `completePlatformTraining` reads existing row before insert; no duplicate completions for the same `(tenantId, clerkUserId, trainingId)`.
- **Idempotent hire**: `hireCandidate` upserts `tenantMembers` and `employeeProfiles` by `clerkUserId` and email, so re-running hire does not create duplicate records. ADP worker scheduling uses the existing profile id; `adpSyncWorker` itself is idempotent via integration events.
- **PHI / documents**: `documentArchiveItems` stores only metadata; actual bytes live in Convex storage via `files`. Verify the caller's tenant owns the `fileId` before linking.
- **Clerk invitation errors**: If `sendClerkInvitation` throws, do not insert the candidate or tasks (transaction is rolled back automatically because we call the helper before any Convex writes, or keep all DB writes after the network call).
- **Audit PII**: Audit metadata may include candidate/employee IDs but should avoid free-form PHI; `hrNotes` stay in the application row.

---

## 6. Test Strategy

Create `convex/candidates.test.ts` and `convex/onboarding.test.ts` using the existing `convex-test` harness.

### `convex/candidates.test.ts` — focused cases

1. `inviteCandidate creates 5 seeded tasks in order`
   - Call as admin; assert candidate row status `invited`, 5 tasks with expected `type`/`order` values.
2. `inviteCandidate blocked for org:caregiver caller`
   - Call as caregiver; expect `ConvexError` with "Forbidden".
3. `submitApplication marks form_submission task completed`
   - Candidate submits; assert application row exists and task `form_submission` has status `complete`.
4. `getCandidateProfile returns own row for candidate`
5. `listCandidates filtered by status works for HR`
6. `getCandidateDetail includes applications, tasks, documents`
7. `reviewApplication approved transitions candidate to hr_review`
8. `sendOffer from hr_review transitions to offer_sent`
9. `acceptOffer from offer_sent transitions to accepted`
10. `rejectOffer from offer_sent transitions to withdrawn`
11. `hireCandidate from accepted creates employeeProfile and schedules ADP sync`
    - Use `ADP_MOCK_ADAPTER=true` or mock the scheduler; assert profile `adpSyncStatus` is `pending_credentials` and a scheduled call to `adpSyncWorker` exists.
12. `addCandidateDocument marks document_upload task completed`
13. `listCandidateTasks returns tasks ordered for candidate`
14. `org:candidate cannot call listCandidates` (guard test)
15. `org:hr can call listCandidates`

### `convex/onboarding.test.ts` — focused cases

1. `completePlatformTraining is idempotent` — call twice, assert one row.
2. `hasPlatformTrainingCompleted false before, true after`.
3. `resetPlatformTraining deletes completion for admin`.
4. `resetPlatformTraining blocked for non-admin`.

### Broad gates

After edits, run in order:

```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test
```

If any existing test breaks because of the `audit.ts` role-list change or schema index additions, update only the affected expectations; do not broaden beyond what is required.

---

## 7. Rollback / Verification Notes

- **Rollback**: All changes are additive except the edits to `convex/candidates.ts` and `convex/audit.ts`. If a rollback is needed, restore those two files from git and delete `convex/onboarding.ts` and any new test files. Schema index additions are backward-compatible.
- **Verification checklist**:
  - [ ] `npx convex codegen` exits 0.
  - [ ] `npm run typecheck` exits 0.
  - [ ] `npm run lint` exits 0.
  - [ ] `npm run test` exits 0 (including new candidate/onboarding tests).
  - [ ] Manual spot-check via Convex dashboard or a small script: admin invites candidate → candidate submits application → HR reviews → offer sent → candidate accepts → HR hires → employeeProfile created with `adpSyncStatus: 'pending_credentials'`.
- **Deployment note**: The new Clerk invitation mutation runs server-side; ensure `CLERK_SECRET_KEY` is set in the Convex deployment environment.
