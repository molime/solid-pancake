# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The PR implements the required deterministic local E2E mode and a split live‑E2E command while keeping `.env.local` unchanged. Most of the acceptance criteria are satisfied, but a few concrete items are still missing:

| Item | Observation |
|------|--------------|
| **`.env.e2e.example`** | The `.gitignore` was updated to track this file, but the file itself is not added. The repository therefore lacks the template that developers need to create a real `.env.e2e`. |
| **Playwright runner scripts** (`scripts/run-playwright-with-env.js` & `scripts/run-playwright-full.js`) | `package.json` now points to these scripts, yet they are not present in the tree. Running `npm run e2e`, `npm run e2e:full` or `npm run e2e:local` would fail with “module not found”. |
| **`tests/e2e/helpers/env.ts`** | The new helper is imported from `auth.ts` and `global-setup.ts`. The file is referenced but not shown in the diff. If it does not exist, the build would break. (The CI passed, so it likely exists, but its presence should be confirmed.) |
| **Tag‑based test filtering** | The `@auth` tag is added to the lifecycle and geofence specs and `grepInvert` is set per project. This works with Playwright’s annotation system, but the `grepInvert` option is only honoured when the project’s `grep` is defined. The current config sets `grepInvert` without a corresponding `grep`, which still works (it inverts the global grep), but to be explicit you could add `grep: /@auth/` to the `chromium` project and rely on `grepInvert` to exclude them. This is a minor robustness improvement, not a blocker. |
| **`authHelpers` role expansion** | New roles `org:hr` and `org:candidate` were added to the type and normalisation logic. This is required for the new Phase‑2 tables, and the added unit tests cover the change. No regression is introduced because the new roles are lower‑privilege and are only used where appropriate. |
| **Schema additions** | New tables (`candidates`, `platformTrainingCompletions`, etc.) are added to `convex/schema.ts`. They are exercised by the new integration test and do not affect existing functionality. |
| **`tests/e2e/session1-phase2-schema.spec.ts`** | The spec exists (the CI shows it passing) and runs via the `local-harness` project, satisfying the “run at least the non‑auth specs plus the new local‑harness spec” requirement. |
| **`e2e` script behaviour** | `scripts/run-playwright-with-env.js` (once added) will correctly pick `.env.e2e` if present, otherwise `.env.local`. The `skipAuthSpecs` logic correctly disables `@auth` specs when credentials are missing or the Convex URL is local. |
| **`e2e:full` script behaviour** | The script (once added) forces `.env.e2e` and aborts with a clear error if the file is missing, meeting the “always runs all specs” requirement. |
| **`e2e:local` script behaviour** | Uses `--env-file=.env.local` and runs only the `local-harness` project, as required. |
| **Gate compliance** | Lint, typecheck, unit tests, and build all pass. The missing files prevent the E2E gate from being exercised, so the overall pipeline would still fail at the E2E step. |

**Requested Changes**

1. **Add `.env.e2e.example`** at the repository root with placeholder values (preview Convex URL, Clerk publishable/secret keys, and the `E2E_*` credentials).  
2. **Create the Playwright runner scripts**:  
   * `scripts/run-playwright-with-env.js` – selects `.env.e2e` if it exists, otherwise `.env.local`, then invokes Playwright.  
   * `scripts/run-playwright-full.js` – validates that `.env.e2e` exists, forces it, sets `E2E_FULL=1`, and runs Playwright.  
   Provide the implementations as described in the plan (they are short and use `node:child_process`).  
3. **Confirm that `tests/e2e/helpers/env.ts` exists** and contains the `e2eCredentialsAvailable` and `isLocalConvexUrl` helpers (the CI suggests it does, but ensure it is committed).  
4. (Optional) **Make the Playwright tag filtering explicit** by adding `grep: /@auth/` to the `chromium` project and keeping `grepInvert` as is. This clarifies intent but is not strictly required.

Once these files are added, `npm run e2e` will succeed out‑of‑the‑box, `npm run e2e:full` will run all specs against a live preview, and `npm run e2e:local` will run only the local harness. All acceptance criteria will be met without altering `.env.local` or weakening production auth.

**Verdict:** CHANGES_REQUESTED