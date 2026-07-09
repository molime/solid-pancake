# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_124158\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 56.1s rc=0

• # Implementation Plan: Fix AppShell Desktop Sidebar Overlap

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Prevent the fixed 240px desktop sidebar in `AppShell` from visually overlapping the main content area by adding a matching left margin to the content wrapper **only when the chrome is visible** (`hideChrome === false`).

  **Acceptance Criteria:**
  - **AC-1:** `src/app/shell/AppShell.tsx` content wrapper `className` is updated from  
    `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')`  
    to  
    `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]')`.
  - **AC-2:** `lg:ml-[240px]` is applied **only** when `hideChrome` is `false`.
  - **AC-3:** Chromeless routes (`/dev/screenshots/*` and `/onboarding/*`) retain `w-full` and receive **no** left margin.
  - **AC-4:** Mobile viewports remain unaffected (`lg:` prefix ensures the margin only activates at the desktop breakpoint).
  - **AC-5:** No other source files are modified unless a required gate fails.
  - **AC-6:** `npm run typecheck` passes.
  - **AC-7:** `npm run test` passes.
  - **AC-8:** `E2E_FULL=1 npm run e2e` passes.
  - **AC-9:** `npm run build` passes.

  ## 2. Discovery Notes

  - **`src/app/shell/AppShell.tsx`** inspected:
    - `hideChrome` is computed via `useMemo` on `location.pathname.startsWith('/dev/screenshots') || location.pathname.startsWith('/onboarding')` (lines 24-29).
    - Content wrapper is at line 41: `<div className={cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')}>`.
    - `Sidebar` is rendered conditionally at line 40: `{!hideChrome && <Sidebar />}`.
    - `Topbar` is rendered conditionally at line 42: `{!hideChrome && <Topbar />}`.
    - The component is wrapped in `TrainingGate` (line 38), which passes `role` down; the layout change is purely presentational and does not alter that gate.
  - **`src/app/shell/Sidebar.tsx`** inspected:
    - Desktop sidebar element: `<aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-atria-sidebar text-atria-sidebar-text lg:flex">` (line 169).
    - Confirms the fixed sidebar width is exactly `240px`, matching the requested `lg:ml-[240px]` offset.
    - Mobile sidebar is rendered via a drawer at `w-[280px] max-w-[82vw]` only when `mobileOpen` is true, so the desktop margin has no mobile impact.
  - **Test inventory:** No `AppShell.test.tsx` exists. Existing shell tests are `Sidebar.test.tsx` and `RouteGuard.test.tsx`.

  ## 3. Alternatives Considered

  | Approach | Verdict | Reason |
  |---|---|---|
  | **A. Add `lg:ml-[240px]` to the chrome branch of the existing `cn` call (chosen)** | ✅ Safe | One-line, localized change. Preserves `hideChrome` semantics and exactly matches the verified 240px fixed sidebar width. |
  | B. Move sidebar from `fixed` to `sticky` / flex layout inside `AppShell` | ❌ Reject | Requires restructuring `Sidebar.tsx` and changes mobile drawer behavior. Larger blast radius; unnecessary for the reported overlap. |
  | C. Apply `ml-[240px]` unconditionally and override with `lg:ml-0` on chromeless routes | ❌ Reject | More verbose and error-prone; the existing ternary already cleanly separates chrome vs. chromeless states. |
  | D. Use a CSS custom property / theme token for sidebar width | ❌ Reject | Over-engineered for a single fixed value; no other consumers need the token right now. |
  | E. Add global padding to `<main>` | ❌ Reject | Risks affecting other layouts/routes not wrapped by `AppShell`. |

  ## 4. Files to Create / Modify

  | File | Change Type | What Changes |
  |---|---|---|
  | `src/app/shell/AppShell.tsx` | Modify | Update content wrapper `cn` call to add `lg:ml-[240px]` when `hideChrome` is false. |

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  - **Auth / multi-tenancy / PHI:** No backend, auth, or data access changes. `AppShell` only adjusts layout; tenant guards in `authHelpers.ts` and Convex functions are untouched.
  - **Roles:** Layout applies universally regardless of `org:admin`, `org:coordinator`, or `org:caregiver`.
  - **Mobile:** The sidebar is `hidden ... lg:flex` on desktop and rendered via a drawer on mobile. `lg:ml-[240px]` only affects the `lg` breakpoint, so mobile layouts remain unchanged.
  - **Chromeless routes:** `/dev/screenshots/*` and `/onboarding/*` set `hideChrome = true`, so they keep `w-full` with no left margin.
  - **TrainingGate wrapper:** The layout change is inside `TrainingGate`; role-gated training behavior is unaffected.
  - **Idempotency:** Purely presentational; no state or side effects.
  - **Breakpoint consistency:** The sidebar becomes visible at `lg` and the margin also activates at `lg`, so the offsets are aligned. No `md` mismatch was observed.

  ## 6. Test Strategy

  Run the full gate sequence after editing:

  ```bash
  npm run typecheck
  npm run test
  E2E_FULL=1 npm run e2e
  npm run build
  ```

  - **Typecheck:** Ensure TypeScript types remain valid (no new props or imports).
  - **Unit tests:** `npm run test` covers existing shell components (`Sidebar.test.tsx`, `RouteGuard.test.tsx`). No new unit test is required for a single Tailwind class change, but existing tests must not regress.
  - **E2E:** `E2E_FULL=1 npm run e2e` should validate that authenticated desktop flows render main content without sidebar overlap.
    - Critical check: desktop viewport content is not obscured by the sidebar.
    - Critical check: mobile viewport content has no left margin.
  - **Manual visual verification:** If Playwright screenshots are available, compare a logged-in dashboard screenshot before/after to confirm the 240px offset.
  - **No Convex codegen:** The change is in `src/app/shell`; no `convex/_generated` files are touched.

  ## 7. Rollback / Verification Notes

  - **Rollback:** Revert the single line change in `src/app/shell/AppShell.tsx` to restore the previous wrapper class: `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')`.
  - **Visual verification:**
    1. Run the dev server (`npm run dev`).
    2. Resize browser to ≥ `lg` breakpoint (default 1024px).
    3. Confirm the sidebar is visible and the main content starts 240px from the left edge.
    4. Navigate to `/onboarding` or `/dev/screenshots/*` and confirm the wrapper uses `w-full` with no left margin.
    5. Resize browser to < `lg` and confirm no left margin is applied.
  - **Gate policy:** All four gates (`typecheck`, `test`, `e2e`, `build`) must pass before considering the task complete. If any gate fails, diagnose within `AppShell.tsx` or its direct dependents only; do not broaden scope unless the failure is clearly unrelated.


[stderr]
• The user wants me to read a prompt file and carry out those instructions completely. I need to first read the file at the specified path. Let me read it.The prompt file asks me to produce a premium implementation plan. However, the user says "carry out those instructions completely" and "Output your final answer/verdict as requested." The prompt file itself contains a task about fixing AppShell desktop sidebar overlap, but the instructions say to "Produce a premium implementation plan" and "Do NOT write the full code."

  I am an agentic CLI backend, so I MUST open and read the actual relevant files before writing the plan — I cannot just reason from context. I already read the prompt file. Now I need to inspect `src/app/shell/AppShell.tsx` and possibly `src/app/shell/Sidebar.tsx` to verify the candidate plans.

  Let me read these files.I've read both files. Now I need to produce the premium implementation plan. The prompt asks me to synthesize the candidate plans into ONE coherent, de-duplicated, best-of-all implementation plan. 

  Key observations:
  1. AppShell.tsx line 41 has `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')`
  2. Need to change to `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]')`
  3. Sidebar.tsx has fixed sidebar width 240px at `w-[240px]` (line 169), hidden on mobile `hidden ... lg:flex`
  4. No AppShell test exists
  5. Need to run gates: npm run typecheck, npm run test, E2E_FULL=1 npm run e2e, npm run build
  6. No codegen needed since no convex changes

  I should produce a plan with all 7 sections, resolving conflicts and keeping strongest ideas. I should not write the full code. I should be agentic - I did inspect files.

  Let me synthesize:
  - AC should be explicit
  - Discovery notes should cite actual file names/lines and function/type names
  - Alternatives should include the realistic ones
  - Files table only AppShell.tsx
  - Edge cases: mobile, chromeless routes, TrainingGate, no backend/auth impact
  - Test strategy: the four gate commands, manual visual verification
  - Rollback: single line revert

  I'll produce a clean markdown plan.Good, confirmed no AppShell.test.tsx. Now I have all the information needed to produce the final plan. Let me write it out as markdown.

To resume this session: kimi -r session_9deba6ee-57a9-4976-aba7-a7fa20d8ecba
