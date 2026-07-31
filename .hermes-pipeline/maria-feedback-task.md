# Maria's Feedback Batch — 5 Issues to Fix

## Context
Maria tested the ATRIA-X production app and reported 5 issues. The design doc with full analysis, two-solution comparison per issue, and staged implementation is at: C:\Users\pinol\Downloads\maria-feedback-batch-design-doc.md

Read that design doc FIRST before implementing. It has the root cause analysis, proposed solutions, and selected approach for each issue.

## The 5 Issues

### Issue 1: Candidates see admin agency option on Select Agency page
When a candidate returns to the application, they land on /select-agency and see agency cards showing "Role: admin". Candidates should not see admin options.

Root cause: SelectAgencyPage.tsx renders ALL Clerk org memberships including admin ones. If a user has both a candidate membership and an admin membership, they see both.

Fix: Filter memberships to hide admin-role memberships when the user also has candidate/caregiver roles. In SelectAgencyPage.tsx, before the `userMemberships.data?.map(...)` block (around line 317), filter memberships: if the user has any membership with atriaRole of 'org:candidate' or 'org:caregiver', filter out memberships where atriaRole is 'org:admin' or role is 'org:admin'.

Files: src/app/auth/SelectAgencyPage.tsx, src/app/auth/SelectAgencyPage.test.tsx

### Issue 2: Application stepper out of bounds on small screens
The ProgressSteps component at the top of the application form overflows on smaller screens. Maria says "Esto sale del rango en el debe estar".

Root cause: ProgressSteps.tsx shows step labels at all screen sizes. With 6 steps, labels squeeze and overflow on mobile.

Fix: Hide step labels on small screens (below sm breakpoint). In ProgressSteps.tsx, change the label container div (around line 130) from `className="mt-2 px-1"` to `className="mt-2 px-1 hidden sm:block"`. The circles remain visible at all sizes, and the "Step X of Y" text above the stepper already provides context.

Files: src/shared/ui/ProgressSteps.tsx, src/shared/ui/sharedUi.test.tsx (if needed)

### Issue 3: SSN/ITIN field should always indicate which was selected
The candidate application form has an ID type dropdown (SSN or ITIN) and a combined "SSN / ITIN" input. But in the HR review page, the label always says "SSN" regardless of what the candidate selected. Maria wants the label to reflect the actual selection everywhere the value is displayed.

Root cause: 
1. In ApplicationReviewPage.tsx line 845: `<ApplicationField label="SSN" value={String(i9.ssn ?? '')} />` — hardcoded "SSN".
2. In PersonalInfoSection.tsx line 97: `<FieldGroup label='SSN / ITIN' ...>` — always shows "SSN / ITIN" even after idType is selected.

Fix:
1. In ApplicationReviewPage.tsx, change the SSN label to use the candidate's idType. The application fields data has `fields.personal.idType` which is 'ssn' or 'itin'. Change line 845 to use a dynamic label: `label={((fields.personal as Record<string, unknown>)?.idType ?? 'ssn').toString().toUpperCase()}` — but verify the exact data path by reading the code.
2. In PersonalInfoSection.tsx, when idType is selected (value.idType is not empty), show the selected type as the label instead of "SSN / ITIN": `label={value.idType ? value.idType.toUpperCase() : 'SSN / ITIN'}`.

Files: src/features/hr/pages/ApplicationReviewPage.tsx, src/features/onboarding/components/application/PersonalInfoSection.tsx

### Issue 4: Skip on optional document upload doesn't let you skip
On the additional certifications upload page, the "Skip this step" button navigates to /onboarding but doesn't mark the task as skipped. When the candidate returns to the checklist, the task is still pending and appears as the next step, creating a loop.

Root cause: DocumentUploadPage.tsx line 497: the skip button only calls `navigate('/onboarding')` without marking the task as skipped in the backend. There's no skipTask mutation in convex/candidates.ts.

Fix:
1. Add a `skipCandidateTask` mutation in convex/candidates.ts that sets a task's status to 'skipped'. It should:
   - Take clerkOrgId and taskId as args
   - Use requireTenant for auth
   - Validate the task belongs to the tenant (assertTenantDoc)
   - Only allow skipping optional tasks (check OPTIONAL_TASK_TYPES)
   - Patch the task status to 'skipped'
2. In DocumentUploadPage.tsx, call skipCandidateTask before navigating. Add a useMutation for api.candidates.skipCandidateTask, and call it in the skip button onClick.
3. In CandidateOnboardingPage.tsx, the filter at line 96 already excludes skipped tasks: `tasks?.filter((t) => t.status !== 'skipped')`. But Maria wants skipped optional tasks to show with a "Skipped" badge and a button to re-open if they change their mind. So:
   - Keep the existing visibleTasks filter for the main list
   - Add a separate section for skipped optional tasks showing them with a "Skipped" badge and a button to re-open (navigate to the upload page)
   - When re-opened, the task status needs to go back to 'pending'. Add a `unskipCandidateTask` mutation or reuse a generic updateTaskStatus mutation. Actually, the simplest: just navigate to the upload page — the upload page will reset the status to pending when the user uploads something. But if they navigate there and skip again, that's fine too. Actually, to unskip, we need a mutation. Let's add `unskipCandidateTask` or make the skip button on the checklist call a mutation to set status back to 'pending'.

Wait, keep it simple. The existing code already filters out skipped tasks from the visible list. Let me adjust: instead of completely hiding skipped tasks, show them at the bottom of the checklist with a "Skipped" badge and an "Upload now" button that navigates to the upload page. When they click "Upload now", navigate to the upload page. The DocumentUploadPage already handles uploads — when a file is submitted, the attachCandidateDocument mutation will set the task status to 'complete'. We don't need an unskip mutation — just navigating to the upload page is enough; if they upload, it becomes complete; if they skip again, it stays skipped.

But we DO need to make sure the task is visible on the checklist when skipped. Currently `visibleTasks` filters out ALL skipped tasks (line 96). We need to change this to only filter out skipped tasks that are NOT optional, or show skipped optional tasks separately.

The simplest approach: change the filter to show skipped optional tasks at the bottom with a different styling.

Files: convex/candidates.ts, convex/candidates.test.ts, src/features/onboarding/pages/DocumentUploadPage.tsx, src/features/onboarding/pages/CandidateOnboardingPage.tsx

### Issue 5: Login page should indicate which ATRIA product it is
Maria wants the login page to specify which ATRIA product the user is logging into (candidate portal, HR portal, etc.). She prefers a single login page but wants a label/indicator.

Root cause: SignInRedirect in router.tsx (lines 198-211) renders Clerk's SignIn with just the AtriaLogo above it. No product/context label is shown.

Fix: Add a contextual subtitle below the AtriaLogo on the sign-in page. Derive the product label from the redirect URL parameter:
- If redirect includes '/onboarding' or '/caregiver': "Candidate Portal"
- If redirect includes '/hr': "HR Portal"  
- If redirect includes '/coordinator': "Staff Portal"
- Default (/select-agency): no label

Files: src/app/router.tsx, src/app/router.test.tsx (if needed)

## Constraints
- Keep changes conservative and minimal
- Follow the project style: 2-space indent, single quotes, NO semicolons, PascalCase components
- Do NOT make changes to existing services unless absolutely necessary
- Run npx convex codegen after any convex/ changes
- Verify with: npm run lint, npm run typecheck, npm run test, npm run build
- Read files before editing — do not hallucinate code
- The full design doc with detailed analysis is at C:\Users\pinol\Downloads\maria-feedback-batch-design-doc.md