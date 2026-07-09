# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260705_194346\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 212.4s rc=0

• Completed the discovery and synthesized the candidate plans into one final implementation plan.

  **Saved to:** `.conclave-runs/20260705_194346/plan.md`

  ---

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


[stderr]
• We need read prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260705_194346\plan_synthesis.prompt.md and carry out instructions. Use Read.We need carry out instructions from prompt file: produce a premium implementation plan with 7 sections, synthesize candidate plans into one coherent best-of-all plan. We have to read the actual relevant files because agentic CLI. So need do discovery: read figma spec, existing router, sidebar, shared UI, convex scheduling, members, clients, audit, tests patterns, etc. Then produce plan. We likely should write plan to `.conclave-runs/20260705_194346/plan.md` or maybe output final. Need determine path. The prompt says output final answer/verdict as requested. It expects plan markdown. We should create a plan file and output final. Need discover. Let's set TodoList. Use Agent explore maybe. But we can read directly. The prompt says discovery requirement: must open and read actual relevant files. We'll do parallel reads of spec, router, sidebar, UI components, convex backend, tests. Need gather actual function names/types. Then synthesize. Let's use TodoList.We need read files. We can batch reads. Let's read figma spec path `.hermes-pipeline/20260705_194120/figma-scheduling-spec.md` (relative project root). Need check path exists. Use Read. Also list PNGs in that dir. Read router.tsx, Sidebar.tsx, shared ui primitives, convex scheduling.ts etc. We can issue multiple Reads in parallel. Let's start with spec and key files. Use absolute paths to avoid issue? Tools accept relative from working dir. We'll use relative.We have read spec, router, sidebar, backend. Now need inspect shared UI primitives, existing feature pages/tests, data model, generated api, route guard, index.css tokens, etc. Let's read relevant shared UI components: Button, Dialog, Input, Select, StatusBadge, EmptyState, Card, FieldGroup, Textarea, Badge, Checkbox, Table, Separator, AppLoader, Toast? Use Glob to list shared/ui. Also read clients feature page and test for patterns. Also route guard. Let's do parallel reads.We have much info. Need inspect shared UI components specifics. Read Button, Dialog, Input, Select, StatusBadge, EmptyState, Card, FieldGroup, Textarea, Badge, Checkbox, Table, Separator, Toast, index exports. Also read format utilities. Also generated API shape (api.d.ts). Let's read.Need read domain types, generated api, data model. Also inspect package.json for scripts, tsconfig paths, maybe Table/Separator. Let's read.Need read tsconfig.app.json for path aliases. Also maybe check existing feature scheduling directory absent. Also check tests setup. Let's read tsconfig.app, vitest config maybe, eslint config, shiftQueries listMyShifts for shape. Also inspect scheduling spec exported PNGs maybe use ReadMedia? Might not need. But we need verify frames exist. Let's list PNGs. Also check shifts.ts? Not needed. But helpful. Let's read tsconfig.app and shiftQueries.We have enough. Need maybe read schema for shifts/availability/coverage fields. Could read convex/schema.ts. Also read Table/Separator maybe. But not strictly needed for plan. We should verify schema shape. Read schema.ts. Also existing test setup file? There is src/test maybe. Let's read src/test/setup.ts and an example test.We have comprehensive discovery. Now update todos. Then synthesize plan. Need produce final plan markdown with 7 sections. We should decide file path. The prompt says output final answer/verdict. In conclave runs, plan likely saved to `.conclave-runs/20260705_194346/plan.md`. The candidate c_plan_agentic already produced plan.md, but we need synthesize. We can overwrite with final plan. The instructions say "Do NOT edit the repo directly outside the pipeline" but .conclave-runs is pipeline output directory. So okay. We'll write plan.md. Then final message summarizing.

  Need produce premium implementation plan. Include restated goal & acceptance criteria numbered AC-1... Discovery notes citing actual function/type names. Alternatives. Files table. Edge cases. Test strategy. Rollback.

  Synthesize candidate plans and our discovery. Need resolve conflicts:
  - Candidate c_plan_agentic used actual discovery, noted date/time ISO conflict. Candidate qwen chat-only. Candidate kimi maybe partial. We should use actual discovery.
  - File structure: Prompt says create `src/features/scheduling/` with six files directly, not pages/components subfolders. But figma spec suggests pages/components subfolders. The prompt says "Create `src/features/scheduling/` with: 1. `SchedulingPage.tsx` ...". It does not explicitly require subfolders. The figma spec says file tree with pages/components/model. We need decide. The task statement lists files directly under scheduling. The safest is to follow task statement exactly: create files in `src/features/scheduling/`. But the figma spec provides a file tree with subfolders. The prompt says "Ground truth is the Figma spec... Kimi must implement from that spec, and the review stage must compare live app screenshots against those exported PNGs." The file tree is an implementation detail, not visible. The acceptance criteria doesn't mention file tree. We can choose either. The existing app uses `src/features/clients/pages/ClientsPage.tsx`, `src/features/caregiver/pages/...`, `src/features/team/pages/...`. So convention is pages subfolder. The task statement says create directly under `src/features/scheduling/`. To align with existing codebase convention and Figma spec, we should place pages under `src/features/scheduling/pages/` and components under `src/features/scheduling/components/`. But the task statement says "Create `src/features/scheduling/` with: `SchedulingPage.tsx` ..." It doesn't forbid subfolders. The implementer can decide. In plan, we can state file paths as `src/features/scheduling/pages/SchedulingPage.tsx` and `src/features/scheduling/components/ShiftEditorModal.tsx` etc., matching existing conventions and Figma spec. This is better. Need mention that route imports point to these files.

  - Date/time ISO conflict: Figma spec says use local time `YYYY-MM-DDTHH:mm:ss` interpreted as local. Existing ClientsPage uses `${date}T${time}:00Z` (UTC). Backend scheduling.ts availability check uses UTC (getUTCDayOfWeek, formatUTCTime) and filters use `T00:00:00.000Z`. So if we send local ISO without Z, backend will interpret as UTC? Actually new Date('2026-06-20T09:00:00') uses local timezone, then toISOString yields UTC offset. The backend uses getUTCDayOfWeek etc. To be consistent, we should send UTC strings. The Figma spec is contradictory. The task statement says "Build ISO from selected date + start/end time strings using `YYYY-MM-DDTHH:mm:ss` interpreted as local time (Figma is local). Use the same `toISOString()` conversion the rest of the app uses." Wait it says interpreted as local time but also same toISOString conversion. Existing app uses Z suffix. We need choose. Since backend uses UTC, the chosen approach should match backend. Use a helper that builds a local-date-time UTC string? Actually `${date}T${time}:00Z` treats the selected date and time as UTC. If user selects 9:00 AM in CDMX, it stores 09:00 UTC, which when displayed with toLocaleTimeString in CDMX shows 4:00 AM (if CDT -5). That's wrong. Existing ClientsPage likely has bug? Wait formatTime uses toLocaleTimeString, so if stored as 09:00Z, in US Central (UTC-5) displays 4:00 AM. But maybe the app is intended for UTC? The backend checkAvailability uses UTC, so it expects times in UTC. Figma spec local time is for display. The correct approach: treat user input as local time, convert to ISO string (with Z) representing same moment. E.g., `new Date(`${date}T${time}`).toISOString()`. That stores the selected local time as UTC timestamp. Then display using toLocaleTimeString converts back to local. That is consistent. The ClientsPage uses `${date}T${time}:00Z`, which is actually treating input as UTC, not local. But for a scheduling app in a single timezone, if all clients and caregivers are in same timezone, maybe they input times in UTC? Hmm.

  The task statement explicitly says "Build ISO from selected date + start/end time strings using `YYYY-MM-DDTHH:mm:ss` interpreted as local time (Figma is local). Use the same `toISOString()` conversion the rest of the app uses." This suggests we should use local Date constructor and toISOString. But existing ClientsPage doesn't. We can note in plan that the implementation should use `new Date(`${date}T${time}`).toISOString()` to preserve local-time semantics and align with backend UTC storage; flag that if Figma review reveals mismatch with existing ClientsPage, adjust. Actually the plan is for implementer; we can instruct them to use a helper `toIsoFromLocal(date, time)` that returns `new Date(\`${date}T${time}\`).toISOString()`. This is safest.

  But the candidate plan says use `${date}T${time}:00Z` convention. We should resolve. Use local-to-UTC conversion. We'll include in plan.

  - Toast: No global provider. Use inline Toast component rendered conditionally (e.g., in page corner) for success/error. Or a local toast state. The plan should note no toast provider; use local inline Toast.

  - AvailabilityPage: spec says kind recurring/override. Backend addAvailabilityWindow uses kind union 'recurring' | 'one-off'. The task says kind recurring/override. Backend accepts 'one-off' for date overrides. So map 'override' -> 'one-off'. Need note.

  - CoverageRequestsPanel: The task says "Each row: shift date, caregiver name, reason, status badge open/filled/cancelled. 'Assign' button opens caregiver dropdown and calls resolveCoverage." The backend listCoverageRequests returns request + shift + clientName, not requester display name. We may need to fetch caregiver names for requester. It returns requesterId. The panel can display requester name by looking up members? But no query for member by id. We can call members.listCaregivers to get list and match requesterId/reassignedTo. Or use shift.caregiverId? Actually requester is original caregiver. Could display using members.listCaregivers. Plan can note.

  - ShiftPacketPanel: For admin view, show client/caregiver details. Need fetch full client details (address) and caregiver details? listShifts returns display names only. For phone/address, we can fetch clients.get and members? members.me? No get member. We can use clients.get for client address. For caregiver phone/credentials, not readily available. The panel may need to display only what's available: display names, times, service type, rate, geofence override. Plan can note limited details if backend doesn't expose; if needed, extend backend minimally? The task says use existing backend. So show only available fields. But Figma shows address/contact and credential summary. We can fetch client via clients.get to get serviceAddress; caregiver details can come from members.listCaregivers. The ShiftPacketPanel can call clients.get and members.listCaregivers to enrich. Or the parent page passes shift. Plan should mention.

  - Audit history: api.audit.list returns all tenant events. Filter client-side by shiftId. Need note.

  - ShiftEditorModal conflict error: Backend throws `Shift conflicts with ${conflict._id} (${conflict.scheduledStart} - ${conflict.scheduledEnd})`. Need parse scheduledStart/End from message to produce "Schedule conflict: this caregiver already has a shift from HH:MM to HH:MM on this date." Use formatTime.

  - Routes: use lazy imports. Route paths in router are relative without leading slash? Existing uses `path="clients"` not `/clients`. The figma spec uses `/scheduling` etc. In react-router v7 nested under AppShell, path can be `scheduling` (relative). The route element path strings don't have leading slash; NavLink uses `/scheduling`. So add `path="scheduling"` etc. The spec shows `/scheduling`. It works either way. Use `path="scheduling"` to match existing style.

  - Sidebar: import Clock from lucide-react. Add nav items.

  - Tests: Use vitest, mock convex/react and @clerk/react, use getFunctionName. Place tests next to files or in `__tests__`. Existing ClientsPage.test.tsx is next to page. We'll follow that: `src/features/scheduling/SchedulingPage.test.tsx`, etc.

  - Visual regression: After implementation, run dev and capture screenshots compare to PNGs. We can mention use playwright or manual screenshots.

  Need ensure plan includes all required sections. Let's update todo.Now write plan.md. Need be concise but complete. Use markdown. Ensure actual function names: api.scheduling.listShifts returns { items, hasMore, nextCursor }. listCaregiverShifts returns items[] directly. createShift args, updateShift args, requestCoverage, resolveCoverage, listCoverageRequests, listMyAvailability, addAvailabilityWindow, deleteAvailabilityWindow, listAvailabilityForScheduling. members.listCaregivers returns tenantMembers (clerkUserId, displayName, email). clients.list returns clients (displayName etc). audit.list returns auditEvents.

  Need include acceptance criteria numbered. Let's create ~16 criteria. Align with task and figma.

  Need alternatives considered:
  - Flat vs pages/components subfolders. Choose subfolders matching existing app.
  - Local-time vs UTC string construction. Choose local Date -> toISOString.
  - Global toast provider vs inline Toast. Choose inline.
  - Coverage request row enrichment: fetch caregivers list and match requesterId, vs backend extension. Choose client-side matching.
  - Slide-in vs modal for ShiftPacketPanel: use Dialog (modal) because existing Dialog is modal; mention slide-in can be achieved but no animation library. Use Dialog for simplicity and visual parity.

  Need files table. List create/modify. Could include tests.

  Need edge cases: multi-tenancy via requireTenantRole, role guards, no manual orgId, timezones, conflict idempotency (disable submit), PHI, audit filtering, coverage status, delete only scheduled, availability kind mapping, touch targets.

  Need test strategy: unit tests specific cases, e2e visual regression, gate commands.

  Need rollback: branch feature/phase-2-worker-onboarding, revert changes, run codegen if convex changed (not needed? If no backend changes, none). After editing convex/* run codegen, but we are not editing convex. So no codegen. But plan can mention if backend extended, run codegen.

  Let's write. Need output to file. Use Write path `.conclave-runs/20260705_194346/plan.md`.Now update todo to done. Then final response. Need mention final plan saved to path. Since user asked output final answer/verdict as requested. We can provide concise final message and maybe include key highlights. Should we include full plan? The plan is large. The user likely wants the plan. In final answer, maybe include the plan itself? Since we wrote to file, but the instruction says output final answer. To be safe, final answer should include the full plan markdown? But that may be very long. However the tool output can handle. The user explicitly said "Output your final answer/verdict as requested." The plan is the requested output. The file is helpful. I think final response can state plan completed and saved, with a summary, not paste entire plan. But the user may want it inline. Let's read prompt again: "Produce a premium implementation plan with ALL of the following sections... output only the final plan as markdown." The prompt file instructs to output only final plan as markdown. The user's instruction says "carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested." So the final answer should be the plan markdown. We should output the full plan in the final message. Since we already wrote to file, we can also mention file path. But final answer should contain plan. Let's output the plan markdown (maybe same content). We can copy from file? We have content. Let's include it. But need not too verbose? It's okay. The final answer can be the plan. I'll output it. But before, update todo.Now final answer with full plan. Include note that plan saved to file. Need ensure same language English. We'll output markdown.

To resume this session: kimi -r session_41369557-cd72-4d49-bdb6-d0d7ac8a013e
