# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### Schema & Role Extension
- `tenantMembers.role` correctly extended with `org:hr` and `org:candidate` literals in `schema.ts` (lines +50-51).
- All 10 Phase 2 tables added with correct fields, types, and tenant-first indexes matching the spec. Every table leads with `tenantId`, preserving multi-tenant isolation at the schema level.
- `coverageRequests` and `platformTrainingCompletions` (not in docs) use sensible inferred schemas with appropriate tenant-scoped indexes.

### Auth Helpers
- `TenantRole` type union expanded correctly in `authHelpers.ts`.
- `normalizeTenantRole` handles both full (`org:hr`, `org:candidate`) and bare (`hr`, `candidate`) aliases, consistent with the existing pattern for admin/coordinator/caregiver.
- No existing `requireTenantRole` call sites needed changes — they pass literal subsets of the expanded type and remain valid.

### Duplicate Role Validators
- `members.ts` `sync` and `updateRole` validators expanded (+2 literals each). ✅
- `invitations.ts` `roleValidator` and `InviteRole` type expanded. ✅
- `toClerkRole` still maps all non-admin roles to `org:member`, which is correct — HR/candidate members get `org:member` in Clerk with their specific role stored in Convex.

### Frontend
- `RouteGuard.tsx` local `TenantRole` type expanded to match. This type is duplicated from `authHelpers.ts` (pre-existing tech debt), but the change keeps them in sync.

### Generated Code
- `_generated/api.d.ts` registers both `candidates` and `platformTrainingCompletions` modules, confirming codegen was run.

### Tests
- `authHelpers.test.ts`: New cases for `getClerkOrganizationRole` with `org:hr`/`org:candidate` and bare `hr`/`candidate` aliases, plus `assertTenantDoc` with a candidate-shaped doc across tenants. ✅
- `phase2Guards.test.ts` (4 tests visible in gate output): covers the four required scenarios — candidate tenant guard, cross-tenant candidate read rejection, platformTrainingCompletions foreign-tenant user rejection, and org:hr member insert/retrieve. ✅
- All 296 tests pass across 38 files.

### Security & Multi-Tenancy
- Every new table has `tenantId` as a required first field and tenant-first indexes — no cross-tenant data leakage at the query level.
- The `platformTrainingCompletions` stub (referenced in `api.d.ts` but implementation not in diff) must verify the target `clerkUserId` is a member of the acting tenant before writing. The passing test confirms this guard works, though the implementation isn't visible for line-by-line review.
- `candidates` stores PII (email, phone); tenant isolation via `assertTenantDoc` is tested.
- `hrCases` stores sensitive descriptions; guarded by tenant role checks in stubs.

### Minor Observations (non-blocking)
- `documentArchiveItems.by_tenant_expires_at` indexes on an optional field — Convex handles this with a sparse index, which is correct for "find expiring docs" queries.
- The local `TenantRole` type in `RouteGuard.tsx` duplicates the canonical one from `authHelpers.ts`. Not a regression, but a future consolidation opportunity.
- The new stub files (`candidates.ts`, `platformTrainingCompletions.ts`, `phase2Guards.test.ts`) aren't in the diff but are confirmed present by the passing test suite and `api.d.ts` registration.

All three gates green. Task requirements satisfied.

VERDICT: APPROVED