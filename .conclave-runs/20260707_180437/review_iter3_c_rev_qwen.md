# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

The changes implement the dev-only Clerk invitation bypass for local development, allowing `@gmail.com` candidates to be invited despite Clerk's email allow-list restrictions. The implementation covers all acceptance criteria from the plan, including schema updates, bypass logic, frontend UI changes, and comprehensive tests.

Key aspects well handled:
- Schema updates with `invitationFailed` and `invitationError` fields
- Proper environment gating for bypass functionality
- Preservation of candidate records on invitation failures
- Clear error handling and propagation
- Comprehensive unit and E2E tests
- Security considerations for dev-only features

Areas for improvement:
- Some redundant code in `employeeProfiles.ts` that duplicates logic from `candidates.ts`
- Missing E2E test for the bypass functionality in `tests/e2e/onboarding.spec.ts`

Overall, the implementation is solid and addresses the core issue effectively.

### Summary of Findings
* **Redundant Code**: The `employeeProfiles.ts` file duplicates the admin lookup logic that was centralized in `candidates.ts`. This could lead to maintenance issues if the logic needs to change in the future.
* **Missing E2E Test**: While unit tests cover the bypass functionality, there's no E2E test in `tests/e2e/onboarding.spec.ts` to verify the end-to-end flow of inviting a candidate via bypass and signing in. This reduces confidence in the complete workflow.

### Merge Readiness
The pull request is almost ready for merging. The core functionality is well-implemented and tested. However, there are a couple of issues that should be addressed first:

1.  The redundant code in `employeeProfiles.ts` should be refactored to use the shared logic.
2.  An E2E test should be added to `tests/e2e/onboarding.spec.ts` to cover the bypass workflow.

Once these issues are resolved, the PR should be good to merge. I am unable to directly approve this pull request, and recommend that others review and approve this code before merging.

[Comment on convex/employeeProfiles.ts]:


This logic for finding the first org admin is duplicated from `candidates.ts`. Consider refactoring to use a shared utility function to avoid redundancy and ensure consistency.

```typescript
    const admin = await ctx.runQuery(api.members.firstOrgAdmin, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!admin) {
      throw new ConvexError(
        'No organization admin available to send Clerk invitation.',
      )
    }
```

[Comment on convex/candidates.ts]:


Consider adding a check to ensure that the `admin` object is not null before accessing `admin.clerkUserId`. This will prevent potential runtime errors if no admin is found.

```typescript
    const admin = await ctx.runQuery(api.members.firstOrgAdmin, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!admin) {
      throw new ConvexError(
        'No organization admin available to send Clerk invitation.',
      )
    }
```