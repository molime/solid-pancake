# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The PR adds the HR feature set (pages, routing, sidebar, backend mutations/queries, and tests) and expands existing Convex schema and mutations to support the new “needs_correction” decision and optional hiring details. Most acceptance criteria are met, but there are concrete blockers:

| Issue | File / Line(s) | Why it blocks |
|-------|----------------|----------------|
| **Missing HR‑cases backend implementation** – the new `hrCases` module is referenced in `convex/_generated/api.d.ts` and the acceptance criteria (AC‑13) require `createHrCase`, `listHrCases`, `updateHrCase` (and optionally a dashboard stats query). No `convex/hrCases.ts` (or its tests) appears in the diff, so the API is undefined at runtime. | `convex/_generated/api.d.ts` (import added) – but no source file. | Calls to `api.hrCases.*` will throw “function not found” and the generated TypeScript types will be incomplete. This also means the HR Cases page cannot fetch data. |
| **Onboarding route test failure** – `DocumentUploadPage.test.tsx` reports “No routes matched location `/onboarding`”. The router guard for onboarding (`allowedRoles={['org:candidate']}`) is exercised in the test without a mock `org:candidate` role, so the guard redirects away and the route never matches. | `src/app/router.test.tsx` (onboarding tests) – test setup does not mock a candidate role. | The onboarding flow is part of the existing product; the test suite must be able to render those routes. |
| **React‑act warnings in HR tests** – `HRDashboardPage.test.tsx` and `PlatformTrainingWizard.test.tsx` emit “An update … was not wrapped in act(...)”. While not a compile‑time error, they indicate flaky tests and violate the testing guidelines. | `src/features/hr/pages/HRDashboardPage.test.tsx` (modal open) and `src/features/onboarding/PlatformTrainingWizard.test.tsx`. | Could cause nondeterministic test failures in CI. |
| **Potential KpiCard API mismatch** – the shared `KpiCard` component was modified (30 lines removed). The new HR dashboard expects optional `valueClassName` / `trend` props (see AC‑3). The current component signature no longer includes these props, which may lead to runtime styling issues or TypeScript errors if the dashboard uses them. | `src/shared/ui/KpiCard.tsx` (diff shows removal of props). | Dashboard may not render KPI values with the required color/trend styling. |

All other acceptance criteria (routing, sidebar nav, status‑badge mapping, backend `reviewApplication` extension, `hireCandidate` args, route guards, tests for HR pages, lint/typecheck/build) pass.

---

## Required Changes

### 1. Add the HR‑cases backend module
Create **`convex/hrCases.ts`** with the following (mirroring existing patterns):

```ts
import { v } from 'convex/values'
import { internal, api } from './_generated/api'
import { query, mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import type { Id } from './_generated/dataModel'

export const createHrCase = mutation({
  args: {
    clerkOrgId: v.string(),
    subjectType: v.union(v.literal('candidate'), v.literal('employee')),
    subjectId: v.id('candidates'), // or employeeProfiles – will be validated later
    category: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    // Resolve subject existence & tenant isolation
    let subjectName = ''
    if (args.subjectType === 'candidate') {
      const cand = await ctx.db.get(args.subjectId as Id<'candidates'>)
      if (!cand) throw new ConvexError('Candidate not found')
      assertTenantDoc(cand, tenantId)
      subjectName = cand.displayName
    } else {
      const emp = await ctx.db.get(args.subjectId as Id<'employeeProfiles'>)
      if (!emp) throw new ConvexError('Employee not found')
      assertTenantDoc(emp, tenantId)
      subjectName = emp.displayName
    }

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_clerk_user', (q) => q.eq('clerkUserId', ctx.auth.userId))
      .unique()
    if (!member) throw new ConvexError('Member not found')
    assertTenantDoc(member, tenantId)

    const caseId = await ctx.db.insert('hrCases', {
      tenantId,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      category: args.category,
      title: args.title,
      description: args.description,
      status: 'open',
      ownerMemberId: member._id,
      createdAt: new Date().toISOString(),
    })

    return caseId
  },
})

export const listHrCases = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const cases = await ctx.db
      .query('hrCases')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .collect()

    // Resolve subject and owner display names in‑line
    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const memberMap = new Map(members.map((m) => [m._id, m]))

    const subjects = await Promise.all(
      cases.map(async (c) => {
        if (c.subjectType === 'candidate') {
          const cand = await ctx.db.get(c.subjectId as Id<'candidates'>)
          return cand?.displayName ?? ''
        }
        const emp = await ctx.db.get(c.subjectId as Id<'employeeProfiles'>)
        return emp?.displayName ?? ''
      }),
    )

    return cases.map((c, i) => ({
      ...c,
      ownerName: memberMap.get(c.ownerMemberId)?.displayName ?? '',
      subjectName: subjects[i],
    }))
  },
})

export const updateHrCase = mutation({
  args: {
    clerkOrgId: v.string(),
    caseId: v.id('hrCases'),
    status: v.union(v.literal('open'), v.literal('in_review'), v.literal('resolved'), v.literal('closed')),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:hr',
    ])

    const hrCase = await ctx.db.get(args.caseId)
    if (!hrCase) throw new ConvexError('Case not found')
    assertTenantDoc(hrCase, tenantId)

    await ctx.db.patch(args.caseId, {
      status: args.status,
      ...(args.title && { title: args.title }),
      ...(args.description && { description: args.description }),
      ...(args.category && { category: args.category }),
    })
    return args.caseId
  },
})
```

* Ensure the `hrCases` table exists in `convex/schema.ts` (it already does).  
* Add an index `by_tenant` if not present (already exists).  

### 2. Add tests for the new HR‑cases API
Create **`convex/hrCases.test.ts`** covering:

* Successful `createHrCase` (tenant isolation, owner resolution).  
* `listHrCases` returns only cases for the tenant with resolved names.  
* `updateHrCase` allows status transitions and blocks cross‑tenant updates.  
* Guard enforcement: non‑HR roles receive `ConvexError`.

Use the existing test helpers (`asAdmin`, `seedTenant`, etc.) to keep consistency.

### 3. Fix onboarding route test setup
In **`src/app/router.test.tsx`** (or a shared test helper), add a mock for the candidate role when onboarding routes are exercised:

```ts
function mockSignedInWithRole(role: string) {
  // existing implementation …
}

// Add a helper for candidate role
function mockSignedInAsCandidate() {
  mockSignedInWithRole('org:candidate')
}
```

Then, in `DocumentUploadPage.test.tsx` (and any other onboarding tests) call `mockSignedInAsCandidate()` before rendering the router. This will satisfy the `TenantRoleRouteGuard` and allow the `/onboarding/...` routes to match.

### 4. Wrap state‑changing test actions in `act`
Update the two failing tests:

* **`src/features/hr/pages/HRDashboardPage.test.tsx`** – wrap the button click that opens the modal in `await act(async () => { fireEvent.click(...); })` (or `userEvent.click` which already uses act).  
* **`src/features/onboarding/PlatformTrainingWizard.test.tsx`** – similarly wrap the step navigation that triggers state updates.

These changes eliminate the console warnings and make the tests deterministic.

### 5. Verify `KpiCard` API matches dashboard usage
The HR dashboard (to be implemented) expects `KpiCard` to accept optional styling props (`valueClassName`, `trend`). The recent change removed those props. Re‑introduce them without breaking existing callers:

```tsx
// src/shared/ui/KpiCard.tsx
export interface KpiCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  detail?: ReactNode
  valueClassName?: string   // ← add back
  trend?: 'up' | 'down'    // ← optional
}
```

Adjust the component rendering to apply `valueClassName` to the value element and optionally render a trend arrow. Ensure TypeScript compiles (typecheck already passes, but adding the props restores intended API).

### 6. Run the full gate suite again
After applying the above changes:

```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test   # should now pass all tests without act warnings
npm run build
```

All gates must pass before the PR can be merged.

---

**Conclusion:** The PR is largely complete but is missing the core HR‑cases backend, has a failing onboarding test due to missing role mocking, contains act‑related test warnings, and a potential `KpiCard` API regression. Implement the changes above to satisfy all acceptance criteria and ensure a clean CI run.

**VERDICT:** CHANGES_REQUESTED