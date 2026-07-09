# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 5 Scheduling & Shift Management

### Summary
This is a substantial implementation adding scheduling functionality across 15 files (~2800 lines). All quality gates (lint, typecheck, unit tests) pass. The implementation follows existing patterns and reuses shared UI primitives correctly.

---

### Acceptance Criteria Verification

| AC | Status | Notes |
|----|--------|-------|
| AC-1 (Routes) | ✅ | `router.tsx` lines 57-71: lazy imports + `TenantRoleRouteGuard` for all 3 routes |
| AC-2 (Sidebar) | ✅ | `Sidebar.tsx` lines 40-58: Schedule for admin/coordinator, Schedule+Availability for caregiver |
| AC-3 (SchedulingPage) | ✅ | `SchedulingPage.tsx`: weekly calendar, caregiver filter, Add shift, EmptyState |
| AC-4 (ShiftEditorModal create/update) | ✅ | `ShiftEditorModal.tsx` lines 130-165: calls `createShift`/`updateShift` with correct args |
| AC-5 (Conflict error) | ✅ | `ShiftEditorModal.tsx` lines 172-179: parses backend error, displays formatted message |
| AC-6 (Availability hint) | ✅ | `ShiftEditorModal.tsx` lines 84-92 + `schedulingUtils.ts` `coversSlot()` |
| AC-7 (ShiftPacketPanel) | ✅ | `ShiftPacketPanel.tsx`: status badge, client/caregiver, time, rate, geofence, role-based actions |
| AC-8 (Audit history) | ✅ | `ShiftPacketPanel.tsx` lines 67-74: filters `api.audit.list` by `shiftId` |
| AC-9 (CoverageRequestsPanel) | ✅ | `CoverageRequestsPanel.tsx`: lists open requests, Assign calls `resolveCoverage` |
| AC-10 (CaregiverSchedulePage) | ✅ | `CaregiverSchedulePage.tsx`: mobile-first list, opens packet on tap |
| AC-11 (AvailabilityPage) | ✅ | `AvailabilityPage.tsx`: recurring/override windows, add/delete |
| AC-12 (Visual fidelity) | ✅ | Uses `controlSize="lg"`, `text-base`, dark tokens (`atria-*`) |
| AC-13 (Toast) | ✅ | Inline `Toast` component with local state (no global provider) |
| AC-14 (Tests) | ⚠️ | **Missing `CaregiverSchedulePage.test.tsx`** - see blocker below |
| AC-15 (Quality gates) | ✅ | All 4 gates pass (382 tests total) |
| AC-16 (Visual regression) | ⚠️ | Cannot verify screenshots in this review - requires manual check |

---

### Issues Found

#### 🔴 BLOCKER: Missing CaregiverSchedulePage Test File

**File:** `src/features/scheduling/pages/CaregiverSchedulePage.test.tsx` — **NOT PRESENT** in diff

**Plan requirement (Test Strategy section):**
> - `CaregiverSchedulePage.test.tsx` (implied by AC-10 + Test Strategy): Mobile-first upcoming shift list at `/caregiver/schedule`, calling `api.scheduling.listCaregiverShifts`. Tapping a row opens `ShiftPacketPanel` in caregiver view.

**Current test files in diff:**
- `SchedulingPage.test.tsx` ✅
- `ShiftEditorModal.test.tsx` ✅
- `CoverageRequestsPanel.test.tsx` ✅
- `AvailabilityPage.test.tsx` ✅
- `CaregiverSchedulePage.test.tsx` ❌ **MISSING**

**Risk:** No unit test coverage for caregiver schedule rendering, empty state, or shift tap behavior. This is a routed page with role-specific logic that should have test coverage matching the other pages.

**Fix required:** Create `src/features/scheduling/pages/CaregiverSchedulePage.test.tsx` with:
- Renders loading state while `listCaregiverShifts` is undefined
- Renders empty state when no shifts
- Renders shift cards for populated state
- Tapping a row opens `ShiftPacketPanel` (or calls the appropriate handler)

---

#### ⚠️ OBSERVATION: ShiftPacketPanel Has No Dedicated Tests

**File:** `src/features/scheduling/components/ShiftPacketPanel.test.tsx` — **NOT PRESENT**

This is a complex component with:
- Role-based action rendering (admin/coordinator vs caregiver)
- Delete confirmation flow
- Coverage request form
- Audit history filtering

While not explicitly listed in AC-14, this component has significant logic that would benefit from test coverage. Consider adding in a follow-up.

---

#### ⚠️ OBSERVATION: Conflict Error Timezone Display

**File:** `ShiftEditorModal.tsx` lines 176-178
```tsx
const startHm = conflict.start.slice(11, 16)
const endHm = conflict.end.slice(11, 16)
```

The backend stores times as UTC ISO strings. The error message extracts HH:MM directly from the UTC string. If users input local times (e.g., 09:00 CDMX), the conflict message may show UTC times (e.g., 15:00) which could confuse users.

**Mitigation:** This is consistent with how the rest of the app handles time display. If Figma review shows mismatch, convert to local time using `formatTime()` from `@/shared/format`.

---

#### ✅ SECURITY: Multi-Tenancy Correctly Implemented

All Convex calls use `clerkOrgId` from `useOrganization().organization.id`:
- `ShiftEditorModal.tsx` line 68
- `CoverageRequestsPanel.tsx` line 54
- `ShiftPacketPanel.tsx` line 47

Backend `requireTenantRole` guards enforce tenant membership. No manual tenant ID construction.

---

#### ✅ SECURITY: PHI Handling

- Client/caregiver names rendered directly (no console logging)
- Audit events are tenant-scoped
- No sensitive data in error messages beyond shift times

---

### Recommendations

1. **Add `CaregiverSchedulePage.test.tsx`** before merge (blocker)
2. Consider adding `ShiftPacketPanel.test.tsx` for role-based action testing
3. After merge, run `npm run dev` and capture screenshots for visual regression comparison against Figma PNGs (AC-16)

---

### Verdict

The implementation is solid and passes all automated gates. However, the missing test file for `CaregiverSchedulePage` is a concrete gap against the Test Strategy in the approved plan. This should be addressed before approval.

VERDICT: CHANGES_REQUESTED