# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260708_093923\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 351.1s rc=0

• I’ll inspect the repo to ground the synthesis in the actual files, then produce the final plan.I inspected the actual files in the repo, so the plan below is grounded in the current code rather than inferred from the context description.

  ---

  # Phase 2 Candidate Onboarding Portal — Synthesized Implementation Plan

  **Branch:** `feature/phase-2-worker-onboarding`  
  **Design reference:** `C:/Users/pinol/Downloads/atriax-phase2-candidate-portal-redesign.md`  
  **Style constraints:** 2-space indent, single quotes, no semicolons, Tailwind tokens, existing `src/shared/ui`.

  ## 1. Restated goal and acceptance criteria

  **Goal:** Make the Phase 2 candidate onboarding portal work end-to-end for an invited candidate without Clerk magic-link mocking, fix the dev document-upload “Failed to fetch” regression, align the checklist and document upload with the backend’s six task types, clean up routing, and ensure offer/profile/status/training pages consume `application.fields` correctly.

  - **AC-1 — Upload regression fixed.** Candidate document upload succeeds in local dev. The upload path uses Convex’s standard `POST` flow, parses `{ storageId }` from the JSON response, and `127.0.0.1:3210` upload-URL origins are proxied through the Vite dev server so the browser fetch does not fail with CORS/reachability errors.
  - **AC-2 — Routing cleaned up.** `src/app/router.tsx` has no duplicate `/onboarding/documents` route. `CandidateOnboardingIndex` routes `invited|new|application_draft` → `/onboarding/application`, `offer_sent` → `/onboarding/offer`, and every other status → `/onboarding/checklist`.
  - **AC-3 — Checklist matches backend task types.** `CandidateOnboardingPage` maps the six `CANDIDATE_TASK_TYPES` (`form_submission`, `photo_id`, `cpr_certificate`, `background_check`, `employment_agreement`, `platform_training`) to Figma labels/routes, computes progress from `listCandidateTasks`, and routes document tasks by task `_id`.
  - **AC-4 — Application form matches Figma entry frame.** `ApplicationFormPage` collects only `fullName`, `email`, `phone`, and `position`; calls `submitApplication`; and redirects to `/onboarding/status`.
  - **AC-5 — Document upload completes the correct task.** `DocumentUploadPage` queries `listCandidateTasks`, finds the task by `_id`, derives title/`documentType` from `task.type`, uploads via the shared helper, and calls `attachCandidateDocument` with `documentType: task.type` and an optional expiry date.
  - **AC-6 — HR can send an offer with all fields.** `ApplicationReviewPage` collects/defaults `payRate`, `startDate`, `schedule`, `supervisor`, and `expiresAt` from `application.fields`, and passes all of them to `sendOffer`. `OfferAcceptancePage` reads those values from `application.fields`.
  - **AC-7 — Profile/status/training use data correctly.** `CandidateProfilePage` reads from `getCandidateProfile` and `getMyApplication.application.fields`; `ApplicationStatusPage` uses `application.submittedAt` and task completions; `TrainingPage` records per-step completions via `completeForCandidate`.
  - **AC-8 — Security/tenancy preserved.** All touched mutations still go through `requireTenantRole`/`assertTenantDoc`; candidates can only attach documents to their own profile; no cross-tenant reads/writes are introduced.
  - **AC-9 — Gates green.** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and the local E2E harness all pass. Auth-required E2E specs may be skipped when live Clerk credentials are missing.

  ## 2. Discovery notes

  Files were inspected directly. Key seams and contracts found:

  - **Backend lifecycle** (`convex/candidates.ts`):
    - `CANDIDATE_TASK_TYPES = ['form_submission','photo_id','cpr_certificate','background_check','employment_agreement','platform_training']` (lines 41-48).
    - `submitApplication` (line 675) updates `applications`, sets `candidate.status = 'applied'`, and completes `form_submission`.
    - `getMyApplication` (line 205) returns `{ candidate, application, tasks }` ordered by `order`.
    - `listCandidateTasks` (line 295) returns the candidate’s tasks.
    - `attachCandidateDocument` (line 1281) inserts `files` + `documentArchiveItems` and calls `completeCandidateTask` by `documentType`.
    - `acknowledgeBackgroundCheck` (line 1141) completes both `background_check` and `employment_agreement`.
    - `sendOffer` (line 800) merges optional `payRate|startDate|schedule|supervisor|expiresAt` into `application.fields` as `offerExpiresAt`.
    - `acceptOffer` / `rejectOffer` (lines 851, 888) enforce `offer_sent` status.

  - **Storage** (`convex/files.ts`):
    - `generateUploadUrl` (line 38) already allows `org:candidate` and returns `{ url, tenantId, uploadedBy }`.
    - Caregiver proof upload (`src/features/caregiver/components/ShiftTaskList.tsx`) already uses `POST` and `response.json().storageId`.

  - **Training** (`convex/platformTrainingCompletions.ts`):
    - `completeForCandidate` and `listMyCompletions` already allow `org:candidate`; `completeForCandidate` also completes the `platform_training` task.

  - **Frontend pages** (`src/features/onboarding/pages/*`):
    - `CandidateOnboardingPage.tsx` already maps the six real task types, but routes document tasks by type string (`/onboarding/upload/photo_id`) rather than task `_id`.
    - `DocumentUploadPage.tsx` uses `PUT` and parses `storageId` from the URL path instead of the JSON response.
    - `CandidateOnboardingIndex.tsx` routes `application_draft` to the application form and `offer_sent` to the offer page; other statuses go to the checklist.
    - `ApplicationReviewPage.tsx` already has inputs for `payRate`, `startDate`, `schedule`, and `supervisor`, but is missing `expiresAt` and does not seed defaults from `application.fields`.
    - `OfferAcceptancePage.tsx` already reads `payRate`, `startDate`, `schedule`, `supervisor`, and `offerExpiresAt` from `application.fields`.
    - `CandidateProfilePage.tsx` already reads `application.application.fields`.

  - **Routing** (`src/app/router.tsx`):
    - Only one `/onboarding/documents` route was observed in the current file (line 511); no duplicate exists in this snapshot. Verify before merging.

  - **Tooling**:
    - `vite.config.ts` has no dev proxy.
    - `playwright.config.ts` skips `@auth` specs when `VITE_CONVEX_URL` is local or Clerk credentials are missing.

  ## 3. Alternatives considered and chosen approach

  | Area | Alternative | Why not chosen |
  |------|-------------|----------------|
  | **Upload URL reachability** | Reconfigure `npx convex dev` to bind to `localhost` instead of `127.0.0.1`. | Not reliably exposed by the Convex CLI; brittle across versions. |
  | **Upload URL reachability** | Create a backend HTTP action that proxies bytes to `ctx.storage`. | Adds bandwidth through Convex functions and complicates progress/cancellation. |
  | **Upload URL reachability** | **Chosen:** Vite dev proxy for `/api/storage` + a small helper that rewrites the upload-URL origin to `window.location.origin` in dev. | Same-origin request in dev, zero backend changes, matches the existing caregiver proof upload pattern. |
  | **Upload protocol** | Keep `PUT` + URL-path parsing. | Convex storage upload returns `storageId` in the `POST` JSON body; current code is incorrect and fragile. |
  | **Checklist task labels** | Add a `title` column to `candidateTasks`. | Avoids schema migration; a frontend display map is sufficient and keeps the backend type list as the single source of truth. |
  | **Document upload routing** | Drop `/onboarding/upload/:taskId` and use `/onboarding/documents` generically. | Per-task routing lets the page show the exact Figma title and complete the correct task type. |
  | **Offer fields entry** | Build a separate “Send offer” modal/page. | The review page already has the decision card; adding fields inline is the smallest change and matches the existing `sendOffer` signature. |

  ## 4. Files to create/modify

  | File | Change type | What changes |
  |------|-------------|--------------|
  | `src/shared/lib/upload.ts` | Create | `uploadFileToConvex({ generateUploadUrl, file })` helper: calls `generateUploadUrl`, `POST`s the file, returns `storageId`. In dev, rewrites `127.0.0.1`/`localhost` upload-URL origin to `window.location.origin` so the Vite proxy handles it. |
  | `vite.config.ts` | Modify | Add dev-only `server.proxy` for `/api/storage` → `process.env.VITE_CONVEX_URL` (or `http://127.0.0.1:3210` fallback), `changeOrigin: true`. |
  | `src/app/router.tsx` | Modify | Verify and remove any duplicate `/onboarding/documents` route. Keep the existing `/onboarding/*` route table. |
  | `src/features/onboarding/pages/CandidateOnboardingPage.tsx` | Modify | Map real task types to Figma labels/routes; route document tasks to `/onboarding/upload/${task._id}`; compute progress from `listCandidateTasks`; “Next” goes to the first pending task. |
  | `src/features/onboarding/pages/ApplicationFormPage.tsx` | Rewrite | Match the Figma *Application Entry* frame: logo, title, full name, email, phone, position, autosave pill, submit CTA, status footer link. Submit `{ fullName, email, phone, position }` via `submitApplication` and redirect to `/onboarding/status`. |
  | `src/features/onboarding/pages/DocumentUploadPage.tsx` | Rewrite | Query `listCandidateTasks`, find task by `_id`, derive title/label from `task.type`, use the new upload helper, call `attachCandidateDocument` with `documentType: task.type`, expiry field when relevant, then navigate to `/onboarding/checklist`. |
  | `src/features/onboarding/pages/ApplicationStatusPage.tsx` | Modify | Adjust status-card colors, timeline subtext from `application.submittedAt` and task completion dates, and CTA destinations to match Figma. |
  | `src/features/onboarding/pages/CandidateProfilePage.tsx` | Modify | Ensure read-only fields come from `application.application.fields` correctly; add Figma-matching edit/save toggle for name/email/phone if not already present. |
  | `src/features/onboarding/pages/TrainingPage.tsx` | Modify | Adjust step-wizard styling to match Figma frame `190:2504`; keep scroll/timer logic and final redirect to `/onboarding/checklist`. |
  | `src/features/onboarding/pages/AcknowledgmentPage.tsx` | Modify | Tidy copy and styling to match Figma frame `158:905`; keep scroll + checkbox unlock and `acknowledgeBackgroundCheck` call. |
  | `src/features/hr/pages/ApplicationReviewPage.tsx` | Modify | Add `expiresAt` input; seed `payRate`, `startDate`, `schedule`, `supervisor`, `expiresAt` defaults from `application.fields`; pass all offer fields to `sendOffer`. |
  | `src/features/onboarding/ApplicationFormPage.test.tsx` | Modify | Update mock and assertions to the new four-field shape and Figma labels. |
  | `src/features/onboarding/pages/*.test.tsx` | Create/update | Focused Vitest tests for checklist, upload, offer, profile, status, acknowledgment, and training (render + interaction). |
  | `convex/candidates.test.ts` | Modify/extend | Update expected task list to six types in order; add tests for `attachCandidateDocument` completing `photo_id`/`cpr_certificate`, `acknowledgeBackgroundCheck` completing `background_check` + `employment_agreement`, and `sendOffer` field merge. |
  | `convex/files.test.ts` | Modify | Add tests that `generateUploadUrl` allows `org:candidate` and rejects unknown/cross-tenant callers. |
  | `convex/_generated/*` | Regenerate | Run `npx convex codegen` after any `convex/*` source edit. Do not edit by hand. |

  ## 5. Data/auth/security/multi-tenant/PHI/idempotency edge cases

  - **Tenant isolation:** Every mutation still calls `requireTenantRole(ctx, clerkOrgId, [...])`; `assertTenantDoc` is used wherever documents are fetched by ID. No new unguarded queries.
  - **Candidate scoping:** `attachCandidateDocument` resolves the candidate from the authenticated identity via `getOwnCandidate`, so a candidate can only archive files against their own profile.
  - **Upload URL scoping:** `generateUploadUrl` only issues a URL after tenant/role verification. The helper does not expose `tenantId` to arbitrary callers.
  - **Document type validation:** `attachCandidateDocument` validates `contentType` and `size`; the frontend also validates before upload.
  - **Task completion idempotency:** `completeCandidateTask` finds the first pending task by `type` and patches it; if the task is already complete it is a no-op.
  - **Duplicate training completions:** `completeForCandidate` inserts a completion row each time; `listMyCompletions` + `Set` handles duplicates on the frontend. Acceptable because the table has no unique constraint and the UI uses step-by-step progression.
  - **Application resubmission:** `submitApplication` blocks terminal statuses and updates the latest non-hired application row, preventing duplicate active rows.
  - **Offer field merge:** `sendOffer` only overwrites fields explicitly provided, preserving earlier application fields.
  - **Local storage URL security:** The dev-only origin rewrite only changes the origin to the current dev server; the signed token/path remain unchanged, so the request is still authenticated by Convex.
  - **PHI:** Document archive items keep `visibility: 'admins_coordinators'`; candidates never receive download URLs for documents.

  ## 6. Test strategy

  **Unit / component (Vitest + jsdom):**

  - `ApplicationFormPage.test.tsx` — render, fill fields, assert `submitApplication` called with `{ clerkOrgId, fields: { fullName, email, phone, position } }`, assert redirect to `/onboarding/status`.
  - `CandidateOnboardingPage.test.tsx` — mock tasks for all six types, assert progress text, assert “Next” routes to the first pending task (using `_id` for upload tasks), assert labels match Figma.
  - `DocumentUploadPage.test.tsx` — mock `listCandidateTasks`, select file, mock upload helper/attach mutation, assert `attachCandidateDocument` called with `documentType: task.type`.
  - `OfferAcceptancePage.test.tsx` — accept/reject call correct mutations; non-`offer_sent` state shows “No pending offer”.
  - `CandidateProfilePage.test.tsx` — toggles edit, calls `updateCandidate`, cancels.
  - `ApplicationStatusPage.test.tsx` — renders correct timeline state for `applied`, `offer_sent`, `rejected`.
  - `AcknowledgmentPage.test.tsx` — confirm disabled until scroll + checkbox; calls `acknowledgeBackgroundCheck`.
  - `TrainingPage.test.tsx` — timer unlocks button, `completeForCandidate` called per step.

  **Backend integration (`convex-test`):**

  - `convex/files.test.ts` — `generateUploadUrl` succeeds for `org:candidate`, fails for unknown/cross-tenant org.
  - `convex/candidates.test.ts` — invite creates the six tasks in order; `submitApplication` completes `form_submission`; `attachCandidateDocument` completes `photo_id`/`cpr_certificate`; `acknowledgeBackgroundCheck` completes `background_check` + `employment_agreement`; `sendOffer` merges offer fields into `applications.fields`.

  **E2E:**

  - `tests/e2e/session1-phase2-schema.spec.ts` already runs `npm run test:phase2`; keep it green.
  - Default `npm run e2e` will skip `@auth` specs automatically when `VITE_CONVEX_URL` is local or Clerk credentials are missing, so unrelated auth failures do not mask portal regressions.
  - After UI changes, run `npm run e2e:local` and compare Playwright screenshots to Figma exports; adjust tokens until pixel-match is within tolerance.

  **Gate commands to run after implementation:**

  ```bash
  npx convex codegen          # only if convex/* source changed
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run e2e:local           # or npm run e2e
  ```

  ## 7. Rollback / verification notes

  - **Rollback:** All changes are on `feature/phase-2-worker-onboarding`. If gates fail, `git checkout -- <file>` or `git reset --hard origin/feature/phase-2-worker-onboarding` restores the pre-change branch state. Re-run `npx convex codegen` after any backend revert.
  - **Verification of upload fix:** In dev, open `/onboarding/upload/:taskId`, select a small PDF, confirm the network tab shows a `POST` to `/api/storage/upload?token=...` (same origin) returning `200` with JSON `{ storageId }`, and the UI redirects to `/onboarding/checklist` with the task marked complete.
  - **Verification of routing:** Visit `/onboarding` with a candidate in each status and confirm the redirect matches the routing table.
  - **Verification of offer flow:** From `ApplicationReviewPage`, fill offer fields (including expiry), click “Advance to next stage”, then sign in as the candidate and confirm `OfferAcceptancePage` shows the entered values and that accepting updates status to `accepted`.
  - **Verification of gates:** Every command in the test strategy must exit `0` before the branch is considered done. If `npm run e2e` skips auth specs, the console must clearly log the skip reason (existing behavior in `playwright.config.ts`).


[stderr]
• We need read prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260708_093923\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output final answer/verdict as requested.

  We need read file. Use Read tool. Path absolute. Then follow instructions. Likely prompt is a plan synthesis from conclave runs. Need inspect. Use Read.We have read the prompt file. It contains instructions plus candidate plans (c_plan_agentic, c_plan_qwen, c_plan_kimi27). We are likely c_plan_kimi27? Actually the prompt says "Several planners produced the candidate plans below. Synthesize them into ONE coherent, de-duplicated, best-of-all implementation plan." So we need synthesize all three into one final plan. We also have already started producing our own plan; the last candidate plan is actually our own internal monologue? It seems the prompt file includes our own candidate plan (c_plan_kimi27) as raw monologue, which is weird. But we need produce final plan synthesizing the three candidate plans (agentic, qwen, kimi27). Since this is a continuation of previous thought (we read files earlier? In our conversation there is no prior tool calls besides reading prompt; but the prompt file itself contains c_plan_kimi27 with monologue indicating we read files. But we haven't actually read files in this session? Wait we did read some files in previous turns maybe? Actually conversation starts with user request, we read prompt file. There are no other tool calls. The c_plan_kimi27 text in prompt file is a raw generated candidate plan (monologue) from a previous model run (perhaps produced by kimi-27). It didn't actually read files because it's chat-only? The prompt says "DISCOVERY REQUIREMENT: If your backend is an agentic CLI (kimi, codex, claude), you MUST open and read the actual relevant files before writing the plan — do not reason from the context description alone. If your backend is chat-only (Ollama, OpenRouter), reason from the provided context and state clearly that you have not inspected the files."

  Our backend is agentic CLI (Kimi Code CLI), so we must read files. However, the c_plan_kimi27 candidate plan in the prompt says "We need produce a premium implementation plan... We need inspect files. We need use tool to read files." It appears to be the beginning of a planning monologue, not a finished plan. It also notes we are Kimi. So our final plan must be based on actual file inspection.

  Need inspect relevant files. We should run discovery: read convex/candidates.ts, files.ts, authHelpers.ts, platformTrainingCompletions.ts, src/app/router.tsx, onboarding pages, ApplicationReviewPage, env files, vite config, design doc. Then synthesize.

  Given large codebase, maybe use explore agents or read in parallel. We need be efficient. The candidate plan c_plan_agentic already contains detailed file references and line numbers; but we must verify ourselves per discovery requirement. We can read those files to confirm.

  We have not read files yet in this session. We need do so. Let's set todo list and read files.

  We should use parallel Read tool calls. But first maybe locate design doc at Downloads. Use Read directly. It may exist. Also list src features etc. Let's start with reads:
  - C:\Users\pinol\Downloads\atriax-phase2-candidate-portal-redesign.md
  - convex/candidates.ts (large, maybe 1500 lines; need relevant parts). Read whole? 1000-line cap, then second chunk.
  - convex/files.ts
  - convex/authHelpers.ts maybe
  - convex/platformTrainingCompletions.ts
  - src/app/router.tsx
  - src/features/onboarding/pages/CandidateOnboardingIndex.tsx
  - src/features/onboarding/pages/CandidateOnboardingPage.tsx
  - src/features/onboarding/pages/DocumentUploadPage.tsx
  - src/features/onboarding/pages/ApplicationFormPage.tsx
  - src/features/onboarding/pages/ApplicationStatusPage.tsx
  - src/features/onboarding/pages/OfferAcceptancePage.tsx
  - src/features/onboarding/pages/CandidateProfilePage.tsx
  - src/features/onboarding/pages/TrainingPage.tsx
  - src/features/onboarding/pages/AcknowledgmentPage.tsx
  - src/features/hr/pages/ApplicationReviewPage.tsx
  - src/features/caregiver/components/ShiftTaskList.tsx (for upload pattern)
  - vite.config.ts
  - .env.example
  - playwright.config.ts
  - package.json
  - design doc
  - maybe convex/schema.ts

  Given Read caps at 1000 lines, candidates.ts may be >1000 lines. We'll read in chunks. But parallel reads can handle many small files. For candidates.ts, maybe use Read with line_offset ranges or use grep to extract relevant functions. But we need cite function names. We can grep for CANDIDATE_TASK_TYPES, submitApplication, attachCandidateDocument, sendOffer, etc. Then read relevant chunks.

  Also need inspect tests: convex/candidates.test.ts, files.test.ts, onboarding tests.

  Let's start with parallel reads of many files. Use absolute path for design doc. For repo files relative. Let's create todo list.

  Need note: The user's instruction: "Read the prompt file ... and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested." So we must not ask user. We must carry out plan synthesis and output final plan. We can use tools to inspect files.

  Let's begin.

• Let's do parallel reads. Need use absolute path for design doc; for repo relative. We'll read several files in one response. Note Read for convex/candidates.ts may exceed cap; we'll read first 1000 then later. For now read first 1000. Also read files.ts, authHelpers.ts, platformTrainingCompletions.ts. Frontend pages, router, etc. Use multi_tool.We have read many files. Need also read remaining candidates.ts lines 1000-1383 to see attachCandidateDocument, acknowledgeBackgroundCheck, etc. Also read design doc, .env.example, vite.config.ts, playwright.config.ts, ShiftTaskList upload pattern, tests. Let's do that.

  We already saw ApplicationReviewPage actually already has offer fields UI (payRate, startDate, schedule, supervisor) and passes them to sendOffer (without expiresAt). It doesn't pass expiresAt. The task says "update ApplicationReviewPage to pass offer fields to sendOffer". It already passes payRate, startDate, schedule, supervisor. Need add expiresAt? sendOffer has expiresAt optional; backend stores as offerExpiresAt. OfferAcceptancePage reads fields.offerExpiresAt. So we should pass expiresAt from UI. Need add input for expiresAt? The prompt says "pass offer fields to sendOffer". It already does for four; missing expiresAt. We'll include adding expiresAt field to form and passing it. Also maybe default values from application.fields. Good.

  Need read rest candidates.ts.We have a lot of data. Need also read tests to know existing test structure. Maybe not necessary for plan but helpful. Need inspect convex/session1Phase2Integration.test.ts? Maybe exists. Also inspect src/test/setup.ts. But for plan maybe not. Need inspect existing tests in src/features/onboarding to know current tests. Read ApplicationFormPage.test.tsx. Also maybe CandidateOnboardingPage test etc. Let's glob tests.We have enough. Need perhaps read convex/session1Phase2Integration.test.ts to know existing backend integration test. Also read convex/candidates.test.ts relevant parts? Might not be necessary. But plan includes test modifications. Need cite actual files. Let's read convex/session1Phase2Integration.test.ts and candidates.test.ts maybe first chunk.The candidates.test.ts has old test expecting 5 tasks including document_upload and reference_check. This test will need updating to 6 tasks with new types. Also need note that backend now seeds 6 tasks (CANDIDATE_TASK_TYPES). The test currently expects 5; will fail. We'll need to update it. Good.

  Need inspect more of candidates.test.ts around submitApplication, sendOffer etc. But not necessary maybe. We can cite.

  Need also inspect convex/schema.ts for candidateTasks table fields. Also platformTrainingCompletions indexes.We have actual file contents. Need synthesize final plan. Key observations:

  - CandidateOnboardingPage already updated TASK_META to the six new types (photo_id, cpr_certificate) and routes to /onboarding/upload/photo_id etc. It seems partially fixed already. But it uses type string as route param, not task _id. The prompt says ensure frontend checklist and document upload complete correct task types. Currently CandidateOnboardingPage routes /onboarding/upload/photo_id (type), not /onboarding/upload/:taskId (task id). DocumentUploadPage expects taskId param as type string. It doesn't query tasks. So it uses type directly as documentType. That works for photo_id and cpr_certificate but only if route param equals type. It doesn't handle task _id. The prompt says "DocumentUploadPage fetches listCandidateTasks, finds task by _id, and passes task.type to attachCandidateDocument". Current page uses param as type. Need decide if we should change to use task _id. The candidate plan agentic suggests that. The design doc says route /onboarding/upload/:taskId and page reads task from listCandidateTasks. So we should align.

  - CandidateOnboardingPage currently maps route for document tasks as /onboarding/upload/photo_id etc. To switch to task _id, we need update TASK_META route to /onboarding/upload/${task._id}? But TASK_META is static per type. Better in render, use route based on task._id. So plan: CandidateOnboardingPage uses task._id for routing.

  - CandidateOnboardingIndex routes correctly. Maybe no change except accepted/hired to checklist; okay.

  - ApplicationFormPage currently has many fields (dob, address, etc.) and doesn't match Figma entry. Design doc says reduce to fullName, email, phone, position. Prompt says update ApplicationFormPage to pass correct fields. Candidate plan agentic says rewrite to entry form. We'll include.

  - DocumentUploadPage uses PUT and extracts storageId from URL path. Caregiver uses POST and JSON. Need fix. Also local URL 127.0.0.1 issue. Need create upload helper. Also DocumentUploadPage doesn't query tasks. We'll rewrite.

  - ApplicationReviewPage already has offer field inputs (payRate, startDate, schedule, supervisor) and passes them. It doesn't pass expiresAt. sendOffer optional expiresAt; OfferAcceptancePage reads offerExpiresAt. Need add expiresAt input and pass. Also default values should be loaded from application.fields. Currently defaults are hardcoded strings; should use fields if present.

  - OfferAcceptancePage already reads fields correctly. Good.

  - CandidateProfilePage already reads application.application.fields. Good.

  - ApplicationStatusPage already uses application.submittedAt and tasks. Good. Need maybe pixel-match, but plan can mention adjusting tokens per Figma.

  - TrainingPage already has step wizard with scroll/timer. Good. It doesn't match Figma frames 298:2/3/4? It's close. Plan can mention adjust styling. It uses hardcoded TRAINING_STEPS; good.

  - Routing: duplicate /onboarding/documents at lines 511-519 and 531-539? Actually we read router.tsx and saw only one `/onboarding/documents` route (lines 510-519) and `/onboarding/offer` at 531-539. Wait candidate plan said duplicate /onboarding/documents at lines 511-519 and 531-539, but actual file has /onboarding/documents once, /onboarding/offer after. Maybe the duplicate was in another version? We see no duplicate. Need re-check: lines 510-519 path onboarding/documents; lines 520-528 onboarding/acknowledgment; lines 530-539 onboarding/offer. No duplicate. So maybe already fixed or the candidate plan mistaken. However task says remove duplicate /onboarding/documents route. We can note in plan: verify duplicate absent; if present remove. But actual file no duplicate. Need be accurate. Could there be another route elsewhere? Search for onboarding/documents.No duplicate currently. The task description may be stale. We should note: "current router has only one `/onboarding/documents`; verify no duplicate remains." But acceptance criteria could include no duplicate. Since there is none, we can leave as-is or remove if appears. Need decide. The prompt explicitly says "Remove duplicate /onboarding/documents route in src/app/router.tsx". Since there is none, maybe it was already removed. Our plan should state: inspect router; if duplicate exists, remove it; currently it is already unique. But to satisfy task, we can say "verify and, if still present, remove duplicate route". However the task says do it. In plan, file changes table can include router.tsx: remove duplicate /onboarding/documents route (if present); confirm /onboarding routes. But to be precise, we can state current file has a single /onboarding/documents route; no action needed unless the duplicate reappears. But that might look like ignoring. Maybe the duplicate was between /onboarding/documents and /onboarding/offer? No. We'll mention.

  Need also note `/apply` route is guarded to org:candidate, which design doc says public applicant signup flow is not a goal; candidates enter via invitation. So keep guarded.

  Need inspect AppShell hides chrome? Could read? Not necessary.

  Need also understand storage URL bug. In dev, generateUploadUrl returns http://127.0.0.1:3210/api/storage/upload?token=...; the frontend fetch to that URL may fail due to CORS or because the dev server runs at http://localhost:5173 and 127.0.0.1:3210 is reachable? Actually 127.0.0.1 is same machine; CORS may be issue because convex dev server may not allow localhost origin? The fix: use Vite proxy for `/api/storage` to convex backend, and rewrite upload URL origin to window.location.origin in dev. Need create helper. The helper can be in src/shared/lib/upload.ts. Also update .env.local maybe VITE_CONVEX_URL is local. Need ensure vite proxy. The prompt says fix env wiring / upload helper / storage URL config. So plan includes: create `src/shared/lib/upload.ts` with `uploadToConvexStorage({ generateUploadUrl, file })`; dev origin rewrite; Vite dev proxy for `/api/storage` to VITE_CONVEX_URL.

  But note: `generateUploadUrl` returns `{ url, tenantId, uploadedBy }`. The helper will call generateUploadUrl, get url, in dev replace origin with `window.location.origin` (so proxy handles), POST file, parse JSON storageId. Also need preserve query string.

  Need also maybe ensure `VITE_CONVEX_URL` in .env.local uses `http://127.0.0.1:3210` (local backend). The proxy target should be that URL. `vite.config.ts` can read `process.env.VITE_CONVEX_URL`. But Vite config with `defineConfig` doesn't have `loadEnv` by default. Use `loadEnv` from vite. Or use `process.env.VITE_CONVEX_URL`. In dev command with --configLoader native, process env available? The config uses `process.env`? Actually Node's `process.env` is available. We can use `loadEnv(mode, process.cwd(), '')` to load .env.local. But simpler: `server: { proxy: { '/api/storage': { target: process.env.VITE_CONVEX_URL || 'http://127.0.0.1:3210', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/storage/, '/api/storage') } } }` maybe not needed. Actually target is the convex backend; when frontend fetches `/api/storage/upload?token=...`, Vite proxies to target + path. `changeOrigin: true` sets host header. Good.

  Need update DocumentUploadPage to use helper and pass task type from queried task. Also maybe allow `documentType` to be `photo_id`/`cpr_certificate`. The `attachCandidateDocument` handles any documentType string.

  Need ensure `CandidateOnboardingPage` maps to task _id for upload route. Could be simple change: remove route from TASK_META, in render for upload tasks use `/onboarding/upload/${task._id}`. For form/ack/training use static routes. For documents generic route maybe `/onboarding/documents` but not used. Good.

  Need consider `CandidateOnboardingPage` currently computes nextPending as first non-complete task. Good. It uses TASK_META for labels. Good. Need ensure no old types. Already good. But task says "ensure checklist and document upload complete the correct task types". So plan includes verify map matches CANDIDATE_TASK_TYPES. Already matches.

  Need update ApplicationFormPage per design doc. Also ensure it submits fields shape { fullName, email, phone, position }. It currently submits many. Need rewrite. Also redirect to `/onboarding/status` (currently redirects to checklist). Design doc says redirect to status.

  Need update ApplicationStatusPage per design doc: match frame, status card colors, timeline with dates, CTA destinations. Current is structurally okay but needs pixel styling. Plan includes restyle.

  Need update CandidateProfilePage per design doc: match Figma, edit mode. Current is read-only. Plan includes rewrite.

  Need update TrainingPage per design doc frames 298:2/3/4. Current is course catalog (190:2504). Wait design doc says current TrainingPage renders course catalog instead of wizard. But actual TrainingPage we read is a step wizard with scroll/timer. So maybe already updated. But Figma frames 298:2/3/4 show wizard. The current page is close. We can mention adjust to match exact frames (colors, layout). Prompt says "ensure offer/acceptance/profile/training pages use application.fields correctly". Training doesn't use fields; fine.

  Need also check that CandidateOnboardingIndex routes `accepted` to checklist. Candidate accepted still needs to complete documents/training before hire. Good. `hired` maybe should go to status or profile? But fine.

  Need also note backend tests: `convex/candidates.test.ts` expects old task list; must update to 6 types and new order. Also add tests for attachCandidateDocument task completion for photo_id/cpr_certificate and acknowledgeBackgroundCheck for background_check/employment_agreement and sendOffer field merge. The candidate plan includes that.

  Need also note `files.test.ts` add generateUploadUrl allows candidate. Maybe not necessary but good.

  Need also note E2E: `session1-phase2-schema.spec.ts` runs `test:phase2` backend integration. Need keep green. Also default e2e skips auth specs if credentials missing. Good.

  Need also consider `convex/files.ts`: `generateUploadUrl` returns `url`, `tenantId`, `uploadedBy`. The upload helper only needs url. Good.

  Need also consider whether we need to modify `files.ts` to configure storage URL? No, storage URL is from Convex dev. The fix is frontend proxy + helper. Could also set `VITE_CONVEX_URL` to `http://127.0.0.1:3210` in .env.local. But the upload URL origin is local; proxy fixes CORS. Need maybe mention ensure `.env.local` VITE_CONVEX_URL is set; if it points to 127.0.0.1, frontend fetch to that is cross-origin from localhost:5173? Actually 127.0.0.1 vs localhost are different origins. If Vite dev server runs on localhost:5173 and fetch to 127.0.0.1:3210, that's cross-origin (different host). Convex dev may allow CORS? The error "Failed to fetch" could be CORS. Proxy solves.

  Need also maybe add `server.proxy` in vite.config.ts. But note `vite.config.ts` uses `defineConfig` from `vitest/config`. We can add `server` property. Good.

  Need now produce final plan. Must be markdown. Include all 7 sections. Should be a synthesis of candidate plans, de-duplicated. Use actual file names and function names. Should mention design doc. Should note no schema migration. Should include alternatives considered. Should include test strategy with specific commands. Should include rollback/verification.

  We also need maybe mention that the current code already has some fixes (CandidateOnboardingPage task meta updated, ApplicationReviewPage fields present). The plan should reflect current state and required changes.

  Let's craft sections:

  1. Restated goal & acceptance criteria:
  - Goal: finish/harden Phase 2 candidate onboarding portal on branch feature/phase-2-worker-onboarding: fix dev document upload failure, make application form match Figma entry, wire checklist/document upload to backend task types, clean routing, ensure offer/profile/training pages use application.fields, keep security/gates green.
  - AC-1 Upload fix: local dev document upload succeeds; helper uses POST + JSON storageId; dev origin rewritten to Vite proxy; no 127.0.0.1/CORS failures.
  - AC-2 Routing: no duplicate /onboarding/documents; CandidateOnboardingIndex routes invited/new/application_draft -> /onboarding/application; offer_sent -> /onboarding/offer; all others -> /onboarding/checklist.
  - AC-3 Checklist: labels/routes map to CANDIDATE_TASK_TYPES [form_submission, photo_id, cpr_certificate, background_check, employment_agreement, platform_training]; progress computed from listCandidateTasks; Next routes to first pending task using task._id for upload tasks.
  - AC-4 Application form: match Figma entry (title, fields fullName/email/phone/position, autosave pill, status link), submit via submitApplication, redirect to /onboarding/status.
  - AC-5 Document upload: fetch listCandidateTasks, match task by _id, derive title/documentType from task.type, upload via shared helper, attach with documentType=task.type and optional expiry, redirect checklist.
  - AC-6 Offer flow: ApplicationReviewPage collects payRate, startDate, schedule, supervisor, expiresAt and passes to sendOffer; OfferAcceptancePage reads application.fields with defaults; accept/reject mutations work.
  - AC-7 Profile/status/training: CandidateProfilePage renders candidate + application.fields; ApplicationStatusPage uses application.submittedAt and task completions; TrainingPage records per-step completions via completeForCandidate and redirects to checklist.
  - AC-8 Security/tenancy: all mutations use requireTenantRole; candidates only attach to own profile; no cross-tenant reads/writes.
  - AC-9 Gates: lint, typecheck, unit tests, build, e2e local harness green.

  2. Discovery notes:
  - Backend: candidates.ts defines CANDIDATE_TASK_TYPES (form_submission, photo_id, cpr_certificate, background_check, employment_agreement, platform_training) at lines 41-48. submitApplication updates application and completes form_submission. attachCandidateDocument inserts files/documentArchiveItems and completes task by documentType (any string). acknowledgeBackgroundCheck completes background_check + employment_agreement. sendOffer merges optional offer fields into application.fields and sets status offer_sent. acceptOffer/rejectOffer enforce offer_sent. listCandidateTasks/getMyApplication return tasks ordered.
  - Storage: files.ts generateUploadUrl allows org:candidate and returns { url, tenantId, uploadedBy }. Caregiver ShiftTaskList.tsx uses POST and response.json().storageId pattern.
  - Training: platformTrainingCompletions.ts completeForCandidate/listMyCompletions allow org:candidate; completeForCandidate also completes platform_training task.
  - Frontend pages: CandidateOnboardingPage already maps six task types but routes upload by type string instead of task._id. DocumentUploadPage uses PUT + URL path parsing. ApplicationFormPage collects extra fields (dob, address, etc.). ApplicationReviewPage already has offer field inputs but lacks expiresAt and doesn't seed values from application.fields. OfferAcceptancePage reads application.fields.offerExpiresAt. CandidateProfilePage uses application.application.fields. ApplicationStatusPage uses application.submittedAt. TrainingPage has step wizard.
  - Routing: src/app/router.tsx currently has a single /onboarding/documents route (no duplicate observed in this inspection); /apply guarded to org:candidate (intended).
  - Auth: authHelpers requireTenantRole, assertTenantDoc used everywhere.
  - Tooling: vite.config.ts has no dev proxy; playwright.config.ts skips @auth specs when local/missing credentials.

  3. Alternatives considered:
  - Upload reachability: reconfigure convex dev bind address (brittle), backend HTTP action proxy (adds load), Vite proxy + origin rewrite (chosen, zero backend changes, matches caregiver pattern).
  - Upload protocol: keep PUT + path parsing (wrong; Convex uses POST JSON), switch to POST + JSON (chosen).
  - Checklist task display: add title column to candidateTasks (schema migration not required; frontend display map sufficient and type is source of truth).
  - Document upload routing: generic /onboarding/documents vs task-specific /onboarding/upload/:taskId (chosen; allows exact title and correct documentType).
  - Offer fields: separate offer modal vs inline in ApplicationReviewPage (chosen; existing review page already has decision card and sendOffer signature).

  4. Files to create/modify table:
  - src/shared/lib/upload.ts create
  - vite.config.ts modify
  - src/app/router.tsx modify (verify/remove duplicate /onboarding/documents)
  - src/features/onboarding/pages/CandidateOnboardingIndex.tsx modify maybe no change? Verify routing table.
  - src/features/onboarding/pages/CandidateOnboardingPage.tsx modify: route upload tasks by task._id
  - src/features/onboarding/pages/ApplicationFormPage.tsx rewrite: Figma entry form
  - src/features/onboarding/pages/DocumentUploadPage.tsx rewrite: use task query + helper
  - src/features/onboarding/pages/ApplicationStatusPage.tsx modify: match Figma tokens/timeline
  - src/features/onboarding/pages/CandidateProfilePage.tsx modify: match Figma + edit mode
  - src/features/onboarding/pages/TrainingPage.tsx modify: match Figma 298 frames
  - src/features/onboarding/pages/AcknowledgmentPage.tsx modify: match Figma 158:905 (already close)
  - src/features/hr/pages/ApplicationReviewPage.tsx modify: add expiresAt input, seed from application.fields, pass expiresAt to sendOffer
  - src/features/onboarding/ApplicationFormPage.test.tsx modify
  - src/features/onboarding/pages/*.test.tsx create/update
  - convex/candidates.test.ts modify: update expected task list, add lifecycle tests
  - convex/files.test.ts modify: generateUploadUrl candidate role
  - convex/_generated/* regenerate via npx convex codegen if any convex source edited (files.ts role list already includes candidate; no schema change; still run codegen after edits).

  Need be careful: We shouldn't edit convex/*? The task says after editing convex/* run codegen. We may not need to edit convex/* except tests. files.ts already includes org:candidate. So no convex source changes; codegen not strictly needed but safe. However candidates.test.ts update is test file, not source. So no codegen needed. But if we modify convex source? Maybe not. We'll keep plan to only frontend changes and tests. Good.

  5. Edge cases:
  - Tenant isolation via requireTenantRole; assertTenantDoc.
  - Candidate scoping: attachCandidateDocument uses getOwnCandidate.
  - Upload URL signed; origin rewrite only changes origin in dev, token/path unchanged.
  - Task completion idempotent: completeCandidateTask finds first pending by type.
  - Duplicate training completions: UI uses Set; backend allows multiple rows.
  - Application resubmission: terminal statuses blocked; latest non-hired row updated.
  - Offer field merge: sendOffer only overwrites provided fields.
  - File validation: type/size checked in frontend and backend.
  - Expiry optional for documents.
  - PHI: files visibility admins_coordinators; candidates never get download URLs.
  - E2E auth skip: playwright config avoids unrelated failures.

  6. Test strategy:
  Unit/component:
  - ApplicationFormPage.test.tsx: fill fullName/email/phone/position, assert submitApplication called with those fields, redirect status.
  - CandidateOnboardingPage.test.tsx: mock all six task types, assert progress, next route to first pending (task._id for uploads), labels.
  - DocumentUploadPage.test.tsx: mock listCandidateTasks, select file, assert helper called and attachCandidateDocument with documentType=task.type.
  - OfferAcceptancePage.test.tsx: accept/reject call correct mutations; non-offer_sent shows no pending.
  - CandidateProfilePage.test.tsx: toggle edit/save.
  - ApplicationStatusPage.test.tsx: timeline state for applied/offer_sent/rejected.
  - AcknowledgmentPage.test.tsx: confirm disabled until scroll+checkbox.
  - TrainingPage.test.tsx: timer unlocks button, completeForCandidate per step.

  Backend integration:
  - convex/candidates.test.ts: invite creates six tasks in order; submitApplication completes form_submission; attachCandidateDocument completes photo_id/cpr_certificate; acknowledgeBackgroundCheck completes background_check+employment_agreement; sendOffer merges fields including offerExpiresAt; acceptOffer updates status.
  - convex/files.test.ts: generateUploadUrl succeeds for org:candidate, fails for wrong role.

  E2E:
  - tests/e2e/session1-phase2-schema.spec.ts (test:phase2) remains green.
  - npm run e2e skips @auth when local/missing credentials.

  Gate commands:
  npx convex codegen (if any convex source changed)
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  npm run e2e:local (or npm run e2e)

  7. Rollback/verification:
  - All changes on feature branch; revert via git.
  - Verify upload: network POST to /api/storage/upload returns { storageId }, redirect checklist task complete.
  - Verify routing: visit /onboarding for each status.
  - Verify offer: HR sends offer with fields; candidate sees values; accept updates status.
  - Verify gates: all commands exit 0.

  Need final answer as markdown plan. Should be concise but complete. Avoid code. Ensure single quotes/no semicolons? Plan text doesn't matter. But code snippets? We can include bash commands.

  Need also mention that inspection was done (since agentic CLI). Good.

  Let's also consider design doc references. It says Figma frames: application entry 157:682, full application form 189:2287, checklist 157:832, documents 157:860, offer 158:879, acknowledgment 158:905, profile 162:1395, training 190:2504 (ignore empty 298:2/3/4). But design doc says training wizard frames 298:2/3/4. Prompt says training frame 190:2504 and ignore empty 298:2/3/4. So use 190:2504. Good.

  Need maybe mention public /apply route? Prompt says "Remove duplicate /onboarding/documents route ... wire CandidateOnboardingIndex routing to new statuses/tasks, update ApplicationReviewPage to pass offer fields to sendOffer, and ensure offer/acceptance/profile/training pages use application.fields correctly." So we focus.

  Potential issue: CandidateOnboardingPage currently routes document tasks to `/onboarding/upload/photo_id` etc. If we change to `/onboarding/upload/${task._id}`, the DocumentUploadPage must read task by _id. That is a more robust plan. However it requires tasks query. The route param `taskId` currently used as type. We can keep same route param name but interpret as _id. We need update both page and checklist. Good.

  Potential issue: In CandidateOnboardingPage, if the first pending task is photo_id, the "Next" button should route to /onboarding/upload/<task._id>. In render, the row click should also go to task-specific route. The TASK_META map can provide static routes for non-upload tasks; for upload tasks, route computed from task._id. Could simplify by having TASK_META only for labels, and route function `getTaskRoute(task)` returns static route for form/ack/training, else `/onboarding/upload/${task._id}`. Good.

  Potential issue: `CandidateOnboardingIndex` for `application_draft` -> application. Good. But after submitting application, status `applied` -> checklist. Good. After HR requests correction, status `application_draft` -> application. Good.

  Potential issue: DocumentUploadPage uses `taskId` param; if route uses _id, need query listCandidateTasks and find task._id === taskId. If task not found, show error/back. Good.

  Potential issue: ApplicationReviewPage's sendOffer currently doesn't pass expiresAt. Need add `expiresAt` input (date). It also has hardcoded defaults. We should seed from `fields` of application. For example:
  ```
  const [payRate, setPayRate] = useState(fields.payRate || '$22.00 / hr')
  ...
  const [expiresAt, setExpiresAt] = useState(fields.offerExpiresAt || '')
  ```
  Then pass `expiresAt` to sendOffer.

  Potential issue: OfferAcceptancePage reads `fields.offerExpiresAt`. Good.

  Potential issue: CandidateProfilePage currently read-only and uses appFields.dob etc. If ApplicationFormPage no longer collects dob/address/experience, those fields will be absent. CandidateProfilePage should handle missing gracefully (show '—'). It already does. But design doc wants edit mode. Could be out of scope? Prompt says "ensure offer/acceptance/profile/training pages use application.fields correctly." It doesn't explicitly require edit mode. But design doc Stage 8 says edit mode. The task says "complete the candidate portal implementation per phase-2-implementation-plan.md and Figma frames". Since no phase-2 plan exists, but design doc is referenced. We can include profile rewrite with edit mode in plan, but maybe keep minimal. Candidate plan agentic says "ensure read-only fields come from application.application.fields path correctly; preserve edit/save for name/email/phone" — current page has no edit/save. Hmm. The prompt says "ensure offer/acceptance/profile/training pages use application.fields correctly." It may not require edit mode. But to be comprehensive, we can plan to add edit mode. However that increases scope. Since the user says "carry out those instructions completely" but we are only writing a plan, not implementing. We can include profile page modifications to match Figma and use fields correctly. Adding edit mode is optional but aligned with Figma. We'll include but mark as styling/field usage, not backend changes.

  Potential issue: TrainingPage uses `completeForCandidate` which marks platform_training complete on any step completion (first time). It records each step. After all steps, the task is complete. Good. It redirects to checklist. Good.

  Potential issue: The design doc mentions `hasCompleted` query and platformTrainingCompletions index. Not needed.

  Need also maybe mention `src/app/providers.tsx` auth sync? Not needed.

  Now produce final plan. Ensure not too long but premium. Use tables and bullets.

  Need include "Files were inspected directly" in discovery.

  Let's write final answer.

To resume this session: kimi -r session_f9711c88-22a0-4f96-92d5-6d4258ea3175
