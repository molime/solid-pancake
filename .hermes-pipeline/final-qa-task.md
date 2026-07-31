# Final E2E QA Testing — All Batches

You are doing thorough E2E QA testing of the ATRIA-X app. The dev server is running at http://localhost:5173.

## What to Test

### 1. Login Page Product Tabs
- Navigate to http://localhost:5173/sign-in
- Verify 3 pill-style tabs: Candidate Portal, HR Portal, Staff Portal
- Click each tab — subtitle below AtriaLogo should change
- Active tab should be highlighted with accent color

### 2. Position Persistence (Apply → Application Form)
- Navigate to /apply?agency=<slug>
- Select a position
- Complete the apply form and sign in
- On the application form step 0 (Job Description), verify the position is pre-selected
- It should NOT be empty requiring re-selection

### 3. ProgressSteps Overflow
- Navigate to the application form
- Verify the stepper at the top doesn't overflow
- Circles should be 32px (h-8 w-8), labels visible on desktop, hidden on mobile
- On narrow screens, it should scroll horizontally (overflow-x-auto)

### 4. SSN/ITIN Dynamic Label
- In the application form Personal Info step, select SSN — label should say "SSN"
- Select ITIN — label should change to "ITIN"
- Before selecting, label should say "SSN / ITIN"

### 5. Skip Additional Documentation
- Navigate to the additional certifications upload step
- Click "Skip this step"
- Return to checklist — task should show as "Skipped" with a badge
- It should NOT still be asking to upload

### 6. "Candidate Portal" Label (not "Onboarding")
- On all candidate-facing pages, verify the subtitle says "Candidate Portal" not "Onboarding"
- Check: application form, application status, checklist, document upload, profile, offer, acknowledgment, employment agreement, training

### 7. Session Cleanup
- Sign in as HR, navigate around
- Sign out — verify you're on the sign-in page
- Sign in as candidate — verify you land on candidate flow, NOT HR portal
- The stale session issue should be fixed

### 8. HR Logo Size
- Sign in as HR
- Verify the AtriaLogo in the sidebar is large and prominent (h-14, 56px)
- It should be clearly recognizable, not tiny

### 9. HR Cases — Modal
- Go to HR Cases tab
- Click "View →" on a case — modal should open and STAY OPEN
- It should NOT close immediately
- Modal should show: case ID, title, category, status, subject, assigned to, opened date, description
- Status change dropdown should work inside the modal

### 10. HR Cases — Select removed from table
- Verify the table actions column only has "View →" button
- There should be NO Select dropdown for status changes in the table row
- Status changes happen only in the modal

### 11. Agency Branding
- On HR dashboard and HR cases page, verify agency logo + "Powered by ATRIA-X Digital Solutions" appears at the bottom

### 12. SelectAgencyPage — Admin filtering
- If a user has both candidate and admin memberships, verify only the candidate membership appears in the agency picker

### 13. Auto-flag cron (code review)
- Verify convex/crons.ts exists with two daily cron jobs: checkAndFlagIssues and checkExpiringCredentials
- Verify checkAndFlagIssues covers: expiring documents, expiring training, background check issues, candidate pipeline stalls, application rejections, shift issues, unverified documents
- Verify deduplication uses flagType field so the two crons don't create duplicate cases

## Method
- For UI tests: write Playwright scripts that navigate to the pages and verify elements
- For code review: read the source files directly
- Fix any issues found
- Run focused tests after any fix

## Important
- The dev server is at http://localhost:5173
- Do NOT ask questions — finish the task
- Report all findings at the end
