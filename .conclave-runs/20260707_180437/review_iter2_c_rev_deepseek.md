# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Code Review: ATRIA-X Phase 2 – `inviteCandidate` Clerk allow-list bypass

### Summary

The diff implements the core bypass mechanism, adds schema fields, internal mutations, and frontend changes. However, **three concrete blockers** must be addressed before approval. The most critical is storing temporary credentials in the database, which violates the plan’s explicit security requirement and would fail in production due to schema enforcement.

---

### Blocker 1: Temporary credentials stored in candidate record (security + schema violation)

**File:** `convex/candidates.ts`  
**What the diff shows:**

- `patchCandidateClerkUser` accepts `manualPassword` and `magicLink` as optional args and patches them into the candidate document.
- The call site in `inviteCandidate` passes `bypass.manualPassword` and `bypass.magicLink` to this mutation.

**Why it’s a blocker:**

- The plan’s **PHI / security** section explicitly states: *“The temporary password and magic link are returned to the caller only; they are **not** stored in the `candidates` table.”*
- The `candidates` schema (in `convex/schema.ts`) does **not** define `manualPassword` or `magicLink` fields. Convex enforces the schema at runtime, so this patch would throw an error in production. The tests pass only because `convex-test` does not enforce schema strictly.
- Storing a plaintext password and a single-use sign-in token in the database is a security risk, even in dev.

**Required change:**  
Remove `manualPassword` and `magicLink` from `patchCandidateClerkUser` args and from the patch call. The bypass result should be returned directly from the action and used only by the UI, never persisted.

---

### Blocker 2: Missing E2E spec for bypass sign-in

**File:** `tests/e2e/onboarding.spec.ts`  
**What the diff shows:** No changes to this file.

**Why it’s a blocker:**

- **AC-9** requires: *“adds a spec that invites a unique `@gmail.com` candidate in local dev and signs in as that candidate via the returned bypass magic link, landing on `/onboarding`.”*
- The diff includes changes to many other test files but omits this E2E spec entirely.

**Required change:**  
Add the E2E spec as described in the plan, gated behind `E2E_FULL` or `assertE2ECredentialsConfigured`.

---

### Blocker 3: Malformed condition in `inviteCandidate` bypass gate

**File:** `convex/candidates.ts`  
**What the diff shows:**

```typescript
if (isDevInvitationBypassEnabled() 00260026 isAllowListError(err) 00260026 (console.log("[BYPASS] enabled", isDevInvitationBypassEnabled(), "allowList", isAllowListError(err)), true)) {
```

**Why it’s a blocker:**

- The stray `00260026` tokens are not valid JavaScript. Even if they are a diff-rendering artifact, the `console.log` with `, true` makes the condition always evaluate to `true` when the first two parts are true, which is unnecessary and confusing.
- The condition should be a clean `if (isDevInvitationBypassEnabled() && isAllowListError(err))`. The current form is fragile and could mask logic errors.

**Required change:**  
Replace the entire condition with `if (isDevInvitationBypassEnabled() && isAllowListError(err))` and remove the `console.log`.

---

### Additional observations (not blockers)

1. **Unplanned inviter change:** `inviteCandidate` now uses `firstOrgAdmin` instead of `identity.subject`. This is not in the plan. While it may improve security (ensuring only an admin sends invitations), it changes existing behavior. The plan’s AC-4 did not specify this. Consider whether this is intentional and whether it should be documented.

2. **`patchCandidateClerkUser` clears `invitationFailed`/`invitationError`:** This is correct, but ensure that the schema’s `invitationFailed` field is optional and can be set to `undefined` (Convex allows this).

3. **`patchCandidateInvitationError` does not clear `manualPassword`/`magicLink`:** Since those fields should not be stored (see Blocker 1), this is moot after the fix.

4. **Console.log in production code:** The `console.log` in the bypass condition should be removed entirely.

5. **Missing `generateClerkSignInTicket` export:** The plan requires this function in `invitationBypass.ts`. The diff does not show the file content, but the tests pass, so it likely exists. No action needed.

6. **`convex/invitations.test.ts` changes not visible:** The unit gate passed, so tests exist. No action needed.

---

### Verdict

**VERDICT: CHANGES_REQUESTED**