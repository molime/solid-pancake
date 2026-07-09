# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The diff adds the missing schema fields, indexes, and audit‑event support required by the Session 2 scheduling backend, and updates the generated API to expose the new `scheduling` module.  

**Key compliance points**
- **Audit** – `auditEvents` now includes an optional `kind` field and `audit.record` stores it, satisfying the “kind='…'” requirement while preserving existing callers.
- **Availability windows** – the table is rewritten to match the task API (`caregiverId`, `kind`, `dayOfWeek?`, `date?`, `startTime`, `endTime`, `available`, `note?`) with appropriate indexes.
- **Coverage requests** – schema now requires `reason`, uses a union for `status`, and adds `reassignedTo` and `resolvedBy` fields needed for coverage resolution.
- **Shift indexing** – a new `by_tenant_caregiver_status_start` index enables efficient pagination/filtering for `listShifts`.
- **Generated API** – `convex/_generated/api.d.ts` now exports the `scheduling` namespace, making all new Convex functions reachable.
- **Tests** – `convex/scheduling.test.ts` already exists and passes, confirming that the required mutations/queries, conflict detection, role guards, and advisory availability logic are correctly implemented.

All required functions, guards, conflict detection, advisory warnings, audit logging, and pagination behavior are now supported, and the code passes lint, type‑checking, and the full test suite.

**Verdict:**  

VERDICT: APPROVED