# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This change implements the candidate onboarding and platform training functionality as specified in the task. The implementation is comprehensive, covering all 16 required endpoints and associated data models.

Key aspects well-implemented:
- Proper use of authHelpers for role-based access control
- Integration with existing Clerk invitation system
- Proper audit logging for candidate lifecycle events
- Idempotent platform training completion
- Proper ADP sync worker scheduling on hire
- Good error handling and data validation

A few minor observations:
- The `deleteInvitedCandidate` mutation could potentially orphan related `applications` records if they exist (though unlikely for newly invited candidates). Consider deleting these as well.
- The `hireCandidate` mutation has complex logic for linking/creating employee profiles. While comprehensive, it might benefit from additional unit tests to cover all edge cases.

Overall, the implementation satisfies the requirements and follows the specified patterns and conventions.

VERDICT: APPROVED