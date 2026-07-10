# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 3 - Candidate & Onboarding Backend

### Summary
The diff implements the core candidate management workflow in `convex/candidates.ts` with proper auth guards, schema updates, and audit logging. However, **the onboarding.ts file containing training functions (items 11-13) is not visible in the diff**, which is a critical gap for task verification.

---

### ✅ What's Correct

**Schema Updates (`convex/schema.ts`):**
- `candidates`: Added `by_tenant_clerk_user` index for identity linkage (line 332-333)
- `applications`: Added `fields`, `decision`, `hrNotes` columns + `by_candidate` index (lines 336-343)
- `candidateTasks`: Added `order` field + `by_tenant_candidate_order` index (lines 347-354)

**Auth & Audit:**
- `audit.ts` (line 19): Added `org:hr`, `org:candidate` to allow-list ✓
- `authHelpers.ts` (lines 190-215): New `requireTenantRoleAction` for action-level auth ✓
- `members.ts` (lines 149-158, 187-197): Links `clerkUserId` to candidate row on invitation acceptance ✓

**Candidate Workflow (`convex/candidates.ts`):**
| Function | Status | Notes |
|----------|--------|-------|
| `inviteCandidate` | ✓ | Action with Clerk invite + 5 seeded tasks + rollback on failure |
| `getCandidateProfile` | ✓ | Falls back to email lookup if clerkUserId not set |
| `submitApplication` | ✓ | Upserts application, marks form_submission complete, audits |
| `listCandidates` | ✓ | Admin/HR only, optional status filter |
| `getCandidateDetail` | ✓ | Returns candidate + applications + tasks + documents |
| `reviewApplication` | ✓ | Transitions to hr_review/rejected |
| `sendOffer` | ✓ | From hr_review → offer_sent |
| `acceptOffer`/`rejectOffer` | ✓ | Idempotent accept, proper status transitions |
| `hireCandidate` | ✓ | Creates tenantMember, employeeProfile with `pending_credentials`, schedules ADP sync |
| `addCandidateDocument` | ✓ | Role-aware candidateId handling, marks document_upload complete |
| `listCandidateTasks` / `listCandidateTasksForHR` | ✓ | Proper role guards |

**ADP Integration (`hireCandidate` lines 620-660):**
- Correctly calls `internal.adpOutbound.adpSyncWorker` with `employeeProfileId`
- Sets `adpSyncStatus: 'pending_credentials'` as specified
- Links `hiredEmployeeProfileId` to application record

---

### ⚠️ Issues Requiring Attention

**1. Missing onboarding.ts Diff (Critical)**
The task explicitly requires:
- `completePlatformTraining()` (item 11)
- `hasPlatformTrainingCompleted()` (item 12)  
- `resetPlatformTraining({ clerkUserId })` (item 13)

These should be in `convex/onboarding.ts`. While `api.d.ts` shows the module is registered and `convex/onboarding.test.ts` shows 5 passing tests, **I cannot verify the implementation without seeing the actual file diff**. This is a task completion gap.

**2. Legacy Functions Still Present**
The old `get`, `create`, `update` functions remain in `candidates.ts` (lines 825-862 shown in diff tail). These could cause confusion about which API to use. Consider deprecating or removing.

**3. Duplicate Code in members.ts**
The candidate `clerkUserId` linkage logic appears twice (lines 149-158 and 187-197) in different branches of `sync`. This may be intentional for create vs update paths, but should be verified.

**4. Invite Rollback Edge Case**
In `inviteCandidate` (lines 316-335), if `sendClerkInvitation` fails, `deleteInvitedCandidate` is called. If that deletion fails, you get a stranded candidate record. Consider wrapping in a try-catch with logging.

---

### 🔒 Security Observations

- All mutations properly use `requireTenantRole` or `requireTenantRoleAction`
- `assertTenantDoc` checks tenant isolation on HR-accessed records
- `hireCandidate` validates `clerkUserId` exists before creating employee records (line 597)
- `addCandidateDocument` prevents candidates from specifying arbitrary candidateId (lines 724-733)
- No PHI exposure risks identified in the diff

---

### 🧪 Test Coverage

All gates pass:
- `convex/candidates.test.ts`: 14 tests ✓
- `convex/onboarding.test.ts`: 5 tests ✓
- Total: 333 tests passing

However, without seeing `onboarding.ts`, I cannot verify the training tests cover idempotency and admin-only reset properly.

---

### Required Changes

1. **Provide `convex/onboarding.ts` diff** to verify training functions (items 11-13) are implemented correctly with:
   - Idempotent `completePlatformTraining()`
   - Boolean return from `hasPlatformTrainingCompleted()`
   - Admin-only `resetPlatformTraining()`

2. **Clarify legacy function status** - either remove `get`/`create`/`update` or add deprecation comments

3. **Add error handling** around the `deleteInvitedCandidate` rollback in `inviteCandidate`

---

VERDICT: CHANGES_REQUESTED