# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 3 Candidate & Onboarding Backend

### Summary
This change implements the candidate recruitment lifecycle and platform training gate. The core mutations (invite, application, offer lifecycle, hire) and onboarding functions are well-implemented with proper auth guards, audit logging, and ADP integration. However, **4 required query endpoints are not visible in the diff**.

---

### ✅ What's Correct

**Auth & Multi-tenancy:**
- All mutations use `requireTenantRole` with correct role allowlists (`org:admin`, `org:hr`, `org:candidate`, `org:caregiver`)
- `assertTenantDoc` guards tenant isolation on candidate lookups
- `audit.ts` updated to allow `org:hr` and `org:candidate` roles (line 19)
- New `requireTenantRoleAction` helper in `authHelpers.ts` (lines 190-215) for action-level auth

**Candidate Lifecycle:**
- `inviteCandidate`: Seeds 5 tasks in order (form_submission, document_upload, background_check, reference_check, platform_training), sends Clerk invite, status='invited'
- `submitApplication`: Upserts application, marks form_submission task complete, audit logged
- Offer lifecycle (`sendOffer`→`acceptOffer`/`rejectOffer`): Proper status transitions with guards
- `hireCandidate`: Creates/updates tenantMember (org:caregiver), employeeProfile with `adpSyncStatus: 'pending_credentials'`, schedules `internal.adpOutbound.adpSyncWorker`

**Platform Training (onboarding.ts):**
- `completePlatformTraining`: Idempotent (checks existing before insert)
- `hasPlatformTrainingCompleted`: Returns boolean correctly
- `resetPlatformTraining`: Admin-only, deletes completion row

**Schema Updates (schema.ts):**
- `candidates`: Added `by_tenant_clerk_user` index
- `applications`: Added `fields`, `decision`, `hrNotes`, `by_candidate` and `by_candidate_submittedAt` indexes
- `candidateTasks`: Added `order` field and `by_tenant_candidate_order` index

**Identity Linkage (members.ts):**
- `sync` mutation links `clerkUserId` to candidate record when role='org:candidate' (lines 167-174, 202-209)

**Tests:**
- 15 tests in `candidates.test.ts` covering invite, profile, application, offer lifecycle
- 5 tests in `onboarding.test.ts` covering training completion, idempotency, reset
- All 334 tests pass

---

### ⚠️ Missing Required Endpoints

The task explicitly requires **16 endpoints**. The following 4 query functions are **not visible in the diff**:

| # | Required Function | Status in Diff |
|---|------------------|----------------|
| 4 | `listCandidates({ status? })` | ❌ Not visible |
| 5 | `getCandidateDetail({ candidateId })` | ❌ Not visible |
| 15 | `listCandidateTasks()` | ❌ Not visible |
| 16 | `listCandidateTasksForHR({ candidateId })` | ❌ Not visible |

The `candidates.ts` diff shows 810 lines added but truncates after `addCandidateDocument`. The deprecated `get`/`create`/`update` functions are marked with `@deprecated` comments but the new list/detail queries are not shown.

**Impact:** HR/admin cannot view candidate lists, candidate details with applications/tasks/documents, or task lists—core workflow functionality.

---

### ⚠️ Potential Issues

**1. Race condition in `hireCandidate` (candidates.ts ~line 600+):**
```typescript
if (candidate.status !== 'accepted') {
  throw new ConvexError('Candidate must have accepted the offer to be hired.')
}
// ... later ...
await ctx.db.patch(candidate._id, { status: 'hired' })
```
Two concurrent hire calls could both pass the status check before either patches to 'hired', potentially creating duplicate employee profiles. The existing profile lookup mitigates this but isn't atomic.

**2. No cleanup on Clerk invite failure (candidates.ts `inviteCandidate`):**
If `sendClerkInvitation` succeeds but subsequent DB operations fail, an orphaned Clerk invitation exists. Consider wrapping in try/catch with cleanup mutation.

**3. Test coverage gap:**
No tests for `listCandidates`, `getCandidateDetail`, `listCandidateTasks`, `listCandidateTasksForHR` (if they exist). The 15 existing tests don't cover these queries.

---

### 🔒 Security Review

| Concern | Status |
|---------|--------|
| Tenant isolation | ✅ `assertTenantDoc` on all candidate lookups |
| Role-based access | ✅ Correct allowlists per function |
| PHI exposure | ✅ No PHI in candidate tables; documents use existing `documentArchiveItems` |
| Auth bypass | ✅ Double-gated (RouteGuard + server) |
| IDOR | ✅ Candidate self-service uses `getOwnCandidate` helper |

---

### Required Changes

1. **Add missing query functions** (`listCandidates`, `getCandidateDetail`, `listCandidateTasks`, `listCandidateTasksForHR`) to `convex/candidates.ts` with proper auth guards
2. **Add tests** for the 4 missing query functions covering role-based access control
3. **Consider atomic status transition** in `hireCandidate` using a conditional patch or optimistic concurrency check

---

VERDICT: CHANGES_REQUESTED