# Pipeline summary — atriax
**Task:** ATRIA-X Phase 1 SESSION 8 — E2E + ADP contract tests + plug-and-play dry run.

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
**Plan mode:** codex
**Reviewers:** codex
**Result:** NOT_CONVERGED (review cap hit)
**Converged:** False  **Final gate:** False
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260626_161701

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
- {'stage': 'fix_iter3', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postfix3', 'passed': True}
- {'stage': 'review_codex_iter4', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'UNKNOWN'}
- {'stage': 'fix_iter4', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix4', 'passed': True}
- {'stage': 'gate_final', 'passed': False}

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