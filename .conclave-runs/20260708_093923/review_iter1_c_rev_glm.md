# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

I've reviewed the diff against the plan's acceptance criteria, focusing on correctness, security, and completeness.

### Positive findings

- **AC-3/4/5 frontend tests pass** — `CandidateOnboardingPage.test.tsx` confirms six tasks rendered with task-id routing; `ApplicationFormPage.test.tsx` confirms Figma entry form with `fullName/email/phone/position`; `DocumentUploadPage.test.tsx` confirms upload attaches by task type.
- **AC-8 tenant isolation** — All touched mutations still go through `requireTenantRole`/`assertTenantDoc`. `generateUploadUrl` correctly adds `org:candidate` to allowed roles.
- **AC-9 gates green** — lint, typecheck, 469 unit tests all pass.
- **Backend lifecycle tests** — `onboarding.test.ts` covers submit→review→offer→accept→hire flow, training idempotency, and candidate scheduling block.
- **Scheduling fix** — `deleteShift` now records audit *before* deleting the shift, fixing a referential-integrity bug.
- **E2E infrastructure** — Candidate and HR auth helpers, env vars, and seed fixtures are solid additions.
- **Invitation bypass** — `isAllowListError`, `createBypassMember`, and `ATRIA_X_DEV_INVITE_BYPASS` env var provide a clean dev escape hatch without weakening production.

### Issues requiring changes

#### 1. Security: `public_metadata` fallback enables privilege escalation — `convex/authHelpers.ts`

Lines 148–150 introduce a fallback to `identity.public_metadata` when `org_public_metadata` is absent:

```typescript
const topLevelMetadata = identity.org_public_metadata ?? identity.public_metadata
const metadataRole = getAtriaRoleFromMetadata(topLevelMetadata)
```

Clerk's user-level `public_metadata` **can be set by the user themselves** via the Frontend API (`user.update({ publicMetadata })`). A candidate could set `publicMetadata: { atriaRole: 'org:admin' }`, refresh their session, and — if `org_public_metadata` were ever `null`/`undefined` for an org member — be granted admin access. The original `getClerkOrganizationRole` did **not** read `public_metadata` at all; this fallback is newly introduced and creates a privilege-escalation vector.

**Request:** Remove the `?? identity.public_metadata` fallback. For org members, Clerk always provides `org_public_metadata` (at minimum `{}`), so the fallback is unnecessary. If it's needed for the dev-bypass flow, set `org_public_metadata.atriaRole` on the Clerk org membership instead (via the Backend API with `CLERK_SECRET_KEY`), which is org-controlled and not user-writable.

The test at `convex/authHelpers.test.ts:162–169` (`prefers atriaRole from public_metadata fallback`) should be removed or rewritten to verify that `public_metadata` is **not** consulted when `org_public_metadata` is absent.

#### 2. Test inconsistency: old task types — `convex/onboarding.test.ts`

The test `candidateTasks are ordered 0-4 with correct types` (line ~77) manually seeds five tasks with the **old** types (`document_upload`, `reference_check`) and asserts that ordering. The backend now uses six types (`form_submission`, `photo_id`, `cpr_certificate`, `background_check`, `employment_agreement`, `platform_training`). While the test validates ordering mechanics, it's misleading and doesn't cover the actual `CANDIDATE_TASK_TYPES` constant.

**Request:** Update this test to seed and assert the six current task types so it stays consistent with the production schema and the frontend checklist.

### Non-blocking notes

- **Unused args in `generateUploadUrl`** — `contentType` and `size` are declared as optional args but never referenced in the handler. Consider removing them or adding validation; leaving dead args is confusing for future readers.
- **`createBypassMember` is an `internalMutation`** — Verify that all call sites properly authenticate before invoking it. Internal mutations bypass Convex's client-side auth, so the burden is on the caller.
- **Frontend source files not in this diff** — The key onboarding page rewrites (upload helper, Vite proxy, `ApplicationFormPage`, `DocumentUploadPage`, `CandidateOnboardingPage`, `ApplicationReviewPage`, `OfferAcceptancePage`, router cleanup) don't appear in the diff. The passing tests confirm they exist and work, but they should be reviewed in a separate pass if not already merged.

VERDICT: CHANGES_REQUESTED