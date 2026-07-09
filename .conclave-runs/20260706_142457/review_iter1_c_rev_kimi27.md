# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

## Review

I reviewed the visible portion of the diff and the gate results. The backend and routing/sidebar wiring for the HR feature look correct, and all four quality gates pass.

### What looks good

- **`convex/candidates.ts`**: `reviewApplication` now accepts `decision: 'needs_correction'`, requires `hrNotes` for that decision, updates the candidate to `application_draft`, and records the decision/notes on the application. `hireCandidate` now accepts optional `startDate`, `payRate`, and `supervisor` and stores them inside `application.fields.hiringDetails` without breaking existing callers.
- **`convex/candidates.test.ts`**: A new test verifies the `needs_correction` flow end-to-end.
- **`convex/schema.ts`**: `applications.decision` is widened to include `needs_correction`, and `employeeProfiles` gets the `by_tenant_member` index needed for the `/hr/employees/:memberId` route.
- **`convex/employeeProfiles.ts`**: `listEmployeeProfiles` now allows `org:hr` and returns `tenantMemberId`/`clerkUserId` for routing; `getEmployeeProfileDetail` is added and properly asserts tenant membership on the member before resolving the profile.
- **`convex/members.ts`** and **`convex/files.ts`**: `listCaregivers` and `generateUploadUrl` now include `org:candidate`/`org:hr` as needed for the candidate document-upload and supervisor-selection flows.
- **`src/app/router.tsx`**: All seven HR routes are present inside `AppShell`, wrapped in `TenantRoleRouteGuard` with `allowedRoles: ['org:admin', 'org:hr']` and `RouteSuspense`.
- **`src/app/shell/Sidebar.tsx`**: Adds `Candidates`, `Employees`, and `Cases` nav items gated to `org:admin`/`org:hr`, with active-state matching on child paths.
- **Tests**: `router.test.tsx` and `Sidebar.test.tsx` add HR-specific render/redirect and nav-visibility coverage.

### Concerns / things to verify

1. **Scope of the diff**: The branch diff includes a large amount of scheduling and onboarding code (`src/features/scheduling/*`, `src/features/onboarding/*`, `src/dev/*`, `AppShell.tsx`, `main.tsx`) that is not part of the Session 7 HR screens task. While it is guarded and passes tests, it significantly expands the blast radius of this PR. For future merges, consider whether this unrelated work belongs in separate commits/PRs.
2. **`attachCandidateDocument` visibility**: The mutation sets `visibility: 'admins_coordinators'`. Please confirm that `org:hr` is covered by that visibility level, or the Application Review page will not be able to display documents uploaded by candidates.
3. **HR cases backend and page tests**: `convex/hrCases.ts` is referenced in the generated API but its implementation and `convex/hrCases.test.ts` are not visible in the provided diff. Likewise, the HR page component implementations and their tests (other than `HRDashboardPage.test.tsx`, which appears in the test stderr) are not in the visible portion. Ensure `createHrCase`/`listHrCases`/`updateHrCase` enforce tenant isolation and role guards, and that AC-15 test coverage is present before merging.

None of the above are confirmed regressions or security holes in the visible code, and the gates are green.

VERDICT: APPROVED