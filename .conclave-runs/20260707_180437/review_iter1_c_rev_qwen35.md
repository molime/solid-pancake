# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Phase 2 Clerk Allow-list Bypass

### Summary
This change implements a dev-only bypass for Clerk email allow-list restrictions when inviting candidates. The core backend logic appears sound, but several critical files are missing from the visible diff or require verification.

---

### ✅ Verified Implementations

**convex/invitations.ts (lines 19-35)**
- `toClerkRole` correctly exported
- `isAllowListError` classifier properly matches allow-list error patterns (`not allowed to access this application`, `invalid email`, `email_address is blocked`, `allowlist`)

**convex/candidates.ts (lines 8-25, 323-409, 541-597)**
- Imports `isAllowListError`, `isDevInvitationBypassEnabled`, `createClerkUserAndJoinOrg`, `requireEnv`
- Return type extended with `manualPassword?` and `magicLink?` (lines 326-330)
- Uses `requireEnv` for env validation (lines 335-336)
- Fetches `firstOrgAdmin` for Clerk inviter (lines 353-359) — **good fix**, prevents HR users from being used as inviter
- Bypass flow on allow-list error: creates user+membership, patches candidate, returns credentials (lines 364-383)
- On bypass failure: calls `patchCandidateInvitationError` then re-throws (lines 384-392)
- On any other error: calls `patchCandidateInvitationError` then re-throws (lines 395-401)
- **Removed** `deleteInvitedCandidate` cleanup — candidate record now preserved on all failures
- New internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser` include tenant guard via `assertTenantDoc` pattern (lines 541-597)

**convex/members.ts (lines 91-107)**
- `firstOrgAdmin` query correctly finds first org:admin for a tenant

**convex/employeeProfiles.ts (lines 193-206)**
- `createCaregiver` also updated to use `firstOrgAdmin` — **consistent fix**

**convex/candidates.test.ts (lines 313-612)**
- Tests for bypass success with gmail.com email
- Tests for bypass disabled (record preserved, error thrown)
- Tests for production URL guard (no bypass calls)
- Tests for unexpected 5xx errors (record preserved)
- All tests use proper `vi.stubEnv` and `vi.stubGlobal('fetch')` mocking

**convex/members.test.ts (lines 57-115)**
- Tests for `firstOrgAdmin` returning admin or null

**.env.example (lines 8-12)**
- Documents `ATRIA_X_DEV_INVITE_BYPASS` with appropriate warning

---

### ❌ Missing / Cannot Verify from Diff

**1. convex/_utils/invitationBypass.ts — NOT VISIBLE IN DIFF**
- The file is referenced in `convex/_generated/api.d.ts` (lines 11-12), confirming it exists
- **Cannot verify**: `isDevInvitationBypassEnabled()` gating logic, `createClerkUserAndJoinOrg()` Clerk API calls, 409 handling, sign-in ticket generation
- **Risk**: If the env gate is incorrectly implemented, bypass could leak to production

**2. convex/schema.ts — ONLY 2 LINES CHANGED**
- Plan requires adding `invitationFailed?: boolean` and `invitationError?: string` to `candidates` table
- Diff shows only 2 lines changed — **insufficient to verify schema update**
- **Risk**: If schema fields missing, `patchCandidateInvitationError` will fail at runtime

**3. src/features/hr/components/InviteCandidateModal.tsx — 50 LINES CHANGED BUT TRUNCATED**
- **Cannot verify**: Modal handles new return shape (`manualPassword`, `magicLink`), shows dev-only credentials card, keeps modal open on failure
- **Risk**: UX regression if modal closes on error or doesn't show bypass credentials

**4. src/features/hr/pages/CandidatePipelinePage.tsx — 23 LINES CHANGED BUT TRUNCATED**
- **Cannot verify**: INVITATION column added, `invitationFailed` badge rendered, dev-only magic link displayed
- **Risk**: HR operators cannot see failed invitations

**5. tests/e2e/onboarding.spec.ts — NOT IN DIFF**
- Plan AC-9 requires E2E spec that invites gmail.com candidate and signs in via bypass
- **Cannot verify**: Spec exists, uses unique email, gates with `E2E_FULL`
- **Risk**: No end-to-end validation of bypass flow

**6. convex/invitations.test.ts — ONLY 14 LINES CHANGED**
- Plan requires tests for `isAllowListError` classifier and bypass behavior
- **Cannot verify**: Tests cover all required cases (classifier, bypass success, bypass disabled, production guard)

---

### 🔒 Security & Multi-tenancy Review

**Good:**
- `patchCandidateInvitationError` and `patchCandidateClerkUser` both validate tenant via `clerkOrgId` check (lines 556-559, 578-581)
- Bypass uses same `clerkOrgId` passed to `inviteCandidate` — no auth bypass
- Credentials (`manualPassword`, `magicLink`) returned to caller only, not persisted in DB
- Env gate should prevent production use (but cannot verify implementation)

**Concerns:**
- Cannot verify `isDevInvitationBypassEnabled()` actually checks `APP_URL` hostname === 'localhost' OR `ATRIA_X_DEV_INVITE_BYPASS` flag
- If bypass helper doesn't handle 409 "user exists" correctly, could leave orphan Clerk users
- Magic link expiry not surfaced to UI (cannot verify)

---

### 🧪 Test Coverage Gaps

**Missing from visible diff:**
- `convex/invitations.test.ts` — need to verify `isAllowListError` tests exist
- `tests/e2e/onboarding.spec.ts` — E2E spec for bypass flow not visible
- No visible test for 409 user-exists handling in bypass
- No visible test for membership 409 handling

**Present:**
- `convex/candidates.test.ts` has comprehensive bypass tests (lines 313-612)
- `convex/members.test.ts` covers `firstOrgAdmin`

---

### 📋 Required Changes

**BLOCKER 1: Verify convex/_utils/invitationBypass.ts implementation**
- Must confirm `isDevInvitationBypassEnabled()` returns `true` ONLY when `APP_URL` is localhost OR `ATRIA_X_DEV_INVITE_BYPASS` is '1'/'true'
- Must confirm `createClerkUserAndJoinOrg()` handles 409 user-exists and 409 membership-exists
- Must confirm sign-in ticket generation uses correct Clerk API endpoint

**BLOCKER 2: Verify convex/schema.ts has candidates table fields**
- Must confirm `invitationFailed: v.optional(v.boolean())` and `invitationError: v.optional(v.string())` added
- Run `npx convex codegen` and verify `_generated` types include these fields

**BLOCKER 3: Verify frontend changes**
- `InviteCandidateModal.tsx` must show dev credentials card when bypass succeeds
- `CandidatePipelinePage.tsx` must show `invitationFailed` badge

**BLOCKER 4: Verify E2E spec exists**
- `tests/e2e/onboarding.spec.ts` must have bypass invite + sign-in test

---

### Gate Results
| Gate | Status |
|------|--------|
| lint | ✅ PASS |
| typecheck | ✅ PASS |
| unit tests | ✅ PASS (444 tests) |
| e2e | ⚠️ NOT RUN (not in diff) |
| build | ⚠️ NOT RUN |

---

### Verdict

The backend logic in `convex/candidates.ts` and `convex/invitations.ts` is well-implemented. However, critical files are missing from the visible diff, preventing full verification of:
1. The bypass utility implementation (security gate)
2. Schema changes (runtime correctness)
3. Frontend UX (user-facing functionality)
4. E2E tests (end-to-end validation)

These are not cosmetic issues — they are core acceptance criteria from the plan.

VERDICT: CHANGES_REQUESTED