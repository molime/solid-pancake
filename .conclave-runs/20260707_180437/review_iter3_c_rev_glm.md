# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review: ATRIA-X Phase 2 — `inviteCandidate` Clerk Allow-List Bypass

### AC-1 ✅ Schema changes
`convex/schema.ts` adds `invitationFailed` and `invitationError` optional fields to the `candidates` table. Tests confirm they're read/written correctly. `npx convex codegen` regenerates `api.d.ts` (visible in the diff).

### AC-2 ✅ `isAllowListError` classifier
`convex/invitations.ts` exports `isAllowListError` with a regex covering `"not allowed to access this application"`, `"invalid email"`, `"email_address is blocked"`, `"not on the allowlist"`, and `"allow.list"`. Handles `ConvexError`, `Error`, and unknown types. Tests in `candidates.test.ts` exercise the allow-list error path.

### AC-3 ✅ `convex/_utils/invitationBypass.ts`
Referenced via `api.d.ts` import and `candidates.ts` imports. Tests confirm:
- `isDevInvitationBypassEnabled()` is `true` for `APP_URL=http://localhost:5173` (empty flag) and for `APP_URL=https://app.example.com` + `ATRIA_X_DEV_INVITE_BYPASS=true`, and `false` for production URL without the flag.
- `createClerkUserAndJoinOrg` creates user + membership, returns `{ clerkUserId, invitationId: 'bypass:<id>', manualPassword, magicLink }`.
- Handles 409 user-exists (test "bypasses via explicit flag" implicitly covers this via the mock returning 200).

### AC-4 ✅ `inviteCandidate` refactor + internal mutations
- `patchCandidateInvitationError` and `patchCandidateClerkUser` are internal mutations with tenant validation (`assertTenantDoc` pattern via `tenant.clerkOrgId === args.clerkOrgId`).
- `inviteCandidate` no longer calls `deleteInvitedCandidate`. On Clerk failure:
  - If allow-list error + bypass enabled → attempts bypass, patches candidate with `clerkUserId` + sentinel `invitationId`, creates bypass member.
  - If bypass fails → patches `invitationFailed: true` + error, rethrows.
  - If non-allow-list error → patches `invitationFailed: true` + error, rethrows.
- `deleteInvitedCandidate` is fully removed and replaced.

### AC-5 ✅ `InviteCandidateModal.tsx`
Shows a dev-only bypass credentials card (`data-testid="bypass-credentials-card"`) with email, temporary password, and magic link on bypass success. Keeps modal open on failure with error banner. On normal success (no bypass), closes modal.

### AC-6 ⚠️ Partial — `CandidatePipelinePage.tsx`
Adds an "Invitation" column with:
- `danger` "Invitation failed" badge when `invitationFailed` is true ✅
- `success` "Dev bypass" badge when `invitationId` starts with `"bypass:"` ✅
- `info` "Sent" badge when `invitationId` exists ✅

**Gap:** The AC requires that the pipeline page "in dev mode, exposes the bypass magic link / credentials for that row." The current implementation only shows a static "Dev bypass" badge — there is no way to retrieve or regenerate the magic link or password from the pipeline page. The credentials are only available in the invite modal immediately after bypass. This is a practical limitation since the magic link/password are not persisted, but the AC explicitly calls for exposing them in the pipeline page. **Recommend adding a "Regenerate sign-in link" button for bypass candidates that calls a new action to create a fresh Clerk sign-in ticket.**

### AC-7 ✅ `convex/invitations.test.ts`
Test count increased (13 tests passing). Covers `isAllowListError` classification and bypass behavior.

### AC-8 ✅ `convex/candidates.test.ts`
New tests cover:
- Bypass success on localhost with allow-list error ✅
- Record preservation when bypass fails ✅
- Production URL guard (no bypass calls made) ✅
- Bypass via explicit flag on production URL ✅
- Record preservation on unexpected 5xx errors ✅
- Missing `CLERK_SECRET_KEY` / `APP_URL` clear errors ✅
- Admin inviter selection (HR caller uses admin inviter) ✅
- No admin available → clear error ✅

### AC-9 ❌ Missing — E2E spec
`tests/e2e/onboarding.spec.ts` is **not present** in the diff (not in the file list at all). The AC requires: "add an E2E spec in `tests/e2e/onboarding.spec.ts` that uses the bypass to sign in as a `gmail.com` candidate." This is a **missing acceptance criterion**.

### AC-10 ⚠️ Partial — Quality gates
- `npm run lint` ✅ PASS
- `npm run typecheck` ✅ PASS
- `npm run test` ✅ PASS (449 tests)
- `npm run e2e` — not shown in gate results
- `E2E_FULL=1 npm run e2e` — not shown
- `npm run build` — not shown

The e2e and build gates are not reported. Given the missing E2E spec, the e2e gate cannot fully pass for this feature.

---

### Security & Multi-Tenancy

- **Bypass gating** is correct: `isDevInvitationBypassEnabled()` checks `APP_URL` hostname === `localhost` OR `ATRIA_X_DEV_INVITE_BYPASS` explicitly set. Production URL without flag → bypass disabled. Tests confirm.
- **Tenant isolation**: `patchCandidateInvitationError` and `patchCandidateClerkUser` both verify `tenant.clerkOrgId === args.clerkOrgId` before patching. `createBypassMember` looks up tenant by `clerkOrgId`. ✅
- **Credentials not persisted**: `manualPassword` and `magicLink` are returned from the action but never stored in the DB. ✅
- **`.env.example`** documents `ATRIA_X_DEV_INVITE_BYPASS` with a "never enable in production" comment. ✅

### Edge Cases

- **Partial bypass failure**: If `createBypassMember` fails after `patchCandidateClerkUser` succeeds, the candidate will have `clerkUserId` set but no `tenantMembers` entry. The action throws, so the client sees an error, but the candidate record is in a partially-valid state. This is a minor concern for a dev-only feature. Consider wrapping `patchCandidateClerkUser` + `createBypassMember` in a transactional pattern or reversing `patchCandidateClerkUser` on `createBypassMember` failure.
- **Re-invite blocked**: A candidate with `invitationFailed: true` and `status: 'invited'` will block re-invite with "active candidate already exists." Acceptable per AC, but worth documenting.
- **`firstOrgAdmin` query**: `inviteCandidate` now requires an org:admin to exist in `tenantMembers`. This is a behavioral change from using `identity.subject`. The test "throws a clear error when no org:admin is available" covers this. Ensure all tenants have at least one admin seeded.

### Unrelated Changes
The diff includes changes to `hrCases.ts` (adding `title`/`createdAt`), `scheduling.ts`, `seed.ts` (390 lines), `forms.test.ts`, `onboarding.test.ts`, `scheduling.test.ts`, `members.ts`/`members.test.ts`, `employeeProfiles.ts`, and various UI files. These appear to be Phase 2 lifecycle features bundled in the same branch. They should be reviewed separately but don't block this AC.

---

### Required Changes

1. **AC-9**: Add the E2E spec at `tests/e2e/onboarding.spec.ts` that invites a `gmail.com` candidate via the bypass and signs in as that candidate. Gate with `test.skip(!process.env.E2E_FULL, ...)` or `assertE2ECredentialsConfigured`.

2. **AC-6 (partial)**: Add a dev-only mechanism in `CandidatePipelinePage.tsx` to expose the magic link/credentials for bypass candidates. Simplest approach: add a "Copy sign-in link" button that calls a new internal action `candidates.regenerateBypassSignInTicket` which creates a fresh Clerk sign-in ticket for the bypass user and returns the magic link URL.

VERDICT: CHANGES_REQUESTED