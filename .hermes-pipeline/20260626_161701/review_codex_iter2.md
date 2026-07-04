# stage review_codex_iter2
# cmd: codex exec --ignore-user-config --sandbox read-only --color never --ephemeral --skip-git-repo-check 'Read the file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter2.prompt.md and carry out its instructions completely and autonomously. Do not ask questions; make reasonable decisions and finish the task. Output your final result (plan / review / summary) as your last message.'

Reading additional input from stdin...
OpenAI Codex v0.136.0
--------
workdir: C:\Users\pinol\Documents\Work\atriax\solid-pancake
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019f064e-daf1-78e1-8490-811cde627325
--------
user
Read the file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter2.prompt.md and carry out its instructions completely and autonomously. Do not ask questions; make reasonable decisions and finish the task. Output your final result (plan / review / summary) as your last message.
codex
I’ll read the review prompt and the current repo state first, then follow the instructions as far as this read-only workspace permits.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.hermes-pipeline\\20260626_161701\\review_codex_iter2.prompt.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
mcp: codex/list_mcp_resources started
mcp: codex/list_mcp_resources (completed)
 succeeded in 427ms:
 M .env.example
 M convex/_generated/api.d.ts
 M convex/_generated/api.js
 M convex/_generated/server.d.ts
 M convex/_generated/server.js
 M convex/adpSync.ts
 M convex/invitations.ts
 M convex/members.ts
 M convex/reviews.ts
 M convex/schema.ts
 M convex/seed.ts
 M convex/shiftClock.test.ts
 M convex/shiftQueries.ts
 M convex/shifts.ts
 M convex/tenants.ts
 M eslint.config.js
 M package.json
 M playwright.config.ts
 M src/app/router.tsx
 M src/app/shell/Sidebar.tsx
 M src/features/caregiver/components/ShiftDocumentationForm.tsx
 M src/features/caregiver/components/ShiftTaskList.tsx
 M src/features/caregiver/model/documentationDraft.ts
 M src/features/caregiver/pages/CaregiverTodayPage.tsx
 M src/features/clients/pages/ClientsPage.test.tsx
 M src/features/clients/pages/ClientsPage.tsx
 M src/features/coordinator/components/ReviewDetail.tsx
 M src/features/coordinator/components/ReviewHistory.tsx
 M src/features/coordinator/pages/CoordinatorReviewPage.tsx
 M src/features/dashboard/pages/DashboardPage.tsx
 M src/features/platform/pages/PlatformAdminPage.tsx
 M src/features/team/pages/TeamPage.test.tsx
 M src/features/team/pages/TeamPage.tsx
 M src/index.css
 M src/shared/format.ts
 M src/shared/testing/convexApi.test.ts
 M src/shared/ui/AppLoader.tsx
 M src/shared/ui/Badge.tsx
 M src/shared/ui/Button.tsx
 M src/shared/ui/Card.tsx
 M src/shared/ui/Checkbox.tsx
 M src/shared/ui/Dialog.tsx
 M src/shared/ui/Input.tsx
 M src/shared/ui/KpiCard.tsx
 M src/shared/ui/Select.tsx
 M src/shared/ui/StatusBadge.tsx
 M src/shared/ui/Table.tsx
 M src/shared/ui/Textarea.tsx
 M src/shared/ui/index.ts
 M tsconfig.app.json
 M vite.config.ts
?? .hermes-pipeline/
?? convex/adpOutbound.ts
?? convex/adpSync.test.ts
?? convex/employeeProfiles.test.ts
?? convex/employeeProfiles.ts
?? convex/integrations/
?? convex/reviews.test.ts
?? convex/tsconfig.json
?? src/features/caregiver/components/LocationStatusPanel.tsx
?? src/features/caregiver/components/MissingChecklist.tsx
?? src/features/caregiver/components/ShiftClockInScreen.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.test.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.tsx
?? src/features/caregiver/components/ShiftDocumentationForm.test.tsx
?? src/features/caregiver/components/ShiftNoteStep.tsx
?? src/features/caregiver/components/ShiftSuccessScreen.tsx
?? src/features/caregiver/hooks/
?? src/features/caregiver/model/documentationWizard.test.ts
?? src/features/caregiver/model/documentationWizard.ts
?? src/features/coordinator/components/ReviewDetail.test.tsx
?? src/features/coordinator/pages/CoordinatorReviewPage.test.tsx
?? src/features/settings/
?? src/shared/ui/EmptyState.tsx
?? src/shared/ui/FieldGroup.tsx
?? src/shared/ui/ProgressSteps.tsx
?? src/shared/ui/Toast.tsx
?? src/shared/ui/sharedUi.test.tsx
?? tests/e2e/geofence.spec.ts
?? tests/e2e/global-setup.ts
?? tests/e2e/helpers/
?? tests/e2e/phase1-lifecycle.spec.ts

 succeeded in 492ms:
# ROLE: REVIEWER (codex)

You review the uncommitted changes in this repository against the task and acceptance criteria.
Inspect the diff with `git diff` and `git status`. Do NOT edit code.

Cover: correctness, security (HIPAA / multi-tenancy / auth), style-rule compliance, test coverage
(unit + e2e + stress), and missed edge cases. List each required change as a numbered actionable item.

Request changes only for concrete blockers: acceptance-criteria misses, regressions, money/security/PHI
risks, broken contracts, or missing tests for touched behavior. Do not block the run on speculative polish,
style preferences outside the project rules, or unrelated repo baseline failures; call those out as
follow-ups instead.

## Project context
ATRIA-X: multi-tenant SaaS for home-care agencies. React19+Vite8+TS, Tailwind4, React Router 7, Clerk (auth/orgs), Convex (backend+DB), Vitest, Playwright. Formatting: 2-space indent, single quotes, NO semicolons, PascalCase components, camelCase utils. CORE RULE: a service is never billed unless its shift documentation is complete and approved (caregiver->coordinator->billing). Multi-tenancy is the central invariant: every Convex fn touching tenant data MUST go through authHelpers.ts guards (requireTenant / requireTenantRole / assertTenantDoc); enforce auth twice (RouteGuard + server). Roles: org:admin, org:coordinator, org:caregiver. After editing convex/* run `npx convex codegen`. Never edit convex/_generated by hand. Follow CLAUDE.md/AGENTS.md.

## Task
ATRIA-X Phase 1 SESSION 8 â€” E2E + ADP contract tests + plug-and-play dry run.

MANDATORY EXECUTION CONSTRAINTS:
- Do not use Opus/Claude. Use Codex for plan and review, Kimi for implementation/fix as configured by the pipeline.
- Keep changes conservative and minimalistic. Respect the existing project structure and design.
- If unsure about code or files, open them. Do not hallucinate.
- Style: single quotes, no semicolons, 2-space indentation.
- Follow ATRIA-X rules: tenant access through authHelpers; never bill a shift until documentation is complete and approved; run Convex codegen after Convex API/schema changes.
- Optimize the flow for speed only where quality is not reduced: do not skip required gates.
- Create a detailed design/staging document artifact for this session (prefer the pipeline run directory, e.g. design-doc.md / implementation-plan.md; if versioning a docs file in repo is necessary, do it through the pipeline only). The doc must divide the implementation into stages and include a detailed to-do list for each stage before implementation.

TASK:
Implement/verify ATRIA-X Phase 1 end-to-end and integration test coverage.

(1) Playwright e2e for the full lifecycle against seeded data with geofence disabled:
- Command target: npm run e2e.
- Flow: caregiver logs in, opens assigned shift, Clock In, completes the 6-step note.
- Verify Clock Out is disabled until the note is complete, then enabled.
- Clock Out -> shift submitted.
- Coordinator logs in, sees it in the review queue, opens detail, requests a correction.
- Caregiver fixes + resubmits.
- Coordinator approves -> shift becomes billing-ready.
- Assert status = color + word at each step.

(2) Playwright/logic coverage for geofence enabled:
- Mock browser geolocation inside radius => Clock In/Out allowed and location evidence stored.
- Mock outside radius => UI shows the Figma-style blocked state and server rejects.
- Deny geolocation permission => UI shows blocked state and no punch is created.
- Disable the setting as admin/coordinator => location is no longer requested.

(3) ADP contract/integration tests using the mock adapter:
- Unconfigured tenant -> clock-in/out succeed and timePunches are marked pending_credentials; app remains fully usable.
- Flip integrationConnections.status to configured with mock creds and run sync engine -> queued punches post exactly once (idempotent), adpPunchId stored, statuses go synced.
- Run adpInitialWorkerLoad -> existing profiles matched by email, new ones created with adpAssociateOid.
- createCaregiver enqueues a worker sync that drains to synced.
- Assert NO secret values or raw ADP credentials appear in integrationEvents/logs.
- Assert location evidence is NOT included in ADP punch payloads unless ADP explicitly requires it later.

Seed/fixtures:
- Update seed.ts if needed for e2e fixtures, idempotently.
- Prefer deterministic seeded users/roles/shifts/settings.

Required gates for this session:
- codegen if Convex API/schema changed
- npm run lint
- npm run typecheck
- npm run test
- npm run e2e
All required gates must be genuinely green before reporting success. Report real pass/fail for each gate in summary.md.

## Latest gate results (for your awareness)
===== postfix1_unit run 1/1: npm run test =====

> mariatest@0.0.0 test
> vitest run --configLoader native


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.6 [39m[90mC:/Users/pinol/Documents/Work/atriax/solid-pancake[39m

 [32mâœ“[39m src/features/caregiver/components/ShiftDocumentationForm.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 6860[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders the clock-in screen when not clocked in [33m 460[2mms[22m[39m
     [33m[2mâœ“[22m[39m advances through each wizard step after clock-in [33m 2182[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls clockOut with location when geofence is enabled and note is complete [33m 825[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows outside-radius server error in plain language [33m 808[2mms[22m[39m
     [33m[2mâœ“[22m[39m disables the clock-out button and shows a loading label while submitting [33m 751[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls onDone when returning home from the success screen [33m 872[2mms[22m[39m
     [33m[2mâœ“[22m[39m autosaves draft note fields [33m 430[2mms[22m[39m
 [32mâœ“[39m src/features/team/pages/TeamPage.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 6810[2mms[22m[39m
     [33m[2mâœ“[22m[39m creates caregiver invitations through the server redirect flow [33m 1482[2mms[22m[39m
     [33m[2mâœ“[22m[39m passes coordinator intent to the server invitation flow [33m 1021[2mms[22m[39m
     [33m[2mâœ“[22m[39m maps coordinator role to org:member when updating Clerk membership [33m 315[2mms[22m[39m
     [33m[2mâœ“[22m[39m refreshes invitations list after sending an invite [33m 676[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows "already a member" message when invitee is already in the org [33m 908[2mms[22m[39m
     [33m[2mâœ“[22m[39m adds a caregiver through the caregiver form [33m 1505[2mms[22m[39m
 [32mâœ“[39m src/features/clients/pages/ClientsPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 3536[2mms[22m[39m
     [33m[2mâœ“[22m[39m uses caregiver email as the scheduling dropdown label [33m 1255[2mms[22m[39m
     [33m[2mâœ“[22m[39m opens the address dialog and saves the service address [33m 2152[2mms[22m[39m
 [32mâœ“[39m src/features/coordinator/components/ReviewDetail.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 1981[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls approve mutation when Approve is clicked [33m 369[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls requestCorrection mutation after typing a comment [33m 1230[2mms[22m[39m
 [32mâœ“[39m src/app/auth/SelectAgencyPage.test.tsx [2m([22m[2m8 tests[22m[2m)[22m[33m 2225[2mms[22m[39m
     [33m[2mâœ“[22m[39m does not call Convex while Convex auth is loading [33m 457[2mms[22m[39m
     [33m[2mâœ“[22m[39m retries once on transient token error, then succeeds [33m 541[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows JWT config error when retry also fails with missing org claim [33m 547[2mms[22m[39m
 [32mâœ“[39m src/features/settings/pages/GeofenceSettingsPage.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 1432[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders the current geofence settings [33m 550[2mms[22m[39m
     [33m[2mâœ“[22m[39m toggles enforcement options when geofence is enabled [33m 332[2mms[22m[39m
     [33m[2mâœ“[22m[39m saves updated geofence settings [33m 541[2mms[22m[39m
 [32mâœ“[39m src/features/coordinator/pages/CoordinatorReviewPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 825[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders populated queue with status pills [33m 527[2mms[22m[39m
 [32mâœ“[39m src/shared/ui/sharedUi.test.tsx [2m([22m[2m18 tests[22m[2m)[22m[33m 871[2mms[22m[39m
       [33m[2mâœ“[22m[39m renders a default secondary button [33m 585[2mms[22m[39m
 [32mâœ“[39m src/shared/testing/convexApi.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 1029[2mms[22m[39m
     [33m[2mâœ“[22m[39m tenants.ts exports ensureSelectedAgency [33m 385[2mms[22m[39m
 [32mâœ“[39m convex/adpSync.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 336[2mms[22m[39m
 [32mâœ“[39m src/app/shell/Sidebar.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 329[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/components/ShiftClockOutScreen.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 372[2mms[22m[39m
     [33m[2mâœ“[22m[39m disables clock-out when note is incomplete [33m 316[2mms[22m[39m
 [32mâœ“[39m src/app/shell/RouteGuard.test.tsx [2m([22m[2m14 tests[22m[2m)[22m[32m 195[2mms[22m[39m
 [32mâœ“[39m convex/seed.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 107[2mms[22m[39m
 [32mâœ“[39m convex/shiftClock.behavior.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 195[2mms[22m[39m
 [32mâœ“[39m convex/platform.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 83[2mms[22m[39m
 [32mâœ“[39m src/app/providers.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 157[2mms[22m[39m
 [32mâœ“[39m src/app/router.test.tsx [2m([22m[2m6 tests[22m[2m)[22m[32m 166[2mms[22m[39m
 [32mâœ“[39m convex/reviews.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 120[2mms[22m[39m
 [32mâœ“[39m convex/employeeProfiles.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 173[2mms[22m[39m
 [32mâœ“[39m convex/shiftClock.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 216[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/hooks/useCaregiverLocation.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 105[2mms[22m[39m
 [32mâœ“[39m convex/members.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 122[2mms[22m[39m
 [32mâœ“[39m convex/authHelpers.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 29[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/model/documentationWizard.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/locationValidation.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32mâœ“[39m convex/timePunches.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/tenantSettings.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m src/shared/domain/shiftRules.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32mâœ“[39m src/features/billing/model/invoiceUtils.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mâœ“[39m convex/files.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32mâœ“[39m convex/integrations/adp/adpClient.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/model/documentationDraft.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mâœ“[39m convex/shiftLifecycle.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/shiftValidation.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mâœ“[39m src/app/reloadOnStaleAssets.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32mâœ“[39m src/shared/search/embedding.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 16[2mms[22m[39m

[2m Test Files [22m [1m[32m37 passed[39m[22m[90m (37)[39m
[2m      Tests [22m [1m[32m276 passed[39m[22m[90m (276)[39m
[2m   Start at [22m 17:37:17
[2m   Duration [22m 218.44s[2m (transform 3.73s, setup 14.75s, import 16.55s, tests 28.48s, environment 139.38s)[22m


----- exit code: 0 -----

===== postfix1_typecheck run 1/1: npm run typecheck =====

> mariatest@0.0.0 typecheck
> tsc -b


----- exit code: 0 -----

## REQUIRED: the FINAL line of your output must be EXACTLY one of:
VERDICT: APPROVED
VERDICT: CHANGES_REQUESTED

Approve only if the change is correct, secure, well-tested, and style-compliant.


codex
I have the review brief. This turn is a code review only, so I’m going to inspect the uncommitted diff, the relevant tests, and the project rules without modifying files.
  → Read project rules and changed-file overview
  • Inspect lifecycle, geofence, and ADP implementation diffs
  • Inspect e2e/unit coverage and gate evidence
  • Produce actionable review verdict
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --name-only' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'package.json'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'CLAUDE.md') { Get-Content -Raw -LiteralPath 'CLAUDE.md' }" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'AGENTS.md') { Get-Content -Raw -LiteralPath 'AGENTS.md' }" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
2026-06-26T23:42:45.665599Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'CLAUDE.md') { Get-Content -Raw -LiteralPath 'CLAUDE.md' }"` rejected: blocked by policy
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'CLAUDE.md') { Get-Content -Raw -LiteralPath 'CLAUDE.md' }"` rejected: blocked by policy
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'AGENTS.md') { Get-Content -Raw -LiteralPath 'AGENTS.md' }"` rejected: blocked by policy
2026-06-26T23:42:45.684599Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "if (Test-Path -LiteralPath 'AGENTS.md') { Get-Content -Raw -LiteralPath 'AGENTS.md' }"` rejected: blocked by policy
 succeeded in 727ms:
.env.example
convex/_generated/api.d.ts
convex/_generated/api.js
convex/_generated/server.d.ts
convex/_generated/server.js
convex/adpSync.ts
convex/invitations.ts
convex/members.ts
convex/reviews.ts
convex/schema.ts
convex/seed.ts
convex/shiftClock.test.ts
convex/shiftQueries.ts
convex/shifts.ts
convex/tenants.ts
eslint.config.js
package.json
playwright.config.ts
src/app/router.tsx
src/app/shell/Sidebar.tsx
src/features/caregiver/components/ShiftDocumentationForm.tsx
src/features/caregiver/components/ShiftTaskList.tsx
src/features/caregiver/model/documentationDraft.ts
src/features/caregiver/pages/CaregiverTodayPage.tsx
src/features/clients/pages/ClientsPage.test.tsx
src/features/clients/pages/ClientsPage.tsx
src/features/coordinator/components/ReviewDetail.tsx
src/features/coordinator/components/ReviewHistory.tsx
src/features/coordinator/pages/CoordinatorReviewPage.tsx
src/features/dashboard/pages/DashboardPage.tsx
src/features/platform/pages/PlatformAdminPage.tsx
src/features/team/pages/TeamPage.test.tsx
src/features/team/pages/TeamPage.tsx
src/index.css
src/shared/format.ts
src/shared/testing/convexApi.test.ts
src/shared/ui/AppLoader.tsx
src/shared/ui/Badge.tsx
src/shared/ui/Button.tsx
src/shared/ui/Card.tsx
src/shared/ui/Checkbox.tsx
src/shared/ui/Dialog.tsx
src/shared/ui/Input.tsx
src/shared/ui/KpiCard.tsx
src/shared/ui/Select.tsx
src/shared/ui/StatusBadge.tsx
src/shared/ui/Table.tsx
src/shared/ui/Textarea.tsx
src/shared/ui/index.ts
tsconfig.app.json
vite.config.ts
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

 succeeded in 747ms:
{
  "name": "mariatest",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --configLoader native",
    "build": "tsc -b && vite build --configLoader native",
    "lint": "eslint .",
    "typecheck": "tsc -b",
    "test": "vitest run --configLoader native",
    "test:watch": "vitest --configLoader native",
    "e2e": "playwright test",
    "preview": "vite preview --configLoader native"
  },
  "dependencies": {
    "@clerk/react": "^6.6.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "convex": "^1.39.1",
    "lucide-react": "^1.16.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.15.1",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.60.0",
    "@tailwindcss/vite": "^4.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "convex-test": "^0.0.53",
    "eslint": "^10.4.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "jsdom": "^29.1.1",
    "prettier": "^3.8.3",
    "tailwindcss": "^4.3.0",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12",
    "vitest": "^4.1.6"
  }
}


 succeeded in 794ms:
 .env.example                                       |   9 +
 convex/_generated/api.d.ts                         |  53 +-
 convex/_generated/api.js                           |   3 +-
 convex/_generated/server.d.ts                      |   2 -
 convex/_generated/server.js                        |   2 -
 convex/adpSync.ts                                  | 346 +++++++++++-
 convex/invitations.ts                              |  82 +--
 convex/members.ts                                  |  49 +-
 convex/reviews.ts                                  |   4 +
 convex/schema.ts                                   |   8 +-
 convex/seed.ts                                     | 396 ++++++++++++++
 convex/shiftClock.test.ts                          | 243 ++++++++-
 convex/shiftQueries.ts                             |  42 +-
 convex/shifts.ts                                   |   8 +-
 convex/tenants.ts                                  |  18 +
 eslint.config.js                                   |  12 +-
 package.json                                       |  10 +-
 playwright.config.ts                               |   4 +-
 src/app/router.tsx                                 |  17 +
 src/app/shell/Sidebar.tsx                          |   7 +
 .../components/ShiftDocumentationForm.tsx          | 519 +++++++++++-------
 .../caregiver/components/ShiftTaskList.tsx         |  45 +-
 src/features/caregiver/model/documentationDraft.ts |  68 +++
 .../caregiver/pages/CaregiverTodayPage.tsx         | 212 +++++---
 src/features/clients/pages/ClientsPage.test.tsx    | 214 +++++++-
 src/features/clients/pages/ClientsPage.tsx         | 256 ++++++++-
 .../coordinator/components/ReviewDetail.tsx        | 577 +++++++++++++++++----
 .../coordinator/components/ReviewHistory.tsx       | 161 ++++--
 .../coordinator/pages/CoordinatorReviewPage.tsx    | 334 +++++++++---
 src/features/dashboard/pages/DashboardPage.tsx     | 219 +++++---
 src/features/platform/pages/PlatformAdminPage.tsx  |  13 +-
 src/features/team/pages/TeamPage.test.tsx          | 172 +++++-
 src/features/team/pages/TeamPage.tsx               | 204 +++++++-
 src/index.css                                      | 135 ++++-
 src/shared/format.ts                               |  69 +++
 src/shared/testing/convexApi.test.ts               |  10 +-
 src/shared/ui/AppLoader.tsx                        |   8 +-
 src/shared/ui/Badge.tsx                            |   5 +-
 src/shared/ui/Button.tsx                           |  26 +-
 src/shared/ui/Card.tsx                             |   8 +-
 src/shared/ui/Checkbox.tsx                         |   2 +-
 src/shared/ui/Dialog.tsx                           |  12 +-
 src/shared/ui/Input.tsx                            |  13 +-
 src/shared/ui/KpiCard.tsx                          |  12 +-
 src/shared/ui/Select.tsx                           |  13 +-
 src/shared/ui/StatusBadge.tsx                      |  63 ++-
 src/shared/ui/Table.tsx                            |   6 +-
 src/shared/ui/Textarea.tsx                         |  10 +-
 src/shared/ui/index.ts                             |   8 +-
 tsconfig.app.json                                  |   2 +-
 vite.config.ts                                     |  54 +-
 51 files changed, 3975 insertions(+), 790 deletions(-)
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

codex
The diff is broad and includes generated Convex output, new ADP integration code, UI changes, and Playwright specs. I’m narrowing on the task-critical paths first: lifecycle review, geofence enforcement, ADP contracts, and evidence for required gates.
  ✓ Read project rules and changed-file overview
  → Inspect lifecycle, geofence, and ADP implementation diffs
  • Inspect e2e/unit coverage and gate evidence
  • Produce actionable review verdict
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- convex/schema.ts convex/adpSync.ts convex/adpOutbound.ts convex/employeeProfiles.ts convex/shiftClock.test.ts convex/adpSync.test.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg --files -g 'CLAUDE.md' -g 'AGENTS.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- src/features/caregiver/components/ShiftDocumentationForm.tsx src/features/caregiver/components/ShiftClockInScreen.tsx src/features/caregiver/components/ShiftClockOutScreen.tsx src/features/caregiver/components/LocationStatusPanel.tsx src/features/caregiver/hooks/useCaregiverLocation.ts convex/shiftClock.ts convex/locationValidation.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -LiteralPath '.hermes-pipeline\\20260626_161701' | Select-Object -ExpandProperty FullName" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests/e2e/phase1-lifecycle.spec.ts'; Get-Content -Raw -LiteralPath 'tests/e2e/geofence.spec.ts'; Get-Content -Raw -LiteralPath 'tests/e2e/global-setup.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 751ms:
diff --git a/src/features/caregiver/components/ShiftDocumentationForm.tsx b/src/features/caregiver/components/ShiftDocumentationForm.tsx
index 8b68a49..0ed55de 100644
--- a/src/features/caregiver/components/ShiftDocumentationForm.tsx
+++ b/src/features/caregiver/components/ShiftDocumentationForm.tsx
@@ -1,275 +1,424 @@
 import { useMutation, useQuery } from 'convex/react'
 import type { FunctionReturnType } from 'convex/server'
-import { useMemo, useState } from 'react'
+import { useEffect, useMemo, useRef, useState } from 'react'
 import { api } from '../../../../convex/_generated/api'
 import type { Id } from '../../../../convex/_generated/dataModel'
 import {
   createTaskDrafts,
   noteDraftFromNote,
-  validateDocumentationDraft,
+  buildServicesProvided,
+  buildClientResponse,
+  parseSelectedServices,
+  parseSelectedGoals,
+  parseIssueChoice,
   type NoteDraft,
   type TaskDraft,
+  type ServiceLabel,
+  type GoalLabel,
+  type IssueChoice,
 } from '../model/documentationDraft'
-import { Badge } from '@/shared/ui/Badge'
+import {
+  WIZARD_STEPS,
+  validateDocumentationDraft,
+  validateStep,
+  buildAutosavePatch,
+} from '../model/documentationWizard'
+import { useCaregiverLocation } from '../hooks/useCaregiverLocation'
 import { Button } from '@/shared/ui/Button'
-import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
-import { Input } from '@/shared/ui/Input'
-import { Separator } from '@/shared/ui/Separator'
-import { Textarea } from '@/shared/ui/Textarea'
-import { ShiftTaskList } from './ShiftTaskList'
+import { ShiftClockInScreen } from './ShiftClockInScreen'
+import { ShiftClockOutScreen } from './ShiftClockOutScreen'
+import { ShiftNoteStep } from './ShiftNoteStep'
+import { ShiftSuccessScreen } from './ShiftSuccessScreen'
+import { ChevronLeft, ChevronRight } from 'lucide-react'
+import { cn } from '@/shared/lib/cn'
+import { formatStreetAddress } from '@/shared/format'
 
 type ShiftDetails = FunctionReturnType<typeof api.shiftQueries.getWithDetails>
+type TenantSettings = FunctionReturnType<typeof api.tenantSettings.get>
 type TaskId = ShiftDetails['tasks'][number]['_id']
 type TaskDraftList = TaskDraft<TaskId>[]
 
-type BrowserLocation = {
-  latitude: number
-  longitude: number
-  accuracyMeters: number
-}
+const TERMINAL_STATUSES = new Set([
+  'submitted',
+  'approved',
+  'billing_ready',
+])
 
-async function getCurrentLocation(): Promise<BrowserLocation | undefined> {
-  if (!navigator.geolocation) return undefined
-  return new Promise((resolve) => {
-    navigator.geolocation.getCurrentPosition(
-      (position) => {
-        resolve({
-          latitude: position.coords.latitude,
-          longitude: position.coords.longitude,
-          accuracyMeters: position.coords.accuracy,
-        })
-      },
-      () => resolve(undefined),
-      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
-    )
-  })
+function defaultGeofence(settings: TenantSettings | undefined) {
+  return {
+    enabled: settings?.shiftGeofence.enabled ?? false,
+    enforceClockIn: settings?.shiftGeofence.enforceClockIn ?? false,
+    enforceClockOut: settings?.shiftGeofence.enforceClockOut ?? false,
+  }
 }
 
 export function ShiftDocumentationForm({
   clerkOrgId,
   shiftId,
+  firstName,
+  onDone,
 }: {
   clerkOrgId: string
   shiftId: Id<'shifts'>
+  firstName?: string
+  onDone?: () => void
 }) {
   const details = useQuery(api.shiftQueries.getWithDetails, {
     clerkOrgId,
     shiftId,
   })
+  const settings = useQuery(api.tenantSettings.get, { clerkOrgId })
 
-  if (!details) {
+  if (!details || !settings) {
     return (
-      <Card>
-        <CardContent className="p-6">
-          <div className="text-sm text-atria-muted">Loading shift details…</div>
-        </CardContent>
-      </Card>
+      <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6">
+        <div className="text-sm text-atria-muted">Loading shift details…</div>
+      </div>
     )
   }
 
   return (
-    <ShiftDocumentationEditor
+    <ShiftDocumentationWizard
       clerkOrgId={clerkOrgId}
       details={details}
+      settings={settings}
       shiftId={shiftId}
+      firstName={firstName}
+      onDone={onDone}
     />
   )
 }
 
-function ShiftDocumentationEditor({
+function ShiftDocumentationWizard({
   clerkOrgId,
   details,
+  settings,
   shiftId,
+  firstName,
+  onDone,
 }: {
   clerkOrgId: string
   details: ShiftDetails
+  settings: TenantSettings
   shiftId: Id<'shifts'>
+  firstName?: string
+  onDone?: () => void
 }) {
   const [note, setNote] = useState<NoteDraft>(() => noteDraftFromNote(details.note))
-  const [taskUpdates, setTaskUpdates] = useState<TaskDraftList>(() =>
+  const [taskDrafts, setTaskDrafts] = useState<TaskDraftList>(() =>
     createTaskDrafts(details.tasks),
   )
-  const [nowMs] = useState(() => Date.now())
+  const [selectedServices, setSelectedServices] = useState<ServiceLabel[]>(() =>
+    parseSelectedServices(details.note?.servicesProvided),
+  )
+  const [selectedGoals, setSelectedGoals] = useState<GoalLabel[]>(() =>
+    parseSelectedGoals(details.note?.servicesProvided),
+  )
+  const [issueChoice, setIssueChoice] = useState<IssueChoice | null>(() =>
+    parseIssueChoice(details.note?.clientResponse),
+  )
+  const [confirmed, setConfirmed] = useState(false)
+  const [currentStepIndex, setCurrentStepIndex] = useState(0)
+  const [view, setView] = useState<'clockIn' | 'wizard' | 'clockOut' | 'success'>(() => {
+    if (TERMINAL_STATUSES.has(details.shift.status)) return 'success'
+    if (details.shift.clockInAt) return 'wizard'
+    return 'clockIn'
+  })
+  const [isSaving, setIsSaving] = useState(false)
+  const [saved, setSaved] = useState(false)
+  const [isPunchLoading, setIsPunchLoading] = useState(false)
+  const [saveError, setSaveError] = useState<string | null>(null)
+
+  const geofence = useMemo(
+    () => defaultGeofence(settings),
+    [settings],
+  )
+  const { state: locationState, requestLocation, setOutsideError, clearLocationError } = useCaregiverLocation()
+
   const clockIn = useMutation(api.shifts.clockIn)
   const clockOut = useMutation(api.shifts.clockOut)
+  const updateProgressNote = useMutation(api.shifts.updateProgressNote)
 
   const blockers = useMemo(
-    () => validateDocumentationDraft(note, taskUpdates, details.tasks),
-    [note, taskUpdates, details.tasks],
+    () => validateDocumentationDraft(note, taskDrafts, details.tasks),
+    [note, taskDrafts, details.tasks],
   )
 
-  const scheduledStartMs = Date.parse(details.shift.scheduledStart)
-  const isScheduledDue =
-    Number.isFinite(scheduledStartMs) && scheduledStartMs <= nowMs
-  const hasClockIn = Boolean(details.shift.clockInAt)
-  const hasClockOut = Boolean(details.shift.clockOutAt)
-
-  const editable =
-    (details.shift.status === 'in_progress' ||
-      details.shift.status === 'needs_correction') &&
-    hasClockIn &&
-    (details.shift.status === 'needs_correction' || !hasClockOut)
-  const canClockIn =
-    !hasClockIn &&
-    !hasClockOut &&
-    isScheduledDue &&
-    (details.shift.status === 'scheduled' ||
-      details.shift.status === 'in_progress')
-  const canClockOut = editable && blockers.length === 0
+  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
+
+  const autosave = (patch: Partial<NoteDraft>) => {
+    if (autosaveTimeoutRef.current) {
+      clearTimeout(autosaveTimeoutRef.current)
+    }
+    setSaved(false)
+    autosaveTimeoutRef.current = setTimeout(async () => {
+      if (Object.keys(patch).length === 0) return
+      setIsSaving(true)
+      setSaveError(null)
+      try {
+        await updateProgressNote({
+          clerkOrgId,
+          shiftId,
+          ...patch,
+        })
+        setSaved(true)
+      } catch (err) {
+        setSaveError(err instanceof Error ? err.message : 'Autosave failed')
+      } finally {
+        setIsSaving(false)
+      }
+    }, 800)
+  }
+
+  const handleNoteChange = (next: NoteDraft) => {
+    setNote(next)
+    const stepId = WIZARD_STEPS[currentStepIndex].id
+    const patch = buildAutosavePatch(stepId, next)
+    autosave(patch)
+  }
+
+  const updateServicesAndGoals = (
+    services: ServiceLabel[],
+    goals: GoalLabel[],
+  ) => {
+    const servicesProvided = buildServicesProvided(services, goals)
+    setSelectedServices(services)
+    setSelectedGoals(goals)
+    const next = { ...note, servicesProvided }
+    setNote(next)
+    autosave({ servicesProvided })
+  }
+
+  const updateIssueChoice = (choice: IssueChoice) => {
+    setIssueChoice(choice)
+    const clientResponse = buildClientResponse(choice)
+    const next = { ...note, clientResponse }
+    setNote(next)
+    autosave({ clientResponse })
+  }
 
   const handleClockIn = async () => {
+    setSaveError(null)
+    setIsPunchLoading(true)
     try {
-      const location = await getCurrentLocation()
+      const location = await requestLocation({
+        geofence,
+        punchType: 'clock_in',
+      })
+      const locationRequired = geofence.enabled && geofence.enforceClockIn
+      if (locationRequired && !location) {
+        return
+      }
       await clockIn({ clerkOrgId, shiftId, location })
+      setView('wizard')
     } catch (err) {
-      console.error('Clock in error:', err)
-      alert(err instanceof Error ? err.message : 'Clock in failed')
+      const message = err instanceof Error ? err.message : 'Clock in failed'
+      if (message.toLowerCase().includes('outside')) {
+        setOutsideError(message)
+      } else {
+        setSaveError(message)
+      }
+    } finally {
+      setIsPunchLoading(false)
     }
   }
 
   const handleClockOut = async () => {
+    setSaveError(null)
+    setIsPunchLoading(true)
     try {
-      const location = await getCurrentLocation()
+      const location = await requestLocation({
+        geofence,
+        punchType: 'clock_out',
+      })
       await clockOut({
         clerkOrgId,
         shiftId,
         location,
         note,
-        tasks: taskUpdates,
+        tasks: taskDrafts,
       })
+      setView('success')
     } catch (err) {
-      console.error('Clock out error:', err)
-      alert(err instanceof Error ? err.message : 'Clock out failed')
+      const message = err instanceof Error ? err.message : 'Clock out failed'
+      if (message.toLowerCase().includes('outside')) {
+        setOutsideError(message)
+      } else {
+        setSaveError(message)
+      }
+    } finally {
+      setIsPunchLoading(false)
     }
   }
 
-  return (
-    <Card>
-      <CardHeader>
-        <CardTitle>Shift Documentation</CardTitle>
-      </CardHeader>
-      <CardContent className="space-y-4">
-        <div className="grid grid-cols-2 gap-3">
-          <div>
-            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
-              Start Time
-            </label>
-            <Input
-              type="time"
-              value={note.startTime}
-              onChange={(e) => setNote((n) => ({ ...n, startTime: e.target.value }))}
-              disabled={!editable}
-            />
-          </div>
-          <div>
-            <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
-              End Time
-            </label>
-            <Input
-              type="time"
-              value={note.endTime}
-              onChange={(e) => setNote((n) => ({ ...n, endTime: e.target.value }))}
-              disabled={!editable}
-            />
-          </div>
-        </div>
+  const currentStepId = WIZARD_STEPS[currentStepIndex].id
+  const stepBlockers = validateStep(currentStepId, note, taskDrafts, details.tasks)
 
-        <div>
-          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
-            Services Provided
-          </label>
-          <Input
-            value={note.servicesProvided}
-            onChange={(e) => setNote((n) => ({ ...n, servicesProvided: e.target.value }))}
-            placeholder="Describe services provided..."
-            disabled={!editable}
-          />
-        </div>
+  const isDoneStep = currentStepIndex === WIZARD_STEPS.length - 1
+  const canAdvance =
+    stepBlockers.length === 0 &&
+    (currentStepId !== 'what' || selectedServices.length > 0) &&
+    (currentStepId !== 'goal' || selectedGoals.length > 0) &&
+    (currentStepId !== 'issues' || issueChoice !== null)
+  const canSubmitDone = canAdvance && confirmed
 
-        <div>
-          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
-            Client Response
-          </label>
-          <Input
-            value={note.clientResponse}
-            onChange={(e) => setNote((n) => ({ ...n, clientResponse: e.target.value }))}
-            placeholder="How did the client respond?"
-            disabled={!editable}
-          />
-        </div>
+  const goNext = () => {
+    if (currentStepIndex < WIZARD_STEPS.length - 1) {
+      setCurrentStepIndex((i) => i + 1)
+    } else {
+      setView('clockOut')
+    }
+  }
 
-        <div>
-          <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
-            Narrative
-          </label>
-          <Textarea
-            value={note.narrative}
-            onChange={(e) => setNote((n) => ({ ...n, narrative: e.target.value }))}
-            placeholder="Detailed narrative of the shift..."
-            disabled={!editable}
-          />
-        </div>
+  const goBack = () => {
+    if (currentStepIndex > 0) {
+      setCurrentStepIndex((i) => i - 1)
+    } else {
+      setView('clockIn')
+      clearLocationError()
+    }
+  }
+
+  const editStep = (stepIndex: number) => {
+    setCurrentStepIndex(stepIndex)
+  }
 
-        <Separator />
+  const clientName = details.client?.displayName ?? 'Client'
+  const address = details.client?.serviceAddress
+    ? formatStreetAddress(details.client.serviceAddress)
+    : 'No address'
 
-        <ShiftTaskList
-          clerkOrgId={clerkOrgId}
-          editable={editable}
-          taskUpdates={taskUpdates}
+  useEffect(() => {
+    return () => {
+      if (autosaveTimeoutRef.current) {
+        clearTimeout(autosaveTimeoutRef.current)
+      }
+    }
+  }, [])
+
+  useEffect(() => {
+    if (view === 'clockOut') {
+      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
+        // Location errors are captured in locationState; surface them via the checklist.
+      })
+    }
+  }, [view, geofence, requestLocation])
+
+  if (view === 'success') {
+    return (
+      <ShiftSuccessScreen
+        firstName={firstName ?? ''}
+        clientName={clientName}
+        onHome={() => {
+          onDone?.()
+          setView('clockIn')
+          setCurrentStepIndex(0)
+          setConfirmed(false)
+          clearLocationError()
+        }}
+      />
+    )
+  }
+
+  if (view === 'clockIn') {
+    return (
+      <ShiftClockInScreen
+        scheduledStart={details.shift.scheduledStart}
+        scheduledEnd={details.shift.scheduledEnd}
+        clientName={clientName}
+        address={address}
+        geofence={geofence}
+        locationState={locationState}
+        isLoading={isPunchLoading}
+        onClockIn={handleClockIn}
+      />
+    )
+  }
+
+  if (view === 'clockOut') {
+    return (
+      <ShiftClockOutScreen
+        scheduledStart={details.shift.scheduledStart}
+        clientName={clientName}
+        actualClockInAt={details.shift.clockInAt}
+        blockers={blockers}
+        geofence={geofence}
+        locationState={locationState}
+        isLoading={isPunchLoading}
+        onClockOut={handleClockOut}
+      />
+    )
+  }
+
+  return (
+    <div className="flex h-full flex-col">
+      <div className="flex-1 overflow-y-auto">
+        <ShiftNoteStep
+          stepId={currentStepId}
+          stepIndex={currentStepIndex}
+          note={note}
+          onNoteChange={handleNoteChange}
+          taskDrafts={taskDrafts}
+          onTaskDraftsChange={setTaskDrafts}
           tasks={details.tasks}
-          onChange={setTaskUpdates}
+          editable
+          clerkOrgId={clerkOrgId}
+          clientName={clientName}
+          selectedServices={selectedServices}
+          selectedGoals={selectedGoals}
+          issueChoice={issueChoice}
+          confirmed={confirmed}
+          onSelectedServicesChange={(services) =>
+            updateServicesAndGoals(services, selectedGoals)
+          }
+          onSelectedGoalsChange={(goals) =>
+            updateServicesAndGoals(selectedServices, goals)
+          }
+          onIssueChoiceChange={updateIssueChoice}
+          onConfirmedChange={setConfirmed}
+          onEditStep={editStep}
+          isSaving={isSaving}
+          saved={saved}
         />
+      </div>
+
+      {saveError && (
+        <div className="mb-4 rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3 text-sm text-atria-danger" data-testid="save-error">
+          {saveError}
+        </div>
+      )}
+
+      <div className="flex items-center justify-between gap-3">
+        <Button
+          variant="secondary"
+          size="lg"
+          className="h-[52px] min-w-[44px]"
+          onClick={goBack}
+          data-testid="wizard-back-button"
+        >
+          <ChevronLeft className="h-5 w-5" />
+          Back
+        </Button>
 
-        {blockers.length > 0 && (
-          <div className="rounded-md bg-atria-danger-bg p-3">
-            <p className="text-xs font-medium text-atria-danger mb-1">
-              Blockers
-            </p>
-            <ul className="space-y-0.5">
-              {blockers.map((blocker) => (
-                <li key={blocker} className="text-xs text-atria-danger">
-                  {blocker}
-                </li>
-              ))}
-            </ul>
-          </div>
-        )}
-
-        {canClockIn && (
-          <Button
-            variant="primary"
-            className="w-full"
-            onClick={handleClockIn}
-          >
-            Clock In
-          </Button>
-        )}
-
-        {editable && (
-          <Button
-            variant="primary"
-            className="w-full"
-            disabled={!canClockOut}
-            onClick={handleClockOut}
-          >
-            Clock Out & Submit
-          </Button>
-        )}
-
-        {details.shift.status === 'scheduled' && !isScheduledDue && (
-          <div className="rounded-md bg-atria-bg p-3 text-xs text-atria-muted">
-            This shift is scheduled for the future. Documentation opens at the
-            scheduled start time.
-          </div>
-        )}
-
-        {details.shift.status === 'submitted' && (
-          <Badge variant="info">Submitted for coordinator review</Badge>
-        )}
-        {details.shift.status === 'needs_correction' && (
-          <Badge variant="danger">Returned for corrections</Badge>
-        )}
-      </CardContent>
-    </Card>
+        <Button
+          variant="primary"
+          size="lg"
+          className={cn(
+            'h-[52px] min-w-[44px] rounded-full',
+            currentStepId !== 'issues' && WIZARD_STEPS[currentStepIndex].bgAccent,
+          )}
+          onClick={goNext}
+          disabled={isDoneStep ? !canSubmitDone : !canAdvance}
+          data-testid="wizard-next-button"
+        >
+          {isDoneStep ? 'Submit my notes' : 'Next Step'}
+          {isDoneStep ? (
+            <span className="ml-2">✓</span>
+          ) : (
+            <ChevronRight className="h-5 w-5" />
+          )}
+        </Button>
+      </div>
+    </div>
   )
 }
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it

 succeeded in 811ms:
diff --git a/convex/adpSync.ts b/convex/adpSync.ts
index 562433d..37ba06b 100644
--- a/convex/adpSync.ts
+++ b/convex/adpSync.ts
@@ -1,15 +1,341 @@
 import { v } from 'convex/values'
-import { internalAction } from './_generated/server'
+import {
+  internalMutation,
+  internalQuery,
+  mutation,
+  type MutationCtx,
+  type QueryCtx,
+} from './_generated/server'
+import { internal } from './_generated/api'
+import type { Id } from './_generated/dataModel'
+import { assertTenantDoc, requireTenantRole } from './authHelpers'
+import { adpEnvVarNames, isAdpConfigured } from './integrations/adp/config'
 
-export const adpSyncPunch = internalAction({
-  args: { punchId: v.id('timePunches') },
-  handler: async (_ctx, { punchId }) => {
-    // Stub: ADP credentials are not configured yet. When credentials are
-    // available this action will queue the punch to ADP Workforce Now.
-    return {
-      status: 'skipped',
-      reason: 'ADP credentials not configured',
-      punchId: punchId as string,
+type ClaimResult =
+  | {
+      type: 'already_synced'
+      eventId: Id<'integrationEvents'>
+      response?: unknown
     }
+  | { type: 'in_flight'; eventId: Id<'integrationEvents'> }
+  | { type: 'max_attempts'; attempt: number }
+  | { type: 'claimed'; eventId: Id<'integrationEvents'>; attempt: number }
+
+const RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]
+const IN_FLIGHT_STALE_MS = 5 * 60 * 1000
+
+const adpPunchSyncStatus = v.union(
+  v.literal('pending_credentials'),
+  v.literal('queued'),
+  v.literal('synced'),
+  v.literal('error'),
+)
+
+const adpEmployeeSyncStatus = v.union(
+  v.literal('pending_credentials'),
+  v.literal('queued'),
+  v.literal('synced'),
+  v.literal('error'),
+  v.literal('matched'),
+  v.literal('created'),
+)
+
+export function sanitizeError(error: unknown): string {
+  const message = error instanceof Error ? error.message : String(error)
+  return redactSecrets(message.slice(0, 500))
+}
+
+function redactSecrets(message: string): string {
+  let redacted = message
+
+  for (const name of adpEnvVarNames()) {
+    const value = process.env[name]?.trim()
+    if (value) {
+      redacted = redacted.split(value).join(`[REDACTED:${name}]`)
+    }
+  }
+
+  redacted = redacted.replace(
+    /Basic\s+[A-Za-z0-9+/=]{10,}/g,
+    'Basic [REDACTED]',
+  )
+  redacted = redacted.replace(
+    /Bearer\s+[A-Za-z0-9_\-./=]{10,}/g,
+    'Bearer [REDACTED]',
+  )
+  redacted = redacted.replace(
+    /(token['"]?\s*[:=]\s*)['"]?[A-Za-z0-9_\-./=]{8,}['"]?/gi,
+    '$1[REDACTED]',
+  )
+
+  return redacted
+}
+
+export function normalizeEmail(email: string): string {
+  return email.trim().toLowerCase()
+}
+
+export function idempotencyKey(kind: string, refId: string): string {
+  return `${kind}:${refId}`
+}
+
+export function chooseRetryDelayMs(attempt: number): number {
+  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1]
+}
+
+export const loadPunchForAdpSync = internalQuery({
+  args: { timePunchId: v.id('timePunches') },
+  handler: async (ctx: QueryCtx, { timePunchId }) => {
+    const punch = await ctx.db.get(timePunchId)
+    if (!punch) throw new Error('Time punch not found.')
+    return punch
   },
 })
+
+export const loadEmployeeProfileForAdpSync = internalQuery({
+  args: { employeeProfileId: v.id('employeeProfiles') },
+  handler: async (ctx: QueryCtx, { employeeProfileId }) => {
+    const profile = await ctx.db.get(employeeProfileId)
+    if (!profile) throw new Error('Employee profile not found.')
+    return profile
+  },
+})
+
+export const findEmployeeProfileByClerkUserId = internalQuery({
+  args: { tenantId: v.id('tenants'), clerkUserId: v.string() },
+  handler: async (ctx: QueryCtx, { tenantId, clerkUserId }) => {
+    return ctx.db
+      .query('employeeProfiles')
+      .withIndex('by_tenant_clerk_user', (q) =>
+        q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
+      )
+      .unique()
+  },
+})
+
+export const findEmployeeProfilesByTenant = internalQuery({
+  args: { tenantId: v.id('tenants') },
+  handler: async (ctx: QueryCtx, { tenantId }) => {
+    return ctx.db
+      .query('employeeProfiles')
+      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
+      .collect()
+  },
+})
+
+export const isAdpConfiguredForTenant = internalQuery({
+  args: { tenantId: v.id('tenants') },
+  handler: async (ctx: QueryCtx, { tenantId }) => {
+    return isAdpConfigured(ctx, tenantId)
+  },
+})
+
+export const patchPunchAdpStatus = internalMutation({
+  args: {
+    timePunchId: v.id('timePunches'),
+    tenantId: v.id('tenants'),
+    adpSyncStatus: adpPunchSyncStatus,
+    adpPunchId: v.optional(v.string()),
+    adpError: v.optional(v.string()),
+  },
+  handler: async (ctx: MutationCtx, args) => {
+    const punch = await ctx.db.get(args.timePunchId)
+    if (!punch) throw new Error('Time punch not found.')
+    assertTenantDoc(punch, args.tenantId)
+
+    const patch: {
+      adpSyncStatus: 'pending_credentials' | 'queued' | 'synced' | 'error'
+      adpPunchId?: string
+      adpError?: string
+    } = { adpSyncStatus: args.adpSyncStatus }
+    if (args.adpPunchId !== undefined) patch.adpPunchId = args.adpPunchId
+    if (args.adpError !== undefined || args.adpSyncStatus === 'synced') {
+      patch.adpError = args.adpError
+    }
+    await ctx.db.patch(args.timePunchId, patch)
+  },
+})
+
+export const patchWorkerAdpStatus = internalMutation({
+  args: {
+    employeeProfileId: v.id('employeeProfiles'),
+    tenantId: v.id('tenants'),
+    adpSyncStatus: adpEmployeeSyncStatus,
+    adpAssociateOid: v.optional(v.string()),
+    adpWorkerId: v.optional(v.string()),
+    adpError: v.optional(v.string()),
+  },
+  handler: async (ctx: MutationCtx, args) => {
+    const profile = await ctx.db.get(args.employeeProfileId)
+    if (!profile) throw new Error('Employee profile not found.')
+    assertTenantDoc(profile, args.tenantId)
+
+    const isSuccessStatus =
+      args.adpSyncStatus === 'synced' ||
+      args.adpSyncStatus === 'matched' ||
+      args.adpSyncStatus === 'created'
+
+    const patch: {
+      adpSyncStatus:
+        | 'pending_credentials'
+        | 'queued'
+        | 'synced'
+        | 'error'
+        | 'matched'
+        | 'created'
+      adpAssociateOid?: string
+      adpWorkerId?: string
+      adpError?: string
+    } = { adpSyncStatus: args.adpSyncStatus }
+    if (args.adpAssociateOid !== undefined) {
+      patch.adpAssociateOid = args.adpAssociateOid
+    }
+    if (args.adpWorkerId !== undefined) patch.adpWorkerId = args.adpWorkerId
+    if (args.adpError !== undefined || isSuccessStatus) {
+      patch.adpError = args.adpError
+    }
+    await ctx.db.patch(args.employeeProfileId, patch)
+  },
+})
+
+export const upsertMatchedEmployeeProfile = internalMutation({
+  args: {
+    tenantId: v.id('tenants'),
+    associateOID: v.string(),
+    workerID: v.optional(v.string()),
+    displayName: v.string(),
+    email: v.string(),
+    matchProfileId: v.optional(v.id('employeeProfiles')),
+  },
+  handler: async (ctx: MutationCtx, args) => {
+    if (args.matchProfileId) {
+      const match = await ctx.db.get(args.matchProfileId)
+      if (!match) throw new Error('Employee profile not found.')
+      assertTenantDoc(match, args.tenantId)
+      await ctx.db.patch(args.matchProfileId, {
+        adpAssociateOid: args.associateOID,
+        adpWorkerId: args.workerID,
+        adpSyncStatus: 'matched',
+      })
+      return args.matchProfileId
+    }
+
+    return ctx.db.insert('employeeProfiles', {
+      tenantId: args.tenantId,
+      displayName: args.displayName,
+      email: args.email,
+      adpAssociateOid: args.associateOID,
+      adpWorkerId: args.workerID,
+      adpSyncStatus: 'created',
+      createdAt: new Date().toISOString(),
+    })
+  },
+})
+
+export const claimIntegrationEvent = internalMutation({
+  args: {
+    tenantId: v.id('tenants'),
+    kind: v.string(),
+    refId: v.string(),
+    idempotencyKey: v.string(),
+    request: v.optional(v.any()),
+    maxAttempts: v.number(),
+  },
+  handler: async (ctx: MutationCtx, args): Promise<ClaimResult> => {
+    const events = await ctx.db
+      .query('integrationEvents')
+      .withIndex('by_tenant_idemp', (q) =>
+        q.eq('tenantId', args.tenantId).eq('idempotencyKey', args.idempotencyKey),
+      )
+      .order('desc')
+      .collect()
+
+    for (const event of events) {
+      if (event.status === 'success') {
+        return {
+          type: 'already_synced',
+          eventId: event._id,
+          response: event.response,
+        }
+      }
+      if (event.status === 'attempting') {
+        const createdAt = new Date(event.createdAt).getTime()
+        if (Date.now() - createdAt < IN_FLIGHT_STALE_MS) {
+          return { type: 'in_flight', eventId: event._id }
+        }
+      }
+    }
+
+    const latestAttempt = events.find((e) => typeof e.attempt === 'number')
+    const attempt = (latestAttempt?.attempt ?? 0) + 1
+    if (attempt > args.maxAttempts) {
+      return { type: 'max_attempts', attempt }
+    }
+
+    const eventId = await ctx.db.insert('integrationEvents', {
+      tenantId: args.tenantId,
+      provider: 'adp',
+      kind: args.kind,
+      refId: args.refId,
+      idempotencyKey: args.idempotencyKey,
+      status: 'attempting',
+      attempt,
+      request: args.request,
+      createdAt: new Date().toISOString(),
+    })
+
+    return { type: 'claimed', eventId, attempt }
+  },
+})
+
+export const patchIntegrationEvent = internalMutation({
+  args: {
+    eventId: v.id('integrationEvents'),
+    status: v.string(),
+    response: v.optional(v.any()),
+    completedAt: v.optional(v.string()),
+    nextRetryAt: v.optional(v.string()),
+  },
+  handler: async (ctx: MutationCtx, args) => {
+    await ctx.db.patch(args.eventId, {
+      status: args.status,
+      response: args.response,
+      completedAt: args.completedAt,
+      nextRetryAt: args.nextRetryAt,
+    })
+  },
+})
+
+export const triggerInitialWorkerLoad = mutation({
+  args: { clerkOrgId: v.string() },
+  handler: async (ctx, { clerkOrgId }) => {
+    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
+      'org:admin',
+    ])
+    await ctx.scheduler.runAfter(
+      0,
+      internal.adpOutbound.adpInitialWorkerLoad,
+      { tenantId },
+    )
+    return { status: 'queued' }
+  },
+})
+
+export const adpSyncStatusLiterals = {
+  adpPunchSyncStatus,
+  adpEmployeeSyncStatus,
+}
+
+export type AdpPunchSyncStatus =
+  | 'pending_credentials'
+  | 'queued'
+  | 'synced'
+  | 'error'
+
+export type AdpEmployeeSyncStatus =
+  | 'pending_credentials'
+  | 'queued'
+  | 'synced'
+  | 'error'
+  | 'matched'
+  | 'created'
diff --git a/convex/schema.ts b/convex/schema.ts
index 02719f6..5dd2ba9 100644
--- a/convex/schema.ts
+++ b/convex/schema.ts
@@ -14,6 +14,7 @@ const adpEmployeeSyncStatus = v.union(
   v.literal('synced'),
   v.literal('error'),
   v.literal('matched'),
+  v.literal('created'),
 )
 
 const integrationConnectionStatus = v.union(
@@ -173,7 +174,9 @@ export default defineSchema({
     status: integrationConnectionStatus,
     lastCheckedAt: v.optional(v.string()),
     note: v.optional(v.string()),
-  }).index('by_tenant_provider', ['tenantId', 'provider']),
+  })
+    .index('by_tenant_provider', ['tenantId', 'provider'])
+    .index('by_provider_status', ['provider', 'status']),
 
   integrationEvents: defineTable({
     tenantId: v.id('tenants'),
@@ -182,8 +185,11 @@ export default defineSchema({
     refId: v.optional(v.string()),
     idempotencyKey: v.string(),
     status: v.string(),
+    attempt: v.optional(v.number()),
     request: v.optional(v.any()),
     response: v.optional(v.any()),
+    completedAt: v.optional(v.string()),
+    nextRetryAt: v.optional(v.string()),
     createdAt: v.string(),
   })
     .index('by_tenant_idemp', ['tenantId', 'idempotencyKey'])
diff --git a/convex/shiftClock.test.ts b/convex/shiftClock.test.ts
index adae542..3f173e7 100644
--- a/convex/shiftClock.test.ts
+++ b/convex/shiftClock.test.ts
@@ -1,7 +1,11 @@
 import { describe, expect, it } from 'vitest'
 import { readFileSync } from 'node:fs'
 import { resolve } from 'node:path'
+import { convexTest } from 'convex-test'
 import { haversineDistanceMeters } from './locationValidation'
+import schema from './schema'
+import { api } from './_generated/api'
+import type { Id } from './_generated/dataModel'
 
 const shiftSourcePath = resolve(__dirname, 'shifts.ts')
 const shiftSource = readFileSync(shiftSourcePath, 'utf-8')
@@ -119,7 +123,7 @@ describe('clock punch side effects', () => {
   })
 
   it('enqueues ADP sync after clock punches', () => {
-    expect(shiftSource).toContain('internal.adpSync.adpSyncPunch')
+    expect(shiftSource).toContain('internal.adpOutbound.adpSyncPunch')
   })
 })
 
@@ -158,3 +162,240 @@ describe('haversine sanity for test coordinates', () => {
     expect(haversineDistanceMeters(home, nearby)).toBeLessThan(100)
   })
 })
+
+const runtimeModules = import.meta.glob('./**/*.*s')
+
+function createRuntimeConvex() {
+  return convexTest({ schema, modules: runtimeModules })
+}
+
+async function seedShift(
+  t: ReturnType<typeof createRuntimeConvex>,
+  options: {
+    clerkOrgId: string
+    caregiverId: string
+    geofenceEnabled?: boolean
+    clientLatitude?: number
+    clientLongitude?: number
+  },
+) {
+  return t.run(async (ctx) => {
+    const tenantId = await ctx.db.insert('tenants', {
+      clerkOrgId: options.clerkOrgId,
+      name: 'Test Agency',
+      slug: 'test-agency',
+      createdAt: new Date().toISOString(),
+    })
+
+    await ctx.db.insert('tenantMembers', {
+      tenantId,
+      clerkUserId: options.caregiverId,
+      role: 'org:caregiver',
+      displayName: 'Caregiver',
+      email: 'caregiver@example.com',
+    })
+
+    await ctx.db.insert('tenantSettings', {
+      tenantId,
+      shiftGeofence: {
+        enabled: options.geofenceEnabled ?? false,
+        enforceClockIn: options.geofenceEnabled ?? false,
+        enforceClockOut: options.geofenceEnabled ?? false,
+        defaultRadiusMeters: 100,
+        maxAccuracyMeters: 50,
+      },
+    })
+
+    const clientId = await ctx.db.insert('clients', {
+      tenantId,
+      displayName: 'Test Client',
+      serviceType: 'SLS',
+      authorizationHours: 100,
+      riskFlags: [],
+      serviceAddress: {
+        line1: '123 Main St',
+        city: 'Minneapolis',
+        state: 'MN',
+        postalCode: '55401',
+        latitude: options.clientLatitude,
+        longitude: options.clientLongitude,
+      },
+    })
+
+    const shiftId = await ctx.db.insert('shifts', {
+      tenantId,
+      clientId,
+      caregiverId: options.caregiverId,
+      scheduledStart: '2020-01-01T08:00:00Z',
+      scheduledEnd: '2020-01-01T16:00:00Z',
+      status: 'scheduled',
+      serviceType: 'SLS',
+      rate: 25,
+    })
+
+    await ctx.db.insert('progressNotes', {
+      tenantId,
+      shiftId,
+      startTime: '',
+      endTime: '',
+      servicesProvided: '',
+      clientResponse: '',
+      narrative: '',
+    })
+
+    await ctx.db.insert('shiftTasks', {
+      tenantId,
+      shiftId,
+      title: 'Upload shift documentation proof',
+      requiredProof: true,
+      status: 'pending',
+    })
+
+    return { tenantId, clientId, shiftId }
+  })
+}
+
+function asCaregiverRuntime(
+  t: ReturnType<typeof createRuntimeConvex>,
+  caregiverId: string,
+  clerkOrgId: string,
+) {
+  return t.withIdentity({
+    subject: caregiverId,
+    org_id: clerkOrgId,
+    org_role: 'org:caregiver',
+  })
+}
+
+describe('clock-in geofence runtime', () => {
+  it('allows clock-in without location when geofence is disabled', async () => {
+    const t = createRuntimeConvex()
+    const clerkOrgId = 'org_geo_disabled'
+    const caregiverId = 'user_cg_geo_disabled'
+    const { shiftId } = await seedShift(t, {
+      clerkOrgId,
+      caregiverId,
+      geofenceEnabled: false,
+    })
+
+    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
+      api.shifts.clockIn,
+      { clerkOrgId, shiftId },
+    )
+
+    expect(result.punchId).toBeDefined()
+
+    const punch = await t.run(async (ctx) => {
+      return ctx.db.get(result.punchId as Id<'timePunches'>)
+    })
+    expect(punch?.location).toBeUndefined()
+  })
+
+  it('allows clock-in inside radius and stores location evidence', async () => {
+    const t = createRuntimeConvex()
+    const clerkOrgId = 'org_geo_inside'
+    const caregiverId = 'user_cg_geo_inside'
+    const { shiftId } = await seedShift(t, {
+      clerkOrgId,
+      caregiverId,
+      geofenceEnabled: true,
+      clientLatitude: 44.9778,
+      clientLongitude: -93.265,
+    })
+
+    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
+      api.shifts.clockIn,
+      {
+        clerkOrgId,
+        shiftId,
+        location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 5 },
+      },
+    )
+
+    expect(result.punchId).toBeDefined()
+
+    const punch = await t.run(async (ctx) => {
+      return ctx.db.get(result.punchId as Id<'timePunches'>)
+    })
+    expect(punch?.location).toBeDefined()
+    expect(punch?.location?.withinGeofence).toBe(true)
+  })
+
+  it('rejects clock-in outside radius and creates no punch', async () => {
+    const t = createRuntimeConvex()
+    const clerkOrgId = 'org_geo_outside'
+    const caregiverId = 'user_cg_geo_outside'
+    const { tenantId, shiftId } = await seedShift(t, {
+      clerkOrgId,
+      caregiverId,
+      geofenceEnabled: true,
+      clientLatitude: 44.9778,
+      clientLongitude: -93.265,
+    })
+
+    await expect(
+      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
+        api.shifts.clockIn,
+        {
+          clerkOrgId,
+          shiftId,
+          location: { latitude: 45.0, longitude: -93.0, accuracyMeters: 5 },
+        },
+      ),
+    ).rejects.toThrow('outside the allowed')
+
+    const punches = await t.run(async (ctx) => {
+      return ctx.db
+        .query('timePunches')
+        .withIndex('by_tenant_shift_type', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', 'clock_in'),
+        )
+        .collect()
+    })
+    expect(punches).toHaveLength(0)
+  })
+
+  it('rejects clock-in when required location is missing', async () => {
+    const t = createRuntimeConvex()
+    const clerkOrgId = 'org_geo_missing'
+    const caregiverId = 'user_cg_geo_missing'
+    const { shiftId } = await seedShift(t, {
+      clerkOrgId,
+      caregiverId,
+      geofenceEnabled: true,
+      clientLatitude: 44.9778,
+      clientLongitude: -93.265,
+    })
+
+    await expect(
+      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
+        api.shifts.clockIn,
+        { clerkOrgId, shiftId },
+      ),
+    ).rejects.toThrow('Location is required')
+  })
+
+  it('rejects clock-in when location accuracy exceeds agency limit', async () => {
+    const t = createRuntimeConvex()
+    const clerkOrgId = 'org_geo_accuracy'
+    const caregiverId = 'user_cg_geo_accuracy'
+    const { shiftId } = await seedShift(t, {
+      clerkOrgId,
+      caregiverId,
+      geofenceEnabled: true,
+      clientLatitude: 44.9778,
+      clientLongitude: -93.265,
+    })
+
+    await expect(
+      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
+        api.shifts.clockIn,
+        {
+          clerkOrgId,
+          shiftId,
+          location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 200 },
+        },
+      ),
+    ).rejects.toThrow('exceeds the agency limit')
+  })
+})
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it

2026-06-26T23:43:44.400649Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.8 seconds
Output:

 exited 1 in 778ms:
 succeeded in 839ms:
import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  signInWithClerk,
  signOut,
} from './helpers/auth'

const CLIENT_NAME = 'Sam Lee'

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  assertE2ECredentialsConfigured()
})

test('full caregiver-to-billing lifecycle with geofence disabled', async ({ page, context }) => {
  // Ensure geofence is disabled for this flow
  await context.clearPermissions()

  // ---- Caregiver: clock in ----
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, {
    hasText: CLIENT_NAME,
  })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })

  // Assert initial status word + color
  const statusBadge = shiftCard.locator('[data-testid="shift-status-badge"]')
  await expect(statusBadge).toHaveText('UPCOMING')
  await expect(statusBadge).toHaveClass(/bg-atria-info/)

  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()
  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()

  await page.locator('[data-testid="clock-in-button"]').click()
  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

  // ---- Complete 6-step note ----
  // Step 1: When
  await page.locator('[data-testid="start-time-input"]').fill('09:00')
  await page.locator('[data-testid="end-time-input"]').fill('13:00')
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-what"]')).toBeAttached()

  // Step 2: What
  await page.locator('[data-testid="service-option-Bathing"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-how"]')).toBeAttached()

  // Step 3: How
  await page.locator('[data-testid="narrative-textarea"]').fill(
    'I helped Sam with a warm bath, breakfast, and light housekeeping. He was in good spirits and ate a full meal.',
  )
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-goal"]')).toBeAttached()

  // Step 4: Goal
  await page.locator('[data-testid="goal-option-Walk a little each day"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-issues"]')).toBeAttached()

  // Step 5: Issues + task proof
  await page.locator('[data-testid="issue-choice-no"]').click()
  const taskCheckbox = page.locator('[data-testid^="task-complete-checkbox-"]').first()
  await taskCheckbox.check()
  // Upload a tiny proof file
  const proofInput = page.locator('[data-testid^="task-proof-input-"]').first()
  await proofInput.setInputFiles({
    name: 'proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('shift proof'),
  })
  await expect(page.locator('text=proof.txt')).toBeVisible({ timeout: 10000 })
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached()

  // Step 6: Done / confirm
  // Clock Out (via the wizard submit button) is disabled until the note is complete.
  const nextButton = page.locator('[data-testid="wizard-next-button"]')
  await expect(nextButton).toBeDisabled()

  await page.locator('[data-testid="confirm-checkbox"]').check()
  await expect(nextButton).toBeEnabled()

  await nextButton.click()
  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="complete-checklist"]')).toBeVisible()
  const clockOutButton = page.locator('[data-testid="clock-out-button"]')
  await expect(clockOutButton).toBeEnabled()

  // ---- Clock out / submit ----
  await clockOutButton.click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: request correction ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)

  const reviewRow = page.locator(`[data-testid^="review-row-"]`, {
    hasText: CLIENT_NAME,
  })
  await expect(reviewRow).toBeVisible({ timeout: 15000 })
  await expect(reviewRow).toHaveAttribute('data-shift-status', 'submitted')
  const reviewStatus = reviewRow.locator('[data-testid="review-status-badge"]')
  await expect(reviewStatus).toHaveText('Submitted')
  await expect(reviewStatus).toHaveClass(/bg-atria-info/)

  await reviewRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="review-comment-input"]')).toBeVisible()
  await page.locator('[data-testid="review-comment-input"]').fill('Please add the exact start time.')
  await page.locator('[data-testid="request-correction-button"]').click()

  // Wait to return to queue
  const returnedRow = page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })
  await expect(returnedRow).toBeVisible({ timeout: 15000 })
  await expect(returnedRow).toHaveAttribute('data-shift-status', 'needs_correction')
  const returnedStatus = returnedRow.locator('[data-testid="review-status-badge"]')
  await expect(returnedStatus).toHaveText('Needs correction')
  await expect(returnedStatus).toHaveClass(/bg-atria-danger/)

  // ---- Caregiver: fix and resubmit ----
  await signOut(page)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const correctionCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: CLIENT_NAME })
  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveText('CORRECTION')
  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveClass(/bg-atria-danger/)
  await correctionCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached()
  await page.locator('[data-testid="start-time-input"]').fill('09:15')
  await page.locator('[data-testid="wizard-next-button"]').click()
  // Navigate to done step quickly via edit links
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached({ timeout: 15000 })
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.locator('[data-testid="wizard-next-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  await page.locator('[data-testid="clock-out-button"]').click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: approve -> billing ready ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)

  const resubmittedRow = page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })
  await expect(resubmittedRow).toBeVisible({ timeout: 15000 })
  await expect(resubmittedRow).toHaveAttribute('data-shift-status', 'submitted')
  const resubmittedStatus = resubmittedRow.locator('[data-testid="review-status-badge"]')
  await expect(resubmittedStatus).toHaveText('Submitted')
  await expect(resubmittedStatus).toHaveClass(/bg-atria-info/)

  await resubmittedRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="approve-button"]')).toBeVisible()
  await page.locator('[data-testid="approve-button"]').click()

  // Approved shifts appear under the Approved filter and are billing_ready.
  await page.locator('[data-testid="filter-approved"]').click()
  const approvedRow = page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })
  await expect(approvedRow).toBeVisible({ timeout: 15000 })
  await expect(approvedRow).toHaveAttribute('data-shift-status', 'billing_ready')
  const approvedStatus = approvedRow.locator('[data-testid="review-status-badge"]')
  await expect(approvedStatus).toHaveText('Approved')
  await expect(approvedStatus).toHaveClass(/bg-atria-success/)
})

import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  assertE2ECredentialsConfigured,
  resetE2EShifts,
  signInWithClerk,
  signOut,
} from './helpers/auth'

const GEOFENCE_CLIENT = 'Maya Torres'
const INSIDE_COORDS = { latitude: 44.9779, longitude: -93.2649 }
const OUTSIDE_COORDS = { latitude: 45.0, longitude: -93.0 }

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  assertE2ECredentialsConfigured()
})

test.afterEach(async ({ page }) => {
  // Restore fixture shifts to a clean scheduled state and disable geofence
  // so each scenario starts from the same baseline.
  await resetE2EShifts(page)
})

async function enableGeofence(page: import('@playwright/test').Page) {
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/settings/geofence')
  await expect(page).toHaveURL(/settings\/geofence/)

  await page.locator('[data-testid="geofence-enabled-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-in-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-out-checkbox"]').check()
  await page.locator('[data-testid="save-geofence-button"]').click()
  await expect(page.locator('[data-testid="geofence-message"]')).toHaveText('Geofence settings saved.', { timeout: 10000 })
  await signOut(page)
}

async function openGeofenceShift(page: import('@playwright/test').Page) {
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()
  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
}

test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
  await enableGeofence(page)

  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(INSIDE_COORDS)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await openGeofenceShift(page)

  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()

  await page.locator('[data-testid="clock-in-button"]').click()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

  // Fill note quickly and clock out
  await page.locator('[data-testid="start-time-input"]').fill('14:00')
  await page.locator('[data-testid="end-time-input"]').fill('18:00')
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="service-option-Bathing"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="narrative-textarea"]').fill(
    'I helped Maya with mobility exercises and a meal. She was steady on her feet.',
  )
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="goal-option-Walk a little each day"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="issue-choice-no"]').click()
  await page.locator('[data-testid^="task-complete-checkbox-"]').first().check()
  await page.locator('[data-testid^="task-proof-input-"]').first().setInputFiles({
    name: 'geo-proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('geofence proof'),
  })
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.locator('[data-testid="wizard-next-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  const outPanel = page.locator('[data-testid="clock-out-location-panel"]')
  await expect(outPanel).toBeVisible()
  await expect(outPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
  await expect(page.locator('[data-testid="clock-out-button"]')).toBeEnabled()
  await page.locator('[data-testid="clock-out-button"]').click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })
})

test('geofence outside radius shows blocked UI and server rejects punch', async ({ page, context }) => {
  await enableGeofence(page)

  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(OUTSIDE_COORDS)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await openGeofenceShift(page)

  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()

  const clockInButton = page.locator('[data-testid="clock-in-button"]')
  await clockInButton.click()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
  await expect(clockInButton).toBeDisabled()
})

test('denied geolocation permission shows blocked UI and creates no punch', async ({ page, context }) => {
  await enableGeofence(page)

  await context.clearPermissions()
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await openGeofenceShift(page)

  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()

  const clockInButton = page.locator('[data-testid="clock-in-button"]')
  await clockInButton.click()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
  await expect(clockInButton).toBeDisabled()
})

test('disabling geofence stops requesting browser location', async ({ page, context }) => {
  // Geofence is already disabled by the afterEach reset.
  await context.clearPermissions()
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await openGeofenceShift(page)

  await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
})

import { chromium, type FullConfig } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  e2eCredentialsAvailable,
  signInWithClerk,
  signOut,
} from './helpers/auth'

type RoleCredentials = {
  email: string
  password: string
}

async function extractClerkUserId(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const clerk = (window as unknown as Record<string, unknown>).Clerk as
      | { user?: { id: string } }
      | undefined
    return clerk?.user?.id ?? null
  })
}

async function seedE2EFixtures(
  authToken: string,
  userIds: {
    adminUserId: string
    coordinatorUserId: string
    caregiverUserId: string
  },
) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot seed e2e fixtures.')
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      path: 'seed:seedE2E',
      args: {
        clerkOrgId: E2E_ORG_ID,
        adminUserId: userIds.adminUserId,
        coordinatorUserId: userIds.coordinatorUserId,
        caregiverUserId: userIds.caregiverUserId,
      },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`seedE2E failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('seedE2E result:', result)
}

async function extractClerkToken(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => {
    const keys = ['__clerk_client_jwt', '__session', '__clerk_session_jwt']
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value) return value
    }
    return null
  })
}

export default async function globalSetup(config: FullConfig) {
  if (!e2eCredentialsAvailable()) {
    console.log('E2E credentials not configured; skipping global seed.')
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({
    baseURL: config.projects[0]?.use.baseURL,
  })

  try {
    const roles: Record<string, RoleCredentials> = {
      admin: { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
      coordinator: { email: E2E_COORDINATOR_EMAIL, password: E2E_COORDINATOR_PASSWORD },
      caregiver: { email: E2E_CAREGIVER_EMAIL, password: E2E_CAREGIVER_PASSWORD },
    }

    const userIds: Record<string, string> = {}
    for (const [role, credentials] of Object.entries(roles)) {
      await signInWithClerk(page, credentials.email, credentials.password, E2E_ORG_ID)
      const userId = await extractClerkUserId(page)
      if (!userId) {
        throw new Error(`Could not extract Clerk user id for ${role}.`)
      }
      userIds[role] = userId
      await signOut(page)
    }

    // Sign back in as admin so we can call the seed mutation with an admin token.
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

    // Bootstrap the tenant if this is the first run against this org.
    await page.goto('/select-agency')
    await page.waitForLoadState('networkidle')

    const token = await extractClerkToken(page)
    if (!token) {
      throw new Error('Could not extract Clerk session token; cannot seed e2e fixtures.')
    }

    await seedE2EFixtures(token, {
      adminUserId: userIds.admin,
      coordinatorUserId: userIds.coordinator,
      caregiverUserId: userIds.caregiver,
    })
  } finally {
    await browser.close()
  }
}


 succeeded in 1031ms:
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\fix_iter1.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\fix_iter1.prompt.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postfix1_lint.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postfix1_typecheck.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postfix1_unit.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postimpl_lint.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postimpl_typecheck.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\gate_postimpl_unit.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\implement.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\implement.prompt.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\implementation-plan.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\plan_codex.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\plan_codex.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\plan_codex.prompt.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\plan_final.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter1.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter1.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter1.prompt.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter2.log
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter2.prompt.md
C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\summary.md

codex
The first pass shows the e2e specs are present, but there are still untracked implementation files that `git diff` does not show. I’m reading those directly and checking them against the acceptance criteria.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/adpOutbound.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/employeeProfiles.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/integrations/adp/config.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/integrations/adp/adpClient.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/adpSync.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 852ms:
'use node'

import { v } from 'convex/values'
import { internalAction, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { getSharedMockAdp } from './integrations/adp/mockAdp'
import { NotConfiguredError } from './integrations/adp/errors'
import type { AdpPort } from './integrations/adp/adpPort'
import {
  chooseRetryDelayMs,
  idempotencyKey,
  normalizeEmail,
  sanitizeError,
} from './adpSync'

declare const process: { env: Record<string, string | undefined> }

const MAX_ATTEMPTS = 5

async function getAdpPort(): Promise<AdpPort> {
  if (process.env.ADP_MOCK_ADAPTER === 'true') {
    return getSharedMockAdp()
  }
  const { AdpClient } = await import('./integrations/adp/adpClient')
  return new AdpClient()
}

async function patchEvent(
  ctx: ActionCtx,
  eventId: Id<'integrationEvents'>,
  patch: {
    status: string
    response?: unknown
    completedAt?: string
    nextRetryAt?: string
  },
) {
  await ctx.runMutation(internal.adpSync.patchIntegrationEvent, {
    eventId,
    ...patch,
  })
}

export const adpSyncPunch = internalAction({
  args: { timePunchId: v.id('timePunches') },
  handler: async (ctx: ActionCtx, { timePunchId }) => {
    const punch = await ctx.runQuery(internal.adpSync.loadPunchForAdpSync, {
      timePunchId,
    })
    const tenantId = punch.tenantId

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const profile = await ctx.runQuery(
      internal.adpSync.findEmployeeProfileByClerkUserId,
      { tenantId, clerkUserId: punch.caregiverId },
    )

    if (!profile || !profile.adpAssociateOid) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Caregiver employee profile or ADP associate OID missing.',
      })
      return { status: 'error' }
    }

    const key = idempotencyKey('punch', timePunchId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'punch',
        refId: timePunchId as string,
        idempotencyKey: key,
        request: {
          timePunchId: timePunchId as string,
          punchType: punch.punchType,
          associateOID: profile.adpAssociateOid,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.postPunch({
        idempotencyKey: key,
        timePunchId: timePunchId as string,
        associateOID: profile.adpAssociateOid,
        punchType: punch.punchType,
        at: punch.at,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
        adpPunchId: result.punchId,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: { adpPunchId: result.punchId },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpPunchId: result.punchId }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncPunch,
          { timePunchId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpSyncWorker = internalAction({
  args: { employeeProfileId: v.id('employeeProfiles') },
  handler: async (ctx: ActionCtx, { employeeProfileId }) => {
    const profile = await ctx.runQuery(
      internal.adpSync.loadEmployeeProfileForAdpSync,
      { employeeProfileId },
    )
    const tenantId = profile.tenantId

    if (profile.adpAssociateOid) {
      if (profile.adpSyncStatus !== 'synced') {
        await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
          employeeProfileId,
          tenantId,
          adpSyncStatus: 'synced',
        })
      }
      return { status: 'already_synced' }
    }

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const key = idempotencyKey('worker', employeeProfileId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'worker',
        refId: employeeProfileId as string,
        idempotencyKey: key,
        request: {
          employeeProfileId: employeeProfileId as string,
          displayName: profile.displayName,
          email: profile.email,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.createWorker({
        idempotencyKey: key,
        employeeProfileId: employeeProfileId as string,
        displayName: profile.displayName,
        email: profile.email,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
        adpAssociateOid: result.associateOID,
        adpWorkerId: result.workerID,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: {
          adpAssociateOid: result.associateOID,
          adpWorkerId: result.workerID,
        },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpAssociateOid: result.associateOID }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncWorker,
          { employeeProfileId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpInitialWorkerLoad = internalAction({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: ActionCtx, { tenantId }) => {
    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      return {
        status: 'pending_credentials',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    const key = idempotencyKey('initial_worker_load', tenantId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'initial_worker_load',
        refId: tenantId as string,
        idempotencyKey: key,
        request: { tenantId: tenantId as string },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      const response = claim.response as
        | { processed: number; matched: number; created: number; errors: number }
        | undefined
      return {
        status: 'already_synced',
        processed: response?.processed ?? 0,
        matched: response?.matched ?? 0,
        created: response?.created ?? 0,
        errors: response?.errors ?? 0,
      }
    }

    if (claim.type === 'in_flight') {
      return {
        status: 'in_flight',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    if (claim.type === 'max_attempts') {
      return {
        status: 'max_attempts',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    try {
      const profiles = (await ctx.runQuery(
        internal.adpSync.findEmployeeProfilesByTenant,
        { tenantId },
      )) as Doc<'employeeProfiles'>[]

      const profilesByEmail = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          normalizeEmail(p.email),
          p,
        ]),
      )
      const profilesByName = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          p.displayName.trim(),
          p,
        ]),
      )
      const profilesByAoid = new Map(
        profiles
          .filter(
            (p: Doc<'employeeProfiles'>): p is Doc<'employeeProfiles'> & {
              adpAssociateOid: string
            } => Boolean(p.adpAssociateOid),
          )
          .map((p: Doc<'employeeProfiles'> & { adpAssociateOid: string }) => [
            p.adpAssociateOid,
            p,
          ]),
      )

      const port = await getAdpPort()
      let cursor: string | undefined
      let processed = 0
      let matched = 0
      let created = 0
      let errors = 0

      do {
        const page = await port.listWorkers(cursor)
        for (const worker of page.workers) {
          processed++

          if (!worker.associateOID || !worker.displayName.trim()) {
            errors++
            continue
          }

          try {
            const email = worker.email
              ? normalizeEmail(worker.email)
              : undefined
            const matchByAoid = worker.associateOID
              ? profilesByAoid.get(worker.associateOID)
              : undefined
            const matchByEmail = email
              ? profilesByEmail.get(email)
              : undefined
            const matchByName = profilesByName.get(worker.displayName.trim())
            const match = matchByAoid ?? matchByEmail ?? matchByName

            await ctx.runMutation(
              internal.adpSync.upsertMatchedEmployeeProfile,
              {
                tenantId,
                associateOID: worker.associateOID,
                workerID: worker.workerID,
                displayName: worker.displayName,
                email: email ?? worker.displayName,
                matchProfileId: match?._id,
              },
            )

            if (match) matched++
            else created++
          } catch (workerError) {
            errors++
            console.error('ADP worker load failed for a record:', workerError)
          }
        }
        cursor = page.nextCursor
      } while (cursor)

      const result = { processed, matched, created, errors }
      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: result,
        completedAt: new Date().toISOString(),
      })

      return { status: 'success', ...result }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpInitialWorkerLoad,
          { tenantId },
        )
      }

      return { status: syncStatus, error: adpError, errors: 0 }
    }
  },
})


 succeeded in 860ms:
import { v } from 'convex/values'
import {
  action,
  internalMutation,
  query,
  type MutationCtx,
} from './_generated/server'
import { internal, api } from './_generated/api'
import { requireTenantRole } from './authHelpers'
import type { Doc, Id } from './_generated/dataModel'
import { normalizeEmail } from './adpSync'
import { sendClerkInvitation } from './invitations'

export async function ensureCaregiverEmployeeProfile(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  member: Doc<'tenantMembers'>,
) {
  if (member.role !== 'org:caregiver') return null

  const existingByClerkUserId = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
    )
    .unique()

  if (existingByClerkUserId) {
    if (!existingByClerkUserId.tenantMemberId) {
      await ctx.db.patch(existingByClerkUserId._id, { tenantMemberId: member._id })
    }
    return existingByClerkUserId._id
  }

  const normalizedEmail = normalizeEmail(member.email)
  const existingByEmail = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .filter((q) => q.eq(q.field('email'), normalizedEmail))
    .unique()

  if (existingByEmail) {
    if (
      existingByEmail.clerkUserId &&
      existingByEmail.clerkUserId !== member.clerkUserId
    ) {
      return existingByEmail._id
    }

    await ctx.db.patch(existingByEmail._id, {
      clerkUserId: member.clerkUserId,
      tenantMemberId: member._id,
      displayName: member.displayName,
      email: normalizedEmail,
    })
    return existingByEmail._id
  }

  return ctx.db.insert('employeeProfiles', {
    tenantId,
    clerkUserId: member.clerkUserId,
    tenantMemberId: member._id,
    displayName: member.displayName,
    email: member.email,
    adpSyncStatus: 'queued',
    createdAt: new Date().toISOString(),
  })
}

export const createCaregiverProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    displayName: v.string(),
    email: v.string(),
    adpSyncStatus: v.optional(v.union(
      v.literal('pending_credentials'),
      v.literal('queued'),
    )),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email)
    const trimmedName = args.displayName.trim()
    const initialStatus = args.adpSyncStatus ?? 'queued'

    const existing = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .filter((q) => q.eq(q.field('email'), normalizedEmail))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: trimmedName,
        email: normalizedEmail,
      })
      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
        employeeProfileId: existing._id,
      })
      return existing._id
    }

    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId: args.tenantId,
      displayName: trimmedName,
      email: normalizedEmail,
      adpSyncStatus: initialStatus,
      createdAt: new Date().toISOString(),
    })

    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
      employeeProfileId: profileId,
    })

    return profileId
  },
})

export const createCaregiver = action({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    appBaseUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    profileId: Id<'employeeProfiles'>
    invitationId: string
    emailAddress: string
    role: string
    status: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can create caregivers.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const adpConfigured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId: tenant._id },
    )

    const profileId: Id<'employeeProfiles'> = await ctx.runMutation(
      internal.employeeProfiles.createCaregiverProfile,
      {
        tenantId: tenant._id,
        displayName: args.displayName,
        email: args.email,
        adpSyncStatus: adpConfigured ? 'queued' : 'pending_credentials',
      },
    )

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
    }

    const invitation = await sendClerkInvitation({
      secretKey,
      inviterUserId: identity.subject,
      clerkOrgId: args.clerkOrgId,
      emailAddress: args.email,
      role: 'org:caregiver',
      appBaseUrl: args.appBaseUrl,
    })

    return {
      profileId,
      invitationId: invitation.id,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: invitation.status,
    }
  },
})

export const listEmployeeProfiles = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const memberById = new Map(members.map((m) => [m._id, m]))

    return profiles.map((profile) => {
      const member = profile.tenantMemberId
        ? memberById.get(profile.tenantMemberId)
        : undefined
      return {
        _id: profile._id,
        displayName: profile.displayName,
        email: profile.email,
        role: member?.role ?? 'org:caregiver',
        adpSyncStatus: profile.adpSyncStatus,
      }
    })
  },
})

export const runAdpInitialWorkerLoad = action({
  args: { clerkOrgId: v.string() },
  handler: async (
    ctx,
    { clerkOrgId },
  ): Promise<{
    status: string
    processed: number
    matched: number
    created: number
    errors: number
    error?: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, { clerkOrgId })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can run ADP load.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, { clerkOrgId })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const result: {
      status: string
      processed?: number
      matched?: number
      created?: number
      errors?: number
      error?: string
    } = await ctx.runAction(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId: tenant._id,
    })

    return {
      status: result.status,
      processed: result.processed ?? 0,
      matched: result.matched ?? 0,
      created: result.created ?? 0,
      errors: result.errors ?? 0,
      error: result.error,
    }
  },
})


 succeeded in 822ms:
import type { QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

declare const process: { env: Record<string, string | undefined> }

const REQUIRED_ENVS = [
  'ADP_TOKEN_URL',
  'ADP_BASE_URL',
  'ADP_CLIENT_ID',
  'ADP_CLIENT_SECRET',
  'ADP_CLIENT_CERT_PEM',
  'ADP_CLIENT_KEY_PEM',
]

export function adpEnvVarNames(): string[] {
  return REQUIRED_ENVS
}

export function areAdpEnvVarsPresent(): boolean {
  return REQUIRED_ENVS.every((name) => Boolean(process.env[name]?.trim()))
}

export async function isAdpConfigured(
  ctx: QueryCtx,
  tenantId: Id<'tenants'>,
): Promise<boolean> {
  if (!areAdpEnvVarsPresent()) return false

  const connection = await ctx.db
    .query('integrationConnections')
    .withIndex('by_tenant_provider', (q) =>
      q.eq('tenantId', tenantId).eq('provider', 'adp'),
    )
    .unique()

  return connection?.status === 'configured'
}


 succeeded in 816ms:
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'
import { sanitizeError } from './adpSync'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function seedAgency(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    caregiverEmail?: string
    configureAdp?: boolean
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: options.caregiverEmail ?? 'caregiver@example.com',
    })

    if (options.configureAdp) {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    }

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
      serviceAddress: {
        line1: '123 Main St',
        city: 'Minneapolis',
        state: 'MN',
        postalCode: '55401',
      },
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: 'pending',
    })

    return { tenantId, memberId, clientId, shiftId }
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

describe('adpSyncPunch', () => {
  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_unconfigured'
    const caregiverId = 'user_cg_adp_unconfigured'
    const caregiverEmail = 'unconfigured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: false,
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(result.punchId).toBeDefined()

    const punchBefore = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.timePunches.get,
      {
        clerkOrgId,
        punchId: result.punchId as Id<'timePunches'>,
      },
    )
    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')

    const eventsBefore = await t.run(async (ctx) => {
      return ctx.db.query('integrationEvents').collect()
    })
    expect(eventsBefore).toHaveLength(0)

    // Flip integration connection to configured and add employee profile
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-unconfigured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.patch(result.punchId as Id<'timePunches'>, {
        adpSyncStatus: 'queued',
      })
    })

    const syncResult = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId: result.punchId as Id<'timePunches'>,
    })
    expect(syncResult.status).toBe('synced')
    expect(syncResult.adpPunchId).toBeDefined()

    const punchAfter = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punchAfter?.adpSyncStatus).toBe('synced')
    expect(punchAfter?.adpPunchId).toBe(syncResult.adpPunchId)
  })

  it('posts punch once, stores adpPunchId, and is idempotent', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_configured'
    const caregiverId = 'user_cg_adp_configured'
    const caregiverEmail = 'configured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-configured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('synced')
    expect(first.adpPunchId).toBeDefined()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('already_synced')

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punch?.adpSyncStatus).toBe('synced')
    expect(punch?.adpPunchId).toBe(first.adpPunchId)

    expect(mock.callCounts.postPunch).toBe(1)

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('success')
  })

  it('does not send location evidence in the ADP punch payload', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_location'
    const caregiverId = 'user_cg_adp_location'
    const caregiverEmail = 'location@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-location@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          distanceMeters: 12,
          targetLabel: 'Client service address',
          targetLatitude: 44.9778,
          targetLongitude: -93.265,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    expect(mock.callCounts.postPunch).toBe(1)
    expect(mock.lastPunchInput).toBeDefined()
    expect(mock.lastPunchInput).not.toHaveProperty('location')
    expect(mock.lastPunchInput).not.toHaveProperty('latitude')
    expect(mock.lastPunchInput).not.toHaveProperty('longitude')
    expect(mock.lastPunchInput).not.toHaveProperty('distanceMeters')
    expect(mock.lastPunchInput).toHaveProperty('idempotencyKey')
    expect(mock.lastPunchInput).toHaveProperty('associateOID')
    expect(mock.lastPunchInput).toHaveProperty('punchType')
    expect(mock.lastPunchInput).toHaveProperty('at')
  })

  it('does not leak ADP secrets into integrationEvents on failure', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({
      failNextCall: true,
      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_secret_leak'
    const caregiverId = 'user_cg_adp_secret_leak'
    const caregiverEmail = 'secret-leak@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })

    expect(events.length).toBeGreaterThan(0)
    const eventJson = JSON.stringify(events)
    expect(eventJson).not.toContain('mock-client-secret')
    expect(eventJson).not.toContain('mock-client-id')
    expect(eventJson).not.toContain('bW9jay1jbGllbnQtaWQ')

    const punch = await t.run(async (ctx) => ctx.db.get(timePunchId))
    expect(punch?.adpError).toBeDefined()
    expect(punch?.adpError).not.toContain('mock-client-secret')
    expect(punch?.adpError).not.toContain('mock-client-id')

    mock.clearFailure()
  })

  it('records error and succeeds on retry', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_retry'
    const caregiverId = 'user_cg_adp_retry'
    const caregiverEmail = 'retry@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-retry@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('error')

    const punchAfterFirst = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterFirst?.adpSyncStatus).toBe('error')
    expect(punchAfterFirst?.adpError).toBeDefined()

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('synced')

    const punchAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterSecond?.adpSyncStatus).toBe('synced')
    expect(punchAfterSecond?.adpError).toBeUndefined()

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.status).toBe('error')
    expect(events[1]?.status).toBe('success')
  })
})

describe('claimIntegrationEvent', () => {
  it('prevents overlapping claims and respects success', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_claim'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_claim',
      configureAdp: true,
    })

    const key = 'punch:claim-test'
    const first = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(first.type).toBe('claimed')

    const second = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(second.type).toBe('in_flight')

    await t.mutation(internal.adpSync.patchIntegrationEvent, {
      eventId: first.eventId,
      status: 'success',
      response: { adpPunchId: 'punch-123' },
      completedAt: new Date().toISOString(),
    })

    const third = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(third.type).toBe('already_synced')
  })
})

describe('sanitizeError', () => {
  it('redacts ADP env values, Basic/Bearer tokens, and generic tokens', () => {
    vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')

    const message =
      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

    const redacted = sanitizeError(new Error(message))

    expect(redacted).not.toContain('mock-client-id')
    expect(redacted).not.toContain('mock-client-secret')
    expect(redacted).not.toContain(
      'bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0',
    )
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_ID]')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_SECRET]')
    expect(redacted).toContain('Basic [REDACTED]')
    expect(redacted).toContain('Bearer [REDACTED]')

    vi.unstubAllEnvs()
  })
})

describe('adpInitialWorkerLoad', () => {
  it('matches existing profile by email and creates profile for new worker', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-existing',
          workerID: 'w-existing',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-new',
          workerID: 'w-new',
          displayName: 'New ADP Worker',
          email: 'new-adp@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load',
      configureAdp: true,
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(2)
    const matched = profiles.find((p) => p.email === 'existing@example.com')
    const created = profiles.find((p) => p.email === 'new-adp@example.com')

    expect(matched?.adpSyncStatus).toBe('matched')
    expect(matched?.adpAssociateOid).toBe('aoid-existing')
    expect(created?.adpSyncStatus).toBe('created')
    expect(created?.adpAssociateOid).toBe('aoid-new')
  })

  it('records failure and retries', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_retry'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load_retry',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('error')

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `initial_worker_load:${tenantId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('success')
  })

  it('is idempotent across reruns by AOID', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-rerun',
          workerID: 'w-rerun',
          displayName: 'Rerun Worker',
          email: 'rerun@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_rerun'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_rerun',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('success')
    expect(first.created).toBe(1)

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('already_synced')

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })
    expect(profiles).toHaveLength(1)
  })

  it('can be triggered by an admin through the public mutation', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-public',
          workerID: 'w-public',
          displayName: 'Public Load Worker',
          email: 'public@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_public_load'
    const adminId = 'user_admin_public_load'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.adpSync.triggerInitialWorkerLoad,
      { clerkOrgId },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-public')
  })
})

describe('adpSyncWorker', () => {
  it('no-ops when profile already has an ADP associate OID', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_existing_aoid'
    const caregiverId = 'user_cg_existing_aoid'
    const caregiverEmail = 'existing-aoid@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-existing',
        adpSyncStatus: 'matched',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(result.status).toBe('already_synced')
    expect(mock.callCounts.createWorker).toBe(0)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBe('aoid-existing')
  })

  it('retries without creating duplicate workers using idempotency key', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker_retry'
    const caregiverId = 'user_cg_worker_retry'
    const caregiverEmail = 'worker-retry@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(first.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(second.status).toBe('synced')
    expect(second.adpAssociateOid).toBeDefined()

    const profileAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profileAfterSecond?.adpSyncStatus).toBe('synced')
    expect(profileAfterSecond?.adpError).toBeUndefined()

    expect(mock.workerCount()).toBe(1)
  })
})

describe('adpSyncWorker scheduled drain', () => {
  it('enqueues worker sync when caregiver is created and stores AOID', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker'
    const caregiverId = 'user_cg_adp_worker'
    const caregiverEmail = 'worker@example.com'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('enqueues worker sync when an existing member is promoted to caregiver', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_promote'
    const adminId = 'user_admin_promote'
    const caregiverId = 'user_cg_promote'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:coordinator',
        displayName: 'Future Caregiver',
        email: 'promote@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asAdmin(t, adminId, clerkOrgId).mutation(api.members.updateRole, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('links new caregiver to ADP-loaded profile by email and name', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_profile'
    const caregiverId = 'user_cg_link_profile'
    const caregiverEmail = 'link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Link Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-link',
        adpSyncStatus: 'created',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Link Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-link')
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })

  it('links a caregiver to an existing profile by email even when display names differ', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_email_only'
    const caregiverId = 'user_cg_link_email_only'
    const caregiverEmail = 'email-link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Admin Entered Name',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Clerk Display Name',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.tenantMemberId).toBeDefined()
    expect(profiles[0]?.adpAssociateOid).toBeDefined()
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })
})


 succeeded in 832ms:
'use node'

import { Agent, request } from 'node:https'
import type {
  AdpAccessToken,
  AdpListWorkersResult,
  AdpPort,
  AdpPunchInput,
  AdpPunchResult,
  AdpTimeCard,
  AdpWorkerProfileInput,
  AdpWorkerResult,
  AdpWorkerSummary,
} from './adpPort'
import { NotConfiguredError } from './errors'

declare const process: { env: Record<string, string | undefined> }

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new NotConfiguredError(`Missing ADP environment variable: ${name}`)
  return value
}

function buildHttpsAgent(): Agent {
  const cert = requireEnv('ADP_CLIENT_CERT_PEM')
  const key = requireEnv('ADP_CLIENT_KEY_PEM')
  return new Agent({ cert, key })
}

function httpsRequest(options: {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url)
    const req = request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        agent: buildHttpsAgent(),
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    )

    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function extractEmail(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const candidate =
      obj.emailUri ?? obj.uri ?? obj.address ?? obj.emailAddress
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}

export function normalizeWorker(
  worker: Record<string, unknown>,
): AdpWorkerSummary {
  const associateOID = String(worker.associateOID ?? worker.associateOid ?? '')
  const workerID = worker.workerID
    ? String(worker.workerID)
    : worker.workerId
    ? String(worker.workerId)
    : undefined

  let displayName = ''
  const personName = worker.personName
  if (personName && typeof personName === 'object') {
    const name = personName as Record<string, unknown>
    const given = String(name.givenName ?? '')
    const family = String(name.familyName ?? '')
    displayName = `${given} ${family}`.trim()
  }
  if (!displayName) {
    displayName = String(worker.displayName ?? 'Unnamed Worker')
  }

  let email: string | undefined
  const workAssignments = worker.workAssignments
  if (Array.isArray(workAssignments)) {
    for (const assignment of workAssignments) {
      if (assignment && typeof assignment === 'object') {
        const emails = (assignment as Record<string, unknown>).emailAddresses
        if (Array.isArray(emails)) {
          for (const raw of emails) {
            const found = extractEmail(raw)
            if (found) {
              email = found
              break
            }
          }
        }
      }
      if (email) break
    }
  }

  if (!email) {
    const person = worker.person
    if (person && typeof person === 'object') {
      const communication = (person as Record<string, unknown>).communication
      if (communication && typeof communication === 'object') {
        const emails = (communication as Record<string, unknown>).emails
        if (Array.isArray(emails)) {
          for (const raw of emails) {
            const found = extractEmail(raw)
            if (found) {
              email = found
              break
            }
          }
        }
      }
    }
  }

  return {
    associateOID,
    workerID,
    displayName,
    email,
    status: worker.status
      ? String(worker.status)
      : worker.workerStatus
      ? String(worker.workerStatus)
      : undefined,
  }
}

export class AdpClient implements AdpPort {
  async getAccessToken(): Promise<AdpAccessToken> {
    const now = Date.now()
    if (tokenCache && tokenCache.expiresAt > now + 60_000) {
      return {
        accessToken: tokenCache.accessToken,
        tokenType: 'Bearer',
        expiresAt: new Date(tokenCache.expiresAt).toISOString(),
      }
    }

    const tokenUrl = requireEnv('ADP_TOKEN_URL')
    const clientId = requireEnv('ADP_CLIENT_ID')
    const clientSecret = requireEnv('ADP_CLIENT_SECRET')

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    )
    const { status, body } = await httpsRequest({
      url: tokenUrl,
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP token request failed with status ${status}`)
    }

    const payload = parseJson(body) as Record<string, unknown> | null
    if (!payload || typeof payload.access_token !== 'string') {
      throw new Error('ADP token response missing access_token')
    }

    const expiresIn =
      typeof payload.expires_in === 'number'
        ? payload.expires_in
        : Number.parseInt(String(payload.expires_in ?? '3600'), 10)

    const accessToken = payload.access_token
    const expiresAt = now + expiresIn * 1000
    tokenCache = { accessToken, expiresAt }

    return {
      accessToken,
      tokenType: String(payload.token_type ?? 'Bearer'),
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  private async adpGet(path: string): Promise<unknown> {
    const baseUrl = requireEnv('ADP_BASE_URL')
    const token = await this.getAccessToken()
    const { status, body } = await httpsRequest({
      url: `${baseUrl}${path}`,
      method: 'GET',
      headers: { Authorization: `${token.tokenType} ${token.accessToken}` },
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP request failed: GET ${path} status ${status}`)
    }

    return parseJson(body)
  }

  private async adpPost(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const baseUrl = requireEnv('ADP_BASE_URL')
    const token = await this.getAccessToken()
    const { status, body } = await httpsRequest({
      url: `${baseUrl}${path}`,
      method: 'POST',
      headers: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (status < 200 || status >= 300) {
      throw new Error(`ADP request failed: POST ${path} status ${status}`)
    }

    return parseJson(body)
  }

  async listWorkers(cursor?: string): Promise<AdpListWorkersResult> {
    const skip = cursor ? Number.parseInt(cursor, 10) : 0
    const payload = await this.adpGet(`/hr/v2/workers?$top=100&$skip=${skip}`)
    const workers: AdpWorkerSummary[] = []

    if (payload && typeof payload === 'object') {
      const rawWorkers = (payload as Record<string, unknown>).workers
      if (Array.isArray(rawWorkers)) {
        for (const raw of rawWorkers) {
          if (raw && typeof raw === 'object') {
            workers.push(normalizeWorker(raw as Record<string, unknown>))
          }
        }
      }
    }

    const nextCursor = workers.length === 100 ? String(skip + 100) : undefined
    return { workers, nextCursor }
  }

  async createWorker(
    profile: AdpWorkerProfileInput,
  ): Promise<AdpWorkerResult> {
    const payload = await this.adpPost('/events/hr/v1/worker.hire', {
      events: [
        {
          data: {
            eventContext: {
              correlationID: profile.idempotencyKey,
              associateOID: profile.employeeProfileId,
            },
            transform: {
              worker: {
                person: {
                  communication: {
                    emails: [{ emailUri: profile.email }],
                  },
                  legalName: {
                    formattedName: profile.displayName,
                  },
                },
              },
            },
          },
        },
      ],
    })

    const eventPayload = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}
    const events = eventPayload.events
    const firstEvent = Array.isArray(events) && events.length > 0
      ? events[0]
      : null
    const data = firstEvent && typeof firstEvent === 'object'
      ? (firstEvent as Record<string, unknown>).data
      : null
    const output = data && typeof data === 'object'
      ? (data as Record<string, unknown>).output
      : null
    const associateOID = output && typeof output === 'object'
      ? String((output as Record<string, unknown>).associateOID ?? '')
      : ''
    const workerID = output && typeof output === 'object'
      ? String((output as Record<string, unknown>).workerID ?? '')
      : undefined

    if (!associateOID) {
      throw new Error('ADP worker.hire response missing associateOID')
    }

    return { associateOID, workerID }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async postPunch(_punch: AdpPunchInput): Promise<AdpPunchResult> {
    // STUB: ADP time-entry event body is product-dependent (real-time punch
    // vs. batch time-card import). Do not enable payroll writes until the
    // final ADP event contract is approved and mapped. Everything around this
    // fill-in point (OAuth, mTLS, worker load, idempotency, retries) is wired.
    throw new NotConfiguredError(
      'ADP punch posting is not configured: implement the product-specific time-entry event body in adpClient.postPunch',
    )
  }

  async getTimeCards(aoid: string): Promise<AdpTimeCard> {
    const payload = await this.adpGet(`/time/v2/workers/${aoid}/time-cards`)
    const timeCards = payload && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).timeCards ?? [])
      : []
    return {
      aoid,
      timeCards: Array.isArray(timeCards) ? timeCards : [],
    }
  }
}


codex
I’ve confirmed the ADP layer has mock-adapter coverage for idempotency, credential-pending behavior, worker load, and secret redaction. Next I’m checking whether those paths are actually reachable and whether tenant/auth boundaries and e2e setup hold up.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- convex/members.ts convex/invitations.ts convex/tenants.ts convex/shiftQueries.ts convex/shifts.ts convex/reviews.ts convex/seed.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/members.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/shifts.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/shiftQueries.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/authHelpers.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 915ms:
diff --git a/convex/invitations.ts b/convex/invitations.ts
index 7dff927..01b8cae 100644
--- a/convex/invitations.ts
+++ b/convex/invitations.ts
@@ -47,6 +47,48 @@ function normalizeCreatedAt(value: unknown) {
   return new Date().toISOString()
 }
 
+export async function sendClerkInvitation(args: {
+  secretKey: string
+  inviterUserId: string
+  clerkOrgId: string
+  emailAddress: string
+  role: InviteRole
+  appBaseUrl: string
+}) {
+  const response = await fetch(
+    `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
+    {
+      method: 'POST',
+      headers: {
+        Authorization: `Bearer ${args.secretKey}`,
+        'Content-Type': 'application/json',
+      },
+      body: JSON.stringify({
+        inviter_user_id: args.inviterUserId,
+        email_address: args.emailAddress.trim(),
+        role: toClerkRole(args.role),
+        redirect_url: invitationRedirectUrl(args.appBaseUrl),
+        public_metadata: { atriaRole: args.role },
+      }),
+    },
+  )
+
+  const payload = await response.json()
+  if (!response.ok) {
+    throw new ConvexError(clerkErrorMessage(payload))
+  }
+
+  const record = payload as Record<string, unknown>
+  return {
+    id: String(record.id ?? ''),
+    emailAddress: String(record.email_address ?? args.emailAddress),
+    role: String(record.role ?? toClerkRole(args.role)),
+    roleName: String(record.role_name ?? toClerkRole(args.role)),
+    status: String(record.status ?? 'pending'),
+    createdAt: normalizeCreatedAt(record.created_at),
+  }
+}
+
 export const create = action({
   args: {
     clerkOrgId: v.string(),
@@ -74,37 +116,13 @@ export const create = action({
       )
     }
 
-    const response = await fetch(
-      `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
-      {
-        method: 'POST',
-        headers: {
-          Authorization: `Bearer ${secretKey}`,
-          'Content-Type': 'application/json',
-        },
-        body: JSON.stringify({
-          inviter_user_id: identity.subject,
-          email_address: args.emailAddress.trim(),
-          role: toClerkRole(args.role),
-          redirect_url: invitationRedirectUrl(args.appBaseUrl),
-          public_metadata: { atriaRole: args.role },
-        }),
-      },
-    )
-
-    const payload = await response.json()
-    if (!response.ok) {
-      throw new ConvexError(clerkErrorMessage(payload))
-    }
-
-    const record = payload as Record<string, unknown>
-    return {
-      id: String(record.id ?? ''),
-      emailAddress: String(record.email_address ?? args.emailAddress),
-      role: String(record.role ?? toClerkRole(args.role)),
-      roleName: String(record.role_name ?? toClerkRole(args.role)),
-      status: String(record.status ?? 'pending'),
-      createdAt: normalizeCreatedAt(record.created_at),
-    }
+    return sendClerkInvitation({
+      secretKey,
+      inviterUserId: identity.subject,
+      clerkOrgId: args.clerkOrgId,
+      emailAddress: args.emailAddress,
+      role: args.role,
+      appBaseUrl: args.appBaseUrl,
+    })
   },
 })
diff --git a/convex/members.ts b/convex/members.ts
index 983d1a8..4f0e620 100644
--- a/convex/members.ts
+++ b/convex/members.ts
@@ -1,5 +1,6 @@
 import { v } from 'convex/values'
 import { query, mutation } from './_generated/server'
+import { internal } from './_generated/api'
 import {
   getActiveClerkOrganizationId,
   getClerkOrganizationRole,
@@ -8,6 +9,7 @@ import {
   requireTenant,
   requireTenantRole,
 } from './authHelpers'
+import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
 
 export const checkMembership = query({
   args: { clerkOrgId: v.string() },
@@ -129,16 +131,46 @@ export const sync = mutation({
         displayName: args.displayName,
         email: args.email,
       })
+      if (role === 'org:caregiver') {
+        const employeeProfileId = await ensureCaregiverEmployeeProfile(
+          ctx,
+          tenantId,
+          { ...existing, role, displayName: args.displayName, email: args.email },
+        )
+        if (employeeProfileId) {
+          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
+            employeeProfileId,
+          })
+        }
+      }
       return existing._id
     }
 
-    return ctx.db.insert('tenantMembers', {
+    const memberId = await ctx.db.insert('tenantMembers', {
       tenantId,
       clerkUserId: args.clerkUserId,
       role,
       displayName: args.displayName,
       email: args.email,
     })
+
+    if (role === 'org:caregiver') {
+      const newMember = await ctx.db.get(memberId)
+      if (newMember) {
+        const employeeProfileId = await ensureCaregiverEmployeeProfile(
+          ctx,
+          tenantId,
+          newMember,
+        )
+        if (employeeProfileId) {
+          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
+            employeeProfileId,
+          })
+        }
+      }
+    }
+
+    return memberId
   },
 })
 
@@ -173,6 +205,21 @@ export const updateRole = mutation({
     }
 
     await ctx.db.patch(existing._id, { role: args.role })
+
+    if (args.role === 'org:caregiver') {
+      const updatedMember = { ...existing, role: args.role }
+      const employeeProfileId = await ensureCaregiverEmployeeProfile(
+        ctx,
+        tenantId,
+        updatedMember,
+      )
+      if (employeeProfileId) {
+        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
+          employeeProfileId,
+        })
+      }
+    }
+
     return existing._id
   },
 })
diff --git a/convex/reviews.ts b/convex/reviews.ts
index 28caea2..bc7a5b8 100644
--- a/convex/reviews.ts
+++ b/convex/reviews.ts
@@ -111,6 +111,10 @@ export const requestCorrection = mutation({
     if (!shift) throw new Error('Shift not found.')
     assertTenantDoc(shift, tenantId)
 
+    if (!args.comment || args.comment.trim().length === 0) {
+      throw new Error('A comment is required to request a correction.')
+    }
+
     if (shift.status !== 'submitted' && shift.status !== 'billing_ready') {
       throw new Error(
         'Can only return submitted or approved shifts for correction.',
diff --git a/convex/seed.ts b/convex/seed.ts
index 521bf6a..7f96506 100644
--- a/convex/seed.ts
+++ b/convex/seed.ts
@@ -500,3 +500,399 @@ function hashToken(token: string): number {
   }
   return hash
 }
+
+// Deterministic E2E fixtures. Idempotent by clerkOrgId, member user id, and
+// scheduled start time. Geofence is disabled by default so the lifecycle
+// flow can run without location. A second client with coordinates is provided
+// for geofence scenarios.
+export const seedE2E = mutation({
+  args: {
+    clerkOrgId: v.string(),
+    adminUserId: v.string(),
+    coordinatorUserId: v.string(),
+    caregiverUserId: v.string(),
+  },
+  handler: async (ctx, args) => {
+    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
+      'org:admin',
+    ])
+
+    const today = new Date().toISOString().slice(0, 10)
+
+    const members = [
+      {
+        clerkUserId: args.adminUserId,
+        role: 'org:admin' as const,
+        displayName: 'E2E Admin',
+        email: 'e2e-admin@atriax.test',
+      },
+      {
+        clerkUserId: args.coordinatorUserId,
+        role: 'org:coordinator' as const,
+        displayName: 'E2E Coordinator',
+        email: 'e2e-coordinator@atriax.test',
+      },
+      {
+        clerkUserId: args.caregiverUserId,
+        role: 'org:caregiver' as const,
+        displayName: 'E2E Caregiver',
+        email: 'e2e-caregiver@atriax.test',
+      },
+    ]
+
+    const memberIds: Record<string, Id<'tenantMembers'>> = {}
+    for (const member of members) {
+      const existing = await ctx.db
+        .query('tenantMembers')
+        .withIndex('by_tenant_user', (q) =>
+          q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
+        )
+        .unique()
+      if (existing) {
+        memberIds[member.clerkUserId] = existing._id
+      } else {
+        memberIds[member.clerkUserId] = await ctx.db.insert('tenantMembers', {
+          tenantId,
+          clerkUserId: member.clerkUserId,
+          role: member.role,
+          displayName: member.displayName,
+          email: member.email,
+        })
+      }
+    }
+
+    const findClient = async (displayName: string) => {
+      const all = await ctx.db
+        .query('clients')
+        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
+        .collect()
+      return all.find((c) => c.displayName === displayName) ?? null
+    }
+
+    let lifecycleClientId: Id<'clients'>
+    const lifecycleClient = await findClient('Sam Lee')
+    if (!lifecycleClient) {
+      lifecycleClientId = await ctx.db.insert('clients', {
+        tenantId,
+        displayName: 'Sam Lee',
+        serviceType: 'ILS',
+        authorizationHours: 30,
+        riskFlags: [],
+      })
+    } else {
+      lifecycleClientId = lifecycleClient._id
+    }
+
+    let geofenceClientId: Id<'clients'>
+    const geofenceClient = await findClient('Maya Torres')
+    if (!geofenceClient) {
+      geofenceClientId = await ctx.db.insert('clients', {
+        tenantId,
+        displayName: 'Maya Torres',
+        serviceType: 'SLS',
+        authorizationHours: 40,
+        riskFlags: ['mobility'],
+        serviceAddress: {
+          line1: '123 Hennepin Ave',
+          city: 'Minneapolis',
+          state: 'MN',
+          postalCode: '55401',
+          latitude: 44.9778,
+          longitude: -93.265,
+        },
+      })
+    } else {
+      geofenceClientId = geofenceClient._id
+    }
+
+    // Reset geofence to disabled so lifecycle tests never prompt for location.
+    const existingSettings = await ctx.db
+      .query('tenantSettings')
+      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
+      .unique()
+    const defaultGeofence = {
+      enabled: false,
+      enforceClockIn: false,
+      enforceClockOut: false,
+      defaultRadiusMeters: 100,
+      maxAccuracyMeters: 50,
+    }
+    if (existingSettings) {
+      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
+    } else {
+      await ctx.db.insert('tenantSettings', {
+        tenantId,
+        shiftGeofence: defaultGeofence,
+      })
+    }
+
+    const findShift = async (scheduledStart: string) => {
+      const all = await ctx.db
+        .query('shifts')
+        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
+        .collect()
+      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
+    }
+
+    const resetShift = async (shiftId: Id<'shifts'>) => {
+      await ctx.db.patch(shiftId, {
+        status: 'scheduled',
+        clockInAt: undefined,
+        clockOutAt: undefined,
+        serviceLocationOverride: undefined,
+      })
+
+      const existingNote = await ctx.db
+        .query('progressNotes')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .unique()
+      if (existingNote) {
+        await ctx.db.patch(existingNote._id, {
+          startTime: '',
+          endTime: '',
+          servicesProvided: '',
+          clientResponse: '',
+          narrative: '',
+          submittedBy: undefined,
+          submittedAt: undefined,
+        })
+      } else {
+        await ctx.db.insert('progressNotes', {
+          tenantId,
+          shiftId,
+          startTime: '',
+          endTime: '',
+          servicesProvided: '',
+          clientResponse: '',
+          narrative: '',
+        })
+      }
+
+      const existingTasks = await ctx.db
+        .query('shiftTasks')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const task of existingTasks) {
+        await ctx.db.delete(task._id)
+      }
+      await ctx.db.insert('shiftTasks', {
+        tenantId,
+        shiftId,
+        title: 'Upload shift documentation proof',
+        requiredProof: true,
+        status: 'pending',
+      })
+
+      const reviews = await ctx.db
+        .query('reviewEvents')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const review of reviews) {
+        await ctx.db.delete(review._id)
+      }
+
+      const billingLines = await ctx.db
+        .query('billingLines')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const line of billingLines) {
+        await ctx.db.delete(line._id)
+      }
+
+      const punches = await ctx.db
+        .query('timePunches')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const punch of punches) {
+        await ctx.db.delete(punch._id)
+      }
+    }
+
+    let lifecycleShiftId: Id<'shifts'>
+    const lifecycleStart = `${today}T09:00:00Z`
+    const lifecycleShift = await findShift(lifecycleStart)
+    if (!lifecycleShift) {
+      lifecycleShiftId = await ctx.db.insert('shifts', {
+        tenantId,
+        clientId: lifecycleClientId,
+        caregiverId: args.caregiverUserId,
+        scheduledStart: lifecycleStart,
+        scheduledEnd: `${today}T13:00:00Z`,
+        status: 'scheduled',
+        serviceType: 'ILS',
+        rate: 30,
+      })
+    } else {
+      lifecycleShiftId = lifecycleShift._id
+      await ctx.db.patch(lifecycleShiftId, { caregiverId: args.caregiverUserId })
+    }
+    await resetShift(lifecycleShiftId)
+
+    let geofenceShiftId: Id<'shifts'>
+    const geofenceStart = `${today}T14:00:00Z`
+    const geofenceShift = await findShift(geofenceStart)
+    if (!geofenceShift) {
+      geofenceShiftId = await ctx.db.insert('shifts', {
+        tenantId,
+        clientId: geofenceClientId,
+        caregiverId: args.caregiverUserId,
+        scheduledStart: geofenceStart,
+        scheduledEnd: `${today}T18:00:00Z`,
+        status: 'scheduled',
+        serviceType: 'SLS',
+        rate: 28.5,
+      })
+    } else {
+      geofenceShiftId = geofenceShift._id
+      await ctx.db.patch(geofenceShiftId, { caregiverId: args.caregiverUserId })
+    }
+    await resetShift(geofenceShiftId)
+
+    return {
+      status: 'seeded' as const,
+      tenantId,
+      memberIds,
+      lifecycleShiftId,
+      geofenceShiftId,
+    }
+  },
+})
+
+// Resets the two deterministic E2E fixture shifts back to a clean scheduled
+// state and disables geofence. Used between serial e2e scenarios so each test
+// starts from the same fixture baseline.
+export const resetE2EShifts = mutation({
+  args: {
+    clerkOrgId: v.string(),
+  },
+  handler: async (ctx, args) => {
+    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
+      'org:admin',
+    ])
+
+    const today = new Date().toISOString().slice(0, 10)
+
+    const existingSettings = await ctx.db
+      .query('tenantSettings')
+      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
+      .unique()
+    const defaultGeofence = {
+      enabled: false,
+      enforceClockIn: false,
+      enforceClockOut: false,
+      defaultRadiusMeters: 100,
+      maxAccuracyMeters: 50,
+    }
+    if (existingSettings) {
+      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
+    }
+
+    const findShift = async (scheduledStart: string) => {
+      const all = await ctx.db
+        .query('shifts')
+        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
+        .collect()
+      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
+    }
+
+    const resetShift = async (shiftId: Id<'shifts'>) => {
+      await ctx.db.patch(shiftId, {
+        status: 'scheduled',
+        clockInAt: undefined,
+        clockOutAt: undefined,
+        serviceLocationOverride: undefined,
+      })
+
+      const existingNote = await ctx.db
+        .query('progressNotes')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .unique()
+      if (existingNote) {
+        await ctx.db.patch(existingNote._id, {
+          startTime: '',
+          endTime: '',
+          servicesProvided: '',
+          clientResponse: '',
+          narrative: '',
+          submittedBy: undefined,
+          submittedAt: undefined,
+        })
+      }
+
+      const existingTasks = await ctx.db
+        .query('shiftTasks')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const task of existingTasks) {
+        await ctx.db.delete(task._id)
+      }
+      await ctx.db.insert('shiftTasks', {
+        tenantId,
+        shiftId,
+        title: 'Upload shift documentation proof',
+        requiredProof: true,
+        status: 'pending',
+      })
+
+      const reviews = await ctx.db
+        .query('reviewEvents')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const review of reviews) {
+        await ctx.db.delete(review._id)
+      }
+
+      const billingLines = await ctx.db
+        .query('billingLines')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const line of billingLines) {
+        await ctx.db.delete(line._id)
+      }
+
+      const punches = await ctx.db
+        .query('timePunches')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect()
+      for (const punch of punches) {
+        await ctx.db.delete(punch._id)
+      }
+    }
+
+    const lifecycleShift = await findShift(`${today}T09:00:00Z`)
+    if (lifecycleShift) {
+      await resetShift(lifecycleShift._id)
+    }
+
+    const geofenceShift = await findShift(`${today}T14:00:00Z`)
+    if (geofenceShift) {
+      await resetShift(geofenceShift._id)
+    }
+
+    return {
+      status: 'reset' as const,
+      lifecycleShiftId: lifecycleShift?._id ?? null,
+      geofenceShiftId: geofenceShift?._id ?? null,
+    }
+  },
+})
diff --git a/convex/shiftQueries.ts b/convex/shiftQueries.ts
index 0517c7a..b0d389f 100644
--- a/convex/shiftQueries.ts
+++ b/convex/shiftQueries.ts
@@ -23,13 +23,26 @@ export const listMyShifts = query({
   handler: async (ctx, { clerkOrgId }) => {
     const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
 
-    return ctx.db
+    const shifts = await ctx.db
       .query('shifts')
       .withIndex('by_tenant_caregiver_status', (q) =>
         q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
       )
       .order('desc')
       .take(100)
+
+    const clients = await Promise.all(
+      shifts.map((shift) => ctx.db.get(shift.clientId)),
+    )
+
+    clients.forEach((client) => {
+      if (client) assertTenantDoc(client, tenantId)
+    })
+
+    return shifts.map((shift, index) => ({
+      shift,
+      client: clients[index],
+    }))
   },
 })
 
@@ -116,7 +129,7 @@ export const getWithDetails = query({
     assertTenantDoc(shift, tenantId)
     assertShiftReadableByRole(shift, role, identity.subject)
 
-    const [client, note, tasks, reviews] = await Promise.all([
+    const [client, note, tasks, reviews, punches] = await Promise.all([
       ctx.db.get(shift.clientId),
       ctx.db
         .query('progressNotes')
@@ -137,14 +150,37 @@ export const getWithDetails = query({
         )
         .order('desc')
         .collect(),
+      ctx.db
+        .query('timePunches')
+        .withIndex('by_tenant_shift', (q) =>
+          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
+        )
+        .collect(),
     ])
 
     if (client) assertTenantDoc(client, tenantId)
     if (note) assertTenantDoc(note, tenantId)
     for (const task of tasks) assertTenantDoc(task, tenantId)
     for (const review of reviews) assertTenantDoc(review, tenantId)
+    for (const punch of punches) assertTenantDoc(punch, tenantId)
 
-    return { shift, client, note, tasks, reviews }
+    const clockIn = punches.find((p) => p.punchType === 'clock_in')
+    const clockOut = punches.find((p) => p.punchType === 'clock_out')
+    const locationMatched = Boolean(
+      clockIn?.location && clockIn.location.withinGeofence === true,
+    )
+    const submittedOnSite = Boolean(
+      clockOut?.location && clockOut.location.withinGeofence === true,
+    )
+
+    return {
+      shift,
+      client,
+      note,
+      tasks,
+      reviews,
+      verification: { locationMatched, submittedOnSite },
+    }
   },
 })
 
diff --git a/convex/shifts.ts b/convex/shifts.ts
index 8812dda..9354346 100644
--- a/convex/shifts.ts
+++ b/convex/shifts.ts
@@ -315,8 +315,8 @@ async function recordClockPunch(
     },
   })
 
-  await ctx.scheduler.runAfter(0, internal.adpSync.adpSyncPunch, {
-    punchId,
+  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
+    timePunchId: punchId,
   })
 
   return punchId
@@ -766,8 +766,8 @@ export const clockOut = mutation({
         },
       })
 
-      await ctx.scheduler.runAfter(0, internal.adpSync.adpSyncPunch, {
-        punchId,
+      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
+        timePunchId: punchId,
       })
 
       await ctx.db.patch(args.shiftId, { clockOutAt: now })
diff --git a/convex/tenants.ts b/convex/tenants.ts
index 7d41f52..f9dded3 100644
--- a/convex/tenants.ts
+++ b/convex/tenants.ts
@@ -1,5 +1,6 @@
 import { v } from 'convex/values'
 import { query, mutation } from './_generated/server'
+import { internal } from './_generated/api'
 import {
   getClerkOrganizationRole,
   requireIdentity,
@@ -8,6 +9,7 @@ import {
   type TenantRole,
 } from './authHelpers'
 import type { Id } from './_generated/dataModel'
+import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
 
 export const list = query({
   args: {},
@@ -141,6 +143,22 @@ export const ensureSelectedAgency = mutation({
       email,
     })
 
+    if (role === 'org:caregiver') {
+      const newMember = await ctx.db.get(memberId)
+      if (newMember) {
+        const employeeProfileId = await ensureCaregiverEmployeeProfile(
+          ctx,
+          tenantId,
+          newMember,
+        )
+        if (employeeProfileId) {
+          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
+            employeeProfileId,
+          })
+        }
+      }
+    }
+
     return { tenantId, memberId, isNewTenant }
   },
 })
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it

 succeeded in 889ms:
import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertTenantDoc,
  requireTenant,
  requireTenantRole,
} from './authHelpers'

function assertShiftReadableByRole(
  shift: { caregiverId: string },
  role: string,
  clerkUserId: string,
) {
  if (role === 'org:caregiver' && shift.caregiverId !== clerkUserId) {
    throw new ConvexError(
      'Forbidden: caregivers can only view assigned shifts.',
    )
  }
}

export const listMyShifts = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
      )
      .order('desc')
      .take(100)

    const clients = await Promise.all(
      shifts.map((shift) => ctx.db.get(shift.clientId)),
    )

    clients.forEach((client) => {
      if (client) assertTenantDoc(client, tenantId)
    })

    return shifts.map((shift, index) => ({
      shift,
      client: clients[index],
    }))
  },
})

export const listForReview = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const submitted = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'submitted'),
      )
      .order('desc')
      .take(100)

    const needsCorrection = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'needs_correction'),
      )
      .order('desc')
      .take(100)

    return [...submitted, ...needsCorrection]
  },
})

export const listBillingReady = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'billing_ready'),
      )
      .order('desc')
      .take(200)
  },
})

export const listAll = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(200)
  },
})

export const get = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)
    return shift
  },
})

export const getWithDetails = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)

    const [client, note, tasks, reviews, punches] = await Promise.all([
      ctx.db.get(shift.clientId),
      ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique(),
      ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
      ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .order('desc')
        .collect(),
      ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
    ])

    if (client) assertTenantDoc(client, tenantId)
    if (note) assertTenantDoc(note, tenantId)
    for (const task of tasks) assertTenantDoc(task, tenantId)
    for (const review of reviews) assertTenantDoc(review, tenantId)
    for (const punch of punches) assertTenantDoc(punch, tenantId)

    const clockIn = punches.find((p) => p.punchType === 'clock_in')
    const clockOut = punches.find((p) => p.punchType === 'clock_out')
    const locationMatched = Boolean(
      clockIn?.location && clockIn.location.withinGeofence === true,
    )
    const submittedOnSite = Boolean(
      clockOut?.location && clockOut.location.withinGeofence === true,
    )

    return {
      shift,
      client,
      note,
      tasks,
      reviews,
      verification: { locationMatched, submittedOnSite },
    }
  },
})

export const dashboardStats = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const all = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .collect()

    const billingLines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()
    const oldestSubmitted = all
      .filter((shift) => shift.status === 'submitted')
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    return {
      inProgress: all.filter((shift) => shift.status === 'in_progress').length,
      submitted: all.filter((shift) => shift.status === 'submitted').length,
      needsCorrection: all.filter(
        (shift) => shift.status === 'needs_correction',
      ).length,
      billingReady: all.filter((shift) => shift.status === 'billing_ready')
        .length,
      dollarsAtRisk:
        Math.round(
          billingLines.reduce(
            (sum, line) => sum + (line.exportBatchId ? 0 : line.amount),
            0,
          ) * 100,
        ) / 100,
      oldestSubmittedAge: oldestSubmitted
        ? Math.floor(
            (Date.now() - new Date(oldestSubmitted.scheduledStart).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0,
    }
  },
})


 succeeded in 941ms:
import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireIdentity,
  requireMatchingClerkOrganization,
  requireTenant,
  requireTenantRole,
} from './authHelpers'
import { ensureCaregiverEmployeeProfile } from './employeeProfiles'

export const checkMembership = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const activeOrgId = getActiveClerkOrganizationId(identity)
    if (!activeOrgId || activeOrgId !== clerkOrgId) return false

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()

    if (!tenant) return false

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
      )
      .unique()

    return !!member
  },
})

export const me = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
    return ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    return members
  },
})

export const listCaregivers = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()

    return members
  },
})

export const sync = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
    displayName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    requireMatchingClerkOrganization(identity, args.clerkOrgId)

    if (args.clerkUserId !== identity.subject) {
      throw new Error('Members can only self-sync from Clerk.')
    }

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()

    if (!tenant) throw new Error('Tenant not found.')

    const tenantId = tenant._id

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    const roleFromClerk = getClerkOrganizationRole(identity)
    const role = roleFromClerk ?? existing?.role ?? 'org:caregiver'

    if (existing) {
      await ctx.db.patch(existing._id, {
        role,
        displayName: args.displayName,
        email: args.email,
      })
      if (role === 'org:caregiver') {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          { ...existing, role, displayName: args.displayName, email: args.email },
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
      return existing._id
    }

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: args.clerkUserId,
      role,
      displayName: args.displayName,
      email: args.email,
    })

    if (role === 'org:caregiver') {
      const newMember = await ctx.db.get(memberId)
      if (newMember) {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          newMember,
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
    }

    return memberId
  },
})

export const updateRole = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (args.clerkUserId === identity.subject) {
      throw new Error('Cannot change your own role.')
    }

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (!existing) {
      throw new Error('Member not found.')
    }

    await ctx.db.patch(existing._id, { role: args.role })

    if (args.role === 'org:caregiver') {
      const updatedMember = { ...existing, role: args.role }
      const employeeProfileId = await ensureCaregiverEmployeeProfile(
        ctx,
        tenantId,
        updatedMember,
      )
      if (employeeProfileId) {
        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
          employeeProfileId,
        })
      }
    }

    return existing._id
  },
})

export const remove = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})


 succeeded in 910ms:
import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { mergeTaskUpdates, validateShiftDocumentation } from './shiftValidation'
import {
  initialShiftStatusForStart,
  isScheduledStartDue,
} from './shiftLifecycle'
import {
  resolveShiftServiceTarget,
  validatePunchLocation,
  type LocationInput,
} from './locationValidation'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'
import type { Id } from './_generated/dataModel'

const DEFAULT_REQUIRED_PROOF_TASK = 'Upload shift documentation proof'
const MAX_BULK_SHIFTS = 500

async function assertCaregiverMember(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  caregiverId: string,
) {
  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
    )
    .unique()

  if (!member || member.role !== 'org:caregiver') {
    throw new Error(
      'Selected caregiver must be an active caregiver in this agency.',
    )
  }
}

function validateShiftTimes(scheduledStart: string, scheduledEnd: string) {
  if (scheduledEnd <= scheduledStart) {
    throw new Error('Shift end time must be after start time.')
  }
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be greater than zero.')
  }
}

async function loadShift(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const shift = await ctx.db.get(shiftId)
  if (!shift) throw new Error('Shift not found.')
  assertTenantDoc(shift, tenantId)
  return shift
}

async function loadProgressNote(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const note = await ctx.db
    .query('progressNotes')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .unique()

  if (!note) throw new Error('Progress note not found.')
  assertTenantDoc(note, tenantId)
  return note
}

async function loadShiftTasks(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const tasks = await ctx.db
    .query('shiftTasks')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()

  for (const task of tasks) assertTenantDoc(task, tenantId)
  return tasks
}

async function findPunch(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
  punchType: 'clock_in' | 'clock_out',
) {
  return ctx.db
    .query('timePunches')
    .withIndex('by_tenant_shift_type', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', punchType),
    )
    .unique()
}

async function assertClockInPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_in')
  if (!existing) {
    throw new Error(
      'You must clock in before you can document or submit this shift.',
    )
  }
}

async function assertClockOutPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_out')
  if (!existing) {
    throw new Error(
      'You must clock out before this shift can be submitted.',
    )
  }
}

async function getShiftGeofence(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
) {
  const settings = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()

  return settings?.shiftGeofence ?? DEFAULT_SHIFT_GEOFENCE
}

async function validateClockPunchLocation(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shift: {
    clientId: Id<'clients'>
    serviceLocationOverride?: {
      label: string
      latitude: number
      longitude: number
      radiusMeters?: number
    } | null
  },
  location: LocationInput | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  const geofence = await getShiftGeofence(ctx, tenantId)
  const required =
    geofence.enabled &&
    (punchType === 'clock_in'
      ? geofence.enforceClockIn
      : geofence.enforceClockOut)

  const client = await ctx.db.get(shift.clientId)
  if (!client) throw new Error('Client not found.')
  assertTenantDoc(client, tenantId)

  const target = resolveShiftServiceTarget(shift, client, geofence)

  return validatePunchLocation({
    location,
    target,
    required,
    maxAccuracyMeters: geofence.maxAccuracyMeters,
  })
}

async function submitShift(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    note: {
      startTime: string
      endTime: string
      servicesProvided: string
      clientResponse: string
      narrative: string
    }
    tasks: {
      taskId: Id<'shiftTasks'>
      status: 'pending' | 'complete'
      proofUrl?: string
      proofName?: string
    }[]
  },
  actor: { subject: string; role: string },
) {
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)

  if (actor.role === 'org:caregiver' && shift.caregiverId !== actor.subject) {
    throw new Error('Caregivers can only submit their assigned shifts.')
  }

  if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
    throw new Error('Only in-progress or corrected shifts can be submitted.')
  }

  await assertClockInPunchExists(ctx, tenantId, args.shiftId)
  await assertClockOutPunchExists(ctx, tenantId, args.shiftId)

  const existingNote = await loadProgressNote(ctx, tenantId, args.shiftId)
  const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)

  const mergedTasks = mergeTaskUpdates(existingTasks, args.tasks)
  const blockers = validateShiftDocumentation(args.note, mergedTasks)
  if (blockers.length > 0) {
    throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
  }

  await ctx.db.patch(existingNote._id, {
    startTime: args.note.startTime,
    endTime: args.note.endTime,
    servicesProvided: args.note.servicesProvided,
    clientResponse: args.note.clientResponse,
    narrative: args.note.narrative,
    submittedBy: actor.subject,
    submittedAt: new Date().toISOString(),
  })

  for (const task of mergedTasks) {
    await ctx.db.patch(task._id, {
      status: task.status,
      proofUrl: task.proofUrl,
      proofName: task.proofName,
    })
  }

  await ctx.db.patch(args.shiftId, { status: 'submitted' })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: 'shift_submitted',
    shiftId: args.shiftId,
    previousStatus: shift.status,
    nextStatus: 'submitted',
  })

  return args.shiftId
}

async function recordClockPunch(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    caregiverId: string
    punchType: 'clock_in' | 'clock_out'
    location?: LocationInput
  },
) {
  const now = new Date().toISOString()
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)
  const locationEvidence = await validateClockPunchLocation(
    ctx,
    tenantId,
    shift,
    args.location,
    args.punchType,
  )

  const existing = await findPunch(ctx, tenantId, args.shiftId, args.punchType)
  if (existing) {
    return existing._id
  }

  const punchId = await ctx.db.insert('timePunches', {
    tenantId,
    shiftId: args.shiftId,
    caregiverId: args.caregiverId,
    punchType: args.punchType,
    at: now,
    source: 'atriax',
    location: locationEvidence,
    adpSyncStatus: 'pending_credentials',
    createdAt: now,
  })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: `shift_${args.punchType === 'clock_in' ? 'clocked_in' : 'clocked_out'}`,
    shiftId: args.shiftId,
    metadata: {
      punchId: punchId as string,
      withinGeofence: locationEvidence?.withinGeofence ?? null,
      distanceMeters: locationEvidence?.distanceMeters ?? null,
    },
  })

  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
    timePunchId: punchId,
  })

  return punchId
}

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)
    validateShiftTimes(args.scheduledStart, args.scheduledEnd)
    validateRate(args.rate)

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId: args.clientId,
      caregiverId: args.caregiverId,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      status: initialShiftStatusForStart(args.scheduledStart),
      serviceType: args.serviceType,
      rate: args.rate,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: DEFAULT_REQUIRED_PROOF_TASK,
      requiredProof: true,
      status: 'pending',
    })

    return shiftId
  },
})

export const createMany = mutation({
  args: {
    clerkOrgId: v.string(),
    clientIds: v.array(v.id('clients')),
    caregiverId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const uniqueClientIds = Array.from(
      new Set(args.clientIds),
    ) as Id<'clients'>[]

    if (uniqueClientIds.length === 0) {
      throw new Error('Select at least one client.')
    }
    if (args.endDate < args.startDate) {
      throw new Error('End date must be on or after start date.')
    }
    if (args.endTime <= args.startTime) {
      throw new Error('End time must be after start time.')
    }
    validateRate(args.rate)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)

    const clients: Array<{
      _id: Id<'clients'>
      serviceType: 'SLS' | 'ILS'
    }> = []
    for (const clientId of uniqueClientIds) {
      const client = await ctx.db.get(clientId)
      if (!client) throw new Error('Client not found.')
      assertTenantDoc(client, tenantId)
      clients.push({ _id: client._id, serviceType: client.serviceType })
    }

    const createdShiftIds: Id<'shifts'>[] = []
    const cursor = new Date(`${args.startDate}T00:00:00Z`)
    const end = new Date(`${args.endDate}T00:00:00Z`)
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date range.')
    }

    const dayCount =
      Math.floor((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalShiftCount = dayCount * clients.length
    if (totalShiftCount > MAX_BULK_SHIFTS) {
      throw new Error(`Bulk schedule is limited to ${MAX_BULK_SHIFTS} shifts.`)
    }

    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      for (const client of clients) {
        const scheduledStart = `${date}T${args.startTime}:00Z`
        const scheduledEnd = `${date}T${args.endTime}:00Z`
        const shiftId = await ctx.db.insert('shifts', {
          tenantId,
          clientId: client._id,
          caregiverId: args.caregiverId,
          scheduledStart,
          scheduledEnd,
          status: initialShiftStatusForStart(scheduledStart),
          serviceType: client.serviceType,
          rate: args.rate,
        })

        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        })

        await ctx.db.insert('shiftTasks', {
          tenantId,
          shiftId,
          title: DEFAULT_REQUIRED_PROOF_TASK,
          requiredProof: true,
          status: 'pending',
        })

        createdShiftIds.push(shiftId)
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return { created: createdShiftIds.length, shiftIds: createdShiftIds }
  },
})

export const startDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only start their assigned shifts.')
    }

    if (shift.status !== 'scheduled') {
      throw new Error('Only scheduled shifts can be opened for documentation.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be documented before their scheduled start.',
      )
    }

    await ctx.db.patch(args.shiftId, { status: 'in_progress' })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_started',
      shiftId: args.shiftId,
      previousStatus: 'scheduled',
      nextStatus: 'in_progress',
    })

    return args.shiftId
  },
})

export const updateProgressNote = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    servicesProvided: v.optional(v.string()),
    clientResponse: v.optional(v.string()),
    narrative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only update their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be updated.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const note = await loadProgressNote(ctx, tenantId, args.shiftId)
    const patch: Record<string, string> = {}
    if (args.startTime !== undefined) patch.startTime = args.startTime
    if (args.endTime !== undefined) patch.endTime = args.endTime
    if (args.servicesProvided !== undefined) {
      patch.servicesProvided = args.servicesProvided
    }
    if (args.clientResponse !== undefined) patch.clientResponse = args.clientResponse
    if (args.narrative !== undefined) patch.narrative = args.narrative

    await ctx.db.patch(note._id, patch)
    return note._id
  },
})

export const submitDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    note: v.object({
      startTime: v.string(),
      endTime: v.string(),
      servicesProvided: v.string(),
      clientResponse: v.string(),
      narrative: v.string(),
    }),
    tasks: v.array(
      v.object({
        taskId: v.id('shiftTasks'),
        status: v.union(v.literal('pending'), v.literal('complete')),
        proofUrl: v.optional(v.string()),
        proofName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:caregiver',
      'org:coordinator',
      'org:admin',
    ])

    return submitShift(ctx, args, { subject: identity.subject, role })
  },
})

export const clockIn = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock in to their assigned shifts.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be clocked in before their scheduled start.',
      )
    }

    if (shift.status !== 'scheduled' && shift.status !== 'in_progress') {
      throw new Error(
        'This shift has already been submitted or completed and cannot be clocked in again.',
      )
    }

    const existing = await findPunch(ctx, tenantId, args.shiftId, 'clock_in')
    if (existing) {
      return { punchId: existing._id, clockInAt: shift.clockInAt }
    }

    const punchId = await recordClockPunch(ctx, {
      clerkOrgId: args.clerkOrgId,
      shiftId: args.shiftId,
      caregiverId: shift.caregiverId,
      punchType: 'clock_in',
      location: args.location,
    })

    const now = new Date().toISOString()
    await ctx.db.patch(args.shiftId, {
      status: 'in_progress',
      clockInAt: now,
    })

    return { punchId, clockInAt: now }
  },
})

export const clockOut = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
    note: v.optional(
      v.object({
        startTime: v.string(),
        endTime: v.string(),
        servicesProvided: v.string(),
        clientResponse: v.string(),
        narrative: v.string(),
      }),
    ),
    tasks: v.optional(
      v.array(
        v.object({
          taskId: v.id('shiftTasks'),
          status: v.union(v.literal('pending'), v.literal('complete')),
          proofUrl: v.optional(v.string()),
          proofName: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock out of their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be clocked out.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)
    const note = args.note ??
      (await loadProgressNote(ctx, tenantId, args.shiftId))
    const mergedTasks = args.tasks
      ? mergeTaskUpdates(existingTasks, args.tasks)
      : existingTasks
    const blockers = validateShiftDocumentation(note, mergedTasks)
    if (blockers.length > 0) {
      throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
    }

    const existingClockOut = await findPunch(
      ctx,
      tenantId,
      args.shiftId,
      'clock_out',
    )

    let punchId: Id<'timePunches'>
    let clockOutAt: string

    if (existingClockOut) {
      punchId = existingClockOut._id
      clockOutAt = shift.clockOutAt ?? existingClockOut.at
    } else {
      const locationEvidence = await validateClockPunchLocation(
        ctx,
        tenantId,
        shift,
        args.location,
        'clock_out',
      )

      const now = new Date().toISOString()

      punchId = await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: args.shiftId,
        caregiverId: shift.caregiverId,
        punchType: 'clock_out',
        at: now,
        source: 'atriax',
        location: locationEvidence,
        adpSyncStatus: 'pending_credentials',
        createdAt: now,
      })

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'shift_clocked_out',
        shiftId: args.shiftId,
        metadata: {
          punchId: punchId as string,
          withinGeofence: locationEvidence?.withinGeofence ?? null,
          distanceMeters: locationEvidence?.distanceMeters ?? null,
        },
      })

      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
        timePunchId: punchId,
      })

      await ctx.db.patch(args.shiftId, { clockOutAt: now })
      clockOutAt = now
    }

    await submitShift(
      ctx,
      {
        clerkOrgId: args.clerkOrgId,
        shiftId: args.shiftId,
        note: {
          startTime: note.startTime,
          endTime: note.endTime,
          servicesProvided: note.servicesProvided,
          clientResponse: note.clientResponse,
          narrative: note.narrative,
        },
        tasks: mergedTasks.map((task) => ({
          taskId: task._id,
          status: task.status,
          proofUrl: task.proofUrl,
          proofName: task.proofName,
        })),
      },
      { subject: identity.subject, role },
    )

    return { punchId, clockOutAt }
  },
})

export const updateServiceLocationOverride = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    serviceLocationOverride: v.optional(
      v.object({
        label: v.string(),
        addressLine: v.optional(v.string()),
        latitude: v.number(),
        longitude: v.number(),
        radiusMeters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    await loadShift(ctx, tenantId, args.shiftId)

    if (args.serviceLocationOverride !== undefined) {
      if (
        !Number.isFinite(args.serviceLocationOverride.latitude) ||
        args.serviceLocationOverride.latitude < -90 ||
        args.serviceLocationOverride.latitude > 90
      ) {
        throw new Error('latitude must be between -90 and 90.')
      }

      if (
        !Number.isFinite(args.serviceLocationOverride.longitude) ||
        args.serviceLocationOverride.longitude < -180 ||
        args.serviceLocationOverride.longitude > 180
      ) {
        throw new Error('longitude must be between -180 and 180.')
      }

      if (
        args.serviceLocationOverride.radiusMeters !== undefined &&
        (!Number.isFinite(args.serviceLocationOverride.radiusMeters) ||
          args.serviceLocationOverride.radiusMeters <= 0)
      ) {
        throw new Error('radiusMeters must be greater than zero.')
      }
    }

    await ctx.db.patch(args.shiftId, {
      serviceLocationOverride: args.serviceLocationOverride,
    })

    return args.shiftId
  },
})

export const updateStatus = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    status: v.union(v.literal('scheduled'), v.literal('in_progress')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    await ctx.db.patch(args.shiftId, { status: args.status })
    return args.shiftId
  },
})


 succeeded in 872ms:
import type { QueryCtx, MutationCtx } from './_generated/server'
import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'

export type AuthContext = QueryCtx | MutationCtx
export type TenantRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

export async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  return identity
}

export async function requireTenant(ctx: AuthContext, clerkOrgId: string) {
  const identity = await requireIdentity(ctx)
  requireMatchingClerkOrganization(identity, clerkOrgId)

  const tenant = await ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()

  if (!tenant) {
    throw new ConvexError('Unauthorized: tenant not found.')
  }

  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
    )
    .unique()

  if (!member) {
    throw new ConvexError('Forbidden: not a member of this tenant.')
  }

  return {
    tenantId: tenant._id,
    tenant,
    clerkOrgId,
    identity,
    member,
    role: member.role,
  }
}

export async function requireTenantRole(
  ctx: AuthContext,
  clerkOrgId: string,
  allowedRoles: TenantRole[],
) {
  const { tenantId, tenant, identity, member, role } = await requireTenant(
    ctx,
    clerkOrgId,
  )

  if (!allowedRoles.includes(role)) {
    throw new ConvexError(
      `Forbidden: required one of [${allowedRoles.join(', ')}].`,
    )
  }

  return { tenantId, tenant, clerkOrgId, identity, member, role }
}

export function assertTenantDoc<T extends { tenantId: unknown }>(
  doc: T,
  tenantId: Id<'tenants'>,
): asserts doc is T & { tenantId: Id<'tenants'> } {
  if (doc.tenantId !== tenantId) {
    throw new ConvexError('Forbidden: cross-tenant access denied.')
  }
}

export async function getTenantByClerkOrgId(
  ctx: AuthContext,
  clerkOrgId: string,
) {
  return ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
}

function normalizeTenantRole(role: unknown): TenantRole | null {
  if (
    role === 'org:admin' ||
    role === 'org:coordinator' ||
    role === 'org:caregiver'
  ) {
    return role
  }

  if (role === 'admin') return 'org:admin'
  if (role === 'coordinator') return 'org:coordinator'
  if (role === 'caregiver') return 'org:caregiver'

  return null
}

export function getActiveClerkOrganizationId(identity: {
  [key: string]: unknown
}) {
  if (typeof identity.org_id === 'string') return identity.org_id

  const compactOrg = identity.o
  if (
    compactOrg &&
    typeof compactOrg === 'object' &&
    'id' in compactOrg &&
    typeof (compactOrg as Record<string, unknown>).id === 'string'
  ) {
    return (compactOrg as Record<string, unknown>).id as string
  }

  if (typeof identity['o.id'] === 'string') return identity['o.id']

  return null
}

export function getClerkOrganizationRole(identity: {
  [key: string]: unknown
}): TenantRole | null {
  const topLevelRole = normalizeTenantRole(identity.org_role)
  if (topLevelRole) return topLevelRole

  const compactOrg = identity.o
  if (compactOrg && typeof compactOrg === 'object' && 'rol' in compactOrg) {
    return normalizeTenantRole(
      (compactOrg as Record<string, unknown>).rol,
    )
  }

  return normalizeTenantRole(identity['o.rol'])
}

export function requireMatchingClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (typeof activeOrgId === 'string' && activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

/** Stricter variant that REQUIRES org_id to be present and match.
 *  Use for bootstrap mutations where missing org context is suspicious.
 */
export function requireActiveClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (!activeOrgId) {
    throw new ConvexError(
      'Forbidden: active Clerk organization required but missing from token.',
    )
  }
  if (activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

export async function ensureTenantMember(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
) {
  return ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
}


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests/e2e/helpers/auth.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'playwright.config.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.env.example'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\summary.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\review_codex_iter1.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 853ms:
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})


 succeeded in 869ms:
import { expect, type Page } from '@playwright/test'

export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
export const E2E_CAREGIVER_EMAIL = process.env.E2E_CAREGIVER_EMAIL ?? ''
export const E2E_CAREGIVER_PASSWORD = process.env.E2E_CAREGIVER_PASSWORD ?? ''
export const E2E_COORDINATOR_EMAIL = process.env.E2E_COORDINATOR_EMAIL ?? ''
export const E2E_COORDINATOR_PASSWORD = process.env.E2E_COORDINATOR_PASSWORD ?? ''

export function e2eCredentialsAvailable(): boolean {
  return Boolean(
    E2E_ORG_ID &&
      E2E_ADMIN_EMAIL &&
      E2E_ADMIN_PASSWORD &&
      E2E_CAREGIVER_EMAIL &&
      E2E_CAREGIVER_PASSWORD &&
      E2E_COORDINATOR_EMAIL &&
      E2E_COORDINATOR_PASSWORD,
  )
}

export function assertE2ECredentialsConfigured(): void {
  if (!e2eCredentialsAvailable()) {
    throw new Error(
      'E2E Clerk credentials are not configured. Set E2E_CLERK_ORG_ID, E2E_ADMIN_EMAIL/PASSWORD, E2E_CAREGIVER_EMAIL/PASSWORD, and E2E_COORDINATOR_EMAIL/PASSWORD.',
    )
  }
}

async function selectOrgIfAsked(page: Page, orgId: string) {
  // Clerk's organization switcher may appear after sign-in. Try to select the
  // expected org by its id or name, or just wait for the app to settle.
  const orgButton = page.locator(`[data-testid="organization-button-${orgId}"]`).or(
    page.locator(`button:has-text("${orgId}")`),
  )
  if (await orgButton.isVisible().catch(() => false)) {
    await orgButton.click()
    await page.waitForLoadState('networkidle')
  }
}

export async function signInWithClerk(
  page: Page,
  email: string,
  password: string,
  orgId: string,
) {
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)

  // Clerk sign-in flow: email -> continue -> password -> continue
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[inputmode="email"]').first()
  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)

  const continueButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await continueButton.click()

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
  await expect(passwordInput).toBeVisible({ timeout: 10000 })
  await passwordInput.fill(password)

  const submitButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await submitButton.click()

  // Wait for navigation away from sign-in
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')

  await selectOrgIfAsked(page, orgId)
}

export async function signOut(page: Page) {
  // Clear Clerk session state so the next sign-in starts fresh.
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')
}

async function extractClerkToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const keys = ['__clerk_client_jwt', '__session', '__clerk_session_jwt']
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (value) return value
    }
    return null
  })
}

export async function resetE2EShifts(page: Page) {
  assertE2ECredentialsConfigured()

  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is not set; cannot reset e2e fixtures.')
  }

  const token = await extractClerkToken(page)
  if (!token) {
    throw new Error('Could not extract Clerk session token; cannot reset e2e fixtures.')
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      path: 'seed:resetE2EShifts',
      args: { clerkOrgId: E2E_ORG_ID },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`resetE2EShifts failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('resetE2EShifts result:', result)

  await signOut(page)
}


 succeeded in 815ms:
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_CONVEX_URL=https://tidy-crocodile-154.convex.cloud

# Set this in Convex environment variables, not in frontend hosting.
# Required for organization invite emails to redirect back into ATRIA-X.
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

# ADP Workforce Now integration (server-side Convex env only).
# Leave unset to run safely without ADP credentials; sync rows become pending_credentials.
ADP_TOKEN_URL=
ADP_BASE_URL=
ADP_CLIENT_ID=
ADP_CLIENT_SECRET=
ADP_CLIENT_CERT_PEM=
ADP_CLIENT_KEY_PEM=


 succeeded in 843ms:
# ATRIA-X Phase 1 Session 8 â€” Implementation Summary

## Goal

Implement and verify end-to-end and integration test coverage for the complete caregiver-to-billing shift lifecycle, geofence enforcement, and ADP mock integration contracts.

## Files Changed

- `convex/seed.ts` â€” `seedE2E` now accepts real Clerk user IDs for admin/coordinator/caregiver, resets fixture shifts/reviews/billing/punches/tasks to a clean scheduled baseline, and resets geofence settings to disabled on every run. Added `resetE2EShifts` mutation used between serial e2e tests.
- `convex/_generated/*` â€” regenerated via `npx convex codegen` against the local backend (no hand edits).
- `src/features/coordinator/pages/CoordinatorReviewPage.tsx` â€” added `data-shift-status` to review rows so e2e can assert the underlying shift status (e.g. `billing_ready`).
- `src/features/dashboard/pages/DashboardPage.tsx` â€” removed trailing blank line at EOF so `git diff --check` passes.
- `tests/e2e/helpers/auth.ts` â€” replaced skip helper with `assertE2ECredentialsConfigured` (fails fast instead of skipping), added `resetE2EShifts` helper.
- `tests/e2e/global-setup.ts` â€” collects actual Clerk user IDs for all three roles and passes them to `seed:seedE2E`; skips seed gracefully when credentials are absent so baseline smoke tests still run.
- `tests/e2e/phase1-lifecycle.spec.ts` â€” added Clock Out disabled-before-completion assertion, status color assertions for correction/resubmission, and `data-shift-status="billing_ready"` assertion after approval.
- `tests/e2e/geofence.spec.ts` â€” outside/denied scenarios now click Clock In to exercise the real location request and blocked UI; each enforcement test enables geofence itself; `afterEach` resets fixtures so serial tests stay independent.
- Removed stray root artifact `({i`.
- `.hermes-pipeline/20260626_161701/implementation-plan.md` â€” updated staging checklist.
- `.hermes-pipeline/20260626_161701/summary.md` â€” this file.

## Required Gates

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Convex codegen | `npx convex codegen` | **PASS** | Ran successfully against the local Convex backend (`anonymous-agent`) by overriding the deployment-only `CONVEX_DEPLOY_KEY`. Generated files committed. |
| Lint | `npm run lint` | **PASS** | 0 errors. |
| Typecheck | `npm run typecheck` | **PASS** | 0 errors. |
| Unit tests | `npm run test` | **PASS** | 37 files, 276 tests passing. |
| E2E tests | `npm run e2e` | **FAIL (credentials)** | 4 baseline smoke tests pass. The 5 new required lifecycle/geofence specs now fail fast with a clear error when `E2E_CLERK_ORG_ID` and test-account credentials are not configured, instead of being skipped. They will run once credentials are provided. |

## E2E Credential Requirement

The new e2e specs require these environment variables to run against real Clerk test accounts:

- `E2E_CLERK_ORG_ID`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_CAREGIVER_EMAIL` / `E2E_CAREGIVER_PASSWORD`
- `E2E_COORDINATOR_EMAIL` / `E2E_COORDINATOR_PASSWORD`

When set, `global-setup.ts` signs in each role, extracts the real Clerk user IDs, and calls `seed:seedE2E` to create deterministic fixtures. The specs then exercise the full lifecycle and geofence flows, and `seed:resetE2EShifts` is called between serial geofence tests to keep the baseline clean.

## Verification Notes

- `seedE2E` now uses configured Clerk user IDs instead of hard-coded `e2e-*` placeholders, so tenant auth and shift visibility work with real accounts.
- Fixture settings and shifts are reset idempotently on every seed run.
- ADP contract tests assert that `timePunches` with location evidence do **not** send latitude/longitude/distance in the ADP punch payload.
- Secret-redaction test asserts mock ADP credentials do not appear in `integrationEvents` or `adpError` after a failure.
- Billing invariant verified: `reviews.approve` rejects incomplete documentation and only creates a `billingLines` row for complete, submitted shifts.
- Geofence server tests verify punches are rejected outside radius / with missing location / with poor accuracy, and no `timePunches` row is created on rejection.
- `git diff --check` now reports only CRLF warnings (pre-existing line-ending settings); no blank-line errors remain.


 succeeded in 847ms:
# stage review_codex_iter1
# cmd: codex exec --ignore-user-config --sandbox read-only --color never --ephemeral --skip-git-repo-check 'Read the file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter1.prompt.md and carry out its instructions completely and autonomously. Do not ask questions; make reasonable decisions and finish the task. Output your final result (plan / review / summary) as your last message.'

Reading additional input from stdin...
OpenAI Codex v0.136.0
--------
workdir: C:\Users\pinol\Documents\Work\atriax\solid-pancake
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: none
reasoning summaries: none
session id: 019f062d-4a51-77b1-8d82-8224a0d54840
--------
user
Read the file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701\review_codex_iter1.prompt.md and carry out its instructions completely and autonomously. Do not ask questions; make reasonable decisions and finish the task. Output your final result (plan / review / summary) as your last message.
codex
Iâ€™ll read the pipeline prompt first, then pull only the repo context it points to so the final output matches its requested format.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake\\.hermes-pipeline\\20260626_161701\\review_codex_iter1.prompt.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 637ms:
# ROLE: REVIEWER (codex)

You review the uncommitted changes in this repository against the task and acceptance criteria.
Inspect the diff with `git diff` and `git status`. Do NOT edit code.

Cover: correctness, security (HIPAA / multi-tenancy / auth), style-rule compliance, test coverage
(unit + e2e + stress), and missed edge cases. List each required change as a numbered actionable item.

Request changes only for concrete blockers: acceptance-criteria misses, regressions, money/security/PHI
risks, broken contracts, or missing tests for touched behavior. Do not block the run on speculative polish,
style preferences outside the project rules, or unrelated repo baseline failures; call those out as
follow-ups instead.

## Project context
ATRIA-X: multi-tenant SaaS for home-care agencies. React19+Vite8+TS, Tailwind4, React Router 7, Clerk (auth/orgs), Convex (backend+DB), Vitest, Playwright. Formatting: 2-space indent, single quotes, NO semicolons, PascalCase components, camelCase utils. CORE RULE: a service is never billed unless its shift documentation is complete and approved (caregiver->coordinator->billing). Multi-tenancy is the central invariant: every Convex fn touching tenant data MUST go through authHelpers.ts guards (requireTenant / requireTenantRole / assertTenantDoc); enforce auth twice (RouteGuard + server). Roles: org:admin, org:coordinator, org:caregiver. After editing convex/* run `npx convex codegen`. Never edit convex/_generated by hand. Follow CLAUDE.md/AGENTS.md.

## Task
ATRIA-X Phase 1 SESSION 8 Ã¢â‚¬â€ E2E + ADP contract tests + plug-and-play dry run.

MANDATORY EXECUTION CONSTRAINTS:
- Do not use Opus/Claude. Use Codex for plan and review, Kimi for implementation/fix as configured by the pipeline.
- Keep changes conservative and minimalistic. Respect the existing project structure and design.
- If unsure about code or files, open them. Do not hallucinate.
- Style: single quotes, no semicolons, 2-space indentation.
- Follow ATRIA-X rules: tenant access through authHelpers; never bill a shift until documentation is complete and approved; run Convex codegen after Convex API/schema changes.
- Optimize the flow for speed only where quality is not reduced: do not skip required gates.
- Create a detailed design/staging document artifact for this session (prefer the pipeline run directory, e.g. design-doc.md / implementation-plan.md; if versioning a docs file in repo is necessary, do it through the pipeline only). The doc must divide the implementation into stages and include a detailed to-do list for each stage before implementation.

TASK:
Implement/verify ATRIA-X Phase 1 end-to-end and integration test coverage.

(1) Playwright e2e for the full lifecycle against seeded data with geofence disabled:
- Command target: npm run e2e.
- Flow: caregiver logs in, opens assigned shift, Clock In, completes the 6-step note.
- Verify Clock Out is disabled until the note is complete, then enabled.
- Clock Out -> shift submitted.
- Coordinator logs in, sees it in the review queue, opens detail, requests a correction.
- Caregiver fixes + resubmits.
- Coordinator approves -> shift becomes billing-ready.
- Assert status = color + word at each step.

(2) Playwright/logic coverage for geofence enabled:
- Mock browser geolocation inside radius => Clock In/Out allowed and location evidence stored.
- Mock outside radius => UI shows the Figma-style blocked state and server rejects.
- Deny geolocation permission => UI shows blocked state and no punch is created.
- Disable the setting as admin/coordinator => location is no longer requested.

(3) ADP contract/integration tests using the mock adapter:
- Unconfigured tenant -> clock-in/out succeed and timePunches are marked pending_credentials; app remains fully usable.
- Flip integrationConnections.status to configured with mock creds and run sync engine -> queued punches post exactly once (idempotent), adpPunchId stored, statuses go synced.
- Run adpInitialWorkerLoad -> existing profiles matched by email, new ones created with adpAssociateOid.
- createCaregiver enqueues a worker sync that drains to synced.
- Assert NO secret values or raw ADP credentials appear in integrationEvents/logs.
- Assert location evidence is NOT included in ADP punch payloads unless ADP explicitly requires it later.

Seed/fixtures:
- Update seed.ts if needed for e2e fixtures, idempotently.
- Prefer deterministic seeded users/roles/shifts/settings.

Required gates for this session:
- codegen if Convex API/schema changed
- npm run lint
- npm run typecheck
- npm run test
- npm run e2e
All required gates must be genuinely green before reporting success. Report real pass/fail for each gate in summary.md.

## Latest gate results (for your awareness)
> vitest run --configLoader native


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.6 [39m[90mC:/Users/pinol/Documents/Work/atriax/solid-pancake[39m

 [32mÃ¢Å“â€œ[39m src/features/team/pages/TeamPage.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 7081[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m creates caregiver invitations through the server redirect flow [33m 1361[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m passes coordinator intent to the server invitation flow [33m 1154[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m maps coordinator role to org:member when updating Clerk membership [33m 330[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m refreshes invitations list after sending an invite [33m 827[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m shows "already a member" message when invitee is already in the org [33m 960[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m adds a caregiver through the caregiver form [33m 1627[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/caregiver/components/ShiftDocumentationForm.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 7381[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m renders the clock-in screen when not clocked in [33m 628[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m advances through each wizard step after clock-in [33m 2430[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m calls clockOut with location when geofence is enabled and note is complete [33m 838[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m shows outside-radius server error in plain language [33m 828[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m disables the clock-out button and shows a loading label while submitting [33m 734[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m calls onDone when returning home from the success screen [33m 826[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m autosaves draft note fields [33m 491[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/clients/pages/ClientsPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 3158[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m uses caregiver email as the scheduling dropdown label [33m 1066[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m opens the address dialog and saves the service address [33m 1967[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/auth/SelectAgencyPage.test.tsx [2m([22m[2m8 tests[22m[2m)[22m[33m 3563[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m does not call Convex while Convex auth is loading [33m 1015[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m shows visible error on bootstrap failure and stays on page [33m 310[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m retries once on transient token error, then succeeds [33m 742[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m shows JWT config error when retry also fails with missing org claim [33m 609[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/coordinator/components/ReviewDetail.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 2872[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m renders note sections from getWithDetails [33m 475[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m calls approve mutation when Approve is clicked [33m 829[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m calls requestCorrection mutation after typing a comment [33m 1317[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/settings/pages/GeofenceSettingsPage.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 1415[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m renders the current geofence settings [33m 461[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m toggles enforcement options when geofence is enabled [33m 380[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m saves updated geofence settings [33m 566[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/shared/ui/sharedUi.test.tsx [2m([22m[2m18 tests[22m[2m)[22m[33m 736[2mms[22m[39m
       [33m[2mÃ¢Å“â€œ[22m[39m renders a default secondary button [33m 443[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/coordinator/pages/CoordinatorReviewPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 671[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m renders populated queue with status pills [33m 463[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/caregiver/components/ShiftClockOutScreen.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 416[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m disables clock-out when note is incomplete [33m 357[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/adpSync.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 922[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m marks punch pending_credentials when ADP is not configured and syncs after configuration [33m 427[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/shared/testing/convexApi.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 390[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/shell/Sidebar.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 321[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/providers.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 396[2mms[22m[39m
     [33m[2mÃ¢Å“â€œ[22m[39m connects Clerk routing to React Router [33m 385[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/shiftClock.behavior.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 414[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/reviews.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 127[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/shell/RouteGuard.test.tsx [2m([22m[2m14 tests[22m[2m)[22m[32m 211[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/router.test.tsx [2m([22m[2m6 tests[22m[2m)[22m[32m 147[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/seed.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 136[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/employeeProfiles.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 251[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/members.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 144[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/platform.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 168[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/caregiver/hooks/useCaregiverLocation.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 91[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/shiftClock.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 124[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/shared/domain/shiftRules.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 27[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/caregiver/model/documentationWizard.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 20[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/locationValidation.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 27[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/timePunches.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 25[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/billing/model/invoiceUtils.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/features/caregiver/model/documentationDraft.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/app/reloadOnStaleAssets.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/authHelpers.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 22[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/tenantSettings.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/shiftValidation.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/shiftLifecycle.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/files.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m convex/integrations/adp/adpClient.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32mÃ¢Å“â€œ[39m src/shared/search/embedding.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 17[2mms[22m[39m

[2m Test Files [22m [1m[32m37 passed[39m[22m[90m (37)[39m
[2m      Tests [22m [1m[32m276 passed[39m[22m[90m (276)[39m
[2m   Start at [22m 17:00:14
[2m   Duration [22m 242.91s[2m (transform 4.62s, setup 16.54s, import 20.03s, tests 31.37s, environment 153.48s)[22m


----- exit code: 0 -----

===== postimpl_typecheck run 1/1: npm run typecheck =====

> mariatest@0.0.0 typecheck
> tsc -b


----- exit code: 0 -----

## REQUIRED: the FINAL line of your output must be EXACTLY one of:
VERDICT: APPROVED
VERDICT: CHANGES_REQUESTED

Approve only if the change is correct, secure, well-tested, and style-compliant.


codex
The prompt is a review-only task: inspect uncommitted changes, do not edit code, and end with an approval verdict line. Iâ€™m collecting the diff, status, and local project rules before checking the touched behavior.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg --files -g 'AGENTS.md' -g 'CLAUDE.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --stat' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
2026-06-26T23:05:32.215739Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.6 seconds
Output:

 exited 1 in 594ms:
 succeeded in 716ms:
 M .env.example
 M convex/_generated/api.d.ts
 M convex/_generated/api.js
 M convex/_generated/server.d.ts
 M convex/_generated/server.js
 M convex/adpSync.ts
 M convex/invitations.ts
 M convex/members.ts
 M convex/reviews.ts
 M convex/schema.ts
 M convex/seed.ts
 M convex/shiftClock.test.ts
 M convex/shiftQueries.ts
 M convex/shifts.ts
 M convex/tenants.ts
 M eslint.config.js
 M package.json
 M playwright.config.ts
 M src/app/router.tsx
 M src/app/shell/Sidebar.tsx
 M src/features/caregiver/components/ShiftDocumentationForm.tsx
 M src/features/caregiver/components/ShiftTaskList.tsx
 M src/features/caregiver/model/documentationDraft.ts
 M src/features/caregiver/pages/CaregiverTodayPage.tsx
 M src/features/clients/pages/ClientsPage.test.tsx
 M src/features/clients/pages/ClientsPage.tsx
 M src/features/coordinator/components/ReviewDetail.tsx
 M src/features/coordinator/components/ReviewHistory.tsx
 M src/features/coordinator/pages/CoordinatorReviewPage.tsx
 M src/features/dashboard/pages/DashboardPage.tsx
 M src/features/platform/pages/PlatformAdminPage.tsx
 M src/features/team/pages/TeamPage.test.tsx
 M src/features/team/pages/TeamPage.tsx
 M src/index.css
 M src/shared/format.ts
 M src/shared/testing/convexApi.test.ts
 M src/shared/ui/AppLoader.tsx
 M src/shared/ui/Badge.tsx
 M src/shared/ui/Button.tsx
 M src/shared/ui/Card.tsx
 M src/shared/ui/Checkbox.tsx
 M src/shared/ui/Dialog.tsx
 M src/shared/ui/Input.tsx
 M src/shared/ui/KpiCard.tsx
 M src/shared/ui/Select.tsx
 M src/shared/ui/StatusBadge.tsx
 M src/shared/ui/Table.tsx
 M src/shared/ui/Textarea.tsx
 M src/shared/ui/index.ts
 M tsconfig.app.json
 M vite.config.ts
?? ({i
?? .hermes-pipeline/
?? convex/adpOutbound.ts
?? convex/adpSync.test.ts
?? convex/employeeProfiles.test.ts
?? convex/employeeProfiles.ts
?? convex/integrations/
?? convex/reviews.test.ts
?? convex/tsconfig.json
?? src/features/caregiver/components/LocationStatusPanel.tsx
?? src/features/caregiver/components/MissingChecklist.tsx
?? src/features/caregiver/components/ShiftClockInScreen.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.test.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.tsx
?? src/features/caregiver/components/ShiftDocumentationForm.test.tsx
?? src/features/caregiver/components/ShiftNoteStep.tsx
?? src/features/caregiver/components/ShiftSuccessScreen.tsx
?? src/features/caregiver/hooks/
?? src/features/caregiver/model/documentationWizard.test.ts
?? src/features/caregiver/model/documentationWizard.ts
?? src/features/coordinator/components/ReviewDetail.test.tsx
?? src/features/coordinator/pages/CoordinatorReviewPage.test.tsx
?? src/features/settings/
?? src/shared/ui/EmptyState.tsx
?? src/shared/ui/FieldGroup.tsx
?? src/shared/ui/ProgressSteps.tsx
?? src/shared/ui/Toast.tsx
?? src/shared/ui/sharedUi.test.tsx
?? tests/e2e/geofence.spec.ts
?? tests/e2e/global-setup.ts
?? tests/e2e/helpers/
?? tests/e2e/phase1-lifecycle.spec.ts

 succeeded in 714ms:
 .env.example                                       |   9 +
 convex/_generated/api.d.ts                         |  53 +-
 convex/_generated/api.js                           |   3 +-
 convex/_generated/server.d.ts                      |   2 -
 convex/_generated/server.js                        |   2 -
 convex/adpSync.ts                                  | 346 +++++++++++-
 convex/invitations.ts                              |  82 +--
 convex/members.ts                                  |  49 +-
 convex/reviews.ts                                  |   4 +
 convex/schema.ts                                   |   8 +-
 convex/seed.ts                                     | 218 ++++++++
 convex/shiftClock.test.ts                          | 243 ++++++++-
 convex/shiftQueries.ts                             |  42 +-
 convex/shifts.ts                                   |   8 +-
 convex/tenants.ts                                  |  18 +
 eslint.config.js                                   |  12 +-
 package.json                                       |  10 +-
 playwright.config.ts                               |   4 +-
 src/app/router.tsx                                 |  17 +
 src/app/shell/Sidebar.tsx                          |   7 +
 .../components/ShiftDocumentationForm.tsx          | 519 +++++++++++-------
 .../caregiver/components/ShiftTaskList.tsx         |  45 +-
 src/features/caregiver/model/documentationDraft.ts |  68 +++
 .../caregiver/pages/CaregiverTodayPage.tsx         | 212 +++++---
 src/features/clients/pages/ClientsPage.test.tsx    | 214 +++++++-
 src/features/clients/pages/ClientsPage.tsx         | 256 ++++++++-
 .../coordinator/components/ReviewDetail.tsx        | 577 +++++++++++++++++----
 .../coordinator/components/ReviewHistory.tsx       | 161 ++++--
 .../coordinator/pages/CoordinatorReviewPage.tsx    | 333 +++++++++---
 src/features/dashboard/pages/DashboardPage.tsx     | 221 +++++---
 src/features/platform/pages/PlatformAdminPage.tsx  |  13 +-
 src/features/team/pages/TeamPage.test.tsx          | 172 +++++-
 src/features/team/pages/TeamPage.tsx               | 204 +++++++-
 src/index.css                                      | 135 ++++-
 src/shared/format.ts                               |  69 +++
 src/shared/testing/convexApi.test.ts               |  10 +-
 src/shared/ui/AppLoader.tsx                        |   8 +-
 src/shared/ui/Badge.tsx                            |   5 +-
 src/shared/ui/Button.tsx                           |  26 +-
 src/shared/ui/Card.tsx                             |   8 +-
 src/shared/ui/Checkbox.tsx                         |   2 +-
 src/shared/ui/Dialog.tsx                           |  12 +-
 src/shared/ui/Input.tsx                            |  13 +-
 src/shared/ui/KpiCard.tsx                          |  12 +-
 src/shared/ui/Select.tsx                           |  13 +-
 src/shared/ui/StatusBadge.tsx                      |  63 ++-
 src/shared/ui/Table.tsx                            |   6 +-
 src/shared/ui/Textarea.tsx                         |  10 +-
 src/shared/ui/index.ts                             |   8 +-
 tsconfig.app.json                                  |   2 +-
 vite.config.ts                                     |  54 +-
 51 files changed, 3798 insertions(+), 790 deletions(-)
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

codex
This is a broad Phase 1 change set with backend, UI, generated Convex files, seed data, and e2e tests touched. Iâ€™m going to focus review on the taskâ€™s contractual areas first: lifecycle e2e, geofence behavior, ADP sync contracts, tenant/auth guards, and reported gate evidence.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg --files .hermes-pipeline' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'package.json'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --name-only' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'playwright.config.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 785ms:
.hermes-pipeline\20260624_184258\plan_final.md
.hermes-pipeline\20260624_184258\plan_codex.prompt.md
.hermes-pipeline\20260624_184258\plan_codex.md
.hermes-pipeline\20260624_184258\implement.prompt.md
.hermes-pipeline\20260623_194138\summary.md
.hermes-pipeline\20260623_194138\summary.json
.hermes-pipeline\20260623_194138\review_codex_iter4.prompt.md
.hermes-pipeline\20260623_194138\review_codex_iter4.md
.hermes-pipeline\20260623_194138\review_codex_iter3.prompt.md
.hermes-pipeline\20260623_194138\review_codex_iter3.md
.hermes-pipeline\20260623_194138\review_codex_iter2.prompt.md
.hermes-pipeline\20260623_194138\review_codex_iter2.md
.hermes-pipeline\20260623_194138\review_codex_iter1.prompt.md
.hermes-pipeline\20260623_194138\review_codex_iter1.md
.hermes-pipeline\20260623_194138\plan_final.md
.hermes-pipeline\20260623_194138\plan_codex.prompt.md
.hermes-pipeline\20260623_194138\plan_codex.md
.hermes-pipeline\20260623_194138\implement.prompt.md
.hermes-pipeline\20260623_194138\fix_iter4.prompt.md
.hermes-pipeline\20260623_194138\fix_iter3.prompt.md
.hermes-pipeline\20260623_194138\fix_iter2.prompt.md
.hermes-pipeline\20260623_194138\fix_iter1.prompt.md
.hermes-pipeline\20260624_161335\summary.md
.hermes-pipeline\20260624_161335\summary.json
.hermes-pipeline\20260624_161335\review_codex_iter2.prompt.md
.hermes-pipeline\20260624_161335\review_codex_iter2.md
.hermes-pipeline\20260624_161335\review_codex_iter1.prompt.md
.hermes-pipeline\20260624_161335\review_codex_iter1.md
.hermes-pipeline\20260624_161335\plan_final.md
.hermes-pipeline\20260624_161335\plan_codex.prompt.md
.hermes-pipeline\20260624_161335\plan_codex.md
.hermes-pipeline\20260624_161335\implement.prompt.md
.hermes-pipeline\20260624_161335\fix_iter1.prompt.md
.hermes-pipeline\20260625_165149\vite.screenshot.config.ts
.hermes-pipeline\20260625_165149\summary.md
.hermes-pipeline\20260625_165149\summary.json
.hermes-pipeline\20260624_162530\summary.md
.hermes-pipeline\20260624_162530\summary.json
.hermes-pipeline\20260624_162530\review_codex_iter3.prompt.md
.hermes-pipeline\20260624_162530\review_codex_iter3.md
.hermes-pipeline\20260624_162530\review_codex_iter2.prompt.md
.hermes-pipeline\20260624_162530\review_codex_iter2.md
.hermes-pipeline\20260624_162530\review_codex_iter1.prompt.md
.hermes-pipeline\20260624_162530\review_codex_iter1.md
.hermes-pipeline\20260624_162530\plan_final.md
.hermes-pipeline\20260624_162530\plan_codex.prompt.md
.hermes-pipeline\20260624_162530\plan_codex.md
.hermes-pipeline\20260624_162530\implement.prompt.md
.hermes-pipeline\20260624_162530\fix_iter3.prompt.md
.hermes-pipeline\20260624_162530\fix_iter2.prompt.md
.hermes-pipeline\20260624_162530\fix_iter1.prompt.md
.hermes-pipeline\20260625_165149\screenshots\app-signup.png
.hermes-pipeline\20260625_165149\screenshots\app-home.png
.hermes-pipeline\20260625_165149\screenshots\app-coordinator-queue.png
.hermes-pipeline\20260625_165149\screenshots\app-coordinator-detail.png
.hermes-pipeline\20260625_165149\screenshots\app-coordinator-dashboard.png
.hermes-pipeline\20260625_165149\screenshot.spec.ts
.hermes-pipeline\20260623_153328\summary.md
.hermes-pipeline\20260623_153328\summary.json
.hermes-pipeline\20260623_153328\review_codex_iter4.prompt.md
.hermes-pipeline\20260623_153328\review_codex_iter4.md
.hermes-pipeline\20260623_153328\review_codex_iter3.prompt.md
.hermes-pipeline\20260623_153328\review_codex_iter3.md
.hermes-pipeline\20260623_153328\review_codex_iter2.prompt.md
.hermes-pipeline\20260623_153328\review_codex_iter2.md
.hermes-pipeline\20260623_153328\review_codex_iter1.prompt.md
.hermes-pipeline\20260623_153328\review_codex_iter1.md
.hermes-pipeline\20260623_153328\plan_final.md
.hermes-pipeline\20260623_153328\plan_codex.prompt.md
.hermes-pipeline\20260623_153328\plan_codex.md
.hermes-pipeline\20260623_153328\implement.prompt.md
.hermes-pipeline\20260623_153328\fix_iter4.prompt.md
.hermes-pipeline\20260623_153328\fix_iter3.prompt.md
.hermes-pipeline\20260623_153328\fix_iter2.prompt.md
.hermes-pipeline\20260623_153328\fix_iter1.prompt.md
.hermes-pipeline\20260624_161802\review_codex_iter3.prompt.md
.hermes-pipeline\20260624_161802\review_codex_iter3.md
.hermes-pipeline\20260624_161802\review_codex_iter2.prompt.md
.hermes-pipeline\20260624_161802\review_codex_iter2.md
.hermes-pipeline\20260624_161802\review_codex_iter1.prompt.md
.hermes-pipeline\20260624_161802\review_codex_iter1.md
.hermes-pipeline\20260624_161802\plan_final.md
.hermes-pipeline\20260624_161802\plan_codex.prompt.md
.hermes-pipeline\20260624_161802\plan_codex.md
.hermes-pipeline\20260624_161802\implement.prompt.md
.hermes-pipeline\20260624_161802\fix_iter3_summary.md
.hermes-pipeline\20260624_161802\fix_iter3.prompt.md
.hermes-pipeline\20260624_161802\fix_iter2.prompt.md
.hermes-pipeline\20260624_161802\fix_iter1_summary.md
.hermes-pipeline\20260624_161802\fix_iter1.prompt.md
.hermes-pipeline\20260625_165149\plan_codex.md
.hermes-pipeline\20260625_165149\implement.prompt.md
.hermes-pipeline\20260625_165149\fix_iter1.prompt.md
.hermes-pipeline\20260625_165149\figma_screen_spec.md
.hermes-pipeline\20260624_102243\summary.md
.hermes-pipeline\20260624_102243\summary.json
.hermes-pipeline\20260624_102243\review_codex_iter4.prompt.md
.hermes-pipeline\20260624_102243\review_codex_iter4.md
.hermes-pipeline\20260624_102243\review_codex_iter3.prompt.md
.hermes-pipeline\20260624_102243\review_codex_iter3.md
.hermes-pipeline\20260624_102243\review_codex_iter2.prompt.md
.hermes-pipeline\20260624_102243\review_codex_iter2.md
.hermes-pipeline\20260624_102243\review_codex_iter1.prompt.md
.hermes-pipeline\20260624_102243\review_codex_iter1.md
.hermes-pipeline\20260624_102243\plan_final.md
.hermes-pipeline\20260624_102243\plan_codex.prompt.md
.hermes-pipeline\20260624_102243\plan_codex.md
.hermes-pipeline\20260624_102243\implement.prompt.md
.hermes-pipeline\20260624_102243\fix_iter4.prompt.md
.hermes-pipeline\20260624_102243\fix_iter3.prompt.md
.hermes-pipeline\20260624_102243\fix_iter2.prompt.md
.hermes-pipeline\20260624_102243\fix_iter1.prompt.md
.hermes-pipeline\20260625_165149\screenshot-app\visual.css
.hermes-pipeline\20260625_165149\screenshot-app\mockConvex.tsx
.hermes-pipeline\20260625_165149\screenshot-app\mockClerk.tsx
.hermes-pipeline\20260625_165149\screenshot-app\main.tsx
.hermes-pipeline\20260625_165149\screenshot-app\index.html
.hermes-pipeline\20260625_165149\review_codex_iter2.prompt.md
.hermes-pipeline\20260625_165149\review_codex_iter2.md
.hermes-pipeline\20260625_165149\review_codex_iter1.prompt.md
.hermes-pipeline\20260625_165149\review_codex_iter1.md
.hermes-pipeline\20260625_165149\playwright.screenshot.config.ts
.hermes-pipeline\20260625_165149\plan_final.md
.hermes-pipeline\20260625_165149\plan_codex.prompt.md
.hermes-pipeline\20260625_165149\figma\coordinator-review-queue_1-399.png
.hermes-pipeline\20260625_165149\figma\coordinator-review-detail_1-400.png
.hermes-pipeline\20260625_165149\figma\coordinator-dashboard_1-291.png
.hermes-pipeline\20260625_165149\debug-screenshot.mjs
.hermes-pipeline\20260623_122350\review_codex_iter1.md
.hermes-pipeline\20260623_122350\plan_final.md
.hermes-pipeline\20260623_122350\plan_codex.prompt.md
.hermes-pipeline\20260623_122350\plan_codex.md
.hermes-pipeline\20260623_122350\implement.prompt.md
.hermes-pipeline\20260623_122350\fix_iter4.prompt.md
.hermes-pipeline\20260623_122350\fix_iter3.prompt.md
.hermes-pipeline\20260623_122350\fix_iter2.prompt.md
.hermes-pipeline\20260623_122350\fix_iter1.prompt.md
.hermes-pipeline\20260626_155217\plan_final.md
.hermes-pipeline\20260626_155217\plan_codex.prompt.md
.hermes-pipeline\20260626_155217\plan_codex.md
.hermes-pipeline\20260626_155217\implement.prompt.md
.hermes-pipeline\20260623_122350\review_opus_iter4.prompt.md
.hermes-pipeline\20260623_122350\review_opus_iter4.md
.hermes-pipeline\20260623_122350\review_opus_iter3.prompt.md
.hermes-pipeline\20260623_122350\review_opus_iter3.md
.hermes-pipeline\20260623_122350\review_opus_iter2.prompt.md
.hermes-pipeline\20260623_122350\review_opus_iter2.md
.hermes-pipeline\20260623_122350\review_opus_iter1.prompt.md
.hermes-pipeline\20260623_122350\review_opus_iter1.md
.hermes-pipeline\20260623_122350\review_codex_iter4.prompt.md
.hermes-pipeline\20260623_122350\review_codex_iter4.md
.hermes-pipeline\20260623_122350\review_codex_iter3.prompt.md
.hermes-pipeline\20260623_122350\review_codex_iter3.md
.hermes-pipeline\20260623_122350\review_codex_iter2.prompt.md
.hermes-pipeline\20260623_122350\review_codex_iter2.md
.hermes-pipeline\20260623_122350\review_codex_iter1.prompt.md
.hermes-pipeline\20260623_224923\plan_final.md
.hermes-pipeline\20260623_224923\plan_codex.prompt.md
.hermes-pipeline\20260623_224923\plan_codex.md
.hermes-pipeline\20260623_224923\implement.prompt.md
.hermes-pipeline\20260623_224923\summary.md
.hermes-pipeline\20260623_224923\review_codex_iter1.prompt.md
.hermes-pipeline\20260623_224923\review_codex_iter1.md
.hermes-pipeline\20260623_224923\summary.json
.hermes-pipeline\20260625_084642\summary.md
.hermes-pipeline\20260625_084642\summary.json
.hermes-pipeline\20260625_084642\review_codex_iter4.prompt.md
.hermes-pipeline\20260625_084642\review_codex_iter4.md
.hermes-pipeline\20260625_084642\review_codex_iter3.prompt.md
.hermes-pipeline\20260625_084642\review_codex_iter3.md
.hermes-pipeline\20260625_084642\review_codex_iter2.prompt.md
.hermes-pipeline\20260625_084642\review_codex_iter2.md
.hermes-pipeline\20260625_084642\review_codex_iter1.prompt.md
.hermes-pipeline\20260625_084642\review_codex_iter1.md
.hermes-pipeline\20260625_084642\plan_final.md
.hermes-pipeline\20260625_084642\plan_codex.prompt.md
.hermes-pipeline\20260625_084642\plan_codex.md
.hermes-pipeline\20260625_084642\implement.prompt.md
.hermes-pipeline\20260625_084642\fix_iter3.prompt.md
.hermes-pipeline\20260625_084642\fix_iter2.prompt.md
.hermes-pipeline\20260625_084642\fix_iter1.prompt.md
.hermes-pipeline\20260604_163200\fix_iter1.prompt.md
.hermes-pipeline\20260603_165807\summary.md
.hermes-pipeline\20260603_165807\summary.json
.hermes-pipeline\20260603_165807\review_opus_iter3.prompt.md
.hermes-pipeline\20260603_165807\review_opus_iter3.md
.hermes-pipeline\20260626_160744\plan_codex.prompt.md
.hermes-pipeline\20260603_165807\review_opus_iter2.md
.hermes-pipeline\20260603_165807\review_codex_iter3.prompt.md
.hermes-pipeline\20260603_165807\review_codex_iter3.md
.hermes-pipeline\20260603_165807\review_codex_iter2.prompt.md
.hermes-pipeline\20260603_165807\review_codex_iter2.md
.hermes-pipeline\20260603_165807\fix_iter2.prompt.md
.hermes-pipeline\20260604_163200\fix_iter3.prompt.md
.hermes-pipeline\20260604_163200\fix_iter2.prompt.md
.hermes-pipeline\20260604_163200\implement.prompt.md
.hermes-pipeline\20260624_185028\fix_iter2.prompt.md
.hermes-pipeline\20260624_185028\fix_iter1.prompt.md
.hermes-pipeline\20260624_185028\figma_screen_spec.md
.hermes-pipeline\20260624_185028\fix_iter3.prompt.md
.hermes-pipeline\20260624_185028\dev_server.pid
.hermes-pipeline\20260624_185028\fix_iter4.prompt.md
.hermes-pipeline\20260604_163200\review_codex_iter3.md
.hermes-pipeline\20260604_163200\review_codex_iter2.prompt.md
.hermes-pipeline\20260604_163200\review_codex_iter2.md
.hermes-pipeline\20260604_163200\review_codex_iter1.prompt.md
.hermes-pipeline\20260604_163200\review_codex_iter1.md
.hermes-pipeline\20260604_163200\plan_opus.prompt.md
.hermes-pipeline\20260604_163200\plan_opus.md
.hermes-pipeline\20260604_163200\plan_final.md
.hermes-pipeline\20260604_163200\plan_codex.prompt.md
.hermes-pipeline\20260604_163200\plan_codex.md
.hermes-pipeline\20260604_163200\review_opus_iter2.md
.hermes-pipeline\20260604_163200\review_opus_iter1.prompt.md
.hermes-pipeline\20260604_163200\review_opus_iter1.md
.hermes-pipeline\20260604_163200\review_codex_iter4.prompt.md
.hermes-pipeline\20260604_163200\review_codex_iter4.md
.hermes-pipeline\20260624_185028\figma\11_states_edge_cases.png
.hermes-pipeline\20260604_163200\review_codex_iter3.prompt.md
.hermes-pipeline\20260624_185028\figma\10_success.png
.hermes-pipeline\20260624_185028\figma\09_clock_out.png
.hermes-pipeline\20260604_163200\review_opus_iter3.prompt.md
.hermes-pipeline\20260624_185028\figma\08_step6_done.png
.hermes-pipeline\20260604_163200\review_opus_iter3.md
.hermes-pipeline\20260624_185028\figma\07_step5_issues.png
.hermes-pipeline\20260604_163200\review_opus_iter2.prompt.md
.hermes-pipeline\20260624_185028\figma\06_step4_goal.png
.hermes-pipeline\20260624_185028\figma\05_step3_how.png
.hermes-pipeline\20260604_163200\review_opus_iter4.prompt.md
.hermes-pipeline\20260624_185028\figma\04_step2_what.png
.hermes-pipeline\20260624_185028\figma\03_step1_when.png
.hermes-pipeline\20260604_163200\review_opus_iter4.md
.hermes-pipeline\20260624_185028\figma\02_clock_in.png
.hermes-pipeline\20260604_163200\summary.json
.hermes-pipeline\20260624_185028\figma\01_today_entry.png
.hermes-pipeline\20260624_185028\plan_codex.md
.hermes-pipeline\20260624_185028\implement.prompt.md
.hermes-pipeline\20260624_185028\plan_codex.prompt.md
.hermes-pipeline\20260604_163200\summary.md
.hermes-pipeline\20260624_185028\plan_final.md
.hermes-pipeline\20260624_185028\playwright.screenshot.config.ts
.hermes-pipeline\20260624_185028\review_codex_iter1.md
.hermes-pipeline\20260624_185028\vite.screenshot.config.ts
.hermes-pipeline\20260624_185028\visual_review_followup.md
.hermes-pipeline\20260624_185028\visual_review.md
.hermes-pipeline\20260624_185028\visual_codex_review.prompt.md
.hermes-pipeline\20260624_185028\summary.md
.hermes-pipeline\20260624_185028\summary.json
.hermes-pipeline\20260624_185028\screen_spec.md
.hermes-pipeline\20260624_185028\screenshot_login.spec.ts
.hermes-pipeline\20260626_161701\plan_codex.prompt.md
.hermes-pipeline\20260626_161701\plan_codex.md
.hermes-pipeline\20260626_161701\implementation-plan.md
.hermes-pipeline\20260626_161701\implement.prompt.md
.hermes-pipeline\20260626_161701\review_codex_iter1.prompt.md
.hermes-pipeline\20260626_161701\plan_final.md
.hermes-pipeline\20260626_161701\summary.md
.hermes-pipeline\20260624_185028\review_codex_iter3.prompt.md
.hermes-pipeline\20260624_185028\review_codex_iter3.md
.hermes-pipeline\20260624_185028\review_codex_iter2.prompt.md
.hermes-pipeline\20260624_185028\review_codex_iter2.md
.hermes-pipeline\20260624_185028\review_codex_iter1.prompt.md
.hermes-pipeline\20260624_185028\review_codex_iter4.prompt.md
.hermes-pipeline\20260624_185028\review_codex_iter4.md
.hermes-pipeline\20260624_185028\screenshot.spec.ts
.hermes-pipeline\20260624_185028\screenshot-app\visual.css
.hermes-pipeline\20260624_185028\screenshot-app\mockConvex.tsx
.hermes-pipeline\20260624_185028\screenshot-app\mockClerk.tsx
.hermes-pipeline\20260624_185028\screenshot-app\main.tsx
.hermes-pipeline\20260624_185028\screenshot-app\index.html
.hermes-pipeline\20260624_185028\screenshots\step2_what.png
.hermes-pipeline\20260624_185028\screenshots\step1_when.png
.hermes-pipeline\20260624_185028\screenshots\login_redirect.png
.hermes-pipeline\20260624_185028\screenshots\clock_out.png
.hermes-pipeline\20260624_185028\screenshots\clock_in_geofence.png
.hermes-pipeline\20260624_185028\screenshots\clock_in.png
.hermes-pipeline\20260624_185028\screenshots\step5_issues.png
.hermes-pipeline\20260624_185028\screenshots\step4_goal.png
.hermes-pipeline\20260624_185028\screenshots\step3_how.png
.hermes-pipeline\20260624_185028\screenshots\success.png
.hermes-pipeline\20260624_185028\screenshots\step6_done.png
.hermes-pipeline\20260624_185028\screenshots\today.png

 succeeded in 788ms:
{
  "name": "mariatest",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --configLoader native",
    "build": "tsc -b && vite build --configLoader native",
    "lint": "eslint .",
    "typecheck": "tsc -b",
    "test": "vitest run --configLoader native",
    "test:watch": "vitest --configLoader native",
    "e2e": "playwright test",
    "preview": "vite preview --configLoader native"
  },
  "dependencies": {
    "@clerk/react": "^6.6.6",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "convex": "^1.39.1",
    "lucide-react": "^1.16.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.15.1",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.60.0",
    "@tailwindcss/vite": "^4.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "convex-test": "^0.0.53",
    "eslint": "^10.4.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "jsdom": "^29.1.1",
    "prettier": "^3.8.3",
    "tailwindcss": "^4.3.0",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12",
    "vitest": "^4.1.6"
  }
}


 succeeded in 843ms:
.env.example
convex/_generated/api.d.ts
convex/_generated/api.js
convex/_generated/server.d.ts
convex/_generated/server.js
convex/adpSync.ts
convex/invitations.ts
convex/members.ts
convex/reviews.ts
convex/schema.ts
convex/seed.ts
convex/shiftClock.test.ts
convex/shiftQueries.ts
convex/shifts.ts
convex/tenants.ts
eslint.config.js
package.json
playwright.config.ts
src/app/router.tsx
src/app/shell/Sidebar.tsx
src/features/caregiver/components/ShiftDocumentationForm.tsx
src/features/caregiver/components/ShiftTaskList.tsx
src/features/caregiver/model/documentationDraft.ts
src/features/caregiver/pages/CaregiverTodayPage.tsx
src/features/clients/pages/ClientsPage.test.tsx
src/features/clients/pages/ClientsPage.tsx
src/features/coordinator/components/ReviewDetail.tsx
src/features/coordinator/components/ReviewHistory.tsx
src/features/coordinator/pages/CoordinatorReviewPage.tsx
src/features/dashboard/pages/DashboardPage.tsx
src/features/platform/pages/PlatformAdminPage.tsx
src/features/team/pages/TeamPage.test.tsx
src/features/team/pages/TeamPage.tsx
src/index.css
src/shared/format.ts
src/shared/testing/convexApi.test.ts
src/shared/ui/AppLoader.tsx
src/shared/ui/Badge.tsx
src/shared/ui/Button.tsx
src/shared/ui/Card.tsx
src/shared/ui/Checkbox.tsx
src/shared/ui/Dialog.tsx
src/shared/ui/Input.tsx
src/shared/ui/KpiCard.tsx
src/shared/ui/Select.tsx
src/shared/ui/StatusBadge.tsx
src/shared/ui/Table.tsx
src/shared/ui/Textarea.tsx
src/shared/ui/index.ts
tsconfig.app.json
vite.config.ts
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

 succeeded in 837ms:
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})


codex
The required pipeline artifacts are present in the current run directory, including `implementation-plan.md` and `summary.md`. Iâ€™m reading those alongside the new tests to compare claimed coverage with actual assertions.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\implementation-plan.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\summary.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests\\e2e\\phase1-lifecycle.spec.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests\\e2e\\geofence.spec.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 822ms:
# ATRIA-X Phase 1 Session 8 Ã¢â‚¬â€ Implementation Summary

## Goal

Implement and verify end-to-end and integration test coverage for the complete caregiver-to-billing shift lifecycle, geofence enforcement, and ADP mock integration contracts.

## Files Changed

- `convex/seed.ts` Ã¢â‚¬â€ added deterministic `seedE2E` mutation for e2e fixtures.
- `convex/shiftClock.test.ts` Ã¢â‚¬â€ added runtime geofence tests (disabled, inside, outside, missing, accuracy).
- `convex/reviews.test.ts` Ã¢â‚¬â€ added approval-incomplete rejection, complete approval + billing line, caregiver resubmission after correction.
- `convex/adpSync.test.ts` Ã¢â‚¬â€ added unconfiguredÃ¢â€ â€™configured sync flow, location-evidence omission assertion, and secret-redaction-in-events assertion.
- `convex/integrations/adp/mockAdp.ts` Ã¢â‚¬â€ added `lastPunchInput` to inspect ADP payloads.
- `src/features/caregiver/pages/CaregiverTodayPage.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftClockInScreen.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftClockOutScreen.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftDocumentationForm.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftNoteStep.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftTaskList.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/LocationStatusPanel.tsx` Ã¢â‚¬â€ test selectors + status attribute.
- `src/features/caregiver/components/MissingChecklist.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/caregiver/components/ShiftSuccessScreen.tsx` Ã¢â‚¬â€ test selector.
- `src/features/coordinator/pages/CoordinatorReviewPage.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/coordinator/components/ReviewDetail.tsx` Ã¢â‚¬â€ test selectors.
- `src/features/settings/pages/GeofenceSettingsPage.tsx` Ã¢â‚¬â€ test selectors.
- `eslint.config.js` Ã¢â‚¬â€ added ignores for binary/local/env files so `npm run lint` completes.
- `playwright.config.ts` Ã¢â‚¬â€ disabled parallelism, added `globalSetup`, set `workers: 1` for e2e stability.
- `tests/e2e/helpers/auth.ts` Ã¢â‚¬â€ shared Clerk sign-in helper and credential check.
- `tests/e2e/global-setup.ts` Ã¢â‚¬â€ seeds e2e fixtures via Convex HTTP API after admin sign-in.
- `tests/e2e/phase1-lifecycle.spec.ts` Ã¢â‚¬â€ full caregiverÃ¢â€ â€™coordinatorÃ¢â€ â€™billing lifecycle e2e.
- `tests/e2e/geofence.spec.ts` Ã¢â‚¬â€ inside/outside/denied/disabled geofence e2e scenarios.
- `.hermes-pipeline/20260626_161701/implementation-plan.md` Ã¢â‚¬â€ staging document.
- `.hermes-pipeline/20260626_161701/summary.md` Ã¢â‚¬â€ this file.

## Required Gates

| Gate | Command | Result | Notes |
|------|---------|--------|-------|
| Convex codegen | `npx convex codegen` | **FAIL** | Environment has `CONVEX_DEPLOY_KEY` set; Convex codegen refuses to run against a deployment-only environment. Only `seedE2E` was added; no existing API signatures changed, so generated code remains valid for existing functions. |
| Lint | `npm run lint` | **PASS** | 0 errors after adding necessary ignores. |
| Typecheck | `npm run typecheck` | **PASS** | 0 errors. |
| Unit tests | `npm run test` | **PASS** | 37 files, 276 tests passing. |
| E2E tests | `npm run e2e` | **PASS** | 4 existing smoke tests passed; 5 new tests skipped because `E2E_CLERK_ORG_ID` / test-account credentials are not configured in this environment. |

## E2E Credential Requirement

The new e2e specs require these environment variables to run against real Clerk test accounts:

- `E2E_CLERK_ORG_ID`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_CAREGIVER_EMAIL` / `E2E_CAREGIVER_PASSWORD`
- `E2E_COORDINATOR_EMAIL` / `E2E_COORDINATOR_PASSWORD`

When set, `global-setup.ts` signs in as admin and calls `seed:seedE2E` to create deterministic fixtures, then the specs exercise the full lifecycle and geofence flows. Without them the specs skip cleanly and the gate remains green.

## Verification Notes

- ADP contract tests assert that `timePunches` with location evidence do **not** send latitude/longitude/distance in the ADP punch payload.
- Secret-redaction test asserts mock ADP credentials do not appear in `integrationEvents` or `adpError` after a failure.
- Billing invariant verified: `reviews.approve` rejects incomplete documentation and only creates a `billingLines` row for complete, submitted shifts.
- Geofence server tests verify punches are rejected outside radius / with missing location / with poor accuracy, and no `timePunches` row is created on rejection.


 succeeded in 834ms:
import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  signInWithClerk,
  signOut,
  skipIfNoE2ECredentials,
} from './helpers/auth'

const CLIENT_NAME = 'Sam Lee'

test.describe.configure({ mode: 'serial' })
skipIfNoE2ECredentials(test)

test('full caregiver-to-billing lifecycle with geofence disabled', async ({ page, context }) => {
  // Ensure geofence is disabled for this flow
  await context.clearPermissions()

  // ---- Caregiver: clock in ----
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, {
    hasText: CLIENT_NAME,
  })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })

  // Assert initial status word + color
  const statusBadge = shiftCard.locator('[data-testid="shift-status-badge"]')
  await expect(statusBadge).toHaveText('UPCOMING')
  await expect(statusBadge).toHaveClass(/variant-info|bg-atria-info/)

  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()
  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()

  await page.locator('[data-testid="clock-in-button"]').click()
  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

  // ---- Complete 6-step note ----
  // Step 1: When
  await page.locator('[data-testid="start-time-input"]').fill('09:00')
  await page.locator('[data-testid="end-time-input"]').fill('13:00')
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-what"]')).toBeAttached()

  // Step 2: What
  await page.locator('[data-testid="service-option-Bathing"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-how"]')).toBeAttached()

  // Step 3: How
  await page.locator('[data-testid="narrative-textarea"]').fill(
    'I helped Sam with a warm bath, breakfast, and light housekeeping. He was in good spirits and ate a full meal.',
  )
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-goal"]')).toBeAttached()

  // Step 4: Goal
  await page.locator('[data-testid="goal-option-Walk a little each day"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-issues"]')).toBeAttached()

  // Step 5: Issues + task proof
  await page.locator('[data-testid="issue-choice-no"]').click()
  const taskCheckbox = page.locator('[data-testid^="task-complete-checkbox-"]').first()
  await taskCheckbox.check()
  // Upload a tiny proof file
  const proofInput = page.locator('[data-testid^="task-proof-input-"]').first()
  await proofInput.setInputFiles({
    name: 'proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('shift proof'),
  })
  await expect(page.locator('text=proof.txt')).toBeVisible({ timeout: 10000 })
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached()

  // Step 6: Done / confirm
  await page.locator('[data-testid="confirm-checkbox"]').check()

  // ---- Verify clock out enabled only when note is complete ----
  await page.locator('[data-testid="wizard-next-button"]').click()
  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-testid="complete-checklist"]')).toBeVisible()
  const clockOutButton = page.locator('[data-testid="clock-out-button"]')
  await expect(clockOutButton).toBeEnabled()

  // ---- Clock out / submit ----
  await clockOutButton.click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: request correction ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)

  const reviewRow = page.locator(`[data-testid^="review-row-"]`, {
    hasText: CLIENT_NAME,
  })
  await expect(reviewRow).toBeVisible({ timeout: 15000 })
  const reviewStatus = reviewRow.locator('[data-testid="review-status-badge"]')
  await expect(reviewStatus).toHaveText('Submitted')
  await expect(reviewStatus).toHaveClass(/variant-info|bg-atria-info/)

  await reviewRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="review-comment-input"]')).toBeVisible()
  await page.locator('[data-testid="review-comment-input"]').fill('Please add the exact start time.')
  await page.locator('[data-testid="request-correction-button"]').click()

  // Wait to return to queue
  await expect(page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })).toBeVisible({ timeout: 15000 })
  await expect(reviewStatus).toHaveText('Needs correction')
  await expect(reviewStatus).toHaveClass(/variant-danger|bg-atria-danger/)

  // ---- Caregiver: fix and resubmit ----
  await signOut(page)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const correctionCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: CLIENT_NAME })
  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveText('CORRECTION')
  await correctionCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached()
  await page.locator('[data-testid="start-time-input"]').fill('09:15')
  await page.locator('[data-testid="wizard-next-button"]').click()
  // Navigate to done step quickly via edit links
  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached({ timeout: 15000 })
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.locator('[data-testid="wizard-next-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  await page.locator('[data-testid="clock-out-button"]').click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })

  // ---- Coordinator: approve -> billing ready ----
  await signOut(page)
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/coordinator/review')
  await expect(page).toHaveURL(/coordinator\/review/)

  const resubmittedRow = page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })
  await expect(resubmittedRow).toBeVisible({ timeout: 15000 })
  await expect(resubmittedRow.locator('[data-testid="review-status-badge"]')).toHaveText('Submitted')

  await resubmittedRow.locator('button:has-text("Review")').click()
  await expect(page.locator('[data-testid="approve-button"]')).toBeVisible()
  await page.locator('[data-testid="approve-button"]').click()

  // Approved shifts appear under the Approved filter
  await page.locator('[data-testid="filter-approved"]').click()
  const approvedRow = page.locator(`[data-testid^="review-row-"]`, { hasText: CLIENT_NAME })
  await expect(approvedRow).toBeVisible({ timeout: 15000 })
  const approvedStatus = approvedRow.locator('[data-testid="review-status-badge"]')
  await expect(approvedStatus).toHaveText('Approved')
  await expect(approvedStatus).toHaveClass(/variant-success|bg-atria-success/)
})


 succeeded in 891ms:
# ATRIA-X Phase 1 Session 8 Ã¢â‚¬â€ Implementation Plan

## Goal

Implement and verify end-to-end and integration test coverage for the complete caregiver-to-billing shift lifecycle, geofence enforcement, and ADP mock integration contracts.

## Acceptance Criteria

- `npm run e2e` covers the full seeded lifecycle with geofence disabled:
  - Caregiver clocks in.
  - Completes the 6-step note.
  - Clock Out disabled until note complete, then enabled.
  - Clock Out submits the shift.
  - Coordinator requests a correction.
  - Caregiver fixes and resubmits.
  - Coordinator approves Ã¢â€ â€™ shift becomes billing-ready.
  - Each lifecycle state asserts both status word and status color.

- Geofence coverage verifies:
  - Inside radius allows clock in/out and stores location evidence.
  - Outside radius shows blocked UI and server rejects the punch.
  - Denied geolocation shows blocked UI and creates no punch.
  - Disabling geofence prevents location requests.

- ADP contract/integration tests verify:
  - Unconfigured tenant keeps app usable and marks punches `pending_credentials`.
  - Configured mock ADP sync posts queued punches exactly once.
  - `adpPunchId` stored and statuses become `synced`.
  - Initial worker load matches existing profiles by email and creates missing profiles with `adpAssociateOid`.
  - `createCaregiver` enqueues worker sync and drains to `synced`.
  - No secrets/raw credentials appear in `integrationEvents` or logs.
  - Location evidence is not sent in ADP punch payloads.

- Required gates genuinely green:
  - `npx convex codegen` if Convex API/schema changed
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run e2e`

## Stages

### Stage 1 Ã¢â‚¬â€ Fixtures & selectors

- [x] Inspect existing auth, route guards, seed helpers, and test setup.
- [ ] Update `convex/seed.ts` with deterministic e2e fixtures:
  - `seedE2E` mutation that creates/updates a test tenant, members (admin, coordinator, caregiver), clients with service addresses, and shifts for lifecycle + geofence scenarios.
  - Idempotent by clerkOrgId / email / scheduledStart.
  - Geofence disabled by default for the lifecycle shift; a separate client has coordinates for geofence tests.
- [ ] Add `data-testid` attributes to key UI surfaces:
  - `CaregiverTodayPage` shift cards and "Clock in & start" button.
  - `ShiftClockInScreen`, `ShiftClockOutScreen`, `LocationStatusPanel`.
  - `ShiftNoteStep` step navigation and inputs.
  - `CoordinatorReviewPage` queue rows and filter tabs.
  - `ReviewDetail` approve / request-correction buttons and comment field.
  - `GeofenceSettingsPage` toggles and save button.

### Stage 2 Ã¢â‚¬â€ Server-side tests

- [ ] `convex/shiftClock.test.ts`: add convex-test cases for geofence disabled, inside radius, outside radius, missing/denied location, disabled setting, and verify no punch is created on rejection.
- [ ] `convex/reviews.test.ts`: add cases for correction request, resubmission returning to queue, and approval marking billing-ready only when documentation is complete.
- [ ] `convex/adpSync.test.ts`: verify unconfigured tenant behavior, configured mock sync idempotency, secret redaction, and location evidence omission from ADP payloads.
- [ ] `convex/employeeProfiles.test.ts`: verify `adpInitialWorkerLoad` matching/creation and `createCaregiver` enqueue + drain.

### Stage 3 Ã¢â‚¬â€ E2E specs

- [ ] `tests/e2e/phase1-lifecycle.spec.ts`: full lifecycle using seeded data with geofence disabled.
  - Conditional auth via Clerk sign-in using `E2E_*` environment variables.
  - If credentials are unavailable, tests skip with a clear message so the gate stays green.
- [ ] `tests/e2e/geofence.spec.ts`: inside radius, outside radius, denied permission, and disable-setting flows.
- [ ] `tests/e2e/helpers/auth.ts`: shared sign-in helper and role-based page objects.

### Stage 4 Ã¢â‚¬â€ Gates & summary

- [ ] Run `npx convex codegen` if Convex files changed.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test`.
- [ ] Run `npm run e2e`.
- [ ] Write real pass/fail results to `.hermes-pipeline/20260626_161701/summary.md`.

## Files To Create / Modify

Create:

- `.hermes-pipeline/20260626_161701/implementation-plan.md`
- `.hermes-pipeline/20260626_161701/summary.md`
- `tests/e2e/phase1-lifecycle.spec.ts`
- `tests/e2e/geofence.spec.ts`
- `tests/e2e/helpers/auth.ts`

Modify:

- `convex/seed.ts`
- `src/features/caregiver/pages/CaregiverTodayPage.tsx`
- `src/features/caregiver/components/ShiftClockInScreen.tsx`
- `src/features/caregiver/components/ShiftClockOutScreen.tsx`
- `src/features/caregiver/components/ShiftDocumentationForm.tsx`
- `src/features/caregiver/components/LocationStatusPanel.tsx`
- `src/features/coordinator/pages/CoordinatorReviewPage.tsx`
- `src/features/coordinator/components/ReviewDetail.tsx`
- `src/features/settings/pages/GeofenceSettingsPage.tsx`
- `convex/shiftClock.test.ts`
- `convex/reviews.test.ts`
- `convex/adpSync.test.ts`
- `convex/employeeProfiles.test.ts`

Do not edit `convex/_generated` by hand.

## Risks & Mitigations

- **Auth dependency for e2e**: Real Clerk sign-in requires test accounts. Mitigation: conditional skip with env vars; existing smoke tests remain.
- **Multi-tenancy**: All backend helpers use `authHelpers` guards; no changes that weaken tenant isolation.
- **HIPAA/privacy**: Location evidence stays internal; ADP payload assertions ensure no leakage.
- **Secret leakage**: ADP mock creds are stubbed via `vi.stubEnv` and redacted by `sanitizeError`; assertions verify they do not appear in events/logs.
- **Billing invariant**: Approval only reaches `billing_ready` when documentation is complete; enforced by `reviews.approve` and verified by tests.


 succeeded in 870ms:
import { test, expect } from '@playwright/test'
import {
  E2E_CAREGIVER_EMAIL,
  E2E_CAREGIVER_PASSWORD,
  E2E_COORDINATOR_EMAIL,
  E2E_COORDINATOR_PASSWORD,
  E2E_ORG_ID,
  signInWithClerk,
  signOut,
  skipIfNoE2ECredentials,
} from './helpers/auth'

const GEOFENCE_CLIENT = 'Maya Torres'
const INSIDE_COORDS = { latitude: 44.9779, longitude: -93.2649 }
const OUTSIDE_COORDS = { latitude: 45.0, longitude: -93.0 }

test.describe.configure({ mode: 'serial' })
skipIfNoE2ECredentials(test)

test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
  // Coordinator enables geofence enforcement
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/settings/geofence')
  await expect(page).toHaveURL(/settings\/geofence/)

  await page.locator('[data-testid="geofence-enabled-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-in-checkbox"]').check()
  await page.locator('[data-testid="geofence-enforce-clock-out-checkbox"]').check()
  await page.locator('[data-testid="save-geofence-button"]').click()
  await expect(page.locator('[data-testid="geofence-message"]')).toHaveText('Geofence settings saved.', { timeout: 10000 })
  await signOut(page)

  // Caregiver with location inside radius
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(INSIDE_COORDS)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })

  await page.locator('[data-testid="clock-in-button"]').click()
  await expect(page.locator('[data-testid="step-content-when"]')).toBeAttached({ timeout: 15000 })

  // Fill note quickly and clock out
  await page.locator('[data-testid="start-time-input"]').fill('14:00')
  await page.locator('[data-testid="end-time-input"]').fill('18:00')
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="service-option-Bathing"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="narrative-textarea"]').fill(
    'I helped Maya with mobility exercises and a meal. She was steady on her feet.',
  )
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="goal-option-Walk a little each day"]').click()
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="issue-choice-no"]').click()
  await page.locator('[data-testid^="task-complete-checkbox-"]').first().check()
  await page.locator('[data-testid^="task-proof-input-"]').first().setInputFiles({
    name: 'geo-proof.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('geofence proof'),
  })
  await page.locator('[data-testid="wizard-next-button"]').click()
  await page.locator('[data-testid="confirm-checkbox"]').check()
  await page.locator('[data-testid="wizard-next-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
  const outPanel = page.locator('[data-testid="clock-out-location-panel"]')
  await expect(outPanel).toBeVisible()
  await expect(outPanel).toHaveAttribute('data-location-status', 'granted', { timeout: 15000 })
  await expect(page.locator('[data-testid="clock-out-button"]')).toBeEnabled()
  await page.locator('[data-testid="clock-out-button"]').click()
  await expect(page.locator('[data-testid="shift-success-screen"]')).toBeVisible({ timeout: 15000 })
})

test('geofence outside radius shows blocked UI and server rejects punch', async ({ page, context }) => {
  // Ensure geofence is enabled from previous test
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(OUTSIDE_COORDS)
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })

  const clockInButton = page.locator('[data-testid="clock-in-button"]')
  await expect(clockInButton).toBeDisabled()
})

test('denied geolocation permission shows blocked UI and creates no punch', async ({ page, context }) => {
  await context.clearPermissions()
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
  await expect(locationPanel).toBeVisible()
  await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })

  const clockInButton = page.locator('[data-testid="clock-in-button"]')
  await expect(clockInButton).toBeDisabled()
})

test('disabling geofence stops requesting browser location', async ({ page, context }) => {
  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
  await page.goto('/settings/geofence')
  await expect(page).toHaveURL(/settings\/geofence/)

  await page.locator('[data-testid="geofence-enabled-checkbox"]').uncheck()
  await page.locator('[data-testid="save-geofence-button"]').click()
  await expect(page.locator('[data-testid="geofence-message"]')).toHaveText('Geofence settings saved.', { timeout: 10000 })
  await signOut(page)

  // With geofence disabled, location should not be requested even if permission is denied
  await context.clearPermissions()
  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
  await page.goto('/caregiver/today')
  await expect(page).toHaveURL(/caregiver\/today/)

  const shiftCard = page.locator(`[data-testid^="shift-card-"]`, { hasText: GEOFENCE_CLIENT })
  await expect(shiftCard).toBeVisible({ timeout: 15000 })
  await shiftCard.locator('[data-testid="clock-in-start-button"]').click()

  await expect(page.locator('[data-testid="shift-clock-in-screen"]')).toBeVisible()
  await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
})


codex
One acceptance issue is already visible: the new e2e specs skip when credentials are absent, while the task required the full `npm run e2e` gate to exercise the new lifecycle/geofence coverage. Iâ€™m checking whether there are deeper functional blockers beyond that gate mismatch.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests\\e2e\\helpers\\auth.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests\\e2e\\global-setup.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\seed.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\schema.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 827ms:
import { test as base, expect, type Page } from '@playwright/test'

export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
export const E2E_CAREGIVER_EMAIL = process.env.E2E_CAREGIVER_EMAIL ?? ''
export const E2E_CAREGIVER_PASSWORD = process.env.E2E_CAREGIVER_PASSWORD ?? ''
export const E2E_COORDINATOR_EMAIL = process.env.E2E_COORDINATOR_EMAIL ?? ''
export const E2E_COORDINATOR_PASSWORD = process.env.E2E_COORDINATOR_PASSWORD ?? ''

export function e2eCredentialsAvailable(): boolean {
  return Boolean(
    E2E_ORG_ID &&
      E2E_ADMIN_EMAIL &&
      E2E_ADMIN_PASSWORD &&
      E2E_CAREGIVER_EMAIL &&
      E2E_CAREGIVER_PASSWORD &&
      E2E_COORDINATOR_EMAIL &&
      E2E_COORDINATOR_PASSWORD,
  )
}

export function skipIfNoE2ECredentials(test: typeof base) {
  test.beforeAll(() => {
    if (!e2eCredentialsAvailable()) {
      test.skip(true, 'E2E Clerk credentials are not configured')
    }
  })
}

async function selectOrgIfAsked(page: Page, orgId: string) {
  // Clerk's organization switcher may appear after sign-in. Try to select the
  // expected org by its id or name, or just wait for the app to settle.
  const orgButton = page.locator(`[data-testid="organization-button-${orgId}"]`).or(
    page.locator(`button:has-text("${orgId}")`),
  )
  if (await orgButton.isVisible().catch(() => false)) {
    await orgButton.click()
    await page.waitForLoadState('networkidle')
  }
}

export async function signInWithClerk(
  page: Page,
  email: string,
  password: string,
  orgId: string,
) {
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)

  // Clerk sign-in flow: email -> continue -> password -> continue
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[inputmode="email"]').first()
  await expect(emailInput).toBeVisible({ timeout: 10000 })
  await emailInput.fill(email)

  const continueButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await continueButton.click()

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
  await expect(passwordInput).toBeVisible({ timeout: 10000 })
  await passwordInput.fill(password)

  const submitButton = page.locator('button:has-text("Continue"), button[type="submit"]').first()
  await submitButton.click()

  // Wait for navigation away from sign-in
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20000 })
  await page.waitForLoadState('networkidle')

  await selectOrgIfAsked(page, orgId)
}

export async function signOut(page: Page) {
  // Clear Clerk session state so the next sign-in starts fresh.
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.context().clearCookies()
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')
}


 succeeded in 778ms:
import { chromium, type FullConfig } from '@playwright/test'
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_ORG_ID,
  e2eCredentialsAvailable,
  signInWithClerk,
} from './helpers/auth'

async function seedE2EFixtures(authToken: string) {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    console.warn('VITE_CONVEX_URL is not set; skipping e2e seed.')
    return
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      path: 'seed:seedE2E',
      args: { clerkOrgId: E2E_ORG_ID },
      format: 'json',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`seedE2E failed: ${response.status} ${text}`)
  }

  const result = await response.json()
  console.log('seedE2E result:', result)
}

export default async function globalSetup(config: FullConfig) {
  if (!e2eCredentialsAvailable()) {
    console.log('E2E credentials not configured; skipping global seed.')
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage({
    baseURL: config.projects[0]?.use.baseURL,
  })

  try {
    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)

    // Extract the Clerk session token from localStorage. The exact key can vary
    // by Clerk version, so we try the common ones.
    const token = await page.evaluate(() => {
      const keys = ['__clerk_client_jwt', '__session', '__clerk_session_jwt']
      for (const key of keys) {
        const value = localStorage.getItem(key)
        if (value) return value
      }
      return null
    })

    if (!token) {
      console.warn('Could not extract Clerk token; skipping e2e seed.')
    } else {
      await seedE2EFixtures(token)
    }
  } finally {
    await browser.close()
  }
}


 succeeded in 796ms:
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const adpPunchSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
)

const adpEmployeeSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
  v.literal('matched'),
  v.literal('created'),
)

const integrationConnectionStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('configured'),
  v.literal('error'),
)

const adpProviderLiteral = v.literal('adp')

export default defineSchema({
  tenants: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    billingSettings: v.optional(
      v.object({
        defaultRate: v.number(),
        exportFormat: v.union(v.literal('csv'), v.literal('json')),
      }),
    ),
    createdAt: v.string(),
  })
    .index('by_clerk_org_id', ['clerkOrgId'])
    .index('by_slug', ['slug']),

  tenantMembers: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
    displayName: v.string(),
    email: v.string(),
  })
    .index('by_tenant_user', ['tenantId', 'clerkUserId'])
    .index('by_tenant_role', ['tenantId', 'role'])
    .index('by_clerk_user_id', ['clerkUserId']),

  tenantSettings: defineTable({
    tenantId: v.id('tenants'),
    shiftGeofence: v.object({
      enabled: v.boolean(),
      enforceClockIn: v.boolean(),
      enforceClockOut: v.boolean(),
      defaultRadiusMeters: v.number(),
      maxAccuracyMeters: v.number(),
    }),
  }).index('by_tenant', ['tenantId']),

  clients: defineTable({
    tenantId: v.id('tenants'),
    displayName: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    authorizationHours: v.number(),
    riskFlags: v.array(v.string()),
    serviceAddress: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      }),
    ),
  }).index('by_tenant', ['tenantId']),

  shifts: defineTable({
    tenantId: v.id('tenants'),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    coordinatorId: v.optional(v.string()),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    clockInAt: v.optional(v.string()),
    clockOutAt: v.optional(v.string()),
    status: v.union(
      v.literal('scheduled'),
      v.literal('in_progress'),
      v.literal('submitted'),
      v.literal('needs_correction'),
      v.literal('approved'),
      v.literal('billing_ready'),
    ),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
    serviceLocationOverride: v.optional(
      v.object({
        label: v.string(),
        addressLine: v.optional(v.string()),
        latitude: v.number(),
        longitude: v.number(),
        radiusMeters: v.optional(v.number()),
      }),
    ),
  })
    .index('by_tenant_caregiver_status', ['tenantId', 'caregiverId', 'status'])
    .index('by_tenant_coordinator_status', [
      'tenantId',
      'coordinatorId',
      'status',
    ])
    .index('by_tenant_status_start', ['tenantId', 'status', 'scheduledStart']),

  timePunches: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    caregiverId: v.string(),
    punchType: v.union(v.literal('clock_in'), v.literal('clock_out')),
    at: v.string(),
    source: v.literal('atriax'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
        distanceMeters: v.optional(v.number()),
        targetLabel: v.optional(v.string()),
        targetLatitude: v.optional(v.number()),
        targetLongitude: v.optional(v.number()),
        withinGeofence: v.optional(v.boolean()),
      }),
    ),
    adpSyncStatus: adpPunchSyncStatus,
    adpPunchId: v.optional(v.string()),
    adpError: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_shift', ['tenantId', 'shiftId'])
    .index('by_tenant_shift_type', ['tenantId', 'shiftId', 'punchType'])
    .index('by_tenant_sync_status', ['tenantId', 'adpSyncStatus']),

  employeeProfiles: defineTable({
    tenantId: v.id('tenants'),
    clerkUserId: v.optional(v.string()),
    tenantMemberId: v.optional(v.id('tenantMembers')),
    displayName: v.string(),
    email: v.string(),
    adpAssociateOid: v.optional(v.string()),
    adpWorkerId: v.optional(v.string()),
    adpSyncStatus: adpEmployeeSyncStatus,
    adpError: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_clerk_user', ['tenantId', 'clerkUserId'])
    .index('by_tenant_adp_aoid', ['tenantId', 'adpAssociateOid']),

  integrationConnections: defineTable({
    tenantId: v.id('tenants'),
    provider: adpProviderLiteral,
    status: integrationConnectionStatus,
    lastCheckedAt: v.optional(v.string()),
    note: v.optional(v.string()),
  })
    .index('by_tenant_provider', ['tenantId', 'provider'])
    .index('by_provider_status', ['provider', 'status']),

  integrationEvents: defineTable({
    tenantId: v.id('tenants'),
    provider: adpProviderLiteral,
    kind: v.string(),
    refId: v.optional(v.string()),
    idempotencyKey: v.string(),
    status: v.string(),
    attempt: v.optional(v.number()),
    request: v.optional(v.any()),
    response: v.optional(v.any()),
    completedAt: v.optional(v.string()),
    nextRetryAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_tenant_idemp', ['tenantId', 'idempotencyKey'])
    .index('by_tenant_created', ['tenantId', 'createdAt']),

  progressNotes: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    startTime: v.string(),
    endTime: v.string(),
    servicesProvided: v.string(),
    clientResponse: v.string(),
    narrative: v.string(),
    submittedBy: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  shiftTasks: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    title: v.string(),
    requiredProof: v.boolean(),
    status: v.union(v.literal('pending'), v.literal('complete')),
    proofUrl: v.optional(v.string()),
    proofName: v.optional(v.string()),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  reviewEvents: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    reviewerId: v.string(),
    decision: v.union(v.literal('approved'), v.literal('correction_requested')),
    comment: v.string(),
    createdAt: v.string(),
  }).index('by_tenant_shift', ['tenantId', 'shiftId']),

  billingLines: defineTable({
    tenantId: v.id('tenants'),
    shiftId: v.id('shifts'),
    hours: v.number(),
    rate: v.number(),
    amount: v.number(),
    exportBatchId: v.optional(v.id('exportBatches')),
    createdAt: v.string(),
  })
    .index('by_tenant_export_batch', ['tenantId', 'exportBatchId'])
    .index('by_tenant_shift', ['tenantId', 'shiftId']),

  exportBatches: defineTable({
    tenantId: v.id('tenants'),
    name: v.string(),
    exportedAt: v.string(),
    exportedBy: v.string(),
    invoiceNumber: v.optional(v.string()),
    periodStart: v.optional(v.string()),
    periodEnd: v.optional(v.string()),
    caregiverId: v.optional(v.string()),
    caregiverName: v.optional(v.string()),
    caregiverEmail: v.optional(v.string()),
    lineCount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
  }).index('by_tenant', ['tenantId']),

  complianceDocs: defineTable({
    tenantId: v.id('tenants'),
    title: v.string(),
    body: v.string(),
    category: v.union(
      v.literal('billing'),
      v.literal('documentation'),
      v.literal('credentialing'),
      v.literal('policy'),
    ),
    visibility: v.optional(
      v.union(v.literal('all_staff'), v.literal('admins_coordinators')),
    ),
    embedding: v.array(v.float64()),
  })
    .index('by_tenant_category', ['tenantId', 'category'])
    .vectorIndex('by_tenant_embedding', {
      vectorField: 'embedding',
      dimensions: 32,
      filterFields: ['tenantId', 'category'],
    }),

  auditEvents: defineTable({
    tenantId: v.id('tenants'),
    actorId: v.string(),
    actorRole: v.string(),
    shiftId: v.optional(v.id('shifts')),
    previousStatus: v.optional(v.string()),
    nextStatus: v.optional(v.string()),
    action: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.string(),
  }).index('by_tenant_created_at', ['tenantId', 'createdAt']),

  files: defineTable({
    tenantId: v.id('tenants'),
    storageId: v.string(),
    uploadedBy: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    linkedType: v.union(v.literal('shiftTask'), v.literal('complianceDoc')),
    linkedId: v.string(),
    visibility: v.union(
      v.literal('all_staff'),
      v.literal('admins_coordinators'),
    ),
    createdAt: v.string(),
  })
    .index('by_tenant_linked', ['tenantId', 'linkedType', 'linkedId'])
    .index('by_tenant_uploaded', ['tenantId', 'uploadedBy'])
    .index('by_tenant_storage', ['tenantId', 'storageId']),

  platformAdmins: defineTable({
    clerkUserId: v.string(),
    createdAt: v.string(),
  }).index('by_clerk_user_id', ['clerkUserId']),
})


 succeeded in 798ms:
import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireTenantRole } from './authHelpers'
import type { Id } from './_generated/dataModel'

// Fixed reference dates for deterministic, idempotent seeds across days
const REF_TODAY = '2024-01-15'
const REF_YESTERDAY = '2024-01-14'

export const seedAgency = mutation({
  args: {
    clerkOrgId: v.string(),
    caregiverIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const counts = {
      clientsCreated: 0,
      clientsSkipped: 0,
      shiftsCreated: 0,
      shiftsSkipped: 0,
      shiftsRepaired: 0,
      docsCreated: 0,
      docsSkipped: 0,
    }

    // Helper: find client by displayName within tenant
    const findClient = async (displayName: string) => {
      const all = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((c) => c.displayName === displayName) ?? null
    }

    // Upsert clients
    let clientSlsId: Id<'clients'>
    const clientSls = await findClient('Alex Rivera')
    if (!clientSls) {
      clientSlsId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Alex Rivera',
        serviceType: 'SLS',
        authorizationHours: 40,
        riskFlags: ['mobility'],
      })
      counts.clientsCreated++
    } else {
      clientSlsId = clientSls._id
      counts.clientsSkipped++
    }

    let clientIlsId: Id<'clients'>
    const clientIls = await findClient('Jordan Chen')
    if (!clientIls) {
      clientIlsId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Jordan Chen',
        serviceType: 'ILS',
        authorizationHours: 30,
        riskFlags: [],
      })
      counts.clientsCreated++
    } else {
      clientIlsId = clientIls._id
      counts.clientsSkipped++
    }

    const cg1 = args.caregiverIds[0] ?? 'cg-demo-1'
    const cg2 = args.caregiverIds[1] ?? 'cg-demo-2'

    // Helper: find shift by scheduledStart within tenant
    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q.eq('tenantId', tenantId),
        )
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    // Helper: repair missing child records for a shift
    const repairShiftChildren = async (
      shiftId: Id<'shifts'>,
      config: {
        note?: { startTime: string; endTime: string; servicesProvided: string; clientResponse: string; narrative: string; submittedBy?: string; submittedAt?: string }
        tasks: Array<{ title: string; requiredProof: boolean; status: 'pending' | 'complete'; proofName?: string }>
        review?: { reviewerId: string; decision: 'approved' | 'correction_requested'; comment: string; createdAt: string }
        billing?: { hours: number; rate: number; amount: number; createdAt: string }
      },
    ) => {
      let repaired = false

      const existingNote = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
        .unique()
      if (!existingNote && config.note) {
        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: config.note.startTime,
          endTime: config.note.endTime,
          servicesProvided: config.note.servicesProvided,
          clientResponse: config.note.clientResponse,
          narrative: config.note.narrative,
          submittedBy: config.note.submittedBy,
          submittedAt: config.note.submittedAt,
        })
        repaired = true
      }

      const existingTasks = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
        .collect()
      const existingTaskTitles = new Set(existingTasks.map((t) => t.title))
      for (const task of config.tasks) {
        if (!existingTaskTitles.has(task.title)) {
          await ctx.db.insert('shiftTasks', {
            tenantId,
            shiftId,
            title: task.title,
            requiredProof: task.requiredProof,
            status: task.status,
            proofName: task.proofName,
          })
          repaired = true
        }
      }

      if (config.review) {
        const existingReviews = await ctx.db
          .query('reviewEvents')
          .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
          .collect()
        if (existingReviews.length === 0) {
          await ctx.db.insert('reviewEvents', {
            tenantId,
            shiftId,
            reviewerId: config.review.reviewerId,
            decision: config.review.decision,
            comment: config.review.comment,
            createdAt: config.review.createdAt,
          })
          repaired = true
        }
      }

      if (config.billing) {
        const existingBilling = await ctx.db
          .query('billingLines')
          .withIndex('by_tenant_shift', (q) => q.eq('tenantId', tenantId).eq('shiftId', shiftId))
          .collect()
        if (existingBilling.length === 0) {
          await ctx.db.insert('billingLines', {
            tenantId,
            shiftId,
            hours: config.billing.hours,
            rate: config.billing.rate,
            amount: config.billing.amount,
            createdAt: config.billing.createdAt,
          })
          repaired = true
        }
      }

      return repaired
    }

    // Shift 1: in_progress today
    let shift1Id: Id<'shifts'>
    const shift1 = await findShift(`${REF_TODAY}T09:00:00Z`)
    if (!shift1) {
      shift1Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientSlsId,
        caregiverId: cg1,
        scheduledStart: `${REF_TODAY}T09:00:00Z`,
        scheduledEnd: `${REF_TODAY}T13:00:00Z`,
        status: 'in_progress',
        serviceType: 'SLS',
        rate: 28.5,
      })
      counts.shiftsCreated++
    } else {
      shift1Id = shift1._id
      counts.shiftsSkipped++
    }
    const shift1Repaired = await repairShiftChildren(shift1Id, {
      note: { startTime: '', endTime: '', servicesProvided: '', clientResponse: '', narrative: '' },
      tasks: [
        { title: 'Medication support observed', requiredProof: true, status: 'pending' },
        { title: 'Community access activity', requiredProof: false, status: 'pending' },
      ],
    })
    if (shift1Repaired) counts.shiftsRepaired++

    // Shift 2: in_progress yesterday
    let shift2Id: Id<'shifts'>
    const shift2 = await findShift(`${REF_YESTERDAY}T14:00:00Z`)
    if (!shift2) {
      shift2Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientIlsId,
        caregiverId: cg2,
        scheduledStart: `${REF_YESTERDAY}T14:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T18:00:00Z`,
        status: 'in_progress',
        serviceType: 'ILS',
        rate: 32.0,
      })
      counts.shiftsCreated++
    } else {
      shift2Id = shift2._id
      counts.shiftsSkipped++
    }
    const shift2Repaired = await repairShiftChildren(shift2Id, {
      note: { startTime: '', endTime: '', servicesProvided: '', clientResponse: '', narrative: '' },
      tasks: [
        { title: 'ILS coaching session', requiredProof: false, status: 'pending' },
        { title: 'Meal planning documentation', requiredProof: true, status: 'pending' },
      ],
    })
    if (shift2Repaired) counts.shiftsRepaired++

    // Shift 3: submitted yesterday
    let shift3Id: Id<'shifts'>
    const shift3 = await findShift(`${REF_YESTERDAY}T08:00:00Z`)
    if (!shift3) {
      shift3Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientSlsId,
        caregiverId: cg1,
        scheduledStart: `${REF_YESTERDAY}T08:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T12:00:00Z`,
        status: 'submitted',
        serviceType: 'SLS',
        rate: 28.5,
      })
      counts.shiftsCreated++
    } else {
      shift3Id = shift3._id
      counts.shiftsSkipped++
    }
    const shift3Repaired = await repairShiftChildren(shift3Id, {
      note: {
        startTime: '08:00',
        endTime: '12:00',
        servicesProvided: 'Community integration, medication reminders',
        clientResponse: 'Engaged well with group activity.',
        narrative: 'Supported client through morning routine and community outing.',
        submittedBy: cg1,
        submittedAt: `${REF_YESTERDAY}T12:30:00Z`,
      },
      tasks: [
        { title: 'Medication support observed', requiredProof: true, status: 'complete', proofName: 'med_log.jpg' },
        { title: 'Community access activity', requiredProof: false, status: 'complete' },
      ],
    })
    if (shift3Repaired) counts.shiftsRepaired++

    // Shift 4: billing_ready yesterday
    let shift4Id: Id<'shifts'>
    const shift4 = await findShift(`${REF_YESTERDAY}T09:00:00Z`)
    if (!shift4) {
      shift4Id = await ctx.db.insert('shifts', {
        tenantId,
        clientId: clientIlsId,
        caregiverId: cg2,
        scheduledStart: `${REF_YESTERDAY}T09:00:00Z`,
        scheduledEnd: `${REF_YESTERDAY}T13:00:00Z`,
        status: 'billing_ready',
        serviceType: 'ILS',
        rate: 32.0,
      })
      counts.shiftsCreated++
    } else {
      shift4Id = shift4._id
      counts.shiftsSkipped++
    }
    const hours = 4
    const amount = Math.round(hours * 32.0 * 100) / 100
    const shift4Repaired = await repairShiftChildren(shift4Id, {
      note: {
        startTime: '09:00',
        endTime: '13:00',
        servicesProvided: 'ILS coaching, budgeting practice',
        clientResponse: 'Practiced meal planning independently.',
        narrative: 'Client showed improvement in independent living skills.',
        submittedBy: cg2,
        submittedAt: `${REF_YESTERDAY}T13:15:00Z`,
      },
      tasks: [
        { title: 'ILS coaching session', requiredProof: false, status: 'complete' },
        { title: 'Budgeting worksheet', requiredProof: true, status: 'complete', proofName: 'budget_sheet.pdf' },
      ],
      review: {
        reviewerId: 'co-demo-1',
        decision: 'approved',
        comment: 'Documentation complete and accurate.',
        createdAt: `${REF_YESTERDAY}T14:00:00Z`,
      },
      billing: {
        hours,
        rate: 32.0,
        amount,
        createdAt: `${REF_YESTERDAY}T14:00:00Z`,
      },
    })
    if (shift4Repaired) counts.shiftsRepaired++

    // Upsert compliance docs
    const findDoc = async (title: string) => {
      const all = await ctx.db
        .query('complianceDocs')
        .withIndex('by_tenant_category', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((d) => d.title === title) ?? null
    }

    const doc1 = await findDoc('SLS Documentation Requirements')
    if (!doc1) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'SLS Documentation Requirements',
        body: 'All SLS shifts require progress notes with start/end times, services provided, and client response. Proof of medication support must be attached when applicable.',
        category: 'documentation',
        visibility: 'all_staff',
        embedding: generateEmbedding('SLS Documentation Requirements progress notes medication support proof'),
      })
      counts.docsCreated++
    } else {
      counts.docsSkipped++
    }

    const doc2 = await findDoc('ILS Billing Guidelines')
    if (!doc2) {
      await ctx.db.insert('complianceDocs', {
        tenantId,
        title: 'ILS Billing Guidelines',
        body: 'ILS services are billed at the authorized rate per hour. Documentation must show measurable skill acquisition.',
        category: 'billing',
        visibility: 'all_staff',
        embedding: generateEmbedding('ILS Billing Guidelines authorized rate per hour skill acquisition'),
      })
      counts.docsCreated++
    } else {
      counts.docsSkipped++
    }

    const totalCreated =
      counts.clientsCreated +
      counts.shiftsCreated +
      counts.docsCreated
    const totalSkipped =
      counts.clientsSkipped +
      counts.shiftsSkipped +
      counts.docsSkipped

    if (totalCreated === 0 && totalSkipped > 0 && counts.shiftsRepaired === 0) {
      return {
        status: 'already-seeded' as const,
        message: `All demo data already exists (${totalSkipped} items skipped).`,
        counts,
      }
    }

    if (counts.shiftsRepaired > 0) {
      return {
        status: 'seeded' as const,
        message: `Repaired ${counts.shiftsRepaired} shift${counts.shiftsRepaired !== 1 ? 's' : ''} with missing records. ${totalCreated > 0 ? `Created ${totalCreated} new items.` : ''}`,
        counts,
      }
    }

    return {
      status: 'seeded' as const,
      message: `Seeded ${totalCreated} new items. ${totalSkipped > 0 ? `${totalSkipped} existing items skipped.` : ''}`,
      counts,
    }
  },
})

export const seedCaregiverShifts = mutation({
  args: {
    clerkOrgId: v.string(),
    caregiverId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .take(10)

    if (clients.length === 0) {
      throw new Error('No clients found. Seed agency data first.')
    }

    const today = new Date().toISOString().split('T')[0]
    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) =>
          q.eq('tenantId', tenantId),
        )
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    const counts = { created: 0, skipped: 0 }

    // Demo shift 1: scheduled for today morning
    const start1 = `${today}T09:00:00Z`
    if (!(await findShift(start1))) {
      const client = clients[0]
      await ctx.db.insert('shifts', {
        tenantId,
        clientId: client._id,
        caregiverId: args.caregiverId,
        scheduledStart: start1,
        scheduledEnd: `${today}T13:00:00Z`,
        status: 'scheduled',
        serviceType: client.serviceType,
        rate: 28.5,
      })
      counts.created++
    } else {
      counts.skipped++
    }

    // Demo shift 2: scheduled for today afternoon
    const start2 = `${today}T14:00:00Z`
    if (!(await findShift(start2))) {
      const client = clients.length > 1 ? clients[1] : clients[0]
      await ctx.db.insert('shifts', {
        tenantId,
        clientId: client._id,
        caregiverId: args.caregiverId,
        scheduledStart: start2,
        scheduledEnd: `${today}T18:00:00Z`,
        status: 'scheduled',
        serviceType: client.serviceType,
        rate: 30.0,
      })
      counts.created++
    } else {
      counts.skipped++
    }

    return {
      status: counts.created > 0 ? ('seeded' as const) : ('already-seeded' as const),
      message:
        counts.created > 0
          ? `Created ${counts.created} demo shift${counts.created !== 1 ? 's' : ''} for caregiver.`
          : `All demo shifts already exist (${counts.skipped} skipped).`,
      counts,
    }
  },
})

function generateEmbedding(text: string): number[] {
  const DIMENSIONS = 32
  const vector = Array.from({ length: DIMENSIONS }, () => 0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  tokens.forEach((token, index) => {
    const hash = hashToken(`${token}:${index}`)
    const slot = Math.abs(hash) % DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[slot] += sign * (1 + token.length / 12)
  })

  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value ** 2, 0),
  )
  return magnitude === 0
    ? vector
    : vector.map((value) => Number((value / magnitude).toFixed(6)))
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash
}

// Deterministic E2E fixtures. Idempotent by clerkOrgId, member email, and
// scheduled start time. Geofence is disabled by default so the lifecycle
// flow can run without location. A second client with coordinates is provided
// for geofence scenarios.
export const seedE2E = mutation({
  args: {
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const today = new Date().toISOString().slice(0, 10)

    const members = [
      {
        clerkUserId: 'e2e-admin',
        role: 'org:admin' as const,
        displayName: 'E2E Admin',
        email: 'e2e-admin@atriax.test',
      },
      {
        clerkUserId: 'e2e-coordinator',
        role: 'org:coordinator' as const,
        displayName: 'E2E Coordinator',
        email: 'e2e-coordinator@atriax.test',
      },
      {
        clerkUserId: 'e2e-caregiver',
        role: 'org:caregiver' as const,
        displayName: 'E2E Caregiver',
        email: 'e2e-caregiver@atriax.test',
      },
    ]

    const memberIds: Record<string, Id<'tenantMembers'>> = {}
    for (const member of members) {
      const existing = await ctx.db
        .query('tenantMembers')
        .withIndex('by_tenant_user', (q) =>
          q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
        )
        .unique()
      if (existing) {
        memberIds[member.clerkUserId] = existing._id
      } else {
        memberIds[member.clerkUserId] = await ctx.db.insert('tenantMembers', {
          tenantId,
          clerkUserId: member.clerkUserId,
          role: member.role,
          displayName: member.displayName,
          email: member.email,
        })
      }
    }

    const findClient = async (displayName: string) => {
      const all = await ctx.db
        .query('clients')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((c) => c.displayName === displayName) ?? null
    }

    let lifecycleClientId: Id<'clients'>
    const lifecycleClient = await findClient('Sam Lee')
    if (!lifecycleClient) {
      lifecycleClientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Sam Lee',
        serviceType: 'ILS',
        authorizationHours: 30,
        riskFlags: [],
      })
    } else {
      lifecycleClientId = lifecycleClient._id
    }

    let geofenceClientId: Id<'clients'>
    const geofenceClient = await findClient('Maya Torres')
    if (!geofenceClient) {
      geofenceClientId = await ctx.db.insert('clients', {
        tenantId,
        displayName: 'Maya Torres',
        serviceType: 'SLS',
        authorizationHours: 40,
        riskFlags: ['mobility'],
        serviceAddress: {
          line1: '123 Hennepin Ave',
          city: 'Minneapolis',
          state: 'MN',
          postalCode: '55401',
          latitude: 44.9778,
          longitude: -93.265,
        },
      })
    } else {
      geofenceClientId = geofenceClient._id
    }

    // Ensure geofence is disabled by default so the lifecycle test runs
    // without prompting for browser location.
    const existingSettings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()
    if (!existingSettings) {
      await ctx.db.insert('tenantSettings', {
        tenantId,
        shiftGeofence: {
          enabled: false,
          enforceClockIn: false,
          enforceClockOut: false,
          defaultRadiusMeters: 100,
          maxAccuracyMeters: 50,
        },
      })
    }

    const findShift = async (scheduledStart: string) => {
      const all = await ctx.db
        .query('shifts')
        .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
        .collect()
      return all.find((s) => s.scheduledStart === scheduledStart) ?? null
    }

    let lifecycleShiftId: Id<'shifts'>
    const lifecycleStart = `${today}T09:00:00Z`
    const lifecycleShift = await findShift(lifecycleStart)
    if (!lifecycleShift) {
      lifecycleShiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId: lifecycleClientId,
        caregiverId: 'e2e-caregiver',
        scheduledStart: lifecycleStart,
        scheduledEnd: `${today}T13:00:00Z`,
        status: 'scheduled',
        serviceType: 'ILS',
        rate: 30,
      })
    } else {
      lifecycleShiftId = lifecycleShift._id
    }

    const ensureProgressNote = async (shiftId: Id<'shifts'>) => {
      const existing = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      if (!existing) {
        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        })
      }
    }

    const ensureDefaultTask = async (shiftId: Id<'shifts'>) => {
      const existing = await ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
      if (existing.length === 0) {
        await ctx.db.insert('shiftTasks', {
          tenantId,
          shiftId,
          title: 'Upload shift documentation proof',
          requiredProof: true,
          status: 'pending',
        })
      }
    }

    await ensureProgressNote(lifecycleShiftId)
    await ensureDefaultTask(lifecycleShiftId)

    let geofenceShiftId: Id<'shifts'>
    const geofenceStart = `${today}T14:00:00Z`
    const geofenceShift = await findShift(geofenceStart)
    if (!geofenceShift) {
      geofenceShiftId = await ctx.db.insert('shifts', {
        tenantId,
        clientId: geofenceClientId,
        caregiverId: 'e2e-caregiver',
        scheduledStart: geofenceStart,
        scheduledEnd: `${today}T18:00:00Z`,
        status: 'scheduled',
        serviceType: 'SLS',
        rate: 28.5,
      })
    } else {
      geofenceShiftId = geofenceShift._id
    }

    await ensureProgressNote(geofenceShiftId)
    await ensureDefaultTask(geofenceShiftId)

    return {
      status: 'seeded' as const,
      tenantId,
      memberIds,
      lifecycleShiftId,
      geofenceShiftId,
    }
  },
})


codex
The seed mutation has a likely functional problem: it creates members with hard-coded Clerk user IDs like `e2e-caregiver`, but the signed-in Clerk users will have real `userId` values. Iâ€™m checking the auth helpers and queries to confirm whether that prevents seeded shifts from being visible/actionable.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\authHelpers.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\shiftClock.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\shiftQueries.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\reviews.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 732ms:
import type { QueryCtx, MutationCtx } from './_generated/server'
import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'

export type AuthContext = QueryCtx | MutationCtx
export type TenantRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

export async function requireIdentity(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError('Unauthorized: authentication required.')
  }
  return identity
}

export async function requireTenant(ctx: AuthContext, clerkOrgId: string) {
  const identity = await requireIdentity(ctx)
  requireMatchingClerkOrganization(identity, clerkOrgId)

  const tenant = await ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()

  if (!tenant) {
    throw new ConvexError('Unauthorized: tenant not found.')
  }

  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
    )
    .unique()

  if (!member) {
    throw new ConvexError('Forbidden: not a member of this tenant.')
  }

  return {
    tenantId: tenant._id,
    tenant,
    clerkOrgId,
    identity,
    member,
    role: member.role,
  }
}

export async function requireTenantRole(
  ctx: AuthContext,
  clerkOrgId: string,
  allowedRoles: TenantRole[],
) {
  const { tenantId, tenant, identity, member, role } = await requireTenant(
    ctx,
    clerkOrgId,
  )

  if (!allowedRoles.includes(role)) {
    throw new ConvexError(
      `Forbidden: required one of [${allowedRoles.join(', ')}].`,
    )
  }

  return { tenantId, tenant, clerkOrgId, identity, member, role }
}

export function assertTenantDoc<T extends { tenantId: unknown }>(
  doc: T,
  tenantId: Id<'tenants'>,
): asserts doc is T & { tenantId: Id<'tenants'> } {
  if (doc.tenantId !== tenantId) {
    throw new ConvexError('Forbidden: cross-tenant access denied.')
  }
}

export async function getTenantByClerkOrgId(
  ctx: AuthContext,
  clerkOrgId: string,
) {
  return ctx.db
    .query('tenants')
    .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
    .unique()
}

function normalizeTenantRole(role: unknown): TenantRole | null {
  if (
    role === 'org:admin' ||
    role === 'org:coordinator' ||
    role === 'org:caregiver'
  ) {
    return role
  }

  if (role === 'admin') return 'org:admin'
  if (role === 'coordinator') return 'org:coordinator'
  if (role === 'caregiver') return 'org:caregiver'

  return null
}

export function getActiveClerkOrganizationId(identity: {
  [key: string]: unknown
}) {
  if (typeof identity.org_id === 'string') return identity.org_id

  const compactOrg = identity.o
  if (
    compactOrg &&
    typeof compactOrg === 'object' &&
    'id' in compactOrg &&
    typeof (compactOrg as Record<string, unknown>).id === 'string'
  ) {
    return (compactOrg as Record<string, unknown>).id as string
  }

  if (typeof identity['o.id'] === 'string') return identity['o.id']

  return null
}

export function getClerkOrganizationRole(identity: {
  [key: string]: unknown
}): TenantRole | null {
  const topLevelRole = normalizeTenantRole(identity.org_role)
  if (topLevelRole) return topLevelRole

  const compactOrg = identity.o
  if (compactOrg && typeof compactOrg === 'object' && 'rol' in compactOrg) {
    return normalizeTenantRole(
      (compactOrg as Record<string, unknown>).rol,
    )
  }

  return normalizeTenantRole(identity['o.rol'])
}

export function requireMatchingClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (typeof activeOrgId === 'string' && activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

/** Stricter variant that REQUIRES org_id to be present and match.
 *  Use for bootstrap mutations where missing org context is suspicious.
 */
export function requireActiveClerkOrganization(
  identity: { [key: string]: unknown },
  clerkOrgId: string,
) {
  const activeOrgId = getActiveClerkOrganizationId(identity)
  if (!activeOrgId) {
    throw new ConvexError(
      'Forbidden: active Clerk organization required but missing from token.',
    )
  }
  if (activeOrgId !== clerkOrgId) {
    throw new ConvexError('Forbidden: active Clerk organization mismatch.')
  }
}

export async function ensureTenantMember(
  ctx: AuthContext,
  tenantId: Id<'tenants'>,
  clerkUserId: string,
) {
  return ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
    )
    .unique()
}


 succeeded in 720ms:
import { ConvexError, v } from 'convex/values'
import { query } from './_generated/server'
import {
  assertTenantDoc,
  requireTenant,
  requireTenantRole,
} from './authHelpers'

function assertShiftReadableByRole(
  shift: { caregiverId: string },
  role: string,
  clerkUserId: string,
) {
  if (role === 'org:caregiver' && shift.caregiverId !== clerkUserId) {
    throw new ConvexError(
      'Forbidden: caregivers can only view assigned shifts.',
    )
  }
}

export const listMyShifts = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)

    const shifts = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_caregiver_status', (q) =>
        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
      )
      .order('desc')
      .take(100)

    const clients = await Promise.all(
      shifts.map((shift) => ctx.db.get(shift.clientId)),
    )

    clients.forEach((client) => {
      if (client) assertTenantDoc(client, tenantId)
    })

    return shifts.map((shift, index) => ({
      shift,
      client: clients[index],
    }))
  },
})

export const listForReview = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const submitted = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'submitted'),
      )
      .order('desc')
      .take(100)

    const needsCorrection = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'needs_correction'),
      )
      .order('desc')
      .take(100)

    return [...submitted, ...needsCorrection]
  },
})

export const listBillingReady = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) =>
        q.eq('tenantId', tenantId).eq('status', 'billing_ready'),
      )
      .order('desc')
      .take(200)
  },
})

export const listAll = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    return ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .order('desc')
      .take(200)
  },
})

export const get = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)
    return shift
  },
})

export const getWithDetails = query({
  args: { clerkOrgId: v.string(), shiftId: v.id('shifts') },
  handler: async (ctx, { clerkOrgId, shiftId }) => {
    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
    const shift = await ctx.db.get(shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)
    assertShiftReadableByRole(shift, role, identity.subject)

    const [client, note, tasks, reviews, punches] = await Promise.all([
      ctx.db.get(shift.clientId),
      ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique(),
      ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
      ctx.db
        .query('reviewEvents')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .order('desc')
        .collect(),
      ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect(),
    ])

    if (client) assertTenantDoc(client, tenantId)
    if (note) assertTenantDoc(note, tenantId)
    for (const task of tasks) assertTenantDoc(task, tenantId)
    for (const review of reviews) assertTenantDoc(review, tenantId)
    for (const punch of punches) assertTenantDoc(punch, tenantId)

    const clockIn = punches.find((p) => p.punchType === 'clock_in')
    const clockOut = punches.find((p) => p.punchType === 'clock_out')
    const locationMatched = Boolean(
      clockIn?.location && clockIn.location.withinGeofence === true,
    )
    const submittedOnSite = Boolean(
      clockOut?.location && clockOut.location.withinGeofence === true,
    )

    return {
      shift,
      client,
      note,
      tasks,
      reviews,
      verification: { locationMatched, submittedOnSite },
    }
  },
})

export const dashboardStats = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const all = await ctx.db
      .query('shifts')
      .withIndex('by_tenant_status_start', (q) => q.eq('tenantId', tenantId))
      .collect()

    const billingLines = await ctx.db
      .query('billingLines')
      .withIndex('by_tenant_export_batch', (q) => q.eq('tenantId', tenantId))
      .collect()
    const oldestSubmitted = all
      .filter((shift) => shift.status === 'submitted')
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    return {
      inProgress: all.filter((shift) => shift.status === 'in_progress').length,
      submitted: all.filter((shift) => shift.status === 'submitted').length,
      needsCorrection: all.filter(
        (shift) => shift.status === 'needs_correction',
      ).length,
      billingReady: all.filter((shift) => shift.status === 'billing_ready')
        .length,
      dollarsAtRisk:
        Math.round(
          billingLines.reduce(
            (sum, line) => sum + (line.exportBatchId ? 0 : line.amount),
            0,
          ) * 100,
        ) / 100,
      oldestSubmittedAge: oldestSubmitted
        ? Math.floor(
            (Date.now() - new Date(oldestSubmitted.scheduledStart).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0,
    }
  },
})


 succeeded in 715ms:
import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import {
  calculateDocumentedHours,
  roundCurrency,
  validateShiftDocumentation,
} from './shiftValidation'

export const approve = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (shift.status !== 'submitted') {
      throw new Error('Only submitted shifts can be approved.')
    }

    const note = await ctx.db
      .query('progressNotes')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .unique()

    if (!note) throw new Error('Progress note not found.')
    assertTenantDoc(note, tenantId)

    const tasks = await ctx.db
      .query('shiftTasks')
      .withIndex('by_tenant_shift', (q) =>
        q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
      )
      .collect()

    for (const task of tasks) assertTenantDoc(task, tenantId)

    const blockers = validateShiftDocumentation(note, tasks)
    if (blockers.length > 0) {
      throw new Error(
        `Incomplete documentation cannot be approved: ${blockers.join(' ')}`,
      )
    }

    const hours = calculateDocumentedHours(note.startTime, note.endTime)
    if (hours === null) {
      throw new Error('Valid documented hours are required before approval.')
    }

    await ctx.db.patch(args.shiftId, { status: 'billing_ready' })

    await ctx.db.insert('reviewEvents', {
      tenantId,
      shiftId: args.shiftId,
      reviewerId: identity.subject,
      decision: 'approved',
      comment: args.comment,
      createdAt: new Date().toISOString(),
    })

    const amount = roundCurrency(hours * shift.rate)

    await ctx.db.insert('billingLines', {
      tenantId,
      shiftId: args.shiftId,
      hours,
      rate: shift.rate,
      amount,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_approved',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'billing_ready',
    })

    return args.shiftId
  },
})

export const requestCorrection = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (!args.comment || args.comment.trim().length === 0) {
      throw new Error('A comment is required to request a correction.')
    }

    if (shift.status !== 'submitted' && shift.status !== 'billing_ready') {
      throw new Error(
        'Can only return submitted or approved shifts for correction.',
      )
    }

    if (shift.status === 'billing_ready') {
      const billingLines = await ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', args.shiftId),
        )
        .collect()

      for (const line of billingLines) {
        assertTenantDoc(line, tenantId)
        if (line.exportBatchId) {
          throw new Error(
            'Invoiced billing lines cannot be returned for correction without a reversal.',
          )
        }
        await ctx.db.delete(line._id)
      }
    }

    await ctx.db.patch(args.shiftId, { status: 'needs_correction' })

    await ctx.db.insert('reviewEvents', {
      tenantId,
      shiftId: args.shiftId,
      reviewerId: identity.subject,
      decision: 'correction_requested',
      comment: args.comment,
      createdAt: new Date().toISOString(),
    })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_correction_requested',
      shiftId: args.shiftId,
      previousStatus: shift.status,
      nextStatus: 'needs_correction',
    })

    return args.shiftId
  },
})


2026-06-26T23:07:18.009366Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.9 seconds
Output:
Get-Content : Cannot find path 'convex\shiftClock.ts' because it does not exist.
At line:2 char:1
+ Get-Content -Raw -LiteralPath 'convex\shiftClock.ts'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (convex\shiftClock.ts:String) [Get-Content], ItemNotFoundException
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 

 exited 1 in 891ms:
Get-Content : Cannot find path 'convex\shiftClock.ts' because it does not exist.
At line:2 char:1
+ Get-Content -Raw -LiteralPath 'convex\shiftClock.ts'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (convex\shiftClock.ts:String) [Get-Content], ItemNotFoundException
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 

codex
Confirmed: caregiver-facing shift queries key off `identity.subject`, so the seeded caregiver ID must match the real Clerk subject. Hard-coded fake IDs make the new e2e data inaccessible unless the real test accounts happen to use those exact subjects, which Clerk does not.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\shifts.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\adpSync.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\adpOutbound.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -Recurse -File -LiteralPath 'convex\\integrations' | Select-Object -ExpandProperty FullName" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 746ms:
import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import { requireTenantRole, assertTenantDoc } from './authHelpers'
import { internal } from './_generated/api'
import { mergeTaskUpdates, validateShiftDocumentation } from './shiftValidation'
import {
  initialShiftStatusForStart,
  isScheduledStartDue,
} from './shiftLifecycle'
import {
  resolveShiftServiceTarget,
  validatePunchLocation,
  type LocationInput,
} from './locationValidation'
import { DEFAULT_SHIFT_GEOFENCE } from './tenantSettings'
import type { Id } from './_generated/dataModel'

const DEFAULT_REQUIRED_PROOF_TASK = 'Upload shift documentation proof'
const MAX_BULK_SHIFTS = 500

async function assertCaregiverMember(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  caregiverId: string,
) {
  const member = await ctx.db
    .query('tenantMembers')
    .withIndex('by_tenant_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
    )
    .unique()

  if (!member || member.role !== 'org:caregiver') {
    throw new Error(
      'Selected caregiver must be an active caregiver in this agency.',
    )
  }
}

function validateShiftTimes(scheduledStart: string, scheduledEnd: string) {
  if (scheduledEnd <= scheduledStart) {
    throw new Error('Shift end time must be after start time.')
  }
}

function validateRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Rate must be greater than zero.')
  }
}

async function loadShift(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const shift = await ctx.db.get(shiftId)
  if (!shift) throw new Error('Shift not found.')
  assertTenantDoc(shift, tenantId)
  return shift
}

async function loadProgressNote(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const note = await ctx.db
    .query('progressNotes')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .unique()

  if (!note) throw new Error('Progress note not found.')
  assertTenantDoc(note, tenantId)
  return note
}

async function loadShiftTasks(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const tasks = await ctx.db
    .query('shiftTasks')
    .withIndex('by_tenant_shift', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId),
    )
    .collect()

  for (const task of tasks) assertTenantDoc(task, tenantId)
  return tasks
}

async function findPunch(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
  punchType: 'clock_in' | 'clock_out',
) {
  return ctx.db
    .query('timePunches')
    .withIndex('by_tenant_shift_type', (q) =>
      q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', punchType),
    )
    .unique()
}

async function assertClockInPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_in')
  if (!existing) {
    throw new Error(
      'You must clock in before you can document or submit this shift.',
    )
  }
}

async function assertClockOutPunchExists(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shiftId: Id<'shifts'>,
) {
  const existing = await findPunch(ctx, tenantId, shiftId, 'clock_out')
  if (!existing) {
    throw new Error(
      'You must clock out before this shift can be submitted.',
    )
  }
}

async function getShiftGeofence(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
) {
  const settings = await ctx.db
    .query('tenantSettings')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .unique()

  return settings?.shiftGeofence ?? DEFAULT_SHIFT_GEOFENCE
}

async function validateClockPunchLocation(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  shift: {
    clientId: Id<'clients'>
    serviceLocationOverride?: {
      label: string
      latitude: number
      longitude: number
      radiusMeters?: number
    } | null
  },
  location: LocationInput | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  const geofence = await getShiftGeofence(ctx, tenantId)
  const required =
    geofence.enabled &&
    (punchType === 'clock_in'
      ? geofence.enforceClockIn
      : geofence.enforceClockOut)

  const client = await ctx.db.get(shift.clientId)
  if (!client) throw new Error('Client not found.')
  assertTenantDoc(client, tenantId)

  const target = resolveShiftServiceTarget(shift, client, geofence)

  return validatePunchLocation({
    location,
    target,
    required,
    maxAccuracyMeters: geofence.maxAccuracyMeters,
  })
}

async function submitShift(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    note: {
      startTime: string
      endTime: string
      servicesProvided: string
      clientResponse: string
      narrative: string
    }
    tasks: {
      taskId: Id<'shiftTasks'>
      status: 'pending' | 'complete'
      proofUrl?: string
      proofName?: string
    }[]
  },
  actor: { subject: string; role: string },
) {
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)

  if (actor.role === 'org:caregiver' && shift.caregiverId !== actor.subject) {
    throw new Error('Caregivers can only submit their assigned shifts.')
  }

  if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
    throw new Error('Only in-progress or corrected shifts can be submitted.')
  }

  await assertClockInPunchExists(ctx, tenantId, args.shiftId)
  await assertClockOutPunchExists(ctx, tenantId, args.shiftId)

  const existingNote = await loadProgressNote(ctx, tenantId, args.shiftId)
  const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)

  const mergedTasks = mergeTaskUpdates(existingTasks, args.tasks)
  const blockers = validateShiftDocumentation(args.note, mergedTasks)
  if (blockers.length > 0) {
    throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
  }

  await ctx.db.patch(existingNote._id, {
    startTime: args.note.startTime,
    endTime: args.note.endTime,
    servicesProvided: args.note.servicesProvided,
    clientResponse: args.note.clientResponse,
    narrative: args.note.narrative,
    submittedBy: actor.subject,
    submittedAt: new Date().toISOString(),
  })

  for (const task of mergedTasks) {
    await ctx.db.patch(task._id, {
      status: task.status,
      proofUrl: task.proofUrl,
      proofName: task.proofName,
    })
  }

  await ctx.db.patch(args.shiftId, { status: 'submitted' })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: 'shift_submitted',
    shiftId: args.shiftId,
    previousStatus: shift.status,
    nextStatus: 'submitted',
  })

  return args.shiftId
}

async function recordClockPunch(
  ctx: MutationCtx,
  args: {
    clerkOrgId: string
    shiftId: Id<'shifts'>
    caregiverId: string
    punchType: 'clock_in' | 'clock_out'
    location?: LocationInput
  },
) {
  const now = new Date().toISOString()
  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
    'org:admin',
    'org:coordinator',
    'org:caregiver',
  ])

  const shift = await loadShift(ctx, tenantId, args.shiftId)
  const locationEvidence = await validateClockPunchLocation(
    ctx,
    tenantId,
    shift,
    args.location,
    args.punchType,
  )

  const existing = await findPunch(ctx, tenantId, args.shiftId, args.punchType)
  if (existing) {
    return existing._id
  }

  const punchId = await ctx.db.insert('timePunches', {
    tenantId,
    shiftId: args.shiftId,
    caregiverId: args.caregiverId,
    punchType: args.punchType,
    at: now,
    source: 'atriax',
    location: locationEvidence,
    adpSyncStatus: 'pending_credentials',
    createdAt: now,
  })

  await ctx.runMutation(internal.audit.record, {
    clerkOrgId: args.clerkOrgId,
    action: `shift_${args.punchType === 'clock_in' ? 'clocked_in' : 'clocked_out'}`,
    shiftId: args.shiftId,
    metadata: {
      punchId: punchId as string,
      withinGeofence: locationEvidence?.withinGeofence ?? null,
      distanceMeters: locationEvidence?.distanceMeters ?? null,
    },
  })

  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
    timePunchId: punchId,
  })

  return punchId
}

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    clientId: v.id('clients'),
    caregiverId: v.string(),
    scheduledStart: v.string(),
    scheduledEnd: v.string(),
    serviceType: v.union(v.literal('SLS'), v.literal('ILS')),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const client = await ctx.db.get(args.clientId)
    if (!client) throw new Error('Client not found.')
    assertTenantDoc(client, tenantId)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)
    validateShiftTimes(args.scheduledStart, args.scheduledEnd)
    validateRate(args.rate)

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId: args.clientId,
      caregiverId: args.caregiverId,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      status: initialShiftStatusForStart(args.scheduledStart),
      serviceType: args.serviceType,
      rate: args.rate,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: DEFAULT_REQUIRED_PROOF_TASK,
      requiredProof: true,
      status: 'pending',
    })

    return shiftId
  },
})

export const createMany = mutation({
  args: {
    clerkOrgId: v.string(),
    clientIds: v.array(v.id('clients')),
    caregiverId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    rate: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const uniqueClientIds = Array.from(
      new Set(args.clientIds),
    ) as Id<'clients'>[]

    if (uniqueClientIds.length === 0) {
      throw new Error('Select at least one client.')
    }
    if (args.endDate < args.startDate) {
      throw new Error('End date must be on or after start date.')
    }
    if (args.endTime <= args.startTime) {
      throw new Error('End time must be after start time.')
    }
    validateRate(args.rate)
    await assertCaregiverMember(ctx, tenantId, args.caregiverId)

    const clients: Array<{
      _id: Id<'clients'>
      serviceType: 'SLS' | 'ILS'
    }> = []
    for (const clientId of uniqueClientIds) {
      const client = await ctx.db.get(clientId)
      if (!client) throw new Error('Client not found.')
      assertTenantDoc(client, tenantId)
      clients.push({ _id: client._id, serviceType: client.serviceType })
    }

    const createdShiftIds: Id<'shifts'>[] = []
    const cursor = new Date(`${args.startDate}T00:00:00Z`)
    const end = new Date(`${args.endDate}T00:00:00Z`)
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date range.')
    }

    const dayCount =
      Math.floor((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const totalShiftCount = dayCount * clients.length
    if (totalShiftCount > MAX_BULK_SHIFTS) {
      throw new Error(`Bulk schedule is limited to ${MAX_BULK_SHIFTS} shifts.`)
    }

    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      for (const client of clients) {
        const scheduledStart = `${date}T${args.startTime}:00Z`
        const scheduledEnd = `${date}T${args.endTime}:00Z`
        const shiftId = await ctx.db.insert('shifts', {
          tenantId,
          clientId: client._id,
          caregiverId: args.caregiverId,
          scheduledStart,
          scheduledEnd,
          status: initialShiftStatusForStart(scheduledStart),
          serviceType: client.serviceType,
          rate: args.rate,
        })

        await ctx.db.insert('progressNotes', {
          tenantId,
          shiftId,
          startTime: '',
          endTime: '',
          servicesProvided: '',
          clientResponse: '',
          narrative: '',
        })

        await ctx.db.insert('shiftTasks', {
          tenantId,
          shiftId,
          title: DEFAULT_REQUIRED_PROOF_TASK,
          requiredProof: true,
          status: 'pending',
        })

        createdShiftIds.push(shiftId)
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return { created: createdShiftIds.length, shiftIds: createdShiftIds }
  },
})

export const startDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only start their assigned shifts.')
    }

    if (shift.status !== 'scheduled') {
      throw new Error('Only scheduled shifts can be opened for documentation.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be documented before their scheduled start.',
      )
    }

    await ctx.db.patch(args.shiftId, { status: 'in_progress' })

    await ctx.runMutation(internal.audit.record, {
      clerkOrgId: args.clerkOrgId,
      action: 'shift_started',
      shiftId: args.shiftId,
      previousStatus: 'scheduled',
      nextStatus: 'in_progress',
    })

    return args.shiftId
  },
})

export const updateProgressNote = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    servicesProvided: v.optional(v.string()),
    clientResponse: v.optional(v.string()),
    narrative: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver', 'org:coordinator', 'org:admin'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only update their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be updated.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const note = await loadProgressNote(ctx, tenantId, args.shiftId)
    const patch: Record<string, string> = {}
    if (args.startTime !== undefined) patch.startTime = args.startTime
    if (args.endTime !== undefined) patch.endTime = args.endTime
    if (args.servicesProvided !== undefined) {
      patch.servicesProvided = args.servicesProvided
    }
    if (args.clientResponse !== undefined) patch.clientResponse = args.clientResponse
    if (args.narrative !== undefined) patch.narrative = args.narrative

    await ctx.db.patch(note._id, patch)
    return note._id
  },
})

export const submitDocumentation = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    note: v.object({
      startTime: v.string(),
      endTime: v.string(),
      servicesProvided: v.string(),
      clientResponse: v.string(),
      narrative: v.string(),
    }),
    tasks: v.array(
      v.object({
        taskId: v.id('shiftTasks'),
        status: v.union(v.literal('pending'), v.literal('complete')),
        proofUrl: v.optional(v.string()),
        proofName: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:caregiver',
      'org:coordinator',
      'org:admin',
    ])

    return submitShift(ctx, args, { subject: identity.subject, role })
  },
})

export const clockIn = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock in to their assigned shifts.')
    }

    if (!isScheduledStartDue(shift.scheduledStart)) {
      throw new Error(
        'Future shifts cannot be clocked in before their scheduled start.',
      )
    }

    if (shift.status !== 'scheduled' && shift.status !== 'in_progress') {
      throw new Error(
        'This shift has already been submitted or completed and cannot be clocked in again.',
      )
    }

    const existing = await findPunch(ctx, tenantId, args.shiftId, 'clock_in')
    if (existing) {
      return { punchId: existing._id, clockInAt: shift.clockInAt }
    }

    const punchId = await recordClockPunch(ctx, {
      clerkOrgId: args.clerkOrgId,
      shiftId: args.shiftId,
      caregiverId: shift.caregiverId,
      punchType: 'clock_in',
      location: args.location,
    })

    const now = new Date().toISOString()
    await ctx.db.patch(args.shiftId, {
      status: 'in_progress',
      clockInAt: now,
    })

    return { punchId, clockInAt: now }
  },
})

export const clockOut = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    location: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracyMeters: v.number(),
      }),
    ),
    note: v.optional(
      v.object({
        startTime: v.string(),
        endTime: v.string(),
        servicesProvided: v.string(),
        clientResponse: v.string(),
        narrative: v.string(),
      }),
    ),
    tasks: v.optional(
      v.array(
        v.object({
          taskId: v.id('shiftTasks'),
          status: v.union(v.literal('pending'), v.literal('complete')),
          proofUrl: v.optional(v.string()),
          proofName: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      args.clerkOrgId,
      ['org:caregiver'],
    )

    const shift = await loadShift(ctx, tenantId, args.shiftId)

    if (shift.caregiverId !== identity.subject) {
      throw new Error('Caregivers can only clock out of their assigned shifts.')
    }

    if (shift.status !== 'in_progress' && shift.status !== 'needs_correction') {
      throw new Error('Only in-progress or corrected shifts can be clocked out.')
    }

    await assertClockInPunchExists(ctx, tenantId, args.shiftId)

    const existingTasks = await loadShiftTasks(ctx, tenantId, args.shiftId)
    const note = args.note ??
      (await loadProgressNote(ctx, tenantId, args.shiftId))
    const mergedTasks = args.tasks
      ? mergeTaskUpdates(existingTasks, args.tasks)
      : existingTasks
    const blockers = validateShiftDocumentation(note, mergedTasks)
    if (blockers.length > 0) {
      throw new Error(`Incomplete documentation: ${blockers.join(' ')}`)
    }

    const existingClockOut = await findPunch(
      ctx,
      tenantId,
      args.shiftId,
      'clock_out',
    )

    let punchId: Id<'timePunches'>
    let clockOutAt: string

    if (existingClockOut) {
      punchId = existingClockOut._id
      clockOutAt = shift.clockOutAt ?? existingClockOut.at
    } else {
      const locationEvidence = await validateClockPunchLocation(
        ctx,
        tenantId,
        shift,
        args.location,
        'clock_out',
      )

      const now = new Date().toISOString()

      punchId = await ctx.db.insert('timePunches', {
        tenantId,
        shiftId: args.shiftId,
        caregiverId: shift.caregiverId,
        punchType: 'clock_out',
        at: now,
        source: 'atriax',
        location: locationEvidence,
        adpSyncStatus: 'pending_credentials',
        createdAt: now,
      })

      await ctx.runMutation(internal.audit.record, {
        clerkOrgId: args.clerkOrgId,
        action: 'shift_clocked_out',
        shiftId: args.shiftId,
        metadata: {
          punchId: punchId as string,
          withinGeofence: locationEvidence?.withinGeofence ?? null,
          distanceMeters: locationEvidence?.distanceMeters ?? null,
        },
      })

      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
        timePunchId: punchId,
      })

      await ctx.db.patch(args.shiftId, { clockOutAt: now })
      clockOutAt = now
    }

    await submitShift(
      ctx,
      {
        clerkOrgId: args.clerkOrgId,
        shiftId: args.shiftId,
        note: {
          startTime: note.startTime,
          endTime: note.endTime,
          servicesProvided: note.servicesProvided,
          clientResponse: note.clientResponse,
          narrative: note.narrative,
        },
        tasks: mergedTasks.map((task) => ({
          taskId: task._id,
          status: task.status,
          proofUrl: task.proofUrl,
          proofName: task.proofName,
        })),
      },
      { subject: identity.subject, role },
    )

    return { punchId, clockOutAt }
  },
})

export const updateServiceLocationOverride = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    serviceLocationOverride: v.optional(
      v.object({
        label: v.string(),
        addressLine: v.optional(v.string()),
        latitude: v.number(),
        longitude: v.number(),
        radiusMeters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    await loadShift(ctx, tenantId, args.shiftId)

    if (args.serviceLocationOverride !== undefined) {
      if (
        !Number.isFinite(args.serviceLocationOverride.latitude) ||
        args.serviceLocationOverride.latitude < -90 ||
        args.serviceLocationOverride.latitude > 90
      ) {
        throw new Error('latitude must be between -90 and 90.')
      }

      if (
        !Number.isFinite(args.serviceLocationOverride.longitude) ||
        args.serviceLocationOverride.longitude < -180 ||
        args.serviceLocationOverride.longitude > 180
      ) {
        throw new Error('longitude must be between -180 and 180.')
      }

      if (
        args.serviceLocationOverride.radiusMeters !== undefined &&
        (!Number.isFinite(args.serviceLocationOverride.radiusMeters) ||
          args.serviceLocationOverride.radiusMeters <= 0)
      ) {
        throw new Error('radiusMeters must be greater than zero.')
      }
    }

    await ctx.db.patch(args.shiftId, {
      serviceLocationOverride: args.serviceLocationOverride,
    })

    return args.shiftId
  },
})

export const updateStatus = mutation({
  args: {
    clerkOrgId: v.string(),
    shiftId: v.id('shifts'),
    status: v.union(v.literal('scheduled'), v.literal('in_progress')),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const shift = await ctx.db.get(args.shiftId)
    if (!shift) throw new Error('Shift not found.')
    assertTenantDoc(shift, tenantId)

    await ctx.db.patch(args.shiftId, { status: args.status })
    return args.shiftId
  },
})


 succeeded in 715ms:
'use node'

import { v } from 'convex/values'
import { internalAction, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { getSharedMockAdp } from './integrations/adp/mockAdp'
import { NotConfiguredError } from './integrations/adp/errors'
import type { AdpPort } from './integrations/adp/adpPort'
import {
  chooseRetryDelayMs,
  idempotencyKey,
  normalizeEmail,
  sanitizeError,
} from './adpSync'

declare const process: { env: Record<string, string | undefined> }

const MAX_ATTEMPTS = 5

async function getAdpPort(): Promise<AdpPort> {
  if (process.env.ADP_MOCK_ADAPTER === 'true') {
    return getSharedMockAdp()
  }
  const { AdpClient } = await import('./integrations/adp/adpClient')
  return new AdpClient()
}

async function patchEvent(
  ctx: ActionCtx,
  eventId: Id<'integrationEvents'>,
  patch: {
    status: string
    response?: unknown
    completedAt?: string
    nextRetryAt?: string
  },
) {
  await ctx.runMutation(internal.adpSync.patchIntegrationEvent, {
    eventId,
    ...patch,
  })
}

export const adpSyncPunch = internalAction({
  args: { timePunchId: v.id('timePunches') },
  handler: async (ctx: ActionCtx, { timePunchId }) => {
    const punch = await ctx.runQuery(internal.adpSync.loadPunchForAdpSync, {
      timePunchId,
    })
    const tenantId = punch.tenantId

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const profile = await ctx.runQuery(
      internal.adpSync.findEmployeeProfileByClerkUserId,
      { tenantId, clerkUserId: punch.caregiverId },
    )

    if (!profile || !profile.adpAssociateOid) {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Caregiver employee profile or ADP associate OID missing.',
      })
      return { status: 'error' }
    }

    const key = idempotencyKey('punch', timePunchId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'punch',
        refId: timePunchId as string,
        idempotencyKey: key,
        request: {
          timePunchId: timePunchId as string,
          punchType: punch.punchType,
          associateOID: profile.adpAssociateOid,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.postPunch({
        idempotencyKey: key,
        timePunchId: timePunchId as string,
        associateOID: profile.adpAssociateOid,
        punchType: punch.punchType,
        at: punch.at,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: 'synced',
        adpPunchId: result.punchId,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: { adpPunchId: result.punchId },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpPunchId: result.punchId }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchPunchAdpStatus, {
        timePunchId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncPunch,
          { timePunchId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpSyncWorker = internalAction({
  args: { employeeProfileId: v.id('employeeProfiles') },
  handler: async (ctx: ActionCtx, { employeeProfileId }) => {
    const profile = await ctx.runQuery(
      internal.adpSync.loadEmployeeProfileForAdpSync,
      { employeeProfileId },
    )
    const tenantId = profile.tenantId

    if (profile.adpAssociateOid) {
      if (profile.adpSyncStatus !== 'synced') {
        await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
          employeeProfileId,
          tenantId,
          adpSyncStatus: 'synced',
        })
      }
      return { status: 'already_synced' }
    }

    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'pending_credentials',
      })
      return { status: 'pending_credentials' }
    }

    const key = idempotencyKey('worker', employeeProfileId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'worker',
        refId: employeeProfileId as string,
        idempotencyKey: key,
        request: {
          employeeProfileId: employeeProfileId as string,
          displayName: profile.displayName,
          email: profile.email,
        },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
      })
      return { status: 'already_synced' }
    }

    if (claim.type === 'in_flight') {
      return { status: 'in_flight' }
    }

    if (claim.type === 'max_attempts') {
      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'error',
        adpError: 'Max ADP sync attempts exceeded.',
      })
      return { status: 'max_attempts' }
    }

    try {
      const port = await getAdpPort()
      const result = await port.createWorker({
        idempotencyKey: key,
        employeeProfileId: employeeProfileId as string,
        displayName: profile.displayName,
        email: profile.email,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: 'synced',
        adpAssociateOid: result.associateOID,
        adpWorkerId: result.workerID,
      })

      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: {
          adpAssociateOid: result.associateOID,
          adpWorkerId: result.workerID,
        },
        completedAt: new Date().toISOString(),
      })

      return { status: 'synced', adpAssociateOid: result.associateOID }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      await ctx.runMutation(internal.adpSync.patchWorkerAdpStatus, {
        employeeProfileId,
        tenantId,
        adpSyncStatus: syncStatus,
        adpError,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpSyncWorker,
          { employeeProfileId },
        )
      }

      return { status: syncStatus, error: adpError }
    }
  },
})

export const adpInitialWorkerLoad = internalAction({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: ActionCtx, { tenantId }) => {
    const configured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId },
    )
    if (!configured) {
      return {
        status: 'pending_credentials',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    const key = idempotencyKey('initial_worker_load', tenantId as string)
    const claim = await ctx.runMutation(
      internal.adpSync.claimIntegrationEvent,
      {
        tenantId,
        kind: 'initial_worker_load',
        refId: tenantId as string,
        idempotencyKey: key,
        request: { tenantId: tenantId as string },
        maxAttempts: MAX_ATTEMPTS,
      },
    )

    if (claim.type === 'already_synced') {
      const response = claim.response as
        | { processed: number; matched: number; created: number; errors: number }
        | undefined
      return {
        status: 'already_synced',
        processed: response?.processed ?? 0,
        matched: response?.matched ?? 0,
        created: response?.created ?? 0,
        errors: response?.errors ?? 0,
      }
    }

    if (claim.type === 'in_flight') {
      return {
        status: 'in_flight',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    if (claim.type === 'max_attempts') {
      return {
        status: 'max_attempts',
        processed: 0,
        matched: 0,
        created: 0,
        errors: 0,
      }
    }

    try {
      const profiles = (await ctx.runQuery(
        internal.adpSync.findEmployeeProfilesByTenant,
        { tenantId },
      )) as Doc<'employeeProfiles'>[]

      const profilesByEmail = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          normalizeEmail(p.email),
          p,
        ]),
      )
      const profilesByName = new Map(
        profiles.map((p: Doc<'employeeProfiles'>) => [
          p.displayName.trim(),
          p,
        ]),
      )
      const profilesByAoid = new Map(
        profiles
          .filter(
            (p: Doc<'employeeProfiles'>): p is Doc<'employeeProfiles'> & {
              adpAssociateOid: string
            } => Boolean(p.adpAssociateOid),
          )
          .map((p: Doc<'employeeProfiles'> & { adpAssociateOid: string }) => [
            p.adpAssociateOid,
            p,
          ]),
      )

      const port = await getAdpPort()
      let cursor: string | undefined
      let processed = 0
      let matched = 0
      let created = 0
      let errors = 0

      do {
        const page = await port.listWorkers(cursor)
        for (const worker of page.workers) {
          processed++

          if (!worker.associateOID || !worker.displayName.trim()) {
            errors++
            continue
          }

          try {
            const email = worker.email
              ? normalizeEmail(worker.email)
              : undefined
            const matchByAoid = worker.associateOID
              ? profilesByAoid.get(worker.associateOID)
              : undefined
            const matchByEmail = email
              ? profilesByEmail.get(email)
              : undefined
            const matchByName = profilesByName.get(worker.displayName.trim())
            const match = matchByAoid ?? matchByEmail ?? matchByName

            await ctx.runMutation(
              internal.adpSync.upsertMatchedEmployeeProfile,
              {
                tenantId,
                associateOID: worker.associateOID,
                workerID: worker.workerID,
                displayName: worker.displayName,
                email: email ?? worker.displayName,
                matchProfileId: match?._id,
              },
            )

            if (match) matched++
            else created++
          } catch (workerError) {
            errors++
            console.error('ADP worker load failed for a record:', workerError)
          }
        }
        cursor = page.nextCursor
      } while (cursor)

      const result = { processed, matched, created, errors }
      await patchEvent(ctx, claim.eventId, {
        status: 'success',
        response: result,
        completedAt: new Date().toISOString(),
      })

      return { status: 'success', ...result }
    } catch (error) {
      const isNotConfigured = error instanceof NotConfiguredError
      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
      const adpError = sanitizeError(error)
      const nextRetryAt =
        !isNotConfigured && claim.attempt < MAX_ATTEMPTS
          ? new Date(
              Date.now() + chooseRetryDelayMs(claim.attempt),
            ).toISOString()
          : undefined

      await patchEvent(ctx, claim.eventId, {
        status: syncStatus,
        response: { error: adpError },
        completedAt: new Date().toISOString(),
        nextRetryAt,
      })

      if (!isNotConfigured && claim.attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          chooseRetryDelayMs(claim.attempt),
          internal.adpOutbound.adpInitialWorkerLoad,
          { tenantId },
        )
      }

      return { status: syncStatus, error: adpError, errors: 0 }
    }
  },
})


 succeeded in 785ms:
import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import { adpEnvVarNames, isAdpConfigured } from './integrations/adp/config'

type ClaimResult =
  | {
      type: 'already_synced'
      eventId: Id<'integrationEvents'>
      response?: unknown
    }
  | { type: 'in_flight'; eventId: Id<'integrationEvents'> }
  | { type: 'max_attempts'; attempt: number }
  | { type: 'claimed'; eventId: Id<'integrationEvents'>; attempt: number }

const RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]
const IN_FLIGHT_STALE_MS = 5 * 60 * 1000

const adpPunchSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
)

const adpEmployeeSyncStatus = v.union(
  v.literal('pending_credentials'),
  v.literal('queued'),
  v.literal('synced'),
  v.literal('error'),
  v.literal('matched'),
  v.literal('created'),
)

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return redactSecrets(message.slice(0, 500))
}

function redactSecrets(message: string): string {
  let redacted = message

  for (const name of adpEnvVarNames()) {
    const value = process.env[name]?.trim()
    if (value) {
      redacted = redacted.split(value).join(`[REDACTED:${name}]`)
    }
  }

  redacted = redacted.replace(
    /Basic\s+[A-Za-z0-9+/=]{10,}/g,
    'Basic [REDACTED]',
  )
  redacted = redacted.replace(
    /Bearer\s+[A-Za-z0-9_\-./=]{10,}/g,
    'Bearer [REDACTED]',
  )
  redacted = redacted.replace(
    /(token['"]?\s*[:=]\s*)['"]?[A-Za-z0-9_\-./=]{8,}['"]?/gi,
    '$1[REDACTED]',
  )

  return redacted
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function idempotencyKey(kind: string, refId: string): string {
  return `${kind}:${refId}`
}

export function chooseRetryDelayMs(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length) - 1]
}

export const loadPunchForAdpSync = internalQuery({
  args: { timePunchId: v.id('timePunches') },
  handler: async (ctx: QueryCtx, { timePunchId }) => {
    const punch = await ctx.db.get(timePunchId)
    if (!punch) throw new Error('Time punch not found.')
    return punch
  },
})

export const loadEmployeeProfileForAdpSync = internalQuery({
  args: { employeeProfileId: v.id('employeeProfiles') },
  handler: async (ctx: QueryCtx, { employeeProfileId }) => {
    const profile = await ctx.db.get(employeeProfileId)
    if (!profile) throw new Error('Employee profile not found.')
    return profile
  },
})

export const findEmployeeProfileByClerkUserId = internalQuery({
  args: { tenantId: v.id('tenants'), clerkUserId: v.string() },
  handler: async (ctx: QueryCtx, { tenantId, clerkUserId }) => {
    return ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant_clerk_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', clerkUserId),
      )
      .unique()
  },
})

export const findEmployeeProfilesByTenant = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: QueryCtx, { tenantId }) => {
    return ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
  },
})

export const isAdpConfiguredForTenant = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx: QueryCtx, { tenantId }) => {
    return isAdpConfigured(ctx, tenantId)
  },
})

export const patchPunchAdpStatus = internalMutation({
  args: {
    timePunchId: v.id('timePunches'),
    tenantId: v.id('tenants'),
    adpSyncStatus: adpPunchSyncStatus,
    adpPunchId: v.optional(v.string()),
    adpError: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const punch = await ctx.db.get(args.timePunchId)
    if (!punch) throw new Error('Time punch not found.')
    assertTenantDoc(punch, args.tenantId)

    const patch: {
      adpSyncStatus: 'pending_credentials' | 'queued' | 'synced' | 'error'
      adpPunchId?: string
      adpError?: string
    } = { adpSyncStatus: args.adpSyncStatus }
    if (args.adpPunchId !== undefined) patch.adpPunchId = args.adpPunchId
    if (args.adpError !== undefined || args.adpSyncStatus === 'synced') {
      patch.adpError = args.adpError
    }
    await ctx.db.patch(args.timePunchId, patch)
  },
})

export const patchWorkerAdpStatus = internalMutation({
  args: {
    employeeProfileId: v.id('employeeProfiles'),
    tenantId: v.id('tenants'),
    adpSyncStatus: adpEmployeeSyncStatus,
    adpAssociateOid: v.optional(v.string()),
    adpWorkerId: v.optional(v.string()),
    adpError: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const profile = await ctx.db.get(args.employeeProfileId)
    if (!profile) throw new Error('Employee profile not found.')
    assertTenantDoc(profile, args.tenantId)

    const isSuccessStatus =
      args.adpSyncStatus === 'synced' ||
      args.adpSyncStatus === 'matched' ||
      args.adpSyncStatus === 'created'

    const patch: {
      adpSyncStatus:
        | 'pending_credentials'
        | 'queued'
        | 'synced'
        | 'error'
        | 'matched'
        | 'created'
      adpAssociateOid?: string
      adpWorkerId?: string
      adpError?: string
    } = { adpSyncStatus: args.adpSyncStatus }
    if (args.adpAssociateOid !== undefined) {
      patch.adpAssociateOid = args.adpAssociateOid
    }
    if (args.adpWorkerId !== undefined) patch.adpWorkerId = args.adpWorkerId
    if (args.adpError !== undefined || isSuccessStatus) {
      patch.adpError = args.adpError
    }
    await ctx.db.patch(args.employeeProfileId, patch)
  },
})

export const upsertMatchedEmployeeProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    associateOID: v.string(),
    workerID: v.optional(v.string()),
    displayName: v.string(),
    email: v.string(),
    matchProfileId: v.optional(v.id('employeeProfiles')),
  },
  handler: async (ctx: MutationCtx, args) => {
    if (args.matchProfileId) {
      const match = await ctx.db.get(args.matchProfileId)
      if (!match) throw new Error('Employee profile not found.')
      assertTenantDoc(match, args.tenantId)
      await ctx.db.patch(args.matchProfileId, {
        adpAssociateOid: args.associateOID,
        adpWorkerId: args.workerID,
        adpSyncStatus: 'matched',
      })
      return args.matchProfileId
    }

    return ctx.db.insert('employeeProfiles', {
      tenantId: args.tenantId,
      displayName: args.displayName,
      email: args.email,
      adpAssociateOid: args.associateOID,
      adpWorkerId: args.workerID,
      adpSyncStatus: 'created',
      createdAt: new Date().toISOString(),
    })
  },
})

export const claimIntegrationEvent = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    kind: v.string(),
    refId: v.string(),
    idempotencyKey: v.string(),
    request: v.optional(v.any()),
    maxAttempts: v.number(),
  },
  handler: async (ctx: MutationCtx, args): Promise<ClaimResult> => {
    const events = await ctx.db
      .query('integrationEvents')
      .withIndex('by_tenant_idemp', (q) =>
        q.eq('tenantId', args.tenantId).eq('idempotencyKey', args.idempotencyKey),
      )
      .order('desc')
      .collect()

    for (const event of events) {
      if (event.status === 'success') {
        return {
          type: 'already_synced',
          eventId: event._id,
          response: event.response,
        }
      }
      if (event.status === 'attempting') {
        const createdAt = new Date(event.createdAt).getTime()
        if (Date.now() - createdAt < IN_FLIGHT_STALE_MS) {
          return { type: 'in_flight', eventId: event._id }
        }
      }
    }

    const latestAttempt = events.find((e) => typeof e.attempt === 'number')
    const attempt = (latestAttempt?.attempt ?? 0) + 1
    if (attempt > args.maxAttempts) {
      return { type: 'max_attempts', attempt }
    }

    const eventId = await ctx.db.insert('integrationEvents', {
      tenantId: args.tenantId,
      provider: 'adp',
      kind: args.kind,
      refId: args.refId,
      idempotencyKey: args.idempotencyKey,
      status: 'attempting',
      attempt,
      request: args.request,
      createdAt: new Date().toISOString(),
    })

    return { type: 'claimed', eventId, attempt }
  },
})

export const patchIntegrationEvent = internalMutation({
  args: {
    eventId: v.id('integrationEvents'),
    status: v.string(),
    response: v.optional(v.any()),
    completedAt: v.optional(v.string()),
    nextRetryAt: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await ctx.db.patch(args.eventId, {
      status: args.status,
      response: args.response,
      completedAt: args.completedAt,
      nextRetryAt: args.nextRetryAt,
    })
  },
})

export const triggerInitialWorkerLoad = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
    ])
    await ctx.scheduler.runAfter(
      0,
      internal.adpOutbound.adpInitialWorkerLoad,
      { tenantId },
    )
    return { status: 'queued' }
  },
})

export const adpSyncStatusLiterals = {
  adpPunchSyncStatus,
  adpEmployeeSyncStatus,
}

export type AdpPunchSyncStatus =
  | 'pending_credentials'
  | 'queued'
  | 'synced'
  | 'error'

export type AdpEmployeeSyncStatus =
  | 'pending_credentials'
  | 'queued'
  | 'synced'
  | 'error'
  | 'matched'
  | 'created'


 succeeded in 985ms:
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\adpClient.test.ts
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\adpClient.ts
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\adpPort.ts
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\config.ts
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\errors.ts
C:\Users\pinol\Documents\Work\atriax\solid-pancake\convex\integrations\adp\mockAdp.ts

codex
Iâ€™m continuing through the backend path because the task is security-sensitive: ADP events must not leak credentials or location evidence, and tenant-scoped Convex functions must stay behind auth helpers.
2026-06-26T23:08:12.505430Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\phase1-lifecycle.spec.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
2026-06-26T23:08:12.510278Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'convex\\seed.ts' | ForEach-Object { "'$i++; if ($i -ge 310 -and $i -le 470) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'convex\\seed.ts' | ForEach-Object { "'$i++; if ($i -ge 310 -and $i -le 470) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\phase1-lifecycle.spec.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\helpers\\auth.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 80) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\phase1-lifecycle.spec.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 180) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'.hermes-pipeline\\20260626_161701\\summary.md' | ForEach-Object { "'$i++; if ($i -ge 20 -and $i -le 45) { '"'{0,4}: {1}' -f "'$i, $_ } }' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'convex\\seed.ts' | ForEach-Object { "'$i++; if ($i -ge 310 -and $i -le 470) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
2026-06-26T23:08:12.518637Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\helpers\\auth.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 80) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'tests\\e2e\\helpers\\auth.ts' | ForEach-Object { "'$i++; if ($i -ge 1 -and $i -le 80) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'.hermes-pipeline\\20260626_161701\\summary.md' | ForEach-Object { "'$i++; if ($i -ge 20 -and $i -le 45) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
2026-06-26T23:08:12.521114Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command '$i=0; Get-Content -LiteralPath '"'.hermes-pipeline\\20260626_161701\\summary.md' | ForEach-Object { "'$i++; if ($i -ge 20 -and $i -le 45) { '"'{0,4}: {1}' -f "'$i, $_ } }'` rejected: blocked by policy
codex
The shell blocked my first line-number formatting command, so Iâ€™m switching to `rg -n` for concise, policy-safe references.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"e2e-admin|e2e-coordinator|e2e-caregiver|caregiverId: 'e2e-caregiver'|geofence-enabled\" convex/seed.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"skipIfNoE2ECredentials|test\\.skip|E2E Clerk credentials\" tests/e2e/helpers/auth.ts tests/e2e/phase1-lifecycle.spec.ts tests/e2e/geofence.spec.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "Convex codegen|E2E tests|FAIL|skipped|PASS" .hermes-pipeline/20260626_161701/summary.md' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"shift-status-badge|review-status-badge|toHaveClass|toHaveText\\('UPCOMING'|billing-ready|billing ready|billing_ready\" tests/e2e/phase1-lifecycle.spec.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 693ms:
521:        clerkUserId: 'e2e-admin',
524:        email: 'e2e-admin@atriax.test',
527:        clerkUserId: 'e2e-coordinator',
530:        email: 'e2e-coordinator@atriax.test',
533:        clerkUserId: 'e2e-caregiver',
536:        email: 'e2e-caregiver@atriax.test',
639:        caregiverId: 'e2e-caregiver',
698:        caregiverId: 'e2e-caregiver',

 succeeded in 711ms:
tests/e2e/geofence.spec.ts:10:  skipIfNoE2ECredentials,
tests/e2e/geofence.spec.ts:18:skipIfNoE2ECredentials(test)
tests/e2e/phase1-lifecycle.spec.ts:10:  skipIfNoE2ECredentials,
tests/e2e/phase1-lifecycle.spec.ts:16:skipIfNoE2ECredentials(test)
tests/e2e/helpers/auth.ts:23:export function skipIfNoE2ECredentials(test: typeof base) {
tests/e2e/helpers/auth.ts:26:      test.skip(true, 'E2E Clerk credentials are not configured')

 succeeded in 742ms:
39:| Convex codegen | `npx convex codegen` | **FAIL** | Environment has `CONVEX_DEPLOY_KEY` set; Convex codegen refuses to run against a deployment-only environment. Only `seedE2E` was added; no existing API signatures changed, so generated code remains valid for existing functions. |
40:| Lint | `npm run lint` | **PASS** | 0 errors after adding necessary ignores. |
41:| Typecheck | `npm run typecheck` | **PASS** | 0 errors. |
42:| Unit tests | `npm run test` | **PASS** | 37 files, 276 tests passing. |
43:| E2E tests | `npm run e2e` | **PASS** | 4 existing smoke tests passed; 5 new tests skipped because `E2E_CLERK_ORG_ID` / test-account credentials are not configured in this environment. |
50:- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
51:- `E2E_CAREGIVER_EMAIL` / `E2E_CAREGIVER_PASSWORD`
52:- `E2E_COORDINATOR_EMAIL` / `E2E_COORDINATOR_PASSWORD`

 succeeded in 741ms:
33:  const statusBadge = shiftCard.locator('[data-testid="shift-status-badge"]')
34:  await expect(statusBadge).toHaveText('UPCOMING')
35:  await expect(statusBadge).toHaveClass(/variant-info|bg-atria-info/)
106:  const reviewStatus = reviewRow.locator('[data-testid="review-status-badge"]')
108:  await expect(reviewStatus).toHaveClass(/variant-info|bg-atria-info/)
118:  await expect(reviewStatus).toHaveClass(/variant-danger|bg-atria-danger/)
127:  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveText('CORRECTION')
142:  // ---- Coordinator: approve -> billing ready ----
150:  await expect(resubmittedRow.locator('[data-testid="review-status-badge"]')).toHaveText('Submitted')
160:  const approvedStatus = approvedRow.locator('[data-testid="review-status-badge"]')
162:  await expect(approvedStatus).toHaveClass(/variant-success|bg-atria-success/)

codex
The lifecycle spec also appears to miss parts of the required assertion surface: it only checks some status labels/colors and never observes Clock Out in the disabled state before the note is complete. Iâ€™m checking the UI mappings now to separate test gaps from actual product regressions.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\shared\\ui\\StatusBadge.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "shift-status-badge|review-status-badge|status.*billing|billing_ready|Approved|UPCOMING|CORRECTION|variant" src/features/caregiver src/features/coordinator src/shared/ui/StatusBadge.tsx' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\coordinator\\pages\\CoordinatorReviewPage.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\pages\\CaregiverTodayPage.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 743ms:
import type { PropsWithChildren } from 'react'
import type { ShiftStatus } from '@/shared/domain/types'
import { formatStatusLabel } from '@/shared/format'
import { cn } from '@/shared/utils/cn'

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const statusVariantMap: Record<ShiftStatus, StatusBadgeVariant> = {
  scheduled: 'neutral',
  in_progress: 'info',
  submitted: 'warning',
  needs_correction: 'danger',
  approved: 'success',
  billing_ready: 'info',
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  neutral:
    'border-atria-border-strong bg-atria-neutral-bg text-atria-neutral',
  info:
    'border-atria-info/30 bg-atria-info-bg text-atria-info',
  warning:
    'border-atria-warning/30 bg-atria-warning-bg text-atria-warning',
  danger:
    'border-atria-danger/30 bg-atria-danger-bg text-atria-danger',
  success:
    'border-atria-success/30 bg-atria-success-bg text-atria-success',
}

const variantLabels: Record<StatusBadgeVariant, string> = {
  neutral: 'Neutral',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  success: 'Success',
}

type StatusBadgeProps = {
  status?: ShiftStatus
  variant?: StatusBadgeVariant
  className?: string
}

export function StatusBadge({
  status,
  variant,
  className,
  children,
}: PropsWithChildren<StatusBadgeProps>) {
  const resolvedVariant = variant ?? (status ? statusVariantMap[status] : 'neutral')
  const label =
    children ?? (status ? formatStatusLabel(status) : variantLabels[resolvedVariant])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-atria-sm)] border px-2 py-1 text-xs font-semibold',
        variantClasses[resolvedVariant],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}


 succeeded in 746ms:
src/shared/ui/StatusBadge.tsx:14:  billing_ready: 'info',
src/shared/ui/StatusBadge.tsx:17:const variantClasses: Record<StatusBadgeVariant, string> = {
src/shared/ui/StatusBadge.tsx:30:const variantLabels: Record<StatusBadgeVariant, string> = {
src/shared/ui/StatusBadge.tsx:40:  variant?: StatusBadgeVariant
src/shared/ui/StatusBadge.tsx:46:  variant,
src/shared/ui/StatusBadge.tsx:50:  const resolvedVariant = variant ?? (status ? statusVariantMap[status] : 'neutral')
src/shared/ui/StatusBadge.tsx:52:    children ?? (status ? formatStatusLabel(status) : variantLabels[resolvedVariant])
src/shared/ui/StatusBadge.tsx:58:        variantClasses[resolvedVariant],
src/features/coordinator\pages\CoordinatorReviewPage.tsx:85:        buildRow(shift, 'Approved', 'success'),
src/features/coordinator\pages\CoordinatorReviewPage.tsx:153:          label="Approved"
src/features/coordinator\pages\CoordinatorReviewPage.tsx:214:                  <Badge variant={row.statusVariant} data-testid="review-status-badge">{row.statusLabel}</Badge>
src/features/caregiver\pages\CaregiverTodayPage.tsx:94:                    <StatusBadge status={shift.status} data-testid="shift-status-badge" />
src/features/caregiver\pages\CaregiverTodayPage.tsx:122:                  variant="primary"
src/features/caregiver\pages\CaregiverTodayPage.tsx:148:                variant="ghost"
src/features/caregiver\pages\CaregiverTodayPage.tsx:180:  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
src/features/caregiver\pages\CaregiverTodayPage.tsx:181:    scheduled: { label: 'UPCOMING', variant: 'info' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:182:    in_progress: { label: 'IN PROGRESS', variant: 'warning' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:183:    submitted: { label: 'SUBMITTED', variant: 'info' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:184:    needs_correction: { label: 'CORRECTION', variant: 'danger' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:185:    approved: { label: 'APPROVED', variant: 'success' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:186:    billing_ready: { label: 'BILLING READY', variant: 'success' },
src/features/caregiver\pages\CaregiverTodayPage.tsx:188:  const config = map[status] ?? { label: status.toUpperCase(), variant: 'default' as const }
src/features/caregiver\pages\CaregiverTodayPage.tsx:190:    <Badge variant={config.variant} data-testid={testId}>
src/features/coordinator\components\ReviewHistory.tsx:62:    const isApproved = review.decision === 'approved'
src/features/coordinator\components\ReviewHistory.tsx:65:      icon: isApproved ? (
src/features/coordinator\components\ReviewHistory.tsx:70:      iconClass: isApproved
src/features/coordinator\components\ReviewHistory.tsx:73:      title: isApproved ? 'Approved' : 'Correction requested',
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:42:  status?: 'submitted' | 'needs_correction' | 'billing_ready'
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:132:          status: 'billing_ready',
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:158:    await userEvent.click(screen.getByRole('button', { name: /Approved/i }))
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:161:      expect(screen.getByText('Approved')).toBeInTheDocument()
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:169:          status: 'billing_ready',
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:181:    const approvedTab = screen.getByRole('button', { name: /Approved/i })
src/features/coordinator\pages\CoordinatorReviewPage.test.tsx:185:      expect(screen.getByText('Approved')).toBeInTheDocument()
src/features/caregiver\components\ShiftClockInScreen.tsx:88:        variant="primary"
src/features/coordinator\components\ReviewDetail.test.tsx:45:  status?: 'submitted' | 'needs_correction' | 'billing_ready'
src/features/coordinator\components\ReviewDetail.tsx:58:    shift.status === 'submitted' || shift.status === 'billing_ready'
src/features/coordinator\components\ReviewDetail.tsx:273:            variant={noProblems ? 'success' : 'warning'}
src/features/coordinator\components\ReviewDetail.tsx:433:        <Badge variant={task.status === 'complete' ? 'success' : 'warning'}>
src/features/coordinator\components\ReviewDetail.tsx:503:            variant="primary"
src/features/coordinator\components\ReviewDetail.tsx:519:            variant="secondary"
src/features/coordinator\components\ReviewDetail.tsx:573:  if (shiftStatus === 'billing_ready') {
src/features/coordinator\components\ReviewDetail.tsx:574:    return 'Approved and ready for billing.'
src/features/caregiver\components\ShiftClockOutScreen.tsx:61:      <Badge variant="success" className="h-8 px-3 text-sm">
src/features/caregiver\components\ShiftClockOutScreen.tsx:100:        variant="primary"
src/features/caregiver\components\ShiftDocumentationForm.tsx:44:  'billing_ready',
src/features/caregiver\components\ShiftDocumentationForm.tsx:393:          variant="secondary"
src/features/caregiver\components\ShiftDocumentationForm.tsx:404:          variant="primary"
src/features/caregiver\components\ShiftSuccessScreen.tsx:41:        <Button variant="primary" size="lg" className="w-full rounded-full" onClick={onHome}>
src/features/caregiver\components\ShiftTaskList.tsx:143:                          variant="ghost"

 succeeded in 721ms:
import { useOrganization } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ReviewDetail } from '../components/ReviewDetail'
import { ClipboardCheck, ArrowRight, Clock } from 'lucide-react'

type ReviewFilter = 'pending' | 'approved' | 'returned'

interface QueueRow {
  shift: Doc<'shifts'>
  caregiverName: string
  clientName: string
  statusLabel: string
  statusVariant: 'info' | 'danger' | 'success'
}

export function CoordinatorReviewPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const reviewShifts = useQuery(
    api.shiftQueries.listForReview,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const approvedShifts = useQuery(
    api.shiftQueries.listBillingReady,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const clients = useQuery(
    api.clients.list,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const caregivers = useQuery(
    api.members.listCaregivers,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )
  const [filter, setFilter] = useState<ReviewFilter>('pending')

  const isLoading =
    reviewShifts === undefined ||
    approvedShifts === undefined ||
    clients === undefined ||
    caregivers === undefined

  const { pendingRows, returnedRows, approvedRows } = useMemo(() => {
    const clientMap = new Map(clients?.map((c) => [c._id, c.displayName]) ?? [])
    const caregiverMap = new Map(
      caregivers?.map((c) => [c.clerkUserId, c.displayName]) ?? [],
    )

    const buildRow = (
      shift: Doc<'shifts'>,
      statusLabel: string,
      statusVariant: 'info' | 'danger' | 'success',
    ): QueueRow => ({
      shift,
      caregiverName:
        caregiverMap.get(shift.caregiverId) ?? 'Unknown caregiver',
      clientName: clientMap.get(shift.clientId) ?? 'Unknown client',
      statusLabel,
      statusVariant,
    })

    const pending =
      reviewShifts
        ?.filter((shift) => shift.status === 'submitted')
        .map((shift) => buildRow(shift, 'Submitted', 'info')) ?? []

    const returned =
      reviewShifts
        ?.filter((shift) => shift.status === 'needs_correction')
        .map((shift) => buildRow(shift, 'Needs correction', 'danger')) ?? []

    const approved =
      approvedShifts?.map((shift) =>
        buildRow(shift, 'Approved', 'success'),
      ) ?? []

    return { pendingRows: pending, returnedRows: returned, approvedRows: approved }
  }, [reviewShifts, approvedShifts, clients, caregivers])

  const visibleRows =
    filter === 'pending'
      ? pendingRows
      : filter === 'approved'
        ? approvedRows
        : returnedRows

  const selectedRow = useMemo(
    () =>
      visibleRows.find((row) => row.shift._id === selectedShiftId) ??
      pendingRows.find((row) => row.shift._id === selectedShiftId) ??
      returnedRows.find((row) => row.shift._id === selectedShiftId) ??
      approvedRows.find((row) => row.shift._id === selectedShiftId),
    [selectedShiftId, visibleRows, pendingRows, returnedRows, approvedRows],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-atria-muted">
          <Clock className="h-4 w-4 animate-spin" />
          Loading review queueÃ¢â‚¬Â¦
        </div>
      </div>
    )
  }

  if (selectedShiftId && selectedRow && clerkOrgId) {
    return (
      <ReviewDetail
        clerkOrgId={clerkOrgId}
        caregiverName={selectedRow.caregiverName}
        clientName={selectedRow.clientName}
        onBack={() => setSelectedShiftId(null)}
        shiftId={selectedShiftId}
      />
    )
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-atria-ink">
          Documentation to review
        </h1>
        <p className="text-base text-atria-muted">
          {pendingRows.length} shift note{pendingRows.length !== 1 ? 's' : ''}{' '}
          {pendingRows.length === 1 ? 'is' : 'are'} waiting for your review.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterTab
          active={filter === 'pending'}
          count={pendingRows.length}
          label="Pending"
          onClick={() => setFilter('pending')}
          data-testid="filter-pending"
        />
        <FilterTab
          active={filter === 'approved'}
          count={approvedRows.length}
          label="Approved"
          onClick={() => setFilter('approved')}
          data-testid="filter-approved"
        />
        <FilterTab
          active={filter === 'returned'}
          count={returnedRows.length}
          label="Returned"
          onClick={() => setFilter('returned')}
          data-testid="filter-returned"
        />
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 border-b border-atria-border px-6 py-3 text-xs font-semibold uppercase tracking-wider text-atria-muted">
            <div className="col-span-5">Caregiver & Client</div>
            <div className="col-span-4">Shift</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          <div className="divide-y divide-atria-border">
            {visibleRows.length === 0 && (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardCheck className="h-6 w-6" />}
                  title={`No ${filter} shifts`}
                  description={`There are no ${filter} documentation notes to display right now.`}
                />
              </div>
            )}

            {visibleRows.map((row) => (
              <div
                key={row.shift._id}
                className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-atria-surface-2/50"
                data-testid={`review-row-${row.shift._id}`}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-atria-accent/20 text-atria-accent">
                    <span className="text-sm font-semibold">
                      {getInitials(row.caregiverName)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-atria-ink">
                      {row.caregiverName}{' '}
                      <span className="text-atria-muted">Ã¢â€ â€™</span>{' '}
                      {row.clientName}
                    </p>
                    <p className="text-xs text-atria-muted">
                      {row.statusLabel} {formatShiftDate(row.shift.scheduledStart)}
                    </p>
                  </div>
                </div>

                <div className="col-span-4 text-sm text-atria-ink">
                  {formatTimeRange(row.shift.scheduledStart, row.shift.scheduledEnd)}
                </div>

                <div className="col-span-3 flex items-center justify-end gap-3">
                  <Badge variant={row.statusVariant} data-testid="review-status-badge">{row.statusLabel}</Badge>
                  <button
                    className="inline-flex items-center gap-1 text-sm font-medium text-atria-accent transition-colors hover:text-atria-accent-hover"
                    onClick={() => setSelectedShiftId(row.shift._id)}
                    type="button"
                    data-testid={`review-button-${row.shift._id}`}
                  >
                    Review <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterTab({
  active,
  count,
  label,
  onClick,
  'data-testid': testId,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
  'data-testid'?: string
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-atria-warning-bg text-atria-warning'
          : 'bg-atria-surface text-atria-text-secondary hover:bg-atria-surface-2'
      }`}
      onClick={onClick}
      type="button"
      data-testid={testId}
    >
      {label} Ã‚Â· {count}
    </button>
  )
}

function formatShiftDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  if (isToday) return `today Ã‚Â· ${time}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  return `${fmt(start)} Ã¢â‚¬â€œ ${fmt(end)}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}


 succeeded in 741ms:
import { useOrganization, useUser } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ShiftDocumentationForm } from '../components/ShiftDocumentationForm'
import { CalendarDays, ChevronLeft, Clock, MapPin } from 'lucide-react'
import { formatTime, formatWeekdayDate, formatDurationHours, formatStreetAddress } from '@/shared/format'
import { cn } from '@/shared/lib/cn'

export function CaregiverTodayPage() {
  const { organization } = useOrganization()
  const { user } = useUser()
  const clerkOrgId = organization?.id
  const firstName = user?.firstName ?? ''

  const data = useQuery(
    api.shiftQueries.listMyShifts,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )

  const [selectedShiftId, setSelectedShiftId] = useState<Id<'shifts'> | null>(
    null,
  )

  const selectedItem = data?.find((item) => item.shift._id === selectedShiftId)

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-base text-atria-muted">Loading shiftsÃ¢â‚¬Â¦</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-atria-surface-2">
            <CalendarDays className="h-7 w-7 text-atria-text-muted" />
          </div>
          <p className="text-base font-semibold text-atria-ink">No shifts assigned</p>
          <p className="mt-1 text-sm text-atria-text-secondary">
            You have no shifts for today in {organization?.name}. Check back later or contact your coordinator.
          </p>
        </div>
      </div>
    )
  }

  const showList = !selectedShiftId
  const showForm = Boolean(selectedItem)

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-atria-ink">
          Good morning, {firstName || 'Caregiver'} Ã°Å¸â€˜â€¹
        </h1>
        <p className="text-base text-atria-text-secondary">
          {formatWeekdayDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`space-y-4 ${showList ? '' : 'hidden lg:block'}`}>
          <p className="text-base font-semibold text-atria-ink">Your visit today</p>
          {data.map(({ shift, client }) => {
            const start = formatTime(shift.scheduledStart)
            const end = formatTime(shift.scheduledEnd)
            const duration = formatDurationHours(shift.scheduledStart, shift.scheduledEnd)
            const address = formatStreetAddress(client?.serviceAddress)
            const noteNotStarted =
              (shift.status === 'scheduled' || shift.status === 'in_progress') &&
              !shift.clockOutAt

            return (
              <div key={shift._id} className="space-y-4">
                <Card
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedShiftId === shift._id
                      ? 'border-atria-accent'
                      : 'hover:border-atria-border-strong',
                  )}
                  onClick={() => setSelectedShiftId(shift._id)}
                  data-testid={`shift-card-${shift._id}`}
                >
                  <CardContent className="space-y-4 p-5">
                    <StatusBadge status={shift.status} data-testid="shift-status-badge" />

                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-atria-ink">
                        {client?.displayName ?? 'Unknown client'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-base text-atria-text-secondary">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {start} Ã¢â‚¬â€œ {end} {duration && ` Ã‚Â· ${duration}`}
                        </span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-base text-atria-text-secondary">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">{address}</span>
                      </p>
                    </div>

                    {noteNotStarted && (
                      <p className="flex items-center gap-2 text-sm text-atria-warning">
                        <span>Ã¢Å¡Â </span>
                        Shift notes not started yet
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Button
                  variant="primary"
                  size="lg"
                  className="h-16 w-full rounded-full text-lg"
                  onClick={() => setSelectedShiftId(shift._id)}
                  data-testid="clock-in-start-button"
                >
                  Clock in & start
                  <span className="ml-2">Ã¢â€ â€™</span>
                </Button>

                <p className="text-center text-sm text-atria-text-secondary">
                  It only takes a few minutes. We'll guide you step by step.
                </p>

                <p className="text-center text-sm text-atria-text-muted">
                  Need help? Call your coordinator
                </p>
              </div>
            )
          })}
        </div>

        <div className={`lg:col-span-2 ${showForm ? '' : 'hidden lg:block'}`}>
          {selectedItem ? (
            <div className="flex h-svh flex-col gap-3 lg:h-full">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSelectedShiftId(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to shifts
              </Button>
              <div className="min-h-0 flex-1">
                <ShiftDocumentationForm
                  key={selectedItem.shift._id}
                  clerkOrgId={clerkOrgId!}
                  shiftId={selectedItem.shift._id}
                  firstName={firstName}
                  onDone={() => setSelectedShiftId(null)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({
  status,
  'data-testid': testId,
}: {
  status: string
  'data-testid'?: string
}) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'danger' }> = {
    scheduled: { label: 'UPCOMING', variant: 'info' },
    in_progress: { label: 'IN PROGRESS', variant: 'warning' },
    submitted: { label: 'SUBMITTED', variant: 'info' },
    needs_correction: { label: 'CORRECTION', variant: 'danger' },
    approved: { label: 'APPROVED', variant: 'success' },
    billing_ready: { label: 'BILLING READY', variant: 'success' },
  }
  const config = map[status] ?? { label: status.toUpperCase(), variant: 'default' as const }
  return (
    <Badge variant={config.variant} data-testid={testId}>
      {config.label}
    </Badge>
  )
}


codex
Geofence e2e relies on UI disabled states for outside/denied cases; server rejection and no-punch creation may be covered by Convex tests instead, so Iâ€™m reading those tests before treating it as a missing acceptance item.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "geofence|outside|missing|no punch|location|accuracy|disabled|timePunches|pending_credentials|configured|secret|location evidence|lastPunchInput|adpInitialWorkerLoad|createCaregiver|idempot" convex/shiftClock.test.ts convex/adpSync.test.ts convex/employeeProfiles.test.ts convex/reviews.test.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\adpSync.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\employeeProfiles.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\shiftClock.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 771ms:
convex/reviews.test.ts:82:    await ctx.db.insert('timePunches', {
convex/reviews.test.ts:89:      adpSyncStatus: 'pending_credentials',
convex/reviews.test.ts:93:    await ctx.db.insert('timePunches', {
convex/reviews.test.ts:100:      adpSyncStatus: 'pending_credentials',
convex/reviews.test.ts:195:        comment: 'Please add the missing proof.',
convex/employeeProfiles.test.ts:18:  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/employeeProfiles.test.ts:91:describe('createCaregiver', () => {
convex/employeeProfiles.test.ts:118:        status: 'configured',
convex/employeeProfiles.test.ts:126:      api.employeeProfiles.createCaregiver,
convex/employeeProfiles.test.ts:150:  it('reuses the same profile when createCaregiver is called again with the same email and a different name', async () => {
convex/employeeProfiles.test.ts:176:        status: 'configured',
convex/employeeProfiles.test.ts:184:      api.employeeProfiles.createCaregiver,
convex/employeeProfiles.test.ts:196:      api.employeeProfiles.createCaregiver,
convex/employeeProfiles.test.ts:225:  it('marks profile as pending_credentials when ADP is not configured', async () => {
convex/employeeProfiles.test.ts:249:      api.employeeProfiles.createCaregiver,
convex/employeeProfiles.test.ts:264:    expect(profile?.adpSyncStatus).toBe('pending_credentials')
convex/employeeProfiles.test.ts:292:        api.employeeProfiles.createCaregiver,
convex/employeeProfiles.test.ts:349:        status: 'configured',
convex/shiftClock.test.ts:5:import { haversineDistanceMeters } from './locationValidation'
convex/shiftClock.test.ts:12:const locationSourcePath = resolve(__dirname, 'locationValidation.ts')
convex/shiftClock.test.ts:13:const locationSource = readFileSync(locationSourcePath, 'utf-8')
convex/shiftClock.test.ts:58:  it('includes a clear error when clock-in is missing', () => {
convex/shiftClock.test.ts:65:describe('clock-in geofence gating', () => {
convex/shiftClock.test.ts:66:  it('validates location through validateClockPunchLocation', () => {
convex/shiftClock.test.ts:71:  it('requires location when geofence enforcement is enabled', () => {
convex/shiftClock.test.ts:72:    expect(locationSource).toContain('Location is required for this punch')
convex/shiftClock.test.ts:75:  it('rejects clock-in outside the service radius', () => {
convex/shiftClock.test.ts:76:    expect(locationSource).toContain('outside the allowed')
convex/shiftClock.test.ts:79:  it('enforces maximum location accuracy', () => {
convex/shiftClock.test.ts:80:    expect(locationSource).toContain('exceeds the agency limit')
convex/shiftClock.test.ts:94:describe('clock-out geofence gating', () => {
convex/shiftClock.test.ts:95:  it('validates clock-out location before submitting', () => {
convex/shiftClock.test.ts:108:  it('records clock_in and clock_out timePunches', () => {
convex/shiftClock.test.ts:130:describe('idempotent clock-in', () => {
convex/shiftClock.test.ts:150:describe('service location mutations', () => {
convex/shiftClock.test.ts:177:    geofenceEnabled?: boolean
convex/shiftClock.test.ts:201:        enabled: options.geofenceEnabled ?? false,
convex/shiftClock.test.ts:202:        enforceClockIn: options.geofenceEnabled ?? false,
convex/shiftClock.test.ts:203:        enforceClockOut: options.geofenceEnabled ?? false,
convex/shiftClock.test.ts:270:describe('clock-in geofence runtime', () => {
convex/shiftClock.test.ts:271:  it('allows clock-in without location when geofence is disabled', async () => {
convex/shiftClock.test.ts:273:    const clerkOrgId = 'org_geo_disabled'
convex/shiftClock.test.ts:274:    const caregiverId = 'user_cg_geo_disabled'
convex/shiftClock.test.ts:278:      geofenceEnabled: false,
convex/shiftClock.test.ts:289:      return ctx.db.get(result.punchId as Id<'timePunches'>)
convex/shiftClock.test.ts:291:    expect(punch?.location).toBeUndefined()
convex/shiftClock.test.ts:294:  it('allows clock-in inside radius and stores location evidence', async () => {
convex/shiftClock.test.ts:301:      geofenceEnabled: true,
convex/shiftClock.test.ts:311:        location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 5 },
convex/shiftClock.test.ts:318:      return ctx.db.get(result.punchId as Id<'timePunches'>)
convex/shiftClock.test.ts:320:    expect(punch?.location).toBeDefined()
convex/shiftClock.test.ts:321:    expect(punch?.location?.withinGeofence).toBe(true)
convex/shiftClock.test.ts:324:  it('rejects clock-in outside radius and creates no punch', async () => {
convex/shiftClock.test.ts:326:    const clerkOrgId = 'org_geo_outside'
convex/shiftClock.test.ts:327:    const caregiverId = 'user_cg_geo_outside'
convex/shiftClock.test.ts:331:      geofenceEnabled: true,
convex/shiftClock.test.ts:342:          location: { latitude: 45.0, longitude: -93.0, accuracyMeters: 5 },
convex/shiftClock.test.ts:345:    ).rejects.toThrow('outside the allowed')
convex/shiftClock.test.ts:349:        .query('timePunches')
convex/shiftClock.test.ts:358:  it('rejects clock-in when required location is missing', async () => {
convex/shiftClock.test.ts:360:    const clerkOrgId = 'org_geo_missing'
convex/shiftClock.test.ts:361:    const caregiverId = 'user_cg_geo_missing'
convex/shiftClock.test.ts:365:      geofenceEnabled: true,
convex/shiftClock.test.ts:378:  it('rejects clock-in when location accuracy exceeds agency limit', async () => {
convex/shiftClock.test.ts:380:    const clerkOrgId = 'org_geo_accuracy'
convex/shiftClock.test.ts:381:    const caregiverId = 'user_cg_geo_accuracy'
convex/shiftClock.test.ts:385:      geofenceEnabled: true,
convex/shiftClock.test.ts:396:          location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 200 },
convex/adpSync.test.ts:19:  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:63:        status: 'configured',
convex/adpSync.test.ts:140:  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
convex/adpSync.test.ts:144:    const clerkOrgId = 'org_adp_unconfigured'
convex/adpSync.test.ts:145:    const caregiverId = 'user_cg_adp_unconfigured'
convex/adpSync.test.ts:146:    const caregiverEmail = 'unconfigured@example.com'
convex/adpSync.test.ts:162:      api.timePunches.get,
convex/adpSync.test.ts:165:        punchId: result.punchId as Id<'timePunches'>,
convex/adpSync.test.ts:168:    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')
convex/adpSync.test.ts:175:    // Flip integration connection to configured and add employee profile
convex/adpSync.test.ts:180:        status: 'configured',
convex/adpSync.test.ts:189:        adpAssociateOid: 'mock-aoid-unconfigured@example.com',
convex/adpSync.test.ts:194:      await ctx.db.patch(result.punchId as Id<'timePunches'>, {
convex/adpSync.test.ts:200:      timePunchId: result.punchId as Id<'timePunches'>,
convex/adpSync.test.ts:206:      return ctx.db.get(result.punchId as Id<'timePunches'>)
convex/adpSync.test.ts:212:  it('posts punch once, stores adpPunchId, and is idempotent', async () => {
convex/adpSync.test.ts:216:    const clerkOrgId = 'org_adp_configured'
convex/adpSync.test.ts:217:    const caregiverId = 'user_cg_adp_configured'
convex/adpSync.test.ts:218:    const caregiverEmail = 'configured@example.com'
convex/adpSync.test.ts:232:        adpAssociateOid: 'mock-aoid-configured@example.com',
convex/adpSync.test.ts:237:      return ctx.db.insert('timePunches', {
convex/adpSync.test.ts:244:        location: {
convex/adpSync.test.ts:247:          accuracyMeters: 5,
convex/adpSync.test.ts:278:          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
convex/adpSync.test.ts:286:  it('does not send location evidence in the ADP punch payload', async () => {
convex/adpSync.test.ts:290:    const clerkOrgId = 'org_adp_location'
convex/adpSync.test.ts:291:    const caregiverId = 'user_cg_adp_location'
convex/adpSync.test.ts:292:    const caregiverEmail = 'location@example.com'
convex/adpSync.test.ts:306:        adpAssociateOid: 'mock-aoid-location@example.com',
convex/adpSync.test.ts:311:      return ctx.db.insert('timePunches', {
convex/adpSync.test.ts:318:        location: {
convex/adpSync.test.ts:321:          accuracyMeters: 5,
convex/adpSync.test.ts:336:    expect(mock.lastPunchInput).toBeDefined()
convex/adpSync.test.ts:337:    expect(mock.lastPunchInput).not.toHaveProperty('location')
convex/adpSync.test.ts:338:    expect(mock.lastPunchInput).not.toHaveProperty('latitude')
convex/adpSync.test.ts:339:    expect(mock.lastPunchInput).not.toHaveProperty('longitude')
convex/adpSync.test.ts:340:    expect(mock.lastPunchInput).not.toHaveProperty('distanceMeters')
convex/adpSync.test.ts:341:    expect(mock.lastPunchInput).toHaveProperty('idempotencyKey')
convex/adpSync.test.ts:342:    expect(mock.lastPunchInput).toHaveProperty('associateOID')
convex/adpSync.test.ts:343:    expect(mock.lastPunchInput).toHaveProperty('punchType')
convex/adpSync.test.ts:344:    expect(mock.lastPunchInput).toHaveProperty('at')
convex/adpSync.test.ts:347:  it('does not leak ADP secrets into integrationEvents on failure', async () => {
convex/adpSync.test.ts:351:      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
convex/adpSync.test.ts:354:    const clerkOrgId = 'org_adp_secret_leak'
convex/adpSync.test.ts:355:    const caregiverId = 'user_cg_adp_secret_leak'
convex/adpSync.test.ts:356:    const caregiverEmail = 'secret-leak@example.com'
convex/adpSync.test.ts:370:        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
convex/adpSync.test.ts:375:      return ctx.db.insert('timePunches', {
convex/adpSync.test.ts:393:          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
convex/adpSync.test.ts:400:    expect(eventJson).not.toContain('mock-client-secret')
convex/adpSync.test.ts:406:    expect(punch?.adpError).not.toContain('mock-client-secret')
convex/adpSync.test.ts:437:      return ctx.db.insert('timePunches', {
convex/adpSync.test.ts:477:          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
convex/adpSync.test.ts:503:      idempotencyKey: key,
convex/adpSync.test.ts:513:      idempotencyKey: key,
convex/adpSync.test.ts:530:      idempotencyKey: key,
convex/adpSync.test.ts:541:    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:544:      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
convex/adpSync.test.ts:549:    expect(redacted).not.toContain('mock-client-secret')
convex/adpSync.test.ts:563:describe('adpInitialWorkerLoad', () => {
convex/adpSync.test.ts:602:    const result = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex/adpSync.test.ts:639:    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex/adpSync.test.ts:648:          q.eq('tenantId', tenantId).eq('idempotencyKey', `initial_worker_load:${tenantId}`),
convex/adpSync.test.ts:657:    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex/adpSync.test.ts:663:  it('is idempotent across reruns by AOID', async () => {
convex/adpSync.test.ts:684:    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex/adpSync.test.ts:690:    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex/adpSync.test.ts:740:        status: 'configured',
convex/adpSync.test.ts:811:  it('retries without creating duplicate workers using idempotency key', async () => {
convex/adpSync.test.ts:878:        status: 'configured',
convex/adpSync.test.ts:948:        status: 'configured',
convex/adpSync.test.ts:1001:        status: 'configured',
convex/adpSync.test.ts:1061:        status: 'configured',

 succeeded in 810ms:
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

function stubClerkInvitation() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_test',
            email_address: 'caregiver@test.com',
            role: 'org:member',
            role_name: 'Member',
            status: 'pending',
            created_at: Date.now(),
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  coordinatorId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: coordinatorId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

describe('createCaregiver', () => {
  it('creates an employee profile and enqueues worker sync', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver'
    const adminId = 'user_admin_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    expect(result.profileId).toBeDefined()
    expect(result.emailAddress).toBe('caregiver@test.com')

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver@test.com')
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('reuses the same profile when createCaregiver is called again with the same email and a different name', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_reuse'
    const adminId = 'user_admin_create_reuse'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const first = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Original Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const second = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Updated Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(second.profileId).toBe(first.profileId)

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Updated Name')
  })

  it('marks profile as pending_credentials when ADP is not configured', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_no_adp'
    const adminId = 'user_admin_create_no_adp'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver-no-adp@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver-no-adp@test.com')
    expect(profile?.adpSyncStatus).toBe('pending_credentials')
  })

  it('rejects non-admin callers', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_coordinator'
    const coordinatorId = 'user_coordinator_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).action(
        api.employeeProfiles.createCaregiver,
        {
          clerkOrgId,
          displayName: 'Caregiver',
          email: 'caregiver@test.com',
          appBaseUrl: 'http://localhost',
        },
      ),
    ).rejects.toThrow('only agency admins')
  })
})

describe('runAdpInitialWorkerLoad', () => {
  it('returns correct matched/created counts with mocked ADP', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-one',
          workerID: 'w-one',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-two',
          workerID: 'w-two',
          displayName: 'New ADP Employee',
          email: 'new@example.com',
          status: 'active',
        },
      ],
    })

    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_summary'
    const adminId = 'user_admin_load'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.runAdpInitialWorkerLoad,
      { clerkOrgId },
    )

    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)
  })
})

describe('listEmployeeProfiles', () => {
  it('returns profiles for admin and includes adpSyncStatus', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles'
    const adminId = 'user_admin_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Caregiver One',
        email: 'one@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const profiles = await asAdmin(t, adminId, clerkOrgId).query(
      api.employeeProfiles.listEmployeeProfiles,
      { clerkOrgId },
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Caregiver One')
    expect(profiles[0]?.adpSyncStatus).toBe('queued')
  })

  it('rejects caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles_caregiver'
    const caregiverId = 'user_cg_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(
        api.employeeProfiles.listEmployeeProfiles,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})

describe('tenantSettings.updateShiftGeofence role guards', () => {
  it('allows admin and coordinator edits and rejects caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_roles'
    const adminId = 'user_admin_geo'
    const coordinatorId = 'user_coordinator_geo'
    const caregiverId = 'user_cg_geo'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    const payload = {
      clerkOrgId,
      enabled: true,
      enforceClockIn: true,
      enforceClockOut: false,
      defaultRadiusMeters: 150,
      maxAccuracyMeters: 75,
    }

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).rejects.toThrow()
  })
})


 succeeded in 866ms:
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'
import { sanitizeError } from './adpSync'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function seedAgency(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    caregiverEmail?: string
    configureAdp?: boolean
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: options.caregiverEmail ?? 'caregiver@example.com',
    })

    if (options.configureAdp) {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    }

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
      serviceAddress: {
        line1: '123 Main St',
        city: 'Minneapolis',
        state: 'MN',
        postalCode: '55401',
      },
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: 'pending',
    })

    return { tenantId, memberId, clientId, shiftId }
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

describe('adpSyncPunch', () => {
  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_unconfigured'
    const caregiverId = 'user_cg_adp_unconfigured'
    const caregiverEmail = 'unconfigured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: false,
    })

    const result = await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(result.punchId).toBeDefined()

    const punchBefore = await asCaregiver(t, caregiverId, clerkOrgId).query(
      api.timePunches.get,
      {
        clerkOrgId,
        punchId: result.punchId as Id<'timePunches'>,
      },
    )
    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')

    const eventsBefore = await t.run(async (ctx) => {
      return ctx.db.query('integrationEvents').collect()
    })
    expect(eventsBefore).toHaveLength(0)

    // Flip integration connection to configured and add employee profile
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-unconfigured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.patch(result.punchId as Id<'timePunches'>, {
        adpSyncStatus: 'queued',
      })
    })

    const syncResult = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId: result.punchId as Id<'timePunches'>,
    })
    expect(syncResult.status).toBe('synced')
    expect(syncResult.adpPunchId).toBeDefined()

    const punchAfter = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punchAfter?.adpSyncStatus).toBe('synced')
    expect(punchAfter?.adpPunchId).toBe(syncResult.adpPunchId)
  })

  it('posts punch once, stores adpPunchId, and is idempotent', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_configured'
    const caregiverId = 'user_cg_adp_configured'
    const caregiverEmail = 'configured@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-configured@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('synced')
    expect(first.adpPunchId).toBeDefined()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('already_synced')

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punch?.adpSyncStatus).toBe('synced')
    expect(punch?.adpPunchId).toBe(first.adpPunchId)

    expect(mock.callCounts.postPunch).toBe(1)

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('success')
  })

  it('does not send location evidence in the ADP punch payload', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_location'
    const caregiverId = 'user_cg_adp_location'
    const caregiverEmail = 'location@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-location@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_out',
        at: new Date().toISOString(),
        source: 'atriax',
        location: {
          latitude: 44.9778,
          longitude: -93.265,
          accuracyMeters: 5,
          distanceMeters: 12,
          targetLabel: 'Client service address',
          targetLatitude: 44.9778,
          targetLongitude: -93.265,
          withinGeofence: true,
        },
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    expect(mock.callCounts.postPunch).toBe(1)
    expect(mock.lastPunchInput).toBeDefined()
    expect(mock.lastPunchInput).not.toHaveProperty('location')
    expect(mock.lastPunchInput).not.toHaveProperty('latitude')
    expect(mock.lastPunchInput).not.toHaveProperty('longitude')
    expect(mock.lastPunchInput).not.toHaveProperty('distanceMeters')
    expect(mock.lastPunchInput).toHaveProperty('idempotencyKey')
    expect(mock.lastPunchInput).toHaveProperty('associateOID')
    expect(mock.lastPunchInput).toHaveProperty('punchType')
    expect(mock.lastPunchInput).toHaveProperty('at')
  })

  it('does not leak ADP secrets into integrationEvents on failure', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({
      failNextCall: true,
      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_secret_leak'
    const caregiverId = 'user_cg_adp_secret_leak'
    const caregiverEmail = 'secret-leak@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })

    expect(events.length).toBeGreaterThan(0)
    const eventJson = JSON.stringify(events)
    expect(eventJson).not.toContain('mock-client-secret')
    expect(eventJson).not.toContain('mock-client-id')
    expect(eventJson).not.toContain('bW9jay1jbGllbnQtaWQ')

    const punch = await t.run(async (ctx) => ctx.db.get(timePunchId))
    expect(punch?.adpError).toBeDefined()
    expect(punch?.adpError).not.toContain('mock-client-secret')
    expect(punch?.adpError).not.toContain('mock-client-id')

    mock.clearFailure()
  })

  it('records error and succeeds on retry', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_retry'
    const caregiverId = 'user_cg_adp_retry'
    const caregiverEmail = 'retry@example.com'
    const { tenantId, shiftId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const timePunchId = await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'mock-aoid-retry@example.com',
        adpSyncStatus: 'synced',
        createdAt: new Date().toISOString(),
      })

      return ctx.db.insert('timePunches', {
        tenantId,
        shiftId,
        caregiverId,
        punchType: 'clock_in',
        at: new Date().toISOString(),
        source: 'atriax',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(first.status).toBe('error')

    const punchAfterFirst = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterFirst?.adpSyncStatus).toBe('error')
    expect(punchAfterFirst?.adpError).toBeDefined()

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
      timePunchId,
    })
    expect(second.status).toBe('synced')

    const punchAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(timePunchId)
    })
    expect(punchAfterSecond?.adpSyncStatus).toBe('synced')
    expect(punchAfterSecond?.adpError).toBeUndefined()

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `punch:${timePunchId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(2)
    expect(events[0]?.status).toBe('error')
    expect(events[1]?.status).toBe('success')
  })
})

describe('claimIntegrationEvent', () => {
  it('prevents overlapping claims and respects success', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_claim'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_claim',
      configureAdp: true,
    })

    const key = 'punch:claim-test'
    const first = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(first.type).toBe('claimed')

    const second = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(second.type).toBe('in_flight')

    await t.mutation(internal.adpSync.patchIntegrationEvent, {
      eventId: first.eventId,
      status: 'success',
      response: { adpPunchId: 'punch-123' },
      completedAt: new Date().toISOString(),
    })

    const third = await t.mutation(internal.adpSync.claimIntegrationEvent, {
      tenantId,
      kind: 'punch',
      refId: 'claim-test',
      idempotencyKey: key,
      request: {},
      maxAttempts: 5,
    })
    expect(third.type).toBe('already_synced')
  })
})

describe('sanitizeError', () => {
  it('redacts ADP env values, Basic/Bearer tokens, and generic tokens', () => {
    vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')

    const message =
      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

    const redacted = sanitizeError(new Error(message))

    expect(redacted).not.toContain('mock-client-id')
    expect(redacted).not.toContain('mock-client-secret')
    expect(redacted).not.toContain(
      'bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0',
    )
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_ID]')
    expect(redacted).toContain('[REDACTED:ADP_CLIENT_SECRET]')
    expect(redacted).toContain('Basic [REDACTED]')
    expect(redacted).toContain('Bearer [REDACTED]')

    vi.unstubAllEnvs()
  })
})

describe('adpInitialWorkerLoad', () => {
  it('matches existing profile by email and creates profile for new worker', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-existing',
          workerID: 'w-existing',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-new',
          workerID: 'w-new',
          displayName: 'New ADP Worker',
          email: 'new-adp@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load',
      configureAdp: true,
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(2)
    const matched = profiles.find((p) => p.email === 'existing@example.com')
    const created = profiles.find((p) => p.email === 'new-adp@example.com')

    expect(matched?.adpSyncStatus).toBe('matched')
    expect(matched?.adpAssociateOid).toBe('aoid-existing')
    expect(created?.adpSyncStatus).toBe('created')
    expect(created?.adpAssociateOid).toBe('aoid-new')
  })

  it('records failure and retries', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_retry'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_load_retry',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('error')

    const events = await t.run(async (ctx) => {
      return ctx.db
        .query('integrationEvents')
        .withIndex('by_tenant_idemp', (q) =>
          q.eq('tenantId', tenantId).eq('idempotencyKey', `initial_worker_load:${tenantId}`),
        )
        .collect()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('success')
  })

  it('is idempotent across reruns by AOID', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-rerun',
          workerID: 'w-rerun',
          displayName: 'Rerun Worker',
          email: 'rerun@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_rerun'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId: 'user_cg_adp_rerun',
      configureAdp: true,
    })

    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(first.status).toBe('success')
    expect(first.created).toBe(1)

    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId,
    })
    expect(second.status).toBe('already_synced')

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })
    expect(profiles).toHaveLength(1)
  })

  it('can be triggered by an admin through the public mutation', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-public',
          workerID: 'w-public',
          displayName: 'Public Load Worker',
          email: 'public@example.com',
          status: 'active',
        },
      ],
    })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_public_load'
    const adminId = 'user_admin_public_load'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asAdmin(t, adminId, clerkOrgId).mutation(
      api.adpSync.triggerInitialWorkerLoad,
      { clerkOrgId },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-public')
  })
})

describe('adpSyncWorker', () => {
  it('no-ops when profile already has an ADP associate OID', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_existing_aoid'
    const caregiverId = 'user_cg_existing_aoid'
    const caregiverEmail = 'existing-aoid@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-existing',
        adpSyncStatus: 'matched',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(result.status).toBe('already_synced')
    expect(mock.callCounts.createWorker).toBe(0)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBe('aoid-existing')
  })

  it('retries without creating duplicate workers using idempotency key', async () => {
    stubAdpEnv()
    const mock = resetSharedMockAdp({ failNextCall: true })
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker_retry'
    const caregiverId = 'user_cg_worker_retry'
    const caregiverEmail = 'worker-retry@example.com'
    const { tenantId } = await seedAgency(t, {
      clerkOrgId,
      caregiverId,
      caregiverEmail,
      configureAdp: true,
    })

    const employeeProfileId = await t.run(async (ctx) => {
      return ctx.db.insert('employeeProfiles', {
        tenantId,
        clerkUserId: caregiverId,
        displayName: 'Caregiver',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const first = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(first.status).toBe('error')

    mock.clearFailure()

    const second = await t.action(internal.adpOutbound.adpSyncWorker, {
      employeeProfileId,
    })
    expect(second.status).toBe('synced')
    expect(second.adpAssociateOid).toBeDefined()

    const profileAfterSecond = await t.run(async (ctx) => {
      return ctx.db.get(employeeProfileId)
    })
    expect(profileAfterSecond?.adpSyncStatus).toBe('synced')
    expect(profileAfterSecond?.adpError).toBeUndefined()

    expect(mock.workerCount()).toBe(1)
  })
})

describe('adpSyncWorker scheduled drain', () => {
  it('enqueues worker sync when caregiver is created and stores AOID', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_worker'
    const caregiverId = 'user_cg_adp_worker'
    const caregiverEmail = 'worker@example.com'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('enqueues worker sync when an existing member is promoted to caregiver', async () => {
    stubAdpEnv()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_promote'
    const adminId = 'user_admin_promote'
    const caregiverId = 'user_cg_promote'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:coordinator',
        displayName: 'Future Caregiver',
        email: 'promote@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    await asAdmin(t, adminId, clerkOrgId).mutation(api.members.updateRole, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant_clerk_user', (q) =>
          q.eq('tenantId', tenant._id).eq('clerkUserId', caregiverId),
        )
        .unique()
    })

    expect(profile).toBeDefined()
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('links new caregiver to ADP-loaded profile by email and name', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_profile'
    const caregiverId = 'user_cg_link_profile'
    const caregiverEmail = 'link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Link Caregiver',
        email: caregiverEmail,
        adpAssociateOid: 'aoid-link',
        adpSyncStatus: 'created',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Link Caregiver',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.adpAssociateOid).toBe('aoid-link')
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })

  it('links a caregiver to an existing profile by email even when display names differ', async () => {
    stubAdpEnv()
    resetSharedMockAdp()
    const t = createTestConvex()
    const clerkOrgId = 'org_adp_link_email_only'
    const caregiverId = 'user_cg_link_email_only'
    const caregiverEmail = 'email-link@example.com'

    const tenantId = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Admin Entered Name',
        email: caregiverEmail,
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })

      return tenantId
    })

    vi.useFakeTimers()

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(api.members.sync, {
      clerkOrgId,
      clerkUserId: caregiverId,
      role: 'org:caregiver',
      displayName: 'Clerk Display Name',
      email: caregiverEmail,
    })

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profiles = await t.run(async (ctx) => {
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.clerkUserId).toBe(caregiverId)
    expect(profiles[0]?.tenantMemberId).toBeDefined()
    expect(profiles[0]?.adpAssociateOid).toBeDefined()
    expect(profiles[0]?.adpSyncStatus).toBe('synced')
  })
})


 succeeded in 836ms:
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convexTest } from 'convex-test'
import { haversineDistanceMeters } from './locationValidation'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const shiftSourcePath = resolve(__dirname, 'shifts.ts')
const shiftSource = readFileSync(shiftSourcePath, 'utf-8')
const locationSourcePath = resolve(__dirname, 'locationValidation.ts')
const locationSource = readFileSync(locationSourcePath, 'utf-8')

describe('shift clock exports', () => {
  it('exports clockIn and clockOut', async () => {
    const mod = await import('./shifts')
    expect(mod).toHaveProperty('clockIn')
    expect(mod).toHaveProperty('clockOut')
  })
})

describe('clock-in/out authorization', () => {
  it('restricts clockIn to caregivers', () => {
    expect(shiftSource).toContain('export const clockIn')
    expect(shiftSource).toMatch(
      /clockIn[\s\S]*?requireTenantRole[\s\S]*?\['org:caregiver'\]/,
    )
  })

  it('restricts clockOut to caregivers', () => {
    expect(shiftSource).toContain('export const clockOut')
    expect(shiftSource).toMatch(
      /clockOut[\s\S]*?requireTenantRole[\s\S]*?\['org:caregiver'\]/,
    )
  })

  it('only allows caregivers to clock their assigned shifts', () => {
    expect(shiftSource).toContain(
      'Caregivers can only clock in to their assigned shifts.',
    )
    expect(shiftSource).toContain(
      'Caregivers can only clock out of their assigned shifts.',
    )
  })
})

describe('progress note writes require clock-in', () => {
  it('guards updateProgressNote with assertClockInPunchExists', () => {
    expect(shiftSource).toContain('export const updateProgressNote')
    expect(shiftSource).toContain('assertClockInPunchExists')
  })

  it('guards submitDocumentation with assertClockInPunchExists', () => {
    expect(shiftSource).toMatch(/submitShift[\s\S]*?assertClockInPunchExists/)
  })

  it('includes a clear error when clock-in is missing', () => {
    expect(shiftSource).toContain(
      'You must clock in before you can document or submit this shift.',
    )
  })
})

describe('clock-in geofence gating', () => {
  it('validates location through validateClockPunchLocation', () => {
    expect(shiftSource).toContain('validateClockPunchLocation')
    expect(shiftSource).toContain('resolveShiftServiceTarget')
  })

  it('requires location when geofence enforcement is enabled', () => {
    expect(locationSource).toContain('Location is required for this punch')
  })

  it('rejects clock-in outside the service radius', () => {
    expect(locationSource).toContain('outside the allowed')
  })

  it('enforces maximum location accuracy', () => {
    expect(locationSource).toContain('exceeds the agency limit')
  })
})

describe('clock-out documentation gating', () => {
  it('validates documentation completeness before clock-out', () => {
    expect(shiftSource).toMatch(/clockOut[\s\S]*?validateShiftDocumentation/)
  })

  it('blocks clock-out when documentation is incomplete', () => {
    expect(shiftSource).toMatch(/clockOut[\s\S]*?Incomplete documentation/)
  })
})

describe('clock-out geofence gating', () => {
  it('validates clock-out location before submitting', () => {
    const clockOutBlock = shiftSource.slice(
      shiftSource.indexOf('export const clockOut'),
    )
    const submitIndex = clockOutBlock.indexOf('await submitShift')
    expect(submitIndex).toBeGreaterThan(0)
    expect(clockOutBlock.indexOf('validateClockPunchLocation')).toBeLessThan(
      submitIndex,
    )
  })
})

describe('clock punch side effects', () => {
  it('records clock_in and clock_out timePunches', () => {
    expect(shiftSource).toContain("punchType: 'clock_in'")
    expect(shiftSource).toContain("punchType: 'clock_out'")
  })

  it('patches shift clockInAt and clockOutAt timestamps', () => {
    expect(shiftSource).toContain('clockInAt: now')
    expect(shiftSource).toContain('clockOutAt: now')
  })

  it('writes audit events for clock actions', () => {
    expect(shiftSource).toContain("'shift_submitted'")
    expect(shiftSource).toContain('clocked_in')
    expect(shiftSource).toContain('clocked_out')
    expect(shiftSource).toContain('ctx.runMutation(internal.audit.record')
  })

  it('enqueues ADP sync after clock punches', () => {
    expect(shiftSource).toContain('internal.adpOutbound.adpSyncPunch')
  })
})

describe('idempotent clock-in', () => {
  it('looks up existing clock_in punch before creating another', () => {
    expect(shiftSource).toMatch(/clockIn[\s\S]*?findPunch[\s\S]*?'clock_in'/)
  })

  it('returns existing punch on double clock-in', () => {
    expect(shiftSource).toContain('if (existing) {')
    expect(shiftSource).toContain('return { punchId: existing._id')
  })
})

describe('clock-out reuses submit path', () => {
  it('calls submitShift from clockOut', () => {
    const clockOutBlock = shiftSource.slice(
      shiftSource.indexOf('export const clockOut'),
    )
    expect(clockOutBlock).toContain('await submitShift(')
  })
})

describe('service location mutations', () => {
  it('exports updateServiceLocationOverride for admin/coordinator', () => {
    expect(shiftSource).toContain('export const updateServiceLocationOverride')
    expect(shiftSource).toContain("'org:admin'")
    expect(shiftSource).toContain("'org:coordinator'")
  })
})

describe('haversine sanity for test coordinates', () => {
  it('computes a small distance for nearby coordinates', () => {
    const home = { latitude: 44.9778, longitude: -93.265 }
    const nearby = { latitude: 44.9779, longitude: -93.2649 }
    expect(haversineDistanceMeters(home, nearby)).toBeLessThan(100)
  })
})

const runtimeModules = import.meta.glob('./**/*.*s')

function createRuntimeConvex() {
  return convexTest({ schema, modules: runtimeModules })
}

async function seedShift(
  t: ReturnType<typeof createRuntimeConvex>,
  options: {
    clerkOrgId: string
    caregiverId: string
    geofenceEnabled?: boolean
    clientLatitude?: number
    clientLongitude?: number
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence: {
        enabled: options.geofenceEnabled ?? false,
        enforceClockIn: options.geofenceEnabled ?? false,
        enforceClockOut: options.geofenceEnabled ?? false,
        defaultRadiusMeters: 100,
        maxAccuracyMeters: 50,
      },
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
      serviceAddress: {
        line1: '123 Main St',
        city: 'Minneapolis',
        state: 'MN',
        postalCode: '55401',
        latitude: options.clientLatitude,
        longitude: options.clientLongitude,
      },
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'scheduled',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Upload shift documentation proof',
      requiredProof: true,
      status: 'pending',
    })

    return { tenantId, clientId, shiftId }
  })
}

function asCaregiverRuntime(
  t: ReturnType<typeof createRuntimeConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

describe('clock-in geofence runtime', () => {
  it('allows clock-in without location when geofence is disabled', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_disabled'
    const caregiverId = 'user_cg_geo_disabled'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: false,
    })

    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      { clerkOrgId, shiftId },
    )

    expect(result.punchId).toBeDefined()

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punch?.location).toBeUndefined()
  })

  it('allows clock-in inside radius and stores location evidence', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_inside'
    const caregiverId = 'user_cg_geo_inside'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    const result = await asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
      api.shifts.clockIn,
      {
        clerkOrgId,
        shiftId,
        location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 5 },
      },
    )

    expect(result.punchId).toBeDefined()

    const punch = await t.run(async (ctx) => {
      return ctx.db.get(result.punchId as Id<'timePunches'>)
    })
    expect(punch?.location).toBeDefined()
    expect(punch?.location?.withinGeofence).toBe(true)
  })

  it('rejects clock-in outside radius and creates no punch', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_outside'
    const caregiverId = 'user_cg_geo_outside'
    const { tenantId, shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        {
          clerkOrgId,
          shiftId,
          location: { latitude: 45.0, longitude: -93.0, accuracyMeters: 5 },
        },
      ),
    ).rejects.toThrow('outside the allowed')

    const punches = await t.run(async (ctx) => {
      return ctx.db
        .query('timePunches')
        .withIndex('by_tenant_shift_type', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId).eq('punchType', 'clock_in'),
        )
        .collect()
    })
    expect(punches).toHaveLength(0)
  })

  it('rejects clock-in when required location is missing', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_missing'
    const caregiverId = 'user_cg_geo_missing'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        { clerkOrgId, shiftId },
      ),
    ).rejects.toThrow('Location is required')
  })

  it('rejects clock-in when location accuracy exceeds agency limit', async () => {
    const t = createRuntimeConvex()
    const clerkOrgId = 'org_geo_accuracy'
    const caregiverId = 'user_cg_geo_accuracy'
    const { shiftId } = await seedShift(t, {
      clerkOrgId,
      caregiverId,
      geofenceEnabled: true,
      clientLatitude: 44.9778,
      clientLongitude: -93.265,
    })

    await expect(
      asCaregiverRuntime(t, caregiverId, clerkOrgId).mutation(
        api.shifts.clockIn,
        {
          clerkOrgId,
          shiftId,
          location: { latitude: 44.9779, longitude: -93.2649, accuracyMeters: 200 },
        },
      ),
    ).rejects.toThrow('exceeds the agency limit')
  })
})


codex
The Convex tests do cover several geofence and ADP contracts, but there are still gaps in clock-out evidence and the actual Playwright coverage is conditional. Iâ€™m checking the new employee/profile actions and tenant member flows next, since those touch auth and ADP scheduling.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\employeeProfiles.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\tenantSettings.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\invitations.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\members.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 678ms:
import { v } from 'convex/values'
import {
  action,
  internalMutation,
  query,
  type MutationCtx,
} from './_generated/server'
import { internal, api } from './_generated/api'
import { requireTenantRole } from './authHelpers'
import type { Doc, Id } from './_generated/dataModel'
import { normalizeEmail } from './adpSync'
import { sendClerkInvitation } from './invitations'

export async function ensureCaregiverEmployeeProfile(
  ctx: MutationCtx,
  tenantId: Id<'tenants'>,
  member: Doc<'tenantMembers'>,
) {
  if (member.role !== 'org:caregiver') return null

  const existingByClerkUserId = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant_clerk_user', (q) =>
      q.eq('tenantId', tenantId).eq('clerkUserId', member.clerkUserId),
    )
    .unique()

  if (existingByClerkUserId) {
    if (!existingByClerkUserId.tenantMemberId) {
      await ctx.db.patch(existingByClerkUserId._id, { tenantMemberId: member._id })
    }
    return existingByClerkUserId._id
  }

  const normalizedEmail = normalizeEmail(member.email)
  const existingByEmail = await ctx.db
    .query('employeeProfiles')
    .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
    .filter((q) => q.eq(q.field('email'), normalizedEmail))
    .unique()

  if (existingByEmail) {
    if (
      existingByEmail.clerkUserId &&
      existingByEmail.clerkUserId !== member.clerkUserId
    ) {
      return existingByEmail._id
    }

    await ctx.db.patch(existingByEmail._id, {
      clerkUserId: member.clerkUserId,
      tenantMemberId: member._id,
      displayName: member.displayName,
      email: normalizedEmail,
    })
    return existingByEmail._id
  }

  return ctx.db.insert('employeeProfiles', {
    tenantId,
    clerkUserId: member.clerkUserId,
    tenantMemberId: member._id,
    displayName: member.displayName,
    email: member.email,
    adpSyncStatus: 'queued',
    createdAt: new Date().toISOString(),
  })
}

export const createCaregiverProfile = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    displayName: v.string(),
    email: v.string(),
    adpSyncStatus: v.optional(v.union(
      v.literal('pending_credentials'),
      v.literal('queued'),
    )),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email)
    const trimmedName = args.displayName.trim()
    const initialStatus = args.adpSyncStatus ?? 'queued'

    const existing = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', args.tenantId))
      .filter((q) => q.eq(q.field('email'), normalizedEmail))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: trimmedName,
        email: normalizedEmail,
      })
      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
        employeeProfileId: existing._id,
      })
      return existing._id
    }

    const profileId = await ctx.db.insert('employeeProfiles', {
      tenantId: args.tenantId,
      displayName: trimmedName,
      email: normalizedEmail,
      adpSyncStatus: initialStatus,
      createdAt: new Date().toISOString(),
    })

    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
      employeeProfileId: profileId,
    })

    return profileId
  },
})

export const createCaregiver = action({
  args: {
    clerkOrgId: v.string(),
    displayName: v.string(),
    email: v.string(),
    appBaseUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    profileId: Id<'employeeProfiles'>
    invitationId: string
    emailAddress: string
    role: string
    status: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can create caregivers.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, {
      clerkOrgId: args.clerkOrgId,
    })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const adpConfigured = await ctx.runQuery(
      internal.adpSync.isAdpConfiguredForTenant,
      { tenantId: tenant._id },
    )

    const profileId: Id<'employeeProfiles'> = await ctx.runMutation(
      internal.employeeProfiles.createCaregiverProfile,
      {
        tenantId: tenant._id,
        displayName: args.displayName,
        email: args.email,
        adpSyncStatus: adpConfigured ? 'queued' : 'pending_credentials',
      },
    )

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
    }

    const invitation = await sendClerkInvitation({
      secretKey,
      inviterUserId: identity.subject,
      clerkOrgId: args.clerkOrgId,
      emailAddress: args.email,
      role: 'org:caregiver',
      appBaseUrl: args.appBaseUrl,
    })

    return {
      profileId,
      invitationId: invitation.id,
      emailAddress: invitation.emailAddress,
      role: invitation.role,
      status: invitation.status,
    }
  },
})

export const listEmployeeProfiles = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])

    const profiles = await ctx.db
      .query('employeeProfiles')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    const memberById = new Map(members.map((m) => [m._id, m]))

    return profiles.map((profile) => {
      const member = profile.tenantMemberId
        ? memberById.get(profile.tenantMemberId)
        : undefined
      return {
        _id: profile._id,
        displayName: profile.displayName,
        email: profile.email,
        role: member?.role ?? 'org:caregiver',
        adpSyncStatus: profile.adpSyncStatus,
      }
    })
  },
})

export const runAdpInitialWorkerLoad = action({
  args: { clerkOrgId: v.string() },
  handler: async (
    ctx,
    { clerkOrgId },
  ): Promise<{
    status: string
    processed: number
    matched: number
    created: number
    errors: number
    error?: string
  }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, { clerkOrgId })
    if (!member) {
      throw new Error('Tenant not found.')
    }
    if (member.role !== 'org:admin') {
      throw new Error('Forbidden: only agency admins can run ADP load.')
    }

    const tenant = await ctx.runQuery(api.tenants.get, { clerkOrgId })
    if (!tenant) {
      throw new Error('Tenant not found.')
    }

    const result: {
      status: string
      processed?: number
      matched?: number
      created?: number
      errors?: number
      error?: string
    } = await ctx.runAction(internal.adpOutbound.adpInitialWorkerLoad, {
      tenantId: tenant._id,
    })

    return {
      status: result.status,
      processed: result.processed ?? 0,
      matched: result.matched ?? 0,
      created: result.created ?? 0,
      errors: result.errors ?? 0,
      error: result.error,
    }
  },
})


 succeeded in 661ms:
import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { assertTenantDoc, requireTenant, requireTenantRole } from './authHelpers'

export const DEFAULT_SHIFT_GEOFENCE = {
  enabled: false,
  enforceClockIn: false,
  enforceClockOut: false,
  defaultRadiusMeters: 100,
  maxAccuracyMeters: 50,
}

export const get = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)

    const settings = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    if (!settings) {
      return {
        tenantId,
        shiftGeofence: DEFAULT_SHIFT_GEOFENCE,
      }
    }

    assertTenantDoc(settings, tenantId)
    return settings
  },
})

export const updateShiftGeofence = mutation({
  args: {
    clerkOrgId: v.string(),
    enabled: v.boolean(),
    enforceClockIn: v.boolean(),
    enforceClockOut: v.boolean(),
    defaultRadiusMeters: v.number(),
    maxAccuracyMeters: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    if (!Number.isFinite(args.defaultRadiusMeters) || args.defaultRadiusMeters <= 0) {
      throw new Error('defaultRadiusMeters must be greater than zero.')
    }

    if (!Number.isFinite(args.maxAccuracyMeters) || args.maxAccuracyMeters <= 0) {
      throw new Error('maxAccuracyMeters must be greater than zero.')
    }

    const existing = await ctx.db
      .query('tenantSettings')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique()

    const shiftGeofence = {
      enabled: args.enabled,
      enforceClockIn: args.enforceClockIn,
      enforceClockOut: args.enforceClockOut,
      defaultRadiusMeters: args.defaultRadiusMeters,
      maxAccuracyMeters: args.maxAccuracyMeters,
    }

    if (existing) {
      assertTenantDoc(existing, tenantId)
      await ctx.db.patch(existing._id, { shiftGeofence })
      return existing._id
    }

    return await ctx.db.insert('tenantSettings', {
      tenantId,
      shiftGeofence,
    })
  },
})


 succeeded in 657ms:
import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { api } from './_generated/api'

declare const process: { env: Record<string, string | undefined> }

const roleValidator = v.union(
  v.literal('org:admin'),
  v.literal('org:coordinator'),
  v.literal('org:caregiver'),
)

type InviteRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

function toClerkRole(role: InviteRole) {
  return role === 'org:admin' ? 'org:admin' : 'org:member'
}

function invitationRedirectUrl(appBaseUrl: string) {
  const url = new URL(appBaseUrl)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new ConvexError('Invitation redirect URL must use HTTPS.')
  }
  return `${url.origin}/accept-invitation`
}

function clerkErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'errors' in payload &&
    Array.isArray((payload as { errors: unknown[] }).errors)
  ) {
    const first = (payload as { errors: Array<Record<string, unknown>> })
      .errors[0]
    const message = first?.long_message ?? first?.message
    if (typeof message === 'string') return message
  }
  return 'Clerk invitation request failed.'
}

function normalizeCreatedAt(value: unknown) {
  if (typeof value === 'number') {
    return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString()
  }
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date().toISOString()
}

export async function sendClerkInvitation(args: {
  secretKey: string
  inviterUserId: string
  clerkOrgId: string
  emailAddress: string
  role: InviteRole
  appBaseUrl: string
}) {
  const response = await fetch(
    `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inviter_user_id: args.inviterUserId,
        email_address: args.emailAddress.trim(),
        role: toClerkRole(args.role),
        redirect_url: invitationRedirectUrl(args.appBaseUrl),
        public_metadata: { atriaRole: args.role },
      }),
    },
  )

  const payload = await response.json()
  if (!response.ok) {
    throw new ConvexError(clerkErrorMessage(payload))
  }

  const record = payload as Record<string, unknown>
  return {
    id: String(record.id ?? ''),
    emailAddress: String(record.email_address ?? args.emailAddress),
    role: String(record.role ?? toClerkRole(args.role)),
    roleName: String(record.role_name ?? toClerkRole(args.role)),
    status: String(record.status ?? 'pending'),
    createdAt: normalizeCreatedAt(record.created_at),
  }
}

export const create = action({
  args: {
    clerkOrgId: v.string(),
    emailAddress: v.string(),
    role: roleValidator,
    appBaseUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError('Unauthorized: authentication required.')
    }

    const member = await ctx.runQuery(api.members.me, {
      clerkOrgId: args.clerkOrgId,
    })
    if (member?.role !== 'org:admin') {
      throw new ConvexError('Forbidden: only agency admins can invite users.')
    }

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      throw new ConvexError(
        'Server invitation configuration is missing CLERK_SECRET_KEY.',
      )
    }

    return sendClerkInvitation({
      secretKey,
      inviterUserId: identity.subject,
      clerkOrgId: args.clerkOrgId,
      emailAddress: args.emailAddress,
      role: args.role,
      appBaseUrl: args.appBaseUrl,
    })
  },
})


 succeeded in 691ms:
import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import {
  getActiveClerkOrganizationId,
  getClerkOrganizationRole,
  requireIdentity,
  requireMatchingClerkOrganization,
  requireTenant,
  requireTenantRole,
} from './authHelpers'
import { ensureCaregiverEmployeeProfile } from './employeeProfiles'

export const checkMembership = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const activeOrgId = getActiveClerkOrganizationId(identity)
    if (!activeOrgId || activeOrgId !== clerkOrgId) return false

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
      .unique()

    if (!tenant) return false

    const member = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
      )
      .unique()

    return !!member
  },
})

export const me = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
    return ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', identity.subject),
      )
      .unique()
  },
})

export const list = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
      .collect()

    return members
  },
})

export const listCaregivers = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:coordinator',
    ])

    const members = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_role', (q) =>
        q.eq('tenantId', tenantId).eq('role', 'org:caregiver'),
      )
      .collect()

    return members
  },
})

export const sync = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
    displayName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    requireMatchingClerkOrganization(identity, args.clerkOrgId)

    if (args.clerkUserId !== identity.subject) {
      throw new Error('Members can only self-sync from Clerk.')
    }

    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', args.clerkOrgId))
      .unique()

    if (!tenant) throw new Error('Tenant not found.')

    const tenantId = tenant._id

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    const roleFromClerk = getClerkOrganizationRole(identity)
    const role = roleFromClerk ?? existing?.role ?? 'org:caregiver'

    if (existing) {
      await ctx.db.patch(existing._id, {
        role,
        displayName: args.displayName,
        email: args.email,
      })
      if (role === 'org:caregiver') {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          { ...existing, role, displayName: args.displayName, email: args.email },
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
      return existing._id
    }

    const memberId = await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: args.clerkUserId,
      role,
      displayName: args.displayName,
      email: args.email,
    })

    if (role === 'org:caregiver') {
      const newMember = await ctx.db.get(memberId)
      if (newMember) {
        const employeeProfileId = await ensureCaregiverEmployeeProfile(
          ctx,
          tenantId,
          newMember,
        )
        if (employeeProfileId) {
          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
            employeeProfileId,
          })
        }
      }
    }

    return memberId
  },
})

export const updateRole = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    role: v.union(
      v.literal('org:admin'),
      v.literal('org:coordinator'),
      v.literal('org:caregiver'),
    ),
  },
  handler: async (ctx, args) => {
    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    if (args.clerkUserId === identity.subject) {
      throw new Error('Cannot change your own role.')
    }

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (!existing) {
      throw new Error('Member not found.')
    }

    await ctx.db.patch(existing._id, { role: args.role })

    if (args.role === 'org:caregiver') {
      const updatedMember = { ...existing, role: args.role }
      const employeeProfileId = await ensureCaregiverEmployeeProfile(
        ctx,
        tenantId,
        updatedMember,
      )
      if (employeeProfileId) {
        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
          employeeProfileId,
        })
      }
    }

    return existing._id
  },
})

export const remove = mutation({
  args: {
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
      'org:admin',
    ])

    const existing = await ctx.db
      .query('tenantMembers')
      .withIndex('by_tenant_user', (q) =>
        q.eq('tenantId', tenantId).eq('clerkUserId', args.clerkUserId),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\app\\router.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\settings\\pages\\GeofenceSettingsPage.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\components\\LocationStatusPanel.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\hooks\\useCaregiverLocation.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 779ms:
import { Navigate, Route, Routes } from 'react-router-dom'
import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { PlatformShell } from './shell/PlatformShell'
import { SelectAgencyPage } from './auth/SelectAgencyPage'
import { SignedInRouteGuard, TenantRoleRouteGuard } from './shell/RouteGuard'
import { AppLoader } from '@/shared/ui/AppLoader'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const CaregiverTodayPage = lazy(() =>
  import('@/features/caregiver/pages/CaregiverTodayPage').then((module) => ({
    default: module.CaregiverTodayPage,
  })),
)
const CoordinatorReviewPage = lazy(() =>
  import('@/features/coordinator/pages/CoordinatorReviewPage').then(
    (module) => ({
      default: module.CoordinatorReviewPage,
    }),
  ),
)
const BillingPage = lazy(() =>
  import('@/features/billing/pages/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
const ClientsPage = lazy(() =>
  import('@/features/clients/pages/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  })),
)
const TeamPage = lazy(() =>
  import('@/features/team/pages/TeamPage').then((module) => ({
    default: module.TeamPage,
  })),
)
const PlatformAdminPage = lazy(() =>
  import('@/features/platform/pages/PlatformAdminPage').then((module) => ({
    default: module.PlatformAdminPage,
  })),
)
const SearchPage = lazy(() =>
  import('@/features/search/pages/SearchPage').then((module) => ({
    default: module.SearchPage,
  })),
)
const GeofenceSettingsPage = lazy(() =>
  import('@/features/settings/pages/GeofenceSettingsPage').then((module) => ({
    default: module.GeofenceSettingsPage,
  })),
)

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoader label="Preparing workspace" />}>
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/accept-invitation/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/accept-invitation"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/create-agency"
        element={
          <SignedInRouteGuard>
            <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
              <CreateOrganization
                routing="path"
                path="/create-agency"
                afterCreateOrganizationUrl="/select-agency"
              />
            </div>
          </SignedInRouteGuard>
        }
      />
      <Route
        path="/select-agency"
        element={
          <SignedInRouteGuard>
            <SelectAgencyPage />
          </SignedInRouteGuard>
        }
      />
      <Route element={<PlatformShell />}>
        <Route
          path="platform"
          element={
            <RouteSuspense>
              <PlatformAdminPage />
            </RouteSuspense>
          }
        />
      </Route>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <DashboardPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="caregiver/today"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
              <RouteSuspense>
                <CaregiverTodayPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/review"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <CoordinatorReviewPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/billing"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <BillingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="clients"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <ClientsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="team"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
              <RouteSuspense>
                <TeamPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="search"
          element={
            <RouteSuspense>
              <SearchPage />
            </RouteSuspense>
          }
        />
        <Route
          path="settings/geofence"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <GeofenceSettingsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}


 succeeded in 732ms:
import { MapPin, MapPinOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import type { useCaregiverLocation } from '../hooks/useCaregiverLocation'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function LocationStatusPanel({
  state,
  'data-testid': testId,
}: {
  state: LocationState
  'data-testid'?: string
}) {
  const sharedProps = { 'data-testid': testId, 'data-location-status': state.status }

  if (state.status === 'idle') {
    return (
      <Card className="border-atria-border bg-atria-surface-2" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-atria-text-muted" />
          <p className="text-sm text-atria-text-secondary">
            Location will be checked when you tap Clock In.
          </p>
        </div>
      </Card>
    )
  }

  if (state.status === 'checking') {
    return (
      <Card className="border-atria-info/30 bg-atria-info-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-atria-info" />
          <p className="text-sm text-atria-info">Checking your locationÃ¢â‚¬Â¦</p>
        </div>
      </Card>
    )
  }

  if (state.status === 'granted') {
    return (
      <Card className="border-atria-success/30 bg-atria-success-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-atria-success" />
          <div className="text-sm text-atria-success">
            <p>Location available</p>
            <p className="text-xs opacity-90">
              Accuracy: {Math.round(state.location.accuracyMeters)}m
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const isBlocked =
    state.status === 'denied' ||
    state.status === 'unsupported' ||
    state.status === 'outside'
  const icon = isBlocked ? (
    <MapPinOff className="h-5 w-5 text-atria-danger" />
  ) : (
    <AlertCircle className="h-5 w-5 text-atria-warning" />
  )
  const toneClass = isBlocked
    ? 'border-atria-danger/30 bg-atria-danger-bg'
    : 'border-atria-warning/30 bg-atria-warning-bg'
  const textClass = isBlocked ? 'text-atria-danger' : 'text-atria-warning'

  return (
    <Card className={toneClass} {...sharedProps}>
      <div className="flex items-start gap-3 p-4">
        {icon}
        <p className={`text-sm ${textClass}`}>{state.message}</p>
      </div>
    </Card>
  )
}


 succeeded in 803ms:
import { useOrganization } from '@clerk/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Checkbox } from '@/shared/ui/Checkbox'
import { MapPin } from 'lucide-react'

export function GeofenceSettingsPage() {
  const { organization } = useOrganization()
  const clerkOrgId = organization?.id

  const settings = useQuery(
    api.tenantSettings.get,
    clerkOrgId ? { clerkOrgId } : 'skip',
  )
  const update = useMutation(api.tenantSettings.updateShiftGeofence)

  const [draft, setDraft] = useState<Partial<{
    enabled: boolean
    enforceClockIn: boolean
    enforceClockOut: boolean
    defaultRadiusMeters: number
    maxAccuracyMeters: number
  }>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = settings
    ? { ...settings.shiftGeofence, ...draft }
    : {
        enabled: false,
        enforceClockIn: false,
        enforceClockOut: false,
        defaultRadiusMeters: 100,
        maxAccuracyMeters: 50,
      }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-atria-muted">Loading settingsÃ¢â‚¬Â¦</div>
      </div>
    )
  }

  const handleSave = async () => {
    if (!clerkOrgId) return
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      await update({
        clerkOrgId,
        ...form,
      })
      setMessage('Geofence settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateToggle = (key: 'enabled' | 'enforceClockIn' | 'enforceClockOut') => {
    setDraft((prev) => ({ ...prev, [key]: !(prev[key] ?? form[key]) }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-atria-ink">Settings</h1>
        <p className="text-sm text-atria-muted">Clock-in location rules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-atria-accent" />
            Clock-in location rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-atria-muted">
            Require caregivers to be near the service location when clocking in
            or out. If no client address coordinates are configured, clock
            punches will be blocked when enforcement is on.
          </p>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enabled"
              checked={form.enabled}
              onChange={() => updateToggle('enabled')}
              data-testid="geofence-enabled-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enabled"
                className="text-sm font-medium text-atria-ink"
              >
                Enable geofence
              </label>
              <p className="text-xs text-atria-muted">
                Turn location validation on for the agency.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enforceClockIn"
              checked={form.enforceClockIn}
              onChange={() => updateToggle('enforceClockIn')}
              disabled={!form.enabled}
              data-testid="geofence-enforce-clock-in-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enforceClockIn"
                className="text-sm font-medium text-atria-ink"
              >
                Enforce on clock-in
              </label>
              <p className="text-xs text-atria-muted">
                Block clock-in when outside the allowed radius.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="enforceClockOut"
              checked={form.enforceClockOut}
              onChange={() => updateToggle('enforceClockOut')}
              disabled={!form.enabled}
              data-testid="geofence-enforce-clock-out-checkbox"
            />
            <div className="space-y-1">
              <label
                htmlFor="enforceClockOut"
                className="text-sm font-medium text-atria-ink"
              >
                Enforce on clock-out
              </label>
              <p className="text-xs text-atria-muted">
                Block clock-out when outside the allowed radius.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Default radius (meters)
              </label>
              <Input
                type="number"
                value={form.defaultRadiusMeters}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultRadiusMeters: Number(e.target.value),
                  }))
                }
                className="mt-1"
                data-testid="geofence-radius-input"
              />
              <p className="text-xs text-atria-muted mt-1">
                How close a caregiver must be to the service address.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-atria-muted uppercase tracking-wider">
                Max accuracy (meters)
              </label>
              <Input
                type="number"
                value={form.maxAccuracyMeters}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    maxAccuracyMeters: Number(e.target.value),
                  }))
                }
                className="mt-1"
                data-testid="geofence-accuracy-input"
              />
              <p className="text-xs text-atria-muted mt-1">
                Reject GPS readings that are too imprecise.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-geofence-button"
          >
            {isSaving ? 'SavingÃ¢â‚¬Â¦' : 'Save geofence settings'}
          </Button>

          {error && <p className="text-sm text-atria-danger" data-testid="geofence-error">{error}</p>}
          {message && <p className="text-sm text-atria-success" data-testid="geofence-message">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}


 succeeded in 779ms:
import { useCallback, useRef, useState } from 'react'

export type BrowserLocation = {
  latitude: number
  longitude: number
  accuracyMeters: number
}

type LocationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'granted'; location: BrowserLocation }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string }
  | { status: 'outside'; message: string }

export type ShiftGeofence = {
  enabled: boolean
  enforceClockIn: boolean
  enforceClockOut: boolean
}

function isLocationRequired(
  geofence: ShiftGeofence | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  if (!geofence?.enabled) return false
  return punchType === 'clock_in'
    ? geofence.enforceClockIn
    : geofence.enforceClockOut
}

function parsePosition(position: GeolocationPosition): BrowserLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
  }
}

export function useCaregiverLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' })
  const pendingRef = useRef<Promise<BrowserLocation | undefined> | null>(null)

  const requestLocation = useCallback(
    async (options?: {
      geofence?: ShiftGeofence
      punchType?: 'clock_in' | 'clock_out'
    }): Promise<BrowserLocation | undefined> => {
      const punchType = options?.punchType ?? 'clock_in'
      const required = isLocationRequired(options?.geofence, punchType)

      if (!required) {
        setState({ status: 'idle' })
        return undefined
      }

      if (!navigator.geolocation) {
        const message =
          'Your browser does not support location services. Contact your coordinator.'
        setState({ status: 'unsupported', message })
        return undefined
      }

      setState({ status: 'checking' })

      const promise = new Promise<BrowserLocation | undefined>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = parsePosition(position)
            setState({ status: 'granted', location })
            resolve(location)
          },
          (error) => {
            let message = 'Unable to read your location. Please try again.'
            if (error.code === error.PERMISSION_DENIED) {
              message =
                'Location access was denied. Enable location permissions in your browser settings to clock in.'
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message =
                'Location is temporarily unavailable. Move to an area with better GPS signal and try again.'
            } else if (error.code === error.TIMEOUT) {
              message = 'Location request timed out. Please try again.'
            }
            const denied = error.code === error.PERMISSION_DENIED
            setState({ status: denied ? 'denied' : 'error', message })
            resolve(undefined)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })

      pendingRef.current = promise
      return promise
    },
    [],
  )

  const setOutsideError = useCallback((message: string) => {
    setState({ status: 'outside', message })
  }, [])

  const clearLocationError = useCallback(() => {
    setState({ status: 'idle' })
  }, [])

  return {
    state,
    requestLocation,
    setOutsideError,
    clearLocationError,
  }
}


codex
The geofence UI uses a single hook that only marks â€œoutsideâ€ after a server error; Playwrightâ€™s outside-radius test expects that state before clicking Clock In. Iâ€™m reading the clock-in component to confirm whether that assertion can ever pass.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\components\\ShiftClockInScreen.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\components\\ShiftClockOutScreen.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\components\\ShiftDocumentationForm.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src\\features\\caregiver\\hooks\\useCaregiverLocation.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 706ms:
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { LocationStatusPanel } from './LocationStatusPanel'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime, formatDurationHours } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockInScreen({
  scheduledStart,
  scheduledEnd,
  clientName,
  address,
  geofence,
  locationState,
  isLoading,
  onClockIn,
}: {
  scheduledStart: string
  scheduledEnd: string
  clientName: string
  address: string
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockIn: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const duration = formatDurationHours(scheduledStart, scheduledEnd)
  const start = formatTime(scheduledStart)
  const end = formatTime(scheduledEnd)

  const locationBlocked =
    geofence.enabled &&
    geofence.enforceClockIn &&
    (locationState.status === 'denied' ||
      locationState.status === 'unsupported' ||
      locationState.status === 'outside')

  return (
    <div className="space-y-3" data-testid="shift-clock-in-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock in</h2>
        <p className="text-base text-atria-text-secondary">
          Start your shift to begin your notes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold text-atria-ink">{clientName}</p>
            <p className="text-base text-atria-text-secondary">
              Ã°Å¸â€¢Â {start} Ã¢â‚¬â€œ {end} {duration && ` Ã‚Â· ${duration}`}
            </p>
          </div>
          <div className="flex items-start gap-2 text-base text-atria-text-secondary">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{address}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      {geofence.enabled && geofence.enforceClockIn && (
        <LocationStatusPanel state={locationState} data-testid="clock-in-location-panel" />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockIn}
        disabled={isLoading || locationBlocked}
        data-testid="clock-in-button"
      >
        {isLoading ? 'Clocking inÃ¢â‚¬Â¦' : 'Clock in now'}
        {!isLoading && <span className="ml-2">Ã¢â€ â€™</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your start time is sent to ADP for payroll. You can begin your shift notes right after clocking in.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}


 succeeded in 676ms:
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import {
  createTaskDrafts,
  noteDraftFromNote,
  buildServicesProvided,
  buildClientResponse,
  parseSelectedServices,
  parseSelectedGoals,
  parseIssueChoice,
  type NoteDraft,
  type TaskDraft,
  type ServiceLabel,
  type GoalLabel,
  type IssueChoice,
} from '../model/documentationDraft'
import {
  WIZARD_STEPS,
  validateDocumentationDraft,
  validateStep,
  buildAutosavePatch,
} from '../model/documentationWizard'
import { useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { Button } from '@/shared/ui/Button'
import { ShiftClockInScreen } from './ShiftClockInScreen'
import { ShiftClockOutScreen } from './ShiftClockOutScreen'
import { ShiftNoteStep } from './ShiftNoteStep'
import { ShiftSuccessScreen } from './ShiftSuccessScreen'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { formatStreetAddress } from '@/shared/format'

type ShiftDetails = FunctionReturnType<typeof api.shiftQueries.getWithDetails>
type TenantSettings = FunctionReturnType<typeof api.tenantSettings.get>
type TaskId = ShiftDetails['tasks'][number]['_id']
type TaskDraftList = TaskDraft<TaskId>[]

const TERMINAL_STATUSES = new Set([
  'submitted',
  'approved',
  'billing_ready',
])

function defaultGeofence(settings: TenantSettings | undefined) {
  return {
    enabled: settings?.shiftGeofence.enabled ?? false,
    enforceClockIn: settings?.shiftGeofence.enforceClockIn ?? false,
    enforceClockOut: settings?.shiftGeofence.enforceClockOut ?? false,
  }
}

export function ShiftDocumentationForm({
  clerkOrgId,
  shiftId,
  firstName,
  onDone,
}: {
  clerkOrgId: string
  shiftId: Id<'shifts'>
  firstName?: string
  onDone?: () => void
}) {
  const details = useQuery(api.shiftQueries.getWithDetails, {
    clerkOrgId,
    shiftId,
  })
  const settings = useQuery(api.tenantSettings.get, { clerkOrgId })

  if (!details || !settings) {
    return (
      <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface p-6">
        <div className="text-sm text-atria-muted">Loading shift detailsÃ¢â‚¬Â¦</div>
      </div>
    )
  }

  return (
    <ShiftDocumentationWizard
      clerkOrgId={clerkOrgId}
      details={details}
      settings={settings}
      shiftId={shiftId}
      firstName={firstName}
      onDone={onDone}
    />
  )
}

function ShiftDocumentationWizard({
  clerkOrgId,
  details,
  settings,
  shiftId,
  firstName,
  onDone,
}: {
  clerkOrgId: string
  details: ShiftDetails
  settings: TenantSettings
  shiftId: Id<'shifts'>
  firstName?: string
  onDone?: () => void
}) {
  const [note, setNote] = useState<NoteDraft>(() => noteDraftFromNote(details.note))
  const [taskDrafts, setTaskDrafts] = useState<TaskDraftList>(() =>
    createTaskDrafts(details.tasks),
  )
  const [selectedServices, setSelectedServices] = useState<ServiceLabel[]>(() =>
    parseSelectedServices(details.note?.servicesProvided),
  )
  const [selectedGoals, setSelectedGoals] = useState<GoalLabel[]>(() =>
    parseSelectedGoals(details.note?.servicesProvided),
  )
  const [issueChoice, setIssueChoice] = useState<IssueChoice | null>(() =>
    parseIssueChoice(details.note?.clientResponse),
  )
  const [confirmed, setConfirmed] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [view, setView] = useState<'clockIn' | 'wizard' | 'clockOut' | 'success'>(() => {
    if (TERMINAL_STATUSES.has(details.shift.status)) return 'success'
    if (details.shift.clockInAt) return 'wizard'
    return 'clockIn'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPunchLoading, setIsPunchLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const geofence = useMemo(
    () => defaultGeofence(settings),
    [settings],
  )
  const { state: locationState, requestLocation, setOutsideError, clearLocationError } = useCaregiverLocation()

  const clockIn = useMutation(api.shifts.clockIn)
  const clockOut = useMutation(api.shifts.clockOut)
  const updateProgressNote = useMutation(api.shifts.updateProgressNote)

  const blockers = useMemo(
    () => validateDocumentationDraft(note, taskDrafts, details.tasks),
    [note, taskDrafts, details.tasks],
  )

  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autosave = (patch: Partial<NoteDraft>) => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
    setSaved(false)
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (Object.keys(patch).length === 0) return
      setIsSaving(true)
      setSaveError(null)
      try {
        await updateProgressNote({
          clerkOrgId,
          shiftId,
          ...patch,
        })
        setSaved(true)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Autosave failed')
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleNoteChange = (next: NoteDraft) => {
    setNote(next)
    const stepId = WIZARD_STEPS[currentStepIndex].id
    const patch = buildAutosavePatch(stepId, next)
    autosave(patch)
  }

  const updateServicesAndGoals = (
    services: ServiceLabel[],
    goals: GoalLabel[],
  ) => {
    const servicesProvided = buildServicesProvided(services, goals)
    setSelectedServices(services)
    setSelectedGoals(goals)
    const next = { ...note, servicesProvided }
    setNote(next)
    autosave({ servicesProvided })
  }

  const updateIssueChoice = (choice: IssueChoice) => {
    setIssueChoice(choice)
    const clientResponse = buildClientResponse(choice)
    const next = { ...note, clientResponse }
    setNote(next)
    autosave({ clientResponse })
  }

  const handleClockIn = async () => {
    setSaveError(null)
    setIsPunchLoading(true)
    try {
      const location = await requestLocation({
        geofence,
        punchType: 'clock_in',
      })
      const locationRequired = geofence.enabled && geofence.enforceClockIn
      if (locationRequired && !location) {
        return
      }
      await clockIn({ clerkOrgId, shiftId, location })
      setView('wizard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clock in failed'
      if (message.toLowerCase().includes('outside')) {
        setOutsideError(message)
      } else {
        setSaveError(message)
      }
    } finally {
      setIsPunchLoading(false)
    }
  }

  const handleClockOut = async () => {
    setSaveError(null)
    setIsPunchLoading(true)
    try {
      const location = await requestLocation({
        geofence,
        punchType: 'clock_out',
      })
      await clockOut({
        clerkOrgId,
        shiftId,
        location,
        note,
        tasks: taskDrafts,
      })
      setView('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clock out failed'
      if (message.toLowerCase().includes('outside')) {
        setOutsideError(message)
      } else {
        setSaveError(message)
      }
    } finally {
      setIsPunchLoading(false)
    }
  }

  const currentStepId = WIZARD_STEPS[currentStepIndex].id
  const stepBlockers = validateStep(currentStepId, note, taskDrafts, details.tasks)

  const isDoneStep = currentStepIndex === WIZARD_STEPS.length - 1
  const canAdvance =
    stepBlockers.length === 0 &&
    (currentStepId !== 'what' || selectedServices.length > 0) &&
    (currentStepId !== 'goal' || selectedGoals.length > 0) &&
    (currentStepId !== 'issues' || issueChoice !== null)
  const canSubmitDone = canAdvance && confirmed

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1)
    } else {
      setView('clockOut')
    }
  }

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1)
    } else {
      setView('clockIn')
      clearLocationError()
    }
  }

  const editStep = (stepIndex: number) => {
    setCurrentStepIndex(stepIndex)
  }

  const clientName = details.client?.displayName ?? 'Client'
  const address = details.client?.serviceAddress
    ? formatStreetAddress(details.client.serviceAddress)
    : 'No address'

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (view === 'clockOut') {
      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
        // Location errors are captured in locationState; surface them via the checklist.
      })
    }
  }, [view, geofence, requestLocation])

  if (view === 'success') {
    return (
      <ShiftSuccessScreen
        firstName={firstName ?? ''}
        clientName={clientName}
        onHome={() => {
          onDone?.()
          setView('clockIn')
          setCurrentStepIndex(0)
          setConfirmed(false)
          clearLocationError()
        }}
      />
    )
  }

  if (view === 'clockIn') {
    return (
      <ShiftClockInScreen
        scheduledStart={details.shift.scheduledStart}
        scheduledEnd={details.shift.scheduledEnd}
        clientName={clientName}
        address={address}
        geofence={geofence}
        locationState={locationState}
        isLoading={isPunchLoading}
        onClockIn={handleClockIn}
      />
    )
  }

  if (view === 'clockOut') {
    return (
      <ShiftClockOutScreen
        scheduledStart={details.shift.scheduledStart}
        clientName={clientName}
        actualClockInAt={details.shift.clockInAt}
        blockers={blockers}
        geofence={geofence}
        locationState={locationState}
        isLoading={isPunchLoading}
        onClockOut={handleClockOut}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <ShiftNoteStep
          stepId={currentStepId}
          stepIndex={currentStepIndex}
          note={note}
          onNoteChange={handleNoteChange}
          taskDrafts={taskDrafts}
          onTaskDraftsChange={setTaskDrafts}
          tasks={details.tasks}
          editable
          clerkOrgId={clerkOrgId}
          clientName={clientName}
          selectedServices={selectedServices}
          selectedGoals={selectedGoals}
          issueChoice={issueChoice}
          confirmed={confirmed}
          onSelectedServicesChange={(services) =>
            updateServicesAndGoals(services, selectedGoals)
          }
          onSelectedGoalsChange={(goals) =>
            updateServicesAndGoals(selectedServices, goals)
          }
          onIssueChoiceChange={updateIssueChoice}
          onConfirmedChange={setConfirmed}
          onEditStep={editStep}
          isSaving={isSaving}
          saved={saved}
        />
      </div>

      {saveError && (
        <div className="mb-4 rounded-[var(--radius-atria-md)] border border-atria-danger/30 bg-atria-danger-bg p-3 text-sm text-atria-danger" data-testid="save-error">
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="h-[52px] min-w-[44px]"
          onClick={goBack}
          data-testid="wizard-back-button"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </Button>

        <Button
          variant="primary"
          size="lg"
          className={cn(
            'h-[52px] min-w-[44px] rounded-full',
            currentStepId !== 'issues' && WIZARD_STEPS[currentStepIndex].bgAccent,
          )}
          onClick={goNext}
          disabled={isDoneStep ? !canSubmitDone : !canAdvance}
          data-testid="wizard-next-button"
        >
          {isDoneStep ? 'Submit my notes' : 'Next Step'}
          {isDoneStep ? (
            <span className="ml-2">Ã¢Å“â€œ</span>
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}


 succeeded in 695ms:
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { LocationStatusPanel } from './LocationStatusPanel'
import { MissingChecklist, CompleteChecklist } from './MissingChecklist'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockOutScreen({
  scheduledStart,
  clientName,
  actualClockInAt,
  actualClockOutAt,
  blockers,
  geofence,
  locationState,
  isLoading,
  onClockOut,
}: {
  scheduledStart: string
  clientName: string
  actualClockInAt?: string | null
  actualClockOutAt?: string | null
  blockers: string[]
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockOut: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const locationRequired = geofence.enabled && geofence.enforceClockOut
  const locationReady = !locationRequired || locationState.status === 'granted'
  const canSubmit = blockers.length === 0 && locationReady && !isLoading

  const clockInTime = actualClockInAt ? formatTime(actualClockInAt) : formatTime(scheduledStart)
  const clockOutTime = actualClockOutAt
    ? formatTime(actualClockOutAt)
    : currentTime

  return (
    <div className="space-y-3" data-testid="shift-clock-out-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock out</h2>
        <p className="text-base text-atria-text-secondary">
          Your shift notes are complete. You can clock out now.
        </p>
      </div>

      <Badge variant="success" className="h-8 px-3 text-sm">
        Ã¢Å“â€œ Shift note done
      </Badge>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
            Shift summary
          </p>
          <div className="flex items-start gap-2 text-base text-atria-ink">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-atria-text-muted" />
            <span>
              {clientName} Ã‚Â· {clockInTime} Ã¢â‚¬â€œ {clockOutTime}
            </span>
          </div>
        </CardContent>
      </Card>

      {locationRequired && <LocationStatusPanel state={locationState} data-testid="clock-out-location-panel" />}

      {canSubmit ? <CompleteChecklist data-testid="complete-checklist" /> : (
        <MissingChecklist
          blockers={blockers}
          geofence={geofence}
          locationState={locationState}
          data-testid="missing-checklist"
        />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockOut}
        disabled={!canSubmit}
        data-testid="clock-out-button"
      >
        {isLoading ? 'SubmittingÃ¢â‚¬Â¦' : 'Clock out now'}
        {!isLoading && <span className="ml-2">Ã¢â€ â€™</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your end time is sent to ADP for payroll. Your shift note stays in ATRIA-X for your coordinator to review.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}


 succeeded in 678ms:
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCaregiverLocation } from './useCaregiverLocation'

const mockGetCurrentPosition = vi.fn()

describe('useCaregiverLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns idle when geofence is disabled', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    const location = await act(async () =>
      result.current.requestLocation({ geofence: { enabled: false, enforceClockIn: false, enforceClockOut: false } }),
    )
    expect(location).toBeUndefined()
    expect(result.current.state.status).toBe('idle')
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it('requests location when geofence is enabled for clock-in', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('granted'))
    expect(mockGetCurrentPosition).toHaveBeenCalledOnce()
  })

  it('shows denied state when permission is denied', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((_: unknown, error: (e: GeolocationPositionError) => void) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('denied'))
    expect('message' in result.current.state ? result.current.state.message : '').toContain('denied')
  })

  it('shows outside error from server rejection', () => {
    const { result } = renderHook(() => useCaregiverLocation())
    act(() => result.current.setOutsideError('You are 500m outside the allowed radius.'))
    expect(result.current.state.status).toBe('outside')
    expect('message' in result.current.state ? result.current.state.message : '').toContain('500m')
  })

  it('does not request location when enforcement is disabled for the punch type', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: false, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })
})


codex
Confirmed: `ShiftClockInScreen` does not proactively request location. Outside/denied states are only produced after the user attempts clock-in, so two new geofence tests would hang or fail as soon as credentials are configured.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "requestLocation|handleClockIn|setOutsideError|locationBlocked|clock-in-button|clock-in-location-panel" src/features/caregiver/components/ShiftDocumentationForm.tsx src/features/caregiver/components/ShiftClockInScreen.tsx src/features/caregiver/hooks/useCaregiverLocation.ts tests/e2e/geofence.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"data-location-status', 'outside|data-location-status', 'denied|clockInButton|toBeDisabled|clock-in-button\" tests/e2e/geofence.spec.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "E2E_ORG_ID|E2E_ADMIN_EMAIL|localStorage|getItem|seedE2E" tests/e2e/global-setup.ts tests/e2e/helpers/auth.ts convex/seed.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"currentStepIndex|goNext|setView\\('clockOut'\\)|clock-out-button|toBeDisabled|toBeEnabled|complete-checklist\" src/features/caregiver/components/ShiftDocumentationForm.tsx tests/e2e/phase1-lifecycle.spec.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 738ms:
tests/e2e/geofence.spec.ts:45:  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
tests/e2e/geofence.spec.ts:49:  await page.locator('[data-testid="clock-in-button"]').click()
tests/e2e/geofence.spec.ts:97:  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
tests/e2e/geofence.spec.ts:101:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
tests/e2e/geofence.spec.ts:116:  const locationPanel = page.locator('[data-testid="clock-in-location-panel"]')
tests/e2e/geofence.spec.ts:120:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
tests/e2e/geofence.spec.ts:145:  await expect(page.locator('[data-testid="clock-in-location-panel"]')).toHaveCount(0)
tests/e2e/geofence.spec.ts:146:  await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()
src/features/caregiver/hooks/useCaregiverLocation.ts:46:  const requestLocation = useCallback(
src/features/caregiver/hooks/useCaregiverLocation.ts:100:  const setOutsideError = useCallback((message: string) => {
src/features/caregiver/hooks/useCaregiverLocation.ts:110:    requestLocation,
src/features/caregiver/hooks/useCaregiverLocation.ts:111:    setOutsideError,
src/features/caregiver/components/ShiftClockInScreen.tsx:43:  const locationBlocked =
src/features/caregiver/components/ShiftClockInScreen.tsx:84:        <LocationStatusPanel state={locationState} data-testid="clock-in-location-panel" />
src/features/caregiver/components/ShiftClockInScreen.tsx:92:        disabled={isLoading || locationBlocked}
src/features/caregiver/components/ShiftClockInScreen.tsx:93:        data-testid="clock-in-button"
src/features/caregiver/components/ShiftDocumentationForm.tsx:136:  const { state: locationState, requestLocation, setOutsideError, clearLocationError } = useCaregiverLocation()
src/features/caregiver/components/ShiftDocumentationForm.tsx:200:  const handleClockIn = async () => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:204:      const location = await requestLocation({
src/features/caregiver/components/ShiftDocumentationForm.tsx:217:        setOutsideError(message)
src/features/caregiver/components/ShiftDocumentationForm.tsx:230:      const location = await requestLocation({
src/features/caregiver/components/ShiftDocumentationForm.tsx:245:        setOutsideError(message)
src/features/caregiver/components/ShiftDocumentationForm.tsx:301:      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:305:  }, [view, geofence, requestLocation])
src/features/caregiver/components/ShiftDocumentationForm.tsx:333:        onClockIn={handleClockIn}

 succeeded in 747ms:
49:  await page.locator('[data-testid="clock-in-button"]').click()
99:  await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
101:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
102:  await expect(clockInButton).toBeDisabled()
118:  await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
120:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
121:  await expect(clockInButton).toBeDisabled()
146:  await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()

 succeeded in 691ms:
tests/e2e/phase1-lifecycle.spec.ts:88:  await expect(page.locator('[data-testid="complete-checklist"]')).toBeVisible()
tests/e2e/phase1-lifecycle.spec.ts:89:  const clockOutButton = page.locator('[data-testid="clock-out-button"]')
tests/e2e/phase1-lifecycle.spec.ts:90:  await expect(clockOutButton).toBeEnabled()
tests/e2e/phase1-lifecycle.spec.ts:139:  await page.locator('[data-testid="clock-out-button"]').click()
src/features/caregiver/components/ShiftDocumentationForm.tsx:121:  const [currentStepIndex, setCurrentStepIndex] = useState(0)
src/features/caregiver/components/ShiftDocumentationForm.tsx:175:    const stepId = WIZARD_STEPS[currentStepIndex].id
src/features/caregiver/components/ShiftDocumentationForm.tsx:254:  const currentStepId = WIZARD_STEPS[currentStepIndex].id
src/features/caregiver/components/ShiftDocumentationForm.tsx:257:  const isDoneStep = currentStepIndex === WIZARD_STEPS.length - 1
src/features/caregiver/components/ShiftDocumentationForm.tsx:265:  const goNext = () => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:266:    if (currentStepIndex < WIZARD_STEPS.length - 1) {
src/features/caregiver/components/ShiftDocumentationForm.tsx:269:      setView('clockOut')
src/features/caregiver/components/ShiftDocumentationForm.tsx:274:    if (currentStepIndex > 0) {
src/features/caregiver/components/ShiftDocumentationForm.tsx:358:          stepIndex={currentStepIndex}
src/features/caregiver/components/ShiftDocumentationForm.tsx:408:            currentStepId !== 'issues' && WIZARD_STEPS[currentStepIndex].bgAccent,
src/features/caregiver/components/ShiftDocumentationForm.tsx:410:          onClick={goNext}

 succeeded in 711ms:
tests/e2e/helpers/auth.ts:3:export const E2E_ORG_ID = process.env.E2E_CLERK_ORG_ID ?? ''
tests/e2e/helpers/auth.ts:4:export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
tests/e2e/helpers/auth.ts:13:    E2E_ORG_ID &&
tests/e2e/helpers/auth.ts:14:      E2E_ADMIN_EMAIL &&
tests/e2e/helpers/auth.ts:77:    localStorage.clear()
convex/seed.ts:508:export const seedE2E = mutation({
tests/e2e/global-setup.ts:3:  E2E_ADMIN_EMAIL,
tests/e2e/global-setup.ts:5:  E2E_ORG_ID,
tests/e2e/global-setup.ts:10:async function seedE2EFixtures(authToken: string) {
tests/e2e/global-setup.ts:24:      path: 'seed:seedE2E',
tests/e2e/global-setup.ts:25:      args: { clerkOrgId: E2E_ORG_ID },
tests/e2e/global-setup.ts:32:    throw new Error(`seedE2E failed: ${response.status} ${text}`)
tests/e2e/global-setup.ts:36:  console.log('seedE2E result:', result)
tests/e2e/global-setup.ts:51:    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
tests/e2e/global-setup.ts:53:    // Extract the Clerk session token from localStorage. The exact key can vary
tests/e2e/global-setup.ts:58:        const value = localStorage.getItem(key)
tests/e2e/global-setup.ts:67:      await seedE2EFixtures(token)

codex
I have enough for concrete blockers now, but Iâ€™m doing one final pass over generated/API changes and config changes so the review does not miss a build or contract issue hidden outside the new specs.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- convex/_generated/api.d.ts convex/_generated/api.js convex/_generated/server.d.ts convex/_generated/server.js' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- eslint.config.js vite.config.ts tsconfig.app.json .env.example' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff -- src/shared/ui/Button.tsx src/shared/ui/Badge.tsx src/index.css' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "requireTenant|requireTenantRole|assertTenantDoc|tenantId" convex/*.ts convex/integrations/**/*.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 795ms:
diff --git a/convex/_generated/api.d.ts b/convex/_generated/api.d.ts
index 761762f..94d0379 100644
--- a/convex/_generated/api.d.ts
+++ b/convex/_generated/api.d.ts
@@ -8,11 +8,7 @@
  * @module
  */
 
-import type {
-  ApiFromModules,
-  FilterApi,
-  FunctionReference,
-} from "convex/server";
+import type * as adpOutbound from "../adpOutbound.js";
 import type * as adpSync from "../adpSync.js";
 import type * as audit from "../audit.js";
 import type * as authHelpers from "../authHelpers.js";
@@ -20,7 +16,13 @@ import type * as billing from "../billing.js";
 import type * as billingHelpers from "../billingHelpers.js";
 import type * as clients from "../clients.js";
 import type * as embedding from "../embedding.js";
+import type * as employeeProfiles from "../employeeProfiles.js";
 import type * as files from "../files.js";
+import type * as integrations_adp_adpClient from "../integrations/adp/adpClient.js";
+import type * as integrations_adp_adpPort from "../integrations/adp/adpPort.js";
+import type * as integrations_adp_config from "../integrations/adp/config.js";
+import type * as integrations_adp_errors from "../integrations/adp/errors.js";
+import type * as integrations_adp_mockAdp from "../integrations/adp/mockAdp.js";
 import type * as invitations from "../invitations.js";
 import type * as locationValidation from "../locationValidation.js";
 import type * as members from "../members.js";
@@ -36,15 +38,14 @@ import type * as tenantSettings from "../tenantSettings.js";
 import type * as tenants from "../tenants.js";
 import type * as timePunches from "../timePunches.js";
 
-/**
- * A utility for referencing Convex functions in your app's API.
- *
- * Usage:
- * ```js
- * const myFunctionReference = api.myModule.myFunction;
- * ```
- */
+import type {
+  ApiFromModules,
+  FilterApi,
+  FunctionReference,
+} from "convex/server";
+
 declare const fullApi: ApiFromModules<{
+  adpOutbound: typeof adpOutbound;
   adpSync: typeof adpSync;
   audit: typeof audit;
   authHelpers: typeof authHelpers;
@@ -52,7 +53,13 @@ declare const fullApi: ApiFromModules<{
   billingHelpers: typeof billingHelpers;
   clients: typeof clients;
   embedding: typeof embedding;
+  employeeProfiles: typeof employeeProfiles;
   files: typeof files;
+  "integrations/adp/adpClient": typeof integrations_adp_adpClient;
+  "integrations/adp/adpPort": typeof integrations_adp_adpPort;
+  "integrations/adp/config": typeof integrations_adp_config;
+  "integrations/adp/errors": typeof integrations_adp_errors;
+  "integrations/adp/mockAdp": typeof integrations_adp_mockAdp;
   invitations: typeof invitations;
   locationValidation: typeof locationValidation;
   members: typeof members;
@@ -68,11 +75,31 @@ declare const fullApi: ApiFromModules<{
   tenants: typeof tenants;
   timePunches: typeof timePunches;
 }>;
+
+/**
+ * A utility for referencing Convex functions in your app's public API.
+ *
+ * Usage:
+ * ```js
+ * const myFunctionReference = api.myModule.myFunction;
+ * ```
+ */
 export declare const api: FilterApi<
   typeof fullApi,
   FunctionReference<any, "public">
 >;
+
+/**
+ * A utility for referencing Convex functions in your app's internal API.
+ *
+ * Usage:
+ * ```js
+ * const myFunctionReference = internal.myModule.myFunction;
+ * ```
+ */
 export declare const internal: FilterApi<
   typeof fullApi,
   FunctionReference<any, "internal">
 >;
+
+export declare const components: {};
diff --git a/convex/_generated/api.js b/convex/_generated/api.js
index 3f9c482..44bf985 100644
--- a/convex/_generated/api.js
+++ b/convex/_generated/api.js
@@ -8,7 +8,7 @@
  * @module
  */
 
-import { anyApi } from "convex/server";
+import { anyApi, componentsGeneric } from "convex/server";
 
 /**
  * A utility for referencing Convex functions in your app's API.
@@ -20,3 +20,4 @@ import { anyApi } from "convex/server";
  */
 export const api = anyApi;
 export const internal = anyApi;
+export const components = componentsGeneric();
diff --git a/convex/_generated/server.d.ts b/convex/_generated/server.d.ts
index e22cbd9..bec05e6 100644
--- a/convex/_generated/server.d.ts
+++ b/convex/_generated/server.d.ts
@@ -95,8 +95,6 @@ export declare const internalAction: ActionBuilder<DataModel, "internal">;
  */
 export declare const httpAction: HttpActionBuilder;
 
-export declare const env: Record<string, string | undefined>;
-
 /**
  * A set of services for use within Convex query functions.
  *
diff --git a/convex/_generated/server.js b/convex/_generated/server.js
index 79c6b77..bf3d25a 100644
--- a/convex/_generated/server.js
+++ b/convex/_generated/server.js
@@ -91,5 +91,3 @@ export const internalAction = internalActionGeneric;
  * @returns The wrapped function. Import this function from `convex/http.js` and route it to hook it up.
  */
 export const httpAction = httpActionGeneric;
-
-export const env = process.env;
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it

2026-06-26T23:12:10.696839Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.8 seconds
Output:
rg: convex/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)
rg: convex/integrations/**/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 exited 1 in 811ms:
rg: convex/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)
rg: convex/integrations/**/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 succeeded in 814ms:
diff --git a/src/index.css b/src/index.css
index 4d30df2..c52e137 100644
--- a/src/index.css
+++ b/src/index.css
@@ -1,31 +1,75 @@
 @import "tailwindcss";
 
-@theme inline {
+@theme {
   --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
-  --color-atria-bg: #f4f7f8;
-  --color-atria-surface: #ffffff;
-  --color-atria-sidebar: #17232b;
-  --color-atria-ink: #17212b;
-  --color-atria-muted: #667085;
-  --color-atria-border: #d9e3e7;
-  --color-atria-accent: #0f766e;
-  --color-atria-accent-hover: #115e59;
-  --color-atria-success: #16834f;
-  --color-atria-success-bg: rgba(22, 131, 79, 0.1);
-  --color-atria-warning: #b7791f;
-  --color-atria-warning-bg: rgba(183, 121, 31, 0.12);
-  --color-atria-danger: #b42318;
-  --color-atria-danger-bg: rgba(180, 35, 24, 0.1);
-  --color-atria-info: #2563eb;
-  --color-atria-info-bg: rgba(37, 99, 235, 0.1);
-  --color-atria-sidebar-text: #b9c5cb;
-  --color-atria-sidebar-active: #ffffff;
+
+  /* Default mode: Dark. Source: design-system-tokens.md (v1). */
+  --color-atria-bg: #0a0e0f;
+  --color-atria-bg-sunken: #070a0b;
+  --color-atria-surface: #11171a;
+  --color-atria-surface-2: #161d21;
+  --color-atria-surface-3: #1c262b;
+  --color-atria-sidebar: #0c1113;
+  --color-atria-ink: #f2f6f7;
+  --color-atria-text-primary: #f2f6f7;
+  --color-atria-text-secondary: #aebcc2;
+  --color-atria-muted: #6e808a;      /* legacy alias; prefer --color-atria-text-muted */
+  --color-atria-text-muted: #6e808a;
+  --color-atria-text-disabled: #49575e;
+  --color-atria-on-accent: #04140e;
+  --color-atria-border: #2a373d;
+  --color-atria-border-subtle: #1f2a2f;
+  --color-atria-border-strong: #3a4a52;
+  --color-atria-accent: #16a34a;
+  --color-atria-accent-hover: #15833d;
+  --color-atria-accent-quiet: rgba(22, 163, 74, 0.14);
+  --color-atria-success: #2fbf71;
+  --color-atria-success-bg: rgba(47, 191, 113, 0.14);
+  --color-atria-warning: #f0b429;
+  --color-atria-warning-bg: rgba(240, 180, 41, 0.14);
+  --color-atria-danger: #f0564a;
+  --color-atria-danger-bg: rgba(240, 86, 74, 0.14);
+  --color-atria-info: #4d8df6;
+  --color-atria-info-bg: rgba(77, 141, 246, 0.14);
+  --color-atria-neutral: #8a99a0;
+  --color-atria-neutral-bg: rgba(138, 153, 160, 0.12);
+  --color-atria-sidebar-text: #aebcc2;
+  --color-atria-sidebar-active: #f2f6f7;
+
+  /* Step accents used by the Progress Note wizard. */
+  --color-atria-step-when: #3b82f6;
+  --color-atria-step-what: #a855f7;
+  --color-atria-step-how: #f59e0b;
+  --color-atria-step-goal: #14b8a6;
+  --color-atria-step-issues: #ef4444;
+  --color-atria-step-done: #16a34a;
+
+  /* Radius scale. */
   --radius-atria: 8px;
+  --radius-atria-sm: 8px;
+  --radius-atria-md: 12px;
+  --radius-atria-lg: 16px;
+  --radius-atria-xl: 20px;
+  --radius-atria-pill: 999px;
+
+  /* Sizing / touch targets. */
+  --size-control-md: 40px;
+  --size-control-lg: 52px;
+  --size-tile: 88px;
+  --size-sidebar: 248px;
+  --size-topbar: 64px;
+  --size-kpi-card: 140px;
+  --size-avatar: 36px;
+
+  /* Elevation. */
+  --shadow-atria-card: 0 1px 2px rgba(0, 0, 0, 0.4);
+  --shadow-atria-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
 }
 
 :root {
   color: var(--color-atria-ink);
   background: var(--color-atria-bg);
+  font-size: 16px;
   font-synthesis: none;
   text-rendering: optimizeLegibility;
   -webkit-font-smoothing: antialiased;
@@ -56,7 +100,7 @@ a {
   text-decoration: none;
 }
 
-/* Scrollbar styling */
+/* Scrollbar styling (dark mode default). */
 ::-webkit-scrollbar {
   width: 6px;
   height: 6px;
@@ -65,9 +109,58 @@ a {
   background: transparent;
 }
 ::-webkit-scrollbar-thumb {
-  background: #b9c5cb;
+  background: var(--color-atria-border-strong);
   border-radius: 3px;
 }
 ::-webkit-scrollbar-thumb:hover {
+  background: #4a5a62;
+}
+
+/**
+ * Light mode palette (preserved for a future theme toggle).
+ * Apply `.light` or `data-theme="light"` on <html> or a parent to restore the
+ * legacy light values that lived in @theme inline before this dark port.
+ */
+.light,
+[data-theme="light"] {
+  --color-atria-bg: #f4f7f8;
+  --color-atria-bg-sunken: #e8edf0;
+  --color-atria-surface: #ffffff;
+  --color-atria-surface-2: #f8f9fa;
+  --color-atria-surface-3: #f1f3f5;
+  --color-atria-sidebar: #17232b;
+  --color-atria-ink: #17212b;
+  --color-atria-text-primary: #17212b;
+  --color-atria-text-secondary: #344054;
+  --color-atria-muted: #667085;      /* legacy alias; prefer --color-atria-text-muted */
+  --color-atria-text-muted: #667085;
+  --color-atria-text-disabled: #98a2b3;
+  --color-atria-on-accent: #ffffff;
+  --color-atria-border: #d9e3e7;
+  --color-atria-border-subtle: #e4e7ec;
+  --color-atria-border-strong: #98a2b3;
+  --color-atria-accent: #0f766e;
+  --color-atria-accent-hover: #115e59;
+  --color-atria-accent-quiet: rgba(15, 118, 110, 0.1);
+  --color-atria-success: #16834f;
+  --color-atria-success-bg: rgba(22, 131, 79, 0.1);
+  --color-atria-warning: #b7791f;
+  --color-atria-warning-bg: rgba(183, 121, 31, 0.12);
+  --color-atria-danger: #b42318;
+  --color-atria-danger-bg: rgba(180, 35, 24, 0.1);
+  --color-atria-info: #2563eb;
+  --color-atria-info-bg: rgba(37, 99, 235, 0.1);
+  --color-atria-neutral: #667085;
+  --color-atria-neutral-bg: rgba(102, 112, 133, 0.1);
+  --color-atria-sidebar-text: #b9c5cb;
+  --color-atria-sidebar-active: #ffffff;
+}
+
+.light ::-webkit-scrollbar-thumb,
+[data-theme="light"] ::-webkit-scrollbar-thumb {
+  background: #b9c5cb;
+}
+.light ::-webkit-scrollbar-thumb:hover,
+[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
   background: #8fa0a8;
 }
diff --git a/src/shared/ui/Badge.tsx b/src/shared/ui/Badge.tsx
index 58f2cd2..0ee29dd 100644
--- a/src/shared/ui/Badge.tsx
+++ b/src/shared/ui/Badge.tsx
@@ -7,12 +7,13 @@ const badgeStyles = cva(
   {
     variants: {
       variant: {
-        default: 'bg-atria-bg text-atria-muted',
+        default: 'bg-atria-surface-2 text-atria-text-secondary',
         success: 'bg-atria-success-bg text-atria-success',
         warning: 'bg-atria-warning-bg text-atria-warning',
         danger: 'bg-atria-danger-bg text-atria-danger',
         info: 'bg-atria-info-bg text-atria-info',
-        accent: 'bg-atria-accent/10 text-atria-accent',
+        neutral: 'bg-atria-neutral-bg text-atria-neutral',
+        accent: 'bg-atria-accent-quiet text-atria-accent',
       },
     },
     defaultVariants: {
diff --git a/src/shared/ui/Button.tsx b/src/shared/ui/Button.tsx
index 961b9ae..c3e1b5f 100644
--- a/src/shared/ui/Button.tsx
+++ b/src/shared/ui/Button.tsx
@@ -3,27 +3,29 @@ import { cva, type VariantProps } from 'class-variance-authority'
 import { cn } from '@/shared/lib/cn'
 
 const buttonStyles = cva(
-  'inline-flex items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45',
+  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-atria-md)] px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:bg-atria-surface-2 disabled:text-atria-text-disabled disabled:border-atria-border disabled:opacity-100 focus:outline-none focus:ring-2 focus:ring-atria-accent/60 focus:ring-offset-2 focus:ring-offset-atria-bg',
   {
     variants: {
       variant: {
         primary:
-          'bg-atria-accent text-white hover:bg-atria-accent-hover',
+          'rounded-full bg-atria-accent text-atria-on-accent hover:bg-atria-accent-hover',
         secondary:
-          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-bg',
-        danger: 'bg-atria-danger text-white hover:bg-red-800',
-        ghost: 'text-atria-muted hover:text-atria-ink hover:bg-atria-bg',
+          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
+        danger:
+          'bg-atria-danger text-white hover:bg-atria-danger/90',
+        ghost:
+          'text-atria-text-secondary hover:text-atria-ink hover:bg-atria-surface-2',
         sidebar:
-          'text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5 justify-start',
+          'justify-start rounded-[var(--radius-atria-md)] text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5',
         sidebarActive:
-          'bg-white/10 text-atria-sidebar-active justify-start',
+          'justify-start rounded-[var(--radius-atria-md)] bg-white/10 text-atria-sidebar-active',
       },
       size: {
-        sm: 'h-8 px-3 text-xs',
-        md: 'h-9 px-4',
-        lg: 'h-10 px-5',
-        icon: 'h-9 w-9 px-0',
-        sidebar: 'h-9 px-3',
+        sm: 'h-8 px-3 text-sm',
+        md: 'h-10 px-4 text-sm',
+        lg: 'h-[52px] px-6 text-base',
+        icon: 'h-10 w-10 px-0',
+        sidebar: 'h-10 px-3',
       },
     },
     defaultVariants: {
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it

 succeeded in 823ms:
diff --git a/.env.example b/.env.example
index c374c9f..9d4f1a9 100644
--- a/.env.example
+++ b/.env.example
@@ -4,3 +4,12 @@ VITE_CONVEX_URL=https://tidy-crocodile-154.convex.cloud
 # Set this in Convex environment variables, not in frontend hosting.
 # Required for organization invite emails to redirect back into ATRIA-X.
 CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
+
+# ADP Workforce Now integration (server-side Convex env only).
+# Leave unset to run safely without ADP credentials; sync rows become pending_credentials.
+ADP_TOKEN_URL=
+ADP_BASE_URL=
+ADP_CLIENT_ID=
+ADP_CLIENT_SECRET=
+ADP_CLIENT_CERT_PEM=
+ADP_CLIENT_KEY_PEM=
diff --git a/eslint.config.js b/eslint.config.js
index a20c4e8..fd2fee7 100644
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -6,7 +6,17 @@ import tseslint from 'typescript-eslint'
 import { defineConfig, globalIgnores } from 'eslint/config'
 
 export default defineConfig([
-  globalIgnores(['dist', 'convex/_generated']),
+  globalIgnores([
+    'dist',
+    'convex/_generated',
+    '.hermes-pipeline',
+    '.convex/local',
+    'node_modules',
+    'test-results',
+    'playwright-report',
+    '*.config.*',
+    '.env*',
+  ]),
   {
     files: ['**/*.{ts,tsx}'],
     extends: [
diff --git a/tsconfig.app.json b/tsconfig.app.json
index f46566f..7a3aed9 100644
--- a/tsconfig.app.json
+++ b/tsconfig.app.json
@@ -4,7 +4,7 @@
     "target": "es2023",
     "lib": ["ES2023", "DOM"],
     "module": "esnext",
-    "types": ["vite/client", "vitest/globals"],
+    "types": ["vite/client", "vitest/globals", "node"],
     "skipLibCheck": true,
     "paths": {
       "@/*": ["./src/*"]
diff --git a/vite.config.ts b/vite.config.ts
index f4fc41c..d6a7330 100644
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -1,22 +1,46 @@
 import path from 'node:path'
 import react from '@vitejs/plugin-react'
-import tailwindcss from '@tailwindcss/vite'
 import { defineConfig } from 'vitest/config'
+import type { PluginOption } from 'vite'
 
 // https://vite.dev/config/
-export default defineConfig({
-  plugins: [react(), tailwindcss()],
-  resolve: {
-    alias: {
-      '@': path.resolve(__dirname, './src'),
+export default defineConfig(async ({ mode }) => {
+  const plugins: PluginOption[] = [react()]
+
+  // Tailwind's Vite plugin loads a native Oxide binding. Vite's default
+  // config bundler tries to resolve that native dependency while bundling
+  // vite.config.ts, which fails in some Windows sandboxes with EPERM.
+  // package.json now invokes Vite/Vitest with --configLoader native so the
+  // config is executed by Node directly instead of being bundled. We still
+  // keep the plugin out of test mode because jsdom tests do not need CSS
+  // processing and should not pull in the Oxide binary.
+  if (mode !== 'test') {
+    const { default: tailwindcss } = await import('@tailwindcss/vite')
+    plugins.push(tailwindcss())
+  }
+
+  return {
+    plugins,
+    resolve: {
+      alias: {
+        '@': path.resolve(import.meta.dirname, './src'),
+      },
+    },
+    test: {
+      environment: 'jsdom',
+      exclude: [
+        'node_modules/**',
+        'dist/**',
+        'tests/e2e/**',
+        '.hermes-pipeline/**',
+      ],
+      globals: true,
+      setupFiles: './src/test/setup.ts',
+      css: true,
+      pool: 'threads',
+      fileParallelism: false,
+      maxWorkers: 1,
+      testTimeout: 15000,
     },
-  },
-  test: {
-    environment: 'jsdom',
-    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
-    globals: true,
-    setupFiles: './src/test/setup.ts',
-    css: true,
-    fileParallelism: false,
-  },
+  }
 })
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

codex
The generated Convex files look like they came from a newer codegen shape, but the summary says codegen itself failed in this environment. Iâ€™m checking whether anything imports removed generated exports or whether this is just an unverified gate problem.
2026-06-26T23:12:35.672421Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"from './_generated/server'|from \\\"./_generated/server\\\"|env\" convex src --glob '"'!convex/_generated/**'"'"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"from './_generated/server'|from \\\"./_generated/server\\\"|env\" convex src --glob '"'!convex/_generated/**'"'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"from './_generated/server'|from \\\"./_generated/server\\\"|env\" convex src --glob '"'!convex/_generated/**'"'"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex\\tsconfig.json'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'Get-ChildItem -Force | Select-Object -ExpandProperty Name' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"api\\.seed\\.seedE2E|seedE2E|adpOutbound|employeeProfiles|integrations/adp\" convex/_generated/api.d.ts convex/_generated/api.js src convex --glob '"'!convex/_generated/**'"'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 669ms:
{
  /* This TypeScript project config describes the environment that
   * Convex functions run in and is used to typecheck them.
   * You can modify it, but some settings are required to use Convex.
   */
  "compilerOptions": {
    /* These settings are not required by Convex and can be modified. */
    "allowJs": true,
    "strict": true,
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,

    /* These compiler options are required by Convex */
    "target": "ESNext",
    "lib": ["ES2023", "dom"],
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["./**/*"],
  "exclude": ["./_generated"]
}


 succeeded in 690ms:
convex/_generated/api.d.ts:11:import type * as adpOutbound from "../adpOutbound.js";
convex/_generated/api.d.ts:19:import type * as employeeProfiles from "../employeeProfiles.js";
convex/_generated/api.d.ts:21:import type * as integrations_adp_adpClient from "../integrations/adp/adpClient.js";
convex/_generated/api.d.ts:22:import type * as integrations_adp_adpPort from "../integrations/adp/adpPort.js";
convex/_generated/api.d.ts:23:import type * as integrations_adp_config from "../integrations/adp/config.js";
convex/_generated/api.d.ts:24:import type * as integrations_adp_errors from "../integrations/adp/errors.js";
convex/_generated/api.d.ts:25:import type * as integrations_adp_mockAdp from "../integrations/adp/mockAdp.js";
convex/_generated/api.d.ts:48:  adpOutbound: typeof adpOutbound;
convex/_generated/api.d.ts:56:  employeeProfiles: typeof employeeProfiles;
convex/_generated/api.d.ts:58:  "integrations/adp/adpClient": typeof integrations_adp_adpClient;
convex/_generated/api.d.ts:59:  "integrations/adp/adpPort": typeof integrations_adp_adpPort;
convex/_generated/api.d.ts:60:  "integrations/adp/config": typeof integrations_adp_config;
convex/_generated/api.d.ts:61:  "integrations/adp/errors": typeof integrations_adp_errors;
convex/_generated/api.d.ts:62:  "integrations/adp/mockAdp": typeof integrations_adp_mockAdp;
convex\adpOutbound.ts:7:import { getSharedMockAdp } from './integrations/adp/mockAdp'
convex\adpOutbound.ts:8:import { NotConfiguredError } from './integrations/adp/errors'
convex\adpOutbound.ts:9:import type { AdpPort } from './integrations/adp/adpPort'
convex\adpOutbound.ts:25:  const { AdpClient } = await import('./integrations/adp/adpClient')
convex\adpOutbound.ts:173:          internal.adpOutbound.adpSyncPunch,
convex\adpOutbound.ts:184:  args: { employeeProfileId: v.id('employeeProfiles') },
convex\adpOutbound.ts:311:          internal.adpOutbound.adpSyncWorker,
convex\adpOutbound.ts:388:      )) as Doc<'employeeProfiles'>[]
convex\adpOutbound.ts:391:        profiles.map((p: Doc<'employeeProfiles'>) => [
convex\adpOutbound.ts:397:        profiles.map((p: Doc<'employeeProfiles'>) => [
convex\adpOutbound.ts:405:            (p: Doc<'employeeProfiles'>): p is Doc<'employeeProfiles'> & {
convex\adpOutbound.ts:409:          .map((p: Doc<'employeeProfiles'> & { adpAssociateOid: string }) => [
convex\adpOutbound.ts:496:          internal.adpOutbound.adpInitialWorkerLoad,
convex\adpSync.test.ts:6:import { resetSharedMockAdp } from './integrations/adp/mockAdp'
convex\adpSync.test.ts:184:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:199:    const syncResult = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:227:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:255:    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:261:    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:301:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:333:    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })
convex\adpSync.test.ts:365:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:387:    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })
convex\adpSync.test.ts:427:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:449:    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:462:    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:593:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:602:    const result = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex\adpSync.test.ts:613:        .query('employeeProfiles')
convex\adpSync.test.ts:639:    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex\adpSync.test.ts:657:    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex\adpSync.test.ts:684:    const first = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex\adpSync.test.ts:690:    const second = await t.action(internal.adpOutbound.adpInitialWorkerLoad, {
convex\adpSync.test.ts:697:        .query('employeeProfiles')
convex\adpSync.test.ts:761:        .query('employeeProfiles')
convex\adpSync.test.ts:787:      return ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:798:    const result = await t.action(internal.adpOutbound.adpSyncWorker, {
convex\adpSync.test.ts:826:      return ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:836:    const first = await t.action(internal.adpOutbound.adpSyncWorker, {
convex\adpSync.test.ts:843:    const second = await t.action(internal.adpOutbound.adpSyncWorker, {
convex\adpSync.test.ts:902:        .query('employeeProfiles')
convex\adpSync.test.ts:970:        .query('employeeProfiles')
convex\adpSync.test.ts:1005:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:1031:        .query('employeeProfiles')
convex\adpSync.test.ts:1065:      await ctx.db.insert('employeeProfiles', {
convex\adpSync.test.ts:1090:        .query('employeeProfiles')
convex\adpSync.ts:12:import { adpEnvVarNames, isAdpConfigured } from './integrations/adp/config'
convex\adpSync.ts:96:  args: { employeeProfileId: v.id('employeeProfiles') },
convex\adpSync.ts:108:      .query('employeeProfiles')
convex\adpSync.ts:120:      .query('employeeProfiles')
convex\adpSync.ts:161:    employeeProfileId: v.id('employeeProfiles'),
convex\adpSync.ts:208:    matchProfileId: v.optional(v.id('employeeProfiles')),
convex\adpSync.ts:223:    return ctx.db.insert('employeeProfiles', {
convex\adpSync.ts:317:      internal.adpOutbound.adpInitialWorkerLoad,
convex\employeeProfiles.ts:22:    .query('employeeProfiles')
convex\employeeProfiles.ts:37:    .query('employeeProfiles')
convex\employeeProfiles.ts:59:  return ctx.db.insert('employeeProfiles', {
convex\employeeProfiles.ts:86:      .query('employeeProfiles')
convex\employeeProfiles.ts:96:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex\employeeProfiles.ts:102:    const profileId = await ctx.db.insert('employeeProfiles', {
convex\employeeProfiles.ts:110:    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex\employeeProfiles.ts:129:    profileId: Id<'employeeProfiles'>
convex\employeeProfiles.ts:162:    const profileId: Id<'employeeProfiles'> = await ctx.runMutation(
convex\employeeProfiles.ts:163:      internal.employeeProfiles.createCaregiverProfile,
convex\employeeProfiles.ts:202:      .query('employeeProfiles')
convex\employeeProfiles.ts:266:    } = await ctx.runAction(internal.adpOutbound.adpInitialWorkerLoad, {
convex\employeeProfiles.test.ts:6:import { resetSharedMockAdp } from './integrations/adp/mockAdp'
convex\employeeProfiles.test.ts:126:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:141:      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
convex\employeeProfiles.test.ts:184:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:196:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:216:        .query('employeeProfiles')
convex\employeeProfiles.test.ts:249:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:259:      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
convex\employeeProfiles.test.ts:292:        api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:353:      await ctx.db.insert('employeeProfiles', {
convex\employeeProfiles.test.ts:363:      api.employeeProfiles.runAdpInitialWorkerLoad,
convex\employeeProfiles.test.ts:397:      await ctx.db.insert('employeeProfiles', {
convex\employeeProfiles.test.ts:407:      api.employeeProfiles.listEmployeeProfiles,
convex\employeeProfiles.test.ts:440:        api.employeeProfiles.listEmployeeProfiles,
src\features\team\pages\TeamPage.tsx:143:  const employeeProfiles = useQuery(
src\features\team\pages\TeamPage.tsx:144:    api.employeeProfiles.listEmployeeProfiles,
src\features\team\pages\TeamPage.tsx:149:  const createCaregiver = useAction(api.employeeProfiles.createCaregiver)
src\features\team\pages\TeamPage.tsx:151:    api.employeeProfiles.runAdpInitialWorkerLoad,
src\features\team\pages\TeamPage.tsx:595:      {isAdmin && employeeProfiles !== undefined && (
src\features\team\pages\TeamPage.tsx:666:            {employeeProfiles.length === 0 ? (
src\features\team\pages\TeamPage.tsx:681:                  {employeeProfiles.map((profile) => {
src\features\team\pages\TeamPage.test.tsx:49:  employeeProfiles?: Array<{
src\features\team\pages\TeamPage.test.tsx:68:  const employeeProfiles = options.employeeProfiles
src\features\team\pages\TeamPage.test.tsx:91:      if (name === 'employeeProfiles:listEmployeeProfiles') return employeeProfiles
src\features\team\pages\TeamPage.test.tsx:107:      if (name === 'employeeProfiles:createCaregiver') return mocks.createCaregiver
src\features\team\pages\TeamPage.test.tsx:108:      if (name === 'employeeProfiles:runAdpInitialWorkerLoad')
src\features\team\pages\TeamPage.test.tsx:468:      employeeProfiles: [],
src\features\team\pages\TeamPage.test.tsx:512:      employeeProfiles: [],
src\features\team\pages\TeamPage.test.tsx:545:      employeeProfiles: [
src\shared\testing\convexApi.test.ts:104:  it('adpOutbound.ts exports adp sync actions', async () => {
src\shared\testing\convexApi.test.ts:105:    const mod = await import('../../../convex/adpOutbound')
convex\members.ts:12:import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
convex\members.ts:141:          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex\members.ts:166:          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex\members.ts:217:        await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex\schema.ts:155:  employeeProfiles: defineTable({
convex\seed.ts:508:export const seedE2E = mutation({
convex\shiftClock.test.ts:126:    expect(shiftSource).toContain('internal.adpOutbound.adpSyncPunch')
convex\shifts.ts:318:  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
convex\shifts.ts:769:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
convex\tenants.ts:12:import { ensureCaregiverEmployeeProfile } from './employeeProfiles'
convex\tenants.ts:155:          await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {

 succeeded in 899ms:
.convex
.git
.hermes-pipeline
convex
Cï€ºUserspinolDocumentsWorkatriaxsolid-pancake.hermes-pipeline20260625_165149screenshots
dist
docs
node_modules
public
src
test-results
tests
({i
.env.example
.env.local
.env.local.anonymous.bak
.env.preview
.env.production
.gitignore
.vercelignore
convex.json
eslint.config.js
index.html
package-lock.json
package.json
playwright.config.ts
README.md
test-run-current.log
test-run-current2.log
test-run-forks.log
test-run-seq.log
test-run.log
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vercel.json
vite.config.ts

codex
There is also an untracked stray file named `({i` at the repo root. Iâ€™m checking whether it has content; if it is an artifact, it should not be included in the change set.
2026-06-26T23:13:03.726323Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item -LiteralPath '({i' | Format-List Name,Length,FullName"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item -LiteralPath '({i' | Format-List Name,Length,FullName" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Item -LiteralPath '({i' | Format-List Name,Length,FullName"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"by_tenant_user|tenantMembers|collect\\(\\)\" convex/employeeProfiles.ts convex/members.ts convex/shiftQueries.ts convex/tenants.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '({i'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "Convex codegen|summary.md|e2e|skipped|credentials" .hermes-pipeline/20260626_161701/implementation-plan.md .hermes-pipeline/20260626_161701/summary.md tests/e2e/*.ts tests/e2e/helpers/*.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 513ms:
convex/tenants.ts:19:      .query('tenantMembers')
convex/tenants.ts:23:      .collect()
convex/tenants.ts:74:    await ctx.db.insert('tenantMembers', {
convex/tenants.ts:119:      .query('tenantMembers')
convex/tenants.ts:120:      .withIndex('by_tenant_user', (q) =>
convex/tenants.ts:138:    const memberId = await ctx.db.insert('tenantMembers', {
convex/shiftQueries.ts:145:        .collect(),
convex/shiftQueries.ts:152:        .collect(),
convex/shiftQueries.ts:158:        .collect(),
convex/shiftQueries.ts:198:      .collect()
convex/shiftQueries.ts:203:      .collect()
convex/members.ts:31:      .query('tenantMembers')
convex/members.ts:32:      .withIndex('by_tenant_user', (q) =>
convex/members.ts:46:      .query('tenantMembers')
convex/members.ts:47:      .withIndex('by_tenant_user', (q) =>
convex/members.ts:62:      .query('tenantMembers')
convex/members.ts:63:      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
convex/members.ts:64:      .collect()
convex/members.ts:79:      .query('tenantMembers')
convex/members.ts:83:      .collect()
convex/members.ts:119:      .query('tenantMembers')
convex/members.ts:120:      .withIndex('by_tenant_user', (q) =>
convex/members.ts:149:    const memberId = await ctx.db.insert('tenantMembers', {
convex/members.ts:197:      .query('tenantMembers')
convex/members.ts:198:      .withIndex('by_tenant_user', (q) =>
convex/members.ts:238:      .query('tenantMembers')
convex/members.ts:239:      .withIndex('by_tenant_user', (q) =>
convex/employeeProfiles.ts:17:  member: Doc<'tenantMembers'>,
convex/employeeProfiles.ts:204:      .collect()
convex/employeeProfiles.ts:207:      .query('tenantMembers')
convex/employeeProfiles.ts:208:      .withIndex('by_tenant_user', (q) => q.eq('tenantId', tenantId))
convex/employeeProfiles.ts:209:      .collect()

2026-06-26T23:13:04.315000Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.5 seconds
Output:
.hermes-pipeline/20260626_161701/summary.md:9:- `convex/seed.ts` â€” added deterministic `seedE2E` mutation for e2e fixtures.
.hermes-pipeline/20260626_161701/summary.md:27:- `playwright.config.ts` â€” disabled parallelism, added `globalSetup`, set `workers: 1` for e2e stability.
.hermes-pipeline/20260626_161701/summary.md:28:- `tests/e2e/helpers/auth.ts` â€” shared Clerk sign-in helper and credential check.
.hermes-pipeline/20260626_161701/summary.md:29:- `tests/e2e/global-setup.ts` â€” seeds e2e fixtures via Convex HTTP API after admin sign-in.
.hermes-pipeline/20260626_161701/summary.md:30:- `tests/e2e/phase1-lifecycle.spec.ts` â€” full caregiverâ†’coordinatorâ†’billing lifecycle e2e.
.hermes-pipeline/20260626_161701/summary.md:31:- `tests/e2e/geofence.spec.ts` â€” inside/outside/denied/disabled geofence e2e scenarios.
.hermes-pipeline/20260626_161701/summary.md:33:- `.hermes-pipeline/20260626_161701/summary.md` â€” this file.
.hermes-pipeline/20260626_161701/summary.md:39:| Convex codegen | `npx convex codegen` | **FAIL** | Environment has `CONVEX_DEPLOY_KEY` set; Convex codegen refuses to run against a deployment-only environment. Only `seedE2E` was added; no existing API signatures changed, so generated code remains valid for existing functions. |
.hermes-pipeline/20260626_161701/summary.md:43:| E2E tests | `npm run e2e` | **PASS** | 4 existing smoke tests passed; 5 new tests skipped because `E2E_CLERK_ORG_ID` / test-account credentials are not configured in this environment. |
.hermes-pipeline/20260626_161701/summary.md:47:The new e2e specs require these environment variables to run against real Clerk test accounts:
.hermes-pipeline/20260626_161701/summary.md:59:- Secret-redaction test asserts mock ADP credentials do not appear in `integrationEvents` or `adpError` after a failure.
.hermes-pipeline/20260626_161701/implementation-plan.md:9:- `npm run e2e` covers the full seeded lifecycle with geofence disabled:
.hermes-pipeline/20260626_161701/implementation-plan.md:26:  - Unconfigured tenant keeps app usable and marks punches `pending_credentials`.
.hermes-pipeline/20260626_161701/implementation-plan.md:31:  - No secrets/raw credentials appear in `integrationEvents` or logs.
.hermes-pipeline/20260626_161701/implementation-plan.md:39:  - `npm run e2e`
.hermes-pipeline/20260626_161701/implementation-plan.md:46:- [ ] Update `convex/seed.ts` with deterministic e2e fixtures:
.hermes-pipeline/20260626_161701/implementation-plan.md:67:- [ ] `tests/e2e/phase1-lifecycle.spec.ts`: full lifecycle using seeded data with geofence disabled.
.hermes-pipeline/20260626_161701/implementation-plan.md:69:  - If credentials are unavailable, tests skip with a clear message so the gate stays green.
.hermes-pipeline/20260626_161701/implementation-plan.md:70:- [ ] `tests/e2e/geofence.spec.ts`: inside radius, outside radius, denied permission, and disable-setting flows.
.hermes-pipeline/20260626_161701/implementation-plan.md:71:- [ ] `tests/e2e/helpers/auth.ts`: shared sign-in helper and role-based page objects.
.hermes-pipeline/20260626_161701/implementation-plan.md:79:- [ ] Run `npm run e2e`.
.hermes-pipeline/20260626_161701/implementation-plan.md:80:- [ ] Write real pass/fail results to `.hermes-pipeline/20260626_161701/summary.md`.
.hermes-pipeline/20260626_161701/implementation-plan.md:87:- `.hermes-pipeline/20260626_161701/summary.md`
.hermes-pipeline/20260626_161701/implementation-plan.md:88:- `tests/e2e/phase1-lifecycle.spec.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:89:- `tests/e2e/geofence.spec.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:90:- `tests/e2e/helpers/auth.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:112:- **Auth dependency for e2e**: Real Clerk sign-in requires test accounts. Mitigation: conditional skip with env vars; existing smoke tests remain.
rg: tests/e2e/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)
rg: tests/e2e/helpers/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 exited 1 in 545ms:
.hermes-pipeline/20260626_161701/summary.md:9:- `convex/seed.ts` â€” added deterministic `seedE2E` mutation for e2e fixtures.
.hermes-pipeline/20260626_161701/summary.md:27:- `playwright.config.ts` â€” disabled parallelism, added `globalSetup`, set `workers: 1` for e2e stability.
.hermes-pipeline/20260626_161701/summary.md:28:- `tests/e2e/helpers/auth.ts` â€” shared Clerk sign-in helper and credential check.
.hermes-pipeline/20260626_161701/summary.md:29:- `tests/e2e/global-setup.ts` â€” seeds e2e fixtures via Convex HTTP API after admin sign-in.
.hermes-pipeline/20260626_161701/summary.md:30:- `tests/e2e/phase1-lifecycle.spec.ts` â€” full caregiverâ†’coordinatorâ†’billing lifecycle e2e.
.hermes-pipeline/20260626_161701/summary.md:31:- `tests/e2e/geofence.spec.ts` â€” inside/outside/denied/disabled geofence e2e scenarios.
.hermes-pipeline/20260626_161701/summary.md:33:- `.hermes-pipeline/20260626_161701/summary.md` â€” this file.
.hermes-pipeline/20260626_161701/summary.md:39:| Convex codegen | `npx convex codegen` | **FAIL** | Environment has `CONVEX_DEPLOY_KEY` set; Convex codegen refuses to run against a deployment-only environment. Only `seedE2E` was added; no existing API signatures changed, so generated code remains valid for existing functions. |
.hermes-pipeline/20260626_161701/summary.md:43:| E2E tests | `npm run e2e` | **PASS** | 4 existing smoke tests passed; 5 new tests skipped because `E2E_CLERK_ORG_ID` / test-account credentials are not configured in this environment. |
.hermes-pipeline/20260626_161701/summary.md:47:The new e2e specs require these environment variables to run against real Clerk test accounts:
.hermes-pipeline/20260626_161701/summary.md:59:- Secret-redaction test asserts mock ADP credentials do not appear in `integrationEvents` or `adpError` after a failure.
.hermes-pipeline/20260626_161701/implementation-plan.md:9:- `npm run e2e` covers the full seeded lifecycle with geofence disabled:
.hermes-pipeline/20260626_161701/implementation-plan.md:26:  - Unconfigured tenant keeps app usable and marks punches `pending_credentials`.
.hermes-pipeline/20260626_161701/implementation-plan.md:31:  - No secrets/raw credentials appear in `integrationEvents` or logs.
.hermes-pipeline/20260626_161701/implementation-plan.md:39:  - `npm run e2e`
.hermes-pipeline/20260626_161701/implementation-plan.md:46:- [ ] Update `convex/seed.ts` with deterministic e2e fixtures:
.hermes-pipeline/20260626_161701/implementation-plan.md:67:- [ ] `tests/e2e/phase1-lifecycle.spec.ts`: full lifecycle using seeded data with geofence disabled.
.hermes-pipeline/20260626_161701/implementation-plan.md:69:  - If credentials are unavailable, tests skip with a clear message so the gate stays green.
.hermes-pipeline/20260626_161701/implementation-plan.md:70:- [ ] `tests/e2e/geofence.spec.ts`: inside radius, outside radius, denied permission, and disable-setting flows.
.hermes-pipeline/20260626_161701/implementation-plan.md:71:- [ ] `tests/e2e/helpers/auth.ts`: shared sign-in helper and role-based page objects.
.hermes-pipeline/20260626_161701/implementation-plan.md:79:- [ ] Run `npm run e2e`.
.hermes-pipeline/20260626_161701/implementation-plan.md:80:- [ ] Write real pass/fail results to `.hermes-pipeline/20260626_161701/summary.md`.
.hermes-pipeline/20260626_161701/implementation-plan.md:87:- `.hermes-pipeline/20260626_161701/summary.md`
.hermes-pipeline/20260626_161701/implementation-plan.md:88:- `tests/e2e/phase1-lifecycle.spec.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:89:- `tests/e2e/geofence.spec.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:90:- `tests/e2e/helpers/auth.ts`
.hermes-pipeline/20260626_161701/implementation-plan.md:112:- **Auth dependency for e2e**: Real Clerk sign-in requires test accounts. Mitigation: conditional skip with env vars; existing smoke tests remain.
rg: tests/e2e/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)
rg: tests/e2e/helpers/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 succeeded in 588ms:
codex
Iâ€™ve finished the review pass. The blockers are concrete acceptance misses rather than style polish, so the final will request changes with exact files and lines.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"identity\\.subject|caregiverId\" convex/shiftQueries.ts convex/shifts.ts convex/authHelpers.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"data-location-status', 'outside|data-location-status', 'denied|clockInButton|toBeDisabled|clock-in-button\" tests/e2e/geofence.spec.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "requestLocation|handleClockIn|setOutsideError|useEffect|clock_out|clock_in" src/features/caregiver/components/ShiftDocumentationForm.tsx src/features/caregiver/hooks/useCaregiverLocation.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "complete-checklist|clock-out-button|toBeEnabled|toBeDisabled|SUBMITTED|CORRECTION|Approved|BILLING READY|billing_ready|review-status-badge|shift-status-badge" tests/e2e/phase1-lifecycle.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 649ms:
49:  await page.locator('[data-testid="clock-in-button"]').click()
99:  await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
101:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
102:  await expect(clockInButton).toBeDisabled()
118:  await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })
120:  const clockInButton = page.locator('[data-testid="clock-in-button"]')
121:  await expect(clockInButton).toBeDisabled()
146:  await expect(page.locator('[data-testid="clock-in-button"]')).toBeEnabled()

 succeeded in 700ms:
convex/authHelpers.ts:32:      q.eq('tenantId', tenant._id).eq('clerkUserId', identity.subject),
convex/shifts.ts:24:  caregiverId: string,
convex/shifts.ts:29:      q.eq('tenantId', tenantId).eq('clerkUserId', caregiverId),
convex/shifts.ts:213:  if (actor.role === 'org:caregiver' && shift.caregiverId !== actor.subject) {
convex/shifts.ts:269:    caregiverId: string
convex/shifts.ts:298:    caregiverId: args.caregiverId,
convex/shifts.ts:329:    caregiverId: v.string(),
convex/shifts.ts:344:    await assertCaregiverMember(ctx, tenantId, args.caregiverId)
convex/shifts.ts:351:      caregiverId: args.caregiverId,
convex/shifts.ts:385:    caregiverId: v.string(),
convex/shifts.ts:412:    await assertCaregiverMember(ctx, tenantId, args.caregiverId)
convex/shifts.ts:447:          caregiverId: args.caregiverId,
convex/shifts.ts:498:    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
convex/shifts.ts:545:    if (role === 'org:caregiver' && shift.caregiverId !== identity.subject) {
convex/shifts.ts:597:    return submitShift(ctx, args, { subject: identity.subject, role })
convex/shifts.ts:622:    if (shift.caregiverId !== identity.subject) {
convex/shifts.ts:646:      caregiverId: shift.caregiverId,
convex/shifts.ts:701:    if (shift.caregiverId !== identity.subject) {
convex/shifts.ts:749:        caregiverId: shift.caregiverId,
convex/shifts.ts:796:      { subject: identity.subject, role },
convex/shiftQueries.ts:10:  shift: { caregiverId: string },
convex/shiftQueries.ts:14:  if (role === 'org:caregiver' && shift.caregiverId !== clerkUserId) {
convex/shiftQueries.ts:29:        q.eq('tenantId', tenantId).eq('caregiverId', identity.subject),
convex/shiftQueries.ts:118:    assertShiftReadableByRole(shift, role, identity.subject)
convex/shiftQueries.ts:130:    assertShiftReadableByRole(shift, role, identity.subject)

 succeeded in 669ms:
src/features/caregiver/hooks/useCaregiverLocation.ts:26:  punchType: 'clock_in' | 'clock_out',
src/features/caregiver/hooks/useCaregiverLocation.ts:29:  return punchType === 'clock_in'
src/features/caregiver/hooks/useCaregiverLocation.ts:46:  const requestLocation = useCallback(
src/features/caregiver/hooks/useCaregiverLocation.ts:49:      punchType?: 'clock_in' | 'clock_out'
src/features/caregiver/hooks/useCaregiverLocation.ts:51:      const punchType = options?.punchType ?? 'clock_in'
src/features/caregiver/hooks/useCaregiverLocation.ts:100:  const setOutsideError = useCallback((message: string) => {
src/features/caregiver/hooks/useCaregiverLocation.ts:110:    requestLocation,
src/features/caregiver/hooks/useCaregiverLocation.ts:111:    setOutsideError,
src/features/caregiver/components/ShiftDocumentationForm.tsx:3:import { useEffect, useMemo, useRef, useState } from 'react'
src/features/caregiver/components/ShiftDocumentationForm.tsx:136:  const { state: locationState, requestLocation, setOutsideError, clearLocationError } = useCaregiverLocation()
src/features/caregiver/components/ShiftDocumentationForm.tsx:200:  const handleClockIn = async () => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:204:      const location = await requestLocation({
src/features/caregiver/components/ShiftDocumentationForm.tsx:206:        punchType: 'clock_in',
src/features/caregiver/components/ShiftDocumentationForm.tsx:217:        setOutsideError(message)
src/features/caregiver/components/ShiftDocumentationForm.tsx:230:      const location = await requestLocation({
src/features/caregiver/components/ShiftDocumentationForm.tsx:232:        punchType: 'clock_out',
src/features/caregiver/components/ShiftDocumentationForm.tsx:245:        setOutsideError(message)
src/features/caregiver/components/ShiftDocumentationForm.tsx:291:  useEffect(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:299:  useEffect(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:301:      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:305:  }, [view, geofence, requestLocation])
src/features/caregiver/components/ShiftDocumentationForm.tsx:333:        onClockIn={handleClockIn}

 succeeded in 657ms:
33:  const statusBadge = shiftCard.locator('[data-testid="shift-status-badge"]')
88:  await expect(page.locator('[data-testid="complete-checklist"]')).toBeVisible()
89:  const clockOutButton = page.locator('[data-testid="clock-out-button"]')
90:  await expect(clockOutButton).toBeEnabled()
106:  const reviewStatus = reviewRow.locator('[data-testid="review-status-badge"]')
127:  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveText('CORRECTION')
139:  await page.locator('[data-testid="clock-out-button"]').click()
150:  await expect(resubmittedRow.locator('[data-testid="review-status-badge"]')).toHaveText('Submitted')
156:  // Approved shifts appear under the Approved filter
160:  const approvedStatus = approvedRow.locator('[data-testid="review-status-badge"]')
161:  await expect(approvedStatus).toHaveText('Approved')

codex
One more seed issue is deterministic state: `seedE2E` only inserts disabled geofence settings when none exist, so a prior run that left geofence enabled can contaminate the lifecycle spec. That is part of the fixture blocker rather than a separate style concern.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "existingSettings|tenantSettings|enabled: false|enforceClockIn|enforceClockOut" convex/seed.ts tests/e2e/geofence.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "location evidence|clock-out|clock_out|stores location|withinGeofence|clockOut" convex/shiftClock.test.ts tests/e2e/geofence.spec.ts src/features/caregiver/components/ShiftDocumentationForm.tsx' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"runAfter\\(0, internal\\.adpOutbound\\.adpSyncPunch|pending_credentials|integrationConnections|configured\" convex/shifts.ts convex/adpOutbound.ts convex/adpSync.test.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"raw ADP|secret|request:|response:|console\\.error|sanitizeError|ADP_CLIENT\" convex/adpOutbound.ts convex/adpSync.ts convex/adpSync.test.ts convex/integrations/adp/*.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 725ms:
convex/seed.ts:607:    const existingSettings = await ctx.db
convex/seed.ts:608:      .query('tenantSettings')
convex/seed.ts:611:    if (!existingSettings) {
convex/seed.ts:612:      await ctx.db.insert('tenantSettings', {
convex/seed.ts:615:          enabled: false,
convex/seed.ts:616:          enforceClockIn: false,
convex/seed.ts:617:          enforceClockOut: false,

 succeeded in 710ms:
src/features/caregiver/components/ShiftDocumentationForm.tsx:122:  const [view, setView] = useState<'clockIn' | 'wizard' | 'clockOut' | 'success'>(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:139:  const clockOut = useMutation(api.shifts.clockOut)
src/features/caregiver/components/ShiftDocumentationForm.tsx:232:        punchType: 'clock_out',
src/features/caregiver/components/ShiftDocumentationForm.tsx:234:      await clockOut({
src/features/caregiver/components/ShiftDocumentationForm.tsx:269:      setView('clockOut')
src/features/caregiver/components/ShiftDocumentationForm.tsx:300:    if (view === 'clockOut') {
src/features/caregiver/components/ShiftDocumentationForm.tsx:301:      requestLocation({ geofence, punchType: 'clock_out' }).catch(() => {
src/features/caregiver/components/ShiftDocumentationForm.tsx:338:  if (view === 'clockOut') {
convex/shiftClock.test.ts:16:  it('exports clockIn and clockOut', async () => {
convex/shiftClock.test.ts:19:    expect(mod).toHaveProperty('clockOut')
convex/shiftClock.test.ts:31:  it('restricts clockOut to caregivers', () => {
convex/shiftClock.test.ts:32:    expect(shiftSource).toContain('export const clockOut')
convex/shiftClock.test.ts:34:      /clockOut[\s\S]*?requireTenantRole[\s\S]*?\['org:caregiver'\]/,
convex/shiftClock.test.ts:84:describe('clock-out documentation gating', () => {
convex/shiftClock.test.ts:85:  it('validates documentation completeness before clock-out', () => {
convex/shiftClock.test.ts:86:    expect(shiftSource).toMatch(/clockOut[\s\S]*?validateShiftDocumentation/)
convex/shiftClock.test.ts:89:  it('blocks clock-out when documentation is incomplete', () => {
convex/shiftClock.test.ts:90:    expect(shiftSource).toMatch(/clockOut[\s\S]*?Incomplete documentation/)
convex/shiftClock.test.ts:94:describe('clock-out geofence gating', () => {
convex/shiftClock.test.ts:95:  it('validates clock-out location before submitting', () => {
convex/shiftClock.test.ts:96:    const clockOutBlock = shiftSource.slice(
convex/shiftClock.test.ts:97:      shiftSource.indexOf('export const clockOut'),
convex/shiftClock.test.ts:99:    const submitIndex = clockOutBlock.indexOf('await submitShift')
convex/shiftClock.test.ts:101:    expect(clockOutBlock.indexOf('validateClockPunchLocation')).toBeLessThan(
convex/shiftClock.test.ts:108:  it('records clock_in and clock_out timePunches', () => {
convex/shiftClock.test.ts:110:    expect(shiftSource).toContain("punchType: 'clock_out'")
convex/shiftClock.test.ts:113:  it('patches shift clockInAt and clockOutAt timestamps', () => {
convex/shiftClock.test.ts:115:    expect(shiftSource).toContain('clockOutAt: now')
convex/shiftClock.test.ts:141:describe('clock-out reuses submit path', () => {
convex/shiftClock.test.ts:142:  it('calls submitShift from clockOut', () => {
convex/shiftClock.test.ts:143:    const clockOutBlock = shiftSource.slice(
convex/shiftClock.test.ts:144:      shiftSource.indexOf('export const clockOut'),
convex/shiftClock.test.ts:146:    expect(clockOutBlock).toContain('await submitShift(')
convex/shiftClock.test.ts:294:  it('allows clock-in inside radius and stores location evidence', async () => {
convex/shiftClock.test.ts:321:    expect(punch?.location?.withinGeofence).toBe(true)
tests/e2e/geofence.spec.ts:20:test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
tests/e2e/geofence.spec.ts:28:  await page.locator('[data-testid="geofence-enforce-clock-out-checkbox"]').check()
tests/e2e/geofence.spec.ts:75:  await expect(page.locator('[data-testid="shift-clock-out-screen"]')).toBeVisible({ timeout: 15000 })
tests/e2e/geofence.spec.ts:76:  const outPanel = page.locator('[data-testid="clock-out-location-panel"]')
tests/e2e/geofence.spec.ts:79:  await expect(page.locator('[data-testid="clock-out-button"]')).toBeEnabled()
tests/e2e/geofence.spec.ts:80:  await page.locator('[data-testid="clock-out-button"]').click()

 succeeded in 719ms:
convex/adpSync.test.ts:60:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:63:        status: 'configured',
convex/adpSync.test.ts:140:  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
convex/adpSync.test.ts:144:    const clerkOrgId = 'org_adp_unconfigured'
convex/adpSync.test.ts:145:    const caregiverId = 'user_cg_adp_unconfigured'
convex/adpSync.test.ts:146:    const caregiverEmail = 'unconfigured@example.com'
convex/adpSync.test.ts:168:    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')
convex/adpSync.test.ts:175:    // Flip integration connection to configured and add employee profile
convex/adpSync.test.ts:177:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:180:        status: 'configured',
convex/adpSync.test.ts:189:        adpAssociateOid: 'mock-aoid-unconfigured@example.com',
convex/adpSync.test.ts:216:    const clerkOrgId = 'org_adp_configured'
convex/adpSync.test.ts:217:    const caregiverId = 'user_cg_adp_configured'
convex/adpSync.test.ts:218:    const caregiverEmail = 'configured@example.com'
convex/adpSync.test.ts:232:        adpAssociateOid: 'mock-aoid-configured@example.com',
convex/adpSync.test.ts:737:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:740:        status: 'configured',
convex/adpSync.test.ts:875:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:878:        status: 'configured',
convex/adpSync.test.ts:945:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:948:        status: 'configured',
convex/adpSync.test.ts:998:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:1001:        status: 'configured',
convex/adpSync.test.ts:1058:      await ctx.db.insert('integrationConnections', {
convex/adpSync.test.ts:1061:        status: 'configured',
convex/adpOutbound.ts:53:    const configured = await ctx.runQuery(
convex/adpOutbound.ts:57:    if (!configured) {
convex/adpOutbound.ts:61:        adpSyncStatus: 'pending_credentials',
convex/adpOutbound.ts:63:      return { status: 'pending_credentials' }
convex/adpOutbound.ts:147:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
convex/adpOutbound.ts:203:    const configured = await ctx.runQuery(
convex/adpOutbound.ts:207:    if (!configured) {
convex/adpOutbound.ts:211:        adpSyncStatus: 'pending_credentials',
convex/adpOutbound.ts:213:      return { status: 'pending_credentials' }
convex/adpOutbound.ts:285:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
convex/adpOutbound.ts:324:    const configured = await ctx.runQuery(
convex/adpOutbound.ts:328:    if (!configured) {
convex/adpOutbound.ts:330:        status: 'pending_credentials',
convex/adpOutbound.ts:477:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
convex/shifts.ts:303:    adpSyncStatus: 'pending_credentials',
convex/shifts.ts:318:  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
convex/shifts.ts:754:        adpSyncStatus: 'pending_credentials',
convex/shifts.ts:769:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {

2026-06-26T23:14:19.297445Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.6 seconds
Output:
convex/adpSync.ts:43:export function sanitizeError(error: unknown): string {
convex/adpSync.ts:241:    request: v.optional(v.any()),
convex/adpSync.ts:258:          response: event.response,
convex/adpSync.ts:283:      request: args.request,
convex/adpSync.ts:295:    response: v.optional(v.any()),
convex/adpSync.ts:302:      response: args.response,
convex/adpSync.test.ts:7:import { sanitizeError } from './adpSync'
convex/adpSync.test.ts:18:  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
convex/adpSync.test.ts:19:  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:20:  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
convex/adpSync.test.ts:21:  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
convex/adpSync.test.ts:347:  it('does not leak ADP secrets into integrationEvents on failure', async () => {
convex/adpSync.test.ts:351:      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
convex/adpSync.test.ts:354:    const clerkOrgId = 'org_adp_secret_leak'
convex/adpSync.test.ts:355:    const caregiverId = 'user_cg_adp_secret_leak'
convex/adpSync.test.ts:356:    const caregiverEmail = 'secret-leak@example.com'
convex/adpSync.test.ts:370:        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
convex/adpSync.test.ts:400:    expect(eventJson).not.toContain('mock-client-secret')
convex/adpSync.test.ts:406:    expect(punch?.adpError).not.toContain('mock-client-secret')
convex/adpSync.test.ts:504:      request: {},
convex/adpSync.test.ts:514:      request: {},
convex/adpSync.test.ts:522:      response: { adpPunchId: 'punch-123' },
convex/adpSync.test.ts:531:      request: {},
convex/adpSync.test.ts:538:describe('sanitizeError', () => {
convex/adpSync.test.ts:540:    vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
convex/adpSync.test.ts:541:    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:544:      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
convex/adpSync.test.ts:546:    const redacted = sanitizeError(new Error(message))
convex/adpSync.test.ts:549:    expect(redacted).not.toContain('mock-client-secret')
convex/adpSync.test.ts:554:    expect(redacted).toContain('[REDACTED:ADP_CLIENT_ID]')
convex/adpSync.test.ts:555:    expect(redacted).toContain('[REDACTED:ADP_CLIENT_SECRET]')
convex/adpOutbound.ts:14:  sanitizeError,
convex/adpOutbound.ts:89:        request: {
convex/adpOutbound.ts:140:        response: { adpPunchId: result.punchId },
convex/adpOutbound.ts:148:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:158:        response: { error: adpError },
convex/adpOutbound.ts:224:        request: {
convex/adpOutbound.ts:275:        response: {
convex/adpOutbound.ts:286:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:296:        response: { error: adpError },
convex/adpOutbound.ts:346:        request: { tenantId: tenantId as string },
convex/adpOutbound.ts:461:            console.error('ADP worker load failed for a record:', workerError)
convex/adpOutbound.ts:470:        response: result,
convex/adpOutbound.ts:478:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:488:        response: { error: adpError },
rg: convex/integrations/adp/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

 exited 1 in 594ms:
convex/adpSync.ts:43:export function sanitizeError(error: unknown): string {
convex/adpSync.ts:241:    request: v.optional(v.any()),
convex/adpSync.ts:258:          response: event.response,
convex/adpSync.ts:283:      request: args.request,
convex/adpSync.ts:295:    response: v.optional(v.any()),
convex/adpSync.ts:302:      response: args.response,
convex/adpSync.test.ts:7:import { sanitizeError } from './adpSync'
convex/adpSync.test.ts:18:  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
convex/adpSync.test.ts:19:  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:20:  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
convex/adpSync.test.ts:21:  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
convex/adpSync.test.ts:347:  it('does not leak ADP secrets into integrationEvents on failure', async () => {
convex/adpSync.test.ts:351:      failureMessage: 'auth failed: mock-client-secret / mock-client-id',
convex/adpSync.test.ts:354:    const clerkOrgId = 'org_adp_secret_leak'
convex/adpSync.test.ts:355:    const caregiverId = 'user_cg_adp_secret_leak'
convex/adpSync.test.ts:356:    const caregiverEmail = 'secret-leak@example.com'
convex/adpSync.test.ts:370:        adpAssociateOid: 'mock-aoid-secret-leak@example.com',
convex/adpSync.test.ts:400:    expect(eventJson).not.toContain('mock-client-secret')
convex/adpSync.test.ts:406:    expect(punch?.adpError).not.toContain('mock-client-secret')
convex/adpSync.test.ts:504:      request: {},
convex/adpSync.test.ts:514:      request: {},
convex/adpSync.test.ts:522:      response: { adpPunchId: 'punch-123' },
convex/adpSync.test.ts:531:      request: {},
convex/adpSync.test.ts:538:describe('sanitizeError', () => {
convex/adpSync.test.ts:540:    vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
convex/adpSync.test.ts:541:    vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
convex/adpSync.test.ts:544:      'ADP request failed: client_id mock-client-id Basic bW9jay1jbGllbnQtaWQ6bW9jay1jbGllbnQtc2VjcmV0 token=mock-client-secret Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
convex/adpSync.test.ts:546:    const redacted = sanitizeError(new Error(message))
convex/adpSync.test.ts:549:    expect(redacted).not.toContain('mock-client-secret')
convex/adpSync.test.ts:554:    expect(redacted).toContain('[REDACTED:ADP_CLIENT_ID]')
convex/adpSync.test.ts:555:    expect(redacted).toContain('[REDACTED:ADP_CLIENT_SECRET]')
convex/adpOutbound.ts:14:  sanitizeError,
convex/adpOutbound.ts:89:        request: {
convex/adpOutbound.ts:140:        response: { adpPunchId: result.punchId },
convex/adpOutbound.ts:148:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:158:        response: { error: adpError },
convex/adpOutbound.ts:224:        request: {
convex/adpOutbound.ts:275:        response: {
convex/adpOutbound.ts:286:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:296:        response: { error: adpError },
convex/adpOutbound.ts:346:        request: { tenantId: tenantId as string },
convex/adpOutbound.ts:461:            console.error('ADP worker load failed for a record:', workerError)
convex/adpOutbound.ts:470:        response: result,
convex/adpOutbound.ts:478:      const adpError = sanitizeError(error)
convex/adpOutbound.ts:488:        response: { error: adpError },
rg: convex/integrations/adp/*.ts: The filename, directory name, or volume label syntax is incorrect. (os error 123)

codex
The ADP implementation and tests largely cover the specified contract, including idempotency, redaction in events, worker load, and payload omission. Iâ€™m not seeing a concrete ADP blocker comparable to the e2e/fixture/gate issues.
codex
Iâ€™m doing a final lightweight diff check for whitespace/conflict markers before writing the verdict.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --check' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"<<<<<<<|=======|>>>>>>>|TODO|FIXME\" convex src tests .hermes-pipeline/20260626_161701 --glob '"'!convex/_generated/**'"'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git status --short' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 664ms:
 M .env.example
 M convex/_generated/api.d.ts
 M convex/_generated/api.js
 M convex/_generated/server.d.ts
 M convex/_generated/server.js
 M convex/adpSync.ts
 M convex/invitations.ts
 M convex/members.ts
 M convex/reviews.ts
 M convex/schema.ts
 M convex/seed.ts
 M convex/shiftClock.test.ts
 M convex/shiftQueries.ts
 M convex/shifts.ts
 M convex/tenants.ts
 M eslint.config.js
 M package.json
 M playwright.config.ts
 M src/app/router.tsx
 M src/app/shell/Sidebar.tsx
 M src/features/caregiver/components/ShiftDocumentationForm.tsx
 M src/features/caregiver/components/ShiftTaskList.tsx
 M src/features/caregiver/model/documentationDraft.ts
 M src/features/caregiver/pages/CaregiverTodayPage.tsx
 M src/features/clients/pages/ClientsPage.test.tsx
 M src/features/clients/pages/ClientsPage.tsx
 M src/features/coordinator/components/ReviewDetail.tsx
 M src/features/coordinator/components/ReviewHistory.tsx
 M src/features/coordinator/pages/CoordinatorReviewPage.tsx
 M src/features/dashboard/pages/DashboardPage.tsx
 M src/features/platform/pages/PlatformAdminPage.tsx
 M src/features/team/pages/TeamPage.test.tsx
 M src/features/team/pages/TeamPage.tsx
 M src/index.css
 M src/shared/format.ts
 M src/shared/testing/convexApi.test.ts
 M src/shared/ui/AppLoader.tsx
 M src/shared/ui/Badge.tsx
 M src/shared/ui/Button.tsx
 M src/shared/ui/Card.tsx
 M src/shared/ui/Checkbox.tsx
 M src/shared/ui/Dialog.tsx
 M src/shared/ui/Input.tsx
 M src/shared/ui/KpiCard.tsx
 M src/shared/ui/Select.tsx
 M src/shared/ui/StatusBadge.tsx
 M src/shared/ui/Table.tsx
 M src/shared/ui/Textarea.tsx
 M src/shared/ui/index.ts
 M tsconfig.app.json
 M vite.config.ts
?? ({i
?? .hermes-pipeline/
?? convex/adpOutbound.ts
?? convex/adpSync.test.ts
?? convex/employeeProfiles.test.ts
?? convex/employeeProfiles.ts
?? convex/integrations/
?? convex/reviews.test.ts
?? convex/tsconfig.json
?? src/features/caregiver/components/LocationStatusPanel.tsx
?? src/features/caregiver/components/MissingChecklist.tsx
?? src/features/caregiver/components/ShiftClockInScreen.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.test.tsx
?? src/features/caregiver/components/ShiftClockOutScreen.tsx
?? src/features/caregiver/components/ShiftDocumentationForm.test.tsx
?? src/features/caregiver/components/ShiftNoteStep.tsx
?? src/features/caregiver/components/ShiftSuccessScreen.tsx
?? src/features/caregiver/hooks/
?? src/features/caregiver/model/documentationWizard.test.ts
?? src/features/caregiver/model/documentationWizard.ts
?? src/features/coordinator/components/ReviewDetail.test.tsx
?? src/features/coordinator/pages/CoordinatorReviewPage.test.tsx
?? src/features/settings/
?? src/shared/ui/EmptyState.tsx
?? src/shared/ui/FieldGroup.tsx
?? src/shared/ui/ProgressSteps.tsx
?? src/shared/ui/Toast.tsx
?? src/shared/ui/sharedUi.test.tsx
?? tests/e2e/geofence.spec.ts
?? tests/e2e/global-setup.ts
?? tests/e2e/helpers/
?? tests/e2e/phase1-lifecycle.spec.ts

2026-06-26T23:14:55.639132Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.7 seconds
Output:

 exited 1 in 698ms:
2026-06-26T23:14:55.732155Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 0.8 seconds
Output:
src/features/dashboard/pages/DashboardPage.tsx:243: new blank line at EOF.
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

 exited 1 in 796ms:
src/features/dashboard/pages/DashboardPage.tsx:243: new blank line at EOF.
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

codex
**Review Result**

1. Required gates are not genuinely green. [summary.md](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:39>) reports `npx convex codegen` as **FAIL**, and [summary.md](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:43>) reports `npm run e2e` as passing only because the 5 new required specs were skipped. Fix codegen, make required e2e coverage actually run, and do not report success when required specs skip.

2. The e2e seed data will not work with real Clerk users. [seed.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/seed.ts:521>) hard-codes `e2e-*` Clerk user IDs, while tenant auth and shift visibility require `identity.subject` to match `tenantMembers.clerkUserId` and `shifts.caregiverId` ([authHelpers.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/authHelpers.ts:32>), [shiftQueries.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/shiftQueries.ts:29>)). Seed from real test account subjects or configured Clerk user IDs, and reset fixture settings idempotently; [seed.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/seed.ts:607>) only disables geofence when no settings row exists.

3. Two geofence e2e tests assert states that the UI never reaches before a click. [geofence.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:99>) and [geofence.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:118>) wait for `outside` / `denied` before clicking Clock In, but location is requested only inside `handleClockIn` ([ShiftDocumentationForm.tsx](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/caregiver/components/ShiftDocumentationForm.tsx:200>)). Update the tests or UI flow so outside/denied/server-reject/no-punch behavior is actually exercised.

4. The lifecycle e2e does not meet the stated coverage. It only verifies Clock Out is enabled after completion ([phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:88>)), not disabled before completion, and it misses status color assertions for correction/resubmission plus an actual `billing_ready` assertion after approval ([phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:127>), [phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:150>), [phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:161>)).

Follow-up: `git diff --check` also fails on an extra blank line at [DashboardPage.tsx](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/dashboard/pages/DashboardPage.tsx:243>), and there is an untracked root artifact `({i`.

VERDICT: CHANGES_REQUESTED
tokens used
149,374
**Review Result**

1. Required gates are not genuinely green. [summary.md](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:39>) reports `npx convex codegen` as **FAIL**, and [summary.md](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:43>) reports `npm run e2e` as passing only because the 5 new required specs were skipped. Fix codegen, make required e2e coverage actually run, and do not report success when required specs skip.

2. The e2e seed data will not work with real Clerk users. [seed.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/seed.ts:521>) hard-codes `e2e-*` Clerk user IDs, while tenant auth and shift visibility require `identity.subject` to match `tenantMembers.clerkUserId` and `shifts.caregiverId` ([authHelpers.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/authHelpers.ts:32>), [shiftQueries.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/shiftQueries.ts:29>)). Seed from real test account subjects or configured Clerk user IDs, and reset fixture settings idempotently; [seed.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/seed.ts:607>) only disables geofence when no settings row exists.

3. Two geofence e2e tests assert states that the UI never reaches before a click. [geofence.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:99>) and [geofence.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:118>) wait for `outside` / `denied` before clicking Clock In, but location is requested only inside `handleClockIn` ([ShiftDocumentationForm.tsx](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/caregiver/components/ShiftDocumentationForm.tsx:200>)). Update the tests or UI flow so outside/denied/server-reject/no-punch behavior is actually exercised.

4. The lifecycle e2e does not meet the stated coverage. It only verifies Clock Out is enabled after completion ([phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:88>)), not disabled before completion, and it misses status color assertions for correction/resubmission plus an actual `billing_ready` assertion after approval ([phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:127>), [phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:150>), [phase1-lifecycle.spec.ts](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:161>)).

Follow-up: `git diff --check` also fails on an extra blank line at [DashboardPage.tsx](<C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/dashboard/pages/DashboardPage.tsx:243>), and there is an untracked root artifact `({i`.

VERDICT: CHANGES_REQUESTED


codex
The earlier review’s e2e fixture and test-shape findings appear to have been addressed. The remaining high-risk area is whether the mandatory gate contract is satisfied, so I’m checking the pipeline gate logs and any current diff-check issues.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\gate_postfix1_lint.log'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\gate_postfix1_typecheck.log'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\gate_postfix1_unit.log'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-ChildItem -LiteralPath '.hermes-pipeline\\20260626_161701' -Filter '*e2e*' | Select-Object -ExpandProperty Name" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'git diff --check' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 780ms:

===== postfix1_typecheck run 1/1: npm run typecheck =====

> mariatest@0.0.0 typecheck
> tsc -b


----- exit code: 0 -----


 succeeded in 817ms:

===== postfix1_lint run 1/1: npm run lint =====

> mariatest@0.0.0 lint
> eslint .


----- exit code: 0 -----


 succeeded in 846ms:

===== postfix1_unit run 1/1: npm run test =====

> mariatest@0.0.0 test
> vitest run --configLoader native


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.6 [39m[90mC:/Users/pinol/Documents/Work/atriax/solid-pancake[39m

 [32mâœ“[39m src/features/caregiver/components/ShiftDocumentationForm.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 6860[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders the clock-in screen when not clocked in [33m 460[2mms[22m[39m
     [33m[2mâœ“[22m[39m advances through each wizard step after clock-in [33m 2182[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls clockOut with location when geofence is enabled and note is complete [33m 825[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows outside-radius server error in plain language [33m 808[2mms[22m[39m
     [33m[2mâœ“[22m[39m disables the clock-out button and shows a loading label while submitting [33m 751[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls onDone when returning home from the success screen [33m 872[2mms[22m[39m
     [33m[2mâœ“[22m[39m autosaves draft note fields [33m 430[2mms[22m[39m
 [32mâœ“[39m src/features/team/pages/TeamPage.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 6810[2mms[22m[39m
     [33m[2mâœ“[22m[39m creates caregiver invitations through the server redirect flow [33m 1482[2mms[22m[39m
     [33m[2mâœ“[22m[39m passes coordinator intent to the server invitation flow [33m 1021[2mms[22m[39m
     [33m[2mâœ“[22m[39m maps coordinator role to org:member when updating Clerk membership [33m 315[2mms[22m[39m
     [33m[2mâœ“[22m[39m refreshes invitations list after sending an invite [33m 676[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows "already a member" message when invitee is already in the org [33m 908[2mms[22m[39m
     [33m[2mâœ“[22m[39m adds a caregiver through the caregiver form [33m 1505[2mms[22m[39m
 [32mâœ“[39m src/features/clients/pages/ClientsPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 3536[2mms[22m[39m
     [33m[2mâœ“[22m[39m uses caregiver email as the scheduling dropdown label [33m 1255[2mms[22m[39m
     [33m[2mâœ“[22m[39m opens the address dialog and saves the service address [33m 2152[2mms[22m[39m
 [32mâœ“[39m src/features/coordinator/components/ReviewDetail.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 1981[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls approve mutation when Approve is clicked [33m 369[2mms[22m[39m
     [33m[2mâœ“[22m[39m calls requestCorrection mutation after typing a comment [33m 1230[2mms[22m[39m
 [32mâœ“[39m src/app/auth/SelectAgencyPage.test.tsx [2m([22m[2m8 tests[22m[2m)[22m[33m 2225[2mms[22m[39m
     [33m[2mâœ“[22m[39m does not call Convex while Convex auth is loading [33m 457[2mms[22m[39m
     [33m[2mâœ“[22m[39m retries once on transient token error, then succeeds [33m 541[2mms[22m[39m
     [33m[2mâœ“[22m[39m shows JWT config error when retry also fails with missing org claim [33m 547[2mms[22m[39m
 [32mâœ“[39m src/features/settings/pages/GeofenceSettingsPage.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 1432[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders the current geofence settings [33m 550[2mms[22m[39m
     [33m[2mâœ“[22m[39m toggles enforcement options when geofence is enabled [33m 332[2mms[22m[39m
     [33m[2mâœ“[22m[39m saves updated geofence settings [33m 541[2mms[22m[39m
 [32mâœ“[39m src/features/coordinator/pages/CoordinatorReviewPage.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[33m 825[2mms[22m[39m
     [33m[2mâœ“[22m[39m renders populated queue with status pills [33m 527[2mms[22m[39m
 [32mâœ“[39m src/shared/ui/sharedUi.test.tsx [2m([22m[2m18 tests[22m[2m)[22m[33m 871[2mms[22m[39m
       [33m[2mâœ“[22m[39m renders a default secondary button [33m 585[2mms[22m[39m
 [32mâœ“[39m src/shared/testing/convexApi.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 1029[2mms[22m[39m
     [33m[2mâœ“[22m[39m tenants.ts exports ensureSelectedAgency [33m 385[2mms[22m[39m
 [32mâœ“[39m convex/adpSync.test.ts [2m([22m[2m17 tests[22m[2m)[22m[33m 336[2mms[22m[39m
 [32mâœ“[39m src/app/shell/Sidebar.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 329[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/components/ShiftClockOutScreen.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 372[2mms[22m[39m
     [33m[2mâœ“[22m[39m disables clock-out when note is incomplete [33m 316[2mms[22m[39m
 [32mâœ“[39m src/app/shell/RouteGuard.test.tsx [2m([22m[2m14 tests[22m[2m)[22m[32m 195[2mms[22m[39m
 [32mâœ“[39m convex/seed.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 107[2mms[22m[39m
 [32mâœ“[39m convex/shiftClock.behavior.test.ts [2m([22m[2m13 tests[22m[2m)[22m[32m 195[2mms[22m[39m
 [32mâœ“[39m convex/platform.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 83[2mms[22m[39m
 [32mâœ“[39m src/app/providers.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 157[2mms[22m[39m
 [32mâœ“[39m src/app/router.test.tsx [2m([22m[2m6 tests[22m[2m)[22m[32m 166[2mms[22m[39m
 [32mâœ“[39m convex/reviews.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 120[2mms[22m[39m
 [32mâœ“[39m convex/employeeProfiles.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 173[2mms[22m[39m
 [32mâœ“[39m convex/shiftClock.test.ts [2m([22m[2m28 tests[22m[2m)[22m[32m 216[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/hooks/useCaregiverLocation.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 105[2mms[22m[39m
 [32mâœ“[39m convex/members.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 122[2mms[22m[39m
 [32mâœ“[39m convex/authHelpers.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 29[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/model/documentationWizard.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/locationValidation.test.ts [2m([22m[2m16 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32mâœ“[39m convex/timePunches.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/tenantSettings.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m src/shared/domain/shiftRules.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32mâœ“[39m src/features/billing/model/invoiceUtils.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mâœ“[39m convex/files.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32mâœ“[39m convex/integrations/adp/adpClient.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32mâœ“[39m src/features/caregiver/model/documentationDraft.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mâœ“[39m convex/shiftLifecycle.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32mâœ“[39m convex/shiftValidation.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32mâœ“[39m src/app/reloadOnStaleAssets.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 14[2mms[22m[39m
 [32mâœ“[39m src/shared/search/embedding.test.ts [2m([22m[2m1 test[22m[2m)[22m[32m 16[2mms[22m[39m

[2m Test Files [22m [1m[32m37 passed[39m[22m[90m (37)[39m
[2m      Tests [22m [1m[32m276 passed[39m[22m[90m (276)[39m
[2m   Start at [22m 17:37:17
[2m   Duration [22m 218.44s[2m (transform 3.73s, setup 14.75s, import 16.55s, tests 28.48s, environment 139.38s)[22m


----- exit code: 0 -----


 succeeded in 863ms:
warning: in the working copy of '.env.example', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/api.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.d.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/_generated/server.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/adpSync.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/schema.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shiftClock.test.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'convex/shifts.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftDocumentationForm.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/components/ShiftTaskList.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/model/documentationDraft.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/caregiver/pages/CaregiverTodayPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/clients/pages/ClientsPage.test.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewDetail.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/components/ReviewHistory.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/coordinator/pages/CoordinatorReviewPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/features/dashboard/pages/DashboardPage.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/index.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/format.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/AppLoader.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Badge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Button.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Card.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Checkbox.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Dialog.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Input.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/KpiCard.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Select.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/StatusBadge.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Table.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/Textarea.tsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/shared/ui/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'vite.config.ts', LF will be replaced by CRLF the next time Git touches it

 succeeded in 982ms:
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg --files tests/e2e' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"test\\(|test\\.skip|describe|assertE2ECredentialsConfigured|e2eCredentialsAvailable\" tests/e2e" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "Clock Out|disabled|billing_ready|data-shift-status|bg-atria" tests/e2e/phase1-lifecycle.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"summary|e2e|codegen|PASS|FAIL|credentials\" '.hermes-pipeline\\20260626_161701\\summary.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "outside|denied|no punch|resetE2EShifts|geolocation|location evidence|server rejects" tests/e2e/geofence.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 746ms:
tests/e2e\platform-route.spec.ts
tests/e2e\phase1-lifecycle.spec.ts
tests/e2e\global-setup.ts
tests/e2e\geofence.spec.ts
tests/e2e\billing-flow.spec.ts
tests/e2e\helpers\auth.ts

 succeeded in 819ms:
tests/e2e\billing-flow.spec.ts:3:test('sign-in page loads', async ({ page }) => {
tests/e2e\billing-flow.spec.ts:8:test('select-agency page loads', async ({ page }) => {
tests/e2e\billing-flow.spec.ts:13:test('root path loads', async ({ page }) => {
tests/e2e\geofence.spec.ts:8:  assertE2ECredentialsConfigured,
tests/e2e\geofence.spec.ts:18:test.describe.configure({ mode: 'serial' })
tests/e2e\geofence.spec.ts:21:  assertE2ECredentialsConfigured()
tests/e2e\geofence.spec.ts:53:test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
tests/e2e\geofence.spec.ts:100:test('geofence outside radius shows blocked UI and server rejects punch', async ({ page, context }) => {
tests/e2e\geofence.spec.ts:117:test('denied geolocation permission shows blocked UI and creates no punch', async ({ page, context }) => {
tests/e2e\geofence.spec.ts:133:test('disabling geofence stops requesting browser location', async ({ page, context }) => {
tests/e2e\global-setup.ts:10:  e2eCredentialsAvailable,
tests/e2e\global-setup.ts:81:  if (!e2eCredentialsAvailable()) {
tests/e2e\phase1-lifecycle.spec.ts:8:  assertE2ECredentialsConfigured,
tests/e2e\phase1-lifecycle.spec.ts:15:test.describe.configure({ mode: 'serial' })
tests/e2e\phase1-lifecycle.spec.ts:18:  assertE2ECredentialsConfigured()
tests/e2e\phase1-lifecycle.spec.ts:21:test('full caregiver-to-billing lifecycle with geofence disabled', async ({ page, context }) => {
tests/e2e\platform-route.spec.ts:3:test('platform page loads without server error', async ({ page }) => {
tests/e2e\helpers\auth.ts:11:export function e2eCredentialsAvailable(): boolean {
tests/e2e\helpers\auth.ts:23:export function assertE2ECredentialsConfigured(): void {
tests/e2e\helpers\auth.ts:24:  if (!e2eCredentialsAvailable()) {
tests/e2e\helpers\auth.ts:97:  assertE2ECredentialsConfigured()

 succeeded in 770ms:
21:test('full caregiver-to-billing lifecycle with geofence disabled', async ({ page, context }) => {
22:  // Ensure geofence is disabled for this flow
38:  await expect(statusBadge).toHaveClass(/bg-atria-info/)
86:  // Clock Out (via the wizard submit button) is disabled until the note is complete.
113:  await expect(reviewRow).toHaveAttribute('data-shift-status', 'submitted')
116:  await expect(reviewStatus).toHaveClass(/bg-atria-info/)
126:  await expect(returnedRow).toHaveAttribute('data-shift-status', 'needs_correction')
129:  await expect(returnedStatus).toHaveClass(/bg-atria-danger/)
139:  await expect(correctionCard.locator('[data-testid="shift-status-badge"]')).toHaveClass(/bg-atria-danger/)
162:  await expect(resubmittedRow).toHaveAttribute('data-shift-status', 'submitted')
165:  await expect(resubmittedStatus).toHaveClass(/bg-atria-info/)
171:  // Approved shifts appear under the Approved filter and are billing_ready.
175:  await expect(approvedRow).toHaveAttribute('data-shift-status', 'billing_ready')
178:  await expect(approvedStatus).toHaveClass(/bg-atria-success/)

 succeeded in 750ms:
9:  resetE2EShifts,
27:  await resetE2EShifts(page)
53:test('geofence inside radius allows clock in/out and stores location evidence', async ({ page, context }) => {
56:  await context.grantPermissions(['geolocation'])
100:test('geofence outside radius shows blocked UI and server rejects punch', async ({ page, context }) => {
103:  await context.grantPermissions(['geolocation'])
113:  await expect(locationPanel).toHaveAttribute('data-location-status', 'outside', { timeout: 15000 })
117:test('denied geolocation permission shows blocked UI and creates no punch', async ({ page, context }) => {
129:  await expect(locationPanel).toHaveAttribute('data-location-status', 'denied', { timeout: 15000 })

 succeeded in 786ms:
9:- `convex/seed.ts` — `seedE2E` now accepts real Clerk user IDs for admin/coordinator/caregiver, resets fixture shifts/reviews/billing/punches/tasks to a clean scheduled baseline, and resets geofence settings to disabled on every run. Added `resetE2EShifts` mutation used between serial e2e tests.
10:- `convex/_generated/*` — regenerated via `npx convex codegen` against the local backend (no hand edits).
11:- `src/features/coordinator/pages/CoordinatorReviewPage.tsx` — added `data-shift-status` to review rows so e2e can assert the underlying shift status (e.g. `billing_ready`).
13:- `tests/e2e/helpers/auth.ts` — replaced skip helper with `assertE2ECredentialsConfigured` (fails fast instead of skipping), added `resetE2EShifts` helper.
14:- `tests/e2e/global-setup.ts` — collects actual Clerk user IDs for all three roles and passes them to `seed:seedE2E`; skips seed gracefully when credentials are absent so baseline smoke tests still run.
15:- `tests/e2e/phase1-lifecycle.spec.ts` — added Clock Out disabled-before-completion assertion, status color assertions for correction/resubmission, and `data-shift-status="billing_ready"` assertion after approval.
16:- `tests/e2e/geofence.spec.ts` — outside/denied scenarios now click Clock In to exercise the real location request and blocked UI; each enforcement test enables geofence itself; `afterEach` resets fixtures so serial tests stay independent.
19:- `.hermes-pipeline/20260626_161701/summary.md` — this file.
25:| Convex codegen | `npx convex codegen` | **PASS** | Ran successfully against the local Convex backend (`anonymous-agent`) by overriding the deployment-only `CONVEX_DEPLOY_KEY`. Generated files committed. |
26:| Lint | `npm run lint` | **PASS** | 0 errors. |
27:| Typecheck | `npm run typecheck` | **PASS** | 0 errors. |
28:| Unit tests | `npm run test` | **PASS** | 37 files, 276 tests passing. |
29:| E2E tests | `npm run e2e` | **FAIL (credentials)** | 4 baseline smoke tests pass. The 5 new required lifecycle/geofence specs now fail fast with a clear error when `E2E_CLERK_ORG_ID` and test-account credentials are not configured, instead of being skipped. They will run once credentials are provided. |
33:The new e2e specs require these environment variables to run against real Clerk test accounts:
36:- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
37:- `E2E_CAREGIVER_EMAIL` / `E2E_CAREGIVER_PASSWORD`
38:- `E2E_COORDINATOR_EMAIL` / `E2E_COORDINATOR_PASSWORD`
44:- `seedE2E` now uses configured Clerk user IDs instead of hard-coded `e2e-*` placeholders, so tenant auth and shift visibility work with real accounts.
47:- Secret-redaction test asserts mock ADP credentials do not appear in `integrationEvents` or `adpError` after a failure.

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/hooks/useCaregiverLocation.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/components/LocationStatusPanel.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/components/ShiftClockOutScreen.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/components/ShiftClockInScreen.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/components/ShiftDocumentationForm.test.tsx'; Get-Content -Raw -LiteralPath 'src/features/caregiver/components/ShiftClockOutScreen.test.tsx'; Get-Content -Raw -LiteralPath 'src/features/caregiver/hooks/useCaregiverLocation.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 851ms:
import { useCallback, useRef, useState } from 'react'

export type BrowserLocation = {
  latitude: number
  longitude: number
  accuracyMeters: number
}

type LocationState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'granted'; location: BrowserLocation }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string }
  | { status: 'outside'; message: string }

export type ShiftGeofence = {
  enabled: boolean
  enforceClockIn: boolean
  enforceClockOut: boolean
}

function isLocationRequired(
  geofence: ShiftGeofence | undefined,
  punchType: 'clock_in' | 'clock_out',
) {
  if (!geofence?.enabled) return false
  return punchType === 'clock_in'
    ? geofence.enforceClockIn
    : geofence.enforceClockOut
}

function parsePosition(position: GeolocationPosition): BrowserLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
  }
}

export function useCaregiverLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' })
  const pendingRef = useRef<Promise<BrowserLocation | undefined> | null>(null)

  const requestLocation = useCallback(
    async (options?: {
      geofence?: ShiftGeofence
      punchType?: 'clock_in' | 'clock_out'
    }): Promise<BrowserLocation | undefined> => {
      const punchType = options?.punchType ?? 'clock_in'
      const required = isLocationRequired(options?.geofence, punchType)

      if (!required) {
        setState({ status: 'idle' })
        return undefined
      }

      if (!navigator.geolocation) {
        const message =
          'Your browser does not support location services. Contact your coordinator.'
        setState({ status: 'unsupported', message })
        return undefined
      }

      setState({ status: 'checking' })

      const promise = new Promise<BrowserLocation | undefined>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = parsePosition(position)
            setState({ status: 'granted', location })
            resolve(location)
          },
          (error) => {
            let message = 'Unable to read your location. Please try again.'
            if (error.code === error.PERMISSION_DENIED) {
              message =
                'Location access was denied. Enable location permissions in your browser settings to clock in.'
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              message =
                'Location is temporarily unavailable. Move to an area with better GPS signal and try again.'
            } else if (error.code === error.TIMEOUT) {
              message = 'Location request timed out. Please try again.'
            }
            const denied = error.code === error.PERMISSION_DENIED
            setState({ status: denied ? 'denied' : 'error', message })
            resolve(undefined)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })

      pendingRef.current = promise
      return promise
    },
    [],
  )

  const setOutsideError = useCallback((message: string) => {
    setState({ status: 'outside', message })
  }, [])

  const clearLocationError = useCallback(() => {
    setState({ status: 'idle' })
  }, [])

  return {
    state,
    requestLocation,
    setOutsideError,
    clearLocationError,
  }
}


 succeeded in 864ms:
import { MapPin, MapPinOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/shared/ui/Card'
import type { useCaregiverLocation } from '../hooks/useCaregiverLocation'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function LocationStatusPanel({
  state,
  'data-testid': testId,
}: {
  state: LocationState
  'data-testid'?: string
}) {
  const sharedProps = { 'data-testid': testId, 'data-location-status': state.status }

  if (state.status === 'idle') {
    return (
      <Card className="border-atria-border bg-atria-surface-2" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <MapPin className="h-5 w-5 text-atria-text-muted" />
          <p className="text-sm text-atria-text-secondary">
            Location will be checked when you tap Clock In.
          </p>
        </div>
      </Card>
    )
  }

  if (state.status === 'checking') {
    return (
      <Card className="border-atria-info/30 bg-atria-info-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-atria-info" />
          <p className="text-sm text-atria-info">Checking your locationâ€¦</p>
        </div>
      </Card>
    )
  }

  if (state.status === 'granted') {
    return (
      <Card className="border-atria-success/30 bg-atria-success-bg" {...sharedProps}>
        <div className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-atria-success" />
          <div className="text-sm text-atria-success">
            <p>Location available</p>
            <p className="text-xs opacity-90">
              Accuracy: {Math.round(state.location.accuracyMeters)}m
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const isBlocked =
    state.status === 'denied' ||
    state.status === 'unsupported' ||
    state.status === 'outside'
  const icon = isBlocked ? (
    <MapPinOff className="h-5 w-5 text-atria-danger" />
  ) : (
    <AlertCircle className="h-5 w-5 text-atria-warning" />
  )
  const toneClass = isBlocked
    ? 'border-atria-danger/30 bg-atria-danger-bg'
    : 'border-atria-warning/30 bg-atria-warning-bg'
  const textClass = isBlocked ? 'text-atria-danger' : 'text-atria-warning'

  return (
    <Card className={toneClass} {...sharedProps}>
      <div className="flex items-start gap-3 p-4">
        {icon}
        <p className={`text-sm ${textClass}`}>{state.message}</p>
      </div>
    </Card>
  )
}


 succeeded in 825ms:
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { LocationStatusPanel } from './LocationStatusPanel'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime, formatDurationHours } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockInScreen({
  scheduledStart,
  scheduledEnd,
  clientName,
  address,
  geofence,
  locationState,
  isLoading,
  onClockIn,
}: {
  scheduledStart: string
  scheduledEnd: string
  clientName: string
  address: string
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockIn: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const duration = formatDurationHours(scheduledStart, scheduledEnd)
  const start = formatTime(scheduledStart)
  const end = formatTime(scheduledEnd)

  const locationBlocked =
    geofence.enabled &&
    geofence.enforceClockIn &&
    (locationState.status === 'denied' ||
      locationState.status === 'unsupported' ||
      locationState.status === 'outside')

  return (
    <div className="space-y-3" data-testid="shift-clock-in-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock in</h2>
        <p className="text-base text-atria-text-secondary">
          Start your shift to begin your notes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-lg font-semibold text-atria-ink">{clientName}</p>
            <p className="text-base text-atria-text-secondary">
              ðŸ• {start} â€“ {end} {duration && ` Â· ${duration}`}
            </p>
          </div>
          <div className="flex items-start gap-2 text-base text-atria-text-secondary">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{address}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      {geofence.enabled && geofence.enforceClockIn && (
        <LocationStatusPanel state={locationState} data-testid="clock-in-location-panel" />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockIn}
        disabled={isLoading || locationBlocked}
        data-testid="clock-in-button"
      >
        {isLoading ? 'Clocking inâ€¦' : 'Clock in now'}
        {!isLoading && <span className="ml-2">â†’</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your start time is sent to ADP for payroll. You can begin your shift notes right after clocking in.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}


 succeeded in 836ms:
import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { LocationStatusPanel } from './LocationStatusPanel'
import { MissingChecklist, CompleteChecklist } from './MissingChecklist'
import type { ShiftGeofence, useCaregiverLocation } from '../hooks/useCaregiverLocation'
import { formatTime } from '@/shared/format'

type LocationState = ReturnType<typeof useCaregiverLocation>['state']

export function ShiftClockOutScreen({
  scheduledStart,
  clientName,
  actualClockInAt,
  actualClockOutAt,
  blockers,
  geofence,
  locationState,
  isLoading,
  onClockOut,
}: {
  scheduledStart: string
  clientName: string
  actualClockInAt?: string | null
  actualClockOutAt?: string | null
  blockers: string[]
  geofence: ShiftGeofence
  locationState: LocationState
  isLoading: boolean
  onClockOut: () => void
}) {
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date().toISOString()))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date().toISOString()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const locationRequired = geofence.enabled && geofence.enforceClockOut
  const locationReady = !locationRequired || locationState.status === 'granted'
  const canSubmit = blockers.length === 0 && locationReady && !isLoading

  const clockInTime = actualClockInAt ? formatTime(actualClockInAt) : formatTime(scheduledStart)
  const clockOutTime = actualClockOutAt
    ? formatTime(actualClockOutAt)
    : currentTime

  return (
    <div className="space-y-3" data-testid="shift-clock-out-screen">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-atria-ink">Clock out</h2>
        <p className="text-base text-atria-text-secondary">
          Your shift notes are complete. You can clock out now.
        </p>
      </div>

      <Badge variant="success" className="h-8 px-3 text-sm">
        âœ“ Shift note done
      </Badge>

      <Card className="border-atria-success/30 bg-atria-success-bg">
        <CardContent className="space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-success">
            Current time
          </p>
          <p className="text-5xl font-semibold text-atria-success">{currentTime}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
            Shift summary
          </p>
          <div className="flex items-start gap-2 text-base text-atria-ink">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-atria-text-muted" />
            <span>
              {clientName} Â· {clockInTime} â€“ {clockOutTime}
            </span>
          </div>
        </CardContent>
      </Card>

      {locationRequired && <LocationStatusPanel state={locationState} data-testid="clock-out-location-panel" />}

      {canSubmit ? <CompleteChecklist data-testid="complete-checklist" /> : (
        <MissingChecklist
          blockers={blockers}
          geofence={geofence}
          locationState={locationState}
          data-testid="missing-checklist"
        />
      )}

      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full rounded-full text-lg"
        onClick={onClockOut}
        disabled={!canSubmit}
        data-testid="clock-out-button"
      >
        {isLoading ? 'Submittingâ€¦' : 'Clock out now'}
        {!isLoading && <span className="ml-2">â†’</span>}
      </Button>

      <p className="text-center text-sm text-atria-text-secondary">
        Your end time is sent to ADP for payroll. Your shift note stays in ATRIA-X for your coordinator to review.
      </p>

      <p className="text-center text-sm text-atria-text-muted">
        Need help? Call your coordinator
      </p>
    </div>
  )
}


 succeeded in 878ms:
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'

const mocks = {
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  updateProgressNote: vi.fn(),
}

vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(() => ({
      organization: { id: 'org_123', name: 'Agency' },
    })),
    useUser: vi.fn(() => ({ user: { firstName: 'Ana' } })),
  }
})

vi.mock('convex/react', async () => {
  const actual = await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
  }
})

import { useMutation, useQuery } from 'convex/react'
import { ShiftDocumentationForm } from './ShiftDocumentationForm'

const shiftId = 'shift_123' as import('../../../../convex/_generated/dataModel').Id<'shifts'>

function makeDetails(overrides?: {
  status?: string
  clockInAt?: string | null
  clockOutAt?: string | null
  note?: Record<string, string>
  tasks?: Array<{
    _id: string
    title: string
    requiredProof: boolean
    status: 'pending' | 'complete'
    proofName?: string
  }>
}) {
  return {
    shift: {
      _id: shiftId,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      clientId: 'client_123' as import('../../../../convex/_generated/dataModel').Id<'clients'>,
      caregiverId: 'user_123',
      scheduledStart: '2026-06-25T08:00:00Z',
      scheduledEnd: '2026-06-25T16:00:00Z',
      status: overrides?.status ?? 'scheduled',
      serviceType: 'SLS',
      rate: 25,
      clockInAt: overrides?.clockInAt ?? null,
      clockOutAt: overrides?.clockOutAt ?? null,
    },
    client: {
      _id: 'client_123' as import('../../../../convex/_generated/dataModel').Id<'clients'>,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      name: 'Client A',
      displayName: 'Maria Lopez',
      serviceType: 'SLS',
      serviceAddress: {
        line1: '1820 Oak Street',
        line2: 'Apt 4',
        city: 'Anytown',
        state: 'CA',
        postalCode: '90210',
      },
    },
    note: {
      _id: 'note_123' as import('../../../../convex/_generated/dataModel').Id<'progressNotes'>,
      tenantId: 'tenant_123' as import('../../../../convex/_generated/dataModel').Id<'tenants'>,
      shiftId,
      startTime: '',
      endTime: '',
      servicesProvided: '',
      clientResponse: '',
      narrative: '',
      ...overrides?.note,
    },
    tasks: overrides?.tasks ?? [
      {
        _id: 'task_1',
        tenantId: 'tenant_123',
        shiftId,
        title: 'Observation note',
        requiredProof: true,
        status: 'pending' as const,
      },
    ],
    reviews: [],
  }
}

function mockState(options?: {
  geofenceEnabled?: boolean
  geofenceEnforceClockIn?: boolean
  geofenceEnforceClockOut?: boolean
  details?: ReturnType<typeof makeDetails>
}) {
  const details = options?.details ?? makeDetails()
  const geofence = {
    enabled: options?.geofenceEnabled ?? false,
    enforceClockIn: options?.geofenceEnforceClockIn ?? false,
    enforceClockOut: options?.geofenceEnforceClockOut ?? false,
    defaultRadiusMeters: 100,
    maxAccuracyMeters: 50,
  }

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'shiftQueries:getWithDetails') return details
      if (name === 'tenantSettings:get') return { tenantId: 'tenant_123', shiftGeofence: geofence }
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'shifts:clockIn') return mocks.clockIn
      if (name === 'shifts:clockOut') return mocks.clockOut
      if (name === 'shifts:updateProgressNote') return mocks.updateProgressNote
      return vi.fn()
    }) as unknown as typeof useMutation,
  )
}

const mockGetCurrentPosition = vi.fn()

describe('ShiftDocumentationForm', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the clock-in screen when not clocked in', () => {
    mockState({ geofenceEnabled: false })
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)
    expect(screen.getByRole('button', { name: /Clock in now/i })).toBeInTheDocument()
  })

  it('does not request location when geofence is disabled', async () => {
    mockState({ geofenceEnabled: false })
    mocks.clockIn.mockResolvedValueOnce({ punchId: 'punch_1', clockInAt: '2026-06-25T08:01:00Z' })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(mockGetCurrentPosition).not.toHaveBeenCalled()
      expect(mocks.clockIn).toHaveBeenCalledWith({ clerkOrgId: 'org_123', shiftId, location: undefined })
    })
  })

  it('requests location when geofence is enabled for clock-in', async () => {
    mockState({ geofenceEnabled: true, geofenceEnforceClockIn: true })
    mocks.clockIn.mockResolvedValueOnce({ punchId: 'punch_1', clockInAt: '2026-06-25T08:01:00Z' })
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalledOnce()
      expect(mocks.clockIn).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        shiftId,
        location: { latitude: 44.98, longitude: -93.26, accuracyMeters: 10 },
      })
    })
  })

  it('shows blocked state when location permission is denied', async () => {
    mockState({ geofenceEnabled: true, geofenceEnforceClockIn: true })
    mockGetCurrentPosition.mockImplementation((_: unknown, error: (e: GeolocationPositionError) => void) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getByRole('button', { name: /Clock in now/i }))

    await waitFor(() => {
      expect(screen.getByText(/Location access was denied/i)).toBeInTheDocument()
    })
    expect(mocks.clockIn).not.toHaveBeenCalled()
  })

  it('disables the clock-in button and shows a loading label while punching', async () => {
    mockState({ geofenceEnabled: false })
    mocks.clockIn.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    const button = screen.getByRole('button', { name: /Clock in now/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clocking inâ€¦/i })).toBeDisabled()
    })
    expect(mocks.clockIn).toHaveBeenCalledTimes(1)
  })

  it('advances through each wizard step after clock-in', async () => {
    mockState({
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'pending' },
        ],
      }),
    })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    expect(screen.getByText(/When were you there/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Change/i })[0])
    await user.type(screen.getByLabelText(/I started at/i), '08:00')
    await user.click(screen.getByRole('button', { name: /Change/i }))
    await user.type(screen.getByLabelText(/I finished at/i), '16:00')
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/What did you help with/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Bathing/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/How did the visit go/i)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/I helped Maria/i), 'Cooperative and in good spirits')
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/Did you work on her goals/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Walk a little each day/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/Anything we should know/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /No, all good today/i }))
    await user.click(screen.getByRole('checkbox', { name: /Mark Observation note complete/i }))
    await user.click(screen.getByRole('button', { name: /Next Step/i }))
    expect(screen.getByText(/One last look/i)).toBeInTheDocument()
  })

  it('calls clockOut with location when geofence is enabled and note is complete', async () => {
    mockState({
      geofenceEnabled: true,
      geofenceEnforceClockOut: true,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems â€” all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockResolvedValueOnce({ punchId: 'punch_2', clockOutAt: '2026-06-25T16:01:00Z' })
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(mocks.clockOut).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkOrgId: 'org_123',
          shiftId,
          location: { latitude: 44.98, longitude: -93.26, accuracyMeters: 10 },
        }),
      )
    })
  })

  it('shows outside-radius server error in plain language', async () => {
    mockState({
      geofenceEnabled: true,
      geofenceEnforceClockOut: true,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems â€” all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockRejectedValueOnce(
      new Error('You are 500m from the service location and outside the allowed 100m radius.'),
    )
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(document.body.textContent).toContain('500m from the service location')
    })
  })

  it('disables the clock-out button and shows a loading label while submitting', async () => {
    mockState({
      geofenceEnabled: false,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems â€” all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const submitButton2 = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(submitButton2).toBeEnabled())
    await user.click(submitButton2)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submittingâ€¦/i })).toBeDisabled()
    })
    expect(mocks.clockOut).toHaveBeenCalledTimes(1)
  })

  it('calls onDone when returning home from the success screen', async () => {
    const onDone = vi.fn()
    mockState({
      geofenceEnabled: false,
      details: makeDetails({
        status: 'in_progress',
        clockInAt: '2026-06-25T08:01:00Z',
        note: {
          startTime: '08:00',
          endTime: '16:00',
          servicesProvided: 'Bathing, Meals, Walk a little each day goal',
          clientResponse: 'No problems â€” all good today',
          narrative: 'Done',
        },
        tasks: [
          { _id: 'task_1', title: 'Observation note', requiredProof: false, status: 'complete' },
        ],
      }),
    })
    mocks.clockOut.mockResolvedValueOnce({ punchId: 'punch_2', clockOutAt: '2026-06-25T16:01:00Z' })
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} onDone={onDone} />)

    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: /Next Step/i }))
    }

    const confirmCheckbox = screen.getByRole('checkbox', { name: /I confirm this is accurate/i })
    await user.click(confirmCheckbox)

    const submitButton = screen.getByRole('button', { name: /Submit my notes/i })
    await waitFor(() => expect(submitButton).toBeEnabled())
    await user.click(submitButton)

    const clockOutButton = await screen.findByRole('button', { name: /Clock out now/i })
    await waitFor(() => expect(clockOutButton).toBeEnabled())
    await user.click(clockOutButton)

    const homeButton = await screen.findByRole('button', { name: /Back to home/i })
    await user.click(homeButton)

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('autosaves draft note fields', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockState({
      details: makeDetails({ status: 'in_progress', clockInAt: '2026-06-25T08:01:00Z' }),
    })
    mocks.updateProgressNote.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<ShiftDocumentationForm clerkOrgId="org_123" shiftId={shiftId} />)

    await user.click(screen.getAllByRole('button', { name: /Change/i })[0])
    await user.type(screen.getByLabelText(/I started at/i), '08:00')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(mocks.updateProgressNote).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkOrgId: 'org_123',
          shiftId,
          startTime: '08:00',
        }),
      )
    })
    vi.useRealTimers()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShiftClockOutScreen } from './ShiftClockOutScreen'

describe('ShiftClockOutScreen', () => {
  it('disables clock-out when note is incomplete', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={['Narrative is required.']}
        geofence={{ enabled: false, enforceClockIn: false, enforceClockOut: false }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeDisabled()
    expect(screen.getByText(/Narrative is required/i)).toBeInTheDocument()
  })

  it('enables clock-out when note is complete and geofence is disabled', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={[]}
        geofence={{ enabled: false, enforceClockIn: false, enforceClockOut: false }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeEnabled()
  })

  it('requires location when geofence enforcement is enabled for clock-out', () => {
    render(
      <ShiftClockOutScreen
        scheduledStart="2026-06-25T08:00:00Z"
        clientName="Client A"
        blockers={[]}
        geofence={{ enabled: true, enforceClockIn: false, enforceClockOut: true }}
        locationState={{ status: 'idle' }}
        isLoading={false}
        onClockOut={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /Clock out now/i })).toBeDisabled()
    expect(screen.getByText(/Location needed for clock-out/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCaregiverLocation } from './useCaregiverLocation'

const mockGetCurrentPosition = vi.fn()

describe('useCaregiverLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns idle when geofence is disabled', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    const location = await act(async () =>
      result.current.requestLocation({ geofence: { enabled: false, enforceClockIn: false, enforceClockOut: false } }),
    )
    expect(location).toBeUndefined()
    expect(result.current.state.status).toBe('idle')
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it('requests location when geofence is enabled for clock-in', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) =>
      success({ coords: { latitude: 44.98, longitude: -93.26, accuracy: 10 } } as GeolocationPosition),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('granted'))
    expect(mockGetCurrentPosition).toHaveBeenCalledOnce()
  })

  it('shows denied state when permission is denied', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    mockGetCurrentPosition.mockImplementation((_: unknown, error: (e: GeolocationPositionError) => void) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    )

    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: true, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })

    await waitFor(() => expect(result.current.state.status).toBe('denied'))
    expect('message' in result.current.state ? result.current.state.message : '').toContain('denied')
  })

  it('shows outside error from server rejection', () => {
    const { result } = renderHook(() => useCaregiverLocation())
    act(() => result.current.setOutsideError('You are 500m outside the allowed radius.'))
    expect(result.current.state.status).toBe('outside')
    expect('message' in result.current.state ? result.current.state.message : '').toContain('500m')
  })

  it('does not request location when enforcement is disabled for the punch type', async () => {
    const { result } = renderHook(() => useCaregiverLocation())
    await act(async () => {
      result.current.requestLocation({
        geofence: { enabled: true, enforceClockIn: false, enforceClockOut: false },
        punchType: 'clock_in',
      })
    })
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })
})


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "integrationConnections|adpSyncPunch|pending_credentials|queued|triggerInitialWorkerLoad|runAdp|createCaregiver" convex src tests' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/employeeProfiles.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/reviews.test.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/shiftValidation.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'convex/timePunches.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 775ms:
convex\adpSync.ts:28:  v.literal('pending_credentials'),
convex\adpSync.ts:29:  v.literal('queued'),
convex\adpSync.ts:35:  v.literal('pending_credentials'),
convex\adpSync.ts:36:  v.literal('queued'),
convex\adpSync.ts:147:      adpSyncStatus: 'pending_credentials' | 'queued' | 'synced' | 'error'
convex\adpSync.ts:180:        | 'pending_credentials'
convex\adpSync.ts:181:        | 'queued'
convex\adpSync.ts:309:export const triggerInitialWorkerLoad = mutation({
convex\adpSync.ts:320:    return { status: 'queued' }
convex\adpSync.ts:330:  | 'pending_credentials'
convex\adpSync.ts:331:  | 'queued'
convex\adpSync.ts:336:  | 'pending_credentials'
convex\adpSync.ts:337:  | 'queued'
convex\adpSync.test.ts:60:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:139:describe('adpSyncPunch', () => {
convex\adpSync.test.ts:140:  it('marks punch pending_credentials when ADP is not configured and syncs after configuration', async () => {
convex\adpSync.test.ts:168:    expect(punchBefore.adpSyncStatus).toBe('pending_credentials')
convex\adpSync.test.ts:177:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:195:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:199:    const syncResult = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:250:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:255:    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:261:    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:328:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:333:    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })
convex\adpSync.test.ts:382:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:387:    await t.action(internal.adpOutbound.adpSyncPunch, { timePunchId })
convex\adpSync.test.ts:444:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:449:    const first = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:462:    const second = await t.action(internal.adpOutbound.adpSyncPunch, {
convex\adpSync.test.ts:597:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:737:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:748:      api.adpSync.triggerInitialWorkerLoad,
convex\adpSync.test.ts:831:        adpSyncStatus: 'queued',
convex\adpSync.test.ts:875:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:945:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:998:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:1058:      await ctx.db.insert('integrationConnections', {
convex\adpSync.test.ts:1069:        adpSyncStatus: 'queued',
convex\adpOutbound.ts:45:export const adpSyncPunch = internalAction({
convex\adpOutbound.ts:61:        adpSyncStatus: 'pending_credentials',
convex\adpOutbound.ts:63:      return { status: 'pending_credentials' }
convex\adpOutbound.ts:147:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
convex\adpOutbound.ts:173:          internal.adpOutbound.adpSyncPunch,
convex\adpOutbound.ts:211:        adpSyncStatus: 'pending_credentials',
convex\adpOutbound.ts:213:      return { status: 'pending_credentials' }
convex\adpOutbound.ts:285:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
convex\adpOutbound.ts:330:        status: 'pending_credentials',
convex\adpOutbound.ts:477:      const syncStatus = isNotConfigured ? 'pending_credentials' : 'error'
src\features\team\pages\TeamPage.tsx:61:    case 'queued':
src\features\team\pages\TeamPage.tsx:63:    case 'pending_credentials':
src\features\team\pages\TeamPage.tsx:149:  const createCaregiver = useAction(api.employeeProfiles.createCaregiver)
src\features\team\pages\TeamPage.tsx:150:  const runAdpInitialWorkerLoad = useAction(
src\features\team\pages\TeamPage.tsx:151:    api.employeeProfiles.runAdpInitialWorkerLoad,
src\features\team\pages\TeamPage.tsx:337:      await createCaregiver({
src\features\team\pages\TeamPage.tsx:351:  }, [clerkOrgId, caregiverName, caregiverEmail, createCaregiver])
src\features\team\pages\TeamPage.tsx:360:      const result = await runAdpInitialWorkerLoad({ clerkOrgId })
src\features\team\pages\TeamPage.tsx:375:  }, [clerkOrgId, runAdpInitialWorkerLoad])
convex\employeeProfiles.ts:65:    adpSyncStatus: 'queued',
convex\employeeProfiles.ts:70:export const createCaregiverProfile = internalMutation({
convex\employeeProfiles.ts:76:      v.literal('pending_credentials'),
convex\employeeProfiles.ts:77:      v.literal('queued'),
convex\employeeProfiles.ts:83:    const initialStatus = args.adpSyncStatus ?? 'queued'
convex\employeeProfiles.ts:118:export const createCaregiver = action({
convex\employeeProfiles.ts:163:      internal.employeeProfiles.createCaregiverProfile,
convex\employeeProfiles.ts:168:        adpSyncStatus: adpConfigured ? 'queued' : 'pending_credentials',
convex\employeeProfiles.ts:228:export const runAdpInitialWorkerLoad = action({
src\features\team\pages\TeamPage.test.tsx:8:  createCaregiver: vi.fn(),
src\features\team\pages\TeamPage.test.tsx:9:  runAdpInitialWorkerLoad: vi.fn(),
src\features\team\pages\TeamPage.test.tsx:107:      if (name === 'employeeProfiles:createCaregiver') return mocks.createCaregiver
src\features\team\pages\TeamPage.test.tsx:108:      if (name === 'employeeProfiles:runAdpInitialWorkerLoad')
src\features\team\pages\TeamPage.test.tsx:109:        return mocks.runAdpInitialWorkerLoad
src\features\team\pages\TeamPage.test.tsx:450:    mocks.createCaregiver.mockResolvedValueOnce({
src\features\team\pages\TeamPage.test.tsx:483:      expect(mocks.createCaregiver).toHaveBeenCalledTimes(1)
src\features\team\pages\TeamPage.test.tsx:485:    expect(mocks.createCaregiver).toHaveBeenCalledWith({
src\features\team\pages\TeamPage.test.tsx:494:    mocks.runAdpInitialWorkerLoad.mockResolvedValueOnce({
src\features\team\pages\TeamPage.test.tsx:522:      expect(mocks.runAdpInitialWorkerLoad).toHaveBeenCalledTimes(1)
src\features\team\pages\TeamPage.test.tsx:524:    expect(mocks.runAdpInitialWorkerLoad).toHaveBeenCalledWith({
src\features\team\pages\TeamPage.test.tsx:556:          email: 'queued@agency.com',
src\features\team\pages\TeamPage.test.tsx:558:          adpSyncStatus: 'queued',
convex\employeeProfiles.test.ts:91:describe('createCaregiver', () => {
convex\employeeProfiles.test.ts:115:      await ctx.db.insert('integrationConnections', {
convex\employeeProfiles.test.ts:126:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:150:  it('reuses the same profile when createCaregiver is called again with the same email and a different name', async () => {
convex\employeeProfiles.test.ts:173:      await ctx.db.insert('integrationConnections', {
convex\employeeProfiles.test.ts:184:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:196:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:225:  it('marks profile as pending_credentials when ADP is not configured', async () => {
convex\employeeProfiles.test.ts:249:      api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:264:    expect(profile?.adpSyncStatus).toBe('pending_credentials')
convex\employeeProfiles.test.ts:292:        api.employeeProfiles.createCaregiver,
convex\employeeProfiles.test.ts:304:describe('runAdpInitialWorkerLoad', () => {
convex\employeeProfiles.test.ts:346:      await ctx.db.insert('integrationConnections', {
convex\employeeProfiles.test.ts:357:        adpSyncStatus: 'queued',
convex\employeeProfiles.test.ts:363:      api.employeeProfiles.runAdpInitialWorkerLoad,
convex\employeeProfiles.test.ts:401:        adpSyncStatus: 'queued',
convex\employeeProfiles.test.ts:413:    expect(profiles[0]?.adpSyncStatus).toBe('queued')
convex\schema.ts:5:  v.literal('pending_credentials'),
convex\schema.ts:6:  v.literal('queued'),
convex\schema.ts:12:  v.literal('pending_credentials'),
convex\schema.ts:13:  v.literal('queued'),
convex\schema.ts:21:  v.literal('pending_credentials'),
convex\schema.ts:171:  integrationConnections: defineTable({
convex\reviews.test.ts:89:      adpSyncStatus: 'pending_credentials',
convex\reviews.test.ts:100:      adpSyncStatus: 'pending_credentials',
convex\shiftClock.behavior.test.ts:569:        adpSyncStatus: 'pending_credentials',
convex\shiftClock.behavior.test.ts:579:        adpSyncStatus: 'pending_credentials',
convex\shifts.ts:303:    adpSyncStatus: 'pending_credentials',
convex\shifts.ts:318:  await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
convex\shifts.ts:754:        adpSyncStatus: 'pending_credentials',
convex\shifts.ts:769:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncPunch, {
convex\shiftClock.test.ts:126:    expect(shiftSource).toContain('internal.adpOutbound.adpSyncPunch')
convex\integrations\adp\config.ts:30:    .query('integrationConnections')
src\shared\testing\convexApi.test.ts:98:  it('adpSync.ts exports adp sync helpers and triggerInitialWorkerLoad', async () => {
src\shared\testing\convexApi.test.ts:101:    expect(mod).toHaveProperty('triggerInitialWorkerLoad')
src\shared\testing\convexApi.test.ts:106:    expect(mod).toHaveProperty('adpSyncPunch')

 succeeded in 858ms:
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { resetSharedMockAdp } from './integrations/adp/mockAdp'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

function stubAdpEnv() {
  vi.stubEnv('ADP_TOKEN_URL', 'https://mock.adp.com/auth/oauth/v2/token')
  vi.stubEnv('ADP_BASE_URL', 'https://mock.adp.com')
  vi.stubEnv('ADP_CLIENT_ID', 'mock-client-id')
  vi.stubEnv('ADP_CLIENT_SECRET', 'mock-client-secret')
  vi.stubEnv('ADP_CLIENT_CERT_PEM', 'mock-cert')
  vi.stubEnv('ADP_CLIENT_KEY_PEM', 'mock-key')
  vi.stubEnv('ADP_MOCK_ADAPTER', 'true')
}

function stubClerkInvitation() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'inv_test',
            email_address: 'caregiver@test.com',
            role: 'org:member',
            role_name: 'Member',
            status: 'pending',
            created_at: Date.now(),
          }),
      }),
    ) as unknown as typeof fetch,
  )
}

beforeEach(() => {
  resetSharedMockAdp()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function asAdmin(
  t: ReturnType<typeof createTestConvex>,
  adminId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: adminId,
    org_id: clerkOrgId,
    org_role: 'org:admin',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  coordinatorId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: coordinatorId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

describe('createCaregiver', () => {
  it('creates an employee profile and enqueues worker sync', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver'
    const adminId = 'user_admin_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    expect(result.profileId).toBeDefined()
    expect(result.emailAddress).toBe('caregiver@test.com')

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver@test.com')
    expect(profile?.adpSyncStatus).toBe('synced')
    expect(profile?.adpAssociateOid).toBeDefined()
  })

  it('reuses the same profile when createCaregiver is called again with the same email and a different name', async () => {
    stubAdpEnv()
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_reuse'
    const adminId = 'user_admin_create_reuse'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })
    })

    vi.useFakeTimers()

    const first = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Original Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const second = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'Updated Name',
        email: 'reuse@example.com',
        appBaseUrl: 'http://localhost',
      },
    )

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(second.profileId).toBe(first.profileId)

    const profiles = await t.run(async (ctx) => {
      const tenant = await ctx.db
        .query('tenants')
        .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', clerkOrgId))
        .unique()
      if (!tenant) throw new Error('Tenant not found.')
      return ctx.db
        .query('employeeProfiles')
        .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
        .collect()
    })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Updated Name')
  })

  it('marks profile as pending_credentials when ADP is not configured', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_no_adp'
    const adminId = 'user_admin_create_no_adp'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.createCaregiver,
      {
        clerkOrgId,
        displayName: 'New Caregiver',
        email: 'caregiver-no-adp@test.com',
        appBaseUrl: 'http://localhost',
      },
    )

    const profile = await t.run(async (ctx) => {
      return ctx.db.get(result.profileId as Id<'employeeProfiles'>)
    })

    expect(profile).toBeDefined()
    expect(profile?.email).toBe('caregiver-no-adp@test.com')
    expect(profile?.adpSyncStatus).toBe('pending_credentials')
  })

  it('rejects non-admin callers', async () => {
    stubClerkInvitation()
    const t = createTestConvex()
    const clerkOrgId = 'org_create_caregiver_coordinator'
    const coordinatorId = 'user_coordinator_create'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).action(
        api.employeeProfiles.createCaregiver,
        {
          clerkOrgId,
          displayName: 'Caregiver',
          email: 'caregiver@test.com',
          appBaseUrl: 'http://localhost',
        },
      ),
    ).rejects.toThrow('only agency admins')
  })
})

describe('runAdpInitialWorkerLoad', () => {
  it('returns correct matched/created counts with mocked ADP', async () => {
    stubAdpEnv()
    resetSharedMockAdp({
      workers: [
        {
          associateOID: 'aoid-one',
          workerID: 'w-one',
          displayName: 'Existing Employee',
          email: 'existing@example.com',
          status: 'active',
        },
        {
          associateOID: 'aoid-two',
          workerID: 'w-two',
          displayName: 'New ADP Employee',
          email: 'new@example.com',
          status: 'active',
        },
      ],
    })

    const t = createTestConvex()
    const clerkOrgId = 'org_adp_load_summary'
    const adminId = 'user_admin_load'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('integrationConnections', {
        tenantId,
        provider: 'adp',
        status: 'configured',
        lastCheckedAt: new Date().toISOString(),
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Existing Employee',
        email: 'existing@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const result = await asAdmin(t, adminId, clerkOrgId).action(
      api.employeeProfiles.runAdpInitialWorkerLoad,
      { clerkOrgId },
    )

    expect(result.status).toBe('success')
    expect(result.processed).toBe(2)
    expect(result.matched).toBe(1)
    expect(result.created).toBe(1)
    expect(result.errors).toBe(0)
  })
})

describe('listEmployeeProfiles', () => {
  it('returns profiles for admin and includes adpSyncStatus', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles'
    const adminId = 'user_admin_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('employeeProfiles', {
        tenantId,
        displayName: 'Caregiver One',
        email: 'one@example.com',
        adpSyncStatus: 'queued',
        createdAt: new Date().toISOString(),
      })
    })

    const profiles = await asAdmin(t, adminId, clerkOrgId).query(
      api.employeeProfiles.listEmployeeProfiles,
      { clerkOrgId },
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Caregiver One')
    expect(profiles[0]?.adpSyncStatus).toBe('queued')
  })

  it('rejects caregiver callers', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_list_profiles_caregiver'
    const caregiverId = 'user_cg_list'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).query(
        api.employeeProfiles.listEmployeeProfiles,
        { clerkOrgId },
      ),
    ).rejects.toThrow()
  })
})

describe('tenantSettings.updateShiftGeofence role guards', () => {
  it('allows admin and coordinator edits and rejects caregiver', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_geo_roles'
    const adminId = 'user_admin_geo'
    const coordinatorId = 'user_coordinator_geo'
    const caregiverId = 'user_cg_geo'

    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert('tenants', {
        clerkOrgId,
        name: 'Test Agency',
        slug: 'test-agency',
        createdAt: new Date().toISOString(),
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: adminId,
        role: 'org:admin',
        displayName: 'Admin',
        email: 'admin@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: coordinatorId,
        role: 'org:coordinator',
        displayName: 'Coordinator',
        email: 'coordinator@example.com',
      })

      await ctx.db.insert('tenantMembers', {
        tenantId,
        clerkUserId: caregiverId,
        role: 'org:caregiver',
        displayName: 'Caregiver',
        email: 'caregiver@example.com',
      })
    })

    const payload = {
      clerkOrgId,
      enabled: true,
      enforceClockIn: true,
      enforceClockOut: false,
      defaultRadiusMeters: 150,
      maxAccuracyMeters: 75,
    }

    await expect(
      asAdmin(t, adminId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).resolves.toBeDefined()

    await expect(
      asCaregiver(t, caregiverId, clerkOrgId).mutation(
        api.tenantSettings.updateShiftGeofence,
        payload,
      ),
    ).rejects.toThrow()
  })
})


 succeeded in 887ms:
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import schema from './schema'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.*s')

function createTestConvex() {
  return convexTest({ schema, modules })
}

async function seedSubmittedShift(
  t: ReturnType<typeof createTestConvex>,
  options: {
    clerkOrgId: string
    coordinatorId: string
    caregiverId: string
  },
) {
  return t.run(async (ctx) => {
    const tenantId = await ctx.db.insert('tenants', {
      clerkOrgId: options.clerkOrgId,
      name: 'Test Agency',
      slug: 'test-agency',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.coordinatorId,
      role: 'org:coordinator',
      displayName: 'Coordinator',
      email: 'coordinator@example.com',
    })

    await ctx.db.insert('tenantMembers', {
      tenantId,
      clerkUserId: options.caregiverId,
      role: 'org:caregiver',
      displayName: 'Caregiver',
      email: 'caregiver@example.com',
    })

    const clientId = await ctx.db.insert('clients', {
      tenantId,
      displayName: 'Test Client',
      serviceType: 'SLS',
      authorizationHours: 100,
      riskFlags: [],
    })

    const shiftId = await ctx.db.insert('shifts', {
      tenantId,
      clientId,
      caregiverId: options.caregiverId,
      scheduledStart: '2020-01-01T08:00:00Z',
      scheduledEnd: '2020-01-01T16:00:00Z',
      status: 'submitted',
      serviceType: 'SLS',
      rate: 25,
    })

    await ctx.db.insert('progressNotes', {
      tenantId,
      shiftId,
      startTime: '08:00',
      endTime: '16:00',
      servicesProvided: 'Bathing',
      clientResponse: 'All good',
      narrative: 'Completed visit.',
    })

    await ctx.db.insert('shiftTasks', {
      tenantId,
      shiftId,
      title: 'Documentation',
      requiredProof: false,
      status: 'complete',
    })

    await ctx.db.insert('timePunches', {
      tenantId,
      shiftId,
      caregiverId: options.caregiverId,
      punchType: 'clock_in',
      at: '2020-01-01T08:00:00Z',
      source: 'atriax',
      adpSyncStatus: 'pending_credentials',
      createdAt: new Date().toISOString(),
    })

    await ctx.db.insert('timePunches', {
      tenantId,
      shiftId,
      caregiverId: options.caregiverId,
      punchType: 'clock_out',
      at: '2020-01-01T16:00:00Z',
      source: 'atriax',
      adpSyncStatus: 'pending_credentials',
      createdAt: new Date().toISOString(),
    })

    return { tenantId, clientId, shiftId }
  })
}

function asCaregiver(
  t: ReturnType<typeof createTestConvex>,
  caregiverId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: caregiverId,
    org_id: clerkOrgId,
    org_role: 'org:caregiver',
  })
}

function asCoordinator(
  t: ReturnType<typeof createTestConvex>,
  coordinatorId: string,
  clerkOrgId: string,
) {
  return t.withIdentity({
    subject: coordinatorId,
    org_id: clerkOrgId,
    org_role: 'org:coordinator',
  })
}

describe('reviews', () => {
  it('rejects requestCorrection with an empty comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_empty'
    const coordinatorId = 'user_coordinator_empty'
    const caregiverId = 'user_cg_empty'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.requestCorrection,
        {
          clerkOrgId,
          shiftId,
          comment: '',
        },
      ),
    ).rejects.toThrow('A comment is required to request a correction.')
  })

  it('rejects requestCorrection with a whitespace-only comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_ws'
    const coordinatorId = 'user_coordinator_ws'
    const caregiverId = 'user_cg_ws'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.requestCorrection,
        {
          clerkOrgId,
          shiftId,
          comment: '   ',
        },
      ),
    ).rejects.toThrow('A comment is required to request a correction.')
  })

  it('accepts requestCorrection with a non-empty comment', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_correction_ok'
    const coordinatorId = 'user_coordinator_ok'
    const caregiverId = 'user_cg_ok'
    const { shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.requestCorrection,
      {
        clerkOrgId,
        shiftId,
        comment: 'Please add the missing proof.',
      },
    )

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('needs_correction')
  })

  it('rejects approval when documentation is incomplete', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_incomplete'
    const coordinatorId = 'user_coordinator_approve_incomplete'
    const caregiverId = 'user_cg_approve_incomplete'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await t.run(async (ctx) => {
      const note = await ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
      if (note) {
        await ctx.db.patch(note._id, { narrative: '' })
      }
    })

    await expect(
      asCoordinator(t, coordinatorId, clerkOrgId).mutation(
        api.reviews.approve,
        { clerkOrgId, shiftId, comment: 'Looks good' },
      ),
    ).rejects.toThrow('Incomplete documentation')

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('submitted')
  })

  it('approves a complete shift and creates a billing line', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_approve_complete'
    const coordinatorId = 'user_coordinator_approve_complete'
    const caregiverId = 'user_cg_approve_complete'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.approve,
      { clerkOrgId, shiftId, comment: 'Complete and accurate.' },
    )

    const shift = await t.run(async (ctx) => ctx.db.get(shiftId as Id<'shifts'>))
    expect(shift?.status).toBe('billing_ready')

    const billingLines = await t.run(async (ctx) => {
      return ctx.db
        .query('billingLines')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
    })
    expect(billingLines).toHaveLength(1)
    expect(billingLines[0]?.amount).toBeGreaterThan(0)
  })

  it('allows caregiver resubmission after correction and returns shift to review queue', async () => {
    const t = createTestConvex()
    const clerkOrgId = 'org_resubmit'
    const coordinatorId = 'user_coordinator_resubmit'
    const caregiverId = 'user_cg_resubmit'
    const { tenantId, shiftId } = await seedSubmittedShift(t, {
      clerkOrgId,
      coordinatorId,
      caregiverId,
    })

    await asCoordinator(t, coordinatorId, clerkOrgId).mutation(
      api.reviews.requestCorrection,
      { clerkOrgId, shiftId, comment: 'Fix the narrative.' },
    )

    const shiftedToCorrection = await t.run(async (ctx) =>
      ctx.db.get(shiftId as Id<'shifts'>),
    )
    expect(shiftedToCorrection?.status).toBe('needs_correction')

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.updateProgressNote,
      {
        clerkOrgId,
        shiftId,
        narrative: 'Updated narrative with sufficient detail for resubmission.',
      },
    )

    const note = await t.run(async (ctx) => {
      return ctx.db
        .query('progressNotes')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .unique()
    })

    const tasks = await t.run(async (ctx) => {
      return ctx.db
        .query('shiftTasks')
        .withIndex('by_tenant_shift', (q) =>
          q.eq('tenantId', tenantId).eq('shiftId', shiftId),
        )
        .collect()
    })

    await asCaregiver(t, caregiverId, clerkOrgId).mutation(
      api.shifts.submitDocumentation,
      {
        clerkOrgId,
        shiftId,
        note: {
          startTime: note?.startTime ?? '08:00',
          endTime: note?.endTime ?? '16:00',
          servicesProvided: note?.servicesProvided ?? 'Bathing',
          clientResponse: note?.clientResponse ?? 'All good',
          narrative: note?.narrative ?? 'Updated narrative.',
        },
        tasks: tasks.map((task) => ({
          taskId: task._id,
          status: 'complete' as const,
        })),
      },
    )

    const resubmitted = await t.run(async (ctx) =>
      ctx.db.get(shiftId as Id<'shifts'>),
    )
    expect(resubmitted?.status).toBe('submitted')
  })
})


 succeeded in 892ms:
export interface DocumentationNote {
  startTime: string
  endTime: string
  servicesProvided: string
  clientResponse: string
  narrative: string
}

export interface ExistingTask<TaskId extends string = string> {
  _id: TaskId
  title: string
  requiredProof: boolean
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

export interface TaskUpdate<TaskId extends string = string> {
  taskId: TaskId
  status: 'pending' | 'complete'
  proofUrl?: string
  proofName?: string
}

export interface ValidatedTask<TaskId extends string = string>
  extends ExistingTask<TaskId> {
  proofUrl?: string
  proofName?: string
}

export function mergeTaskUpdates<TaskId extends string>(
  tasks: ExistingTask<TaskId>[],
  updates: TaskUpdate<TaskId>[],
): ValidatedTask<TaskId>[] {
  const byTaskId = new Map(updates.map((update) => [update.taskId, update]))

  for (const update of updates) {
    if (!tasks.some((task) => task._id === update.taskId)) {
      throw new Error('Submitted task update does not belong to this shift.')
    }
  }

  return tasks.map((task) => {
    const update = byTaskId.get(task._id)
    if (!update) return task

    return {
      ...task,
      status: update.status,
      proofUrl: update.proofUrl,
      proofName: update.proofName,
    }
  })
}

export function validateShiftDocumentation(
  note: DocumentationNote,
  tasks: ExistingTask[],
): string[] {
  const blockers: string[] = []

  if (!note.startTime.trim()) blockers.push('Start time is required.')
  if (!note.endTime.trim()) blockers.push('End time is required.')
  if (!note.servicesProvided.trim()) {
    blockers.push('Services provided is required.')
  }
  if (!note.clientResponse.trim()) blockers.push('Client response is required.')
  if (!note.narrative.trim()) blockers.push('Narrative is required.')
  if (note.startTime.trim() && note.endTime.trim()) {
    const hours = calculateDocumentedHours(note.startTime, note.endTime)
    if (hours === null) blockers.push('End time must be after start time.')
  }

  for (const task of tasks) {
    if (task.status !== 'complete') {
      blockers.push(`${task.title} must be completed.`)
    }

    if (task.requiredProof && !task.proofName?.trim()) {
      blockers.push(`${task.title} requires proof.`)
    }
  }

  return blockers
}

export function calculateDocumentedHours(
  startTime: string,
  endTime: string,
): number | null {
  const start = minutesSinceMidnight(startTime)
  const end = minutesSinceMidnight(endTime)
  if (start === null || end === null || end <= start) return null
  return Math.round(((end - start) / 60) * 100) / 100
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function minutesSinceMidnight(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}


 succeeded in 689ms:
import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertTenantDoc, requireTenantRole } from './authHelpers'
import type { TenantRole } from './authHelpers'

type PunchActor = {
  role: TenantRole
  clerkUserId: string
}

export function assertPunchAuthorized(
  actor: PunchActor,
  caregiverId: string,
) {
  if (actor.role === 'org:caregiver' && actor.clerkUserId !== caregiverId) {
    throw new Error('Caregivers can only act on their assigned shifts.')
  }
}

export const get = query({
  args: { clerkOrgId: v.string(), punchId: v.id('timePunches') },
  handler: async (ctx, { clerkOrgId, punchId }) => {
    const { tenantId, identity, role } = await requireTenantRole(
      ctx,
      clerkOrgId,
      ['org:admin', 'org:coordinator', 'org:caregiver'],
    )

    const punch = await ctx.db.get(punchId)
    if (!punch) throw new Error('Time punch not found.')
    assertTenantDoc(punch, tenantId)
    assertPunchAuthorized(
      { role, clerkUserId: identity.subject },
      punch.caregiverId,
    )
    return punch
  },
})


codex
The review is no longer just about missing tests: I found a likely transactional ordering risk in the new caregiver creation action. I’m checking line references and whether the existing tests cover failure ordering before deciding if it rises to a requested change.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"createCaregiverProfile|sendClerkInvitation|CLERK_SECRET_KEY|scheduler.runAfter|return \\{ profileId\" convex/employeeProfiles.ts convex/employeeProfiles.test.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "creates an employee profile|marks profile|rejects non-admin|fail|invitation|CLERK" convex/employeeProfiles.test.ts src/features/team/pages/TeamPage.test.tsx' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"action\\(|mutation\\(|query\\(|internalMutation|internalQuery|internalAction|requireTenant|requireTenantRole|assertTenantDoc|ctx\\.db\" convex/adpSync.ts convex/adpOutbound.ts convex/employeeProfiles.ts convex/members.ts convex/seed.ts convex/shifts.ts convex/shiftQueries.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"export const approve|billingLines|validateShiftDocumentation|status: 'billing_ready'\" convex/reviews.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "seedE2E|resetE2EShifts|requireTenantRole|today|resetShift|timePunches" convex/seed.ts tests/e2e/global-setup.ts tests/e2e/helpers/auth.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 1301ms:
convex/shifts.ts:3:import { requireTenantRole, assertTenantDoc } from './authHelpers'
convex/shifts.ts:26:  const member = await ctx.db
convex/shifts.ts:27:    .query('tenantMembers')
convex/shifts.ts:57:  const shift = await ctx.db.get(shiftId)
convex/shifts.ts:59:  assertTenantDoc(shift, tenantId)
convex/shifts.ts:68:  const note = await ctx.db
convex/shifts.ts:69:    .query('progressNotes')
convex/shifts.ts:76:  assertTenantDoc(note, tenantId)
convex/shifts.ts:85:  const tasks = await ctx.db
convex/shifts.ts:86:    .query('shiftTasks')
convex/shifts.ts:92:  for (const task of tasks) assertTenantDoc(task, tenantId)
convex/shifts.ts:102:  return ctx.db
convex/shifts.ts:103:    .query('timePunches')
convex/shifts.ts:140:  const settings = await ctx.db
convex/shifts.ts:141:    .query('tenantSettings')
convex/shifts.ts:170:  const client = await ctx.db.get(shift.clientId)
convex/shifts.ts:172:  assertTenantDoc(client, tenantId)
convex/shifts.ts:205:  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:233:  await ctx.db.patch(existingNote._id, {
convex/shifts.ts:244:    await ctx.db.patch(task._id, {
convex/shifts.ts:251:  await ctx.db.patch(args.shiftId, { status: 'submitted' })
convex/shifts.ts:275:  const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:295:  const punchId = await ctx.db.insert('timePunches', {
convex/shifts.ts:325:export const create = mutation({
convex/shifts.ts:336:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:341:    const client = await ctx.db.get(args.clientId)
convex/shifts.ts:343:    assertTenantDoc(client, tenantId)
convex/shifts.ts:348:    const shiftId = await ctx.db.insert('shifts', {
convex/shifts.ts:359:    await ctx.db.insert('progressNotes', {
convex/shifts.ts:369:    await ctx.db.insert('shiftTasks', {
convex/shifts.ts:381:export const createMany = mutation({
convex/shifts.ts:393:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:419:      const client = await ctx.db.get(clientId)
convex/shifts.ts:421:      assertTenantDoc(client, tenantId)
convex/shifts.ts:444:        const shiftId = await ctx.db.insert('shifts', {
convex/shifts.ts:455:        await ctx.db.insert('progressNotes', {
convex/shifts.ts:465:        await ctx.db.insert('shiftTasks', {
convex/shifts.ts:482:export const startDocumentation = mutation({
convex/shifts.ts:488:    const { tenantId, identity, role } = await requireTenantRole(
convex/shifts.ts:494:    const shift = await ctx.db.get(args.shiftId)
convex/shifts.ts:496:    assertTenantDoc(shift, tenantId)
convex/shifts.ts:512:    await ctx.db.patch(args.shiftId, { status: 'in_progress' })
convex/shifts.ts:526:export const updateProgressNote = mutation({
convex/shifts.ts:537:    const { tenantId, identity, role } = await requireTenantRole(
convex/shifts.ts:565:    await ctx.db.patch(note._id, patch)
convex/shifts.ts:570:export const submitDocumentation = mutation({
convex/shifts.ts:591:    const { identity, role } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:601:export const clockIn = mutation({
convex/shifts.ts:614:    const { tenantId, identity } = await requireTenantRole(
convex/shifts.ts:652:    await ctx.db.patch(args.shiftId, {
convex/shifts.ts:661:export const clockOut = mutation({
convex/shifts.ts:693:    const { tenantId, identity, role } = await requireTenantRole(
convex/shifts.ts:746:      punchId = await ctx.db.insert('timePunches', {
convex/shifts.ts:773:      await ctx.db.patch(args.shiftId, { clockOutAt: now })
convex/shifts.ts:803:export const updateServiceLocationOverride = mutation({
convex/shifts.ts:818:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:851:    await ctx.db.patch(args.shiftId, {
convex/shifts.ts:859:export const updateStatus = mutation({
convex/shifts.ts:866:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/shifts.ts:871:    const shift = await ctx.db.get(args.shiftId)
convex/shifts.ts:873:    assertTenantDoc(shift, tenantId)
convex/shifts.ts:875:    await ctx.db.patch(args.shiftId, { status: args.status })
convex/shiftQueries.ts:4:  assertTenantDoc,
convex/shiftQueries.ts:5:  requireTenant,
convex/shiftQueries.ts:6:  requireTenantRole,
convex/shiftQueries.ts:21:export const listMyShifts = query({
convex/shiftQueries.ts:24:    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
convex/shiftQueries.ts:26:    const shifts = await ctx.db
convex/shiftQueries.ts:27:      .query('shifts')
convex/shiftQueries.ts:35:      shifts.map((shift) => ctx.db.get(shift.clientId)),
convex/shiftQueries.ts:39:      if (client) assertTenantDoc(client, tenantId)
convex/shiftQueries.ts:49:export const listForReview = query({
convex/shiftQueries.ts:52:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/shiftQueries.ts:57:    const submitted = await ctx.db
convex/shiftQueries.ts:58:      .query('shifts')
convex/shiftQueries.ts:65:    const needsCorrection = await ctx.db
convex/shiftQueries.ts:66:      .query('shifts')
convex/shiftQueries.ts:77:export const listBillingReady = query({
convex/shiftQueries.ts:80:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/shiftQueries.ts:85:    return ctx.db
convex/shiftQueries.ts:86:      .query('shifts')
convex/shiftQueries.ts:95:export const listAll = query({
convex/shiftQueries.ts:98:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/shiftQueries.ts:103:    return ctx.db
convex/shiftQueries.ts:104:      .query('shifts')
convex/shiftQueries.ts:111:export const get = query({
convex/shiftQueries.ts:114:    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
convex/shiftQueries.ts:115:    const shift = await ctx.db.get(shiftId)
convex/shiftQueries.ts:117:    assertTenantDoc(shift, tenantId)
convex/shiftQueries.ts:123:export const getWithDetails = query({
convex/shiftQueries.ts:126:    const { tenantId, identity, role } = await requireTenant(ctx, clerkOrgId)
convex/shiftQueries.ts:127:    const shift = await ctx.db.get(shiftId)
convex/shiftQueries.ts:129:    assertTenantDoc(shift, tenantId)
convex/shiftQueries.ts:133:      ctx.db.get(shift.clientId),
convex/shiftQueries.ts:134:      ctx.db
convex/shiftQueries.ts:135:        .query('progressNotes')
convex/shiftQueries.ts:140:      ctx.db
convex/shiftQueries.ts:141:        .query('shiftTasks')
convex/shiftQueries.ts:146:      ctx.db
convex/shiftQueries.ts:147:        .query('reviewEvents')
convex/shiftQueries.ts:153:      ctx.db
convex/shiftQueries.ts:154:        .query('timePunches')
convex/shiftQueries.ts:161:    if (client) assertTenantDoc(client, tenantId)
convex/shiftQueries.ts:162:    if (note) assertTenantDoc(note, tenantId)
convex/shiftQueries.ts:163:    for (const task of tasks) assertTenantDoc(task, tenantId)
convex/shiftQueries.ts:164:    for (const review of reviews) assertTenantDoc(review, tenantId)
convex/shiftQueries.ts:165:    for (const punch of punches) assertTenantDoc(punch, tenantId)
convex/shiftQueries.ts:187:export const dashboardStats = query({
convex/shiftQueries.ts:190:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/shiftQueries.ts:195:    const all = await ctx.db
convex/shiftQueries.ts:196:      .query('shifts')
convex/shiftQueries.ts:200:    const billingLines = await ctx.db
convex/shiftQueries.ts:201:      .query('billingLines')
convex/seed.ts:3:import { requireTenantRole } from './authHelpers'
convex/seed.ts:10:export const seedAgency = mutation({
convex/seed.ts:16:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:32:      const all = await ctx.db
convex/seed.ts:33:        .query('clients')
convex/seed.ts:43:      clientSlsId = await ctx.db.insert('clients', {
convex/seed.ts:59:      clientIlsId = await ctx.db.insert('clients', {
convex/seed.ts:77:      const all = await ctx.db
convex/seed.ts:78:        .query('shifts')
convex/seed.ts:98:      const existingNote = await ctx.db
convex/seed.ts:99:        .query('progressNotes')
convex/seed.ts:103:        await ctx.db.insert('progressNotes', {
convex/seed.ts:117:      const existingTasks = await ctx.db
convex/seed.ts:118:        .query('shiftTasks')
convex/seed.ts:124:          await ctx.db.insert('shiftTasks', {
convex/seed.ts:137:        const existingReviews = await ctx.db
convex/seed.ts:138:          .query('reviewEvents')
convex/seed.ts:142:          await ctx.db.insert('reviewEvents', {
convex/seed.ts:155:        const existingBilling = await ctx.db
convex/seed.ts:156:          .query('billingLines')
convex/seed.ts:160:          await ctx.db.insert('billingLines', {
convex/seed.ts:179:      shift1Id = await ctx.db.insert('shifts', {
convex/seed.ts:207:      shift2Id = await ctx.db.insert('shifts', {
convex/seed.ts:235:      shift3Id = await ctx.db.insert('shifts', {
convex/seed.ts:271:      shift4Id = await ctx.db.insert('shifts', {
convex/seed.ts:319:      const all = await ctx.db
convex/seed.ts:320:        .query('complianceDocs')
convex/seed.ts:328:      await ctx.db.insert('complianceDocs', {
convex/seed.ts:343:      await ctx.db.insert('complianceDocs', {
convex/seed.ts:389:export const seedCaregiverShifts = mutation({
convex/seed.ts:395:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:400:    const clients = await ctx.db
convex/seed.ts:401:      .query('clients')
convex/seed.ts:411:      const all = await ctx.db
convex/seed.ts:412:        .query('shifts')
convex/seed.ts:426:      await ctx.db.insert('shifts', {
convex/seed.ts:445:      await ctx.db.insert('shifts', {
convex/seed.ts:508:export const seedE2E = mutation({
convex/seed.ts:516:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:545:      const existing = await ctx.db
convex/seed.ts:546:        .query('tenantMembers')
convex/seed.ts:554:        memberIds[member.clerkUserId] = await ctx.db.insert('tenantMembers', {
convex/seed.ts:565:      const all = await ctx.db
convex/seed.ts:566:        .query('clients')
convex/seed.ts:575:      lifecycleClientId = await ctx.db.insert('clients', {
convex/seed.ts:589:      geofenceClientId = await ctx.db.insert('clients', {
convex/seed.ts:609:    const existingSettings = await ctx.db
convex/seed.ts:610:      .query('tenantSettings')
convex/seed.ts:621:      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
convex/seed.ts:623:      await ctx.db.insert('tenantSettings', {
convex/seed.ts:630:      const all = await ctx.db
convex/seed.ts:631:        .query('shifts')
convex/seed.ts:638:      await ctx.db.patch(shiftId, {
convex/seed.ts:645:      const existingNote = await ctx.db
convex/seed.ts:646:        .query('progressNotes')
convex/seed.ts:652:        await ctx.db.patch(existingNote._id, {
convex/seed.ts:662:        await ctx.db.insert('progressNotes', {
convex/seed.ts:673:      const existingTasks = await ctx.db
convex/seed.ts:674:        .query('shiftTasks')
convex/seed.ts:680:        await ctx.db.delete(task._id)
convex/seed.ts:682:      await ctx.db.insert('shiftTasks', {
convex/seed.ts:690:      const reviews = await ctx.db
convex/seed.ts:691:        .query('reviewEvents')
convex/seed.ts:697:        await ctx.db.delete(review._id)
convex/seed.ts:700:      const billingLines = await ctx.db
convex/seed.ts:701:        .query('billingLines')
convex/seed.ts:707:        await ctx.db.delete(line._id)
convex/seed.ts:710:      const punches = await ctx.db
convex/seed.ts:711:        .query('timePunches')
convex/seed.ts:717:        await ctx.db.delete(punch._id)
convex/seed.ts:725:      lifecycleShiftId = await ctx.db.insert('shifts', {
convex/seed.ts:737:      await ctx.db.patch(lifecycleShiftId, { caregiverId: args.caregiverUserId })
convex/seed.ts:745:      geofenceShiftId = await ctx.db.insert('shifts', {
convex/seed.ts:757:      await ctx.db.patch(geofenceShiftId, { caregiverId: args.caregiverUserId })
convex/seed.ts:774:export const resetE2EShifts = mutation({
convex/seed.ts:779:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:785:    const existingSettings = await ctx.db
convex/seed.ts:786:      .query('tenantSettings')
convex/seed.ts:797:      await ctx.db.patch(existingSettings._id, { shiftGeofence: defaultGeofence })
convex/seed.ts:801:      const all = await ctx.db
convex/seed.ts:802:        .query('shifts')
convex/seed.ts:809:      await ctx.db.patch(shiftId, {
convex/seed.ts:816:      const existingNote = await ctx.db
convex/seed.ts:817:        .query('progressNotes')
convex/seed.ts:823:        await ctx.db.patch(existingNote._id, {
convex/seed.ts:834:      const existingTasks = await ctx.db
convex/seed.ts:835:        .query('shiftTasks')
convex/seed.ts:841:        await ctx.db.delete(task._id)
convex/seed.ts:843:      await ctx.db.insert('shiftTasks', {
convex/seed.ts:851:      const reviews = await ctx.db
convex/seed.ts:852:        .query('reviewEvents')
convex/seed.ts:858:        await ctx.db.delete(review._id)
convex/seed.ts:861:      const billingLines = await ctx.db
convex/seed.ts:862:        .query('billingLines')
convex/seed.ts:868:        await ctx.db.delete(line._id)
convex/seed.ts:871:      const punches = await ctx.db
convex/seed.ts:872:        .query('timePunches')
convex/seed.ts:878:        await ctx.db.delete(punch._id)
convex/employeeProfiles.ts:4:  internalMutation,
convex/employeeProfiles.ts:9:import { requireTenantRole } from './authHelpers'
convex/employeeProfiles.ts:21:  const existingByClerkUserId = await ctx.db
convex/employeeProfiles.ts:22:    .query('employeeProfiles')
convex/employeeProfiles.ts:30:      await ctx.db.patch(existingByClerkUserId._id, { tenantMemberId: member._id })
convex/employeeProfiles.ts:36:  const existingByEmail = await ctx.db
convex/employeeProfiles.ts:37:    .query('employeeProfiles')
convex/employeeProfiles.ts:50:    await ctx.db.patch(existingByEmail._id, {
convex/employeeProfiles.ts:59:  return ctx.db.insert('employeeProfiles', {
convex/employeeProfiles.ts:70:export const createCaregiverProfile = internalMutation({
convex/employeeProfiles.ts:85:    const existing = await ctx.db
convex/employeeProfiles.ts:86:      .query('employeeProfiles')
convex/employeeProfiles.ts:92:      await ctx.db.patch(existing._id, {
convex/employeeProfiles.ts:102:    const profileId = await ctx.db.insert('employeeProfiles', {
convex/employeeProfiles.ts:118:export const createCaregiver = action({
convex/employeeProfiles.ts:196:export const listEmployeeProfiles = query({
convex/employeeProfiles.ts:199:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
convex/employeeProfiles.ts:201:    const profiles = await ctx.db
convex/employeeProfiles.ts:202:      .query('employeeProfiles')
convex/employeeProfiles.ts:206:    const members = await ctx.db
convex/employeeProfiles.ts:207:      .query('tenantMembers')
convex/employeeProfiles.ts:228:export const runAdpInitialWorkerLoad = action({
convex/adpSync.ts:3:  internalMutation,
convex/adpSync.ts:4:  internalQuery,
convex/adpSync.ts:11:import { assertTenantDoc, requireTenantRole } from './authHelpers'
convex/adpSync.ts:86:export const loadPunchForAdpSync = internalQuery({
convex/adpSync.ts:89:    const punch = await ctx.db.get(timePunchId)
convex/adpSync.ts:95:export const loadEmployeeProfileForAdpSync = internalQuery({
convex/adpSync.ts:98:    const profile = await ctx.db.get(employeeProfileId)
convex/adpSync.ts:104:export const findEmployeeProfileByClerkUserId = internalQuery({
convex/adpSync.ts:107:    return ctx.db
convex/adpSync.ts:108:      .query('employeeProfiles')
convex/adpSync.ts:116:export const findEmployeeProfilesByTenant = internalQuery({
convex/adpSync.ts:119:    return ctx.db
convex/adpSync.ts:120:      .query('employeeProfiles')
convex/adpSync.ts:126:export const isAdpConfiguredForTenant = internalQuery({
convex/adpSync.ts:133:export const patchPunchAdpStatus = internalMutation({
convex/adpSync.ts:142:    const punch = await ctx.db.get(args.timePunchId)
convex/adpSync.ts:144:    assertTenantDoc(punch, args.tenantId)
convex/adpSync.ts:155:    await ctx.db.patch(args.timePunchId, patch)
convex/adpSync.ts:159:export const patchWorkerAdpStatus = internalMutation({
convex/adpSync.ts:169:    const profile = await ctx.db.get(args.employeeProfileId)
convex/adpSync.ts:171:    assertTenantDoc(profile, args.tenantId)
convex/adpSync.ts:197:    await ctx.db.patch(args.employeeProfileId, patch)
convex/adpSync.ts:201:export const upsertMatchedEmployeeProfile = internalMutation({
convex/adpSync.ts:212:      const match = await ctx.db.get(args.matchProfileId)
convex/adpSync.ts:214:      assertTenantDoc(match, args.tenantId)
convex/adpSync.ts:215:      await ctx.db.patch(args.matchProfileId, {
convex/adpSync.ts:223:    return ctx.db.insert('employeeProfiles', {
convex/adpSync.ts:235:export const claimIntegrationEvent = internalMutation({
convex/adpSync.ts:245:    const events = await ctx.db
convex/adpSync.ts:246:      .query('integrationEvents')
convex/adpSync.ts:275:    const eventId = await ctx.db.insert('integrationEvents', {
convex/adpSync.ts:291:export const patchIntegrationEvent = internalMutation({
convex/adpSync.ts:300:    await ctx.db.patch(args.eventId, {
convex/adpSync.ts:309:export const triggerInitialWorkerLoad = mutation({
convex/adpSync.ts:312:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/members.ts:9:  requireTenant,
convex/members.ts:10:  requireTenantRole,
convex/members.ts:14:export const checkMembership = query({
convex/members.ts:23:    const tenant = await ctx.db
convex/members.ts:24:      .query('tenants')
convex/members.ts:30:    const member = await ctx.db
convex/members.ts:31:      .query('tenantMembers')
convex/members.ts:41:export const me = query({
convex/members.ts:44:    const { tenantId, identity } = await requireTenant(ctx, clerkOrgId)
convex/members.ts:45:    return ctx.db
convex/members.ts:46:      .query('tenantMembers')
convex/members.ts:54:export const list = query({
convex/members.ts:57:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/members.ts:61:    const members = await ctx.db
convex/members.ts:62:      .query('tenantMembers')
convex/members.ts:70:export const listCaregivers = query({
convex/members.ts:73:    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
convex/members.ts:78:    const members = await ctx.db
convex/members.ts:79:      .query('tenantMembers')
convex/members.ts:89:export const sync = mutation({
convex/members.ts:109:    const tenant = await ctx.db
convex/members.ts:110:      .query('tenants')
convex/members.ts:118:    const existing = await ctx.db
convex/members.ts:119:      .query('tenantMembers')
convex/members.ts:129:      await ctx.db.patch(existing._id, {
convex/members.ts:149:    const memberId = await ctx.db.insert('tenantMembers', {
convex/members.ts:158:      const newMember = await ctx.db.get(memberId)
convex/members.ts:177:export const updateRole = mutation({
convex/members.ts:188:    const { tenantId, identity } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/members.ts:196:    const existing = await ctx.db
convex/members.ts:197:      .query('tenantMembers')
convex/members.ts:207:    await ctx.db.patch(existing._id, { role: args.role })
convex/members.ts:227:export const remove = mutation({
convex/members.ts:233:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/members.ts:237:    const existing = await ctx.db
convex/members.ts:238:      .query('tenantMembers')
convex/members.ts:245:      await ctx.db.delete(existing._id)
convex/adpOutbound.ts:4:import { internalAction, type ActionCtx } from './_generated/server'
convex/adpOutbound.ts:45:export const adpSyncPunch = internalAction({
convex/adpOutbound.ts:183:export const adpSyncWorker = internalAction({
convex/adpOutbound.ts:321:export const adpInitialWorkerLoad = internalAction({

 succeeded in 1357ms:
src/features/team/pages/TeamPage.test.tsx:57:  invitations?: Array<{
src/features/team/pages/TeamPage.test.tsx:70:  const invitations = options.invitations ?? []
src/features/team/pages/TeamPage.test.tsx:78:        data: invitations,
src/features/team/pages/TeamPage.test.tsx:120:  it('creates caregiver invitations through the server redirect flow', async () => {
src/features/team/pages/TeamPage.test.tsx:164:  it('passes coordinator intent to the server invitation flow', async () => {
src/features/team/pages/TeamPage.test.tsx:304:  it('renders pending invitations fetched from Clerk', async () => {
src/features/team/pages/TeamPage.test.tsx:316:      invitations: [
src/features/team/pages/TeamPage.test.tsx:338:  it('shows a revoke button for pending invitations', async () => {
src/features/team/pages/TeamPage.test.tsx:350:      invitations: [
src/features/team/pages/TeamPage.test.tsx:372:  it('refreshes invitations list after sending an invite', async () => {
src/features/team/pages/TeamPage.test.tsx:452:      invitationId: 'inv_cg',
convex/employeeProfiles.test.ts:25:  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')
convex/employeeProfiles.test.ts:92:  it('creates an employee profile and enqueues worker sync', async () => {
convex/employeeProfiles.test.ts:225:  it('marks profile as pending_credentials when ADP is not configured', async () => {
convex/employeeProfiles.test.ts:267:  it('rejects non-admin callers', async () => {

 succeeded in 1365ms:
convex/employeeProfiles.ts:12:import { sendClerkInvitation } from './invitations'
convex/employeeProfiles.ts:70:export const createCaregiverProfile = internalMutation({
convex/employeeProfiles.ts:96:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex/employeeProfiles.ts:110:    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
convex/employeeProfiles.ts:163:      internal.employeeProfiles.createCaregiverProfile,
convex/employeeProfiles.ts:172:    const secretKey = process.env.CLERK_SECRET_KEY
convex/employeeProfiles.ts:174:      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
convex/employeeProfiles.ts:177:    const invitation = await sendClerkInvitation({
convex/employeeProfiles.test.ts:25:  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_clerk')

 succeeded in 1322ms:
8:  validateShiftDocumentation,
11:export const approve = mutation({
51:    const blockers = validateShiftDocumentation(note, tasks)
63:    await ctx.db.patch(args.shiftId, { status: 'billing_ready' })
76:    await ctx.db.insert('billingLines', {
125:      const billingLines = await ctx.db
126:        .query('billingLines')
132:      for (const line of billingLines) {

 succeeded in 1250ms:
tests/e2e/helpers/auth.ts:96:export async function resetE2EShifts(page: Page) {
tests/e2e/helpers/auth.ts:118:      path: 'seed:resetE2EShifts',
tests/e2e/helpers/auth.ts:126:    throw new Error(`resetE2EShifts failed: ${response.status} ${text}`)
tests/e2e/helpers/auth.ts:130:  console.log('resetE2EShifts result:', result)
tests/e2e/global-setup.ts:29:async function seedE2EFixtures(
tests/e2e/global-setup.ts:49:      path: 'seed:seedE2E',
tests/e2e/global-setup.ts:62:    throw new Error(`seedE2E failed: ${response.status} ${text}`)
tests/e2e/global-setup.ts:66:  console.log('seedE2E result:', result)
tests/e2e/global-setup.ts:121:    await seedE2EFixtures(token, {
convex/seed.ts:3:import { requireTenantRole } from './authHelpers'
convex/seed.ts:16:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:175:    // Shift 1: in_progress today
convex/seed.ts:395:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:409:    const today = new Date().toISOString().split('T')[0]
convex/seed.ts:422:    // Demo shift 1: scheduled for today morning
convex/seed.ts:423:    const start1 = `${today}T09:00:00Z`
convex/seed.ts:431:        scheduledEnd: `${today}T13:00:00Z`,
convex/seed.ts:441:    // Demo shift 2: scheduled for today afternoon
convex/seed.ts:442:    const start2 = `${today}T14:00:00Z`
convex/seed.ts:450:        scheduledEnd: `${today}T18:00:00Z`,
convex/seed.ts:508:export const seedE2E = mutation({
convex/seed.ts:516:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:520:    const today = new Date().toISOString().slice(0, 10)
convex/seed.ts:637:    const resetShift = async (shiftId: Id<'shifts'>) => {
convex/seed.ts:711:        .query('timePunches')
convex/seed.ts:722:    const lifecycleStart = `${today}T09:00:00Z`
convex/seed.ts:730:        scheduledEnd: `${today}T13:00:00Z`,
convex/seed.ts:739:    await resetShift(lifecycleShiftId)
convex/seed.ts:742:    const geofenceStart = `${today}T14:00:00Z`
convex/seed.ts:750:        scheduledEnd: `${today}T18:00:00Z`,
convex/seed.ts:759:    await resetShift(geofenceShiftId)
convex/seed.ts:774:export const resetE2EShifts = mutation({
convex/seed.ts:779:    const { tenantId } = await requireTenantRole(ctx, args.clerkOrgId, [
convex/seed.ts:783:    const today = new Date().toISOString().slice(0, 10)
convex/seed.ts:808:    const resetShift = async (shiftId: Id<'shifts'>) => {
convex/seed.ts:872:        .query('timePunches')
convex/seed.ts:882:    const lifecycleShift = await findShift(`${today}T09:00:00Z`)
convex/seed.ts:884:      await resetShift(lifecycleShift._id)
convex/seed.ts:887:    const geofenceShift = await findShift(`${today}T14:00:00Z`)
convex/seed.ts:889:      await resetShift(geofenceShift._id)

codex
The gate logs confirm lint/typecheck/unit are green and `git diff --check` now has only line-ending warnings. I’m doing one last pass over generated/API consistency and e2e seeding details before writing the final review.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "profileId|sendClerkInvitation|CLERK_SECRET_KEY|createCaregiverProfile" convex/employeeProfiles.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "employeeProfiles|adpOutbound|tenantSettings|seedE2E|resetE2EShifts" convex/_generated/api.d.ts convex/_generated/api.js convex/_generated/server.d.ts convex/_generated/server.js' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "geofence disabled|clock-in-start-button|data-testid|shift-card|statusBadge" src/features/caregiver/pages/CaregiverTodayPage.tsx src/features/caregiver/components/ShiftTaskList.tsx src/features/caregiver/components/ShiftNoteStep.tsx src/features/caregiver/components/ShiftSuccessScreen.tsx' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'tests/e2e/billing-flow.spec.ts'; Get-Content -Raw -LiteralPath 'tests/e2e/platform-route.spec.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath '.hermes-pipeline\\20260626_161701\\implementation-plan.md'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 1045ms:
12:import { sendClerkInvitation } from './invitations'
70:export const createCaregiverProfile = internalMutation({
102:    const profileId = await ctx.db.insert('employeeProfiles', {
111:      employeeProfileId: profileId,
114:    return profileId
129:    profileId: Id<'employeeProfiles'>
162:    const profileId: Id<'employeeProfiles'> = await ctx.runMutation(
163:      internal.employeeProfiles.createCaregiverProfile,
172:    const secretKey = process.env.CLERK_SECRET_KEY
174:      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
177:    const invitation = await sendClerkInvitation({
187:      profileId,

 succeeded in 1081ms:
convex/_generated/api.d.ts:11:import type * as adpOutbound from "../adpOutbound.js";
convex/_generated/api.d.ts:19:import type * as employeeProfiles from "../employeeProfiles.js";
convex/_generated/api.d.ts:37:import type * as tenantSettings from "../tenantSettings.js";
convex/_generated/api.d.ts:48:  adpOutbound: typeof adpOutbound;
convex/_generated/api.d.ts:56:  employeeProfiles: typeof employeeProfiles;
convex/_generated/api.d.ts:74:  tenantSettings: typeof tenantSettings;

 succeeded in 1042ms:
src/features/caregiver/components/ShiftSuccessScreen.tsx:17:    <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center" data-testid="shift-success-screen">
src/features/caregiver/components/ShiftNoteStep.tsx:161:      <div data-testid={`step-content-${stepId}`} className="hidden" />
src/features/caregiver/components/ShiftNoteStep.tsx:243:            data-testid={label === 'I started at' ? 'start-time-input' : 'end-time-input'}
src/features/caregiver/components/ShiftNoteStep.tsx:290:            data-testid={`service-option-${service.label}`}
src/features/caregiver/components/ShiftNoteStep.tsx:338:        data-testid="narrative-textarea"
src/features/caregiver/components/ShiftNoteStep.tsx:397:            data-testid={`goal-option-${goal.label}`}
src/features/caregiver/components/ShiftNoteStep.tsx:444:          data-testid="issue-choice-no"
src/features/caregiver/components/ShiftNoteStep.tsx:464:          data-testid="issue-choice-yes"
src/features/caregiver/components/ShiftNoteStep.tsx:557:          data-testid="confirm-checkbox"
src/features/caregiver/pages/CaregiverTodayPage.tsx:91:                  data-testid={`shift-card-${shift._id}`}
src/features/caregiver/pages/CaregiverTodayPage.tsx:94:                    <StatusBadge status={shift.status} data-testid="shift-status-badge" />
src/features/caregiver/pages/CaregiverTodayPage.tsx:126:                  data-testid="clock-in-start-button"
src/features/caregiver/pages/CaregiverTodayPage.tsx:175:  'data-testid': testId,
src/features/caregiver/pages/CaregiverTodayPage.tsx:178:  'data-testid'?: string
src/features/caregiver/pages/CaregiverTodayPage.tsx:190:    <Badge variant={config.variant} data-testid={testId}>
src/features/caregiver/components/ShiftTaskList.tsx:123:                data-testid={`task-complete-checkbox-${task._id}`}
src/features/caregiver/components/ShiftTaskList.tsx:164:                          data-testid={`task-proof-input-${task._id}`}

 succeeded in 1079ms:
import { expect, test } from '@playwright/test'

test('sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page).toHaveURL(/sign-in/)
})

test('select-agency page loads', async ({ page }) => {
  await page.goto('/select-agency')
  await expect(page).toHaveURL(/select-agency/)
})

test('root path loads', async ({ page }) => {
  await page.goto('/')
  // Root will redirect based on auth state; just verify it doesn't 404
  expect(page.url()).not.toContain('404')
})

import { test, expect } from '@playwright/test'

test('platform page loads without server error', async ({ page }) => {
  const response = await page.goto('/platform')
  expect(response?.status()).toBeLessThan(500)
  // Unauthenticated users are redirected â€” page should not crash
  const body = await page.locator('body').textContent()
  expect(body).toBeTruthy()
})


 succeeded in 1071ms:
# ATRIA-X Phase 1 Session 8 â€” Implementation Plan

## Goal

Implement and verify end-to-end and integration test coverage for the complete caregiver-to-billing shift lifecycle, geofence enforcement, and ADP mock integration contracts.

## Acceptance Criteria

- `npm run e2e` covers the full seeded lifecycle with geofence disabled:
  - Caregiver clocks in.
  - Completes the 6-step note.
  - Clock Out disabled until note complete, then enabled.
  - Clock Out submits the shift.
  - Coordinator requests a correction.
  - Caregiver fixes and resubmits.
  - Coordinator approves â†’ shift becomes billing-ready.
  - Each lifecycle state asserts both status word and status color.

- Geofence coverage verifies:
  - Inside radius allows clock in/out and stores location evidence.
  - Outside radius shows blocked UI and server rejects the punch.
  - Denied geolocation shows blocked UI and creates no punch.
  - Disabling geofence prevents location requests.

- ADP contract/integration tests verify:
  - Unconfigured tenant keeps app usable and marks punches `pending_credentials`.
  - Configured mock ADP sync posts queued punches exactly once.
  - `adpPunchId` stored and statuses become `synced`.
  - Initial worker load matches existing profiles by email and creates missing profiles with `adpAssociateOid`.
  - `createCaregiver` enqueues worker sync and drains to `synced`.
  - No secrets/raw credentials appear in `integrationEvents` or logs.
  - Location evidence is not sent in ADP punch payloads.

- Required gates genuinely green:
  - `npx convex codegen` if Convex API/schema changed
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run e2e`

## Stages

### Stage 1 â€” Fixtures & selectors

- [x] Inspect existing auth, route guards, seed helpers, and test setup.
- [x] Update `convex/seed.ts` with deterministic e2e fixtures:
  - `seedE2E` mutation that creates/updates a test tenant, members (admin, coordinator, caregiver), clients with service addresses, and shifts for lifecycle + geofence scenarios.
  - Accepts the real Clerk user IDs for the configured test accounts instead of hard-coding placeholder IDs.
  - Resets fixture shifts, reviews, billing lines, time punches, and tasks to a clean scheduled baseline on every run.
  - Resets geofence settings to disabled on every run.
  - `resetE2EShifts` mutation for serial e2e scenarios to restore the baseline between tests.
- [x] Add `data-testid` attributes to key UI surfaces:
  - `CaregiverTodayPage` shift cards and "Clock in & start" button.
  - `ShiftClockInScreen`, `ShiftClockOutScreen`, `LocationStatusPanel`.
  - `ShiftNoteStep` step navigation and inputs.
  - `CoordinatorReviewPage` queue rows and filter tabs.
  - `ReviewDetail` approve / request-correction buttons and comment field.
  - `GeofenceSettingsPage` toggles and save button.

### Stage 2 â€” Server-side tests

- [x] `convex/shiftClock.test.ts`: add convex-test cases for geofence disabled, inside radius, outside radius, missing/denied location, disabled setting, and verify no punch is created on rejection.
- [x] `convex/reviews.test.ts`: add cases for correction request, resubmission returning to queue, and approval marking billing-ready only when documentation is complete.
- [x] `convex/adpSync.test.ts`: verify unconfigured tenant behavior, configured mock sync idempotency, secret redaction, and location evidence omission from ADP payloads.
- [x] `convex/employeeProfiles.test.ts`: verify `adpInitialWorkerLoad` matching/creation and `createCaregiver` enqueue + drain.

### Stage 3 â€” E2E specs

- [x] `tests/e2e/phase1-lifecycle.spec.ts`: full lifecycle using seeded data with geofence disabled.
  - Conditional auth via Clerk sign-in using `E2E_*` environment variables.
  - Required specs now fail with a clear error when credentials are unavailable instead of being skipped, so the gate is honest.
  - Added assertions: Clock Out / submit button disabled before confirmation, status word + color for correction/resubmission/approval, and `data-shift-status="billing_ready"` after approval.
- [x] `tests/e2e/geofence.spec.ts`: inside radius, outside radius, denied permission, and disable-setting flows.
  - Outside/denied scenarios now click Clock In so location is actually requested and the blocked state is exercised.
  - Each geofence test that needs enforcement enables it explicitly.
  - `afterEach` calls `seed:resetE2EShifts` so serial tests always start from the scheduled fixture baseline.
- [x] `tests/e2e/helpers/auth.ts`: shared Clerk sign-in helper, credential guard, and `resetE2EShifts` test helper.

### Stage 4 â€” Gates & summary

- [x] Run `npx convex codegen` if Convex files changed.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test`.
- [x] Run `npm run e2e`.
- [x] Write real pass/fail results to `.hermes-pipeline/20260626_161701/summary.md`.

## Files To Create / Modify

Create:

- `.hermes-pipeline/20260626_161701/implementation-plan.md`
- `.hermes-pipeline/20260626_161701/summary.md`
- `tests/e2e/phase1-lifecycle.spec.ts`
- `tests/e2e/geofence.spec.ts`
- `tests/e2e/helpers/auth.ts`

Modify:

- `convex/seed.ts`
- `src/features/coordinator/pages/CoordinatorReviewPage.tsx`
- `src/features/dashboard/pages/DashboardPage.tsx`
- `tests/e2e/global-setup.ts`
- `convex/_generated/*` (via `npx convex codegen`, never by hand)

## Risks & Mitigations

- **Auth dependency for e2e**: Real Clerk sign-in requires test accounts. Mitigation: global setup seeds fixtures only when credentials are present; required specs fail fast with a clear message when credentials are missing so the gate cannot be green by skipping.
- **Multi-tenancy**: All backend helpers use `authHelpers` guards; no changes that weaken tenant isolation.
- **HIPAA/privacy**: Location evidence stays internal; ADP payload assertions ensure no leakage.
- **Secret leakage**: ADP mock creds are stubbed via `vi.stubEnv` and redacted by `sanitizeError`; assertions verify they do not appear in events/logs.
- **Billing invariant**: Approval only reaches `billing_ready` when documentation is complete; enforced by `reviews.approve` and verified by tests.


codex
One more e2e reliability issue is emerging around cleanup: the reset helper signs in as admin without first clearing the current caregiver/coordinator session. I’m checking the app’s sign-in behavior so I don’t overstate it.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "SignIn|SignedIn|SignedOut|sign-in|SelectAgency|RouteGuard|Clerk" src/app src/main.tsx src' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/app/router.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/app/shell/RouteGuard.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"resetE2EShifts\\(|signOut\\(|signInWithClerk\\(\" tests/e2e/geofence.spec.ts tests/e2e/phase1-lifecycle.spec.ts tests/e2e/helpers/auth.ts tests/e2e/global-setup.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/app/auth/SignInPage.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 837ms:
src/app\providers.test.tsx:11:  ClerkProvider: mocks.clerkProvider,
src/app\providers.test.tsx:14:    isSignedIn: false,
src/app\providers.test.tsx:29:  it('connects Clerk routing to React Router', async () => {
src/app\providers.test.tsx:41:        signInUrl: '/sign-in',
src/app\providers.test.tsx:54:// fetches Clerk's default session token. It tracks lastFetchedOrgIdRef
src/app\shell\Topbar.tsx:1:import { useOrganization, useUser, useClerk } from '@clerk/react'
src/app\shell\Topbar.tsx:20:  const { signOut } = useClerk()
src/app\shell\Topbar.tsx:67:          onClick={() => signOut(() => navigate('/sign-in'))}
src\features\team\pages\TeamPage.tsx:29:/** Map ATRIA-X roles to Clerk's default organization roles.
src\features\team\pages\TeamPage.tsx:30: *  Clerk only knows `org:admin` and `org:member` out of the box.
src\features\team\pages\TeamPage.tsx:33:function toClerkRole(atriaRole: RoleValue): 'org:admin' | 'org:member' {
src\features\team\pages\TeamPage.tsx:37:type ClerkInvitation = {
src\features\team\pages\TeamPage.tsx:108:function fromCache(cached: CachedInvitation): ClerkInvitation {
src\features\team\pages\TeamPage.tsx:113:    status: cached.status as ClerkInvitation['status'],
src\features\team\pages\TeamPage.tsx:118:function cacheClerkInvitations(orgId: string, invitations: ClerkInvitation[]) {
src\features\team\pages\TeamPage.tsx:173:  const [invitations, setInvitations] = useState<ClerkInvitation[]>(() => {
src\features\team\pages\TeamPage.tsx:190:          data: ClerkInvitation[]
src\features\team\pages\TeamPage.tsx:193:        cacheClerkInvitations(clerkOrgId, clerkData)
src\features\team\pages\TeamPage.tsx:223:          data: ClerkInvitation[]
src\features\team\pages\TeamPage.tsx:226:        cacheClerkInvitations(clerkOrgId, clerkData)
src\features\team\pages\TeamPage.tsx:304:    async (invitation: ClerkInvitation) => {
src\features\team\pages\TeamPage.tsx:405:          role: toClerkRole(newRole),
src\features\team\pages\TeamPage.tsx:713:            The Clerk role was updated, but the local database could not be
src/app\shell\RouteGuard.tsx:10:export function TenantRouteGuard({ children }: PropsWithChildren) {
src/app\shell\RouteGuard.tsx:11:  const { isLoaded: authLoaded, isSignedIn } = useAuth()
src/app\shell\RouteGuard.tsx:17:  if (!isSignedIn) {
src/app\shell\RouteGuard.tsx:18:    return <Navigate to="/sign-in" replace />
src/app\shell\RouteGuard.tsx:51:export function SignedInRouteGuard({ children }: PropsWithChildren) {
src/app\shell\RouteGuard.tsx:52:  const { isLoaded, isSignedIn } = useAuth()
src/app\shell\RouteGuard.tsx:58:  if (!isSignedIn) {
src/app\shell\RouteGuard.tsx:59:    return <Navigate to="/sign-in" replace />
src/app\shell\RouteGuard.tsx:65:export function TenantRoleRouteGuard({
src\app\shell\Topbar.tsx:1:import { useOrganization, useUser, useClerk } from '@clerk/react'
src\app\shell\Topbar.tsx:20:  const { signOut } = useClerk()
src\app\shell\Topbar.tsx:67:          onClick={() => signOut(() => navigate('/sign-in'))}
src\features\team\pages\TeamPage.test.tsx:208:  it('maps coordinator role to org:member when updating Clerk membership', async () => {
src\features\team\pages\TeamPage.test.tsx:256:  it('preserves org:admin when updating Clerk membership to admin', async () => {
src\features\team\pages\TeamPage.test.tsx:304:  it('renders pending invitations fetched from Clerk', async () => {
src/app\shell\RouteGuard.test.tsx:4:  TenantRouteGuard,
src/app\shell\RouteGuard.test.tsx:5:  SignedInRouteGuard,
src/app\shell\RouteGuard.test.tsx:6:  TenantRoleRouteGuard,
src/app\shell\RouteGuard.test.tsx:7:} from './RouteGuard'
src/app\shell\RouteGuard.test.tsx:45:function mockClerkState(options: {
src/app\shell\RouteGuard.test.tsx:47:  isSignedIn?: boolean
src/app\shell\RouteGuard.test.tsx:53:    isSignedIn: options.isSignedIn ?? false,
src/app\shell\RouteGuard.test.tsx:75:describe('TenantRouteGuard', () => {
src/app\shell\RouteGuard.test.tsx:81:    mockClerkState({ authLoaded: false, isSignedIn: false, orgLoaded: true })
src/app\shell\RouteGuard.test.tsx:85:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:87:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:95:    mockClerkState({ authLoaded: true, isSignedIn: true, orgLoaded: false })
src/app\shell\RouteGuard.test.tsx:99:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:101:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:108:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:110:      isSignedIn: true,
src/app\shell\RouteGuard.test.tsx:117:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:119:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:125:  it('redirects to /sign-in when not signed in', () => {
src/app\shell\RouteGuard.test.tsx:126:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:128:      isSignedIn: false,
src/app\shell\RouteGuard.test.tsx:135:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:137:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:140:    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
src/app\shell\RouteGuard.test.tsx:141:    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
src/app\shell\RouteGuard.test.tsx:146:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:148:      isSignedIn: true,
src/app\shell\RouteGuard.test.tsx:155:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:157:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:165:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:167:      isSignedIn: true,
src/app\shell\RouteGuard.test.tsx:174:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:176:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:184:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:186:      isSignedIn: true,
src/app\shell\RouteGuard.test.tsx:193:      <TenantRouteGuard>
src/app\shell\RouteGuard.test.tsx:195:      </TenantRouteGuard>,
src/app\shell\RouteGuard.test.tsx:203:describe('SignedInRouteGuard', () => {
src/app\shell\RouteGuard.test.tsx:211:      isSignedIn: false,
src/app\shell\RouteGuard.test.tsx:215:      <SignedInRouteGuard>
src/app\shell\RouteGuard.test.tsx:217:      </SignedInRouteGuard>,
src/app\shell\RouteGuard.test.tsx:223:  it('redirects to /sign-in when not signed in', () => {
src/app\shell\RouteGuard.test.tsx:226:      isSignedIn: false,
src/app\shell\RouteGuard.test.tsx:230:      <SignedInRouteGuard>
src/app\shell\RouteGuard.test.tsx:232:      </SignedInRouteGuard>,
src/app\shell\RouteGuard.test.tsx:235:    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
src/app\shell\RouteGuard.test.tsx:236:    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
src/app\shell\RouteGuard.test.tsx:242:      isSignedIn: true,
src/app\shell\RouteGuard.test.tsx:246:      <SignedInRouteGuard>
src/app\shell\RouteGuard.test.tsx:248:      </SignedInRouteGuard>,
src/app\shell\RouteGuard.test.tsx:256:describe('TenantRoleRouteGuard', () => {
src/app\shell\RouteGuard.test.tsx:262:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:268:      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src/app\shell\RouteGuard.test.tsx:270:      </TenantRoleRouteGuard>,
src/app\shell\RouteGuard.test.tsx:277:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:283:      <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:coordinator']}>
src/app\shell\RouteGuard.test.tsx:285:      </TenantRoleRouteGuard>,
src/app\shell\RouteGuard.test.tsx:292:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:298:      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src/app\shell\RouteGuard.test.tsx:300:      </TenantRoleRouteGuard>,
src/app\shell\RouteGuard.test.tsx:308:    mockClerkState({
src/app\shell\RouteGuard.test.tsx:314:      <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
src/app\shell\RouteGuard.test.tsx:316:      </TenantRoleRouteGuard>,
src/app\shell\PlatformShell.tsx:2:import { SignedInRouteGuard } from './RouteGuard'
src/app\shell\PlatformShell.tsx:3:import { useUser, useClerk } from '@clerk/react'
src/app\shell\PlatformShell.tsx:8:  const { signOut } = useClerk()
src/app\shell\PlatformShell.tsx:12:    <SignedInRouteGuard>
src/app\shell\PlatformShell.tsx:48:              onClick={() => signOut(() => navigate('/sign-in'))}
src/app\shell\PlatformShell.tsx:69:              onClick={() => signOut(() => navigate('/sign-in'))}
src/app\shell\PlatformShell.tsx:81:    </SignedInRouteGuard>
src/app\shell\AppShell.tsx:4:import { TenantRouteGuard } from './RouteGuard'
src/app\shell\AppShell.tsx:11:    <TenantRouteGuard>
src/app\shell\AppShell.tsx:24:    </TenantRouteGuard>
src\app\shell\RouteGuard.tsx:10:export function TenantRouteGuard({ children }: PropsWithChildren) {
src\app\shell\RouteGuard.tsx:11:  const { isLoaded: authLoaded, isSignedIn } = useAuth()
src\app\shell\RouteGuard.tsx:17:  if (!isSignedIn) {
src\app\shell\RouteGuard.tsx:18:    return <Navigate to="/sign-in" replace />
src\app\shell\RouteGuard.tsx:51:export function SignedInRouteGuard({ children }: PropsWithChildren) {
src\app\shell\RouteGuard.tsx:52:  const { isLoaded, isSignedIn } = useAuth()
src\app\shell\RouteGuard.tsx:58:  if (!isSignedIn) {
src\app\shell\RouteGuard.tsx:59:    return <Navigate to="/sign-in" replace />
src\app\shell\RouteGuard.tsx:65:export function TenantRoleRouteGuard({
src/app\auth\SelectAgencyPage.tsx:24:export function SelectAgencyPage() {
src/app\auth\SelectAgencyPage.tsx:51:        'Authentication failed. Please check your Clerk + Convex configuration.',
src/app\auth\SelectAgencyPage.tsx:112:            'Agency could not be opened because the Convex JWT is missing active organization claims. Check the Clerk convex JWT template and Convex auth config.',
src/app\router.tsx:2:import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
src/app\router.tsx:6:import { SelectAgencyPage } from './auth/SelectAgencyPage'
src/app\router.tsx:7:import { SignedInRouteGuard, TenantRoleRouteGuard } from './shell/RouteGuard'
src/app\router.tsx:70:        path="/sign-in/*"
src/app\router.tsx:73:            <SignIn
src/app\router.tsx:75:              path="/sign-in"
src/app\router.tsx:89:              signInUrl="/sign-in"
src/app\router.tsx:102:              signInUrl="/sign-in"
src/app\router.tsx:111:          <SignedInRouteGuard>
src/app\router.tsx:119:          </SignedInRouteGuard>
src/app\router.tsx:125:          <SignedInRouteGuard>
src/app\router.tsx:126:            <SelectAgencyPage />
src/app\router.tsx:127:          </SignedInRouteGuard>
src/app\router.tsx:144:            <TenantRoleRouteGuard
src/app\router.tsx:150:            </TenantRoleRouteGuard>
src/app\router.tsx:156:            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
src/app\router.tsx:160:            </TenantRoleRouteGuard>
src/app\router.tsx:166:            <TenantRoleRouteGuard
src/app\router.tsx:172:            </TenantRoleRouteGuard>
src/app\router.tsx:178:            <TenantRoleRouteGuard
src/app\router.tsx:184:            </TenantRoleRouteGuard>
src/app\router.tsx:190:            <TenantRoleRouteGuard
src/app\router.tsx:196:            </TenantRoleRouteGuard>
src/app\router.tsx:202:            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src/app\router.tsx:206:            </TenantRoleRouteGuard>
src/app\router.tsx:220:            <TenantRoleRouteGuard
src/app\router.tsx:226:            </TenantRoleRouteGuard>
src\app\shell\RouteGuard.test.tsx:4:  TenantRouteGuard,
src\app\shell\RouteGuard.test.tsx:5:  SignedInRouteGuard,
src\app\shell\RouteGuard.test.tsx:6:  TenantRoleRouteGuard,
src\app\shell\RouteGuard.test.tsx:7:} from './RouteGuard'
src\app\shell\RouteGuard.test.tsx:45:function mockClerkState(options: {
src\app\shell\RouteGuard.test.tsx:47:  isSignedIn?: boolean
src\app\shell\RouteGuard.test.tsx:53:    isSignedIn: options.isSignedIn ?? false,
src\app\shell\RouteGuard.test.tsx:75:describe('TenantRouteGuard', () => {
src\app\shell\RouteGuard.test.tsx:81:    mockClerkState({ authLoaded: false, isSignedIn: false, orgLoaded: true })
src\app\shell\RouteGuard.test.tsx:85:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:87:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:95:    mockClerkState({ authLoaded: true, isSignedIn: true, orgLoaded: false })
src\app\shell\RouteGuard.test.tsx:99:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:101:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:108:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:110:      isSignedIn: true,
src\app\shell\RouteGuard.test.tsx:117:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:119:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:125:  it('redirects to /sign-in when not signed in', () => {
src\app\shell\RouteGuard.test.tsx:126:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:128:      isSignedIn: false,
src\app\shell\RouteGuard.test.tsx:135:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:137:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:140:    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
src\app\shell\RouteGuard.test.tsx:141:    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
src\app\shell\RouteGuard.test.tsx:146:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:148:      isSignedIn: true,
src\app\shell\RouteGuard.test.tsx:155:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:157:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:165:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:167:      isSignedIn: true,
src\app\shell\RouteGuard.test.tsx:174:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:176:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:184:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:186:      isSignedIn: true,
src\app\shell\RouteGuard.test.tsx:193:      <TenantRouteGuard>
src\app\shell\RouteGuard.test.tsx:195:      </TenantRouteGuard>,
src\app\shell\RouteGuard.test.tsx:203:describe('SignedInRouteGuard', () => {
src\app\shell\RouteGuard.test.tsx:211:      isSignedIn: false,
src\app\shell\RouteGuard.test.tsx:215:      <SignedInRouteGuard>
src\app\shell\RouteGuard.test.tsx:217:      </SignedInRouteGuard>,
src\app\shell\RouteGuard.test.tsx:223:  it('redirects to /sign-in when not signed in', () => {
src\app\shell\RouteGuard.test.tsx:226:      isSignedIn: false,
src\app\shell\RouteGuard.test.tsx:230:      <SignedInRouteGuard>
src\app\shell\RouteGuard.test.tsx:232:      </SignedInRouteGuard>,
src\app\shell\RouteGuard.test.tsx:235:    expect(screen.getByText('Navigate to /sign-in')).toBeInTheDocument()
src\app\shell\RouteGuard.test.tsx:236:    expect(mockNavigate).toHaveBeenCalledWith('/sign-in')
src\app\shell\RouteGuard.test.tsx:242:      isSignedIn: true,
src\app\shell\RouteGuard.test.tsx:246:      <SignedInRouteGuard>
src\app\shell\RouteGuard.test.tsx:248:      </SignedInRouteGuard>,
src\app\shell\RouteGuard.test.tsx:256:describe('TenantRoleRouteGuard', () => {
src\app\shell\RouteGuard.test.tsx:262:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:268:      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src\app\shell\RouteGuard.test.tsx:270:      </TenantRoleRouteGuard>,
src\app\shell\RouteGuard.test.tsx:277:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:283:      <TenantRoleRouteGuard allowedRoles={['org:admin', 'org:coordinator']}>
src\app\shell\RouteGuard.test.tsx:285:      </TenantRoleRouteGuard>,
src\app\shell\RouteGuard.test.tsx:292:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:298:      <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src\app\shell\RouteGuard.test.tsx:300:      </TenantRoleRouteGuard>,
src\app\shell\RouteGuard.test.tsx:308:    mockClerkState({
src\app\shell\RouteGuard.test.tsx:314:      <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
src\app\shell\RouteGuard.test.tsx:316:      </TenantRoleRouteGuard>,
src/app\router.test.tsx:11:    SignIn: () => <div data-testid="sign-in">SignIn</div>,
src/app\router.test.tsx:22:    useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false })),
src/app\router.test.tsx:41:vi.mock('./auth/SelectAgencyPage', () => ({
src/app\router.test.tsx:42:  SelectAgencyPage: () => (
src/app\router.test.tsx:43:    <div data-testid="select-agency">SelectAgencyPage</div>
src/app\router.test.tsx:76:  it('renders SignIn at /sign-in', () => {
src/app\router.test.tsx:77:    render(<TestRouter initialEntries={['/sign-in']} />)
src/app\router.test.tsx:78:    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
src/app\router.test.tsx:81:  it('renders SignIn at /sign-in/factor-one', () => {
src/app\router.test.tsx:82:    render(<TestRouter initialEntries={['/sign-in/factor-one']} />)
src/app\router.test.tsx:83:    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
src\app\shell\PlatformShell.tsx:2:import { SignedInRouteGuard } from './RouteGuard'
src\app\shell\PlatformShell.tsx:3:import { useUser, useClerk } from '@clerk/react'
src\app\shell\PlatformShell.tsx:8:  const { signOut } = useClerk()
src\app\shell\PlatformShell.tsx:12:    <SignedInRouteGuard>
src\app\shell\PlatformShell.tsx:48:              onClick={() => signOut(() => navigate('/sign-in'))}
src\app\shell\PlatformShell.tsx:69:              onClick={() => signOut(() => navigate('/sign-in'))}
src\app\shell\PlatformShell.tsx:81:    </SignedInRouteGuard>
src/app\auth\SelectAgencyPage.test.tsx:4:import { SelectAgencyPage } from './SelectAgencyPage'
src/app\auth\SelectAgencyPage.test.tsx:49:function mockClerkState(options: {
src/app\auth\SelectAgencyPage.test.tsx:78:    isSignedIn: !!options.user,
src/app\auth\SelectAgencyPage.test.tsx:84:    isSignedIn: !!options.user,
src/app\auth\SelectAgencyPage.test.tsx:92:describe('SelectAgencyPage', () => {
src/app\auth\SelectAgencyPage.test.tsx:98:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:105:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:114:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:121:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:134:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:141:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:166:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:173:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:188:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:195:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:210:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:217:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:224:          /Authentication failed.*check your Clerk.*Convex configuration/i,
src/app\auth\SelectAgencyPage.test.tsx:235:      .mockRejectedValueOnce(new Error('Forbidden: active Clerk organization required but missing from token.'))
src/app\auth\SelectAgencyPage.test.tsx:238:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:245:    render(<SelectAgencyPage />)
src/app\auth\SelectAgencyPage.test.tsx:258:      new Error('Forbidden: active Clerk organization required but missing from token.'),
src/app\auth\SelectAgencyPage.test.tsx:261:    mockClerkState({
src/app\auth\SelectAgencyPage.test.tsx:268:    render(<SelectAgencyPage />)
src\app\shell\AppShell.tsx:4:import { TenantRouteGuard } from './RouteGuard'
src\app\shell\AppShell.tsx:11:    <TenantRouteGuard>
src\app\shell\AppShell.tsx:24:    </TenantRouteGuard>
src/app\providers.tsx:1:import { ClerkProvider, useAuth } from '@clerk/react'
src/app\providers.tsx:8:const ClerkProviderFromEnv = ClerkProvider as unknown as (
src/app\providers.tsx:24:/** Clerk + Convex auth adapter using the default Clerk session token.
src/app\providers.tsx:30:function useAuthFromClerk() {
src/app\providers.tsx:31:  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth()
src/app\providers.tsx:46:    // Clerk's getToken is not memoized, so we depend on org context instead.
src/app\providers.tsx:54:      isAuthenticated: isSignedIn ?? false,
src/app\providers.tsx:57:    [isLoaded, isSignedIn, fetchAccessToken],
src/app\providers.tsx:64:      <ClerkWithRouter>{children}</ClerkWithRouter>
src/app\providers.tsx:69:function ClerkWithRouter({ children }: PropsWithChildren) {
src/app\providers.tsx:73:    <ClerkProviderFromEnv
src/app\providers.tsx:77:      signInUrl="/sign-in"
src/app\providers.tsx:82:      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
src/app\providers.tsx:85:    </ClerkProviderFromEnv>
src\app\router.tsx:2:import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
src\app\router.tsx:6:import { SelectAgencyPage } from './auth/SelectAgencyPage'
src\app\router.tsx:7:import { SignedInRouteGuard, TenantRoleRouteGuard } from './shell/RouteGuard'
src\app\router.tsx:70:        path="/sign-in/*"
src\app\router.tsx:73:            <SignIn
src\app\router.tsx:75:              path="/sign-in"
src\app\router.tsx:89:              signInUrl="/sign-in"
src\app\router.tsx:102:              signInUrl="/sign-in"
src\app\router.tsx:111:          <SignedInRouteGuard>
src\app\router.tsx:119:          </SignedInRouteGuard>
src\app\router.tsx:125:          <SignedInRouteGuard>
src\app\router.tsx:126:            <SelectAgencyPage />
src\app\router.tsx:127:          </SignedInRouteGuard>
src\app\router.tsx:144:            <TenantRoleRouteGuard
src\app\router.tsx:150:            </TenantRoleRouteGuard>
src\app\router.tsx:156:            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
src\app\router.tsx:160:            </TenantRoleRouteGuard>
src\app\router.tsx:166:            <TenantRoleRouteGuard
src\app\router.tsx:172:            </TenantRoleRouteGuard>
src\app\router.tsx:178:            <TenantRoleRouteGuard
src\app\router.tsx:184:            </TenantRoleRouteGuard>
src\app\router.tsx:190:            <TenantRoleRouteGuard
src\app\router.tsx:196:            </TenantRoleRouteGuard>
src\app\router.tsx:202:            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
src\app\router.tsx:206:            </TenantRoleRouteGuard>
src\app\router.tsx:220:            <TenantRoleRouteGuard
src\app\router.tsx:226:            </TenantRoleRouteGuard>
src\shared\testing\convexApi.test.ts:7:  it('uses customJwt provider without applicationID to accept default Clerk tokens', async () => {
src\app\router.test.tsx:11:    SignIn: () => <div data-testid="sign-in">SignIn</div>,
src\app\router.test.tsx:22:    useAuth: vi.fn(() => ({ isLoaded: true, isSignedIn: false })),
src\app\router.test.tsx:41:vi.mock('./auth/SelectAgencyPage', () => ({
src\app\router.test.tsx:42:  SelectAgencyPage: () => (
src\app\router.test.tsx:43:    <div data-testid="select-agency">SelectAgencyPage</div>
src\app\router.test.tsx:76:  it('renders SignIn at /sign-in', () => {
src\app\router.test.tsx:77:    render(<TestRouter initialEntries={['/sign-in']} />)
src\app\router.test.tsx:78:    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
src\app\router.test.tsx:81:  it('renders SignIn at /sign-in/factor-one', () => {
src\app\router.test.tsx:82:    render(<TestRouter initialEntries={['/sign-in/factor-one']} />)
src\app\router.test.tsx:83:    expect(screen.getByTestId('sign-in')).toBeInTheDocument()
src\app\providers.tsx:1:import { ClerkProvider, useAuth } from '@clerk/react'
src\app\providers.tsx:8:const ClerkProviderFromEnv = ClerkProvider as unknown as (
src\app\providers.tsx:24:/** Clerk + Convex auth adapter using the default Clerk session token.
src\app\providers.tsx:30:function useAuthFromClerk() {
src\app\providers.tsx:31:  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth()
src\app\providers.tsx:46:    // Clerk's getToken is not memoized, so we depend on org context instead.
src\app\providers.tsx:54:      isAuthenticated: isSignedIn ?? false,
src\app\providers.tsx:57:    [isLoaded, isSignedIn, fetchAccessToken],
src\app\providers.tsx:64:      <ClerkWithRouter>{children}</ClerkWithRouter>
src\app\providers.tsx:69:function ClerkWithRouter({ children }: PropsWithChildren) {
src\app\providers.tsx:73:    <ClerkProviderFromEnv
src\app\providers.tsx:77:      signInUrl="/sign-in"
src\app\providers.tsx:82:      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
src\app\providers.tsx:85:    </ClerkProviderFromEnv>
src\app\providers.test.tsx:11:  ClerkProvider: mocks.clerkProvider,
src\app\providers.test.tsx:14:    isSignedIn: false,
src\app\providers.test.tsx:29:  it('connects Clerk routing to React Router', async () => {
src\app\providers.test.tsx:41:        signInUrl: '/sign-in',
src\app\providers.test.tsx:54:// fetches Clerk's default session token. It tracks lastFetchedOrgIdRef
src\app\auth\SelectAgencyPage.test.tsx:4:import { SelectAgencyPage } from './SelectAgencyPage'
src\app\auth\SelectAgencyPage.test.tsx:49:function mockClerkState(options: {
src\app\auth\SelectAgencyPage.test.tsx:78:    isSignedIn: !!options.user,
src\app\auth\SelectAgencyPage.test.tsx:84:    isSignedIn: !!options.user,
src\app\auth\SelectAgencyPage.test.tsx:92:describe('SelectAgencyPage', () => {
src\app\auth\SelectAgencyPage.test.tsx:98:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:105:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:114:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:121:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:134:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:141:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:166:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:173:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:188:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:195:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:210:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:217:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:224:          /Authentication failed.*check your Clerk.*Convex configuration/i,
src\app\auth\SelectAgencyPage.test.tsx:235:      .mockRejectedValueOnce(new Error('Forbidden: active Clerk organization required but missing from token.'))
src\app\auth\SelectAgencyPage.test.tsx:238:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:245:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.test.tsx:258:      new Error('Forbidden: active Clerk organization required but missing from token.'),
src\app\auth\SelectAgencyPage.test.tsx:261:    mockClerkState({
src\app\auth\SelectAgencyPage.test.tsx:268:    render(<SelectAgencyPage />)
src\app\auth\SelectAgencyPage.tsx:24:export function SelectAgencyPage() {
src\app\auth\SelectAgencyPage.tsx:51:        'Authentication failed. Please check your Clerk + Convex configuration.',
src\app\auth\SelectAgencyPage.tsx:112:            'Agency could not be opened because the Convex JWT is missing active organization claims. Check the Clerk convex JWT template and Convex auth config.',

 succeeded in 788ms:
tests/e2e/global-setup.ts:100:      await signInWithClerk(page, credentials.email, credentials.password, E2E_ORG_ID)
tests/e2e/global-setup.ts:106:      await signOut(page)
tests/e2e/global-setup.ts:110:    await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
tests/e2e/helpers/auth.ts:43:export async function signInWithClerk(
tests/e2e/helpers/auth.ts:74:export async function signOut(page: Page) {
tests/e2e/helpers/auth.ts:96:export async function resetE2EShifts(page: Page) {
tests/e2e/helpers/auth.ts:99:  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
tests/e2e/helpers/auth.ts:132:  await signOut(page)
tests/e2e/geofence.spec.ts:27:  await resetE2EShifts(page)
tests/e2e/geofence.spec.ts:31:  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:40:  await signOut(page)
tests/e2e/geofence.spec.ts:58:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:105:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:121:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:136:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/phase1-lifecycle.spec.ts:26:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/phase1-lifecycle.spec.ts:104:  await signOut(page)
tests/e2e/phase1-lifecycle.spec.ts:105:  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
tests/e2e/phase1-lifecycle.spec.ts:132:  await signOut(page)
tests/e2e/phase1-lifecycle.spec.ts:133:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/phase1-lifecycle.spec.ts:155:  await signOut(page)
tests/e2e/phase1-lifecycle.spec.ts:156:  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)

 succeeded in 824ms:
import { useOrganization, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Navigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { AppLoader } from '@/shared/ui/AppLoader'

type TenantRole = 'org:admin' | 'org:coordinator' | 'org:caregiver'

export function TenantRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  if (!authLoaded) {
    return <AppLoader fullScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <TenantMembershipGuard>{children}</TenantMembershipGuard>
}

function TenantMembershipGuard({ children }: PropsWithChildren) {
  const { isLoaded, organization } = useOrganization()

  const membership = useQuery(
    api.members.checkMembership,
    isLoaded && organization ? { clerkOrgId: organization.id } : 'skip',
  )

  if (!isLoaded) {
    return <AppLoader fullScreen />
  }

  if (!organization) {
    return <Navigate to="/select-agency" replace />
  }

  if (membership === undefined) {
    return <AppLoader fullScreen label="Opening agency workspace" />
  }

  if (!membership) {
    return <Navigate to="/select-agency" replace />
  }

  return <>{children}</>
}

export function SignedInRouteGuard({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <AppLoader fullScreen />
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <>{children}</>
}

export function TenantRoleRouteGuard({
  allowedRoles,
  children,
}: PropsWithChildren<{ allowedRoles: TenantRole[] }>) {
  const { organization } = useOrganization()
  const member = useQuery(
    api.members.me,
    organization?.id ? { clerkOrgId: organization.id } : 'skip',
  )

  if (!organization || member === undefined) {
    return <AppLoader fullScreen label="Checking access" />
  }

  if (!member) {
    return <Navigate to="/select-agency" replace />
  }

  if (!allowedRoles.includes(member.role)) {
    return (
      <Navigate
        to={member.role === 'org:caregiver' ? '/caregiver/today' : '/'}
        replace
      />
    )
  }

  return <>{children}</>
}


 succeeded in 832ms:
import { Navigate, Route, Routes } from 'react-router-dom'
import { CreateOrganization, SignIn, SignUp } from '@clerk/react'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppShell } from './shell/AppShell'
import { PlatformShell } from './shell/PlatformShell'
import { SelectAgencyPage } from './auth/SelectAgencyPage'
import { SignedInRouteGuard, TenantRoleRouteGuard } from './shell/RouteGuard'
import { AppLoader } from '@/shared/ui/AppLoader'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const CaregiverTodayPage = lazy(() =>
  import('@/features/caregiver/pages/CaregiverTodayPage').then((module) => ({
    default: module.CaregiverTodayPage,
  })),
)
const CoordinatorReviewPage = lazy(() =>
  import('@/features/coordinator/pages/CoordinatorReviewPage').then(
    (module) => ({
      default: module.CoordinatorReviewPage,
    }),
  ),
)
const BillingPage = lazy(() =>
  import('@/features/billing/pages/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
const ClientsPage = lazy(() =>
  import('@/features/clients/pages/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  })),
)
const TeamPage = lazy(() =>
  import('@/features/team/pages/TeamPage').then((module) => ({
    default: module.TeamPage,
  })),
)
const PlatformAdminPage = lazy(() =>
  import('@/features/platform/pages/PlatformAdminPage').then((module) => ({
    default: module.PlatformAdminPage,
  })),
)
const SearchPage = lazy(() =>
  import('@/features/search/pages/SearchPage').then((module) => ({
    default: module.SearchPage,
  })),
)
const GeofenceSettingsPage = lazy(() =>
  import('@/features/settings/pages/GeofenceSettingsPage').then((module) => ({
    default: module.GeofenceSettingsPage,
  })),
)

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppLoader label="Preparing workspace" />}>
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/accept-invitation/*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
            <SignUp
              routing="path"
              path="/accept-invitation"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/select-agency"
            />
          </div>
        }
      />
      <Route
        path="/create-agency"
        element={
          <SignedInRouteGuard>
            <div className="flex min-h-screen items-center justify-center bg-atria-bg p-4">
              <CreateOrganization
                routing="path"
                path="/create-agency"
                afterCreateOrganizationUrl="/select-agency"
              />
            </div>
          </SignedInRouteGuard>
        }
      />
      <Route
        path="/select-agency"
        element={
          <SignedInRouteGuard>
            <SelectAgencyPage />
          </SignedInRouteGuard>
        }
      />
      <Route element={<PlatformShell />}>
        <Route
          path="platform"
          element={
            <RouteSuspense>
              <PlatformAdminPage />
            </RouteSuspense>
          }
        />
      </Route>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <DashboardPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="caregiver/today"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:caregiver']}>
              <RouteSuspense>
                <CaregiverTodayPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/review"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <CoordinatorReviewPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="coordinator/billing"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <BillingPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="clients"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <ClientsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="team"
          element={
            <TenantRoleRouteGuard allowedRoles={['org:admin']}>
              <RouteSuspense>
                <TeamPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route
          path="search"
          element={
            <RouteSuspense>
              <SearchPage />
            </RouteSuspense>
          }
        />
        <Route
          path="settings/geofence"
          element={
            <TenantRoleRouteGuard
              allowedRoles={['org:admin', 'org:coordinator']}
            >
              <RouteSuspense>
                <GeofenceSettingsPage />
              </RouteSuspense>
            </TenantRoleRouteGuard>
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}


2026-06-26T23:49:46.957455Z ERROR codex_core::tools::router: error=Exit code: 1
Wall time: 1 seconds
Output:
Get-Content : Cannot find path 'src/app/auth/SignInPage.tsx' because it does not exist.
At line:2 char:1
+ Get-Content -Raw -LiteralPath 'src/app/auth/SignInPage.tsx'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (src/app/auth/SignInPage.tsx:String) [Get-Content], ItemNotFoundExceptio 
   n
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 

 exited 1 in 988ms:
Get-Content : Cannot find path 'src/app/auth/SignInPage.tsx' because it does not exist.
At line:2 char:1
+ Get-Content -Raw -LiteralPath 'src/app/auth/SignInPage.tsx'
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (src/app/auth/SignInPage.tsx:String) [Get-Content], ItemNotFoundExceptio 
   n
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand
 

codex
I found a second concrete e2e bug: the correction resubmit path appears to expect the final wizard step after only one “Next” click. I’m verifying the wizard markup so the review points to the actual failure rather than an assumption.
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/components/ShiftNoteStep.tsx'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
2026-06-26T23:50:30.126910Z ERROR codex_core::tools::router: error=`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"data-testid=\\{"'`step-content|data-testid='"\\\"step-content|hidden\" src/features/caregiver/components/ShiftNoteStep.tsx"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "fix and resubmit|step-content-done|wizard-next-button|start-time-input|Next Step|Submit my notes" tests/e2e/phase1-lifecycle.spec.ts src/features/caregiver/components/ShiftDocumentationForm.tsx src/features/caregiver/components/ShiftNoteStep.tsx src/features/caregiver/model/documentationWizard.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw -LiteralPath 'src/features/caregiver/model/documentationWizard.ts'" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"data-testid=\\{"'`step-content|data-testid='"\\\"step-content|hidden\" src/features/caregiver/components/ShiftNoteStep.tsx" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 declined in 0ms:
`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"data-testid=\\{"'`step-content|data-testid='"\\\"step-content|hidden\" src/features/caregiver/components/ShiftNoteStep.tsx"` rejected: blocked by policy
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "currentStepIndex|setCurrentStepIndex|goNext|isDoneStep|WIZARD_STEPS.length" src/features/caregiver/components/ShiftDocumentationForm.tsx' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 677ms:
src/features/caregiver/components/ShiftNoteStep.tsx:243:            data-testid={label === 'I started at' ? 'start-time-input' : 'end-time-input'}
src/features/caregiver/components/ShiftDocumentationForm.tsx:412:          data-testid="wizard-next-button"
src/features/caregiver/components/ShiftDocumentationForm.tsx:414:          {isDoneStep ? 'Submit my notes' : 'Next Step'}
tests/e2e/phase1-lifecycle.spec.ts:48:  await page.locator('[data-testid="start-time-input"]').fill('09:00')
tests/e2e/phase1-lifecycle.spec.ts:50:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:55:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:62:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:67:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:82:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:83:  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached()
tests/e2e/phase1-lifecycle.spec.ts:87:  const nextButton = page.locator('[data-testid="wizard-next-button"]')
tests/e2e/phase1-lifecycle.spec.ts:131:  // ---- Caregiver: fix and resubmit ----
tests/e2e/phase1-lifecycle.spec.ts:143:  await page.locator('[data-testid="start-time-input"]').fill('09:15')
tests/e2e/phase1-lifecycle.spec.ts:144:  await page.locator('[data-testid="wizard-next-button"]').click()
tests/e2e/phase1-lifecycle.spec.ts:146:  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached({ timeout: 15000 })
tests/e2e/phase1-lifecycle.spec.ts:148:  await page.locator('[data-testid="wizard-next-button"]').click()

 succeeded in 664ms:
121:  const [currentStepIndex, setCurrentStepIndex] = useState(0)
175:    const stepId = WIZARD_STEPS[currentStepIndex].id
254:  const currentStepId = WIZARD_STEPS[currentStepIndex].id
257:  const isDoneStep = currentStepIndex === WIZARD_STEPS.length - 1
265:  const goNext = () => {
266:    if (currentStepIndex < WIZARD_STEPS.length - 1) {
267:      setCurrentStepIndex((i) => i + 1)
274:    if (currentStepIndex > 0) {
275:      setCurrentStepIndex((i) => i - 1)
283:    setCurrentStepIndex(stepIndex)
315:          setCurrentStepIndex(0)
358:          stepIndex={currentStepIndex}
408:            currentStepId !== 'issues' && WIZARD_STEPS[currentStepIndex].bgAccent,
410:          onClick={goNext}
411:          disabled={isDoneStep ? !canSubmitDone : !canAdvance}
414:          {isDoneStep ? 'Submit my notes' : 'Next Step'}
415:          {isDoneStep ? (

 succeeded in 769ms:
import { useState } from 'react'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Checkbox } from '@/shared/ui/Checkbox'
import { ShiftTaskList } from './ShiftTaskList'
import {
  WIZARD_STEPS,
  type WizardStepId,
  validateStep,
} from '../model/documentationWizard'
import {
  SERVICE_OPTIONS,
  GOAL_OPTIONS,
  ISSUE_CHOICE_NO,
  ISSUE_CHOICE_YES,
  type ServiceLabel,
  type GoalLabel,
  type IssueChoice,
} from '../model/documentationDraft'
import type { NoteDraft, TaskDraft, LoadedTask } from '../model/documentationDraft'
import { cn } from '@/shared/lib/cn'
import type { Dispatch, SetStateAction } from 'react'
import { formatTime } from '@/shared/format'

export function ShiftNoteStep<TaskId extends string>({
  stepId,
  stepIndex,
  note,
  onNoteChange,
  taskDrafts,
  onTaskDraftsChange,
  tasks,
  editable,
  clerkOrgId,
  clientName,
  selectedServices,
  selectedGoals,
  issueChoice,
  confirmed,
  onSelectedServicesChange,
  onSelectedGoalsChange,
  onIssueChoiceChange,
  onConfirmedChange,
  onEditStep,
  isSaving,
  saved,
}: {
  stepId: WizardStepId
  stepIndex: number
  note: NoteDraft
  onNoteChange: (note: NoteDraft) => void
  taskDrafts: TaskDraft<TaskId>[]
  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
  tasks: LoadedTask<TaskId>[]
  editable: boolean
  clerkOrgId: string
  clientName: string
  selectedServices: ServiceLabel[]
  selectedGoals: GoalLabel[]
  issueChoice: IssueChoice | null
  confirmed: boolean
  onSelectedServicesChange: (services: ServiceLabel[]) => void
  onSelectedGoalsChange: (goals: GoalLabel[]) => void
  onIssueChoiceChange: (choice: IssueChoice) => void
  onConfirmedChange: (confirmed: boolean) => void
  onEditStep?: (stepIndex: number) => void
  isSaving: boolean
  saved: boolean
}) {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)!
  const stepBlockers = validateStep(stepId, note, taskDrafts, tasks)
  const helperText = step.helper.replace(/\{clientName\}/g, clientName)
  const progressPercent = ((stepIndex + 1) / WIZARD_STEPS.length) * 100

  const update = (patch: Partial<NoteDraft>) => {
    onNoteChange({ ...note, ...patch })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-atria-text-secondary">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </span>
          {saved && !isSaving && (
            <span className="text-atria-success">Autosaved âœ“</span>
          )}
          {isSaving && <span className="text-atria-text-muted">Savingâ€¦</span>}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-atria-border">
          <div
            className={cn('h-full transition-all duration-300', step.bgAccent)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className={cn('text-2xl font-semibold', step.accent)}>{step.prompt}</h2>
        <p className="text-base text-atria-text-secondary">{helperText}</p>
      </div>

      {stepId === 'when' && (
        <WhenStep
          note={note}
          onChange={update}
          editable={editable}
          stepBlockers={stepBlockers}
        />
      )}

      {stepId === 'what' && (
        <WhatStep
          selectedServices={selectedServices}
          onChange={onSelectedServicesChange}
        />
      )}

      {stepId === 'how' && (
        <HowStep
          note={note}
          onChange={update}
          editable={editable}
          clientName={clientName}
        />
      )}

      {stepId === 'goal' && (
        <GoalStep
          selectedGoals={selectedGoals}
          onChange={onSelectedGoalsChange}
        />
      )}

      {stepId === 'issues' && (
        <IssuesStep
          issueChoice={issueChoice}
          onChange={onIssueChoiceChange}
          clerkOrgId={clerkOrgId}
          editable={editable}
          taskDrafts={taskDrafts}
          tasks={tasks}
          onTaskDraftsChange={onTaskDraftsChange}
        />
      )}

      {stepId === 'done' && (
        <DoneStep
          note={note}
          selectedServices={selectedServices}
          selectedGoals={selectedGoals}
          issueChoice={issueChoice}
          confirmed={confirmed}
          onConfirmedChange={onConfirmedChange}
          onEditStep={onEditStep}
        />
      )}

      <div data-testid={`step-content-${stepId}`} className="hidden" />
    </div>
  )
}

function WhenStep({
  note,
  onChange,
  editable,
  stepBlockers,
}: {
  note: NoteDraft
  onChange: (patch: Partial<NoteDraft>) => void
  editable: boolean
  stepBlockers: string[]
}) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null)

  const startError = !note.startTime.trim() && stepBlockers.some((b) => b.includes('Start time'))
  const endError = stepBlockers.some((b) => b.includes('End time') || b.includes('after'))

  return (
    <div className="space-y-3">
      <TimeCard
        label="I started at"
        time={note.startTime}
        displayTime={note.startTime ? formatTime(`2026-06-25T${note.startTime}:00`) : 'â€”'}
        isEditing={editing === 'start'}
        onEdit={() => setEditing(editing === 'start' ? null : 'start')}
        onTimeChange={(value) => onChange({ startTime: value })}
        error={startError ? 'Enter a start time' : undefined}
        editable={editable}
      />
      <TimeCard
        label="I finished at"
        time={note.endTime}
        displayTime={note.endTime ? formatTime(`2026-06-25T${note.endTime}:00`) : 'â€”'}
        isEditing={editing === 'end'}
        onEdit={() => setEditing(editing === 'end' ? null : 'end')}
        onTimeChange={(value) => onChange({ endTime: value })}
        error={endError ? stepBlockers.find((b) => b.includes('End time') || b.includes('after')) : undefined}
        editable={editable}
      />
    </div>
  )
}

function TimeCard({
  label,
  time,
  displayTime,
  isEditing,
  onEdit,
  onTimeChange,
  error,
  editable,
}: {
  label: string
  time: string
  displayTime: string
  isEditing: boolean
  onEdit: () => void
  onTimeChange: (value: string) => void
  error?: string
  editable: boolean
}) {
  return (
    <div className="rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-atria-text-secondary">{label}</p>
          <p className="text-2xl font-semibold text-atria-ink">{displayTime}</p>
          {error && <p className="mt-1 text-sm text-atria-danger">{error}</p>}
        </div>
        {isEditing ? (
          <Input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            disabled={!editable}
            className="w-32"
            aria-label={label}
            data-testid={label === 'I started at' ? 'start-time-input' : 'end-time-input'}
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            disabled={!editable}
            className="min-h-[44px] rounded-full border border-atria-border bg-atria-surface px-4 text-sm font-medium text-atria-ink transition-colors hover:bg-atria-surface-2 disabled:opacity-45"
          >
            Change
          </button>
        )}
      </div>
    </div>
  )
}

function WhatStep({
  selectedServices,
  onChange,
}: {
  selectedServices: ServiceLabel[]
  onChange: (services: ServiceLabel[]) => void
}) {
  const toggle = (label: ServiceLabel) => {
    if (selectedServices.includes(label)) {
      onChange(selectedServices.filter((s) => s !== label))
    } else {
      onChange([...selectedServices, label])
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {SERVICE_OPTIONS.map((service) => {
        const selected = selectedServices.includes(service.label)
        return (
          <button
            key={service.label}
            type="button"
            onClick={() => toggle(service.label)}
            className={cn(
              'flex min-h-[88px] flex-col items-start justify-between rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
              selected
                ? 'border-atria-step-what bg-atria-step-what/10 text-atria-step-what'
                : 'border-atria-border bg-atria-surface-2 text-atria-ink hover:bg-atria-surface',
            )}
            data-testid={`service-option-${service.label}`}
          >
            <span className="text-2xl">{service.icon}</span>
            <span className="text-base font-medium">
              {service.label} {selected && 'âœ“'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HowStep({
  note,
  onChange,
  editable,
  clientName,
}: {
  note: NoteDraft
  onChange: (patch: Partial<NoteDraft>) => void
  editable: boolean
  clientName: string
}) {
  const length = note.narrative.length
  const valid = length >= 20

  const phrases = [
    '+ Bathing',
    '+ Ate well',
    '+ In good spirits',
  ]

  const appendPhrase = (phrase: string) => {
    const text = phrase.replace(/^\+ /, '')
    const separator = note.narrative.length > 0 && !note.narrative.endsWith('.') ? '. ' : ' '
    const next = note.narrative.length > 0 ? `${note.narrative}${separator}${text}` : text
    onChange({ narrative: next })
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={note.narrative}
        onChange={(e) => onChange({ narrative: e.target.value })}
        placeholder={`I helped ${clientName} with her morning bath and got her dressed...`}
        disabled={!editable}
        className="min-h-[200px] border-atria-step-how focus:border-atria-step-how focus:ring-atria-step-how"
        data-testid="narrative-textarea"
      />

      {valid && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-atria-success">âœ“ Looking good! Nice and clear.</span>
          <span className="text-atria-text-muted">{length} characters</span>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-atria-text-secondary">Need ideas? Tap a quick phrase:</p>
        <div className="flex flex-wrap gap-2">
          {phrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => appendPhrase(phrase)}
              className="min-h-[36px] rounded-full border border-atria-border bg-atria-surface px-3 text-sm text-atria-ink transition-colors hover:bg-atria-surface-2"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function GoalStep({
  selectedGoals,
  onChange,
}: {
  selectedGoals: GoalLabel[]
  onChange: (goals: GoalLabel[]) => void
}) {
  const toggle = (label: GoalLabel) => {
    if (selectedGoals.includes(label)) {
      onChange(selectedGoals.filter((g) => g !== label))
    } else {
      onChange([...selectedGoals, label])
    }
  }

  return (
    <div className="space-y-3">
      {GOAL_OPTIONS.map((goal) => {
        const selected = selectedGoals.includes(goal.label)
        return (
          <button
            key={goal.label}
            type="button"
            onClick={() => toggle(goal.label)}
            className={cn(
              'flex w-full items-center justify-between rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
              selected
                ? 'border-atria-step-goal bg-atria-step-goal/10'
                : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
            )}
            data-testid={`goal-option-${goal.label}`}
          >
            <div>
              <p className={cn('text-base font-semibold', selected ? 'text-atria-step-goal' : 'text-atria-ink')}>
                {goal.label}
              </p>
              <p className="text-sm text-atria-text-secondary">Goal: {goal.goal}</p>
            </div>
            <span className={cn('text-xl', selected ? 'text-atria-step-goal' : 'text-atria-text-muted')}>
              {selected ? 'âœ“' : 'â—‹'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function IssuesStep<TaskId extends string>({
  issueChoice,
  onChange,
  clerkOrgId,
  editable,
  taskDrafts,
  tasks,
  onTaskDraftsChange,
}: {
  issueChoice: IssueChoice | null
  onChange: (choice: IssueChoice) => void
  clerkOrgId: string
  editable: boolean
  taskDrafts: TaskDraft<TaskId>[]
  tasks: LoadedTask<TaskId>[]
  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onChange(ISSUE_CHOICE_NO)}
          className={cn(
            'flex items-start gap-4 rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
            issueChoice === ISSUE_CHOICE_NO
              ? 'border-atria-success bg-atria-success-bg'
              : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
          )}
          data-testid="issue-choice-no"
        >
          <span className="text-2xl">ðŸ˜Š</span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', issueChoice === ISSUE_CHOICE_NO ? 'text-atria-success' : 'text-atria-ink')}>
              No, all good today
            </p>
            <p className="text-sm text-atria-text-secondary">Everything went fine</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange(ISSUE_CHOICE_YES)}
          className={cn(
            'flex items-start gap-4 rounded-[var(--radius-atria-lg)] border p-4 text-left transition-colors',
            issueChoice === ISSUE_CHOICE_YES
              ? 'border-atria-danger bg-atria-danger-bg'
              : 'border-atria-border bg-atria-surface-2 hover:bg-atria-surface',
          )}
          data-testid="issue-choice-yes"
        >
          <span className="text-2xl">âš ï¸</span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', issueChoice === ISSUE_CHOICE_YES ? 'text-atria-danger' : 'text-atria-ink')}>
              Yes, I need to report something
            </p>
            <p className="text-sm text-atria-text-secondary">A fall, pain, mood change, or other concern</p>
          </div>
        </button>
      </div>

      <ShiftTaskList
        clerkOrgId={clerkOrgId}
        editable={editable}
        taskUpdates={taskDrafts}
        tasks={tasks}
        onChange={onTaskDraftsChange}
      />
    </div>
  )
}

function DoneStep({
  note,
  selectedServices,
  selectedGoals,
  issueChoice,
  confirmed,
  onConfirmedChange,
  onEditStep,
}: {
  note: NoteDraft
  selectedServices: ServiceLabel[]
  selectedGoals: GoalLabel[]
  issueChoice: IssueChoice | null
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  onEditStep?: (stepIndex: number) => void
}) {
  const serviceParts: string[] = [...selectedServices]
  for (const goal of selectedGoals) {
    serviceParts.push(`${goal} goal`)
  }

  const MAX_REVIEW_SERVICES = 3
  const reviewServices =
    serviceParts.length > MAX_REVIEW_SERVICES
      ? `${serviceParts.slice(0, MAX_REVIEW_SERVICES).join(' Â· ')} Â· +${serviceParts.length - MAX_REVIEW_SERVICES} more`
      : serviceParts.join(' Â· ')

  const issueText =
    issueChoice === ISSUE_CHOICE_NO
      ? 'âœ“ No problems â€” all good today'
      : issueChoice === ISSUE_CHOICE_YES
        ? 'âš ï¸ Reported: A fall, pain, mood change, or other concern'
        : 'â€”'

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-[var(--radius-atria-lg)] border border-atria-border bg-atria-surface-2 p-4">
        <ReviewRow
          label="Time"
          value={
            note.startTime && note.endTime
              ? `${formatTime(`2026-06-25T${note.startTime}:00`)} â€“ ${formatTime(`2026-06-25T${note.endTime}:00`)}`
              : 'â€”'
          }
          onEdit={() => onEditStep?.(0)}
        />
        <ReviewRow
          label="What you helped with"
          value={serviceParts.length > 0 ? reviewServices : 'â€”'}
          onEdit={() => onEditStep?.(1)}
        />
        <ReviewRow
          label="Your notes"
          value={note.narrative ? `â€œ${note.narrative}â€` : 'â€”'}
          valueClassName="line-clamp-1"
          onEdit={() => onEditStep?.(2)}
        />
        <ReviewRow
          label="Issues"
          value={issueText}
          onEdit={() => onEditStep?.(4)}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-atria-md)] border border-atria-border bg-atria-surface-2 p-4">
        <Checkbox
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="mt-0.5 h-5 w-5"
          data-testid="confirm-checkbox"
        />
        <span className="text-base text-atria-ink">
          I confirm this is accurate and true.
        </span>
      </label>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  valueClassName,
  onEdit,
}: {
  label: string
  value: string
  valueClassName?: string
  onEdit?: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-atria-text-muted">
          {label}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-sm font-medium text-atria-step-done hover:underline"
          >
            Edit
          </button>
        )}
      </div>
      <p className={cn('mt-1 text-base text-atria-ink', valueClassName)}>{value}</p>
    </div>
  )
}


 succeeded in 738ms:
import {
  type NoteDraft,
  type TaskDraft,
  type LoadedTask,
  validateDocumentationDraft,
} from './documentationDraft'

export const WIZARD_STEPS = [
  {
    id: 'when',
    label: 'When',
    prompt: 'When were you there?',
    helper: 'Check the times are right. Tap to change if needed.',
    accent: 'text-atria-step-when',
    bgAccent: 'bg-atria-step-when',
    borderAccent: 'border-atria-step-when',
    fields: ['startTime', 'endTime'] as const,
  },
  {
    id: 'what',
    label: 'What',
    prompt: 'What did you help with?',
    helper: 'Tap everything you did today. You can pick more than one.',
    accent: 'text-atria-step-what',
    bgAccent: 'bg-atria-step-what',
    borderAccent: 'border-atria-step-what',
    fields: ['servicesProvided'] as const,
  },
  {
    id: 'how',
    label: 'How',
    prompt: 'How did the visit go?',
    helper: 'Tell us in your own words what you helped with and how {clientName} was doing.',
    accent: 'text-atria-step-how',
    bgAccent: 'bg-atria-step-how',
    borderAccent: 'border-atria-step-how',
    fields: ['narrative'] as const,
  },
  {
    id: 'goal',
    label: 'Goal',
    prompt: 'Did you work on her goals?',
    helper: "These are {clientName}'s care plan goals. Tap the ones you helped with today.",
    accent: 'text-atria-step-goal',
    bgAccent: 'bg-atria-step-goal',
    borderAccent: 'border-atria-step-goal',
    fields: ['servicesProvided'] as const,
  },
  {
    id: 'issues',
    label: 'Issues',
    prompt: 'Anything we should know?',
    helper: 'Did anything go wrong, or did {clientName} seem unwell? It\'s okay if not.',
    accent: 'text-atria-step-issues',
    bgAccent: 'bg-atria-step-issues',
    borderAccent: 'border-atria-step-issues',
    fields: ['clientResponse'] as const,
  },
  {
    id: 'done',
    label: 'Done',
    prompt: 'One last look ðŸ‘€',
    helper: 'Check everything looks right, then send it to your coordinator.',
    accent: 'text-atria-step-done',
    bgAccent: 'bg-atria-step-done',
    borderAccent: 'border-atria-step-done',
    fields: [] as const,
  },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

export function stepIndexFor(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id)
}

export function validateStep(
  stepId: WizardStepId,
  note: NoteDraft,
  taskDrafts: TaskDraft[],
  tasks: LoadedTask[],
): string[] {
  const blockers = validateDocumentationDraft(note, taskDrafts, tasks)

  if (stepId === 'when') {
    return blockers.filter(
      (b) =>
        b.includes('Start time') ||
        b.includes('End time') ||
        b.includes('must be after'),
    )
  }

  if (stepId === 'what') {
    return blockers.filter((b) => b.includes('Services provided'))
  }

  if (stepId === 'how') {
    return blockers.filter((b) => b.includes('Narrative'))
  }

  if (stepId === 'goal') {
    return []
  }

  if (stepId === 'issues') {
    return blockers.filter((b) =>
      tasks.some((task) => b.includes(task.title)),
    )
  }

  return blockers
}

export function noteFieldsForStep(stepId: WizardStepId): Partial<NoteDraft> {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)
  const patch: Partial<NoteDraft> = {}
  for (const field of step?.fields ?? []) {
    switch (field) {
      case 'startTime':
        patch.startTime = ''
        break
      case 'endTime':
        patch.endTime = ''
        break
      case 'servicesProvided':
        patch.servicesProvided = ''
        break
      case 'clientResponse':
        patch.clientResponse = ''
        break
      case 'narrative':
        patch.narrative = ''
        break
    }
  }
  return patch
}

export function buildAutosavePatch(
  stepId: WizardStepId,
  note: NoteDraft,
): Partial<NoteDraft> {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)
  if (!step) return {}
  const patch: Partial<NoteDraft> = {}
  for (const field of step.fields) {
    switch (field) {
      case 'startTime':
        patch.startTime = note.startTime
        break
      case 'endTime':
        patch.endTime = note.endTime
        break
      case 'servicesProvided':
        patch.servicesProvided = note.servicesProvided
        break
      case 'clientResponse':
        patch.clientResponse = note.clientResponse
        break
      case 'narrative':
        patch.narrative = note.narrative
        break
    }
  }
  return patch
}

export function isStepComplete(
  stepId: WizardStepId,
  note: NoteDraft,
  taskDrafts: TaskDraft[],
  tasks: LoadedTask[],
): boolean {
  return validateStep(stepId, note, taskDrafts, tasks).length === 0
}

export { validateDocumentationDraft }


exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"isEditing \\?|data-testid=\\{label|Change|setEditing\" src/features/caregiver/components/ShiftNoteStep.tsx" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "start-time-input|end-time-input|step-content-done|fix and resubmit|wizard-next-button" tests/e2e/phase1-lifecycle.spec.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"afterEach|resetE2EShifts|signInWithClerk|signOut\\(\" tests/e2e/geofence.spec.ts tests/e2e/helpers/auth.ts" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n \"E2E tests|FAIL \\(credentials\\)|npm run e2e|Required Gates\" .hermes-pipeline/20260626_161701/summary.md" in C:\Users\pinol\Documents\Work\atriax\solid-pancake
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'rg -n "createCaregiverProfile|CLERK_SECRET_KEY|sendClerkInvitation|scheduler.runAfter" convex/employeeProfiles.ts' in C:\Users\pinol\Documents\Work\atriax\solid-pancake
 succeeded in 717ms:
29:  onNoteChange,
31:  onTaskDraftsChange,
40:  onSelectedServicesChange,
41:  onSelectedGoalsChange,
42:  onIssueChoiceChange,
43:  onConfirmedChange,
51:  onNoteChange: (note: NoteDraft) => void
53:  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
62:  onSelectedServicesChange: (services: ServiceLabel[]) => void
63:  onSelectedGoalsChange: (goals: GoalLabel[]) => void
64:  onIssueChoiceChange: (choice: IssueChoice) => void
65:  onConfirmedChange: (confirmed: boolean) => void
76:    onNoteChange({ ...note, ...patch })
108:          onChange={update}
117:          onChange={onSelectedServicesChange}
124:          onChange={update}
133:          onChange={onSelectedGoalsChange}
140:          onChange={onIssueChoiceChange}
145:          onTaskDraftsChange={onTaskDraftsChange}
156:          onConfirmedChange={onConfirmedChange}
168:  onChange,
173:  onChange: (patch: Partial<NoteDraft>) => void
177:  const [editing, setEditing] = useState<'start' | 'end' | null>(null)
189:        onEdit={() => setEditing(editing === 'start' ? null : 'start')}
190:        onTimeChange={(value) => onChange({ startTime: value })}
199:        onEdit={() => setEditing(editing === 'end' ? null : 'end')}
200:        onTimeChange={(value) => onChange({ endTime: value })}
214:  onTimeChange,
223:  onTimeChange: (value: string) => void
235:        {isEditing ? (
239:            onChange={(e) => onTimeChange(e.target.value)}
243:            data-testid={label === 'I started at' ? 'start-time-input' : 'end-time-input'}
252:            Change
262:  onChange,
265:  onChange: (services: ServiceLabel[]) => void
269:      onChange(selectedServices.filter((s) => s !== label))
271:      onChange([...selectedServices, label])
305:  onChange,
310:  onChange: (patch: Partial<NoteDraft>) => void
327:    onChange({ narrative: next })
334:        onChange={(e) => onChange({ narrative: e.target.value })}
369:  onChange,
372:  onChange: (goals: GoalLabel[]) => void
376:      onChange(selectedGoals.filter((g) => g !== label))
378:      onChange([...selectedGoals, label])
417:  onChange,
422:  onTaskDraftsChange,
425:  onChange: (choice: IssueChoice) => void
430:  onTaskDraftsChange: Dispatch<SetStateAction<TaskDraft<TaskId>[]>>
437:          onClick={() => onChange(ISSUE_CHOICE_NO)}
457:          onClick={() => onChange(ISSUE_CHOICE_YES)}
481:        onChange={onTaskDraftsChange}
493:  onConfirmedChange,
501:  onConfirmedChange: (confirmed: boolean) => void
555:          onChange={(e) => onConfirmedChange(e.target.checked)}

 succeeded in 720ms:
48:  await page.locator('[data-testid="start-time-input"]').fill('09:00')
49:  await page.locator('[data-testid="end-time-input"]').fill('13:00')
50:  await page.locator('[data-testid="wizard-next-button"]').click()
55:  await page.locator('[data-testid="wizard-next-button"]').click()
62:  await page.locator('[data-testid="wizard-next-button"]').click()
67:  await page.locator('[data-testid="wizard-next-button"]').click()
82:  await page.locator('[data-testid="wizard-next-button"]').click()
83:  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached()
87:  const nextButton = page.locator('[data-testid="wizard-next-button"]')
131:  // ---- Caregiver: fix and resubmit ----
143:  await page.locator('[data-testid="start-time-input"]').fill('09:15')
144:  await page.locator('[data-testid="wizard-next-button"]').click()
146:  await expect(page.locator('[data-testid="step-content-done"]')).toBeAttached({ timeout: 15000 })
148:  await page.locator('[data-testid="wizard-next-button"]').click()

 succeeded in 666ms:
21:## Required Gates
29:| E2E tests | `npm run e2e` | **FAIL (credentials)** | 4 baseline smoke tests pass. The 5 new required lifecycle/geofence specs now fail fast with a clear error when `E2E_CLERK_ORG_ID` and test-account credentials are not configured, instead of being skipped. They will run once credentials are provided. |

 succeeded in 669ms:
tests/e2e/geofence.spec.ts:9:  resetE2EShifts,
tests/e2e/geofence.spec.ts:10:  signInWithClerk,
tests/e2e/geofence.spec.ts:24:test.afterEach(async ({ page }) => {
tests/e2e/geofence.spec.ts:27:  await resetE2EShifts(page)
tests/e2e/geofence.spec.ts:31:  await signInWithClerk(page, E2E_COORDINATOR_EMAIL, E2E_COORDINATOR_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:40:  await signOut(page)
tests/e2e/geofence.spec.ts:58:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:105:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:121:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/geofence.spec.ts:134:  // Geofence is already disabled by the afterEach reset.
tests/e2e/geofence.spec.ts:136:  await signInWithClerk(page, E2E_CAREGIVER_EMAIL, E2E_CAREGIVER_PASSWORD, E2E_ORG_ID)
tests/e2e/helpers/auth.ts:43:export async function signInWithClerk(
tests/e2e/helpers/auth.ts:74:export async function signOut(page: Page) {
tests/e2e/helpers/auth.ts:96:export async function resetE2EShifts(page: Page) {
tests/e2e/helpers/auth.ts:99:  await signInWithClerk(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORG_ID)
tests/e2e/helpers/auth.ts:118:      path: 'seed:resetE2EShifts',
tests/e2e/helpers/auth.ts:126:    throw new Error(`resetE2EShifts failed: ${response.status} ${text}`)
tests/e2e/helpers/auth.ts:130:  console.log('resetE2EShifts result:', result)
tests/e2e/helpers/auth.ts:132:  await signOut(page)

 succeeded in 1129ms:
12:import { sendClerkInvitation } from './invitations'
70:export const createCaregiverProfile = internalMutation({
96:      await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
110:    await ctx.scheduler.runAfter(0, internal.adpOutbound.adpSyncWorker, {
163:      internal.employeeProfiles.createCaregiverProfile,
172:    const secretKey = process.env.CLERK_SECRET_KEY
174:      throw new Error('Server invitation configuration is missing CLERK_SECRET_KEY.')
177:    const invitation = await sendClerkInvitation({

codex
**Review Result**

1. Fix the required e2e gate before approval. [summary.md](C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:29) reports `npm run e2e` as **FAIL (credentials)**. The session explicitly requires all gates, including e2e, to be genuinely green.

2. Fix the lifecycle e2e interactions. [phase1-lifecycle.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:48) fills time inputs directly, but those inputs only render after clicking `Change` in [ShiftNoteStep.tsx](C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/caregiver/components/ShiftNoteStep.tsx:235). The correction flow also expects `step-content-done` after one `Next` click at [phase1-lifecycle.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:144), but the wizard only advances one step at a time.

3. Make geofence e2e cleanup session-safe. [geofence.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:24) calls `resetE2EShifts` after each test while the page may still be signed in as caregiver. That helper immediately calls admin `signInWithClerk` at [auth.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/helpers/auth.ts:99), and `signInWithClerk` expects a fresh `/sign-in` form. Clear/sign out before admin reset or make the sign-in helper handle an existing session.

4. Prevent ADP side effects when caregiver invitation fails. [employeeProfiles.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/employeeProfiles.ts:163) creates the employee profile and schedules worker sync before checking `CLERK_SECRET_KEY` or sending the Clerk invite at [employeeProfiles.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/employeeProfiles.ts:172). If invitation config or Clerk fails, the action can still leave an employee profile and queued/synced ADP worker for a caregiver who was not invited. Reorder the invite/config check or add compensation, plus a failure-path test.

Lint, typecheck, and unit logs are green; `git diff --check` has only line-ending warnings. The blockers above are acceptance/gate and payroll/PHI risk issues.

VERDICT: CHANGES_REQUESTED
tokens used
180,897
**Review Result**

1. Fix the required e2e gate before approval. [summary.md](C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260626_161701/summary.md:29) reports `npm run e2e` as **FAIL (credentials)**. The session explicitly requires all gates, including e2e, to be genuinely green.

2. Fix the lifecycle e2e interactions. [phase1-lifecycle.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:48) fills time inputs directly, but those inputs only render after clicking `Change` in [ShiftNoteStep.tsx](C:/Users/pinol/Documents/Work/atriax/solid-pancake/src/features/caregiver/components/ShiftNoteStep.tsx:235). The correction flow also expects `step-content-done` after one `Next` click at [phase1-lifecycle.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/phase1-lifecycle.spec.ts:144), but the wizard only advances one step at a time.

3. Make geofence e2e cleanup session-safe. [geofence.spec.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/geofence.spec.ts:24) calls `resetE2EShifts` after each test while the page may still be signed in as caregiver. That helper immediately calls admin `signInWithClerk` at [auth.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/tests/e2e/helpers/auth.ts:99), and `signInWithClerk` expects a fresh `/sign-in` form. Clear/sign out before admin reset or make the sign-in helper handle an existing session.

4. Prevent ADP side effects when caregiver invitation fails. [employeeProfiles.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/employeeProfiles.ts:163) creates the employee profile and schedules worker sync before checking `CLERK_SECRET_KEY` or sending the Clerk invite at [employeeProfiles.ts](C:/Users/pinol/Documents/Work/atriax/solid-pancake/convex/employeeProfiles.ts:172). If invitation config or Clerk fails, the action can still leave an employee profile and queued/synced ADP worker for a caregiver who was not invited. Reorder the invite/config check or add compensation, plus a failure-path test.

Lint, typecheck, and unit logs are green; `git diff --check` has only line-ending warnings. The blockers above are acceptance/gate and payroll/PHI risk issues.

VERDICT: CHANGES_REQUESTED
