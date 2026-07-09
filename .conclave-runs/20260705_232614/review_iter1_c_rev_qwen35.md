# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: ATRIA-X Scheduling Screens + Screenshot Harness

### Summary
The diff implements the **scheduling feature components** (pages, modals, panels, utils) with tests, but **critically misses the screenshot harness infrastructure** that is the primary task requirement.

---

### ✅ What Is Implemented Correctly

| Area | Status | Notes |
|------|--------|-------|
| Scheduling pages | ✓ | `SchedulingPage.tsx`, `CaregiverSchedulePage.tsx`, `AvailabilityPage.tsx` created |
| Components | ✓ | `ShiftEditorModal.tsx`, `ShiftPacketPanel.tsx`, `CoverageRequestsPanel.tsx` |
| Routes + guards | ✓ | `router.tsx` adds `/scheduling`, `/caregiver/schedule`, `/caregiver/availability` with `TenantRoleRouteGuard` |
| Sidebar nav | ✓ | `Sidebar.tsx` adds role-scoped Schedule/Availability items |
| Tests | ✓ | 386 tests passing including new scheduling component tests |
| StatusBadge bug fix | ✓ | `src/shared/ui/StatusBadge.tsx` line changed `@/shared/utils/cn` → `@/shared/lib/cn` |
| Lint/Typecheck/Unit | ✓ | All gates passing |

---

### ❌ Critical Missing Items (Blockers)

#### 1. Screenshot Harness Files Not Created
**Task AC #1** explicitly requires:
- `src/dev/mockClerkReact.tsx`
- `src/dev/mockConvexReact.tsx`
- `src/dev/mockData.ts`
- `src/dev/mockApi.ts`
- `src/dev/ScreenshotHarnessPage.tsx`

**None of these files appear in the diff.** The router imports `@/dev/ScreenshotHarnessPage` conditionally (router.tsx:71-77), but the file doesn't exist. This will cause:
- **Build failure** when `VITE_ENABLE_SCREENSHOT_MOCKS=true`
- **Cannot verify UI against Figma** (core task purpose)

#### 2. Vite Alias Configuration Incomplete
**Task AC #1** requires conditional aliases in `vite.config.ts`:
```ts
// When VITE_ENABLE_SCREENSHOT_MOCKS === 'true':
// @clerk/react -> src/dev/mockClerkReact.tsx
// convex/react -> src/dev/mockConvexReact.tsx
```

The diff shows only 22 lines changed in `vite.config.ts` but the actual alias configuration for mocks is not visible. Without this, the Clerk/Convex mocks won't intercept imports.

#### 3. Build Gate Not Shown
Task AC #4 requires:
```bash
npm run build
```

The gate results show lint/typecheck/unit passing, but **no build gate output**. Given the missing `src/dev/*` files, the build may fail when the conditional import is evaluated.

#### 4. Date Freeze Not Implemented
**Task AC #1** requires:
> "Use a fixed Date.now override so the calendar shows the Figma week (Mon Jun 15 – Sun Jun 21, 2026) with Thursday Jun 18 as 'today'."

No `Date.now` override mechanism is visible in the diff. The scheduling components will render the actual current date, not the Figma spec week.

#### 5. No Visual Diff Evidence
**Task AC #5** requires:
> "Provide the captured live screenshots and a visual-diff summary in the run directory."

No screenshots or diff summary are present. Without the harness, this cannot be completed.

---

### ⚠️ Security/Production Concerns

| Issue | File | Risk |
|-------|------|------|
| Conditional import of non-existent file | `router.tsx:71-77` | Build may fail in CI if env flag is set |
| No env guard on vite aliases | `vite.config.ts` | Mock modules could leak to production bundle |
| Missing build gate | N/A | Cannot verify production bundle integrity |

---

### Requested Changes

1. **Create all `src/dev/*` harness files** with:
   - Mock ClerkProvider, useUser, useAuth, useOrganization
   - Mock ConvexProviderWithAuth, useQuery, useMutation
   - Fixed `Date.now` override for Figma week (June 15-21, 2026)
   - `ScreenshotHarnessPage` with `?view=` query param routing

2. **Add conditional Vite aliases** in `vite.config.ts`:
   ```ts
   if (process.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true') {
     resolve.alias = {
       '@clerk/react': path.resolve(__dirname, 'src/dev/mockClerkReact.tsx'),
       'convex/react': path.resolve(__dirname, 'src/dev/mockConvexReact.tsx'),
     }
   }
   ```

3. **Run and pass `npm run build`** gate with output shown

4. **Capture screenshots** at 1440x900 and 390x844 viewports and provide visual-diff summary

---

### Verdict

The scheduling feature implementation is solid with proper tests and role guards, but the **primary task deliverable (screenshot harness) is completely missing**. This blocks the core purpose: verifying UI against Figma PNGs.

VERDICT: CHANGES_REQUESTED