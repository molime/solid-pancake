# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: ATRIA-X Phase 2 DB Schema & Guard Tests (Session 1)

## 1. Goal & Acceptance Criteria
**Goal:** Extend the Convex backend schema to support Phase 2 HR/Recruiting features while enforcing strict multi-tenant isolation via `authHelpers`. Establish the foundational data structures and security guards without implementing full business logic yet.

**Acceptance Criteria:**
1.  `convex/schema.ts` updated with 9 new tables and expanded `tenantMembers.role` union.
2.  `npx convex codegen` runs successfully with no errors.
3.  `convex/authHelpers.ts` updated to recognize new roles (`org:hr`, `org:candidate`).
4.  Stub queries/mutations exist for new tables where typechecks demand them, all wrapped in tenant guards.
5.  Test suite (`convex/*.test.ts`) passes covering:
    *   Tenant-guarded insert (candidates).
    *   Cross-tenant read rejection.
    *   `platformTrainingCompletions` tenant/user isolation.
    *   `tenantMembers` role expansion (org:hr insert/retrieve).
6.  Gates pass: `npm run lint`, `npm run typecheck`, `npm run test`.
7.  Code style: 2-space indent, single quotes, no semicolons.

## 2. Discovery Notes
**Limitation:** I am a chat-only agent and **cannot inspect the local repository files** (`convex/schema.ts`, `convex/authHelpers.ts`, etc.). I cannot verify existing field names, index structures, or the exact implementation of `authHelpers`.

**Assumptions & Inferences:**
*   **Schema Structure:** Based on standard Convex multi-tenant patterns, existing tables likely include a `tenantId` field indexed for isolation. New tables must follow this pattern.
*   **Auth Helpers:** `authHelpers.ts` likely exports `requireTenantRole` and `assertTenantDoc`. These must be updated to accept the new role strings.
*   **Phase 2 Spec:** The prompt mentions "exact schemas/indexes specified" but does not provide the field-level definitions in this context. The implementer must refer to the external Phase 2 Design Spec for field types (e.g., `phoneNumber`, `status enums`). I will plan for the *structural* integration (tenantId, indexes) based on the table names provided.
*   **Testing Harness:** Assuming `convex-test` or similar Vitest integration is already configured based on the `npm run test` gate.

## 3. Alternatives Considered
*   **Option A: Full Logic Implementation.** Implement full CRUD for all new tables now.
    *   *Reject:* Out of scope for Session 1. Increases surface area for bugs and review time. Violates "surgical and scope-controlled" constraint.
*   **Option B: Schema Only, No Tests.** Update schema and run codegen, defer tests to Session 2.
    *   *Reject:* High risk. Multi-tenant guards are critical security boundaries. Verifying them now prevents regression later.
*   **Option C: Chosen Plan (Schema + Guards + Guard Tests).** Update schema, update auth types, create minimal stubs to satisfy types, write tests specifically for the security boundaries.
    *   *Rationale:* Safest path. Validates the security model immediately. Keeps code change minimal (stubs only). Aligns with Diego's cost-conscious preference (less compute time on unnecessary logic execution during dev).

## 4. Exact Files & Behavioral Changes

### A. `convex/schema.ts`
*   **Edit:** Locate `tenantMembers` table definition.
*   **Change:** Extend the `role` validator union.
    *   *From:* `'org:admin' | 'org:coordinator' | 'org:caregiver'`
    *   *To:* `'org:admin' | 'org:coordinator' | 'org:caregiver' | 'org:hr' | 'org:candidate'`
*   **Add:** Define the following tables using `defineTable`. Ensure every table includes `tenantId` (indexed) unless explicitly global (none listed appear global).
    1.  `candidates`
    2.  `applications`
    3.  `candidateTasks`
    4.  `hrCases`
    5.  `availabilityWindows`
    6.  `coverageRequests`
    7.  `formDefinitions`
    8.  `formSubmissions`
    9.  `documentArchiveItems`
    10. `platformTrainingCompletions`
*   **Indexes:** Add indexes on `tenantId` for all tenant-scoped tables. Add compound indexes where query patterns are known (e.g., `candidates` by `status` + `tenantId`).

### B. `convex/authHelpers.ts`
*   **Edit:** Update TypeScript types/interfaces associated with `Role` or `TenantRole` to include `'org:hr'` and `'org:candidate'`.
*   **Edit:** Ensure `requireTenantRole` function logic allows these new roles without throwing prematurely (if it uses a whitelist).
*   **Verify:** `assertTenantDoc` helper must correctly compare `doc.tenantId` against `auth.tenantId`.

### C. New Stub Files (Create only if typecheck fails)
*   **Files:** `convex/candidates.ts`, `convex/applications.ts`, ... (one per new table if needed).
*   **Content:** Export minimal `query` or `mutation` functions required to satisfy imports elsewhere or to enable testing.
*   **Security:** Every function must start with `const auth = await authHelpers.getAuth(ctx);` and use `authHelpers.requireTenantRole(auth, ['org:admin', 'org:hr', ...])` or `authHelpers.assertTenantDoc(auth, doc)` before returning/writing.
*   **Style:** Enforce 2-space indent, single quotes, no semicolons.

### D. Test Files (`convex/*.test.ts`)
*   **Create:** `convex/candidates.test.ts`, `convex/tenantMembers.test.ts`, `convex/platformTrainingCompletions.test.ts`.
*   **Scenarios:**
    1.  **Candidate Insert:** User with `org:hr` inserts candidate into Tenant A. Assert success. Assert `tenantId` matches Tenant A.
    2.  **Cross-Tenant Read:** User from Tenant A attempts to read Candidate from Tenant B. Assert rejection (error thrown or empty result depending on helper implementation).
    3.  **Training Completion:** User attempts to write `platformTrainingCompletions` for a `userId` that does not belong to their tenant. Assert rejection.
    4.  **Role Expansion:** Insert `tenantMembers` doc with `role: 'org:hr'`. Query it back. Assert role is preserved and accessible.

## 5. Edge Cases & Security Considerations
*   **Multi-Tenancy Leakage:** The highest risk. Ensure `tenantId` is *never* user-provided in mutations. It must be derived strictly from `auth` context.
*   **PHI/PII:** `candidates` and `hrCases` may contain sensitive data. Ensure no logs print these fields. Future work should consider encryption at rest, but for now, strict access control is the gate.
*   **Role Escalation:** Ensure `org:candidate` cannot elevate themselves to `org:hr` via `tenantMembers` mutation. Only `org:admin` should modify `tenantMembers`.
*   **Idempotency:** `platformTrainingCompletions` might be written multiple times. Stubs should consider upsert logic or unique indexes if specified in the Phase 2 Spec.
*   **Convex Codegen:** Running codegen changes `_generated` files. These must not be manually edited. Plan includes running codegen *before* final typecheck.

## 6. Test Strategy
*   **Unit/Integration:** Use Convex's testing harness (`convex-test`) to spin up an in-memory backend.
*   **Setup:** Create two distinct tenants (Tenant A, Tenant B) and users with different roles (`org:hr`, `org:admin`) in the test setup.
*   **Assertions:**
    *   Use `rejects` for security violations.
    *   Use `toEqual` for data integrity checks.
*   **Gates:**
    1.  `npm run lint` (ESLint/Prettier check for style compliance).
    2.  `npm run typecheck` (TypeScript validation, ensures codegen types match).
    3.  `npm run test` (Vitest suite).
*   **Cost Control:** Keep tests deterministic and fast. Avoid excessive `await` chains or large data generation in tests.

## 7. Rollback & Verification
*   **Rollback:**
    1.  `git revert` the commit containing schema and helper changes.
    2.  Run `npx convex codegen` again to regenerate types based on the reverted schema.
    3.  Verify `npm run typecheck` passes on the reverted state.
    *   *Note:* Convex schema changes are additive, so rolling back code is safe unless downstream clients (mobile/web) have already deployed relying on the new fields. Since this is Session 1 (dev phase), risk is low.
*   **Verification:**
    1.  Check `convex/_generated/api.d.ts` to confirm new tables and roles are present.
    2.  Run the specific test file `convex/candidates.test.ts` in isolation to confirm guard logic works before running full suite.
    3.  Confirm no `any` types were introduced in `authHelpers` to bypass new role types.

---
**Plan Status:** Ready for Implementation.
**Session Scope:** Strictly Session 1 (Schema + Guards + Tests). Logic implementation deferred to subsequent sessions.
**Cost Note:** Plan minimizes compute by focusing on stubs and targeted security tests rather than full E2E flows at this stage.