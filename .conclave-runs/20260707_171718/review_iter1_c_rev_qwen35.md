# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 Clerk Allow-list Bypass

### Summary
This is a substantial change implementing a dev-only bypass for Clerk email allow-list restrictions. The core logic is sound, tests are comprehensive, and gates pass. However, I've identified **3 concrete blockers** that must be addressed before merge.

---

### Issues Requiring Changes

#### 1. `isAllowListError` regex is incomplete (convex/invitations.ts, line ~28)

**Problem:** The regex pattern does not match all error messages specified in the design doc:

```typescript
// Current (incomplete):
return /not allowed to access this application|allow.?list|not on the allowlist|restricted/i.test(message)

// Missing patterns from design doc:
// - "invalid email"
// - "email_address is blocked"
```

**Impact:** If Clerk returns "invalid email" or "email_address is blocked" errors, the bypass will NOT trigger. The candidate record will be preserved (good), but the dev will not get the bypass credentials, blocking local QA for those error cases.

**Fix:** Update the regex to:
```typescript
return /not allowed to access this application|invalid email|email_address is blocked|allow.?list|not on the allowlist|restricted/i.test(message)
```

---

#### 2. Missing E2E spec for bypass flow (AC-9 not satisfied)

**Problem:** The plan explicitly requires:
> **AC-9:** `tests/e2e/onboarding.spec.ts` adds a spec that invites a unique `@gmail.com` candidate in local dev and signs in as that candidate via the returned bypass magic link, landing on `/onboarding`.

The diff shows **no changes** to `tests/e2e/onboarding.spec.ts`. While `tests/e2e/helpers/auth.ts` and `tests/e2e/global-setup.ts` were modified (likely supporting infrastructure), the actual E2E spec exercising the bypass flow is missing.

**Impact:** No end-to-end verification that the bypass flow works in a real browser with live Clerk API calls. This is a critical gap for a security-sensitive dev bypass feature.

**Fix:** Add a new `test.describe` block in `tests/e2e/onboarding.spec.ts` that:
1. Signs in as HR
2. Invites a unique `@gmail.com` candidate
3. Asserts the bypass credentials card appears
4. Signs out and signs in as the candidate via the magic link
5. Asserts landing on `/onboarding`

Gate with `test.skip(!process.env.E2E_FULL, ...)` if credentials are required.

---

#### 3. Orphaned `deleteInvitedCandidate` function (convex/candidates.ts, line ~560)

**Problem:** The plan states:
> "remove the `deleteInvitedCandidate` cleanup path"

The function is no longer called (the `inviteCandidate` catch block no longer invokes it), but **the function definition remains** in the file. This is dead code that could confuse future maintainers or be accidentally re-enabled.

**Impact:** Minor, but violates the "surgical and scope-controlled" principle. Dead code is a maintenance burden and potential security risk if someone re-adds the call.

**Fix:** Remove the entire `deleteInvitedCandidate` internal mutation definition from `convex/candidates.ts`.

---

### Verification Items (Not Blockers)

| Item | Status | Notes |
|------|--------|-------|
| Schema fields `invitationFailed`/`invitationError` | ⚠️ Verify | Diff shows only 2 lines added; tests reference these fields. Typecheck passes, so likely correct, but confirm schema.ts has the fields. |
| `InviteCandidateModal.tsx` UI changes | ⚠️ Verify | 50 lines changed; cannot confirm bypass credentials card is rendered. |
| `CandidatePipelinePage.tsx` badge column | ⚠️ Verify | 23 lines changed; cannot confirm `invitationFailed` badge is displayed. |
| `convex/_utils/invitationBypass.ts` created | ⚠️ Verify | Referenced in api.d.ts diff; file creation not shown in diff excerpt. |
| `firstOrgAdmin` query | ✅ Implemented | Visible in `convex/members.ts` with tests. |
| Unit tests for bypass | ✅ Comprehensive | `convex/candidates.test.ts` has 5 new bypass-related tests covering success, disabled, production guard, and record preservation. |
| All gates pass | ✅ | lint, typecheck, unit tests all PASS. |

---

### Security Review

| Concern | Assessment |
|---------|------------|
| **Production safety** | ✅ `isDevInvitationBypassEnabled` gates on `localhost` OR explicit `ATRIA_X_DEV_INVITE_BYPASS` flag. |
| **Multi-tenancy** | ✅ Internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser` both verify `tenant.clerkOrgId === args.clerkOrgId`. |
| **Credential exposure** | ✅ `manualPassword` and `magicLink` are returned to client only, not persisted in DB. |
| **PHI** | ✅ No PHI touched; candidate email is not PHI. |
| **Idempotency** | ⚠️ Existing candidate with `bypass:*` invitationId will block re-invite (existing behavior). Acceptable for Phase 2 per plan. |

---

### Requested Changes

1. **Fix `isAllowListError` regex** in `convex/invitations.ts` to include `"invalid email"` and `"email_address is blocked"`.
2. **Add E2E spec** in `tests/e2e/onboarding.spec.ts` covering the bypass invite + sign-in flow.
3. **Remove `deleteInvitedCandidate`** function from `convex/candidates.ts` (dead code).

---

VERDICT: CHANGES_REQUESTED