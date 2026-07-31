# Login Page Product Tabs

## Context
Design doc at: C:\Users\pinol\Downloads\login-product-tabs-design-doc.md
Read it FIRST before implementing.

## Task
Add a tab selector to the sign-in page that lets users pick which ATRIA product they're logging into (Candidate Portal, HR Portal, Staff Portal). This is purely aesthetic — underneath it's the same Clerk sign-in form. Selecting a tab changes the `redirect` URL query param, which updates:
1. The product label subtitle below the AtriaLogo
2. Clerk's `forceRedirectUrl` / `fallbackRedirectUrl` (where the user goes after login)

## Current Code
- `SignInRedirect` in `src/app/router.tsx` (around line 198-230)
- Already has `deriveProductLabel(redirectUrl)` that returns "Candidate Portal", "HR Portal", "Staff Portal", or null
- Already has `useRedirectParam()` that reads the `redirect` query param, defaults to `/select-agency`
- Uses `AtriaLogo`, `SignIn` from Clerk, `cn` helper

## Implementation

1. Replace `useRedirectParam()` with `useSearchParams` from react-router-dom in `SignInRedirect`
2. Add a `PRODUCT_TABS` constant array:
   ```js
   const PRODUCT_TABS = [
     { label: 'Candidate Portal', redirect: '/onboarding' },
     { label: 'HR Portal', redirect: '/hr' },
     { label: 'Staff Portal', redirect: '/coordinator/review' },
   ]
   ```
3. Add a tab selector (pill-style buttons) between the logo/label section and the Clerk `<SignIn>` component
4. Active tab is determined by matching `redirect` param to a tab's redirect value
5. Clicking a tab calls `setSearchParams({ redirect: tab.redirect }, { replace: true })`
6. No tab highlighted when redirect is `/select-agency` (default/generic)

## Style
- 2-space indent, single quotes, NO semicolons
- Match existing patterns in router.tsx
- Use `cn` for conditional class names
- Pill-style tabs matching the tab style used elsewhere in the app (rounded-full, px-4 py-2 text-sm font-medium)

## Tests
- Add tests in `src/app/router.test.tsx` for:
  - Tabs render with correct labels
  - Clicking a tab updates the redirect param
  - Active tab is highlighted
  - Product label updates when tab changes

## Verify
- npm run lint
- npm run typecheck
- npm run test
- npm run build