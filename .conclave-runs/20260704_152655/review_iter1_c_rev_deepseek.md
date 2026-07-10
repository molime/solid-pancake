# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review

### Task Compliance

The task explicitly states: **"Do not touch the Session 1 schema/test changes."** The diff includes extensive modifications to files that are clearly part of Session 1:

- `convex/schema.ts` – adds `candidates`, `applications`, `candidateTasks`, `hrCases`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`, `platformTrainingCompletions` tables.
- `convex/authHelpers.ts` – adds `org:hr` and `org:candidate` roles.
- `convex/authHelpers.test.ts` – adds tests for those roles.
- `convex/invitations.ts` – adds `org:hr` and `org:candidate` role literals.
- `convex/members.ts` – adds `org:hr` and `org:candidate` role literals.
- `convex/_generated/api.d.ts` – auto‑generated consequence of adding new modules.
- `src/app/shell/RouteGuard.tsx` – adds `org:hr` and `org:candidate` to the type.

These are not part of the E2E harness workaround and violate the instruction to leave Session 1 untouched. They must be reverted from this commit.

### Missing Required Files

The task mandates creation of several files that are absent from the diff:

1. **`.env.e2e.example`** – not present.
2. **`scripts/run-playwright-with-env.js`** – referenced in `package.json` but not created.
3. **`scripts/run-playwright-full.js`** – referenced in `package.json` but not created.
4. **`tests/e2e/helpers/env.ts`** – imported by `auth.ts` and `global-setup.ts` but not present.
5. **`convex/session1Phase2Integration.test.ts`** – referenced in `package.json` `test:phase2` script but not present.
6. **`tests/e2e/session1-phase2-schema.spec.ts`** – referenced in `playwright.config.ts` but not present.

Without these files, the E2E harness workaround is incomplete and `npm run e2e` will fail.

### E2E Harness Changes That Are Correct

- `.gitignore` exception for `.env.e2e.example` – correct.
- `package.json` script updates – correct structure.
- `playwright.config.ts` – correct project setup, `grepInvert`/`testIgnore` logic, `skipAuthSpecs` detection.
- `tests/e2e/geofence.spec.ts` – wrapped in `test.describe('geofence scenarios', { tag: '@auth' }, ...)` – correct.
- `tests/e2e/phase1-lifecycle.spec.ts` – wrapped in `test.describe('phase1 lifecycle', { tag: '@auth' }, ...)` – correct.
- `tests/e2e/global-setup.ts` – added `isLocalConvexUrl()` guard – correct.
- `tests/e2e/helpers/auth.ts` – moved `e2eCredentialsAvailable` to `env.ts` – correct, but `env.ts` is missing.

### Security / PHI / Idempotency

No security or PHI risks in the E2E harness changes themselves. The unauthorized Session 1 changes introduce new roles and tables, but those are outside the scope of this task and should be removed.

### Verdict

The code change does **not** satisfy the task because it includes prohibited modifications to Session 1 files and is missing multiple required files. The E2E harness logic that is present is correct, but the implementation is incomplete and over‑broad.

**Requested changes:**
- Revert all changes to `convex/schema.ts`, `convex/authHelpers.ts`, `convex/authHelpers.test.ts`, `convex/invitations.ts`, `convex/members.ts`, `convex/_generated/api.d.ts`, `src/app/shell/RouteGuard.tsx`.
- Create the six missing files listed above.
- Ensure `npm run e2e` exits 0 locally with the required specs.

VERDICT: CHANGES_REQUESTED