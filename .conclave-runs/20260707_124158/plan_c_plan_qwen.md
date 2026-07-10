# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: AppShell Desktop Sidebar Overlap Fix

## 1. Restated Goal & Acceptance Criteria
**Goal:** Resolve desktop layout overlap where the fixed 240px left sidebar obscures main content by conditionally applying left margin to the content wrapper.

**Acceptance Criteria:**
- **AC-1:** `src/app/shell/AppShell.tsx` content wrapper `className` includes `lg:ml-[240px]` only when `hideChrome` is `false`.
- **AC-2:** Mobile viewports (< `lg` breakpoint) remain unaffected (no left margin applied).
- **AC-3:** `hideChrome` state logic remains intact; no functional regressions in sidebar toggle behavior.
- **AC-4:** All verification gates pass: `typecheck`, `test`, `e2e`, `build`.
- **AC-5:** No changes to Convex backend or generated types (no `codegen` required).

## 2. Discovery Notes
- **File Access Limitation:** I am operating as a chat-only backend in this session. I **have not inspected the actual files** on disk. This plan relies on the explicit file path (`src/app/shell/AppShell.tsx`) and class logic provided in the TASK description.
- **Assumed Contracts:**
  - `cn()` utility is available (standard `clsx`/`tailwind-merge` pattern).
  - `hideChrome` is a boolean prop/state available in the component scope.
  - Tailwind 4 configuration supports arbitrary values (`[240px]`) and `lg:` breakpoint.
- **Context:** ATRIA-X uses React19+Vite8. No Convex functions are touched, so `authHelpers` and multi-tenancy guards are not relevant to this specific diff.

## 3. Alternatives Considered
| Option | Approach | Verdict | Reason |
| :--- | :--- | :--- | :--- |
| **A (Chosen)** | Add `lg:ml-[240px]` to content wrapper | **Safe** | Minimal diff, CSS-only, scoped to `hideChrome` state. Matches TASK spec exactly. |
| **B** | Adjust sidebar `z-index` | **Reject** | Does not solve overlap; content would still be underneath, just layered differently. |
| **C** | Add global padding to `<main>` | **Reject** | Risk of affecting other layouts/routes not wrapped by `AppShell`. |
| **D** | Change sidebar to `relative` flow | **Reject** | Breaks "fixed" sidebar requirement for scrolling behavior. |

## 4. Files to Create/Modify
| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/app/shell/AppShell.tsx` | Modify | Update `className` logic on content wrapper div. Change `hideChrome ? 'w-full' : 'overflow-hidden'` to `hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]'`. |

## 5. Data/Auth/Security/Edge Cases
- **Multi-tenancy:** N/A. This is a pure UI layout change; no tenant data is fetched or displayed differently.
- **Auth/Roles:** N/A. Layout applies universally regardless of `org:admin`, `org:coordinator`, or `org:caregiver`.
- **PHI/Security:** No data exposure risk.
- **State Edge Case:** Ensure `hideChrome` toggling does not cause layout shift glitches (CLS). The `lg:` breakpoint ensures mobile users (who often toggle chrome) are not impacted by the desktop-specific margin.
- **Breakpoint Edge Case:** Verify Tailwind `lg` default (usually 1024px) aligns with sidebar visibility logic. If sidebar shows on `md`, this fix might need adjustment, but adhering to TASK `lg:` requirement for now.

## 6. Test Strategy
**Verification Commands (Sequential):**
1.  `npm run typecheck` — Ensure TS types align (no new props added).
2.  `npm run test` — Run unit tests (Vitest). Expect no failures as no logic changed.
3.  `E2E_FULL=1 npm run e2e` — Playwright suite.
    *   *Critical Check:* Desktop viewport test must assert content is not obscured by sidebar.
    *   *Critical Check:* Mobile viewport test must assert no left margin exists.
4.  `npm run build` — Ensure production bundle compiles without Tailwind purging errors.

**Cost Optimization (Diego/Conclave Context):**
- If E2E fails, isolate the specific spec file before re-running `E2E_FULL=1` to save compute/billing cycles.
- No Convex codegen needed, saving backend orchestration time.

## 7. Rollback / Verification Notes
- **Rollback:** `git revert HEAD` or manually restore the `className` string to `hideChrome ? 'w-full' : 'overflow-hidden'`.
- **Visual Verification:**
  1.  Run dev server (`npm run dev`).
  2.  Resize browser to >1024px width.
  3.  Confirm sidebar is visible and content starts at 240px from left.
  4.  Resize browser to <1024px width.
  5.  Confirm content starts at 0px from left (no margin).
- **Conclave Gate:** If using Conclave orchestration, mark this task as "OSS execution" safe (no API billing for backend logic).