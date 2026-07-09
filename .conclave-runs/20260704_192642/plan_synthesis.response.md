# SESSION 3 — Candidate & Onboarding Backend + Platform Training Gate

## 1. Restated Goal & Acceptance Criteria

Build the Convex backend for the ATRIA-X candidate hiring pipeline and the platform-training gate. All functions live in `convex/candidates.ts` (candidate lifecycle) and `convex/onboarding.ts` (training), route through `convex/authHelpers.ts`, reuse `convex/invitations.ts` for Clerk invites, and reuse the Phase 1 `adpSyncWorker` action in `convex/adpOutbound.ts` for ADP worker creation on hire.

### 16 endpoints to deliver

| # | Function | Module | Kind | Required role(s) |
|---|----------|--------|------|------------------|
| 1 | `inviteCandidate({ clerkOrgId, displayName, email, phone?, appBaseUrl })` | `candidates.ts` | mutation | `org:admin` / `org:hr` |
| 2 | `getCandidateProfile({ clerkOrgId })` | `candidates.ts` | query | `org:candidate` |
| 3 | `submitApplication({ clerkOrgId, fields })` | `candidates.ts` | mutation | `org:candidate` |
| 4 | `listCandidates({ clerkOrgId, status? })` | `candidates.ts` | query | `org:admin` / `org:hr` |
| 5 | `getCandidateDetail({ clerkOrgId, candidateId })` | `candidates.ts` | query | `org:admin` / `org:hr` |
| 6 | `reviewApplication({ clerkOrgId, candidateId, decision, hrNotes? })` | `candidates.ts` | mutation | `org:admin` / `org:hr` |
| 7 | `sendOffer({ clerkOrgId, candidateId })` | `candidates.ts` | mutation | `org:admin` / `org:hr` |
| 8 | `acceptOffer({ clerkOrgId })` | `candidates.ts` | mutation | `org:candidate` |
| 9 | `rejectOffer({ clerkOrgId })` | `candidates.ts` | mutation | `org:candidate` |
| 10 | `hireCandidate({ clerkOrgId, candidateId })` | `candidates.ts` | mutation | `org:admin` / `org:hr` |
| 11 | `completePlatformTraining({ clerkOrgId, trainingId? })` | `onboarding.ts` | mutation | `org:caregiver` / `org:candidate` |
| 12 | `hasPlatformTrainingCompleted({ clerkOrgId, trainingId? })` | `onboarding.ts` | query | `org:caregiver` / `org:candidate` |
| 13 | `resetPlatformTraining({ clerkOrgId, clerkUserId })` | `onboarding.ts` | mutation | `org:admin` |
| 14 | `addCandidateDocument({ clerkOrgId, candidateId?, fileId, documentType, label, expiresAt? })` | `candidates.ts` | mutation | `org:candidate` / `org:admin` / `org:hr` |
| 15 | `listCandidateTasks({ clerkOrgId })` | `candidates.ts` | query | `org:candidate` |
| 16 | `listCandidateTasksForHR({ clerkOrgId, candidateId })` | `candidates.ts` | query | `org:admin` / `org:hr` |

### Acceptance criteria

- All 16 functions are exported, compile after `npx convex codegen`, and pass role/tenant guards.
- `inviteCandidate` seeds exactly 5 ordered `candidateTasks` in a single transaction with the candidate row.
- `submitApplication` upserts the candidate's `applications` row, marks the `form_submission` task complete, and records an audit event.
- `hireCandidate` transitions the candidate to `hired`, upserts a `tenantMembers` row with `org:caregiver`, upserts an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`, and schedules `internal.adpOutbound.adpSyncWorker` with the profile id.
- `completePlatformTraining` is idempotent for `(tenantId, clerkUserId, trainingId)`.
- `npm run lint`, `npm run typecheck`, and `npm run test` are green.

---

## 2. Discovery Notes (verified from repo)

Files inspected and the seams/contracts found:

- **`convex/authHelpers.ts`** — Already exports `requireTenantRole(ctx, clerkOrgId, allowedRoles)`, `requireTenant`, `assertTenantDoc`, `ensureTenantMember`, and identity/org extraction helpers. `TenantRole` already includes both `org:hr` and `org:candidate`. No role changes needed.
- **`convex/invitations.ts`** — Exports `sendClerkInvitation({ secretKey, inviterUserId, clerkOrgId, emailAddress, role, appBaseUrl })`. It maps non-admin roles to Clerk's `org:member` but stores the ATRIA-X role in `public_metadata.atriaRole`. For candidate invites we call it with `role: 'org:candidate'` directly from our mutation (do not reuse the admin-only `create` action).
- **`convex/adpOutbound.ts`** — Exports `internalAction` `adpSyncWorker({ employeeProfileId })`. The correct scheduler path is `internal.adpOutbound.adpSyncWorker`, not `internal.adpSync.adpSyncWorker`.
- **`convex/employeeProfiles.ts`** — Has `ensureCaregiverEmployeeProfile` and `createCaregiverProfile`, but these default `adpSyncStatus` to `queued`. For hired candidates we need explicit `pending_credentials`, so `hireCandidate` will upsert the profile directly rather than reuse these helpers.
- **`convex/audit.ts`** — Exports `record` `internalMutation`, but its role allow-list is `['org:admin', 'org:coordinator', 'org:caregiver']`. It must be extended to include `'org:hr'` so HR-owned candidate actions can audit.
- **`convex/schema.ts`** — Already defines:
  - `candidates` (with `tenantId`, optional `clerkUserId`, `email`, `phone`, `displayName`, `status`, `source`, `createdAt`)
  - `applications` (with `tenantId`, `candidateId`, `status`, `submittedAt`, `reviewedBy`, `decisionAt`, `hiredEmployeeProfileId`)
  - `candidateTasks` (with `tenantId`, `candidateId`, optional `applicationId`, `type`, `status`, `dueAt`, `completedAt`)
  - `documentArchiveItems` (with `tenantId`, `fileId`, `subjectType`, `subjectId`, `category`, `status`, `expiresAt`, etc.)
  - `platformTrainingCompletions` (with `tenantId`, `clerkUserId`, `trainingId`, `completedAt`, `status`, `expiresAt`)
- **`convex/candidates.ts`** — Currently exports only `get`, `create`, `update` for admin/coordinator/hr. It will be replaced/extended with the new lifecycle API.
- **`convex/platformTrainingCompletions.ts`** — Exists with an admin-only `create`. Per the task, training logic goes in a new `convex/onboarding.ts`.
- **Test harness** — Existing tests use `convex-test` + Vitest (`employeeProfiles.test.ts`, `authHelpers.test.ts`, etc.).

---

## 3. Alternatives Considered

| Decision | Chosen approach | Rejected alternative | Why |
|----------|----------------|----------------------|-----|
| Candidate lookup for self-service | Look up by `clerkUserId`; fall back to email if not linked | Always require `candidateId` from client | Candidates may not know their candidate id; Clerk user linkage happens after invite acceptance. Fallback by email keeps the API usable. |
| Link candidate row to Clerk user | Patch `candidates.clerkUserId` in `members.sync` when a new `org:candidate` member is created | Keep candidate row unlinked | Without linking, self-service queries rely on email matching which is fragile. Patching in `members.sync` is the one natural seam. |
| Employee profile creation | Upsert directly with `adpSyncStatus: 'pending_credentials'` | Reuse `ensureCaregiverEmployeeProfile` | The helper defaults to `queued`; the task explicitly requires `pending_credentials` for new hires. |
| ADP sync trigger | Schedule `internal.adpOutbound.adpSyncWorker` | Call ADP inline or call `employeeProfiles.createCaregiverProfile` | The task says reuse Phase 1 worker; actions avoid blocking the mutation and inherit retries. |
| Training location | New `convex/onboarding.ts` | Extend `convex/platformTrainingCompletions.ts` | Task explicitly names `onboarding.ts`; keeps candidate lifecycle and training gate separate. |
| Task ordering | Add explicit `order` integer to `candidateTasks` | Order by `_creationTime` | Explicit `order` gives the UI a stable contract and makes tests deterministic. |
| Audit for HR | Add `org:hr` to `audit.ts` allow-list | Create a separate audit mutation | One audit table keeps reporting simple; HR is a legitimate audit actor. |
| Document upload task matching | Mark generic `document_upload` task complete | Map documentType → specific task type | The task says "matching document_upload task"; keep it simple and match the `document_upload` task. |

---

## 4. Exact Files to Create/Edit

### A. `convex/schema.ts` — additive changes

Add to `candidates`:
```ts
.index('by_tenant_clerk_user', ['tenantId', 'clerkUserId'])
```

Add to `applications`:
```ts
fields: v.optional(v.any()),
```
```ts
.index('by_candidate', ['candidateId'])
```

Modify `candidateTasks`:
```ts
candidateTasks: defineTable({
  tenantId: v.id('tenants'),
  candidateId: v.id('candidates'),
  applicationId: v.optional(v.id('applications')),
  type: v.string(),
  status: v.string(),
  order: v.number(),          // NEW
  dueAt: v.optional(v.string()),
  completedAt: v.optional(v.string()),
})
  .index('by_tenant_candidate_status', ['tenantId', 'candidateId', 'status'])
  .index('by_tenant_candidate_order', ['tenantId', 'candidateId', 'order']), // NEW
```

### B. `convex/audit.ts` — role fix

Change the allow-list in `record` from:
```ts
['org:admin', 'org:coordinator', 'org:caregiver']
```
to:
```ts
['org:admin', 'org:coordinator', 'org:caregiver', 'org:hr']
```

### C. `convex/members.ts` — candidate identity linkage

In `sync`, after a new `org:candidate` member is inserted (or when an existing member's role resolves to `org:candidate`), patch the matching `candidates` row where `tenantId` + `email` match and `clerkUserId` is missing:
```ts
if (role === 'org:candidate') {
  const candidate = await ctx.db
    .query('candidates')
    .withIndex('by_tenant_email', (q) =>
      q.eq('tenantId', tenantId).eq('email', normalizeEmail(args.email)),
    )
    .unique()
  if (candidate && !candidate.clerkUserId) {
    await ctx.db.patch(candidate._id, { clerkUserId: args.clerkUserId })
  }
}
```

### D. `convex/candidates.ts` — replace/extend with lifecycle API

Replace existing `get`/`create`/`update` exports with the following exports.

#### Queries

- **`getCandidateProfile({ clerkOrgId })`** — role `org:candidate`
  1. Resolve identity.
  2. Look up `candidates` by `tenantId` + `identity.subject` (`by_tenant_clerk_user`).
  3. If not found, look up by `tenantId` + normalized `identity.email` (`by_tenant_email`).
  4. Return the row or `null`.

- **`listCandidates({ clerkOrgId, status? })`** — role `org:admin` / `org:hr`
  1. Query `candidates` by `tenantId`; optionally filter by `status`.
  2. Order by `createdAt` desc.

- **`getCandidateDetail({ clerkOrgId, candidateId })`** — role `org:admin` / `org:hr`
  1. Fetch candidate, `assertTenantDoc`.
  2. Fetch `applications` by `candidateId` (`by_candidate`).
  3. Fetch `candidateTasks` by `tenantId` + `candidateId` ordered by `order`.
  4. Fetch `documentArchiveItems` with `subjectType: 'candidate'` and `subjectId: candidateId._id` (`by_tenant_subject`).
  5. Return `{ candidate, applications, tasks, documents }`.

- **`listCandidateTasks({ clerkOrgId })`** — role `org:candidate`
  1. Resolve own candidate row (as in `getCandidateProfile`).
  2. Return tasks ordered by `order` asc.

- **`listCandidateTasksForHR({ clerkOrgId, candidateId })`** — role `org:admin` / `org:hr`
  1. Fetch candidate, `assertTenantDoc`.
  2. Return tasks ordered by `order` asc.

#### Mutations

- **`inviteCandidate({ clerkOrgId, displayName, email, phone?, appBaseUrl })`** — role `org:admin` / `org:hr`
  1. Normalize email.
  2. Guard duplicate active candidate: query `by_tenant_email`; if existing status is not `withdrawn`, throw.
  3. Read `CLERK_SECRET_KEY`; call `sendClerkInvitation({ secretKey, inviterUserId: identity.subject, clerkOrgId, emailAddress, role: 'org:candidate', appBaseUrl })`.
  4. Insert `candidates` row: `{ tenantId, email, displayName, phone, status: 'invited', source: 'clerk_invite', createdAt }`.
  5. Seed 5 `candidateTasks` rows in one transaction:
     | order | type |
     |-------|------|
     | 0 | `form_submission` |
     | 1 | `document_upload` |
     | 2 | `background_check` |
     | 3 | `reference_check` |
     | 4 | `platform_training` |
     All with `status: 'pending'`.
  6. Audit `candidate.invited`.
  7. Return `{ candidateId, invitationId }`.

- **`submitApplication({ clerkOrgId, fields })`** — role `org:candidate`
  1. Resolve own candidate row; guard status not in terminal states (`hired`, `withdrawn`).
  2. Upsert `applications` row:
     - Find latest application for candidate; if exists and not hired, patch with `fields`, `status: 'submitted'`, `submittedAt`.
     - Else insert new application.
  3. Update candidate `status` to `applied`.
  4. Mark `form_submission` task complete (`status: 'complete'`, `completedAt`).
  5. Audit `candidate.application.submitted`.

- **`reviewApplication({ clerkOrgId, candidateId, decision, hrNotes? })`** — role `org:admin` / `org:hr`
  1. Fetch candidate, `assertTenantDoc`; require status `applied` or `hr_review`.
  2. Patch latest application: `decision`, `hrNotes`, `reviewedBy`, `decisionAt`, `status: decision`.
  3. Candidate status: `approved` → `hr_review`; `rejected` → `rejected`.
  4. If approved, mark `hr_review` task complete (if such a task exists; optional).
  5. Audit `candidate.application.reviewed` with `{ decision }`.

- **`sendOffer({ clerkOrgId, candidateId })`** — role `org:admin` / `org:hr`
  1. Fetch candidate, `assertTenantDoc`; require status `hr_review`.
  2. Set status to `offer_sent`.
  3. Audit `candidate.offer.sent`.

- **`acceptOffer({ clerkOrgId })`** — role `org:candidate`
  1. Resolve own candidate row; require status `offer_sent`.
  2. Idempotent: if already `accepted`, return success.
  3. Set status to `accepted`.
  4. Mark `offer_acceptance` task complete (if seeded).
  5. Audit `candidate.offer.accepted`.

- **`rejectOffer({ clerkOrgId })`** — role `org:candidate`
  1. Resolve own candidate row; require status `offer_sent`.
  2. Set status to `withdrawn`.
  3. Audit `candidate.offer.rejected`.

- **`hireCandidate({ clerkOrgId, candidateId })`** — role `org:admin` / `org:hr`
  1. Fetch candidate, `assertTenantDoc`; require status `accepted` and `clerkUserId` present.
  2. Normalize candidate email.
  3. Upsert `tenantMembers`:
     - Query `by_tenant_user` for `(tenantId, candidate.clerkUserId)`.
     - If exists, patch role to `org:caregiver`.
     - Else insert `{ tenantId, clerkUserId, role: 'org:caregiver', displayName: candidate.displayName, email }`.
  4. Upsert `employeeProfiles`:
     - Query `by_tenant_clerk_user` for candidate's `clerkUserId`; if found, patch `tenantMemberId`, `displayName`, `email`, `adpSyncStatus: 'pending_credentials'`.
     - Else query `by_tenant` + email filter; if found and `clerkUserId` matches or is empty, patch `clerkUserId`, `tenantMemberId`, `displayName`, `adpSyncStatus: 'pending_credentials'`.
     - Else insert new profile with `adpSyncStatus: 'pending_credentials'`.
  5. Capture `employeeProfileId`.
  6. Schedule ADP sync: `ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, { employeeProfileId })`.
  7. Patch candidate `status` to `hired`.
  8. Patch latest application `hiredEmployeeProfileId`.
  9. Audit `candidate.hired` with `{ employeeProfileId }`.

- **`addCandidateDocument({ clerkOrgId, candidateId?, fileId, documentType, label, expiresAt? })`** — role `org:candidate` / `org:admin` / `org:hr`
  1. Resolve candidate:
     - `org:candidate`: use own candidate row; reject if a different `candidateId` is passed.
     - `org:admin` / `org:hr`: require `candidateId`; fetch and `assertTenantDoc`.
  2. Fetch `files` row for `fileId`; `assertTenantDoc` to ensure tenant ownership.
  3. Insert `documentArchiveItems` row: `{ tenantId, fileId, subjectType: 'candidate', subjectId: candidateId.toString(), category: documentType, status: 'active', expiresAt, source: label, createdAt }`.
  4. Mark `document_upload` task complete if pending.
  5. Audit `candidate.document.added` with `{ documentType }`.

### E. `convex/onboarding.ts` — create new module

- **`completePlatformTraining({ clerkOrgId, trainingId? })`** — role `org:caregiver` / `org:candidate`
  1. Default `trainingId` to `'platform_training'` if omitted.
  2. Query `platformTrainingCompletions` by `by_tenant_user` for `(tenantId, identity.subject)` and filter by `trainingId`.
  3. If a row exists, return it (idempotent).
  4. Insert `{ tenantId, clerkUserId: identity.subject, trainingId, completedAt, status: 'completed' }`.
  5. Audit `platform.training.completed`.

- **`hasPlatformTrainingCompleted({ clerkOrgId, trainingId? })`** — role `org:caregiver` / `org:candidate`
  1. Default `trainingId` to `'platform_training'`.
  2. Query `by_tenant_user` for caller; return whether a matching row exists.

- **`resetPlatformTraining({ clerkOrgId, clerkUserId })`** — role `org:admin`
  1. Query `platformTrainingCompletions` by `by_tenant_user` for `(tenantId, clerkUserId)` and default training id.
  2. Delete the row if found.
  3. Audit `platform.training.reset`.
  4. Return `{ deleted: boolean }`.

### F. Generated API surface

After all edits, run `npx convex codegen` so `_generated/api` includes the new exports.

---

## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

- **Multi-tenancy**: Every function resolves tenant via `requireTenantRole` or `requireTenant`. All fetched docs must pass `assertTenantDoc` before mutation. Candidate self-service functions resolve the candidate by the authenticated Clerk user, never by caller-supplied `candidateId`.
- **Role guards**: `org:coordinator` is intentionally excluded from candidate HR powers per the task. Only `org:admin`/`org:hr` perform HR actions.
- **Candidate identity linkage**: `clerkUserId` is null at invite time. `members.sync` patches it once the candidate accepts the Clerk invitation and logs in. Self-service queries fall back to email lookup until linkage occurs.
- **State-machine integrity**: `sendOffer`, `acceptOffer`, `rejectOffer`, and `hireCandidate` check current `status` and reject invalid transitions with `ConvexError`. `acceptOffer` is idempotent.
- **Duplicate invites**: `inviteCandidate` rejects an active duplicate by email (status not `withdrawn`).
- **Idempotent hire**: `hireCandidate` upserts `tenantMembers` and `employeeProfiles` by `clerkUserId` and email; re-running does not duplicate records. `adpSyncWorker` is itself idempotent via integration events.
- **Idempotent training**: `completePlatformTraining` reads existing completion before insert.
- **PHI/PII**: Candidate email/phone and application `fields` are tenant-scoped. Audit metadata stores ids and action names, not raw application fields or SSNs.
- **Document ownership**: `addCandidateDocument` verifies the `fileId` belongs to the tenant via the `files` table before linking.
- **Clerk invitation failures**: `sendClerkInvitation` is called before any Convex writes in `inviteCandidate`, so a failed invitation rolls back the transaction automatically.

---

## 6. Test Strategy

Create `convex/candidates.test.ts` and `convex/onboarding.test.ts` using the existing `convex-test` + Vitest harness (see `employeeProfiles.test.ts` for patterns).

Helper roles to add:
```ts
function asHR(t, hrId, clerkOrgId) {
  return t.withIdentity({ subject: hrId, org_id: clerkOrgId, org_role: 'org:hr' })
}
function asCandidate(t, candidateId, clerkOrgId) {
  return t.withIdentity({ subject: candidateId, org_id: clerkOrgId, org_role: 'org:candidate' })
}
```

### `convex/candidates.test.ts`

1. `inviteCandidate seeds 5 tasks in order` — call as HR; assert candidate status `invited` and 5 tasks with expected types/orders.
2. `inviteCandidate blocked for org:caregiver` — expect authorization error.
3. `getCandidateProfile returns own row by clerkUserId`.
4. `getCandidateProfile falls back to email when clerkUserId not linked`.
5. `submitApplication marks form_submission task completed and creates application`.
6. `listCandidates filtered by status works for HR`.
7. `getCandidateDetail includes applications, tasks, and documents`.
8. `reviewApplication approved transitions candidate to hr_review`.
9. `sendOffer from hr_review transitions to offer_sent`.
10. `acceptOffer from offer_sent transitions to accepted`.
11. `rejectOffer from offer_sent transitions to withdrawn`.
12. `hireCandidate from accepted creates caregiver member and employee profile with pending_credentials`.
13. `hireCandidate schedules adpSyncWorker with employeeProfileId` (stub ADP env, use fake timers, call `finishAllScheduledFunctions`).
14. `addCandidateDocument marks document_upload task completed`.
15. `listCandidateTasks returns tasks ordered for candidate`.
16. `listCandidateTasksForHR returns tasks for target candidate`.
17. `org:candidate cannot call listCandidates`.
18. `org:hr can call listCandidates`.

### `convex/onboarding.test.ts`

1. `completePlatformTraining is idempotent` — call twice as candidate; assert one completion row.
2. `hasPlatformTrainingCompleted false before, true after`.
3. `resetPlatformTraining deletes completion for admin`.
4. `resetPlatformTraining blocked for non-admin`.

### Broad gates

Run in order after edits:
```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test
```

---

## 7. Rollback / Verification Notes

- **Rollback**: All schema changes are additive indexes/fields. To revert, restore `convex/candidates.ts`, `convex/audit.ts`, and `convex/members.ts` from git, delete `convex/onboarding.ts` and new test files, then run `npx convex codegen`.
- **Verification checklist**:
  - [ ] `npx convex codegen` exits 0.
  - [ ] `npm run lint` exits 0.
  - [ ] `npm run typecheck` exits 0.
  - [ ] `npm run test` exits 0 (including new candidate/onboarding tests).
  - [ ] Manual dev-tenant walkthrough: admin invites candidate → candidate submits application → HR reviews → offer sent → candidate accepts → HR hires → `employeeProfiles` created with `adpSyncStatus: 'pending_credentials'` and ADP worker scheduled.
  - [ ] Complete and reset platform training as respective roles.
- **Deployment note**: Ensure `CLERK_SECRET_KEY` is set in the Convex deployment environment so `sendClerkInvitation` succeeds.
