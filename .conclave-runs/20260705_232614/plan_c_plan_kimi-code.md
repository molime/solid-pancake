# ATRIA-X Session 5 Follow-up — Visual Regression & Figma Match Plan

Branch: `feature/phase-2-worker-onboarding`  
Scope: Dev-only screenshot harness + authenticated visual regression fixes for Scheduling & Shift Management screens.  
Date: 2026-07-06

---

## 1. Restated Goal & Acceptance Criteria

**Goal:** Enable Conclave reviewers to verify the ATRIA-X Scheduling UI against the exported Figma frames without real Clerk credentials, then fix any visible divergence so the live rendered output matches the Figma ground truth within 2 px / same token.

### Acceptance Criteria

- **AC-1** A dev-only screenshot harness exists behind `VITE_ENABLE_SCREENSHOT_MOCKS=true` and is never imported or resolved in production builds.
- **AC-2** The harness mocks `@clerk/react` and `convex/react` sufficiently for the scheduling pages to render with fake auth, fake data, and fake mutations.
- **AC-3** `vite.config.ts` resolves `@clerk/react` → `src/dev/mockClerkReact.tsx` and `convex/react` → `src/dev/mockConvexReact.tsx` only when `VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`.
- **AC-4** `src/app/router.tsx` exposes `/dev/screenshots?view=...` inside `AppShell` only in dev + when `VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`.
- **AC-5** The harness supports `view=scheduling|shift-editor|shift-packet|coverage|caregiver-schedule|availability`, and renders the corresponding production component with a fixed `Date.now` so the calendar shows the Figma week (Mon Jun 15 – Sun Jun 21, 2026) with Thursday as "today".
- **AC-6** Live PNGs are captured at desktop (1440×900) and mobile (390×844) viewports and compared side-by-side with the Figma PNGs in `.hermes-pipeline/20260705_232547/`.
- **AC-7** Visible divergences in real scheduling components are fixed: colors, spacing, radius, typography, status badge wording/colors, button shapes, card layout, icon usage, and empty state.
- **AC-8** All gates pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **AC-9** No new production dependencies; no new Radix/shadcn packages.
- **AC-10** Multi-tenancy guards remain intact in production; the harness bypasses auth only inside `src/dev/*` files resolved by the dev alias.

---

## 2. Discovery Notes

### Verified repo seams

- **Branch:** `feature/phase-2-worker-onboarding` is checked out.
- **Routes:** `src/app/router.tsx` already declares `/scheduling`, `/caregiver/schedule`, and `/caregiver/availability` inside the `AppShell` block, guarded by `TenantRoleRouteGuard`. The lazy imports are `SchedulingPage`, `CaregiverSchedulePage`, and `AvailabilityPage` from `src/features/scheduling/pages/*`.
- **Sidebar:** `src/app/shell/Sidebar.tsx` already includes the three nav items (`Schedule` for admin/coordinator + caregiver, `Availability` for caregiver) and reads role from `api.members.me`. Visible items are filtered by `item.roles.includes(role)`.
- **Route guards:** `TenantRouteGuard` uses `useAuth`/`useOrganization` and `api.members.checkMembership`; `TenantRoleRouteGuard` uses `useOrganization` + `api.members.me`. Both are Clerk-dependent and must be mocked to render the harness.
- **Vite config:** `vite.config.ts` exports an async `defineConfig`. The `resolve.alias` map currently only contains `@`. The config already supports dynamic `mode` checks, so adding a conditional alias branch is straightforward.
- **Design tokens:** `src/index.css` declares a dark-only `@theme` with `--color-atria-*`. The Figma PNGs use slightly different hex values (e.g., Figma green `#22c55e` vs. CSS `--color-atria-success: #2fbf71`; Figma blue `#3b82f6` vs. `--color-atria-info: #4d8df6`; Figma red `#ef4444` vs. `--color-atria-danger: #f0564a`; Figma amber `#f59e0b` vs. `--color-atria-warning: #f0b429`). Because these are global tokens used elsewhere, do **not** change them unless the design-system file confirms it. Instead, apply Figma-specific colors locally inside the scheduling components using Tailwind arbitrary values or new CSS variables scoped to the feature.
- **Shared UI primitives:** `Button` supports `variant: primary|secondary|danger|ghost|sidebar|sidebarActive` and `size: sm|md|lg|icon|sidebar`. Primary is already `rounded-full`, which matches the Figma pill buttons. `Dialog` is a centered modal with `DialogHeader/DialogTitle/DialogContent/DialogFooter`. `StatusBadge` maps `ShiftStatus` to variants and is already "color + word". **Bug found:** `StatusBadge.tsx` imports `cn` from `@/shared/utils/cn`, which does not exist in this repo; the rest of the app uses `@/shared/lib/cn`. This will fail build/lint and must be fixed.
- **Scheduling components:**
  - `SchedulingPage` renders a 7-column calendar, `CoverageRequestsPanel` below the calendar, `ShiftEditorModal`, and `ShiftPacketPanel`. Week anchor defaults to `getWeekStart(new Date())`.
  - `ShiftEditorModal` has a two-column layout (form + eligibility panel) but the eligibility panel currently shows generic rows. Figma expects credential/conflict checks.
  - `ShiftPacketPanel` renders client/caregiver info cards and a care-plan checklist.
  - `CoverageRequestsPanel` is currently an inline admin reassignment panel (`Select` + `Assign` button), not the caregiver-facing "Request coverage" page shown in Figma.
  - `AvailabilityPage` currently shows editable day rows with an inline "Add window" form; Figma shows a read-only-looking weekly list with a big "Save changes" CTA.
- **Backend APIs used:** `api.scheduling.listShifts`, `api.scheduling.listCaregiverShifts`, `api.scheduling.createShift`, `api.scheduling.updateShift`, `api.scheduling.deleteShift`, `api.scheduling.requestCoverage`, `api.scheduling.resolveCoverage`, `api.scheduling.listCoverageRequests`, `api.scheduling.listMyAvailability`, `api.scheduling.addAvailabilityWindow`, `api.scheduling.deleteAvailabilityWindow`, `api.scheduling.listAvailabilityForScheduling`, `api.members.listCaregivers`, `api.clients.list`, `api.audit.list`, `api.shiftQueries.getWithDetails`.
- **Test baseline:** Existing tests in `src/features/scheduling/pages/*.test.tsx` and `src/features/scheduling/components/*.test.tsx` use `vi.mock('@clerk/react')` and `vi.mock('convex/react')`. They currently pass (per prompt) and must continue to pass.

### Figma-to-code divergences observed

| Screen | Divergence |
| --- | --- |
| **Scheduling calendar** | 1. "+ Add shift" Figma button has no icon; current uses `<CalendarPlus />`. 2. Open-shift card in Figma renders time/client line in red; current uses `text-atria-text-secondary`. 3. Figma card names use Figma sample caregivers (`R. Díaz`, `M. Soto`, etc.); current `formatCardName` logic is correct but mock data must supply matching names. 4. Figma header has no visible prev/this/next week controls; current renders them. Controls can stay for UX, but the screenshot harness should hide them or position them outside the Figma crop if matching pixel-for-pixel. |
| **Shift editor** | 1. Figma title is "New shift" with subtitle "Assign a caregiver to a client visit. We'll check credentials before saving."; current has no subtitle. 2. Figma CLIENT/CAREGIVER/DATE/TIME/SERVICE TYPE labels are muted uppercase; current already uppercase. 3. Figma date/time inputs show leading icons (calendar/clock) and a combined time display; current uses native `<Input type="date|time">` without icons. 4. Figma service type option label is "Personal care & companionship"; current shows "Supported Living Services (SLS)". 5. Figma includes a NOTES (OPTIONAL) `<Textarea>`; current omits it. 6. Eligibility panel in Figma lists credential/conflict rows and a green banner "Eligible — safe to schedule"; current panel has different rows and banner wording. |
| **Shift packet** | 1. Client card in Figma shows specific address lines + phone with emoji bullets; current uses `formatAddress(client?.serviceAddress)` and a generic "Client contact on file" line. 2. Caregiver card in Figma shows phone, "CPR & First Aid valid", and rating/visits; current shows email, "Credentials on file", "Active caregiver". 3. Figma action buttons are "Edit shift" (primary pill), "Cancel shift" (red outline pill), "🖨 Print packet" link; current is close but verify exact sizing/spacing. |
| **Coverage request** | Figma shows a dedicated caregiver-facing page with "Request coverage" title, a "SHIFT TO COVER" card, and an "Eligible coworkers" list with "Ask to cover" buttons. Current `CoverageRequestsPanel` is an admin reassignment panel. **This is the largest divergence.** Need to either create a new page component for the caregiver coverage-request flow or redesign `CoverageRequestsPanel` to match the Figma frame when used in the harness view. |
| **Availability** | Figma shows simple day rows (Mon–Sun) with time windows in green or "Unavailable"/"Off" in muted, plus a full-width "Save changes" pill button and a note. Current has inline "Add window" expansion forms. Need to simplify the rows and move editing into a modal or inline accordion, keeping the Figma static appearance for the default state. |

---

## 3. Alternatives Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| **A. Conditional Vite alias to mock modules** | Keeps mock code isolated; production bundle cannot accidentally include mocks; minimal router changes. | Requires maintaining parallel mock implementations of Clerk and Convex providers. | **Chosen.** Safest for production isolation and matches the prompt exactly. |
| **B. Runtime env checks inside real providers** | No alias trickery. | Pollutes production code with dev-only branches; harder to guarantee tree-shaking. | Rejected. Violates "do not break production" and "dead code behind env flag". |
| **C. Storybook or Ladle for screenshots** | Purpose-built for isolated UI states. | Adds a new dev dependency and config; not requested. | Rejected. No new production deps; keep tooling minimal. |
| **D. Change global design tokens to match Figma** | One-token fix. | Global tokens are used across the app; changing them may regress other screens without design-system confirmation. | Rejected for tokens. Use local Figma colors inside scheduling components only. |

---

## 4. Files to Create / Modify

| File | Change type | What changes |
| --- | --- | --- |
| `src/dev/mockClerkReact.tsx` | Create | Dev-only mock of `@clerk/react` exporting: `ClerkProvider`, `useUser`, `useAuth`, `useOrganization`, `useClerk`, `CreateOrganization`, `SignIn`, `SignUp`, `OrganizationSwitcher`. Returns a fake org (`org_hermes`), fake user (`Ana Gómez`, `org:coordinator`/`org:caregiver` selectable), and `isLoaded/isSignedIn=true`. |
| `src/dev/mockConvexReact.tsx` | Create | Dev-only mock of `convex/react` exporting: `ConvexProviderWithAuth`, `ConvexReactClient`, `useConvexAuth`, `useConvex`, `useQuery`, `useMutation`. Wires to `src/dev/mockApi.ts` and `src/dev/mockData.ts`. |
| `src/dev/mockData.ts` | Create | Realistic fake tenants, members, clients, shifts, availability windows, coverage requests, and audit events matching the Figma week (Mon 15 – Sun 21 Jun 2026, Thursday = today). Includes the sample caregivers/clients shown in the PNGs. |
| `src/dev/mockApi.ts` | Create | Query/mutation function stubs for every scheduling-related Convex API used by the pages. Reads/writes in-memory copies of `mockData`. Simulates delay so loading states are visible but brief. |
| `src/dev/ScreenshotHarnessPage.tsx` | Create | Reads `?view=` query param and renders: `SchedulingPage` (full), `SchedulingPage` with `ShiftEditorModal` open, `SchedulingPage` with `ShiftPacketPanel` open, `CoverageRequestsPanel` standalone, `CaregiverSchedulePage`, `AvailabilityPage`. Applies a fixed `Date.now` override for the Figma week. Dimmed-background variants use a CSS overlay or pass `open=true` and rely on the modal/panel backdrop. |
| `vite.config.ts` | Modify | Conditionally add to `resolve.alias` only when `process.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`: `@clerk/react` → `src/dev/mockClerkReact.tsx`, `convex/react` → `src/dev/mockConvexReact.tsx`. Keep existing `@` alias untouched. |
| `src/app/router.tsx` | Modify | Add a conditional `/dev/screenshots` route inside the `AppShell` block when `import.meta.env.DEV && import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`. Guard it so it is compiled out in production. |
| `src/shared/ui/StatusBadge.tsx` | Modify | Fix import path: change `@/shared/utils/cn` to `@/shared/lib/cn`. |
| `src/features/scheduling/pages/SchedulingPage.tsx` | Modify | 1. Remove `CalendarPlus` icon from "Add shift" button (or hide it behind a prop) to match Figma. 2. Change open-shift secondary line to red (`text-[#ef4444]`). 3. Optional: add a prop to hide week-navigation arrows for the harness screenshot view. 4. Ensure card text uses Figma sample names from mocked data. |
| `src/features/scheduling/components/ShiftEditorModal.tsx` | Modify | 1. Add "New shift" subtitle text. 2. Add leading calendar/clock icons to date/time fields. 3. Add NOTES `<Textarea>` field. 4. Update service-type option labels to match Figma. 5. Align eligibility panel rows with Figma (CPR valid, First Aid valid, no schedule conflicts) and banner wording "Eligible — safe to schedule" / "Not eligible — review conflicts". |
| `src/features/scheduling/components/ShiftPacketPanel.tsx` | Modify | 1. Update client card to show address + apartment + phone lines with emoji bullets as in Figma. 2. Update caregiver card to show phone, "CPR & First Aid valid", and rating/visits. 3. Verify action buttons match Figma pill sizing and colors. |
| `src/features/scheduling/components/CoverageRequestsPanel.tsx` | Modify / split | Either redesign this panel to render the Figma caregiver coverage-request layout when used standalone, or create a new `RequestCoveragePage.tsx` and route. Keep the admin reassignment logic if other flows depend on it; otherwise replace it. |
| `src/features/scheduling/pages/AvailabilityPage.tsx` | Modify | Simplify default day-row UI to match Figma: left day name, right green window time or "Unavailable"/"Off". Move add/edit/delete into a modal or an inline accordion that is collapsed by default. Keep full-width "Save changes" pill button (currently a no-op/toast; acceptable). |
| `src/index.css` | Maybe modify | If the team confirms design-system token update, change `--color-atria-success/info/danger/warning` to Figma hexes. **If not confirmed, leave unchanged and use arbitrary Tailwind values in components.** |
| `tests/e2e/screenshots.spec.ts` | Create | Playwright spec that starts dev server with `VITE_ENABLE_SCREENSHOT_MOCKS=true` on port 5180, navigates to each `?view=`, captures desktop (1440×900) and mobile (390×844) PNGs, and writes them to `.conclave-runs/20260705_232614/live-screenshots/`. |
| `.conclave-runs/20260705_232614/visual-diff-summary.md` | Create | Markdown table comparing each Figma PNG to the live PNG: viewport, similarity/notes, fixed divergences. |

---

## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

- **Auth bypass isolation:** The mock Clerk/Convex modules must live only in `src/dev/*` and be aliased only when `VITE_ENABLE_SCREENSHOT_MOCKS=true`. The production build must resolve the real packages. Verify with `npm run build` and by searching the `dist/` bundle for mock module paths/strings.
- **Route leakage:** `src/app/router.tsx` must use `import.meta.env.DEV` and `import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'` so the `/dev/screenshots` route is dead-code-eliminated in production.
- **Role correctness in mocks:** `mockClerkReact` should default to `org:coordinator` for admin views and allow the harness to switch to `org:caregiver` for caregiver pages. `mockConvexReact`'s `api.members.me` must return the matching role so `TenantRoleRouteGuard` and `Sidebar` render correctly.
- **PHI / fake data:** All mock clients, phone numbers, and addresses must be synthetic. Do not use real PII.
- **Multi-tenancy:** Production guards in `RouteGuard.tsx` and `authHelpers.ts` are not changed. The harness bypasses them only via aliased mocks, not by relaxing guards.
- **Convex client shape:** `ConvexProviderWithAuth` in `convex/react` expects an `authInfo` callback; the mock must satisfy the same interface so TypeScript is happy.
- **Date determinism:** Override `Date.now` and `new Date()` behavior inside the harness page only (e.g., freeze to `2026-06-18T12:00:00-05:00` or the user's local equivalent) so "today" is always Thursday and the week is always Jun 15–21. Do not mutate global `Date` in production.
- **Mutation idempotency in mocks:** `mockApi.ts` should not duplicate shifts/coverage requests on rapid clicks; guard with in-progress state and dedupe by generated IDs.
- **Coverage request role confusion:** Figma shows the caregiver asking for coverage; the existing admin panel resolves coverage. Keep the two paths distinct to avoid leaking coordinator-only reassignment UI to caregivers.

---

## 6. Test Strategy

### Unit / integration tests

- Update/add tests for changed components only if behavior changes:
  - `SchedulingPage`: verify open-shift card renders red secondary text.
  - `ShiftEditorModal`: verify notes field appears and submits with `createShift`/`updateShift` payload.
  - `ShiftPacketPanel`: verify caregiver card renders rating/visits and client card renders phone line.
  - `AvailabilityPage`: verify default row shows green window time or "Off".
- Keep existing mocks of `@clerk/react` and `convex/react` in tests; they already simulate the auth layer and should not be affected by the dev harness.

### E2E / screenshot tests

- Create `tests/e2e/screenshots.spec.ts`:
  1. Launch dev server: `VITE_ENABLE_SCREENSHOT_MOCKS=true npm run dev -- --port 5180`.
  2. For each `view` value, set viewport to 1440×900 and 390×844.
  3. Navigate to `http://localhost:5180/dev/screenshots?view=<view>`.
  4. Capture full-page PNG to `.conclave-runs/20260705_232614/live-screenshots/<view>-desktop.png` and `<view>-mobile.png`.
  5. (Optional) Use pixelmatch or Playwright's `toHaveScreenshot` to compute diff against Figma PNGs; record results in `visual-diff-summary.md`.

### Gate commands (must all pass)

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### Additional verification commands

```bash
# Confirm dev harness resolves mocks
VITE_ENABLE_SCREENSHOT_MOCKS=true npm run dev -- --port 5180
# Then open http://localhost:5180/dev/screenshots?view=scheduling

# Confirm production build does not include dev files
grep -R "mockClerkReact\|mockConvexReact\|ScreenshotHarness" dist/ || echo "OK: no dev mocks in dist"
```

---

## 7. Rollback / Verification Notes

- **Rollback:** Revert the single commit (or stash) containing this change. The only production-affected files are `src/app/router.tsx`, `vite.config.ts`, `src/shared/ui/StatusBadge.tsx`, and the scheduling components. `src/dev/*` files are additive and safe to delete.
- **Pre-change backup:** Before editing, snapshot the scheduling component files and `vite.config.ts` so the Figma fixes can be reverted independently of the harness.
- **Verification checklist:**
  - [ ] `npm run lint` passes with no new errors.
  - [ ] `npm run typecheck` passes.
  - [ ] `npm run test` passes (including existing scheduling tests).
  - [ ] `npm run build` passes and `dist/` does not contain `src/dev` paths.
  - [ ] Dev server with `VITE_ENABLE_SCREENSHOT_MOCKS=true` renders `/dev/screenshots?view=scheduling` showing the Jun 15–21 week with Thursday highlighted.
  - [ ] All six harness views render without Clerk credentials.
  - [ ] Live screenshots are captured at 1440×900 and 390×844.
  - [ ] `visual-diff-summary.md` documents each divergence and whether it was fixed.
- **Known risk:** If `StatusBadge.tsx` import path fix is omitted, `npm run build` will fail because `@/shared/utils/cn` does not exist. This is a required one-line fix.
- **Known risk:** The caregiver coverage-request Figma frame and the existing admin `CoverageRequestsPanel` are materially different. The implementer must decide whether to introduce a new page or redesign the panel. Document that decision in the PR summary.
