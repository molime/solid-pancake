# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Session 3 - Candidate & Onboarding Backend

## 1. Goal & Acceptance Criteria
**Goal:** Implement the candidate lifecycle management and platform training gate within the Convex backend, ensuring strict multi-tenant security, role-based access control (RBAC), and integration with existing invitation and ADP sync systems.

**Acceptance Criteria:**
1.  **16 Functions Implemented:** All specified mutations/queries created in `convex/candidates.ts` and `convex/onboarding.ts`.
2.  **Security:** Every function guarded by `authHelpers.requireTenantRole` or equivalent. Tenant isolation enforced on all data reads/writes.
3.  **Integrations:** Reuses `convex/invitations.ts` for Clerk invites and `convex/adpSync.ts` for ADP worker scheduling.
4.  **Task Seeding:** `inviteCandidate` automatically seeds 5 specific `candidateTasks`.
5.  **Idempotency:** `completePlatformTraining` and offer acceptance/rejection handle duplicate calls gracefully.
6.  **Tests:** All 16 specific test cases pass (including role guards, task completion triggers, and ADP sync scheduling).
7.  **Gates:** `npm run lint`, `typecheck`, and `test` must pass. `npx convex codegen` run after schema/function changes.
8.  **Style:** 2-space indent, single quotes, no semicolons.

## 2. Discovery Notes
**Limitation:** I cannot inspect the local repository files directly. This plan relies on the task description, standard Convex/Clerk patterns, and the provided context regarding existing modules (`authHelpers`, `invitations`, `adpSync`).

**Assumed Contracts & Seams:**
*   **`convex/authHelpers.ts`:** Exports `requireTenantRole(ctx, roles[])` which throws 403 if Clerk user metadata doesn't match.
*   **`convex/invitations.ts`:** Exports `sendInvitation({ email, role, orgId })` handling Clerk API calls.
*   **`convex/adpSync.ts`:** Exports `adpSyncWorker` action accepting `employeeProfileId`.
*   **Schema Tables (Expected):**
    *   `candidates`: `userId` (Clerk), `tenantId`, `status` (invited, applied, reviewed, offer_sent, accepted, hired, withdrawn), `profileData`.
    *   `applications`: `candidateId`, `formData`, `status`.
    *   `candidateTasks`: `candidateId`, `type` (form_submission, document_upload, etc.), `status`, `order`.
    *   `platformTrainingCompletions`: `userId`, `tenantId`, `completedAt`.
    *   `documentArchiveItems`: `ownerId` (candidateId), `fileId`, `type`, `expiresAt`.
    *   `employeeProfiles`: `tenantMemberId`, `adpSyncStatus`.
    *   `tenantMembers`: Links Clerk User to Tenant + Role (`org:caregiver`).
*   **Auth Context:** Convex `ctx.auth` provides `userId` and `tokenClaims` (where Clerk metadata lives).

## 3. Alternatives Considered
1.  **Single File vs. Split Files:**
    *   *Option:* Put all logic in `candidates.ts`.
    *   *Decision:* Split training logic to `onboarding.ts` as per task instruction. This separates "Hiring Lifecycle" from "Compliance/Training", reducing file complexity and aligning with domain boundaries.
2.  **Action vs. Mutation for ADP Sync:**
    *   *Option:* Call ADP API directly inside `hireCandidate` mutation.
    *   *Decision:* Reuse `adpSyncWorker` action (Phase 1). Mutations should not block on external HTTP calls. Scheduling the action ensures reliability and retry logic already built in Phase 1.
3.  **Task Seeding Strategy:**
    *   *Option:* Seed tasks via client-side batch call.
    *   *Decision:* Seed server-side within `inviteCandidate` transaction. Ensures atomicity (invite fails -> no tasks; invite succeeds -> tasks exist).

## 4. Exact Files to Create/Edit

### A. `convex/schema.ts` (Verification/Update)
*   **Action:** Verify tables exist. If missing, add definitions for `candidates`, `applications`, `candidateTasks`, `platformTrainingCompletions`, `documentArchiveItems`.
*   **Key Fields:** Ensure `tenantId` is indexed on all tables for multi-tenant filtering. Ensure `candidateId` is indexed on `applications` and `tasks`.

### B. `convex/candidates.ts` (Core Lifecycle)
*   **`inviteCandidate` (mutation):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Call `invitations.sendInvitation` (role: `org:candidate`). Insert `candidates` row (status: `invited`). Insert 5 `candidateTasks` (e.g., `profile_complete`, `form_submission`, `doc_upload_1`, `doc_upload_2`, `training_complete`).
*   **`getCandidateProfile` (query):**
    *   Guard: `org:candidate`.
    *   Logic: Query `candidates` where `userId === ctx.auth.userId`.
*   **`submitApplication` (mutation):**
    *   Guard: `org:candidate`.
    *   Logic: Upsert `applications`. Find `candidateTasks` where `type === 'form_submission'`, mark completed. Write audit log (if audit table exists).
*   **`listCandidates` (query):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Query `candidates` by `tenantId`. Filter by `status` if provided.
*   **`getCandidateDetail` (query):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Fetch candidate + `applications` + `tasks` + `documentArchiveItems`. Ensure all belong to same `tenantId`.
*   **`reviewApplication` (mutation):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Update `applications` status. Update `candidates` status to `reviewed`. Save `hrNotes`.
*   **`sendOffer` (mutation):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Transition `candidates` status `reviewed` -> `offer_sent`.
*   **`acceptOffer` (mutation):**
    *   Guard: `org:candidate`.
    *   Logic: Transition `candidates` status `offer_sent` -> `accepted`. Idempotent check (if already accepted, return success).
*   **`rejectOffer` (mutation):**
    *   Guard: `org:candidate`.
    *   Logic: Transition `candidates` status `offer_sent` -> `withdrawn`.
*   **`hireCandidate` (mutation):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic:
        1.  Verify status `accepted`.
        2.  Upsert `tenantMembers` (role: `org:caregiver`).
        3.  Create/Update `employeeProfiles` (status: `pending_credentials`).
        4.  Schedule `adpSyncWorker` action with `employeeProfileId`.
        5.  Update `candidates` status `hired`.
        6.  Audit log.
*   **`addCandidateDocument` (mutation):**
    *   Guard: `org:candidate` (own) | `org:admin` | `org:hr`.
    *   Logic: Insert `documentArchiveItems`. Find matching `candidateTasks` (type `document_upload`), mark completed.
*   **`listCandidateTasks` (query):**
    *   Guard: `org:candidate`.
    *   Logic: Query `candidateTasks` by `candidateId` (derived from user), order by `order`.
*   **`listCandidateTasksForHR` (query):**
    *   Guard: `org:admin` | `org:hr`.
    *   Logic: Query `candidateTasks` by `candidateId` (arg), verify tenant match.

### C. `convex/onboarding.ts` (Training Gate)
*   **`completePlatformTraining` (mutation):**
    *   Guard: `org:caregiver` | `org:candidate`.
    *   Logic: Upsert `platformTrainingCompletions`. Idempotent (if exists, update timestamp or noop).
*   **`hasPlatformTrainingCompleted` (query):**
    *   Guard: `org:caregiver` | `org:candidate`.
    *   Logic: Check existence of row in `platformTrainingCompletions` for user. Return boolean.
*   **`resetPlatformTraining` (mutation):**
    *   Guard: `org:admin`.
    *   Logic: Delete `platformTrainingCompletions` row for target `clerkUserId`.

### D. Tests (`convex/candidates.test.ts`, `convex/onboarding.test.ts`)
*   Use `convex-test` harness.
*   Mock `invitations` and `adpSyncWorker` where side effects need verification.
*   Implement the 16 specific test cases listed in the task (e.g., "inviteCandidate blocked for org:caregiver").

## 5. Data/Auth/Security Edge Cases
1.  **Multi-Tenancy Leak:** Ensure every query includes `tenantId` filtering. Never query `candidates` by `candidateId` alone without verifying the caller's tenant matches the candidate's tenant.
2.  **Role Escalation:** `hireCandidate` grants `org:caregiver`. Ensure this doesn't inadvertently grant `org:admin`. Verify `tenantMembers` upsert logic strictly sets the role.
3.  **PHI/PII:** Candidate data (phone, email) is sensitive. Ensure logs/audits do not plaintext log PII unless necessary for compliance.
4.  **Race Conditions:**
    *   `acceptOffer` vs `rejectOffer`: Use Convex transactionality. If status changes mid-transaction, fail gracefully.
    *   `completePlatformTraining`: Idempotency key or simple upsert prevents double-counting compliance.
5.  **Orphaned Tasks:** When `hireCandidate` runs, ensure remaining open `candidateTasks` are either closed or marked irrelevant so the new employee isn't blocked by candidate-era tasks. (Task implies status change is sufficient, but worth noting).
6.  **ADP Sync Failure:** If `adpSyncWorker` fails, `employeeProfiles.adpSyncStatus` should reflect `failed` eventually (handled by worker retry logic, but initial state is `pending_credentials`).

## 6. Test Strategy
**Unit/Integration (Convex Test Harness):**
*   **Auth Guards:** Test each function with a user context lacking the required role (expect 403).
*   **Tenant Isolation:** Create Candidate A in Tenant 1. Login as Admin in Tenant 2. Attempt `getCandidateDetail` (expect empty or error).
*   **State Machines:**
    *   Invite -> Tasks Created (Count = 5).
    *   Submit App -> Task `form_submission` Completed.
    *   Hire -> `tenantMembers` created + `adpSyncWorker` scheduled.
*   **Idempotency:** Call `completePlatformTraining` twice. Verify only one record exists or timestamp updates without error.
*   **Training Gate:** Verify `hasPlatformTrainingCompleted` returns `false` initially, `true` after mutation.

**Broad Gates:**
*   `npm run lint`: Enforce single quotes, no semicolons.
*   `npm run typecheck`: Ensure Convex generated types match usage.
*   `npm test`: All Vitest suites pass.

## 7. Rollback & Verification
1.  **Verification:**
    *   Run `npx convex codegen` immediately after editing `schema.ts` or function signatures.
    *   Run `npm run test` locally before pushing.
    *   Check Convex Dashboard for function deployment success.
2.  **Rollback:**
    *   Git revert the commit containing `convex/candidates.ts`, `convex/onboarding.ts`, and schema changes.
    *   Run `npx convex codegen` to regenerate types to pre-change state.
    *   If schema changed (new tables), note that existing data in new tables will be lost on revert (acceptable for new feature branch).
3.  **Post-Deploy:**
    *   Smoke test: Invite a candidate via admin dashboard (if UI exists) or via Convex Dashboard UI.
    *   Verify Clerk invitation email is received.
    *   Verify ADP sync action triggers in logs upon hire.

---
**Note to Implementer:** Adhere strictly to the 2-space indent and single-quote style. When in doubt about schema field names, check `convex/schema.ts` first. If a table is missing, define it minimally to support the function requirements. Ensure `authHelpers` is imported correctly from the existing path.