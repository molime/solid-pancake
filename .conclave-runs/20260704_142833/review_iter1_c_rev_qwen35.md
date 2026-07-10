# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

## Review: ATRIA-X Phase 2 DB Schema + Guard Tests (Session 1)

### Summary
The diff shows additive schema changes for 10 Phase 2 tables, role extensions in authHelpers/members/invitations, and test additions. All gates (lint, typecheck, test) pass with 296 tests including 4 new `phase2Guards.test.ts` tests.

### What's Verified in the Diff

| File | Change | Status |
|------|--------|--------|
| `convex/schema.ts` | Extended `tenantMembers.role` with `org:hr`/`org:candidate`; added 10 new tables with correct fields/indexes | ✅ Correct |
| `convex/authHelpers.ts` | Extended `TenantRole` type; added `hr`/`candidate` bare alias normalization | ✅ Correct |
| `convex/members.ts` | Extended role validators in `sync` and `updateRole` | ✅ Correct |
| `convex/invitations.ts` | Extended `roleValidator` and `InviteRole` type | ✅ Correct |
| `convex/authHelpers.test.ts` | Added candidate-shaped doc test for `assertTenantDoc`; added `org:hr`/`org:candidate` role normalization tests | ✅ Correct |
| `convex/_generated/api.d.ts` | References new `candidates` and `platformTrainingCompletions` modules | ⚠️ Implies stubs exist but not shown |
| `src/app/shell/RouteGuard.tsx` | Extended frontend `TenantRole` type | ✅ Consistent |

### Missing from Diff (Critical for Security Review)

The following files are **referenced in generated code** and **required by the task** but not visible in the diff:

1. **`convex/candidates.ts`** - Must contain:
   - `create` mutation with `requireTenantRole` guard
   - `get` query with tenant guard + `assertTenantDoc`
   - `update` mutation demonstrating `assertTenantDoc` cross-tenant rejection

2. **`convex/platformTrainingCompletions.ts`** - Must contain:
   - `create` mutation that verifies target `clerkUserId` exists in `tenantMembers` for the acting tenant (prevents cross-tenant user writes)

3. **`convex/phase2Guards.test.ts`** - Must contain 4 specific test scenarios:
   - Candidate insert tenant-guarded via `assertTenantDoc`
   - Cross-tenant candidate read rejected
   - `platformTrainingCompletions` cannot be written for different tenant's user
   - `tenantMembers` with `org:hr` can be inserted and retrieved

### Security Concerns

| Concern | Risk | Evidence |
|---------|------|----------|
| **Cross-tenant candidate access** | High | `assertTenantDoc` test added in `authHelpers.test.ts` ✅, but mutation implementation not visible |
| **Cross-tenant training completion writes** | High | Task requires verifying `clerkUserId` is member of acting tenant; implementation not visible |
| **PHI in candidates table** | Medium | `email`/`phone` stored; tenant isolation depends on guards not visible in diff |
| **Stubs created without typecheck failure** | Low | Task says "only where codegen/typecheck fail"; stubs appear preemptive but enable required tests |

### Positive Indicators

- **Test suite passes**: `convex/phase2Guards.test.ts (4 tests)` shows ✅ in test output
- **Schema enforces tenantId**: All 10 new tables have `tenantId` as first field with tenant-first indexes
- **Role normalization complete**: Both `org:hr`/`org:candidate` and bare `hr`/`candidate` aliases handled
- **No hand-edits to generated code**: `convex/_generated/api.d.ts` changes are consistent with codegen output

### Required Changes

The test results indicate the implementation works, but **I cannot verify the security guards are correctly implemented** without seeing the mutation code. For a health platform with PHI, this is a blocker.

**Request the following files be included in the diff for review:**
1. `convex/candidates.ts` - Verify `requireTenantRole` and `assertTenantDoc` usage
2. `convex/platformTrainingCompletions.ts` - Verify tenant member lookup before write
3. `convex/phase2Guards.test.ts` - Verify all 4 required test scenarios are covered

### Verdict Reasoning

- Schema changes: ✅ Correct and complete
- Role extensions: ✅ Consistent across all files
- Tests passing: ✅ 296 tests green including new guards
- **Security guards**: ⚠️ Cannot verify without seeing mutation implementations
- **Task compliance**: ⚠️ Cannot confirm stubs use `authHelpers` guards as required

For a security review of tenant isolation on a healthcare platform, I need to see the actual guard implementations, not just infer them from passing tests.

VERDICT: CHANGES_REQUESTED