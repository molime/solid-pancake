# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# ATRIA-X Phase 2 — Tests & Seed Fixtures Implementation Plan

> **Scope control:** This plan touches only the test layer, `convex/seed.ts`, and the minimal E2E auth/test helpers required to run the pipeline. No hand-edits to `convex/_generated`. All backend changes run through `npx convex codegen`.

---

## 1. Restated Goal & Acceptance Criteria

**Goal:** Add comprehensive Phase 2 test coverage and deterministic seed fixtures to ATRIA-X so that the candidate-to-caregiver, scheduling, and document-archive flows are exercised end-to-end in Playwright and at the Convex integration layer, while keeping the repo style-compliant and the full CI pipeline green.

| ID | Acceptance Criteria |
|---|---|
| **AC-1** | `tests/e2e/onboarding.spec.ts` exists and exercises the full candidate-to-caregiver flow: invite → submitted → review → offer → accept → hire → training gate → complete training → `/caregiver/today`, using env-based Clerk credentials when available or the mock Clerk harness with role injection otherwise. |
| **AC-2** | `tests/e2e/scheduling.spec.ts` exists and covers: admin creates a shift, conflict detection fires/quiets correctly, caregiver availability is honored, and a coverage request is created and resolved. |
| **AC-3** | `tests/e2e/documents.spec.ts` exists and covers: verify document, reject document, and toggle “expiring soon”. |
| **AC-4** | `convex/onboarding.test.ts` exists and covers: `candidateTasks` order, `submitApplication`, `reviewApplication`, `sendOffer`, `acceptOffer`, `hireCandidate` (asserts `employeeProfile` creation + ADP sync `pending_credentials`), `completePlatformTraining` idempotency, `hasPlatformTrainingCompleted`, `resetPlatformTraining`, and `org:candidate` cannot `listShifts`. |
| **AC-5** | `convex/scheduling.test.ts` exists and covers: `checkShiftConflict` for adjacent / overlap / excluded / completed cases, `createShift` audit fields, cross-caregiver conflict, caregiver role requirement, and update/delete coverage guards. |
| **AC-6** | `convex/forms.test.ts` exists and covers: `submitForm` rejects missing required / inactive fields, `updateDocumentArchiveItem` sets `verifyBy`/`verifiedAt`, and `org:caregiver` cannot call the mutation. |
| **AC-7** | `convex/seed.ts` is updated idempotently with Phase 2 fixtures: one candidate in `submitted` with a seeded application, one availability window, one `open` coverage request, one `formDefinition` with 3 fields (`name` required, `experience` required, `notes` optional), and one `documentArchiveItem` in `pending_review`. |
| **AC-8** | All new/modified code follows repo style: 2-space indent, single quotes, no semicolons. |
| **AC-9** | Pipeline is run and reported: `npm run lint`, `npm run typecheck`, `npm run test`, `E2E_FULL=1 npm run e2e`, `npm run build` — with actual pass/fail and counts. |

---

## 2. Discovery Notes

> **Repo inspection was unavailable in this chat environment.** I cannot cite actual function/type names discovered on disk. The plan below uses the names and seams supplied in the task description; the implementer must verify them against the real repo before coding.

**Files/seams to verify first:**

- `convex/schema.ts` — confirm tables/columns for `candidates`, `employeeProfiles`, `adpSync`, `shifts`, `availability`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`, `trainingProgress`, and any `orgId`/`userId` indexes.
- `convex/authHelpers.ts` (or equivalent) — confirm the guard helpers used in every tenant-scoped function (e.g., `requireOrgMember`, `requireOrgRole`, `getAuthContext`).
- `convex/onboarding.ts`, `convex/scheduling.ts`, `convex/forms.ts` — confirm exported mutation/query names and argument shapes.
- `convex/seed.ts` — confirm existing seed structure, idempotency pattern, and how `orgId`/`userId` are generated.
- `playwright.config.ts` — confirm base URL, auth storage state path, and global setup hook.
- `tests/e2e/global-setup.ts` or existing E2E helpers — confirm how Clerk sign-in is currently mocked or performed.
- `package.json` scripts — confirm exact names for `lint`, `typecheck`, `test`, `e2e`, `build`.
- `convex.json` / `tsconfig.json` — confirm whether `.test.ts` files inside `convex/` are ignored by the Convex compiler/deploy step.

---

## 3. Alternatives Considered

| Alternative | Why Not Chosen |
|---|---|
| **A. Real Clerk E2E accounts only** | Flaky, slow, and requires live email/password management. Chosen approach prefers `E2E_HR_EMAIL` / `E2E_CANDIDATE_EMAIL` env vars when present, but falls back to a mock Clerk harness with role injection so tests stay deterministic and cheap. |
| **B. Per-test tenant seeding** | Creates too much DB churn for E2E. Chosen approach seeds one deterministic Phase 2 tenant in global setup and reuses role-specific accounts across specs. |
| **C. Wipe-and-reseed seed strategy** | Destructive in shared dev backends. Chosen approach uses deterministic stable IDs and upserts so `npx convex dev` can be rerun safely without duplicates. |
| **D. E2E directly calls Convex mutations for setup** | Bypasses the UI and weakens the “end-to-end” value. Chosen approach drives setup through the UI where possible, using helpers only for auth and global fixture seeding. |
| **E. Integration tests outside `convex/` folder** | Task explicitly requests `convex/*.test.ts`. Chosen approach follows the requested layout and verifies the Convex build step ignores `.test.ts` files. |

---

## 4. Files to Create / Modify

| File | Change Type | What Changes |
|---|---|---|
| `tests/e2e/onboarding.spec.ts` | **Create** | Full candidate-to-caregiver Playwright flow. |
| `tests/e2e/scheduling.spec.ts` | **Create** | Admin shift creation, conflict detection, availability, coverage request resolution. |
| `tests/e2e/documents.spec.ts` | **Create** | Document verify / reject / “expiring soon” toggle. |
| `tests/e2e/helpers/auth.ts` | **Create or modify** | Clerk sign-in helper + mock Clerk fallback with role injection. |
| `tests/e2e/helpers/seed.ts` (or `tests/e2e/global-setup.ts`) | **Create or modify** | Idempotent Phase 2 tenant + role users (`org:hr`, `org:admin`, `org:caregiver`, candidate). |
| `convex/onboarding.test.ts` | **Create** | Integration tests for onboarding state machine and guards. |
| `convex/scheduling.test.ts` | **Create** | Integration tests for shift conflicts, audit, and coverage guards. |
| `convex/forms.test.ts` | **Create** | Integration tests for form submission validation and document archive verification. |
| `convex/seed.ts` | **Modify** | Add idempotent Phase 2 fixtures (candidate, availability, coverage request, form definition, document archive item). |
| `playwright.config.ts` | **Modify if needed** | Wire global setup, base URL, and `E2E_FULL` gating. |
| `package.json` | **Read-only / report only** | Confirm scripts; no code edits unless a script is genuinely missing. |
| `convex/_generated/*` | **No manual edits** | Regenerate via `npx convex codegen` after any `convex/` source change. |

---

## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

- **Multi-tenancy:** Every Convex integration test must set an `orgId` and pass through `authHelpers` guards. Include negative tests that swap `orgId` and assert the function returns no data / throws.
- **Role injection safety:** The mock Clerk harness must only be reachable under `NODE_ENV=test` or an explicit `E2E_MOCK_CLERK` flag; it must never be importable in production code paths.
- **Idempotent seeding:** All seeded fixtures use deterministic stable IDs (e.g., `seed_phase2_candidate`, `seed_phase2_form_def`). Use upsert/merge logic so rerunning `npx convex dev` does not create duplicates.
- **Training gate:** `org:candidate` must be rejected from `listShifts` until `completePlatformTraining` has run; test both before and after states.
- **Shift conflict logic:** Adjacent shifts (end == start) should **not** conflict; overlapping shifts **must** conflict; `excluded` / `completed` statuses should be excluded from conflict checks.
- **Coverage request guards:** Only `org:admin` / `org:coordinator` may update/delete coverage requests; `org:caregiver` attempts must fail.
- **Form validation:** `submitForm` must reject missing required fields and ignore inactive fields even if supplied.
- **Document archive audit:** `updateDocumentArchiveItem` must set `verifyBy` and `verifiedAt` on approval; rejection must update status without setting verified fields (verify exact contract from the real function).
- **PHI / PII:** Use synthetic names, emails, and SSN-like identifiers in seeds and E2E tests. No real patient data.
- **ADP sync:** After `hireCandidate`, assert an `adpSync` row exists with status `pending_credentials` and the correct `orgId`.

---

## 6. Test Strategy

### Integration tests (Vitest / `convex-test`)

Run with: `npm run test`

- **`convex/onboarding.test.ts`**
  - Seed org + users with roles.
  - Assert `candidateTasks` returns tasks in expected order.
  - `submitApplication`: valid payload succeeds; missing field fails.
  - `reviewApplication`: transitions candidate status.
  - `sendOffer` / `acceptOffer`: state transitions.
  - `hireCandidate`: creates `employeeProfile` and `adpSync` `pending_credentials`.
  - `completePlatformTraining`: call twice, assert idempotent (one record, no error).
  - `hasPlatformTrainingCompleted`: false → true → false after `resetPlatformTraining`.
  - `listShifts` as `org:candidate`: throws / returns unauthorized.

- **`convex/scheduling.test.ts`**
  - `checkShiftConflict`:
    - adjacent shifts → no conflict
    - overlapping shifts → conflict
    - excluded status shift → no conflict
    - completed status shift → no conflict
  - `createShift`: assert audit fields (`createdBy`, `createdAt`, `orgId`).
  - Cross-caregiver conflict: assign shift to caregiver A, check conflict for caregiver B on overlapping time if the function is caregiver-agnostic; otherwise assert per-caregiver isolation.
  - Caregiver role required: `org:caregiver` calling `createShift` fails.
  - Coverage guards: `org:caregiver` cannot update/delete coverage request.

- **`convex/forms.test.ts`**
  - `submitForm`: missing required field fails; inactive field is ignored.
  - `updateDocumentArchiveItem`: approval sets `verifyBy` / `verifiedAt`.
  - `org:caregiver` calling `updateDocumentArchiveItem` fails.

### E2E tests (Playwright)

Run with: `E2E_FULL=1 npm run e2e`

- **Global setup / auth helper**
  - If env credentials exist, sign in via Clerk UI.
  - Else use mock Clerk harness to inject `org:hr`, `org:admin`, `org:caregiver`, and candidate identities.
  - Seed one agency tenant and persist storage states for each role.

- **`tests/e2e/onboarding.spec.ts`**
  - HR invites candidate.
  - Candidate submits application.
  - Admin/HR reviews and moves to review → offer.
  - Candidate accepts offer.
  - Admin hires candidate; verify backend state (employee profile + ADP pending).
  - Candidate hits training gate; complete platform training.
  - Navigate to `/caregiver/today`; assert page loads.

- **`tests/e2e/scheduling.spec.ts`**
  - Admin creates a shift.
  - Attempt to create an overlapping shift; assert conflict warning.
  - Create an adjacent shift; assert no conflict.
  - Caregiver submits availability.
  - Create/open a coverage request; coordinator/admin resolves it; assert status change.

- **`tests/e2e/documents.spec.ts`**
  - Admin/coordinator opens document archive.
  - Verify a pending document; assert status and verifier metadata.
  - Reject a document; assert status.
  - Toggle “expiring soon” flag; assert UI reflects change.

### Pipeline gates

Run in order and capture output:

1. `npm run lint`
2. `npm run typecheck`
3. `npx convex codegen` (after any `convex/` change)
4. `npm run test`
5. `E2E_FULL=1 npm run e2e`
6. `npm run build`

Report: pass/fail for each gate plus test counts (e.g., `X passed, Y failed, Z skipped`).

---

## 7. Rollback / Verification Notes

- **Before any code change:** create a feature branch and confirm the current pipeline baseline (at least `npm run lint`, `npm run typecheck`, `npm run build`) passes.
- **After editing `convex/`:** run `npx convex codegen` and verify `git diff convex/_generated` only contains regenerated artifacts, not hand edits.
- **Seed idempotency check:** run `npx convex dev` twice; query the seeded tables and confirm no duplicate Phase 2 fixtures.
- **If a gate fails:** fix only the failing test or the function it exercises. Do not expand scope into unrelated UI/backend refactors.
- **Rollback:** revert the branch to `main` or delete the created test files and restore `convex/seed.ts` from git. Because changes are scoped to tests + seed, rollback is low-risk.
- **Final verification:** ensure no edits outside the listed files (except generated `_generated` files from codegen) and that `git status` matches the Files table.