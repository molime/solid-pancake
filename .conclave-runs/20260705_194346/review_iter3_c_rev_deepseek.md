# http://localhost:11434/api/chat
# model=deepseek-v4-flash:cloud status=200

## Code Review: Scheduling & Shift Management (Session 5)

### Summary

The implementation adds 15 files (2566 insertions) covering the six required screens, routing, sidebar, and tests. All four quality gates pass. However, several acceptance criteria from the plan and task are not fully met, and some touched behaviours lack test coverage. Below are the concrete blockers.

---

### 1. Missed AC-3: Client last name in shift cards

**File:** `src/features/scheduling/pages/SchedulingPage.tsx` (line ~150, inferred from test)  
**Issue:** The shift card renders `clientDisplayName` (full name) instead of the client’s last name only. The task explicitly states “client last name” and the Figma spec shows last-name-only.  
**Required change:** Extract the last word from `clientDisplayName` (or use a dedicated field if available) and display only the last name. Update `SchedulingPage.test.tsx` to assert the last name.

---

### 2. Missed AC-13: Toast component not used

**Files:**  
- `src/features/scheduling/components/ShiftEditorModal.tsx` (line ~160, error div)  
- `src/features/scheduling/components/ShiftPacketPanel.tsx` (lines ~200, 220, `window.alert`)  
- `src/features/scheduling/components/CoverageRequestsPanel.tsx` (line ~80, `window.alert`)  
- `src/features/scheduling/pages/SchedulingPage.tsx` (likely uses `onSuccess` callback but no Toast)

**Issue:** The task requires success/error feedback via the existing `Toast` component rendered inline. The implementation uses `window.alert` and plain error divs instead.  
**Required change:** Replace all `window.alert` calls and error divs with the `Toast` component, driven by local state. Ensure success messages (e.g., “Shift created”, “Coverage requested”) also use Toast.

---

### 3. Missing test for edit mode in `ShiftEditorModal`

**File:** `src/features/scheduling/components/ShiftEditorModal.test.tsx`  
**Issue:** The test only covers `createShift`. The edit mode (`shiftToEdit` prop) calls `updateShift` but is not tested. This is touched behaviour.  
**Required change:** Add a test that passes a `shiftToEdit` prop, fills the form, and asserts `updateShift` is called with the correct `shiftId` and updated fields.

---

### 4. Missing test for availability hint in `ShiftEditorModal`

**File:** `src/features/scheduling/components/ShiftEditorModal.test.tsx`  
**Issue:** The availability hint (green/amber banner) is a core feature of the modal (AC-6) but is not tested. The component queries `listAvailabilityForScheduling` and renders an eligibility panel.  
**Required change:** Add a test that mocks `listAvailabilityForScheduling` returning windows and verifies the correct hint text (“Eligible — safe to schedule”, “No availability declared”, “Availability does not cover slot”) is displayed.

---

### 5. Missing test for caregiver filter in `SchedulingPage`

**File:** `src/features/scheduling/pages/SchedulingPage.test.tsx`  
**Issue:** The page includes a caregiver filter dropdown (AC-3) but the test does not verify that changing the filter re-queries `listShifts` with the selected `caregiverId`.  
**Required change:** Add a test that selects a caregiver from the filter and asserts `listShifts` is called with the expected `caregiverId`.

---

### 6. Missing test for override kind mapping in `AvailabilityPage`

**File:** `src/features/scheduling/pages/AvailabilityPage.test.tsx`  
**Issue:** The task requires mapping UI kind `override` to backend kind `one-off`. The test only covers `recurring` windows. The override path is not tested.  
**Required change:** Add a test that selects “Override” kind, fills date/time, and asserts `addAvailabilityWindow` is called with `kind: 'one-off'`.

---

### 7. Potential issue: `AvailabilityPage` kind mapping (cannot verify from truncated diff)

**File:** `src/features/scheduling/pages/AvailabilityPage.tsx` (truncated in diff)  
**Issue:** The diff does not show the submit handler. If the mapping from `override` to `one-off` is missing, the backend will reject the request.  
**Required change:** Verify the submit handler maps `override` → `'one-off'` and add the test above to confirm.

---

### 8. Minor: `ShiftPacketPanel` uses `window.print()` – acceptable but not tested

No blocker, but note that the print functionality is not covered by any test. Not required by the task.

---

### Verdict

The implementation is largely correct and passes all gates, but misses three acceptance criteria (AC-3, AC-13) and lacks tests for four touched behaviours (edit mode, availability hint, caregiver filter, override kind). These are concrete blockers per the review guidelines.

VERDICT: CHANGES_REQUESTED