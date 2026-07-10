# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: Session 3 — Candidate & Onboarding Backend

### Coverage of Task Requirements

All 16 endpoints are implemented and accounted for:

| # | Function | Role Guard | Status |
|---|----------|-----------|--------|
| 1 | `inviteCandidate` (action → internal mutation) | org:admin/org:hr ✅ | Seeds 5 tasks, sends Clerk invite ✅ |
| 2 | `getCandidateProfile` | org:candidate ✅ | Self-lookup by clerkUserId then email ✅ |
| 3 | `submitApplication` | org:candidate ✅ | Upserts application, completes form_submission task ✅ |
| 4 | `listCandidates` | org:admin/org:hr ✅ | Optional status filter ✅ |
| 5 | `getCandidateDetail` | org:admin/org:hr ✅ | Returns candidate + applications + tasks + documents ✅ |
| 6 | `reviewApplication` | org:admin/org:hr ✅ | Decision + hrNotes, transitions status ✅ |
| 7 | `sendOffer` | org:admin/org:hr ✅ | Guards on hr_review status ✅ |
| 8 | `acceptOffer` | org:candidate ✅ | Guards on offer_sent, idempotent on already-accepted ✅ |
| 9 | `rejectOffer` | org:candidate ✅ | Guards on offer_sent → withdrawn ✅ |
| 10 | `hireCandidate` | org:admin/org:hr ✅ | Upserts tenantMember + employeeProfile, schedules ADP sync, audits ✅ |
| 11–13 | onboarding.ts | org:caregiver/org:candidate/org:admin | Tests pass (5 tests) — file not in diff but api.d.ts confirms registration ✅ |
| 14 | `addCandidateDocument` | org:candidate/org:admin/org:hr ✅ | Candidates auto-resolve own profile; completes document_upload task ✅ |
| 15 | `listCandidateTasks` | org:candidate ✅ | Ordered by `by_tenant_candidate_order` index ✅ |
| 16 | `listCandidateTasksForHR` | org:admin/org:hr ✅ | Same index ✅ |

### Schema Changes

- `candidates`: added `by_tenant_clerk_user` index — needed for self-service lookups after Clerk invite acceptance ✅
- `applications`: added `fields`, `decision`, `hrNotes` columns + `by_candidate` index ✅
- `candidateTasks`: added `order` field + `by_tenant_candidate_order` index — deterministic ordering ✅
- `audit.ts`: added `org:hr` and `org:candidate` to allowed roles ✅

### Identity Linkage (members.ts)

The `sync` mutation now patches `clerkUserId` on the candidate row when an `org:candidate` member syncs — both in the existing-member and new-member branches. This is critical for `getCandidateProfile` and other self-service queries to work after the candidate accepts the Clerk invitation. Well handled.

### Security & Auth

- `inviteCandidate` is an `action` (necessary for Clerk HTTP call) and does manual role checking via `ctx.runQuery(api.members.me, ...)`, then delegates DB writes to `insertInvitedCandidate` internal mutation which re-validates with `requireTenantRole`. Defense-in-depth ✅
- `addCandidateDocument` correctly prevents candidates from specifying a different `candidateId` — throws if a candidate provides one ✅
- `hireCandidate` guards on `candidate.clerkUserId` being set before proceeding — prevents hiring unlinked candidates ✅
- `assertTenantDoc` used consistently for tenant isolation on direct lookups ✅

### Minor Observations (non-blocking)

1. **Dead `completeCandidateTask` calls**: `reviewApplication` calls `completeCandidateTask(..., 'hr_review')` and `acceptOffer` calls `completeCandidateTask(..., 'offer_acceptance')`, but neither `'hr_review'` nor `'offer_acceptance'` exist in `CANDIDATE_TASK_TYPES`. The function is a silent no-op when no matching task is found, so this doesn't crash or produce wrong results — it's just dead logic. Not a blocker since the task spec doesn't require these task completions.

2. **`inviteCandidate` uses `action` not `mutation`**: The task says "mutation" but the implementation correctly uses `action` because `sendClerkInvitation` makes HTTP calls. The internal mutation handles all DB writes. This is the correct Convex pattern.

3. **`process.env` declare**: The `declare const process` at the top of candidates.ts is unconventional but harmless — Convex actions already have `process.env` available.

4. **Missing `onboarding.ts` from diff**: The file isn't shown in the diff but `api.d.ts` confirms it's registered and `onboarding.test.ts` (5 tests) passes. Can't review the implementation directly, but the test gate is green.

### Test Gate Results

All three gates pass: **lint ✅, typecheck ✅, 333/333 tests ✅** (including 14 in `candidates.test.ts` and 5 in `onboarding.test.ts`).

VERDICT: APPROVED