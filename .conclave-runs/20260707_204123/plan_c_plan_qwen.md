# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: ATRIA-X Phase 2 Clerk Dev Environment Fixes

## 1. Restated Goal & Acceptance Criteria

**Goal:** Unblock the `feature/phase-2-worker-onboarding` branch dev environment by resolving Clerk organization member quota limits and fixing invalid sign-in ticket generation for local testing, without impacting production auth flows.

**Acceptance Criteria:**
*   **AC-1 (Quota Cleanup):** The dev bypass utility must automatically maintain at least one available seat in the Clerk organization (max 5 members). It must preserve the four core fixture roles (`admin`, `hr`, `caregiver`, `coordinator`) and only delete the oldest non-essential member if the limit is reached.
*   **AC-2 (Ticket Validity):** The `dev-sign-in-link.js` script must generate sign-in tickets that successfully authenticate when opened at `http://localhost:5173/sign-in?__clerk_ticket=...` without manual URL rewriting.
*   **AC-3 (Script Flexibility):** The sign-in script must support generating tickets for `all` roles or specific roles (`admin`, `hr`, `caregiver`, `coordinator`, `candidate`), sourcing emails from `.env.local`.
*   **AC-4 (Verification):** All build/lint/typecheck/test commands pass (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`).
*   **AC-5 (E2E Stability):** The E2E onboarding suite (`npm run e2e:full -- tests/e2e/onboarding.spec.ts`) passes, including lifecycle and bypass specs.
*   **AC-6 (Documentation):** `atriax-phase2-manual-qa.md` and `atriax-phase2-clerk-qa-fix-design.md` are updated with accurate testing instructions and design rationale.

## 2. Discovery Notes

**Constraint Acknowledgement:** I am a chat-only backend (Ollama/OpenRouter context). I **have not inspected the actual files** at `C:/Users/pinol/Documents/Work/atriax/solid-pancake` or `C:/Users/pinol/Downloads/`. This plan is based on the provided system context (Convex, Clerk, React19, Vite8) and standard patterns for these technologies.

**Expected Structure & Seams:**
*   **Quota Logic:** Likely located in a test utility file (e.g., `tests/helpers/clerk-seed.ts` or `scripts/dev-seed.ts`) where `E2E_CANDIDATE_EMAIL` is currently managed. I expect to find Clerk Backend API usage (`@clerk/backend`) for listing/deleting members.
*   **Ticket Script:** `C:/Users/pinol/Downloads/dev-sign-in-link.js`. Currently likely uses `fetch` to hit Clerk API and string-manipulates the result. Needs to switch to using `createTicket` with correct `redirect_url`.
*   **Auth Guards:** `convex/auth.config.ts` or similar helpers (`authHelpers`) mentioned in context. Changes must not touch these production guards.
*   **Env Vars:** `.env.local` likely contains `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and fixture emails (`ADMIN_EMAIL`, `HR_EMAIL`, etc.).

## 3. Alternatives Considered

| Approach | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Quota: Increase Clerk Plan** | Solves limit permanently. | Costs money (violates Diego's cost-conscious constraint); unnecessary for dev. | **Reject** |
| **Quota: Delete All Non-Admin** | Simple logic. | Risks deleting specific test users needed for parallel sessions; loses history. | **Reject** |
| **Quota: Smart Cleanup (Chosen)** | Keeps core fixtures; recycles oldest temp users; free. | Slightly more logic to implement (sort by `created_at`). | **Accept** |
| **Tickets: URL Rewrite (Current)** | No API changes needed. | Breaks signature/redirect validation; invalid tickets. | **Reject** |
| **Tickets: SDK `createTicket` (Chosen)** | Official support; correct redirect handling; valid signatures. | Requires updating script to use Node SDK properly. | **Accept** |
| **Tickets: Impersonation** | Easy for devs. | Doesn't test actual ticket flow; different security context. | **Reject** |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `C:/Users/pinol/Downloads/dev-sign-in-link.js` | Modify | Replace URL rewriting with Clerk Backend SDK `createTicket` call. Add CLI arg support for roles (`all`, `admin`, etc.). Read emails from `.env.local`. |
| `tests/helpers/clerk-org-manager.ts` (Estimated) | Modify | Implement `ensureAvailableSeat()` logic. List members, filter core fixtures, delete oldest non-essential if count >= 5. |
| `tests/e2e/onboarding.spec.ts` | Verify/Update | Ensure it calls the new org manager before inviting candidates. |
| `C:/Users/pinol/Downloads/atriax-phase2-manual-qa.md` | Update | Document new ticket generation command and Gmail alias testing strategy. |
| `C:/Users/pinol/Downloads/atriax-phase2-clerk-qa-fix-design.md` | Create | Design doc explaining the quota algorithm and ticket fix rationale. |
| `.env.local` | Verify | Ensure all 5 role emails are defined for the script to consume. |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases

*   **Multi-Tenancy:** The cleanup logic **must** scope queries to the specific Dev Organization ID used for testing. It must not accidentally query or delete members from other orgs if the API key has broader permissions.
*   **Race Conditions:** If multiple E2E suites run in parallel (Diego runs multiple sessions), the cleanup logic needs to be atomic or tolerant of concurrent deletions. *Mitigation:* Add a small random jitter or retry logic if deletion fails due to concurrent modification.
*   **Core Fixture Protection:** Hardcode the emails or User IDs of the 4 core fixtures (admin, hr, caregiver, coordinator) in the cleanup utility to prevent accidental deletion.
*   **PHI/PII:** Dev data should be anonymized. Ensure cleanup doesn't log PII of deleted users to console.
*   **Ticket Redirect:** The `redirect_url` passed to `createTicket` must exactly match `http://localhost:5173/sign-in` (including trailing slash consistency) to avoid redirect loops.
*   **Production Safety:** Wrap all cleanup logic in `if (process.env.NODE_ENV !== 'production')` guards. Ensure `CLERK_SECRET_KEY` used is the Dev Instance key, not Production.

## 6. Test Strategy

**Unit/Integration:**
1.  **Quota Logic Unit Test:** Create a test `tests/unit/clerk-org-manager.test.ts`. Mock Clerk API. Verify that when 5 members exist (4 core + 1 temp), the temp is deleted. Verify when 5 members exist (4 core + 1 essential), no deletion occurs (or error handled).
2.  **Ticket Script Dry-Run:** Run `node dev-sign-in-link.js --role=admin --dry-run`. Verify it constructs the correct API payload without sending.

**E2E Gates:**
1.  **Command:** `npx convex codegen --typecheck=disable`
    *   *Expect:* No errors in generated types.
2.  **Command:** `npm run lint && npm run typecheck && npm run test`
    *   *Expect:* All pass.
3.  **Command:** `npm run build`
    *   *Expect:* Production build succeeds (confirms no prod code broken).
4.  **Command:** `npm run e2e:full -- tests/e2e/onboarding.spec.ts`
    *   *Expect:* Both `lifecycle.spec.ts` and `bypass.spec.ts` (within suite) pass. Specifically verify the candidate invitation step does not hit the 5-member limit error.

**Manual Verification:**
1.  Run `node C:/Users/pinol/Downloads/dev-sign-in-link.js --role=candidate`.
2.  Copy the generated URL.
3.  Open in Incognito window.
4.  Verify successful login to `http://localhost:5173` without "Invalid Ticket" error.

## 7. Rollback / Verification Notes

**Rollback Plan:**
1.  **Git Revert:** Since changes are scoped to `tests/`, `scripts/`, and `Downloads/`, a `git revert` of the commit touching `tests/helpers/clerk-org-manager.ts` will restore previous quota logic.
2.  **Script Restore:** Keep a backup copy of `dev-sign-in-link.js` before editing. Restore from backup if ticket generation fails.
3.  **Clerk State:** If cleanup logic accidentally deletes a core fixture, re-run the main seed script (`npm run db:seed` or equivalent) to restore the 4 core members.

**Verification Checklist:**
*   [ ] Confirm `CLERK_SECRET_KEY` in `.env.local` matches the Dev Instance (not Production).
*   [ ] Confirm the 4 core fixture emails are excluded from deletion logic.
*   [ ] Confirm E2E suite runs cleanly twice in a row (verifies quota cleanup persists between runs).
*   [ ] Confirm Design Doc and QA Doc are saved to `C:/Users/pinol/Downloads/`.

**Post-Implementation:**
*   Notify Diego that the dev environment is unblocked.
*   Remind that this logic is dev-only and guarded by environment checks.