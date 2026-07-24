# Pipeline summary — atriax
**Task:** ATRIA-X Phase 2 HR onboarding UX polish. Make three conservative, minimal changes and clean up the current lint/typecheck state.

1. In `src/features/hr/components/InviteCandidateModal.tsx`:
   - Add inline form validation: email must be valid, displayName is required, phone is optional but if provided must be at least 10 digits.
   - Show errors via the existing `FieldGroup` `error` prop only after blur or a submit attempt (use `touched` state).
   - Disable the submit button while the form is invalid or `submitting`.
   - Update/create `src/features/hr/components/InviteCandidateModal.test.tsx` to cover invalid email, invalid phone, missing required fields, and successful submit.

2. In `src/features/hr/pages/ApplicationReviewPage.tsx`:
   - Add a single `handleApproveAndSendOffer` that calls `reviewApplication` then `sendOffer` sequentially.
   - Replace the primary "Approve application" CTA for candidates with status `applied`/`application_draft` with "Approve application & send offer".
   - Keep the existing "Send offer" CTA for `hr_review` status.
   - Keep the `allTasksComplete` guard that disables the primary action.
   - Update `src/features/hr/pages/ApplicationReviewPage.test.tsx` to assert the new button label and that clicking it calls `reviewApplication` then `sendOffer`. Mock tasks as complete so the button is enabled.

3. In `src/shared/format.ts`:
   - Add `formatDocumentCategoryLabel(category: string): string` that maps `photo_id` -> "Photo identification", `cpr_certificate` -> "CPR certificate", `background_check` -> "Background check", `employment_agreement` -> "Employment agreement", `form_submission` -> "Application form", with fallback to `formatStatusLabel(category)`.
   - Use it in `ApplicationReviewPage` for document card titles and default `fileName`.
   - Use it in `DocumentUploadPage` if it currently renders raw category keys.
   - Create/update `src/shared/format.test.ts` with tests for the new helper.

4. Cleanup (do not skip):
   - Fix the two lint errors in `src/features/hr/pages/ApplicationReviewPage.test.tsx`: `_args` is defined but never used in the `useQuery` mock implementations. Remove the unused `_args` parameter or replace with a proper no-arg signature that matches `useQuery` types.
   - Run `npm run lint` on the changed files and ensure zero errors.
   - Run `npm run typecheck` (`tsc -b`) and ensure zero errors.
   - Run targeted vitest tests for the three changed test files and ensure all pass.
   - Run the full `npm run test` with an extended timeout and report honest pass/fail. The suite is slow on this machine; run it in the background if needed and poll until completion.

Constraints: keep changes conservative, preserve existing flow/status guards/styling, follow project single-quote style, do not delete unrelated code, do not expose secrets.
**Plan mode:** codex
**Reviewers:** codex
**Result:** SUCCESS
**Converged:** True  **Final gate:** True
**Run dir:** C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260712_162926

## Stages
- {'stage': 'plan_codex', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'rc': 0}
- {'stage': 'implement', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postimpl', 'passed': True}
- {'stage': 'review_codex_iter1', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'CHANGES_REQUESTED'}
- {'stage': 'fix_iter1', 'backend': 'kimi', 'model': 'Kimi-k2.6 (default)', 'rc': 0}
- {'stage': 'gate_postfix1', 'passed': True}
- {'stage': 'review_codex_iter2', 'backend': 'codex', 'model': 'gpt-5.5 (default)', 'verdict': 'APPROVED'}
- {'stage': 'gate_final', 'passed': True}

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