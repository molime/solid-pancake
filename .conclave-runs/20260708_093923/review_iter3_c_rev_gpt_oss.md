# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

{
  "tool": "read",
  "path": "src/features/onboarding/pages/DocumentUploadPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/CandidateOnboardingPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/ApplicationFormPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/hr/pages/ApplicationReviewPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/CandidateProfilePage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/ApplicationStatusPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/TrainingPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/AcknowledgmentPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/app/router.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "vite.config.ts",
  "line_start": 1,
  "line_end": 200
}
{
  "tool": "read",
  "path": "C:\\Users\\pinol\\Downloads\\atriax-phase2-candidate-portal-redesign.md",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/DocumentUploadPage.tsx",
  "line_start": 1,
  "line_end": 400
}
{
  "tool": "read",
  "path": "src/app/router.tsx",
  "line_start": 1,
  "line_end": 200
}
{
  "tool": "read",
  "path": "package.json",
  "line_start": 1,
  "line_end": 200
}
{
  "tool": "search",
  "path": "src/features/hr/pages/ApplicationReviewPage.tsx",
  "query": "expiresAt",
  "max_results": 20
}
{
  "tool": "read",
  "path": "src/features/onboarding/ApplicationFormPage.test.tsx",
  "line_start": 1,
  "line_end": 200
}
{
  "tool": "read",
  "path": "src/features/onboarding/pages/CandidateOnboardingPage.test.tsx",
  "line_start": 1,
  "line_end": 200
}
**Review Summary**

The PR makes extensive improvements to the candidate onboarding flow, adds many new backend tests, and tightens auth handling. Most of the acceptance criteria are covered, but a few critical items remain incomplete or only partially addressed.

---

### 1. Upload URL regression (AC‑1)

* **Backend** – `convex/files.ts` now allows `org:candidate` (line 42). Good, but the *dev‑only* “Failed to fetch” error is caused by the upload URL pointing to `http://127.0.0.1:3210/...` which is a different origin from the Vite dev server (`http://localhost:5173`).  
* **Frontend** – No new upload helper (`src/shared/lib/upload.ts`) was added, and `vite.config.ts` was not modified to proxy `/api/storage` to the Convex dev server. The existing `DocumentUploadPage` still uses the old `PUT`‑style URL parsing (see the unchanged `src/features/onboarding/pages/DocumentUploadPage.tsx`).  
* **Tests** – `src/features/onboarding/pages/DocumentUploadPage.test.tsx` now passes because the fetch is mocked, but the real‑world dev bug remains.

**Required fix:**  
1. Add `src/shared/lib/upload.ts` with a `uploadFileToConvex` helper that:  
   * Calls `generateUploadUrl` via the Convex client.  
   * In dev, rewrites the returned URL’s origin to `window.location.origin` (so the Vite proxy can handle it).  
   * Performs a `POST` with the file body and reads `{ storageId }` from the JSON response.  
2. Extend `vite.config.ts` to include a dev‑only `server.proxy` entry for `/api/storage` → `process.env.VITE_CONVEX_URL` (or `http://127.0.0.1:3210`).  
3. Update `DocumentUploadPage` to use the new helper and to send `documentType: task.type` (derived from the task fetched by `_id`).  

---

### 2. Routing cleanup (AC‑2)

* `src/app/router.tsx` had a duplicate `/onboarding/documents` route removed (10 lines deleted). The file now contains a single `/onboarding/documents` entry, satisfying the duplicate‑removal requirement. No further action needed.

---

### 3. Checklist & task routing (AC‑3)

* `src/features/onboarding/pages/CandidateOnboardingPage.test.tsx` passes, indicating the checklist renders the six task types correctly.  
* However, the page still routes document uploads by **type string** (`/onboarding/upload/photo_id`) rather than by the task’s `_id`. The Figma spec expects routing via `/onboarding/upload/:taskId`.  

**Required fix:**  
* Change the rendering logic in `CandidateOnboardingPage.tsx` to generate the upload link as `/onboarding/upload/${task._id}` for tasks whose `type` is a document (`photo_id`, `cpr_certificate`). Adjust the “Next” button logic accordingly.

---

### 4. Application entry form (AC‑4)

* `src/features/onboarding/pages/ApplicationFormPage.test.tsx` now validates a four‑field form (fullName, email, phone, position) and redirects to `/onboarding/status`. The implementation appears to match the Figma entry frame, so this criterion is satisfied.

---

### 5. Document upload flow (AC‑5)

* The test for `DocumentUploadPage` passes, but the component still uses the old `PUT`‑style URL parsing and does not query `listCandidateTasks` to resolve the task by `_id`. After the upload helper is added (see point 1), also refactor the page to:
  * Query `listCandidateTasks`, locate the task by `_id` from the route param.  
  * Derive `documentType` from `task.type`.  
  * Call `attachCandidateDocument` with `{ documentType: task.type, ... }`.  

---

### 6. Offer flow (AC‑6)

* `src/features/hr/pages/ApplicationReviewPage.tsx` already collects `payRate`, `startDate`, `schedule`, and `supervisor`, but **does not include an `expiresAt` field** nor does it seed the inputs from `application.fields`.  
* `src/features/onboarding/pages/OfferAcceptancePage.tsx` correctly reads `fields.offerExpiresAt`, but the HR side never sends it.

**Required fix:**  
* Add an `expiresAt` input (date picker) to the review page.  
* Initialise all offer inputs (`payRate`, `startDate`, `schedule`, `supervisor`, `expiresAt`) from `application.fields` if present.  
* Pass `expiresAt` to `sendOffer`.  
* Add a unit test verifying that `sendOffer` receives the extra field.

---

### 7. Profile / status / training pages (AC‑7)

* `CandidateProfilePage.tsx` was modified (48 lines) and now reads `application.application.fields`. The edit‑toggle UI required by the design doc is present, satisfying the “use fields correctly” clause.  
* `ApplicationStatusPage.tsx` and `TrainingPage.tsx` were not changed in the diff, but existing implementations already render status timelines and the step‑wizard respectively, matching the referenced Figma frames. No further changes required.

---

### 8. Security & tenancy (AC‑8)

* Added `org:candidate` to storage permissions.  
* Auth helpers now consider `org_public_metadata` for role resolution (`convex/authHelpers.ts`).  
* New internal mutation `members.createBypassMember` is gated by `requireTenantRole`.  
* No new cross‑tenant reads/writes introduced. This area looks solid.

---

### 9. Test coverage (AC‑9)

* All unit, integration, and E2E tests pass (58 test files, 469 tests).  
* However, there is **no test covering the new `expiresAt` field** nor the dev‑proxy upload flow. Add a test for `ApplicationReviewPage` and a Playwright scenario that performs a real file upload in a local dev environment (using the new helper) to guarantee the regression is fixed.

---

## Required Changes (concrete blockers)

| File | Change |
|------|--------|
| `src/shared/lib/upload.ts` (new) | Implement `uploadFileToConvex({ generateUploadUrl, file })` as described in point 1. |
| `vite.config.ts` | Add `server.proxy` for `/api/storage` → `process.env.VITE_CONVEX_URL` (dev only) and `changeOrigin: true`. |
| `src/features/onboarding/pages/DocumentUploadPage.tsx` | Use the new upload helper, fetch task by `_id`, POST upload, parse JSON `storageId`, call `attachCandidateDocument` with `documentType: task.type`. |
| `src/features/onboarding/pages/CandidateOnboardingPage.tsx` | Route document‑type tasks to `/onboarding/upload/${task._id}`; adjust “Next” navigation accordingly. |
| `src/features/hr/pages/ApplicationReviewPage.tsx` | Add `expiresAt` input, seed all offer fields from `application.fields`, pass `expiresAt` to `sendOffer`. |
| `src/features/onboarding/pages/ApplicationReviewPage.test.tsx` (new) | Verify `sendOffer` receives `expiresAt`. |
| `src/features/onboarding/pages/DocumentUploadPage.test.tsx` (if needed) | Ensure the test reflects the new POST‑JSON upload flow. |
| `src/features/onboarding/pages/TrainingPage.tsx` (optional) | Verify styling matches Figma frame 298:2/3/4 (no functional change required). |
| `src/app/router.tsx` | Confirm only one `/onboarding/documents` route remains (already removed duplicate). |
| `src/features/onboarding/pages/DocumentUploadPage.test.tsx` | May need minor update to mock the new helper. |

---

### Verification Steps

1. **Local dev upload** – Run the app (`npm run dev`), open a document upload page, select a file. Network tab should show a `POST` to `/api/storage/upload?...` (same origin) returning `{ "storageId": "..." }`. The task should be marked complete and the UI should navigate back to the checklist.  
2. **Offer flow** – In HR view, fill all offer fields including expiry date, click “Send Offer”. Switch to candidate view; the offer page must display the expiry date and allow acceptance. Verify `acceptOffer` updates status to `accepted`.  
3. **Routing** – Visit `/onboarding` with a candidate in each status (`invited`, `application_draft`, `applied`, `hr_review`, `offer_sent`, `accepted`, `hired`). Confirm redirects match the spec.  
4. **Run all gates** – `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run e2e:local`. All must exit `0`.  
5. **E2E upload** – Add a Playwright test that performs a real file upload in a local dev run (bypassing Clerk auth if needed). Ensure the test passes, confirming the proxy fix works.

---

**Conclusion:** The PR is largely successful but missing the critical dev‑proxy upload fix and the `expiresAt` handling in the offer flow, plus the routing adjustment for document uploads. These blockers must be addressed before the changes can be considered complete.

**Verdict:** CHANGES_REQUESTED