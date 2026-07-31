# E2E HR User Role Resolution Fix

## Problem
Two E2E tests fail because the HR user (phase2-hr@atriax.example.com) gets redirected to the candidate onboarding page instead of the HR application review page. The `members.me` query returns `org:candidate` instead of `org:hr` for the HR user.

## Root Cause Hypothesis
When the HR user signs in via Clerk ticket, `ensureSelectedAgency` runs on first login. This function:
1. Checks if a `tenantMembers` record already exists for this user
2. If yes, patches displayName/email but does NOT change the role
3. If no, creates a new record using `getClerkOrganizationRole(identity) ?? defaultRole`
4. `defaultRole` is `org:caregiver` unless there's an existing candidate record (then `org:candidate`)

The HR user might have a candidate record in the `candidates` table from a previous E2E run, causing `ensureSelectedAgency` to default them to `org:candidate`.

BUT — the seed function (`resetE2ECandidate`) creates a `tenantMembers` record with `org:hr` for the HR user. If `ensureSelectedAgency` finds this existing record, it should NOT change the role (step 2 above — it only patches displayName/email).

So the issue might be:
1. The seed creates the tenantMembers record with org:hr
2. The HR user signs in
3. `ensureSelectedAgency` finds the existing record and patches it (keeping org:hr)
4. But `members.me` queries by `clerkUserId` and might not find it if the Clerk user ID doesn't match

OR:
1. The seed runs in `beforeEach` using the candidate's token
2. The seed creates tenantMembers for the HR user with the correct clerkUserId
3. The HR user signs in with a ticket
4. The Clerk user ID in the JWT might be different from what the seed used

OR:
1. The HR user has BOTH a tenantMembers record (org:hr) AND a candidates record
2. The `members.me` query in `ensureSelectedAgency` finds the tenantMembers record
3. But the `TenantRoleRouteGuard` uses `members.me` which calls `requireTenant` -> `requireTenant` might resolve the wrong member

## Task
1. Read `convex/members.ts` - the `me` query and `checkMembership` function
2. Read `convex/tenants.ts` - the `ensureSelectedAgency` function
3. Read `convex/authHelpers.ts` - the `requireTenant` function, especially the no-org-membership path
4. Read `convex/seed.ts` - the `seedE2ECandidateFixtures` function to see how the HR member is created
5. Read `tests/e2e/helpers/auth.ts` - the `signInWithClerk` function and how org is set
6. Read `tests/e2e/helpers/seed.ts` - the `resetE2ECandidate` function and `findClerkUserId`

Figure out why the HR user's role is being resolved as `org:candidate` instead of `org:hr` and fix it.

The dev server is running at http://localhost:5173.
The dev Convex is at https://tidy-crocodile-154.convex.cloud.
The dev Clerk org ID is org_3Dz8teqlLdIf7bWcDrAN4DtVKWA.
The E2E HR email is phase2-hr@atriax.example.com.

Key files to check:
- convex/members.ts (the `me` query)
- convex/tenants.ts (ensureSelectedAgency)
- convex/authHelpers.ts (requireTenant, the no-org path)
- convex/seed.ts (how HR member is seeded)
- tests/e2e/helpers/auth.ts (signInWithClerk, how active org is set)
- tests/e2e/helpers/seed.ts (resetE2ECandidate, findClerkUserId)

The HR user on dev Clerk has role org:hr (NOT using atriaRole publicMetadata workaround like prod).
The dev Clerk JWT template now includes org_public_metadata.
The HR user does NOT have atriaRole in their publicMetadata on dev Clerk.

Run any focused tests after fixing. Do NOT ask questions - finish the task.