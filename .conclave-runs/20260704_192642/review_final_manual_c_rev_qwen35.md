# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 3 Candidate & Onboarding Backend

### Summary
The diff implements most of the candidate lifecycle functionality in `convex/candidates.ts` with proper auth guards, audit logging, and multi-tenancy enforcement. However, **critical onboarding/training functions are missing from the visible diff**.

---

### ✅ What's Correct

**Auth & Multi-tenancy:**
- `inviteCandidate` (line 254) uses `requireTenantRoleAction` for admin/hr only
- `getCandidateProfile` (line 108) gated to `org:candidate`
- `hireCandidate` (line 574) gated to admin/hr, validates `accepted` status
- All queries/mutations pass `clerkOrgId` through `requireTenantRole`
- `assertTenantDoc` used on candidate lookups (line 152, 590)

**Candidate Lifecycle:**
- `inviteCandidate` seeds 5 tasks with `order` field (lines 329-335)
- `submitApplication` marks `form_submission` task complete (line 401)
- `hireCandidate` creates/updates `tenantMember` as `org:caregiver` (lines 607-622)
- `hireCandidate` creates `employeeProfile` with `adpSyncStatus: 'pending_credentials'` (lines 624-655)
- `hireCandidate` schedules `internal.adpOutbound.adpSyncWorker` (lines 658-661)
- Status transitions enforced (e.g., `sendOffer` requires `hr_review` at line 459)

**Schema Updates:**
- `candidates` table: added `by_tenant_clerk_user` index (line 332)
- `applications` table: added `fields`, `decision`, `hrNotes`, proper indexes (lines 338-347)
- `candidateTasks`: added `order` field and `by_tenant_candidate_order` index (lines 355-362)

**Audit Integration:**
- `audit.ts` updated to allow `org:hr` and `org:candidate` (line 19)
- Candidate actions logged via `recordCandidateAudit` helper

**Members Sync:**
- `linkCandidateClerkUserId` links candidate to clerkUserId on invite acceptance (lines 17-30, 167-187)

---

### ❌ Critical Issues

**1. Missing onboarding.ts Implementation (BLOCKER)**

The task explicitly requires:
- (11) `mutation completePlatformTraining()` - idempotent
- (12) `query hasPlatformTrainingCompleted()` - returns boolean
- (13) `mutation resetPlatformTraining({ clerkUserId })` - admin only

The `api.d.ts` diff shows `onboarding` module is imported (line 30), and tests reference `convex/onboarding.test.ts`, but **the actual `convex/onboarding.ts` file is NOT in the diff**. I cannot verify:
- Training completion idempotency
- Proper role guards (caregiver/candidate for complete, admin for reset)
- `platformTrainingCompletions` table usage

**Request:** Show `convex/onboarding.ts` diff to verify training gate implementation.

---

### ⚠️ Potential Issues

**1. Race Condition in members.ts sync (line 167-187)**

```typescript
if (role === 'org:candidate') {
  await linkCandidateClerkUserId(ctx, tenantId, args.clerkUserId, args.email)
}
```

This runs in `sync` mutation which may be called multiple times during Clerk webhook processing. The `linkCandidateClerkUserId` function checks `!candidate.clerkUserId` before patching, which provides basic idempotency, but there's no uniqueness constraint preventing duplicate candidate rows if sync runs concurrently. The existing `by_tenant_email` index with `.unique()` in `insertInvitedCandidate` (line 308) protects against duplicates at invite time, but not during sync.

**Recommendation:** Add a database-level uniqueness constraint or use `ctx.db.insert` with conflict handling.

**2. Task Completion Logic (line 73-88)**

```typescript
async function completeCandidateTask(...) {
  const task = await ctx.db
    .query('candidateTasks')
    .withIndex('by_tenant_candidate_status', (q) =>
      q.eq('tenantId', tenantId).eq('candidateId', candidateId).eq('status', 'pending'),
    )
    .filter((q) => q.eq(q.field('type'), type))
    .first()
```

This queries by status='pending' then filters by type. If multiple pending tasks of same type exist (shouldn't happen but possible on bug), only first is completed. The seed logic (lines 329-335) creates exactly one task per type, so this is low risk.

**3. Email Normalization Consistency**

`normalizeCandidateEmail` (line 34) uses `normalizeEmail` from `adpSync`. Ensure this matches Clerk's email normalization to avoid lookup failures in `getOwnCandidate` (lines 44-58).

---

### 📋 Test Coverage Gaps

The test gate shows `convex/candidates.test.ts (15 tests)` and `convex/onboarding.test.ts (5 tests)` passing, but I cannot verify:
- `completePlatformTraining` idempotency test
- `hasPlatformTrainingCompleted` false→true transition test
- `org:caregiver` can call `completePlatformTraining` (task says caregiver OR candidate)

**Request:** Confirm onboarding tests cover the 3 training functions with idempotency verification.

---

### Security Review

| Concern | Status |
|---------|--------|
| Tenant isolation | ✅ All fns use `requireTenantRole` + `assertTenantDoc` |
| Role escalation | ✅ Admin/hr only for invite/hire, candidate only for self-ops |
| PHI exposure | ⚠️ Candidate documents stored in `documentArchiveItems` - verify storage encryption |
| Audit trail | ✅ All state changes logged via `recordCandidateAudit` |
| Idempotency | ⚠️ Training functions not visible; hireCandidate has some idempotency via existing member/profile checks |

---

### Final Assessment

The candidates.ts implementation is solid with proper auth, audit, and lifecycle management. However, **I cannot approve without seeing onboarding.ts** since 3 of 16 required functions (completePlatformTraining, hasPlatformTrainingCompleted, resetPlatformTraining) are not in the visible diff. These are critical for the "platform training gate" requirement.

VERDICT: CHANGES_REQUESTED