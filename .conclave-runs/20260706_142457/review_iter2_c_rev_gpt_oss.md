# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The PR adds a substantial HR feature set: new Convex `hrCases` module (mutations, queries, stats, audit), expanded backend guards, candidate‑onboarding mock data, UI enhancements (AppShell, CoverageRequestsPanel, ShiftEditorModal), and a comprehensive test suite. All lint, type‑check, unit‑test, and build gates pass (62 test files, 428 tests). Security‑related guards (`requireTenantRole`) are used for the new mutations/queries, and tenant isolation is verified in the new `hrCases.test.ts`. The added audit logging and subject‑type validation mitigate PHI leakage risks.

**Missing Acceptance Criteria / Concrete Issues**

| AC / Requirement | Observation | Impact |
|------------------|--------------|--------|
| **AC‑1 – HR routes & guards** (`/hr*` wrapped in `TenantRoleRouteGuard` and `RouteSuspense`) | No changes to `src/app/router.tsx` are present in the diff. The new pages exist and are unit‑tested, but the router does not expose the required routes, nor does it apply the role guard. | Users cannot navigate to HR pages via the app; the acceptance criterion is not met. |
| **AC‑2 – Sidebar HR navigation** (`Candidates`, `Employees`, `Cases` for `org:admin`/`org:hr`) | `src/app/shell/Sidebar.tsx` was not modified. The existing tests for the sidebar pass, but they only verify existing items; there is no evidence that the new HR nav items are present. If they are missing, the UI will not expose HR sections. | HR navigation may be invisible to authorized users, violating the spec. |
| **AC‑8 – `reviewApplication` accepts `needs_correction`** | No modifications to `convex/candidates.ts` are shown. The test suite passes, but without seeing the mutation code we cannot confirm the new decision value is handled. If the mutation still rejects the value, the backend contract is incomplete. | HR reviewers would be unable to request corrections, breaking the intended workflow. |
| **AC‑13 – `KpiCard` extension** (optional `valueClassName`/`trend`) | No changes to `src/shared/ui/KpiCard.tsx`. The dashboard may still render, but the spec calls for colored/value‑class styling. If the component cannot accept the needed props, the UI will diverge from the Figma spec. | Visual mismatch on the HR dashboard. |
| **Potential index missing** – `employeeProfiles` index `by_tenant_clerk_user` used in `resolveSubjectName`. The index is not added in this PR. If the index does not exist, `createHrCase` and `listHrCases` would throw at runtime. The tests pass, implying the index exists, but the migration is not shown. | Runtime failures in production if the index is absent. |
| **TrainingGate role handling** – `AppShell` now injects a `TrainingGate` that checks `role` (`org:admin` | `org:hr` | `org:candidate`). Ensure that HR routes are not unintentionally blocked for users who have not completed platform training. No explicit guard bypass is shown for HR. | HR users might be redirected to the training wizard, preventing access to HR pages. |

**Requested Changes**

1. **Add HR routes to `src/app/router.tsx`**  
   - Import the new HR pages lazily (e.g., `const HRDashboardPage = lazy(() => import('@/features/hr/pages/HRDashboardPage'))`).  
   - Wrap each `/hr*` route with `<TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}>` and `<RouteSuspense>`.  
   - Ensure the routes are nested under the existing `AppShell` layout.

2. **Update `src/app/shell/Sidebar.tsx`**  
   - Add navigation items for **Candidates**, **Employees**, and **Cases** with the appropriate Lucide icons (`Users`, `Building2`, `ClipboardCheck`).  
   - Filter visibility to `member.role` ∈ `['org:admin','org:hr']`.  
   - Adjust active‑state styling to match existing items.

3. **Confirm `convex/candidates.ts`**  
   - Verify that `reviewApplication` mutation’s argument type includes `decision: v.union(v.literal('approved'), v.literal('rejected'), v.literal('needs_correction'))`.  
   - Ensure the handler updates status to `application_draft` and records `hrNotes` when `needs_correction` is received.  
   - If missing, add the necessary logic and run `npx convex codegen`.

4. **Extend `src/shared/ui/KpiCard.tsx`** (optional but required for pixel‑faithful UI)  
   - Add props `valueClassName?: string` and `trend?: 'up' | 'down' | 'neutral'`.  
   - Apply `valueClassName` to the value element and render a trend indicator if provided, preserving existing usage.

5. **Add missing index migration** (if not already present)  
   - In `convex/schema.ts`, ensure `employeeProfiles` has an index `by_tenant_clerk_user` (`q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId)`).  
   - Run `npx convex codegen` and commit the generated files.

6. **TrainingGate bypass for HR** (if required)  
   - If `TrainingGate` currently blocks users without completed platform training, add an explicit allow‑list for `org:admin`/`org:hr` so HR pages are accessible regardless of training status.

7. **Add/Update tests**  
   - **Router tests**: verify that `/hr`, `/hr/candidates`, etc., render for `org:admin`/`org:hr` and redirect for other roles.  
   - **Sidebar tests**: assert that the new HR nav items appear for authorized roles.  
   - **`reviewApplication` test**: include a case where `decision: 'needs_correction'` is sent and the candidate status changes accordingly.  
   - **KpiCard test** (optional): ensure the new props render correctly.

After applying these changes, re‑run the full gate suite (`npm run lint && npm run typecheck && npm run test && npm run build`). All acceptance criteria should then be satisfied.

---

VERDICT: CHANGES_REQUESTED