# Diego's Testing Fixes — 5 Issues

## Context
Design doc at: C:\Users\pinol\Downloads\diego-testing-fixes-design-doc.md
Read it FIRST before implementing.

## Issue 1: Position not persisted from apply page to job description step
On the /apply page, the user selects a position which is stored in sessionStorage as 'atriax_apply_position'. But when they reach the application form's step 0, the position is empty because our clearSessionData() on the SignInRedirect wipes sessionStorage.

Fix: Remove the clearSessionData() useEffect from SignInRedirect in src/app/router.tsx. The clearSessionData on sign-out and on ApplyEntryPage mount is sufficient — the stale session issue was caused by localStorage (atriax.clerkOrgId), not sessionStorage. The apply flow data in sessionStorage (atriax_apply_position, atriax_apply_slug) must be preserved through the sign-in flow.

After removing it, verify:
- ApplyEntryPage still calls clearSessionData() on mount (it does, in the useEffect)
- All signOut calls still call clearSessionData() first (they do, via handleSignOut)
- The stale session fix (HR user redirecting to candidate portal) still works because clearSessionData on sign-out clears localStorage

## Issue 2: ProgressSteps still overflowing
The stepper with 8 steps overflows even on desktop. The circles are 40px (h-10 w-10) with gap-2.

Fix in src/shared/ui/ProgressSteps.tsx:
- Reduce circle size from 'h-10 w-10' to 'h-8 w-8'
- Reduce text in circles from 'text-sm' to 'text-xs'
- Reduce gap from 'gap-2' to 'gap-1'
- Add 'overflow-x-auto' to the nav element className so it can scroll horizontally if still too wide
- Keep labels hidden on small screens (already 'hidden sm:block')
- Reduce the svg checkmark from 'h-5 w-5' to 'h-4 w-4'

## Issue 3: Skip additional documentation not reflected in checklist
When skipping additional certifications, the task status should change to 'skipped' and the checklist should show it with a "Skipped" badge. Currently it still shows as pending.

The clearSessionData fix (Issue 1) should help — if sessionStorage was being wiped mid-flow, the Convex auth token might have been affected. But also verify:
1. The skipCandidateTask mutation in convex/candidates.ts works correctly
2. The DocumentUploadPage skip button correctly calls skipCandidateTask
3. The CandidateOnboardingPage's skippedOptionalTasks section renders correctly
4. The visibleTasks filter at line 102 (tasks?.filter((t) => t.status !== 'skipped')) correctly excludes skipped tasks from the main list
5. The skippedOptionalTasks at line 109-115 correctly includes skipped optional tasks

If the mutation is failing silently (DocumentUploadPage catches and ignores errors), add error logging.

## Issue 4: HR portal logo too small
The AtriaLogo in the sidebar is h-10 (40px), barely recognizable.

Fix in src/app/shell/Sidebar.tsx:
- Change the sidebar header height from 'h-16' to 'h-20'
- Change the AtriaLogo className from 'h-10' to 'h-14'

## Issue 5: HR Cases modal closing immediately
The CaseDetailModal opens for a second then closes. The likely cause is the Select dropdown in the table's actions cell conflicting with the modal's backdrop click handler.

Fix in src/features/hr/pages/HRCasesPage.tsx:
- Remove the Select dropdown from the actions cell (lines 152-169)
- Keep only the "View →" button in the actions cell
- Status changes happen only inside the CaseDetailModal (which already has a Select)
- This simplifies the UI and prevents click event conflicts

Note on case IDs: Old cases created before the caseNumber field was added will show "—". New cases will have proper IDs (HR-2026-001 format). This is expected — no code fix needed.

Note on automatic case creation: This is a future enhancement, not a current bug. Do NOT implement it in this batch.

## Style
- 2-space indent, single quotes, NO semicolons
- Match existing patterns

## Verify
- npm run lint
- npm run typecheck
- npm run test
- npm run build