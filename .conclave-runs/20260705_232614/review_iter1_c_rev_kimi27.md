# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

## Review: SESSION 5 follow-up — scheduling screenshot harness & Figma match

### AC coverage

| AC | Status | Notes |
|---|---|---|
| 1. Dev-only harness (`src/dev/*`, conditional aliases, `/dev/screenshots` route, frozen date) | **Not verifiable / incomplete** | The diff stat lists 20 changed files and **no `src/dev/*` files**. `router.tsx:60-71` still references `@/dev/ScreenshotHarnessPage`, and `vite.config.ts` was touched but its hunk is not shown. Either the harness files are untracked, or the references are dead code. |
| 2. Live UI matches Figma PNGs | **Partial** | New scheduling components are present, but I cannot verify the harness-driven screenshots because the harness files are not in the diff. |
| 3. Do not break production | **Needs verification** | `router.tsx` guards the route behind `import.meta.env.DEV && import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`, which is correct. I cannot verify the Vite alias condition because `vite.config.ts` is not visible. `main.tsx` was also changed but its hunk is missing. |
| 4. Gates pass | **Partial** | Lint, typecheck, and unit tests pass. `npm run build` result is **not shown**. |
| 5. Captured screenshots & diff summary | **Missing** | No screenshots or diff summary are included in the change. |

### Concrete blockers

1. **Missing / untracked dev harness files (AC 1)**  
   The required files `src/dev/mockClerkReact.tsx`, `src/dev/mockConvexReact.tsx`, `src/dev/mockData.ts`, `src/dev/mockApi.ts`, and `src/dev/ScreenshotHarnessPage.tsx` are **not in the provided diff**. `src/app/router.tsx:60-71` still lazy-imports `@/dev/ScreenshotHarnessPage`. If the files were deleted after taking screenshots, the references should also be removed; if they exist only as untracked files, they must be committed so the harness is reproducible.

2. **Admin coverage data is fetched in caregiver mode — PHI / permission risk**  
   `src/features/scheduling/components/CoverageRequestsPanel.tsx:75-85` calls `api.scheduling.listCoverageRequests` and `api.scheduling.resolveCoverage` **before** the `mode === 'caregiver'` early return at line 102. In caregiver mode those admin queries still run, so a caregiver page loads (or attempts to load) every open coverage request for the tenant. Even if the backend rejects the call, this is the wrong hook topology; split admin and caregiver into separate components so caregiver mode never invokes admin hooks.

3. **`ShiftPacketPanel` fetches the full audit trail for any role**  
   `src/features/scheduling/components/ShiftPacketPanel.tsx:55-65` calls `api.audit.list` unconditionally. If a caregiver can open a shift packet, this loads the tenant’s audit events. Scope the audit query to a staff-only child component or to a shift-specific endpoint.

4. **“Ask to cover” button is inert**  
   `src/features/scheduling/components/CoverageRequestsPanel.tsx` (caregiver branch, around the eligible-coworker list) renders a “Ask to cover” button with **no `onClick` handler**. The primary action on the caregiver coverage page does nothing. It should call the coverage-request mutation (or navigate to the request flow).

5. **Hardcoded dev/test IDs in production UI**  
   `src/features/scheduling/components/CoverageRequestsPanel.tsx:235-240` defines `eligibleAvailabilityText` keyed to specific fake Clerk user IDs (`user_cg_pedro_ramirez`, etc.) and falls back to it in the caregiver list. Move this data to `src/dev/mockData.ts` and remove the production fallback.

6. **Missing tests for touched behavior**  
   - `src/features/scheduling/components/CoverageRequestsPanel.test.tsx` only tests `mode="admin"`. There are no tests for the new `mode="caregiver"` rendering or the “Ask to cover” action.  
   - `ShiftPacketPanel.tsx` is a new component with delete, coverage-request, and audit-rendering logic, but no test file appears in the diff.

7. **Unverified production-safety files**  
   `vite.config.ts` and `src/main.tsx` were modified but their hunks are not visible. Please confirm:  
   - `vite.config.ts` aliases `@clerk/react` and `convex/react` **only** when `process.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`.  
   - `main.tsx` does **not** globally override `Date.now` or unconditionally import dev mocks.

### Non-blocking notes

- `src/shared/ui/StatusBadge.tsx` import path was correctly changed to `@/shared/lib/cn`.
- `ShiftEditorModal.tsx` eligibility sidebar labels “First Aid valid” based on availability status rather than an actual credential check; this is misleading but the backend still enforces credentials.
- `ShiftEditorModal.tsx` initializes `caregiverId` from `caregivers?.[0]` in a lazy `useState`, so the select stays empty until the user picks a caregiver after data loads.

### Required before approval

1. Commit the `src/dev/*` harness files **or** remove the `/dev/screenshots` route and Vite alias references if the harness was intentionally deleted.  
2. Refactor `CoverageRequestsPanel` so caregiver mode does not invoke `listCoverageRequests` / `resolveCoverage`.  
3. Make `ShiftPacketPanel` fetch audit events only for staff roles.  
4. Wire up the caregiver “Ask to cover” button to the coverage-request mutation.  
5. Remove the hardcoded `eligibleAvailabilityText` map from the production component.  
6. Add tests for caregiver coverage mode and for `ShiftPacketPanel`.  
7. Run `npm run build` and attach the result; include the captured screenshots and visual-diff summary.

VERDICT: CHANGES_REQUESTED