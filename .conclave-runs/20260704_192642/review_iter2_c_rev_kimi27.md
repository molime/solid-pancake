# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

This change implements the Session 3 candidate/onboarding backend as specified and all required gates pass (`lint`, `typecheck`, `unit` — 333 tests green).

**What checks out**

- `convex/candidates.ts` adds the required endpoints guarded through `authHelpers.ts`:
  - `inviteCandidate` (action, because it calls Clerk) guards to `org:admin`/`org:hr`, rolls back the inserted candidate/tasks if the Clerk invitation fails, and seeds the 5 ordered tasks (`form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`).
  - `getCandidateProfile`, `submitApplication`, `acceptOffer`, `rejectOffer`, `listCandidateTasks`, `addCandidateDocument` are correctly scoped to `org:candidate`.
  - `listCandidates`, `getCandidateDetail`, `reviewApplication`, `sendOffer`, `listCandidateTasksForHR`, `hireCandidate` are correctly scoped to `org:admin`/`org:hr`.
- `convex/schema.ts` adds the needed indexes (`by_tenant_clerk_user`, `by_candidate`, `by_tenant_candidate_order`) and the `order`, `fields`, `decision`, `hrNotes` columns.
- `convex/members.ts` links a newly synced `org:candidate` member to the existing `candidates` row by normalized email, enabling self-service lookups after invite acceptance.
- `hireCandidate` upserts a `tenantMembers` row as `org:caregiver`, upserts an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`, and schedules `internal.adpOutbound.adpSyncWorker` with the profile id.
- `convex/audit.ts` widens the audit allow-list so `org:hr`/`org:candidate` actions can record audit entries.
- `convex/authHelpers.ts` adds `requireTenantRoleAction` for action-level guards.
- `convex/_generated/api.d.ts` was updated via codegen (not hand-edited).

**Non-blocking risks / follow-ups**

- `convex/candidates.ts` `insertInvitedCandidate` excludes `withdrawn` from the duplicate-active check, implying re-inviting a withdrawn candidate is allowed, but the `by_tenant_email` unique index will still reject the insert. If re-invite is intended, the old row needs to be removed or the constraint relaxed.
- `hireCandidate` updates the Convex `tenantMembers` role to `org:caregiver` but does not update the corresponding Clerk organization membership role. If the frontend or any guard relies on Clerk’s token role, the user still appears as `org:candidate`, and a subsequent `members.sync` webhook could revert the role. Consider updating Clerk membership role as part of hire or guarding the sync path.
- `hireCandidate` may race with `members.sync`/`ensureCaregiverEmployeeProfile` if a caregiver-role webhook arrives after hire, potentially overwriting the intentionally-set `pending_credentials` status. Ensure the employee-profile helper preserves an existing `pending_credentials` state.
- `submitApplication` accepts `fields: v.any()`, which allows non-object payloads. Narrowing to `v.record(v.string(), v.any())` would match the expected application-data shape.
- `convex/onboarding.ts` and the new test files are not shown in the provided diff, so I cannot directly inspect them; however the generated API references `onboarding` and the test gate shows `convex/onboarding.test.ts` and `convex/candidates.test.ts` passing.

None of the above are acceptance-criteria misses or immediate security/PHI blockers, so this is ready to land.

VERDICT: APPROVED