# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Review Summary

### Task Compliance Assessment

The diff shows substantial progress toward the E2E harness workaround task, but **critical files are missing from the diff** that are required for the implementation to work:

| Required File | Status in Diff | Referenced By |
|--------------|----------------|---------------|
| `.env.e2e.example` | ❌ Missing | `.gitignore` exception added |
| `scripts/run-playwright-with-env.js` | ❌ Missing | `package.json` → `e2e` script |
| `scripts/run-playwright-full.js` | ❌ Missing | `package.json` → `e2e:full` script |
| `tests/e2e/helpers/env.ts` | ❌ Missing | `auth.ts`, `global-setup.ts` imports |
| `tests/e2e/session1-phase2-schema.spec.ts` | ❌ Missing | `playwright.config.ts` → `local-harness` project |
| `convex/session1Phase2Integration.test.ts` | ⚠️ Not in diff (but unit gate shows 2 tests passing) | `package.json` → `test:phase2` script |

### What IS Correct in the Diff

1. **`.gitignore`** — Properly adds `!.env.e2e.example` exception ✓
2. **`package.json`** — Scripts updated correctly with proper syntax ✓
3. **`playwright.config.ts`** — Two projects defined, `grepInvert: /@auth/` logic correct, `testIgnore` for local-harness spec ✓
4. **`tests/e2e/helpers/auth.ts`** — Imports `e2eCredentialsAvailable` from `./env` (but `env.ts` missing) ✓
5. **`tests/e2e/global-setup.ts`** — Imports `isLocalConvexUrl` from `./helpers/env` and skips seed when local ✓
6. **`tests/e2e/phase1-lifecycle.spec.ts`** — Wrapped in `test.describe('phase1 lifecycle', { tag: '@auth' })` ✓
7. **`tests/e2e/geofence.spec.ts`** — Wrapped in `test.describe('geofence scenarios', { tag: '@auth' })` ✓
8. **`convex/schema.ts`** — New tables added (`candidates`, `platformTrainingCompletions`, etc.) ✓
9. **`convex/authHelpers.ts`** — New roles (`org:hr`, `org:candidate`) added to `TenantRole` type ✓
10. **Gate results** — lint, typecheck, unit all PASS ✓

### Security & Multi-tenant Concerns

| Concern | Status |
|---------|--------|
| Auth weakening via mock JWT | ✅ Not present — `auth.config.ts` untouched |
| Debug backdoor mutations | ✅ Not present |
| PHI in tests | ✅ `convex-test` uses synthetic data only |
| Tenant isolation | ✅ `assertTenantDoc` tests added for candidate docs |
| Secrets handling | ✅ `.env.e2e` would be gitignored (if created) |
| Cross-tenant leakage | ✅ New roles guarded by `requireTenantRole` |

### Critical Blockers

1. **Missing runner scripts** — `npm run e2e` and `npm run e2e:full` will fail with "Cannot find module" errors because `scripts/run-playwright-with-env.js` and `scripts/run-playwright-full.js` are not in the diff.

2. **Missing env helper** — `tests/e2e/helpers/auth.ts` imports from `./env` which doesn't exist in the diff. This will cause a runtime import error.

3. **Missing `.env.e2e.example`** — Task explicitly requires this file to be tracked. The `.gitignore` exception is useless without the file.

4. **Missing local-harness spec** — `playwright.config.ts` references `session1-phase2-schema.spec.ts` but the file is not in the diff. The `local-harness` project will have zero tests.

5. **E2E gate not shown** — The gate results only show lint/typecheck/unit. The `npm run e2e` gate status is missing, which is the primary acceptance criterion.

### Requested Changes

1. **Add `scripts/run-playwright-with-env.js`** — Must exist for `npm run e2e` to work.
2. **Add `scripts/run-playwright-full.js`** — Must exist for `npm run e2e:full` to work.
3. **Add `tests/e2e/helpers/env.ts`** — Must export `e2eCredentialsAvailable()` and `isLocalConvexUrl()` for auth.ts and global-setup.ts imports.
4. **Add `tests/e2e/session1-phase2-schema.spec.ts`** — Must exist for `local-harness` project to have tests.
5. **Add `.env.e2e.example`** — Must be tracked per task requirements.
6. **Run and show `npm run e2e` gate** — Must exit 0 with at least non-auth specs + local-harness passing.

---

VERDICT: CHANGES_REQUESTED