# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This pull request implements a dev-only bypass for Clerk's email allow-list restrictions when inviting candidates. The changes are well-structured, with new utility functions, schema updates, internal mutations, and frontend modifications to handle the bypass flow. Unit and E2E tests have been added to ensure correctness.

I've identified one critical issue that needs to be addressed before merging, related to a missing import in a new test file. Other changes appear correct and align with the acceptance criteria.

### Summary of Findings
* **Missing Import in Test File**: The new test file `convex/onboarding.test.ts` is missing an import for `Id` from `./_generated/dataModel`, which is used in the new tests. This will cause test failures.
* **Schema Changes**: The `candidates` table schema has been updated to include `invitationFailed` and `invitationError` fields, which is necessary for tracking invitation status.
* **Bypass Implementation**: A new utility file `convex/_utils/invitationBypass.ts` has been created to handle the bypass logic, including user creation and organization membership. This is gated by environment variables to ensure it only runs in development.
* **Frontend Updates**: The frontend components `InviteCandidateModal.tsx` and `CandidatePipelinePage.tsx` have been updated to display bypass information and handle errors appropriately.
* **Test Coverage**: New unit tests have been added to `convex/candidates.test.ts` and `convex/invitations.test.ts` to cover the bypass logic and error handling. An E2E test has also been added to verify the bypass flow.

### Merge Readiness
The pull request implements the required functionality and includes comprehensive tests. However, there is a critical issue in `convex/onboarding.test.ts` where a missing import will cause test failures. This issue must be addressed before merging. I am unable to approve this pull request, and recommend that others review and approve this code before merging.

[Comment on convex/onboarding.test.ts]:


The `Id` type is used on line 80 but is not imported. Please add the import for `Id` from `./_generated/dataModel`.

```typescript
import type { Id } from './_generated/dataModel'
```