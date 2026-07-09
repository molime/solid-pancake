# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: ATRIA-X Session 2 — Scheduling Backend

## 1. Goal & Acceptance Criteria
**Goal:** Implement secure, multi-tenant scheduling logic (shifts, availability, coverage) in Convex, enforcing strict role-based access control (RBAC) via `authHelpers`.

**Acceptance Criteria:**
- [ ] 15 Convex functions implemented (mutations/queries/helpers) matching specifications (1-15).
- [ ] All functions enforce multi-tenancy via `requireTenantRole` or `requireTenant` + `assertTenantDoc`.
- [ ] Conflict detection prevents overlapping shifts for the same caregiver (excluding self on update).
- [ ] Availability checks return warnings but do not block shift creation.
- [ ] Audit events logged for shift CRUD and coverage resolution.
- [ ] Unit tests cover conflict logic, auth gates, and edge cases (adjacent vs overlapping).
- [ ] `npx convex codegen` runs successfully; `npm run lint`, `typecheck`, `test` pass.
- [ ] Code style: 2-space indent, single quotes, no semicolons.

## 2. Discovery Notes
**Limitation:** I am a chat-only agent and cannot inspect the local filesystem or running Convex dashboard. I cannot verify the exact current state of `convex/schema.ts` or `convex/authHelpers.ts`.

**Assumptions based on Task Context:**
- **Schema:** Tables `shifts`, `availabilityWindows`, `coverageRequests`, `tenantMembers`, `clients`, `auditLogs` exist from Session 1.
- **Indexes:** I will assume necessary indexes exist (e.g., `by_tenant_caregiver_status` on `shifts`). If missing, `schema.ts` updates are required.
- **Auth:** `authHelpers.ts` exports `requireTenantRole`, `requireTenant`, `assertTenantDoc`.
- **Types:** Generated types (`Id`, `Doc`) are available via `@/convex/_generated`.
- **Time:** All timestamps stored as UTC numbers (ms since epoch) to avoid timezone issues in conflict logic.

**Risk:** If Session 1 schema differs (e.g., `shifts` table name is `workerShifts`), implementation will fail typecheck. I will proceed using the names implied in the task (`shifts`, `availabilityWindows`) and note this as a verification step.

## 3. Alternatives Considered
| Approach | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Single `scheduling.ts`** | Fewer files, easier initial navigation. | Becomes monolithic quickly; harder to test isolated logic. | **Reject** |
| **Module (`scheduling/`)** | Clear separation (shifts, availability, coverage); easier ownership. | Slightly more import overhead. | **Select** |
| **Blocking Availability** | Prevents scheduling outside windows. | Too rigid for home-care (emergencies happen); task specifies "advisory". | **Reject** |
| **DB-Level Constraints** | Strongest integrity. | Convex doesn't support complex SQL-like constraints; logic must be in functions. | **Reject** |

## 4. File Plan & Behavioral Changes

### 4.1 `convex/schema.ts` (Verification/Update)
- **Action:** Verify indexes exist for performance.
- **Required Indexes:**
  - `shifts`: `by_tenant_caregiver_status` (tenantId, caregiverId, status), `by_tenant_client_status`.
  - `availabilityWindows`: `by_tenant_user` (tenantId, clerkUserId).
  - `coverageRequests`: `by_tenant_status` (tenantId, status).
- **Change:** Add indexes if missing. Run `npx convex codegen`.

### 4.2 `convex/scheduling/helpers.ts` (New)
- **Function:** `checkShiftConflict(ctx, tenantId, caregiverId, start, end, excludeShiftId?)`
- **Logic:**
  - Query `shifts` by `by_tenant_caregiver_status` for statuses `['scheduled', 'in_progress', 'submitted', 'approved']`.
  - Filter client-side (or via convex filter) for overlap: `start < existing.end && end > existing.start`.
  - Exclude `excludeShiftId` if provided.
  - Return conflicting shift doc or `null`.
- **Security:** Uses internal `ctx`; caller must validate tenantId.

### 4.3 `convex/scheduling/shifts.ts` (New)
- **Mutations:**
  - `createShift`: Validate caregiver role (`org:caregiver`). Call `checkShiftConflict`. Check availability (query `availabilityWindows` for day; flag warning if no cover). Insert shift. Audit `shift.created`.
  - `updateShift`: Assert status not terminal (`submitted`/`approved`/`billing_ready`). Re-run conflict check if times/caregiver changed. Audit `shift.updated`.
  - `deleteShift`: Admin only. Assert status `scheduled`. Hard delete. Audit `shift.deleted`.
  - `assignShift`: Validate new caregiver role. Conflict check (exclude current shift). Update `caregiverId`. Audit `shift.reassigned`.
- **Queries:**
  - `listShifts`: Admin/Coordinator. Filter by params. Join `clients` and `tenantMembers` for names. Paginate (max 100).
  - `listCaregiverShifts`: Caregiver only. Filter by `clerkUserId`. Join `clients`.

### 4.4 `convex/scheduling/availability.ts` (New)
- **Mutations:**
  - `addAvailabilityWindow`: Caregiver only. Insert own window.
  - `updateAvailabilityWindow`: Caregiver only. Assert ownership (`caregiverId === clerkUserId`).
  - `deleteAvailabilityWindow`: Caregiver only. Assert ownership.
- **Queries:**
  - `listMyAvailability`: Caregiver only. Return own windows.
  - `listAvailabilityForScheduling`: Admin/Coordinator. Return all (or filtered by caregiver).

### 4.5 `convex/scheduling/coverage.ts` (New)
- **Mutations:**
  - `requestCoverage`: Caregiver only. Assert shift ownership (`shift.caregiverId === clerkUserId`). Assert status `scheduled`. Insert `coverageRequests` (status `open`).
  - `resolveCoverage`: Admin/Coordinator. Assert request tenant. Validate `reassignedTo` role. Conflict check for new caregiver. Update shift. Update request (`filled`, `resolvedBy`, `resolvedAt`). Audit `coverage.resolved`.
- **Queries:**
  - `listCoverageRequests`: Admin/Coordinator. Filter by status. Join shift info.

### 4.6 `convex/scheduling.test.ts` (New)
- **Framework:** Vitest + `convex-test` (or standard Convex testing harness).
- **Cases:**
  - **Conflict:** Adjacent shifts (pass), Overlapping (fail), Same start (fail), Completed shift overlap (pass), `excludeShiftId` (pass).
  - **Auth:** Cross-tenant caregiver (fail), Update submitted shift (fail), Delete in_progress (fail), Coverage wrong caregiver (fail), Availability non-own (fail), ListShifts wrong role (fail).

## 5. Edge Cases & Security Considerations

| Area | Risk | Mitigation |
| :--- | :--- | :--- |
| **Multi-Tenancy** | Data leakage across tenants. | Every query/mutation starts with `requireTenantRole` or `requireTenant`. All DB queries include `tenantId` filter. `assertTenantDoc` verifies doc belongs to tenant. |
| **Auth Roles** | Privilege escalation. | Strict checks: `deleteShift` requires `org:admin` (not coordinator). `listCaregiverShifts` requires `org:caregiver`. |
| **Time Zones** | Conflict detection errors. | Store all times as UTC numbers. Conflict logic compares numbers. UI handles display localization. |
| **Concurrency** | Double-booking during race condition. | Convex transactions provide atomicity. `checkShiftConflict` + `insert` in same mutation ensures consistency. |
| **PHI/PII** | Exposing client/caregiver names. | Only return `displayName`. Ensure `listShifts` does not return sensitive client addresses unless explicitly required (not in spec). |
| **Audit** | Missing audit trails. | Wrap all state-changing mutations with `auditEvent` calls. Ensure `tenantId` is logged. |
| **Availability** | Confusing advisory warnings. | Return `{ shift: ..., warning: boolean, message?: string }` from `createShift` so UI can inform user without blocking. |

## 6. Test Strategy
**Unit/Integration (Vitest):**
- **Mocking:** Use `convex-test` to mock `ctx` and DB state.
- **Focus:**
  1.  **Logic:** `checkShiftConflict` with various time intervals.
  2.  **Auth:** Verify `UnauthorizedError` thrown when roles mismatch or tenant IDs differ.
  3.  **State:** Verify audit logs are created alongside shifts.
- **Gates:** `npm run test` must pass.

**Type Safety:**
- `npm run typecheck` must pass (ensures schema alignment).

**Lint:**
- `npm run lint` (ESLint + Prettier) enforcing single quotes, no semis, 2-space.

**Excluded:**
- Playwright E2E skipped for this session (backend-only focus).

## 7. Rollback & Verification
**Rollback:**
- Git revert of commit containing `convex/scheduling/` changes.
- Run `npx convex codegen` to regenerate types if schema reverted.

**Verification Steps:**
1.  **Local Dev:** Run `npm run dev`.
2.  **Dashboard:** Check Convex Dashboard -> Functions to ensure all 15 endpoints are deployed.
3.  **Logs:** Check Convex Logs for any `UnauthorizedError` or schema mismatches during initial smoke test.
4.  **Codegen:** Confirm no type errors in frontend components that might consume these new functions (if any exist yet).

## 8. Implementation Sequence
1.  **Schema Check:** Verify `schema.ts` indexes. Add if missing. Codegen.
2.  **Helpers:** Implement `checkShiftConflict` in `helpers.ts`. Test logic.
3.  **Shifts:** Implement CRUD + List in `shifts.ts`.
4.  **Availability:** Implement CRUD + List in `availability.ts`.
5.  **Coverage:** Implement Request/Resolve in `coverage.ts`.
6.  **Tests:** Write `scheduling.test.ts` covering all 15 functions' critical paths.
7.  **Gate:** Run lint, typecheck, test.
8.  **Commit:** `feat: scheduling backend CRUD and conflict detection`.