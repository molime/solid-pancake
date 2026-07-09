# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review: ATRIA-X Phase 2 — inviteCandidate Clerk Allow-List Bypass

### AC Verification

| AC | Status | Notes |
|---|---|---|
| AC-1 Schema fields | ✅ | `invitationFailed` and `invitationError` added to candidates |
| AC-2 `isAllowListError` | ✅ | Exported from `invitations.ts`, regex covers allow-list patterns |
| AC-3 `invitationBypass.ts` | ✅ | File exists (referenced in `api.d.ts`), imports confirm `isDevInvitationBypassEnabled`, `createClerkUserAndJoinOrg`, `generateClerkSignInTicket` |
| AC-4 `candidates.ts` refactor | ✅ | `patchCandidateInvitationError` and `patchCandidateClerkUser` added with tenant guards; `deleteInvitedCandidate` removed; bypass path in `inviteCandidate` correct; `regenerateBypassSignInTicket` bonus action added |
| AC-5 `InviteCandidateModal` | ✅ | Modified (50 lines), handles new return shape with `manualPassword`/`magicLink` |
| AC-6 `CandidatePipelinePage` | ✅ | Modified (67 lines), adds invitation status display |
| AC-7 `invitations.test.ts` | ❌ | **File not in diff.** No `isAllowListError` classifier unit tests added to `convex/invitations.test.ts`. The classifier is only tested indirectly through `candidates.test.ts` bypass integration tests. |
| AC-8 `candidates.test.ts` | ✅ | 625 lines added — bypass success, bypass disabled, production guard, record preservation, `regenerateBypassSignInTicket`, missing env vars, admin-as-inviter, no-admin error |
| AC-9 E2E spec | ❌ | **`tests/e2e/onboarding.spec.ts` not in diff.** No E2E spec for inviting a gmail.com candidate and signing in via bypass magic link. |
| AC-10 Quality gates | ✅ | lint PASS, typecheck PASS, 454 unit tests PASS |

### Bugs / Security Issues

1. **`firstOrgAdmin` query has no auth check** (`convex/members.ts` lines ~89-107) — Any authenticated user can query any org's first admin `clerkUserId`. Should call `requireTenantRole` or at minimum verify the caller belongs to the queried org. Low severity (clerkUserId isn't highly sensitive) but violates the project's multi-tenant guard convention used everywhere else.

2. **`createBypassMember` throws generic `Error`** instead of `ConvexError` (`convex/members.ts` line ~296) — Inconsistent with the rest of the codebase; `ConvexError` propagates cleanly to the client while generic `Error` may leak internal details.

### Edge Cases

3. **No test for 409 user-exists in bypass path** — `createClerkUserAndJoinOrg` is specified to handle 409 by reusing the existing user, but no test verifies this. If the implementation doesn't handle it, a race between two invites for the same gmail.com address could create a duplicate Clerk user or crash.

4. **Bypass partial failure** — If `createClerkUserAndJoinOrg` creates the Clerk user but membership creation fails, the catch block patches `invitationFailed` and throws. The orphaned Clerk user is not cleaned up. Acceptable for dev-only, but worth a code comment.

5. **`patchCandidateClerkUser` clears `invitationFailed`/`invitationError` by setting them to `undefined`** — This is correct (Convex `patch` with `undefined` removes the field), but worth confirming this is intentional behavior if a re-invite is ever attempted on a previously-failed candidate.

### Missed ACs (blockers)

- **AC-7**: `convex/invitations.test.ts` needs direct unit tests for `isAllowListError` covering the regex patterns (`not allowed to access this application`, `invalid email`, `email_address is blocked`, `allowlist`) and negative cases (generic 5xx, network errors).

- **AC-9**: `tests/e2e/onboarding.spec.ts` needs a new `test.describe` block that invites a gmail.com candidate via the HR modal, captures the bypass magic link, signs out, signs in as the candidate via the magic link, and asserts landing on `/onboarding`. Gate with `test.skip(!process.env.E2E_FULL, 'requires live Clerk credentials')`.

VERDICT: CHANGES_REQUESTED