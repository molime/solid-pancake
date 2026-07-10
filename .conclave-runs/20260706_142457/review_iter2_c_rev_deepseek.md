# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Review of Working-Tree Diff

### What the diff contains

The diff includes changes to:

- **Backend HR cases** (`convex/hrCases.ts`, `convex/hrCases.test.ts`): subject validation, subject name resolution, audit logging, extended `updateHrCase` with optional title/description/category, `createdAt` field, and new tests for subject validation and cross-tenant isolation.
- **AppShell** (`src/app/shell/AppShell.tsx`): complete rewrite — removed `TenantRouteGuard`, added direct `useOrganization`/`useUser`/`useQuery` for member, `TrainingGate`, `hideChrome` for screenshot routes, `AppLoader`, and `Navigate` to sign-in.
- **Dev mock infrastructure** (`src/dev/*`): added candidate onboarding views, `org:candidate` role, mock data for candidate tasks/profile/application/documents.
- **Scheduling components** (`CoverageRequestsPanel`, `ShiftEditorModal`, etc.): added caregiver mode, Toast, availability hints, schedule conflict detection, and corresponding tests.
- **Minor fixes** (`HRDashboardPage.test.tsx`, `StatusBadge.tsx`, `FieldGroup.tsx`, `Checkbox.tsx`, `vite.config.ts`, `main.tsx`).

### What is missing (against the plan’s acceptance criteria)

The plan requires the following **new files** and **modifications** that are **not present** in this diff:

| Missing item | Relevant AC |
|---|---|
| `src/features/hr/pages/HRDashboardPage.tsx` | AC-3 |
| `src/features/hr/pages/CandidatePipelinePage.tsx` | AC-5 |
| `src/features/hr/pages/ApplicationReviewPage.tsx` | AC-7 |
| `src/features/hr/pages/HireConvertPage.tsx` | AC-9 |
| `src/features/hr/pages/EmployeesPage.tsx` | AC-10 |
| `src/features/hr/pages/EmployeeProfilePage.tsx` | AC-11 |
| `src/features/hr/pages/HRCasesPage.tsx` | AC-12 |
| `src/features/hr/components/InviteCandidateModal.tsx` | AC-4 |
| `src/features/hr/components/NewCaseModal.tsx` | AC-12 |
| `src/features/hr/lib/candidateStatus.ts` | AC-6 |
| `src/features/hr/lib/adpStatus.ts` | AC-10 |
| `src/features/hr/hooks/useHrToast.ts` | (implied by AC-4, AC-7, AC-9) |
| `src/app/router.tsx` — add `/hr/*` routes with `TenantRoleRouteGuard` | AC-1 |
| `src/app/shell/Sidebar.tsx` — add HR nav items | AC-2 |
| `convex/schema.ts` — add `needs_correction` to `applications.decision`, add `by_tenant_member` index on `employeeProfiles` | AC-8, AC-11 |
| `convex/candidates.ts` — extend `reviewApplication` for `needs_correction`, add optional hire fields | AC-8, AC-9 |
| `convex/employeeProfiles.ts` — add `getEmployeeProfileDetail`, allow `org:hr` in `listEmployeeProfiles` | AC-11 |
| `src/shared/ui/KpiCard.tsx` — optional `valueClassName`/`trend` | AC-3 |
| Test files for the new pages and modals (except `HRDashboardPage.test.tsx` which already existed) | AC-15 |

The diff shows **no new files** and **no modifications** to the files listed above. The only HR-related change in the diff is the backend `hrCases.ts`/`hrCases.test.ts` and a minor fix to the existing `HRDashboardPage.test.tsx`. The core frontend implementation is absent.

### Security/Architecture concern: AppShell guard removal

`src/app/shell/AppShell.tsx` removes the `TenantRouteGuard` wrapper and replaces it with a `TrainingGate` component (not shown in the diff). The plan explicitly requires every `/hr/*` route to be wrapped in `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}`. The new AppShell does not enforce role-based access for HR routes; it only checks that a `member` exists. This is a **regression** — any authenticated member of the org could potentially access HR pages. The `TrainingGate` may or may not enforce roles, but it is not the guard specified in the plan and its behavior is unknown from this diff.

### Other observations

- The `convex/hrCases.ts` changes are well-structured and include proper tenant isolation, subject validation, and audit logging. These satisfy AC-13.
- The `convex/hrCases.test.ts` additions cover subject validation and cross-tenant isolation, which is good.
- The diff includes many changes to scheduling components and dev mock data that are **outside the scope** of Session 7 (HR screens). While not necessarily harmful, they increase the blast radius and are not part of the acceptance criteria. They should be reviewed separately or reverted if not intended for this session.
- The `convex/files.ts` addition of `'org:candidate'` is not part of the HR task and may be for a different feature. It is not a blocker but should be confirmed as intentional.

### Verdict

The diff does **not** implement the core HR frontend pages, modals, router/sidebar wiring, schema changes, candidate mutation extensions, or the required tests. The AppShell guard removal introduces a potential security gap. The task is incomplete.

**CHANGES_REQUESTED**