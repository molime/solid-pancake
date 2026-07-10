# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This pull request introduces significant enhancements to the ATRIA-X system, particularly around candidate onboarding, role management, and audit trails. The changes span across backend mutations, tests, and frontend components. Overall, the changes seem well-structured and address the intended functionalities. However, there are a few areas that require closer inspection and potential adjustments.

### Summary of Findings
* **Candidate Onboarding Enhancements**: The PR introduces comprehensive changes to support candidate onboarding, including new mutations for document attachment, background check acknowledgment, and offer management. These changes are accompanied by extensive tests to ensure correctness.
* **Role Management and Authorization**: The PR enhances role management by introducing new roles (e.g., `org:hr`, `org:candidate`) and refining authorization logic. This includes updates to `authHelpers` to correctly resolve roles from Clerk metadata and ensuring that only authorized users can perform specific actions.
* **Audit Trail Improvements**: The PR adds audit trail functionality to several mutations, providing a detailed record of changes and actions within the system. This enhances transparency and accountability.
* **E2E Test Setup and Stability**: The PR includes significant improvements to the E2E test setup, including the introduction of a global setup file, enhanced authentication helpers, and more robust test data management. These changes aim to improve the reliability and stability of E2E tests.

### Merge Readiness
The pull request introduces substantial and valuable features to the ATRIA-X system. However, due to the presence of a high severity issue and several medium severity issues, I recommend that the pull request not be merged until those are addressed. I am unable to directly approve this pull request, and other reviewers should also examine the code and tests before a decision is made to merge it.