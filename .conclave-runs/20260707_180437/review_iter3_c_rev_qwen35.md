# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 Clerk Allow-list Bypass

### Summary
This change implements a dev-only bypass for Clerk email allow-list restrictions when inviting candidates. The implementation is largely correct and well-tested, but there are gaps against the acceptance criteria.

---

### Acceptance Criteria Verification

| AC | Status | Notes |
|---|---|---|
| AC-1: Schema adds `invitationFailed`/`invitationError` | ⚠️ **Unverified** | `convex/schema.ts` shows `2 +` lines but content is truncated. Tests reference these fields, suggesting they exist. |
| AC-2: `isAllowListError` classifier exported | ✅ **PASS** | `convex/invitations.ts:22-35` exports the function with proper regex matching. |
| AC-3: `convex/_utils/invitationBypass.ts` created | ⚠️ **Unverified** | File not visible in diff (truncated), but imported in `convex/candidates.ts:21-24` and referenced in `_generated/api.d.ts`. |
| AC-4: Internal mutations + `inviteCandidate` refactored | ✅ **PASS** | `convex/candidates.ts:555-607` shows `patchCandidateInvitationError` and `patchCandidateClerkUser` with tenant guards. |
| AC-5: `InviteCandidateModal.tsx` updated | ⚠️ **Unverified** | File shows `50 +-` changes but content truncated. Cannot verify dev credentials card implementation. |
| AC-6: `CandidatePipelinePage.tsx` updated | ⚠️ **Unverified** | File shows `28 +-` changes but content truncated. Cannot verify invitation column/badge. |
| AC-7: `invitations.test.ts` extended | ⚠️ **Partial** | Shows `14 +-` lines. Cannot verify `isAllowListError` tests are included. |
| AC-8: `candidates.test.ts` extended | ✅ **PASS** | `convex/candidates.test.ts:313-706` shows comprehensive bypass tests (success, disabled, production guard, record preservation). |
| **AC-9: E2E spec in `onboarding.spec.ts`** | ❌ **MISSING** | File not listed in diff. This is a required acceptance criterion. |
| AC-10: Quality gates pass | ✅ **PASS** | lint, typecheck, unit tests all pass (449 tests). |

---

### Security & Multi-tenancy Review

**✅ Multi-tenancy guards are correct:**
- `patchCandidateInvitationError` (`convex/candidates.ts:563-577`) and `patchCandidateClerkUser` (`convex/candidates.ts:580-604`) both verify `tenant.clerkOrgId === args.clerkOrgId` before patching.
- `createBypassMember` (`convex/members.ts:288-333`) queries tenant by `clerkOrgId` before inserting/updating.

**✅ Production safety:**
- Bypass is gated by `isDevInvitationBypassEnabled()` which checks `APP_URL` localhost or `ATRIA_X_DEV_INVITE_BYPASS` flag.
- `.env.example` documents the flag with warning "Never enable in production."

**✅ Record preservation:**
- `deleteInvitedCandidate` is removed; all error paths now call `patchCandidateInvitationError` instead.
- Tests verify candidate record persists with `invitationFailed: true` on failures.

**⚠️ PHI/Secrets handling:**
- `manualPassword` and `magicLink` are returned to client but not persisted in DB (correct).
- Ensure frontend does not log these values.

---

### Bugs & Edge Cases

**1. Missing E2E Test (AC-9)**
The plan explicitly requires an E2E spec in `tests/e2e/onboarding.spec.ts` that:
- Invites a unique `@gmail.com` candidate via bypass
- Signs in as that candidate via the magic link
- Asserts landing on `/onboarding`

This file is **not listed in the diff**. This is a blocker for full acceptance.

**2. Schema Changes Not Visible**
`convex/schema.ts` shows only `2 +` lines. Cannot verify `invitationFailed` and `invitationError` fields are actually added to the `candidates` table. The tests reference these fields, so they likely exist, but this should be confirmed.

**3. `isAllowListError` Tests Not Verified**
`convex/invitations.test.ts` shows `14 +-` lines but content is truncated. Cannot confirm tests exist for:
- Matching "not allowed to access this application"
- Matching "invalid email" / "email_address is blocked"
- Returning `false` for generic 5xx errors

**4. Frontend Changes Not Verifiable**
Both `InviteCandidateModal.tsx` and `CandidatePipelinePage.tsx` changes are truncated. Cannot verify:
- Modal shows dev-only credentials card on bypass success
- Pipeline page shows "Invitation failed" badge when `invitationFailed` is true
- Magic link is displayed in dev mode

**5. Minor: `act(...)` Warning**
`src/features/hr/pages/HRDashboardPage.test.tsx` has an unrelated `act(...)` warning. Not a blocker for this change.

---

### Test Coverage Analysis

**✅ Strong backend test coverage:**
- `convex/candidates.test.ts:343-427` - bypass success with gmail.com, asserts `invitationId: /^bypass:/`, `manualPassword: /^dev-/`, `magicLink` with ticket
- `convex/candidates.test.ts:430-474` - bypass disabled, record preserved with `invitationFailed: true`
- `convex/candidates.test.ts:477-527` - production URL guard, no bypass calls
- `convex/candidates.test.ts:530-567` - bypass via explicit flag on production URL
- `convex/candidates.test.ts:570-606` - unexpected 5xx error, record preserved

**✅ Member bypass tests:**
- `convex/members.test.ts:58-114` - `firstOrgAdmin` query tests
- `convex/members.ts:288-333` - `createBypassMember` handles existing members

**⚠️ Missing:**
- E2E spec for bypass flow
- Visible `isAllowListError` unit tests

---

### Required Changes

1. **Add E2E spec** in `tests/e2e/onboarding.spec.ts` covering the bypass invite + sign-in flow (AC-9). This is a hard requirement from the plan.

2. **Verify schema changes** - confirm `convex/schema.ts` has:
   ```ts
   invitationFailed: v.optional(v.boolean()),
   invitationError: v.optional(v.string()),
   ```
   in the `candidates` table definition.

3. **Verify frontend implementation** - ensure `InviteCandidateModal.tsx` shows the dev credentials card and `CandidatePipelinePage.tsx` shows the invitation failed badge.

---

### Verdict

The backend implementation is solid with good test coverage and proper security guards. However, the **E2E spec is missing** (AC-9), and several key files are truncated in the diff preventing full verification of schema and frontend changes. These are concrete gaps against the acceptance criteria.

VERDICT: CHANGES_REQUESTED