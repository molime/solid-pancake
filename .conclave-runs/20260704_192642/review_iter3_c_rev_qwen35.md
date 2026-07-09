# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Candidate & Onboarding Backend Implementation

### Summary
This is a substantial implementation (810 lines added to candidates.ts) that implements the candidate lifecycle management system. The code passes all gates (lint, typecheck, 334 tests). However, there's a critical missing file that prevents full verification.

### ✅ What's Correct

**Schema Changes (convex/schema.ts):**
- `candidates` table: Added `by_tenant_clerk_user` index for self-lookup after Clerk invite acceptance
- `applications` table: Added `fields`, `decision`, `hrNotes` columns plus `by_candidate` and `by_candidate_submittedAt` indexes
- `candidateTasks` table: Added `order` field and `by_tenant_candidate_order` index for deterministic ordering

**Auth & Security:**
- All mutations/queries properly use `requireTenantRole` with correct role restrictions:
  - `inviteCandidate`: org:admin, org:hr (via action)
  - `getCandidateProfile`, `submitApplication`, `acceptOffer`, `rejectOffer`: org:candidate only
  - `listCandidates`, `getCandidateDetail`, `reviewApplication`, `sendOffer`, `hireCandidate`: org:admin, org:hr
  - `addCandidateDocument`: org:candidate, org:admin, org:hr with candidateId validation
- `audit.ts` updated to allow org:hr and org:candidate roles (line 19)
- `authHelpers.ts` adds `requireTenantRoleAction` for action-level auth (lines 190-215)

**Candidate Lifecycle Flow:**
- `inviteCandidate` (lines 283-335): Action that creates candidate + 5 seeded tasks, sends Clerk invitation, has cleanup on failure
- `getOwnCandidate` helper (lines 52-70): Looks up by clerkUserId first, then by normalized email fallback
- `hireCandidate` (lines 628-724): Properly checks `accepted` status, verifies `clerkUserId` linkage, upserts tenantMember as org:caregiver, creates employeeProfile with `pending_credentials`, schedules ADP sync worker

**Members Linkage (convex/members.ts):**
- `linkCandidateClerkUserId` function (lines 14-30) patches candidate.clerkUserId when org:candidate member syncs
- Called in both existing-member and new-member paths in `sync` mutation

**Idempotency:**
- `acceptOffer` returns early if already accepted (line 598)
- `hireCandidate` checks for existing tenantMember and employeeProfile before upserting

### ❌ Critical Blocker: Missing onboarding.ts

**The task explicitly requires:**
> "Build in convex/candidates.ts (and **convex/onboarding.ts for training**)"

**Required training endpoints NOT visible in this diff:**
1. `completePlatformTraining()` - org:caregiver or org:candidate, idempotent
2. `hasPlatformTrainingCompleted()` - caregiver/candidate returns boolean  
3. `resetPlatformTraining({ clerkUserId })` - org:admin only

The diff shows only 6 files changed, and `convex/onboarding.ts` is **not among them**. While `api.d.ts` references the onboarding module and tests pass (including `convex/onboarding.test.ts` with 5 tests), I cannot verify:
- The training functions exist with correct signatures
- `completePlatformTraining` is truly idempotent (task requirement)
- Role guards match specifications
- Integration with `platformTrainingCompletions` table

This is a concrete acceptance criteria gap - 3 of 16 required endpoints are unverified.

### ⚠️ Minor Concerns

1. **Redundant auth in insertInvitedCandidate** (line 340): Internal mutation calls `requireTenantRole` even though the action already validated. Not a security issue but adds latency.

2. **ADP worker path**: Uses `internal.adpOutbound.adpSyncWorker` (line 695) instead of `internal.adpSync.adpSyncWorker`. The plan synthesis noted this was intentional ("correct scheduler target is internal.adpOutbound.adpSyncWorker"), but I cannot verify the worker signature matches without seeing adpOutbound.ts.

3. **Application status field**: The schema diff shows `status` in the index but not in the field definition. May be pre-existing, but worth confirming the field exists for the `by_tenant_status` index to work.

### Tests
All 334 tests pass including `convex/candidates.test.ts` (15 tests) and `convex/onboarding.test.ts` (5 tests). However, without seeing onboarding.ts source, I cannot confirm the training tests cover the required behavior (idempotency, role guards, boolean return type).

---

### Required Changes

1. **Include convex/onboarding.ts in the diff** with all three training endpoints:
   - `completePlatformTraining()` - must be idempotent (check existing completion before inserting)
   - `hasPlatformTrainingCompleted()` - return boolean
   - `resetPlatformTraining({ clerkUserId })` - org:admin only, deletes completion row

2. **Verify adpOutbound.adpSyncWorker signature** accepts `{ employeeProfileId: Id<'employeeProfiles'> }` as called on line 695

VERDICT: CHANGES_REQUESTED