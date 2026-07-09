• # ATRIA-X Phase 2 — `inviteCandidate` Clerk allow-list blocker

  ## 1. Restated goal and acceptance criteria

  **Goal:** Make `candidates:inviteCandidate` resilient to the ATRIA-X dev Clerk instance's email allow-list, so local QA can invite `@gmail.com` candidates and the candidate row is never silently deleted when Clerk rejects an invitation.

  **Acceptance criteria:**

  - **AC-1:** `convex/schema.ts` adds `invitationFailed?: boolean` and `invitationError?: string` to the `candidates` table, then `npx convex codegen` regenerates types.
  - **AC-2:** `convex/invitations.ts` exposes an `isAllowListError(err)` classifier that matches Clerk messages such as `not allowed to access this application`, `invalid email`, and `email_address is blocked`.
  - **AC-3:** New file `convex/_utils/invitationBypass.ts` provides:
    - `isDevInvitationBypassEnabled()` — active only when `APP_URL` is `localhost` (any port) **or** `ATRIA_X_DEV_INVITE_BYPASS` is set to `'1'` / `'true'`.
    - `createClerkUserAndJoinOrg(args)` — creates a Clerk user via `POST /v1/users`, adds an org membership via `POST /v1/organizations/{orgId}/memberships` with `public_metadata: { atriaRole: 'org:candidate' }`, handles 409 "user exists", and returns `{ clerkUserId, invitationId: 'bypass:<clerkUserId>', manualPassword, magicLink }`.
    - `generateClerkSignInTicket(clerkUserId)` — creates a `POST /v1/sign_in_tokens` ticket and returns a `/sign-in?__clerk_ticket=...` magic link.
  - **AC-4:** `convex/candidates.ts` adds internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser`, and refactors `inviteCandidate` so that:
    - On a Clerk failure it **never** calls `deleteInvitedCandidate`.
    - If the failure is an allow-list error and the bypass is enabled, it attempts `createClerkUserAndJoinOrg` once and patches the candidate with the resulting `clerkUserId` + sentinel `invitationId`.
    - On any other failure, or if the bypass itself fails, it calls `patchCandidateInvitationError` to set `invitationFailed: true` and the raw error text, then re-throws the original error.
  - **AC-5:** `src/features/hr/components/InviteCandidateModal.tsx` keeps the modal open on failure and shows a clear, non-disappearing error banner. When the bypass succeeds it shows a dev-only card with the candidate email, temporary password, and a "Sign in as candidate" magic link.
  - **AC-6:** `src/features/hr/pages/CandidatePipelinePage.tsx` adds an **INVITATION** column that renders a `danger` "Invitation failed" badge when `invitationFailed` is true and, in dev mode, exposes the bypass magic link / credentials for that row.
  - **AC-7:** `convex/invitations.test.ts` is extended with tests for the allow-list classifier and for bypass success, bypass disabled, and production-URL guard.
  - **AC-8:** `convex/candidates.test.ts` is extended with tests proving record preservation on Clerk failure, bypass success when enabled, and that bypass refuses to run against a non-local `APP_URL`.
  - **AC-9:** `tests/e2e/onboarding.spec.ts` adds a spec that invites a unique `@gmail.com` candidate in local dev and signs in as that candidate via the returned bypass magic link, landing on `/onboarding`.
  - **AC-10:** All quality gates pass: `npx convex codegen`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, `E2E_FULL=1 npm run e2e` (when credentials exist), and `npm run build`.

  ## 2. Discovery notes

  Repo inspection was performed on the current branch `feature/phase-2-worker-onboarding`.

  - **Failing action:** `convex/candidates.ts:inviteCandidate` (`action`, lines 312–390). It calls `sendClerkInvitation` from `convex/invitations.ts` and, on failure, deletes the newly inserted candidate via `internal.candidates.deleteInvitedCandidate`.
  - **Invitation helper:** `convex/invitations.ts:sendClerkInvitation` calls `POST /v1/organizations/{clerkOrgId}/invitations` and throws a `ConvexError` with the Clerk `long_message`/`message` on non-2xx.
  - **Role mapping:** `convex/invitations.ts:toClerkRole` maps every non-admin role to `org:member`; the app-specific role is carried in `public_metadata.atriaRole`.
  - **Candidate table:** `convex/schema.ts:candidates` currently stores `tenantId`, `clerkUserId?`, `email`, `phone?`, `displayName`, `status`, `source?`, `invitationId?`, `createdAt`. It does not yet track invitation failure state.
  - **Auth guards:** `convex/authHelpers.ts:requireTenantRoleAction` is used by `inviteCandidate`; `requireTenantRole` and `assertTenantDoc` are used by internal mutations. The bypass must stay inside these boundaries.
  - **Existing internal helpers:** `convex/candidates.ts:insertInvitedCandidate` (line 392) creates the candidate and 5 ordered tasks; `patchCandidateInvitationId` (line 491) stores a Clerk invitation id; `deleteInvitedCandidate` (line 506) is the cleanup path to be removed.
  - **Frontend:** `src/features/hr/components/InviteCandidateModal.tsx` submits `api.candidates.inviteCandidate` and shows a simple inline error. `src/features/hr/pages/CandidatePipelinePage.tsx` renders the candidate table with status pills from `candidateStatusPill`.
  - **E2E harness:** `tests/e2e/helpers/auth.ts` already has `signInWithClerk`, `signOut`, and `createSignInTicket`. `tests/e2e/helpers/seed.ts` exposes `callConvexMutation`/`callConvexQuery` and `resetE2ECandidate`. The candidate landing route is `/onboarding` (`src/app/router.tsx`).
  - **Scripts:** `package.json` defines `lint`, `typecheck`, `test`, `e2e`, `e2e:full`, and `build`. `scripts/run-playwright-full.js` requires `.env.e2e` and sets `E2E_FULL=1`.
  - **Environment:** `.env.example` documents `CLERK_SECRET_KEY` and `APP_URL`. The actual dev secrets live in `.env.local`/`.env.local.devonly` (sensitive files, not opened). The new flag `ATRIA_X_DEV_INVITE_BYPASS` should be documented in `.env.example` and `.env.local.devonly`.

  ## 3. Alternatives considered

  | Option | Why it was rejected / chosen |
  | --- | --- |
  | **A. Dashboard-only fix** (add `gmail.com` to the Clerk allow-list) | Not versioned, not reproducible for other devs/testers, leaves production behavior dependent on dashboard state, and cannot be covered by regression tests. |
  | **B. Dev-only backend bypass** (chosen primary fix) | Strictly gated by `APP_URL`/`ATRIA_X_DEV_INVITE_BYPASS`; unblocks local Phase 2 QA deterministically; can be unit- and E2E-tested; cannot leak to production unless the explicit opt-in flag is set. |
  | **C. Resilient invitation + manual fallback** (chosen partial fix) | Keeps the candidate record when Clerk rejects an invitation and surfaces an actionable error. We adopt the "keep the record" part, but we do **not** build a production-grade sign-in ticket flow outside the dev bypass, because Clerk secret-key scopes for production ticket generation are unverified and tickets are single-use/time-bounded. |

  **Decision:** Implement **B + partial C**. The bypass is the primary unblocker; the record-preservation path gives HR operators a visible, recoverable failure state.

  ## 4. Files to create / modify

  | File | Change type | What changes |
  | --- | --- | --- |
  | `convex/_utils/invitationBypass.ts` | Create | `isDevInvitationBypassEnabled()`, `createClerkUserAndJoinOrg({ secretKey, clerkOrgId, email, displayName, role, appBaseUrl })`, `generateClerkSignInTicket({ secretKey, clerkUserId, appBaseUrl })`. Reuses `toClerkRole` from `convex/invitations.ts` (export it if not already exported). |
  | `convex/invitations.ts` | Modify | Export `isAllowListError(err)` and `isEmailRestricted(err)` classifiers; optionally export `toClerkRole`. Keep `sendClerkInvitation` unchanged for the normal path. |
  | `convex/schema.ts` | Modify | Add `invitationFailed: v.optional(v.boolean())` and `invitationError: v.optional(v.string())` to the `candidates` table. |
  | `convex/candidates.ts` | Modify | Add `patchCandidateInvitationError` and `patchCandidateClerkUser` internal mutations. Update `inviteCandidate` to try the bypass on allow-list errors, preserve the record on all failures, and remove the `deleteInvitedCandidate` cleanup. |
  | `src/features/hr/components/InviteCandidateModal.tsx` | Modify | Handle the new action return shape `{ candidateId, invitationId, manualPassword?, magicLink? }`; show a dev-only credentials card on bypass success; keep the error banner visible on failure. |
  | `src/features/hr/pages/CandidatePipelinePage.tsx` | Modify | Add an **INVITATION** column; show a `danger` "Invitation failed" badge when `candidate.invitationFailed` is true; in dev mode, render a magic-link button / credential display for bypassed rows. |
  | `convex/invitations.test.ts` | Modify | Tests for `isAllowListError`; mocked `createClerkUserAndJoinOrg` success path; bypass disabled; production-URL guard. |
  | `convex/candidates.test.ts` | Modify | Tests for bypass success, bypass disabled, production-URL guard, and candidate record preservation on unexpected Clerk errors. |
  | `tests/e2e/onboarding.spec.ts` | Modify | New spec: HR invites a unique `@gmail.com` candidate, bypass card appears, candidate signs in via magic link and lands on `/onboarding`. |
  | `.env.example` | Modify | Add commented `ATRIA_X_DEV_INVITE_BYPASS=1` with a note that it is local-dev only. |
  | `.env.local.devonly` | Modify | Add commented `ATRIA_X_DEV_INVITE_BYPASS=1` line (sensitive file, edit via project conventions). |
  | `convex/README.md` or `docs/dev-setup.md` | Modify | Document the bypass flag, when to use it, and the security guardrails. |

  ## 5. Data / auth / security / multi-tenant / PHI / idempotency edge cases

  - **Multi-tenancy:** The bypass never skips `requireTenantRoleAction`. It uses the same `clerkOrgId` passed to `inviteCandidate`. Internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser` must load the candidate and use `assertTenantDoc` (or `requireTenantRole`) before patching.
  - **Production safety:** `isDevInvitationBypassEnabled()` returns `true` **only** when `APP_URL` parses to `localhost` or `ATRIA_X_DEV_INVITE_BYPASS` is explicitly `'1'`/`'true'`. The helper should return `false` for any other shape. The flag must never be set in production deploys.
  - **Idempotency:** `insertInvitedCandidate` already dedupes by email within a tenant. After a bypass, the candidate row has `invitationId: 'bypass:<clerkUserId>'`; re-inviting the same email currently throws "active candidate already exists." This is acceptable for Phase 2, but the implementer should ensure tests use unique emails and may optionally treat a `bypass:*` invitation id as an incomplete invite to allow re-issue.
  - **User-exists race:** If `POST /v1/users` returns 409, the bypass helper should look up the existing user by email and reuse that `clerkUserId`, then proceed to membership creation. If the membership already exists (409), treat it as success.
  - **Bypass partial failure:** If user creation succeeds but membership creation fails, the helper should attempt best-effort cleanup (delete the orphaned Clerk user) and then fail so `inviteCandidate` falls back to `patchCandidateInvitationError`.
  - **PHI / secrets:** The temporary password and magic link are returned to the caller only; they are **not** stored in the `candidates` table or logged to external services. The dev UI card must be clearly labeled "Local dev only."
  - **Non-allow-list errors:** 5xx, missing scopes, or rate-limit errors do **not** trigger the bypass. The candidate record is preserved, `invitationFailed` is set, and the original error is re-thrown.
  - **Magic-link expiry:** Clerk sign-in tickets are single-use and expire (plan for 600s). The UI should display the expiry clearly and regenerate the invite if needed.
  - **Schema sync:** Any change to `convex/schema.ts` requires `npx convex codegen`. `convex/_generated` must not be edited by hand.

  ## 6. Test strategy

  ### Unit / integration tests (Vitest + convex-test)

  `convex/invitations.test.ts`:
  - `isAllowListError` returns `true` for `"is not allowed to access this application"`, `"invalid email"`, and `"email_address is blocked"`.
  - `isAllowListError` returns `false` for generic 5xx messages.
  - `createClerkUserAndJoinOrg` mocks `POST /v1/users` → 200 + `POST /v1/organizations/{orgId}/memberships` → 200 and returns a sentinel invitation id and magic link.
  - `createClerkUserAndJoinOrg` handles a 409 user-exists response by reusing the returned user id.
  - `isDevInvitationBypassEnabled` is `true` for `APP_URL=http://localhost:5173` and for `APP_URL=https://atriax.io` + `ATRIA_X_DEV_INVITE_BYPASS=1`, and `false` for `APP_URL=https://atriax.io` without the flag.

  `convex/candidates.test.ts`:
  - `inviteCandidate` succeeds via bypass when Clerk returns an allow-list error and the flag is enabled; assert `candidate.clerkUserId` and `candidate.invitationId === 'bypass:<clerkUserId>'`.
  - `inviteCandidate` preserves the candidate record and sets `invitationFailed` + `invitationError` when the bypass is disabled and Clerk returns an allow-list error.
  - `inviteCandidate` preserves the candidate record and sets `invitationFailed` when Clerk returns an unexpected 5xx.
  - `inviteCandidate` does **not** call bypass endpoints when `APP_URL` is production and the flag is unset.
  - `patchCandidateInvitationError` and `patchCandidateClerkUser` update only the candidate in their tenant.

  ### End-to-end test (Playwright)

  In `tests/e2e/onboarding.spec.ts`, add a new `test.describe` block (tag `@auth`, serial, full-run only) with:
  1. `signInAsHR(page)` and navigate to `/hr/candidates`.
  2. Open the invite modal, fill a unique `@gmail.com` email, and submit.
  3. Assert the modal shows the dev bypass card with a magic link (data-testid `bypass-magic-link`).
  4. Extract the magic link URL.
  5. `signOut(page)`.
  6. Navigate to the magic link and wait for redirect to `/onboarding`.
  7. Assert the candidate workspace is ready (URL matches `/onboarding` and "Preparing workspace" is detached).

  Gate the spec with `test.skip(!process.env.E2E_FULL, 'requires live Clerk credentials')` or place it behind the existing `assertE2ECredentialsConfigured` guard.

  ### Gate commands

  Run after every backend change:
  ```bash
  npx convex codegen
  ```

  Run before marking the task complete:
  ```bash
  npm run lint
  npm run typecheck
  npm run test
  npm run e2e
  E2E_FULL=1 npm run e2e:full   # only when .env.e2e credentials exist
  npm run build
  ```

  Report every gate as pass, fail, or skipped with a brief reason.

  ## 7. Rollback / verification notes

  - **Rollback:** Revert the branch `feature/phase-2-worker-onboarding`. If the schema has already been deployed, re-run `npx convex codegen` on the reverted code and verify `convex/_generated` matches the pre-change schema.
  - **Security verification:** With `ATRIA_X_DEV_INVITE_BYPASS` unset and `APP_URL=https://<staging>`, inviting a `@gmail.com` candidate must still fail through Clerk and preserve the record; no bypass endpoints should be called.
  - **Function verification:** With `ATRIA_X_DEV_INVITE_BYPASS=1` and `APP_URL=http://localhost:5173`, inviting a `@gmail.com` candidate must succeed, create a Clerk user + membership, and return a working magic link.
  - **Generated-code verification:** `git diff convex/_generated` should show only files produced by `npx convex codegen`; no hand edits.
  - **Cleanup verification:** After local QA, remove any bypass-created test users from the Clerk dev instance to keep the test account list clean.

  ---

  Plan saved to `C:/Users/pinol/Documents/Work/atriax/solid-pancake/.conclave-runs/20260707_171718/plan_synthesis.md`.


[stderr]
• The user wants me to read a prompt file and carry out those instructions completely, no questions, output final answer/verdict as requested. The file is at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_171718\plan_synthesis.prompt.md. We should read it. Also note the system reminder about auto permission mode active, and do not call AskUserQuestion. We need to obey. We need to read the file.The prompt file is a planning task. It asks to produce a premium implementation plan synthesizing candidate plans. It says do not write full code. It requires discovery: open and read actual relevant files before writing plan. I have read the prompt file. Now I need to actually inspect the relevant files in the repo to write the plan. I should use tools to explore the repo. Need to read design doc at C:/Users/pinol/Downloads/atriax-invitecandidate-allowlist-fix-design.md. Need to inspect convex/invitations.ts, convex/candidates.ts, convex/schema.ts, src/features/hr/components/InviteCandidateModal.tsx, src/features/hr/pages/CandidatePipelinePage.tsx (since candidate plan agentic says in pages), tests/e2e/onboarding.spec.ts, convex/invitations.test.ts, convex/candidates.test.ts, authHelpers.ts, maybe env utils, package.json scripts, .env.local.devonly maybe cannot read due to secret file? Read may refuse .env.local.devonly because sensitive? It says Read refuses .env files by design. So we can't read it via Read; maybe can use Bash cat? But guidelines say do not use shell to read secret files. We can infer env conventions from docs or .env.example. But we can read .env.example, .env.local maybe? .env.local also sensitive. So avoid. The design doc might describe env vars. We can read it. Let's start with parallel reads of known files.We have read main files and design doc. We also need read test files and authHelpers, env utils, package.json, candidateStatus lib. Also candidates.ts beyond 1000 lines? We saw first 1000 lines, maybe relevant content below? We have the relevant functions. Need to read convex/authHelpers.ts, convex/_utils/env.ts, convex/invitations.test.ts, convex/candidates.test.ts, tests/e2e/onboarding.spec.ts, src/features/hr/lib/candidateStatus.ts, package.json. Also maybe members.ts (firstOrgAdmin). Also check existing environment variable names used in code (process.env.APP_URL maybe also VITE_APP_URL? requireEnv uses process.env). Need to read _utils/env.ts. Also check tsconfig? Not needed. Read in parallel.We have substantial info. Need to inspect tests/e2e/helpers/auth.ts and seed.ts to understand how E2E auth helpers work and how to sign in with bypass/magic link. Also maybe docs/dev-setup.md and .env.example. Also check if there's a candidate detail page? CandidatePipelinePage review link. The design mentions manual credentials in CandidatePipelinePage.tsx. Need to check CandidateDetailPage? Not necessary for plan but maybe relevant. We need to know how frontend gets bypass flag. The task says "update src/features/hr/components/InviteCandidateModal.tsx and CandidatePipelinePage.tsx". CandidatePipelinePage is in pages. Need to inspect e2e helpers for signInWithClerk, seed resetE2ECandidate, and env vars. Also maybe need to know existing StatusBadge variants. Read e2e helpers.Need to read tests/e2e/helpers/env.ts to understand mockE2EEnabled, e2eCredentialsAvailable. Also maybe check StatusBadge component, shared ui. Also check convex/README.md? There's no convex/README.md maybe. We can search. Also need to inspect candidate detail page? The task only mentions CandidatePipelinePage. Need to check whether CandidatePipelinePage.tsx is correct path (it is). Need to know how to show bypass credentials: inviteCandidate action returns candidateId and invitationId currently. We may need to change return type to include manualPassword/magicLink maybe only in dev. Need to consider schema changes: candidate table currently has clerkUserId optional, invitationId optional, status, source. We may add invitationFailed boolean or invitationError string? The task says add internal mutations patchCandidateInvitationError + patchCandidateClerkUser. That suggests we store error text and clerkUserId. We might add fields to candidates table: invitationError? or invitationFailed? The prompt says "keep the candidate record on failures instead of deleting it, and add internal mutations patchCandidateInvitationError + patchCandidateClerkUser". The design doc says set `invitationError` metadata and flag `invitationFailed: true`. We can add fields to candidates table: `invitationFailed: v.optional(v.boolean())`, `invitationError: v.optional(v.string())`. Also possibly `clerkUserId` already exists. The `patchCandidateClerkUser` updates clerkUserId (and maybe invitationId sentinel). The bypass sets invitationId sentinel `bypass:<userId>`. We need schema to allow sentinel in invitationId string (it does). For the manual password UI, we need to return it from action. Need to be careful not to leak in production. We can return a dev-only field when bypass active. Since the action runs server side, the client will receive it; in production bypass won't run. We can include `manualPassword` only when bypass enabled. The UI can show it. Alternatively generate a Clerk sign-in ticket and return magic link. The design doc mentions both. Which is simpler? The prompt says "manual credentials/magic link". We can choose one. The E2E helper `createSignInTicket` already exists. But creating a sign-in ticket requires the user_id. The bypass creates user and can generate ticket via `POST /v1/sign_in_tokens`. The helper `createSignInTicket` uses findClerkUserId by email. So in E2E we could either use returned magic link from backend or use helper to create ticket. For tests, easier to return `manualPassword`? But sign-in ticket is more robust because Clerk sign-in can use ticket; password requires user to have password and maybe email verification. Creating user via `/v1/users` can set password and skip email verification? Clerk API supports `skip_password_checks`? Need to know. The design doc says "deterministic random password". Then UI can show email and password, and E2E can sign in with credentials. But using sign-in ticket avoids password. However, the prompt explicitly mentions "manual credentials/magic link". Let's include both maybe: backend returns `manualPassword` and `magicLink` (ticket URL) when bypass active, and UI shows them in dev. But for tests, magic link is easier. Need to ensure sign-in ticket endpoint works with bypass-created user. In local dev with Clerk test instance, sign-in tokens work (createSignInTicket helper uses it). So use ticket. But manual password maybe useful. However, generating a password is simpler than ticket? Let's consider: Clerk user creation POST /v1/users supports fields: email_address, password, skip_password_checks, skip_password_requirement? Actually Clerk Backend API: Create user supports `email_address`, `phone_number`, `password`, `first_name`, `last_name`, `skip_password_checks`, `skip_password_requirement`, `public_metadata`, `private_metadata`, `unsafe_metadata`. We can set password. Then membership. For sign-in, we can use the password. But email might need verification; maybe `skip_password_checks` doesn't skip verification. Sign-in ticket is the established pattern in the repo. The prompt says "dev-only manual credentials/magic link". The design doc says "Return the candidate record plus a `manualPassword` field ... or generate a Clerk sign-in ticket and return a magic link." The E2E spec should "uses the bypass to sign in as a gmail.com candidate." Either approach works. To align with existing helpers, magic link via sign-in ticket is best. But manual credentials may also be shown. However, the prompt says "manual credentials/magic link" plural, so maybe include both. But to keep simple, we can choose magic link. The plan should decide. The synthesis should choose safest/simplest. Let's choose **magic-link (Clerk sign-in ticket)** because it reuses existing `createSignInTicket` helper and avoids email verification issues. Optionally also return `manualPassword`? Maybe not needed. But the prompt explicitly mentions manual credentials. Maybe UI can show "Email / password" but sign-in ticket is also shown. To satisfy, we can return both. But is creating a password necessary if we use ticket? We could create user without password and generate ticket. Then manual credentials would be email + "use magic link". The phrase "manual credentials/magic link" might mean either. We'll plan to return a `magicLink` (Clerk ticket URL) and, for convenience, a `manualPassword` so testers can also sign in with email/password. Actually generating both is not much extra: create user with password, create sign-in ticket. That gives both. UI shows dev-only card with email, password, and "Sign in with magic link" button. E2E uses magic link. But storing password in DB? Not; return to client only. We should not persist password. The action returns it once. That is acceptable for dev. However, passing plaintext password from server to client is a dev-only convenience; fine.

  Need to inspect env.ts for e2e. Also check run-playwright scripts. Also check if there's a convex/_utils directory for invitationBypass. Also maybe check existing convex/_utils files. Also need to see candidate detail page? Not in task but maybe pipeline page uses candidateStatusPill. We have that.

  We need to consider multi-tenancy: bypass helper must use same tenant and org; it should not skip authHelpers. Since inviteCandidate already called requireTenantRoleAction, the bypass runs within that context. The helper itself does not need to re-validate tenant, but internal mutations should assert tenant. `patchCandidateInvitationError` and `patchCandidateClerkUser` are internal mutations; they should receive candidateId, clerkOrgId, etc. They should call requireTenantRole or assertTenantDoc. Since they are called from action after tenant check, still good to assert.

  Need to consider that `createClerkUserAndJoinOrg` in bypass needs `secretKey`, `clerkOrgId`, `email`, `role`, `displayName` maybe. It returns `{ clerkUserId, invitationId: `bypass:${clerkUserId}`, manualPassword, magicLink? }`. It must create user via POST /v1/users, then membership via POST /v1/organizations/{orgId}/memberships. It should handle 409 user exists (then look up user by email or use id from error). It should set public_metadata `{ atriaRole: 'org:candidate' }` and role `org:member` as `toClerkRole`. It should use deterministic password maybe derived from email+secret? No, deterministic could be insecure if leaked; use random password. But for reproducibility in tests, deterministic might be okay if using test secret? Better random; UI returns it. For E2E magic link no need password.

  Idempotency: Re-inviting same email when bypass already created user should not create duplicate candidate (insertInvitedCandidate handles idempotency by existing row). If existing candidate has invitationId sentinel bypass:..., then inviteCandidate returns early at line 338 because result.invitationId is set (but insertInvitedCandidate returns invitationId? It returns only candidateId, isNew, not invitationId. Wait in inviteCandidate, after runMutation internal.candidates.insertInvitedCandidate, it checks `if (result.invitationId) return`. But insertInvitedCandidate returns `{ candidateId, isNew }`, no invitationId. So that check is dead code. Did I misread? Line 331 result = insertInvitedCandidate, line 338 checks result.invitationId, but internal mutation returns only candidateId and isNew. So it never returns early. Hmm maybe insertInvitedCandidate used to return invitationId? Not currently. So re-inviting a withdrawn candidate resets tasks and then sends invitation again. If bypass previously created user and invitationId sentinel, insertInvitedCandidate does not see invitationId because it doesn't have it. The existing candidate with status invited and invitationId bypass:... would be blocked? At line 424: block any active, non-withdrawn, non-incomplete-invite row. Existing status invited with invitationId set is active and not withdrawn and not incomplete (status invited && !invitationId false), so it throws "active candidate already exists". So re-invite after bypass would throw. We may need to adjust: if existing candidate has bypass invitationId and re-invite, perhaps should return existing. But task doesn't require re-invite after bypass. We can note idempotency edge case.

  But we need to update insertInvitedCandidate or add logic to handle bypass. Actually for normal Clerk invitations, an existing candidate with invitationId would also be active and throw on re-invite. That's existing behavior. The early return is dead. Maybe we should fix it? The task says "modify convex/candidates.ts inviteCandidate to try the bypass on those errors, keep the candidate record on failures". It doesn't require fixing dead code. But for bypass, after success, candidate has invitationId sentinel and clerkUserId. Future re-invites could be blocked. Not critical. But the plan can note.

  The prompt says produce a premium implementation plan; do not write full code. We need to synthesize candidate plans into one coherent plan. We should write it to a file? The prompt file itself is at .conclave-runs/20260707_171718/plan_synthesis.prompt.md. The candidate plans include outputs from c_plan_agentic, c_plan_qwen, c_plan_kimi27. The final plan should likely be written to a file in the same directory, e.g., plan_final.md or plan_c_plan_kimi27.md? Since we are the agent assigned this prompt, maybe expected output file is .conclave-runs/20260707_171718/plan_synthesis.md? The prompt says "Output your final answer/verdict as requested." Could output directly in chat. But conclave runs typically write files. Let's inspect directory listing to infer naming conventions. We saw plan_c_plan_agentic.prompt.md, plan_c_plan_kimi27.md (maybe output from kimi27). The prompt file is plan_synthesis.prompt.md. Maybe expected output is plan_synthesis.md. Let's list directory.total 64
drwxr-xr-x 1 pinol 197609     0 Jul  7 17:19 .
drwxr-xr-x 1 pinol 197609     0 Jul  7 17:17 ..
-rw-r--r-- 1 pinol 197609  8260 Jul  7 17:19 plan_c_plan_agentic.md
-rw-r--r-- 1 pinol 197609  4702 Jul  7 17:17 plan_c_plan_agentic.prompt.md
-rw-r--r-- 1 pinol 197609   802 Jul  7 17:17 plan_c_plan_kimi27.md
-rw-r--r-- 1 pinol 197609  6673 Jul  7 17:18 plan_c_plan_qwen.md
-rw-r--r-- 1 pinol 197609 20312 Jul  7 17:19 plan_synthesis.prompt.md
There is plan_c_plan_agentic.md already. The prompt asks to synthesize candidate plans into one coherent plan and output only the final plan as markdown. The expected output likely should be the final answer in chat, or perhaps overwrite plan_c_plan_agentic.md? But the user said "Read the prompt file ... and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested." The instructions inside prompt file are to produce a premium implementation plan with all sections, do not write full code. It does not say write to a file; it says output only the final plan as markdown. The candidate plans mention writing to files, but the prompt says "Output your final answer/verdict as requested." Since we are in a chat, we can output the final plan as a message. However, because this is a conclave planning step, maybe the harness expects the final plan to be in a file. But the user's instruction is to output final answer/verdict as requested. The prompt says "Produce a premium implementation plan... output only the final plan as markdown." So I will output the plan in my final response. But I should also consider writing to the expected file if conclave expects it. The prompt file is plan_synthesis.prompt.md; maybe the harness will read plan_synthesis.md. Hmm. The other candidate plan files are named plan_c_plan_*.md. The synthesis prompt is plan_synthesis.prompt.md. The output file could be plan_synthesis.md. To be safe, I can write the plan to plan_synthesis.md in the same directory and also output in chat? The instruction "Output your final answer/verdict as requested" suggests final chat message. But writing to file doesn't hurt. However, the prompt says "Do NOT write the full code" but writing the plan file is okay. It doesn't explicitly ask to write file, but conclave pattern likely expects file. The candidate plan from c_plan_agentic wrote to plan_c_plan_agentic.md. The synthesis should probably write to plan_synthesis.md. Let's do that and also provide final answer summary. But the user says "Output your final answer/verdict as requested." Maybe final answer should be the plan itself. I can output it in chat and mention saved to file. Since final answer can be long, but plan is comprehensive. The instruction "output only the final plan as markdown" means the response should be only the plan, no extra commentary. But I also want to mention file path? Maybe not. We can output the plan in chat. But if I also write to file, the final answer can be just the plan. The system says when creating/modifying files use tools. Writing plan file is allowed. But if final answer is the plan, I can include it in chat. The user didn't ask to save file; the prompt (which is instructions) says produce plan. I think outputting in chat is enough. But for conclave harness, maybe file is expected. Let's write to plan_synthesis.md and output in chat. However, if I output the entire plan in chat, it's the final answer. If I write to file, the chat can be a brief note. But the prompt says "output only the final plan as markdown" which could mean the response content should be the plan. Since I can do both, but final answer should be the plan. We can include a short line at top "Plan saved to ..." but that violates "only the final plan". Maybe just output plan. I can also write to file silently (tool) and output plan in chat. The user won't see file write but will see plan. That satisfies. Let's write to plan_synthesis.md using Write tool and also output plan in final. Need to ensure no full code in plan. Need all 7 sections.

  Need to read tests/e2e/helpers/env.ts and run scripts, maybe not strictly necessary but helpful for test strategy and gate commands. Also maybe need to inspect StatusBadge variants and maybe candidate detail page? Let's read env.ts and run scripts quickly.We have enough. Need to maybe check tests/e2e/helpers/auth.ts for createSignInTicket: It uses findClerkUserId(email). For bypass-created gmail.com user, that works. The E2E spec can use signInWithClerk(page, gmailEmail, password, orgId, 'org:candidate') if password known, or create a ticket. Since signInWithClerk tries createSignInTicket first, if we have user created and CLERK_SECRET_KEY, it will create ticket and sign in. So the E2E spec just needs to know the bypass email; no need to pass password if ticket works. But if the bypass returns a magic link, the spec can navigate to it. Or the helper can create ticket. The prompt says "uses the bypass to sign in as a gmail.com candidate." So in E2E spec: HR invites gmail.com candidate, gets magic link or credentials from UI, signs out, signs in as candidate. Using existing helper with password (if manual password) is fine. We'll plan to use the manual password returned by bypass and use `signInWithClerk(page, email, password, E2E_ORG_ID, 'org:candidate')`. However, `signInWithClerk` first attempts `createSignInTicket`, which will succeed because user exists, overriding password. It will sign in via ticket. That's okay. But for mock mode, ticket creation returns null (secretKey not set?) Actually `createSignInTicket` returns null if secretKey missing. In mock mode, `signInWithClerk` would fall back to form sign-in, which won't work for a mock user not configured. But the prompt says E2E spec uses bypass to sign in as a gmail.com candidate. In mock E2E, we could use `mockSignInAsRole` after creating the candidate? But the spec should test real sign-in. Maybe the E2E spec should be tagged @auth and run in full mode only? The prompt says add E2E spec in tests/e2e/onboarding.spec.ts that uses the bypass to sign in as a gmail.com candidate. It might be full-only. We can guard with `test.skip` if not full. But we need to consider mock. The existing onboarding.spec.ts runs in both? It uses `assertE2ECredentialsConfigured` beforeAll, which throws if credentials not configured. In mock mode, e2eCredentialsAvailable returns true if base variables set (E2E_CLERK_ORG_ID etc) maybe from .env.e2e? For mock, maybe not. Need to look at .env.e2e? It might be sensitive? .env.e2e is a secret file? Actually .env.e2e may contain credentials; Read refuses. But we can infer. The run script uses .env.e2e if exists. Mock mode maybe set E2E_USE_MOCK. For the new spec, we can use `signInWithClerk` which handles both live and mock? In mock mode, createSignInTicket returns null, then fallback to form sign-in with email/password. But mock sign-in page may not have password fields; the mocks are set via `mockSignInAsRole`. The existing `signInAsCandidate` uses mockSignInAsRole if mock enabled. So for the new spec, better to use a helper that signs in as candidate. But we need the candidate user to exist in Convex. In mock mode, bypass would create a user in Clerk? No, bypass uses Clerk API, but mock mode might not have CLERK_SECRET_KEY. The test would fail. So the spec should probably be live-only (E2E_FULL). We can skip if mock or credentials missing. But the prompt says E2E spec uses bypass to sign in as gmail.com candidate; not necessarily mock. We can plan to gate the spec with `test.skip(!process.env.E2E_FULL, 'full Clerk run only')`. Or use `test.fixme`? We'll include in plan.

  Need to consider how to handle `APP_URL` environment variable in tests. `requireEnv('APP_URL')` is used. In tests, stubEnv APP_URL to localhost. The bypass gate uses APP_URL. Need to also have `ATRIA_X_DEV_INVITE_BYPASS` maybe optional. We need to decide env var name. The design doc uses `ATRIA_X_DEV_INVITE_BYPASS=1`. The prompt uses `ATRIA_X_DEV_INVITE_BYPASS` set. We'll use that.

  Need to inspect the current `.env.local` maybe to confirm APP_URL. But Read refuses .env.local. We know from design doc. We can check docs/dev-setup.md or convex/README.md for env. Search for ATRIA_X_DEV_INVITE_BYPASS maybe not present.Good. Need to consider that candidateStatusPill returns variant/label; we may want to add a separate "invitation failed" indicator independent of status. Since candidate status remains 'invited' even if invitation failed. We can show a badge in a new column or next to status if `invitationFailed` flag. The task says "show a clear invitation-failed badge and dev-only manual credentials/magic link". So in CandidatePipelinePage, add a column "INVITATION" with status "Failed" badge if `invitationFailed`, else "Sent" or "Bypass" if bypass. Also show dev-only card with credentials in CandidatePipelinePage or modal? The prompt says "update src/features/hr/components/InviteCandidateModal.tsx and CandidatePipelinePage.tsx to show a clear invitation-failed badge and dev-only manual credentials/magic link". Could split: modal shows error + dev credentials on bypass; pipeline page shows failed badge. But it says both components show badge and credentials/magic link? Actually likely: InviteCandidateModal shows error banner and, on bypass success, dev credentials; CandidatePipelinePage shows failed badge for existing failed invites and maybe a magic link button. We'll plan: Modal shows the error and, if bypass returns manual credentials/magic link, shows them; Pipeline page shows an `invitationFailed` badge and, if bypass is active, a dev-only card/column with credentials/link. Could be a single combined UX.

  Need to know how `inviteCandidate` action return can include extra fields. It currently returns `{ candidateId, invitationId }`. We'll change to return `{ candidateId, invitationId, manualPassword?, magicLink? }`. The UI can capture returned values. For failures with bypass disabled, the action throws an error, so modal shows error; candidate record persists. For failures due to non-allow-list errors, also record persists (patchCandidateInvitationError). Actually the design says on any Clerk error, keep candidate record and mark `invitationFailed`. But prompt says "keep the candidate record on failures instead of deleting it". So we should patch error for any sendClerkInvitation failure, not only allow-list. Then throw the original error so UI shows it. For allow-list errors with bypass enabled, try bypass; if bypass succeeds, return success; if bypass fails, also keep record and throw. Good.

  Need to define `isAllowListError(err)` classifier. Since sendClerkInvitation throws ConvexError with message. We can check message contains "not allowed to access this application", "invalid email", "email_address is blocked". Use helper in invitations.ts.

  Need to define `isDevInvitationBypassEnabled()` reading `process.env.APP_URL` and `process.env.ATRIA_X_DEV_INVITE_BYPASS`. Gate: APP_URL hostname === 'localhost' or APP_URL starts with 'http://localhost' OR env flag is '1' or 'true'. Should also maybe require `process.env.NODE_ENV !== 'production'`? Not necessary. But to be safe, in production with APP_URL https, bypass only if explicit flag; we can allow flag anywhere for testing but warn. The prompt says activates when APP_URL is localhost or ATRIA_X_DEV_INVITE_BYPASS is set. We'll implement that. But also maybe restrict to `CLERK_SECRET_KEY` starting with `test_`? Not required.

  Need to consider `invitationRedirectUrl` currently throws if protocol not https and hostname not localhost. Localhost APP_URL is fine. Good.

  Need to consider schema changes. Add optional fields to `candidates`: `invitationFailed: v.optional(v.boolean())`, `invitationError: v.optional(v.string())`. Do we need `clerkUserId` already exists. Maybe add `source` already optional. We need internal mutations to patch these. `patchCandidateInvitationError` args: candidateId, invitationError, invitationFailed=true. `patchCandidateClerkUser` args: candidateId, clerkUserId, invitationId? It updates clerkUserId and invitationId. It should also set invitationFailed false? We'll include.

  Need to consider that `inviteCandidate` action currently returns `invitationId` string always; with bypass, `invitationId` sentinel. With failure but record kept, it throws. Good.

  Need to consider updating `insertInvitedCandidate` to not block re-invite of a candidate with bypass sentinel? We can add a small change: if existing has `invitationId` starting with 'bypass:' and re-invite, treat as incomplete? But not required. However, for tests, if we re-invite same gmail.com candidate in multiple tests, duplicate active candidate error might happen. We can avoid by using unique emails. But for robustness, plan can mention.

  Need to consider how to generate deterministic password in bypass. For tests, if we use magic link, no need password. But if we also return manual password, we can generate a random password with crypto.getRandomValues or use a deterministic format like `bypass-<timestamp>`? The design says deterministic random password. Better use a secure random generator. For reproducibility in tests, we can set a test env `ATRIA_X_DEV_INVITE_BYPASS_PASSWORD`? Not needed. We'll generate random and return.

  Need to consider sign-in ticket generation in bypass. `POST /v1/sign_in_tokens` with user_id and expires_in_seconds. The response `token`. Magic link: `${appBaseUrl}/sign-in?__clerk_ticket=${token}`. Need to ensure ticket URL path matches sign-in route. The existing helper uses `/sign-in?__clerk_ticket=`. Good.

  Need to consider error handling in bypass: If user creation succeeds but membership fails, we should attempt to clean up user? Not necessary, but could leave orphan user. We can handle 409 user exists and proceed to membership. If membership fails, maybe delete user. Plan can mention best-effort cleanup.

  Need to consider 409 membership exists (if user already member). Should handle gracefully.

  Need to consider that Clerk user creation requires `email_address` array? Actually Backend API create user accepts `email_address` as string/array? Let's verify. I know Clerk Backend API POST /v1/users accepts `email_address` (array of strings?) Actually docs: `email_address` array? There is also `primary_email_address_id`. The create user endpoint accepts `email_address` (string[]?) Hmm. Need to be accurate. Let's quickly search Clerk docs? Could use WebSearch. But in plan, we can note implementer should follow Clerk API. However, we need to produce correct plan. Let's verify Clerk create user endpoint. Use WebSearch.The web search confirms email_address should be array in create user, and membership endpoint. Good. Also sign-in tokens endpoint exists. Need to verify membership endpoint body. Search.Search not great. We know from code that membership update endpoint uses PATCH /v1/organizations/{orgId}/memberships/{userId}. For create membership, likely POST /v1/organizations/{orgId}/memberships with body { user_id, role, public_metadata }. That is standard. We'll use that.

  Need to check sign_in_tokens endpoint details: POST /v1/sign_in_tokens body { user_id, expires_in_seconds }. Response { token, url? } Actually it returns `token` and maybe `url`. We saw type ClerkSignInToken { token: string }. Magic link constructed manually. Good.

  Now we need to write plan. Need to ensure all sections. Also include specific file names and changes. We should not write code but can include signatures/pseudocode? The prompt says "Do NOT write the full code." We can mention function signatures and behavior. Keep focused.

  Need to incorporate discovery notes with actual function/type names from files we read. Since we are agentic CLI, we inspected files. Need to mention that.

  Need to synthesize candidate plans: c_plan_agentic (detailed, file-specific), c_plan_qwen (chat-only, generic), c_plan_kimi27 (attempted to inspect). We take strongest from agentic and design doc. Need to resolve conflicts: 
  - c_plan_qwen says modify CandidatePipelinePage.tsx in components path (wrong; actual is pages). We'll correct.
  - c_plan_agentic likely has accurate file names.
  - Env gating: use APP_URL localhost or ATRIA_X_DEV_INVITE_BYPASS.
  - Return type: c_plan_qwen mentions `manualPassword` and `devCredentials`. Design doc suggests `manualPassword` or magic link. We'll choose both? Plan can say return `manualPassword` and `magicLink` (sign-in ticket URL) when bypass active.
  - Tests: c_plan_qwen lists generic tests; design doc lists specific cases. We'll include specific cases.
  - E2E: design doc suggests helper for bypass ticket. We'll include spec using bypass.

  Need to mention branch `feature/phase-2-worker-onboarding`, style constraints.

  Need to include rollback/verification notes.

  Need to mention running `npx convex codegen` after schema changes, not hand-editing _generated.

  Need to include edge cases: multi-tenancy (bypass uses same clerkOrgId, does not skip authHelpers), production safety (env gate), idempotency (re-invite with bypass sentinel, record preservation), PHI/security (dev credentials not persisted, only returned), 409 user exists, rate limits, missing scopes, magic link expiry.

  Need to include test strategy with specific unit/integration/e2e cases and gate commands. Need exact commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e` (uses .env.e2e or .env.local; mock if no credentials), `E2E_FULL=1 npm run e2e` (or `npm run e2e:full`), `npm run build`, `npx convex codegen`.

  Need to note that .env.local contains secrets so not inspected; env conventions from design doc and .env.example.

  Need to include a table of files to create/modify.

  Need to include alternatives considered: A dashboard-only fix, B dev bypass, C manual fallback. Chosen B + partial C.

  Need to include acceptance criteria numbered AC-1..AC-9 maybe.

  Let's structure plan:

  1. Restated goal and AC.
  2. Discovery notes.
  3. Alternatives.
  4. Files table.
  5. Edge cases.
  6. Test strategy.
  7. Rollback/verification.

  We need to be careful not to write full code. But we can include proposed function signatures in files table. That's okay.

  Need to consider if `convex/_utils/invitationBypass.ts` should import `toClerkRole` from invitations.ts. Since toClerkRole is not exported. We can export it or duplicate. In plan, note export `toClerkRole` from `invitations.ts` or duplicate helper in bypass.

  Need to consider if `candidates.ts` should import `isDevInvitationBypassEnabled`, `createClerkUserAndJoinOrg` from bypass, and `isAllowListError` from invitations.

  Need to consider schema update fields:
  - `invitationFailed?: boolean`
  - `invitationError?: string`
  Maybe also `bypassMagicLink?: string`? No, don't persist credentials. Only return.

  Need to consider `InviteCandidateModal` return handling: It currently closes on success. If bypass returns magic link, show dev-only card with "Candidate created via dev bypass" and a link. If error, show error banner.

  Need to consider `CandidatePipelinePage`: Add `invitationFailed` column. For candidates with bypass sentinel invitationId, maybe show "Dev bypass" badge; for failed, show "Failed" badge with error tooltip. Maybe add a dev-only action to copy magic link if available. But magic link is transient; after modal closes it's gone. Could store `bypassMagicLink` in candidate record? The prompt says dev-only manual credentials/magic link; maybe store in DB? But storing a sign-in ticket URL is a secret-ish token; it's single-use and expires. For dev convenience, we could store it. But the design doc says manual password returned to UI, not persisted. Magic link could be persisted similarly? It expires in 10 min. Better not persist. The UI modal should show it immediately. In pipeline page, we can show failed badge only. That's enough.

  Need to consider if `patchCandidateInvitationError` should set status? Keep status 'invited' to keep in pipeline. Good.

  Need to consider if `inviteCandidate` should catch only errors from `sendClerkInvitation` and not other errors. It currently wraps sendClerkInvitation try/catch. We'll modify catch. If bypass enabled and isAllowListError(err), call bypass. If bypass succeeds, update candidate via patchCandidateClerkUser (or directly internal mutation). If bypass fails or not enabled, call patchCandidateInvitationError to mark failed, then rethrow err. We should not delete candidate. Need to remove the delete block.

  Need to consider the case where `insertInvitedCandidate` returns existing candidate with invitationId? It doesn't now. We could leave as is. But if we want bypass re-invite idempotency, maybe update insertInvitedCandidate to return invitationId if existing has it, or treat bypass sentinel as incomplete. Not necessary for task. But for robustness, plan can include optional note.

  Need to think about tests for `convex/invitations.test.ts`. Since bypass is in `_utils/invitationBypass.ts`, we can test the helper directly if exported. We need to mock fetch with user creation and membership creation. Also test error classifier. Need to add tests in `convex/invitations.test.ts` maybe also a new `convex/_utils/invitationBypass.test.ts`? The prompt says add tests in convex/invitations.test.ts and convex/candidates.test.ts. So keep in those files. But testing a helper in _utils from invitations.test.ts is okay if imported. Or we can add the classifier in invitations.ts and test it there. The bypass helper can be tested by importing. We'll note.

  Need to include `production-URL guard` test: stub APP_URL to https://atriax.io, no bypass flag, allow-list error, assert bypass not attempted and candidate record preserved? Actually with production URL and error, record should be preserved and error thrown. The test can check fetch not called to user/membership endpoints.

  Need to include `bypass disabled` test: APP_URL localhost, no flag, error is allow-list, assert record preserved and error thrown, no bypass calls.

  Need to include `bypass success` test: APP_URL localhost, flag set, fetch returns allow-list error first, then bypass user+membership succeed, assert candidate has clerkUserId and invitationId sentinel.

  Need to include `record preservation` in candidates.test.ts: same as above. Also test for unexpected 5xx: record preserved and error thrown.

  Need to include tests for `patchCandidateInvitationError` and `patchCandidateClerkUser` maybe internal mutation tests.

  Need to include E2E spec. Since E2E uses Clerk live, plan should note run only when E2E_FULL=1 and credentials exist. Use a unique gmail.com email (with timestamp) to avoid collisions. Use the bypass-returned magic link or password. The spec: sign in as HR, navigate to /hr/candidates, click invite, fill gmail.com email, send. Assert modal shows dev bypass card with magic link. Sign out. Navigate to magic link. Assert candidate portal loads (e.g., /candidate or dashboard). Could also verify candidate profile. Need to know candidate route. The existing onboarding spec uses `/caregiver/today` after hire. For candidate, likely `/candidate` or `/candidate/apply`. We can just assert URL not sign-in and workspace ready. To be safe, plan can say "assert the candidate dashboard loads (URL matches expected candidate route and workspace ready)". We need actual candidate route. Search.We are in the middle of writing the plan. Need to check candidate route for E2E assertion. Read router.tsx.Candidate route is `/onboarding` (CandidateOnboardingPage) guarded by org:candidate. So E2E can assert navigation to /onboarding after sign-in. Good.

  Need to also maybe check RouteGuard to understand fallback. But not needed.

  Now we can write the plan. Need to keep it focused, no code. But we can include pseudocode for function signatures. We need to output final plan as markdown. We should also write it to file plan_synthesis.md. Let's draft plan content.

  We need to cite actual functions/types:
  - `convex/candidates.ts:inviteCandidate` action (line 312), `insertInvitedCandidate` internalMutation (line 392), `patchCandidateInvitationId` (line 491), `deleteInvitedCandidate` (line 506).
  - `convex/invitations.ts:sendClerkInvitation` (line 57), `clerkErrorMessage`, `toClerkRole`.
  - `convex/authHelpers.ts:requireTenantRoleAction`, `requireTenantRole`, `assertTenantDoc`.
  - `convex/schema.ts:candidates` table fields: `tenantId`, `clerkUserId`, `email`, `phone`, `displayName`, `status`, `source`, `invitationId`, `createdAt`.
  - `src/features/hr/pages/CandidatePipelinePage.tsx`, `src/features/hr/components/InviteCandidateModal.tsx`.
  - `tests/e2e/onboarding.spec.ts`, `tests/e2e/helpers/auth.ts` with `signInWithClerk`, `createSignInTicket`, `signOut`.
  - `convex/invitations.test.ts`, `convex/candidates.test.ts` using `convex-test`.

  Need to include acceptance criteria. Let's define:
  AC-1: Schema adds `invitationFailed` and `invitationError` optional fields to `candidates`.
  AC-2: `convex/invitations.ts` exports `isAllowListError` classifier.
  AC-3: Create `convex/_utils/invitationBypass.ts` with env gate and `createClerkUserAndJoinOrg` helper, returns clerkUserId, sentinel invitationId, manual password, magic link; only enabled on localhost APP_URL or ATRIA_X_DEV_INVITE_BYPASS.
  AC-4: `convex/candidates.ts` adds internal mutations `patchCandidateInvitationError` and `patchCandidateClerkUser`; `inviteCandidate` catches sendClerkInvitation failures, tries bypass only for allow-list errors when enabled, preserves candidate record on all failures, no longer deletes.
  AC-5: `InviteCandidateModal.tsx` shows clear error banner and, when bypass succeeds, dev-only credentials/magic link card; keeps modal open on errors.
  AC-6: `CandidatePipelinePage.tsx` displays `invitationFailed` badge and dev-only magic link/credentials if returned.
  AC-7: `convex/invitations.test.ts` covers error classification and bypass behavior (success, disabled, production guard).
  AC-8: `convex/candidates.test.ts` covers record preservation and bypass success.
  AC-9: E2E spec in `tests/e2e/onboarding.spec.ts` invites a gmail.com candidate via bypass and signs in as candidate to `/onboarding`.
  AC-10: `npx convex codegen` runs after schema changes; lint/typecheck/test/e2e/build gates pass.

  Need alternatives: A dashboard-only, B dev bypass, C manual fallback. Chosen B + partial C.

  Files table:
  | File | Change type | What changes |
  | convex/_utils/invitationBypass.ts | Create | `isDevInvitationBypassEnabled()`, `createClerkUserAndJoinOrg()`, `generateClerkSignInTicket()` |
  | convex/invitations.ts | Modify | Export `isAllowListError()`/`isEmailRestricted()`; keep `sendClerkInvitation` unchanged; export `toClerkRole` if needed |
  | convex/schema.ts | Modify | Add `invitationFailed?: boolean`, `invitationError?: string` to candidates |
  | convex/candidates.ts | Modify | `inviteCandidate` catch path; add `patchCandidateInvitationError`, `patchCandidateClerkUser`; remove delete cleanup |
  | src/features/hr/components/InviteCandidateModal.tsx | Modify | Error banner, dev credentials card, return type handling |
  | src/features/hr/pages/CandidatePipelinePage.tsx | Modify | Invitation status column/badge, dev-only link display |
  | convex/invitations.test.ts | Modify | Add classifier + bypass tests |
  | convex/candidates.test.ts | Modify | Add bypass success, disabled, production guard, record preservation tests |
  | tests/e2e/onboarding.spec.ts | Modify | Add bypass invite + sign-in spec |
  | .env.local.devonly / .env.example | Modify | Document ATRIA_X_DEV_INVITE_BYPASS |

  Need edge cases:
  - Multi-tenancy: bypass uses the same `clerkOrgId` from `inviteCandidate`; no authHelpers skipped; internal mutations assert tenant via existing candidate.
  - Production safety: gate is strict; bypass never runs on non-local APP_URL unless explicit flag; recommend never setting flag in production.
  - Idempotency: `insertInvitedCandidate` already dedupes by email within tenant; bypass sentinel invitationId may block re-invite — optional note to handle or not.
  - PHI/security: dev password/magic link returned only to caller, not persisted; don't log.
  - 409 user exists: bypass helper should look up existing user and reuse id; membership 409 should be ignored.
  - Rate limits: propagate errors as bypass failure and preserve record.
  - Missing scopes: bypass fails, record preserved.
  - Magic link expiry: ticket expires in 10 min; UI should show expiration.

  Test strategy:
  - Unit/Integration: Use `convex-test` with `vi.stubEnv` and `vi.stubGlobal('fetch', ...)`. 
    - `invitations.test.ts`: `isAllowListError` recognizes messages; bypass creates user + membership; bypass handles 409 user exists; bypass refuses production URL.
    - `candidates.test.ts`: `inviteCandidate` succeeds via bypass when Clerk returns allow-list error and sets sentinel invitationId/clerkUserId; `inviteCandidate` keeps record and marks `invitationFailed` when bypass disabled; `inviteCandidate` keeps record on unexpected 5xx; `patchCandidateInvitationError` and `patchCandidateClerkUser` work; production URL guard prevents bypass.
  - E2E: Add new spec (maybe full-only) in onboarding.spec.ts. Steps: sign in as HR, navigate /hr/candidates, open modal, fill gmail.com email, submit, assert modal shows dev bypass card with magic link, sign out, navigate magic link, assert /onboarding loads. Use unique email with timestamp. Skip if `E2E_FULL` not set or credentials missing.
  - Gate commands: list.

  Rollback/verification:
  - Rollback: revert branch; ensure schema regenerated.
  - Verification: local dev with bypass flag and gmail.com invite succeeds; staging with flag unset and gmail.com invite fails and record persists; check no manual credentials in production responses; check _generated not manually edited; run all gates.

  Need to mention not hand-editing _generated.

  Now, should we write the plan to file? Let's write to plan_synthesis.md and output final. Use Write tool. Need to ensure content is markdown.We wrote the plan to file. Need to output final answer/verdict as requested. The prompt says output only the final plan as markdown. We can output the plan in the final message. Since it's already in file, we can include the plan content. But final answer may be lengthy. The user asked to carry out instructions completely and output final answer/verdict. The final answer should be the plan. Let's output the plan markdown. We can also mention it's saved to the file. But to follow "output only the final plan", maybe just plan. However, the user asked "Output your final answer/verdict as requested." The requested output is the final plan. So output the plan content. We'll include a brief note at top? Maybe not. Let's output the full plan.

To resume this session: kimi -r session_c6f74be4-8880-49d1-9dd8-a97b6bceb1a1
