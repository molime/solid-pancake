# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 Clerk Allow-list Bypass

### Critical Issues Requiring Changes

#### 1. **Corrupted Syntax in `convex/candidates.ts` (Line ~383)**
The diff shows corrupted encoding in the bypass condition:
```typescript
if (isDevInvitationBypassEnabled() 00260026 isAllowListError(err) 00260026 (console.log("[BYPASS] enabled"...
```
The `00260026` appears to be corrupted `&&` operators. This will cause a **syntax error** and break the build. This must be fixed.

#### 2. **Security Issue: Credentials Stored in Database (`convex/candidates.ts` Line ~580-595)**
The `patchCandidateClerkUser` mutation stores `manualPassword` and `magicLink` in the candidates table:
```typescript
await ctx.db.patch(args.candidateId, {
  clerkUserId: args.clerkUserId,
  invitationId: args.invitationId,
  manualPassword: args.manualPassword,  // ⚠️ SECURITY RISK
  magicLink: args.magicLink,            // ⚠️ SECURITY RISK
  invitationFailed: undefined,
  invitationError: undefined,
})
```
**Risk:** Magic links are single-use tokens with expiry; passwords should never be persisted. If the database is compromised or logs are exposed, these credentials could be leaked. The plan explicitly states credentials should be "returned to the caller only; they are **not** stored in the `candidates` table."

**Fix:** Remove `manualPassword` and `magicLink` from the schema patch. Return them only in the action response.

#### 3. **Missing Acceptance Criterion AC-9: E2E Spec**
The file list shows no `tests/e2e/onboarding.spec.ts` changes. The plan requires:
> "add an E2E spec in tests/e2e/onboarding.spec.ts that uses the bypass to sign in as a gmail.com candidate"

The diff shows `tests/e2e/phase1-lifecycle.spec.ts`, `tests/e2e/geofence.spec.ts`, and `tests/e2e/global-setup.ts` modified, but no onboarding spec. This is a **missed AC**.

#### 4. **Missing File: `convex/_utils/invitationBypass.ts`**
The diff shows `convex/_generated/api.d.ts` importing from `../_utils/invitationBypass.js`, but the actual `convex/_utils/invitationBypass.ts` file is **not in the diff**. This file contains the core bypass logic (`isDevInvitationBypassEnabled`, `createClerkUserAndJoinOrg`, `generateClerkSignInTicket`). Without seeing this file, I cannot verify:
- Production URL guard logic
- 409 user-exists handling
- Membership creation error handling
- Best-effort cleanup on partial failure

This must be included for review.

#### 5. **Schema Changes Not Visible**
The diff shows `convex/schema.ts | 4 +` but the actual schema changes are not shown. I need to verify:
- `invitationFailed?: boolean` added
- `invitationError?: string` added
- **No** `manualPassword` or `magicLink` fields added (per security requirement)

If the schema includes credential fields, this compounds issue #2.

#### 6. **Missing Gate Results: E2E and Build**
The gate results show:
- lint: PASS
- typecheck: PASS  
- unit: PASS (445 tests)

But **e2e** and **build** gates are not reported. The plan requires:
```bash
npm run e2e
E2E_FULL=1 npm run e2e:full
npm run build
```
These must be run and reported before approval.

#### 7. **`deleteInvitedCandidate` Removal Not Verified**
The plan states to "remove the `deleteInvitedCandidate` cleanup path." The diff shows `deleteInvitedCandidate` being replaced with `patchCandidateInvitationError`, but I need to confirm the old deletion logic is fully removed and not called elsewhere.

### Positive Observations

- **Test coverage is strong:** `convex/candidates.test.ts` has 445 lines of new tests covering bypass success, bypass disabled, production guard, and record preservation.
- **Multi-tenancy guards present:** Both `patchCandidateInvitationError` and `patchCandidateClerkUser` check `tenant.clerkOrgId !== args.clerkOrgId` before patching.
- **Error classifier exported:** `isAllowListError` is properly exported from `invitations.ts` with regex matching allow-list messages.
- **`firstOrgAdmin` query added:** `convex/members.ts` now exports `firstOrgAdmin` to ensure invitations use an admin as inviter (fixes a potential auth issue).

### Required Changes Summary

| Issue | File | Severity | Fix |
|-------|------|----------|-----|
| Corrupted `&&` operators | `convex/candidates.ts` | **Blocker** | Fix syntax |
| Credentials in DB | `convex/candidates.ts`, `convex/schema.ts` | **Security** | Remove from schema/patch |
| Missing E2E spec | `tests/e2e/onboarding.spec.ts` | **Missed AC** | Add spec |
| Missing bypass utility | `convex/_utils/invitationBypass.ts` | **Review blocker** | Include in diff |
| Missing gates | CI results | **Process** | Run e2e + build |

---

VERDICT: CHANGES_REQUESTED