# Pipeline summary — atriax
**Task:** ATRIA-X SESSION 2 — Clock-in/out + geofence gating + shift lifecycle

Execution constraints for the pipeline stages:
- This run is for repo C:\Users\pinol\Documents\Work\atriax\solid-pancake.
- Use codex for planning/review and Kimi for implementation/fix. Do not use Claude/Opus.
- Do not run a repo-wide format/lint-fix. Touch only files required for this feature.
- Preserve and reuse the prior session's existing timePunches/geofence settings work in the current working tree. Do not discard or overwrite those changes unless they are directly incompatible with this session.
- Follow ATRIA-X rules: every Convex function touching tenant data goes through convex/authHelpers.ts; caregiver functions are requireTenantRole org:caregiver; admin/coordinator mutations are requireTenantRole org:admin or org:coordinator; assertTenantDoc on every fetched shift/client; single quotes, no semicolons, 2-space indent; after Convex changes run npx convex codegen.
- Core product rule: never bill a shift unless documentation is complete and approved.

Task:
ATRIA-X Phase 1 backend. Implement caregiver clock-in/clock-out with server-side note gating AND optional geofence gating in convex/, reusing existing convex/shiftLifecycle.ts, convex/shiftValidation.ts, convex/shifts.ts, and the timePunches/geofence settings from the prior session.

Add a pure tested helper convex/locationValidation.ts with:
- Haversine distance
- target resolution, where shift override beats client serviceAddress
- accuracy validation
- plain-language error messages

Add admin/coordinator mutations to update tenant shiftGeofence settings and client/shift service-location data. These require org:admin or org:coordinator. Caregivers cannot change these settings.

Implement mutation clockIn({ shiftId, location? }):
- caregiver-scoped with requireTenantRole org:caregiver
- if geofence is enabled and enforceClockIn, require browser geolocation location { latitude, longitude, accuracyMeters }
- reject if no target address coords configured, outside radius, or accuracy > maxAccuracyMeters
- if geofence is disabled, location is optional
- on success record shifts.clockInAt = now ISO
- insert a timePunches row including location evidence and { punchType: 'clock_in', source: 'atriax', adpSyncStatus: 'pending_credentials', at: now }
- apply lifecycle transition per shiftLifecycle.ts
- write auditEvents
- enqueue ADP sync via an internal action adpSyncPunch, stub/no-op for now but with a real call site
- idempotent double clock-in must not create two punches

Add guard: progress-note writes in the existing note create/update path must reject with a clear error unless a clock_in punch exists.

Implement mutation clockOut({ shiftId, location? }):
- caregiver-scoped with requireTenantRole org:caregiver
- if geofence is enabled and enforceClockOut, validate location the same way
- reject unless the shift note passes convex/shiftValidation.ts completeness: start/end/services/clientResponse/narrative + all requiredProof tasks complete
- on pass record shifts.clockOutAt
- insert a clock_out timePunches row with location evidence
- write auditEvents
- enqueue adpSyncPunch
- move the shift to submitted reusing the existing submit path; do not fork it

Tests required:
1. note write blocked before clock-in
2. clock-in blocked when geofence enabled and location missing
3. clock-in blocked outside radius
4. clock-in succeeds inside radius and stores distance/location evidence
5. clock-in succeeds without location when geofence disabled
6. clock-out blocked when note incomplete
7. clock-out blocked outside radius when enabled
8. clock-out succeeds and emits clock_out punch + audit when note complete and inside radius
9. idempotent double clock-in does not create two punches

Required gates:
- npx convex codegen
- npm run lint
- npm run typecheck
- npm run test
- final gates as configured by the ATRIA-X pipeline

Do not claim success unless codegen, lint, typecheck, and tests required by this session are actually green, or report exact real blockers/failures honestly.
**Plan mode:** codex
**Result:** NOT_CONVERGED (review cap hit)
**Converged:** False  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260623_153328

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
- {'stage': 'review_codex_iter3', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter3', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix3', 'passed': True}
- {'stage': 'review_codex_iter4', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
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