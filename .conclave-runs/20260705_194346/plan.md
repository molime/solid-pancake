# Session 5 Implementation Plan: Scheduling & Shift Management

## 1. Restated Goal & Acceptance Criteria

**Goal:** Build the Scheduling & Shift Management frontend for ATRIA-X on branch `feature/phase-2-worker-onboarding`, matching the Figma ground truth in `.hermes-pipeline/20260705_194120/`. Add three role-protected routes, six new screens/components, sidebar navigation, and tests. Reuse only the existing `src/shared/ui` primitives and Convex `api.scheduling.*` backend.

**Acceptance Criteria:**

- **AC-1 (Routes):** `src/app/router.tsx` lazily loads and protects:
  - `/scheduling` for `org:admin`/`org:coordinator`.
  - `/caregiver/schedule` and `/caregiver/availability` for `org:caregiver`.
- **AC-2 (Sidebar):** `src/app/shell/Sidebar.tsx` shows **Schedule** (admin/coordinator), **Schedule** + **Availability** (caregiver), using `CalendarDays` and `Clock`.
- **AC-3 (SchedulingPage):** Mon–Sun weekly calendar with day headers, today highlight, stacked shift cards (caregiver name, time range, client last name), caregiver filter, "+ Add shift" button, and `EmptyState` when `listShifts.items` is empty.
- **AC-4 (ShiftEditorModal):** Create mode calls `api.scheduling.createShift` with `clerkOrgId`, `clientId`, `caregiverId`, `scheduledStart`, `scheduledEnd`, `serviceType`, `rate`, optional `serviceLocationOverride`. Edit mode calls `api.scheduling.updateShift` with `shiftId` plus changed fields.
- **AC-5 (ShiftEditorModal conflict):** On backend `ConvexError` containing `Shift conflicts with ...`, parse the conflicting start/end ISO strings and display:  
  `"Schedule conflict: this caregiver already has a shift from HH:MM to HH:MM on this date."`
- **AC-6 (ShiftEditorModal availability hint):** When caregiver + date + start + end are set, derive availability using `api.scheduling.listAvailabilityForScheduling`. Show green "Available" if covered, amber "No availability declared — shift can still be created" if no windows exist, amber "Caregiver availability does not cover this slot." if windows exist but do not cover.
- **AC-7 (ShiftPacketPanel):** Slide-in/modal panel shows status badge, client/caregiver names, start/end, service type, rate, geofence override address. Admin/coordinator view shows Edit and Delete (confirm) buttons. Caregiver view shows Request Coverage when `status === 'scheduled'`.
- **AC-8 (ShiftPacketPanel audit):** Renders `api.audit.list` events filtered client-side by `shiftId`, showing actor role, action, and timestamp.
- **AC-9 (CoverageRequestsPanel):** Lists open coverage requests from `api.scheduling.listCoverageRequests({ status: 'open' })`. Each row shows shift date, requester caregiver name, reason, status badge. "Assign" opens caregiver dropdown and calls `api.scheduling.resolveCoverage({ coverageRequestId, reassignedTo })`.
- **AC-10 (CaregiverSchedulePage):** Mobile-first upcoming shift list at `/caregiver/schedule`, calling `api.scheduling.listCaregiverShifts`. Tapping a row opens `ShiftPacketPanel` in caregiver view.
- **AC-11 (AvailabilityPage):** Mobile-first Mon–Sun rows plus override form at `/caregiver/availability`. Calls `api.scheduling.listMyAvailability`, `addAvailabilityWindow`, `deleteAvailabilityWindow`. Maps UI kind `override` to backend kind `one-off`.
- **AC-12 (Visual fidelity):** All interactive targets ≥ 44px, body type ≥ 16px, dark tokens only, status shown as color + word. Live screenshots match the five exported PNGs within token/spacing tolerance.
- **AC-13 (Toast):** Success/error feedback uses the existing `Toast` component rendered inline (no global toast provider exists).
- **AC-14 (Tests):** Vitest tests cover: SchedulingPage loading + populated + empty states; ShiftEditorModal calls `createShift` with correct args and shows conflict error; AvailabilityPage renders and calls `addAvailabilityWindow`; CoverageRequestsPanel resolves a request.
- **AC-15 (Quality gates):** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.
- **AC-16 (Visual regression):** After implementation, run `npm run dev`, capture screenshots of `/scheduling`, `/caregiver/schedule`, `/caregiver/availability`, and the ShiftEditor/ShiftPacket/CoverageRequest states, and compare against `.hermes-pipeline/20260705_194120/*.png`.

## 2. Discovery Notes

Verified by reading the actual repo files:

- **Routing & auth:** `src/app/router.tsx` uses `TenantRoleRouteGuard` with `allowedRoles` inside the `AppShell` layout. `src/app/shell/RouteGuard.tsx` fetches `api.members.me` to determine role and redirects unauthorized users. `src/app/shell/Sidebar.tsx` filters `navItems` by `member.role`.
- **Backend scheduling module (`convex/scheduling.ts`):**
  - `createShift` args: `clerkOrgId`, `clientId: Id<'clients'>`, `caregiverId: string`, `scheduledStart: string`, `scheduledEnd: string`, `serviceType: 'SLS' | 'ILS'`, `rate: number`, optional `serviceLocationOverride`.
  - `updateShift` args: `clerkOrgId`, `shiftId: Id<'shifts'>`, optional `clientId`, `caregiverId`, `scheduledStart`, `scheduledEnd`, `serviceType`, `rate`, `serviceLocationOverride`.
  - `deleteShift` requires `org:admin` and `status === 'scheduled'`.
  - `listShifts` returns `{ items, hasMore, nextCursor }`; items are enriched with `clientDisplayName` and `caregiverDisplayName`.
  - `listCaregiverShifts` returns an array of enriched shifts for the authenticated caregiver.
  - `requestCoverage` (caregiver), `resolveCoverage` (admin/coordinator), `listCoverageRequests` (admin/coordinator) with optional `status` filter.
  - `addAvailabilityWindow`, `deleteAvailabilityWindow`, `listMyAvailability`, `listAvailabilityForScheduling`.
  - Conflict error text format: `Shift conflicts with ${id} (${scheduledStart} - ${scheduledEnd})`.
- **Supporting APIs:** `api.members.listCaregivers` returns `tenantMembers` docs (verified in `convex/members.ts`). `api.clients.list` returns `clients` docs. `api.audit.list` returns `auditEvents` (verified in `convex/audit.ts`).
- **Schema (`convex/schema.ts`):** `shifts` include `serviceLocationOverride: { label, addressLine?, latitude, longitude, radiusMeters? }`. `availabilityWindows` use `kind: 'recurring' | 'one-off'`. `coverageRequests` use `status: 'open' | 'filled' | 'cancelled'`.
- **UI primitives (`src/shared/ui/*`):** `Button`, `Dialog` (with `DialogHeader`, `DialogTitle`, `DialogContent`, `DialogFooter`), `Input`, `Select`, `StatusBadge`, `EmptyState`, `Card`/`CardHeader`/`CardTitle`/`CardContent`, `FieldGroup`, `Textarea`, `Badge`, `Checkbox`, `Table` family, `Separator`, `Toast`. `StatusBadge` uses `@/shared/utils/cn` (other components use `@/shared/lib/cn`); both resolve to the same helper.
- **Styling:** `src/index.css` defines dark tokens (`atria-bg`, `atria-surface`, `atria-accent`, `atria-text-*`, `atria-border-*`, radius variables). No new Tailwind classes or light-theme colors.
- **Formatting helpers:** `src/shared/format.ts` exposes `formatTime`, `formatWeekdayDate`, `formatDurationHours`, `formatAddress`, `formatStreetAddress`, `formatCurrency`, `formatStatusLabel`.
- **Testing pattern:** Existing `src/features/clients/pages/ClientsPage.test.tsx` mocks `@clerk/react` and `convex/react`, uses `getFunctionName` from `convex/server` to dispatch mock values by function reference, and places tests next to the component file.
- **Date/time seam:** Existing `ClientsPage` constructs `${date}T${time}:00Z` directly, but the Figma spec asks for local-time semantics. The backend stores ISO strings and checks availability in UTC (`getUTCDayOfWeek`, `formatUTCTime`). The plan resolves this with a local-to-UTC helper.
- **No global toast provider:** `Toast.tsx` is a presentational component only; toast must be driven by local React state.

## 3. Alternatives Considered

| Alternative | Why Rejected | Chosen Approach |
|-------------|--------------|-----------------|
| Place all new files flat under `src/features/scheduling/` exactly as the task bullet lists them. | Diverges from the existing `pages/` + `components/` convention used by `clients`, `team`, `caregiver`, and from the Figma spec file tree. | Use `src/features/scheduling/pages/` for routed pages and `src/features/scheduling/components/` for shared components, matching existing codebase layout. |
| Build ISO strings as `${date}T${time}:00Z` like `ClientsPage` does. | Treats user input as UTC, which will shift displayed times away from the Figma local-time values when rendered with `toLocaleTimeString`. | Use `new Date(`${date}T${time}`).toISOString()` so the selected local date/time is stored as the correct UTC instant and displayed back correctly. |
| Add a global toast provider/context. | Introduces new surface area and conflicts with the "No new Radix/shadcn deps" / minimal-change directive. | Render the existing `Toast` component inline from page-level state for success/error feedback. |
| Extend backend to return requester name and full shift/caregiver details for coverage rows. | Backend is already implemented; task says to use existing APIs. | Enrich coverage rows client-side by joining `members.listCaregivers` and `listShifts` data. |
| Implement ShiftPacketPanel as a true animated slide-in drawer. | No drawer/sheet primitive exists; adding animation libraries is out of scope. | Use the existing `Dialog` modal (same visual weight, simpler, matches testability). |

## 4. Files to Create / Modify

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/features/scheduling/pages/SchedulingPage.tsx` | Create | Weekly calendar, top bar, caregiver filter, Add shift button, empty state, shift-card grid. |
| `src/features/scheduling/components/ShiftEditorModal.tsx` | Create | Create/edit shift form with client/caregiver selects, date/time inputs, service type, rate, availability hint, conflict error. |
| `src/features/scheduling/components/ShiftPacketPanel.tsx` | Create | Modal detail panel: status, client/caregiver, time, service type, rate, geofence override, role-based actions, audit history. |
| `src/features/scheduling/components/CoverageRequestsPanel.tsx` | Create | List of open coverage requests with caregiver assign dropdown and `resolveCoverage` call. |
| `src/features/scheduling/pages/CaregiverSchedulePage.tsx` | Create | Mobile-first caregiver shift list; opens packet in caregiver view. |
| `src/features/scheduling/pages/AvailabilityPage.tsx` | Create | Recurring/override availability editor; add/delete windows. |
| `src/features/scheduling/schedulingUtils.ts` | Create | Helper `toIsoFromLocal(date, time)` and week-range helpers. |
| `src/features/scheduling/pages/SchedulingPage.test.tsx` | Create | Loading, populated, empty-state render tests. |
| `src/features/scheduling/components/ShiftEditorModal.test.tsx` | Create | `createShift` args and conflict-error tests. |
| `src/features/scheduling/pages/AvailabilityPage.test.tsx` | Create | Render and `addAvailabilityWindow` call test. |
| `src/features/scheduling/components/CoverageRequestsPanel.test.tsx` | Create | Resolve coverage request test. |
| `src/app/router.tsx` | Modify | Add lazy imports and three `TenantRoleRouteGuard` routes: `scheduling`, `caregiver/schedule`, `caregiver/availability`. |
| `src/app/shell/Sidebar.tsx` | Modify | Add Schedule nav item for admin/coordinator; add Schedule + Availability items for caregiver; import `Clock`. |
| `tests/e2e/scheduling.spec.ts` (optional) | Create | Playwright critical-flow tests if e2e credentials are available; otherwise rely on unit tests + manual screenshot comparison. |

## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

- **Multi-tenancy:** Every Convex function verifies tenant membership and role via `requireTenantRole`. The frontend only passes `clerkOrgId` from `useOrganization().organization.id`; never manually construct or trust a tenant id.
- **Role guards:** Route guards in `router.tsx` and conditional UI buttons both hide admin actions, but the backend is the authoritative enforcer (e.g., `deleteShift` only allows `org:admin`).
- **Timezones:** Store ISO 8601 UTC instants via `new Date(`${date}T${time}`).toISOString()`. Display with `formatTime`/`formatWeekdayDate`, which render in the browser's local time.
- **Conflict idempotency:** Disable the Save button while the mutation is pending; do not allow double submission. Parse the exact conflict error string for the user-friendly message required by AC-5.
- **Availability mapping:** UI label "override" maps to backend kind `"one-off"`; "recurring" maps one-to-one. Validate `endTime > startTime` before calling the backend (backend also validates).
- **PHI:** Client names and caregiver names are rendered directly; avoid logging shift/client data to the console. Audit history contains actor ids/roles and is tenant-scoped.
- **Delete safety:** `deleteShift` rejects non-`scheduled` shifts on the backend. The UI should hide or disable Delete for non-scheduled shifts to avoid errors.
- **Coverage integrity:** `resolveCoverage` checks that the request is still `open`, the selected caregiver exists and has no conflicting shift, and patches both the shift caregiver and the request status. The UI should refresh after resolution.
- **Audit filtering:** `api.audit.list` returns the latest 200 tenant audit events; the panel filters client-side by `shiftId` and sorts descending.
- **Touch targets / type:** All buttons, inputs, cards, and dropdowns must have min-height ≥ 44px; body text must remain ≥ 16px (`text-base`).

## 6. Test Strategy

**Unit / integration tests (Vitest):**

- `SchedulingPage.test.tsx`
  - Renders loading state while `listShifts` is `undefined`.
  - Renders `EmptyState` when `items` is empty.
  - Renders shift cards for a populated week.
  - Changing caregiver filter re-queries `listShifts` with the selected `caregiverId`.
- `ShiftEditorModal.test.tsx`
  - Selecting client/caregiver, date, times, service type, rate, and saving calls `createShift` with the expected ISO start/end and `serviceLocationOverride` omitted when empty.
  - Simulated backend conflict throws the backend error text; component displays `"Schedule conflict: this caregiver already has a shift from HH:MM to HH:MM on this date."`
  - Edit mode pre-fills form and calls `updateShift` with `shiftId`.
- `AvailabilityPage.test.tsx`
  - Renders the Mon–Sun list and existing windows.
  - Submitting the add-window form calls `addAvailabilityWindow` with `kind: 'recurring'` or `kind: 'one-off'` for overrides.
- `CoverageRequestsPanel.test.tsx`
  - Renders open requests with requester name and reason.
  - Selecting a caregiver and clicking Assign calls `resolveCoverage` with the correct `coverageRequestId` and `reassignedTo`.

**End-to-end / visual regression:**

- If e2e Clerk credentials are configured, add `tests/e2e/scheduling.spec.ts` covering admin create shift → appears on calendar → resolve coverage.
- Regardless, after `npm run dev`, manually capture screenshots of every state and compare side-by-side with:
  - `scheduling-calendar.png`
  - `scheduling-shift-editor.png`
  - `scheduling-shift-packet.png`
  - `scheduling-coverage-request.png`
  - `caregiver-availability-management.png`

**Gate commands:**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7. Rollback / Verification Notes

- **Rollback:** All changes are additive on `feature/phase-2-worker-onboarding`. If critical failures occur, revert the branch to its pre-merge state; no database migrations are required because the backend is already in place.
- **Codegen:** This plan modifies no `convex/*` backend files, so `npx convex codegen` is not required. If the implementer extends a backend file for any reason, run `npx convex codegen` immediately after.
- **Pre-merge verification checklist:**
  1. `npm run lint` passes with no new errors.
  2. `npm run typecheck` passes.
  3. `npm run test` passes (including the new scheduling tests).
  4. `npm run build` produces a production bundle.
  5. `npm run dev` loads `/scheduling`, `/caregiver/schedule`, and `/caregiver/availability` without runtime errors.
  6. Sidebar shows the correct nav items for each role.
  7. Live screenshots match the five exported Figma PNGs; any divergence triggers a fix pass before approval.
- **Known risk / watch item:** The date/time conversion helper must be verified against the Figma local-time screenshots. If screenshots show an hour offset, switch the helper to match the local timezone exactly and re-test conflict detection and availability hints.
