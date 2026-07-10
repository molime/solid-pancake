# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Code Review: Scheduling & Shift Management — SESSION 5 Follow-up

### What's Done Well

The core scheduling feature implementation is solid:

- **SchedulingPage, ShiftEditorModal, ShiftPacketPanel, CoverageRequestsPanel, CaregiverSchedulePage, AvailabilityPage** are well-structured with proper role-based access, Convex query/mutation patterns, and realistic form handling.
- **ShiftEditorModal** has thorough test coverage (6 tests) including create, edit, conflict error formatting, and availability hint logic.
- **CoverageRequestsPanel** correctly implements dual-mode (admin/caregiver) rendering, matching the Figma caregiver "Request coverage" flow.
- **Router** correctly guards scheduling routes with `TenantRoleRouteGuard` per role, and the conditional `ScreenshotHarnessPage` lazy import is production-safe (dead-code eliminated when flag is off).
- **Sidebar** nav items are correctly role-filtered with proper paths (`/scheduling` for admin/coordinator, `/caregiver/schedule` for caregiver).
- **StatusBadge** import fix (`@/shared/utils/cn` → `@/shared/lib/cn`) resolves the build bug identified in the plan.
- All four gates pass (lint, typecheck, unit, build).

---

### Critical Blockers — Missed Acceptance Criteria

**AC #1 requires creating five dev-only files. None of them exist in the diff:**

| Required File | Status |
|---|---|
| `src/dev/mockClerkReact.tsx` | ❌ Missing |
| `src/dev/mockConvexReact.tsx` | ❌ Missing |
| `src/dev/mockData.ts` | ❌ Missing |
| `src/dev/mockApi.ts` | ❌ Missing |
| `src/dev/ScreenshotHarnessPage.tsx` | ❌ Missing |

`router.tsx` line 57–65 conditionally imports `@/dev/ScreenshotHarnessPage`, but the file doesn't exist. When `VITE_ENABLE_SCREENSHOT_MOCKS=true` is set, the build will fail with a module-not-found error. The entire screenshot harness is non-functional.

**AC #1 also requires `vite.config.ts` conditional aliases** redirecting `@clerk/react` → `src/dev/mockClerkReact.tsx` and `convex/react` → `src/dev/mockConvexReact.tsx`. The `vite.config.ts` diff is truncated (22 lines changed), so I cannot verify the alias configuration is present or correct. Even if present, without the target mock files the aliases are broken.

**AC #1 requires a fixed `Date.now` override** so the calendar renders the Figma week (Mon Jun 15 – Sun Jun 21, 2026) with Thursday Jun 18 as "today". No evidence of this in the visible diff.

**AC #2 and #5 require Playwright screenshot capture** at 1440×900 and 390×844 viewports, comparison to Figma PNGs, and a visual-diff summary. No evidence of captured screenshots or comparison output.

---

### Moderate Issues

1. **Hardcoded test data in production component** — `CoverageRequestsPanel.tsx` lines 47–51 define `eligibleAvailabilityText` with hardcoded user IDs (`user_cg_pedro_ramirez`, etc.) and availability strings. While the caregiver mode isn't routed in production today, this map ships in the production bundle and would return stale/incorrect data if the caregiver mode is ever routed to without the `eligibleCoworkers` prop. This data belongs in `src/dev/mockData.ts`, not in the component.

2. **`window.confirm` for destructive action** — `ShiftPacketPanel.tsx` uses `window.confirm('Delete this shift?')`. This is a blocking browser dialog that doesn't match the Figma design system (which would use a confirmation modal). Not a blocker for this review, but worth a follow-up.

---

### Summary

The scheduling feature components themselves are well-implemented and tested. However, the **primary goal of this task** — authenticated visual regression via a dev screenshot harness — is incomplete. The five required mock/harness files are missing, the Vite alias configuration is unverifiable, the Date.now override is absent, and no screenshot capture was performed. The harness as it stands cannot run.

**Required changes:**
- Create all five `src/dev/*` files with proper Clerk/Convex mocks, realistic scheduling mock data matching the Figma spec week, and a `ScreenshotHarnessPage` that renders views by `?view=` query param with a frozen `Date.now`.
- Verify/add the `vite.config.ts` conditional `resolve.alias` entries.
- Add the `Date.now` override (e.g., `Date.now = () => new Date('2026-06-18T12:00:00').valueOf()` in the harness).
- Run the screenshot capture and provide the visual-diff summary.
- Move `eligibleAvailabilityText` out of `CoverageRequestsPanel.tsx` into mock data.

VERDICT: CHANGES_REQUESTED