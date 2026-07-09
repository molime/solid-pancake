# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260706_142457\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 418.9s rc=0

• # Session 7 — HR screens implementation plan
  **Branch:** `feature/phase-2-worker-onboarding`  
  **Scope:** Frontend HR pages/modals + supporting Convex mutations/queries for candidate pipeline and employee management.

  ---

  ## 1. Restated goal & acceptance criteria

  Implement the HR section of ATRIA-X so that `org:admin` and `org:hr` users can manage candidates from invitation through hire, view employees, and track HR cases. The UI must match the Figma exports in `.conclave-runs/20260706_142326`, use the existing `src/shared/ui/*` design system, pass lint/typecheck/test/build, and keep every backend call behind the tenant/role guards.

  ### Acceptance criteria

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

  ## 2. Discovery notes

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

  ## 3. Alternatives considered

  | Alternative | Why rejected |
  |---|---|
  | Add a dedicated `CandidateStatusBadge` component instead of reusing `StatusBadge` | `StatusBadge` already accepts `variant` + `children`; adding a parallel component duplicates styling and diverges from the “map idioms to `src/shared/ui/*`” instruction. A small feature-specific mapping helper is enough. |
  | Compute dashboard counts entirely on the client from `listCandidates`/`listEmployeeProfiles`/`listHrCases` | Works for small tenants but causes unnecessary data transfer. Chosen compromise: reuse the existing list queries for the pipeline/employees/cases pages, but add a lightweight `hrDashboardStats` aggregation query for the dashboard KPIs. |
  | Extend `hireCandidate` to persist start date, pay rate, and supervisor in new schema columns | Schema changes expand the blast radius and are not required by the task text (“keep the fields but mark auto-populated or optional if backend not ready”). Chosen approach: add the fields as optional args to `hireCandidate` and store them inside `application.fields` under a `hiringDetails` key, preserving backward compatibility and avoiding schema changes. |
  | Implement a global toast context | No existing global toast system; adding one is out of scope. Chosen approach: local toast state in each HR page/modal using the existing `Toast` component, which keeps changes surgical. |
  | Use `employeeProfile._id` as the employee-profile route param instead of `tenantMember._id` | The task explicitly says `/hr/employees/:memberId` and the Figma header derives the start date from the member. Chosen approach: use `tenantMember._id` and add a `by_tenant_member` index on `employeeProfiles`. |

  ---

  ## 4. Files to create / modify

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

  ## 5. Data / auth / security / multi-tenant / PHI / idempotency edge cases

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

  ## 6. Test strategy

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

  ## 7. Rollback / verification notes

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
• The user wants me to read a prompt file and carry out those instructions. Let me read the file first.The prompt asks me to act as a principal/staff engineer PLANNING a code change, not to implement it. I need to produce a premium implementation plan with 7 specific sections. I must first do discovery by reading actual relevant files.

  Let me start by exploring the repo structure and reading the relevant files: Figma spec, existing HR/candidates code, router, sidebar, shared UI components, convex functions, tests, etc.Good, I've read the Figma spec and images. Now I need to explore the repo to understand the actual files, schemas, shared UI, router, etc. Let me use an explore agent or do targeted reads. The discovery requirement says I must read actual relevant files.

  Let me explore the repo structure and read key files. I'll launch an explore agent to find relevant files, but I should also read some key files myself. Actually, I can use multiple parallel reads and greps.

  Key files to inspect:
  - src/app/App.tsx or router
  - src/shared/ui/* components
  - src/features directory structure
  - convex/candidates.ts
  - convex/schema.ts (or wherever schema is)
  - convex/employeeProfiles.ts or employees.ts
  - convex/authHelpers.ts
  - src/app/Sidebar.tsx or similar
  - src/shared/lib/cn.ts
  - package.json for scripts

  Let me start with broad exploration.Good, I have the structure. Now I need to read the key files. Let me read in parallel:
  - src/app/router.tsx
  - src/app/shell/Sidebar.tsx
  - src/app/shell/RouteGuard.tsx
  - convex/schema.ts
  - convex/candidates.ts
  - convex/employeeProfiles.ts
  - convex/authHelpers.ts
  - src/shared/ui/index.ts
  - src/shared/ui/StatusBadge.tsx
  - src/shared/ui/KpiCard.tsx
  - src/shared/ui/FieldGroup.tsx
  - src/shared/ui/Table.tsx
  - src/shared/ui/Dialog.tsx
  - src/shared/ui/Select.tsx
  - src/shared/ui/Button.tsx
  - src/shared/ui/Card.tsx
  - src/shared/lib/cn.ts

  That's a lot, but they should be relatively small. Let me batch them.Good. I see `hireCandidate` already exists in candidates.ts. I need to read the rest of candidates.ts and employeeProfiles.ts, authHelpers.ts, and the shared UI components. Let me continue.I notice FieldGroup imports from '@/shared/lib/cn' but StatusBadge imports from '@/shared/utils/cn'. Let me check both cn files exist. Also need to read Table, Dialog, Select, Button, Card, EmptyState, Toast, AppLoader, and formatStatusLabel. Also need to check existing tests for patterns.

  Let me also look at existing pages for patterns (DashboardPage, TeamPage, etc.) and candidates.test.ts. Let me read more files.formatStatusLabel is imported from '@/shared/format' but the file doesn't exist at index.ts. Let me find it.Wait, StatusBadge imports from '@/shared/format' but the file is src/shared/format.ts. That alias might not resolve. Actually it could be configured in tsconfig. But the ui/index.ts also doesn't export StatusBadge? Wait it does. But StatusBadge has a bug importing from non-existent path. Actually '@/shared/format' would resolve to src/shared/format.ts if the alias is set up. But the file is a .ts not .tsx. Anyway, the plan doesn't need to fix this. But I should note it.

  Now let me read format.ts and also read some existing pages for patterns. Also need to look at candidates.test.ts to understand backend testing patterns. Also need to check if there are existing hooks for useToast, etc. Let me read format.ts, DashboardPage, TeamPage, and candidates.test.ts, and maybe router.test.tsx and Sidebar.test.tsx.Excellent. I have a lot of context now. Let me also check:
  - members.ts for list queries that might be needed
  - documentArchive.ts for listing employee documents
  - convex/_generated/api.d.ts to understand API structure (but generated, so maybe skip)
  - src/app/shell/Sidebar.test.tsx for patterns
  - src/app/router.test.tsx for patterns
  - package.json for scripts and test commands
  - tsconfig.json for path aliases

  Also need to check if there are toast hooks. Let me search for useToast or toast usage.No toast hook exists. The plan should note that we'll use a simple local toast state or the existing Toast component. Let me also check the AppShell and Topbar to see if there's a toast container.I have enough context to produce the plan. Let me also quickly check tsconfig.app.json for path aliases and maybe look at one more existing page test pattern (e.g., ClientsPage.tsx is simple). But I think I have enough.

  Key findings:
  - `hireCandidate` already exists in candidates.ts and does what the task wants (creates employeeProfile, tenantMember, etc.)
  - `reviewApplication` needs to accept `needs_correction` decision
  - `hrCases.ts` doesn't exist; need to create it with createHrCase/listHrCases/updateHrCase
  - `employeeProfiles.listEmployeeProfiles` requires org:admin only; task wants org:admin/org:hr for Employees page. May need to extend roles or create a new query.
  - `documentArchive.listDocumentArchive` allows org:admin/org:hr and can filter by linkedTo subjectType/subjectId - good for Documents tab
  - Need queries for dashboard counts and employee profile detail. May need new queries/mutations.
  - Sidebar: navItems array; add HR items
  - Router: add /hr routes inside AppShell with TenantRoleRouteGuard
  - Shared UI: exists, but StatusBadge currently only accepts ShiftStatus. Plan should note extending StatusBadge to accept generic status/variant mapping or creating a dedicated CandidateStatusBadge/HrCaseStatusBadge. Since task says "reuse StatusBadge", we should extend it minimally.
  - No global toast hook; plan should include local toast state in pages/modals or a simple HR toast container.
  - KpiCard exists with a different signature than the local one in DashboardPage (which is a local KpiCard). The shared KpiCard has label/value/detail/icon. Figma spec says use KpiCard. The existing shared KpiCard doesn't have valueClass/trend. The dashboard page uses a local KpiCard with trend/valueClass. Plan should note: either extend shared KpiCard with optional valueClass/trend props, or use the existing shared KpiCard with detail. The spec wants 4 equal cards; use shared KpiCard.
  - EmployeeProfilePage: needs to show employee profile. `employeeProfiles` table doesn't have phone/address/DOB/SSN/payRate/employmentType fields. The task figma spec says "read-only personal info field groups (email, phone, address if available, DOB, SSN masked, pay rate, employment type)" but schema lacks these. The task description says "for this session implement all three tabs" - so we should display what exists and note that full profile fields are Phase 3 / schema extension. Actually the spec says "Profile tab: read-only personal info field groups (email, phone, address if available, DOB, SSN masked, pay rate, employment type)." But schema doesn't have these. We need a query `getEmployeeProfileDetail` that returns profile + member + maybe application/offer data. Since schema lacks these fields, we may need to add optional fields to employeeProfiles or applications. But the task says "extend reviewApplication" and "add hireCandidate" (already exists). For employee profile, maybe we just display what we have and note schema extension for Phase 3. However, the Figma shows specific data. The prompt says "Keep the plan focused on ONLY what the task requires." So we should note the schema gap and propose minimal placeholder/extension.

  Wait, the task description in the prompt says: "Also InviteCandidateModal and NewCaseModal components. Add createHrCase/listHrCases/updateHrCase in convex/hrCases.ts, extend reviewApplication to accept needs_correction, add hireCandidate mutation in candidates.ts." So `hireCandidate` addition is part of the task, but it already exists. The plan should note it exists and verify it meets the spec (it does, mostly). Maybe no change needed except ensuring it accepts the candidate.

  Actually the Figma hire-convert page shows fields: start date, pay rate, supervisor. The task spec says "minimal version from task: just the summary + target + note + confirm button. Keep the fields but mark auto-populated or optional if backend not ready." and "Calls `hireCandidate` mutation". The existing hireCandidate doesn't take startDate/payRate/supervisor. The plan should decide whether to extend hireCandidate args to accept these (optional) and store them, or just call existing hireCandidate and ignore fields for now. Since task says "minimal version" and backend not ready, safest is to keep existing hireCandidate and add optional args later. But the Figma shows required fields. Hmm.

  The task description says "add hireCandidate mutation in candidates.ts" - but it's already there. So the implementer may just verify it. The spec says "minimal version from task: just the summary + target + note + confirm button. Keep the fields but mark auto-populated or optional if backend not ready." So we can make the fields optional in UI and pass them if provided, but existing mutation ignores them. Or extend mutation to store them in application or employeeProfile. Since schema doesn't have these fields, storing would require schema change. Plan should note this trade-off.

  Let me re-read the exact task text: "add hireCandidate mutation in candidates.ts." So the task explicitly asks to add it. Since it already exists, the plan should note it's already implemented and meets the spec, possibly no change needed. But we must be careful: the spec says it should "create or reuse employeeProfile (call existing `employeeProfiles.createCaregiverProfile` internal)" but the existing hireCandidate doesn't call createCaregiverProfile; it inlines the logic. That may be okay. It does create employeeProfile and set adpSyncStatus pending_credentials. Good.

  Now, the plan needs 7 sections. Let me organize.

  I should also check `convex/_generated/api.d.ts` to see how api functions are typed, but generated. Not needed.

  Let me also see if there's a `src/shared/ui/AppLoader.tsx` for loading states.I now have comprehensive context. Time to write the plan. The prompt instructs: "Produce a premium implementation plan with ALL of the following sections... Do NOT write the full code. Keep the plan focused on ONLY what the task requires."

  The final answer/verdict is the plan itself. I should output it as markdown. The user said "Output your final answer/verdict as requested." The prompt requested the plan.

  Let me structure the plan carefully.

  Key points to include:
  1. Restated goal + numbered acceptance criteria.
  2. Discovery notes - files verified, function/type names.
  3. Alternatives considered.
  4. Files to create/modify table.
  5. Data/auth/security/multi-tenant/PHI/idempotency edge cases.
  6. Test strategy - specific cases and gate commands.
  7. Rollback / verification notes.

  Let me draft.

  Discovery notes:
  - Read figma-hr-spec.md and PNGs in .conclave-runs/20260706_142326.
  - Verified router: src/app/router.tsx uses lazy imports, AppShell, TenantRoleRouteGuard, RouteSuspense.
  - Verified Sidebar: src/app/shell/Sidebar.tsx navItems array filters by role.
  - Verified auth guards: TenantRoleRouteGuard in src/app/shell/RouteGuard.tsx supports 'org:hr'; authHelpers.ts has requireTenantRole.
  - Verified schema: candidates, applications, candidateTasks, employeeProfiles, tenantMembers, documentArchiveItems, hrCases tables. applications.decision is union approved/rejected only. hrCases exists with fields.
  - Verified candidates.ts: listCandidates, getCandidateDetail, inviteCandidate (action), reviewApplication, sendOffer, acceptOffer, hireCandidate already exist. hireCandidate creates tenantMember + employeeProfile + sets adpSyncStatus pending_credentials.
  - Verified employeeProfiles.ts: createCaregiverProfile internal, listEmployeeProfiles (admin only).
  - Verified documentArchive.ts: listDocumentArchive allows admin/hr and filters by linkedTo subjectType/subjectId.
  - Verified shared UI: src/shared/ui/index.ts exports Button, Card*, Dialog*, Input, Textarea, Select, Table*, StatusBadge, KpiCard, FieldGroup, EmptyState, Badge, Toast. cn is in src/shared/lib/cn. StatusBadge currently typed to ShiftStatus only.
  - Verified tests: convex/candidates.test.ts has asHR helper and tests for invite, review, hire. src/app/router.test.tsx and Sidebar.test.tsx patterns.
  - Verified package.json scripts: lint, typecheck, test, build.

  Acceptance criteria:
  - AC-1: Routes exist and guarded: /hr, /hr/candidates, /hr/candidates/:candidateId, /hr/candidates/:candidateId/hire, /hr/employees, /hr/employees/:memberId, /hr/cases. All inside AppShell with TenantRoleRouteGuard allowedRoles ['org:admin','org:hr'] and RouteSuspense.
  - AC-2: Sidebar shows Candidates, Employees, Cases for org:admin/org:hr under People & hiring (or appended), with correct icons and active states.
  - AC-3: HRDashboardPage matches Figma: title/subtitle, 4 KPIs (in pipeline, active employees, expiring credentials, open cases), Candidate pipeline card top 3 pending with Review links, Invite candidate button opens modal.
  - AC-4: InviteCandidateModal validates displayName/email, calls inviteCandidate action, toasts, closes, refreshes counts.
  - AC-5: CandidatePipelinePage matches Figma: title/subtitle, filter tabs, table with status badges and Review links.
  - AC-6: StatusBadge extended or candidate statuses mapped; badges match spec colors/labels.
  - AC-7: ApplicationReviewPage matches Figma: back link, header, application details, documents, recruiter notes, decision panel with advance/request correction/reject. Advance disabled until tasks complete. Confirmation dialogs.
  - AC-8: reviewApplication accepts needs_correction, sets candidate status to application_draft (or hr_review per spec) and application status accordingly.
  - AC-9: HireConvertPage matches Figma: back link, candidate profile, new employee record form, Confirm & hire calls hireCandidate, navigates to /hr/employees on success.
  - AC-10: EmployeesPage matches Figma: table with name/email/adp sync status/actions.
  - AC-11: EmployeeProfilePage matches Figma: header, tabs (Profile/Documents/Cases), Profile tab shows available fields, Documents uses documentArchive, Cases uses hrCases.
  - AC-12: HRCasesPage matches Figma: title/subtitle, table, New case button opens NewCaseModal, create/list/update mutations work.
  - AC-13: Backend hrCases.ts created with createHrCase, listHrCases, updateHrCase guarded org:admin/org:hr, tenant-isolated.
  - AC-14: lint, typecheck, test, build pass.
  - AC-15: Existing tests still pass; new tests added for HR backend and UI as specified.

  Files to create/modify:
  Create:
  - src/features/hr/pages/HRDashboardPage.tsx
  - src/features/hr/pages/CandidatePipelinePage.tsx
  - src/features/hr/pages/ApplicationReviewPage.tsx
  - src/features/hr/pages/HireConvertPage.tsx
  - src/features/hr/pages/EmployeesPage.tsx
  - src/features/hr/pages/EmployeeProfilePage.tsx
  - src/features/hr/pages/HRCasesPage.tsx
  - src/features/hr/components/InviteCandidateModal.tsx
  - src/features/hr/components/NewCaseModal.tsx
  - src/features/hr/components/HRToast.tsx (optional)
  - convex/hrCases.ts
  - src/features/hr/pages/__tests__/*.test.tsx (or co-located .test.tsx)
  - convex/hrCases.test.ts

  Modify:
  - src/app/router.tsx: add hr routes
  - src/app/shell/Sidebar.tsx: add hr nav items
  - convex/candidates.ts: extend reviewApplication decision union to include needs_correction; set status application_draft or hr_review. Also note hireCandidate exists and verify.
  - convex/employeeProfiles.ts: add getEmployeeProfileDetail query (org:admin/org:hr), update listEmployeeProfiles to allow org:hr, or add listEmployeeProfilesForHr.
  - convex/members.ts: maybe add getMemberById query for employee profile header (or use employeeProfiles detail). Actually EmployeeProfilePage route param is :memberId (tenantMember id). Need query to get member by id and profile. Add getTenantMember query or extend employeeProfiles.
  - src/shared/ui/StatusBadge.tsx: extend to accept string status with variant override, or candidate-specific mapping. Or create separate CandidateStatusBadge. Since task says use StatusBadge, extend minimally.
  - convex/_generated/*: run npx convex codegen after backend changes.

  Wait, the task says "extend reviewApplication to accept needs_correction". The schema applications.decision currently union approved/rejected. reviewApplication args use v.union literal approved/rejected. We need to change both schema and mutation. For needs_correction, what status to set? Spec says "set candidate status to application_draft (or keep applied) and application status accordingly." The Figma note says "Update candidates.ts reviewApplication decision union to include needs_correction and set candidate status to application_draft (or keep applied) and application status accordingly." But candidate status enum in code doesn't include application_draft; it has 'applied', 'hr_review', etc. The Figma spec in section 3 says status application_draft maps to amber/warning label "Draft". But candidates.ts CANDIDATE_STATUS type doesn't include application_draft. Wait:

  type CandidateStatus = 'invited' | 'applied' | 'hr_review' | 'rejected' | 'offer_sent' | 'accepted' | 'hired' | 'withdrawn'

  But figma-hr-spec section 3 says statusBadge mapping includes 'application_draft'. Hmm. There's a mismatch. The task prompt says "extend reviewApplication to accept needs_correction". The Figma spec says set candidate status to application_draft. But the existing type doesn't include application_draft. The schema candidates.status is v.string(), so any string allowed. But CANDIDATE_STATUS type and TERMINAL_STATUSES etc. would need update.

  The prompt line 23 says: "Roles: org:admin, org:coordinator, org:caregiver." But HR role exists. That's just context. The task explicitly says allowedRoles ['org:admin','org:hr'].

  For application_draft: we should add it to CandidateStatus union and use it for needs_correction. The Figma candidate pipeline shows "Docs pending" status which maps to application_draft? Actually the mapping says application_draft → amber label "Draft". The pipeline screenshot shows "Docs pending" amber. So application_draft label should maybe be "Docs pending". The spec says "application_draft → amber / warning label 'Draft'". But the screenshot shows "Docs pending". Hmm. We need to reconcile. The task says implement pixel-faithful to Figma. So maybe application_draft label should be "Docs pending". But the spec text says "Draft". Since Figma is source of truth for visual, use "Docs pending" for application_draft? But that contradicts the written spec. The plan can note: map application_draft to amber badge, display label "Docs pending" to match Figma (or "Draft" if spec text is binding). This is a potential ambiguity. Since the task says "pixel-faithful to Figma", prefer "Docs pending". I'll note it as a decision.

  Actually the status badge mapping in spec:
  - `invited` / `withdrawn` → gray / neutral
  - `application_draft` → amber / warning label "Draft"
  - `submitted` / `hr_review` → blue / info label "Submitted" / "Under review"
  - `offer_sent` → teal label "Offer sent"
  - `accepted` / `hired` → green label "Accepted" / "Hired"
  - `rejected` → red label "Rejected"

  But candidate statuses in code: invited, applied, hr_review, rejected, offer_sent, accepted, hired, withdrawn. There's no application_draft or submitted. Application has status 'submitted'. So the mapping may be conflating candidate and application statuses. We need to map candidate.status to badge:
  - invited → neutral label "New" (Figma shows "New" for new candidates)
  - applied → maybe "Submitted" / "Under review"? But Figma pipeline shows statuses: New, Screening, Docs pending, Offer. These don't align exactly. The Figma shows "Screening" for what might be hr_review. "Docs pending" for application_draft. "Offer" for offer_sent. "New" for invited/applied.

  The plan should be clear: implement a `candidateStatusDisplay` helper that maps candidate.status to badge variant/label per Figma. Need to handle the ambiguity. I'll include a table in the plan.

  For `reviewApplication` needs_correction: set candidate.status to 'application_draft' and application.status to 'needs_correction' or 'draft'. The schema application.status is v.string(), so okay. The application.decision field should include 'needs_correction' in union. But decision is optional and currently approved/rejected. We can add needs_correction to decision union. Or we can leave decision null and set status to 'needs_correction'. The spec says "calls reviewApplication with decision:'needs_correction'". So add needs_correction to decision union. Set candidate.status to 'application_draft' and application.status to 'needs_correction' or 'draft'. Also set hrNotes. The plan should specify.

  For idempotency: reviewApplication should probably guard against re-reviewing terminal statuses. Already checks candidate.status in applied/hr_review. For needs_correction, candidate.status applied/hr_review is fine. If already application_draft, reject or allow? Usually allow re-request. But keep simple: only from applied/hr_review.

  For hireCandidate: already exists, idempotent-ish (reuses employeeProfile by clerk user/email, reuses tenantMember, patches role). Plan notes no change needed except verifying it satisfies spec. But the task prompt says "add hireCandidate mutation in candidates.ts". Since it exists, note verified.

  For employee profile: route param :memberId likely tenantMember._id. Need query to get member and employee profile. We can add `getEmployeeProfileForHR` in employeeProfiles.ts that takes tenantMemberId and returns profile + member. Or add in members.ts. Since employee profile may not exist for all caregivers (if created via TeamPage before hireCandidate existed), handle missing profile gracefully.

  For employee documents: `documentArchive.listDocumentArchive` with linkedTo subjectType 'employee', subjectId = clerkUserId. The documentArchiveItems table subjectType is string, subjectId is string. Good.

  For employee cases: `listHrCases` should support filtering by subjectId. Or we add `listHrCasesBySubject`. Plan should specify.

  For NewCaseModal: subjectId select employee/candidate. Need queries to list candidates and employees for selection. We can use existing `listCandidates` and `listEmployeeProfiles` (after role update) or `members.listCaregivers`. Plan should specify.

  For dashboard counts: need new queries or extend existing. Could add `hrDashboardStats` query that returns pipelineCount, activeEmployeesCount, expiringCredentialsCount, openCasesCount. Or compute on client from list queries. Better backend query for performance and isolation. Plan: add `hrDashboardStats` in a new or existing file (maybe hrCases.ts or candidates.ts). Since it touches multiple tables, create in `convex/hr.ts` or extend candidates.ts. Keep in candidates.ts or hrCases.ts? Maybe create `convex/hr.ts` with dashboard stats and employee counts. But task only mentions hrCases.ts. To minimize, add queries to existing modules:
  - pipeline count: in candidates.ts add `countPipelineCandidates` or extend listCandidates (but counting all and filtering is fine for small data).
  - active employees: members.ts has listCaregivers; client can count. Or add countCaregivers.
  - open cases: hrCases.ts listHrCases filter status open; client count.
  - expiring credentials: 0 hardcoded.

  But to keep dashboard fast, add backend aggregate queries. Plan can include `hrDashboardStats` in convex/hrCases.ts or candidates.ts. I'll propose a new `convex/hr.ts`? The task says create convex/hrCases.ts. Maybe put stats in candidates.ts to avoid new file. But it touches cases. Could put in hrCases.ts. Let's add `hrDashboardStats` to hrCases.ts? No, it doesn't belong there. Add to candidates.ts? Not ideal. Create `convex/hr.ts` with stats and maybe list helpers. But task didn't ask for it. The plan can include it as a created file. That's fine.

  Actually, we can compute counts on the client from existing list queries: listCandidates, listEmployeeProfiles (after role update), listHrCases. But listEmployeeProfiles is admin-only. Need to extend to hr. Then dashboard can compute. For performance it's okay for session 7. Plan: extend `employeeProfiles.listEmployeeProfiles` roles to ['org:admin','org:hr'] and return tenantMemberId so we can link. Dashboard counts computed client-side from list queries. This avoids new backend query. But the Figma dashboard title says "People & hiring" etc. We'll compute.

  However, "In pipeline" count requires counting candidates where status in ['invited','application_draft','submitted','hr_review','offer_sent','accepted']? The spec says "status in ['invited','application_draft','submitted','hr_review']". But candidate statuses are invited, applied, hr_review, etc. Applied is missing. Need to include 'applied' and 'offer_sent'/'accepted'? The spec says those four. But 'submitted' is application status, not candidate. This is another ambiguity. The pipeline should include all non-hired/non-rejected/non-withdrawn candidates. I'll define in plan: count candidates whose status is one of invited, applied, hr_review, application_draft, offer_sent, accepted (i.e., not hired/rejected/withdrawn). But to match spec text: ['invited','application_draft','submitted','hr_review']. Since candidate.status doesn't have 'submitted', use 'applied' as equivalent, or count applications with status submitted. Plan should note ambiguity and propose mapping.

  For candidate pipeline page filter tabs:
  - All: all candidates
  - In progress: non-terminal (not hired/rejected/withdrawn)
  - Review needed: applied or hr_review or application_draft? Spec says "Review needed". We'll map to applied + hr_review.
  - Hired: hired.

  Need to align with Figma filter tabs: All, New, Screening, Offer, Hired? Wait the screenshot shows tabs: "All · 18", "New · 5", "Screening · 7", "Offer · 3". But the spec text says tabs: All, In progress, Review needed, Hired. The spec text is probably the simplified version for implementation. Since task says implement pixel-faithful to Figma, should we use All/New/Screening/Offer/Hired? The prompt text says "Filter tabs (pill style)... All, In progress, Review needed, Hired". And "StatusBadge color/word mapping for candidate statuses: ..." The Figma image shows different tabs. Which is authoritative? The prompt text likely is the implementation spec, and Figma is visual reference. The text says use those four tabs. The image shows five tabs with counts. This is conflicting. The plan should note the conflict and choose the text spec as primary because it's explicit and simpler, but call out visual divergence. Or choose Figma. The user says "Implement pixel-faithful to Figma." So maybe we should match the image tabs: All, New, Screening, Offer, Hired. But then "New" would filter invited/applied? "Screening" = hr_review/application_draft? "Offer" = offer_sent/accepted? This complicates.

  Given the prompt explicitly lists tabs, I'll follow the text spec but note the divergence and that the implementer can align with Figma by splitting into more tabs. The plan's acceptance criteria can reflect the text spec.

  For AC-6 status badge mapping: need to support candidate statuses. Current StatusBadge variant map uses ShiftStatus. We'll extend StatusBadge to accept a `variant` prop already exists. So we can just pass variant manually for each candidate status. But we need a mapping function. The plan can say: add a `getCandidateStatusDisplay(status)` helper in src/features/hr/lib/candidateStatus.ts that returns { variant, label }. Do not modify StatusBadge itself unless types prevent passing variant. Actually StatusBadge already accepts `variant` and `children`, so no modification needed. But its `status` prop type is ShiftStatus. We won't use `status` for candidates; we'll use `variant` + children. Good. No StatusBadge modification needed.

  Similarly for hrCase status badge: use Badge or StatusBadge with variant + children.

  For KpiCard: shared KpiCard has icon prop but no valueClass/trend. The Figma KPI cards have trend text. We can either extend KpiCard with optional trend/valueClass or just use detail for trend. The spec says "reuse KpiCard". The existing shared KpiCard has detail prop. We can put trend text in detail. For value color, the spec wants accent colors. Shared KpiCard value is always text-atria-ink. We need value color classes. Plan: extend shared KpiCard with optional `valueClassName?: string` (or `valueClass`) prop. Minimal, non-breaking.

  For toasts: no global toast system. Plan: create a small `HrToast` component or use local state + Toast component in each page/modal. For simplicity, add a `useHrToast` hook in src/features/hr/hooks/useHrToast.ts that returns a toast state and a render helper. Or just inline state. Plan should specify a reusable local toast pattern.

  For ADP sync status badge: existing `adpStatusPill` in TeamPage maps statuses to label/variant. We should extract or replicate in hr feature. Plan: create `src/features/hr/lib/adpStatus.ts` with adpStatusDisplay mapping.

  For PHI/Security: HR pages show SSN, DOB, etc. But schema lacks these fields. Plan should note: do not store PHI until encryption/at-rest controls are in place; for Phase 2, display only existing fields and mask any future SSN field. For now, SSN won't be displayed because schema lacks it. Also all queries must use authHelpers guards (tenantId + role). Cases can contain sensitive employment info; guard by tenantId.

  For idempotency: inviteCandidate already idempotent. hireCandidate already idempotent. createHrCase should not create duplicate cases; but spec doesn't require idempotency key. We can generate idempotency key or just allow duplicates. Plan should mention: add optional `idempotencyKey` to hrCases or accept that duplicates are possible and can be closed.

  Now, the plan should be comprehensive but not code. I need to output it. The user wants final answer/verdict as requested. So I'll output the plan markdown.

  Let me also make sure to mention that the backend is agentic CLI and I inspected files (discovery requirement).

  Now I need to write the plan. I'll create a markdown document. Since this is a plan file, I could write it to a file? The prompt says "Produce a premium implementation plan... Output your final answer/verdict as requested." The user wants the final answer in the response. I should output it directly. But the instructions also say "when task requires creating or modifying files, use tools". This is a planning task; the output is the plan. I can just respond with the plan text. However, the prompt is from a file and says "Produce a premium implementation plan". It doesn't say write to a file. The user says "Output your final answer/verdict as requested." So final response should be the plan.

  But maybe they want me to write the plan to a file? The prompt is "plan_c_plan_agentic.prompt.md" and asks to produce a plan. Usually in Conclave, the plan agent outputs a plan file. But the user just says read the prompt and carry out instructions; output final answer/verdict as requested. The prompt's final instruction is to produce the plan. So I'll output the plan in my response.

  Given the length, I'll be thorough but concise.

  One more check: `reviewApplication` decision union needs to include needs_correction. The schema applications.decision also needs update. Since schema.ts uses v.union literal approved/rejected, we need to add needs_correction. That affects generated types; run codegen.

  Also candidate status application_draft needs to be added to CandidateStatus union in candidates.ts and maybe validate. Schema is v.string() so no change needed there. But we should update the type alias.

  For `hireCandidate`: existing mutation doesn't accept startDate/payRate/supervisor. The plan should decide: leave existing mutation unchanged, UI fields optional/not stored. Or extend mutation to accept optional args and store in application or new fields. Since schema lacks employee profile fields for startDate/payRate/supervisor, if we want to store them, we'd need schema changes. The task says "for this session, minimal version from task: just the summary + target + note + confirm button. Keep the fields but mark auto-populated or optional if backend not ready." So plan: UI shows auto-populated fields (full name, position) and required inputs (start date, pay rate, supervisor) but they are optional for the mutation call; existing hireCandidate is called without them. Add a note that storing these fields is Phase 3 unless we extend schema. But the Figma shows required fields with green borders. The UI should validate them before enabling Confirm. It can collect them but not send them, or send them to a new optional-args version that ignores them. To avoid type errors, we can call existing hireCandidate with just clerkOrgId/candidateId. The fields serve as a UX checklist. But the user may expect them to be sent. Hmm.

  Maybe better: extend `hireCandidate` mutation args to optionally accept `startDate`, `payRate`, `supervisor` (all optional) and store them on the application row (which already has `fields: v.any()`) by patching `fields.hrOnboarding` or similar. This avoids schema change. Then the mutation remains backward-compatible. Plan can propose this: extend hireCandidate args with optional onboarding fields, store inside application.fields as `hiringDetails` object. This satisfies UI without new schema columns. Good.

  Similarly, employee profile page "pay rate" could come from application.fields.hiringDetails.payRate if stored. But that's okay.

  For supervisor: subjectId could be a tenantMember._id. We can store as string. For the select, list admins/coordinators? Actually supervisor likely a coordinator. We can use `members.list` (admin only) or `members.listCaregivers`. Since list is admin-only, maybe create a `listSupervisors` query returning tenantMembers with roles admin/coordinator. Plan: add `listSupervisors` to members.ts with roles admin/hr. Or just reuse `members.list` and extend roles to hr. Simpler: extend `members.list` roles to include org:hr. Then HR can list all members for supervisor selection and case assignment.

  For case assignment: NewCaseModal needs `assigned to`? Spec says table columns: SUBJECT, KIND, STATUS, ASSIGNED, CREATED, ACTIONS. But NewCaseModal spec only mentions title, description, kind, subjectId. It doesn't mention owner. We can set ownerMemberId to current HR member id. The assigned column can show the owner's displayName. Need to return owner name in listHrCases. We can join tenantMembers. Plan: createHrCase sets ownerMemberId to ctx.member._id (the HR user). listHrCases joins tenantMembers to get owner displayName.

  For subject name in cases: subjectType 'employee' or 'candidate'. For employee, subjectId = clerkUserId; for candidate, subjectId = candidate._id. Need to resolve name. listHrCases can fetch employeeProfiles or candidates based on subjectType. Plan: in listHrCases, resolve subject displayName by querying employeeProfiles by clerkUserId or candidates by _id.

  For employee profile cases tab: listHrCases filtered by subjectId (clerkUserId) and subjectType 'employee'.

  For employee profile documents tab: listDocumentArchive with linkedTo subjectType 'employee', subjectId clerkUserId.

  For employee profile header: route is `/hr/employees/:memberId` (tenantMember id). Need query that takes tenantMemberId and returns member + employeeProfile. We can add `getEmployeeProfileDetail` in employeeProfiles.ts. It should require org:admin/org:hr, get tenantMember by id, then get employeeProfile by tenantMemberId or clerkUserId. Return { member, profile, application?: latest application }.

  Actually, the hireCandidate mutation sets `hiredEmployeeProfileId` on application. The employeeProfile has tenantMemberId. So from tenantMember._id we can find profile by tenantMemberId index? The schema has index `by_tenant_clerk_user` and `by_tenant`. No index by tenantMemberId. But we can filter. Or we can add index. Plan: add index `by_tenant_member` on employeeProfiles.tenantMemberId to support efficient lookup. Since modifying schema, run codegen.

  Alternatively, route param could be employeeProfile._id instead of tenantMember._id. The task says `/hr/employees/:memberId`. The Figma header shows "Caregiver · Hired Apr 1, 2025 · EMP-0042". memberId likely tenantMember._id. We'll use tenantMember._id. Add index on employeeProfiles.tenantMemberId.

  For employee start date: schema doesn't have startDate. We can show `tenantMember.createdAt` as "Hired date" or "Start date". Figma shows "Hired Apr 1, 2025". So use member.createdAt or profile.createdAt. The task spec for EmployeeProfilePage says "start date (`tenantMember.createdAt`)". Good.

  For employment status badge: always "Active" green.

  For EmployeeProfilePage tabs: spec says Profile / Documents / Cases. But Figma shows Overview / Credentials / Training / Documents. The spec text says "Tabs: Profile / Documents / Cases (pill style, active green). For this session implement all three tabs." So follow text spec.

  Now, let's also note the need for tests:
  - Backend: convex/hrCases.test.ts covering create/list/update guards, tenant isolation, status transitions.
  - Backend: convex/candidates.test.ts add test for reviewApplication needs_correction.
  - Frontend: src/features/hr/pages/__tests__/HRDashboardPage.test.tsx (mock Clerk/Convex, render KPIs, invite modal).
  - Frontend: src/features/hr/pages/__tests__/CandidatePipelinePage.test.tsx (render table, tabs).
  - Frontend: src/features/hr/pages/__tests__/ApplicationReviewPage.test.tsx (decision buttons disabled/enabled).
  - Frontend: src/features/hr/pages/__tests__/HireConvertPage.test.tsx.
  - Frontend: src/features/hr/pages/__tests__/EmployeesPage.test.tsx.
  - Frontend: src/features/hr/pages/__tests__/EmployeeProfilePage.test.tsx.
  - Frontend: src/features/hr/pages/__tests__/HRCasesPage.test.tsx.
  - Frontend: src/app/router.test.tsx add HR route render tests.
  - Frontend: src/app/shell/Sidebar.test.tsx add HR nav items for org:hr.

  Gate commands: npm run lint, npm run typecheck, npm run test, npm run build.

  Rollback: git branch feature/phase-2-worker-onboarding; commit increments; revert by resetting branch.

  Now, I should also mention that `StatusBadge` currently imports `@/shared/format` which is a `.ts` file, but path alias likely resolves. Not a blocker.

  Let me write the plan. I'll be careful with formatting.

  Actually, maybe I should create a plan file in the repo? The prompt is a "plan agentic" prompt. In Conclave, the plan agent probably writes a plan file. But the user just says "Output your final answer/verdict as requested." I'll output in response. The final answer can be the plan markdown.

  I will include a clear header and all sections.

  One more nuance: the prompt says "Do NOT write the full code." So I must not include code blocks of implementation. I can include pseudocode-ish descriptions but not full code.

  Let's write.

To resume this session: kimi -r session_d6a913fb-dbbc-4449-8308-ddd3f311e0cc
