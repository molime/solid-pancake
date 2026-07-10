# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 Clerk Allow-List Bypass

### Summary
The implementation addresses the Clerk allow-list blocker for `@gmail.com` candidate invitations in local dev. The backend changes are comprehensive with strong test coverage. However, there are **missing deliverables** against the acceptance criteria that must be addressed before approval.

---

### Acceptance Criteria Verification

| AC | Status | Evidence |
|---|---|---|
| AC-1: Schema adds `invitationFailed`/`invitationError` | ⚠️ Unverified | `convex/schema.ts \| 2 +` shown but field additions not visible in truncated diff. Typecheck passing suggests correct. |
| AC-2: `isAllowListError` classifier | ✅ PASS | `convex/invitations.ts` lines 22-33: exports function matching "not allowed to access", "invalid email", "email_address is blocked", "allow.?list" |
| AC-3: `convex/_utils/invitationBypass.ts` created | ⚠️ Unverified | File not in visible diff, but `api.d.ts` imports it and typecheck passed. Cannot verify implementation. |
| AC-4: `candidates.ts` mutations + refactor | ✅ PASS | `patchCandidateInvitationError` (lines 556-575), `patchCandidateClerkUser` (lines 577-603), `inviteCandidate` refactor (lines 324-430), `deleteInvitedCandidate` removed |
| AC-5: `InviteCandidateModal.tsx` error + dev card | ⚠️ Unverified | File shows `50 +-` changes but content truncated. Cannot verify UI behavior. |
| AC-6: `CandidatePipelinePage.tsx` INVITATION column | ⚠️ Unverified | File shows `67 ++-` changes but content truncated. Cannot verify badge/link rendering. |
| AC-7: `invitations.test.ts` extended | ⚠️ Unverified | File not in changed files list with significant additions. Test output shows 13 tests passed but cannot verify bypass-specific tests. |
| AC-8: `candidates.test.ts` extended | ✅ PASS | `625 +` lines added. Visible tests cover: bypass success, bypass disabled, production guard, record preservation, `regenerateBypassSignInTicket` (4 tests) |
| AC-9: E2E spec in `onboarding.spec.ts` | ❌ **MISS** | File **not in changed files list**. Plan explicitly requires this spec. |
| AC-10: All gates pass | ⚠️ **Incomplete** | lint/typecheck/unit reported PASS. **e2e and build gates not reported** despite task requirement. |

---

### Security & Multi-Tenancy Review

**Good:**
- `patchCandidateInvitationError` (lines 563-567) and `patchCandidateClerkUser` (lines 585-589) both validate `tenant.clerkOrgId !== args.clerkOrgId` to prevent cross-tenant access
- `isDevInvitationBypassEnabled()` gate restricts bypass to localhost or explicit `ATRIA_X_DEV_INVITE_BYPASS` flag
- `regenerateBypassSignInTicket` (lines 605-649) validates candidate was created via bypass (`invitationId?.startsWith('bypass:')`) and restricts to org:admin/org:hr
- `manualPassword` and `magicLink` returned only to caller, not persisted to DB

**Concerns:**
- `createBypassMember` internal mutation (members.ts lines 289-340) relies on caller's action-level auth (`requireTenantRoleAction` in `inviteCandidate`) rather than re-validating. This is acceptable but should be documented.
- Frontend receiving `manualPassword` in production if flag accidentally enabled. The gate should be strict.

---

### Test Coverage Assessment

**Strong:**
- `candidates.test.ts` additions (625 lines) comprehensively cover:
  - Bypass success with mock fetch (lines 363-430 in visible portion)
  - Record preservation on bypass failure
  - Production URL guard without flag
  - Production URL with explicit flag
  - Unexpected 5xx error preservation
  - `regenerateBypassSignInTicket` success/failure/auth guard tests

**Missing:**
- `invitations.test.ts` should have `isAllowListError` classifier tests - not visible in diff
- **E2E spec completely missing** (AC-9)

---

### Gate Results

| Gate | Status | Notes |
|---|---|---|
| lint | ✅ PASS | 19.9s |
| typecheck | ✅ PASS | 19.1s |
| unit | ✅ PASS | 454 tests, 204s |
| e2e | ❓ **NOT REPORTED** | Required by task |
| e2e:full | ❓ **NOT REPORTED** | Required by task |
| build | ❓ **NOT REPORTED** | Required by task |

---

### Required Changes

1. **Add E2E spec** (`tests/e2e/onboarding.spec.ts`): The plan explicitly requires a spec that invites a `@gmail.com` candidate via bypass and signs in via magic link. This file is not in the changed files list.

2. **Report missing gates**: Run and report `npm run e2e`, `E2E_FULL=1 npm run e2e:full`, and `npm run build` results. Task requires "Report every gate pass/fail honestly."

3. **Verify schema.ts changes**: Confirm `invitationFailed?: boolean` and `invitationError?: string` are added to the `candidates` table. Typecheck passing suggests yes, but should be visible.

4. **Verify frontend changes**: Confirm `InviteCandidateModal.tsx` shows dev credentials card on bypass success and `CandidatePipelinePage.tsx` shows invitation-failed badge. These are critical UX requirements.

---

### Recommendation

The backend implementation is solid with excellent test coverage for the core bypass logic. However, **AC-9 (E2E spec) is completely missing** and **gate reporting is incomplete**. These are explicit requirements from the plan that cannot be waived.

VERDICT: CHANGES_REQUESTED