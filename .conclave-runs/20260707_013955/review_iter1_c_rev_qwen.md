# http://localhost:11434/api/chat
# model=qwen3-coder:480b-cloud status=200

## Code Review

This is a substantial update that significantly enhances the test coverage, fixes several bugs, and adds new functionality. The changes are largely well-implemented and align with the acceptance criteria. However, there are a few critical issues that need to be addressed before approval.

### Summary of Findings
1. **Critical Bug in `candidates.test.ts`**: The assertion for verifying the Clerk API call in `updateClerkMembershipRole` was weakened, potentially masking incorrect behavior.
2. **Security Risk in `files.ts`**: A new permission was added that could expose files to candidates inappropriately.
3. **Test Coverage Gaps**: Several new functions and complex logic lack corresponding test coverage.
4. **Potential Data Loss in `seed.ts`**: The `seedPhase2Candidate` function deletes all tasks for a candidate, which could lead to data loss in non-test environments.

### Merge Readiness
This pull request introduces significant improvements but contains critical issues that must be addressed before merging. Specifically, the weakened test assertion in `candidates.test.ts` and the potential security risk in `files.ts` are blockers. I am unable to approve this pull request, and recommend that it not be merged until these issues are resolved and verified. Other reviewers should also examine the changes.

VERDICT: CHANGES_REQUESTED