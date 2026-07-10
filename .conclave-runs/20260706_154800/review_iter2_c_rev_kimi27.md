# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Review of the working-tree diff against `feature/phase-2-worker-onboarding`:

## Session 8 deliverables are absent from the diff

The task requires creating:

- `src/features/documents/pages/DocumentArchivePage.tsx`
- `src/features/documents/components/DocumentDetailPanel.tsx`
- `src/features/documents/pages/DocumentArchiveRoute.tsx`
- `src/features/forms/components/DynamicFormRenderer.tsx`
- `src/features/forms/pages/FormSubmissionPage.tsx`

plus router updates for `/documents` and `/forms/:formDefinitionId`, a Sidebar “Documents” nav item for admin/hr, and tests for the new components.

The diff header lists 26 changed files, and the visible patch touches `convex/files.ts`, `convex/hrCases.*`, `src/app/shell/AppShell.tsx`, scheduling components, dev harness files, `src/main.tsx`, and shared UI primitives. **None of the required documents/forms files are present, and the router/sidebar changes for the new routes are not visible.** Consequently:

- **AC-1** through **AC-6** from the plan are not satisfied.
- The required Vitest tests for `DynamicFormRenderer` and `DocumentArchivePage` are missing.
- The gate results (lint/typecheck/unit green) only prove the existing code compiles/tests; they do not validate the Session 8 acceptance criteria.

## Concrete blockers in the included changes

1. **`src/app/shell/AppShell.tsx` — membership loading regression**
   The new shell removes `TenantRouteGuard` and waits forever when `member === undefined`:
   ```tsx
   if (member === undefined) return <AppLoader label='Loading workspace' />
   ```
   Convex `useQuery` returns `undefined` while loading and `null` when no row exists. A user with no tenant membership will be stuck on the loader instead of being redirected to `/sign-in` or an onboarding error page. This is a regression in the global auth shell and should be handled (`member === null` → redirect/error).

2. **`convex/hrCases.ts` — uncontrolled error on candidate subject resolution**
   In `resolveSubjectName` (around the candidate branch):
   ```ts
   const candidate = await ctx.db.get(subjectId as Id<'candidates'>)
   ```
   `subjectId` comes from the client as an arbitrary string. If it is not a valid Convex ID format, `db.get` can throw an internal error rather than the intended `ConvexError('Candidate subject not found.')`. Wrap this in validation or a try/catch so callers get a controlled error.

3. **`convex/files.ts` — candidate upload role added without Session 8 context**
   Line adding `'org:candidate'` to `generateUploadUrl` role allow-list is not part of the Session 8 scope described in the task. If it is intentional for a different feature it should be justified; otherwise it is scope creep that widens storage upload permissions.

## Other notes

- `src/dev/mockConvexReact.tsx` has a duplicate union member (`'org:candidate' | 'org:candidate'`). TypeScript accepts it, but it should be cleaned up.
- `convex/hrCases.ts` `listHrCases` now resolves subject names per row (`Promise.all` + `resolveSubjectName`), which is an N+1 query pattern. Functionally correct, but consider a batched lookup for larger case volumes.
- The scheduling and HR-case changes appear internally consistent and the added tests for cross-tenant isolation and subject validation are good, but they do not address this task.

## Required changes

1. Add the missing Session 8 files and implement the filter table, slide-in panel, dynamic form renderer, and form submission page per the plan.
2. Update the router (`src/routes.tsx` / `src/main.tsx`) with the correct role gates and the Sidebar with the admin/hr “Documents” link.
3. Add the required unit tests for `DynamicFormRenderer` and `DocumentArchivePage`.
4. Fix `AppShell.tsx` so a missing membership does not hang on `AppLoader`.
5. Harden `convex/hrCases.ts` `resolveSubjectName` against invalid candidate IDs.

VERDICT: CHANGES_REQUESTED