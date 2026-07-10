# ATRIA-X Session 2 — Scheduling Backend Implementation Plan

## 1. Restated Goal and Acceptance Criteria

**Goal:** Add the backend scheduling surface for ATRIA-X Phase 2 on branch `feature/phase-2-worker-onboarding`. Implement shift CRUD, caregiver availability, coverage request workflow, and shift conflict detection, all guarded through `convex/authHelpers.ts` and without any ADP integration calls.

**Acceptance Criteria (all verifiable by `npm run lint`, `npm run typecheck`, `npm run test`; e2e skipped):**

- `convex/scheduling.ts` exposes exactly the 14 operations listed in the task (1–14).
- `checkShiftConflict` is exported as a pure helper and used by `createShift`, `updateShift`, `assignShift`, and `resolveCoverage`.
- Every public mutation/query calls `requireTenantRole` (or `requireTenant`) and uses `assertTenantDoc` before acting on any tenant-scoped document.
- `createShift` inserts with `status: 'scheduled'`, validates the caregiver is a tenant member with role `org:caregiver`, runs conflict detection, and returns an advisory availability warning when the slot is not covered by the caregiver's windows.
- `updateShift` blocks edits when the shift is in `submitted`, `approved`, or `billing_ready`.
- `deleteShift` is restricted to `org:admin` and only deletes shifts whose status is `scheduled`.
- `assignShift` and `resolveCoverage` verify the target caregiver is a tenant `org:caregiver` and rerun conflict detection (excluding the current shift for `assignShift`).
- Availability CRUD is scoped to the caller's own `clerkUserId` (`identity.subject`).
- `requestCoverage` is restricted to the assigned caregiver of a `scheduled` shift.
- `resolveCoverage` updates the shift caregiver, marks the request `filled`, and records an audit event.
- `listShifts` and `listCoverageRequests` require `org:admin` or `org:coordinator`; `listCaregiverShifts`, `listMyAvailability`, and availability mutations require `org:caregiver`.
- Unit tests in `convex/scheduling.test.ts` cover: adjacent shifts (no conflict), overlapping shifts (conflict), same-start conflict, completed/`billing_ready` shifts excluded from conflict, `excludeShiftId` behavior, cross-tenant caregiver rejection, submitted-shift edit block, in-progress delete block, wrong-caregiver coverage request block, availability ownership enforcement, and role-based `listShifts` access.
- `npx convex codegen` is run after any schema change and before tests.

---

## 2. Discovery Notes

Verified by direct repo inspection on branch `feature/phase-2-worker-onboarding` (commit `27bb01d`).

- **Auth seam:** `convex/authHelpers.ts` exports `requireTenantRole(ctx, clerkOrgId, allowedRoles)`, `requireTenant(ctx, clerkOrgId)`, `assertTenantDoc(doc, tenantId)`, and `ensureTenantMember(ctx, tenantId, clerkUserId)`. This is the only auth path the new code will use.
- **Existing shift code:** `convex/shifts.ts` already has `create`, `createMany`, `startDocumentation`, `clockIn`, `clockOut`, etc., and `convex/shiftQueries.ts` has `listMyShifts`, `listAll`, `get`, etc. They use the same `shifts` table. The new `scheduling.ts` functions will coexist with these; no refactoring of the existing clock/submit flow is required.
- **Schema seams:**
  - `shifts` table exists with indexes `by_tenant_caregiver_status` and `by_tenant_status_start`.
  - `clients` table exists with `by_tenant` index.
  - `tenantMembers` table exists with `by_tenant_user` and `by_tenant_role` indexes.
  - `coverageRequests` table exists with `by_tenant_shift` and `by_tenant_status` indexes.
  - `auditEvents` table exists with `action` (string) but no `kind` field.
  - `availabilityWindows` table exists but currently targets `employeeProfileId` and stores `weekday`/`status`; it does not match the task's `caregiverId`/`kind`/`dayOfWeek`/`date`/`available`/`note` shape.
- **Audit seam:** `convex/audit.ts` exposes an `internalMutation` named `record` that accepts `action` (required string). It is called from `shifts.ts` via `ctx.runMutation(internal.audit.record, ...)`. The new scheduling code will continue calling this internal mutation.
- **Test harness:** Existing tests use `convex-test` with `import.meta.glob('./**/*.*s')` to load modules and `t.withIdentity({ subject, org_id, org_role })` to simulate Clerk identities. This pattern will be reused for `convex/scheduling.test.ts`.
- **No ADP references needed:** Scheduling is purely tenant/internal; ADP calls are explicitly out of scope.

---

## 3. Alternatives Considered

| Decision | Option A | Option B (chosen) | Rationale |
|---|---|---|---|
| Where to put the new code | Refactor `shifts.ts` and `shiftQueries.ts` to centralize everything in `scheduling.ts` | Create new `convex/scheduling.ts` alongside existing files | Avoids regression risk in the already-working clock/submit/billing flow and keeps the Session 2 surface isolated and reviewable. |
| Availability window schema | Keep existing `employeeProfileId` + `weekday` + `status` shape and translate at the API layer | Update `availabilityWindows` schema to use `caregiverId` (clerkUserId), `kind`, `dayOfWeek`, `date`, `available`, `note` | The task's API explicitly references `own clerkUserId`, `kind`, `dayOfWeek`, `date`, and `available`. Translating through `employeeProfiles` adds indirection and a join on every write with no benefit. Since no code currently writes to `availabilityWindows`, the schema rewrite is safe. |
| Audit event field for "kind" | Reuse existing `action` field and set `action: 'shift.created'` | Add optional `kind` field to `auditEvents` and populate both `action` and `kind` | The task literally says "Write auditEvent kind='shift.created'". Adding an optional `kind` satisfies the requirement literally while keeping `action` populated for backward compatibility with existing callers. |
| Conflict query strategy | One query per status using `by_tenant_caregiver_status` | Single partial-index query by `tenantId` + `caregiverId`, then JS filter by status and overlap | Simpler code, fewer round trips, and typical caregiver shift volumes make the scan negligible. If volumes grow, the per-status index strategy can be adopted without changing the public API. |
| Shift delete cascade | Only hard-delete the shift row | Hard-delete shift plus any auto-created `progressNotes` and `shiftTasks` rows | Chosen: literal hard-delete of the shift row only, because the task explicitly says "Hard-delete the shift row." A data-hygiene note is added to consider cascading in a follow-up if orphaned rows become a concern. |

---

## 4. Exact Files to Create/Edit

### 4.1 Schema changes — `convex/schema.ts`

#### 4.1.1 Update `availabilityWindows` table
Replace the current `availabilityWindows` definition with:

```ts
availabilityWindows: defineTable({
  tenantId: v.id('tenants'),
  caregiverId: v.string(), // clerkUserId
  kind: v.union(v.literal('recurring'), v.literal('one_off')),
  dayOfWeek: v.optional(v.number()), // 0–6, required when kind === 'recurring'
  date: v.optional(v.string()), // YYYY-MM-DD, required when kind === 'one_off'
  startTime: v.string(), // HH:mm
  endTime: v.string(), // HH:mm
  available: v.boolean(),
  note: v.optional(v.string()),
})
  .index('by_tenant_caregiver', ['tenantId', 'caregiverId'])
  .index('by_tenant_caregiver_date', ['tenantId', 'caregiverId', 'date']),
```

#### 4.1.2 Extend `auditEvents` table
Add an optional `kind` field:

```ts
auditEvents: defineTable({
  tenantId: v.id('tenants'),
  actorId: v.string(),
  actorRole: v.string(),
  shiftId: v.optional(v.id('shifts')),
  previousStatus: v.optional(v.string()),
  nextStatus: v.optional(v.string()),
  action: v.string(),
  kind: v.optional(v.string()), // NEW
  metadata: v.optional(v.record(v.string(), v.any())),
  createdAt: v.string(),
}).index('by_tenant_created_at', ['tenantId', 'createdAt']),
```

### 4.2 Audit seam update — `convex/audit.ts`

Update the `record` internalMutation args to accept an optional `kind` and write it into the document alongside `action`:

```ts
args: {
  clerkOrgId: v.string(),
  action: v.string(),
  kind: v.optional(v.string()), // NEW
  shiftId: v.optional(v.id('shifts')),
  previousStatus: v.optional(v.string()),
  nextStatus: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.any())),
},
```

In the insert payload include `kind: args.kind` (will be `undefined` when omitted, which is fine). Existing callers in `shifts.ts` remain unchanged and continue to work.

### 4.3 New scheduling module — `convex/scheduling.ts`

Create this file. Style: single quotes, no semicolons, 2-space indent. All public functions use `mutation`/`query` from `./_generated/server` and call authHelpers. Internal helpers are not exported as Convex functions.

#### Exported helpers

```ts
export async function checkShiftConflict(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<'tenants'>,
  caregiverId: string,
  start: string,
  end: string,
  excludeShiftId?: Id<'shifts'>,
): Promise<{ _id: Id<'shifts'>; scheduledStart: string; scheduledEnd: string } | null>
```

Implementation notes:
- Query `shifts` with `by_tenant_caregiver_status` partial key: `.eq('tenantId', tenantId).eq('caregiverId', caregiverId)`.
- Filter in JS to statuses in `['scheduled', 'in_progress', 'submitted', 'approved']`.
- Exclude `excludeShiftId` if provided.
- Return the first row where `start < other.scheduledEnd && other.scheduledStart < end`.

#### 1) `createShift` mutation
Args: `clerkOrgId`, `clientId`, `caregiverId`, `scheduledStart`, `scheduledEnd`, `serviceType`, `rate`, `serviceLocationOverride?`.

- `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
- Load client, `assertTenantDoc`, throw `ConvexError('Client not found.')` if missing.
- Verify caregiver: query `tenantMembers` `by_tenant_user` for `tenantId + caregiverId`; require role `org:caregiver`; throw `ConvexError('Caregiver must be an active member of this agency.')` if not.
- Validate `scheduledEnd > scheduledStart` and `rate > 0`.
- Call `checkShiftConflict`; if conflict, throw `ConvexError(\`Shift conflicts with existing shift ${conflict._id} (${conflict.scheduledStart} – ${conflict.scheduledEnd}).\`)`.
- Check availability advisory:
  - Parse `scheduledStart` to date string `YYYY-MM-DD` and day-of-week `0–6`.
  - Query `availabilityWindows` by `tenantId + caregiverId`.
  - Filter windows relevant to that day: `(kind === 'recurring' && dayOfWeek === shiftDayOfWeek) || (kind === 'one_off' && date === shiftDate)`.
  - If any relevant windows exist and the `[startTime, endTime]` interval is **not** fully covered by the union of those windows, set `availabilityWarning = true`.
  - If no windows exist at all, no warning (availability is advisory).
- Insert shift with `status: 'scheduled'`.
- Call `internal.audit.record` with `action: 'shift.created'`, `kind: 'shift.created'`, `shiftId`, `previousStatus: undefined`, `nextStatus: 'scheduled'`.
- Return `{ shiftId, availabilityWarning?: true }`.

#### 2) `updateShift` mutation
Args: `clerkOrgId`, `shiftId`, plus optional fields to update (`scheduledStart?`, `scheduledEnd?`, `serviceType?`, `rate?`, `serviceLocationOverride?`).

- `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
- Load shift, `assertTenantDoc`; throw if missing.
- If `shift.status` is `submitted`, `approved`, or `billing_ready`, throw `ConvexError('Cannot edit a shift that is submitted or approved')`.
- Validate rate and times if provided.
- Build patch object only for provided fields.
- If `scheduledStart`, `scheduledEnd`, or caregiver change is involved, rerun `checkShiftConflict` (exclude `shiftId`).
- Apply patch.
- Call `internal.audit.record` with `action: 'shift.updated'`, `kind: 'shift.updated'`, `shiftId`, `previousStatus`, `nextStatus` (current status, usually unchanged).
- Return `shiftId`.

#### 3) `deleteShift` mutation
Args: `clerkOrgId`, `shiftId`.

- `requireTenantRole(ctx, clerkOrgId, ['org:admin'])`.
- Load shift, `assertTenantDoc`; throw if missing.
- If `shift.status !== 'scheduled'`, throw `ConvexError('Only scheduled shifts can be deleted.')`.
- Call `internal.audit.record` with `action: 'shift.deleted'`, `kind: 'shift.deleted'`, `shiftId`, `previousStatus: 'scheduled'`.
- `await ctx.db.delete(shiftId)`.
- Return `shiftId`.

#### 4) `assignShift` mutation
Args: `clerkOrgId`, `shiftId`, `caregiverId`.

- `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
- Load shift, `assertTenantDoc`.
- Verify target caregiver is tenant `org:caregiver` (same helper as `createShift`).
- `checkShiftConflict` excluding `shiftId` for the new caregiver.
- Patch `shift.caregiverId`.
- Call `internal.audit.record` with `action: 'shift.reassigned'`, `kind: 'shift.reassigned'`, `shiftId`, metadata `{ previousCaregiverId: old, nextCaregiverId: new }`.
- Return `shiftId`.

#### 5) `listShifts` query
Args: `clerkOrgId`, `status?`, `startDate?`, `endDate?`, `caregiverId?`.

- `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
- Choose index based on filters:
  - If `caregiverId` provided: `by_tenant_caregiver_status` with `tenantId + caregiverId`, optionally eq `status`.
  - Else: `by_tenant_status_start` with `tenantId`, optionally eq `status`.
- If `startDate`/`endDate` provided, filter result in JS using ISO string comparisons (`scheduledStart >= ${startDate}T00:00:00.000Z` and `scheduledStart <= ${endDate}T23:59:59.999Z`).
- `.take(100)` max.
- Join client and caregiver display names:
  - For each shift, `ctx.db.get(shift.clientId)`.
  - Query `tenantMembers` `by_tenant_user` for each `caregiverId` (or batch with a single `by_tenant` collect and build a map).
- Return array of objects: `{ ...shift, clientDisplayName, caregiverDisplayName }`.

#### 6) `listCaregiverShifts` query
Args: `clerkOrgId`.

- `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
- Query `shifts` by `tenantId + identity.subject` via `by_tenant_caregiver_status`.
- Order desc by scheduledStart, `.take(100)`.
- Join client display names.
- Return array of `{ ...shift, clientDisplayName }`.

#### 7–10) Availability mutations/queries

- `addAvailabilityWindow`
  - Args: `clerkOrgId`, `kind`, `dayOfWeek?`, `date?`, `startTime`, `endTime`, `available`, `note?`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
  - Validate: `endTime > startTime`; if `kind === 'recurring'` require `dayOfWeek` in `0–6`; if `kind === 'one_off'` require `date` matching `YYYY-MM-DD`.
  - Insert with `caregiverId: identity.subject`.
  - Return window `_id`.

- `updateAvailabilityWindow`
  - Args: `clerkOrgId`, `windowId`, `startTime?`, `endTime?`, `available?`, `note?`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
  - Load window, `assertTenantDoc`; throw if missing.
  - If `window.caregiverId !== identity.subject`, throw `ConvexError('Forbidden: can only edit your own availability window.')`.
  - Validate `endTime > startTime` if both provided.
  - Patch.
  - Return `windowId`.

- `deleteAvailabilityWindow`
  - Args: `clerkOrgId`, `windowId`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
  - Load, `assertTenantDoc`, ownership check, then `ctx.db.delete(windowId)`.
  - Return `windowId`.

- `listMyAvailability`
  - Args: `clerkOrgId`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
  - Query `availabilityWindows` by `tenantId + identity.subject`.
  - Return all windows (up to 200; adjust if needed).

- `listAvailabilityForScheduling`
  - Args: `clerkOrgId`, `caregiverId?`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
  - If `caregiverId` provided, query by `tenantId + caregiverId`; else query by `tenantId` (filter/collect).
  - Return windows.

#### 11–13) Coverage workflow

- `requestCoverage`
  - Args: `clerkOrgId`, `shiftId`, `reason`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:caregiver'])`.
  - Load shift, `assertTenantDoc`.
  - If `shift.caregiverId !== identity.subject`, throw `ConvexError('Forbidden: can only request coverage for your assigned shift.')`.
  - If `shift.status !== 'scheduled'`, throw `ConvexError('Only scheduled shifts can request coverage.')`.
  - Insert `coverageRequests` with `tenantId`, `shiftId`, `requesterId: identity.subject`, `reason`, `status: 'open'`, `createdAt: new Date().toISOString()`.
  - Return request `_id`.

- `resolveCoverage`
  - Args: `clerkOrgId`, `coverageRequestId`, `reassignedTo`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
  - Load coverage request, `assertTenantDoc`; throw if missing or status !== `'open'`.
  - Load associated shift, `assertTenantDoc`.
  - Verify `reassignedTo` is tenant `org:caregiver`.
  - `checkShiftConflict` for `reassignedTo` with the shift's times.
  - Patch shift: `caregiverId: reassignedTo`.
  - Patch coverage request: `status: 'filled'`, `resolvedBy: identity.subject`, `resolvedAt: new Date().toISOString()`.
  - Call `internal.audit.record` with `action: 'coverage.resolved'`, `kind: 'coverage.resolved'`, `shiftId`, metadata `{ coverageRequestId, previousCaregiverId: old, nextCaregiverId: reassignedTo }`.
  - Return `{ shiftId, coverageRequestId }`.

- `listCoverageRequests`
  - Args: `clerkOrgId`, `status?`.
  - `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:coordinator'])`.
  - Query `coverageRequests` by `tenantId` (or by `tenantId + status` if index exists; use `by_tenant_status` if status provided). The existing `by_tenant_status` index supports this.
  - Join shift info (`ctx.db.get(request.shiftId)`) for each request.
  - Return array of `{ ...request, shift }`.

### 4.4 New tests — `convex/scheduling.test.ts`

Use `convex-test` harness identical to `convex/reviews.test.ts`/`convex/shiftClock.test.ts`:

```ts
const modules = import.meta.glob('./**/*.*s')
function createTestConvex() { return convexTest({ schema, modules }) }
```

Helper seeders:
- `seedTenantWithMembers(t, { clerkOrgId, adminId?, coordinatorId?, caregiverId })` creates tenant, admin/coordinator/caregiver members, and a client.
- `seedShift(t, { clerkOrgId, tenantId, clientId, caregiverId, scheduledStart, scheduledEnd, status })` inserts a shift directly.
- `seedAvailabilityWindow(t, { tenantId, caregiverId, kind, ... })`.
- Identity helpers: `asAdmin`, `asCoordinator`, `asCaregiver`.

Test cases to implement:
1. `checkShiftConflict` — adjacent shifts (end == next start) returns `null`.
2. `checkShiftConflict` — overlapping start/end returns the conflicting shift id and times.
3. `checkShiftConflict` — same start returns conflict.
4. `checkShiftConflict` — `billing_ready` shift is excluded from conflict check.
5. `checkShiftConflict` — `excludeShiftId` excludes the shift itself.
6. `createShift` blocks a caregiver from a different tenant (cross-tenant `assertTenantDoc` equivalent via member lookup failure).
7. `createShift` returns `availabilityWarning: true` when a window exists for the day but the slot is uncovered.
8. `createShift` returns no warning when availability windows fully cover the slot.
9. `updateShift` blocked when shift status is `submitted`.
10. `deleteShift` blocked when shift status is `in_progress`.
11. `deleteShift` succeeds for `scheduled` shift and writes audit event.
12. `assignShift` reruns conflict detection and rejects conflicting reassignment.
13. `requestCoverage` blocked when called by a caregiver not assigned to the shift.
14. `requestCoverage` blocked when shift is not `scheduled`.
15. `resolveCoverage` updates shift caregiver and coverage request status, writes audit event.
16. Availability CRUD: `add`, `update`, `delete`, `listMyAvailability` restricted to own `clerkUserId`.
17. `listShifts` rejects `org:caregiver` role.
18. `listShifts` returns shifts with joined client and caregiver display names.
19. `listCaregiverShifts` returns only own shifts with client names.

### 4.5 Codegen and gate commands

After editing `convex/schema.ts` and `convex/audit.ts`, run:

```bash
npx convex codegen
```

Then run gates:

```bash
npm run lint
npm run typecheck
npm run test
```

Skip e2e per task instruction.

---

## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

- **Cross-tenant isolation:** Every handler derives `tenantId` from `requireTenantRole`/`requireTenant` using the Clerk `clerkOrgId`, not from caller-provided `tenantId`. All document loads are followed by `assertTenantDoc(doc, tenantId)`. Caregiver membership is verified inside the same tenant before acting.
- **Role escalation:** `deleteShift` is `org:admin` only; scheduling write operations are `org:admin`/`org:coordinator`; caregiver-scoped operations use `org:caregiver`. The `listShifts` and `listCoverageRequests` queries are admin/coordinator only.
- **Caregiver self-scoping:** Availability mutations and `listMyAvailability` compare against `identity.subject`. `listCaregiverShifts` uses `identity.subject` as the caregiver filter, so a caregiver cannot view another caregiver's schedule.
- **Status guards:** `updateShift` blocks `submitted`/`approved`/`billing_ready`; `deleteShift` only allows `scheduled`; `requestCoverage` only allows `scheduled`; `resolveCoverage` only allows `open` requests.
- **Conflict semantics:** Overlap is defined as `start < otherEnd && otherStart < end`. Adjacent shifts (`end === otherStart`) are safe. Only non-terminal statuses (`scheduled`, `in_progress`, `submitted`, `approved`) are checked; `billing_ready` and `needs_correction` are excluded.
- **Availability advisory only:** `createShift` never blocks on uncovered availability; it only returns a warning flag. This preserves coordinator flexibility.
- **PHI / data leakage:** `listShifts` joins client and caregiver names but never returns raw `tenantId` to clients in a way that crosses tenants. All joins happen after tenant filtering.
- **Coverage idempotency:** `resolveCoverage` checks `status === 'open'` before mutating. A second call on an already-filled request throws, preventing double-assignment.
- **Audit trail:** Every state-changing scheduling operation writes an `auditEvents` row with `actorId`, `actorRole`, `shiftId`, and `kind`. This supports compliance review.
- **Date/time assumptions:** Availability windows use `HH:mm` and match against the UTC date/day extracted from the ISO `scheduledStart`. If the product later needs agency-local timezone handling, the matching logic must be updated; document this assumption in code comments.
- **Orphaned child rows on shift delete:** As noted, only the shift row is hard-deleted per the task. Scheduled shifts have auto-created `progressNotes` and `shiftTasks`; these will become orphaned. A follow-up cleanup migration or cascade can be added later if needed.
- **Rate validation:** Reject non-finite, zero, or negative rates; consistent with `shifts.ts`.
- **Input shape:** `serviceLocationOverride` uses the existing `shifts` table object shape; no new validation needed beyond what Convex schema enforces.

---

## 6. Test Strategy

- **Unit/integration layer:** All tests run through `convex-test` against the real schema and the new `scheduling.ts` module. No mocks except Clerk identity injection.
- **Conflict detection:** Dedicated tests for the exported `checkShiftConflict` helper using direct DB seeding and `t.runAction`/internal-like access if needed, or by calling `createShift`/`assignShift` and asserting on thrown messages.
- **Auth matrix:** For each operation, test at least one allowed role and one disallowed role:
  - Admin/coordinator allowed for shift write/list/coverage admin operations.
  - Caregiver allowed/restricted for own availability and own shifts.
  - Caregiver rejected from `listShifts`.
- **State-machine tests:** Verify blocked transitions (`updateShift` on submitted, `deleteShift` on in-progress, `requestCoverage` on non-scheduled, `resolveCoverage` on non-open).
- **Cross-tenant tests:** Attempt to assign a caregiver from tenant B to a shift in tenant A; expect caregiver verification failure.
- **Availability tests:** Verify CRUD ownership and the advisory warning behavior.
- **Gates:**
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test` (all tests, backend only)
- **Skipped:** e2e (`npm run e2e*`) per task instruction.

---

## 7. Rollback / Verification Notes

- **Rollback:** This change is additive except for the `availabilityWindows` schema rewrite and the optional `auditEvents.kind` field. If rollback is needed:
  1. Revert `convex/schema.ts` to the previous `availabilityWindows` shape and remove `kind` from `auditEvents`.
  2. Delete `convex/scheduling.ts` and `convex/scheduling.test.ts`.
  3. Revert the one-line `kind` addition in `convex/audit.ts`.
  4. Run `npx convex codegen` again.
- **Pre-deploy verification:**
  - Confirm `npx convex codegen` produces no diffs beyond expected generated API updates.
  - Confirm `npm run lint` passes.
  - Confirm `npm run typecheck` passes.
  - Confirm `npm run test` passes, especially `convex/scheduling.test.ts`.
- **Post-deploy smoke checks:**
  - Coordinator can create a shift for a caregiver with no conflict.
  - Creating an overlapping shift throws with the conflicting shift id in the message.
  - Caregiver can add availability and request coverage on an assigned shift.
  - Admin can resolve coverage to another caregiver.
- **Risk note:** Because `availabilityWindows` schema changes, any existing rows in that table (none currently in code) would be incompatible. Verify with the team that no production data exists in `availabilityWindows` before deploying; if it does, a migration from `employeeProfileId` to `caregiverId` is required.
