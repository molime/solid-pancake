# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This is a comprehensive and well-executed implementation of the Phase 2 candidate onboarding portal. The changes address all the core requirements, including the critical document upload bug, routing cleanup, checklist/task alignment, and offer flow improvements. The code is clean, well-tested, and adheres to the project's style and structure.

### Summary of Findings

* **Document Upload Fix**: The core issue of document upload failing in development due to CORS/reachability from `127.0.0.1` is resolved by introducing a new `uploadFileToConvex` helper and configuring a Vite proxy for `/api/storage`. This is a robust and well-implemented solution.
* **Routing and Task Management**: The routing logic in `CandidateOnboardingIndex` and task-specific navigation in `CandidateOnboardingPage` have been correctly updated to align with the backend task types and desired user flow. Document tasks are now correctly routed by `task._id`.
* **Application Form and Offer Flow**: The `ApplicationFormPage` has been rewritten to match the Figma entry form, and the `ApplicationReviewPage` now correctly handles and passes all offer fields, including the previously missing `expiresAt`, to the `sendOffer` mutation.
* **Security and Tenancy**: All touched mutations and queries correctly enforce tenant roles using `requireTenantRole` and `assertTenantDoc`, ensuring data isolation. The new `org:candidate` role is properly integrated into file upload permissions.
* **Testing**: Comprehensive unit and integration tests have been added or updated to cover the new functionality and edge cases, including the candidate lifecycle, file uploads, and role-based access control. The existing test suite continues to pass.
* **E2E Test Harness Improvement**: The E2E test harness has been significantly improved with new authentication helpers, environment management, and deterministic fixture seeding, making the tests more reliable and easier to run.

### Merge Readiness

The code changes are well-implemented, thoroughly tested, and address all the requirements outlined in the task. I have no concerns with merging this pull request. However, I am unable to directly approve the pull request, and recommend that others review and approve this code before merging.

VERDICT: APPROVED