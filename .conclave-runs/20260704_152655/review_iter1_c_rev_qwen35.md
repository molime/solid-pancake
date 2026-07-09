# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review

### Summary
This change implements Session 1 Phase 2 schema additions (candidates, platformTrainingCompletions, and related tables) with corresponding auth role expansions. It also attempts to implement the E2E harness workaround for local testing. However, **critical files required by the task are missing from the diff**, which will cause the `npm run e2e` command to fail.

### What's Correct ✓

1. **Schema additions** (`convex/schema.ts`): New tables for `candidates`, `platformTrainingCompletions`, `applications`, `candidateTasks`, `hrCases`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, and `documentArchiveItems` are properly defined with tenant isolation (`tenantId` field) and appropriate indexes.

2. **Auth role expansion** (`convex/authHelpers.ts`, `convex/invitations.ts`, `convex/members.ts`, `src/app/shell/RouteGuard.tsx`): Added `'org:hr'` and `'org:candidate'` roles consistently across backend and frontend.

3. **Playwright config updates** (`playwright.config.ts`): 
   - Added `isLocalConvexUrl()` and `e2eCredentialsAvailable()` helpers
   - Added `skipAuthSpecs` logic with `grepInvert: /@auth/`
   - Added `local-harness` project with `testMatch: /session1-phase2-schema\.spec\.ts$/`
   - Added `testIgnore` for chromium project to exclude the harness spec

4. **Test tagging** (`tests/e2e/phase1-lifecycle.spec.ts`, `tests/e2e/geofence.spec.ts`): Wrapped with `{ tag: '@auth' }` for conditional exclusion.

5. **Global setup skip logic** (`tests/e2e/global-setup.ts`): Added `isLocalConvexUrl()` check to skip seeding against local backend.

6. **Unit tests pass**: `convex/session1Phase2Integration.test.ts` shows 2 tests passing in the gate results.

### Critical Missing Files ✗

The following files are **referenced but not present in the diff**:

| File | Referenced In | Impact |
|------|---------------|--------|
| `.env.e2e.example` | `.gitignore` exception | Task requirement #1 not met |
| `tests/e2e/helpers/env.ts` | `tests/e2e/helpers/auth.ts` imports from `./env` | **Runtime error**: Module not found |
| `tests/e2e/session1-phase2-schema.spec.ts` | `playwright.config.ts` testMatch, task requirement #4 | **E2E failure**: local-harness project has no matching tests |
| `scripts/run-playwright-with-env.js` | `package.json` `"e2e"` script | **E2E failure**: Command not found |
| `scripts/run-playwright-full.js` | `package.json` `"e2e:full"` script | **E2E failure**: Command not found |

### Specific Issues

1. **`tests/e2e/helpers/auth.ts` line 2**: 
   ```ts
   import { e2eCredentialsAvailable } from './env'
   ```
   This import will fail at runtime because `tests/e2e/helpers/env.ts` is not in the diff. The original `e2eCredentialsAvailable()` function was removed but the replacement file wasn't added.

2. **`package.json` e2e script**:
   ```json
   "e2e": "node scripts/run-playwright-with-env.js"
   ```
   This script file doesn't exist in the diff. Running `npm run e2e` will fail with `Error: Cannot find module`.

3. **Task acceptance criteria not met**:
   - ".env.e2e.example is added as a tracked template" — File missing
   - "Add tests/e2e/session1-phase2-schema.spec.ts" — File missing
   - "npm run e2e exits 0" — Will fail due to missing scripts

### Security/PHI Review

- **No auth weakening**: Production auth config untouched ✓
- **Tenant isolation**: All new tables include `tenantId` with indexes ✓
- **No PHI in tests**: Integration test uses synthetic data ✓
- **Secrets handling**: `.env.e2e` would be gitignored (pattern exists), but `.env.e2e.example` template missing

### Recommendation

The schema and auth changes are solid and pass gates. However, the E2E harness implementation is incomplete. The missing files will cause immediate runtime failures when running `npm run e2e`.

VERDICT: CHANGES_REQUESTED