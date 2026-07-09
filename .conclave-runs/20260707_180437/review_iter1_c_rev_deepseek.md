# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of the code change

### Acceptance criteria coverage

| AC | Status | Notes |
|----|--------|-------|
| **AC-1** (schema fields) | ✅ | `convex/schema.ts` adds `invitationFailed` and `invitationError`. `npx convex codegen` regenerated types (seen in `_generated/api.d.ts`). |
| **AC-2** (allow-list classifier) | ✅ | `convex/invitations.ts` exports `isAllowListError` with regex covering required messages. |
| **AC-3** (bypass helper) | ⚠️ | `convex/_utils/invitationBypass.ts` is referenced in imports and `_generated/api.d.ts`, but its content is **not visible in the diff** (file not listed among changed files). Cannot verify implementation of `isDevInvitationBypassEnabled`, `createClerkUserAndJoinOrg`, or `generateClerkSignInTicket`. |
| **AC-4** (candidates.ts refactor) | ✅ | `inviteCandidate` no longer deletes candidate on failure; uses bypass when enabled; adds `patchCandidateInvitationError` and `patchCandidateClerkUser` internal mutations. |
| **AC-5** (InviteCandidateModal) | ✅ | Modal shows dev-only bypass card with email, password, and magic link on success; error banner on failure; stays open. |
| **AC-6** (CandidatePipelinePage) | ❌ | Shows an `invitationFailed` danger badge, but **does not expose bypass magic link / credentials** for bypassed rows as required by the plan. Only a "Dev bypass" info badge is shown. |
| **AC-7** (invitations.test.ts) | ⚠️ | File is not in the diff list; test count increased to 13 (visible in gate output), but content cannot be reviewed. |
| **AC-8** (candidates.test.ts) | ✅ | New tests cover bypass success, bypass disabled, production-URL guard, record preservation, missing env vars, and admin inviter. |
| **AC-9** (E2E spec) | ❌ | **No changes to `tests/e2e/onboarding.spec.ts`** in the diff. The required E2E spec that invites a `@gmail.com` candidate and signs in via bypass magic link is missing. |
| **AC-10** (gates) | ⚠️ | Lint, typecheck, and unit tests pass. **No e2e or build results provided.** Cannot confirm full gate compliance. |

### Security & correctness observations

- **Multi-tenancy**: Bypass uses the same `clerkOrgId` and does not skip `requireTenantRoleAction`. Internal mutations verify tenant via `clerkOrgId` and candidate’s tenant. ✅
- **Production safety**: `isDevInvitationBypassEnabled` is gated by `APP_URL` hostname or `ATRIA_X_DEV_INVITE_BYPASS` flag. Tests confirm production URL without flag does not trigger bypass. ✅
- **PHI / secrets**: Manual password and magic link are returned to the caller only, not persisted. UI card is labeled “Dev bypass”. ✅
- **Idempotency**: `insertInvitedCandidate` still throws on duplicate email within tenant. Bypass-created candidates with `invitationId: 'bypass:...'` will block re-invite. Acceptable for Phase 2. ✅
- **Partial failure**: If bypass user creation succeeds but `patchCandidateClerkUser` fails, the Clerk user is orphaned. No cleanup is attempted. Minor, acceptable for dev bypass.
- **Inviter change**: `inviteCandidate` now uses `firstOrgAdmin` query to find an admin inviter instead of `identity.subject`. This is a positive improvement but was not in the original plan. It may break callers that rely on the old behavior (e.g., if no admin exists). Tests cover the no-admin case.

### Concrete blockers (changes required)

1. **Missing E2E spec (AC-9)**: The plan requires a Playwright spec in `tests/e2e/onboarding.spec.ts` that invites a `@gmail.com` candidate via the bypass and signs in as that candidate. This is completely absent from the diff.

2. **Missing bypass credentials in CandidatePipelinePage (AC-6)**: The pipeline page only shows a “Dev bypass” badge. The plan requires it to expose the bypass magic link / credentials for that row in dev mode. The modal already shows them, but the pipeline page should also provide a way to retrieve them (e.g., a copy button or link).

3. **Unreviewable bypass helper (AC-3)**: The file `convex/_utils/invitationBypass.ts` is not present in the diff. Its implementation cannot be verified for correctness, security, or edge-case handling (e.g., 409 user exists, membership already exists, sign-in ticket expiry). The file must be included in the diff for review.

4. **Missing gate results (AC-10)**: Only lint, typecheck, and unit results are provided. The plan requires `npm run e2e`, `E2E_FULL=1 npm run e2e`, and `npm run build` to pass. These results are absent.

### Additional concerns (non-blocking but worth noting)

- The diff includes many unrelated changes (e.g., `convex/seed.ts`, `convex/forms.test.ts`, `convex/scheduling.test.ts`, `src/features/scheduling/...`, `tests/e2e/geofence.spec.ts`, etc.) that are not part of the allow-list fix. This scope creep should be justified or separated.
- The `isAllowListError` regex includes `allow.?list` which is broad; consider tightening to avoid false positives.
- The bypass helper’s `generateClerkSignInTicket` is not visible; ensure it sets a reasonable `expires_in_seconds` (e.g., 600) and constructs the magic link correctly.

### Verdict

The implementation covers most of the core logic but is missing critical pieces: the E2E spec, the pipeline page credentials display, and the bypass helper source file is not reviewable. Additionally, gate results are incomplete.

**CHANGES_REQUESTED**

VERDICT: CHANGES_REQUESTED