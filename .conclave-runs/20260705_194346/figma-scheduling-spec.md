# SESSION 5 — ATRIA-X Scheduling Screens Figma Spec

Exported from Figma channel `7y2m4o5m` on 2026-07-05. These PNGs and this spec are the ground
truth for the FE implementation. The review stage must compare live app screenshots against the
exported PNGs in this directory.

## Exported frames (PNG ground truth)

| Screen | Figma frame id | Figma frame name | Exported PNG path |
| --- | --- | --- | --- |
| A | `151:269` | Scheduling / Calendar | `.hermes-pipeline/20260705_194120/scheduling-calendar.png` |
| B | `154:969` | Scheduling / Shift Editor | `.hermes-pipeline/20260705_194120/scheduling-shift-editor.png` |
| C | `175:1849` | Caregiver / Availability Management | `.hermes-pipeline/20260705_194120/caregiver-availability-management.png` |
| D | `155:87` | Scheduling / Coverage Request | `.hermes-pipeline/20260705_194120/scheduling-coverage-request.png` |
| E | `155:51` | Scheduling / Shift Packet | `.hermes-pipeline/20260705_194120/scheduling-shift-packet.png` |

All exports are @2x PNG from the exact Figma frames. Do not crop or re-colour them.

## Design tokens (dark theme)

Source of truth: `C:\Users\pinol\Documents\Work\atriax\design\design-system-tokens.md`.

### Surfaces
- `color/bg/base`        → `#0A0E0F`  app/page bg
- `color/bg/sunken`      → `#070A0B`  deepest
- `color/surface/1`      → `#11171A`  card bg
- `color/surface/2`      → `#161D21`  raised / input bg
- `color/surface/3`      → `#1C262B`  hover / input field bg
- `color/sidebar/bg`     → `#0C1113`
- `color/border/subtle`  → `#1F2A2F`  hairline
- `color/border/default` → `#2A373D`  card/input borders
- `color/border/strong`  → `#3A4A52`  focus

### Text
- `color/text/primary`   → `#F2F6F7`
- `color/text/secondary` → `#AEBCC2`
- `color/text/muted`     → `#6E808A`
- `color/text/disabled`  → `#49575E`
- `color/text/onAccent`  → `#04140E`

### Brand / accents
- `color/accent/primary`      → `#16A34A` (green buttons, selected nav, success)
- `color/accent/primaryHover` → `#15833D`
- `color/accent/primaryQuiet` → `rgba(22,163,74,0.14)`
- step/info blue → `#3B82F6`
- warning/amber → `#F59E0B`
- danger/red → `#EF4444`

### Status semantic mapping (color + word, never color alone)
Map `ShiftStatus` to `StatusBadge` variant:
- `scheduled`        → `neutral`  (dot + word: Scheduled)
- `in_progress`      → `info`     (dot + word: In Progress)
- `submitted`        → `warning`  (dot + word: Submitted)
- `needs_correction` → `danger`   (dot + word: Needs Correction)
- `approved`         → `success`  (dot + word: Approved)
- `billing_ready`    → `info`     (dot + word: Billing Ready)

Use the existing `StatusBadge` component; it already follows this mapping.

### Typography (Inter)
- Page title: 28px / 34px / 700 (`text/display`)
- Section title: 18px / 24px / 600 (`text/h2`)
- Card title: 17px / 21px / 700
- Body: 16px / 24px / 400
- Small/secondary: 14px / 20px / 400
- Caption/badge/label: 13px / 16px / 500-700
- Base page type must stay ≥16px.

### Spacing / sizing
- Card padding: 24px
- Page gutter: 32px desktop, 16px mobile
- Touch targets: ≥44px (cards, buttons, dropdowns)
- Sidebar desktop: 240px (existing shell uses `w-[240px]`)
- Primary button height: 44px desktop, 52px mobile
- Calendar day column width: ~150px
- Shift card height: 70px

### Radius
- `radius/sm`  → 8px  (badges, inputs)
- `radius/md`  → 12px (cards, nav active pill)
- `radius/lg`  → 16px (calendar card, modal, panels)
- `radius/pill` → 999px (primary buttons)

## Screen A — Scheduling / Calendar (desktop coordinator/admin)

Frame id: `151:269`. Frame size: 1440×1024.

### Layout
- Full page inside `AppShell`. Sidebar active item is **Schedule** (`📅 Schedule`).
- Top bar left: page title "Schedule" (`text/display`), subtitle "Week of June 15–21 · client visits and caregiver coverage" (`text/secondary`, 16px).
- Top bar right: primary green button "+ Add shift" (160×44, radius pill, emerald fill, on-accent text).
- Below top bar: large card `calendar-card` (1128×760, `#151b1d`, border `#2a3437`, radius 16).
- Inside card: 7 day column headers `MON 15` … `SUN 21` (13px bold, muted `#9aa6a8`). Thursday header reads `THU 18 · TODAY` in a slightly lighter muted `#687173`. Sunday also uses `#687173`.
- Divider line under headers: `#2a3437`, 1px, full width.
- Today column (Thu) has a subtle tinted background: `rgba(34,197,94,0.05)` (green 5% opacity), radius 8.
- Shift cards are 140×70, radius 10, stacked vertically per day, with no overlap.

### Shift card content (Screen A)
Each shift card shows:
- Top line: caregiver name (14px / 600, primary text)
- Bottom line: `HH–HH · Client last name` (13px / 400, secondary text)

Figma example cards:
- MON 15 8–11 · Torres (blue)
- MON 15 13–16 · Ríos (blue)
- TUE 16 9–12 · Sánchez (blue)
- WED 17 14–17 · Kim (blue)
- THU 18 8–11 · Torres (green)
- THU 18 13–16 · Ríos (green)
- FRI 19 ⚠ Open shift / 10–13 · needs cover (red)
- SAT 20 9–12 · Sánchez (blue)

Card background colours (18% opacity):
- blue (`#3b82f6`) for normal assigned shifts
- green (`#22c55e`) for the “today” column shifts
- red (`#ef4444`) for open/unassigned shifts

### Behaviour
- Clicking any shift card opens `ShiftPacketPanel` (slide-in or modal).
- Clicking "+ Add shift" opens `ShiftEditorModal` for a new shift.
- Empty state: use `EmptyState` with title "No shifts this week", description "Add a shift to start scheduling caregivers.", action "Add shift" primary button.
- Filter by caregiver: add a `<Select>` dropdown in the top bar labelled "Filter by caregiver" with an "All caregivers" option. Use `members.listCaregivers`.

### Data
- Query: `api.scheduling.listShifts` with `{ clerkOrgId, startDate, endDate }`.
- Map `clientDisplayName`, `caregiverDisplayName` from returned items.

## Screen B — Scheduling / Shift Editor (modal)

Frame id: `154:969`. Modal card shown at x=1928, y=8710, width 740, height 620, radius 16, fill `#151b1d`, border `#2a3437`.

### Form fields (left column inside modal)
All inputs 692×52, radius 10, fill `#0f1315`, border `#2a3437`. Caregiver select has active border `#22c55e`.

Labels (13px / 600, muted `#687173`, ALL CAPS):
- CLIENT
- CAREGIVER
- DATE
- TIME (right column)
- SERVICE TYPE
- NOTES (OPTIONAL)

Values shown in Figma:
- Client: "Rosa Díaz"
- Caregiver: "Lucía Fernández" with chevron `▾`
- Date: "📅  Sat, Jun 20, 2026"
- Time: "🕘  9:00 AM – 1:00 PM"
- Service type: "Personal care & companionship"
- Notes placeholder: "Add anything the caregiver should know…"

### Implementation requirements
- CLIENT: `<Select>` calling `api.clients.list`. Show `displayName`. Required.
- CAREGIVER: `<Select>` calling `api.members.listCaregivers`. Show `displayName`. Required.
- DATE: `<Input type="date">`.
- TIME: two `<Input type="time">` side by side (start / end).
- SERVICE TYPE: `<Select>` with options `SLS` and `ILS`.
- RATE: number `<Input>` (USD hourly rate). Label "RATE". Required, >0.
- NOTES (optional): reuse `<Textarea>` or `<Input>` for an internal note. Optional.
- Inline availability hint: when caregiver + start + end are all set, call `api.scheduling.listAvailabilityForScheduling({ caregiverId })` or derive locally. If any window covers the full slot, show a green pill/text "Available". If the caregiver has no declared windows at all, show amber text "No availability declared — shift can still be created". If a window exists but does not cover the slot, show the backend warning text "Caregiver availability does not cover this slot." in amber.

### Action buttons
- Primary "Save shift" (160×48, emerald, pill radius 24, on-accent text).
- Secondary "Cancel" (120×48, `#151b1d` fill, `#2a3437` border, muted text).

### Submit behaviour
- Call `api.scheduling.createShift` with:
  - `clerkOrgId`, `clientId`, `caregiverId`, `scheduledStart` (ISO), `scheduledEnd` (ISO), `serviceType`, `rate`, optional `serviceLocationOverride`.
- Build ISO from selected date + start/end time strings using `YYYY-MM-DDTHH:mm:ss` interpreted as local time (Figma is local). Use the same `toISOString()` conversion the rest of the app uses.
- On success: close modal, toast "Shift created", refresh `listShifts`.
- On conflict error from server: show inline error exactly:
  > Schedule conflict: this caregiver already has a shift from HH:MM to HH:MM on this date.
  Parse the returned `ConvexError` message (`Shift conflicts with ...`) and render a user-friendly sentence with formatted times from the conflicting shift.

### Pre-fill for edit
- When opened from `ShiftPacketPanel` "Edit shift", load the shift into the form.
- On submit call `api.scheduling.updateShift` with the same field shape plus `shiftId`.

## Screen C — Caregiver / Availability Management (mobile-first)

Frame id: `175:1849`. Mobile frame 390×844.

### Layout
- Back link "← My Schedule" (green `#22c55e`, 14px / 600).
- Title "My Availability" (`text/display`).
- Subtitle "Set the days and times you're available to work this week." (15px secondary).
- Section caption "Week of Jun 23 – Jun 29, 2026" (13px muted).
- List of day rows (Mon–Sun), each row 350×56, radius 12, fill `#151b1d`, inside a mobile card container.
  - Left: day name (16px / 600 primary)
  - Right: declared window time in green (`#22c55e`) if available, or "Unavailable"/"Off" in muted (`#9aa6a8`) if not declared/unavailable.
- Bottom primary "Save changes" button 350×52, emerald, radius 26.
- Note below button: "Changes apply to this week only. Update again next week." (13px muted).

### Add window form
- Each row has a small "Add" / "Edit" affordance (≥44px) that expands an inline form.
- Form fields:
  - Kind toggle/segment: `recurring` / `override`
  - If `recurring`: day-of-week select (already known from row)
  - If `override`: date `<Input type="date">`
  - Start time `<Input type="time">`
  - End time `<Input type="time">`
  - Available toggle (boolean)
- Each existing window has a Delete button (red ghost, ≥44px).

### Behaviour
- On add: call `api.scheduling.addAvailabilityWindow({ clerkOrgId, kind, dayOfWeek, date, startTime, endTime, available, note })`.
- On delete: call `api.scheduling.deleteAvailabilityWindow({ clerkOrgId, windowId })`.
- Persisted immediately per-window (no batch save needed), but keep the “Save changes” button as a no-op or page-level toast to match the Figma CTA.

## Screen D — Scheduling / Coverage Request (coordinator/admin resolution)

Frame id: `155:87`. Frame 1440×1024.

### Layout
- Back link "← Back to Schedule" (blue `#3b82c5`, 14px / 600).
- Title "Request coverage" (`text/display` or 28/34/700).
- Subtitle "Can't make a shift? Ask an eligible coworker to cover it. Your coordinator approves the swap."
- Shift to cover card (720×132, `#151b1d`, border `#2a3437`, radius 16):
  - Label "SHIFT TO COVER" (13px / 700 muted)
  - "Rosa Díaz · Personal care" (19px / 700 primary)
  - "Sat, Jun 20, 2026 · 9:00 AM – 1:00 PM · 4 hours" (15px secondary)
- "Eligible coworkers" section title (18px / 700) + helper "Only coworkers with valid credentials and no schedule conflict are shown." (14px muted).
- List card (720×288, same card style). Rows separated by 1px `#2a3437` dividers.
  - Each row: coworker name (17px / 600 primary), status line in green "✓ All credentials valid · available Sat morning" (14px).
  - Right side of each row: "Ask to cover" button (150×40, emerald quiet bg 16% opacity, emerald text, radius 20).

### Implementation requirements
- This screen is the **coordinator/admin resolution view**, not the caregiver ask view.
- Show open coverage requests from `api.scheduling.listCoverageRequests({ clerkOrgId, status: 'open' })`.
- Each row displays:
  - shift date (formatted)
  - caregiver name (the original requester)
  - reason
  - status badge `open` (amber)
  - "Assign" button that opens a small inline dropdown of caregivers (`members.listCaregivers`).
- On assign: call `api.scheduling.resolveCoverage({ clerkOrgId, coverageRequestId, reassignedTo })`. The backend already checks conflict and updates the shift caregiver.
- Status badge mapping for coverage requests:
  - `open`      → `warning`  (amber) label "Open"
  - `filled`    → `success`  label "Filled"
  - `cancelled` → `neutral`  label "Cancelled"

## Screen E — Scheduling / Shift Packet (slide-in panel / modal)

Frame id: `155:51`. Frame 1440×1024; content card sits at x=5280 (inside the slide-in panel).

### Layout
- Back link "← Back to Schedule" (blue).
- Title "Saturday visit — Rosa Díaz" (28px / 700 primary).
- Subtitle "Sat, Jun 20, 2026 · 9:00 AM – 1:00 PM · 4 hours" (16px secondary).
- Status pill top-right: amber pill "● Scheduled" (fill `rgba(245,158,11,0.16)`, text `#f59e0b`, radius 16).

### Cards
Two info cards side by side (350×200, `#151b1d`, border `#2a3437`, radius 16):
- CLIENT card
  - Label "CLIENT"
  - Name "Rosa Díaz" (19px / 700)
  - Address/contact lines (15px secondary) with emoji bullets: 📍, 🏠, 📞
- CAREGIVER card
  - Label "CAREGIVER"
  - Name "Lucía Fernández" (19px / 700)
  - Phone, credential summary, rating/visits (15px secondary)

### Tasks / care plan card
- 720×300 card below.
- Title "Care plan for this visit" (17px / 700)
- Subtitle "The caregiver confirms each item during the visit."
- Checklist rows with a checkbox square (22×22, `#0f1315`, border `#2f393c`, radius 6) and task label (15px primary).
- Figma sample tasks: "Help with morning bath and dressing", "Prepare breakfast (low-sodium diet)", "Medication reminder at 10:00 AM", "Light housekeeping in kitchen and bedroom", "15-minute walk if weather allows".

### Action buttons (coordinator/admin view)
- "Edit shift" primary emerald button (150×48, radius 24).
- "Cancel shift" danger outline button (150×48, red border, red text).
- "🖨 Print packet" link (blue, 15px / 600) — implement as `window.print()` or no-op with `print` intent.

### Caregiver view
- Hide Edit / Cancel.
- Show "Request Coverage" button if `status === 'scheduled'`. Clicking opens a small reason dialog and calls `api.scheduling.requestCoverage({ clerkOrgId, shiftId, reason })`.

### Audit history
- Bottom section "Audit history" (title 18px / 700).
- If `api.audit.list` returns events for this shift, render a timestamped list: actor role, action, createdAt.
- If unavailable, render nothing.

## Routes to add

In `src/app/router.tsx` inside the `<Route element={<AppShell />}>` block:

```tsx
const SchedulingPage = lazy(() =>
  import('@/features/scheduling/pages/SchedulingPage').then((m) => ({ default: m.SchedulingPage })),
)
const CaregiverSchedulePage = lazy(() =>
  import('@/features/scheduling/pages/CaregiverSchedulePage').then((m) => ({ default: m.CaregiverSchedulePage })),
)
const AvailabilityPage = lazy(() =>
  import('@/features/scheduling/pages/AvailabilityPage').then((m) => ({ default: m.AvailabilityPage })),
)
```

Add routes:
- `/scheduling` → `TenantRoleRouteGuard(['org:admin', 'org:coordinator'])` → `SchedulingPage`
- `/caregiver/schedule` → `TenantRoleRouteGuard(['org:caregiver'])` → `CaregiverSchedulePage`
- `/caregiver/availability` → `TenantRoleRouteGuard(['org:caregiver'])` → `AvailabilityPage`

## Sidebar updates

In `src/app/shell/Sidebar.tsx` add to `navItems`:

```tsx
{
  label: 'Schedule',
  path: '/scheduling',
  icon: <CalendarDays className="h-4 w-4" />,
  roles: ['org:admin', 'org:coordinator'],
},
{
  label: 'Schedule',
  path: '/caregiver/schedule',
  icon: <CalendarDays className="h-4 w-4" />,
  roles: ['org:caregiver'],
},
{
  label: 'Availability',
  path: '/caregiver/availability',
  icon: <Clock className="h-4 w-4" />,
  roles: ['org:caregiver'],
},
```

`Clock` icon must be imported from `lucide-react`.

## File tree to create

All new files go under `src/features/scheduling/`:

```
src/features/scheduling/
├── pages/
│   ├── SchedulingPage.tsx
│   ├── CaregiverSchedulePage.tsx
│   └── AvailabilityPage.tsx
├── components/
│   ├── ShiftEditorModal.tsx
│   ├── ShiftPacketPanel.tsx
│   └── CoverageRequestsPanel.tsx
└── model/
    └── schedulingUtils.ts   (optional helpers)
```

## Backend APIs to use (already implemented)

- `api.scheduling.listShifts` — admin/coordinator weekly view
- `api.scheduling.listCaregiverShifts` — caregiver list
- `api.scheduling.createShift`
- `api.scheduling.updateShift`
- `api.scheduling.deleteShift`
- `api.scheduling.requestCoverage`
- `api.scheduling.resolveCoverage`
- `api.scheduling.listCoverageRequests`
- `api.scheduling.listMyAvailability`
- `api.scheduling.addAvailabilityWindow`
- `api.scheduling.deleteAvailabilityWindow`
- `api.scheduling.listAvailabilityForScheduling`
- `api.members.listCaregivers`
- `api.clients.list`
- `api.audit.list`

## Code style rules

- 2-space indent, single quotes, no semicolons.
- Use `src/shared/ui/*` primitives: `Button`, `Dialog`, `Input`, `Select`, `StatusBadge`, `EmptyState`, `Card`, `FieldGroup`, `Textarea`, `Badge`.
- Use `cn` from `@/shared/lib/cn`.
- Dark tokens only; do not add light-theme colors or new Tailwind classes.
- Touch targets ≥44px; type ≥16px for body.
- No new Radix/shadcn dependencies.
- Author tests in `src/features/scheduling/` or adjacent `*.test.tsx` files.

## Acceptance criteria

1. All five exported PNGs are present in `.hermes-pipeline/20260705_194120/`.
2. Implementation matches frame layout, colours, copy, and typography within 2px / same token.
3. `SchedulingPage` renders loading and populated states; empty state shown when no shifts.
4. `ShiftEditorModal` calls `createShift` with correct args and shows conflict error as specified.
5. `CoverageRequestsPanel` resolves a request and updates status.
6. `AvailabilityPage` renders and calls `addAvailabilityWindow`.
7. Routes and sidebar nav items work for the correct roles.
8. Gates: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.
