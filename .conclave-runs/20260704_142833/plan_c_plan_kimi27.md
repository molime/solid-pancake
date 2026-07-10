# http://localhost:11434/api/chat
# model=kimi-k2.7-code:cloud status=200

# Implementation Plan: ATRIA-X Phase 2 Schema + Guards + Tests

## 1. Restated Goal & Acceptance Criteria

**Goal:** Additively extend the Convex backend for Phase 2 HR/candidate/coverage features while preserving strict multi-tenant isolation.

**Acceptance criteria:**
- `convex/schema.ts` role union on `tenantMembers.role` includes `org:hr` and `org:candidate`.
- All `requireTenantRole` call sites that reference the role union compile with the new literals.
- Nine new tables (`candidates`, `applications`, `candidateTasks`, `hrCases`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`, `platformTrainingCompletions`) are declared with tenant-scoped indexes.
- `npx convex codegen` runs cleanly and `convex/_generated/*` is never hand-edited.
- Minimal stub queries/mutations exist wherever codegen/typecheck fails, each routed through `convex/authHelpers.ts` guards.
- `convex/*.test.ts` covers:
  - candidates insert is tenant-guarded via `assertTenantDoc`
  - cross-tenant candidate read is rejected
  - `platformTrainingCompletions` cannot be written for a different tenant’s user
  - `tenantMembers` with `org:hr` can be inserted and retrieved
- Gates pass: `npm run lint`, `npm run typecheck`, `npm run test`.
- Code style: 2-space indent, single quotes, no semicolons.

## 2. Discovery Notes

> **Repo inspection was unavailable in this chat session.** I am reasoning from the supplied context only.

From the context I am treating as verified assumptions:
- The repo lives at `~/Documents/Work/conclave`? No — the **ATRIA-X** repo is the current working tree; Conclave is a separate orchestration project.
- Convex schema is declared in `convex/schema.ts`.
- `convex/authHelpers.ts` exports tenant/role guards such as `requireTenantRole`, `requireTenantMember`, and `assertTenantDoc`.
- `convex/_generated/*` is produced by `npx convex codegen`.
- Tests use Vitest and likely `convex-test` against the schema.
- Multi-tenancy rule: every function touching tenant data must go through `authHelpers` guards.

**Open assumptions the implementer must verify locally:**
- Exact names/signatures of `authHelpers` helpers (e.g., does `requireTenantRole` take `ctx` plus an array of allowed roles?).
- Whether `tenantId` is typed as `v.id('tenants')` or `v.string()` in existing tables.
- Whether Clerk user IDs are stored as `v.string()` or `v.id('users')`.
- The **exact field-level schemas/indexes** referenced in the task are not present in the supplied context; the canonical shapes below must be reconciled with the product spec/PRD before coding.

## 3. Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Split schema into multiple files (`convex/schema/candidates.ts`, etc.) | Convex expects a single `defineSchema` export in `convex/schema.ts`. Splitting would require re-exports and increases churn for a purely additive change. |
| Create a separate `roles` table instead of extending the union | Violates the explicit task instruction and would force a migration of existing `tenantMembers` rows. |
| Add full CRUD for every new table now | Out of scope. The task asks for stub skeletons only where codegen/typecheck/test failures demand them. |
| Hand-edit generated files to “fix” types | Explicitly forbidden; codegen must be the source of truth. |

**Chosen approach:** additive edits to `convex/schema.ts`, update `authHelpers` role types if hardcoded, run codegen, let typecheck failures drive stub creation, then add focused guard tests.

## 4. Exact Files to Create/Edit

### 4.1 `convex/schema.ts` — additive schema changes

**A. Extend `tenantMembers.role` union**
Add `org:hr` and `org:candidate` literals to the existing union.

**B. Add Phase 2 tables with tenant-first indexes**

> ⚠️ The field lists below are **canonical placeholders** derived from the table names. Replace with the exact product-spec fields before implementation. Keep every table indexed on `tenantId` (and usually `tenantId` + the lookup field).

| Table | Key fields (example) | Indexes (example) |
|---|---|---|
| `candidates` | `tenantId`, `firstName`, `lastName`, `email`, `phone`, `status`, `assignedHrUserId`, `createdByUserId`, `createdAt` | `by_tenant`, `by_tenant_email`, `by_tenant_status` |
| `applications` | `tenantId`, `candidateId`, `positionId`, `status`, `appliedAt`, `notes` | `by_tenant`, `by_tenant_candidate`, `by_tenant_status` |
| `candidateTasks` | `tenantId`, `candidateId`, `assignedToUserId`, `title`, `status`, `dueAt` | `by_tenant`, `by_tenant_candidate`, `by_tenant_assignee` |
| `hrCases` | `tenantId`, `candidateId`, `employeeUserId`, `caseType`, `status`, `priority`, `assignedToUserId`, `openedAt` | `by_tenant`, `by_tenant_candidate`, `by_tenant_employee`, `by_tenant_status` |
| `availabilityWindows` | `tenantId`, `userId`, `dayOfWeek`, `startTime`, `endTime`, `effectiveFrom`, `effectiveTo`, `isRecurring` | `by_tenant_user`, `by_tenant_user_day` |
| `coverageRequests` | `tenantId`, `shiftId`, `requesterUserId`, `requestedRole`, `startTime`, `endTime`, `status`, `filledByUserId` | `by_tenant`, `by_tenant_status`, `by_tenant_requester` |
| `formDefinitions` | `tenantId`, `name`, `version`, `category`, `schema`, `isActive`, `createdByUserId` | `by_tenant`, `by_tenant_name_version`, `by_tenant_category` |
| `formSubmissions` | `tenantId`, `formDefinitionId`, `candidateId`, `userId`, `answers`, `submittedByUserId`, `submittedAt` | `by_tenant`, `by_tenant_form`, `by_tenant_candidate`, `by_tenant_user` |
| `documentArchiveItems` | `tenantId`, `entityType`, `entityId`, `fileName`, `storageId`, `uploadedByUserId`, `uploadedAt`, `metadata` | `by_tenant`, `by_tenant_entity` |
| `platformTrainingCompletions` | `tenantId`, `userId`, `trainingId`, `completedAt`, `score`, `certificateUrl`, `verifiedByUserId` | `by_tenant`, `by_tenant_user`, `by_tenant_training`, **unique** `by_tenant_user_training` |

**Idempotency note:** `platformTrainingCompletions` should declare a unique index on `['tenantId', 'userId', 'trainingId']` so the same user cannot record the same training twice.

### 4.2 `convex/authHelpers.ts` — role type alignment

- If `Role` is hardcoded as a TypeScript union, add `'org:hr'` and `'org:candidate'`.
- If `Role` is inferred from `schema.ts` via the generated data model, no manual change is needed, but verify the inferred type includes the new literals.
- Search the entire `convex/` tree for `requireTenantRole(` calls. Update any explicit role arrays or switch statements that enumerate allowed roles to include the new literals if the business logic should permit them.

### 4.3 Stub query/mutation files — create only if codegen/typecheck fails

Likely needed stubs (all using `authHelpers` guards):

- `convex/candidates.ts`
  - `get` query: load candidate, call `assertTenantDoc`.
  - `create` mutation: require tenant membership (and optionally `org:hr`/`org:admin`), insert with `tenantId` from the member.
- `convex/platformTraining.ts`
  - `list` query: list completions for the user’s tenant.
  - `recordCompletion` mutation: require tenant member, verify `userId` belongs to the same tenant, insert completion.
- `convex/tenantMembers.ts` (or reuse existing file)
  - `insertHrMember` mutation / `getMember` query if not already present, gated by `org:admin` or `org:hr`.

**Rule:** Do not add stubs preemptively. Run `npx convex codegen && npm run typecheck` first; add stubs only for reported missing exports or type errors. Every stub must call an `authHelpers` guard before touching `ctx.db`.

### 4.4 Test file

Create `convex/phase2.test.ts` (or equivalent `convex/*.test.ts`) covering the four required scenarios.

## 5. Data / Auth / Security / PHI / Idempotency Edge Cases

| Area | Handling |
|---|---|
| **Multi-tenant isolation** | Every new table has `tenantId`. Every query/mutation uses `authHelpers` guards. Every document read must pass `assertTenantDoc` or be filtered by `tenantId`. |
| **Cross-tenant candidate read** | `get` query returns `null` or throws if the candidate’s `tenantId` does not match the caller’s active tenant. |
| **Training completion tenant mismatch** | `recordCompletion` rejects when the target `userId` is not a `tenantMembers` row for the caller’s tenant. |
| **Role escalation** | Only `org:admin` and `org:hr` create candidates/HR cases unless the spec says otherwise. `org:candidate` is a read-only/low-privilege role. |
| **PHI / PII** | Candidate names, emails, phone numbers, HR cases, and documents are sensitive. Do not log full objects. Return only necessary fields in queries. |
| **Document archive** | `storageId` must be stored, but downloads should be gated by tenant membership and role. |
| **Idempotency** | `platformTrainingCompletions` unique index on `tenantId + userId + trainingId` prevents duplicate records. |
| **Availability windows** | Validate `startTime < endTime`; optionally guard against overlapping recurring windows in a future iteration. |
| **Coverage requests** | `filledByUserId`, if provided, must belong to the same tenant and an allowed role. |

## 6. Test Strategy

Use Vitest + `convex-test`. Seed each test with:
1. A tenant.
2. An authenticated user + `tenantMembers` row.
3. A second tenant + user for cross-tenant negative cases.

**Required test cases:**

1. **Candidates insert is tenant-guarded**
   - Call `candidates.create` as `org:hr` member of tenant A.
   - Assert inserted document has `tenantId === A`.
   - Assert `assertTenantDoc` would allow the member to read it back.

2. **Cross-tenant candidate read is rejected**
   - Create candidate in tenant A.
   - As a member of tenant B, call `candidates.get`.
   - Assert rejection / `null` / unauthorized error (match repo convention).

3. **Platform training completions reject different-tenant users**
   - As tenant A member, attempt to record a completion for a user who only exists in tenant B.
   - Assert mutation rejects before writing.

4. **Tenant members with `org:hr` can be inserted and retrieved**
   - Insert a `tenantMembers` row with role `org:hr`.
   - Query it back and assert role equals `org:hr`.

**Broad gates to run after every edit:**
```bash
npx convex codegen
npm run lint
npm run typecheck
npm run test
```

**Cost/infra note:** Per shared context, prefer running codegen/tests under `conclave.local.yaml` (free CPU) or `conclave.cloud.yaml` (GPU) rather than the OpenRouter-backed `conclave.yaml`, keeping the session scoped and billing-free.

## 7. Rollback / Verification Notes

**Rollback:**
- Revert `convex/schema.ts` and `convex/authHelpers.ts`.
- Delete any newly created stub/test files.
- Run `npx convex codegen` to regenerate `convex/_generated/*`.
- Confirm `npm run typecheck` and `npm run test` pass on the reverted state.

**Verification checklist before marking done:**
- [ ] `convex/_generated/dataModel.ts` includes all ten new tables.
- [ ] `tenantMembers.role` type includes `'org:hr'` and `'org:candidate'`.
- [ ] No hand-edits in `convex/_generated`.
- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean.
- [ ] `npm run test` clean, including the four new guard cases.
- [ ] No cross-tenant leakage in any new stub (every function calls an `authHelpers` guard).