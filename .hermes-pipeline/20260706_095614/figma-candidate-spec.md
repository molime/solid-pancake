# ATRIA-X Candidate Portal — Figma Screen Spec

Run directory: `C:/Users/pinol/Documents/Work/atriax/solid-pancake/.hermes-pipeline/20260706_095614`
Exported PNGs: `figma/`

## Ground tokens (from DS — Foundations / inspector + frames)
- Surface 0 (page bg): `#0B0F10`
- Surface 1 / card bg: `#11171A` (closest matching dark card fill; the spec references `#151B1D` for some cards)
- Surface input: `#1E2629`
- Border default: `#2A3437`
- Border green: `#22C55E` (green-500)
- Text primary: `#F5F7F6`
- Text secondary: `#9AA6A8`
- Text muted: `#687173`
- Accent green: `#22C55E`
- Accent amber: `#F59E0B`
- Accent red: `#EF4444`
- Font: Inter, sans-serif
- Border radius: 8px (checkbox), 9px (logo), 10px (inputs), 12px (small cards), 14-16px (pills), 20px (hero cards), 26-28px (buttons), 40px (avatar)
- Touch min 44px, type 13px+ labels, 14-16px body, 17-18px lead, 20-26px headings

## Frame inventory
| Screen | Frame ID | PNG |
|---|---|---|
| Candidate / Application Entry | `157:682` | `figma/Candidate_Application_Entry.png` |
| Candidate / Application Form | `189:2287` | `figma/Candidate_Application_Form.png` |
| Candidate / Application Status | `150:169` | `figma/Candidate_Application_Status.png` |
| Candidate / Onboarding Checklist | `157:832` | `figma/Candidate_Onboarding_Checklist.png` |
| Candidate / Document Upload | `157:860` | `figma/Candidate_Document_Upload.png` |
| Candidate / Acknowledgment Task | `158:905` | `figma/Candidate_Acknowledgment_Task.png` |
| Candidate / Offer & Acceptance | `158:879` | `figma/Candidate_Offer_Acceptance.png` |
| Candidate / Profile View-Edit | `162:1395` | `figma/Candidate_Profile_View_Edit.png` |
| Training Step — Locked | `298:2` | `figma/Candidate_Training_Step_Locked.png` |
| Training Step — Unlocked | `298:3` | `figma/Candidate_Training_Step_Unlocked.png` |
| Training Step — Complete | `298:4` | `figma/Candidate_Training_Step_Complete.png` |

## (1) Application Entry (`157:682`) — /onboarding/application-entry? optional landing
- Mobile frame 390x844, bg `#0B0F10`.
- Top: 36x36 green `#22C55E` rounded logo with bold dark "A" + wordmark "ATRIA-X" 18px bold primary.
- Headline: "Start your application 👋" 26px bold primary.
- Sub: "Fill in the details below. It takes about 5 minutes." 16px secondary.
- Form labels (uppercase 13px semi-bold muted `#687173`): FULL NAME, EMAIL ADDRESS, PHONE NUMBER, POSITION APPLYING FOR.
- Inputs: 342x52, radius 10, bg `#1E2629`, border default except focused/active green. Placeholder secondary.
- Autosave pill: "✓ All changes saved" green text on surface-1 bg, radius 16.
- Primary CTA: 342x56, radius 28, green fill, dark text "Submit application →" 17px bold.
- Footer: privacy line muted, "Already applied? Check your status →" green link.
- **Implementation note:** The task description narrows this to `ApplicationFormPage.tsx` at `/onboarding/application` with fields: Full name (readonly, prefilled), Email (prefilled), Phone (editable), Prior home care experience (textarea), Why you want to join (textarea), Emergency contact name + phone. Use the Form screen tokens. Position field from the Figma is omitted per task.

## (2) Application Form (`189:2287`) — canonical /onboarding/application
- Mobile frame 390x844, bg `#0B0F10`.
- Top left: "← Back" 14px semi-bold green. Top right: 36x36 green logo.
- Title: "Your Application" 26px bold primary.
- Subtitle / section: "Section 1 of 3 — Personal Information" 15px secondary. **Task narrows to single-section form**, but keep progress-bar visual language if relevant.
- Progress track: 342x8, bg `#1E2629`, radius 4; fill green `#22C55E` at 1/3 width.
- Labels uppercase 13px muted, inputs bg `#1E2629`, border default, radius 10, 342x52.
- Readonly prefilled name uses primary text; editable placeholders use secondary.
- Textareas should be taller (min 96px) with same surface/border styling.
- CTA row: Back outline 110x56 radius 28 + Next green 210x56 radius 28.
- **Task fields:** Full name readonly, Email readonly, Phone editable, Prior home care experience textarea, Why you want to join textarea, Emergency contact name + phone.
- **State / behavior:** Inline validation for required fields. Submit calls `submitApplication({ fields: { phone, experience, motivation, emergencyName, emergencyPhone } })`, on success navigate to `/onboarding/status`.

## (3) Application Status (`150:169`) — /onboarding/status
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Greeting: "Hi Lucía 👋" 26px bold primary.
- Sub: "Here's where your application stands." 16px secondary.
- Status card: 342x110, radius 20, amber surface (opacity 0.16) with amber border, inner label "CURRENT STATUS" 13px bold amber, status "Under review" 22px bold primary, subline secondary 14px.
- Progress tracker: vertical timeline with 24px dots on a 2px line (`#2A3437`).
  - Completed stages: green dot with dark "✓", title primary, subtitle secondary.
  - Current stage: amber dot, title amber.
  - Future stages: gray dot `#2A3437`, title muted.
- Stages (task-mandated 5): 'Applied' (always complete once submitted), 'Under review', 'Decision made', 'Offer', 'Accepted'.
- Highlight current stage from `getCandidateProfile` status.
- If status is `needs_correction`, show amber banner: "Your application needs some corrections — please review and resubmit." with link back to `/onboarding/application`.
- CTA: green 342x56 radius 28 (e.g., "View my documents") + help link.

## (4) Onboarding Checklist (`157:832`) — /onboarding
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Headline: "Your onboarding checklist" 26px bold primary.
- Sub: "Complete these before your first shift." 15px secondary.
- Progress track 342x8 bg `#1E2629`, fill green; label "N of 5 tasks complete" 13px semi-bold green.
- Task list: rows with 32x32 checkbox/status square left (radius 8), title 16px, optional due subline 13px secondary.
  - Completed: green checkbox with dark "✓", title primary.
  - In progress: amber surface/border checkbox, title amber + due subline.
  - Pending: surface `#1E2629` border `#2A3437` empty checkbox, title secondary.
- CTA at bottom: green 342x56 radius 28 "Next task label →".
- Help link: "Need help? Contact your recruiter →" green 15px medium.
- **Task behavior:** Fetch `listCandidateTasks`. Render task cards with title, `StatusBadge` (Pending / In progress / Completed — color + word), and CTA button:
  - pending → "Start"
  - in_progress → "Continue"
  - completed → "✓ Done" (no action)
  - Route per kind:
    - `form_submission` → `/onboarding/application`
    - `document_upload` → `/onboarding/upload/:taskId`
    - `acknowledgment` → `/onboarding/acknowledgment`
    - `platform_training` → `/onboarding/training`
- When all required tasks complete, show green success banner: "Your profile is ready for review".

## (5) Document Upload (`157:860`) — /onboarding/upload/:taskId
- Mobile frame, bg `#0B0F10`.
- Top: "← Back to checklist" 14px green.
- Title: task title (e.g., "Upload CPR certificate") 26px bold primary.
- Sub: "We accept JPG, PNG, or PDF. Max 10MB." 15px secondary.
- Drop zone: 342x200, bg `#1E2629`, border green dashed, radius 16, centered "📄" 40px + "Tap to choose a file" 16px semi-bold primary + "or take a photo with your camera" 14px secondary.
- Preview card (after select/upload): 342x72, bg green opacity 0.12, border green, radius 12, left "📄" green, file name primary 15px semi-bold, meta secondary 13px, right red "✕".
- Expiry field label "CERTIFICATE EXPIRY DATE" uppercase muted, input `#1E2629` border default, radius 10.
- Footer note: "Your documents are encrypted and only seen by your recruiter." 13px muted.
- Submit CTA: green 342x56 radius 28 "Submit document".
- **Task behavior:** On file select, upload via Convex `generateUploadUrl` + HTTP POST, then `addCandidateDocument`. On success show preview card with "Uploaded ✓", then navigate back to `/onboarding` after a moment.

## (6) Acknowledgment Task (`158:905`) — /onboarding/acknowledgment
- Mobile frame, bg `#0B0F10`.
- Top: "← Back to checklist" 14px green.
- Title: "Read & confirm" 24px bold primary. Subtitle: "HIPAA Privacy & Confidentiality Policy" 15px secondary.
- Document card: 342x360, bg `#151B1D`, border `#2A3437`, radius 16, scrollable, with 3 numbered sections:
  - Section titles 15px bold primary.
  - Body 14px secondary, line-height ~1.21.
- Scroll hint: "↓ Scroll to read the full document" 12px muted.
- Checkbox row: 32x32 green surface/border checkbox with green "✓" when checked, label "I have read and understood this policy" 15px medium primary.
- Signature note: "Your digital signature and timestamp will be recorded." 13px muted (or "Your name serves as your electronic signature.")
- Confirm CTA: 342x56 green radius 28 "Confirm & sign", disabled until checkbox ticked.
- **Task behavior:** On submit call `submitForm` with hardcoded HIPAA form definition. On success navigate to `/onboarding`.

## (7) Offer & Acceptance (`158:879`) — /onboarding/offer
- Mobile frame, bg `#0B0F10`.
- Top: green logo + "ATRIA-X" wordmark.
- Offer hero card: 342x148, bg green opacity 0.12, border green, radius 20.
  - "🎉 YOU HAVE AN OFFER!" 13px bold green.
  - Position "Home Care Aide" 22px bold primary.
  - Agency + location 15px secondary.
  - "Offer expires Jun 24, 2026" 13px secondary.
- Offer details card: 342x248, bg `#151B1D`, border `#2A3437`, radius 16, rows separated by 1px `#2A3437` dividers.
  - Labels uppercase 13px muted; values 17px semi-bold primary; pay rate value in green.
- Accept CTA: 342x56 green radius 28 "✓ Accept this offer".
- Decline CTA: 342x52 surface `#1E2629` border `#2A3437` radius 26, text secondary "No thanks, decline this offer".
- Footer note: "By accepting you agree to the employment terms above." 13px muted.
- **Task behavior:** Accept calls `acceptOffer`, decline calls `rejectOffer`. On accept navigate to `/onboarding/status` with Accepted stage highlighted. Show agency name, position Caregiver, start date from candidate `invitedAt` or TBD, compensation placeholder.

## (8) Profile View-Edit (`162:1395`) — /onboarding/profile
- Mobile frame, bg `#0B0F10`.
- Top: "← Back" 14px green left, "My Profile" 20px bold primary, "Edit" outline button 80x36 radius 18 right.
- Avatar: 80x80 circle (radius 40), green `#16A34A` bg, dark bold initials 28px.
- Name: 22px bold primary.
- Sub: "Applying: Home Care Aide" 15px secondary (use current role/status label).
- Status pill: amber surface opacity 0.16, radius 14, amber dot text "● Screening stage" 13px semi-bold.
- Divider 1px `#2A3437`.
- Read-only rows: label uppercase 13px muted, value 16px medium primary. Rows: FULL NAME, EMAIL, PHONE, YEARS OF EXPERIENCE, AVAILABILITY. **Task narrows edit to PHONE only**; other fields read-only.
- Edit mode: show phone input with same surface/border styling, Save green button.
- Footer hint: "Need to update something? Tap Edit above →" green 14px.
- Data from `getCandidateProfile` / Clerk user: avatar initials from displayName, name, email, phone, start date (createdAt), status badge.

## (9) Platform Training Wizard (`298:2`, `298:3`, `298:4`) — /onboarding/training
- Full-screen page, no sidebar. Logo at top. Mobile-first 390px.
- Frame bg `#0B0F10`.
- Step label: "Step N of 5" 14px semi-bold secondary `#9AA6A8`.
- Progress bar: 342x4, bg `#293429` (or `#1E2629`), fill green `#22C55E`, proportional to completed steps (step 2 = 40%, step 5 = 100%).
- Step title: 26px bold primary, e.g. "Your shifts" / "Getting help".
- Content area: framed card bg `#15251A` (green-tinted surface) with border `#2E3833`, radius 12, fixed height ~380px (≈45% of 844 viewport), scrollable.
- Body text: 15px regular secondary `#9AA6A8`, paragraph spacing, left-aligned.
- Scroll progress bar below content: 342x4 bg `#293429`, fill green, grows 0%→100% with scroll.
- Scroll hint: "Scroll to read" 13px secondary when not bottom; "Read ✓" 13px semi-bold green when at bottom.
- Countdown timer: "XX seconds remaining" 14px secondary while >0; "0 seconds remaining" green semi-bold when 0. Counts down from `minReadSeconds` (45s per step) after step renders; does not pause on scroll.
- Next button: 342x52, radius 26.
  - Disabled until BOTH scrolled to bottom AND timer reaches 0: fill green at 35% opacity, text dark at 50% opacity, label "Next →".
  - Enabled: full green fill, dark bold text "Next →".
- On final step label becomes "Complete training →". On click call `completePlatformTraining` mutation; show loading state on button. On success navigate to `/onboarding` for candidates or `/caregiver/today` for caregivers.
- Back link: "← Back" 14px green, always visible and enabled except on step 1 where it is hidden or shows "Exit".

## State / interaction summary for wizard
- `scrollProgress`: 0–100 derived from content scrollTop vs scrollHeight-clientHeight.
- `secondsRemaining`: counts from `minReadSeconds` down to 0 using `setInterval`, reset on step change, never pauses.
- `nextDisabled = scrollProgress < 100 || secondsRemaining > 0`.
- Final step button label: "Complete training →".

## Router / shell requirements
- Add `/onboarding/*` routes gated to `org:candidate` except `/onboarding/training` which also allows `org:caregiver`.
- Pages: `/onboarding`, `/onboarding/application`, `/onboarding/status`, `/onboarding/upload/:taskId`, `/onboarding/acknowledgment`, `/onboarding/offer`, `/onboarding/profile`, `/onboarding/training`.
- Add `TrainingGate` in `AppShell.tsx` (or new `TrainingGate.tsx`): after tenant/role resolved, if role is `org:caregiver` OR `org:candidate`, call `hasPlatformTrainingCompleted`. If loading show `AppLoader`. If false and path not `/onboarding/training`, render `<Navigate replace to='/onboarding/training' />`. Otherwise render children.
- Update `Sidebar.tsx` so candidate role sees onboarding nav items only.

## Implementation files
- `src/features/onboarding/model/trainingSteps.ts`
- `src/features/onboarding/components/PlatformTrainingWizard.tsx`
- `src/app/shell/TrainingGate.tsx` (or inline in `AppShell.tsx`)
- `src/features/onboarding/pages/CandidateOnboardingPage.tsx`
- `src/features/onboarding/pages/ApplicationFormPage.tsx`
- `src/features/onboarding/pages/ApplicationStatusPage.tsx`
- `src/features/onboarding/pages/DocumentUploadPage.tsx`
- `src/features/onboarding/pages/AcknowledgmentPage.tsx`
- `src/features/onboarding/pages/OfferAcceptancePage.tsx`
- `src/features/onboarding/pages/CandidateProfilePage.tsx`
- `src/app/router.tsx`
- `src/app/shell/Sidebar.tsx`
- Tests alongside each new component/page.

## Style rules
- Single quotes, no semicolons, 2-space indent.
- Use existing `src/shared/ui/*` components + `@/shared/lib/cn`.
- Map all idioms to shared UI primitives; no new dependencies.
- Touch targets ≥44px; type ≥16px body where possible, labels ≥13px.

## Gates
- `npm run lint`
- `npm run typecheck`
- `npm run test` (new tests must pass)
- `npm run build`
- `npm run e2e` (if live Clerk credentials present; otherwise may be red — report honestly)
