# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

I've examined the diff against all acceptance criteria and the security/edge-case requirements in the plan. Here are my findings:

---

### Critical Issues

**1. Credentials persisted in the database — security/PHI violation**

`convex/candidates.ts` → `patchCandidateClerkUser` stores `manualPassword` and `magicLink` directly on the candidate document:

```typescript
await ctx.db.patch(args.candidateId, {
  clerkUserId: args.clerkUserId,
  invitationId: args.invitationId,
  manualPassword: args.manualPassword,   // ← stored in DB
  magicLink: args.magicLink,               // ← stored in DB
  invitationFailed: undefined,
  invitationError: undefined,
})
```

And `convex/schema.ts` adds these as persisted fields (4 lines added = `invitationFailed`, `invitationError`, `manualPassword`, `magicLink`).

The plan's security section explicitly states: *"The temporary password and magic link are returned to the caller only; they are **not stored** in the candidates table or logged to external services."* Storing plaintext passwords and auth tokens in the database means any query returning candidate documents leaks them, and they're visible in the Convex dashboard. Even in dev mode this is unacceptable — the action already returns these values to the caller, which is sufficient for the modal to display them.

**Fix:** Remove `manualPassword` and `magicLink` from the schema and from `patchCandidateClerkUser`. The action should return them to the client only; they must never be persisted. The `InviteCandidateModal` can show them from the action response; the `CandidatePipelinePage` should show only the `invitationFailed` badge (not stored credentials). If re-generation is needed, the admin can re-trigger the invite.

---

**2. Debug `console.log` left in production code**

`convex/candidates.ts` line in the catch block:

```
if (isDevInvitationBypassEnabled() && isAllowListError(err) && (console.log("[BYPASS] enabled", ...), true)) {
```

The `(console.log(...), true)` comma-operator pattern is a debug artifact. While functionally equivalent to `true` (so the bypass logic is correct), it logs error details to the server console on every allow-list failure. This must be removed — replace with just the boolean condition:

```typescript
if (isDevInvitationBypassEnabled() && isAllowListError(err)) {
```

---

### Missing Acceptance Criteria

**3. AC-7 not met — no tests in `convex/invitations.test.ts`**

The plan requires *"convex/invitations.test.ts is extended with tests for the allow-list classifier and for bypass success, bypass disabled, and production-URL guard."* The diff does **not** modify `convex/invitations.test.ts` at all. While `isAllowListError` is tested indirectly through the integration tests in `candidates.test.ts`, the classifier deserves its own unit tests in the file specified by the AC.

**4. AC-9 not met — no E2E spec in `tests/e2e/onboarding.spec.ts`**

The plan requires *"tests/e2e/onboarding.spec.ts adds a spec that invites a unique @gmail.com candidate in local dev and signs in as that candidate via the returned bypass magic link."* The diff does **not** include any changes to `tests/e2e/onboarding.spec.ts`. This E2E spec is a core part of the verification strategy and is missing entirely.

---

### Minor Observations (non-blocking)

- **`firstOrgAdmin` query** in `members.ts` and its use in `inviteCandidate` / `createCaregiver` is a good change — Clerk invitations require an admin inviter, and the test *"uses an org:admin as the Clerk inviter even when called by org:hr"* validates this. ✅
- **`requireEnv` refactor** in `candidates.ts` is clean. ✅
- **`deleteInvitedCandidate` removed** — correct per plan; candidate records are now preserved on failure. ✅
- **`patchCandidateInvitationError` and `patchCandidateClerkUser`** both include tenant-scoping checks (`tenant.clerkOrgId !== args.clerkOrgId`), satisfying the multi-tenancy guard requirement. ✅
- **`isAllowListError` regex** covers the required patterns. ✅
- **`.env.example`** documents `ATRIA_X_DEV_INVITE_BYPASS` with a clear dev-only warning. ✅
- **New tests in `candidates.test.ts`** thoroughly cover bypass success, bypass disabled, production-URL guard, record preservation on 500 errors, missing env vars, and admin-inviter behavior. ✅
- **New tests in `members.test.ts`** for `firstOrgAdmin`. ✅
- **Unrelated changes** (`hrCases.ts`, `scheduling.ts`, `forms.test.ts`, `onboarding.test.ts`, `seed.ts`, etc.) appear to be Phase 2 lifecycle additions that are consistent with the branch scope.

---

### Summary of Required Changes

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | `manualPassword` / `magicLink` stored in DB | Critical (security) | Remove from schema and `patchCandidateClerkUser`; return from action only |
| 2 | Debug `console.log` in `inviteCandidate` catch | Medium | Remove `(console.log(...), true)` comma-operator pattern |
| 3 | Missing `invitations.test.ts` classifier tests | AC miss | Add unit tests for `isAllowListError` |
| 4 | Missing E2E spec `onboarding.spec.ts` | AC miss | Add bypass sign-in E2E test |

VERDICT: CHANGES_REQUESTED