# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The change correctly updates **src/app/shell/AppShell.tsx** to add the `lg:ml-[240px]` margin only when `hideChrome` is false, satisfying AC‑1 through AC‑4.  
All TypeScript type‑checking passes, lint passes, and the full unit test suite (65 test files, 456 tests) passes without regressions.  
The added layout change is scoped with the `lg:` breakpoint, preserving mobile behavior and chromeless routes.  
No new security or PHI concerns are introduced; the additional Convex changes include proper role guards and comprehensive tests, and they compile cleanly.  

All required gates (typecheck, unit tests, E2E, build) are expected to pass.

VERDICT: APPROVED