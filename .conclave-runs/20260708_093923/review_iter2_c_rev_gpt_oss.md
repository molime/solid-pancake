# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

We need to read the file.**Review Summary**

The diff introduces a large amount of backend test coverage and minor UI tweaks, but it does **not** address several core acceptance criteria for Phase 2 candidate onboarding:

| Acceptance Criterion | Status | Evidence |
|----------------------|--------|----------|
| **AC‑1 – Upload regression fixed** – new `src/shared/lib/upload.ts`, Vite dev‑proxy, POST‑based upload, JSON `storageId` parsing, dev‑origin rewrite. | ❌ Missing | No new `upload.ts` file, no changes to `vite.config.ts`, and `convex/files.ts` only added optional args; the frontend still uses the old `PUT`‑based `DocumentUploadPage`. |
| **AC‑2 – Routing clean‑up** – ensure no duplicate `/onboarding/documents` route. | ✅ (already clean) | `src/app/router.tsx` still contains a single `/onboarding/documents` route; no duplicate was introduced. |
| **AC‑3 – Checklist uses correct task types & routes by task _id** – `CandidateOnboardingPage` should link upload tasks to `/onboarding/upload/<taskId>` and compute progress from the six `CANDIDATE_TASK_TYPES`. | ❌ Partially | The page already maps the six task types, but routes are still hard‑coded to `/onboarding/upload/<type>` (e.g. `/onboarding/upload/photo_id`). No change to use `task._id`. |
| **AC‑4 – Application entry form matches Figma** – only `fullName`, `email`, `phone`, `position`; autosave pill; redirect to `/onboarding/status`. | ❌ Missing | `src/features/onboarding/ApplicationFormPage.tsx` was not modified; it still renders many extra fields (DOB, address, experience, etc.) and redirects to the checklist. |
| **AC‑5 – Document upload page** – query `listCandidateTasks`, find task by `_id`, use new upload helper, call `attachCandidateDocument` with `documentType: task.type`, then redirect to checklist. | ❌ Missing | `src/features/onboarding/pages/DocumentUploadPage.tsx` was not changed; it still uses a `PUT` request, parses `storageId` from the URL path, and does not look up the task by `_id`. |
| **AC‑6 – Offer flow** – `ApplicationReviewPage` must include an `expiresAt` input, seed all offer fields from `application.fields`, and pass them to `sendOffer`. | ❌ Missing | No changes to `src/features/hr/pages/ApplicationReviewPage.tsx`; the `expiresAt` field is absent and defaults are hard‑coded. |
| **AC‑7 – Offer/acceptance/profile/training pages use `application.fields` correctly** – profile page should read/write fields, training page should reflect Figma step‑wizard. | ❌ Partially | `CandidateProfilePage` was touched (48‑line change) but the diff does not show an edit‑mode implementation or proper field defaults. Training page already uses a step wizard but no explicit alignment with Figma frames 298:2/3/4 is verified. |
| **AC‑8 – Security / tenancy** – all mutations must still call `requireTenantRole` / `assertTenantDoc`. | ✅ | Backend mutations already guard roles; no new unguarded code was added. |
| **AC‑9 – All gates (lint, typecheck, unit, build, E2E) pass** | ✅ (current test run) | All existing gates pass, but new functionality is untested and therefore not verified. |

**Concrete Missing Implementations / Blockers**

1. **Upload Helper & Vite Proxy**  
   *Create `src/shared/lib/upload.ts`* with a `uploadFileToConvex` function that:
   - Calls `generateUploadUrl` (now accepts `contentType`/`size`).
   - In dev, rewrites the returned URL’s origin to `window.location.origin` so the Vite proxy can forward the request.
   - Performs a `POST` with the file body, parses `{ storageId }` from JSON, and returns it.  
   *Update `vite.config.ts`* to add a dev‑only `server.proxy` entry for `/api/storage` pointing at `process.env.VITE_CONVEX_URL` (fallback `http://127.0.0.1:3210`).  

2. **ApplicationFormPage Rewrite**  
   - Reduce the form to the four required fields (`fullName`, `email`, `phone`, `position`).  
   - Add the autosave pill UI and a footer link to “Already have an account?”.  
   - On submit, call `submitApplication` with the reduced payload and `router.navigate('/onboarding/status')`.  

3. **DocumentUploadPage Rewrite**  
   - Query `listCandidateTasks` to locate the task by `taskId` (now `_id`).  
   - Derive `documentType` from `task.type`.  
   - Use the new upload helper to obtain `storageId`.  
   - Call `attachCandidateDocument({ clerkOrgId, taskId: task._id, documentType, storageId })`.  
   - After success, navigate back to `/onboarding/checklist`.  

4. **CandidateOnboardingPage Routing Update**  
   - For tasks whose `type` is a document (`photo_id`, `cpr_certificate`), generate the route `/onboarding/upload/${task._id}` instead of the static type‑based route.  
   - Adjust the “Next” button logic to use the first pending task’s `_id` for document uploads.  

5. **ApplicationReviewPage Enhancements**  
   - Add an `expiresAt` `<input type="date">` field.  
   - Initialise all offer fields (`payRate`, `startDate`, `schedule`, `supervisor`, `expiresAt`) from `application.fields` (fallback to empty strings).  
   - Pass the `expiresAt` value to `sendOffer`.  

6. **CandidateProfilePage Edit Mode**  
   - Implement an edit‑toggle UI (pencil icon → form fields) that updates the candidate via `updateCandidate` mutation.  
   - Ensure the displayed values are sourced from `application.application.fields`.  

7. **Tests for New Behaviour**  
   - **Upload helper**: unit test for `uploadFileToConvex` (mock `generateUploadUrl` and fetch).  
   - **ApplicationFormPage**: test that only the four fields are rendered, that `submitApplication` receives the correct payload, and that navigation goes to `/onboarding/status`.  
   - **DocumentUploadPage**: test task lookup by `_id`, correct call to `attachCandidateDocument`, and redirect.  
   - **CandidateOnboardingPage**: test that “Next” routes to `/onboarding/upload/<taskId>` for document tasks.  
   - **ApplicationReviewPage**: test that `expiresAt` input is rendered, defaults from `application.fields`, and that `sendOffer` receives it.  

8. **Documentation / Design Alignment**  
   - Verify pixel‑matching against the Figma frames (157:682, 189:2287, 157:832, 157:860, 158:879, 158:905, 162:1395, 190:2504). Adjust Tailwind classes as needed.  

**Recommended Changes**

- Add the missing files (`upload.ts`, updated `vite.config.ts`).  
- Refactor the three onboarding pages (`ApplicationFormPage`, `DocumentUploadPage`, `CandidateOnboardingPage`) as described.  
- Extend `ApplicationReviewPage` with the `expiresAt` field and proper defaults.  
- Implement edit mode in `CandidateProfilePage`.  
- Add the corresponding unit tests and update any affected integration tests.  
- Run `npx convex codegen` if any Convex source files are touched (e.g., `files.ts` already includes `org:candidate`).  

Once these changes are merged and the new tests pass, all acceptance criteria will be satisfied.

**Verdict**: CHANGES_REQUESTED