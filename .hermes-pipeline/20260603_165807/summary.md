# Pipeline summary — atriax
**Task:** Add a Vitest unit test file at src/shared/format.test.ts that thoroughly tests the three exported functions in src/shared/format.ts (formatCurrency, formatHours, formatStatusLabel), including edge cases (zero, negative, fractional values, multi-word underscore strings). Follow the repo style: single quotes, no semicolons, 2-space indent. Do NOT modify format.ts. Vitest runs with globals enabled so describe/it/expect do not need imports.
**Plan mode:** both
**Result:** FINAL_GATE_FAILED
**Converged:** True  **Final gate:** False
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260603_165807

## Stages
- {'stage': 'plan_opus', 'backend': 'hermes', 'model': 'claude-opus-4-8', 'rc': 0}
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postimpl', 'passed': False}
- {'stage': 'review_opus_iter1', 'backend': 'hermes', 'model': 'claude-opus-4-8', 'verdict': 'APPROVED'}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix1', 'passed': False}
- {'stage': 'review_opus_iter2', 'backend': 'hermes', 'model': 'claude-opus-4-8', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter2', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix2', 'passed': False}
- {'stage': 'review_opus_iter3', 'backend': 'hermes', 'model': 'claude-opus-4-8', 'verdict': 'APPROVED'}
- {'stage': 'review_codex_iter3', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'APPROVED'}
- {'stage': 'gate_final', 'passed': False}

## Hermes authenticated providers (probe)
```
anthropic (1 credentials):
  #1  ANTHROPIC_API_KEY    api_key env:ANTHROPIC_API_KEY ←
```

## Next step
Review the uncommitted diff, then commit/merge if satisfied:
```
git -C "C:\Users\pinol\Documents\Work\atriax\solid-pancake" diff
```