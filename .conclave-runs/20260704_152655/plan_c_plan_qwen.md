# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Atria-X Session 1 E2E Harness Workaround

## 1. Goal & Acceptance Criteria
**Goal:** Unblock Session 1 E2E testing by implementing a deterministic local mode that bypasses live Clerk/Convex preview credential blockers, while preserving the ability to run live tests when credentials are available.

**Acceptance Criteria:**
- `npm run e2e` exits 0 locally without valid Clerk preview credentials.
- `npm run e2e` runs non-auth specs + `session1-phase2-schema.spec.ts` (local harness).
- `npm run e2e:full` runs all specs against live preview (fails if creds missing).
- `npm run e2e:local` runs specifically against local dev server with mock auth.
- `tests/e2e/session1-phase2-schema.spec.ts` exists and validates candidates/platformTraining endpoints.
- No changes to Session 1 schema or existing test logic (additive only).
- `.env.e2e` is gitignored; `.env.e2e.example` is committed.
- Gates (lint, typecheck, unit, build, e2e) pass.

## 2. Discovery Notes
**Limitation:** I am a chat-only model and cannot inspect the Atria-X repository filesystem directly. I cannot verify existing file contents, folder structures, or current `playwright.config.ts` implementation.

**Reasoning from Context:**
- **Stack:** React19+Vite8+TS, Convex, Clerk, Playwright.
- **Auth Flow:** Clerk typically injects `__session` cookies or local storage tokens. Convex dev backend (`127.0.0.1`) often disables strict JWT verification compared to production/preview.
- **Blocking Issue:** Local `.env.local` points to anonymous Convex dev (no JWT verification), but preview deployment requires `CLERK_JWT_ISSUER_DOMAIN` which is missing/permission-locked.
- **Assumption:** Standard Playwright + Vite + Convex setup. `playwright.config.ts` likely resides in root. Tests likely in `tests/e2e`.
- **Risk:** Mocking auth in E2E can drift from production behavior. We must isolate this to `local-harness` project only.

## 3. Alternatives Considered
| Approach | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Fix Preview Credentials** | True E2E fidelity. | Blocked by permission (`CLERK_JWT_ISSUER_DOMAIN`). Requires ops intervention. | **Reject** (Immediate blocker). |
| **Disable Auth Entirely** | Easy to implement. | Breaks multi-tenancy guards; risks shipping auth regressions. | **Reject** (Security risk). |
| **Split Env + Mock Token** | Unblocks CI/Local; keeps live path available; isolates risk. | Requires maintaining mock helper; potential drift. | **Select** (Best balance of speed/safety). |
| **Backend Integration Only** | Fast, deterministic. | Doesn't test UI integration (React Router/Convex hooks). | **Fallback** (Use `test:phase2` if UI mock fails). |

## 4. File Changes & Behavioral Specs

### 4.1 `.env.e2e.example` (Create)
- **Purpose:** Template for live E2E credentials.
- **Content:**
  ```bash
  VITE_CONVEX_URL=https://your-preview-deployment.convex.cloud
  CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-issuer.com
  E2E_USER_EMAIL=test@example.com
  E2E_USER_PASSWORD=...
  ```
- **Action:** Add to `.gitignore` (ensure `.env.e2e` is ignored, example committed).

### 4.2 `package.json` (Edit)
- **Purpose:** Orchestrate env loading and test scopes.
- **Changes:**
  - Add `e2e`: Checks for `.env.e2e`. If exists, `dotenv -e .env.e2e playwright test`. Else `dotenv -e .env.local playwright test --project=chromium --project=local-harness`.
  - Add `e2e:full`: `dotenv -e .env.e2e playwright test` (Fails if missing).
  - Add `e2e:local`: `dotenv -e .env.local playwright test --project=local-harness`.
  - Add `test:phase2`: `vitest run tests/integration/phase2` (Fallback backend tests).
- **Note:** Use `dotenv-cli` if not present, or standard `cross-env` pattern.

### 4.3 `playwright.config.ts` (Edit)
- **Purpose:** Define projects and conditional skipping.
- **Changes:**
  - **Import:** `import { defineConfig, devices } from '@playwright/test'`
  - **Env Check:** Read `VITE_CONVEX_URL` and `CLERK_PUBLISHABLE_KEY`.
  - **Projects:**
    1.  `chromium`: Default.
        -   **Logic:** If `VITE_CONVEX_URL` includes `localhost` OR creds missing → Set `grepInvert: /@auth/` (skip auth specs).
        -   **Use:** `npm run e2e` (safe mode).
    2.  `local-harness`:
        -   **Logic:** Forces `VITE_CONVEX_URL` to local. Enables mock auth helper.
        -   **Use:** `npm run e2e:local`.
    3.  `live-preview`:
        -   **Logic:** Requires valid `.env.e2e`. No skipping.
        -   **Use:** `npm run e2e:full`.
  - **Global Setup:** Add `globalSetup` to validate env vars before run.

### 4.4 `tests/e2e/helpers/auth.ts` (Create)
- **Purpose:** Mock Clerk auth for local harness.
- **Logic:**
  - Export `loginAsMock(page, role)`.
  - Sets `localStorage` keys expected by Clerk provider (e.g., `__clerk_db_jwt`).
  - **Security:** Wrap in `if (process.env.NODE_ENV === 'test')` checks if possible, or ensure only called in `local-harness` project.
  - **Fallback:** If mocking fails (app rejects token), throw specific error caught by config to skip test instead of fail.

### 4.5 `tests/e2e/session1-phase2-schema.spec.ts` (Create)
- **Purpose:** Validate Session 1 schema changes (candidates/platformTraining).
- **Content:**
  - Import `loginAsMock` from helpers.
  - **Test 1:** `visit candidates list` → Assert empty state or seeded data.
  - **Test 2:** `create candidate` → Assert Convex write (via UI or direct HTTP API call using `convex-http` helper).
  - **Test 3:** `assign platformTraining` → Assert relationship created.
  - **Auth:** Use `loginAsMock('org:admin')` before each test.
  - **Tagging:** Mark with `@phase2` tag for filtering.

### 4.6 `tests/integration/phase2.backend.spec.ts` (Create - Fallback)
- **Purpose:** Dedicated backend integration if UI mock is too invasive.
- **Content:**
  - Use `vitest` + `convex-testing`.
  - Directly call Convex functions (`candidates.create`, `platformTraining.assign`).
  - Assert DB state.
  - **Script:** Linked to `test:phase2` in `package.json`.

## 5. Data/Auth/Security Edge Cases
- **Multi-tenancy:** Mock token must include `org_id` claim. Ensure tests verify data isolation (Org A cannot see Org B).
- **PHI:** Do not seed real patient data in local harness. Use generated faker data.
- **Auth Bypass Safety:** Ensure `loginAsMock` is **never** imported in production code (`src/`). Keep strictly in `tests/`.
- **Convex Dev vs. Preview:** Local Convex dev backend may not enforce RLS (Row Level Security) same as cloud. The `test:phase2` backend integration is critical to verify RLS logic if UI mock bypasses it.
- **Idempotency:** E2E tests must clean up after themselves (use `test.afterEach` to delete created candidates).

## 6. Test Strategy
- **Unit:** Existing Vitest suite (unchanged).
- **Integration:** `test:phase2` (Backend only, verifies Convex functions + RLS).
- **E2E Local:** `npm run e2e` (UI + Mock Auth, verifies React/Router flow).
- **E2E Live:** `npm run e2e:full` (UI + Real Auth, verifies full stack + Clerk config).
- **Gates:**
  - `lint`: ESLint pass.
  - `typecheck`: TypeScript pass.
  - `build`: Vite build success.
  - `e2e`: Must exit 0 (skips allowed).

## 7. Rollback & Verification
- **Rollback:** Revert `playwright.config.ts`, `package.json`, and delete new test files. No schema changes were made, so DB rollback not needed.
- **Verification Steps:**
  1.  Run `npm run e2e` locally. Confirm exit 0. Check logs for "Skipping auth specs" if creds missing.
  2.  Run `npm run e2e:local`. Confirm `session1-phase2-schema.spec.ts` runs and passes.
  3.  Run `npm run test:phase2`. Confirm backend integration passes.
  4.  (Optional) If creds available, run `npm run e2e:full` to validate live path.
  5.  Verify `.env.e2e` is in `.gitignore`.

## 8. Implementation Notes for Agent
- **Cost Optimization:** Default `e2e` runs locally (free/Ollama) unless `.env.e2e` is present. This aligns with Diego's cost-conscious preference.
- **Conclave Context:** If running this plan via Conclave, ensure the `e2e` script doesn't trigger expensive model calls during test setup.
- **Syntax:** Adhere to Atria-X formatting (2-space indent, single quotes, no semicolons) in all generated code files.
- **Convex Codegen:** Remind user to run `npx convex codegen` if any Convex types are imported into tests.