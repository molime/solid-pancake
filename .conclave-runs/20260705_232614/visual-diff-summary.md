# ATRIA-X Scheduling Visual Diff Summary

Generated: 2026-07-06

## Method

- Started the dev server with `VITE_ENABLE_SCREENSHOT_MOCKS=true` on port 5180.
- Captured live PNGs with Playwright at:
  - Desktop: 1440×900
  - Mobile: 390×844
- Compared against the @2x Figma exports in `.hermes-pipeline/20260705_232547/`.
- Full side-by-side report: [`visual-diff-summary.html`](visual-diff-summary.html)

## Screenshots captured

| View | Desktop | Mobile |
|---|---|---|
| scheduling | `scheduling-desktop.png` | `scheduling-mobile.png` |
| shift-editor | `shift-editor-desktop.png` | `shift-editor-mobile.png` |
| shift-packet | `shift-packet-desktop.png` | `shift-packet-mobile.png` |
| coverage | `coverage-desktop.png` | `coverage-mobile.png` |
| caregiver-schedule | `caregiver-schedule-desktop.png` | `caregiver-schedule-mobile.png` |
| availability | `availability-desktop.png` | `availability-mobile.png` |

## Observations

### scheduling
- Live matches the Figma calendar week (Mon Jun 15 – Sun Jun 21) and “THU 18 · TODAY” highlight.
- Shift card colors, layout, and content align with the reference.
- Live includes the current ATRIA-X sidebar nav, caregiver filter dropdown, week navigator, and open-coverage panel at the bottom; these are functional additions not present in the older Figma export.

### shift-editor
- Live now opens the editor pre-filled with the featured Saturday shift (Rosa Díaz, Lucía Fernández, Sat Jun 20, 9 AM–1 PM), matching the Figma form values.
- The live modal title reads “Edit shift” because it uses the `shiftToEdit` prop; the Figma reference reads “New shift” while showing pre-filled values.
- The eligibility panel shows a coverage warning because the mock Saturday availability window is marked unavailable; this is data-consistent with the availability view.

### shift-packet
- Live matches Figma: Saturday visit for Rosa Díaz, Scheduled status badge, client/caregiver cards, care-plan checklist, admin actions, and audit history.

### coverage
- Correctly renders the caregiver “Request coverage” screen with the shift-to-cover card and eligible coworkers list, matching the Figma reference.

### availability (mobile)
- Mobile list rows match the Figma structure and green time windows.
- The week label reflects the frozen date (Jun 22–28); the Figma caption reads Jun 23–29, but the frozen Thursday date (Jun 25) naturally yields a Mon–Sun week of Jun 22–28.

### caregiver-schedule (mobile)
- No Figma reference PNG was supplied for this state. Live capture shows the mobile caregiver schedule list with greeting, upcoming visit cards, and Scheduled status badges.

## Gates status

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ (395 passed)
- `npm run build` ✅
