# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_204123\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 216.3s rc=0

• # ATRIA-X Phase 2 Clerk QA Fix — Implementation Plan

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Unblock the local dev / E2E environment on `feature/phase-2-worker-onboarding` by making the Clerk dev-instance invitation bypass resilient to the 5-member org quota, and by fixing the local dev sign-in ticket script so its URLs actually authenticate a user at `http://localhost:5173`. All changes must be dev/test-only.

  | ID | Acceptance Criterion |
  |---|---|
  | **AC-1** | `convex/_utils/invitationBypass.ts` frees a Clerk org membership slot when the quota is hit, without ever deleting the four core fixture accounts (`E2E_ADMIN_EMAIL`, `E2E_HR_EMAIL`, `E2E_CAREGIVER_EMAIL`, `E2E_COORDINATOR_EMAIL`). If no free seat exists, it deletes the oldest previous bypass-created member, then the oldest non-essential member (e.g. the seeded candidate), then fails safely. |
  | **AC-2** | Bypass-created Clerk users and org memberships are tagged with `public_metadata.atriaBypass = true` so cleanup can reliably identify them. |
  | **AC-3** | `C:/Users/pinol/Downloads/dev-sign-in-link.js` produces working local URLs of the form `http://localhost:5173/sign-in?__clerk_ticket=<token>` for `all` and for each role (`admin`, `hr`, `caregiver`, `coordinator`, `candidate`), reading emails from `.env.local`. |
  | **AC-4** | New unit tests for the quota-cleanup path are added to the repo and pass. |
  | **AC-5** | A diagnostic script `C:/Users/pinol/Downloads/clerk-quota-check.js` is created/updated to list org memberships, mark protected fixture accounts, and show whether a free slot exists. |
  | **AC-6** | `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` is updated with Gmail-alias candidate testing instructions and the corrected sign-in script usage. |
  | **AC-7** | `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` is written, explaining the two problems, chosen solutions, and implementation stages. |
  | **AC-8** | `npx convex codegen --typecheck=disable`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all pass. |
  | **AC-9** | `npm run e2e:full -- tests/e2e/onboarding.spec.ts` passes, including both the lifecycle spec and the bypass spec. |

  ---

  ## 2. Discovery Notes

  Files inspected:

  - **`convex/_utils/invitationBypass.ts`**
    - `isDevInvitationBypassEnabled()` gates bypass on `APP_URL` localhost or `ATRIA_X_DEV_INVITE_BYPASS=true`.
    - `addClerkOrgMembershipWithQuotaCleanup()` currently catches the Clerk quota error and deletes **only** the membership for `process.env.E2E_CANDIDATE_EMAIL`. It has no protection for the admin/HR/caregiver/coordinator fixtures and no fallback if the candidate is absent.
    - `createClerkUser()` sets `public_metadata: { atriaRole: args.role }` but does **not** mark the account as bypass-created.
    - `addClerkOrgMembership()` sets `public_metadata: { atriaRole: args.role }` but likewise has no bypass marker.
    - `generateClerkSignInTicket()` calls `POST /sign_in_tokens` and returns `payload.token`.
    - `createClerkUserAndJoinOrg()` is the entry point used by `candidates.inviteCandidate`.

  - **`convex/candidates.ts`**
    - `inviteCandidate` action calls `createClerkUserAndJoinOrg` only when `isDevInvitationBypassEnabled()` and `isAllowListError(err)` are true.
    - `regenerateBypassSignInTicket` action re-uses `generateClerkSignInTicket` and builds `${APP_URL}/sign-in?__clerk_ticket=${ticket}`.

  - **`convex/members.ts`**
    - `createBypassMember` internal mutation inserts/updates the `tenantMembers` row for a bypass-created user.
    - `firstOrgAdmin` query supplies the inviter for normal Clerk invitations.

  - **`convex/invitations.ts`**
    - `sendClerkInvitation` posts to `/organizations/{id}/invitations`.
    - `isAllowListError` detects the allow-list / blocked-email error that triggers bypass.

  - **Tests inspected**
    - `convex/invitations.test.ts` already has bypass stubs in `stubClerkBypass()` but no quota-cleanup cases.
    - `convex/candidates.test.ts` covers the allow-list bypass path and `regenerateBypassSignInTicket`.
    - `convex/onboarding.test.ts` covers the candidate-to-caregiver lifecycle.
    - `tests/e2e/onboarding.spec.ts` has two serial `@auth` describe blocks. The bypass spec deletes the fixture candidate in `beforeAll` to free a seat, which is exactly the fragility we need to remove.

  - **Frontend / script inspected**
    - `src/app/auth/SelectAgencyPage.tsx` consumes the Clerk session and calls `tenants.ensureSelectedAgency`.
    - `C:/Users/pinol/Downloads/dev-sign-in-link.js` reads `.env.local` manually, looks up each role’s email via Clerk’s `/users` endpoint, creates a ticket via `/sign_in_tokens`, then host-rewrites the returned `data.url` to `localhost:5173`. The fallback path constructs `localhost:5173/sign-in?__clerk_ticket=<token>` but is only used when `data.url` is missing.
    - `.env.example` documents the required variables (`CLERK_SECRET_KEY`, `E2E_*_EMAIL`, `E2E_CANDIDATE_EMAIL`, `APP_URL`, `ATRIA_X_DEV_INVITE_BYPASS`).

  ---

  ## 3. Alternatives Considered

  | Alternative | Why Rejected |
  |---|---|
  | **Always delete the seeded candidate before any bypass invite** | Too brittle. If the candidate has already been removed, the delete fails and the bypass still breaks. It also does not handle leftover bypass users from earlier runs. |
  | **Delete the oldest org member without a protected list** | Would eventually delete the admin, HR, caregiver, or coordinator fixtures and break every other E2E spec. |
  | **Use `@clerk/backend` SDK in the dev script** | Adds a dependency to a repo-external script and does not fix the actual bug (host-rewriting the Clerk-hosted URL). The raw `/sign_in_tokens` response already exposes the token; the fix is how the local URL is built. |
  | **Point the user at the raw Clerk-hosted `data.url`** | The whole point of local dev is to land on `localhost:5173`, not a Clerk-hosted page. |

  **Chosen approach:**  
  - Build the local URL from the `token` field of the `/sign_in_tokens` response, not from `data.url`.  
  - In the bypass, tag created users/memberships and implement a small, deterministic cleanup priority: (1) oldest bypass-tagged member, (2) seeded candidate fixture, (3) oldest other non-essential member, (4) fail rather than touch protected fixtures.

  ---

  ## 4. Files to Create / Modify

  | File | Change Type | What Changes |
  |---|---|---|
  | `convex/_utils/invitationBypass.ts` | Modify | 1. Add `atriaBypass: true` to `public_metadata` in `createClerkUser` and `addClerkOrgMembership`. 2. Replace the single `E2E_CANDIDATE_EMAIL` deletion in `addClerkOrgMembershipWithQuotaCleanup` with a deterministic helper that sorts memberships by `created_at`, skips protected fixture emails, prefers bypass-tagged members, then falls back to the candidate fixture, then fails. 3. Export or keep helper testable. |
  | `C:/Users/pinol/Downloads/dev-sign-in-link.js` | Modify | 1. Use the `token` field from `POST /sign_in_tokens` (or extract `__clerk_ticket` from `data.url`) to build `http://localhost:5173/sign-in?__clerk_ticket=<token>`. 2. Stop host-rewriting `data.url`. 3. Add clearer error output. 4. Keep `all` / individual role support and `.env.local` parsing. |
  | `convex/invitations.test.ts` | Modify | Add unit tests for the quota-cleanup priority: bypass-tagged member deletion, candidate fixture deletion, protected-fixture preservation, and safe failure when only protected fixtures remain. |
  | `C:/Users/pinol/Downloads/clerk-quota-check.js` | Create | Diagnostic script that lists org memberships, flags protected fixture emails, counts free slots, and optionally deletes the oldest bypass-tagged member if asked. |
  | `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` | Modify | Add “Gmail alias” testing instructions and update the sign-in section to describe the fixed local ticket URL. |
  | `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` | Create | Brief design doc with problem statements, chosen solutions, and staged rollout. |

  No hand-edits to `convex/_generated/**`.

  ---

  ## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

  - **Protected fixture accounts:** The cleanup helper must load `E2E_ADMIN_EMAIL`, `E2E_HR_EMAIL`, `E2E_CAREGIVER_EMAIL`, `E2E_COORDINATOR_EMAIL` into a case-insensitive set and never delete those memberships. If any of those env vars are missing, the helper must still err on the side of safety and only delete known bypass-tagged members.
  - **Bypass tag leak to production:** `atriaBypass` is only ever written by `createClerkUserAndJoinOrg`, which itself is gated by `isDevInvitationBypassEnabled()`. It cannot run in production unless the explicit env flag is set.
  - **Cross-tenant leakage:** The cleanup only touches memberships within the target `clerkOrgId` passed into the bypass; no global org iteration.
  - **PHI:** No patient data is involved in these Clerk-only helpers.
  - **Idempotency:** If the same email is invited twice, `createClerkUser` already returns the existing user on 409/422. The cleanup should run only when the membership POST fails with a quota error, then retry once.
  - **Race conditions:** Two simultaneous bypass invites could both see a full org and both try to delete. The helper should list memberships immediately before deletion and tolerate `resource_not_found` on the delete call.
  - **Ticket misuse:** Sign-in tokens are short-lived (600s). The script should continue to set a short expiry and print a timestamp.

  ---

  ## 6. Test Strategy

  ### Unit / integration tests

  In `convex/invitations.test.ts`, add a `describe('addClerkOrgMembershipWithQuotaCleanup')` block with mocked Clerk responses:

  1. **Bypass-tagged member is removed first.**  
     Mock org membership list with protected admin + an older bypass-tagged member. On the first membership POST return a quota error; assert the bypass-tagged member is deleted and the POST is retried successfully.

  2. **Candidate fixture is removed when no bypass member exists.**  
     Mock list with protected fixtures + seeded candidate. Assert candidate membership is deleted and retry succeeds.

  3. **Protected fixtures are never deleted.**  
     Mock list with only the four protected fixtures. Assert no DELETE calls are made and the original quota error is re-thrown.

  4. **Oldest non-essential member is removed when candidate is absent.**  
     Mock list with protected fixtures + one older non-essential non-bypass member. Assert that member is deleted and retry succeeds.

  ### Build / type / lint gates

  Run after any `convex/**` change:

  ```bash
  npx convex codegen --typecheck=disable
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  ```

  ### E2E gate

  ```bash
  npm run e2e:full -- tests/e2e/onboarding.spec.ts
  ```

  Both `onboarding candidate-to-caregiver` and `dev invitation bypass for restricted emails` must pass.

  ---

  ## 7. Rollback / Verification Notes

  - **Rollback:** Revert `convex/_utils/invitationBypass.ts`, `convex/invitations.test.ts`, and `C:/Users/pinol/Downloads/dev-sign-in-link.js`. Re-run `npx convex codegen --typecheck=disable`, `npm run test`, and the targeted E2E spec.
  - **Verification checklist:**
    - [ ] `isDevInvitationBypassEnabled()` still returns `false` on a production `APP_URL` without the explicit flag.
    - [ ] Quota cleanup deletes a bypass-tagged member before the seeded candidate.
    - [ ] Quota cleanup never deletes admin/HR/caregiver/coordinator fixture emails.
    - [ ] `dev-sign-in-link.js admin` prints a URL that, when opened in a clean browser profile, signs the user in to `localhost:5173`.
    - [ ] `dev-sign-in-link.js all` prints one working URL per configured role.
    - [ ] All lint / typecheck / test / build gates are green.
    - [ ] `npm run e2e:full -- tests/e2e/onboarding.spec.ts` is green.

  ---


[stderr]
• The user wants me to read a prompt file and carry out instructions. Let me first read the file.Wait, the prompt file says "You are a principal/staff engineer PLANNING a code change" and asks to "Produce a premium implementation plan" and "Do NOT write the full code." 

  So I need to produce a plan, not implement the code. I should read the relevant files first as per the discovery requirement. The user asked me to carry out the instructions completely and output final answer/verdict as requested.

  So the instructions are to produce a plan with sections 1-7. I need to inspect the relevant files. Let me find and read the relevant files:
  - Clerk bypass code in convex/
  - `C:/Users/pinol/Downloads/dev-sign-in-link.js`
  - `.env.local`
  - Onboarding tests
  - Manual QA doc
  - Maybe authHelpers

  I should read files. I'm allowed to read outside working directory for the Downloads files since user specified path. Let me start exploring.I need to inspect convex files. Let me read the relevant convex files:
  - convex/_utils/invitationBypass.ts
  - convex/candidates.ts
  - convex/invitations.test.ts
  - convex/onboarding.test.ts
  - convex/tenants.ts
  - convex/authHelpers.ts maybe

  And tests. Also .env.local. And manual QA doc.Now I need to read:
  - convex/tenants.ts to understand seed/fixture logic and env vars for E2E emails
  - .env.local to know E2E emails (maybe contains secrets? But it's not a recognized secret file format? It might contain CLERK keys. But prompt asks me to read emails. System says Read refuses .env files. Let me try. If refused, I can grep with Grep? Grep searches hidden files but skips secrets? .env is probably skipped. I can read the env.example maybe. The task says "reading emails from .env.local" but env.local probably has secrets. I'll read .env.local.example or similar. Actually Read refuses .env files? It says "Sensitive files (.env files...) are refused." So I cannot read .env.local. I can read .env.local.example or .env.example. Let me try those.
  - Manual QA doc
  - E2E onboarding tests
  - members.ts or createBypassMember
  - invitations.ts

  Let me read more.Read the E2E test, .env.example, and maybe members.ts. Also maybe tests/e2e/auth setup.Read candidates.test.ts around quota? Also members.ts. Also env.local via a safe way? Maybe I can read package.json and check test scripts.I need more details about ticket invalid issue. The current script rewrites the domain. Need to investigate Clerk sign_in_tokens API. It returns a URL. I can search Clerk docs or inspect actual response. The problem statement: "The script currently constructs a local URL by rewriting the Clerk-hosted ticket URL's domain to `localhost:5173`. This is apparently invalid." So the returned `data.url` from Clerk is for the hosted sign-in page, not the ticket. Maybe `data.url` includes `?__clerk_ticket=...` and rewriting host invalidates it because the ticket token is bound to the frontend API? Or maybe we should not use `data.url` at all but construct `http://localhost:5173/sign-in?__clerk_ticket=<token>` from the `token` returned. The script currently does use `ticket.clerkUrl.replace(host, baseUrl)` when `clerkUrl` exists, but falls back to constructing local URL with token. The issue says rewriting fails. Maybe `data.url` is actually a magic link to the Clerk-hosted pages (like `https://accounts.foo.dev/sign-in?__clerk_ticket=...`) and when you rewrite to localhost, the ticket becomes invalid because it's bound to the Clerk frontend API. The correct approach might be to extract the `__clerk_ticket` query param from `data.url` and then construct localhost URL with that ticket, not just rewrite the host. Or maybe `data.url` doesn't contain the ticket at all? Let's verify by checking Clerk docs or making an actual API call? But I cannot without secret key. However I can search the web.

  Also check if @clerk/backend package is available; maybe use Clerk SDK to create sign-in token. The script currently uses raw fetch. The fix could be to use `@clerk/backend` `createSignInToken` and use the token field. The prompt says: "The correct approach is likely to use the Clerk SDK or the exact ticket URL/redirect behavior that Clerk expects for local development. Investigate why the rewritten URL fails and implement a working solution."

  Since the instructions say produce a plan (not code), I need to note this investigation. But discovery requirement says I must open and read actual relevant files. I have. I can also do a web search for Clerk sign_in_tokens ticket URL behavior. Let me search.Search didn't directly answer. Let me fetch Clerk API docs for sign_in_tokens.Fetch failed content extraction. Try another URL.No content. Let me search more specifically for sign-in tokens API.Let me fetch that Clerk doc.Need to know response fields. Fetch OpenAPI spec maybe.Update todo list. We have inspected convex bypass and dev-sign-in-link, tests, manual QA. Need still inspect .env.local? It's blocked. We have enough. Mark accordingly.Now I need to produce the premium implementation plan. The instructions say "Do NOT write the full code. Keep the plan focused on ONLY what the task requires." So output a plan with the seven sections. I must cite actual function/type names.

  I should also consider the E2E test currently deletes the fixture candidate in beforeAll. The plan needs to improve quota cleanup in `addClerkOrgMembershipWithQuotaCleanup` to delete oldest non-essential member or previous bypass-created member, preserving admin, hr, caregiver, coordinator fixture accounts. Need to identify those fixture emails. The current code uses only `E2E_CANDIDATE_EMAIL` as sacrificial. Need to add env vars for the four core fixture emails (or hardcode known test emails?) The task says "without deleting essential fixture members (admin, hr, caregiver, coordinator)." The E2E env vars are E2E_ADMIN_EMAIL, E2E_HR_EMAIL, E2E_CAREGIVER_EMAIL, E2E_COORDINATOR_EMAIL. So implement protected set.

  Also it says "If no free seat exists, the bypass should delete the *oldest non-essential* member or a previous bypass-created member". Need to determine how to identify bypass-created members. In `createClerkUserAndJoinOrg` we set `public_metadata: { atriaRole: args.role }` for the membership. Bypass candidate membership has role org:member and public_metadata atriaRole org:candidate. The seeded fixture members likely also have public_metadata atriaRole. Need to identify bypass-created members maybe by invitation? We don't store invitation ID in Clerk. We could add a tag in public_metadata `source: 'atria-dev-bypass'` when creating membership/user. That would allow cleanup to prefer previous bypass-created members. Or identify by email domain? The task says "previous bypass-created member". Best is to mark public_metadata with `atriaBypass: true` for users/memberships created by the bypass. Then cleanup can find memberships where public_user_data.user_id has public_metadata.atriaBypass or membership public_metadata.atriaBypass. But membership public_metadata is returned in list.

  Also "oldest non-essential" member: need to sort by `created_at` ascending. The `listClerkOrgMemberships` returns memberships with `created_at`. We can compute oldest among non-protected.

  Need to preserve core fixture accounts even if they are the oldest. Protected set: E2E_ADMIN_EMAIL, E2E_HR_EMAIL, E2E_CAREGIVER_EMAIL, E2E_COORDINATOR_EMAIL. Also maybe the inviter/admin? The task says "never the four core fixture accounts." So those.

  Also the plan should mention that deletion should also remove the Clerk user optionally? The current `deleteClerkOrgMembership` only removes membership, not user. The E2E test `deleteClerkUserByEmail` deletes user. For quota, membership deletion frees a seat. That is enough. But if a previous bypass-created member remains in org, deleting membership frees seat. The user object doesn't count against quota.

  Need to consider that when quota error occurs, we should attempt cleanup before retry, maybe multiple times? Since quota is 5, if only 1 seat needed, deleting one non-essential should suffice. But if not, fail.

  Also the `isDevInvitationBypassEnabled` is currently strict: uses `new URL(appUrl).hostname === 'localhost'`. If `appUrl` is invalid, it throws. Might be fine.

  Now second issue: sign-in ticket script. Current script uses raw fetch to `/sign_in_tokens` and rewrites `data.url` host. Need to investigate why invalid. I need to provide in plan. Could use `@clerk/backend` SDK if installed. It is not in package.json. But user says "The correct approach is likely to use the Clerk SDK or the exact ticket URL/redirect behavior that Clerk expects for local development." We can add `@clerk/backend` as dev dependency and use `createSignInToken` which returns token and url. Or we can use raw fetch but parse `data.url` to extract `__clerk_ticket` and build local URL. The invalid likely because rewriting host changes the path? Let me investigate actual `data.url`. Clerk sign-in token URL might be `https://accounts.<instance>.dev/sign-in?__clerk_ticket=<token>&redirect_url=...` maybe with signature. The ticket token itself may be bound to the frontend API domain; using it on a different host may be disallowed? Actually sign-in tickets should be usable on any authorized origin as long as the publishable key matches? Hmm.

  The user says "Fix the script so generated sign-in tickets actually work when opened at `http://localhost:5173/sign-in?__clerk_ticket=...`." So the desired local URL is `http://localhost:5173/sign-in?__clerk_ticket=...`. That suggests the script should output exactly that. The current fallback constructs that when no `clerkUrl`. But when `clerkUrl` exists, it rewrites host. So perhaps we should never use `clerkUrl` host; always extract the ticket token and output `baseUrl/sign-in?__clerk_ticket=<token>`. The ticket token in `data.url` may be URL-encoded. We can parse it with URL and searchParams.

  Why would rewriting host fail? Maybe `data.url` from Clerk is `https://clerk.<instance>.dev/v1/tickets/<token>?...`? I need to determine. The prompt says "This is apparently invalid." It asks to investigate. As a plan, I can state: use the token field from the API response directly and construct local URL; avoid rewriting `data.url` because that URL is a Clerk-hosted redirect URL tied to the instance's Frontend API domain and may include additional signed parameters / different path that become invalid when host-rewritten. The sign-in token itself (the `token` field) is what the local app needs in the `__clerk_ticket` query parameter. For local development, `http://localhost:5173/sign-in?__clerk_ticket=<token>` is consumed by the app's Clerk provider and routed through the configured publishable key.

  Need to confirm the response has both `token` and `url`. I couldn't fetch docs. But the current code expects both. The plan can state we will inspect actual API response shape and switch to token-based URL.

  Also "support `all` and individual roles (admin, hr, caregiver, coordinator, candidate), reading emails from `.env.local`." The current script already supports all and roles and reads env. But candidate role isn't included? It includes candidate. Good. It currently prints valid roles without coordinator? It includes coordinator. Need to maybe add `all` default.

  Also need to update manual QA doc to accurately describe how to test with Gmail aliases and sign in with fixed script. Gmail aliases: `user+alias@gmail.com`. The doc currently says use @atriax.example.com. The task says update to describe Gmail aliases and sign in with fixed script.

  Also need design doc.

  Need to mention tests/diagnostic scripts in `C:/Users/pinol/Downloads/` and unit tests for bypass quota cleanup. Unit tests should go in `convex/invitations.test.ts` or a new `convex/invitationBypass.test.ts` to test `addClerkOrgMembershipWithQuotaCleanup` helper. But the helper isn't exported. Could export for tests. Or test via `createClerkUserAndJoinOrg` and mock fetch to simulate quota then cleanup. Need to add tests verifying: 
  - quota error triggers cleanup of sacrificial candidate 
  - cleanup protects core fixture emails 
  - cleanup deletes oldest non-essential member when candidate not present 
  - cleanup prefers bypass-tagged members 
  - never deletes protected fixture accounts.

  Also diagnostic script in Downloads maybe `clerk-quota-check.js` to list org memberships and identify protected/free seats.

  Also mention gate commands: `npx convex codegen --typecheck=disable`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and E2E.

  Now write the plan. It should be a premium implementation plan, not code. We need to output final answer as requested. The user said "Do not ask questions. Output your final answer/verdict as requested." So produce plan.

  I should also consider if any files are generated by codegen and should not be edited manually. Only `convex/_utils/invitationBypass.ts` etc.

  Let's structure plan:

  1. Restated goal & acceptance criteria.
  2. Discovery notes.
  3. Alternatives considered.
  4. Files to create/modify table.
  5. Edge cases.
  6. Test strategy.
  7. Rollback / verification.

  Need to cite actual function/type names.

  Let's craft carefully.

  Acceptance criteria:
  AC-1: Quota cleanup robust. Modify `addClerkOrgMembershipWithQuotaCleanup` in `convex/_utils/invitationBypass.ts` to, on quota error, ensure a free org membership slot by removing one non-protected member before retrying, preserving core fixture accounts. It logs the deleted membership for diagnostics. It never deletes E2E_ADMIN_EMAIL, E2E_HR_EMAIL, E2E_CAREGIVER_EMAIL, E2E_COORDINATOR_EMAIL. If a previous bypass-tagged member exists, remove the oldest one; else remove oldest non-essential; else fail. Unit tests exist and pass.
  AC-2: Mark bypass-created users/memberships. `createClerkUser` and `addClerkOrgMembership` tag `public_metadata` with `atriaBypass: true` (or `source: 'atria-dev-bypass'`) so cleanup can identify them.
  AC-3: Sign-in link script fixed. `C:/Users/pinol/Downloads/dev-sign-in-link.js` uses the raw `token` from Clerk's `POST /v1/sign_in_tokens` response to build `http://localhost:5173/sign-in?__clerk_ticket=<token>` rather than rewriting `data.url` host; supports `all` and individual roles; reads `.env.local` emails; validates `CLERK_SECRET_KEY`. Diagnostic log prints Clerk URL and local URL.
  AC-4: Manual QA doc updated. `atriax-phase2-manual-qa.md` explains using Gmail aliases (`user+alias@gmail.com`) for candidate invites and the fixed sign-in script.
  AC-5: Design doc written. `atriax-phase2-clerk-qa-fix-design.md` with problems, solutions, stages.
  AC-6: Tests pass. `npx convex codegen --typecheck=disable`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` pass.
  AC-7: E2E onboarding suite passes. `npm run e2e:full -- tests/e2e/onboarding.spec.ts` lifecycle and bypass specs pass.

  Discovery notes:
  - Verified `convex/_utils/invitationBypass.ts`: `isDevInvitationBypassEnabled`, `addClerkOrgMembershipWithQuotaCleanup` (currently only deletes `E2E_CANDIDATE_EMAIL`), `createClerkUser`, `addClerkOrgMembership`, `generateClerkSignInTicket`, `createClerkUserAndJoinOrg`.
  - Verified `convex/candidates.ts`: `inviteCandidate` action calls `createClerkUserAndJoinOrg` on allow-list errors; `regenerateBypassSignInTicket`.
  - Verified `convex/members.ts`: `createBypassMember` internal mutation; `firstOrgAdmin` query used for Clerk invitations.
  - Verified `convex/invitations.ts`: `toClerkRole`, `sendClerkInvitation`, `isAllowListError`.
  - Verified tests: `convex/invitations.test.ts` stubs bypass; `convex/candidates.test.ts` has bypass tests; `convex/onboarding.test.ts` lifecycle; `tests/e2e/onboarding.spec.ts` serial auth describe blocks.
  - Verified `src/app/auth/SelectAgencyPage.tsx` consumes Clerk session and boots tenant.
  - Verified `C:/Users/pinol/Downloads/dev-sign-in-link.js` rewrites `clerkUrl` host and falls back to token URL; reads `.env.local` manually; roles include admin, hr, caregiver, coordinator, candidate.
  - Verified `.env.example` defines env vars; `.env.local` is sensitive and not read but expected to contain `CLERK_SECRET_KEY`, `E2E_*_EMAIL`, `E2E_CANDIDATE_EMAIL`.

  Alternatives:
  - Delete oldest member blindly without protection list → could delete admin/hr/caregiver/coordinator; rejected.
  - Use Clerk SDK `@clerk/backend` for sign-in tokens → adds dev dependency and doesn't solve host rewrite; could be done but raw fetch with token is simpler and no new package. Since script is outside repo, adding dependency not needed. Rejected in favor of fixing URL construction.
  - Always delete candidate before bypass → not robust if candidate absent; rejected.

  Files table:
  - `convex/_utils/invitationBypass.ts` - modify: robust quota cleanup, tag bypass users/memberships, keep helper pure dev-only.
  - `C:/Users/pinol/Downloads/dev-sign-in-link.js` - rewrite: build local URL from token only, improve error messages, keep role support.
  - `convex/invitations.test.ts` - add: quota cleanup unit tests.
  - `C:/Users/pinol/Downloads/clerk-quota-check.js` - create: diagnostic script listing org memberships, protected status, free slots.
  - `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` - update: Gmail alias instructions, fixed sign-in script usage.
  - `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` - create: design doc.

  Edge cases:
  - Protected emails missing from env: treat no protected set and only delete bypass-tagged members? Safer to require at least core emails? If missing, don't delete anyone because can't identify essential. The code should only delete known non-essential or bypass-tagged. If no protected emails configured, still should avoid deleting arbitrary oldest? Better: if protected set empty, still delete only bypass-tagged. If none, fail. But task says preserve four core fixture accounts; if env missing, we can't preserve them, so should not delete unknowns. So cleanup should only consider deleting: (a) bypass-tagged members regardless of email, (b) candidate fixture email. This covers.
  - Multiple bypass members: delete oldest bypass-tagged.
  - Candidate fixture is protected? Actually candidate is non-essential but preferentially deletable. So not protected.
  - Concurrent bypass attempts: race possible; retry once after listing fresh.
  - Sign-in ticket expired: script can set longer expiry or print timestamp.
  - Ticket URL vs token: use token from response; if response lacks token, fail.

  Test strategy:
  - Unit tests for `addClerkOrgMembershipWithQuotaCleanup` in `convex/invitations.test.ts` by exporting helper or testing via `createClerkUserAndJoinOrg`. Mock fetch to return membership list with protected fixture + older bypass member; assert bypass member deleted and new membership POST called twice. Mock list with no bypass but candidate fixture; assert candidate deleted. Mock list with only protected fixtures; assert no deletion and error thrown.
  - Run `npx convex codegen --typecheck=disable` after `convex/*` changes.
  - Run lint/typecheck/test/build gates.
  - E2E: `npm run e2e:full -- tests/e2e/onboarding.spec.ts` expecting both describe blocks pass. Ensure `.env.local` has credentials and APP_URL localhost.

  Rollback:
  - Revert `convex/_utils/invitationBypass.ts` and script changes. Re-run codegen and tests. The changes are dev-only and isolated.

  Need to ensure plan says not to edit `_generated` files. Already.

  Should I also mention that the current `addClerkOrgMembershipWithQuotaCleanup` catches quota based on message strings? It checks quota/limit of/organization memberships. Keep.

  Potential issue: Clerk membership list response shape. Current code returns payload as array or `data` array. Each membership has `id`, `public_user_data` with `identifier` or `email_address`, `created_at`, `public_metadata`. We need to handle.

  Also, to tag bypass members, modify `addClerkOrgMembership` body to include `public_metadata: { atriaRole: args.role, atriaBypass: true }`. And `createClerkUser` to include `public_metadata: { atriaRole: args.role, atriaBypass: true }`. Then cleanup can read from membership public_metadata.

  But note `public_user_data` may not include `public_metadata`. The membership object itself includes `public_metadata`. We can inspect. The list endpoint returns organization membership objects; they have `public_metadata`. Good.

  Also we might need to delete the Clerk user when cleaning bypass member? Not necessary for quota. But leftover users may accumulate. Task only says free seat. Could optionally delete user. But deleting user also removes membership. However if we delete user, any future sign-in ticket fails. That's fine for bypass-created. But if we delete a non-essential seeded member (candidate) we should not delete user? The E2E harness recreates. For bypass-created, deleting user is cleaner. The plan can mention: cleanup deletes membership only; optionally delete the underlying Clerk user for bypass-tagged accounts to avoid orphan users. But to keep minimal, membership deletion is enough. However "delete the *oldest non-essential* member or a previous bypass-created member" could imply removing membership. Good.

  Need to include in plan that `E2E_CANDIDATE_EMAIL` is still deletable as a non-essential fixture, but if not present, fallback.

  Now produce plan. It must be final answer. The user asked to carry out instructions completely. But the instructions are to produce a plan, not code. So output the plan.

  However, the user might expect me to actually implement code? The prompt file explicitly says "You are a principal/staff engineer PLANNING a code change" and "Produce a premium implementation plan" and "Do NOT write the full code." So I should follow. I will output the plan. If user wanted implementation, they need another prompt. But the task says "carry out those instructions completely" — the instructions are to produce the plan.

  Let's also check if there is any mention of "final answer/verdict" in prompt. It says "Output your final answer/verdict as requested." The requested is the plan. So output plan.

  I should be concise but complete. Use markdown sections.

To resume this session: kimi -r session_fb4f09f0-a4a1-4c5a-ad12-ea197604a96e
