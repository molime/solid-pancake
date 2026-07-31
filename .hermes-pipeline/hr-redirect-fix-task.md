# E2E HR User Redirect Fix — Final Attempt

## Problem
Two E2E tests fail because the HR user (phase2-hr@atriax.example.com, Clerk user_3G9RlC6JHLyePFMTMYhZvUIXUR5) gets redirected to the candidate onboarding page (/onboarding) instead of seeing the HR application review page at /hr/candidates/:id.

## Verified Facts
1. HR user has 1 Clerk org membership: org_3Dz8teqlLdIf7bWcDrAN4DtVKWA with role org:hr
2. HR user has 1 tenantMembers record in dev Convex with role org:hr, clerkUserId user_3G9RlC6JHLyePFMTMYhZvUIXUR5
3. HR user has NO candidates record
4. Dev Clerk JWT template now includes org_public_metadata (was missing before)
5. The HR user's Clerk publicMetadata does NOT have atriaRole (dev uses org:hr as actual Clerk role, not the workaround)
6. The page snapshot shows the HR user landing on the candidate onboarding checklist (/onboarding) — meaning the TenantRoleRouteGuard redirected them because members.me returned a role that's not org:admin or org:hr

## Hypothesis
The issue is a timing/race condition in the Clerk ticket sign-in flow:
1. signInWithClerk creates a ticket, navigates to /sign-in?__clerk_ticket=...
2. Clerk processes the ticket and redirects to /select-agency (forceRedirectUrl)
3. SelectAgencyPage auto-selects the 1 org membership, calls setActive({ organization: orgId })
4. Bootstrap effect calls ensureSelectedAgency mutation
5. ensureSelectedAgency calls requireActiveClerkOrganization which checks org_id in JWT
6. If the JWT hasn't refreshed yet after setActive, org_id is missing → throws
7. The error is caught, retried after 400ms
8. If 400ms isn't enough, the retry also fails
9. The SelectAgencyPage shows an error, the test's selectOrgIfAsked doesn't handle this
10. The test continues, navigates to /hr/candidates/:id, but the app redirects to /onboarding because members.me still returns the wrong role

OR:

The issue might be that ensureSelectedAgency succeeds but creates a NEW tenantMembers record with the wrong role (org:caregiver or org:candidate) because the existing record lookup fails. Check if the existingMember lookup at line 118-123 of tenants.ts uses identity.subject which matches the clerkUserId in the tenantMembers table.

OR:

The issue might be that the SelectAgencyPage's getVisibleMemberships filter (our new code) is interfering. Check if the HR user's membership has atriaRole in publicMetadata or not, and if getVisibleMemberships handles the case where atriaRole is undefined correctly.

## Task
1. Read the full signInWithClerk function in tests/e2e/helpers/auth.ts (lines 245-290)
2. Read the full selectOrgIfAsked function (lines 152-200)
3. Read the full waitForWorkspaceReady function (lines 136-150)
4. Read the SelectAgencyPage auto-select logic (src/app/auth/SelectAgencyPage.tsx lines 109-140)
5. Read the bootstrap effect (lines 150-220)
6. Read the ensureSelectedAgency mutation (convex/tenants.ts lines 86-170)
7. Read the requireActiveClerkOrganization function (convex/authHelpers.ts lines 238-251)
8. Read the members.me query (convex/members.ts lines 81-93) and requireTenant (convex/authHelpers.ts lines 22-50)

Then figure out why the HR user ends up on /onboarding instead of /hr and fix it.

The fix should be in the E2E test helpers or the app code. If it's a timing issue, add a longer retry or a different wait strategy. If it's a code bug, fix the code.

After fixing, run these specific E2E tests to verify:
```
E2E_FULL=1 node --env-file .env.e2e ./node_modules/@playwright/test/cli.js test tests/e2e/application-car-insurance.spec.ts tests/e2e/onboarding-application.spec.ts --reporter=line
```

The dev server is running at http://localhost:5173.
Do NOT ask questions — finish the task.