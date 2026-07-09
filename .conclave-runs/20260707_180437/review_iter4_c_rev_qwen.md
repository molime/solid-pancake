# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This pull request implements a dev-only bypass for Clerk's email allow-list restrictions when inviting candidates. The changes are comprehensive, touching backend logic, schema, frontend components, and tests. The implementation correctly addresses the core issue while maintaining security and data integrity.

Key improvements include:
- Schema updates to track invitation failures.
- A new utility for bypassing Clerk restrictions in development.
- Modifications to candidate invitation logic to use the bypass and preserve records on failure.
- Frontend updates to display invitation status and dev-only bypass information.
- Extensive unit and E2E tests covering various scenarios.

The code is well-structured, and the tests provide good coverage for the new functionality. No critical or high severity issues were found.

[Comment on convex/candidates.ts]:


Consider adding a more descriptive error message that includes the candidate's email for better debugging.

```typescript
      throw new ConvexError(
        `No organization admin available to send Clerk invitation for candidate ${args.email}.`,
      )
```

[Comment on convex/candidates.ts]:


Consider extracting the error message into a constant for better maintainability and consistency.

```typescript
          const bypassMessage =
            bypassErr instanceof Error ? bypassErr.message : DEV_BYPASS_FAILED_MESSAGE
```

[Comment on convex/candidates.ts]:


Consider extracting the error message into a constant for better maintainability and consistency.

```typescript
        invitationError:
          err instanceof Error ? err.message : INVITATION_REQUEST_FAILED_MESSAGE,
```

[Comment on convex/employeeProfiles.ts]:


Consider adding a more descriptive error message that includes the employee's email for better debugging.

```typescript
      throw new ConvexError(
        'No organization admin available to send Clerk invitation for employee ${args.email}.',
      )
```