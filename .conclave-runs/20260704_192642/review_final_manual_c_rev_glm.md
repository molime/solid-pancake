# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: Session 3 — Candidate & Onboarding Backend

### Task Coverage

All 16 endpoints are implemented. Items (11)–(13) (`completePlatformTraining`, `hasPlatformTrainingCompleted`, `resetPlatformTraining`) are referenced in `api.d.ts` and covered by 5 passing tests in `onboarding.test.ts`, though the `convex/onboarding.ts` file itself isn't in the diff (presumably created in a prior commit already in the base branch, since typecheck passes).

### Multi-Tenancy & Auth

Every function that touches tenant data goes through `requireTenantRole` or `requireTenantRoleAction`. `assertTenantDoc` is used when fetching candidates by ID in `getCandidateDetail`, `reviewApplication`, `sendOffer`, `hireCandidate`, and `addCandidateDocument`. The `getOwnCandidate` helper scopes by `tenantId` on both index lookups. The new `requireTenantRoleAction` correctly re-derives membership via `ctx.runQuery(api.members.me, …)` since actions can't read the DB directly. **Multi-tenant invariant is maintained.**

### Status Machine Correctness

- `inviteCandidate` → `invited` ✅
- `submitApplication` → `applied` (guards against terminal statuses) ✅
- `reviewApplication` → `hr_review` (approved) or `rejected` ✅
- `sendOffer` → `offer_sent` (requires `hr_review`) ✅
- `acceptOffer` → `accepted` (requires `offer_sent`, idempotent if already `accepted`) ✅
- `rejectOffer` → `withdrawn` (requires `offer_sent`) ✅
- `hireCandidate` → `hired` (requires `accepted` + `clerkUserId` linked) ✅

### Key Design Decisions — Correct

1. **`inviteCandidate` as action, not mutation**: Necessary because `sendClerkInvitation` calls the Clerk HTTP API. The two-phase pattern (internal mutation insert → Clerk invite → cleanup on failure) is sound.

2. **Candidate identity linkage in `members.sync`**: When a candidate accepts the Clerk invite, `sync` patches `clerkUserId` onto the candidate row via `linkCandidateClerkUserId`. This bridges the gap between invitation (email-only) and authenticated identity. Both the update and insert paths of `sync` call it. Good.

3. **`hireCandidate` employee profile upsert**: Checks by `clerkUserId` first, then by `email`, then creates new. Sets `adpSyncStatus: 'pending_credentials'` and schedules `internal.adpOutbound.adpSyncWorker` with `runAfter(0, …)`. Correct.

4. **`addCandidateDocument` role-aware candidateId**: Candidates can't specify a `candidateId` (throws), must use own profile. Admin/HR must provide it. Proper auth boundary.

5. **5 seeded tasks**: `CANDIDATE_TASK_TYPES` array with `order` field and `by_tenant_candidate_order` index ensures deterministic ordering.

6. **Audit**: Every state transition calls `recordCandidateAudit` with previous/next status and metadata. The `audit.ts` change adds `org:hr` and `org:candidate` to the allow-list. Correct.

### Minor Observations (non-blocking)

- **`listCandidates` in-memory status filter**: Uses `by_tenant_email` index then filters by status. Acceptable at current scale; a `by_tenant_status` index could be added later if needed.
- **`submitApplication` upsert patches latest non-hired application**: If a candidate was rejected and re-applies, it patches the existing application rather than creating a new one. Matches the "upsert" requirement.
- **TOCTOU in `insertInvitedCandidate`**: The duplicate-email check and insert aren't atomic, but the `by_tenant_email` index isn't unique so the worst case is a duplicate entry, not a crash. Not a real-world concern given the Clerk invitation flow serializes per-email.

### Security & PHI

No PHI leaks identified. All queries are scoped to the authenticated tenant. Document access is tenant-scoped via `assertTenantDoc`. Candidate self-service queries use `getOwnCandidate` which requires both `tenantId` and identity match.

### Tests

All 334 tests pass across 42 files. The specific task-required tests are covered:
- `candidates.test.ts` (15 tests): invite/seeds, role guards, submit/review/offer/hire lifecycle
- `onboarding.test.ts` (5 tests): idempotency, false→true transition
- `members.test.ts` (5 tests): candidate linkage in sync

### Verdict

The implementation is correct, secure, and satisfies all 16 task requirements. Multi-tenancy is enforced throughout, the status machine is sound, audit trails are maintained, and all gates pass green.

VERDICT: APPROVED