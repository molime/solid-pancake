# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Summary of Findings**

| File / Area | Issue | Impact |
|--------------|-------|--------|
| `src/dev/ScreenshotHarnessPage.tsx` | The `coverage` view renders `<CoverageRequestsPanel clerkOrgId={clerkOrgId} />` which defaults to **admin** mode. The Figma spec for the coverage screen is the **caregiver** view, so the captured screenshot will not match the reference PNG. | Visual‑regression will fail for the “coverage” screen. |
| `vite.config.ts` | Alias redirection is gated on `import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'`. `import.meta.env` is not available in the Node‑side Vite config; the condition always evaluates to `false`, so the mocks are never used even when the flag is set. | The dev‑only harness would still pull the real `@clerk/react` / `convex/react` packages, breaking the “no‑Clerk‑credentials” requirement. |
| `src/main.tsx` (date freeze) | The comment mentions overriding the `Date` constructor, but the implementation only overrides `Date.now`. Several scheduling utilities (`src/features/scheduling/model/schedulingUtils.ts`) instantiate `new Date()` directly to compute the week range. Without a full constructor mock, the calendar will render the actual current week instead of the fixed Figma week. | The screenshot harness will show the wrong dates, causing visual mismatch. |
| `src/shared/ui/StatusBadge.tsx` | The import was corrected to `@/shared/lib/cn`, but the component still references a CSS variable `--radius-atria-lg` that is defined only in the production theme. In the dev harness (which does not load the full Tailwind config), the variable may be undefined, leading to a runtime CSS error. | Potential UI breakage in the harness. |
| Tests – coverage of dev‑only path | No test verifies that the Vite aliasing works when `VITE_ENABLE_SCREENSHOT_MOCKS=true`. While unit tests pass, a regression could re‑introduce the real auth layer. | Missing guard against accidental production leakage. |

**Requested Changes**

1. **Coverage View Mode**
   - In `src/dev/ScreenshotHarnessPage.tsx`, change the `coverage` case to render the caregiver‑mode panel:  
     ```tsx
     case 'coverage':
       return <CoverageRequestsPanel clerkOrgId={clerkOrgId} mode="caregiver" />
     ```
   - This aligns the screenshot with the Figma `scheduling-coverage-request.png`.

2. **Vite Alias Guard**
   - Update `vite.config.ts` to use `process.env.VITE_ENABLE_SCREENSHOT_MOCKS` (or `env` from `loadEnv`) for the conditional alias block. Example:
     ```ts
     const enableScreenshotMocks = process.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true'
     if (enableScreenshotMocks) {
       config.resolve?.alias?.push(
         { find: '@clerk/react', replacement: path.resolve(__dirname, 'src/dev/mockClerkReact.tsx') },
         { find: 'convex/react', replacement: path.resolve(__dirname, 'src/dev/mockConvexReact.tsx') },
       )
     }
     ```
   - Ensure the condition is evaluated at build time.

3. **Full Date Mock**
   - In `src/main.tsx`, replace the simple `Date.now` override with a full constructor mock that also patches `new Date()`:
     ```tsx
     if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_SCREENSHOT_MOCKS === 'true') {
       const fixed = new Date('2026-06-18T12:00:00Z')
       const OriginalDate = Date
       // @ts-ignore – we intentionally replace the global
       globalThis.Date = class extends OriginalDate {
         constructor(...args: any[]) {
           if (args.length === 0) {
             super(fixed)
           } else {
             super(...args)
           }
         }
         static now() {
           return fixed.getTime()
         }
       } as unknown as DateConstructor
     }
     ```
   - This guarantees any `new Date()` call without arguments yields the fixed Thursday.

4. **StatusBadge CSS Variable Fallback**
   - In `src/shared/ui/StatusBadge.tsx`, add a fallback for the radius variable:
     ```tsx
     style={{ borderRadius: 'var(--radius-atria-lg, 0.5rem)' }}
     ```
   - Prevents runtime CSS errors when the variable isn’t defined in the dev harness.

5. **Add Alias‑Guard Test**
   - Create a new test `src/dev/aliasGuard.test.tsx` that sets `process.env.VITE_ENABLE_SCREENSHOT_MOCKS='true'`, imports the Vite config (or a small helper that reads the alias list), and asserts that the alias array contains entries for `@clerk/react` and `convex/react`. This ensures the conditional logic stays functional.

**Conclusion**

All other acceptance criteria (dev‑only harness, mock data, route addition, test suite, lint/typecheck/build) are satisfied and pass. Implementing the changes above will close the remaining gaps and guarantee that the visual‑regression harness produces screenshots that exactly match the provided Figma assets without leaking production dependencies.

---

VERDICT: CHANGES_REQUESTED