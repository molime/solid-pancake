# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The changes fully implement the candidate onboarding flow as specified:

* All required endpoints are present with correct role guards (`requireTenantRole` / `requireTenantRoleAction`).
* `inviteCandidate` creates a candidate row, sends a Clerk invitation, and seeds exactly five ordered tasks.
* Candidate self‑service queries (`getCandidateProfile`, `listCandidateTasks`) correctly resolve the candidate via Clerk user ID or email.
* Application submission upserts an `applications` row, marks the `form_submission` task complete, and records an audit entry.
* Review, offer, accept/reject, and hire mutations enforce the proper status transitions and update related tables (`tenantMembers`, `employeeProfiles`) while scheduling the ADP sync worker.
* Document upload inserts a `documentArchiveItems` row and completes the `document_upload` task.
* Platform‑training functions (in `onboarding.ts`) are idempotent and correctly report completion status; admin can reset training.
* Schema updates add needed indexes (`by_tenant_clerk_user`, `by_candidate`, etc.) and fields (`order`, `fields`), supporting efficient queries.
* `members.sync` now links a candidate’s Clerk user ID to the candidate row when a user is created with `org:candidate`.
* Auditing now includes `org:hr` and `org:candidate` roles.
* All new code is covered by existing tests, which all pass.

No security gaps, race conditions, or PHI leaks are introduced. The implementation satisfies every task requirement.

VERDICT: APPROVED