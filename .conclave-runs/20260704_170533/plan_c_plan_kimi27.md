# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# ATRIA-X Session 2 — Scheduling Backend Implementation Plan

## 1. Restated Goal & Acceptance Criteria

**Goal:** Extend the ATRIA-X Phase 2 backend on branch `feature/phase-2-worker-onboarding` with a complete, multi-tenant scheduling subsystem in Convex: shift CRUD, caregiver availability windows, coverage requests, and shift-conflict detection. All functions must route through `convex/authHelpers.ts`, must not call ADP, and must respect the existing role model (`org:admin`, `org:coordinator`, `org:caregiver`).

**Acceptance criteria:**
- All 15 requested functions exist, are correctly typed, and enforce the required roles.
- `createShift`, `updateShift`, `assignShift`, and `resolveCoverage` call `checkShiftConflict` and throw a `ConvexError` naming the conflicting shift and its times.
- `createShift` returns an availability advisory warning when the caregiver has windows for the day but the slot is uncovered; it never blocks on availability.
- `deleteShift` hard-deletes only `scheduled` shifts and writes an audit event.
- `updateShift` is blocked for `submitted`, `approved`, or `billing_ready` statuses.
- `requestCoverage` is allowed only by the assigned caregiver on a `scheduled` shift.
- `resolveCoverage` verifies the replacement caregiver, checks conflicts, updates the shift, and closes the request.
- Queries return joined client/caregiver display names and paginate correctly (max 100/page).
- Schema changes are made only in `convex/schema.ts`; `convex/_generated` is regenerated via `npx convex codegen`.
- New unit/integration tests cover the listed conflict, auth, and role cases.
- `npm run lint`, `npm run typecheck`, and `npm run test` pass. E2E is skipped.

---

## 2. Discovery Notes

**Repo inspection was unavailable** — this is a chat-only session, so I could not open files. The plan below is built from the supplied context and standard Convex + Clerk patterns.

**Assumed existing seams** (verify before coding):
- `convex/schema.ts` already defines `clients`, `tenantMembers`, and `auditEvents` tables from Session 1.
- `convex/authHelpers.ts` exports at least:
  - `requireTenant(ctx)` — returns the current Clerk org/tenant id.
  - `requireTenantRole(ctx, role)` — throws if the caller lacks the role for the tenant.
  - `assertTenantDoc(ctx, table, id, tenantId)` — returns the doc or throws if it does not belong to the tenant.
  - A way to get the caller’s Clerk user id (e.g., `getCurrentUserOrThrow(ctx)` or it is returned by `requireTenantRole`).
- `tenantMembers` has an index like `by_tenant_user: ['tenantId', 'userId']` and stores `role` and `userId`.
- `clients` has an index like `by_tenant: ['tenantId']` and stores `displayName`.
- `auditEvents` has a schema that accepts `tenantId`, `kind`, `actorId`, `entityId`, and `metadata`.

**If any of the above differ**, adjust the helper signatures and index names locally in the scheduling module rather than refactoring shared auth code unless unavoidable.

---

## 3. Alternatives Considered

| Decision | Options | Chosen approach | Rationale |
|---|---|---|---|
| File organization | One `convex/scheduling.ts` vs. `convex/scheduling/*.ts` | Split into `convex/scheduling/shifts.ts`, `availability.ts`, `coverage.ts`, plus `helpers.ts` | 15 functions; splitting keeps reviewable files and avoids merge conflicts in future sessions. |
| Time representation | ISO strings vs. epoch ms for shifts; HH:MM vs. minutes for windows | Shifts: `number` epoch ms; windows: `number` minutes-from-midnight; one-off windows: ISO date string | Easiest overlap math and indexing. Document the local-timezone assumption. |
| Availability behavior | Hard block vs. advisory warning | Advisory warning only | Matches the requirement that availability is advisory. |
| Pagination | In-memory filtering after `.take(100)` vs. composite indexes | Composite indexes (`by_tenant_status_start`, `by_tenant_caregiver_status_start`) | Correct pagination under combined filters; no missed rows. |
| Delete behavior | Soft delete vs. hard delete | Hard delete per task, with cascade of linked `coverageRequests` | Prevents orphaned coverage rows after a shift is removed. |

---

## 4. Exact Files to Create/Edit

### `convex/schema.ts`
Add three new tables (and any missing supporting indexes). If `tenantId` is an `id<'tenants'>` in the existing schema, use that type instead of `string`.

**`shifts`**
- Fields: `tenantId`, `clientId: v.id('clients')`, `caregiverId: v.string` (Clerk user id), `scheduledStart: v.number`, `scheduledEnd: v.number`, `serviceType: v.string`, `rate: v.number`, `serviceLocationOverride: v.optional(v.string)`, `status: v.union(...)` (`scheduled`, `in_progress`, `submitted`, `approved`, `billing_ready`, `completed`, `cancelled`), `createdAt`, `updatedAt`.
- Indexes:
  - `by_tenant_status: ['tenantId', 'status']`
  - `by_tenant_caregiver_status: ['tenantId', 'caregiverId', 'status']`
  - `by_tenant_status_start: ['tenantId', 'status', 'scheduledStart']`
  - `by_tenant_caregiver_status_start: ['tenantId', 'caregiverId', 'status', 'scheduledStart']`
  - `by_tenant_start: ['tenantId', 'scheduledStart']`

**`availabilityWindows`**
- Fields: `tenantId`, `caregiverId: v.string`, `kind: v.union(v.literal('recurring'), v.literal('one-off'))`, `dayOfWeek: v.optional(v.number)` (0–6), `date: v.optional(v.string)` (YYYY-MM-DD), `startTime: v.number` (minutes), `endTime: v.number`, `available: v.boolean`, `note: v.optional(v.string)`, `createdAt`, `updatedAt`.
- Indexes:
  - `by_tenant_caregiver: ['tenantId', 'caregiverId']`
  - `by_caregiver: ['caregiverId']`

**`coverageRequests`**
- Fields: `tenantId`, `shiftId: v.id('shifts')`, `requestedBy: v.string`, `reason: v.string`, `status: v.union(v.literal('open'), v.literal('filled'), v.literal('cancelled'))`, `reassignedTo: v.optional(v.string)`, `resolvedBy: v.optional(v.string)`, `resolvedAt: v.optional(v.number)`, `createdAt`, `updatedAt`.
- Indexes:
  - `by_tenant_status: ['tenantId', 'status']`
  - `by_shift: ['shiftId']`

Also verify/add:
- `tenantMembers.by_tenant_user: ['tenantId', 'userId']` (required for caregiver verification).
- `clients.by_tenant: ['tenantId']` (required for `assertTenantDoc` on clients).

### `convex/authHelpers.ts` (verify only; edit only if missing)
- Confirm `requireTenantRole` accepts either a single role or an array. If it only accepts one role, add a small local wrapper `requireAnyTenantRole(ctx, roles[])` inside `convex/scheduling/helpers.ts` rather than changing auth semantics.
- Confirm the caller’s Clerk user id is obtainable. If not exposed, add a minimal `getCurrentUserOrThrow` to `authHelpers.ts`.

### `convex/audit.ts` (or existing audit helper)
Ensure a helper exists with a signature like:

```ts
writeAuditEvent(ctx, { tenantId, kind, actorId, entityId, metadata? })
```

Use it from every mutating scheduling function with kinds: `shift.created`, `shift.updated`, `shift.deleted`, `shift.reassigned`, `coverage.resolved`.

### `convex/scheduling/helpers.ts` (new internal helpers)
- `verifyCaregiverMember(ctx, tenantId, caregiverId)`  
  Query `tenantMembers` by `by_tenant_user`, require the doc exists and `role === 'org:caregiver'`. Throw `ConvexError` otherwise.
- `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`  
  Query `shifts` by `by_tenant_caregiver_status` (`eq tenantId`, `eq caregiverId`), filter to non-terminal statuses (`scheduled`, `in_progress`, `submitted`, `approved`), and return the first doc where `start < existing.scheduledEnd && end > existing.scheduledStart` and `existing._id !== excludeShiftId`. Returns `null` if none.
- `findShiftConflict(shifts, start, end, excludeShiftId?)`  
  Pure, testable version of the overlap logic used by `checkShiftConflict`.
- `checkAvailabilityWarning(ctx, tenantId, caregiverId, scheduledStart, scheduledEnd)`  
  Query the caregiver’s windows for the tenant. If the caregiver has any window for the relevant day (recurring `dayOfWeek` or one-off `date`) and no available window covers the full slot, return a warning string; otherwise return `null`.
- `buildShiftWithNames(ctx, shift)`  
  Fetch the client doc and the caregiver `tenantMember`, then return the shift with `clientDisplayName` and `caregiverDisplayName` attached.

### `convex/scheduling/shifts.ts`
Export six Convex functions:

1. **`createShift` mutation** — requires `org:admin` or `org:coordinator`.
   - Validate `scheduledStart < scheduledEnd`.
   - `assertTenantDoc` on `clientId`.
   - `verifyCaregiverMember` on `caregiverId`.
   - `checkShiftConflict`; if found, throw `ConvexError('Shift conflicts with ${id} (${start}-${end})')`.
   - Run `checkAvailabilityWarning`; if warning, include it in the return value but still insert.
   - Insert shift with `status: 'scheduled'`.
   - Write `shift.created` audit event.
   - Return `{ shiftId, availabilityWarning }`.

2. **`updateShift` mutation** — requires `org:admin` or `org:coordinator`.
   - `assertTenantDoc` on `shiftId`.
   - Throw if current status is `submitted`, `approved`, or `billing_ready`.
   - For each provided field: `clientId` → `assertTenantDoc`; `caregiverId` → `verifyCaregiverMember`; times → validate ordering.
   - If `scheduledStart`, `scheduledEnd`, or `caregiverId` changed, rerun `checkShiftConflict(shiftId)`.
   - Update `updatedAt`.
   - Write `shift.updated` audit event.
   - Return `{ shiftId }`.

3. **`deleteShift` mutation** — requires `org:admin`.
   - `assertTenantDoc` on `shiftId`.
   - Throw if status is not `scheduled`.
   - Delete any `coverageRequests` with `shiftId` (cascade) to avoid orphans.
   - Hard-delete the shift.
   - Write `shift.deleted` audit event.
   - Return `{ shiftId }`.

4. **`assignShift` mutation** — requires `org:admin` or `org:coordinator`.
   - `assertTenantDoc` on `shiftId`.
   - `verifyCaregiverMember` on new `caregiverId`.
   - `checkShiftConflict` excluding the current shift.
   - Update `caregiverId` and `updatedAt`.
   - Write `shift.reassigned` audit event.
   - Return `{ shiftId }`.

5. **`listShifts` query** — requires `org:admin` or `org:coordinator`.
   - Accept `{ status?, startDate?, endDate?, caregiverId?, cursor? }`.
   - Pick the narrowest index:
     - `caregiverId + status` → `by_tenant_caregiver_status_start`
     - `caregiverId` → `by_tenant_caregiver_status`
     - `status + date range` → `by_tenant_status_start`
     - `status` → `by_tenant_status`
     - date only → `by_tenant_start`
   - Apply `.paginate({ cursor, numItems: 100 })`.
   - For each returned shift, use `buildShiftWithNames`.
   - Return `{ items: ShiftWithNames[], nextCursor, hasMore }`.

6. **`listCaregiverShifts` query** — requires `org:caregiver`.
   - Use `by_tenant_caregiver_status` with `eq('tenantId', tenantId).eq('caregiverId', currentUserId)`.
   - Order by `scheduledStart` descending, take 100.
   - Join client name via `buildShiftWithNames`.
   - Return array.

### `convex/scheduling/availability.ts`
Export five Convex functions:

7. **`addAvailabilityWindow` mutation** — requires `org:caregiver`.
   - `tenantId` from auth; `caregiverId = currentUserId`.
   - Validate: recurring → `dayOfWeek` required; one-off → `date` required; `startTime < endTime`.
   - Insert window.
   - Return `{ windowId }`.

8. **`updateAvailabilityWindow` mutation** — requires `org:caregiver`.
   - `assertTenantDoc` on `windowId`.
   - Throw if `window.caregiverId !== currentUserId`.
   - Update allowed fields and `updatedAt`.
   - Return `{ windowId }`.

9. **`deleteAvailabilityWindow` mutation** — requires `org:caregiver`.
   - `assertTenantDoc` on `windowId`.
   - Throw if not owned.
   - Delete.
   - Return `{ windowId }`.

10. **`listMyAvailability` query** — requires `org:caregiver`.
    - Query `by_caregiver` for `currentUserId`.
    - Return array.

11. **`listAvailabilityForScheduling` query** — requires `org:admin` or `org:coordinator`.
    - Query `by_tenant_caregiver`; if `caregiverId` provided, `eq` it.
    - Return array.

### `convex/scheduling/coverage.ts`
Export three Convex functions:

12. **`requestCoverage` mutation** — requires `org:caregiver`.
    - `assertTenantDoc` on `shiftId`.
    - Throw if `shift.caregiverId !== currentUserId`.
    - Throw if `shift.status !== 'scheduled'`.
    - Insert `coverageRequests` with `status: 'open'`.
    - Return `{ coverageRequestId }`.

13. **`resolveCoverage` mutation** — requires `org:admin` or `org:coordinator`.
    - `assertTenantDoc` on `coverageRequestId`.
    - Throw if `coverageRequest.status !== 'open'`.
    - Fetch the shift via `assertTenantDoc`.
    - `verifyCaregiverMember` on `reassignedTo`.
    - `checkShiftConflict` for the shift’s times with the new caregiver, excluding the shift.
    - Update shift: `caregiverId = reassignedTo`, `updatedAt = now`.
    - Update coverage request: `status = 'filled'`, `reassignedTo`, `resolvedBy = currentUserId`, `resolvedAt = now`.
    - Write `coverage.resolved` audit event.
    - Return `{ shiftId, coverageRequestId }`.

14. **`listCoverageRequests` query** — requires `org:admin` or `org:coordinator`.
    - Query `by_tenant_status`; optionally `eq('status', status)`.
    - For each request, fetch the shift and client, attach shift info.
    - Return array.

### `convex/scheduling.test.ts` (new)
See Section 6.

### `convex/_generated`
- Do not edit by hand.
- After schema changes, run `npx convex codegen`.

---

## 5. Data / Auth / Security / PHI / Idempotency Edge Cases

- **Cross-tenant access:** Every doc lookup uses `assertTenantDoc` or a `by_tenant_*` index scoped to the authenticated tenant. A caregiver id from another tenant will fail `verifyCaregiverMember`.
- **Role escalation:** All entry points call `requireTenantRole` (or the local `requireAnyTenantRole` wrapper) before any data access.
- **Terminal-status edits:** `updateShift` explicitly rejects `submitted`, `approved`, and `billing_ready`. `deleteShift` only accepts `scheduled`.
- **Double-booking:** `checkShiftConflict` excludes `completed`/`cancelled` and uses strict overlap (`<` / `>`), so adjacent shifts are allowed.
- **Availability is advisory only:** `createShift` never blocks; it only adds a warning flag when windows exist but do not cover the slot.
- **Coverage integrity:** `deleteShift` cascades deletion of linked `coverageRequests` to avoid dangling references. `resolveCoverage` requires the request to be `open`.
- **PHI / sensitive data:** Shift records tie clients and caregivers to times and locations. Access is restricted by tenant + role, every mutation is audited, and no data is returned cross-tenant.
- **Time zones:** Availability windows store minutes-from-midnight in the agency’s local time. If the product later supports multiple time zones, add a `timezone` field; do not over-engineer now.
- **Currency:** Store `rate` as a number. Prefer integer cents in production to avoid float rounding; for this session, `v.number` is acceptable.
- **Idempotency:** No idempotency keys are required. Conflict detection and role checks naturally prevent most duplicate harmful states. Duplicate `requestCoverage` calls will create multiple open rows; this is acceptable per the spec but can be revisited if product wants one open request per shift.

---

## 6. Test Strategy

Add `convex/scheduling.test.ts`. Use `convex-test` if the project already has it; otherwise add it as a dev dependency or use a Vitest mock harness for `ctx.db` and `authHelpers`.

### Pure helper tests (direct, no DB)
- `findShiftConflict`
  - No conflict on adjacent shifts (`09:00-10:00` and `10:00-11:00`).
  - Conflict on overlapping shifts.
  - Conflict when a new shift has the same start as an existing one.
  - No conflict when the only existing shift is `completed`.
  - `excludeShiftId` correctly excludes the shift being edited.

### Integration / auth tests
- `createShift` blocks a cross-tenant caregiver (caregiver id exists in another tenant but not the caller’s tenant).
- `updateShift` is blocked when the shift status is `submitted`.
- `deleteShift` is blocked when the shift status is `in_progress`.
- `requestCoverage` is blocked when the caller is not the shift’s assigned caregiver.
- Availability `update`/`delete` are blocked when the window belongs to another caregiver.
- `listShifts` rejects a caller with only `org:caregiver` role.
- `createShift` conflict throws a message containing the conflicting shift id and times.
- `assignShift` conflict excludes the current shift.
- `resolveCoverage` verifies the replacement caregiver and rejects a conflicting replacement.

### Gates to run
```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test
```
Skip Playwright / e2e for this backend-only session.

---

## 7. Rollback / Verification Notes

- **Before starting:** ensure the working tree is clean on `feature/phase-2-worker-onboarding` so a `git revert` or `git stash` is possible.
- **After schema edits:** run `npx convex codegen` immediately and verify `convex/_generated` reflects the new tables/indexes. Do not hand-edit generated files.
- **Verification:** after implementation, all scheduling mutations should appear in the Convex dashboard under `scheduling/shifts:*`, `scheduling/availability:*`, and `scheduling/coverage:*`.
- **Rollback:** if gates fail and the issue is structural, revert the branch to the pre-Session-2 commit, rerun `npx convex codegen`, and re-apply the plan in smaller chunks.