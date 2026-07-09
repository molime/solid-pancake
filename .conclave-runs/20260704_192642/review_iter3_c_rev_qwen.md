# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This change implements the candidate onboarding and platform training functionality as specified in the task. The implementation is comprehensive, covering all 16 required endpoints with proper role-based access control, audit logging, and integration with existing systems like Clerk invitations and ADP sync.

Key aspects well-implemented:
- Schema changes correctly add necessary indexes and fields
- Role-based access control properly enforced via `requireTenantRole` and new `requireTenantRoleAction`
- Audit logging consistently applied across mutations
- Proper handling of candidate identity linkage through `members.sync`
- Idempotent operations where required (e.g., `completePlatformTraining`)
- Correct integration with ADP sync worker for new hires

The code follows established patterns in the codebase and maintains consistency with existing style and architecture. All tests pass and linting/type checking is clean.

No critical, high, or medium severity issues were identified. The implementation correctly handles edge cases around candidate status transitions, document management, and task completion.

VERDICT: APPROVED