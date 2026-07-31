# Comprehensive E2E QA Testing — ALL Uncommitted Work

You are doing thorough E2E QA testing of ALL uncommitted changes in the ATRIA-X app. The dev server is running at http://localhost:5173.

First, run `git diff --stat HEAD` to see ALL changed files. Then test EVERY feature that was changed.

## Complete List of Features to Test

### Batch 1: Maria's 5 Original Fixes
1. **SelectAgencyPage admin filtering** — candidates/caregivers should NOT see admin org options in the agency picker
2. **ProgressSteps responsiveness** — stepper circles should be 32px (h-8 w-8), labels hidden on mobile, overflow-x-auto for narrow screens, gap-1
3. **SSN/ITIN dynamic label** — in PersonalInfoSection, label shows "SSN" when SSN selected, "ITIN" when ITIN selected, "SSN / ITIN" when empty. In HR ApplicationReviewPage, the label uses the candidate's idType
4. **Document upload skip** — clicking skip on optional additional_certifications calls skipCandidateTask mutation, returns to checklist, task shows as "Skipped" with badge, "Upload now" button to re-open
5. **Login page product label** — subtitle below AtriaLogo shows "Candidate Portal", "HR Portal", or "Staff Portal" based on redirect URL

### Batch 2: HR Cases Enhancement + Agency Branding
6. **Case numbers** — new cases get auto-generated case numbers (HR-2026-001 format)
7. **CaseDetailModal** — clicking a case opens modal showing: case ID, title, category, status badge, subject (with link to employee profile), assigned to, opened date, description, status change Select
8. **Clickable rows** — clicking a case row in HRCasesPage opens the detail modal
9. **EmployeeProfilePage Cases tab** — cases tab rows are clickable with detail modal
10. **AgencyBranding** — agency logo + "Powered by ATRIA-X Digital Solutions" at bottom of HRDashboardPage and HRCasesPage

### Batch 3: Login Product Tabs
11. **Pill-style tab selector** — 3 tabs on sign-in page (Candidate Portal, HR Portal, Staff Portal), clicking changes redirect param + subtitle, active tab highlighted

### Batch 4: Maria's Final Fixes
12. **"Onboarding" → "Candidate Portal"** — all candidate-facing pages show "Candidate Portal" not "Onboarding" as subtitle
13. **"Your onboarding tasks" → "Your tasks"** — checklist heading
14. **"Back to onboarding checklist" → "Back to task list"** — status page buttons
15. **Email domain allowlist** — cleared on prod (verify code allows all domains when list is empty)
16. **Session cleanup** — clearSessionData() called on sign-out (all pages), apply page load, but NOT on sign-in page (to preserve sessionStorage with apply flow position)
17. **Position persistence** — position selected on /apply page should be pre-filled on application form step 0 (sessionStorage 'atriax_apply_position' must survive sign-in)

### Batch 5: Diego's Testing Fixes
18. **ProgressSteps v2** — smaller circles (h-8 w-8), text-xs, gap-1, overflow-x-auto on nav, svg checkmark h-4 w-4
19. **HR logo size** — sidebar AtriaLogo is h-14 (56px), sidebar header is h-20
20. **HR Cases modal fix** — Select dropdown removed from table actions cell, only "View →" button remains, modal stays open when clicked (no immediate close)
21. **Skip fix** — skipCandidateTask works correctly, skipped tasks show in checklist with badge

### Batch 6: Auto-Case Creation
22. **convex/crons.ts** — two daily cron jobs: checkAndFlagIssues (comprehensive) and checkExpiringCredentials (legacy compat)
23. **checkAndFlagIssues** — covers 7 flag types: expiring_document, training_expiry, bg_check_concern, pipeline_stall, application_rejection, shift_issue, unverified_doc
24. **Deduplication** — both crons use flagType field for dedup, no duplicate cases for same subject+flagType
25. **hrDashboardStats** — expiringCredentials count is real (not hardcoded 0)
26. **flagType field** — added to hrCases schema

## Testing Method
- For UI tests (items 1-21): write Playwright scripts that navigate to pages and verify elements exist with correct text/sizes
- For code/backend tests (items 22-26): read the source files and verify the implementation
- For each issue found: fix it, then run focused tests (npx vitest run <file> or npm run lint/typecheck)
- Run the full test suite at the end: npm run lint && npm run typecheck && npm run test && npm run build

## Important
- The dev server is at http://localhost:5173
- Do NOT ask questions — finish the task
- Fix ANY issues found
- Report ALL findings at the end with pass/fail status for each item
