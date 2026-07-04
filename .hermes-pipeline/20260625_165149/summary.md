# Pipeline summary — atriax
**Task:** SESSION 7 — FE: coordinator review & approval.

Repo: C:\Users\pinol\Documents\Work\atriax\solid-pancake.

Parent Hermes hard Figma pre-step is complete:
- Joined talk-to-figma channel q21hjw9j.
- Exported target coordinator frames as PNGs:
  - Coordinator / Dashboard frame 1:291: C:\Users\pinol\AppData\Local\hermes\image_cache\img_7681b2de40de.png
  - Coordinator / Review Queue frame 1:399: C:\Users\pinol\AppData\Local\hermes\image_cache\img_f1558cdf10ec.png
  - Coordinator / Review Detail frame 1:400: C:\Users\pinol\AppData\Local\hermes\image_cache\img_8b0676c66f64.png
- Wrote screen spec: C:\Users\pinol\AppData\Local\Temp\atriax-session7-figma-spec.md

Before visual review/final approval, copy or reference these artifacts from the active .hermes-pipeline/<timestamp>/ run directory; if reviewers need local run artifacts, use these exact paths.

Task:
ATRIA-X frontend — coordinator review & approval, pixel-faithful to the Figma coordinator frames (Coordinator dashboard, Review queue, Review detail with Approve / Request Correction). Desktop-first.

Restyle/restructure:
- src/features/coordinator/CoordinatorReviewPage.tsx or src/features/coordinator/pages/CoordinatorReviewPage.tsx, whichever exists
- src/features/coordinator/components/ReviewDetail.tsx
- src/features/coordinator/components/ReviewHistory.tsx
- coordinator dashboard view in src/features/dashboard

Match the exported PNGs + dark tokens in the screen spec. Reuse src/shared/ui primitives and @/shared/lib/cn. No new dependencies. Style: single quotes, no semicolons, 2-space indent.

Functional requirements:
- Review queue = submitted shifts list with filters and status pills.
- Status pills must be color + word: Submitted info, Needs correction red, Approved green.
- Review detail shows the note: times, services, client response, narrative, tasks + proof, audit/review history.
- Two big primary actions: Approve and Request Correction.
- Approve marks shift approved/billing-ready using existing convex/reviews.ts mutations/queries.
- Request Correction returns to caregiver with a required comment using existing convex/reviews.ts mutations/queries.
- Keep all tenant access through authHelpers; server already enforces role.
- Show dependency-visibility principle: what's missing / who's next / what it blocks.

Tests required:
- Queue renders states: loading, empty, populated.
- Approve calls the right mutation.
- Request-correction calls the right mutation.
- Correction requires a comment.

Acceptance required:
- Run the app, capture screenshots of every coordinator state, and compare against exported Figma PNGs.
- If any visible divergence exists, Kimi must fix before approval.
- Gates: lint, typecheck, test green; build succeeds. Run codegen only if Convex generated API metadata changes.

Model constraints:
- Use Codex for planning and review. Do not use Opus/Claude.
- Kimi handles implementation/fix stages as configured by the pipeline.

Baseline note from parent Hermes before launch: worktree already contained many modified/untracked files from prior ATRIA-X sessions, including coordinator files and .hermes-pipeline. Treat existing dirty work as intentional baseline Phase-1 cumulative work; do not reset/stash/revert unless necessary and explicitly justified.
**Plan mode:** codex
**Reviewers:** codex
**Result:** SUCCESS
**Converged:** True  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260625_165149

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postimpl', 'passed': True}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 124}
- {'stage': 'gate_postfix1', 'passed': True}
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