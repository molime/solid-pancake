# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# ATRIA-X Session 1 E2E harness workaround — implementation plan

> **Scope:** additive harness changes only. No edits to `.env.local`, no edits to `convex/*` schema or functions, no edits to Session 1 feature tests, no hand-edits of `convex/_generated`.

---

## 1. Restated goal & acceptance criteria

**Goal:** make Session 1 green and testable today while the live Clerk + Convex preview path is blocked, and keep a split live-E2E command ready for when the preview `CLERK_JWT_ISSUER_DOMAIN` issue is resolved.

**Acceptance criteria**
- `.env.e2e.example` is committed; real `.env.e2e` is git-ignored.
- `npm run e2e` (no usable `.env.e2e`) exits `0`, runs the non-auth Playwright specs plus the new `local-harness` spec, logs why live Clerk specs are skipped, and runs `test:phase2` backend coverage.
- `npm run e2e:local` runs only the `local-harness` Playwright project.
- `npm run e2e:full` fails fast if `.env.e2e` is missing/incomplete/local; with a valid `.env.e2e` it runs the full Playwright suite including live Clerk lifecycle/geofence specs.
- `npm run test:phase2` deterministically exercises the new `candidates` and `platformTraining` endpoints with mock identities and verifies role + org isolation.
- `.env.local` still points at the local anonymous Convex dev backend.
- All gates green: `lint`, `typecheck`, `unit`, `build`, `e2e`.

---

## 2. Discovery notes

**Repo inspection is unavailable in this chat interface.** The plan below is built from the supplied context and standard Convex/Playwright/Vitest conventions. The implementer must verify these seams before applying changes:

| Seam | What to verify |
|---|---|
| `package.json` scripts | current `e2e`, `test`, `build`, `lint`, `typecheck` command names |
| `playwright.config.ts` | existing `projects`, `testDir`, `webServer`, `use.baseURL` |
| `.env.local` | exact `VITE_CONVEX_URL` for local dev (localhost / 127.0.0.1) |
| `convex/authHelpers.ts` | exact `UserIdentity` / JWT claim shape expected (e.g. `profile.org_id`, `profile.role`, `org_id`, `org_role`) |
| `convex/candidates.ts` | exact query/mutation names and arg shapes |
| `convex/platformTraining.ts` | exact query/mutation/action names and arg shapes |
| Existing live Clerk specs | file paths/names for lifecycle/geofence specs (needed for `LIVE_E2E_PATTERNS`) |
| Vitest config | file location (`vitest.config.ts` vs `vite.config.ts`) and existing `test.include/exclude` |
| Installed packages | whether `dotenv` / `convex-test` are already present |

---

## 3. Alternatives considered

| Option | Verdict |
|---|---|
| **A. Patch `authHelpers` to accept a deterministic mock JWT in local dev** | Rejected. Touches the tenant guard, risks leaking to production, and would require env-gating that is easy to get wrong. |
| **B. Stand up a local mock Clerk JWKS server** | Rejected. Too much infrastructure, not deterministic, and would require changing Convex auth provider config. |
| **C. `convex-test` backend integration for real endpoint coverage + Playwright local-harness as a best-effort probe** | **Chosen.** Keeps production auth untouched, gives deterministic local coverage, and lets `npm run e2e` exit `0` while live Clerk E2E is blocked. |
| **D. Skip all auth-required Playwright specs and do nothing else** | Rejected. The task requires exercising the new endpoints; `test:phase2` provides that coverage. |

---

## 4. Exact files to create/edit

### New files

#### `.env.e2e.example`
Copy-to-fill template. Committed.

```bash
# Copy to .env.e2e and fill with real preview values. Never commit .env.e2e.
VITE_CONVEX_URL=https://<preview-slug>.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://<issuer>.clerk.accounts.dev
E2E_CLERK_USERNAME=e2e-user@example.com
E2E_CLERK_PASSWORD=...
E2E_CLERK_ORG_ID=org_...
```

#### `scripts/env-helpers.js`
Shared env-selection logic used by the other scripts and by `playwright.config.ts`.

- Exports `REQUIRED_E2E_VARS`, `parseEnvE2e()`, `isLocalUrl()`, `isLiveE2eEnv()`.
- `isLiveE2eEnv` returns true only when all required vars are present **and** `VITE_CONVEX_URL` is not localhost/127.0.0.1.

#### `scripts/with-env.js`
Cross-platform env selector.

- Mode `e2e`: if `.env.e2e` exists **and** its parsed values represent a usable live env, load `.env.e2e` with `override: true`; otherwise load `.env.local` with `override: true`.
- Mode `local`: always load `.env.local` with `override: true`.
- Then spawn the rest of the command line (`playwright test`, etc.) with `stdio: 'inherit'`.

#### `scripts/require-env-e2e.js`
Fail-fast guard for `e2e:full`.

- Parses `.env.e2e` directly (does not mutate `process.env`).
- Errors and exits `1` if the file is missing or any `REQUIRED_E2E_VARS` are empty, or if `VITE_CONVEX_URL` is local.

#### `tests/e2e/session1-phase2-schema.spec.ts`
Playwright local-harness spec.

- Tagged `@local-harness`.
- Smoke test: when `VITE_CONVEX_URL` is local, assert the local Convex dev server is reachable.
- Endpoint probe: attempt a direct Convex HTTP API call to `candidates:create` and `candidates:list` using a fixed local token (`E2E_LOCAL_TOKEN`, default `local-e2e-token`).
- If the call fails with an auth error (because `authHelpers` still enforce Clerk), call `test.skip(true, 'authHelpers enforce Clerk auth in local dev; endpoint coverage is in test:phase2')` and exit cleanly.
- Use raw `request.post(...)` to `/api/mutation` and `/api/query` (verify exact path/shape against the installed `convex` version).

#### `tests/phase2/phase2.integration.test.ts`
Deterministic backend integration test using `convex-test`.

- Imports `schema` from `../../convex/schema` and `api` from `../../convex/_generated/api`.
- Creates a fresh `convexTest(schema, api)` context per test.
- Constructs mock identities that match the shape expected by `authHelpers` (inspect `authHelpers.ts` for the exact claim keys).
- Covers:
  - admin can create/list candidates,
  - caregiver cannot create candidates,
  - platform training create/list is isolated by org,
  - coordinator/admin role differences if applicable.
- Uses synthetic data only.

### Edited files

#### `.gitignore`
Add:

```gitignore
# E2E secrets
.env.e2e
```

#### `package.json`
Add dev dependencies (pin to versions compatible with the installed `convex` package):

```json
"devDependencies": {
  "dotenv": "^16.4.5",
  "convex-test": "<compatible-version>"
}
```

Update/add scripts:

```json
"scripts": {
  "e2e": "node scripts/with-env.js e2e playwright test && npm run test:phase2",
  "e2e:full": "node scripts/require-env-e2e.js && npm run e2e",
  "e2e:local": "node scripts/with-env.js local playwright test --project=local-harness",
  "test:phase2": "node scripts/with-env.js local vitest run tests/phase2/phase2.integration.test.ts"
}
```

#### `playwright.config.ts`
- Import `isLiveE2eEnv` from `./scripts/env-helpers` (use `require` if TS import of JS is problematic).
- Define `LIVE_E2E_PATTERNS` — update this list to match the actual Clerk-auth spec files (e.g. `['**/live/**', '**/*.live.spec.ts']`). If existing live specs do not follow a convention, the only allowed touch to them is a move/rename or an `@live-clerk` tag — no logic changes.
- Log a clear message when live credentials are missing/local.
- Configure two projects:

```ts
const isLiveE2E = isLiveE2eEnv(process.env)

if (!isLiveE2E) {
  console.log('[e2e] Live Clerk credentials missing or local Convex backend; excluding live/auth-required specs. Use e2e:full with .env.e2e to run them.')
}

const LIVE_E2E_PATTERNS = ['**/live/**', '**/*.live.spec.ts']

export default defineConfig({
  // preserve all existing top-level settings
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: isLiveE2E ? undefined : LIVE_E2E_PATTERNS,
      grepInvert: [
        /@local-harness/,
        ...(isLiveE2E ? [] : [/@live-clerk/, /@auth-required/])
      ]
    },
    {
      name: 'local-harness',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /session1-phase2-schema\.spec\.ts$/
    }
  ]
})
```

If the existing config already has `firefox`/`webkit` projects, keep them and apply the same live-exclusion logic to each, or temporarily disable them for this harness — the task only requires `chromium` + `local-harness`.

#### Vitest config (`vitest.config.ts` or `vite.config.ts`)
Exclude `tests/phase2/**` from the default unit run so it only executes via `test:phase2`.

```ts
import { defineConfig, defaultExclude } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'tests/phase2/**']
    // preserve existing settings
  }
})
```

---

## 5. Data / auth / security / multi-tenant / PHI / idempotency edge cases

- **No production auth bypass.** The only auth-related code is in test files and env scripts. `convex/authHelpers.ts` is read, never weakened.
- **Local token is not a real secret.** `E2E_LOCAL_TOKEN` defaults to a placeholder and is only used against `localhost/127.0.0.1`. The Playwright spec skips endpoint probes against non-local backends.
- **`.env.e2e` is git-ignored.** The example file contains no secrets.
- **Auth-required specs are skipped deterministically** when live credentials are missing or the backend is local, with a logged reason in `playwright.config.ts`.
- **Multi-tenant coverage is preserved** in `test:phase2` by testing with `org:admin`, `org:coordinator`, and `org:caregiver` mock identities and verifying org isolation.
- **No PHI in tests.** All candidate/training data is synthetic (`'Local Candidate'`, `'org-phase2-1'`, etc.).
- **No schema or generated-file edits.** If `convex/_generated/api` is stale from Session 1, run `npx convex codegen` once before typecheck/e2e, but do not hand-edit generated files.
- **Idempotency:** `convex-test` uses a fresh in-memory DB per test context, so no cross-test leakage. Each test uses unique org IDs.

---

## 6. Test strategy

### Focused new tests
- `tests/e2e/session1-phase2-schema.spec.ts` — local-harness smoke + best-effort Convex HTTP probe.
- `tests/phase2/phase2.integration.test.ts` — deterministic backend coverage of `candidates` and `platformTraining` endpoints with role/org assertions.

### Broad gates to run (in order)
1. `npm install` after adding deps.
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test` (unit tests; integration test is excluded)
5. `npm run build`
6. `npm run e2e` — must exit `0` with no `.env.e2e`; verify it runs non-auth specs + `local-harness` smoke and skips the auth probe with a logged reason.
7. `npm run e2e:local` — runs only the `local-harness` project.
8. `npm run test:phase2` — runs the backend integration test green.
9. `npm run e2e:full` — verify it fails fast with a clear message when `.env.e2e` is missing.

### Expected behavior matrix
| Command | `.env.e2e` absent | `.env.e2e` incomplete | `.env.e2e` valid preview |
|---|---|---|---|
| `npm run e2e` | green, local mode | green, falls back to local | attempts live full suite |
| `npm run e2e:full` | fails fast | fails fast | runs full suite |
| `npm run e2e:local` | green local-harness | green local-harness | green local-harness (forced local) |
| `npm run test:phase2` | green | green | green |

---

## 7. Rollback / verification notes

**Rollback**
1. Revert `package.json` scripts and devDependencies.
2. Revert `playwright.config.ts`.
3. Revert the Vitest config exclude change.
4. Remove `.gitignore` `.env.e2e` line.
5. Delete `.env.e2e.example`, `scripts/env-helpers.js`, `scripts/with-env.js`, `scripts/require-env-e2e.js`, `tests/e2e/session1-phase2-schema.spec.ts`, and `tests/phase2/phase2.integration.test.ts`.

**Verification after rollback**
- `npm run e2e` returns to its pre-change behavior.
- `npm run test` no longer references `tests/phase2/`.
- `.env.local` is unchanged.

**Post-implementation sanity checks**
- Confirm `.env.local` still points at the local anonymous Convex dev backend.
- Confirm `convex/_generated` has not been hand-edited.
- Confirm no Session 1 schema or test files were modified.
- Confirm `npm run e2e` exits `0` in a clean checkout with no `.env.e2e`.