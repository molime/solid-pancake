# HR Cases Enhancement + Dashboard Branding

## Context
Maria tested the HR dashboard and cases tab. Design doc with full analysis and staged implementation:
C:\Users\pinol\Downloads\hr-cases-enhancement-design-doc.md

Read that design doc FIRST before implementing. It has the root cause analysis, Figma reference, and staged TODO lists.

## Two Tasks

### Task A: Agency Branding on HR Pages
Maria wants the ATRIA logo + agency logo + "Powered by ATRIA-X Digital Solutions" text on the HR pages, matching the candidate flow. The candidate flow has this at the bottom of each page.

Create a reusable `AgencyBranding` component in `src/shared/ui/AgencyBranding.tsx` that:
- Uses `useTenant()` to get `tenantName`
- Uses `resolveAgencyLogo(tenantName)` from `src/app/shell/agencyLogo.ts` to get the logo URL
- Renders the agency logo (h-10, object-contain, opacity-70) and "Powered by ATRIA-X Digital Solutions" text below it
- If no agency logo resolves, just show the "Powered by" text

Add this component to the bottom of:
- `src/features/hr/pages/HRDashboardPage.tsx` (before the closing div of the main content area)
- `src/features/hr/pages/HRCasesPage.tsx` (before the NewCaseModal)

### Task B: HR Cases — Full Case Detail + Click-to-Open

Maria's feedback (key points):
1. She wants to click a case and see its full details — currently clicking does nothing
2. Even closed cases should be openable to view details (for evidence in case of termination)
3. Cases should be linked to the employee's archive so everything about an employee is in one place

#### Figma Design (node 191:2688 — "HR / Cases")
The Figma shows these columns: CASE ID, EMPLOYEE, TYPE, OPENED, ASSIGNED TO, STATUS, VIEW
- Case IDs like "HR-2024-001"
- Type is color-coded (discrepancy=warning, dispute=warning, policy_violation=danger, etc.)
- Status pills (Open=red, In review=yellow, Resolved=green, Closed=gray)
- "View →" link to open case details

#### Implementation

**Backend changes (convex/hrCases.ts + convex/schema.ts):**

1. Add `caseNumber: v.optional(v.string())` to the hrCases schema

2. In `createHrCase`, auto-generate a case number: count existing cases for the tenant, increment, format as `HR-<year>-<padded number>`. Example: `HR-2026-001`

3. Add `getHrCase` query:
```typescript
export const getHrCase = query({
  args: { clerkOrgId: v.string(), caseId: v.id('hrCases') },
  handler: async (ctx, { clerkOrgId, caseId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, HR_ROLES)
    const hrCase = await ctx.db.get(caseId)
    if (!hrCase) throw new ConvexError('Case not found.')
    assertTenantDoc(hrCase, tenantId)
    
    // Resolve subject name
    let subjectName = 'Unknown'
    if (hrCase.subjectType === 'employee') {
      const profiles = await ctx.db.query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId)).collect()
      const profile = profiles.find(p => p.clerkUserId === hrCase.subjectId)
      if (profile) subjectName = profile.displayName
    } else if (hrCase.subjectType === 'candidate') {
      const candidate = await ctx.db.get(hrCase.subjectId as Id<'candidates'>)
      if (candidate) subjectName = candidate.displayName
    }
    
    // Resolve owner name
    let ownerName = 'Unassigned'
    if (hrCase.ownerMemberId) {
      const owner = await ctx.db.get(hrCase.ownerMemberId)
      if (owner) ownerName = owner.displayName
    }
    
    return { ...hrCase, subjectName, ownerName }
  },
})
```

4. Update `listHrCases` to include `caseNumber` and `title` in returned objects (they should already be there from the schema, just make sure the map includes them).

5. Update `listHrCasesForSubject` to include `caseNumber` and `title`.

**Frontend changes:**

1. Create `src/features/hr/components/CaseDetailModal.tsx`:
   - Takes `caseId` (Id<'hrCases'> | null) and `clerkOrgId` as props
   - When caseId is not null, queries `api.hrCases.getHrCase`
   - Shows in a Dialog: case number, title, category, status badge, description, subject name (with link to employee profile if subjectType is 'employee'), assigned to, created date, resolved date
   - Has a status change select inside the modal (reuse existing STATUS_OPTIONS)
   - Close button

2. Update `src/features/hr/pages/HRCasesPage.tsx`:
   - Add CASE ID column (first column) showing caseNumber
   - Add TITLE column showing the case title (currently only shows category as "kind")
   - Make the employee name a Link to `/hr/employees/:memberId` if subjectType is 'employee' (need to resolve memberId from subjectId — the employeeProfiles list has clerkUserId)
   - Add "View →" button in actions column that opens CaseDetailModal
   - Make the entire row clickable (onClick opens modal)
   - Keep the status Select in the actions area for quick status changes
   - Add CaseDetailModal at the bottom of the page
   - Add AgencyBranding at the bottom

3. Update `src/features/hr/pages/EmployeeProfilePage.tsx` CasesTab:
   - Add caseNumber column
   - Add title column
   - Make rows clickable to open CaseDetailModal
   - Add CaseDetailModal to the CasesTab

**Style:** 2-space indent, single quotes, NO semicolons, PascalCase components. Match existing patterns in the codebase.

**After backend changes:** Run `npx convex codegen` (or `CONVEX_DEPLOY_KEY= npx convex codegen --typecheck disable` if blocked).

**Verify with:** npm run lint, npm run typecheck, npm run test, npm run build