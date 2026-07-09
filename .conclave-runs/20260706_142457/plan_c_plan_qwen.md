# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Session 7 — HR Screens & Worker Onboarding

## 1. Restated Goal & Acceptance Criteria

**Goal:** Implement the HR module for Atria-X, enabling agencies to manage candidate pipelines, convert candidates to employees, and track HR cases. All UI must match provided Figma specs pixel-perfectly. Backend mutations must enforce multi-tenancy and role-based access.

**Acceptance Criteria:**
- **AC-1 (Routes):** All 7 pages accessible via defined routes (`/hr`, `/hr/candidates`, `/hr/candidates/:id`, `/hr/candidates/:id/hire`, `/hr/employees`, `/hr/employees/:id`, `/hr/cases`).
- **AC-2 (UI Fidelity):** Components match `hr-dashboard.png` through `hr-cases.png` specs (Tailwind4, 2-space indent, single quotes, no semis).
- **AC-3 (Backend):** Convex functions `createHrCase`, `listHrCases`, `updateHrCase`, `hireCandidate` implemented in correct files. `reviewApplication` extended.
- **AC-4 (Auth & Tenancy):** All Convex functions use `authHelpers` to scope data to `orgId`. Roles `org:admin` and `org:coordinator` allowed for HR actions; `org:caregiver` restricted.
- **AC-5 (Navigation):** Sidebar updated with HR section; Router configured for nested HR layouts if applicable.
- **AC-6 (Gates):** `lint`, `typecheck`, `test`, `build` pass locally. `npx convex codegen` run after backend changes.
- **AC-7 (Modals):** `InviteCandidateModal` and `NewCaseModal` functional with form validation and error states.

## 2. Discovery Notes

**Limitation Statement:** I am a chat-only model and **cannot access the local filesystem** at `C:\Users\pinol\Documents\Work\atriax\solid-pancake`. I cannot verify existing file structures, exact component exports in `src/shared/ui/*`, or current Convex schema definitions. I am reasoning from the provided project context (Atria-X stack) and standard conventions.

**Inferred Contracts & Seams:**
- **Auth:** Clerk organization integration expected. `useOrganization` hook likely available.
- **Convex:** `authHelpers` pattern established in previous sessions (Session 1-6). Functions likely exported from `convex/_generated/api`.
- **UI Library:** `src/shared/ui/*` likely contains `Button`, `Input`, `Card`, `Table`, `Modal` primitives using `cn` helper.
- **Data Models:**
  - `candidates` table: status (`applied`, `reviewing`, `hired`, `rejected`), `orgId`.
  - `employees` table: linked to `users` or `candidates`, `orgId`.
  - `hrCases` table: `title`, `description`, `status`, `assignedTo`, `orgId`.
- **Routing:** React Router 7 `createFileRouting` or standard `createBrowserRouter` based on Vite8 setup.

## 3. Alternatives Considered

| Approach | Why Rejected/Chosen |
| :--- | :--- |
| **Single HR Page vs. Multiple Routes** | **Chosen:** Multiple routes (`/hr/candidates`, `/hr/employees`). Better UX for deep linking (e.g., sharing a candidate profile) and matches Figma spec. |
| **Convex Actions vs. Mutations** | **Chosen:** Mutations for `hireCandidate` and `createHrCase`. Actions are for external APIs. State changes must be transactional mutations. |
| **Global State (Zustand) vs. Convex Realtime** | **Chosen:** Convex realtime subscriptions for lists (candidates, cases). Reduces boilerplate and ensures data consistency. |
| **Hardcoded Roles vs. Clerk Permissions** | **Chosen:** Clerk organization roles (`org:admin`). Centralized auth management, aligns with existing `authHelpers`. |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/features/hr/` | Create | Directory structure for HR feature module. |
| `src/features/hr/pages/HRDashboardPage.tsx` | Create | Summary stats, quick actions, recent cases. |
| `src/features/hr/pages/CandidatePipelinePage.tsx` | Create | Table/List of candidates with status filters. |
| `src/features/hr/pages/ApplicationReviewPage.tsx` | Create | Detail view, application docs, `reviewApplication` form. |
| `src/features/hr/pages/HireConvertPage.tsx` | Create | Form to map candidate data to employee record. |
| `src/features/hr/pages/EmployeesPage.tsx` | Create | Directory of current staff, status filters. |
| `src/features/hr/pages/EmployeeProfilePage.tsx` | Create | Detail view, employment history, cases linked. |
| `src/features/hr/pages/HRCasesPage.tsx` | Create | List of HR tickets/cases, status board. |
| `src/features/hr/components/InviteCandidateModal.tsx` | Create | Form to send invite email/link to candidate. |
| `src/features/hr/components/NewCaseModal.tsx` | Create | Form to create HR case (type, priority, description). |
| `convex/hrCases.ts` | Create | `createHrCase`, `listHrCases`, `updateHrCase` mutations/queries. |
| `convex/candidates.ts` | Modify | Add `hireCandidate` mutation; extend `reviewApplication` signature. |
| `convex/schema.ts` | Modify | Add `hrCases` table definition (if not existing). |
| `src/router.tsx` (or equivalent) | Modify | Add HR route tree. |
| `src/shared/layout/Sidebar.tsx` | Modify | Add HR navigation links (visible to Admin/Coordinator). |
| `src/shared/lib/cn.ts` | Verify | Ensure utility exists for Tailwind merging. |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases

- **Multi-Tenancy (Critical):** Every Convex query/mutation in `hrCases.ts` and `candidates.ts` must extract `orgId` from `ctx.auth` and filter by it. Never trust client-side `orgId` inputs.
  - *Pattern:* `const identity = await authHelpers.getUserIdentity(ctx);`
- **Role Guards:**
  - `hireCandidate`: Only `org:admin` or `org:coordinator`.
  - `viewEmployees`: All roles (maybe), but `edit` restricted.
  - *Implementation:* Check `identity.role` inside Convex functions.
- **PHI/Privacy:** Candidate data may contain sensitive info. Ensure logs do not capture PII. Convex logs are internal, but avoid `console.log` of full objects.
- **Idempotency:** `hireCandidate` must check current status. If already `hired`, return error or no-op. Prevent double-employee creation.
- **Concurrency:** Two admins reviewing same candidate. Optimistic UI updates with Convex realtime should handle conflict resolution (last write wins or version check).
- **Orphaned Data:** If candidate is hired, ensure candidate record links to employee record correctly without data loss.

## 6. Test Strategy

**Unit Tests (Vitest):**
- `src/features/hr/components/NewCaseModal.test.tsx`: Validate form submission, error states, required fields.
- `src/features/hr/components/InviteCandidateModal.test.tsx`: Validate email format, org context injection.

**Integration Tests (Convex + Testing Library):**
- `convex/hrCases.test.ts`:
  - Verify `listHrCases` returns only cases for `orgId`.
  - Verify `createHrCase` fails without auth.
  - Verify `hireCandidate` transitions status correctly.

**E2E Tests (Playwright):**
- `tests/hr-pipeline.spec.ts`:
  - Login as Admin → Navigate to `/hr/candidates` → Review Application → Hire → Verify redirect to `/hr/employees`.
  - Login as Caregiver → Verify HR nav hidden or access denied.
  - Create HR Case → Verify appearance in `/hr/cases`.

**Gate Commands:**
```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx convex codegen
```

## 7. Rollback / Verification Notes

- **Rollback:**
  - Git revert commit on `feature/phase-2-worker-onboarding`.
  - Convex functions are additive/modifyable; reverting code reverts logic. No destructive DB migrations expected (schema additions are safe).
  - If `hireCandidate` created duplicate employees, manual cleanup in Convex Dashboard may be required.
- **Verification:**
  - Check Convex Dashboard for `hrCases` table population.
  - Verify Clerk role propagation in local dev (use `clerk dev` or test users).
  - Confirm Tailwind4 purging works (no unused styles bloating build).
  - **Diego Cost Check:** Ensure no unnecessary external API calls (OpenRouter) triggered by this FE work. All logic stays within Convex/Client.

---
**Next Step:** Assign to implementation agent (Codex/Claude) with strict instruction to run `npx convex codegen` after backend edits and verify `authHelpers` usage in every Convex function.