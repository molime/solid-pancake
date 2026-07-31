# E2E QA Testing Task — ATRIA-X Production App

You are doing thorough manual QA testing of the ATRIA-X app running at http://localhost:5173.

## What to Test

### 1. Login Page Product Tabs
- Navigate to http://localhost:5173/sign-in
- Verify three tab buttons are visible: "Candidate Portal", "HR Portal", "Staff Portal"
- Click each tab and verify:
  - The URL `redirect` param changes
  - The product label subtitle below the AtriaLogo updates accordingly
  - The active tab is highlighted with the accent color
  - When no tab matches (default /select-agency), no tab is highlighted

### 2. ProgressSteps Responsiveness
- Navigate to the application form page (if accessible)
- Verify the ProgressSteps component shows circles at all sizes
- Verify step labels are hidden on mobile-width viewport and visible on desktop

### 3. SSN/ITIN Dynamic Label
- On the application form, select "SSN" as ID type
- Verify the field label changes to "SSN" (not "SSN / ITIN")
- Select "ITIN" as ID type
- Verify the field label changes to "ITIN"

### 4. SelectAgencyPage Admin Filtering
- This requires auth — just verify the code logic is correct by reading the SelectAgencyPage.tsx file
- Confirm that getVisibleMemberships filters out admin memberships when user has candidate/caregiver roles

### 5. HR Cases — Case Detail Modal
- Navigate to the HR cases page (if accessible)
- Verify the table has Case ID, Title, Employee, Type, Status, Assigned, View columns
- Click a case row or "View →" link
- Verify a CaseDetailModal opens showing: case number, title, category, status badge, description, subject name, assigned to, created date
- Verify you can change status inside the modal
- Verify the modal can be closed

### 6. Agency Branding
- On the HR dashboard page, verify the agency logo + "Powered by ATRIA-X Digital Solutions" text appears at the bottom
- On the HR cases page, verify the same branding appears at the bottom

### 7. Document Upload Skip
- This requires candidate auth — verify the code logic by reading DocumentUploadPage.tsx
- Confirm the skip button calls skipCandidateTask mutation before navigating
- Confirm the button is hidden when task status is 'complete'

## How to Test
Use Playwright via a Node.js script. Write the script to a temp file and run it with node. The dev server is at http://localhost:5173.

For pages that require authentication, you can:
1. Read the source code to verify the logic is correct
2. Use the screenshot harness at /dev/screenshots if available
3. Mock auth by setting localStorage values if needed

Write a comprehensive Playwright test script that covers as many of these as possible. For items that require auth and can't be easily tested, read the source code and verify the logic is correct.

Run the script and report results. Fix any issues found.