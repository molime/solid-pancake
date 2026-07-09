# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of SESSION 3 Candidate & Onboarding Backend Changes

### Summary
The diff implements the majority of the 16 required endpoints for candidate management, plus supporting changes in `authHelpers.ts`, `members.ts`, `schema.ts`, and `audit.ts`. All gates (lint, typecheck, unit tests) pass. However, there is a **concrete correctness bug** in the `getLatestApplication` helper that affects three mutations (`submitApplication`, `reviewApplication`, `hireCandidate`). This must be fixed before approval.

---

### What’s Good
- **Role guards** are correctly applied via `requireTenantRole` / `requireTenantRoleAction` for every endpoint.
- **`inviteCandidate`** action correctly inserts candidate + 5 seeded tasks, sends Clerk invitation with role `org:candidate`, and rolls back on failure.
- **`submitApplication`** upserts application, marks `form_submission` task completed, and records audit.
- **`acceptOffer`** is idempotent (allows re-call when already `accepted`).
- **`hireCandidate`** upserts `tenantMember` with `org:caregiver`, creates/updates `employeeProfile` with `adpSyncStatus: 'pending_credentials'`, schedules `adpOutbound.adpSyncWorker`, and records audit.
- **`addCandidateDocument`** correctly resolves candidate identity for self-service vs admin/HR uploads, inserts `documentArchiveItems`, and completes `document_upload` task.
- **Candidate identity linkage** in `members.ts` sync mutation patches `clerkUserId` on the candidate row when a member with role `org:candidate` is created – essential for self-service queries.
- **`audit.ts`** allow-list updated to include `org:hr` and `org:candidate` so candidate mutations can record audits.
- **Schema indexes** (`by_tenant_clerk_user`, `by_candidate`, `by_tenant_candidate_order`) are correctly added.

---

### Blocker: `getLatestApplication` uses incorrect ordering

**File:** `convex/candidates.ts`, lines 30–37

```ts
async function getLatestApplication(
  ctx: AuthContext,
  candidateId: Id<'candidates'>,
) {
  return ctx.db
    .query('applications')
    .withIndex('by_candidate', (q) => q.eq('candidateId', candidateId))
    .order('desc')
    .first()
}
```

The index `by_candidate` is defined as `['candidateId']` (single field). Calling `.order('desc')` on this index orders by `candidateId` descending, which is **not meaningful** – it will return an arbitrary application, not the most recent one. This breaks the upsert logic in `submitApplication`, the application selection in `reviewApplication`, and the `hiredEmployeeProfileId` patch in `hireCandidate`.

**Fix required:**  
Add a compound index on `['candidateId', 'submittedAt']` (or `['candidateId', '_creationTime']` if `submittedAt` is not always set) and use that index for ordering. For example:

```ts
// In schema.ts
.index('by_candidate_submittedAt', ['candidateId', 'submittedAt'])

// In getLatestApplication
.withIndex('by_candidate_submittedAt', (q) =>
  q.eq('candidateId', candidateId))
.order('desc')
.first()
```

Alternatively, collect all applications and sort in memory (acceptable given small cardinality per candidate), but the index approach is cleaner and more performant.

---

### Other Observations (non-blocking)

- **`listCandidates`** filters by status in memory after collecting all candidates. For large tenants this could be slow, but acceptable for current scale.
- **`inviteCandidate`** uses `requireTenantRoleAction` (new helper) which calls `api.members.me` via `ctx.runQuery`. This is correct but relies on the `members.me` query existing – tests pass, so it does.
- **`onboarding.ts`** is not shown in the diff, but `convex/onboarding.test.ts` exists and passes. The `_generated/api.d.ts` diff includes the `onboarding` module, so the file is present. Cannot verify its content from this diff, but tests indicate it satisfies the training gate requirements.
- **`adpSyncWorker`** is scheduled as `internal.adpOutbound.adpSyncWorker` rather than from `adpSync.ts` as stated in the task. The plan synthesis confirmed the correct target is `adpOutbound`, and tests pass, so this is fine.
- **`sendClerkInvitation`** is called with `role: 'org:candidate'`. The existing `invitations.ts` function must accept this parameter – tests pass, so it does.

---

### Verdict

The code is well-structured, secure, and covers nearly all acceptance criteria. The one concrete bug in `getLatestApplication` ordering must be fixed to ensure correct application upsert and review behavior. Once that is resolved, the implementation is ready.

**VERDICT: CHANGES_REQUESTED**