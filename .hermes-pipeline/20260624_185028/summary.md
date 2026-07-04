# Pipeline summary — atriax
**Task:** SESSION 6 — ATRIA-X frontend caregiver shift documentation flow with Clock-In/Clock-Out + optional geofence.

Execution constraints for the internal pipeline:
- Use --project atriax, --plan-mode codex, --reviewers codex, --auto.
- Use Codex CLI for plan/review. Do not use Opus/Claude.
- Use Kimi CLI for implementation/fix as configured by the pipeline.
- Do not bypass the pipeline or make direct out-of-band repo edits.
- Follow ATRIA-X rules: multi-tenancy/server authorization, existing src/shared/ui primitives + @/shared/lib/cn, no new Radix/shadcn deps, style single quotes/no semicolons/2-space.
- Repo: C:\Users\pinol\Documents\Work\atriax\solid-pancake.

Task:
ATRIA-X frontend — caregiver shift documentation flow with clock-in/clock-out + optional geofence, pixel-faithful to the Figma caregiver wizard lane.

Figma/talk-to-figma hard pre-step:
- Connect to talk-to-figma channel id: wzkdzbsj.
- Export every target frame as PNG before implementing.
- Target frames: Today/entry, Clock In, Step1 When, Step2 What, Step3 How, Step4 Goal, Step5 Issues, Step6 Done, Clock Out, Submission success, plus location-permission/geofence-blocked state if present.
- Write a screen spec artifact in the pipeline run with frame IDs, PNG paths, exact copy, spacing, tokens, and state behavior.
- Use that spec + dark tokens as ground truth. Mobile-first, 390-wide primary.

Implementation scope:
- Restructure src/features/caregiver (CaregiverTodayPage.tsx, ShiftDocumentationForm.tsx, ShiftTaskList.tsx, model/documentationDraft.ts) into a guided flow.
- Flow: pick shift -> CLOCK IN screen -> 6 guided note steps -> CLOCK OUT screen -> success screen.
- CLOCK IN screen: big primary 'Clock In' pill. If geofence is enabled, request browser geolocation via navigator.geolocation, show permission/checking/blocked states in the Figma style, then call clockIn({ shiftId, location }). Until clocked in, note steps are locked with a plain-language hint.
- Six guided steps: one question at a time with top progress bar + per-step accent colors: When=blue, What=purple, How=amber, Goal=teal, Issues=red, Done=green. Autosave draft by reusing documentationDraft. Live inline validation.
- CLOCK OUT screen: 'Clock Out' disabled until note is complete and, when geofence is enabled, location is available/inside radius. Show a 'what's still missing' checklist including note items and location items. On tap call clockOut({ shiftId, location }). Success screen after submit.
- If geofence is disabled, do not request location and do not show location blockers.
- Wire to Convex clockIn/clockOut mutations and existing shift/progressNote/shiftTask queries+mutations.
- Reflect server gating in UI but do not rely on client guard alone.
- Big touch targets >=44px, 16px+ type, status = color + word.
- Map any v0/shadcn idiom to existing src/shared/ui primitives + @/shared/lib/cn. No new Radix/shadcn deps.

Required tests:
- Flow renders each step.
- Geofence disabled does not request location.
- Geofence enabled requests location.
- Location denied shows blocked state.
- Outside-radius server error renders the plain-language blocked state.
- Clock-out disabled when note incomplete.
- Submit calls clockOut with location.
- Draft autosave preserved.

Review acceptance:
- Run the app.
- Capture screenshots of every caregiver state.
- Compare against exported Figma PNGs.
- Any visible divergence requires a Kimi fix pass before approval.

Required gates:
- codegen if Convex API/schema touched.
- lint green.
- typecheck green.
- test green.
- build succeeds.
- Do not claim success unless required gates are actually green and recorded in the pipeline run artifacts.
**Plan mode:** codex
**Reviewers:** codex
**Result:** NOT_CONVERGED (review cap hit)
**Converged:** False  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260624_185028

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 2304}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 124}
- {'stage': 'gate_postimpl', 'passed': False}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postfix1', 'passed': True}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter2', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postfix2', 'passed': False}
- {'stage': 'review_codex_iter3', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter3', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postfix3', 'passed': True}
- {'stage': 'review_codex_iter4', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter4', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 1}
- {'stage': 'gate_postfix4', 'passed': False}
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