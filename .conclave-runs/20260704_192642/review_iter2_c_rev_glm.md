# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: Session 3 — Candidate & Onboarding Backend

### Completeness Check (all 16 endpoints)

| # | Function | Location | Auth | Status |
|---|----------|----------|------|--------|
| 1 | `inviteCandidate` | candidates.ts (action) | org:admin, org:hr ✅ | Creates candidate + 5 seeded tasks + Clerk invite |
| 2 | `getCandidateProfile` | candidates.ts | org:candidate ✅ | Self-service via clerkUserId/email fallback |
| 3 | `submitApplication` | candidates.ts | org:candidate ✅ | Upserts app, marks form_submission task |
| 4 | `listCandidates` | candidates.ts | org:admin, org:hr ✅ | Optional status filter |
| 5 | `getCandidateDetail` | candidates.ts | org:admin, org:hr ✅ | Returns candidate+apps+tasks+docs |
| 6 | `reviewApplication` | candidates.ts | org:admin, org:hr ✅ | approved→hr_review, rejected→rejected |
| 7 | `sendOffer` | candidates.ts | org:admin, org:hr ✅ | hr_review → offer_sent |
| 8 | `acceptOffer` | candidates.ts | org:candidate ✅ | Idempotent (early return if already accepted) |
| 9 | `rejectOffer` | candidates.ts | org:candidate ✅ | offer_sent → withdrawn |
| 10 | `hireCandidate` | candidates.ts | org:admin, org:hr ✅ | Upserts tenantMember+employeeProfile, schedules ADP sync |
| 11 | `completePlatformTraining` | onboarding.ts (not in diff) | org:caregiver, org:candidate | Tests pass (5/5) ✅ |
| 12 | `hasPlatformTrainingCompleted` | onboarding.ts (not in diff) | org:caregiver, org:candidate | Tests pass ✅ |
| 13 | `resetPlatformTraining` | onboarding.ts (not in diff) | org:admin | Tests pass ✅ |
| 14 | `addCandidateDocument` | candidates.ts | org:candidate, org:admin, org:hr ✅ | Candidates auto-scoped to own profile |
| 15 | `listCandidateTasks` | candidates.ts | org:candidate ✅ | Ordered by `order` index |
| 16 | `listCandidateTasksForHR` | candidates.ts | org:admin, org:hr ✅ | Ordered by `order` index |

### Correctness

**Identity linkage** — The `members.sync` mutation now patches `clerkUserId` on the candidate row when a `org:candidate` member is created/updated (lines +149-157, +184-195). This is critical for `getCandidateProfile` and `acceptOffer`/`rejectOffer` to work after the candidate accepts the Clerk invite. The fallback to email lookup in `getOwnCandidate` provides a safety net for the race between the Clerk webhook and the candidate's first API call. Well handled.

**`hireCandidate` clerkUserId guard** — The `if (!candidate.clerkUserId)` check at ~line 640 is a sound safety gate: you can't create a tenantMember or employeeProfile without a linked Clerk identity. The only scenario where this could fire unexpectedly is if `members.sync` hasn't run yet (webhook race), but in practice the candidate must be authenticated to have reached `accepted` status, so `members.sync` will have fired. Acceptable.

**`inviteCandidate` rollback** — If `sendClerkInvitation` throws, the code calls `deleteInvitedCandidate` to clean up. This is good error handling. The internal mutation deletes tasks then the candidate — transactional, so it's all-or-nothing.

**`reviewApplication` status guard** — Allows both `'applied'` and `'hr_review'` as valid starting states, which permits HR to re-review (e.g., add notes). The transition `applied → hr_review` on approval and `applied → rejected` on rejection is correct per the state machine.

**`acceptOffer` idempotency** — Returns early if status is already `'accepted'`. Good.

**Employee profile upsert in `hireCandidate`** — Checks by clerkUserId first, then by email, then creates new. This handles the case where an employee profile already exists (e.g., from a prior employment). Sets `adpSyncStatus: 'pending_credentials'` as required. Schedules `internal.adpOutbound.adpSyncWorker` with `runAfter(0)`. Correct.

### Schema Changes

- `candidates`: added `by_tenant_clerk_user` index — needed for `getOwnCandidate` lookup.
- `applications`: added `fields` (v.any()), `decision`, `hrNotes` columns + `by_candidate` index — supports `submitApplication` and `reviewApplication`.
- `candidateTasks`: added `order` field + `by_tenant_candidate_order` index — supports deterministic task ordering.

All schema additions are additive and non-breaking.

### Auth & Multi-tenancy

- Every function goes through `requireTenantRole` or `requireTenantRoleAction` — ✅
- `assertTenantDoc` used when accessing cross-tenant documents (candidate in `getCandidateDetail`, file in `addCandidateDocument`) — ✅
- `addCandidateDocument`: candidates are auto-scoped to their own profile (cannot pass a different `candidateId`) — ✅
- `audit.ts` now allows `org:hr` and `org:candidate` roles — ✅

### Security / PHI

- No raw PHI stored in audit metadata (only IDs) — ✅
- File ownership validated via `assertTenantDoc` before document creation — ✅
- `requireTenantRoleAction` properly validates auth in action context using `ctx.auth.getUserIdentity()` + `ctx.runQuery(api.members.me)` — ✅

### Minor Observations (non-blocking)

1. **Duplicate email race in `inviteCandidate`**: The check-then-insert in `insertInvitedCandidate` isn't atomic. Two concurrent invites for the same email could both pass the uniqueness check. Convex doesn't support unique constraints, so this is a known limitation. Unlikely in practice for a single-tenant admin action.

2. **`listCandidates` full-table scan**: Uses `by_tenant_email` index then filters by status in-memory. For expected data volumes this is fine; a `by_tenant_status` index would be better at scale.

3. **`onboarding.ts` not in diff**: The three training-gate functions (11-13) are referenced in `api.d.ts` and their tests pass (5/5), but I can't verify the implementation line-by-line. Given all gates green, this is acceptable.

### Test Coverage

- `candidates.test.ts`: 14 tests — covers invite flow, role guards, application submission, hiring, ADP sync scheduling
- `onboarding.test.ts`: 5 tests — covers idempotency, hasPlatformTrainingCompleted toggle
- `phase2Guards.test.ts`: 4 tests — covers role guard enforcement including `org:candidate` cannot call `listShifts`
- All 333 tests pass across 42 files

### Gates

- `npm run lint` ✅
- `npm run typecheck` ✅  
- `npm run test` ✅ (333/333)

VERDICT: APPROVED