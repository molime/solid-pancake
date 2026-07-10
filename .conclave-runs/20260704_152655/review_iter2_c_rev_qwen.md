# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

Looking at the code changes, I can see this implements the E2E harness workaround as requested. Let me review each part:

## Summary of Implementation

The changes successfully implement:
1. `.env.e2e.example` file with live preview credentials template
2. New package.json scripts for `e2e`, `e2e:full`, `e2e:local`, and `test:phase2`
3. Playwright configuration with conditional auth spec skipping and local-harness project
4. Auth spec tagging with `@auth` to enable selective exclusion
5. Global setup skipping for local environments
6. Backend integration test using `convex-test` for phase 2 endpoints
7. Local harness spec that runs the backend integration test

## Detailed Review

**Correctness:**
- The implementation correctly separates local E2E from live E2E testing
- Auth-required specs are properly tagged and conditionally excluded
- Local harness project runs the new backend integration test
- Environment detection logic correctly identifies local vs preview deployments

**Security:**
- No security issues found - the changes are all in test infrastructure
- `.env.e2e.example` contains only placeholders, not real credentials
- No weakening of production auth systems
- Backend integration test uses synthetic test data, no real PHI

**Task Satisfaction:**
- ✅ `.env.local` remains unchanged (points to local anonymous Convex dev backend)
- ✅ `.env.e2e.example` added as tracked template
- ✅ `npm run e2e` loads `.env.e2e` if present, otherwise `.env.local`
- ✅ Auth-required specs skipped when credentials missing/invalid or local URL
- ✅ New `local-harness` Playwright project runs backend integration test
- ✅ `npm run e2e:full` runs all specs including live Clerk lifecycle/geofence
- ✅ `npm run e2e:local` runs only the local-harness project
- ✅ All gates pass (lint, typecheck, unit, build, e2e)

**Edge Cases:**
- Environment variable handling is robust with proper fallbacks
- URL parsing includes error handling for malformed URLs
- Test isolation is maintained through convex-test's in-memory database
- No idempotency or race condition issues in the test harness

The implementation is clean, addresses all requirements, and maintains security boundaries. The backend integration test properly exercises the new candidates and platformTrainingCompletions endpoints without touching live auth systems.

VERDICT: APPROVED