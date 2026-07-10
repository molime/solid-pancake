# ATRIA-X Session 2 — Scheduling Backend Implementation Plan

## 1. Restated Goal & Acceptance Criteria

**Goal:** Extend the ATRIA-X Phase 2 backend on `feature/phase-2-worker-onboarding` with a complete, multi-tenant scheduling subsystem in Convex: shift CRUD, caregiver availability windows, coverage requests, and shift-conflict detection. All functions route through `convex/authHelpers.ts`, do not call ADP, and respect the existing role model (`org:admin`, `org:coordinator`, `org:caregiver`).

**Acceptance criteria:**
- [ ] All 15 requested functions exist in `convex/scheduling.ts`, are correctly typed, and enforce the required roles.
- [ ] `createShift`, `updateShift` (when times/caregiver change), `assignShift`, and `resolveCoverage` call `checkShiftConflict` and throw a `ConvexError` naming the conflicting shift id and its times.
- [ ] `createShift` returns an availability advisory warning when the caregiver has windows for the day but the slot is uncovered; it never blocks on availability.
- [ ] `deleteShift` hard-deletes only `scheduled` shifts, cascades linked `coverageRequests`, and writes an audit event.
- [ ] `updateShift` is blocked for `submitted`, `approved`, or `billing_ready` statuses.
- [ ] `requestCoverage` is allowed only by the assigned caregiver on a `scheduled` shift.
- [ ] `resolveCoverage` verifies the replacement caregiver, checks conflicts, updates the shift, and closes the request.
- [ ] Queries return joined client/caregiver display names and never exceed 100 items per page.
- [ ] Schema changes are made only in `convex/schema.ts`; `convex/_generated` is regenerated via `npx convex codegen`.
- [ ] New unit/integration tests in `convex/scheduling.test.ts` cover the listed conflict, auth, role, and availability cases.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run test` pass. E2E is skipped.

---

## 2. Discovery Notes

Files inspected in the working tree:

- **`convex/schema.ts`** — Tables `shifts`, `tenantMembers`, `clients`, `auditEvents`, `coverageRequests`, and `availabilityWindows` already exist.
  - `shifts` uses ISO strings for `scheduledStart`/`scheduledEnd`, has `by_tenant_caregiver_status` and `by_tenant_status_start` indexes.
  - `availabilityWindows` currently uses `employeeProfileId` + `weekday` + `effectiveStart`/`effectiveEnd`/`status`; **no runtime code references it**, so it can be safely rewritten to match the task API.
  - `coverageRequests` has `requesterId`, optional `reason`, `status` as a plain string, `createdAt`, and `resolvedAt`; **no runtime code references it**, so it can be tightened to a union status and extended with `reassignedTo`/`resolvedBy`.
  - `auditEvents` stores the event type in a required `action` string; there is no `kind` field yet.
- **`convex/authHelpers.ts`** — Exports `requireTenant(ctx, clerkOrgId)`, `requireTenantRole(ctx, clerkOrgId, allowedRoles[])`, `assertTenantDoc(doc, tenantId)`, and `ensureTenantMember(ctx, tenantId, clerkUserId)`. The role helper already accepts an array of allowed roles.
- **`convex/audit.ts`** — Exports an internal mutation `record` that takes `clerkOrgId`, `action`, optional `shiftId`, status fields, and `metadata`. Existing callers in `convex/shifts.ts` pass `action` only.
- **`convex/shifts.ts` / `convex/shiftQueries.ts`** — Already contain shift lifecycle logic (`create`, `clockIn`, `submitDocumentation`, etc.). These will be left untouched to avoid regressions; the new scheduling functions live in a separate module.
- **`package.json`** — `convex-test` is installed; `npm run test` runs vitest; lint/typecheck scripts exist.
- **No `convex/scheduling.ts` exists.**

---

## 3. Alternatives Considered

| Decision | Options | Chosen approach | Rationale |
|---|---|---|---|
| File organization | One `convex/scheduling.ts` vs. `convex/scheduling/*.ts` | **Single `convex/scheduling.ts`** | Matches the task name exactly, minimizes generated API surface, and keeps imports simple. Can be split later if it grows past ~600 lines. |
| `availabilityWindows` schema | Adapt old `employeeProfileId` shape vs. rewrite | **Rewrite to `caregiverId` + `kind` + `dayOfWeek`/`date`** | The task API explicitly targets the caller's own `clerkUserId` (`caregiverId`). No existing data or code references the old shape. |
| Audit event "kind" | Add `kind` field vs. reuse `action` | **Add optional `kind` to `auditEvents` and `audit.record`, keep `action` required** | Satisfies the literal requirement (`kind='shift.created'`) while remaining backward-compatible with existing callers that only pass `action`. |
| Shift time representation | ISO strings vs. epoch ms | **Keep existing ISO strings** | Avoids a schema migration and existing code already relies on ISO comparison. Lexicographic compare is correct for UTC ISO strings. |
| Availability window time representation | `HH:mm` strings vs. minutes | **Store as `HH:mm` strings** | Keeps the API human-readable and matches the task signature. Lexicographic comparison is correct for same-day windows. |
| Availability behavior | Hard block vs. advisory warning | **Advisory warning only** | Exact task requirement. |
| Delete behavior | Hard delete shift only vs. cascade | **Hard delete shift + cascade `coverageRequests`** | Follows the task instruction and prevents dangling coverage rows; leaves `progressNotes`/`shiftTasks` as noted because the task only requires deleting the shift row. |

---

## 4. Exact Files to Create/Edit

### 4.1 `convex/schema.ts`

1. **Add optional `kind` to `auditEvents`:**
   ```ts
   auditEvents: defineTable({
     tenantId: v.id('tenants'),
     actorId: v.string(),
     actorRole: v.string(),
     shiftId: v.optional(v.id('shifts')),
     previousStatus: v.optional(v.string()),
     nextStatus: v.optional(v.string()),
     action: v.string(),
     kind: v.optional(v.string()),        // NEW
     metadata: v.optional(v.record(v.string(), v.any())),
     createdAt: v.string(),
   }).index('by_tenant_created_at', ['tenantId', 'createdAt']),
   ```

2. **Rewrite `availabilityWindows` to match the task API:**
   ```ts
   availabilityWindows: defineTable({
     tenantId: v.id('tenants'),
     caregiverId: v.string(),              // clerkUserId
     kind: v.union(v.literal('recurring'), v.literal('one-off')),
     dayOfWeek: v.optional(v.number()),    // 0–6, required for recurring
     date: v.optional(v.string()),         // YYYY-MM-DD, required for one-off
     startTime: v.string(),                // HH:mm
     endTime: v.string(),                  // HH:mm
     available: v.boolean(),
     note: v.optional(v.string()),
     createdAt: v.string(),
   })
     .index('by_tenant_caregiver', ['tenantId', 'caregiverId'])
     .index('by_tenant_caregiver_date', ['tenantId', 'caregiverId', 'date']),
   ```

3. **Tighten/extend `coverageRequests`:**
   ```ts
   coverageRequests: defineTable({
     tenantId: v.id('tenants'),
     shiftId: v.id('shifts'),
     requesterId: v.string(),
     reason: v.string(),
     status: v.union(v.literal('open'), v.literal('filled'), v.literal('cancelled')),
     reassignedTo: v.optional(v.string()), // NEW
     resolvedBy: v.optional(v.string()),   // NEW
     resolvedAt: v.optional(v.string()),   // NEW
     createdAt: v.string(),
   })
     .index('by_tenant_shift', ['tenantId', 'shiftId'])
     .index('by_tenant_status', ['tenantId', 'status']),
   ```

4. **Add one `shifts` index for combined caregiver + status + start queries:**
   ```ts
   shifts: defineTable({ ... })
     .index('by_tenant_caregiver_status', ['tenantId', 'caregiverId', 'status'])
     .index('by_tenant_coordinator_status', ['tenantId', 'coordinatorId', 'status'])
     .index('by_tenant_status_start', ['tenantId', 'status', 'scheduledStart'])
     .index('by_tenant_caregiver_status_start', ['tenantId', 'caregiverId', 'status', 'scheduledStart']), // NEW
   ```

### 4.2 `convex/audit.ts`

Extend `record` to accept an optional `kind` without changing existing callers:

```ts
export const record = internalMutation({
  args: {
    clerkOrgId: v.string(),
    action: v.string(),
    kind: v.optional(v.string()), // NEW
    shiftId: v.optional(v.id('shifts')),
    previousStatus: v.optional(v.string()),
    nextStatus: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    // existing tenant/role/shift checks unchanged
    return ctx.db.insert('auditEvents', {
      // ... existing fields ...
      action: args.action,
      kind: args.kind, // NEW
      // ...
    })
  },
})
```

### 4.3 `convex/scheduling.ts` (new)

All functions accept `clerkOrgId: string` as the first arg to satisfy `authHelpers` (the task signatures are conceptual). Export helper functions at the top, then the 14 Convex functions.

**Shared helpers**

- `assertCaregiverMember(ctx, tenantId, caregiverId)`
  - Query `tenantMembers` by `by_tenant_user`.
  - Throw `ConvexError('Selected caregiver must be an active caregiver in this agency.')` if missing or role !== `org:caregiver`.

- `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`
  - Query `shifts` by `by_tenant_caregiver_status` with `eq('tenantId', tenantId).eq('caregiverId', caregiverId)`.
  - Filter to non-terminal statuses: `scheduled`, `in_progress`, `submitted`, `approved`.
  - Return the first doc where `start < existing.scheduledEnd && end > existing.scheduledStart` and `existing._id !== excludeShiftId`; otherwise `null`.

- `checkAvailabilityWarning(ctx, tenantId, caregiverId, scheduledStart, scheduledEnd)`
  - Derive the shift date (`YYYY-MM-DD`) and `dayOfWeek` from `scheduledStart`.
  - Query `availabilityWindows` by `by_tenant_caregiver`.
  - Keep windows that match the day: `(kind === 'recurring' && dayOfWeek === shiftDayOfWeek)` OR `(kind === 'one-off' && date === shiftDate)`.
  - If there are windows for the day but the `[startTime, endTime]` slice is **not** fully covered by the union of `available === true` windows, return a warning string (e.g. `'Caregiver availability does not cover this slot.'`); otherwise return `null`.

- `buildShiftWithNames(ctx, shift)`
  - Fetch `client` and caregiver `tenantMember` in parallel.
  - Return `{ ...shift, clientDisplayName: client?.displayName ?? '', caregiverDisplayName: member?.displayName ?? '' }`.

**Functions 1–6: Shifts**

1. **`createShift` mutation** — requires `org:admin` or `org:coordinator`.
   - Args: `clientId`, `caregiverId`, `scheduledStart`, `scheduledEnd`, `serviceType`, `rate`, `serviceLocationOverride?`.
   - Validate `scheduledEnd > scheduledStart` and `rate > 0`.
   - `assertTenantDoc` on `clientId`.
   - `assertCaregiverMember` on `caregiverId`.
   - `checkShiftConflict`; on conflict throw `ConvexError('Shift conflicts with ${id} (${start} - ${end})')`.
   - `checkAvailabilityWarning`; capture result but do not block.
   - Insert shift with `status: 'scheduled'`.
   - Write audit: `action: 'shift.created', kind: 'shift.created'`.
   - Return `{ shiftId, availabilityWarning }`.

2. **`updateShift` mutation** — requires `org:admin` or `org:coordinator`.
   - Args: `shiftId` + optional `clientId`, `caregiverId`, `scheduledStart`, `scheduledEnd`, `serviceType`, `rate`, `serviceLocationOverride?`.
   - Load shift and `assertTenantDoc`.
   - Block if current status is `submitted`, `approved`, or `billing_ready`.
   - For each provided field validate and, for `clientId`/`caregiverId`, re-verify tenant/role membership.
   - If `scheduledStart`, `scheduledEnd`, or `caregiverId` changed, rerun `checkShiftConflict(shiftId)`.
   - Patch shift.
   - Audit: `action: 'shift.updated', kind: 'shift.updated'`.
   - Return `{ shiftId }`.

3. **`deleteShift` mutation** — requires `org:admin`.
   - Args: `shiftId`.
   - Load shift and `assertTenantDoc`.
   - Block if status is not `scheduled`.
   - Delete all `coverageRequests` with this `shiftId` (prevent orphans).
   - Hard-delete the shift row.
   - Audit: `action: 'shift.deleted', kind: 'shift.deleted'`.
   - Return `{ shiftId }`.

4. **`assignShift` mutation** — requires `org:admin` or `org:coordinator`.
   - Args: `shiftId`, `caregiverId`.
   - Load shift and `assertTenantDoc`.
   - `assertCaregiverMember` on new `caregiverId`.
   - `checkShiftConflict(..., shiftId)`.
   - Patch `caregiverId`.
   - Audit: `action: 'shift.reassigned', kind: 'shift.reassigned'`.
   - Return `{ shiftId }`.

5. **`listShifts` query** — requires `org:admin` or `org:coordinator`.
   - Args: `status?`, `startDate?`, `endDate?`, `caregiverId?`, `cursor?`.
   - Choose the narrowest index and paginate with `numItems: 100`:
     - `caregiverId + status` → `by_tenant_caregiver_status_start`
     - `status` → `by_tenant_status_start`
     - fallback → `by_tenant_caregiver_status` or scan + `.take(100)` depending on the filters.
   - Apply any remaining filters (e.g. date-range string comparison on `scheduledStart`) in JS.
   - Join names with `buildShiftWithNames`.
   - Return `{ items: ShiftWithNames[], nextCursor, hasMore }`.

6. **`listCaregiverShifts` query** — requires `org:caregiver`.
   - Query `shifts` by `by_tenant_caregiver_status` with `caregiverId === identity.subject`.
   - Order by `scheduledStart` desc, take 100.
   - Join client name.
   - Return array of joined shifts.

**Functions 7–11: Availability**

7. **`addAvailabilityWindow` mutation** — requires `org:caregiver`.
   - Args: `kind`, `dayOfWeek?`, `date?`, `startTime`, `endTime`, `available`, `note?`.
   - `caregiverId = identity.subject`; `tenantId` from auth.
   - Validate: recurring → `dayOfWeek` required (0–6); one-off → `date` required; `endTime > startTime`.
   - Insert window with `createdAt: new Date().toISOString()`.
   - Return `{ windowId }`.

8. **`updateAvailabilityWindow` mutation** — requires `org:caregiver`.
   - Args: `windowId`, `startTime?`, `endTime?`, `available?`, `note?`.
   - Load window, `assertTenantDoc`, and ensure `window.caregiverId === identity.subject`.
   - Patch allowed fields; if times change, validate ordering.
   - Return `{ windowId }`.

9. **`deleteAvailabilityWindow` mutation** — requires `org:caregiver`.
   - Args: `windowId`.
   - Load window, `assertTenantDoc`, ensure ownership.
   - Delete.
   - Return `{ windowId }`.

10. **`listMyAvailability` query** — requires `org:caregiver`.
    - Query `availabilityWindows` by `by_tenant_caregiver` with `caregiverId === identity.subject`.
    - Return array.

11. **`listAvailabilityForScheduling` query** — requires `org:admin` or `org:coordinator`.
    - Query `availabilityWindows` by `by_tenant_caregiver`; if `caregiverId` provided, `eq` it.
    - Return array.

**Functions 12–14: Coverage**

12. **`requestCoverage` mutation** — requires `org:caregiver`.
    - Args: `shiftId`, `reason`.
    - Load shift, `assertTenantDoc`.
    - Block if `shift.caregiverId !== identity.subject`.
    - Block if `shift.status !== 'scheduled'`.
    - Insert `coverageRequests` with `status: 'open'`, `requesterId: identity.subject`, `reason`.
    - Return `{ coverageRequestId }`.

13. **`resolveCoverage` mutation** — requires `org:admin` or `org:coordinator`.
    - Args: `coverageRequestId`, `reassignedTo`.
    - Load request, `assertTenantDoc`, ensure `status === 'open'`.
    - Load shift, `assertTenantDoc`.
    - `assertCaregiverMember` on `reassignedTo`.
    - `checkShiftConflict(..., shift._id)` for the new caregiver.
    - Patch shift: `caregiverId = reassignedTo`.
    - Patch request: `status: 'filled'`, `reassignedTo`, `resolvedBy: identity.subject`, `resolvedAt: now`.
    - Audit: `action: 'coverage.resolved', kind: 'coverage.resolved'`.
    - Return `{ shiftId, coverageRequestId }`.

14. **`listCoverageRequests` query** — requires `org:admin` or `org:coordinator`.
    - Args: `status?`.
    - Query `coverageRequests` by `by_tenant_status`; optionally `eq('status', status)`.
    - For each request, fetch the shift and client and attach `{ ...request, shift, clientName }`.
    - Return array.

### 4.4 `convex/scheduling.test.ts` (new)

See Section 6.

### 4.5 `convex/_generated/`

- Do not edit by hand.
- Run `npx convex codegen` after any schema change.

---

## 5. Data / Auth / Security / PHI / Idempotency Edge Cases

| Area | Risk | Mitigation |
|---|---|---|
| **Multi-tenancy** | Cross-tenant data leakage | Every function starts with `requireTenantRole`/`requireTenant`. All doc lookups use `assertTenantDoc` or a `by_tenant_*` index scoped to the authenticated tenant. A caregiver id from another tenant fails `assertCaregiverMember`. |
| **Role escalation** | Privilege escalation | Entry points enforce exact role arrays; `deleteShift` is admin-only, `listShifts` excludes caregivers, etc. |
| **Terminal-status edits** | Editing submitted/approved shifts | `updateShift` rejects `submitted`, `approved`, and `billing_ready`. `deleteShift` only accepts `scheduled`. |
| **Double-booking** | Race condition creates overlapping shifts | Convex mutations are transactional; conflict check and insert happen in the same mutation. |
| **Adjacent shifts** | Back-to-back shifts should be allowed | Overlap check uses strict `<`/`>` so `09:00–10:00` and `10:00–11:00` do not conflict. |
| **Availability advisory** | Blocking instead of warning | `createShift` always inserts; it only adds a `availabilityWarning` field when windows exist but do not cover the slot. |
| **Coverage integrity** | Orphan coverage rows after shift delete | `deleteShift` deletes linked `coverageRequests` first. `resolveCoverage` requires request status `open`. |
| **PHI / sensitive data** | Client/caregiver association leakage | All access is tenant + role scoped; joined names only return `displayName`; audit events log every mutating action. |
| **Time zones** | DST / local-time confusion | Shift times remain UTC ISO strings; availability windows store `HH:mm` in the agency's local time. Document this assumption. |
| **Idempotency** | Duplicate coverage requests | The spec allows multiple open requests per shift. No idempotency keys are added unless product later requires them. |
| **Currency** | Float rounding on `rate` | Use `v.number` as the existing schema does. Document that production should move to integer cents if precision becomes critical. |

---

## 6. Test Strategy

Create `convex/scheduling.test.ts` using the existing `convex-test` harness:

```ts
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.*s')
function createTestConvex() { return convexTest({ schema, modules }) }
```

### Pure / helper-level tests

- `checkShiftConflict` / overlap logic:
  - No conflict on adjacent shifts.
  - Conflict on overlapping shifts.
  - Conflict when new shift starts exactly at an existing shift's start.
  - No conflict when the only existing shift is `billing_ready` / `needs_correction`.
  - `excludeShiftId` correctly excludes the shift being edited.

### Integration / auth tests

- `createShift`:
  - succeeds for admin/coordinator.
  - throws when `caregiverId` belongs to another tenant (cross-tenant).
  - throws `ConvexError` with conflict id and times on overlap.
  - returns `availabilityWarning` when windows exist but do not cover the slot.
- `updateShift`:
  - blocked when status is `submitted`.
  - reruns conflict check when `caregiverId` changes.
- `deleteShift`:
  - blocked when status is `in_progress`.
  - hard-deletes a `scheduled` shift and its linked coverage requests.
- `assignShift`:
  - excludes the current shift from conflict detection.
- `requestCoverage`:
  - blocked when caller is not the assigned caregiver.
  - blocked when shift status is not `scheduled`.
- `resolveCoverage`:
  - verifies replacement caregiver role.
  - rejects a replacement that conflicts with another shift.
- Availability CRUD:
  - `update`/`delete` blocked for another caregiver's window.
  - `addAvailabilityWindow` validates recurring vs. one-off required fields.
- `listShifts` rejects a caller with only `org:caregiver` role.

### Gates to run

```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test
```

Skip Playwright / E2E for this backend-only session.

---

## 7. Rollback / Verification Notes

- **Before starting:** ensure the working tree is clean on `feature/phase-2-worker-onboarding` so a `git revert` or `git stash` is possible.
- **After schema edits:** run `npx convex codegen` immediately and verify `convex/_generated/dataModel.ts` reflects the new `availabilityWindows` shape, `coverageRequests` fields, `auditEvents.kind`, and new indexes. Do not hand-edit generated files.
- **Verification:**
  1. `npm run lint` passes with the project's 2-space / single-quote / no-semicolon style.
  2. `npm run typecheck` passes.
  3. `npm run test` passes, including the new `convex/scheduling.test.ts`.
  4. In the Convex dashboard, confirm the new endpoints appear under `scheduling:*`.
- **Rollback:** `git revert` the scheduling commit and rerun `npx convex codegen` to restore generated types.
