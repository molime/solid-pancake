# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

We need review code diff and plan. Need produce review with concrete blockers and final verdict line. We need inspect diff carefully. The user provided diff truncated at 60000 chars; but enough. Also latest gate results show lint/typecheck/unit pass. E2E/build not shown? They say latest real gate results include lint/typecheck/unit only. Need maybe e2e/build not run or omitted. We need review diff against ACs.

We need identify missed AC items, bugs, security, idempotency, PHI, missing tests. Let's parse diff.

Files changed:
- .env.e2e.example adds candidate credentials.
- authHelpers.ts comments.
- candidates.test.ts changes fetch mock to list memberships and patch membership. It now expects call includes `/memberships` and `user_id=...`.
- candidates.ts updateClerkMembershipRole: now lists memberships by user_id, finds membership with target role; if already role returns updated:false; else patches first membership. Good fix for Clerk API path (membership id not user id). Security: uses secret key. Idempotency: if membership already has role, returns false. But what if role differs? It patches first membership. Good.
- documentArchive.test.ts adds pending_review fixture test verifying item, audit event.
- documentArchive.ts listDocumentArchive adds uploadedAt: item.createdAt. OK.
- files.test.ts adds generateUploadUrl tests for candidate and cross-tenant block.
- files.ts generateUploadUrl allows org:candidate. Is that intended? It allows candidates to generate upload URLs. Need ensure candidate only for their own tenant; cross-tenant blocked by requireTenantRole. OK.
- forms.test.ts many changes: sampleFields now experience required, notes optional. Updates existing tests to include experience. Adds multiple missing fields test. Adds updateDocumentArchiveItem via api tests (verifiedBy/verifiedAt and caregiver block). Adds getFormDefinition tests. 
- forms.ts submitForm now collects missing fields and throws compound message. Adds getFormDefinition query allowing admin/coordinator/caregiver/hr/candidate. Good.
- hrCases.test.ts adds asAdmin, seedEmployee, subject validation tests, cross-tenant isolation. 
- hrCases.ts significant changes: createHrCase validates subject type, resolves subject name (candidate by id, employee by clerkUserId), inserts with title, createdAt, audit event. listHrCases uses resolveSubjectName per case async. updateHrCase allows title/description/category optional, status validation. hrDashboardStats formatting. 
  Potential issues: createHrCase subjectId for candidate is passed as candidate _id string; resolveSubjectName uses ctx.db.get(subjectId as Id<'candidates'>). Good. For employee, subjectId is clerkUserId and looks up by index. Good. But listHrCases now does await Promise.all with resolveSubjectName per case; if subjectType invalid catches and returns Unknown. OK.
  Security: updateHrCase asserts tenant doc on case. Cross-tenant test added.
  Idempotency: createHrCase inserts always; no idempotency key. But HR cases likely additive; OK.
- onboarding.test.ts adds lifecycle tests: inviteCandidate seeds 5 tasks, full lifecycle, acceptOffer idempotent, candidate blocked from listShifts. Good.
- scheduling.test.ts adds checkShiftConflict exclude test, non-caregiver block, overlap reject, audit event, cross-caregiver overlap allowed. Good.
- seed.test.ts adds Phase2 fixture idempotency test.
- seed.ts: deleteFixtureCaregiverShifts rewritten to delete all caregiver member shifts and future shifts. Need inspect truncated portion. It now deletes shifts whose caregiverId matches clerkUserId or member _id, and all future shifts. Good. Also seedE2E returns phase2 ids. Need ensure idempotent.
- Other UI files not relevant maybe.

Need compare against plan ACs:
AC-1 scheduling.spec.ts passes: scroll/force Send request. But diff doesn't show changes to tests/e2e/scheduling.spec.ts? Wait the diff list includes many files but not tests/e2e/scheduling.spec.ts? The provided diff file list includes tests/e2e/geofence.spec.ts, phase1-lifecycle.spec.ts, helpers/auth.ts, helpers/env.ts but not scheduling.spec.ts, onboarding.spec.ts, documents.spec.ts. Maybe those E2E files unchanged? But task says scheduling.spec.ts needs fix. The diff may not include them because no changes? But latest gate results only lint/type/unit, no e2e. We need review actual diff; if scheduling.spec.ts not modified, AC-1 not satisfied. However the user says "Current state (do not assume it is fixed — verify)". The diff is the real change. It doesn't include scheduling.spec.ts. So AC-1 likely missed. But maybe the E2E fix was in helpers/auth.ts or ShiftPacketPanel? Let's inspect diff for tests/e2e/helpers/auth.ts and scheduling.spec.ts not present. The diff list doesn't include scheduling.spec.ts. So no E2E scheduling fix. That's a concrete blocker: AC-1 not met.

But maybe the diff truncated omitted some files? The diff list at top enumerates changed files; it includes tests/e2e/geofence.spec.ts, tests/e2e/helpers/auth.ts, tests/e2e/helpers/env.ts, tests/e2e/phase1-lifecycle.spec.ts. Not scheduling.spec.ts, onboarding.spec.ts, documents.spec.ts. So likely unchanged. Need request changes for AC-1.

Need also verify AC-2 onboarding.test.ts explicit form_submission complete and ADP sync queued. Diff shows in lifecycle test: after submitApplication, tasksAfterSubmit find form_submission status 'complete'. Good. After hireCandidate, employeeProfile adpSyncStatus 'pending_credentials'. Good.

AC-3 scheduling.test.ts cross-caregiver overlap and checkShiftConflict exclude. Diff shows both. Good.

AC-4 forms.test.ts multiple missing required fields and updateDocumentArchiveItem wrappers. Diff shows both. Good.

AC-5 seed.ts Phase2 fixtures idempotent. Diff shows seedE2E returns phase2 ids and seed.test verifies counts. Need verify candidate status: The plan says candidate status kept at hr_review so E2E single-click offer flow continues. Diff doesn't show seed.ts candidate status due truncation. Need infer. The seed.test expects candidate email phase2-candidate@atriax.example.com. We need check if status is hr_review. Not visible. But likely. Need maybe not block.

AC-6 all gates run and report real results. Latest results only lint/type/unit. No e2e/build. Need request those run. But maybe omitted from prompt due length. We can note missing e2e/build results.

AC-7 no manual _generated edits, no credentials committed. Diff doesn't touch _generated. .env.e2e.example adds placeholder candidate credentials, not real. OK.

Now deeper review for bugs/security/PHI:

1. candidates.ts updateClerkMembershipRole: It lists memberships by user_id and role? Wait code:
```
const list = (await listResponse.json()) as { data?: Array<{ id: string; role: string }> }
const membership = list.data?.find((m) => m.role === toClerkRole(args.role))
if (membership) {
  return { updated: false, membershipId: membership.id }
}
const targetMembership = list.data?.[0]
if (!targetMembership) {
  return { updated: false, membershipId: null }
}
```
Potential issue: If user has multiple memberships? Unlikely. If target role already set, returns false. Good idempotency. But if membership role is different, it patches first. Good. However if the membership is not found because list returns empty (user not member), returns membershipId null without error. Caller (hireCandidate) then continues? Let's check candidates.ts hireCandidate likely calls updateClerkMembershipRole and expects success. If membership null, maybe later steps fail? But existing test stubbed fetch to return list with one member role org:member then patch. Good.

Security: This internalAction is exported; args include clerkOrgId, clerkUserId, role. It uses CLERK_SECRET_KEY. No tenant auth in internalAction (by design internal). The caller must be trusted internal mutation. OK.

2. hrCases.ts createHrCase: subjectType validation. For candidate subject, uses ctx.db.get(subjectId as Id<'candidates'>). If subjectId is not a valid Id format, Convex may throw? It casts string. OK. For employee, uses clerkUserId. It asserts tenant doc. Good.

But listHrCases now uses resolveSubjectName with ctx that has db only. It passes ctx: { db: QueryCtx['db'] }. In listHrCases, ctx is QueryCtx, has db. OK. It catches errors and returns Unknown. But if a case has subjectType 'employee' and subjectId is a candidate _id (or vice versa), lookup fails and returns Unknown. That's fine.

Potential performance: listHrCases now N+1 queries per case. Acceptable.

Potential bug: hrCases.ts updateHrCase patch includes title/description/category but does not validate status? It checks isValidCaseStatus. Good.

3. forms.ts getFormDefinition: allows org:candidate. It returns full form definition including fields. That's fine. But org:candidate can query any formDefinitionId in their tenant. OK.

4. files.ts generateUploadUrl now allows org:candidate. It returns url, tenantId, uploadedBy. The uploaded file later linked to candidate. Need ensure candidate cannot set visibility or link to other tenant. The mutation only takes clerkOrgId; it generates upload URL and returns tenantId. The candidate will use that URL to upload; storage generateUploadUrl is tenant-agnostic but the returned tenantId ensures frontend links correctly. However the file row isn't created until upload completes and a separate mutation links it. Need ensure linking mutation guards tenant. Not in diff. But existing tests maybe. Not blocker.

5. documentArchive.ts listDocumentArchive adds uploadedAt: item.createdAt. Good.

6. seed.ts deleteFixtureCaregiverShifts: It deletes all future shifts in tenant, not just fixture caregivers. This is powerful but for E2E tenant OK. However if E2E tenant has past shifts? It deletes future only. Good. But the function also deletes shifts for all caregiver members. Need ensure it doesn't delete coverage request rows? It calls deleteShiftChildren for each shift. Good.

Potential issue: It deletes shifts whose caregiverId matches member._id (Convex id). But shifts.caregiverId is consistently Clerk user id per plan. Matching member _id is defensive but could inadvertently delete shifts if some code stores member _id. That's intended. But if a caregiver member _id collides with a clerkUserId of another user? Unlikely because Convex ids start with different prefix. OK.

Potential issue: It includes extraClerkIds: adminUserId, coordinatorUserId, caregiverUserId, candidateUserId. It adds admin/coordinator/candidate to caregiverIds set, then tries to find their member and add member _id. If admin has a shift (shouldn't), it would delete. But admin shouldn't have shifts. OK.

7. E2E tests not changed. The task required fixing scheduling.spec.ts. Not in diff. Also required re-run onboarding.spec.ts and documents.spec.ts. Not changed. But maybe they already pass. However without scheduling fix, AC-1 fails.

8. The latest gate results missing e2e and build. Need request.

9. Style constraints: single quotes, no semicolons, 2-space indent. The diff uses single quotes mostly, no semicolons. Some files have semicolons? Need check. The diff shows no semicolons. Good.

10. Did they run convex codegen after editing convex/*? The diff includes _generated? No. But typecheck passed, so codegen likely run. However we should verify. Not a blocker if typecheck passes.

11. candidates.test.ts: It stubs fetch for list memberships and patch. The test expects membershipCall URL includes `/organizations/${clerkOrgId}/memberships` and `user_id=${candidateUserId}`. Good.

12. onboarding.test.ts seedInvitedCandidate uses vi.stubGlobal fetch returning invite. It then inserts tenantMember with role org:candidate and patches candidate clerkUserId. Good. But it doesn't unstub fetch in afterEach? Existing afterEach vi.unstubAllEnvs and vi.unstubAllGlobals? Let's check onboarding.test.ts afterEach maybe. Not shown. But existing file likely has afterEach. The new seedInvitedCandidate uses vi.stubGlobal inside function; if not restored, could leak. But afterEach likely restores. Not blocker.

13. forms.test.ts sampleFields changed to experience required. Many existing tests updated to include experience. Good. But the multiple missing test expects 'Missing required fields: name, experience'. Since sampleFields order name, experience, notes, missing will be name and experience. Good.

14. forms.ts submitForm: collects missing fields. Good. But error message changed from singular to plural. Existing tests updated. Good.

15. scheduling.test.ts cross-caregiver overlap: seedTenant returns otherCaregiverId? Need ensure seedTenant helper includes otherCaregiverId. The diff shows destructuring. It must have been added in seed.ts helper? Not shown but test passes in unit results (scheduling.test.ts 21 tests passed). Good.

16. checkShiftConflict exclude test: calls internal helper checkShiftConflict imported from scheduling.ts. Need ensure import exists. Test passed. Good.

17. documentArchive.test.ts pending_review fixture: verifies audit event. It checks event.previousStatus and event.nextStatus. Are those fields on auditEvents? The test passed. Good.

18. hrCases.ts createHrCase records audit event with metadata including subjectName. It uses internal.audit.record. Good.

Potential security/PHI: listHrCases returns subjectName resolved from employee profile or candidate. This is internal HR data; caller is HR/admin. OK.

Potential bug: hrCases.ts createHrCase for employee subject uses clerkUserId as subjectId. But in listHrCases, for subjectType 'employee', resolveSubjectName queries employeeProfiles by clerkUserId. Good. In cross-tenant test, createHrCase uses subjectId 'user_employee_a' and seedEmployee creates profile with that clerkUserId. Good.

Potential issue: updateHrCase cross-tenant test uses asAdmin(t, adminB, orgB) to update case from orgA. It expects rejection. The code asserts assertTenantDoc(hrCase, tenantId) where tenantId from requireTenantRole(orgB). Since hrCase.tenantId is orgA, assertion throws. Good.

Potential issue: candidates.ts updateClerkMembershipRole returns membershipId null if no membership. In hireCandidate, after acceptOffer, the candidate should be a member (inviteCandidate created org membership). So list should find. OK.

Potential issue: The diff in candidates.test.ts changes stub to list memberships returning candidate as plain member, then patch returns role caregiver. Good.

Potential issue: The plan required "convex/onboarding.test.ts (or existing file) must cover: ... completePlatformTraining inserts one row; second call idempotent; hasPlatformTrainingCompleted true; resetPlatformTraining deletes row and returns false; org:candidate cannot call listShifts." The diff shows completePlatformTraining idempotency, reset, candidate block. Good.

Potential issue: "convex/scheduling.test.ts must cover: checkShiftConflict adjacent no conflict, overlapping conflict, excluded shiftId not counted, completed not counted; createShift success + audit; cross-caregiver conflict; caregiver role required for assignedCaregiver; updateShift blocked on submitted status; deleteShift blocked on in_progress; requestCoverage rejected for wrong caregiver." Diff shows all. Good.

Potential issue: "convex/forms.test.ts must cover: submitForm rejects missing required fields and lists them; submitForm on inactive form rejected; updateDocumentArchiveItem sets verifiedBy and verifiedAt; org:caregiver cannot call updateDocumentArchiveItem." Diff shows all. Good.

Potential issue: "Update convex/seed.ts with idempotent Phase 2 fixtures if not already present: candidate in 'submitted' status with seeded application, availability window for seeded caregiver, coverage request in 'open', formDefinition with 3 fields (name required, experience required, notes optional), documentArchiveItem in 'pending_review'. Ensure all idempotent (check before inserting)." Diff shows seedE2E returns phase2 ids and test verifies counts. But candidate status not visible. The plan chose to keep status hr_review to not break E2E. The brief says candidate in 'submitted' status with seeded application. But plan says keep hr_review. The diff likely keeps hr_review. Is that acceptable? The brief explicitly says candidate in 'submitted' status. But the plan's acceptance criteria AC-5 says status kept at hr_review. There's a conflict. We need decide if blocker. The user included the plan and asks to check each acceptance criterion. The plan is the acceptance criteria. AC-5 says candidate status kept at hr_review. So per plan, OK. But the original brief said submitted. However the plan justified choosing A to keep E2E flow. Since we review against the plan, not block. But maybe we should note discrepancy? The instructions: "Check each acceptance criterion from the plan." So use plan.

Potential issue: The diff doesn't include any changes to tests/e2e/scheduling.spec.ts. AC-1 not satisfied. Also no e2e/build results. Need request changes.

Potential issue: The diff includes many UI changes (ShiftPacketPanel, CoverageRequestsPanel, etc.) that are part of broader phase2. Need review for bugs? The task focus is tests. But we should note any obvious issues.

Let's inspect UI diff portions:
- CoverageRequestsPanel.test.tsx and .tsx changes. Not directly relevant to ACs but touched. Could have bugs. But we should focus on touched behavior and tests. The panel likely used in E2E. If scheduling.spec.ts not fixed, maybe UI changes already done? The diff shows ShiftPacketPanel.tsx patched client?.phone. Good.
- ShiftEditorModal.tsx changes. Not relevant.
- AvailabilityPage.tsx changes. Not relevant.
- CaregiverSchedulePage.tsx changes. Not relevant.
- SchedulingPage.tsx changes. Not relevant.
- AppShell, Sidebar, router, providers, main, dev mocks. Not relevant.

Need maybe inspect tests/e2e/helpers/auth.ts diff to see if resetE2EShifts changed. It might include candidate sign-in. The diff list includes it. Let's read that portion. It may affect E2E. We have diff for tests/e2e/helpers/auth.ts? The provided diff includes changes to helpers/auth.ts (147 lines). We need inspect. It might add candidate credentials and signIn. But not scheduling fix.

Let's read the diff chunk for tests/e2e/helpers/auth.ts. The diff output is truncated but maybe includes. We need scroll. The diff is huge. We can use Read on the file? But the diff is in prompt, not file. We can ask to see more? We have enough? Let's try to read tests/e2e/helpers/auth.ts in repo to see current state. Also tests/e2e/scheduling.spec.ts. Since we are reviewing, we can read files. Use Read tool.