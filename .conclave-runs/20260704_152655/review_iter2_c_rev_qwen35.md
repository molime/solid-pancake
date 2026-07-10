# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Review: Session 1 Follow-up — E2E Harness Workaround

### Summary
The diff shows substantial progress on the E2E harness workaround, but **critical files are missing** that would cause the `e2e`, `e2e:full`, and `e2e:local` scripts to fail at runtime.

---

### ✅ What's Correct

| File | Status | Notes |
|------|--------|-------|
| `.gitignore` | ✓ | Added `!.env.e2e.example` exception correctly |
| `package.json` | ✓ | Scripts added (`test:phase2`, `e2e`, `e2e:full`, `e2e:local`) |
| `playwright.config.ts` | ✓ | Two projects defined, `skipAuthSpecs` logic, `grepInvert: /@auth/` |
| `tests/e2e/helpers/auth.ts` | ✓ | Imports `e2eCredentialsAvailable` from `./env` |
| `tests/e2e/global-setup.ts` | ✓ | Imports `isLocalConvexUrl`, skips seed on local backend |
| `tests/e2e/geofence.spec.ts` | ✓ | Wrapped in `{ tag: '@auth' }` describe block |
| `tests/e2e/phase1-lifecycle.spec.ts` | ✓ | Wrapped in `{ tag: '@auth' }` describe block |
| `convex/authHelpers.ts` | ✓ | New roles `org:hr`, `org:candidate` added |
| `convex/schema.ts` | ✓ | New tables with `tenantId` and proper indexes |
| Unit gates | ✓ | lint, typecheck, test all pass (298 tests) |

---

### ❌ Missing Files (Blockers)

The following files are **referenced but not present in the diff**:

| File | Referenced By | Impact |
|------|---------------|--------|
| `scripts/run-playwright-with-env.js` | `package.json` → `e2e` script | **`npm run e2e` will fail** (file not found) |
| `scripts/run-playwright-full.js` | `package.json` → `e2e:full` script | **`npm run e2e:full` will fail** |
| `tests/e2e/helpers/env.ts` | `auth.ts`, `global-setup.ts` imports | Typecheck passed, so file may exist—but not in diff |
| `tests/e2e/session1-phase2-schema.spec.ts` | `playwright.config.ts` → `local-harness.testMatch` | **`local-harness` project has no tests to run** |
| `.env.e2e.example` | `.gitignore` exception | Template file not committed |

**Evidence:** The `package.json` diff shows:
```json
"e2e": "node scripts/run-playwright-with-env.js",
"e2e:full": "node scripts/run-playwright-full.js",
```
These scripts do not exist in the 14-file diff. Running `npm run e2e` will error with `Error: Cannot find module 'scripts/run-playwright-with-env.js'`.

---

### ⚠️ Schema Changes — Task Alignment Question

The task states: *"Do not touch the Session 1 schema/test changes."*

The diff adds **9 new tables** to `convex/schema.ts`:
- `candidates`, `applications`, `candidateTasks`, `hrCases`
- `availabilityWindows`, `coverageRequests`
- `formDefinitions`, `formSubmissions`
- `documentArchiveItems`, `platformTrainingCompletions`

If these are **Session 2 (Phase 2)** additions, they're acceptable. If they're meant to be Session 1 work, this violates the task constraint. The unit test `convex/session1Phase2Integration.test.ts` passing (2 tests) suggests these are Phase 2 endpoints being tested, which aligns with the task's focus on proving Phase 2 endpoints are reachable.

**Clarification needed:** Confirm these schema additions are Phase 2 work outside Session 1 scope.

---

### 🔒 Security / Multi-tenant / PHI Review

| Concern | Status | Notes |
|---------|--------|-------|
| Auth weakening | ✓ | `auth.config.ts` untouched; no mock JWT backdoor |
| Tenant isolation | ✓ | All new tables have `tenantId` with indexes |
| PHI in tests | ✓ | `convex-test` uses synthetic data only |
| Secrets handling | ✓ | `.env.e2e` gitignored; only `.env.e2e.example` tracked |
| Role guards | ✓ | `authHelpers.ts` updated with `org:hr`, `org:candidate` |
| Cross-tenant guards | ✓ | `authHelpers.test.ts` includes candidate-shaped doc test |

No security regressions detected.

---

### 🧪 Test Coverage Gaps

1. **`session1-phase2-schema.spec.ts`** — Missing. This is the Playwright wrapper that runs `npm run test:phase2`. Without it, the `local-harness` project is empty.

2. **E2E gate result not shown** — The gate results include lint, typecheck, and unit, but **no `e2e` gate output**. This is the primary acceptance criterion ("npm run e2e exits 0").

3. **`env.ts` not in diff** — While typecheck passed (suggesting the file exists), it should be in the diff for review completeness.

---

### Required Changes

1. **Add `scripts/run-playwright-with-env.js`** — Picks `.env.e2e` if present, otherwise `.env.local`, spawns Playwright.

2. **Add `scripts/run-playwright-full.js`** — Forces `.env.e2e`, sets `E2E_FULL=1`, fails if file missing.

3. **Add `tests/e2e/session1-phase2-schema.spec.ts`** — Playwright spec that runs `npm run test:phase2` via `execSync`.

4. **Add `tests/e2e/helpers/env.ts`** — Export `e2eCredentialsAvailable()` and `isLocalConvexUrl()` for shared use.

5. **Add `.env.e2e.example`** — Template with placeholders for preview deployment credentials.

6. **Run and verify `npm run e2e`** — Confirm it exits 0, skips `@auth` specs on local, runs `local-harness`.

---

### Verdict

The implementation is **structurally correct** but **incomplete**. The missing runner scripts and test spec file are hard blockers—without them, the core task requirement ("npm run e2e exits 0") cannot be satisfied.

VERDICT: CHANGES_REQUESTED