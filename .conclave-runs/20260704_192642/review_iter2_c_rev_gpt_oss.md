# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The change implements most of the required candidate lifecycle functions:

* **inviteCandidate** – correctly guards `org:admin`/`org:hr`, creates a candidate row with status `invited`, seeds five ordered tasks, and sends a Clerk invitation.  
* **getCandidateProfile**, **listCandidates**, **getCandidateDetail**, **listCandidateTasks**, **listCandidateTasksForHR** – all query guards and data retrievals match the spec.  
* **submitApplication**, **reviewApplication**, **sendOffer**, **acceptOffer**, **rejectOffer**, **hireCandidate** – mutations enforce role guards, update status, complete the appropriate tasks, and record audit entries.  
* **addCandidateDocument** – handles candidate‑self and admin/HR uploads, inserts a document archive item, completes the `document_upload` task and audits the action.  
* Schema updates add needed indexes (`by_tenant_clerk_user`, `by_candidate`, `order` on tasks) and a `fields` column on `applications`.  
* `members.sync` now links a candidate’s Clerk user ID on first login, enabling `getCandidateProfile` to locate the candidate.  
* `authHelpers` now includes `requireTenantRoleAction` for actions, and `audit` allows `org:hr`/`org:candidate`.

**Missing pieces**

1. **Onboarding module** – The task requires `convex/onboarding.ts` with:
   * `completePlatformTraining` (idempotent upsert of a `platformTrainingCompletions` row for the caller, allowed for `org:caregiver` or `org:candidate`).
   * `hasPlatformTrainingCompleted` (returns a boolean for the caller).
   * `resetPlatformTraining` (admin‑only deletion of a completion row by `clerkUserId`).

   These functions are referenced in `convex/_generated/api.d.ts` but are not present in the repository.

2. **Tests for onboarding** – While existing candidate tests pass, there are no tests covering the new onboarding functions, which are required for the gate suite.

3. **Idempotency guarantee** – `completePlatformTraining` must be idempotent; without its implementation we cannot verify this behavior.

**Action required**

* Add `convex/onboarding.ts` implementing the three functions with proper role guards, using the existing `platformTrainingCompletions` table, and ensuring idempotent upserts.
* Update any related schema (if needed) to support the upsert (e.g., unique index on `tenantId` + `trainingId` + `clerkUserId`).
* Add corresponding Vitest/Playwright tests verifying:
  * `completePlatformTraining` is idempotent.
  * `hasPlatformTrainingCompleted` reflects the correct boolean before/after completion.
  * `resetPlatformTraining` is admin‑only and removes the row.
* Run `npx convex codegen` after adding the file.

Once these onboarding functions and tests are added, the implementation will fully satisfy the task.

VERDICT: CHANGES_REQUESTED