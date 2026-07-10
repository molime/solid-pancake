# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_204123\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 175.3s rc=0

• # ATRIA-X Phase 2 Clerk QA Fix — Synthesized Implementation Plan

  > **Discovery status:** I inspected the actual repo files and the `Downloads` script before writing this plan. Citations below use real function/type names found in the code.

  ---

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Unblock the `feature/phase-2-worker-onboarding` branch dev environment by making the Clerk dev-instance invitation bypass resilient to the 5-member org quota, and by fixing the local dev sign-in ticket script so its URLs authenticate at `http://localhost:5173/sign-in?__clerk_ticket=...`. All changes must be dev/test-only and must not alter production auth behavior.

  | ID | Acceptance Criterion |
  |---|---|
  | **AC-1** | `convex/_utils/invitationBypass.ts` frees a Clerk org membership seat when the 5-member quota is hit, without ever deleting the four core fixture accounts (`E2E_ADMIN_EMAIL`, `E2E_HR_EMAIL`, `E2E_CAREGIVER_EMAIL`, `E2E_COORDINATOR_EMAIL`). If no free seat exists, it deletes the **oldest previous bypass-created member** first, then the **oldest non-essential member** (e.g. `E2E_CANDIDATE_EMAIL`), then fails safely. |
  | **AC-2** | Bypass-created Clerk users and org memberships are tagged with `public_metadata.atriaBypass = true` so cleanup can reliably identify them. |
  | **AC-3** | `C:/Users/pinol/Downloads/dev-sign-in-link.js` produces working local URLs of the form `http://localhost:5173/sign-in?__clerk_ticket=<token>` for `all` and for each role (`admin`, `hr`, `caregiver`, `coordinator`, `candidate`), reading emails from `.env.local`. It must not rewrite the Clerk-hosted `data.url` host. |
  | **AC-4** | New unit tests for the quota-cleanup priority are added to the repo and pass. |
  | **AC-5** | A diagnostic script `C:/Users/pinol/Downloads/clerk-quota-check.js` is created to list org memberships, mark protected fixture accounts, show free slots, and optionally delete the oldest bypass-tagged member. |
  | **AC-6** | `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` is updated with Gmail-alias candidate testing instructions and the corrected sign-in script usage. |
  | **AC-7** | `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` is written, explaining the two problems, chosen solutions, and implementation stages. |
  | **AC-8** | `npx convex codegen --typecheck=disable`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all pass. |
  | **AC-9** | `npm run e2e:full -- tests/e2e/onboarding.spec.ts` passes, including both the lifecycle spec and the bypass spec. |

  ---

  ## 2. Discovery Notes

  Files verified and their relevant contracts:

  - **`convex/_utils/invitationBypass.ts`**
    - `isDevInvitationBypassEnabled()` gates the bypass on `APP_URL` localhost or `ATRIA_X_DEV_INVITE_BYPASS=true`.
    - `addClerkOrgMembershipWithQuotaCleanup()` currently catches the quota error and deletes **only** the membership for `process.env.E2E_CANDIDATE_EMAIL`. It has no protection for admin/HR/caregiver/coordinator fixtures and no fallback if the candidate is absent.
    - `createClerkUser()` sets `public_metadata: { atriaRole: args.role }` but does **not** mark the account as bypass-created.
    - `addClerkOrgMembership()` sets `public_metadata: { atriaRole: args.role }` but likewise has no bypass marker.
    - `generateClerkSignInTicket()` calls `POST /sign_in_tokens` and returns `payload.token`.
    - `createClerkUserAndJoinOrg()` is the entry point used by `candidates.inviteCandidate`.

  - **`convex/candidates.ts`**
    - `inviteCandidate` action calls `createClerkUserAndJoinOrg` only when `isDevInvitationBypassEnabled()` and `isAllowListError(err)` are true.
    - `regenerateBypassSignInTicket` action re-uses `generateClerkSignInTicket` and builds `${APP_URL}/sign-in?__clerk_ticket=${ticket}`.

  - **`convex/invitations.ts`**
    - `sendClerkInvitation` posts to `/organizations/{id}/invitations`.
    - `toClerkRole` maps any non-admin role to `org:member`.
    - `isAllowListError` detects the allow-list / blocked-email error that triggers bypass.

  - **Tests inspected**
    - `convex/invitations.test.ts` already has bypass stubs in `stubClerkBypass()` but no quota-cleanup cases.
    - `convex/candidates.test.ts` covers the allow-list bypass path and `regenerateBypassSignInTicket`.
    - `tests/e2e/onboarding.spec.ts` has two serial `@auth` describe blocks. The bypass spec deletes the fixture candidate in `beforeAll` to free a seat — this is the fragility we need to remove.

  - **Frontend / script inspected**
    - `C:/Users/pinol/Downloads/dev-sign-in-link.js` reads `.env.local` manually, looks up each role’s email via Clerk’s `/users` endpoint, creates a ticket via `/sign_in_tokens`, then host-rewrites the returned `data.url` to `localhost:5173`. The fallback path constructs `localhost:5173/sign-in?__clerk_ticket=<token>` but is only used when `data.url` is missing.
    - `.env.example` documents the required variables (`CLERK_SECRET_KEY`, `E2E_*_EMAIL`, `E2E_CANDIDATE_EMAIL`, `APP_URL`, `ATRIA_X_DEV_INVITE_BYPASS`), but is missing `E2E_HR_EMAIL`/`E2E_HR_PASSWORD` even though the E2E suite uses them.

  ---

  ## 3. Alternatives Considered

  | Alternative | Why Rejected |
  |---|---|
  | **Always delete the seeded candidate before any bypass invite** | Too brittle. If the candidate has already been removed, the delete fails and the bypass still breaks. It also does not handle leftover bypass users from earlier runs. |
  | **Delete the oldest org member without a protected list** | Would eventually delete the admin, HR, caregiver, or coordinator fixtures and break every other E2E spec. |
  | **Use `@clerk/backend` SDK in the dev script** | Adds a dependency to a repo-external script and does not fix the actual bug (host-rewriting the Clerk-hosted URL). The raw `/sign_in_tokens` response already exposes the token; the fix is how the local URL is built. |
  | **Point the user at the raw Clerk-hosted `data.url`** | The whole point of local dev is to land on `localhost:5173`, not a Clerk-hosted page. |
  | **Increase the Clerk dev plan** | Costs money and violates the cost-conscious constraint; unnecessary for dev. |

  **Chosen approach:**  
  - Build the local URL from the `token` field of the `/sign_in_tokens` response, not from `data.url`.  
  - In the bypass, tag created users/memberships and implement a small, deterministic cleanup priority: (1) oldest bypass-tagged member, (2) seeded candidate fixture, (3) oldest other non-essential member, (4) fail rather than touch protected fixtures.

  ---

  ## 4. Files to Create / Modify

  | File | Change type | What changes |
  |---|---|---|
  | `convex/_utils/invitationBypass.ts` | Modify | 1. Add `atriaBypass: true` to `public_metadata` in `createClerkUser` and `addClerkOrgMembership`. 2. Replace the single `E2E_CANDIDATE_EMAIL` deletion in `addClerkOrgMembershipWithQuotaCleanup` with a deterministic helper that sorts memberships by `created_at`, skips protected fixture emails, prefers bypass-tagged members, then falls back to the candidate fixture, then fails. 3. Export or keep the helper testable. |
  | `C:/Users/pinol/Downloads/dev-sign-in-link.js` | Modify | 1. Use the `token` field from `POST /v1/sign_in_tokens` (or extract `__clerk_ticket` from `data.url` as a fallback) to build `http://localhost:5173/sign-in?__clerk_ticket=<token>`. 2. Stop host-rewriting `data.url`. 3. Add clearer error output and role validation. 4. Keep `all` / individual role support and `.env.local` parsing. |
  | `convex/invitations.test.ts` | Modify | Add unit tests for the quota-cleanup priority: bypass-tagged member deletion, candidate fixture deletion, protected-fixture preservation, and safe failure when only protected fixtures remain. |
  | `C:/Users/pinol/Downloads/clerk-quota-check.js` | Create | Diagnostic script that lists org memberships, flags protected fixture emails, counts free slots, and optionally deletes the oldest bypass-tagged member if asked. |
  | `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` | Modify | Add “Gmail alias” testing instructions and update the sign-in section to describe the fixed local ticket URL. |
  | `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` | Create | Brief design doc with problem statements, chosen solutions, and staged rollout. |
  | `.env.example` | Modify (optional but recommended) | Add `E2E_HR_EMAIL` and `E2E_HR_PASSWORD` so the four core fixture accounts are documented alongside the others. |

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
  - **Env var gaps:** If `E2E_HR_EMAIL` is missing from `.env.local`, the protected set is incomplete. The helper should therefore refuse to delete any membership it cannot classify as bypass-tagged or as the known candidate fixture.

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

  5. **Missing protected env vars triggers safe failure.**  
     Unset all fixture env vars, mock a full org. Assert no deletions occur and the quota error is re-thrown.

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

  ### Manual verification

  1. Run `node C:/Users/pinol/Downloads/dev-sign-in-link.js admin`.
  2. Open the printed `localhost:5173` URL in an incognito window.
  3. Confirm sign-in succeeds and the user lands on `/select-agency` (or the default post-auth route).
  4. Repeat for `candidate` using a Gmail alias (`user+alias@gmail.com`).

  ---

  ## 7. Rollback / Verification Notes

  - **Rollback:** Revert `convex/_utils/invitationBypass.ts`, `convex/invitations.test.ts`, `C:/Users/pinol/Downloads/dev-sign-in-link.js`, and the two new `Downloads` files. Re-run `npx convex codegen --typecheck=disable`, `npm run test`, and the targeted E2E spec.
  - **Verification checklist:**
    - [ ] `isDevInvitationBypassEnabled()` still returns `false` on a production `APP_URL` without the explicit flag.
    - [ ] Quota cleanup deletes a bypass-tagged member before the seeded candidate.
    - [ ] Quota cleanup never deletes admin/HR/caregiver/coordinator fixture emails.
    - [ ] `dev-sign-in-link.js admin` prints a URL that, when opened in a clean browser profile, signs the user in to `localhost:5173`.
    - [ ] `dev-sign-in-link.js all` prints one working URL per configured role.
    - [ ] All lint / typecheck / test / build gates are green.
    - [ ] `npm run e2e:full -- tests/e2e/onboarding.spec.ts` is green.

  ---

  **Final verdict:** The synthesized plan above is the coherent, file-grounded implementation plan. It prioritizes the strongest ideas from the candidate plans (token-based local sign-in URL, protected fixture set, deterministic bypass-tag cleanup, diagnostic scripts, and comprehensive test gates) while correcting inaccuracies such as the missing `E2E_HR_EMAIL` documentation and the wrong assumption that `@clerk/backend` is required.


[stderr]
• The user wants me to read a prompt file and carry out instructions. Let me read the file first.The file is large. I need to read the full content. The output was truncated. Let me read it in chunks using line_offset. The preview shows about 25 lines. Let me read more.The Read tool keeps returning a preview. I need to use the output_path to page through. Let me read the output_path file, or maybe use a different approach - read with head or use Bash? Actually the Read tool is showing preview because output exceeded 50000 chars. The file itself is 51121 chars. I should be able to read it with Read at line_offset. But maybe it still returns preview. Let me try reading from a specific line and limiting output. Or I can use the output_path to read the full file. Let me try reading the output_path file directly.This is nested output. I need to read the actual file content. Let me use Bash with `wc -l` to see lines and then read sections. Actually Bash is fine for reading files, but Read tool is preferred. The issue is that Read returns preview when > 50k chars. Maybe I should use `head` and `tail` via Bash, or use `sed` to extract. But the instructions say use Read for known paths and Bash for shell semantics. Let me try reading smaller chunks with line_offset. Maybe the issue is that the preview is shown but the actual content is in the output_path file. I can use the output_path from the latest read. Actually, the simplest is to use Bash to read the file and save sections, or use `cat`. But reading a 51k file isn't that large. Let me try Bash `wc -l` and then `sed`.489 C:/Users/pinol/Documents/Work/atriax/solid-pancake/.conclave-runs/20260707_204123/plan_synthesis.prompt.md
489 lines. I can read it in chunks of maybe 150 lines. But Read tool preview is triggered by total char count. Let me read with line_offset=1, n_lines=120, then 121-240, etc. Each chunk should be under 50k chars.Good, now I can read the file in chunks. Let me continue reading.Interesting - the prompt file includes the candidate plans AND what appears to be the actual output/thoughts of previous agents. Wait, line 224 starts with `[stderr]` which suggests this file contains the output of a previous agent run, not just the prompt. But actually the user said "Read the prompt file at ... and carry out those instructions completely." The prompt itself asks me to synthesize candidate plans into one plan. But the file seems to contain the candidates and possibly previous agent's scratchpad. I need to read the rest to understand.This file appears to be the previous agent's output from a planning task. It contains candidate plans and the agent's scratchpad/working. The user now asks me to "Read the prompt file ... and carry out those instructions completely." But the file itself is a mix of prompt instructions and previous agent's generated content. The instructions at top say to produce a premium implementation plan, synthesizing candidate plans. The file includes what seems to be one candidate plan and another agent's scratchpad. Wait, lines 69-223 is candidate plan from c_plan_agentic. Lines 225 onwards is the previous agent's reasoning and final plan output. So the file might be a transcript or dump. The user wants me to output the final answer/verdict as requested. The final answer requested is the plan. I should synthesize the candidate plans into one coherent plan. I need to read the rest of the file to see if there are more candidate plans and the previous agent's final plan output.Now I see the file contains three candidate plans:
  1. c_plan_agentic (lines 69-223)
  2. c_plan_qwen (lines 392-487)
  3. c_plan_kimi27 (line 489 onwards, only a brief intro)

  It seems the file is a prompt used for plan synthesis, with candidate plans appended. The user wants me to "carry out those instructions completely" — i.e., produce the final synthesized plan. The file includes the previous agent's scratchpad from line 225-387 which appears to be the previous agent's working output (maybe the same model?) and then more candidate plans.

  Wait, the file includes [stderr] from a previous run. It seems like a transcript. But regardless, the instructions at top are clear: produce a premium implementation plan with 7 sections, synthesizing candidate plans. So I should do that.

  I need to inspect the actual relevant files before writing the plan (discovery requirement). The previous agent's scratchpad already did some inspection, but I should verify myself. Since I have tools, I should read the relevant files. Let me read:
  - convex/_utils/invitationBypass.ts
  - C:/Users/pinol/Downloads/dev-sign-in-link.js
  - convex/invitations.test.ts
  - convex/candidates.ts
  - convex/invitations.ts
  - tests/e2e/onboarding.spec.ts
  - C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md (if exists)
  - .env.example
  - package.json for scripts

  Then I can produce the plan. I don't need to implement code.

  But wait - the file includes what looks like a final plan from previous agent (lines 225-387). However, the task is to synthesize candidate plans into one. The previous agent's output is not necessarily a candidate plan; it's their work. I should treat the candidate plans (c_plan_agentic, c_plan_qwen, c_plan_kimi27) as input. But c_plan_kimi27 is incomplete. So I'll synthesize from c_plan_agentic (which seems well-informed) and c_plan_qwen (which is more generic), and my own file inspection.

  Let me read the relevant files now.Good. Now read more files: candidates.ts, invitations.ts, e2e onboarding spec, manual QA doc, .env.example.I have enough context. I should produce the synthesized implementation plan. But first, let me also read .env.example and the manual QA doc (if exists) to cite them. Also maybe package.json.I have enough to produce a comprehensive plan. However, I need to also consider that the prompt file includes a previous agent's output which seems to already be a plan. But the user explicitly wants me to follow the instructions in the prompt file. The instructions are to synthesize candidate plans into one plan. I should not just regurgitate the previous agent's output; I should produce my own synthesized plan based on actual file inspection.

  Key findings:
  - `convex/_utils/invitationBypass.ts` has `addClerkOrgMembershipWithQuotaCleanup` that only deletes `E2E_CANDIDATE_EMAIL` membership.
  - Need robust cleanup: protected set = E2E_ADMIN_EMAIL, E2E_HR_EMAIL, E2E_CAREGIVER_EMAIL, E2E_COORDINATOR_EMAIL (note: .env.example doesn't include E2E_HR_EMAIL, but code uses E2E_HR_EMAIL in tests; the file uses E2E_HR_EMAIL in onboarding.spec.ts. The .env.example has E2E_ADMIN, E2E_COORDINATOR, E2E_CAREGIVER but not E2E_HR. Wait .env.example does not list E2E_HR_EMAIL, but onboarding.spec.ts imports E2E_HR_EMAIL from helpers/auth. There might be a .env.local entry. The task says preserve admin, hr, caregiver, coordinator. So we need E2E_HR_EMAIL too.
  - Need to tag bypass-created users/memberships. Modify `createClerkUser` and `addClerkOrgMembership` to add `public_metadata.atriaBypass = true` (or `source: 'atria-dev-bypass'`).
  - The cleanup priority: (1) oldest bypass-tagged member, (2) seeded candidate fixture (E2E_CANDIDATE_EMAIL), (3) oldest other non-essential member, (4) fail rather than touch protected fixtures.
  - The sign-in ticket script rewrites `data.url` host. Need to stop. The correct local URL: `http://localhost:5173/sign-in?__clerk_ticket=<token>`. Use token from API response. Maybe also extract from `data.url` if token missing.
  - Need unit tests in `convex/invitations.test.ts` (or new file) for quota cleanup. Since helper is private, maybe export it or test through `createClerkUserAndJoinOrg`. Better export `addClerkOrgMembershipWithQuotaCleanup` for testing, or create a thin exported wrapper. But plan can say export the helper or test via `createClerkUserAndJoinOrg` by mocking fetch.
  - Diagnostic script `C:/Users/pinol/Downloads/clerk-quota-check.js` to list memberships, protected status, free slots.
  - Update manual QA doc with Gmail aliases and fixed script.
  - Write design doc.
  - Run gates.

  Now, the prompt says "Output your final answer/verdict as requested." So final answer should be the plan. I will produce a clean markdown plan with the 7 sections. I should mention I inspected actual files.

  One concern: the prompt file is 490 lines and includes candidate plans. The user wants me to "carry out those instructions completely." It doesn't ask me to implement code. So I will output the plan.

  But wait: the previous agent's output includes a final plan and then candidate plans. It might be that the user wants me to act as a plan synthesis judge and output the best plan. I will do exactly that: produce one coherent plan.

  Let me also check if there are any other relevant files like `convex/members.ts` or auth helpers. I have enough but could mention. Maybe read `convex/members.ts` quickly? Not necessary. I'll mention I inspected.

  Also need to mention that `E2E_HR_EMAIL` is missing from `.env.example` but used in E2E; we should add it to `.env.example` as part of the changes. Actually .env.example doesn't list E2E_HR_EMAIL; maybe it's intentionally omitted? But the task says protect four core fixtures including HR. We should ensure `.env.example` documents `E2E_HR_EMAIL` and `E2E_HR_PASSWORD`? The prompt says only dev/test-time code and scripts; updating .env.example is documentation/env. Could be included. I'll mention it.

  Also need to mention `@clerk/backend` not installed. The script should stay dependency-free. Use raw fetch and token.

  Now I need to write the final plan. It should be premium, concise, with actual function/type names. I'll include sections 1-7.

  Let me draft:

  # ATRIA-X Phase 2 Clerk QA Fix — Implementation Plan

  ## 1. Restated Goal & Acceptance Criteria
  Goal: Unblock local dev/E2E on `feature/phase-2-worker-onboarding` by making the Clerk dev-instance invitation bypass resilient to the 5-member quota and fixing the local sign-in ticket script.

  AC-1: Quota cleanup robust in `convex/_utils/invitationBypass.ts` ...
  AC-2: Bypass-created accounts tagged ...
  AC-3: Sign-in ticket script fixed ...
  AC-4: Unit tests added ...
  AC-5: Diagnostic script created ...
  AC-6: Manual QA doc updated ...
  AC-7: Design doc written ...
  AC-8: Gates pass ...

  ## 2. Discovery Notes
  Files verified:
  - `convex/_utils/invitationBypass.ts`: `isDevInvitationBypassEnabled`, `createClerkUser`, `addClerkOrgMembership`, `addClerkOrgMembershipWithQuotaCleanup` (only deletes E2E_CANDIDATE_EMAIL), `generateClerkSignInTicket`, `createClerkUserAndJoinOrg`.
  - `convex/candidates.ts`: `inviteCandidate` triggers bypass via `createClerkUserAndJoinOrg`; `regenerateBypassSignInTicket` builds magic link.
  - `convex/invitations.ts`: `sendClerkInvitation`, `toClerkRole`, `isAllowListError`.
  - `convex/invitations.test.ts`: stubClerkBypass, existing tests for bypass.
  - `tests/e2e/onboarding.spec.ts`: lifecycle and bypass specs; bypass spec currently deletes fixture candidate in beforeAll.
  - `C:/Users/pinol/Downloads/dev-sign-in-link.js`: rewrites `data.url` host; reads .env.local manually; roles admin/hr/caregiver/coordinator/candidate.
  - `.env.example`: documents variables, but missing `E2E_HR_EMAIL`/`E2E_HR_PASSWORD`.

  ## 3. Alternatives Considered
  - Delete only candidate fixture: brittle, fails if absent.
  - Delete oldest unprotected: risks fixtures.
  - Use `@clerk/backend` SDK: extra dependency, host-rewrite still wrong.
  - Use Clerk-hosted `data.url`: not local dev.
  - Chosen: token-based local URL + deterministic protected-set cleanup.

  ## 4. Files to Create/Modify
  Table.

  ## 5. Edge Cases
  Protected fixture emails, missing env vars, cross-tenant scope, production safety (gated by `isDevInvitationBypassEnabled`), race/concurrent deletions, ticket expiry, idempotency.

  ## 6. Test Strategy
  Unit tests for quota cleanup scenarios, gate commands, E2E command.

  ## 7. Rollback/Verification
  Revert files, re-run codegen/tests, checklist.

  I should keep it focused and not write code. Also include the exact env var names and function names.

  One thing: the prompt asks to "synthesize candidate plans into ONE coherent, de-duplicated, best-of-all implementation plan. Resolve conflicts, keep the strongest ideas". So my plan should reflect synthesis. I'll note that I drew from the candidate plans but corrected based on file inspection (e.g., actual file locations).

  I should also note that the discovery requirement says if agentic CLI, must read files. I did. So I'll state that.

  Now produce final output.

To resume this session: kimi -r session_8a7cffbf-f939-46ee-875a-66e0ac5c0482
