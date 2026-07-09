# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The change implements the requested deterministic local E2E mode and split live‑E2E command, while keeping `.env.local` untouched and adding the necessary scripts, Playwright configuration, and test scaffolding. Most of the required pieces are present, but a few critical files required by the new code are missing, which prevents the solution from being complete and functional.

---

### 1. Acceptance‑Criteria Gaps

| Requirement | Current State | Issue |
|-------------|----------------|-------|
| **Add `.env.e2e.example`** | `.gitignore` now tracks the file, but the file itself is not added. | The template for live‑preview credentials is missing. |
| **Add `tests/e2e/helpers/env.ts`** | `auth.ts` and `global-setup.ts` import `e2eCredentialsAvailable` / `isLocalConvexUrl` from `./env`, but no such file exists in the diff. | Import errors will break the test suite. |
| **Add `tests/e2e/session1-phase2-schema.spec.ts`** | The Playwright config expects a spec named `session1-phase2-schema.spec.ts` (included in `testMatch` for the `local‑harness` project), but the file is not present. | The default `npm run e2e` will not execute the required local‑harness test, violating the “run at least the non‑auth specs plus the new local‑harness spec” rule. |
| **Run `npm run e2e` without failures** | With the missing files, the script will crash on import or fail to find the harness spec. | Default E2E run will not exit 0. |

All other parts (scripts, Playwright config, tagging of auth‑required specs, `.gitignore` exception, updated `authHelpers` types, schema additions, and the backend integration test `convex/session1Phase2Integration.test.ts`) are correctly implemented and pass the existing unit/validation gates.

---

### 2. Security & Multi‑Tenant Considerations

* **Auth logic unchanged** – No weakening of `auth.config.ts` or production guards.
* **New roles (`org:hr`, `org:candidate`)** are added to `TenantRole` and normalization; existing code that checks for specific roles continues to work because the new roles are simply ignored where not relevant.
* **Local‑harness test** runs against the in‑memory `convex-test` backend, never touching real PHI or production data.
* **Skipping auth‑required specs** when credentials are missing or the Convex URL is local is safe; it only reduces test coverage in those environments.

---

### 3. Required Additions

1. **`.env.e2e.example`** (tracked, placeholder values) – see the plan below for exact contents.
2. **`tests/e2e/helpers/env.ts`** – exports `e2eCredentialsAvailable()` and `isLocalConvexUrl()`.
3. **`tests/e2e/session1-phase2-schema.spec.ts`** – a Playwright wrapper that runs `npm run test:phase2` and asserts a successful pass.

These files must be added to the repository for the imports and Playwright project to resolve correctly.

---

### 4. Suggested Minimal Implementations

#### `.env.e2e.example`
```bash
# Live preview E2E environment.
# Copy to .env.e2e and fill with real values before running npm run e2e:full.
# CLERK_JWT_ISSUER_DOMAIN must be set in the Convex dashboard for the preview deployment.

VITE_CONVEX_URL=https://your-preview-deployment.convex.cloud

VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_preview_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_preview_clerk_secret_key

E2E_CLERK_ORG_ID=org_your_preview_org
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=replace_me
E2E_COORDINATOR_EMAIL=coordinator@example.com
E2E_COORDINATOR_PASSWORD=replace_me
E2E_CAREGIVER_EMAIL=caregiver@example.com
E2E_CAREGIVER_PASSWORD=replace_me
```

#### `tests/e2e/helpers/env.ts`
```ts
export function e2eCredentialsAvailable(): boolean {
  return Boolean(
    process.env.E2E_CLERK_ORG_ID &&
      process.env.E2E_ADMIN_EMAIL &&
      process.env.E2E_ADMIN_PASSWORD &&
      process.env.E2E_COORDINATOR_EMAIL &&
      process.env.E2E_COORDINATOR_PASSWORD &&
      process.env.E2E_CAREGIVER_EMAIL &&
      process.env.E2E_CAREGIVER_PASSWORD,
  )
}

export function isLocalConvexUrl(): boolean {
  const url = process.env.VITE_CONVEX_URL
  if (!url) return true
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return true
  }
}
```

#### `tests/e2e/session1-phase2-schema.spec.ts`
```ts
import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

test.describe('session1 phase2 schema local harness', () => {
  test('candidates and platformTraining endpoints are reachable', async () => {
    const output = execSync('npm run test:phase2', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    })
    expect(output).toMatch(/passed/i)
  })
})
```

These files are additive, do not modify production code, and satisfy the “deterministic local E2E mode” requirement.

---

### 5. Verification Steps (post‑fix)

1. `git status` → confirm the three new files are tracked.
2. `npm run e2e` → should print “using env file: .env.local”, skip `@auth` specs, run the non‑auth specs **and** the `session1-phase2-schema` harness, then exit 0.
3. `npm run e2e:local` → runs only the harness spec.
4. Populate `.env.e2e` with real preview credentials and run `npm run e2e:full` → all specs (including auth‑required) execute against the preview Convex backend.
5. All existing gates (`lint`, `typecheck`, `test`, `build`, `e2e`) remain green.

---

**Conclusion:** The implementation is largely correct but incomplete due to missing required files. Adding the three files above will make the solution fully meet the task specifications.

**Verdict:** CHANGES_REQUESTED