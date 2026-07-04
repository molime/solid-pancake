# Pipeline summary — atriax
**Task:** ATRIA-X SESSION 4 — Minimal caregiver identity + ADP sync + geofence settings UI

Run this through the ATRIA-X multi-model pipeline using codex + kimi only: plan/review via Codex CLI, implementation/fix via Kimi CLI. Opus/Claude must not be used.

Repo: C:\Users\pinol\Documents\Work\atriax\solid-pancake

Follow atriax-orchestrator and atriax-rules:
- All tenant data through convex/authHelpers.ts
- requireTenantRole for server-side authorization
- Clerk organization roles: org:admin, org:coordinator, org:caregiver
- npx convex codegen after Convex edits
- Style: single quotes, no semicolons, 2-space indent
- Do not build candidate application or HR onboarding
- Keep this Phase 1 backend + thin admin/coordinator UI minimal

Task:

ATRIA-X Phase 1 backend + thin admin/coordinator UI for minimal caregiver identity and geofence settings, reusing convex/members.ts, convex/invitations.ts, employeeProfiles, tenant shiftGeofence settings, and the ADP sync engine.

Required implementation:

1. Backend mutation createCaregiver({ displayName, email })
   - requireTenantRole org:admin
   - Creates or updates an employeeProfiles row
   - Sends the existing Clerk invitation so the caregiver can log in, reusing convex/invitations.ts
   - Enqueues adpSyncWorker so the new caregiver is reflected in ADP when configured
   - If ADP credentials/config are missing, queue/mark as pending_credentials until then
   - On invite acceptance, link employeeProfiles.clerkUserId + tenantMemberId

2. Backend admin mutation runAdpInitialWorkerLoad()
   - requireTenantRole org:admin
   - Schedules/runs adpInitialWorkerLoad from the prior session
   - Returns a summary with matched/created/errors counts

3. Backend query listEmployeeProfiles
   - Tenant-guarded
   - Admin-facing
   - Return displayName, email, role, adpSyncStatus

4. Thin admin UI under src/features/team
   - Reuse existing Team page patterns and src/shared/ui primitives
   - Role-gated through RouteGuard/TenantRoleRouteGuard as appropriate
   - Add a "Caregivers & ADP sync" panel
   - List employees with adpSyncStatus pill, with color + WORD:
     - Synced = green
     - Queued = amber
     - Pending credentials = gray
     - Error = red
   - Add caregiver form with name + email fields
   - "Load from ADP" button calls runAdpInitialWorkerLoad and shows a result toast

5. Compact "Clock-in location rules" settings panel
   - Visible to admins/coordinators
   - Enable/disable geofence
   - Enforce on clock-in
   - Enforce on clock-out
   - Default radius meters
   - Max accuracy meters
   - Plain-language help text
   - Editable by admin/coordinator
   - Rejected for caregiver on backend

6. Client/shift location editing where it naturally fits
   - Client record or shift detail, whichever matches existing patterns best
   - Service address + latitude/longitude fields, or saved geocoded target
   - If no coordinates are configured and geofence is enabled, warn that clock-in/out will be blocked until an address is completed

Tests required:
- createCaregiver enqueues a worker sync + creates a profile
- initial-load summary counts are correct with mocked ADP
- geofence settings are editable by admin/coordinator and rejected for caregiver

Required gates:
- npx convex codegen
- npm run lint
- npm run typecheck
- npm run test

Quality/scope constraints:
- Minimal Phase 1 only
- Do not build candidate/HR onboarding
- Preserve existing flows unless tests prove the intended change
- Do not claim success unless codegen/lint/typecheck/tests required by this session are actually green

Optimization guidance:
- Avoid wasting loops on formatting-only churn; run the required focused tests and gates promptly after implementation
- Keep scope tight to the listed files/features
- Do not add broad refactors or unrelated UI redesigns
**Plan mode:** codex
**Result:** NOT_CONVERGED (review cap hit)
**Converged:** False  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260624_102243

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postimpl', 'passed': True}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix1', 'passed': True}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter2', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix2', 'passed': True}
- {'stage': 'review_codex_iter3', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'UNKNOWN'}
- {'stage': 'fix_iter3', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix3', 'passed': True}
- {'stage': 'review_codex_iter4', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'UNKNOWN'}
- {'stage': 'fix_iter4', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix4', 'passed': True}
- {'stage': 'gate_final', 'passed': True}

## Hermes authenticated providers (probe)
```
anthropic (1 credentials):
  #1  ANTHROPIC_API_KEY    api_key env:ANTHROPIC_API_KEY ←

openai-api (1 credentials):
  #1  OPENAI_API_KEY       api_key env:OPENAI_API_KEY ←
```

## Next step
Review the uncommitted diff, then commit/merge if satisfied:
```
git -C "C:\Users\pinol\Documents\Work\atriax\solid-pancake" diff
```