# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This is a comprehensive implementation of the HR module for ATRIA-X, covering all the required frontend pages, backend mutations, and integration points. The changes span across both frontend and backend, with careful attention to tenant isolation, role-based access control, and data consistency.

Key highlights:
- All new HR pages and components are implemented with proper routing and guards
- Backend mutations for HR cases and candidate management are well-tested and secure
- UI components are pixel-faithful to the Figma designs with proper error handling
- Extensive test coverage added for both frontend and backend functionality
- Proper integration with existing systems like document archive, audit logging, and role management

The implementation correctly handles multi-tenancy, role validation, and cross-tenant isolation. PHI handling appears to be done correctly by only exposing data that already exists in the schema.

I've identified a few areas for improvement, mostly related to test completeness and minor UI enhancements.

### Summary of Findings
* **Missing Test Coverage for HireConvertPage Error Handling**: The `HireConvertPage` component lacks tests for error handling scenarios when the `hireCandidate` mutation fails. This is a critical path that should be covered.
* **Incomplete Test Coverage for NewCaseModal Validation**: The `NewCaseModal` component's form validation (disabling submit button when fields are empty) is not fully tested. This could lead to a poor user experience if the validation doesn't work as expected.
* **Potential Race Condition in ShiftEditorModal**: The `ShiftEditorModal` component fetches caregiver shifts to check for schedule conflicts. If the shift creation/update happens before the availability data is fully loaded, it might not correctly detect conflicts. This is a minor issue but worth considering.

### Merge Readiness
The pull request is almost ready for merging. The core functionality is well-implemented and tested. However, there are a few medium-severity issues that should be addressed before merging to ensure robustness and maintainability. I am unable to approve this pull request, and recommend that others review and approve this code before merging.

VERDICT: CHANGES_REQUESTED