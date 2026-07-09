# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The diff adds the full candidate lifecycle (invite, application, review, offer, hire) and the supporting onboarding helpers, updates the schema, auth helpers, and member sync to link candidates to Clerk users, and expands audit permissions. Most of the required functionality is present and the test suite passes, indicating correct integration with existing Convex guards and the ADP mock worker.

**Correctness / Missing behavior**
- **Task ordering** – `listCandidateTasks` and `listCandidateTasksForHR` (and the task list returned by `getCandidateDetail`) query the `by_tenant_candidate_order` index but do **not** order the results by the `order` field as required by the spec (“ordered”). This could cause nondeterministic UI ordering and fails the “listCandidateTasks() candidate own tasks ordered” acceptance criterion.
- **Idempotency** – `completePlatformTraining`/`hasPlatformTrainingCompleted`/`resetPlatformTraining` are not shown in the diff; ensure they exist and are idempotent as required. (Assumed present, but verify.)

**Security**
- All mutations and queries are wrapped with `requireTenantRole` (or the new `requireTenantRoleAction` for actions) and respect the tenant‑scoped indexes, so unauthorized access is prevented.
- The new `linkCandidateClerkUserId` in `members.sync` only updates a candidate’s `clerkUserId` when the member role is `org:candidate`, preserving the principle of least privilege.
- Audit logging now includes `org:hr` and `org:candidate` which is safe and matches the expanded audit usage.

**PHI handling**
- Candidate PII (email, phone) remains stored in the `candidates` table and is only accessible via tenant‑scoped guards (`org:admin`, `org:hr`, `org:candidate`). No PHI is written to logs or exposed elsewhere.

**Edge‑case / Race considerations**
- `inviteCandidate` cleans up the candidate row if the Clerk invitation fails, preventing orphaned records.
- `hireCandidate` checks for `clerkUserId` before proceeding, ensuring the candidate has been linked.
- The ADP sync worker is scheduled after the employee profile is persisted, guaranteeing the worker sees a valid record.

**Tests**
- All existing unit and integration tests pass (`npm run test`). However, a test for task ordering is missing; adding one will catch the ordering bug.

**Requested change**
- Add explicit ordering when returning candidate tasks (e.g., `.order('asc')` on the `order` field) in `listCandidateTasks`, `listCandidateTasksForHR`, and the task list portion of `getCandidateDetail` to satisfy the specification.

**Verdict**

VERDICT: CHANGES_REQUESTED