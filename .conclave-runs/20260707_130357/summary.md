# Conclave run summary
- project: atriax
- result: **UNKNOWN** _(in progress)_
- run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_130357
- task: ATRIA-X fix: candidates:inviteCandidate fails with misleading 'missing CLERK_SECRET_KEY' error when env vars are missing or stale backend loaded corrupted .env.local. Implement: (1) create convex/_utils/env.ts with requireEnv(name) that throws ConvexError naming the exact missing variable; (2) update convex/candidates.ts inviteCandidate to use requireEnv('CLERK_SECRET_KEY') and requireEnv('APP_URL'); (3) add regression tests in convex/candidates.test.ts for missing CLERK_SECRET_KEY and missing APP_URL; (4) create scripts/start-dev.js that validates CLERK_SECRET_KEY, APP_URL, VITE_CLERK_PUBLISHABLE_KEY, VITE_CONVEX_URL in .env.local.devonly, kills stale processes on ports 3210/5173, then starts npx convex dev --typecheck disable --env-file .env.local.devonly and npx vite --configLoader native; (5) update package.json dev script to node scripts/start-dev.js. Style: single quotes, no semicolons, 2-space indent. Run npm run lint, typecheck, test, E2E_FULL=1 npm run e2e, npm run build. Report every gate.

## Stages
- {'stage': 'plan', 'how': 'synthesized by c_plan_agentic', 'chars': 14296, 'elapsed_s': 196.8}

## Stage timing
| Stage | Elapsed (s) |
|---|---|
| plan | 196.8 |
| **TOTAL** | **196.8** |