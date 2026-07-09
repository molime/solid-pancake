# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# Implementation Plan: Candidate & Onboarding Backend + Platform Training Gate

## 1. Restated Goal & Acceptance Criteria

Build the ATRIA-X candidate hiring pipeline and platform-training gate entirely inside Convex, using the existing multi-tenant auth layer.

**Acceptance criteria**

- `convex/candidates.ts` exposes all candidate/HR workflow functions.
- `convex/onboarding.ts` exposes platform-training functions.
- Every function routes through `convex/authHelpers.ts` and is tenant-scoped.
- `inviteCandidate` reuses `convex/invitations.ts` to send a Clerk `org:candidate` invitation, inserts a `candidates` row with status `invited`, and seeds exactly 5 ordered `candidateTasks`.
- `hireCandidate` reuses the Phase 1 `adpSyncWorker` action in `convex/adpSync.ts` to schedule ADP worker creation.
- All state-changing mutations write an audit event.
- `npx convex codegen` is run after schema/helper changes.
- `npm run lint`, `npm run typecheck`, and `npm run test` are green.
- Code style: 2-space indent, single quotes, no semicolons.

---

## 2. Discovery Notes

> **Repo inspection unavailable.** I am working from the supplied context only, so the plan below is based on the standard ATRIA-X stack (React 19 + Vite 8 + TypeScript + Tailwind 4 + React Router 7 + Clerk + Convex) and the task description.

**Files I would inspect first (and the seams I am assuming):**

| File | What I need to verify | Assumption if unchanged |
|------|----------------------|--------------------------|
| `convex/schema.ts` | Existing tables (`tenantMembers`, `employeeProfiles`, `documentArchiveItems`, audit table, role enums) | I will add only the new tables/fields required for this task. |
| `convex/authHelpers.ts` | `requireTenantRole`, role union type, identity extraction | Currently supports `org:admin`, `org:coordinator`, `org:caregiver`. I will extend it to include `org:hr` and `org:candidate`. |
| `convex/invitations.ts` | Clerk invitation mutation signature | I will call its exported invitation mutation/action with `{ email, role: 'org:candidate' }` and adapt if the signature differs. |
| `convex/adpSync.ts` | `adpSyncWorker` action name and argument shape | I will schedule it with `{ employeeProfileId }`; adapt if Phase 1 uses a different payload. |
| `convex/employeeProfiles.ts` (if it exists) | Table shape and indexes | `hireCandidate` upserts an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`. |
| Existing test harness | How identities/roles are mocked | I will write tests using the same pattern as existing Convex tests. |

---

## 3. Alternatives Considered

| Alternative | Why not chosen |
|-------------|----------------|
| Put training mutations in `candidates.ts` instead of a separate `onboarding.ts` | Training is a distinct platform-wide gate used by both candidates and caregivers. A dedicated module keeps the candidate pipeline focused and avoids circular imports. |
| Call Clerk directly from `candidates.ts` | The task explicitly says to reuse `convex/invitations.ts`. Centralizing invitations avoids duplicating Clerk org-role logic and keeps audit/logging consistent. |
| Run ADP sync inline instead of scheduling `adpSyncWorker` | Scheduling the existing action reuses Phase 1 infrastructure, keeps the hire mutation fast, and lets ADP retries/failures live in one place. |
| Store training completion inside `tenantMembers` | A separate `platformTrainingCompletions` table is cleaner: it supports idempotent upsert, admin reset, and future training metadata (course version, expiresAt). |

---

## 4. Exact Files to Create/Edit

### 4.1 `convex/schema.ts` — additive schema changes

Add or extend the following tables/indexes. Do **not** modify generated files.

```ts
// candidates pipeline
candidates: defineTable({
  tenantId: v.id('tenants'),          // or v.string if tenantId is Clerk org id
  clerkUserId: v.optional(v.string()),
  email: v.string(),
  phone: v.optional(v.string()),
  displayName: v.string(),
  status: v.union(
    v.literal('invited'),
    v.literal('applied'),
    v.literal('hr_review'),
    v.literal('offer_sent'),
    v.literal('accepted'),
    v.literal('rejected'),
    v.literal('withdrawn'),
    v.literal('hired')
  ),
  invitedAt: v.number(),
  hiredAt: v.optional(v.number()),
})
  .index('by_tenant_email', ['tenantId', 'email'])
  .index('by_tenant_status', ['tenantId', 'status'])
  .index('by_clerk_user', ['clerkUserId'])

candidateTasks: defineTable({
  tenantId: v.id('tenants'),
  candidateId: v.id('candidates'),
  taskKey: v.string(),               // e.g. 'form_submission'
  label: v.string(),
  status: v.union(v.literal('pending'), v.literal('completed')),
  order: v.number(),
  completedAt: v.optional(v.number()),
})
  .index('by_candidate', ['candidateId'])
  .index('by_candidate_order', ['candidateId', 'order'])

candidateApplications: defineTable({
  tenantId: v.id('tenants'),
  candidateId: v.id('candidates'),
  fields: v.any(),                   // application JSON
  decision: v.optional(v.union(v.literal('approved'), v.literal('rejected'))),
  hrNotes: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  reviewedAt: v.optional(v.number()),
})
  .index('by_candidate', ['candidateId'])

// platform training gate
platformTrainingCompletions: defineTable({
  tenantId: v.id('tenants'),
  clerkUserId: v.string(),
  completedAt: v.number(),
})
  .index('by_tenant_user', ['tenantId', 'clerkUserId'])

// if not already present
documentArchiveItems: defineTable({
  tenantId: v.id('tenants'),
  candidateId: v.id('candidates'),
  fileId: v.string(),
  documentType: v.string(),
  label: v.string(),
  expiresAt: v.optional(v.number()),
  uploadedBy: v.string(),            // clerkUserId
  uploadedAt: v.number(),
})
  .index('by_candidate', ['candidateId'])

// lightweight audit (skip if project already has one)
auditEvents: defineTable({
  tenantId: v.id('tenants'),
  actorClerkUserId: v.string(),
  action: v.string(),
  targetId: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
})
  .index('by_tenant', ['tenantId'])
```

### 4.2 `convex/authHelpers.ts` — role extensions

Add to the role union:

```ts
export type OrgRole =
  | 'org:admin'
  | 'org:hr'          // NEW
  | 'org:coordinator'
  | 'org:caregiver'
  | 'org:candidate'   // NEW
```

Add helpers:

- `requireAdminOrHR(ctx)` — throws if caller lacks `org:admin` or `org:hr`.
- `requireCandidate(ctx)` — verifies `org:candidate` and returns the caller’s candidate row (lookup by `clerkUserId`, fallback to email if `clerkUserId` is not yet linked).
- `requireAdminOrHRForCandidate(ctx, candidateId)` — verifies admin/HR role and that the candidate belongs to the caller’s tenant.
- `requireCandidateOrAdminHRForCandidate(ctx, candidateId?)` — used by `addCandidateDocument`.

### 4.3 `convex/audit.ts` (new, or extend existing audit module)

A small internal helper:

```ts
export async function logAudit(ctx, { action, targetId, metadata }) {
  const identity = await getAuthOrThrow(ctx)
  await ctx.db.insert('auditEvents', {
    tenantId: identity.tenantId,
    actorClerkUserId: identity.clerkUserId,
    action,
    targetId,
    metadata,
    createdAt: Date.now(),
  })
}
```

### 4.4 `convex/candidates.ts` — new module

#### Queries

- `getCandidateProfile()` — `org:candidate` returns own `candidates` row.
- `listCandidates({ status? })` — `org:admin`/`org:hr`, tenant-scoped, optional status filter.
- `getCandidateDetail({ candidateId })` — `org:admin`/`org:hr` returns `{ candidate, application, tasks, documents }`.
- `listCandidateTasks()` — `org:candidate` returns own tasks ordered by `order`.
- `listCandidateTasksForHR({ candidateId })` — `org:admin`/`org:hr` returns ordered tasks.

#### Mutations

- `inviteCandidate({ displayName, email, phone? })`
  1. `requireAdminOrHR(ctx)`.
  2. Idempotency check: if a candidate with same `tenantId + email` already exists and is not `invited`, throw; if `invited`, return existing candidate id without re-seeding tasks.
  3. Call `convex/invitations.ts` invitation mutation/action with `role: 'org:candidate'`.
  4. Insert `candidates` row: `status: 'invited'`.
  5. Seed 5 tasks in fixed order:
     1. `form_submission`
     2. `document_upload`
     3. `background_check`
     4. `hr_review`
     5. `offer_acceptance`
  6. `logAudit('candidate.invited', candidateId)`.

- `submitApplication({ fields })`
  1. `requireCandidate(ctx)` → candidate row.
  2. Upsert `candidateApplications` by `candidateId`.
  3. Update candidate `status` to `applied`.
  4. Mark `form_submission` task completed.
  5. `logAudit('candidate.application.submitted', candidateId)`.

- `reviewApplication({ candidateId, decision, hrNotes? })`
  1. `requireAdminOrHRForCandidate(ctx, candidateId)`.
  2. Update `candidateApplications` with decision/notes/reviewedAt.
  3. If `decision === 'approved'`: candidate `status` → `hr_review`, mark `hr_review` task completed.
  4. If `decision === 'rejected'`: candidate `status` → `rejected`.
  5. `logAudit('candidate.application.reviewed', candidateId, { decision })`.

- `sendOffer({ candidateId })`
  1. `requireAdminOrHRForCandidate(ctx, candidateId)`.
  2. Guard candidate `status === 'hr_review'`.
  3. Set `status` → `offer_sent`.
  4. `logAudit('candidate.offer.sent', candidateId)`.

- `acceptOffer()`
  1. `requireCandidate(ctx)` → candidate row.
  2. Guard `status === 'offer_sent'`.
  3. Set `status` → `accepted`.
  4. Mark `offer_acceptance` task completed.
  5. `logAudit('candidate.offer.accepted', candidateId)`.

- `rejectOffer()`
  1. `requireCandidate(ctx)` → candidate row.
  2. Guard `status === 'offer_sent'`.
  3. Set `status` → `withdrawn`.
  4. `logAudit('candidate.offer.rejected', candidateId)`.

- `hireCandidate({ candidateId })`
  1. `requireAdminOrHRForCandidate(ctx, candidateId)`.
  2. Guard `status === 'accepted'` and `clerkUserId` is present.
  3. Upsert `tenantMembers` row for `(tenantId, clerkUserId)` with role `org:caregiver`.
  4. Upsert `employeeProfiles` row for `(tenantId, clerkUserId)`:
     - `candidateId`
     - `role: 'org:caregiver'`
     - `adpSyncStatus: 'pending_credentials'`
  5. Capture `employeeProfileId`.
  6. Schedule `adpSyncWorker` via `ctx.scheduler.runAfter(0, api.adpSync.adpSyncWorker, { employeeProfileId })`.
  7. Set candidate `status` → `hired`, `hiredAt: Date.now()`.
  8. `logAudit('candidate.hired', candidateId, { employeeProfileId })`.

- `addCandidateDocument({ candidateId?, fileId, documentType, label, expiresAt? })`
  1. Resolve candidate id:
     - `org:candidate`: `candidateId` defaults to own candidate; reject if a different id is passed.
     - `org:admin`/`org:hr`: `candidateId` required; verify tenant access.
  2. Insert `documentArchiveItems` row.
  3. Mark `document_upload` task completed if pending.
  4. `logAudit('candidate.document.added', candidateId, { documentType })`.

### 4.5 `convex/onboarding.ts` — new module

- `completePlatformTraining()`
  1. Verify caller has `org:caregiver` or `org:candidate`.
  2. Idempotency: query `platformTrainingCompletions` by `(tenantId, clerkUserId)`. If exists, return.
  3. Otherwise insert row with `completedAt: Date.now()`.
  4. `logAudit('platform.training.completed', clerkUserId)`.

- `hasPlatformTrainingCompleted()`
  1. Verify caller has `org:caregiver` or `org:candidate`.
  2. Return boolean from existence of completion row.

- `resetPlatformTraining({ clerkUserId })`
  1. `requireTenantRole(ctx, 'org:admin')`.
  2. Delete completion row scoped to caller’s tenant and the provided `clerkUserId`.
  3. `logAudit('platform.training.reset', clerkUserId)`.

### 4.6 `convex/invitations.ts` and `convex/adpSync.ts`

- Inspect only. Make no edits unless their exported signatures do not match the assumed contracts above. If they differ, update the call sites in `candidates.ts`, not the reused modules themselves.

---

## 5. Data / Auth / Security / PHI / Idempotency Edge Cases

| Concern | Handling |
|---------|----------|
| **Multi-tenancy** | Every read/write is filtered by `tenantId` from `authHelpers`. Admin/HR functions verify the target candidate belongs to the caller’s tenant. |
| **Role guards** | `org:admin`/`org:hr` for HR/admin functions; `org:candidate` for candidate functions; `org:caregiver`/`org:candidate` for training; `org:admin` for reset. |
| **Candidate identity linking** | `clerkUserId` may be null at invite time. `getCandidateProfile`/`submitApplication` look up by `clerkUserId` first, then by email from the Clerk token. |
| **Duplicate invites** | `inviteCandidate` is idempotent: if an `invited` candidate with the same email exists, return it; otherwise throw on duplicate email in another status. |
| **State-machine guards** | `sendOffer`, `acceptOffer`, `rejectOffer`, and `hireCandidate` check the current `status` and throw `ConvexError` on invalid transitions. |
| **Idempotent training** | `completePlatformTraining` inserts only if no completion row exists for `(tenantId, clerkUserId)`. |
| **PHI/PII** | Application `fields` and candidate email/phone are tenant-scoped. Audit logs store action metadata but avoid logging raw sensitive fields (e.g., SSN). |
| **Document expiry** | `expiresAt` is optional and stored as a Unix timestamp. |
| **Admin training reset** | Only `org:admin` can reset; deletion is scoped to the same tenant. |

---

## 6. Test Strategy

Create `convex/__tests__/candidates.test.ts` and `convex/__tests__/onboarding.test.ts`.

### Candidate tests

1. **`inviteCandidate` seeds 5 tasks in order**
   - Call as `org:hr`.
   - Assert 5 `candidateTasks` rows exist with `status: 'pending'` and `order` 0..4.

2. **`inviteCandidate` blocked for `org:caregiver`**
   - Call as `org:caregiver`, expect authorization error.

3. **`submitApplication` marks `form_submission` completed**
   - Invite candidate, call `submitApplication` as candidate.
   - Assert application row exists and `form_submission` task is `completed`.

4. **`hireCandidate` creates employee profile and schedules ADP sync**
   - Move candidate through pipeline to `accepted` (invite → submit → approve → offer → accept).
   - Call `hireCandidate` as `org:hr`.
   - Assert `employeeProfiles` row exists with `adpSyncStatus: 'pending_credentials'`.
   - Assert `adpSyncWorker` was scheduled with the new `employeeProfileId` (use Phase 1 mock/scheduler spy).

5. **`org:hr can call listCandidates`**
   - Call as `org:hr`, assert array returned.

6. **`org:candidate cannot call listShifts`**
   - Call existing `listShifts` (or another caregiver-only query) as `org:candidate`, expect authorization error.

### Onboarding tests

7. **`completePlatformTraining` is idempotent**
   - Call twice as `org:candidate`; assert only one `platformTrainingCompletions` row.

8. **`hasPlatformTrainingCompleted` false before, true after**
   - Assert false initially.
   - Call `completePlatformTraining`.
   - Assert true.

### Gates

- `npx convex codegen`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

---

## 7. Rollback / Verification Notes

- **Rollback:** All changes are additive. If needed, revert the commit and re-run `npx convex codegen`. No destructive migrations are required.
- **Verification after deploy/codegen:**
  1. `npx convex codegen` succeeds.
  2. `npm run lint` clean.
  3. `npm run typecheck` clean.
  4. `npm run test` passes.
  5. In a dev tenant, manually run `inviteCandidate` and verify the Clerk invitation is sent and 5 tasks appear.
  6. Walk a candidate through the full pipeline to `hireCandidate` and confirm the ADP worker is scheduled.
  7. Complete and reset platform training as the respective roles to confirm the gate works.

---

**Next step:** Inspect `convex/schema.ts`, `convex/authHelpers.ts`, `convex/invitations.ts`, and `convex/adpSync.ts` to confirm the assumed contracts, then implement the files above in the order: schema → auth helpers → audit helper → candidates → onboarding → tests → codegen → lint/typecheck/test.