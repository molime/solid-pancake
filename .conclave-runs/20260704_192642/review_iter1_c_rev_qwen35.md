# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Candidate & Onboarding Backend (Session 3)

### Summary
The diff implements most of the candidate lifecycle in `convex/candidates.ts` with proper auth guards, audit logging, and schema updates. However, there are **critical gaps** that prevent this from satisfying the task requirements.

---

### 🔴 Critical Issues (Blockers)

#### 1. Missing `convex/onboarding.ts` File
The task explicitly requires: *"Build in convex/candidates.ts (and **convex/onboarding.ts for training**)"* with functions 11-13:
- `completePlatformTraining()` (idempotent)
- `hasPlatformTrainingCompleted()` (returns boolean)
- `resetPlatformTraining({ clerkUserId })` (org:admin only)

The diff shows `convex/_generated/api.d.ts` importing `onboarding` (line 30, 71), and tests exist (`convex/onboarding.test.ts` passed 5 tests), but **the actual `convex/onboarding.ts` file is NOT in this diff**. This is a 3/16 endpoint gap that must be included.

#### 2. Task Completion Bugs - Non-Existent Task Types
In `convex/candidates.ts`:

**Line 479-480** (`reviewApplication`):
```typescript
if (args.decision === 'approved') {
  await completeCandidateTask(ctx, tenantId, candidate._id, 'hr_review')
}
```

**Line 533** (`acceptOffer`):
```typescript
await completeCandidateTask(ctx, tenantId, candidate._id, 'offer_acceptance')
```

**Problem:** `CANDIDATE_TASK_TYPES` (lines 24-29) only seeds: `form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`. The tasks `'hr_review'` and `'offer_acceptance'` **do not exist**, so `completeCandidateTask` will silently return `null` without completing anything. This breaks the task completion tracking requirement.

**Fix:** Either add these task types to the seeded 5 tasks, or remove the `completeCandidateTask` calls for non-existent types.

#### 3. Inconsistent Auth Pattern in `inviteCandidate`
**Lines 263-272** manually check role:
```typescript
const member = await ctx.runQuery(api.members.me, { clerkOrgId: args.clerkOrgId })
if (!member) { throw... }
if (member.role !== 'org:admin' && member.role !== 'org:hr') { throw... }
```

All other functions use `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:hr'])`. This inconsistency:
- Bypasses the standard auth helper
- Doesn't record audit context the same way
- Should be unified for maintainability

---

### 🟡 Concerns (Should Address)

#### 4. `hireCandidate` Identity Linkage Check
**Line 621:**
```typescript
if (!candidate.clerkUserId) {
  throw new ConvexError('Candidate has not completed identity linkage.')
}
```
This is correct and important. The `members.ts` sync patch (lines 149-158, 187-197) properly links `clerkUserId` when org:candidate accepts invitation. Good.

#### 5. ADP Worker Scheduling
**Lines 669-672:**
```typescript
await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
  employeeProfileId,
})
```
Correctly uses `internal.adpOutbound.adpSyncWorker` (not the deprecated `adpSync.ts`). Good.

#### 6. Schema Indexes Added
- `candidates.by_tenant_clerk_user` - needed for self-lookup ✓
- `applications.by_candidate` - needed for detail queries ✓
- `candidateTasks.by_tenant_candidate_order` - needed for ordered task lists ✓
- `applications.fields` column added ✓

#### 7. Audit Allow-List Updated
`convex/audit.ts` line 19 adds `'org:hr', 'org:candidate'` to the allow-list. Required for candidate/HR actions to be auditable. Good.

---

### 🟢 What's Correct

- All mutations go through `requireTenantRole` with correct role guards (except `inviteCandidate` noted above)
- `assertTenantDoc` checks tenant isolation on candidate lookups
- Email normalization via `normalizeEmail` from `adpSync`
- Idempotency in `acceptOffer` (line 517-519 returns early if already accepted)
- Terminal status check in `submitApplication` (line 388-390)
- Document upload marks `document_upload` task complete (line 747)
- `addCandidateDocument` properly restricts candidates to their own profile (lines 704-713)

---

### Required Changes

| Issue | File | Severity | Fix |
|-------|------|----------|-----|
| Missing onboarding.ts | `convex/onboarding.ts` | **Blocker** | Add file with functions 11-13 |
| Non-existent task types | `convex/candidates.ts:479,533` | **Blocker** | Remove or seed 'hr_review', 'offer_acceptance' |
| Inconsistent auth pattern | `convex/candidates.ts:263-272` | High | Use `requireTenantRole` like other functions |

---

### Test Coverage Note
The gate logs show `convex/candidates.test.ts (14 tests)` and `convex/onboarding.test.ts (5 tests)` passed. However, since `onboarding.ts` is not in the diff, I cannot verify those tests match the implementation. The candidates tests should cover: inviteCandidate creates 5 tasks, role guards, submitApplication marks form_submission complete, idempotency, and hireCandidate ADP sync scheduling.

---

VERDICT: CHANGES_REQUESTED