# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of Session 3 candidate/onboarding backend:

What works:
- All 16 endpoints are present and routed through `convex/authHelpers.ts`.
- Schema/index additions (`candidateTasks.order`, `candidates.by_tenant_clerk_user`, `applications.fields`/`by_candidate`, etc.) support the new queries.
- The ADP worker is scheduled from `hireCandidate` and the audit allow-list includes `org:hr`/`org:candidate`.
- Tests cover the required behaviors and all gates are green.

Blockers:

1. **Authorization gap in the hire flow (`convex/candidates.ts`, `hireCandidate`).**  
   The mutation upserts the local `tenantMembers` row with `role: 'org:caregiver'`, but it never updates the corresponding Clerk organization membership role (or the `public_metadata` role claim if custom roles are conveyed that way). Because `requireTenantRole`/`getClerkOrganizationRole` derive the caller’s role from the Clerk JWT, a freshly hired caregiver still presents as `org:candidate` on subsequent requests and can continue calling candidate self-service endpoints. In a health platform this is a PHI-access regression.  
   **Required:** propagate the role change to Clerk (e.g., schedule or call an action that PATCHes the Clerk membership to `org:caregiver`) before the hire is considered complete.

2. **Candidate identity linkage must be role-gated (`convex/members.ts`, `linkCandidateClerkUserId`).**  
   The helper patches a candidate’s `clerkUserId` based only on an email match within the tenant. If `members.sync` calls this for non-candidate members, any admin or caregiver whose email happens to match a candidate row would be linked to that candidate profile and could view/modify candidate data.  
   **Required:** ensure `linkCandidateClerkUserId` is only invoked when the synced member’s role is `org:candidate`.

Non-blocking notes:
- `inviteCandidate` sends the Clerk invitation and then patches `invitationId`. If the patch fails and the action retries, `insertInvitedCandidate` returns the existing row without an `invitationId`, causing a second Clerk invitation to be sent. Consider writing the invitation ID before the external call or adding an idempotency guard.
- `resetPlatformTraining` should scope deletions by `tenantId` (and trainingId) to prevent cross-tenant admin resets; please confirm this is present in `convex/onboarding.ts`.

VERDICT: CHANGES_REQUESTED