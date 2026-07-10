# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The recent changes introduce the scheduling feature routes and corresponding sidebar navigation items, correctly guarded by role‑based `TenantRoleRouteGuard`s and wired to the new lazy‑loaded page components. All related unit tests for the new components (SchedulingPage, ShiftEditorModal, AvailabilityPage, CoverageRequestsPanel) pass, and the existing Sidebar tests also succeed with the added items. No security concerns (e.g., leaking org IDs) are introduced, and the routing paths align with the app’s existing relative‑path conventions. All acceptance criteria are satisfied.

VERDICT: APPROVED