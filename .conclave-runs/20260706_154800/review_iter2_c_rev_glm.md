# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review: Session 8 — Document Archive Browser + Dynamic Form Renderer

### Missing Primary Deliverables (Blockers)

The task explicitly requires creating five new frontend files plus router/sidebar updates. **None of them appear in the diff's 26-file manifest:**

| Required File | Present? |
|---|---|
| `src/features/documents/pages/DocumentArchivePage.tsx` | ❌ Not in diff |
| `src/features/documents/components/DocumentDetailPanel.tsx` | ❌ Not in diff |
| `src/features/documents/pages/DocumentArchiveRoute.tsx` | ❌ Not in diff |
| `src/features/forms/components/DynamicFormRenderer.tsx` | ❌ Not in diff |
| `src/features/forms/pages/FormSubmissionPage.tsx` | ❌ Not in diff |
| Router: `/documents` gated org:admin/org:hr | ❌ Not verifiable |
| Router: `/forms/:formDefinitionId` gated all valid roles | ❌ Not verifiable |
| Sidebar: 'Documents' nav item for admin/hr | ❌ Not verifiable |

The test output also lacks the required frontend tests:
- No `DynamicFormRenderer.test.tsx` (should test: all 6 field types render, required validation with per-field errors, valid submit calls `onSubmit`)
- No `DocumentArchivePage.test.tsx` (should test: filter rendering, Verify calls `updateDocumentArchiveItem` with `status='verified'`, Reject opens reason modal)
- No `FormSubmissionPage.test.tsx`

The backend Convex tests (`convex/documentArchive.test.ts`, `convex/forms.test.ts`) pass, confirming backend functions exist, but the **frontend consumers** of those functions are absent.

### Issues in What IS Present

1. **`src/app/shell/AppShell.tsx`** — `TenantRouteGuard` is removed and replaced with `TrainingGate`. This is a significant auth-boundary change. If `TenantRouteGuard` was the multi-tenant route guard, removing it without an equivalent replacement could allow users to access routes outside their org scope. The Convex backend still enforces tenant isolation, but the frontend guard was a defense-in-depth layer. Need confirmation that `TrainingGate` (or route-level guards in `main.tsx`) provides equivalent org-scoping.

2. **`src/dev/mockConvexReact.tsx` line 25** — Duplicate type in union: `'org:coordinator' | 'org:caregiver' | 'org:candidate' | 'org:candidate'`. The second `'org:candidate'` is redundant. Minor but should be cleaned.

3. **`convex/hrCases.ts` — `createHrCase`** — `title` is now a required arg (added to the insert). Previously it was not in the args validator. Any existing callers that don't pass `title` will now throw a Convex validation error. This is a **breaking schema change** that needs a migration or backward-compatible handling.

4. **`convex/hrCases.ts` — `listHrCases`** — The `resolveSubjectName` call per-case with `try/catch` silently swallowing errors (setting `subjectName = 'Unknown'`) could mask data integrity issues. Acceptable for a list view, but worth a `console.warn` in development.

5. **`src/features/scheduling/components/ShiftEditorModal.tsx`** — The `hasScheduleConflict` memo depends on `caregiverShifts?.items?.some(...)`. If `caregiverShifts` returns `undefined` (query loading), the optional chaining correctly short-circuits to `false`, meaning no conflict is shown during loading. This is acceptable but could mislead users into submitting a conflicting shift if they click before the query resolves. Consider disabling the submit button while `caregiverShifts === undefined`.

6. **`src/features/scheduling/components/CoverageRequestsPanel.tsx`** — The `CaregiverCoverageRequestsPanel` calls `requestCoverage` with `reason: \`Coverage request for ${coworker.displayName || coworker.email}\``. The `reason` field is a free-text string constructed from user input. If this is stored and displayed, ensure it's sanitized against XSS on the rendering side (React handles this by default, but worth noting).

### Positive Observations

- Cross-tenant isolation test in `hrCases.test.ts` is excellent — proves orgB admin cannot update orgA's case.
- `resolveSubjectName` with `assertTenantDoc` properly enforces tenant ownership of subject entities.
- `ShiftEditorModal` edit mode, availability hints, and schedule conflict detection are well-implemented.
- `CoverageRequestsPanel` caregiver mode is clean with proper loading/error states.
- Toast replacing `window.alert` is a UX improvement.
- `FieldGroup` enhancements (`labelClassName`, `requiredIndicator`) are correct prerequisites for `DynamicFormRenderer`.
- All 428 existing tests pass; lint, typecheck, and build are green.

### Verdict

The diff contains solid infrastructure work (backend guards, shared UI enhancements, scheduling/caregiver features) but **does not include the five primary deliverables** specified in the task (DocumentArchivePage, DocumentDetailPanel, DocumentArchiveRoute, DynamicFormRenderer, FormSubmissionPage) nor their required tests. AC-1 through AC-5 and AC-7 (tests) are unmet. The breaking change to `createHrCase` (requiring `title`) also needs attention.

VERDICT: CHANGES_REQUESTED