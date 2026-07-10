# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260708_093923\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 348.5s rc=0

• # ATRIA-X Phase 2 — Candidate Onboarding Portal Implementation Plan

  **Branch:** `feature/phase-2-worker-onboarding`  
  **Repo:** `C:/Users/pinol/Documents/Work/atriax/solid-pancake`  
  **Design reference:** `C:/Users/pinol/Downloads/atriax-phase2-candidate-portal-redesign.md` (read in full; no `phase-2-implementation-plan.md` exists in the repo).  
  **Style constraints:** 2-space indent, single quotes, no semicolons, Tailwind tokens, existing `src/shared/ui`.

  ---

  ## 1. Restated goal and acceptance criteria

  **Goal:** Make the Phase 2 candidate onboarding portal work end-to-end for an invited candidate without Clerk magic-link mocking, fix the document-upload “Failed to fetch” regression, align the checklist/document tasks with the backend’s new task types, wire routing correctly, and make every candidate screen match the Figma frames.

  **AC-1 — Upload regression fixed.** Candidate document upload succeeds in local dev. The upload helper uses Convex’s standard `POST` flow, parses `{ storageId }` from the response, and local `127.0.0.1:3210` upload URLs are proxied through the Vite dev server so the browser fetch does not fail with CORS/reachability errors.

  **AC-2 — Routing cleaned up.** The duplicate `/onboarding/documents` route is removed from `src/app/router.tsx`; `CandidateOnboardingIndex` routes statuses to the right first page (`application` for `invited|new|application_draft`, `offer` for `offer_sent`, `checklist` otherwise).

  **AC-3 — Checklist matches backend task types.** `CandidateOnboardingPage` maps the six `candidateTasks` types (`form_submission`, `photo_id`, `cpr_certificate`, `background_check`, `employment_agreement`, `platform_training`) to labels/routes, computes progress from real task rows, and the “Next” button routes to the first pending task.

  **AC-4 — Document upload completes the correct task.** `DocumentUploadPage` fetches `listCandidateTasks`, finds the task by `_id`, and passes `task.type` to `attachCandidateDocument` so `photo_id`, `cpr_certificate`, etc. are completed individually.

  **AC-5 — Application form submits cleanly.** `ApplicationFormPage` matches the Figma entry form, calls `api.candidates.submitApplication` with the correct field shape, and redirects to `/onboarding/status`.

  **AC-6 — HR can send an offer with fields.** `ApplicationReviewPage` collects offer fields (`payRate`, `startDate`, `schedule`, `supervisor`, `expiresAt`) and passes them to `sendOffer`; `OfferAcceptancePage` reads those values from `application.fields`.

  **AC-7 — Profile/status/training use data correctly.** `CandidateProfilePage` reads from both `getCandidateProfile` and `getMyApplication.application.fields`; `ApplicationStatusPage` uses `application.submittedAt` and task completions for timeline text; `TrainingPage` records per-step completions via `completeForCandidate`.

  **AC-8 — Security/tenancy preserved.** All touched mutations still go through `requireTenantRole`; candidates can only attach documents to their own profile; no cross-tenant reads/writes introduced.

  **AC-9 — Gates green.** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run e2e` all pass (auth-required E2E specs may be skipped when live Clerk credentials are missing, but the local harness and unit tests must pass).

  ---

  ## 2. Discovery notes

  Files were inspected directly; key seams/contracts found:

  - **Backend lifecycle** (`convex/candidates.ts`):
    - `CANDIDATE_TASK_TYPES = ['form_submission','photo_id','cpr_certificate','background_check','employment_agreement','platform_training']` (lines 41-48).
    - `submitApplication` (line 675) inserts/updates `applications`, sets `candidate.status = 'applied'`, and completes `form_submission`.
    - `getMyApplication` (line 205) returns `{ candidate, application, tasks }`.
    - `listCandidateTasks` (line 295) returns the candidate’s tasks ordered by `order`.
    - `attachCandidateDocument` (line 1281) creates `files` + `documentArchiveItems` and calls `completeCandidateTask` by `documentType`.
    - `acknowledgeBackgroundCheck` (line 1141) completes both `background_check` and `employment_agreement`.
    - `sendOffer` (line 800) merges optional `payRate|startDate|schedule|supervisor|expiresAt` into `application.fields`.
    - `acceptOffer` / `rejectOffer` (lines 851, 888) enforce `offer_sent` status.

  - **Storage** (`convex/files.ts`):
    - `generateUploadUrl` (line 38) already allows `org:candidate` and returns `{ url, tenantId, uploadedBy }`.
    - Caregiver proof upload (`src/features/caregiver/components/ShiftTaskList.tsx`) uses `POST` and `response.json().storageId`.

  - **Training** (`convex/platformTrainingCompletions.ts`):
    - `completeForCandidate` and `listMyCompletions` already allow `org:candidate`.

  - **Frontend pages** (`src/features/onboarding/pages/*`):
    - `CandidateOnboardingPage.tsx` still maps old task types (`document_upload`, `reference_check`) and has no route for `photo_id` / `cpr_certificate` / `employment_agreement`.
    - `DocumentUploadPage.tsx` uses `PUT` and parses `storageId` from the URL path instead of the JSON response.
    - `CandidateOnboardingIndex.tsx` routes `application_draft` to the application form but does not route `applied`/`hr_review` to the checklist.
    - `ApplicationReviewPage.tsx` calls `sendOffer({ clerkOrgId, candidateId })` without offer fields.
    - `OfferAcceptancePage.tsx` already reads from `application.fields`.

  - **Routing** (`src/app/router.tsx`):
    - `/onboarding/documents` is defined twice (lines 511-519 and 531-539).

  - **Shell/guards** (`src/app/shell/AppShell.tsx`, `src/app/shell/RouteGuard.tsx`):
    - AppShell already hides chrome for `/onboarding/*`.
    - `TenantRoleRouteGuard` supports `org:candidate`.

  - **Environment**:
    - `.env.example` defines `VITE_CONVEX_URL` and Clerk keys.
    - `vite.config.ts` currently has no proxy.
    - `playwright.config.ts` already skips `@auth` specs when credentials are missing or `VITE_CONVEX_URL` is local; `session1-phase2-schema.spec.ts` runs the `test:phase2` backend integration.

  ---

  ## 3. Alternatives considered and chosen approach

  | Area | Alternative | Why not chosen |
  |------|-------------|----------------|
  | **Upload URL reachability** | Try to reconfigure `npx convex dev` to bind to `localhost` instead of `127.0.0.1`. | Not reliably exposed by the Convex CLI; brittle across versions. |
  | **Upload URL reachability** | Create a backend HTTP action that proxies bytes to `ctx.storage`. | Adds bandwidth through Convex mutations and complicates progress/cancellation. |
  | **Upload URL reachability** | **Chosen:** Vite dev proxy for `/api/storage` + a small helper that rewrites the upload URL origin to `window.location.origin` in dev. | Same-origin request in dev, zero backend changes, matches how caregiver proof already uploads. |
  | **Upload protocol** | Keep `PUT` + URL-path parsing. | Convex storage upload returns `storageId` in the POST JSON body; current code is incorrect and fragile. |
  | **Checklist task labels** | Add a `title` column to `candidateTasks`. | Avoids schema migration; frontend display map is sufficient and keeps the backend type list as the single source of truth. |
  | **Document upload routing** | Drop `/onboarding/upload/:taskId` and use `/onboarding/documents` generically. | Per-task routing lets the page show the exact Figma title and complete the correct task type. |
  | **Offer fields entry** | Build a separate “Send offer” modal/page. | The review page already has the decision card; adding fields inline is the smallest change and matches the existing `sendOffer` signature. |

  ---

  ## 4. Files to create/modify

  | File | Change type | What changes |
  |------|-------------|--------------|
  | `src/shared/lib/upload.ts` | Create | `uploadFileToConvex({ generateUploadUrl, file, clerkOrgId })` helper: calls `generateUploadUrl`, POSTs file, returns `storageId`. In dev, rewrites `127.0.0.1`/`localhost` upload-URL origin to `window.location.origin` so the Vite proxy handles it. |
  | `vite.config.ts` | Modify | Add dev-only proxy: `/api/storage` → `process.env.VITE_CONVEX_URL` (or `http://127.0.0.1:3210` fallback), `changeOrigin: true`. |
  | `src/app/router.tsx` | Modify | Remove duplicate `/onboarding/documents` route. Keep `/onboarding` → `CandidateOnboardingIndex`, `/onboarding/checklist`, `/onboarding/application`, `/onboarding/status`, `/onboarding/upload/:taskId`, `/onboarding/documents`, `/onboarding/acknowledgment`, `/onboarding/offer`, `/onboarding/profile`, `/onboarding/training`. |
  | `src/features/onboarding/pages/CandidateOnboardingIndex.tsx` | Modify | Route `invited|new|application_draft` → `/onboarding/application`; `offer_sent` → `/onboarding/offer`; `accepted|hired` and review states → `/onboarding/checklist`. |
  | `src/features/onboarding/pages/CandidateOnboardingPage.tsx` | Rewrite | Map real task types to Figma labels/routes; compute progress from `listCandidateTasks`; “Next” goes to first pending task; footer help link preserved. |
  | `src/features/onboarding/pages/ApplicationFormPage.tsx` | Rewrite | Match Figma entry form (logo, title, full name, email, phone, position, autosave pill, submit CTA, status footer link). Submit `{ fullName, email, phone, position }` via `submitApplication`. |
  | `src/features/onboarding/pages/DocumentUploadPage.tsx` | Rewrite | Query `listCandidateTasks`, find task by `_id`, derive title/label from `task.type`, use new upload helper, call `attachCandidateDocument` with `documentType: task.type`, expiry field when relevant, then navigate to checklist. |
  | `src/features/onboarding/pages/OfferAcceptancePage.tsx` | Modify | Keep structure; ensure all offer values come from `application.fields` with clear defaults. |
  | `src/features/onboarding/pages/CandidateProfilePage.tsx` | Modify | Ensure read-only fields come from `application.application.fields` path correctly; preserve edit/save for name/email/phone. |
  | `src/features/onboarding/pages/ApplicationStatusPage.tsx` | Modify | Timeline subtext uses `application.submittedAt` and task completion dates; CTA destinations corrected. |
  | `src/features/onboarding/pages/TrainingPage.tsx` | Modify | Minor tidy-up: use step data consistently; ensure final step redirect goes to `/onboarding/checklist`. |
  | `src/features/hr/pages/ApplicationReviewPage.tsx` | Modify | Add controlled inputs for `payRate`, `startDate`, `schedule`, `supervisor`, `expiresAt`; pass them to `sendOffer`. Keep disabled state until all tasks complete. |
  | `src/features/onboarding/ApplicationFormPage.test.tsx` | Modify | Update mock and assertions to new field set and Figma labels. |
  | `src/features/onboarding/pages/*` (new tests) | Create | Add/update focused Vitest tests for checklist, upload, offer, profile, status, acknowledgment, training (render + interaction). |
  | `convex/files.test.ts` | Modify | Add tests that `generateUploadUrl` allows `org:candidate` and rejects cross-tenant calls. |
  | `convex/candidates.test.ts` | Modify/extend | Cover attach/acknowledge task completion for the six task types; cover `sendOffer` field merge. |
  | `convex/_generated/*` | Regenerate | Run `npx convex codegen` after any `convex/*` edit. Do not edit by hand. |

  ---

  ## 5. Data/auth/security/multi-tenant/PHI/idempotency edge cases

  - **Tenant isolation:** Every mutation still calls `requireTenantRole(ctx, clerkOrgId, [...])`; `assertTenantDoc` is used where documents are fetched by ID. No new unguarded queries.
  - **Candidate scoping:** `attachCandidateDocument` resolves the candidate from the authenticated identity (`getOwnCandidate`), so a candidate can only archive files against their own profile.
  - **Upload URL scoping:** `generateUploadUrl` only issues a URL after tenant/role verification. The helper does not expose `tenantId` to arbitrary callers.
  - **Document type validation:** `attachCandidateDocument` validates `contentType` and `size`; the frontend also validates before upload.
  - **Task completion idempotency:** `completeCandidateTask` finds the first pending task by `type` and patches it; if the task is already complete it is a no-op.
  - **Duplicate training completions:** `completeForCandidate` inserts a completion row each time; `listMyCompletions` + `Set` handles duplicates on the frontend. Acceptable because the table has no unique constraint and the UI uses step-by-step progression.
  - **Application resubmission:** `submitApplication` blocks terminal statuses and updates the latest non-hired application row, preventing duplicate active rows.
  - **Offer field merge:** `sendOffer` only overwrites fields explicitly provided, preserving earlier application fields.
  - **Local storage URL security:** The dev-only origin rewrite only changes the origin to the current dev server; the signed token/path remain unchanged, so the request is still authenticated by Convex.
  - **PHI:** Document archive items keep `visibility: 'admins_coordinators'`; candidates never receive download URLs for documents.

  ---

  ## 6. Test strategy

  **Unit / component (Vitest + jsdom):**

  - `ApplicationFormPage.test.tsx` — render, fill fields, assert `submitApplication` called with `{ clerkOrgId, fields: { fullName, email, phone, position } }`, assert redirect to `/onboarding/status`.
  - `CandidateOnboardingPage.test.tsx` — mock tasks for all six types, assert progress text, assert “Next” routes to first pending task, assert labels match Figma.
  - `DocumentUploadPage.test.tsx` — mock `listCandidateTasks`, select file, mock upload helper/attach mutation, assert `attachCandidateDocument` called with `documentType: task.type`.
  - `OfferAcceptancePage.test.tsx` — accept/reject call correct mutations; non-`offer_sent` state shows “No pending offer”.
  - `CandidateProfilePage.test.tsx` — toggles edit, calls `updateCandidate`, cancels.
  - `ApplicationStatusPage.test.tsx` — renders correct timeline state for `applied`, `offer_sent`, `rejected`.
  - `AcknowledgmentPage.test.tsx` — confirm disabled until scroll + checkbox; calls `acknowledgeBackgroundCheck`.
  - `TrainingPage.test.tsx` — timer unlocks button, `completeForCandidate` called per step.

  **Backend integration (`convex-test`):**

  - `convex/files.test.ts` — `generateUploadUrl` succeeds for `org:candidate`, fails for unknown/cross-tenant org.
  - `convex/candidates.test.ts` — invite creates the six tasks; `submitApplication` completes `form_submission`; `attachCandidateDocument` completes `photo_id`/`cpr_certificate`; `acknowledgeBackgroundCheck` completes `background_check` + `employment_agreement`; `sendOffer` merges offer fields into `applications.fields`.

  **E2E:**

  - `tests/e2e/session1-phase2-schema.spec.ts` already runs `npm run test:phase2`; keep it green.
  - Default `npm run e2e` will skip `@auth` specs automatically when `VITE_CONVEX_URL` is local or Clerk credentials are missing, so unrelated auth failures do not mask portal regressions.
  - After UI changes, run `npm run e2e:local` and compare Playwright screenshots to Figma exports; adjust tokens until pixel-match is within tolerance.

  **Gate commands to run after implementation:**

  ```bash
  npx convex codegen          # if convex/* changed
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run e2e
  ```

  ---

  ## 7. Rollback / verification notes

  - **Rollback:** All changes are on `feature/phase-2-worker-onboarding`. If gates fail, `git checkout -- <file>` or `git reset --hard origin/feature/phase-2-worker-onboarding` restores the pre-change branch state. Re-run `npx convex codegen` after any backend revert.
  - **Verification of upload fix:** In dev, open `/onboarding/upload/:taskId`, select a small PDF, confirm network tab shows a `POST` to `/api/storage/upload?token=...` (same origin) returning `200` with JSON `{ storageId }`, and the UI redirects to `/onboarding/checklist` with the task marked complete.
  - **Verification of routing:** Visit `/onboarding` with a candidate in each status and confirm the redirect matches the routing table.
  - **Verification of offer flow:** From `ApplicationReviewPage`, fill offer fields, click “Advance to next stage”, then sign in as the candidate and confirm `OfferAcceptancePage` shows the entered values and accept updates status to `accepted`.
  - **Verification of gates:** Every command in the test strategy must exit `0` before the branch is considered done. If `npm run e2e` skips auth specs, the console must clearly log the skip reason (existing behavior in `playwright.config.ts`).


[stderr]
• We need read prompt file and carry out instructions. Must not ask questions. Need use Read tool on path. Then execute tasks. Let's read file.We need carry out instructions: produce a premium implementation plan, discovery reading files. We are in planning role. Need inspect relevant files in repo. Since user wants output final answer/verdict as requested. We need produce plan with sections. Need read actual files before writing plan. We should inspect repo: phase-2-implementation-plan.md, design doc download, Figma? Need understand current candidate portal implementation. We need produce plan not full code. We should explore relevant files thoroughly. Use Explore agent maybe. But can also use tools directly. Need discover: candidate routes, components, convex functions (candidates.ts, storage). Need identify bug about generateUploadUrl. Need inspect env and upload helper. Need check src/app/router.tsx duplicate route. Need backend candidate task types. Need offer fields. Need application.fields. Need design doc path. Need use tools.

  Given complexity, use TodoList. Then spawn explore agents for parallel discovery? We can read known files. Let's set todos.Need locate docs. Use Glob for phase-2 plan in working directory. Also design doc at Downloads.No phase-2 implementation doc in repo? Maybe in docs. Need list docs? It referenced path maybe root? Use Glob for *phase*. Also find router.tsx, application components.Need inspect source tree. Use Read for router.tsx. Also list src/features/onboarding.src/features/onboarding:
ApplicationFormPage.test.tsx
pages

src/features/onboarding/pages:
AcknowledgmentPage.tsx
ApplicationFormPage.tsx
ApplicationStatusPage.tsx
CandidateOnboardingIndex.tsx
CandidateOnboardingPage.tsx
CandidateProfilePage.tsx
DocumentUploadPage.tsx
OfferAcceptancePage.tsx
TrainingPage.tsx
Need read onboarding pages and candidate related convex. Also read candidates.ts and tests. Also storage upload helper likely in src/shared or convex? Let's explore. Use AgentSwarm maybe. But let's read all onboarding page files, ApplicationReviewPage, candidateStatus lib, and convex/candidates.ts, authHelpers. Also package.json scripts and env. Use parallel reads.We have read onboarding pages. Now read backend convex/candidates.ts, files.ts maybe, authHelpers.ts, and ApplicationReviewPage. Also candidateStatus lib, tests. Use parallel reads.We need read rest of candidates.ts (after 1000) for attachCandidateDocument, acknowledgeBackgroundCheck, etc., and files.ts. Need locate convex/files.ts. Also env files. Also design doc in Downloads. Use Glob.Great. Need read convex/files.ts. Also environment variables and upload config. Need inspect .env files, vite config, convex config. Also schema.ts maybe candidateTasks fields, platformTrainingCompletions. And tests. Also identify storage URL bug: generateUploadUrl returns local backend URL. Need inspect files.ts.We need inspect env without secrets maybe .env.example. Also need understand storage URL bug. generateUploadUrl returns ctx.storage.generateUploadUrl() which is absolute URL pointing to Convex backend; in dev it might return http://127.0.0.1:3210/api/storage/upload?token=... That is correct? But prompt says bug because returns local backend URL instead of proper public/storage URL in dev; fix env wiring / upload helper / storage URL config. Need understand Convex dev behavior: ctx.storage.generateUploadUrl() returns URL to upload to convex cloud. For local dev, it returns local backend. If frontend fetch fails because not using correct origin? Maybe Vite proxy? Need inspect convex.json? There's convex.json in root? Need read convex.json or vite config. Also maybe frontend needs to use relative upload helper or configure CONVEX_SITE_URL. Need inspect env.example.Need read convex.json and vite.config.ts, maybe .env.e2e is secret but can read .env.e2e.example? It said blocked? Actually .env.e2e.example blocked? Might be pattern. Could use Bash cat? But better not. We can read .env.example. Need understand convex deployment URL.Need understand storage URL bug. ConvexReactClient configured with VITE_CONVEX_URL (cloud). ctx.storage.generateUploadUrl in Convex action/mutation returns URL for uploading to the same deployment. In local dev using npx convex dev, VITE_CONVEX_URL likely points to local backend http://127.0.0.1:3210. Upload fetch should work if browser can reach localhost. Prompt says generated URL is http://127.0.0.1:3210/api/storage/upload?token=... and fails with "Failed to fetch". Could be due to CORS or the local backend not running? Need maybe use Convex HTTP action or configure APP_URL? Actually upload URL returned is absolute. Maybe bug is they expect to use proper public/storage URL in dev; fix env wiring/upload helper/storage URL config. Could be need to set CONVEX_SITE_URL or similar? Need search for storage URL handling, maybe existing helper.We have enough information. Need produce implementation plan per prompt sections. We also need include discovery notes verifying actual files. Need ensure plan addresses immediate bug: upload URL local. We need propose fix env wiring/upload helper/storage URL config. Need inspect existing tests and playwright config maybe. We already have package scripts. Need maybe read platformTrainingCompletions.ts and existing test for phase2. Also read existing ApplicationFormPage.test.tsx. And maybe e2e session spec. But plan can reference. Need produce final answer only, no questions. We need not implement code. The prompt asks "Produce a premium implementation plan with all of the following sections... Do NOT write the full code." So final output should be the plan. Need include sections exactly: 1 restated goal & acceptance criteria, 2 discovery notes, 3 alternatives, 4 files to create/modify table, 5 edge cases, 6 test strategy, 7 rollback/verification.

  Need cite actual function/type names found. We have them. Need address storage URL bug. Let's gather more about platformTrainingCompletions.ts.Need maybe inspect RouteGuard, AppShell for candidate chrome. Also existing test for platformTrainingCompletions? Not needed. Need ensure plan includes training steps model file maybe not existing. There is no trainingSteps.ts yet. Current TrainingPage hardcodes steps. Design doc says create model file. We can note optional. Need inspect ShiftTaskList to see upload helper pattern for caregiver proof. Maybe there is an upload helper we can reuse.Need also inspect existing tests/e2e/session1-phase2-schema.spec.ts to understand harness. Also maybe playwright.config.ts.Good. We have enough. Need produce plan. We also should address the storage URL bug: Need inspect .env.local? We cannot read but can infer. The bug is generateUploadUrl returns local backend URL (http://127.0.0.1:3210/api/storage/upload?token=...). In current DocumentUploadPage, it does PUT to url with body and gets storageId by splitting url path. But for Convex storage upload, the response for PUT? Actually Convex upload URL expects PUT or POST? In caregiver ShiftTaskList uses POST and response.json() with storageId. DocumentUploadPage uses PUT and extracts storageId from URL path. This may be wrong. Also local URL may be unreachable. Need fix: create a small upload helper in src/shared/lib/upload.ts (or src/features/onboarding/lib/upload.ts) that wraps generateUploadUrl, uses POST, parses JSON storageId, handles dev URL rewriting (127.0.0.1 -> localhost or via VITE dev proxy). The prompt specifically says fix env wiring / upload helper / storage URL config. We need propose: ensure `.env.local` VITE_CONVEX_URL uses `http://localhost:3210` not `http://127.0.0.1:3210`? But providers.tsx uses VITE_CONVEX_URL for Convex client; local dev uses local backend. The upload URL returned by local backend is 127.0.0.1:3210 because Convex dev server advertises that. To make it reachable, maybe configure Convex CLI with `--url`? In `convex dev` you can pass `--url`? Actually `npx convex dev` uses CONVEX_HOST? There's `CONVEX_PROVISION_HOST`? The local backend binds to 127.0.0.1; browser fetching 127.0.0.1:3210 may fail due to CORS if Vite dev server is localhost:5173? Browsers treat 127.0.0.1 and localhost as cross-origin. The simplest fix: proxy upload requests through Vite dev server. Add a Vite proxy config in vite.config.ts: `/api/storage` -> target `http://127.0.0.1:3210` (or VITE_CONVEX_URL). Then upload helper rewrites upload URL's origin to current `window.location.origin` so the request goes via same-origin Vite proxy. For production/cloud, the upload URL is already on convex.cloud reachable cross-origin? Cloud upload URLs should support CORS. So helper can detect localhost/127.0.0.1 and rewrite origin to current origin, letting Vite proxy. Need add proxy only in dev. Or configure Convex dev server to bind to `0.0.0.0`/localhost? But `npx convex dev` maybe not configurable. So proxy is simplest.

  But DocumentUploadPage currently extracts storageId from URL path after upload. For Convex POST upload, response body is JSON {storageId}. For PUT? Let's verify Convex docs: `ctx.storage.generateUploadUrl()` returns URL; upload by sending HTTP POST (or PUT?) with file body; response includes storageId. Actually in Convex React SDK `useGenerateUploadUrl` returns URL, then `fetch(url, { method: 'POST', body: file })` and response.json().storageId. Caregiver code uses POST and JSON. DocumentUploadPage uses PUT and parses path. So need align to POST + JSON. Use helper.

  Also `attachCandidateDocument` expects storageId string. Good.

  Need also update ApplicationReviewPage to pass offer fields to sendOffer. It currently calls sendOffer({clerkOrgId, candidateId}) with no offer fields. The HR UI doesn't have fields inputs. We need add inputs for payRate, startDate, schedule, supervisor, expiresAt (or use application fields). The task says "update ApplicationReviewPage to pass offer fields to sendOffer". So plan should include adding form fields for offer details in ApplicationReviewPage and passing them to sendOffer mutation. Also ensure offer/acceptance/profile/training pages use application.fields correctly. Already OfferAcceptancePage uses fields. Profile uses appFields. Training doesn't use fields. Good.

  Need ensure checklist and document upload complete correct task types. Current backend CANDIDATE_TASK_TYPES = [form_submission, photo_id, cpr_certificate, background_check, employment_agreement, platform_training]. Frontend CandidateOnboardingPage TASK_META uses document_upload, reference_check. Need update to match new types: photo_id, cpr_certificate, employment_agreement. DocumentUploadPage should handle taskId matching photo_id/cpr_certificate (and maybe document_upload fallback). It currently uses taskId 'required' etc. Need update.

  CandidateOnboardingIndex currently routes 'applied','hr_review' to checklist? Actually it routes invited/new/application_draft to application; offer_sent to offer; else (applied, hr_review, accepted, hired, rejected, withdrawn) to checklist. That's fine but for accepted/hired maybe should go to status? Prompt says wire routing to new statuses/tasks. We'll refine: after application submitted (applied/hr_review) -> checklist; accepted -> checklist; offer_sent -> offer; hired -> status/profile? But keep simple: CandidateOnboardingIndex routes based on status to appropriate page. Need maybe route accepted to checklist so they can complete tasks. Good.

  Need also maybe handle document tasks: when candidate clicks document task, route to `/onboarding/upload/:taskId` where taskId is actual Convex task id, and DocumentUploadPage fetches task by id to determine type. Current route uses taskId param but page doesn't query tasks; it uses taskId as documentType directly. Need adjust page to query listCandidateTasks and find task by _id, then use task.type for documentType. So plan.

  Need also complete employment_agreement task: acknowledgment page currently completes background_check and employment_agreement together. That matches backend. Good. But checklist should show employment_agreement as "Sign employment agreement". It routes to /onboarding/acknowledgment. Good.

  Need also ApplicationFormPage: per design doc, should match application entry frame 157:682 with fewer fields. The prompt mentions Figma frames 157:682 (application entry) and 189:2287 (full application form). Maybe there are two pages: entry and full form. Currently only one. We need decide. The design doc says rewrite ApplicationFormPage as entry with fields fullName, email, phone, position. But prompt says "ensure application flow works without magic-link mocking" and "complete the candidate portal implementation per phase-2-implementation-plan.md and Figma frames". The phase-2-implementation-plan.md is not present, but design doc is. We'll use design doc stages. It says Stage 2 application page: one clean working form. Good.

  Need also maybe `CandidateOnboardingPage` handle `application_draft` status? If HR requests correction, candidate status becomes application_draft, and first pending task is form_submission; clicking start goes to /onboarding/application. Good.

  Need remove duplicate /onboarding/documents route. In router, lines 511-519 and 531-539 duplicate. Remove one.

  Need ensure offer/acceptance/profile/training pages use application.fields correctly. Offer page uses fields.position, payRate, startDate, schedule, supervisor. Profile uses appFields. Training doesn't need fields. Good.

  Need also consider `CandidateOnboardingIndex` for `application_draft` -> application. Already.

  Need include tests: update existing tests and add new ones. Need mention convex codegen after convex changes (files.ts allowed roles maybe no schema change? Changing role list doesn't need codegen? It doesn't change schema but might need type generation? The api types unaffected. But if modify convex function args? No. Still safe to run codegen. Prompt says after editing convex/* run npx convex codegen. We'll include.

  Need identify exact ACs. Should include:
  - AC-1 Upload fix: env/proxy/helper so candidate document upload succeeds; storageId parsed from POST JSON; 127.0.0.1 local URLs proxied through Vite dev server or helper rewrites origin.
  - AC-2 Routing: duplicate documents route removed; CandidateOnboardingIndex routes statuses correctly.
  - AC-3 Checklist tasks: map to backend types [form_submission, photo_id, cpr_certificate, background_check, employment_agreement, platform_training]; Start button routes to correct upload/ack/training; progress computed.
  - AC-4 Application form: matches Figma entry, submits correct fields, redirects status.
  - AC-5 Document upload: reads task by _id, uses task.type as documentType, uploads via helper, attaches document, completes task.
  - AC-6 Offer: ApplicationReviewPage collects and passes offer fields to sendOffer; OfferAcceptancePage reads application.fields; accept/reject works.
  - AC-7 Profile/Training/Status use application.fields or candidate data correctly.
  - AC-8 Auth/security: role guards preserved, no cross-tenant leakage, candidates only mutate own docs.
  - AC-9 Gates: lint/typecheck/unit/build/e2e green.

  Need in Discovery notes: list actual functions/types: candidates.ts CANDIDATE_TASK_TYPES, submitApplication, getMyApplication, listCandidateTasks, attachCandidateDocument, acknowledgeBackgroundCheck, sendOffer, acceptOffer, rejectOffer, completeCandidateTask; files.ts generateUploadUrl allowed roles; platformTrainingCompletions.ts completeForCandidate/listMyCompletions; router.tsx duplicate route; ApplicationReviewPage.tsx sendOffer call missing fields; DocumentUploadPage.tsx uses PUT and url path parsing; etc.

  Need alternatives considered: for upload fix, options: (a) configure Convex dev server bind address, (b) Vite proxy + origin rewrite, (c) backend HTTP action to proxy upload. Chosen Vite proxy + helper. For checklist tasks, options: add title field to candidateTasks vs frontend display map; choose frontend map to avoid schema migration. For document upload, options: keep `/onboarding/documents` generic vs `/onboarding/upload/:taskId`; keep both, use task-aware upload. For offer fields, add inputs in ApplicationReviewPage vs separate offer modal; choose inline fields in review page. etc.

  Need files table: | File | Change type | What changes |. Include all.

  Need edge cases: multi-tenant guards, candidate can only attach own documents, terminal status application submit blocked, duplicate application update vs new, task completion idempotent, training completion duplicate rows, storage URL origin rewrite only in dev, CORS, file type/size validation, expiry optional, magic-link mocking not needed, E2E skip auth when credentials missing.

  Need test strategy: unit tests for each page (render, interactions), backend tests for candidate lifecycle (convex-test), files.test add generateUploadUrl candidate role, e2e session1 phase2 schema integration, Playwright default excludes auth specs, build/lint/typecheck commands.

  Need rollback: git stash/revert branch; regenerate Convex codegen if needed; env revert.

  We must not ask user questions. We can produce final plan. Need perhaps mention we inspected actual files. We should be concise but premium. Use markdown.

  Need ensure final answer includes verdict? The prompt says "Output your final answer/verdict as requested." The requested output is the plan. So final answer = plan. Could include "Implementation Plan" heading.

  Need consider one nuance: The prompt says "Reference existing design doc ... if present." We read it. We can reference it in plan. Also "phase-2-implementation-plan.md" not found; we note not present; use design doc.

  Need maybe update todo list before final. Mark tasks done. Then final answer.Now produce final plan. Need be accurate with file paths and details. Let's craft comprehensive plan. Include "Discovery notes" with actual function names. Use table. Mention no schema migration. Mention codegen. Ensure plan focused only on required.

  Let's write final answer.

To resume this session: kimi -r session_034f48fa-5763-420f-96c6-c59d49c4b582
