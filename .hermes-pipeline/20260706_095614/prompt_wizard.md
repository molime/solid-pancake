You are implementing a single React component file. Produce ONLY a unified diff in git diff format. No explanations, no markdown fences. Diff must apply with git apply --whitespace=fix.

Repo root: C:/Users/pinol/Documents/Work/atriax/solid-pancake
Style: 2-space indent, single quotes, no semicolons. Use existing src/shared/ui/* components and @/shared/lib/cn. No new dependencies.

FIGMA SCREEN SPEC (relevant excerpts):
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


EXISTING FILES CONTEXT:
--- src/features/onboarding/model/trainingSteps.ts ---
export type TrainingStep = { id: string; title: string; body: string; minReadSeconds: number }

export const trainingSteps: TrainingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ATRIA-X',
    minReadSeconds: 45,
    body: `ATRIA-X is a care management platform built for home-care agencies and the people who make their work possible: caregivers, schedulers, and coordinators. It brings shift schedules, client notes, and compliance documents into one place so nothing falls through the cracks.

For caregivers, ATRIA-X means less paperwork and clearer expectations. For the agency, it means safer visits, reliable documentation, and the confidence that every shift is accounted for. The goal is simple: make shift documentation and compliance easy and reliable, so you can focus on the care you give.`
  },
  {
    id: 'shifts',
    title: 'Your shifts',
    minReadSeconds: 45,
    body: `Your assigned shifts live on the Today screen. Each card shows the client name, the scheduled time, and the location of the visit, so you know exactly where you need to be.

When you arrive, the flow is straightforward: mark At Location, then Clock In when the shift begins. While you work, keep the client's needs in mind, because before you Clock Out you will complete the documentation for the visit. This sequence keeps the visit safe, transparent, and fully recorded.`
  },
  {
    id: 'documenting',
    title: 'Documenting a shift',
    minReadSeconds: 45,
    body: `After clocking in, you will document the visit through a six-step wizard: When, What, How, Goal, Issues, and Done. When captures the time and location. What records the care provided. How describes the approach you used. Goal notes the client outcome you observed. Issues flags anything that needs follow-up. Done confirms the visit is complete.

Important: your notes must be complete before you clock out. The documentation is part of the shift, not an afterthought, and it protects both you and the client.`
  },
  {
    id: 'documents',
    title: 'Your documents and compliance',
    minReadSeconds: 45,
    body: `The Documents section is where you upload and track the certifications the agency needs on file. Common items include CPR, first aid, TB clearance, and background checks. Each document has an expiration date, and ATRIA-X warns you when something is about to expire.

Keeping credentials current is required to work shifts. If a certification lapses, the app will let you know, and you can upload the renewed document right away.`
  },
  {
    id: 'help',
    title: 'Getting help',
    minReadSeconds: 45,
    body: `If you have questions about a shift, a client, or the app, your coordinator is the first person to contact. They can adjust schedules, clarify documentation, and help with compliance items.

If the app itself is unavailable, contact the agency directly by phone so your shift is still documented. Remember that all notes are audited, so be accurate, honest, and timely in everything you record.`
  }
]


--- src/shared/ui/index.ts ---
export { Button } from './Button'
export { Badge } from './Badge'
export { Input } from './Input'
export { Textarea } from './Textarea'
export { Select } from './Select'
export { Card, CardHeader, CardTitle, CardContent } from './Card'
export { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from './Table'
export { Separator } from './Separator'
export { Checkbox } from './Checkbox'
export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './Dialog'
export { StatusBadge } from './StatusBadge'
export { KpiCard } from './KpiCard'
export { FieldGroup } from './FieldGroup'
export { ProgressSteps } from './ProgressSteps'
export { EmptyState } from './EmptyState'
export { Toast } from './Toast'


--- src/shared/ui/Button.tsx ---
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-atria-md)] px-4 text-base font-medium transition-colors disabled:pointer-events-none disabled:bg-atria-surface-2 disabled:text-atria-text-disabled disabled:border-atria-border disabled:opacity-100 focus:outline-none focus:ring-2 focus:ring-atria-accent/60 focus:ring-offset-2 focus:ring-offset-atria-bg',
  {
    variants: {
      variant: {
        primary:
          'rounded-full bg-atria-accent text-atria-on-accent hover:bg-atria-accent-hover',
        secondary:
          'border border-atria-border bg-atria-surface text-atria-ink hover:bg-atria-surface-2',
        danger:
          'bg-atria-danger text-white hover:bg-atria-danger/90',
        ghost:
          'text-atria-text-secondary hover:text-atria-ink hover:bg-atria-surface-2',
        sidebar:
          'justify-start rounded-[var(--radius-atria-md)] text-atria-sidebar-text hover:text-atria-sidebar-active hover:bg-white/5',
        sidebarActive:
          'justify-start rounded-[var(--radius-atria-md)] bg-white/10 text-atria-sidebar-active',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-[52px] px-6 text-base',
        icon: 'h-10 w-10 px-0',
        sidebar: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>
>

export function Button({
  children,
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles({ variant, size }), className)}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}


--- src/shared/lib/cn.ts ---
export { cn } from '@/shared/utils/cn'


--- src/index.css (tokens) ---
@import "tailwindcss";

@theme {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;

  /* Default mode: Dark. Source: design-system-tokens.md (v1). */
  --color-atria-bg: #0a0e0f;
  --color-atria-bg-sunken: #070a0b;
  --color-atria-surface: #11171a;
  --color-atria-surface-2: #161d21;
  --color-atria-surface-3: #1c262b;
  --color-atria-sidebar: #0c1113;
  --color-atria-ink: #f2f6f7;
  --color-atria-text-primary: #f2f6f7;
  --color-atria-text-secondary: #aebcc2;
  --color-atria-muted: #6e808a;      /* legacy alias; prefer --color-atria-text-muted */
  --color-atria-text-muted: #6e808a;
  --color-atria-text-disabled: #49575e;
  --color-atria-on-accent: #04140e;
  --color-atria-border: #2a373d;
  --color-atria-border-subtle: #1f2a2f;
  --color-atria-border-strong: #3a4a52;
  --color-atria-accent: #16a34a;
  --color-atria-accent-hover: #15833d;
  --color-atria-accent-quiet: rgba(22, 163, 74, 0.14);
  --color-atria-success: #2fbf71;
  --color-atria-success-bg: rgba(47, 191, 113, 0.14);
  --color-atria-warning: #f0b429;
  --color-atria-warning-bg: rgba(240, 180, 41, 0.14);
  --color-atria-danger: #f0564a;
  --color-atria-danger-bg: rgba(240, 86, 74, 0.14);
  --color-atria-info: #4d8df6;
  --color-atria-info-bg: rgba(77, 141, 246, 0.14);
  --color-atria-neutral: #8a99a0;
  --color-atria-neutral-bg: rgba(138, 153, 160, 0.12);
  --color-atria-sidebar-text: #aebcc2;
  --color-atria-sidebar-active: #f2f6f7;

  /* Step accents used by the Progress Note wizard. */
  --color-atria-step-when: #3b82f6;
  --color-atria-step-what: #a855f7;
  --color-atria-step-how: #f59e0b;
  --color-atria-step-goal: #14b8a6;
  --color-atria-step-issues: #ef4444;
  --color-atria-step-done: #16a34a;

  /* Radius scale. */
  --radius-atria: 8px;
  --radius-atria-sm: 8px;
  --radius-atria-md: 12px;
  --radius-atria-lg: 16px;
  --radius-atria-xl: 20px;
  --radius-atria-pill: 999px;

  /* Sizing / touch targets. */
  --size-control-md: 40px;
  --size-control-lg: 52px;
  --size-tile: 88px;
  --size-sidebar: 248px;
  --size-topbar: 64px;
  --size-kpi-card: 140px;
  --size-avatar: 36px;

  /* Elevation. */
  --shadow-atria-card: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-atria-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
}

:root {
  color: var(--color-atria-ink);
  background: var(--color-atria-bg);
  font-size: 16px;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100svh;
  font-family: var(--font-sans);
  letter-spacing: 0;
}

button,
input,
textarea,
select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

/* Scrollbar styling (dark mode default). */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-atria-border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover

--- src/app/providers.tsx ---
import { ClerkProvider, useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithAuth } from 'convex/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useRef } from 'react'

const ClerkProviderFromEnv = ClerkProvider as unknown as (
  props: PropsWithChildren & {
    publishableKey?: string
    routerPush?: (to: string) => void
    routerReplace?: (to: string) => void
    signInUrl?: string
    signUpUrl?: string
    signInFallbackRedirectUrl?: string
    signUpFallbackRedirectUrl?: string
  },
) => ReactElement

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? 'https://tidy-crocodile-154.convex.cloud',
)

/** Clerk + Convex auth adapter using the default Clerk session token.
 *
 *  Fetches the default token (not a named template) and forces a refresh
 *  when the active organization changes so Convex receives the new org
 *  claims immediately.
 */
function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth()
  const lastFetchedOrgIdRef = useRef<string | null | undefined>(undefined)

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const orgChanged = lastFetchedOrgIdRef.current !== orgId
      if (orgChanged) {
        lastFetchedOrgIdRef.current = orgId
      }
      try {
        retur


TASK:
Create src/features/onboarding/components/PlatformTrainingWizard.tsx.
It is a full-screen page (no sidebar, logo at top). Use useLocation and useNavigate from react-router-dom. Use useUser from @clerk/react for user info. Use useOrganization from @clerk/react for clerkOrgId. Use useQuery and useMutation from convex/react.
Import trainingSteps from ../model/trainingSteps.
Import completePlatformTraining from the convex api path: api.onboarding.completePlatformTraining.
Use role from a prop role: "org:candidate" | "org:caregiver".
Component state: currentStep (0..4), scrollProgress (0..100), secondsRemaining (starts at trainingSteps[currentStep].minReadSeconds and counts down to 0 using useEffect + setInterval, resets when currentStep changes), isCompleting boolean.
Refs: contentRef for the scrollable div. On scroll, compute scrollProgress = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)).
Top: render a centered ATRIA-X logo text or an SVG placeholder. Below: "Step {currentStep + 1} of 5" and a thin progress bar width={(currentStep + 1) / 5 * 100}%.
Content area: fixed height h-[380px] or similar, overflow-y-auto, bg surface. Title text-2xl font-bold. Body split into paragraphs by double newline and render as <p> elements.
Below content: thin bar width={scrollProgress}%, label "Scroll to read" or green "Read ✓" when scrollProgress===100.
Countdown text: "{secondsRemaining} seconds remaining" in gray until 0, then green.
Bottom buttons: Back hidden when currentStep===0, else enabled. Next/Complete button disabled unless scrollProgress===100 AND secondsRemaining===0; disabled style opacity-35 pointer-events-none; enabled style primary green. Final step label "Complete training". On click: setIsCompleting(true); call completePlatformTraining({clerkOrgId}); on success navigate(role === "org:candidate" ? "/onboarding" : "/caregiver/today").
Use Tailwind arbitrary colors for exact dark tokens: bg-[#0B0F10], text-[#F5F7F6], surface bg-[#11171A], green text-[#22C55E] and bg-[#22C55E], gray text-[#9AA6A8] / text-[#687173], border-[#2A3437].
Do not import a real logo image; render a text logo.
Output only the diff for this single new file (--- /dev/null, +++ b/src/features/onboarding/components/PlatformTrainingWizard.tsx).
