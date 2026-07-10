# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of the Session 3 candidate/onboarding change.

**Overall:** The diff implements the 16 specified endpoints, schema/index additions, auth guards, audit integration, and Clerk/ADP wiring. All gates pass (`lint`, `typecheck`, 334 tests including `convex/candidates.test.ts` and `convex/onboarding.test.ts`).

**Correctness / contract**
- `convex/candidates.ts:300-360` `inviteCandidate` is correctly implemented as an action because it must call the Clerk invitation API; it guards with `requireTenantRoleAction` for `org:admin`/`org:hr`, then calls the internal `insertInvitedCandidate` mutation which re-checks the role and seeds the 5 ordered tasks.
- `convex/candidates.ts:390-450` `insertInvitedCandidate` seeds tasks with `order: index` and uses the new `by_tenant_candidate_order` index, satisfying the deterministic ordering requirement.
- `convex/candidates.ts:140-160` `getCandidateProfile` and `convex/candidates.ts:240-270` `listCandidateTasks` fall back to email lookup when `clerkUserId` is not yet set, which is safe because `convex/members.ts:15-35` and `convex/members.ts:165-200` link the candidate row to the Clerk user during `members.sync` for `org:candidate`.
- `convex/candidates.ts:500-570` `submitApplication` upserts the latest application and marks the `form_submission` task complete.
- `convex/candidates.ts:580-650` `reviewApplication` transitions `applied`/`hr_review` → `hr_review`/`rejected`.
- `convex/candidates.ts:650-690` `sendOffer`, `acceptOffer`, and `rejectOffer` enforce the required status gates; `acceptOffer` is idempotent for `accepted`.
- `convex/candidates.ts:720-800` `hireCandidate` upserts `tenantMembers` as `org:caregiver`, upserts `employeeProfiles` with `adpSyncStatus: 'pending_credentials'`, schedules `internal.adpOutbound.adpSyncWorker`, and flips the candidate to `hired` all in one transaction.
- `convex/candidates.ts:800-870` `addCandidateDocument` correctly restricts candidates to their own profile while allowing admin/HR to specify `candidateId`, and completes the `document_upload` task.
- `convex/onboarding.ts` is not shown in the provided diff, but the generated API references it and `convex/onboarding.test.ts` passes, covering the training gate, idempotency, and reset behavior.

**Security / multi-tenancy / PHI**
- Every exposed function routes through `requireTenantRole`/`requireTenantRoleAction` and uses `assertTenantDoc` before returning or mutating tenant-scoped rows.
- `convex/authHelpers.ts:190-215` adds `requireTenantRoleAction` so actions can share the same org/role guard pattern.
- `convex/audit.ts:19` expands the audit allow-list to include `org:hr` and `org:candidate` so candidate lifecycle events can be recorded.
- `addCandidateDocument` verifies both the candidate and the uploaded `file` belong to the same tenant before archiving.

**Minor / non-blocking observations**
- `inviteCandidate` is an action rather than a mutation; this is necessary because it calls Clerk’s external API, and the frontend should call it via `useAction`.
- `submitApplication`’s upsert logic could race under concurrent submissions and create two `applications` rows, though the candidate document conflict will cause a retry that patches the latest. Not a blocker, but a future unique index on `(candidateId, submittedAt)` or a status gate would harden it.
- `hireCandidate` can schedule duplicate ADP sync jobs if two HR users concurrently hire the same accepted candidate; this is acceptable if `adpSyncWorker` is idempotent (which the Phase 1 mock/worker is expected to be).

No acceptance-criteria misses, regressions, money/PHI/security risks, or broken contracts were found in the visible change.

VERDICT: APPROVED