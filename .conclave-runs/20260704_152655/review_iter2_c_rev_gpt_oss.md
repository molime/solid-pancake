# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The change introduces a deterministic local E2E mode, a split live‑E2E command, and a “local‑harness” Playwright project. It also adds new Convex tables (`candidates`, `applications`, …) and expands tenant role handling to include `org:hr` and `org:candidate`. Most of the requested script, config, and test‑tag updates are present, and the unit test suite passes.

However, several **required elements are missing or incomplete**, preventing the task from being fully satisfied:

| Requirement | Current Status | Issue |
|-------------|----------------|-------|
| Add `.env.e2e.example` (template for live credentials) | Not present in the diff | The file is referenced in `.gitignore` but never created, so users cannot create a `.env.e2e` for live runs. |
| Add `scripts/run-playwright-with-env.js` and `scripts/run-playwright-full.js` | Not present | `package.json` scripts point to these files, but they do not exist, causing `npm run e2e` to fail. |
| Add `tests/e2e/helpers/env.ts` (exposes `e2eCredentialsAvailable` & `isLocalConvexUrl`) | Not present | `auth.ts` and `global-setup.ts` import from this module, leading to runtime import errors. |
| Add `tests/e2e/session1-phase2-schema.spec.ts` (local‑harness spec) | Not present | The Playwright `local‑harness` project has no matching test file, so the harness never runs. |
| Ensure `npm run e2e` runs the new harness spec in addition to non‑auth specs | Not possible without the harness spec | Default `e2e` will only run the existing non‑auth specs, violating the acceptance criterion that it must run at least one Phase‑2 spec. |
| Keep schema changes minimal | Added many unrelated tables (`applications`, `candidateTasks`, `hrCases`, etc.) | The task only required `candidates` and `platformTrainingCompletions`. Adding a large set of extra tables is non‑minimal and could introduce unintended side‑effects. |
| Update `convex/_generated/api.d.ts` correctly | Updated, but relies on generated file being regenerated after schema changes. Since many new tables were added, a `npx convex codegen` step is now required before a clean build. The current CI does not run this step, which could cause type‑checking failures in downstream builds. |
| Ensure `src/app/shell/RouteGuard.tsx` role list stays in sync | Updated to include new roles, but this change propagates the expanded role set throughout the UI. If the UI does not handle `org:hr`/`org:candidate`, it may display incorrect options. This is beyond the minimal scope of the task. |

**Security / PHI Considerations**

* Expanding `TenantRole` to include `org:hr` and `org:candidate` does not, by itself, grant additional privileges. No new mutations or guards were added that treat these roles differently, so there is no immediate security regression.
* No PHI is introduced or exposed by the new tables; all new data is synthetic in tests.

**Idempotency / Multi‑tenant Concerns**

* The added `convex/session1Phase2Integration.test.ts` (present in the unit suite) uses `convex-test` with fresh data each run, so it is idempotent.
* The extra schema tables are empty by default and do not affect existing tenant data.

**Build / Type‑checking Impact**

* Adding many new tables changes the generated API types. The CI currently runs `npm run typecheck` after the changes, and it passed because the generated files were already updated in the diff. However, any future schema change will require an explicit `npx convex codegen` step, which is not documented in the plan.

**Recommendations**

1. **Add the missing files**  
   * Create `.env.e2e.example` with placeholder variables as described in the task.  
   * Implement `scripts/run-playwright-with-env.js` and `scripts/run-playwright-full.js` exactly as outlined in the plan.  
   * Add `tests/e2e/helpers/env.ts` exposing `e2eCredentialsAvailable` and `isLocalConvexUrl`.  
   * Add `tests/e2e/session1-phase2-schema.spec.ts` that runs `npm run test:phase2` (or directly invokes the Convex test) and asserts success.

2. **Adjust schema changes to be minimal**  
   * Remove the unrelated tables (`applications`, `candidateTasks`, `hrCases`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`) from `convex/schema.ts`. Keep only `candidates` and `platformTrainingCompletions` (and any supporting indexes).  
   * Regenerate the API types (`npx convex codegen`) after trimming the schema.

3. **Verify role handling**  
   * Ensure UI components that consume `TenantRole` can safely handle the newly added `org:hr` and `org:candidate`. If not needed for this task, consider keeping the original three roles to avoid UI inconsistencies.

4. **Document the required code‑gen step**  
   * Add a note in the README or in the `package.json` scripts (e.g., `"prebuild": "npx convex codegen"`) so that future developers run the code‑gen automatically before building.

5. **Run the full E2E suite locally**  
   * After adding the missing files, execute `npm run e2e` (with only `.env.local`) and confirm it exits with status 0, runs the non‑auth specs plus the new harness spec.  
   * Populate a real `.env.e2e` and run `npm run e2e:full` to verify that auth‑required specs execute correctly.

Once the above items are addressed, the repository will meet all acceptance criteria, and the gates (`lint`, `typecheck`, `unit`, `build`, `e2e`) will remain green.

---

**Verdict:** CHANGES_REQUESTED