# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Phase 2 Candidate Onboarding Portal Hardening

## 1. Restated Goal and Acceptance Criteria

**Goal:** Resolve the candidate document upload failure in dev environment, complete the Phase 2 candidate onboarding UI flow (application, documents, offer, acceptance, profile, training), ensure multi-tenant security guards are active, and pass all quality gates without relying on magic-link mocking for core flow validation.

**Acceptance Criteria:**
- **AC-1 (Upload Fix):** Candidate document upload succeeds in local dev; `generateUploadUrl` returns a reachable URL, and PUT request completes without "Failed to fetch".
- **AC-2 (Route Hygiene):** Duplicate `/onboarding/documents` route removed from `src/app/router.tsx`; `CandidateOnboardingIndex` correctly gates access based on candidate status.
- **AC-3 (Task Alignment):** Frontend checklist explicitly maps to backend task types (`form_submission`, `photo_id`, `cpr_certificate`, `background_check`, `employment_agreement`, `platform_training`).
- **AC-4 (Offer Flow):** `ApplicationReviewPage` correctly passes offer fields (rate, start date, etc.) to `sendOffer` mutation; Offer/Acceptance pages read/write `application.fields` accurately.
- **AC-5 (Security):** All Convex functions touching tenant data utilize `authHelpers` guards; no direct table access without org ID verification.
- **AC-6 (Quality Gates):** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` pass locally; E2E suite passes using mock harness if Clerk live credentials are unavailable.

## 2. Discovery Notes

**Limitation Statement:** I am operating in a chat-only capacity and **have not inspected the actual files** in the `solid-pancake` repo (e.g., `src/app/router.tsx`, `convex/candidates.ts`, `phase-2-implementation-plan.md`). This plan is derived from the provided project context, standard Convex/React patterns, and the specific error symptoms described.

**Inferred Contracts & Seams:**
- **Storage:** Convex `storage.generateUploadUrl` is likely wrapped in a helper (e.g., `src/lib/upload.ts` or similar). The error `http://127.0.0.1:3210` indicates the Convex dev server port is being exposed directly to the client but is unreachable or blocked by CORS/network config.
- **Routing:** `src/app/router.tsx` manages protected routes. `CandidateOnboardingIndex` is likely a layout or wrapper component checking `useQuery(api.candidates.getMyApplication)`.
- **Data Model:** `convex/candidates.ts` contains the updated task types. Frontend components likely consume these via `api.candidates.getTasks` or similar.
- **Auth:** Clerk org context (`useOrganization`) must be passed to Convex via `authHelpers` to enforce multi-tenancy.

## 3. Alternatives Considered

| Approach | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Manual URL Construction** | Full control over URL format | Fragile, breaks if Convex changes internal routing, bypasses auth tokens | **Reject** |
| **Proxy via Backend** | Hides Convex URL, solves CORS | Adds latency, extra load on Convex functions, complex implementation | **Reject** |
| **Fix Env + Hook Usage** | Standard Convex pattern, minimal code change | Requires correct `.env.local` config | **Select** |
| **Mock Storage in Dev** | Removes external dependency | Doesn't test real integration, risk of prod regression | **Reject** |

**Chosen Approach:** Fix environment wiring (`.env.local` `CONVEX_URL`) and ensure the frontend upload helper uses the official `useGenerateUploadUrl` hook correctly, handling the dev URL reachability (often switching `127.0.0.1` to `localhost` or ensuring Convex binds to `0.0.0.0`).

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `.env.local` | Modify | Ensure `CONVEX_URL` is set explicitly to `http://localhost:3210` (or matching dev port) to avoid `127.0.0.1` mismatch. |
| `src/lib/upload.ts` (or equivalent) | Modify | Wrap `useGenerateUploadUrl` to handle error logging; ensure `fetch` uses `PUT` with correct headers; add retry logic for transient network failures. |
| `src/app/router.tsx` | Modify | Remove duplicate `/onboarding/documents` route; verify `CandidateOnboardingIndex` protects all `/onboarding/*` routes. |
| `src/pages/onboarding/ApplicationReviewPage.tsx` | Modify | Wire form inputs to `sendOffer` mutation; ensure `application.fields` are populated before sending. |
| `src/pages/onboarding/DocumentsPage.tsx` | Modify | Map UI checklist items to backend task types (`photo_id`, `cpr_certificate`, etc.); use fixed upload helper. |
| `src/pages/onboarding/OfferAcceptancePage.tsx` | Modify | Read `application.fields.offerDetails`; update status to `accepted` via mutation. |
| `src/pages/onboarding/ProfilePage.tsx` | Modify | Ensure profile updates write to `candidates` table with correct `orgId` guard. |
| `src/pages/onboarding/TrainingPage.tsx` | Modify | Mark `platform_training` task complete upon video completion/quiz pass. |
| `convex/candidates.ts` | Verify | Confirm `sendOffer`, `acceptOffer`, `uploadDocument` mutations use `authHelpers` for org isolation. |
| `tests/e2e/onboarding.spec.ts` | Modify | Update selectors for new frames; add mock harness for Clerk if needed (bypass login flow). |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases

- **Multi-Tenancy:** Every Convex mutation (`uploadDocument`, `acceptOffer`, `updateProfile`) must extract `orgId` from Clerk auth token and verify it matches the candidate's application org. Use `authHelpers.getOrgId(ctx)` pattern.
- **Upload Race Conditions:** If a candidate uploads the same document type twice, the backend should either overwrite or version. Plan assumes overwrite latest for simplicity unless `documents` table schema dictates otherwise.
- **Auth Expiry During Upload:** Large file uploads may exceed Clerk token lifetime. The upload URL is pre-signed, so Clerk expiry shouldn't affect the PUT request to Convex storage, but the subsequent "mark complete" mutation will require valid auth.
- **Status Integrity:** Ensure state machine (Applied -> Review -> Offer -> Accepted -> Onboarding) is enforced in Convex mutations. Do not allow accepting an offer if status is not `offer_sent`.
- **PHI/PII:** Document storage is Convex internal. Ensure no PHI is logged to console during upload debugging.

## 6. Test Strategy

**Unit Tests (Vitest):**
- `uploadHelper.test.ts`: Mock `generateUploadUrl` and verify `fetch` is called with correct method/headers.
- `statusUtils.test.ts`: Verify checklist completion logic matches backend task types.

**Integration Tests:**
- Run `npx convex test` to verify backend mutations enforce auth guards (use `ctx` mocking).

**E2E (Playwright):**
- **Harness:** Use `--dangerously-bypass-approvals-and-sandbox` logic or a test-specific Clerk provider if live credentials are missing. Do not block on live email verification.
- **Flow:**
  1.  Login as candidate.
  2.  Submit Application Form (verify `form_submission` task complete).
  3.  Upload ID (verify `photo_id` task complete, check network tab for 200 OK on PUT).
  4.  Admin sends offer (mocked or via separate admin session).
  5.  Candidate accepts offer (verify `employment_agreement` task complete).
  6.  Complete Training (verify `platform_training` task complete).
- **Commands:**
  ```bash
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run e2e -- --grep "onboarding"
  ```

## 7. Rollback / Verification Notes

- **Rollback:**
  - Revert commit on `feature/phase-2-worker-onboarding`.
  - Run `npx convex codegen` to restore `_generated` types if schema was touched (though plan aims to avoid schema changes).
  - Verify `.env.local` is restored if changed globally.
- **Verification:**
  - After merge, check Convex Dashboard for any `function_error` logs related to `authHelpers`.
  - Confirm storage bucket has new documents from test runs.
  - Verify no `127.0.0.1` references in production build output.
- **Post-Plan Action:**
  - Since I cannot inspect files, the implementer must verify `src/lib/upload.ts` (or equivalent) exists. If upload logic is inline within components, refactor to helper first for testability.
  - Confirm `convex/candidates.ts` task types match the strings used in `DocumentsPage.tsx` exactly (case-sensitive).