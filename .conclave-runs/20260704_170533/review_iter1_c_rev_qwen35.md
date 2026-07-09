# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Code Review: ATRIA-X Session 2 — Scheduling Backend

## Summary

The diff shows **schema and audit infrastructure changes only**. The core implementation files (`convex/scheduling.ts` and `convex/scheduling.test.ts`) are **NOT included in this diff**, despite test output showing `convex/scheduling.test.ts (16 tests)` passed. This is a critical gap preventing full review of the task requirements.

## What's Present in the Diff ✓

| File | Change | Assessment |
|------|--------|------------|
| `convex/schema.ts` | Added `by_tenant_caregiver_status_start` index to `shifts` | Correct - supports paginated listShifts queries |
| `convex/schema.ts` | Added `kind: v.optional(v.string())` to `auditEvents` | Correct - backward-compatible, satisfies task literal requirement |
| `convex/schema.ts` | Rewrote `availabilityWindows` (caregiverId, kind, dayOfWeek, date, available, note) | Correct - matches task API; no existing runtime references to old shape |
| `convex/schema.ts` | Extended `coverageRequests` (reason required, status union, reassignedTo, resolvedBy) | Correct - supports resolveCoverage flow |
| `convex/audit.ts` | Added `kind` optional arg to `record` mutation | Correct - existing callers unaffected |
| `convex/_generated/api.d.ts` | References `scheduling` module | Confirms codegen ran |

## Critical Gaps ✗

### 1. Missing `convex/scheduling.ts` Implementation

The diff does **NOT** include the 15 required functions:
- `createShift`, `updateShift`, `deleteShift`, `assignShift`
- `listShifts`, `listCaregiverShifts`
- `addAvailabilityWindow`, `updateAvailabilityWindow`, `deleteAvailabilityWindow`
- `listMyAvailability`, `listAvailabilityForScheduling`
- `requestCoverage`, `resolveCoverage`, `listCoverageRequests`
- `checkShiftConflict` helper

**Cannot verify:**
- Auth guards via `requireTenantRole` / `assertTenantDoc`
- Conflict detection logic (overlap formula, excludeShiftId handling)
- Availability advisory warning (not blocking)
- Status guards (updateShift blocked on submitted/approved/billing_ready)
- deleteShift cascades coverageRequests
- resolveCoverage updates both shift and coverage request atomically
- Error messages include conflicting shift id and times per task spec

### 2. Missing `convex/scheduling.test.ts` Content

Test output shows 16 tests passed, but the test file content is not in the diff. **Cannot verify:**
- Adjacent vs overlapping shift conflict tests
- Cross-tenant caregiver blocking
- Status guard tests (updateShift on submitted, deleteShift on in_progress)
- Availability CRUD ownership tests
- Role enforcement tests (listShifts requires admin/coordinator)

### 3. Schema Migration Risk

The `availabilityWindows` table rewrite changes:
- `employeeProfileId: v.id('employeeProfiles')` → `caregiverId: v.string()`
- `weekday: v.string()` → `kind`, `dayOfWeek`, `date`
- Removed `effectiveStart`, `effectiveEnd`, `status`
- Added `available`, `note`, `createdAt`

**Risk:** If any production data exists in this table (even from Session 1 testing), it will be invalidated. The discovery noted "no runtime code references it" but this should be confirmed before merge.

### 4. coverageRequests.reason Changed from Optional to Required

```diff
- reason: v.optional(v.string()),
+ reason: v.string(),
```

**Risk:** Any existing `coverageRequests` rows with `reason: undefined` will fail validation on read/update. Since discovery showed no runtime references, this is likely safe, but should be confirmed.

## Security & Multi-Tenancy Concerns

Without seeing `scheduling.ts`, I cannot verify:
1. **Every function starts with `requireTenantRole`** - critical for multi-tenant isolation
2. **`assertTenantDoc` on all document lookups** - prevents cross-tenant ID enumeration
3. **Caregiver verification queries `tenantMembers` by_tenant_user** - prevents cross-tenant caregiver assignment
4. **PHI exposure** - listShifts should only return displayName, not client addresses

## Idempotency & Race Conditions

Cannot verify without implementation:
- `checkShiftConflict` + insert in same mutation (atomic double-booking prevention)
- `resolveCoverage` checks `status === 'open'` before updating (prevents double-resolution)
- `deleteShift` deletes coverageRequests before shift (cascade order)

## Gates Status

| Gate | Status | Note |
|------|--------|------|
| lint | PASS | Style compliance confirmed |
| typecheck | PASS | Schema/types aligned |
| test | PASS | 314 tests including 16 scheduling tests |

**However:** Passing gates don't compensate for missing implementation review. The tests passing suggests the code exists in the working tree but wasn't included in the diff submitted for review.

## Required Changes

1. **Include `convex/scheduling.ts` in the diff** - This is the primary deliverable. Cannot approve without reviewing the 15 functions.

2. **Include `convex/scheduling.test.ts` in the diff** - Need to verify test coverage matches task requirements (adjacent shifts, overlapping, same start, completed shift exclusion, excludeShiftId, cross-tenant, status guards, ownership checks).

3. **Confirm no production data in `availabilityWindows`** - Add a note in the commit message or migration plan confirming the table was empty before rewrite.

4. **Verify `coverageRequests` backward compatibility** - If any rows exist with `reason: undefined`, the schema change will break reads. Either keep `reason` optional or add a migration.

## Recommendation

**Do not approve** until the full implementation diff is provided. The schema changes are sound, but the task's core requirement is the 15 scheduling functions with proper auth, conflict detection, and audit logging. These cannot be reviewed from schema changes alone.

Request the complete diff including:
- `convex/scheduling.ts` (all 15 functions + helpers)
- `convex/scheduling.test.ts` (all test cases)

Once provided, re-review for:
- Auth guard placement (first line of each function)
- Conflict detection formula correctness
- Availability warning logic (advisory, not blocking)
- Error message format (includes shift id and times)
- Cascade delete order in deleteShift

VERDICT: CHANGES_REQUESTED