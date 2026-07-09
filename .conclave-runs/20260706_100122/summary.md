# Conclave run summary
- project: atriax
- result: **UNKNOWN** _(in progress)_
- run dir: C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260706_100122
- task: ATRIA-X frontend — Session 6: Candidate portal + platform training wizard, pixel-faithful to Figma candidate frames. Mobile-first throughout. Repo: C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake. Branch: feature/phase-2-worker-onboarding.

Ground truth: exported Figma PNGs in `.hermes-pipeline/20260706_095614/figma/` and the precise screen spec in `.hermes-pipeline/20260706_095614/figma-candidate-spec.md`. Read both before writing any UI.

HARD CONSTRAINTS:
- Single quotes, no semicolons, 2-space indent.
- Use existing `src/shared/ui/*` components + `@/shared/lib/cn`. No new dependencies.
- Touch targets >=44px, 16px+ body type.
- Mobile-first (390px primary), dark tokens: bg `#0B0F10`, surface `#11171A`/`#151B1D`, input `#1E2629`, border `#2A3437`, green `#22C55E`, amber `#F59E0B`, red `#EF4444`, text primary `#F5F7F6`, secondary `#9AA6A8`, muted `#687173`.
- Do NOT edit `convex/_generated` by hand; run `npx convex codegen` only if schema/convex changes occur. Backend mutations already exist; wire to them.
- This is Session 6 of Phase 2. Work on the existing branch `feature/phase-2-worker-onboarding`; do not create a new branch.
- Pixel-perfect Figma match is the #1 acceptance gate.

DELIVERABLES:
(1) Create `src/features/onboarding/model/trainingSteps.ts`:
Export an array of 5 TrainingStep objects:
type TrainingStep = { id: string; title: string; body: string; minReadSeconds: number }
Steps:
1 id:'welcome' title:'Welcome to ATRIA-X' minReadSeconds:45 body: ~200 words describing ATRIA-X as a care management platform, users (caregivers, coordinators, agency), purpose (simple shift documentation and compliance).
2 id:'shifts' title:'Your shifts' minReadSeconds:45 body: ~200 words about Today screen, client name/time/location, At Location -> Clock In -> Document -> Clock Out flow.
3 id:'documenting' title:'Documenting a shift' minReadSeconds:45 body: ~200 words about 6-step wizard (When/What/How/Goal/Issues/Done), complete notes before clocking out.
4 id:'documents' title:'Your documents & compliance' minReadSeconds:45 body: ~200 words about Documents section, uploading certifications, expiration warnings, credentials required to work.
5 id:'help' title:'Getting help' minReadSeconds:45 body: ~150 words about coordinator contact, app unavailable procedure, notes audited.

(2) Create `src/features/onboarding/components/PlatformTrainingWizard.tsx`:
Full-screen page, no sidebar, logo at top. 390px mobile primary.
- Step indicator at top: 'Step N of 5' with thin progress bar filling proportionally to completed steps.
- Content area: step title large bold, body paragraphs in scrollable fixed-height div (~380px / ~45% viewport).
- Scroll progress indicator: thin horizontal bar below content fills 0%->100% with scroll; label 'Scroll to read' when not bottom, 'Read ✓' green when at bottom.
- Countdown timer below: 'XX seconds remaining' counting down from minReadSeconds to 0 after step renders; does NOT pause when scrolling.
- Next button: disabled (opacity 35%, not clickable) until BOTH scrollProgress=100% AND timer=0. Enabled: full primary green. Back button always visible/enabled except step 1 where hidden or shows 'Exit'. Final step replaces 'Next' with 'Complete training'. On complete call `completePlatformTraining` mutation; on success navigate to `/onboarding` for candidate or `/caregiver/today` for caregiver. Loading state on button during mutation.
- Use dark tokens from spec.

(3) Add training gate in `src/app/shell/AppShell.tsx` (or new `TrainingGate.tsx`):
After tenant and role resolved (`userTenantRole` known), if role is 'org:caregiver' OR 'org:candidate', call `hasPlatformTrainingCompleted`. If loading show `AppLoader`. If false AND current path is not already `/onboarding/training`, render `<Navigate replace to='/onboarding/training' />`. If true, render children normally.

(4) `CandidateOnboardingPage.tsx` — /onboarding route, org:candidate only.
Matches Figma Onboarding Checklist exactly. Header 'Your onboarding checklist'. Query `listCandidateTasks`; render vertical list of task cards with title, StatusBadge (Pending gray / In progress amber / Completed green), CTA button: 'Start' (pending), 'Continue' (in_progress), '✓ Done' (completed, no action). Button routes per task kind: form_submission -> /onboarding/application, document_upload -> /onboarding/upload/:taskId, acknowledgment -> /onboarding/acknowledgment, platform_training -> /onboarding/training. Progress summary at top: 'N of 5 tasks complete'. When all required tasks complete, show green success banner 'Your profile is ready for review'.

(5) `ApplicationFormPage.tsx` — /onboarding/application, org:candidate only.
Matches Figma Application Form. Fields: Full name (readonly, prefilled from candidate profile), Email (prefilled), Phone number (editable), Prior home care experience (textarea), Why you want to join (textarea), Emergency contact name + phone. Dark tokens. Submit calls `submitApplication({ fields: { phone, experience, motivation, emergencyName, emergencyPhone } })`. On success navigate to /onboarding/status. Inline validation for required fields.

(6) `ApplicationStatusPage.tsx` — /onboarding/status, org:candidate only.
Matches Figma Application Status. Progress tracker with 5 stages (icon+label): 'Applied' (always complete once submitted), 'Under review', 'Decision made', 'Offer', 'Accepted'. Highlight current stage from `getCandidateProfile` status. If status is 'needs_correction', show amber banner 'Your application needs some corrections — please review and resubmit.' with link back to /onboarding/application.

(7) `DocumentUploadPage.tsx` — /onboarding/upload/:taskId, org:candidate only.
Matches Figma Document Upload. Show task title from `listCandidateTasks` (find by taskId). Drag-and-drop or file input styled dark tokens, green dashed border. On file select: upload via Convex `generateUploadUrl` + HTTP POST, then `addCandidateDocument({ clerkOrgId, fileId, documentType: task.type, label: task.title, expiresAt })`. On success show preview card (name + size + green 'Uploaded ✓'), navigate back to /onboarding after a moment.

(8) `AcknowledgmentPage.tsx` — /onboarding/acknowledgment, org:candidate only.
Matches Figma Acknowledgment Task. Title 'HIPAA Privacy Policy'. Scrollable document card with 3 numbered placeholder sections of HIPAA policy text, scroll hint at bottom. Checkbox 'I have read and understand this policy'. Signature note 'Your name serves as your electronic signature.' 'Confirm & sign' primary button disabled until checkbox ticked. On submit: find or create a formDefinition named 'HIPAA Acknowledgment' (use `listFormDefinitions` then `createFormDefinition` if missing), then `submitForm({ formDefinitionId, data: { acknowledged: true } })`. On success navigate to /onboarding.

(9) `OfferAcceptancePage.tsx` — /onboarding/offer, org:candidate only.
Matches Figma Offer & Acceptance. Offer letter: agency name, position 'Caregiver', start date from candidate `invitedAt` or TBD, compensation placeholder. Two buttons: 'Accept offer' primary green (calls `acceptOffer`) and 'Decline' outline red (calls `rejectOffer`). On accept navigate to /onboarding/status with Accepted stage highlighted.

(10) `CandidateProfilePage.tsx` — /onboarding/profile, org:candidate only.
Matches Figma Candidate Profile View-Edit. Avatar (initials from displayName), name, email, phone, start date (createdAt), status badge. Edit mode for phone only (rest read-only for candidate).

ROUTER/SIDEBAR:
- Update `src/app/router.tsx`: add all `/onboarding/*` routes gated to org:candidate except `/onboarding/training` which also allows org:caregiver.
- Update `Sidebar.tsx`: candidate role sees onboarding nav items only (Onboarding checklist, Training, Profile, etc.; hide admin/coordinator/caregiver nav).

TESTS:
- PlatformTrainingWizard renders; Next disabled before scroll+timer; Next enables after both; completePlatformTraining called on finish; gate redirects when not completed.
- CandidateOnboardingPage renders tasks and correct CTAs.
- ApplicationFormPage submits correctly.
- DocumentUploadPage calls addCandidateDocument on success.

GATES: lint, typecheck, test, build green. E2E honest (may be red without Clerk credentials; report if so). Do not stop until lint/typecheck/test/build are green.


## Stages
- {'stage': 'plan', 'how': 'synthesized by c_plan_agentic', 'chars': 28168, 'elapsed_s': 505.9}
- {'stage': 'implement', 'ok': False, 'elapsed_s': 16.3}

## Stage timing
| Stage | Elapsed (s) |
|---|---|
| plan | 505.9 |
| implement | 16.3 |
| **TOTAL** | **522.2** |