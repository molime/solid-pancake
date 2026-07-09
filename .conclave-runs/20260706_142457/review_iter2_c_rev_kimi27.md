# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

## Review summary

The diff delivers solid backend work for HR cases (`convex/hrCases.ts` + tests) and keeps tenant/role guards in place, but it also makes a risky change to `AppShell.tsx` and is dominated by scheduling/dev-harness changes that are outside the Session 7 HR scope. Most of the HR frontend ACs cannot be verified from this diff because `src/app/router.tsx`, `src/app/shell/Sidebar.tsx`, and the actual `src/features/hr/pages/*.tsx` implementations are not present in the changed-file list. Unit tests for those pages do pass, which suggests the implementations exist elsewhere in the branch.

## Verified / positive

- `convex/hrCases.ts` correctly gates mutations/queries to `org:admin`/`org:hr`, validates subject existence and tenant ownership, records audit events, and resolves subject/owner display names.
- `convex/hrCases.test.ts` covers create/list/update, subject validation, and cross-tenant isolation.
- `hrDashboardStats` query is present.
- `convex/candidates.test.ts` still passes (17 tests), and the new `needs_correction` path is exercised.
- Lint, typecheck, and unit tests all pass.

## Concrete blockers

### 1. `src/app/shell/AppShell.tsx` — `TrainingGate` role cast excludes HR/admin users

```tsx
<TrainingGate role={role as 'org:caregiver' | 'org:candidate' | undefined}>
```

The cast limits the prop to `org:caregiver` or `org:candidate`. Session 7 requires `org:admin` and `org:hr` users to access `/hr/*`. If `TrainingGate` validates or branches on this role, admin/HR users will be redirected or dropped. Even if it happens to work at runtime, the type is wrong and hides the real role set. This is a regression against AC-1/AC-2.

**Requested change:** pass the real `role` without the unsafe cast, and ensure `TrainingGate` (or the shell) allows `org:admin`/`org:hr`/`org:coordinator` through without forcing caregiver/candidate training.

### 2. `src/app/shell/AppShell.tsx` — non-member users get an infinite loader

```tsx
if (member === undefined) return <AppLoader label='Loading workspace' />
```

`useQuery` returns `undefined` while loading and `null` when the user is not a member. The old `TenantRouteGuard` redirected non-members; the new shell only checks `undefined`, so a non-member will spin forever. This is a regression in tenant membership enforcement.

**Requested change:** handle `member === null` by redirecting to `/sign-in` or an unauthorized page, matching the previous `TenantRouteGuard` behavior.

## Scope / reviewability notes

- The changed-file list is heavily weighted toward scheduling (`CoverageRequestsPanel`, `ShiftEditorModal`, `AvailabilityPage`, etc.) and the dev screenshot harness. Those changes look reasonable and are covered by tests, but they are not part of the Session 7 HR task.
- Because `router.tsx`, `Sidebar.tsx`, and the HR page components themselves are not in this diff, I cannot directly verify AC-1 through AC-12 from the code shown. The passing unit tests for `HRDashboardPage`, `CandidatePipelinePage`, `ApplicationReviewPage`, and `EmployeesPage` indicate the files exist in the working tree, but they were not modified in this change.

## Minor notes (non-blocking)

- `src/dev/mockConvexReact.tsx` has a duplicated union member: `'org:candidate' | 'org:candidate'`.
- `convex/hrCases.ts` `listHrCases` now does a per-row `resolveSubjectName` lookup inside `Promise.all`; this is an N+1 query pattern. Acceptable for Phase 2, but worth indexing/aggregating later.

VERDICT: CHANGES_REQUESTED