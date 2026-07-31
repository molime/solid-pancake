# Maria's Final Fixes — 3 Issues

## Context
Design doc at: C:\Users\pinol\Downloads\maria-final-fixes-design-doc.md
Read it FIRST before implementing.

## Issue 1: "Onboarding" label → "Candidate Portal"
The word "Onboarding" appears as a subtitle below the AtriaLogo on all candidate-facing pages. Maria says this is wrong because candidates haven't been hired yet — onboarding happens after hiring.

Change the "Onboarding" subtitle text to "Candidate Portal" on these files:
- src/features/onboarding/pages/ApplicationFormPage.tsx (line ~855)
- src/features/onboarding/pages/ApplicationStatusPage.tsx (line ~135)
- src/features/onboarding/pages/CandidateOnboardingPage.tsx (line ~160)
- src/features/onboarding/pages/CandidateProfilePage.tsx (line ~61)
- src/features/onboarding/pages/DocumentUploadPage.tsx (line ~287)
- src/features/onboarding/pages/EmploymentAgreementPage.tsx (line ~112)
- src/features/onboarding/pages/OfferAcceptancePage.tsx (line ~100)
- src/features/onboarding/pages/AcknowledgmentPage.tsx (line ~77)

Also change these user-visible texts:
- "Your onboarding tasks" → "Your tasks" (CandidateOnboardingPage.tsx line ~170)
- "View my onboarding tasks" → "View my tasks" (ApplicationStatusPage.tsx line ~255)
- "Back to onboarding checklist" → "Back to task list" (ApplicationStatusPage.tsx lines ~260, ~270)
- "Complete your onboarding tasks" → "Complete your tasks" (ApplicationStatusPage.tsx line ~53)

Update any tests that assert on the "Onboarding" text.

## Issue 2: Email domain allowlist — ALREADY FIXED
The prod tenant's allowedEmailDomains has been cleared (set to empty array). All email domains are now allowed. No code changes needed for this issue.

## Issue 3: Stale session data causing wrong redirect
Maria started the candidate flow and it sent her to the HR portal because stale localStorage/sessionStorage/cookies from a previous HR login persisted. After clearing cookies, it worked.

### Fix
1. Create `src/shared/lib/clearSession.ts` with a `clearSessionData()` function that:
   - Clears localStorage
   - Clears sessionStorage
   - Clears all cookies (set expiry to past for multiple path/domain combinations)

2. Call `clearSessionData()` when the sign-in page loads:
   - In `SignInRedirect` component (src/app/router.tsx), add a useEffect that calls clearSessionData() on mount

3. Call `clearSessionData()` before every signOut:
   - Every page that calls `signOut(() => navigate('/sign-in'))` should call clearSessionData() first
   - Create a helper pattern: `() => { clearSessionData(); signOut(() => navigate('/sign-in')) }`
   - Files with signOut calls:
     - src/app/shell/Topbar.tsx (line ~73)
     - src/app/shell/PlatformShell.tsx (lines ~48, ~69)
     - src/app/auth/SelectAgencyPage.tsx (line ~329)
     - src/features/onboarding/pages/ApplicationFormPage.tsx (line ~858)
     - src/features/onboarding/pages/ApplicationStatusPage.tsx (line ~138)
     - src/features/onboarding/pages/CandidateOnboardingPage.tsx (line ~163)
     - src/features/onboarding/pages/CandidateProfilePage.tsx (line ~64)
     - src/features/onboarding/pages/DocumentUploadPage.tsx (line ~290)
     - src/features/onboarding/pages/EmploymentAgreementPage.tsx (line ~115)
     - src/features/onboarding/pages/OfferAcceptancePage.tsx (line ~103)
     - src/features/onboarding/pages/AcknowledgmentPage.tsx (line ~80)
     - src/features/onboarding/pages/TrainingPage.tsx (line ~880)
     - src/features/onboarding/pages/ApplyEntryPage.tsx (line ~171)

4. In ApplyEntryPage.tsx, replace the inline localStorage/sessionStorage/cookie cleanup code (lines 22-38) with a call to clearSessionData()

5. Add tests for clearSessionData utility

## Style
- 2-space indent, single quotes, NO semicolons
- Match existing patterns in the codebase

## Verify
- npm run lint
- npm run typecheck
- npm run test
- npm run build