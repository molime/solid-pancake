# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: Atria-X Scheduling & Shift Management (Session 5)

## 1. Restated Goal & Acceptance Criteria

**Goal:** Implement the Scheduling & Shift Management feature set for Atria-X across Admin/Coordinator and Caregiver roles, adhering strictly to the Figma spec (`.hermes-pipeline/20260705_194120/figma-scheduling-spec.md`), existing UI system, and Convex backend contracts.

**Acceptance Criteria:**
- **AC-1 (Admin Calendar):** `SchedulingPage` renders a Mon–Sun weekly calendar with shift cards, date nav, caregiver filter, and 'Add shift' button. Empty state handled.
- **AC-2 (Shift CRUD):** `ShiftEditorModal` creates/updates shifts via `api.scheduling`. Validates conflicts (shows specific error message). Supports edit mode.
- **AC-3 (Shift Details):** `ShiftPacketPanel` displays shift details, audit history, and role-based actions (Edit/Delete for Admin, Request Coverage for Caregiver).
- **AC-4 (Coverage):** `CoverageRequestsPanel` lists open requests. Admin/Coordinator can assign a caregiver via `api.scheduling.resolveCoverage`.
- **AC-5 (Caregiver Schedule):** `CaregiverSchedulePage` (route `/caregiver/schedule`) shows mobile-first list of upcoming shifts for the logged-in caregiver.
- **AC-6 (Availability):** `AvailabilityPage` (route `/caregiver/availability`) allows caregivers to manage recurring/override availability windows.
- **AC-7 (Navigation):** Sidebar updated with correct links/icons per role. Routes protected by Clerk organization role checks.
- **AC-8 (Visual Fidelity):** Live app screenshots match exported Figma PNGs (dark mode, touch targets >= 44px).
- **AC-9 (Quality Gates):** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.

## 2. Discovery Notes

**Constraint Acknowledgement:** I am operating in a chat-only context. I **have not inspected the actual files** in the repository. The implementer (agent executing this plan) **MUST** verify the following before writing code:

1.  **Convex API Signatures:** Verify exact argument types and return shapes for:
    -   `api.scheduling.listShifts`, `createShift`, `updateShift`, `resolveCoverage`
    -   `api.scheduling.listCaregiverShifts`, `listMyAvailability`, `addAvailabilityWindow`, `deleteAvailabilityWindow`
    -   `api.clients.list`, `api.members.listCaregivers`, `api.audit.list`
    -   *Check:* Do these functions enforce multi-tenancy via `authHelpers` internally? (Frontend assumes yes, but verify no extra tenantId args needed).
2.  **UI Component Inventory:** Inspect `src/shared/ui/*` to map requirements to existing components:
    -   Modal → `src/shared/ui/dialog.tsx` or `modal.tsx`?
    -   Button → `src/shared/ui/button.tsx` (verify variants for destructive/secondary).
    -   Input/Select → `src/shared/ui/input.tsx`, `select.tsx`.
    -   Toast → Verify toast provider is mounted in `src/app/root.tsx` or similar.
3.  **Router Structure:** Inspect `src/app/router.tsx` to confirm pattern for protected routes (e.g., `<ProtectedRoute role={['org:admin']} />`).
4.  **Sidebar Pattern:** Inspect `src/app/shell/Sidebar.tsx` to see how nav items are conditionally rendered based on Clerk roles.
5.  **Figma Spec:** Open `.hermes-pipeline/20260705_194120/figma-scheduling-spec.md` and associated PNGs to confirm exact color tokens, spacing, and layout behavior (especially mobile vs desktop).

## 3. Alternatives Considered

| Approach | Why Rejected | Chosen Approach |
| :--- | :--- | :--- |
| **New UI Lib (shadcn)** | Adds bundle size, diverges from existing `src/shared/ui` system, violates "No new Radix/shadcn deps" constraint. | **Reuse Existing:** Map requirements to `src/shared/ui/*` + `@/shared/lib/cn`. |
| **Full Calendar Lib** | Heavy dependency, hard to match Figma custom design exactly. | **Custom Grid:** Build CSS Grid for Mon–Sun columns to ensure exact visual match. |
| **Single Page w/ Roles** | Complex conditional rendering, harder to test, violates separation of concerns. | **Separate Routes:** `/scheduling` (Admin) vs `/caregiver/*` (Caregiver) for clearer auth boundaries. |
| **Optimistic UI** | Risk of conflict errors desyncing UI state during shift creation. | **Wait for Mutation:** Await `api.scheduling.createShift` response to handle conflict errors explicitly. |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/features/scheduling/SchedulingPage.tsx` | Create | Admin weekly calendar, filter, shift cards, empty state. |
| `src/features/scheduling/ShiftEditorModal.tsx` | Create | Form for create/update, conflict error handling, availability hint. |
| `src/features/scheduling/ShiftPacketPanel.tsx` | Create | Slide-in panel, audit history, role-based actions. |
| `src/features/scheduling/CoverageRequestsPanel.tsx` | Create | List open requests, assign caregiver dropdown. |
| `src/features/scheduling/CaregiverSchedulePage.tsx` | Create | Mobile-first shift list for caregivers. |
| `src/features/scheduling/AvailabilityPage.tsx` | Create | Caregiver availability management (recurring/override). |
| `src/app/router.tsx` | Modify | Add routes for `/scheduling`, `/caregiver/schedule`, `/caregiver/availability`. |
| `src/app/shell/Sidebar.tsx` | Modify | Add nav items (CalendarDays, Clock icons) conditional on role. |
| `src/features/scheduling/__tests__/*` | Create | Vitest tests for components (loading, states, mutations). |
| `e2e/scheduling.spec.ts` | Create | Playwright tests for critical flows (create shift, resolve coverage). |

## 5. Data/Auth/Security/Multi-Tenant Edge Cases

-   **Multi-Tenancy:** All Convex calls implicitly scope to the user's organization via Clerk `org_id`. Verify no manual `orgId` passing is required in frontend args.
-   **Role Guards:**
    -   `/scheduling` must reject `org:caregiver`.
    -   `/caregiver/*` must reject `org:admin` (or redirect).
    -   UI buttons (Edit/Delete) hidden via logic, but API must also enforce (backend responsibility, frontend verifies).
-   **Timezones:** Shifts are likely stored in UTC. Frontend must display in user's local time (CDMX default). Verify `Date` handling in `ShiftEditorModal`.
-   **Conflict Detection:** Backend returns error on overlap. Frontend must parse this specific error string and display it inline (not just a generic toast).
-   **PHI:** Client names visible in shifts. Ensure no logging of PII in console during dev.
-   **Touch Targets:** All interactive elements (buttons, cards) must have `min-height: 44px` and adequate padding for mobile care workers.
-   **Idempotency:** `createShift` should be idempotent or handled gracefully if double-clicked (disable button during pending state).

## 6. Test Strategy

**Unit Tests (Vitest):**
-   `SchedulingPage`: Renders loading skeleton, renders empty state, renders shift cards.
-   `ShiftEditorModal`: Validates required fields, calls `createShift` with correct payload, displays conflict error message.
-   `AvailabilityPage`: Renders existing windows, calls `addAvailabilityWindow` on submit.
-   `CoverageRequestsPanel`: Calls `resolveCoverage` with selected caregiver ID.

**E2E Tests (Playwright):**
-   **Admin Flow:** Login as Admin → Navigate to Schedule → Add Shift → Verify appears on calendar → Edit Shift → Delete Shift.
-   **Conflict Flow:** Create overlapping shift → Verify error message appears → Cancel.
-   **Caregiver Flow:** Login as Caregiver → View Schedule → Request Coverage → View Availability → Add Override.
-   **Visual Regression:** Capture screenshots of `/scheduling` (empty, populated), `/caregiver/schedule`, `/caregiver/availability`. Compare against `.hermes-pipeline/.../*.png`.

**Gate Commands:**
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7. Rollback & Verification Notes

-   **Rollback:** Since this is on branch `feature/phase-2-worker-onboarding`, simply abandon or revert the branch if critical failures occur. No database migrations are expected (backend APIs assumed ready).
-   **Verification:**
    1.  Run `npm run dev`.
    2.  Manually verify all 3 routes load without console errors.
    3.  Verify Sidebar links appear only for correct roles.
    4.  **Critical:** Compare live screens against Figma PNGs side-by-side. Any divergence in spacing, color, or font size requires a fix pass.
    5.  Confirm Convex backend logs show no auth errors during API calls.
-   **Model Swap:** If quality bar is met but token usage is high, downshift from Sonnet to cheaper model for subsequent refactors, but keep Sonnet for this initial implementation to ensure visual fidelity.