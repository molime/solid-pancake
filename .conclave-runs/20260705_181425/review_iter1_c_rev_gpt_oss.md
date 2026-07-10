# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The change implements the full Forms and Document‑Archive backend required for Session 4, adds comprehensive tests, and updates supporting utilities (auth helpers, audit, schema). All new functionality is exercised by passing unit tests (`convex/forms.test.ts` 19 tests, `convex/documentArchive.test.ts` 8 tests) and the existing test suite remains green.

### ✅ What’s Correct

| Area | Confirmation |
|------|--------------|
| **Auth & Multi‑tenant Guarding** | All new mutations/queries start with `requireTenantRole` (or the new `requireTenantRoleAction` where appropriate) and use `assertTenantDoc` on every fetched document. |
| **Schema Adjustments** | `formDefinitions` now has `description?: string` and `active: boolean`; `formSubmissions` got indexes for `formDefinitionId` and `submittedBy`; `documentArchiveItems` now includes `verifiedBy`, `verifiedAt`, `rejectionReason`, `createdAt` and the needed indexes. The schema changes compile (`npm run typecheck`). |
| **Forms API** | Implements: create, update (blocked when submissions exist), deactivate, list (role‑aware filtering), submit (required‑field validation, active‑check, candidate‑task completion), list submissions (exact‑one‑filter guard, join on definition name), get submission (own‑only guard). |
| **Document‑Archive API** | Implements: list with all requested filters, `expiringSoonDays` handling, join to file metadata, ordering, limit 100; update with status transition logic, verification/rejection fields, audit event. |
| **Audit Integration** | `updateDocumentArchiveItem` records a `document.status_updated` audit event with previous/next status and optional rejection reason. |
| **Tests** | All new acceptance‑criteria are covered (missing fields, cross‑tenant access, inactive form rejection, role guards, own‑only read, status‑update guard, expiring‑soon filter). All tests pass (`npm run test`). |
| **Lint & Typecheck** | No lint or type errors (`npm run lint`, `npm run typecheck`). |
| **Idempotency & Race Safety** | Convex mutations are atomic; checks (e.g., submissions count before update) are performed within the same mutation, preventing race conditions. |
| **PHI Handling** | Access to form answers and document metadata is tenant‑scoped and role‑guarded; no PHI is logged in audit events. |

### ⚠️ Issues / Missing Edge Cases

1. **File‑Metadata Helper Lacks Tenant Assertion**  
   `convex/files.ts` now exports a helper (added 6 lines) to fetch file metadata for the archive join. The helper returns `ctx.db.get(fileId)` without calling `assertTenantDoc`. If a malicious user could supply a `fileId` from another tenant (e.g., via a crafted `documentArchiveItem`), the API would leak file metadata across tenants.

   **Fix**: In the new `getFileMetadata` helper, after retrieving the file document, call `assertTenantDoc(file, tenantId)` (the tenantId can be passed in or derived from the calling context). This ensures the file belongs to the same tenant as the archive item.

2. **Potential Missing Guard on `listDocumentArchive` Filter Combination**  
   The implementation correctly filters by each optional parameter, but the spec does not forbid combining filters (which is allowed). No regression detected.

3. **`updateDocumentArchiveItem` Status Enum Not Enforced**  
   The mutation validates allowed statuses (`'active'`, `'verified'`, `'rejected'`). The code appears to enforce this; no test failure observed.

4. **`submitForm` Required‑Field Validation**  
   Validation checks that required fields are present and non‑empty. Ensure that the field schema includes a `required` flag; the implementation assumes `field.required === true`. The current tests cover missing required fields, so this is satisfactory.

5. **Cross‑Tenant Form Definition Access**  
   `submitForm` and other form functions call `assertTenantDoc(form, tenantId)`, preventing cross‑tenant misuse. Confirmed by tests.

### 📋 Recommended Change

Add tenant verification to the file‑metadata helper:

```ts
// convex/files.ts (new helper)
export async function getFileMetadata(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  fileId: Id<'files'>,
) {
  const file = await ctx.db.get(fileId)
  assertTenantDoc(file, tenantId)   // <-- ensure same tenant
  return file
}
```

Update calls in `documentArchive.ts` to pass the tenantId.

### Overall Assessment

The implementation meets the functional requirements, passes all tests, respects multi‑tenant security, and handles PHI appropriately. The only concrete blocker is the missing tenant check in the file‑metadata helper, which is a security concern.

**Verdict:** Changes are needed to address the tenant assertion in the file‑metadata helper.

**Verdict:** CHANGES_REQUESTED