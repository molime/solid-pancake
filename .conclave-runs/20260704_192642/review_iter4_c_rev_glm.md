# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### What's Good

The implementation is thorough and well-structured. All 16 endpoints are present with proper auth guards, lifecycle state-machine enforcement, audit logging, and idempotency where needed. Specific strengths:

- **Auth guards**: Every function goes through `requireTenantRole`/`requireTenantRoleAction` with the correct role sets. The new `requireTenantRoleAction` for the `inviteCandidate` action is correctly implemented.
- **Candidate identity linkage**: `members.ts` now calls `linkCandidateClerkUserId` during sync, which patches the candidate row with the Clerk user ID when the invite is accepted. This is critical for `getCandidateProfile` to work post-acceptance.
- **Idempotency**: `inviteCandidate` returns early if `invitationId` already exists; `acceptOffer` returns early if already accepted; `completePlatformTraining` upserts; `insertInvitedCandidate` reuses withdrawn/incomplete rows.
- **Rollback**: `inviteCandidate` action cleans up the candidate row (and its tasks via `deleteInvitedCandidate`) if the Clerk invitation call fails and the row was newly created.
- **ADP integration**: `hireCandidate` correctly upserts `employeeProfiles` with `adpSyncStatus: 'pending_credentials'` and schedules `internal.adpOutbound.adpSyncWorker` via the scheduler.
- **Audit role fix**: `audit.ts` now allows `org:hr` and `org:candidate` roles.
- **Schema additions**: `order`/`completedAt` on `candidateTasks`, `fields`/review fields on `applications`, `by_tenant_clerk_user` on `candidates`, and the needed indexes are all correct.
- **All three gates pass**: lint, typecheck, and 334 unit tests green.

### Issues Found

#### 1. Missing required test: `org:candidate` cannot call `listShifts` (acceptance criteria miss)

The task explicitly lists this test case:

> "org:candidate cannot call listShifts role guard test"

This test is absent from both `candidates.test.ts` and `onboarding.test.ts`. The `org:candidate` role is new (added via `authHelpers.ts` and `audit.ts` in this diff), so verifying that existing role-gated functions like `listShifts` properly reject it is a necessary guard regression test. The other 7 required test cases are present and passing.

**Fix**: Add a test to `candidates.test.ts` (or `phase2Guards.test.ts`) that seeds a tenant + `org:candidate` member and asserts that calling `api.scheduling.listShifts` (or whichever module exports `listShifts`) with that identity throws/returns forbidden.

#### 2. Minor: `inviteCandidate` rollback gap for reused candidates

When `inviteCandidate` fails at the Clerk invitation step and `result.isNew === false` (reusing a withdrawn/incomplete-invite row), the candidate is left in `'invited'` status with freshly seeded tasks but no `invitationId`. Re-invocation handles this via the `existing?.invitationId` idempotency check, so it's self-healing — not a blocker, just worth noting.

### No Security/PHI/Money Issues

- All tenant-scoped queries filter by `tenantId` and use `assertTenantDoc` for cross-tenant protection.
- `addCandidateDocument` validates file tenant ownership.
- `hireCandidate` requires `candidate.clerkUserId` to be set before proceeding (prevents unlinked hires).
- No PHI fields are stored without proper tenant scoping.
- Clerk secret key is only accessed server-side in the action, never exposed to clients.

---

VERDICT: CHANGES_REQUESTED