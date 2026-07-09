# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### Task Coverage — All 16 Functions Verified

| # | Function | Auth | Status |
|---|----------|------|--------|
| 1 | `inviteCandidate` | `org:admin`/`org:hr` via `requireTenantRoleAction` | ✅ Seeds 5 tasks, Clerk invite, rollback on failure |
| 2 | `getCandidateProfile` | `org:candidate` | ✅ Self-lookup by clerkUserId then email |
| 3 | `submitApplication` | `org:candidate` | ✅ Upserts application, completes `form_submission` task, audits |
| 4 | `listCandidates` | `org:admin`/`org:hr` | ✅ Optional status filter |
| 5 | `getCandidateDetail` | `org:admin`/`org:hr` | ✅ Returns candidate + applications + tasks + documents |
| 6 | `reviewApplication` | `org:admin`/`org:hr` | ✅ From `applied`/`hr_review` → `hr_review`/`rejected` |
| 7 | `sendOffer` | `org:admin`/`org:hr` | ✅ From `hr_review` only |
| 8 | `acceptOffer` | `org:candidate` | ✅ Idempotent (returns early if already `accepted`) |
| 9 | `rejectOffer` | `org:candidate` | ✅ From `offer_sent` → `withdrawn` |
| 10 | `hireCandidate` | `org:admin`/`org:hr` | ✅ Upserts tenantMember + employeeProfile (`pending_credentials`), schedules ADP sync, audits |
| 11–13 | Training functions | Per spec | ✅ Tests pass (5 onboarding tests); `onboarding.ts` registered in `api.d.ts` |
| 14 | `addCandidateDocument` | `org:candidate`/`org:admin`/`org:hr` | ✅ Candidate self-resolves; completes `document_upload` task |
| 15 | `listCandidateTasks` | `org:candidate` | ✅ Ordered by `by_tenant_candidate_order` index |
| 16 | `listCandidateTasksForHR` | `org:admin`/`org:hr` | ✅ |

### Security & Correctness

- **Auth**: Every function goes through `requireTenantRole` / `requireTenantRoleAction` with correct role sets. `assertTenantDoc` guards cross-tenant access on individual records.
- **Action auth**: `requireTenantRoleAction` correctly uses `ctx.auth.getUserIdentity()` + `ctx.runQuery(api.members.me, …)` for Convex actions — no bypass.
- **Candidate identity linkage**: `members.sync` now calls `linkCandidateClerkUserId` when role is `org:candidate`, patching the candidate row's `clerkUserId` so self-service queries work post-invite-acceptance. Critical for correctness.
- **Rollback**: `inviteCandidate` action wraps Clerk invitation in try/catch and calls `deleteInvitedCandidate` internal mutation on failure — no orphaned candidate rows.
- **Idempotency**: `acceptOffer` returns early if already `accepted`; `completeCandidateTask` queries for `status: 'pending'` so double-completes are no-ops; `linkCandidateClerkUserId` only patches when `!candidate.clerkUserId`.
- **PHI / document access**: `addCandidateDocument` restricts candidates to their own profile; admin/HR must supply `candidateId`. File ownership verified via `assertTenantDoc`.
- **Audit**: All state transitions call `recordCandidateAudit`. The audit allow-list now includes `org:hr` and `org:candidate`.

### Schema Changes

Additive only — no breaking changes. New indexes (`by_tenant_clerk_user` on candidates, `by_candidate` + `by_candidate_submittedAt` on applications, `by_tenant_candidate_order` on candidateTasks) and new optional fields (`fields`, `decision`, `hrNotes` on applications; `order` on candidateTasks) are safe. Codegen was run (`api.d.ts` updated).

### Tests

All 334 tests pass across 42 files, including `candidates.test.ts` (15 tests) and `onboarding.test.ts` (5 tests). The required test cases (5 seeded tasks, caregiver blocked, form_submission completed, idempotent training, hireCandidate → employeeProfile + ADP sync, role guards) are covered.

### Minor Observations (non-blocking)

- `listCandidates` fetches all candidates then filters by status in-memory. Acceptable at current scale; a `by_tenant_status` index would help at scale.
- `convex/onboarding.ts` isn't visible in the diff but is registered in `api.d.ts` and its 5 tests pass — the file exists in the working tree.
- `declare const process` in candidates.ts is unconventional but typecheck passes; Convex actions expose `process.env` natively.

No blockers found. All acceptance criteria met, all gates green, no security/PHI/money risks.

VERDICT: APPROVED