# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260706_142457\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 210.6s rc=0

• # Session 7 — HR Screens Implementation Plan

  **Branch:** `feature/phase-2-worker-onboarding`  
  **Scope:** Frontend HR pages/modals + supporting Convex mutations/queries for candidate pipeline and employee management.

  ---

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Implement the HR section of ATRIA-X so that `org:admin` and `org:hr` users can manage candidates from invitation through hire, view employees, and track HR cases. The UI must match the Figma exports in `.conclave-runs/20260706_142326`, use the existing `src/shared/ui/*` design system, pass lint/typecheck/test/build, and keep every backend call behind the tenant/role guards.

  ### Acceptance Criteria

  - **AC-1 Routing & guards** — The following routes exist inside `AppShell`, each wrapped in `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}` and `RouteSuspense`:
    - `/hr`
    - `/hr/candidates`
    - `/hr/candidates/:candidateId`
    - `/hr/candidates/:candidateId/hire`
    - `/hr/employees`
    - `/hr/employees/:memberId`
    - `/hr/cases`

  - **AC-2 Sidebar navigation** — `Sidebar.tsx` shows `Candidates`, `Employees`, and `Cases` for `org:admin` and `org:hr`, using the existing icon style (`Users`, `Building2`, `ClipboardCheck`) and active state.

  - **AC-3 HR dashboard** — `HRDashboardPage` renders:
    - Title `People & hiring` with the spec subtitle.
    - Four `KpiCard`s: “In pipeline”, “Active employees”, “Expiring credentials” (hard-coded `0`), “Open cases”.
    - A `Candidate pipeline` card listing the top 3 newest pending candidates with avatar, name, status badge, invited date, and `Review →` link.
    - An `Invite candidate` primary button that opens `InviteCandidateModal`.

  - **AC-4 Invite candidate modal** — `InviteCandidateModal` is a dialog with validated `displayName` (required), `email` (required), `phone` (optional), calls `api.candidates.inviteCandidate`, shows a success toast, closes, and refreshes dashboard counts.

  - **AC-5 Candidate pipeline page** — `CandidatePipelinePage` renders the title/subtitle, filter tabs (`All`, `In progress`, `Review needed`, `Hired`), and a table with columns NAME, EMAIL, INVITED, STATUS, TASKS, ACTIONS. Each row links to the application review page.

  - **AC-6 Status badges** — Candidate statuses are mapped to badge colors/labels consistent with the Figma spec (e.g. `invited` → neutral/New, `application_draft` → amber/Docs pending, `hr_review` → info/Screening, `offer_sent` → info/Offer, `accepted`/`hired` → success, `rejected` → danger).

  - **AC-7 Application review page** — `ApplicationReviewPage` renders the back link, candidate header, application details, documents submitted, recruiter notes textarea, and the `Your decision` panel with:
    - `Advance to next stage` (disabled until all candidate tasks are complete/waived, then calls `sendOffer`).
    - `Request a correction` (requires `hrNotes`, calls `reviewApplication` with `decision:'needs_correction'`).
    - `Reject application` (confirmation dialog, calls `reviewApplication` with `decision:'reject'`).
    - Success toast after each action.

  - **AC-8 Backend review correction** — `convex/candidates.ts` `reviewApplication` accepts `decision:'needs_correction'`, updates the candidate status to `application_draft`, records `hrNotes`, and writes an audit event. The `applications.decision` schema union is widened to include `needs_correction`.

  - **AC-9 Hire convert page** — `HireConvertPage` renders the back link, candidate profile summary, new-employee-record form (auto-populated name/position, required start date, pay rate, supervisor), and a full-width `Confirm & hire` button that calls `hireCandidate`. On success it toasts and navigates to `/hr/employees`; on error it shows inline error.

  - **AC-10 Employees page** — `EmployeesPage` renders a table with NAME, EMAIL, ADP SYNC STATUS, ACTIONS, where each row links to the employee profile.

  - **AC-11 Employee profile page** — `EmployeeProfilePage` renders the header (avatar, name, role, start date, ADP status, Active badge) and tabs `Profile`, `Documents`, `Cases`. Profile shows available personal info; Documents lists `documentArchiveItems` for the employee; Cases lists `hrCases` for the employee.

  - **AC-12 HR cases page & modal** — `HRCasesPage` renders title/subtitle, cases table (SUBJECT, KIND, STATUS, ASSIGNED, CREATED, ACTIONS), and a `New case` button. `NewCaseModal` captures title/description/kind/subject and calls `createHrCase`.

  - **AC-13 Backend HR cases** — New `convex/hrCases.ts` exposes `createHrCase`, `listHrCases`, and `updateHrCase`, all guarded to `org:admin`/`org:hr`, tenant-isolated, and resolving subject/owner display names.

  - **AC-14 Quality gates** — `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all pass.

  - **AC-15 Tests** — Existing tests still pass; new unit/integration tests cover HR backend mutations, route/sidebar changes, and the new page components.

  ---

  ## 2. Discovery Notes

  I inspected the actual repo files. Verified contracts and seams:

  - **Router / shell**
    - `src/app/router.tsx` uses `lazy()` imports, `AppShell`, `TenantRoleRouteGuard`, and a local `RouteSuspense`. All new routes follow the same pattern.
    - `src/app/shell/RouteGuard.tsx` already lists `org:hr` in `TenantRole`; `TenantRoleRouteGuard` redirects disallowed roles.
    - `src/app/shell/Sidebar.tsx` builds nav from a `navItems: NavItem[]` array filtered by `member.role`. Icons are `lucide-react`, active class `bg-white/10 text-white`.

  - **Shared UI**
    - `src/shared/ui/index.ts` exports `Button`, `Card*`, `Dialog*`, `Input`, `Textarea`, `Select`, `Table*`, `StatusBadge`, `KpiCard`, `FieldGroup`, `EmptyState`, `Badge`, `Toast`.
    - `cn` is exported from `src/shared/lib/cn` (re-exports `src/shared/utils/cn`).
    - `StatusBadge` currently types `status` as `ShiftStatus` but already accepts explicit `variant` + `children`, so candidate/case badges can reuse it without a type change by passing `variant` and label text.
    - `KpiCard` currently has fixed value styling; a non-breaking `valueClassName`/`trend` extension will be needed for the colored dashboard KPIs.

  - **Backend**
    - `convex/schema.ts` defines `candidates`, `applications`, `candidateTasks`, `employeeProfiles`, `tenantMembers`, `documentArchiveItems`, and `hrCases`. `applications.decision` is `v.union(v.literal('approved'), v.literal('rejected'))`. `employeeProfiles` has no `tenantMemberId` index.
    - `convex/candidates.ts` already has `inviteCandidate` (action), `listCandidates`, `getCandidateDetail`, `reviewApplication`, `sendOffer`, `acceptOffer`, `rejectOffer`, and `hireCandidate`. `hireCandidate` creates/reuses `tenantMember` + `employeeProfile`, sets `adpSyncStatus:'pending_credentials'`, and schedules ADP sync. It matches the hire-convert backend requirement.
    - `convex/employeeProfiles.ts` has `createCaregiverProfile` (internal), `listEmployeeProfiles` (currently `org:admin` only), and `ensureCaregiverEmployeeProfile`.
    - `convex/members.ts` has `me`, `list`, `listCaregivers`, `updateRole`.
    - `convex/documentArchive.ts` has `listDocumentArchive` (org:admin/org:hr) with `linkedTo` filter by `subjectType`/`subjectId`.
    - `convex/authHelpers.ts` provides `requireTenantRole`, `assertTenantDoc`, `requireTenantRoleAction`, and `TenantRole` union including `org:hr`.

  - **Tests**
    - `convex/candidates.test.ts` uses `convex-test`, has `asAdmin`, `asHR`, `asCandidate`, `seedTenant`, `seedHR` helpers, and covers invite/review/hire lifecycle.
    - `src/app/router.test.tsx` mocks Clerk/Convex and asserts routes render for allowed roles.
    - `src/app/shell/Sidebar.test.tsx` mocks `useOrganization`, `useUser`, and `useQuery`.

  - **Build / commands**
    - `package.json`: `lint` → `eslint .`, `typecheck` → `tsc -b`, `test` → `vitest run --configLoader native`, `build` → `tsc -b && vite build --configLoader native`.
    - Backend changes require `npx convex codegen` before typecheck/build.

  ---

  ## 3. Alternatives Considered

  | Alternative | Why rejected |
  |---|---|
  | Add a dedicated `CandidateStatusBadge` component instead of reusing `StatusBadge` | `StatusBadge` already accepts `variant` + `children`; adding a parallel component duplicates styling and diverges from the “map idioms to `src/shared/ui/*`” instruction. A small feature-specific mapping helper is enough. |
  | Compute dashboard counts entirely on the client from `listCandidates`/`listEmployeeProfiles`/`listHrCases` | Works for small tenants but causes unnecessary data transfer. Chosen compromise: reuse the existing list queries for the pipeline/employees/cases pages, but add a lightweight `hrDashboardStats` aggregation query for the dashboard KPIs. |
  | Extend `hireCandidate` to persist start date, pay rate, and supervisor in new schema columns | Schema changes expand the blast radius and are not required by the task text (“keep the fields but mark auto-populated or optional if backend not ready”). Chosen approach: add the fields as optional args to `hireCandidate` and store them inside `application.fields` under a `hiringDetails` key, preserving backward compatibility and avoiding schema changes. |
  | Implement a global toast context | No existing global toast system; adding one is out of scope. Chosen approach: local toast state in each HR page/modal using the existing `Toast` component, which keeps changes surgical. |
  | Use `employeeProfile._id` as the employee-profile route param instead of `tenantMember._id` | The task explicitly says `/hr/employees/:memberId` and the Figma header derives the start date from the member. Chosen approach: use `tenantMember._id` and add a `by_tenant_member` index on `employeeProfiles`. |

  ---

  ## 4. Files to Create / Modify

  | File | Change type | What changes |
  |---|---|---|
  | `src/features/hr/pages/HRDashboardPage.tsx` | Create | Dashboard layout, KPI grid, candidate pipeline card, invite button. |
  | `src/features/hr/pages/CandidatePipelinePage.tsx` | Create | Filter tabs, candidates table, status/task display. |
  | `src/features/hr/pages/ApplicationReviewPage.tsx` | Create | Back link, candidate header, application details, documents, notes, decision panel. |
  | `src/features/hr/pages/HireConvertPage.tsx` | Create | Candidate summary, new-employee-record form, confirm hire action. |
  | `src/features/hr/pages/EmployeesPage.tsx` | Create | Employees table with ADP status and links to profile. |
  | `src/features/hr/pages/EmployeeProfilePage.tsx` | Create | Header, Profile/Documents/Cases tabs. |
  | `src/features/hr/pages/HRCasesPage.tsx` | Create | Cases table, new-case button. |
  | `src/features/hr/components/InviteCandidateModal.tsx` | Create | Dialog form for inviting a candidate. |
  | `src/features/hr/components/NewCaseModal.tsx` | Create | Dialog form for creating an HR case. |
  | `src/features/hr/components/HrToast.tsx` | Create | Small reusable local-toast wrapper using `Toast`. |
  | `src/features/hr/lib/candidateStatus.ts` | Create | Status → `{variant, label}` mapping for candidates. |
  | `src/features/hr/lib/adpStatus.ts` | Create | ADP sync status → `{variant, label}` mapping. |
  | `src/features/hr/hooks/useHrToast.ts` | Create | Local toast state hook shared across HR pages. |
  | `convex/hrCases.ts` | Create | `createHrCase`, `listHrCases`, `updateHrCase`, `hrDashboardStats` (or split stats into `convex/hr.ts`). |
  | `convex/hrCases.test.ts` | Create | Backend tests for case CRUD and guards. |
  | `src/features/hr/pages/*.test.tsx` | Create | Component tests for each page and the two modals. |
  | `src/app/router.tsx` | Modify | Add lazy imports and `/hr/*` routes inside `AppShell` with role guard and `RouteSuspense`. |
  | `src/app/shell/Sidebar.tsx` | Modify | Add `Candidates`, `Employees`, `Cases` nav items for `org:admin`/`org:hr`. |
  | `convex/schema.ts` | Modify | Add `needs_correction` to `applications.decision` union; add `by_tenant_member` index on `employeeProfiles`. |
  | `convex/candidates.ts` | Modify | Extend `reviewApplication` args/handler for `decision:'needs_correction'`; add optional `startDate`/`payRate`/`supervisor` to `hireCandidate` args and store them in `application.fields.hiringDetails`. |
  | `convex/employeeProfiles.ts` | Modify | Add `getEmployeeProfileDetail` query; update `listEmployeeProfiles` to allow `org:hr`; add `listSupervisors` helper if not reusing `members.list`. |
  | `convex/members.ts` | Modify | Optionally extend `list` roles to include `org:hr` for supervisor selection. |
  | `src/shared/ui/KpiCard.tsx` | Modify | Add optional `valueClassName` and `trend` props without breaking existing usage. |
  | `src/app/router.test.tsx` | Modify | Add HR route render/redirect tests. |
  | `src/app/shell/Sidebar.test.tsx` | Modify | Add HR nav visibility tests for `org:hr`. |
  | `convex/candidates.test.ts` | Modify | Add test for `reviewApplication` with `needs_correction`. |
  | `convex/_generated/*` | Generated | Run `npx convex codegen` after schema/backend edits. |

  ---

  ## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

  - **Tenant isolation** — Every new query/mutation must call `requireTenantRole(ctx, clerkOrgId, ['org:admin','org:hr'])` and `assertTenantDoc(doc, tenantId)` before reading or mutating any candidate, employee profile, document, or case.
  - **Role enforcement** — All `/hr/*` UI routes use `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}`. Sidebar only shows HR items to those roles.
  - **Candidate status guards** — `reviewApplication` must reject decisions when the candidate is not in `applied`/`hr_review`/`application_draft`. `sendOffer` requires `hr_review`. `hireCandidate` requires `accepted` and a linked `clerkUserId`.
  - **Idempotency**
    - `inviteCandidate` already handles duplicate e-mails by returning the existing invitation.
    - `hireCandidate` already reuses existing `tenantMember` and `employeeProfiles` rows by `clerkUserId` or email.
    - `createHrCase` does not need strict idempotency for this session, but should set `ownerMemberId` to the acting HR member so duplicates are traceable and closable.
  - **PHI / PII**
    - The Figma profile tab shows DOB, SSN, and pay rate. The current schema does **not** store these fields. For Phase 2, display only the fields that exist (`displayName`, `email`, `phone` from candidate/application, `tenantMember.createdAt`, `adpSyncStatus`). Do **not** add plaintext SSN/DOB columns without an explicit encryption/at-rest plan.
    - Case descriptions may contain sensitive employment data; keep them behind the `org:admin`/`org:hr` tenant guard and do not expose in public queries.
  - **Cross-tenant subject resolution** — `listHrCases` resolves subject names by looking up `employeeProfiles` or `candidates` only within the same `tenantId`.
  - **Optional hire fields** — `startDate`, `payRate`, and `supervisor` are optional in the mutation args and stored only inside `application.fields.hiringDetails` so the existing `hireCandidate` contract remains backward-compatible.

  ---

  ## 6. Test Strategy

  ### Backend tests (`convex/hrCases.test.ts` + updates to `convex/candidates.test.ts`)

  - `createHrCase` creates a case with correct `tenantId`, `subjectType`, `subjectId`, `category`, `status:'open'`, and `ownerMemberId`.
  - `listHrCases` returns only cases for the caller’s tenant, sorted newest-first, with resolved subject name and owner name.
  - `updateHrCase` allows `org:hr` to change status to `in_review`, `resolved`, or `closed`; blocks invalid status strings; blocks cross-tenant updates.
  - `reviewApplication` with `decision:'needs_correction'` sets candidate status to `application_draft`, records `hrNotes`, and updates application decision.
  - Existing `hireCandidate` lifecycle test continues to pass after adding optional args.

  ### Frontend tests

  - `Sidebar.test.tsx`: `org:hr` sees `Candidates`, `Employees`, `Cases`; `org:caregiver` does not.
  - `router.test.tsx`: `/hr/candidates` renders for `org:hr`; `/hr` redirects `org:caregiver` to `/caregiver/today`.
  - `HRDashboardPage.test.tsx`: renders 4 KPIs, candidate rows, and opens invite modal.
  - `InviteCandidateModal.test.tsx`: disables send when email/name empty, calls mutation, shows success toast.
  - `CandidatePipelinePage.test.tsx`: renders tabs and candidate rows; tab filtering works.
  - `ApplicationReviewPage.test.tsx`: advance button disabled with incomplete tasks; correction button disabled without notes.
  - `HireConvertPage.test.tsx`: calls `hireCandidate` and navigates on success.
  - `EmployeesPage.test.tsx`: renders employee rows with ADP status badge.
  - `EmployeeProfilePage.test.tsx`: switches tabs and renders documents/cases.
  - `HRCasesPage.test.tsx`: opens new-case modal and renders created case.

  ### Gate commands

  ```bash
  npx convex codegen
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  ```

  Run these in order; do not consider the task complete unless all four pass.

  ---

  ## 7. Rollback / Verification Notes

  - **Branch isolation** — Do all work on `feature/phase-2-worker-onboarding`. Commit after each logical unit (backend schema, backend mutations, shared UI tweaks, pages, tests).
  - **Generated files** — Never hand-edit `convex/_generated`. Always run `npx convex codegen` after schema or backend changes. If codegen produces unexpected diffs, revert `convex/_generated` and rerun.
  - **Visual verification** — Compare the running app against the exported PNGs in `.conclave-runs/20260706_142326`. Pay special attention to:
    - Dashboard KPI colors and value alignment.
    - Candidate pipeline status badge colors/labels.
    - Application review decision button order and disabled states.
    - Hire-convert form field styling.
  - **Rollback** — If gates fail:
    1. Revert the most recent commit.
    2. Re-run `npx convex codegen` if schema changed.
    3. Re-run `npm run lint && npm run typecheck && npm run test && npm run build`.
  - **Post-merge cleanup** — Remove any temporary toast wrappers or unused helper files if a global toast system is introduced later.

  ---

  **Verdict:** Proceed with implementation using the plan above. The backend core (`inviteCandidate`, `hireCandidate`, tenant guards) already exists and only needs `reviewApplication` widened for `needs_correction` plus the new `hrCases.ts` module. The frontend work is the bulk of the session: seven pages, two modals, router/sidebar wiring, and tests.


[stderr]
• The user wants me to read a prompt file and carry out the instructions. Let me read it first.The file is too long. I need to read it in chunks. Let me get the full content. I'll use the output_path to read more.I need to use path instead. Let me read the original file with n_lines.The tool says to use Read with output_path, but when I tried that it failed. Maybe I should use Bash to read the file in chunks, or use the Read tool with output_path as path. Wait - the instruction says "Use Read with output_path to page through the full output." but the Read tool schema requires 'path' not 'output_path'. Maybe the output_path from tool result can be used as path? Let me try that.The tool IDs don't match. The output_path showed tool ID "tool_frEMSuQkBA7FqhThX90Avpv" but the actual file ID in my previous message was "tool_frEMSuQkBA7FqhThX90Avpv" - wait, looking carefully: first result had "tool_616M39Tnx3ZKbBZraWrxyCIK" and second had "tool_frEMSuQkBA7FqhThX90Avpv". But in the preview the output_path line said "tool_frEMSuQkBA7FqhThX90Avpv" with an ID that doesn't match either exactly? Let me re-read.

  Actually first Read result output_path was: `Read-tool_616M39Tnx3ZKbBZraWrxyCIK-340ddb8c-fdfe-41f2-b458-7a9c51e398c3.txt`
  Second Read result output_path was: `Read-tool_frEMSuQkBA7FqhThX90Avpv-e258dfdd-6d15-4117-8074-b41529b3994b.txt`

  I misread. Let me use the correct one.Strange. Maybe I should use Bash with head/tail to read the file, but instructions say use Read for known paths. Actually the file is a known path, but Read tool has a 50k char limit. The file is 74KB. Let me use Bash to read it with `cat` into a smaller display? No, the instructions prefer Read. But Read truncates. Let me try reading the original file with smaller n_lines to see if that avoids truncation? The preview said 74608 chars. With n_lines=1000 it still exceeds 50k. Let me try n_lines=500 or use line ranges.500 lines is still too much. Let me try 300 lines.OK so the prompt file contains the original instructions plus candidate plans. I need to read more. Lines 301-688.Now I have the full prompt file content. It contains:
  - Instructions to produce a premium implementation plan with 7 sections
  - Three candidate plans: c_plan_agentic (detailed, based on actual repo inspection), c_plan_qwen (chat-only, less accurate), c_plan_kimi27 (just instructions to itself)
  - It asks me to synthesize them into one coherent plan.

  I need to act as the principal/staff engineer and produce the final plan. Since this is a planning task, I need to follow the discovery requirement: "If your backend is an agentic CLI (kimi, codex, claude), you MUST open and read the actual relevant files before writing the plan — do not reason from the context description alone."

  I am Kimi, an agentic CLI. I need to read actual files. However, the c_plan_agentic candidate plan already did a lot of discovery and listed findings. But I should verify at least some key files myself to be accurate. I should not just trust the candidate plan. The prompt says I must open and read actual relevant files.

  So my task:
  1. Read key relevant files from the repo to verify the candidate plan's findings
  2. Synthesize the best plan
  3. Output the final plan markdown

  I should use tools to read files. Let me read:
  - Figma spec and maybe images
  - Router, Sidebar, RouteGuard
  - convex/schema.ts, candidates.ts, employeeProfiles.ts, members.ts, documentArchive.ts, authHelpers.ts
  - src/shared/ui components (StatusBadge, KpiCard, etc.)
  - package.json

  Then produce the plan. This is a planning task; I should not write code. But I need to verify by reading files. I'll do that.

  Let me start by reading the Figma spec and key files in parallel.I've read key files. I need to continue reading the remaining parts of candidates.ts (after line 1000), plus members.ts, documentArchive.ts, shared UI components. Let me do that.I have enough information. Let me also check existing test patterns and maybe the DashboardPage to see how KpiCard is used. But I think I have enough to write a comprehensive plan. Let me quickly read router.test.tsx, Sidebar.test.tsx, candidates.test.ts maybe first part, and DashboardPage for KpiCard usage.I have enough info. Let me also check Button, Card, Dialog, Table, Select, EmptyState, ProgressSteps to understand usage. But I can reference them. The plan doesn't need code details. Let me read DashboardPage rest to see local KpiCard usage and maybe format.ts.I have enough. Now I should write the synthesized implementation plan. I need to follow the prompt's requested structure:

  1. Restated goal and numbered acceptance criteria
  2. Discovery notes
  3. Alternatives considered
  4. Files to create/modify table
  5. Data/auth/security/multi-tenant/PHI/idempotency edge cases
  6. Test strategy
  7. Rollback/verification notes

  I should be precise and base it on actual file inspection. I should resolve conflicts between candidate plans:
  - Roles: org:admin and org:hr (not org:coordinator, though some candidate plans said coordinator). The Figma spec and code confirm org:hr.
  - hireCandidate already exists in candidates.ts, so no need to create from scratch; extend optionally for onboarding fields.
  - employeeProfiles.listEmployeeProfiles is admin-only; need to allow org:hr or create new query.
  - Schema: hrCases already exists. applications.decision needs needs_correction. employeeProfiles needs index by tenantMemberId.
  - StatusBadge can be reused via variant+children without modification, but maybe we need to create feature-specific mapping helpers.
  - KpiCard shared component differs from local DashboardPage KpiCard. We should extend shared KpiCard with optional trend/valueClassName or use Card locally. The Figma spec says "reuse KpiCard". The shared KpiCard has label/value/detail/icon. We can extend it with optional `valueClassName` and `trend` to support colored values. Or use the shared one with detail as trend. The plan should recommend minimal extension.
  - Toast: no global toast. Use local state + Toast component. Create a reusable `useHrToast` hook.
  - Candidate status mapping ambiguity: Figma text vs spec text. I should note the conflict and propose resolution.
  - Tabs ambiguity: spec says All/In progress/Review needed/Hired; Figma image shows All/New/Screening/Offer/Hired. Note and choose text spec as baseline with possible Figma alignment.
  - Employee profile fields: schema lacks DOB/SSN/payRate/etc. Display only available fields and note Phase 3.

  I should not write code. Keep plan focused.

  Let me craft the final plan now.

To resume this session: kimi -r session_7018d8ad-45b2-4418-9ce2-13beaad487fa
