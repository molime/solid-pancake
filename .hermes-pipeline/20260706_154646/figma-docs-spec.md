# ATRIA-X Session 8 — Document Archive + Forms Renderer Figma Spec

Exported from Figma channel `ixrb6ut2` (Page 1). Frames inspected 2026-07-06.

## Frames of record

| Frame ID | Name | Use |
|----------|------|-----|
| 156:173 | Document Archive / Browser | Primary archive desktop UI |
| 192:2773 | HR / Document Archive View | Alternate archive desktop layout (reference) |
| 156:112 | Forms / Dynamic Form Renderer | Form renderer states (empty, filled, error, submitted) |

## Global shell / layout tokens

- App bg: `#0b0f10`
- Sidebar bg: `#101517`
- Sidebar width: 248px
- Active nav pill: `#22c55e` at 16% opacity, 12px radius; 3px green accent bar on left edge
- Inactive nav text: `#9aa6a8`, 16px Inter Medium
- Active nav text: `#22c55e`, 16px Inter SemiBold
- Content surface: `#151b1d` with 1px stroke `#2a3437`, 16px radius
- Page heading: `#f5f7f6`, 26px Inter Bold
- Page subtitle: `#9aa6a8`, 16px Inter Regular
- Card input bg: `#0f1314` / `#1e2629` with stroke `#2a3437`; focused/valid border `#22c55e`; error border `#ef4444`
- Primary green: `#22c55e`
- Error red: `#ef4444`
- Warning amber: `#f59e0b`
- Pending blue: `#3b82f6`
- Muted text: `#687173`
- Text on dark: `#f5f7f6`
- 2-space code style, single quotes, no semicolons

## Document Archive / Browser (156:173)

Layout
- Full desktop frame 1440x1024.
- 248px left sidebar; main content starts at x=1928 (288px inset relative to sidebar = same gutter as other admin screens).
- Header: title "Document Archive" + subtitle "All uploaded documents — credentials, forms, certificates, and HR files in one place."
- Top-right action: "+ Upload" button green `#22c55e` 44px high, 22px radius.

Filter bar (y≈19170, between header and table)
- Search box: 280x44, bg `#1e2629`, stroke `#2a3437`, 10px radius, placeholder "🔍 Search documents…" in `#687173`.
- Filter chips (right of search, gap 10-14px):
  - Entity chip (active): green transparent 16% bg, green text, 18px radius, e.g. "Entity: Employees"
  - Type chip (inactive): `#1e2629` bg, `#2a3437` stroke, `#9aa6a8` text, e.g. "Type: All ▾"
  - Status chip (inactive): same style, "Status: All ▾"
  - Expiring soon chip (active): amber transparent 16% bg, amber text, ⚠ prefix.

Table / surface (1928, 19230, 1128x780)
- Surface `#151b1d`, stroke `#2a3437`, radius 16.
- Header row text uppercase, `#687173`, 13px SemiBold: EMPLOYEE, DOCUMENT, TYPE, UPLOADED, EXPIRES, STATUS.
- 1px `#2a3437` divider under header and between rows.
- Row layout (mock data):
  1. Maria Ramos — CPR Certification — Credential — Jun 1 2026 — Jun 1 2027 — green pill "● Valid" — green "View →"
  2. Jorge Méndez — Driver's License — ID Document — Jan 12 2026 — Jul 14 (in 27d) amber — amber pill "● Expiring soon" — green "View →"
  3. Ana Torres — First Aid Certificate — Credential — Mar 5 2025 — Jun 2 (14d ago) red — red pill "● Expired" + subtext "Cannot be scheduled or billed" — green "View →"
  4. Carlos Vega — Signed Offer Letter — HR Form — Jun 14 2026 — "—" — blue pill "● Pending review" — green "View →"
  5. Lucia Morales — Training Acknowledgment — Training Ack. — Jun 10 2026 — Jan 15 2027 — green pill "● Valid" — green "View →"
  6. Robert Díaz — Safety Certificate — Certificate — Apr 20 2025 — Jun 29 (in 12d) amber — amber pill "● Expiring soon" — green "View →"
  7. Patricia Núñez — Background Check — HR Form — Jun 16 2026 — "—" — blue pill "● Pending review" — green "View →"

Status pills
- Valid: green transparent 16% bg + green text + green dot, radius 15, height 30.
- Expiring soon: amber transparent 16% bg + amber text + amber dot, height 30.
- Expired: red transparent 16% bg + red text + red dot, height 30; show "Cannot be scheduled or billed" subtitle on row.
- Pending review: blue transparent 16% bg + blue text + blue dot, height 30.

Action column
- "View →" green `#22c55e`, 14px Medium. Implementation may also expose Verify/Reject buttons inline; keep text same weight/color and any added buttons styled with small green/red outlines matching existing StatusBadge component.

## HR / Document Archive View (192:2773)

Reference only; main archive page should be functionally identical to Browser frame. Notable differences:
- Sidebar nav order: Dashboard, Candidates, Employees, Credentials, Cases, Documents (active).
- Header copy: "All employee documents — credentials, forms, certificates, and HR files."
- Entity chip is labeled "Entity: Employees ▾".
- Columns identical: EMPLOYEE, DOCUMENT, TYPE, UPLOADED, EXPIRES, STATUS, VIEW.
- Subtitle blocker text under expired rows: "Cannot be scheduled or billed".
- Same colors/type scale.

## Forms / Dynamic Form Renderer (156:112)

Layout
- 1440x1024 desktop frame with 248px sidebar; active nav = "Forms".
- Heading "New Employee Form" + subtitle "Fill in each section below. Your progress is saved automatically."
- Two columns:
  - Left form card (288, 19170, 740x820) — main form fields
  - Right progress card (1052, 19170, 364x820) — progress sidebar

Left form card
- Surface `#151b1d`, stroke `#2a3437`, radius 16.
- Section headings inside card: "Personal Information", "Employment Details" — 18px Inter Bold, `#f5f7f6`.
- Field label: 13px Inter SemiBold uppercase, `#687173`, e.g. "FULL NAME", "DATE OF BIRTH", "PHONE NUMBER", "ROLE", "START DATE".
- Input box: bg `#0f1314`, stroke `#2a3437`, 10px radius, 52px height; focused/valid stroke `#22c55e`; error stroke `#ef4444`.
- Input text: 16px Inter Medium, `#f5f7f6`; placeholder text 16px Inter Regular, `#687173`.
- Inline error: 13px Inter Medium, `#ef4444`, ⚠ prefix.
- Autosave pill: `#1e2629` 16% bg, `#9aa6a8` text, "◌ Saving…" 13px.
- Submit button: full-width 676x52, green `#22c55e` when enabled, grayed `#1e2629` when disabled, 26px radius, label "Submit Form" 17px SemiBold.
- Helper text under disabled state: "Fix the errors above before submitting", 13px Regular, `#687173`.

Right progress card
- Same surface/stroke/radius.
- "Your progress" 16px Bold + "2 of 3 sections complete" 13px Regular `#9aa6a8`.
- Progress track 316x8, `#1e2629` bg, green fill.
- Section rows: done = green transparent 8% bg + green text; error = red transparent 8% bg + red text; pending = `#1e2629` bg + `#687173` text.
- Helper paragraph: 13px Regular, `#9aa6a8`.

Field types required (reusable component)
- text → label + input
- textarea → label + textarea
- select → label + dropdown with ▾
- checkbox → label + checkbox
- date → label + input type="date" (show placeholder MM/DD/YYYY when empty)
- number → label + input type="number"
- Required fields show red asterisk after label.

## Functional requirements preserved from task

1. DocumentArchivePage at /documents, roles org:admin or org:hr.
2. Filter bar: type dropdown (All / ID / Certification / Signed form / Other), status filter (All / Pending / Verified / Rejected / Expired), 'Expiring soon' toggle (30-day window), entity search input by name.
3. Table columns: DOCUMENT / TYPE / LINKED TO / STATUS / EXPIRES / ACTIONS (align with Figma: EMPLOYEE may be LINKED TO).
4. StatusBadge colors: pending_review gray, verified green, rejected red, expired red.
5. Verify → optimistic update + toast; Reject → modal with rejectionReason textarea.
6. Click row name → DocumentDetailPanel slide-in from right.
7. Uses listDocumentArchive query with filters.
8. DocumentDetailPanel: file name (link to download URL if available), type, linked entity, status badge, expiry, verifiedBy/verifiedAt, rejectionReason if rejected, Verify/Reject buttons, close.
9. DocumentArchiveRoute.tsx lazy wrapper.
10. DynamicFormRenderer generic reusable component; client-side required validation; inline errors; loading state.
11. FormSubmissionPage at /forms/:formDefinitionId, roles org:candidate/caregiver/admin/hr; fetch listFormDefinitions, submit via submitForm mutation; toast + navigate /onboarding for candidates.
12. Update router and Sidebar with Documents nav for admin/hr.
13. Tests listed in task.
14. Style + gates.

## Exported PNG assets (this run)

- `document-archive-browser.png` (frame 156:173)
- `hr-document-archive-view.png` (frame 192:2773)
- `forms-dynamic-form-renderer.png` (frame 156:112)
