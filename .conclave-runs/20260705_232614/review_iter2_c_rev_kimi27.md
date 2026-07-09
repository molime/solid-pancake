# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

Reviewed the SESSION 5 follow-up diff. The harness scaffolding is mostly correct: the `/dev/screenshots` route is guarded and lazily loaded, the Clerk/Convex mocks provide the required exports, the mock data matches the Figma week, and the `StatusBadge` `cn` import fix is in place. Lint, typecheck, and unit tests pass.

However, there are concrete wiring/data issues that will prevent the screenshots from matching Figma, plus missing verification artifacts.

**Blockers**

1. **`src/dev/ScreenshotHarnessPage.tsx`** (import ~line 8, `CoverageRequestView` ~lines 62–68): The `coverage` harness view renders `<CoverageRequestsPanel clerkOrgId={clerkOrgId} />` in default **admin** mode. The Figma reference (`scheduling-coverage-request.png`) and the newly added caregiver mode expect the caregiver “Request coverage” page. Wire it as:
   ```tsx
   import { clerkOrgId, eligibleCoworkers, featuredShift } from './mockData'
   ...
   <CoverageRequestsPanel
     mode="caregiver"
     clerkOrgId={clerkOrgId}
     shift={featuredShift}
     eligibleCoworkers={eligibleCoworkers}
   />
   ```

2. **`src/dev/mockData.ts`** (`eligibleCoworkers`, near the end): The coworker objects lack the `email` field that `CoverageRequestsPanel`’s `Coworker` type requires. Add `email` to each entry so the caregiver-mode prop is type-safe.

3. **`src/dev/mockData.ts`** (`currentCaregiverUserId` ~line 8 vs. `caregiverIds.lucia` ~lines 22–30): `caregiverIds.lucia` is `'user_cg_lucia_fernandez'` but the mocked signed-in caregiver is `'user_screenshot_caregiver'`. The caregiver schedule shifts, the featured shift, and the coverage request are all assigned to `caregiverIds.lucia`, so they will not appear as the current caregiver’s shifts if `CaregiverSchedulePage` filters by the signed-in user id. Align them (e.g. set `caregiverIds.lucia = currentCaregiverUserId`).

4. **`src/dev/mockApi.ts`** (`scheduling:listShifts`, ~lines 23–45): The resolver conditionally merges `caregiverScheduleShifts` for non-`scheduling` views. That injects a Monday Jun 22 shift and a duplicate Saturday shift into the background calendar behind the shift editor/packet, diverging from the Figma week (Mon Jun 15 – Sun Jun 21). Always return `calendarWeekShifts` for this query; keep `caregiverScheduleShifts` for `scheduling:listCaregiverShifts` only.

5. **`src/dev/mockClerkReact.tsx`** (`getRoleFromView`, ~lines 73–79) and **`src/dev/mockConvexReact.tsx`** (`getRoleForView`): `view === 'coverage'` is treated as coordinator. Since the coverage screenshot is caregiver-facing, map `coverage` to `org:caregiver` so the AppShell sidebar and `members:me` reflect the caregiver context.

**Verification gaps**

- The supplied gate results do not include `npm run build` or the Playwright screenshots/visual-diff summary required by AC #4 and AC #5. Please run `npm run build` and attach the captured 1440×900 and 390×844 PNGs plus the side-by-side diff summary.
- `src/main.tsx` and `vite.config.ts` are modified but their bodies are not shown in the excerpt; please confirm the Date override is guarded by `import.meta.env.DEV && import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'` and that the Vite aliases only activate under the same flag.

**Optional polish**
- `CoverageRequestsPanel` caregiver mode hardcodes “Personal care” instead of the shift’s `serviceType`; align with Figma if it shows the actual service type.
- Verify that the “Ask to cover” button and admin `Select` meet the ≥44 px touch-target requirement.

VERDICT: CHANGES_REQUESTED