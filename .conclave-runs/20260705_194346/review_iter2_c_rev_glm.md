# http://localhost:11434/api/chat
# model=glm-5.1:cloud status=200

## Review

### AC-1 (Routes) ✅
`src/app/router.tsx` adds three lazy-loaded routes with `TenantRoleRouteGuard`:
- `scheduling` → `org:admin`, `org:coordinator`
- `caregiver/schedule` → `org:caregiver`
- `caregiver/availability` → `org:caregiver`

All wrapped in `RouteSuspense`, matching the existing pattern.

### AC-2 (Sidebar) ✅
`src/app/shell/Sidebar.tsx` adds:
- Schedule (`CalendarDays`, `/scheduling`) for admin/coordinator
- Schedule (`CalendarDays`, `/caregiver/schedule`) for caregiver
- Availability (`Clock`, `/caregiver/availability`) for caregiver

Role filtering ensures only one "Schedule" link renders per role. Tests verify caregiver sees exactly one Schedule link pointing to `/caregiver/schedule`.

### Router Tests ✅
`src/app/router.test.tsx` adds `mockSignedInWithRole` helper and 5 new tests:
- Admin and coordinator can access `/scheduling`
- Caregiver can access `/caregiver/schedule` and `/caregiver/availability`
- Caregiver is blocked from `/scheduling` (negative case)

`useClerk` mock added to prevent runtime errors in the guard.

### Sidebar Tests ✅
Updated expectations for all three roles:
- Admin: now includes Schedule, still excludes Availability
- Coordinator: includes Schedule, excludes Availability
- Caregiver: includes Availability, single Schedule link at `/caregiver/schedule`

### Security / Multi-tenancy ✅
Routes use `TenantRoleRouteGuard` with explicit `allowedRoles`. Backend enforcement is separate (not in this diff). No org ID leakage — routes rely on auth context.

### No regressions
All 377 tests pass. Lint, typecheck, and build gates all pass. The diff is purely additive — no existing routes or nav items were modified.

### Minor note (not blocking)
The caregiver-redirect test only asserts the scheduling page is absent, not where the redirect lands. This is consistent with the existing test style and the `RouteGuard` component is independently tested (14 tests), so no action needed.

VERDICT: APPROVED