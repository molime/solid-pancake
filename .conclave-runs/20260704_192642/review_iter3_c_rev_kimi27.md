# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

I reviewed the diff. The new candidate lifecycle endpoints and schema changes line up with the task, and the visible gates all pass. I found three concrete blockers, all around security/PHI access, data integrity, and retry safety:

1. **Legacy candidate endpoints are not role-gated.**  
   In `convex/candidates.ts`, the deprecated `get`, `create`, and `update` handlers call `requireTenantRole(ctx, args.clerkOrgId)` without an `allowedRoles` array (e.g., lines around the legacy `get` handler and the `create`/`update` handlers near the bottom of the file). If `requireTenantRole` treats omitted `allowedRoles` as “allow any tenant member,” these endpoints let caregivers/candidates read and mutate candidate PHI and status directly. Please either add explicit allowlists such as `['org:admin', 'org:hr']` or remove the legacy endpoints.

2. **Re-inviting a withdrawn candidate creates duplicate rows that break `.unique()` lookups.**  
   `insertInvitedCandidate` in `convex/candidates.ts` only throws when `existing.status !== 'withdrawn'`, so a second invite for a withdrawn email inserts a new `candidates` row. Both `getOwnCandidate` in `convex/candidates.ts` and `linkCandidateClerkUserId` in `convex/members.ts` then call `.unique()` on the non-unique `by_tenant_email` index, which will throw at runtime when duplicates exist. Please either reject any existing candidate with the same email or upsert the withdrawn row instead of inserting a duplicate.

3. **`inviteCandidate` is not idempotent across action retries.**  
   `inviteCandidate` is an `action` that first persists the candidate row via `insertInvitedCandidate` and then calls Clerk. If the action is retried after the insert succeeds, `insertInvitedCandidate` throws “active candidate already exists,” leaving the API call failed even though the candidate row (and possibly the invitation) already exists. Please make the action idempotent, e.g., by storing the Clerk `invitationId` on the `candidates` row and returning the existing candidate/invitation on retry instead of throwing.

I also note that `convex/onboarding.ts` is referenced in the generated API but its source was not included in the provided diff; the dedicated test file passes, so I have no concrete issue to raise against it.

VERDICT: CHANGES_REQUESTED