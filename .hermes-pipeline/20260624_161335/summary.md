# Pipeline summary — atriax
**Task:** SESSION 5 — FE foundation: dark token port + primitive polish (PIPELINE, plan-mode codex)

Repository: C:\Users\pinol\Documents\Work\atriax\solid-pancake

MANDATORY PROCESS / SCOPE:
- This run is code work and must be done through the ATRIA-X multi-model pipeline only.
- Plan/review must use Codex CLI (plan-mode codex and reviewers codex). Implementation/fix must use Kimi as configured by the pipeline.
- Opus/Claude is unavailable and must not be used.
- Pure presentation only. No behavior change.
- Follow ATRIA-X rules: single quotes, no semicolons, 2-space indent. Do not hand-edit convex/_generated unless codegen blocker is documented. This task is frontend-only.
- Existing dirty worktree changes are baseline from prior sessions; do not reset, stash, or revert unrelated files.

FIGMA SOURCE OF TRUTH ALREADY CONNECTED/EXPORTED BY HERMES BEFORE CODING:
- Talk-to-Figma channel: wzkdzbsj
- Foundations frame: name "DS — Foundations" (user-facing "Design system — Foundations"), frame ID 1:2
- Foundations PNG export: C:\Users\pinol\AppData\Local\hermes\image_cache\img_b8154a1c250c.png
- Components frame: name "DS — Components" (user-facing "Design system — Components"), frame ID 1:89
- Components PNG export: C:\Users\pinol\AppData\Local\hermes\image_cache\img_cf40f27f5d5d.png
Include these exact frame IDs and PNG paths in the implementation notes / summary artifacts.

DESIGN/TOKEN SOURCES:
- Exported Figma DS frames above.
- Token table in atriax/design/design-system-tokens.md.
- Required values from user brief:
  - colors: bg/base #0A0E0F, surface/1 #11171A, sidebar #0C1113, text/primary #F2F6F7, accent/primary #16A34A
  - status: success #2FBF71, warning #F0B429, danger #F0564A, info #4D8DF6, neutral #8A99A0
  - per-step accents
  - radius sm8/md12/lg16/xl20/pill
  - control heights md40/lg52
  - type scale with 16px minimum body, Inter
- Figma exported frame inspection also shows the DS frames use closely related values such as bg/base #0B0F10, bg/elevated #151B1D, bg/subtle #1E2629, border #2A3437, primary/deep #16A34A, button lg 52px pill, card radius 16, input 52px radius 12, KPI card 260x132. Reconcile exact implementation against design-system-tokens.md and exported frames; document any deliberate token-table-vs-Figma mismatch.

IMPLEMENTATION TASK:
1) Update src/index.css:
   - Replace/extend the --color-atria-* and theme variables to make the dark palette the primary/default mode.
   - Keep the existing token NAMES so downstream code does not break.
   - Structure the CSS so light mode can be added later as a second set.
   - Do NOT delete the old light values: move them under a documented light block.
2) Audit and polish src/shared/ui/* to match the Figma component recipes:
   - Button gains size="lg" (52px; pill radius for primary) and matches primary/secondary/danger/disabled dark recipes.
   - Card padding 24.
   - Input, Select, Textarea: bigger labels, helper/error text, 16px font, 52px lg control recipe where appropriate.
   - StatusBadge variants for success/warning/danger/info/neutral with color + word, never color alone.
   - KpiCard.
   - Ensure ProgressSteps, EmptyState, Toast, FieldGroup match the dark recipe.
3) Keep existing public APIs working; additive changes are preferred.
4) Update component tests/snapshots/assertions only as needed.

VERIFICATION GATES REQUIRED BEFORE CLAIMING GREEN:
- npm run lint
- npm run typecheck
- npm run test
- npm run build
If any required gate is red or unrun, mark the session NOT COMPLETE / NOT GREEN.
**Plan mode:** codex
**Reviewers:** codex
**Result:** SUCCESS
**Converged:** True  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260624_161335

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 3840}
- {'stage': 'gate_postimpl', 'passed': False}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix1', 'passed': False}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'APPROVED'}
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