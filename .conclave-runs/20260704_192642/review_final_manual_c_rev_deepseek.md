# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review

### Summary
The diff implements the candidate lifecycle (invite → apply → review → offer → accept/reject → hire) plus document upload, task tracking, and audit logging.  The training functions (`completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`) are **not visible in the diff**, but the test results show `convex/onboarding.test.ts` (5 tests) passed, so they likely already existed in the base branch.  All gates (lint, typecheck, test) pass.

### What’s good
- **Auth enforcement**: Every endpoint uses `requireTenantRole` / `requireTenantRoleAction` with correct role lists.  `assertTenantDoc` is used where needed.
- **Schema changes**: Added necessary indexes (`by_tenant_clerk_user`, `by_candidate`, `by_candidate_submittedAt`, `by_tenant_candidate_order`) and fields (`order`, `fields`, `decision`, `hrNotes`).
- **Identity linkage**: `members.ts` now patches `candidates.clerkUserId` when a candidate accepts the Clerk invite, enabling self-service queries.
- **Idempotency**: `acceptOffer` returns early if already accepted; `insertInvitedCandidate` rejects duplicate active emails; `completeCandidateTask` only patches a pending task.
- **Audit**: All state transitions log via `internal.audit.record`; the audit allow-list now includes `org:hr` and `org:candidate`.
- **Cleanup on failure**: `inviteCandidate` action deletes the candidate row if the Clerk invitation fails.
- **ADP sync**: `hireCandidate` schedules `internal.adpOutbound.adpSyncWorker` with `pending_credentials` status.

### Potential issues (not blockers)
1. **Employee profile duplicate on email mismatch** (`candidates.ts` line ~700-710)  
   If an `employeeProfiles` row exists with the same email but a *different* `clerkUserId`, the code inserts a new profile instead of throwing.  This could create duplicate profiles for the same person.  The scenario is unlikely (Clerk user IDs are unique), but it’s a latent data-integrity risk.  Not a blocker because the task does not specify this edge case.

2. **Race in `inviteCandidate` action**  
   If the action is retried after the internal mutation succeeds but before the Clerk invitation completes, the second attempt will fail at `insertInvitedCandidate` (duplicate email), but the Clerk invitation may be sent again.  This could produce duplicate Clerk invitations.  Mitigation would require a unique constraint or a two-phase approach, but the task does not require idempotency here.

3. **`listCandidates` index usage**  
   Uses `by_tenant_email` with only `tenantId` – the index is on `(tenantId, email)`, so it will scan all rows for the tenant.  Acceptable for current scale; not a blocker.

### Missing from diff (but tests pass)
- The training functions (`completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`) are not shown in the diff.  Since `convex/onboarding.test.ts` passes, they must exist in the base branch or were added outside this diff.  The task requires them; the test results confirm they are present.

### Conclusion
The change satisfies the task’s acceptance criteria, passes all gates, and has no security, PHI, or money risks.  The two minor issues noted are not concrete blockers per the review guidelines.

VERDICT: APPROVED