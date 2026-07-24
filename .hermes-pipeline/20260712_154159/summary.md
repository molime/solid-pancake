# Pipeline summary — atriax
**Task:** ATRIA-X Phase 2 — HR invite / review / documents polish

Make three conservative UX improvements to the existing candidate onboarding flow:

1. Invite candidate form validation (src/features/hr/components/InviteCandidateModal.tsx)
   - Validate that email looks like an email.
   - Validate that required fields (display name, email) are filled.
   - If phone is provided, validate it has at least 10 digits.
   - Show inline field-level errors; disable submit while invalid or submitting.
   - Use simple regex helpers; do not add dependencies.

2. Single-click approve + send offer (src/features/hr/pages/ApplicationReviewPage.tsx)
   - For candidates in `applied` or `application_draft` status, replace the current "Approve application" primary CTA with "Approve application & send offer".
   - The handler calls `candidates:reviewApplication({ decision: 'approved' })` then immediately `candidates:sendOffer(...)` with the offer fields.
   - Keep the existing `hr_review` status CTA as "Send offer" for edge cases, and keep the rest of the decision card unchanged.
   - Keep the `allTasksComplete` guard.

3. Human-readable document category labels (src/shared/format.ts + ApplicationReviewPage.tsx)
   - Add `formatDocumentCategoryLabel(category)` mapping:
     photo_id -> "Photo identification"
     cpr_certificate -> "CPR certificate"
     background_check -> "Background check"
     employment_agreement -> "Employment agreement"
     form_submission -> "Application form"
     fallback to formatStatusLabel(category) for unknown values.
   - Use this label when rendering each document in ApplicationReviewPage, including the fallback download file name.

Additional requirements:
- Style: single quotes, no semicolons, 2-space indent, Tailwind v4 tokens.
- Keep changes minimal; do not change convex schema, backend state machine, or document upload labels.
- Add regression tests:
  - New src/features/hr/components/InviteCandidateModal.test.tsx covering email/phone validation and valid submission.
  - Update src/features/hr/pages/ApplicationReviewPage.test.tsx to assert the combined approve+offer CTA and label mapping.
  - Add src/shared/format.test.ts (or extend existing) for formatDocumentCategoryLabel.
- Run and keep green: npm run lint, npm run typecheck, npm run test, npm run build. Report e2e results honestly; @auth specs need live Clerk credentials.
- Use branch feature/phase-2-worker-onboarding.

Detailed design doc: C:\\Users\\pinol\\AppData\\Local\\Temp\\atriax-hr-invite-review-doc-polish-design.md
**Plan mode:** codex
**Reviewers:** codex
**Result:** FINAL_GATE_FAILED
**Converged:** True  **Final gate:** False
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260712_154159

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postimpl', 'passed': True}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix1', 'passed': True}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'APPROVED'}
- {'stage': 'gate_final', 'passed': False}

## Hermes authenticated providers (probe)
```
anthropic (1 credentials):
  #1  ANTHROPIC_API_KEY    api_key env:ANTHROPIC_API_KEY ←

ollama-cloud (1 credentials):
  #1  OLLAMA_API_KEY       api_key env:OLLAMA_API_KEY ←

openai-api (1 credentials):
  #1  OPENAI_API_KEY       api_key env:OPENAI_API_KEY ←
```

## Next step
Review the uncommitted diff, then commit/merge if satisfied:
```
git -C "C:\Users\pinol\Documents\Work\atriax\solid-pancake" diff
```