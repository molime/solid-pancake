# Conclave run summary
- project: atriax
- result: **UNKNOWN** _(in progress)_
- run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260707_124158
- task: Fix AppShell desktop sidebar overlap in ATRIA-X. File: src/app/shell/AppShell.tsx. The fixed left sidebar has width 240px and overlaps the main content on desktop. Add 'lg:ml-[240px]' to the content wrapper div only when chrome is shown (hideChrome is false). Current wrapper class is cn('flex flex-1 flex-col', hideChrome ? 'w-full' : 'overflow-hidden'). Change to hideChrome ? 'w-full' : 'overflow-hidden lg:ml-[240px]'. After changing, run npm run typecheck, npm run test, E2E_FULL=1 npm run e2e, and npm run build. Report all gate pass/fail. Do not change anything else unless tests fail.

## Stages
- {'stage': 'plan', 'how': 'synthesized by c_plan_agentic', 'chars': 9097, 'elapsed_s': 211.8}
- {'stage': 'implement', 'ok': True, 'elapsed_s': 957.3}

## Stage timing
| Stage | Elapsed (s) |
|---|---|
| plan | 211.8 |
| implement | 957.3 |
| **TOTAL** | **1169.1** |