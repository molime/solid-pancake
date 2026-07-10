# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_124158\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 60.1s rc=0

• # Implementation Plan: Fix AppShell Desktop Sidebar Overlap

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Prevent the fixed 240px desktop sidebar in `AppShell` from overlapping the main content area by adding a left margin to the content wrapper only when chrome is visible.

  - **AC-1:** `src/app/shell/AppShell.tsx` line 41 wrapper class updated from  
    `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')`  
    to  
    `cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]')`.
  - **AC-2:** The `lg:ml-[240px]` margin is applied **only** when `hideChrome === false`.
  - **AC-3:** Chromeless routes (`/dev/screenshots/*` and `/onboarding/*`) retain full-width layout (`w-full`) and receive no left margin.
  - **AC-4:** No other files are modified unless a required gate fails.
  - **AC-5:** `npm run typecheck` passes.
  - **AC-6:** `npm run test` passes.
  - **AC-7:** `E2E_FULL=1 npm run e2e` passes.
  - **AC-8:** `npm run build` passes.

  ## 2. Discovery Notes

  - **File inspected:** `C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/app/shell/AppShell.tsx`
    - `hideChrome` is computed via `useMemo` from `location.pathname.startsWith('/dev/screenshots') || location.pathname.startsWith('/onboarding')`.
    - The content wrapper is at line 41: `<div className={cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden')}>`.
    - `Sidebar` is rendered conditionally at line 40: `{!hideChrome && <Sidebar />}`.
  - **File inspected:** `C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/app/shell/Sidebar.tsx`
    - Desktop sidebar element: `<aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] ... lg:flex">`.
    - Confirms the fixed sidebar width is exactly `240px`, matching the requested `lg:ml-[240px]` offset.
  - **No `AppShell.test.tsx` exists.** Existing nearby tests are `Sidebar.test.tsx` and `RouteGuard.test.tsx`.

  ## 3. Alternatives Considered

  | Approach | Why Not Chosen |
  |---|---|
  | A. Move sidebar from `fixed` to `sticky` / flex layout inside `AppShell` | Requires restructuring `Sidebar.tsx` and changes mobile drawer behavior. Larger blast radius; unnecessary for a one-property fix. |
  | B. Apply `ml-[240px]` unconditionally and override with `lg:ml-0` on chromeless routes | More verbose and error-prone; the ternary already cleanly separates chrome vs. chromeless states. |
  | C. Use a CSS custom property / theme token for sidebar width | Over-engineered for a single fixed value; no other consumers need the token right now. |
  | **D. Append `lg:ml-[240px]` to the existing chrome branch (chosen)** | Minimal, localized, preserves current `hideChrome` semantics, and exactly matches the verified 240px sidebar width. |

  ## 4. Files to Create / Modify

  | File | Change type | What changes |
  |---|---|---|
  | `src/app/shell/AppShell.tsx` | Modify | Update content wrapper `cn` call to add `lg:ml-[240px]` when `hideChrome` is false. |

  ## 5. Edge Cases

  - **Auth / multi-tenancy / PHI:** No backend, auth, or data access changes. `AppShell` merely adjusts layout; tenant guards in `authHelpers.ts` and Convex functions are untouched.
  - **Mobile:** The sidebar is `hidden ... lg:flex` on desktop and rendered via a drawer on mobile. `lg:ml-[240px]` only affects the desktop breakpoint, so mobile layouts remain unchanged.
  - **Chromeless routes:** `/dev/screenshots/*` and `/onboarding/*` set `hideChrome = true`, so they keep `w-full` with no margin.
  - **TrainingGate wrapper:** The layout change is inside `TrainingGate`; role-gated training behavior is unaffected.
  - **Idempotency:** Purely presentational; no state or side effects.

  ## 6. Test Strategy

  Run the full gate sequence after editing:

  ```bash
  npm run typecheck
  npm run test
  E2E_FULL=1 npm run e2e
  npm run build
  ```

  - **Unit tests:** `npm run test` covers existing shell components (`Sidebar.test.tsx`, `RouteGuard.test.tsx`). No new unit test is required for a single Tailwind class change, but existing tests must not regress.
  - **E2E:** `E2E_FULL=1 npm run e2e` should validate that authenticated desktop flows render main content without sidebar overlap.
  - **Manual visual verification:** If Playwright screenshots are available, compare a logged-in dashboard screenshot before/after to confirm the 240px offset.

  ## 7. Rollback / Verification Notes

  - **Rollback:** Revert the single line change in `src/app/shell/AppShell.tsx` to restore the previous wrapper class.
  - **Verification:** On a desktop viewport (`>= lg` breakpoint) with chrome visible, inspect the content wrapper and confirm `margin-left: 240px` is applied. On `/onboarding` or `/dev/screenshots`, confirm the wrapper has `width: 100%` and no left margin.
  - All four gates (`typecheck`, `test`, `e2e`, `build`) must pass before considering the task complete. If any gate fails, diagnose within `AppShell.tsx` or its direct dependents only; do not broaden scope unless the failure is clearly unrelated.


[stderr]
• The user wants me to read a prompt file and carry out instructions. Let me read the file first.The prompt asks me to act as a principal/staff engineer PLANNING a code change. But the user says "carry out those instructions completely" and "Output your final answer/verdict as requested." However, the prompt itself says "Do NOT write the full code. Keep the plan focused on ONLY what the task requires."

  Wait, this is a planning prompt. The task in the prompt is to fix AppShell desktop sidebar overlap. But the instructions say to "Produce a premium implementation plan" - not to actually implement it.

  But the user says "Read the prompt file... and carry out those instructions completely." So I should produce the plan, not implement the code.

  Let me first do the discovery requirement: open and read the actual relevant files. I need to read src/app/shell/AppShell.tsx.

  Let me also maybe look at related files to understand the context. But the task is surgical - only AppShell.tsx content wrapper change.

  I should read the file now.Good. I've read the file. Now I need to produce the premium implementation plan as requested. The prompt says "Do NOT write the full code. Keep the plan focused on ONLY what the task requires."

  I should also perhaps check if there are related test files, since the task mentions running tests. But the planning instructions don't require me to run tests, just to read relevant files. I've read AppShell.tsx. Maybe I should quickly check for AppShell tests.

  Actually, let me also check Sidebar to confirm width 240px, since the task mentions it.Good. I've confirmed the Sidebar uses `w-[240px]` and is fixed positioned with `fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-atria-sidebar text-atria-sidebar-text lg:flex`. So on desktop (`lg:` breakpoint), the sidebar is fixed width 240px and overlays content. Adding `lg:ml-[240px]` to the content wrapper when chrome is shown will offset the main content by 240px.

  Now I need to produce the premium implementation plan with all 7 sections. Let me also check if there are existing tests for AppShell.No AppShell test. I have enough information. Let me produce the plan.

  The plan should not include code implementation, just the plan. The task says "Do NOT write the full code."

  Sections required:
  1. Restated goal and numbered acceptance criteria
  2. Discovery notes
  3. Alternatives considered and why chosen approach is safest/simplest
  4. Files to create/modify table
  5. Data/auth/security/multi-tenant/PHI/idempotency edge cases
  6. Test strategy
  7. Rollback / verification notes

  I should be concise but complete.

To resume this session: kimi -r session_271a34b5-4623-44f9-ba77-263ea21ec515
