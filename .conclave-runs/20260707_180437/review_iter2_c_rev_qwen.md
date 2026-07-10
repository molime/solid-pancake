# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This pull request implements a dev-only bypass for Clerk's email allow-list restrictions when inviting candidates. The changes are comprehensive, touching backend logic, schema, tests, and frontend components. The implementation correctly addresses the core issue while maintaining security and data integrity.

### Summary of Findings

* **Schema Update**: The `candidates` table schema in `convex/schema.ts` has been correctly updated to include `invitationFailed` and `invitationError` fields. This allows tracking the status of invitation attempts.
* **Backend Logic**: The `inviteCandidate` action in `convex/candidates.ts` now includes logic to detect allow-list errors and attempt a bypass using the new `createClerkUserAndJoinOrg` function from `convex/_utils/invitationBypass.ts`. This ensures that candidates can be invited even if their email domain is restricted by Clerk.
* **Error Handling**: The error handling in `inviteCandidate` has been improved to preserve the candidate record on failures and mark the invitation as failed using the new `patchCandidateInvitationError` internal mutation. This prevents data loss and provides better visibility into invitation issues.
* **Frontend Updates**: The `InviteCandidateModal` and `CandidatePipelinePage` components have been updated to display invitation failure status and, in development mode, provide manual credentials or magic links for bypassed candidates. This improves the user experience for HR personnel during development and testing.
* **Testing**: Comprehensive unit and integration tests have been added to `convex/candidates.test.ts` and `convex/invitations.test.ts` to cover the new bypass logic, error handling, and edge cases. These tests ensure the reliability and correctness of the implementation.
* **Security**: The bypass is strictly gated by environment variables (`APP_URL` and `ATRIA_X_DEV_INVITE_BYPASS`) to prevent it from being activated in production environments. This ensures that the bypass is only used for development and testing purposes.

### Merge Readiness

The pull request is well-structured and addresses the requirements outlined in the task. The implementation is robust, secure, and includes comprehensive tests. I recommend merging this pull request after addressing the minor suggestions provided in the review comments. I am unable to directly approve this pull request, and recommend that others review and approve this code before merging.

VERDICT: APPROVED