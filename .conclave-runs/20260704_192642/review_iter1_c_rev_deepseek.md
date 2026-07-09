# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of SESSION 3 Candidate & Onboarding Backend Changes

### Summary
The diff implements the majority of the 16 required endpoints in `convex/candidates.ts`, with supporting schema changes, audit role expansion, and candidate identity linkage in `convex/members.ts`. The training functions (`completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`) are expected in `convex/onboarding.ts` which is **not present in this diff** – though test results show `onboarding.test.ts` passes, so the file likely exists outside this change set. All gates (lint, typecheck, unit tests) pass.

### What’s Correct
- **Role guards**: All public mutations/queries use `requireTenantRole` with the correct role sets (admin/hr for HR operations, candidate for self-service). The `audit.ts` allow-list is properly extended to include `org:hr` and `org:candidate`.
- **Schema additions**: `candidates.by_tenant_clerk_user` index, `candidateTasks.order` + `by_tenant_candidate_order` index, `applications.fields`/`decision`/`hrNotes` + `by_candidate` index – all match the plan.
- **Candidate identity linkage**: `members.sync` now patches `clerkUserId` on the candidate row when a candidate member is created, enabling self-service queries.
- **Hire flow**: Creates/upserts `tenantMember` with role `org:caregiver`, creates/updates `employeeProfiles` with `adpSyncStatus: 'pending_credentials'`, schedules `adpOutbound.adpSyncWorker`, and records audit. The employee profile upsert logic handles both clerkUserId and email lookups.
- **Document upload**: `addCandidateDocument` correctly distinguishes candidate self-upload (no `candidateId` allowed) from admin/hr upload, inserts `documentArchiveItems` with `subjectType: 'candidate'`, and completes the `document_upload` task.
- **Task completion**: `completeCandidateTask` uses the correct index and marks the task complete with timestamp.
- **Idempotency**: `acceptOffer` returns early if already accepted; `submitApplication` upserts the latest application.

### Concrete Blocker – Orphan Invitation Risk in `inviteCandidate`

**File**: `convex/candidates.ts`, lines 240–300 (the `inviteCandidate` action)

**Problem**: The action calls `sendClerkInvitation` **before** the internal mutation `insertInvitedCandidate`. If the Clerk invitation succeeds but the subsequent database insert fails (e.g., duplicate email, tenant not found, race condition), the invitation is sent but no candidate row is created. This leaves an orphan Clerk invitation that cannot be linked to a candidate record.

Additionally, there is **no duplicate check before sending the invitation**. The internal mutation checks for an existing active candidate, but that check happens after the invitation is already sent. If the email already exists (status `invited`/`applied`/etc.), the Clerk invitation is sent, then the mutation throws, again creating an orphan.

**Required fix**: Either:
1. **Check for duplicate candidate before sending the invitation** (run a query in the action), or
2. **Insert the candidate row first** (via internal mutation), then send the invitation, and if the invitation fails, delete the candidate row (via another internal mutation) or mark it as failed.

The simplest and safest approach is to move the duplicate check into the action and reverse the order: insert candidate first, then send invitation. If the invitation fails, delete the candidate row.

### Additional Observations (Not Blockers)
- The `acceptOffer` mutation attempts to complete a task of type `'offer_acceptance'`, but the seeded tasks (line 20–24) do not include this type. The call to `completeCandidateTask` will silently do nothing. This is harmless but inconsistent – consider either seeding an `offer_acceptance` task or removing the completion call.
- The `hireCandidate` mutation schedules `adpSyncWorker` with `runAfter(0, ...)`. If the mutation is retried (e.g., due to a transient error), multiple workers could be scheduled. The ADP worker should be idempotent, but this is not guaranteed. Consider using a deduplication key or checking if the worker has already been scheduled.
- The `inviteCandidate` action does not use `requireTenantRole` directly; it relies on `api.members.me` and a manual role check. While functionally correct, it deviates from the project convention of using `requireTenantRole` in every public function. Not a blocker, but worth aligning.

### Verdict
The code is largely correct and passes all gates, but the orphan invitation risk in `inviteCandidate` is a concrete bug that must be fixed before merging.

VERDICT: CHANGES_REQUESTED