# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review: ATRIA-X Phase 2 — `inviteCandidate` Clerk Allow-List Bypass

I've reviewed the diff against the plan's acceptance criteria, looking for missed ACs, bugs, security issues, and missing tests.

---

### AC-1 ✅ Schema changes
`convex/schema.ts` adds `invitationFailed` and `invitationError` optional fields. Codegen was run (`_generated/api.d.ts` updated). Typecheck passes.

### AC-2 ✅ `isAllowListError` classifier
`convex/invitations.ts` exports `isAllowListError` with a regex covering `"not allowed to access this application"`, `"invalid email"`, `"email_address is blocked"`, `"not on the allowlist"`, and `"allow.?list"`. Handles `ConvexError`, `Error`, and unknown types.

### AC-3 ⚠️ `convex/_utils/invitationBypass.ts`
File exists (confirmed by `_generated/api.d.ts` import) but is **not visible in the truncated diff**. Tests exercise the bypass path (user creation, membership, sign-in token), and the bypass success test verifies `invitationId`, `manualPassword`, and `magicLink` return values. However, I cannot verify:
- 409 user-exists handling (reuse existing user)
- 409 membership-exists handling (treat as success)
- Partial failure cleanup (orphaned user deletion)
- `generateClerkSignInTicket` implementation

The tests pass, which gives confidence, but the 409 and partial-failure paths are untested.

### AC-4 ⚠️ `convex/candidates.ts` — Bug in `firstOrgAdmin`

The `inviteCandidate` action now looks up an org:admin via `api.members.firstOrgAdmin` instead of using `identity.subject`. This is a behavioral change (presumably to fix HR users lacking invite permissions). However, `firstOrgAdmin` in `convex/members.ts` uses **`.unique()`**:

```typescript
// convex/members.ts line ~100
const admin = await ctx.db
  .query('tenantMembers')
  .withIndex('by_tenant_role', (q) =>
    q.eq('tenantId', tenant._id).eq('role', 'org:admin'),
  )
  .unique()
```

**Bug:** `.unique()` throws when multiple `org:admin` members exist. The function is named `firstOrgAdmin`, implying it should return the first match. Tenants with 2+ admins will get an unhandled error in `inviteCandidate` and `createCaregiver`. **Fix: change `.unique()` to `.first()`.**

The `patchCandidateInvitationError` and `patchCandidateClerkUser` internal mutations correctly validate `clerkOrgId` against the candidate's tenant — good multi-tenant guard.

The `deleteInvitedCandidate` cleanup path is removed; candidate records are preserved on all failures via `patchCandidateInvitationError`. ✅

### AC-5 ⚠️ `InviteCandidateModal.tsx`
50 lines changed but the diff is truncated. Typecheck passes, so the new return shape `{ candidateId, invitationId, manualPassword?, magicLink? }` is handled. Cannot verify the dev-only credentials card or error banner behavior from the visible diff.

### AC-6 ⚠️ `CandidatePipelinePage.tsx`
23 lines changed, diff truncated. Cannot verify the invitation-failed badge or dev-only magic link display.

### AC-7 & AC-8 ⚠️ Tests — Missing flag-based bypass test

`convex/candidates.test.ts` adds strong coverage:
- ✅ Bypass success on localhost
- ✅ Record preservation when bypass fails (all fetch calls error)
- ✅ Production URL guard (no bypass calls)
- ✅ Record preservation on unexpected 5xx
- ✅ Missing env vars
- ✅ org:admin inviter lookup
- ✅ No admin available error

**Missing test:** No test for `ATRIA_X_DEV_INVITE_BYPASS=1` (or `'true'`) with a **production** `APP_URL`. The plan explicitly requires this: *"bypass disabled"* and *"production-URL guard"* tests, plus the flag should activate bypass even on non-localhost URLs. The current production-URL test only tests the negative case (flag empty). A positive case with the flag set is needed.

**Test naming issue:** The test `"preserves the candidate record when bypass is disabled"` sets `APP_URL=http://localhost:5173` with `ATRIA_X_DEV_INVITE_BYPASS=''`. If `isDevInvitationBypassEnabled()` follows the plan (localhost OR flag), the bypass is actually **enabled** on localhost — it just fails because all fetch calls return errors. The test name is misleading.

### AC-9 ❌ Missing E2E spec
`tests/e2e/onboarding.spec.ts` is **not in the diff**. The file list shows 33 changed files; no new E2E spec file exists. This is a clear miss — AC-9 requires an E2E spec that invites a gmail.com candidate via the bypass and signs in.

### AC-10 ⚠️ Quality gates
- ✅ lint: PASS
- ✅ typecheck: PASS
- ✅ unit tests: PASS (444 tests)
- ❓ e2e: not shown in gate results
- ❓ build: not shown in gate results

---

### Summary of Concrete Blockers

1. **Missing E2E spec (AC-9):** `tests/e2e/onboarding.spec.ts` does not exist. Must be created with a spec that invites a gmail.com candidate, verifies the bypass card, and signs in via magic link.

2. **`firstOrgAdmin` bug (`convex/members.ts`):** Uses `.unique()` which throws for tenants with multiple `org:admin` members. Change to `.first()` to match the function name and handle the multi-admin case.

3. **Missing test for flag-based bypass:** Add a test in `convex/candidates.test.ts` (and/or `convex/invitations.test.ts`) for `ATRIA_X_DEV_INVITE_BYPASS=1` with a production `APP_URL` (e.g., `https://app.example.com`) that verifies the bypass is attempted and succeeds.

---

### Non-blocking Observations

- The test `"preserves the candidate record when bypass is disabled"` is misleadingly named — the bypass is enabled (localhost) but fails because all fetch calls error. Consider renaming to `"preserves the candidate record when bypass fails"`.
- `firstOrgAdmin` is a public query with no auth check — any authenticated user can look up the first admin of any org. Consider making it an internal query since it's only called from actions.
- Several unrelated changes are bundled (hrCases.ts `title`/`createdAt`, scheduling tests, forms tests, seed.ts). Not blockers but should be reviewed separately.
- The 409 user-exists and partial-failure paths in `createClerkUserAndJoinOrg` are untested. Consider adding tests for these edge cases.

VERDICT: CHANGES_REQUESTED