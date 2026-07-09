# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of the AppShell desktop-sidebar overlap fix against the acceptance criteria:

- **AC-1 / AC-2 / AC-3 / AC-4 (the actual layout fix):** The planned change — adding `lg:ml-[240px]` to the chrome branch of the content-wrapper `cn(...)` call in `src/app/shell/AppShell.tsx` — is the correct, minimal fix. It matches the fixed `w-[240px]` desktop sidebar in `src/app/shell/Sidebar.tsx`, applies only when `hideChrome === false`, leaves chromeless routes (`/dev/screenshots/*`, `/onboarding/*`) at `w-full`, and the `lg:` prefix protects mobile layouts. No issue with the approach itself.

- **AC-5 (scope control): VIOLATED.** The working-tree diff modifies far more than `src/app/shell/AppShell.tsx`. The top-level diff summary shows `src/app/shell/AppShell.tsx | 52 +-`, which is inconsistent with the single-line `cn(...)` update the plan requires. In addition, many unrelated source files are changed, including but not limited to:
  - `convex/authHelpers.ts`
  - `convex/candidates.ts` / `convex/candidates.test.ts`
  - `convex/files.ts` / `convex/files.test.ts`
  - `convex/forms.ts` / `convex/forms.test.ts`
  - `convex/hrCases.ts` / `convex/hrCases.test.ts`
  - `convex/onboarding.test.ts`
  - `convex/scheduling.test.ts`
  - `convex/seed.ts` / `convex/seed.test.ts`
  - `src/app/providers.tsx`
  - `src/app/router.tsx`
  - `src/app/shell/Sidebar.tsx`
  - `src/dev/ScreenshotHarnessPage.tsx`, `src/dev/mockApi.ts`, `src/dev/mockClerkReact.tsx`, `src/dev/mockConvexReact.tsx`, `src/dev/mockData.ts`
  - `src/features/hr/pages/HRDashboardPage.test.tsx`
  - `src/features/scheduling/components/CoverageRequestsPanel.tsx` / `.test.tsx`
  - `src/features/scheduling/components/ShiftEditorModal.tsx` / `.test.tsx`
  - `src/features/scheduling/components/ShiftPacketPanel.tsx`
  - `src/features/scheduling/pages/AvailabilityPage.tsx` / `.test.tsx`
  - `src/features/scheduling/pages/CaregiverSchedulePage.tsx`
  - `src/features/scheduling/pages/SchedulingPage.tsx` / `.test.tsx`
  - `src/main.tsx`
  - `src/shared/format.ts`, `src/shared/ui/Checkbox.tsx`, `src/shared/ui/FieldGroup.tsx`, `src/shared/ui/StatusBadge.tsx`, `src/shared/ui/index.ts`
  - `tests/e2e/geofence.spec.ts`, `tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/env.ts`, `tests/e2e/phase1-lifecycle.spec.ts`
  - `vite.config.ts`

  Since `npm run typecheck` and `npm run test` already pass, there is no gate-failure justification for these changes under the task’s scope-control rule. They should be reverted or moved to separate work.

- **AC-8 / AC-9 (required gates): NOT VERIFIED.** The provided gate excerpts only show `npm run lint`, `npm run typecheck`, and `npm run test` passing. There are no excerpts for `E2E_FULL=1 npm run e2e` or `npm run build`, both of which the task explicitly requires.

- **Security / PHI / multi-tenancy:** The AppShell change is purely presentational and touches no auth, backend, or tenant data. The unrelated `convex/*` changes (e.g., membership role updates in `convex/candidates.ts`, candidate upload permissions in `convex/files.ts`, HR case subject resolution in `convex/hrCases.ts`) are out of scope for this task and should not be bundled with a one-line UI fix.

**Requested changes:**
1. Reduce the `src/app/shell/AppShell.tsx` change to the single `cn(...)` line described in the plan and revert the remaining ~51 changed lines in that file.
2. Revert all unrelated source-file modifications so this PR contains only `src/app/shell/AppShell.tsx`.
3. Run and report `E2E_FULL=1 npm run e2e` and `npm run build`.

VERDICT: CHANGES_REQUESTED