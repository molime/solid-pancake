# Pipeline summary — atriax
**Task:** Run SESSION 3 — ADP port + adapter + sync engine (PIPELINE, plan-mode codex) for ATRIA-X Phase 1 backend. Do not ask for credentials; the integration must run safely without them.

Repository: C:\Users\pinol\Documents\Work\atriax\solid-pancake
Branch: feature/session-2-clock-geofence
Project: atriax
Planning/review model: Codex only because Claude/Opus is unavailable. Implementation/fix: Kimi as configured by the pipeline.

Before coding, respect ATRIA-X rules:
- Use convex/authHelpers.ts for all tenant data access.
- Preserve multi-tenancy. Never trust caller-supplied tenant ids without authHelpers guards.
- Never log secret values.
- Style: single quotes, no semicolons, 2-space indent.
- After Convex edits run npx convex codegen. Gates required: lint, typecheck, tests green. Do not claim success if any required gate is red/unrun.

Task:
ATRIA-X Phase 1 backend — ADP time integration, built plug-and-play (NO credentials yet; must run safely without them).

Create convex/integrations/adp/.

(1) adpPort.ts: TypeScript interface AdpPort with precise input/output types:
- getAccessToken()
- listWorkers(cursor?)
- createWorker(profile)
- postPunch(punch)
- getTimeCards(aoid)

(2) adpClient.ts: real adapter implementing AdpPort for ADP Workforce Now.
- Auth = OAuth2 client_credentials + mutual TLS.
- POST to process.env ADP_TOKEN_URL with grant_type=client_credentials, ADP_CLIENT_ID, ADP_CLIENT_SECRET.
- Present a client cert built from ADP_CLIENT_CERT_PEM + ADP_CLIENT_KEY_PEM via node:https Agent.
- Cache the bearer token until expiry.
- listWorkers => GET {ADP_BASE_URL}/hr/v2/workers paginated ($top,$skip) returning associateOID/workerID/name/status.
- createWorker => POST {ADP_BASE_URL}/events/hr/v1/worker.hire (hire event).
- getTimeCards => GET {ADP_BASE_URL}/time/v2/workers/{aoid}/time-cards.
- postPunch => leave the request body as a clearly commented STUB (product-dependent: real-time time-entry event vs batch) that throws NotConfiguredError if called while unconfigured, and is the single documented fill-in point; wire everything else around it concretely.

(3) mockAdp.ts: deterministic in-memory AdpPort for tests.

(4) config.ts: isAdpConfigured(ctx, tenantId) = all ADP_* env vars present AND integrationConnections.status === 'configured' for that tenant.

(5) Sync engine as Convex internal actions:
- adpSyncPunch(timePunchId)
- adpSyncWorker(employeeProfileId)
- if NOT configured, set row adpSyncStatus='pending_credentials' and return (app keeps working)
- if configured, call adapter, and on success set 'synced' + store adpPunchId/adpAssociateOid
- on failure set 'error' + adpError with bounded retry
- Make all outbound calls idempotent keyed on integrationEvents idempotencyKey = `${kind}:${refId}` so retries never double-post
- record each attempt (sanitized, NO secrets) in integrationEvents

(6) Internal action adpInitialWorkerLoad(): pulls listWorkers and upserts employeeProfiles, matching existing profiles by email/name and storing adpAssociateOid, marking matched vs created.

Tests (convex/*.test.ts) using mockAdp:
- unconfigured => punch marked pending_credentials and app call still succeeds
- configured => punch posts once, stores adpPunchId, second drain is idempotent
- worker load matches an existing profile by email and creates a new one otherwise
- createWorker enqueued when a caregiver is created

Also: If there is no session 1 branch, continue on feature/session-2-clock-geofence. Local/remote branch inspection found only feature/session-2-clock-geofence and main, so no session 1 merge is available.
**Plan mode:** codex
**Result:** NOT_CONVERGED (review cap hit)
**Converged:** False  **Final gate:** False
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260623_194138

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postimpl', 'passed': True}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'UNKNOWN'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 3840}
- {'stage': 'gate_postfix1', 'passed': False}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter2', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix2', 'passed': True}
- {'stage': 'review_codex_iter3', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter3', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix3', 'passed': True}
- {'stage': 'review_codex_iter4', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
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