# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of the Session 3 candidate/onboarding backend diff:

**What works well**
- `convex/schema.ts` adds the required indexes (`by_tenant_clerk_user` on `candidates`, `by_candidate` on `applications`, `by_tenant_candidate_order` on `candidateTasks`) and the `order`/`fields` columns needed by the new flows.
- `hireCandidate` correctly upserts a `tenantMember` with `org:caregiver`, upserts an `employeeProfiles` row with `adpSyncStatus: 'pending_credentials'`, and schedules `internal.adpOutbound.adpSyncWorker` with the profile id (`convex/candidates.ts`).
- `addCandidateDocument` correctly scopes candidate self-uploads vs. admin/HR uploads, validates the file belongs to the tenant, and marks the `document_upload` task complete.
- `members.sync` now links an accepted Clerk invite back to the `candidates` row by email, which makes the self-service candidate queries work.
- `audit.ts` allows `org:hr`/`org:candidate` audit writes as required.
- All reported gates pass (`lint`, `typecheck`, `test`), including the new `convex/candidates.test.ts` and `convex/onboarding.test.ts` suites.

**Concrete blockers**

1. **`inviteCandidate` bypasses `authHelpers.ts`.**  
   `convex/candidates.ts` defines `inviteCandidate` as an `action` and authorizes it by calling `api.members.me` and checking `member.role`, instead of going through `requireTenantRole` from `convex/authHelpers.ts`. The task explicitly requires *“All functions go through convex/authHelpers.ts.”* This duplicates authorization logic and breaks the repo’s standard tenant-role gate.  
   **Fix:** call `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:hr'])` at the top of the action and use the returned `identity.subject` as the inviter id.

2. **`inviteCandidate` accepts `appBaseUrl` from the client.**  
   The same action takes `appBaseUrl: v.string()` from the caller and passes it to `sendClerkInvitation`, which builds the invitation acceptance redirect. That is an open-redirect/phishing risk on a health platform where candidate credentials/PHI could be sent to an attacker-controlled origin if an admin/HR account is compromised.  
   **Fix:** derive the redirect base URL server-side from a known env var (e.g., `APP_URL`) or validate it against a strict allow-list; do not accept it as a function argument.

3. **Lifecycle task completions reference non-existent task types.**  
   `reviewApplication` calls `completeCandidateTask(..., 'hr_review')` and `acceptOffer` calls `completeCandidateTask(..., 'offer_acceptance')`, but `CANDIDATE_TASK_TYPES` only seeds `form_submission`, `document_upload`, `background_check`, `reference_check`, `platform_training`. Those two completions are currently no-ops, so the task pipeline state is inconsistent.  
   **Fix:** either add `hr_review` and `offer_acceptance` to the seeded task list or remove the no-op completion calls.

**Non-blocking notes**
- `inviteCandidate` is implemented as an `action` rather than a `mutation`. That is reasonable because it must call the Clerk API, but the task text says “mutation.” Consider renaming the spec or keeping the action and documenting why.
- `convex/onboarding.ts` is referenced in `api.d.ts` and covered by passing tests, but its source is not visible in the provided diff, so I could not directly review the training gate implementation.

Please address the three blockers above.

VERDICT: CHANGES_REQUESTED