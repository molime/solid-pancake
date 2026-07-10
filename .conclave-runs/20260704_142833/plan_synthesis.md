# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260704_142833\plan_synthesis.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 110.3s rc=0

• # Implementation Plan: ATRIA-X Phase 2 DB Schema + Guard Tests (Session 1)

  ## 1. Restated Goal & Acceptance Criteria

  **Goal:** Additively extend the Convex backend for Phase 2 HR/recruiting/scheduling support without breaking existing tenant isolation.

  **Acceptance Criteria:**
  - `convex/schema.ts` extends `tenantMembers.role` with `org:hr` and `org:candidate`.
  - `convex/schema.ts` declares all 10 requested Phase 2 tables: `candidates`, `applications`, `candidateTasks`, `hrCases`, `availabilityWindows`, `coverageRequests`, `formDefinitions`, `formSubmissions`, `documentArchiveItems`, `platformTrainingCompletions`.
  - `npx convex codegen` completes cleanly; no hand-edits in `convex/_generated/*`.
  - `convex/authHelpers.ts` recognizes the new roles in `TenantRole`, `normalizeTenantRole`, and `getClerkOrganizationRole` (including bare `hr`/`candidate` aliases).
  - Duplicate role validators in `convex/members.ts` and `convex/invitations.ts` are kept in sync with the schema union.
  - Minimal guarded stubs exist for the tables exercised by tests (`candidates`, `platformTrainingCompletions`), using `requireTenantRole`/`assertTenantDoc`.
  - Tests pass:
    - candidate insert is tenant-guarded via `assertTenantDoc`
    - cross-tenant candidate read is rejected
    - `platformTrainingCompletions` cannot be written for a user who is not a member of the acting tenant
    - `tenantMembers` with `org:hr` can be inserted and retrieved
  - Gates are green: `npm run lint`, `npm run typecheck`, `npm run test`.

  ## 2. Discovery Notes

  Repo inspection was performed on the working tree.

  | File | What was verified |
  |---|---|
  | `convex/schema.ts` | `tenantMembers.role` is a hand-written `v.union` of the three existing roles. All operational tables start with `tenantId` and use tenant-first indexes. No Phase 2 tables exist. |
  | `convex/authHelpers.ts` | `TenantRole` is the source-of-truth union. `requireTenantRole` accepts `TenantRole[]`; all call sites pass string-literal arrays, so expanding the type does not force edits at every call site. `normalizeTenantRole` is hardcoded and must be extended. `assertTenantDoc` compares `doc.tenantId` to the guard-derived `tenantId`. |
  | `convex/members.ts` | `sync` and `updateRole` duplicate the role union in their `v.union` validators. `list` is admin-only; `listCaregivers` filters by `org:caregiver`. |
  | `convex/invitations.ts` | `roleValidator` and `InviteRole` also mirror the three-role union. |
  | `convex/files.ts` | Imports `TenantRole` but uses non-exhaustive `if (role === 'org:caregiver')` checks; new roles safely fall through (treated like admin/coordinator). No change required. |
  | `convex/authHelpers.test.ts` / `convex/employeeProfiles.test.ts` | Established test pattern: `convexTest({ schema, modules })`, seed via `t.run(ctx => ctx.db.insert(...))`, impersonate with `t.withIdentity({ subject, org_id, org_role })`. |
  | `docs/03-database-structure.md` | Specifies exact fields/indexes for 8 of the 10 requested tables. `coverageRequests` and `platformTrainingCompletions` are not specified; minimal sensible schemas will be inferred from the scheduling/training context. |
  | `package.json` | Gates are `npm run lint`, `npm run typecheck`, `npm run test`. Codegen is `npx convex codegen`. |

  ## 3. Alternatives Considered

  | Alternative | Why Not Chosen |
  |---|---|
  | Move roles to a separate `roles` table | The app already maps Clerk org roles directly to `tenantMembers.role`. A separate table adds indirection and is out of scope for a schema-only session. |
  | Give candidate/HR access via custom permission records instead of Clerk roles | The docs model HR/RRHH as a distinct agency role. Keeping the union keeps Clerk and Convex in sync. |
  | Add full CRUD for all 10 tables now | Out of scope for Session 1; increases surface area and review time. |
  | One monolithic `phase2.ts` module for all stubs | Per-table modules match the existing `convex/*.ts` layout, reduce merge conflicts, and make future feature work easier. |
  | Create stubs for all 10 tables preemptively | The task explicitly says stubs “only where codegen/typecheck fail.” We will create only the stubs required by tests and add others only if typecheck reports missing exports. |

  ## 4. Exact Files to Create/Edit

  ### `convex/schema.ts`

  1. Extend `tenantMembers.role`:

  ```ts
  role: v.union(
    v.literal('org:admin'),
    v.literal('org:coordinator'),
    v.literal('org:caregiver'),
    v.literal('org:hr'),
    v.literal('org:candidate'),
  ),
  ```

  2. Append the 10 new table definitions (fields/indexes from `docs/03-database-structure.md`; inferred fields noted for the two unspecified tables):

  ```ts
  candidates: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    displayName: v.string(),
    status: v.string(),
    source: v.optional(v.string()),
    createdAt: v.string(),
  }).index('by_tenant_email', ['tenantId', 'email']),

  applications: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    status: v.string(),
    submittedAt: v.optional(v.string()),
    reviewedBy: v.optional(v.string()),
    decisionAt: v.optional(v.string()),
    hiredEmployeeProfileId: v.optional(v.id('employeeProfiles')),
  }).index('by_tenant_status', ['tenantId', 'status']),

  candidateTasks: defineTable({
    tenantId: v.id('tenants'),
    candidateId: v.id('candidates'),
    applicationId: v.optional(v.id('applications')),
    type: v.string(),
    status: v.string(),
    dueAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  }).index('by_tenant_candidate_status', ['tenantId', 'candidateId', 'status']),

  hrCases: defineTable({
    tenantId: v.id('tenants'),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    status: v.string(),
    ownerMemberId: v.optional(v.id('tenantMembers')),
    description: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
  })
    .index('by_tenant_status', ['tenantId', 'status'])
    .index('by_tenant_owner_status', ['tenantId', 'ownerMemberId', 'status']),

  availabilityWindows: defineTable({
    tenantId: v.id('tenants'),
    employeeProfileId: v.id('employeeProfiles'),
    weekday: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    effectiveStart: v.optional(v.string()),
    effectiveEnd: v.optional(v.string()),
    status: v.string(),
  }).index('by_tenant_employee', ['tenantId', 'employeeProfileId']),

  // Inferred from scheduling context; not detailed in docs
  coverageRequests: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    requesterId: v.string(),
    reason: v.optional(v.string()),
    status: v.string(),
    createdAt: v.string(),
    resolvedAt: v.optional(v.string()),
  })
    .index('by_tenant_shift', ['tenantId', 'shiftId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  formDefinitions: defineTable({
    tenantId: v.id('tenants'),
    key: v.string(),
    name: v.string(),
    version: v.number(),
    status: v.string(),
    fields: v.array(v.any()),
    createdBy: v.string(),
    createdAt: v.string(),
  }).index('by_tenant_key_version', ['tenantId', 'key', 'version']),

  formSubmissions: defineTable({
    tenantId: v.id('tenants'),
    formDefinitionId: v.id('formDefinitions'),
    subjectType: v.string(),
    subjectId: v.string(),
    submittedBy: v.string(),
    status: v.string(),
    answers: v.record(v.string(), v.any()),
    submittedAt: v.string(),
  }).index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId']),

  documentArchiveItems: defineTable({
    tenantId: v.id('tenants'),
    fileId: v.id('files'),
    subjectType: v.string(),
    subjectId: v.string(),
    category: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
    retentionUntil: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index('by_tenant_subject', ['tenantId', 'subjectType', 'subjectId'])
    .index('by_tenant_category_status', ['tenantId', 'category', 'status'])
    .index('by_tenant_expires_at', ['tenantId', 'expiresAt']),

  // Inferred from training-completion test requirement; not detailed in docs
  platformTrainingCompletions: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    trainingId: v.string(),
    completedAt: v.string(),
    status: v.string(),
    expiresAt: v.optional(v.string()),
  }).index('by_tenant_user', ['tenantId', 'clerkUserId']),
  ```

  ### `convex/authHelpers.ts`

  - Expand `TenantRole`:

  ```ts
  export type TenantRole =
    | 'org:admin'
    | 'org:coordinator'
    | 'org:caregiver'
    | 'org:hr'
    | 'org:candidate'
  ```

  - Extend `normalizeTenantRole` to accept the new full names and their bare equivalents:

  ```ts
  if (
    role === 'org:admin' ||
    role === 'org:coordinator' ||
    role === 'org:caregiver' ||
    role === 'org:hr' ||
    role === 'org:candidate'
  ) {
    return role
  }

  if (role === 'admin') return 'org:admin'
  if (role === 'coordinator') return 'org:coordinator'
  if (role === 'caregiver') return 'org:caregiver'
  if (role === 'hr') return 'org:hr'
  if (role === 'candidate') return 'org:candidate'
  ```

  - No existing `requireTenantRole` call sites need editing — they all pass literal string arrays and will continue to type-check after the type expansion.

  ### `convex/members.ts` and `convex/invitations.ts`

  - In `members.ts`, add `v.literal('org:hr')` and `v.literal('org:candidate')` to the `role` validators in `sync` and `updateRole`.
  - In `invitations.ts`, extend `roleValidator` and `InviteRole` to include the two new roles so invitations can create HR/candidate members.
  - Note: `members.sync` only auto-creates an employee profile when the resolved role is `org:caregiver`; the new roles should not trigger that path.

  ### Generated code

  Run:

  ```bash
  npx convex codegen
  ```

  Verify that `_generated/dataModel.d.ts` contains the new tables and that `_generated/api.d.ts` will expose any new module files.

  ### Stub modules (create only as needed for tests/typecheck)

  Create lightweight, guarded stubs for the tables exercised by the required tests. Add additional stubs only if `npm run typecheck` reports missing exports.

  Example shape for `convex/candidates.ts`:

  - `get` query — `requireTenantRole(ctx, clerkOrgId, ['org:admin', 'org:hr', 'org:coordinator'])`, fetch candidate by ID, throw if missing, call `assertTenantDoc(candidate, tenantId)`.
  - `create` mutation — guard as above, insert with `tenantId` derived from the guard.
  - `update` mutation — guard, fetch candidate, `assertTenantDoc`, patch.

  Example shape for `convex/platformTrainingCompletions.ts`:

  - `create` mutation — guard as admin/HR/coordinator, verify the target `clerkUserId` exists in `tenantMembers` for this tenant, then insert.

  ### Test files

  1. **`convex/authHelpers.test.ts`** — add cases:
     - `getClerkOrganizationRole({ org_role: 'org:hr' })` → `'org:hr'`
     - `getClerkOrganizationRole({ org_role: 'hr' })` → `'org:hr'`
     - same for `candidate`
     - `assertTenantDoc` accepts/rejects a candidate-shaped doc across tenants

  2. **`convex/phase2Guards.test.ts`** (new) — using the established `convexTest` + `withIdentity` pattern:
     - **Candidate tenant guard via `assertTenantDoc`:** create a candidate in tenant A, then as an admin of tenant A call `candidates.update` (internally uses `assertTenantDoc`) — succeeds. As an admin of tenant B call the same `candidates.update` with the same candidate ID — throws “cross-tenant access denied”.
     - **Cross-tenant candidate read rejected:** create a candidate in tenant A, then as admin of tenant B call `candidates.get` — throws.
     - **Platform training completion rejects foreign-tenant user:** create user `u1` as a member of tenant A only. As admin of tenant A, create a completion for `u1` — succeeds. Create tenant B with admin but no `u1` member; as admin of tenant B, attempt a completion for `u1` — rejected because `tenantMembers` lookup returns null.
     - **`org:hr` member insert/retrieve:** directly insert a `tenantMembers` row with `role: 'org:hr'` into a tenant, then as `org:admin` call `members.list` and assert the HR member is returned.

  ## 5. Data / Auth / Security / Multi-Tenant / PHI / Idempotency Edge Cases

  - **Tenant isolation:** every new table includes `tenantId` as its first field, and every index starts with `tenantId`. No query or mutation derives `tenantId` from user-supplied data; it always comes from `requireTenantRole`.
  - **Role mapping:** `getClerkOrganizationRole` must recognize `org:hr`/`org:candidate` (and bare aliases) so `members.sync` does not silently downgrade those users to caregivers.
  - **Candidate PII:** `candidates` stores email and optional phone. These are isolated by tenant and must never be returned without `assertTenantDoc`.
  - **Cross-tenant user writes:** `platformTrainingCompletions.create` must verify the target `clerkUserId` has a `tenantMembers` record in the acting tenant; otherwise a malicious admin of tenant B could write training records for tenant A’s users.
  - **HR cases:** contain sensitive follow-up notes. All access goes through tenant role guards; only admin/HR/coordinator stubs are exposed.
  - **Document archive:** `expiresAt`/`retentionUntil` are optional; future cleanup logic must scope by tenant before acting on them.
  - **Idempotency:** not enforced at the schema level. Future mutations that insert training completions, applications, or HR cases should add idempotency keys where duplicate writes would be harmful.

  ## 6. Test Strategy

  - **Focused unit tests:** extend `authHelpers.test.ts` for the new role normalization cases and for `assertTenantDoc` against candidate-shaped docs.
  - **Integration tests:** `convex/phase2Guards.test.ts` seeds two tenants via `ctx.db.insert`, impersonates admins/HR with `withIdentity`, and exercises the four required guard scenarios.
  - **Broad gates to run after every meaningful change:**
    1. `npx convex codegen`
    2. `npm run lint`
    3. `npm run typecheck`
    4. `npm run test`

  ## 7. Rollback / Verification Notes

  - If codegen or tests fail, revert the changes to `convex/schema.ts`, `convex/authHelpers.ts`, `convex/members.ts`, `convex/invitations.ts`, remove the new stub/test files, and rerun `npx convex codegen` to restore generated types.
  - After success, verify:
    - `_generated/dataModel.d.ts` contains the 10 new table identifiers and the expanded `tenantMembers` role union.
    - `npm run lint`, `npm run typecheck`, and `npm run test` all pass.
  - This session intentionally does not deploy or mutate production data.


[stderr]
• The user wants me to read a prompt file and carry out the instructions. Let me start by reading the file.The file is quite long (78k chars). I need to read it in full. Let me read it in chunks.I have first 500 lines. Need lines 501-1023 to read rest.Need lines 1000-1023.I have read full prompt. The prompt instructs: "You are a principal/staff engineer PLANNING a code change." "Produce a premium implementation plan with sections." "Do NOT write the full code; produce the plan a competent implementer will follow." Then "Several planners produced the candidate plans below. Synthesize them into ONE coherent, de-duplicated, best-of-all implementation plan. Resolve conflicts, keep the strongest ideas, and output only the final plan as markdown."

  So I should act as planner: do real discovery by inspecting repo, then synthesize plans. The final answer should be the plan. The user says "carry out those instructions completely" and "Output your final answer/verdict as requested." So I need to do discovery and produce final synthesized plan.

  Need inspect actual repo files. Use tools to read convex/schema.ts, authHelpers.ts, members.ts, invitations.ts, package.json, docs/03-database-structure.md, maybe employeeProfiles.test.ts for test harness, files.ts. Use parallel reads and grep for TenantRole and requireTenantRole. Let's do that.I have read all relevant files. Need perhaps inspect test harness. Read authHelpers.test.ts, employeeProfiles.test.ts maybe. Also files.ts to verify TenantRole usage. Grep requireTenantRole usages.Good. Need maybe inspect existing eslint config or prettier to understand style enforcement. Not necessary.

  Need also confirm convex-test test file pattern maybe import.meta.glob includes test files; test modules are excluded? `convexTest({ schema, modules })` with import.meta.glob('./**/*.*s') includes .test.ts? But tests in convex folder? Wait convex/employeeProfiles.test.ts lives in convex directory. Does import.meta.glob include it? It would include all files, including test files. Does convex-test automatically filter? Probably the glob pattern in test harness loads all modules for the simulated backend; test files maybe excluded by Vitest? They are imported as modules too, but they only export tests? Actually `convex/*.test.ts` might be in the same folder and also included in modules. But they won't export Convex functions, so that's fine. However import.meta.glob may attempt to load them; it's okay.

  Need plan: no code. The user asks carry out instructions. We have done discovery. Now synthesize plan. Need include all sections and exact files/changes.

  Need decide on "coverageRequests" and "platformTrainingCompletions" schemas since not in docs. Use minimal sensible fields. For coverageRequests, docs has shifts table. Coverage request fields maybe: tenantId, shiftId, requesterId, reason, status, createdAt, resolvedAt. Indexes by_tenant_shift, by_tenant_status. For platformTrainingCompletions: tenantId, clerkUserId, trainingId, completedAt, status, expiresAt. Index by_tenant_user. Could include score? Not needed. Keep minimal.

  Need decide whether to use `clerkUserId` or `userId`. To test "different tenant's user", using `clerkUserId` matches tenantMembers. Good.

  Need decide whether to add unique index for platformTrainingCompletions. Not required by prompt; avoid inventing. Use regular index by_tenant_user.

  Need decide whether to use enums for status. Docs doesn't specify exact values. Using v.string keeps additive and avoids premature constraints. But maybe the linter or existing style uses unions for statuses. The prompt says "exact schemas/indexes specified"; statuses are strings in docs, not enum. So v.string is appropriate. For coverageRequests, status string.

  Need decide candidate `status` default maybe 'new' in mutation stub.

  Need decide table order: append after platformAdmins or before? `defineSchema` can have tables in any order. We'll append after platformAdmins.

  Need mention `files.ts` won't be changed because it uses non-exhaustive role checks. However new roles will be treated like admin/coordinator for file visibility (since only caregiver has special restrictions). That's acceptable for schema session.

  Need mention `members.ts` and `invitations.ts` duplicate role union; expand them to avoid type mismatch and keep invite/sync consistent. The task phrase "update every requireTenantRole call referencing this union" might not strictly include these, but the plan should note that these validators mirror the union and will be kept in sync; otherwise `updateRole`/`sync`/`create invitation` would silently reject org:hr/org:candidate inputs.

  Need mention that no existing `requireTenantRole` call sites need changes because they pass string-literal arrays. Type expansion doesn't force edits. However if we decide some call sites should allow HR/candidate in business logic, we can note: do NOT broaden existing guards unless explicitly required; Phase 2 features will add their own stubs with appropriate allowed roles.

  Need mention stub modules: create `convex/candidates.ts` and `convex/platformTrainingCompletions.ts` for tests; optionally create stubs for remaining 8 tables to keep API uniform and satisfy codegen? Codegen doesn't need modules. The prompt says "add stub query/mutation skeletons only where codegen/typecheck fail, each using authHelpers guards". Since typecheck won't fail without modules, but tests require candidate and platformTraining functions. We can say: add minimal stubs for the two tables exercised by tests; run codegen/typecheck, and if any other missing module errors surface, add the smallest stubs needed. However, the task says "write convex/*.test.ts covering ..." not necessarily require module files. But tests need to call API. So create stubs for all 10? The strongest plan might be: create lightweight per-table modules for all 10 new tables so the generated API surface is uniform and future sessions can build on them; each is minimal and guarded. This aligns with candidate plan c_plan_agentic. It does slightly exceed "only where codegen/typecheck fail" but is safe and small. The prompt might penalize adding unnecessary stubs. But tests only need candidates and platformTraining; the rest would be dead code. However adding all 10 stubs is not much. Which is better? The task: "add stub query/mutation skeletons only where codegen/typecheck fail, each using convex/authHelpers.ts guards". That explicitly says only where fail. So we should follow: after schema changes and codegen, run typecheck; add stubs only for errors. Since new tables not referenced by existing code, no typecheck errors expected. Then for tests, we need candidate and platformTraining stubs. So we create those because tests need them. We can phrase: create stubs for `candidates` and `platformTrainingCompletions` to support the required tests; create additional stubs only if `npm run typecheck` reports missing exports. This respects instruction.

  But to make generated API uniform, we might still create all 10. However "only where codegen/typecheck fail" is clear. I think best: create stubs for all tables that have tests or typecheck failures. Since only candidates and platformTraining are tested, create those two. But the prompt also says "write convex/*.test.ts covering candidates insert ... cross-tenant candidate read ... platformTrainingCompletions cannot be written... tenantMembers with org:hr". The org:hr test can use existing members.list, no new stub. So only two new modules.

  Wait candidates test needs both insert and get; platformTraining test needs create. So create `convex/candidates.ts` with get, create, update; `convex/platformTrainingCompletions.ts` with create. Good.

  But cross-tenant candidate read test uses `candidates.get`. It needs query. Insert test uses `candidates.create` mutation. Tenant-guarded insert via assertTenantDoc test maybe uses `candidates.update` (reads candidate and asserts). Or we can directly test assertTenantDoc with a candidate doc (unit test in authHelpers.test.ts) as the prompt says "candidates insert tenant-guarded via assertTenantDoc". Hmm that wording is weird: insert guarded via assertTenantDoc? In insert there's no existing doc. Maybe they want a mutation that after insert returns the doc and calls assertTenantDoc? Or maybe they meant "candidates insert is tenant-guarded and assertTenantDoc works on candidate docs." We can design test: create candidate via `candidates.create`, then in same tenant call `candidates.update` to change status; this mutation fetches the candidate and calls `assertTenantDoc`. Cross-tenant: admin from tenant B calls `candidates.update` on candidate from tenant A; `assertTenantDoc` throws. That covers "insert tenant-guarded via assertTenantDoc" maybe not exactly but acceptable. Alternatively, the test could directly call `assertTenantDoc` on a candidate doc from tenant A with tenant A id passes, and with tenant B id throws. That is simpler and explicitly covers assertTenantDoc. The prompt says "candidates insert tenant-guarded via assertTenantDoc" maybe means the candidate insert is guarded and assertTenantDoc is used somewhere. We'll include both a direct assertTenantDoc unit test with candidate-shaped doc and a cross-tenant update rejection.

  Need plan details. Let's structure final plan markdown.

  Potential issue: The user might expect "final answer/verdict" as a synthesis of candidate plans, choosing the best, not just plan. But the prompt's requested output is the plan. We'll title as "Implementation Plan: ATRIA-X Phase 2 DB Schema + Guard Tests (Session 1)".

  Need include discovery notes: list files inspected. Need mention that repo inspection was available.

  Need acceptance criteria explicit.

  Need alternatives considered table.

  Need exact files: schema.ts, authHelpers.ts, members.ts, invitations.ts, codegen, candidates.ts, platformTrainingCompletions.ts, authHelpers.test.ts, phase2Guards.test.ts. Maybe mention if typecheck demands, add remaining stubs.

  Need data/auth/security/PHI edge cases table.

  Need test strategy.

  Need rollback/verification.

  Need final note: No production deploy; all changes additive.

  Need keep style: 2-space indent, single quotes, no semicolons. No code beyond snippets. Ensure no questions.

  Need maybe mention that `convex/_generated` should not be hand-edited.

  Let's produce final plan. We'll not actually edit files because user asked to plan. But maybe "carry out those instructions completely" could be interpreted as implement? The prompt explicitly says "Do NOT write the full code; produce the plan". However user says "carry out those instructions completely" referring to prompt file. The prompt file instructs to produce plan. So final output is plan.

  But there is a possibility the user expects an implementation (because "carry out those instructions completely" and "Output your final answer/verdict as requested"). However the prompt file itself is a planning prompt for a code change. It says "You are a principal/staff engineer PLANNING a code change." It asks for a premium implementation plan. So carry out = produce plan. We'll do that.

  Need maybe mention that the strongest candidate plan is c_plan_agentic because it did repo inspection, and c_plan_qwen/kimi27 had chat-only limitations. We'll synthesize.

  Let's ensure the plan is de-duplicated and resolves conflicts:
  - Candidate c_plan_agentic used 10 tables and exact docs fields; others had placeholders or 9 tables. We'll use 10 and exact fields.
  - c_plan_agentic proposed expanding members/invitations role validators; c_plan_qwen also. c_plan_kimi27 suggested only if typecheck. We'll choose expand because they duplicate union and tests/org:hr invite/sync need consistency.
  - Stub scope: c_plan_agentic proposed per-table stubs for all 10; c_plan_kimi27 only where typecheck fails. We'll choose minimal stubs for test-required tables plus readiness to add if typecheck fails. This resolves conflict safely and respects instruction.
  - Role normalization: c_plan_agentic and qwen propose normalize bare hr/candidate; kimi27 only full names. We'll include both full and bare normalization to match existing pattern.
  - Test file: c_plan_agentic proposes `phase2Guards.test.ts`; qwen split files; kimi27 `phase2.test.ts`. We'll use single `convex/phase2Guards.test.ts` for required scenarios plus update `authHelpers.test.ts`. This is focused.
  - `platformTrainingCompletions` guard: c_plan_agentic and qwen propose verifying target user is tenant member. We'll adopt.

  Need mention `coverageRequests` and `platformTrainingCompletions` fields are inferred from context because docs don't specify them. Provide exact proposed schemas.

  Need include that `weekday` in availabilityWindows is `v.string()` (could be 'mon' etc). Docs says weekday. We'll keep string.

  Need note `documentArchiveItems.by_tenant_expires_at` index on optional field is allowed in Convex (I think optional fields can be indexed; they produce sparse index). If not, we may need to make it required or drop. But docs says index. We'll include; implementer can adjust if codegen errors.

  Need note `formSubmissions.answers` uses `v.record(v.string(), v.any())`.

  Need ensure table fields match docs exactly. Let's double-check docs fields:
  - candidates: tenantId, clerkUserId?, email, phone, displayName, status, source, createdAt. Index by_tenant_email.
  - applications: tenantId, candidateId, status, submittedAt, reviewedBy, decisionAt, hiredEmployeeProfileId?. Index by_tenant_status.
  - candidateTasks: tenantId, candidateId, applicationId, type, status, dueAt, completedAt. Index by_tenant_candidate_status.
  - hrCases: tenantId, subjectType, subjectId, category, status, ownerMemberId, description, resolvedAt. Indexes by_tenant_status, by_tenant_owner_status.
  - availabilityWindows: tenantId, employeeProfileId, weekday, startTime, endTime, effectiveStart, effectiveEnd, status. Index by_tenant_employee.
  - formDefinitions: tenantId, key, name, version, status, fields, createdBy, createdAt. Index by_tenant_key_version.
  - formSubmissions: tenantId, formDefinitionId, subjectType, subjectId, submittedBy, status, answers, submittedAt. Index by_tenant_subject.
  - documentArchiveItems: tenantId, fileId, subjectType, subjectId, category, status, expiresAt, retentionUntil, source. Indexes by_tenant_subject, by_tenant_category_status, by_tenant_expires_at.

  Good.

  Need decide if `applications` should have `candidateId` optional or required. Docs says candidateId key field, so required. Hired employee profile optional.

  Need decide `candidateTasks.applicationId` optional? Docs says applicationId. Candidate tasks may exist before application? It lists applicationId as key field, but could be optional. We'll make optional to allow tasks independent of application.

  Need decide `hrCases.ownerMemberId` optional. Docs says ownerMemberId key field; but case may be unassigned initially. We'll make optional.

  Need decide `availabilityWindows.status` string. Good.

  Now final plan. Keep length reasonable. Use markdown headings. Include code snippets for schema additions and stub examples. Since prompt says don't write full code, snippets are okay.

  Let's write final answer.

To resume this session: kimi -r session_6008e46e-99af-4b76-9541-54440c759676
