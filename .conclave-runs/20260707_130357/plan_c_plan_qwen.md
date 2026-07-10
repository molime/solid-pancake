# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

1. **Restated goal** and **numbered acceptance criteria**
- Goal: eliminate misleading 'missing CLERK_SECRET_KEY' errors in `candidates:inviteCandidate` by enforcing strict env validation at runtime and startup, ensuring developers catch configuration issues immediately
- AC-1: `convex/_utils/env.ts` exists with `requireEnv(name)` throwing `ConvexError` with exact variable name
- AC-2: `convex/candidates.ts` `inviteCandidate` calls `requireEnv('CLERK_SECRET_KEY')` and `requireEnv('APP_URL')` before logic
- AC-3: `convex/candidates.test.ts` includes tests simulating missing `CLERK_SECRET_KEY` and missing `APP_URL`
- AC-4: `scripts/start-dev.js` validates 4 specific env vars, kills ports 3210/5173, starts convex and vite with correct flags
- AC-5: `package.json` `dev` script points to `node scripts/start-dev.js`
- AC-6: all gates pass: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e`, `npm run build`

2. **Discovery notes**
- Limitation: chat-only backend; cannot inspect actual filesystem or run `cat`/`ls` on repo
- Inferred structure based on task description and Atria-X context:
  - Convex functions live in `convex/` directory
  - Tests likely co-located or in `convex/*.test.ts`
  - Env vars accessed via `process.env` inside Convex functions
  - Multi-tenancy guards (`authHelpers`) expected in `inviteCandidate` alongside env checks
  - Start script needs to handle concurrent processes (convex + vite)
- Assumption: `ConvexError` is imported from `convex/server` or similar standard package
- Assumption: `scripts/` directory exists or should be created at root

3. **Alternatives considered**
- Option A: validate env vars in `convex/http.js` middleware
  - Rejected: `inviteCandidate` is a mutation, middleware might not catch internal calls or specific function failures clearly
- Option B: fail silently with default values
  - Rejected: security risk; must fail loud for missing secrets
- Option C: use `dotenv-cli` in package.json
  - Rejected: does not solve stale process issue or provide custom validation error messages
- Chosen approach: dedicated `requireEnv` utility + custom start script ensures clear errors and clean state before dev server starts

4. **Files to create/modify**
| File | Change type | What changes |
| :--- | :--- | :--- |
| `convex/_utils/env.ts` | Create | export `requireEnv(name)` throwing `ConvexError` |
| `convex/candidates.ts` | Modify | import `requireEnv`, call at top of `inviteCandidate` |
| `convex/candidates.test.ts` | Modify | add 2 tests for missing env vars mocking `process.env` |
| `scripts/start-dev.js` | Create | validate env, kill ports 3210/5173, spawn convex + vite |
| `package.json` | Modify | update `dev` script to `node scripts/start-dev.js` |

5. **Data/auth/security/multi-tenant/PHI/idempotency edge cases**
- Multi-tenancy: `inviteCandidate` must still run `authHelpers` guards after env check; env check does not replace auth
- Security: `CLERK_SECRET_KEY` must never leak to client; `requireEnv` ensures server-side failure before exposure
- PHI: home-care data sensitivity requires strict env validation to prevent accidental writes to wrong tenant due to config drift
- Idempotency: env validation is read-only; safe to run multiple times during startup
- Stale processes: start script must force-kill ports 3210 (convex) and 5173 (vite) to prevent port conflict errors masking env issues

6. **Test strategy**
- Unit: test `requireEnv` throws correct error message when var missing
- Integration: test `inviteCandidate` fails fast with specific error when env missing
- Startup: manually run `npm run dev` with missing var to verify script blocks start
- Gates (must all pass):
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `E2E_FULL=1 npm run e2e`
  - `npm run build`
- Reporting: log pass/fail status for each gate in terminal output

7. **Rollback / verification notes**
- Rollback: `git revert` the commit containing these 5 file changes
- Verification: confirm `inviteCandidate` throws `ConvexError: Missing env var CLERK_SECRET_KEY` instead of generic error when var unset
- Verification: confirm `npm run dev` exits immediately with error list if any of 4 required vars missing in `.env.local.devonly`
- Verification: confirm no semicolons or double quotes introduced in modified files