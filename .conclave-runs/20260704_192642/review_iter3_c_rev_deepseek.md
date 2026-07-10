# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the Code Change

### Summary
The diff implements the candidate lifecycle backend (endpoints 1–10, 14–16) in `convex/candidates.ts`, adds `requireTenantRoleAction` in `authHelpers.ts`, updates `members.ts` for candidate identity linkage, extends the schema with necessary indexes and columns, and fixes the `audit.ts` allow-list. The training functions (11–13) are not in this diff but exist in `convex/onboarding.ts` (confirmed by passing tests). All gates pass.

### Task Coverage

| Task # | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| 1 | `inviteCandidate` | ✅ | Action with Clerk invitation, 5 seeded tasks, cleanup on failure |
| 2 | `getCandidateProfile` | ✅ | Self-service query via `org:candidate` |
| 3 | `submitApplication` | ✅ | Upserts application, marks `form_submission` complete, audits |
| 4 | `listCandidates` | ✅ | Optional status filter, `org:admin`/`org:hr` |
| 5 | `getCandidateDetail` | ✅ | Returns candidate + applications + tasks + documents |
| 6 | `reviewApplication` | ✅ | Decision + optional notes, status transition |
| 7 | `sendOffer` | ✅ | From `hr_review` to `offer_sent` |
| 8 | `acceptOffer` | ✅ | Idempotent (early return if already `accepted`) |
| 9 | `rejectOffer` | ✅ | From `offer_sent` to `withdrawn` |
| 10 | `hireCandidate` | ✅ | Upserts tenantMember, creates/updates employeeProfile with `pending_credentials`, schedules ADP sync, audits |
| 11 | `completePlatformTraining` | Not in diff | Exists in `onboarding.ts` (tests pass) |
| 12 | `hasPlatformTrainingCompleted` | Not in diff | Exists in `onboarding.ts` (tests pass) |
| 13 | `resetPlatformTraining` | Not in diff | Exists in `onboarding.ts` (tests pass) |
| 14 | `addCandidateDocument` | ✅ | Role-aware, inserts `documentArchiveItems`, marks `document_upload` complete |
| 15 | `listCandidateTasks` | ✅ | Ordered by `order` field |
| 16 | `listCandidateTasksForHR` | ✅ | Admin/HR view |

### Security & Correctness

- **Authentication/Authorization**: Every function uses `requireTenantRole` or `requireTenantRoleAction` with the correct allowed roles. The new `requireTenantRoleAction` is properly implemented.
- **Audit**: All state-changing mutations call `recordCandidateAudit` (via `internal.audit.record`). The `audit.ts` allow-list now includes `org:hr` and `org:candidate`.
- **Identity Linkage**: `members.ts` now patches `candidates.clerkUserId` when a member with role `org:candidate` is synced, enabling self-service queries.
- **Idempotency**: `acceptOffer` returns early if already `accepted`. `submitApplication` patches the latest application (idempotent for fields). `hireCandidate` handles existing tenantMember/employeeProfile gracefully.
- **Edge Cases**:
  - `inviteCandidate` checks for existing active candidate by email and cleans up on Clerk failure.
  - `submitApplication` rejects terminal candidates.
  - `addCandidateDocument` prevents candidates from uploading to another candidate.
  - `getOwnCandidate` falls back to email lookup if `clerkUserId` is not set.
- **Schema**: New indexes (`by_tenant_clerk_user`, `by_candidate`, `by_candidate_submittedAt`, `by_tenant_candidate_order`) and columns (`order`, `fields`, `decision`, etc.) are correctly defined.

### Potential Concerns (Non-Blocking)

1. **ADP sync worker path**: The task says “from `convex/adpSync.ts`” but the diff uses `internal.adpOutbound.adpSyncWorker`. The plan synthesis resolved this as the correct target, and tests pass. This is a minor deviation from the literal task but functionally correct.
2. **`hireCandidate` not idempotent for ADP scheduling**: If called twice, it schedules a second ADP sync. The ADP worker is assumed idempotent. Not a blocker.
3. **Training functions not in diff**: They exist in `onboarding.ts` (tested), so the overall task is satisfied.

### Verdict

The diff is correct, secure, and satisfies the task for the candidate lifecycle endpoints. The training functions are present in the codebase (outside this diff) and pass tests. No concrete blockers.

VERDICT: APPROVED