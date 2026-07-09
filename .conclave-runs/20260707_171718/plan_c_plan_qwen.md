# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Atria-X Phase 2 Clerk Allow-list Bypass

## 1. Restated Goal and Acceptance Criteria

**Goal:** Enable local development testing of candidate invitations using gmail.com addresses by implementing a strictly environment-gated bypass for Clerk allow-list restrictions, ensuring candidate records are preserved even when Clerk user creation fails, and providing UI feedback for manual recovery in dev.

**Acceptance Criteria:**
- AC-1: Bypass logic is implemented in `convex/invitations.ts` or `convex/_utils/invitationBypass.ts` and activates ONLY when `APP_URL` contains `localhost` OR `ATRIA_X_DEV_INVITE_BYPASS` is explicitly set
- AC-2: `convex/candidates.ts inviteCandidate` catches Clerk allow-list errors, triggers the bypass, and retains the candidate record instead of deleting it on failure
- AC-3: New internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser` are added to handle state recovery
- AC-4: UI components (`InviteCandidateModal.tsx`, `CandidatePipelinePage.tsx`) display a clear 'invitation-failed' badge and show dev-only credentials/magic link when bypass activates
- AC-5: Unit tests cover bypass success, bypass disabled in prod, production-URL guard, and candidate record preservation
- AC-6: E2E spec `tests/e2e/onboarding.spec.ts` verifies a gmail.com candidate can sign in using the bypass mechanism
- AC-7: All quality gates pass: lint, typecheck, unit test, e2e (mock), build, and `npx convex codegen` runs successfully after schema changes

## 2. Discovery Notes

**Limitation Statement:** I am a chat-only AI model and do not have direct filesystem access to read `C:/Users/pinol/Downloads/atriax-invitecandidate-allowlist-fix-design.md` or inspect the current state of `convex/invitations.ts`, `convex/candidates.ts`, or the UI components. This plan is reasoned from the provided task context, standard Convex/Clerk integration patterns, and the Atria-X architecture description.

**Assumed Contracts:**
- `convex/candidates.ts` contains the `inviteCandidate` mutation currently failing
- `convex/invitations.ts` handles Clerk-specific user creation logic
- `authHelpers` guards are present for multi-tenancy and must not be bypassed
- Convex schema requires `npx convex codegen` after any `convex/` changes
- Clerk error for allow-list violation is identifiable (likely 400/403 with specific message)

## 3. Alternatives Considered

- **Option A: Remove Clerk Allow-list Globally**
  - Reject: Security risk. Exposes production instance to unauthorized sign-ups if config syncs across envs
- **Option B: Use Only Allowed Domains in Dev**
  - Reject: High friction for testers. Does not solve the requirement to test gmail.com flows specifically
- **Option C: Dev-Only Bypass (Chosen)**
  - Accept: Safest. Scoped to local environment via env vars. Preserves production security posture. Allows testing of failure states and recovery flows

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `convex/_utils/invitationBypass.ts` | Create | Helper function to check env gates and perform dev-only Clerk user creation or mock success |
| `convex/invitations.ts` | Modify | Integrate bypass helper. Catch allow-list errors. Return bypass tokens if active |
| `convex/candidates.ts` | Modify | Update `inviteCandidate` to catch errors, call bypass, keep record. Add `patchCandidateInvitationError`, `patchCandidateClerkUser` |
| `src/features/hr/components/InviteCandidateModal.tsx` | Modify | Add UI state for 'invitation-failed'. Show dev credentials/link if bypass active |
| `src/features/hr/components/CandidatePipelinePage.tsx` | Modify | Add badge/column for invitation status. Allow manual retry/link copy for failed invites |
| `convex/invitations.test.ts` | Modify | Add tests for bypass logic, env var gating, and error handling |
| `convex/candidates.test.ts` | Modify | Add tests for record preservation on Clerk failure + bypass success |
| `tests/e2e/onboarding.spec.ts` | Modify | Add spec to invite gmail.com user, verify bypass UI, and sign in with dev credentials |
| `.env.local` | Note | Ensure `ATRIA_X_DEV_INVITE_BYPASS=true` is documented for devs |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases

- **Multi-Tenancy:** The bypass must NOT skip `authHelpers` guards. The candidate must still be associated with the correct `orgId`. Bypass only skips Clerk's email domain restriction, not org membership validation
- **Production Safety:** The bypass logic must strictly check `process.env.APP_URL` for `localhost` OR `process.env.ATRIA_X_DEV_INVITE_BYPASS === 'true'`. Any other value must fail hard
- **Idempotency:** Retrying `inviteCandidate` for the same email should not create duplicate candidate records. Use upsert logic or check existing candidate email before creation
- **PHI/Security:** Dev credentials generated during bypass must not be logged to persistent external services. Display only in UI modal during the session
- **Schema Sync:** Any new fields added to `candidates` table (e.g., `invitationStatus`, `devCredentials`) require schema update and `npx convex codegen`

## 6. Test Strategy

**Unit/Integration (Convex):**
- `test('bypass activates on localhost', ...)`
- `test('bypass rejects on production URL', ...)`
- `test('candidate record persists despite Clerk error', ...)`
- `test('patchCandidateClerkUser updates state correctly', ...)`

**E2E (Playwright):**
- `tests/e2e/onboarding.spec.ts`:
  - Navigate to HR pipeline
  - Invite `test@gmail.com`
  - Assert 'invitation-failed' badge appears
  - Assert dev magic link/credentials are visible (only in dev)
  - Use credentials to sign in as candidate
  - Verify candidate dashboard loads

**Gate Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm run test` (Vitest)
- `npm run e2e` (Mock mode)
- `E2E_FULL=1 npm run e2e` (If credentials exist)
- `npm run build`
- `npx convex codegen` (Run immediately after convex/ changes)

## 7. Rollback / Verification Notes

- **Rollback:** Revert branch `feature/phase-2-worker-onboarding`. Ensure `convex/` schema matches production before deploying revert
- **Verification:**
  - Deploy to staging with `ATRIA_X_DEV_INVITE_BYPASS` unset. Confirm gmail.com invites fail normally (security check)
  - Deploy to local dev with `ATRIA_X_DEV_INVITE_BYPASS=true`. Confirm bypass works
  - Check Convex logs for any unexpected bypass triggers in production environment
  - Verify `convex/_generated` files are not manually edited (check git diff)