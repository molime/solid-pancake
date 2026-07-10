# Conclave run summary
- project: atriax
- result: **CONVERGED**
- run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260704_170533
- task: SESSION 2 — Scheduling backend: shift CRUD, availability, coverage, conflict detection.

Build on the ATRIA-X Phase 2 schema from Session 1 (already committed on branch feature/phase-2-worker-onboarding). All Convex functions in convex/ MUST go through convex/authHelpers.ts (requireTenant / requireTenantRole / assertTenantDoc). No ADP calls.

Create or extend convex/scheduling.ts (and split into convex/scheduling/ subdirectory if needed for clarity). Implement exactly the following:

(1) mutation createShift({ clientId, caregiverId, scheduledStart, scheduledEnd, serviceType, rate, serviceLocationOverride? }) — requireTenantRole org:admin or org:coordinator. Validate: assertTenantDoc on clientId; verify caregiverId is a tenantMember with role org:caregiver for this tenant (query tenantMembers by_tenant_user, require role=org:caregiver); call checkShiftConflict — if conflict found, throw ConvexError with message listing the conflicting shift id and times. Check availabilityWindows: if caregiver has any windows for the day and the slot is not covered, add a warning flag to the returned result (do NOT block — availability is advisory). Insert shift with status 'scheduled'. Write auditEvent kind='shift.created'.

(2) mutation updateShift({ shiftId, ...fieldsToUpdate }) — requireTenantRole org:admin or org:coordinator. assertTenantDoc on shift. If status is submitted/approved/billing_ready throw ConvexError 'Cannot edit a shift that is submitted or approved'. Re-run checkShiftConflict if times or caregiverId changed. Write auditEvent kind='shift.updated'.

(3) mutation deleteShift({ shiftId }) — requireTenantRole org:admin. assertTenantDoc. Status must be 'scheduled'. Write auditEvent kind='shift.deleted'. Hard-delete the shift row.

(4) mutation assignShift({ shiftId, caregiverId }) — requireTenantRole org:admin or org:coordinator. assertTenantDoc on shift. Verify new caregiver is a tenant org:caregiver member. checkShiftConflict (exclude the current shiftId). Write auditEvent 'shift.reassigned'.

(5) query listShifts({ status?, startDate?, endDate?, caregiverId? }) — requireTenantRole org:admin or org:coordinator. Return paginated shifts with client displayName and caregiver displayName joined from tenantMembers. Filter by provided params. Max 100 results per page.

(6) query listCaregiverShifts() — requireTenantRole org:caregiver. Return own shifts (by_tenant_caregiver_status). Include client name.

(7) mutation addAvailabilityWindow({ kind, dayOfWeek?, date?, startTime, endTime, available, note? }) — requireTenantRole org:caregiver. Inserts for own clerkUserId.

(8) mutation updateAvailabilityWindow({ windowId, startTime?, endTime?, available?, note? }) — requireTenantRole org:caregiver. assertTenantDoc; must be own window (caregiverId === clerkUserId).

(9) mutation deleteAvailabilityWindow({ windowId }) — requireTenantRole org:caregiver. assertTenantDoc; own window only.

(10) query listMyAvailability() — requireTenantRole org:caregiver. Returns own windows.

(11) query listAvailabilityForScheduling({ caregiverId? }) — requireTenantRole org:admin or org:coordinator. Returns availability windows, optionally filtered by caregiver.

(12) mutation requestCoverage({ shiftId, reason }) — requireTenantRole org:caregiver. assertTenantDoc on shift; shift.caregiverId must equal calling clerkUserId; status must be 'scheduled'. Insert coverageRequests row status='open'.

(13) mutation resolveCoverage({ coverageRequestId, reassignedTo }) — requireTenantRole org:admin or org:coordinator. assertTenantDoc on coverageRequest. Verify reassignedTo is a tenant org:caregiver. checkShiftConflict for new caregiver. Update shift.caregiverId = reassignedTo. Update coverageRequests status='filled', resolvedBy, resolvedAt. Write auditEvent 'coverage.resolved'.

(14) query listCoverageRequests({ status? }) — requireTenantRole org:admin or org:coordinator. Returns open/all requests with shift info.

(15) Pure helper function checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?): queries shifts by_tenant_caregiver_status for non-terminal statuses (scheduled, in_progress, submitted, approved), checks for time overlap, returns the first conflicting shift or null.

Write unit tests for: no conflict on adjacent shifts; conflict on overlapping; conflict on same start; no conflict on completed shift; excludeShiftId correctly excluded. Tests additionally: createShift blocks cross-tenant caregiver; updateShift blocked on submitted; deleteShift blocked on in_progress; requestCoverage blocked for wrong caregiver; availability CRUD restricted to own windows; listShifts requires admin or coordinator role.

Run npx convex codegen after changes. Style: single quotes, no semicolons, 2-space indent. Gates: npm run lint, typecheck, test green. Skip e2e (backend-only session).

## Stages
- {'stage': 'plan', 'how': 'synthesized by c_plan_agentic', 'chars': 138441}
- {'stage': 'implement', 'ok': True}
- {'stage': 'gate_postimpl', 'passed': True, 'results': [{'name': 'lint', 'status': 'PASS', 'rc': 0, 'log': 'C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.conclave-runs\\20260704_170533\\gate_postimpl_lint.log'}, {'name': 'typecheck', 'status': 'PASS', 'rc': 0, 'log': 'C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.conclave-runs\\20260704_170533\\gate_postimpl_typecheck.log'}, {'name': 'unit', 'status': 'PASS', 'rc': 0, 'log': 'C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.conclave-runs\\20260704_170533\\gate_postimpl_unit.log'}]}
- {'stage': 'review_iter1', 'verdicts': {'c_rev_glm': 'APPROVED', 'c_rev_qwen': 'APPROVED', 'c_rev_deepseek': 'CHANGES_REQUESTED', 'c_rev_kimi27': 'APPROVED', 'c_rev_gpt_oss': 'APPROVED', 'c_rev_qwen35': 'CHANGES_REQUESTED'}, 'passed': True}