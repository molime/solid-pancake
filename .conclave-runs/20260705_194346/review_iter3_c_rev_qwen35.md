# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Code Review: Session 5 Scheduling & Shift Management

### Summary
The implementation adds 6 new components/pages, 3 protected routes, sidebar navigation, and 9 test files. All quality gates pass (lint, typecheck, unit tests). The code follows existing conventions for UI primitives, Convex API usage, and multi-tenancy guards.

### Acceptance Criteria Verification

| AC | Status | Notes |
|----|--------|-------|
| AC-1 (Routes) | ✅ | `router.tsx` lines 57-71 add 3 lazy-loaded routes with `TenantRoleRouteGuard` |
| AC-2 (Sidebar) | ✅ | `Sidebar.tsx` lines 40-58 add Schedule/Availability nav items with correct roles |
| AC-3 (SchedulingPage) | ✅ | Weekly calendar structure present; EmptyState usage verified |
| AC-4 (ShiftEditorModal create/edit) | ⚠️ | Create mode tested; **edit mode test missing** |
| AC-5 (Conflict error) | ✅ | `schedulingUtils.ts` lines 125-130 parse conflict; `ShiftEditorModal.tsx` lines 133-138 format message |
| AC-6 (Availability hint) | ✅ | `coversSlot` in `schedulingUtils.ts` lines 88-118; used in `ShiftEditorModal.tsx` lines 64-69 |
| AC-7 (ShiftPacketPanel) | ✅ | Role-based Edit/Delete/Request Coverage buttons present |
| AC-8 (Audit history) | ✅ | `ShiftPacketPanel.tsx` lines 63-69 filter audit events by shiftId |
| AC-9 (CoverageRequestsPanel) | ✅ | Resolve coverage with caregiver dropdown implemented |
| AC-10 (CaregiverSchedulePage) | ✅ | Mobile-first list calling `listCaregiverShifts` |
| AC-11 (AvailabilityPage) | ⚠️ | **Need verify `override` → `one-off` mapping** (diff truncated) |
| AC-12 (Visual fidelity) | ⚠️ | **Requires manual screenshot comparison** (post-implementation step) |
| AC-13 (Toast) | ⚠️ | Components call `onSuccess` callbacks but **Toast rendering not visible** in truncated pages |
| AC-14 (Tests) | ⚠️ | **Missing edit mode test** for ShiftEditorModal; **missing caregiver filter test** for SchedulingPage |
| AC-15 (Quality gates) | ✅ | All gates pass (lint, typecheck, unit 377 tests) |
| AC-16 (Visual regression) | ⚠️ | **Requires manual screenshot comparison** |

### Concrete Issues Requiring Changes

#### 1. Missing Edit Mode Test for ShiftEditorModal (AC-14)
**File:** `src/features/scheduling/components/ShiftEditorModal.test.tsx`

The test file only has 2 tests (createShift args, conflict error). AC-14 explicitly requires:
> "Edit mode pre-fills form and calls `updateShift` with `shiftId`."

**Request:** Add a test that:
- Renders `ShiftEditorModal` with `shiftToEdit` prop
- Verifies form fields are pre-filled from the shift data
- Clicks Save and asserts `updateShift` is called with `shiftId` and changed fields

#### 2. Missing Caregiver Filter Test for SchedulingPage (AC-14)
**File:** `src/features/scheduling/pages/SchedulingPage.test.tsx`

AC-14 requires:
> "Changing caregiver filter re-queries `listShifts` with the selected `caregiverId`."

**Request:** Add a test that:
- Renders SchedulingPage with populated caregiver filter
- Changes the filter selection
- Asserts `listShifts` is called with the new `caregiverId` parameter

#### 3. Toast Rendering Verification (AC-13)
**Files:** `src/features/scheduling/pages/SchedulingPage.tsx`, `AvailabilityPage.tsx`, `CaregiverSchedulePage.tsx`

AC-13 states:
> "Success/error feedback uses the existing `Toast` component rendered inline (no global toast provider exists)."

The components (`ShiftEditorModal`, `ShiftPacketPanel`, etc.) call `onSuccess?.('message')` callbacks, but the parent pages must render the `Toast` component based on local state. The diff is truncated so I cannot verify this is implemented.

**Request:** Verify each page:
- Has local state for toast message/type
- Renders `<Toast>` component conditionally when message is set
- Clears toast after display or on dismiss

#### 4. AvailabilityPage Kind Mapping (AC-11)
**File:** `src/features/scheduling/pages/AvailabilityPage.tsx`

AC-11 states:
> "Maps UI kind `override` to backend kind `one-off`."

The backend `addAvailabilityWindow` accepts `kind: 'recurring' | 'one-off'` (per discovery notes), but the UI uses "override" label. The diff is truncated so I cannot verify the mapping.

**Request:** Verify `AvailabilityPage.tsx` maps UI `kind: 'override'` to backend `kind: 'one-off'` when calling `addAvailabilityWindow`. Add a test case for override/one-off mapping.

#### 5. ShiftPacketPanel Caregiver Email for Caregiver View
**File:** `src/features/scheduling/components/ShiftPacketPanel.tsx` lines 53-56, 234

**Issue:** The `caregivers` query is skipped for caregiver role (line 53-56), but line 234 displays `caregiver?.email ?? 'No email on file'`. For caregiver viewing their own shift, this will always show "No email on file" even though the shift has `caregiverDisplayName`.

**Impact:** Minor UX issue (not a blocker). The caregiver's display name is shown, but email shows as missing.

**Request:** For caregiver view, use `member?.email` from `api.members.me` (already queried line 47-49) instead of looking up from `caregivers` list.

### Security & Multi-Tenancy Review

| Concern | Status | Notes |
|---------|--------|-------|
| Multi-tenancy | ✅ | All Convex calls pass `clerkOrgId` from `useOrganization()` |
| Role guards | ✅ | Routes protected with `TenantRoleRouteGuard`; UI buttons role-conditional |
| PHI handling | ✅ | No console.log of shift/client data visible |
| Delete safety | ✅ | Delete button only shown when `shift.status === 'scheduled'` (line 197-203) |
| Conflict idempotency | ✅ | Submit button disabled while `submitting` state is true |

### Test Coverage Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `SchedulingPage.test.tsx` | 3 | Loading, populated, empty states (**missing filter test**) |
| `ShiftEditorModal.test.tsx` | 2 | CreateShift args, conflict error (**missing edit mode test**) |
| `AvailabilityPage.test.tsx` | 2 | Render, addAvailabilityWindow |
| `CoverageRequestsPanel.test.tsx` | 2 | Render, resolve coverage |
| `router.test.tsx` | 5 | Route protection for all 3 scheduling routes |
| `Sidebar.test.tsx` | 7 | Nav items for all roles |

### Recommendations

1. **Add the 2 missing tests** (edit mode, caregiver filter) to satisfy AC-14 completely.
2. **Verify Toast rendering** in all 3 page components (SchedulingPage, CaregiverSchedulePage, AvailabilityPage).
3. **Verify override→one-off mapping** in AvailabilityPage.
4. **Fix caregiver email lookup** in ShiftPacketPanel for caregiver view (minor UX).
5. **Complete visual regression** by comparing live screenshots against the 5 Figma PNGs (AC-16).

---

VERDICT: CHANGES_REQUESTED