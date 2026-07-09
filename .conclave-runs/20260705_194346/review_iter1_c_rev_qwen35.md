# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Code Review: Session 5 — Scheduling & Shift Management (Router + Sidebar Only)

## Summary

The provided diff contains **only 2 files** (`router.tsx` and `Sidebar.tsx`), but the task and plan require **12+ new files** for the scheduling feature implementation. The gate results show tests passing for scheduling components, indicating those files exist in the working tree, but they are **not included in this diff** for review.

---

## What Is Correct in This Diff

| File | Observation | Status |
|------|-------------|--------|
| `src/app/router.tsx` (lines 57-69) | Lazy imports use correct path alias `@/features/scheduling/pages/*` | ✅ |
| `src/app/router.tsx` (lines 244-275) | Routes wrapped in `TenantRoleRouteGuard` with correct `allowedRoles` | ✅ |
| `src/app/router.tsx` (line 244) | Admin/coordinator route uses `['org:admin', 'org:coordinator']` | ✅ |
| `src/app/router.tsx` (lines 256, 267) | Caregiver routes use `['org:caregiver']` | ✅ |
| `src/app/shell/Sidebar.tsx` (line 14) | `Clock` icon imported from `lucide-react` | ✅ |
| `src/app/shell/Sidebar.tsx` (lines 40-58) | Nav items match plan: Schedule (admin/coordinator), Schedule + Availability (caregiver) | ✅ |
| `src/app/shell/Sidebar.tsx` (lines 40-58) | Paths match router: `/scheduling`, `/caregiver/schedule`, `/caregiver/availability` | ✅ |

---

## Critical Blockers — Changes Required

### 1. Missing Implementation Files (AC-3 through AC-11)

The diff does not include any of the following required files from the plan:

| Expected File | Plan Section | AC Reference |
|---------------|--------------|--------------|
| `src/features/scheduling/pages/SchedulingPage.tsx` | AC-3 | Weekly calendar, shift cards, caregiver filter, EmptyState |
| `src/features/scheduling/components/ShiftEditorModal.tsx` | AC-4, AC-5, AC-6 | Create/edit shift, conflict error parsing, availability hint |
| `src/features/scheduling/components/ShiftPacketPanel.tsx` | AC-7, AC-8 | Status badge, role-based actions, audit history |
| `src/features/scheduling/components/CoverageRequestsPanel.tsx` | AC-9 | Open requests list, Assign dropdown, `resolveCoverage` call |
| `src/features/scheduling/pages/CaregiverSchedulePage.tsx` | AC-10 | Mobile-first shift list, caregiver view packet |
| `src/features/scheduling/pages/AvailabilityPage.tsx` | AC-11 | Recurring/override windows, `addAvailabilityWindow`, `deleteAvailabilityWindow` |
| `src/features/scheduling/schedulingUtils.ts` | Discovery Notes | `toIsoFromLocal` helper for timezone-safe ISO conversion |
| `src/features/scheduling/*.test.tsx` | AC-14 | Unit tests for all components |

**Risk:** Without these files, the lazy imports in `router.tsx` will fail at runtime with "Module not found" errors. The gate tests passing suggests they exist in the working tree, but **I cannot review them** without the diff.

---

### 2. Cannot Verify Security & Multi-Tenancy Guards (AC-12, Data/Security Section)

The plan's security requirements cannot be verified without seeing the component implementations:

| Requirement | What to Verify | Status |
|-------------|----------------|--------|
| Multi-tenancy | All Convex calls pass `clerkOrgId` from `useOrganization().organization.id` | ❌ Not visible |
| Role-based UI | Admin/coordinator buttons hidden from caregiver view | ❌ Not visible |
| PHI handling | No console logging of client/caregiver names | ❌ Not visible |
| Conflict idempotency | Submit button disabled during mutation pending state | ❌ Not visible |
| Delete safety | Delete hidden/disabled for non-`scheduled` shifts | ❌ Not visible |
| Availability mapping | UI `override` → backend `one-off` | ❌ Not visible |
| Timezone handling | `new Date(\`${date}T${time}\`).toISOString()` vs `${date}T${time}:00Z` | ❌ Not visible |

---

### 3. Cannot Verify Test Coverage (AC-14)

Gate results show these tests passing:
- `src/features/scheduling/pages/AvailabilityPage.test.tsx` (2 tests)
- `src/features/scheduling/components/ShiftEditorModal.test.tsx` (2 tests)
- `src/features/scheduling/components/CoverageRequestsPanel.test.tsx` (2 tests)

However, the test files are **not in the diff**, so I cannot verify:
- Conflict error message parsing matches AC-5 format
- `createShift` args include all required fields (AC-4)
- `resolveCoverage` called with correct `coverageRequestId` and `reassignedTo` (AC-9)
- `addAvailabilityWindow` receives correct `kind` mapping (AC-11)

---

### 4. Visual Regression Gate (AC-16) Not Completed

The plan requires:
> "After implementation, run `npm run dev`, capture screenshots of every scheduling state, and compare against `.hermes-pipeline/20260705_194120/*.png`."

There is no evidence in the diff or gate results that:
- Dev server was run
- Screenshots were captured
- Visual comparison was performed

**This is a required gate before approval.**

---

## Minor Observations (Not Blockers)

| Observation | File | Line | Note |
|-------------|------|------|------|
| Route paths use `"scheduling"` not `"/scheduling"` | `router.tsx` | 244 | Consistent with existing app convention (e.g., `"clients"`), NavLink uses `/scheduling` — this is fine |
| Nav items use `/scheduling` with leading slash | `Sidebar.tsx` | 41 | Consistent with existing nav items — fine |
| No `npx convex codegen` mentioned | N/A | N/A | Plan states no backend changes, so codegen not required — fine |

---

## Required Actions Before Approval

1. **Provide complete diff** including all `src/features/scheduling/**/*` files (pages, components, utils, tests).

2. **Verify visual regression** — run `npm run dev`, capture screenshots of:
   - `/scheduling` (admin/coordinator weekly calendar)
   - `/scheduling` with ShiftEditorModal open
   - `/scheduling` with ShiftPacketPanel open
   - `/scheduling` with CoverageRequestsPanel open
   - `/caregiver/schedule` (mobile list)
   - `/caregiver/availability` (weekly + overrides)
   
   Compare against `.hermes-pipeline/20260705_194120/*.png` and document any divergence + fixes.

3. **Confirm security implementation** — show that:
   - All `api.scheduling.*` calls include `clerkOrgId`
   - Role-based button visibility matches backend guards
   - No PHI logged to console
   - Conflict error parsing matches AC-5 format exactly

4. **Confirm test coverage** — show test files verify:
   - Conflict error message format
   - All `createShift`/`updateShift` args
   - Availability `kind` mapping (`override` → `one-off`)
   - `resolveCoverage` args

---

## Verdict Rationale

The router and sidebar changes are **correct and well-structured**, but they represent only ~10% of the required implementation. I cannot approve a feature review without seeing the actual feature code, tests, and visual regression evidence. The gate results suggest the files exist and tests pass, but **the diff provided is incomplete** for a thorough security/correctness review.

VERDICT: CHANGES_REQUESTED