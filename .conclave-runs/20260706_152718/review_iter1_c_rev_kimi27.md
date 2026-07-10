# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of the working-tree diff:

The diff does **not** implement the Session 8 task. It is a mix of `hrCases`, scheduling, dev-harness, and shell changes. Lint, typecheck, and the existing test suite pass, but the document-archive and dynamic-form-renderer deliverables are absent.

### Blockers

**1. Missing Session 8 deliverables**
The 26-file diff contains none of the required new files:
- `src/features/documents/pages/DocumentArchivePage.tsx`
- `src/features/documents/components/DocumentDetailPanel.tsx`
- `src/features/documents/pages/DocumentArchiveRoute.tsx`
- `src/features/forms/components/DynamicFormRenderer.tsx`
- `src/features/forms/pages/FormSubmissionPage.tsx`

There are also no router changes for `/documents` or `/forms/:formDefinitionId`, and no Sidebar “Documents” nav item for `org:admin`/`org:hr`. Consequently AC-1 through AC-6 are unsatisfied.

**2. `AppShell` membership regression (security)**
`src/app/shell/AppShell.tsx` now loads membership via `useQuery(api.members.me, …)` and only waits while `member === undefined`:

```tsx
const member = useQuery(api.members.me, clerkOrgId ? { clerkOrgId } : 'skip')
...
if (member === undefined) return <AppLoader label='Loading workspace' />
```

If `members.me` returns `null` for a non-member user, the shell renders with `role` undefined and the previous `TenantRouteGuard` enforcement is gone. Add an explicit `member === null` redirect to `/sign-in` or `/unauthorized` and add a test for it.

**3. Missing tests for required new behavior**
There are no tests for the document archive, detail panel, dynamic form renderer, or form submission page because those files are not present. The touched `AppShell` membership/training path also lacks a non-member test.

### Other observations (non-blocking)

- `convex/hrCases.ts` now treats `subjectId` as a Clerk user ID for employees but a Convex document ID for candidates. This mixed contract is error-prone; consider normalizing or validating the format.
- `convex/hrCases.ts` `listHrCases` issues a separate DB read per case (N+1). Acceptable for small lists but worth monitoring.
- `src/features/scheduling/components/ShiftEditorModal.tsx` conflict detection assumes `listShifts` returns `{ items }`. Verify the real query shape in production.
- `src/dev/mockConvexReact.tsx` has a duplicate `'org:candidate'` union entry.

Please implement the missing Session 8 files, fix the `AppShell` null-membership path, and add the required tests.

VERDICT: CHANGES_REQUESTED