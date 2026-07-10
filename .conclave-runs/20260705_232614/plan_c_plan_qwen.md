# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: ATRIA-X Screenshot Harness & Visual Regression

## 1. Restated Goal & Acceptance Criteria

**Goal:** Enable pixel-perfect visual verification of Scheduling & Shift Management screens against Figma specs by creating a dev-only mock environment that bypasses Clerk auth and Convex backend dependencies, allowing deterministic screenshot capture.

**Acceptance Criteria:**
- **AC-1 (Mock Infrastructure):** `VITE_ENABLE_SCREENSHOT_MOCKS=true` successfully redirects `@clerk/react` and `convex/react` imports to local mock implementations via Vite aliases.
- **AC-2 (Dev Route):** A new route `/dev/screenshots` is accessible only in dev mode with the env flag, rendering `ScreenshotHarnessPage`.
- **AC-3 (View Coverage):** The harness supports query-param switching (`?view=scheduling`, `?view=shift-editor`, etc.) for all 6 required views.
- **AC-4 (Data Determinism):** Mock data matches the Figma spec week (Mon–Sun, today=Thursday) and includes realistic shifts, caregivers, and coverage requests.
- **AC-5 (Visual Match):** Captured screenshots at 1440x900 (desktop) and 390x844 (mobile) show no visual divergence from `.hermes-pipeline/` Figma references (colors, spacing, typography).
- **AC-6 (Production Safety):** Mock code is tree-shaken or excluded from production builds; `npm run build` succeeds without mock dependencies.
- **AC-7 (Gates):** `lint`, `typecheck`, `test`, and `build` all pass on branch `feature/phase-2-worker-onboarding`.

## 2. Discovery Notes

*Note: As a chat-based model, I am reasoning from the Session 5 context provided in the prompt and standard ATRIA-X architecture patterns. I have not performed live `cat` operations on the repo.*

-   **Inferred Structure:** Based on Session 5 artifacts, `src/features/scheduling/` contains the core components. `src/app/router.tsx` uses React Router 7. `vite.config.ts` is the central build config.
-   **Auth Seams:** Clerk hooks (`useUser`, `useAuth`) are likely used in `src/app/shell/Sidebar.tsx` and layout wrappers. Mocking the library entry point (`@clerk/react`) is safer than wrapping every component.
-   **Data Seams:** Convex hooks (`useQuery`) are used directly in features. Mocking `convex/react` allows us to intercept these calls and return static JSON from `src/dev/mockData.ts`.
-   **Styling:** Tailwind 4 is in use. No custom CSS files expected outside of `index.css`. Dark mode tokens are standard.
-   **Date Dependency:** The calendar logic likely relies on `new Date()`. We need a global mock or a context provider to freeze "today" to the Figma Thursday.

## 3. Alternatives Considered

| Approach | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Storybook** | Industry standard for component isolation. | High setup cost; doesn't capture full-page layout/router state easily; requires duplicating router context. | **Reject** |
| **Wrapper Components** | Wrap real components in mock providers. | Intrusive; requires modifying every feature file to accept optional mock props; high risk of prop-drilling errors. | **Reject** |
| **Vite Aliases (Chosen)** | Clean separation; zero changes to feature code; mocks are truly dead code in prod; easy toggle via env. | Requires careful type matching between real libs and mocks. | **Select** |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `vite.config.ts` | Modify | Add conditional `resolve.alias` for `@clerk/react` and `convex/react` when `VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`. |
| `src/dev/mockData.ts` | Create | Export static JSON for users, orgs, shifts, availability, and coverage requests matching Figma spec. |
| `src/dev/mockClerkReact.tsx` | Create | Export named mocks for `ClerkProvider`, `useUser`, `useAuth`, etc., returning data from `mockData.ts`. |
| `src/dev/mockConvexReact.tsx` | Create | Export mocks for `ConvexProvider`, `useQuery`, `useMutation`. `useQuery` will return static data based on function name. |
| `src/dev/ScreenshotHarnessPage.tsx` | Create | Main harness component. Parses `?view=`, sets `Date` override, renders target component inside a layout shell. |
| `src/app/router.tsx` | Modify | Add `/dev/screenshots` route wrapped in `import.meta.env.DEV` check. |
| `src/features/scheduling/SchedulingPage.tsx` | Modify | (If needed) Ensure it accepts a `baseDate` prop or reads from a global context for deterministic rendering. |
| `tests/e2e/screenshot-harness.spec.ts` | Create | Playwright script to navigate views, set viewport, capture PNGs, and compare against baseline. |
| `.env.example` | Modify | Document `VITE_ENABLE_SCREENSHOT_MOCKS=true`. |

## 5. Data/Auth/Security/Edge Cases

-   **Production Leak Prevention:**
    -   Vite aliases are build-time. If `VITE_ENABLE_SCREENSHOT_MOCKS` is undefined in prod, aliases won't apply.
    -   Add a runtime check in `ScreenshotHarnessPage` to `throw new Error('Harness not for prod')` if `import.meta.env.PROD`.
    -   Ensure `src/dev/` is not imported by any file in `src/app/` or `src/features/` directly (only via aliases).
-   **Multi-Tenancy Simulation:**
    -   `mockData.ts` must include an `orgId` and `userId` that satisfy the `authHelpers` guards in Convex functions (even though we are mocking the *client* hooks, the components might check local auth state).
    -   Mock `useAuth` to return `{ userId: 'user_123', orgId: 'org_456', role: 'org:admin' }`.
-   **Date Determinism:**
    -   The calendar must show the specific Figma week.
    -   Implement a `MockDateContext` in `ScreenshotHarnessPage` that overrides `window.Date` or provides a `getNow()` utility used by `schedulingUtils`.
    -   If `schedulingUtils` uses `new Date()` directly, we may need to patch `window.Date` globally within the harness component mount.
-   **Icon/Asset Loading:**
    -   Ensure all icons (Lucide/FontAwesome) load correctly in the mock environment. No external font CDN failures.

## 6. Test Strategy

**Unit/Integration:**
-   Run `npm run typecheck` to ensure mock exports match the type signatures of the real libraries (critical for TS satisfaction).
-   Run `npm run test` to ensure existing feature tests still pass (mocks should not affect Jest/Vitest unless env is set).

**E2E/Visual:**
-   **Command:** `VITE_ENABLE_SCREENSHOT_MOCKS=true npm run dev -- --port 5180`
-   **Script:** `npx playwright test tests/e2e/screenshot-harness.spec.ts`
-   **Viewports:**
    -   Desktop: `1440x900`
    -   Mobile: `390x844`
-   **Comparison:**
    -   Script saves new PNGs to `tests/e2e/screenshots/actual/`.
    -   Manual or automated diff against `.hermes-pipeline/20260705_232547/` reference images.
    -   **Threshold:** 0% pixel difference allowed for critical UI elements (buttons, badges). 1% tolerance for anti-aliasing.

**Gates:**
1.  `npm run lint`
2.  `npm run typecheck`
3.  `npm run test`
4.  `npm run build` (Verify no mock code in output bundle).

## 7. Rollback / Verification Notes

-   **Rollback:**
    -   Revert changes to `vite.config.ts` and `src/app/router.tsx`.
    -   Delete `src/dev/` directory.
    -   Delete `tests/e2e/screenshot-harness.spec.ts`.
    -   Since mocks are behind an env flag and new files, a simple `git checkout .` restores prod safety.
-   **Verification:**
    -   After implementation, run `npm run build` and inspect `dist/` assets. Grep for `mockClerk` or `mockData` strings to ensure they are tree-shaken.
    -   Run app *without* the env flag to ensure normal Clerk login flow still works.
    -   Run app *with* the env flag to verify harness loads.

---

**Next Step:** Proceed with creating the `src/dev/` mock infrastructure and updating `vite.config.ts`.