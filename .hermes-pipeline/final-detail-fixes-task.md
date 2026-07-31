# Final Detail Fixes — 3 Issues

## Context
Design doc at: C:\Users\pinol\Downloads\final-detail-fixes-design-doc.md
Read it FIRST before implementing.

## Issue 1: Screen flashes (blank/loader) in candidate flow — CRITICAL UX

### Problem
Several times during the candidate application flow, the screen goes blank or shows a loader, then comes back. The candidate should NEVER be taken out of the flow — neither blank screen nor loader is acceptable once the page has loaded.

### Root Cause
Candidate pages gate rendering on loading state from useTenant (isLoading, clerkOrgId). These values briefly flicker during Clerk token refreshes and Convex auth re-authentication, causing the page to unmount and remount.

### Fix: Sticky mounting pattern
Once the page has rendered its content once, NEVER show a loading state again — even if auth/query state briefly flickers.

For each page, add a `hasMountedRef`:
```tsx
const hasMountedRef = useRef(false)
const lastClerkOrgIdRef = useRef<string | undefined>(undefined)

// Keep ref in sync when value is available
if (clerkOrgId) lastClerkOrgIdRef.current = clerkOrgId

// Only show loader on FIRST load, never after
if (!hasMountedRef.current && (isLoading || !clerkOrgId)) {
  return <AppLoader fullScreen />
}
hasMountedRef.current = true

// Use last known clerkOrgId if current is briefly undefined
const effectiveClerkOrgId = clerkOrgId ?? lastClerkOrgIdRef.current
```

Then use `effectiveClerkOrgId` instead of `clerkOrgId` for queries and mutations.

Apply this pattern to:
- src/features/onboarding/pages/ApplicationFormPage.tsx (line ~432, also has !userLoaded check)
- src/features/onboarding/pages/CandidateOnboardingPage.tsx (line ~138)
- src/features/onboarding/pages/ApplicationStatusPage.tsx (line ~131)
- src/features/onboarding/pages/DocumentUploadPage.tsx (line ~131)

Import useRef if not already imported.
Import AppLoader where not already imported.

IMPORTANT: The existing content should NEVER be replaced by a loader once it has been shown. The user must stay in the flow at all times after the initial load.

## Issue 2: HR dashboard logo still too small

### Problem
The AtriaLogo in the HR sidebar is still tiny and indistinguishable. The sidebar is 240px wide but the logo uses h-14 (56px height) with w-auto, making a horizontal logo appear tiny.

### Fix
In src/app/shell/Sidebar.tsx line 229:
Change: `<AtriaLogo className="h-14" />`
To: `<AtriaLogo className="w-full max-h-16 object-contain px-2" />`

This makes the logo fill the available sidebar width (208px after px-4 padding), which for a horizontal logo is much larger and more prominent.

Also check src/app/shell/PlatformShell.tsx for any AtriaLogo and apply the same width-based fix if needed.

## Issue 3: Auto-flag not triggering for expiring documents

### Problem
Documents uploaded with expiry dates within 3 days were not flagged as HR cases. The cron only runs at 6 AM UTC daily.

### Fix

### 3a: Manual trigger mutation
Add `triggerFlagCheck` mutation in convex/hrCases.ts:
- Args: { clerkOrgId: string }
- Guarded by requireTenantRole with HR_ROLES (same as other HR queries)
- Runs the same check helpers (checkExpiringDocuments, etc.) scoped to the caller's tenant
- Returns { created: number }

### 3b: "Check for issues" button on HRCasesPage
In src/features/hr/pages/HRCasesPage.tsx, add a button next to "New case":
- Button text: "Check for issues" with a RefreshCw icon
- Uses useMutation(api.hrCases.triggerFlagCheck)
- On click: calls the mutation, shows toast with result count, cases list refreshes
- Place it before the "New case" button

### 3c: Real-time flag after document upload
In convex/candidates.ts, in the `attachCandidateDocument` mutation:
- After creating the documentArchiveItem, if args.expiresAt is set and within 30 days of now
- Schedule the checkAndFlagIssues internal mutation to run immediately
- Add: `if (args.expiresAt && new Date(args.expiresAt).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000) { ctx.scheduler.runAfter(0, internal.hrCases.checkAndFlagIssues, {}) }`
- Import internal from './_generated/api' if not already imported

### 3d: Tests
- Test triggerFlagCheck creates cases for expiring docs
- Test that it's HR-role guarded
- Test that non-HR roles are rejected

## Style
- 2-space indent, single quotes, NO semicolons
- Match existing patterns

## Verify
- npm run lint
- npm run typecheck
- npm run test
- npm run build
