# http://localhost:11434/api/chat
# model=qwen3.5:cloud status=200

# Implementation Plan: ATRIA-X Session 6 (Candidate Portal + Training Wizard)

## 1. Restated Goal & Acceptance Criteria

**Goal:** Implement the Phase 2 Worker Onboarding flow for `org:candidate` and `org:caregiver` roles, featuring a gated Platform Training Wizard and a comprehensive Candidate Onboarding Checklist. All UI must be pixel-faithful to Figma, mobile-first, and use dark tokens.

**Acceptance Criteria:**
- **AC-1 (Training Model):** `trainingSteps.ts` exports 5 steps with exact IDs, titles, and `minReadSeconds` (45s each, except Help 45s).
- **AC-2 (Training Wizard):** `PlatformTrainingWizard.tsx` enforces scroll-to-bottom + timer countdown before enabling 'Next'. Final step calls `completePlatformTraining`.
- **AC-3 (Training Gate):** `AppShell` or `TrainingGate` redirects `org:caregiver`/`org:candidate` to `/onboarding/training` if `hasPlatformTrainingCompleted` is false.
- **AC-4 (Onboarding Checklist):** `CandidateOnboardingPage` displays tasks from `listCandidateTasks` with correct status badges and CTAs routing to specific sub-pages.
- **AC-5 (Application Flow):** `ApplicationFormPage` submits to `submitApplication`; `ApplicationStatusPage` reflects `getCandidateProfile` status with stage tracker.
- **AC-6 (Document Upload):** `DocumentUploadPage` handles file pick -> `generateUploadUrl` -> POST -> `addCandidateDocument`.
- **AC-7 (HIPAA Ack):** `AcknowledgmentPage` enforces scroll + checkbox, creates/uses 'HIPAA Acknowledgment' form definition, submits via `submitForm`.
- **AC-8 (Offer):** `OfferAcceptancePage` allows accept/decline via `acceptOffer`/`rejectOffer`.
- **AC-9 (Profile):** `CandidateProfilePage` allows phone edit, read-only rest.
- **AC-10 (Routing/Sidebar):** `router.tsx` gates `/onboarding/*` to candidates (except training); `Sidebar.tsx` hides non-candidate nav items.
- **AC-11 (Quality):** Lint, typecheck, test, build green. Mobile-first (390px), dark tokens, 2-space indent, single quotes, no semicolons.

## 2. Discovery Notes

**Limitation:** I am a chat-based AI and **cannot inspect the local repository** at `C:\\Users\\pinol\\Documents\\Work\\atriax\\solid-pancake`. I am reasoning from the provided task spec, shared memory context, and standard React19+Convex patterns.

**Assumptions based on Task Spec:**
- **Convex Schema:** Functions `completePlatformTraining`, `hasPlatformTrainingCompleted`, `listCandidateTasks`, `submitApplication`, `getCandidateProfile`, `generateUploadUrl`, `addCandidateDocument`, `listFormDefinitions`, `createFormDefinition`, `submitForm`, `acceptOffer`, `rejectOffer` exist in `convex/`.
- **UI Libs:** `src/shared/ui/*` contains primitives (Button, Input, Card, Badge) compatible with Tailwind4. `@/shared/lib/cn` exists for class merging.
- **Auth:** Clerk context (`useAuth`, `useUser`) is available. `userTenantRole` is resolved in a hook or context before `AppShell` renders.
- **Routing:** React Router 7 is used (`createBrowserRouter` or file-based).
- **State:** No global state manager (Redux/Zustand) mentioned; using React state + Convex hooks.

**Risk:** If Convex function signatures differ from assumptions, implementation will fail typecheck. Implementer must verify `convex/` function args before wiring.

## 3. Alternatives Considered

| Decision | Alternative | Chosen Approach | Rationale |
| :--- | :--- | :--- | :--- |
| **Training Gate** | HOC around each route | `AppShell` wrapper / Router Guard | Centralized control prevents route bypass; simpler to maintain than decorating 10+ routes. |
| **Wizard State** | URL params (`?step=1`) | Local Component State | Wizard is linear and transient; URL state adds complexity for scroll/timer sync without benefit. |
| **File Upload** | Direct to S3 | Convex `generateUploadUrl` | Task explicitly specifies Convex storage flow; ensures tenancy/audit trail in DB. |
| **HIPAA Form** | Hardcoded text | Dynamic Form Definition | Task requires finding/creating `formDefinition`; allows future updates without code deploys. |
| **Styling** | CSS Modules | Tailwind4 + `cn` | Repo standard; faster iteration; dark tokens easily applied via utility classes. |

## 4. Files to Create/Modify

| File | Change Type | What Changes |
| :--- | :--- | :--- |
| `src/features/onboarding/model/trainingSteps.ts` | Create | Export `TrainingStep[]` with 5 hardcoded steps. |
| `src/features/onboarding/components/PlatformTrainingWizard.tsx` | Create | Full-screen wizard logic, scroll/timer gates, Convex mutation. |
| `src/app/shell/AppShell.tsx` | Modify | Inject `TrainingGate` logic after role resolution. |
| `src/features/onboarding/pages/CandidateOnboardingPage.tsx` | Create | Task list map, progress summary, status banner. |
| `src/features/onboarding/pages/ApplicationFormPage.tsx` | Create | Form with validation, `submitApplication` call. |
| `src/features/onboarding/pages/ApplicationStatusPage.tsx` | Create | 5-stage tracker, `needs_correction` banner. |
| `src/features/onboarding/pages/DocumentUploadPage.tsx` | Create | Drag-drop UI, upload flow, preview card. |
| `src/features/onboarding/pages/AcknowledgmentPage.tsx` | Create | Scrollable policy, checkbox, form definition logic. |
| `src/features/onboarding/pages/OfferAcceptancePage.tsx` | Create | Offer details, Accept/Decline buttons. |
| `src/features/onboarding/pages/CandidateProfilePage.tsx` | Create | Profile view, phone edit form. |
| `src/app/router.tsx` | Modify | Add `/onboarding/*` routes, apply role guards. |
| `src/app/layout/Sidebar.tsx` | Modify | Conditional rendering for candidate nav items. |
| `convex/` (any) | Verify | Run `npx convex codegen` if schema touched (task says mutations exist). |

## 5. Data/Auth/Security/Edge Cases

- **Multi-tenancy:** All Convex calls must rely on backend `authHelpers` guards. Frontend should not pass `orgId` explicitly if backend infers it from Clerk token.
- **PHI/Compliance:** HIPAA acknowledgment must be immutable once signed. `AcknowledgmentPage` must prevent re-submission if already signed (check `listCandidateTasks` status).
- **Training Gate Loop:** Ensure `hasPlatformTrainingCompleted` doesn't cause infinite redirect loop if loading state isn't handled. Show `AppLoader` while checking.
- **File Upload Race:** User might navigate away during upload. Disable navigation during `POST` to `generateUploadUrl` target.
- **Timer Sync:** Training timer must not reset on re-render. Use `useRef` for timer ID and `Date.now()` for drift correction.
- **Scroll Detection:** `onScroll` events can be noisy. Throttle or use CSS `scrollend` (if supported) or simple `scrollTop + clientHeight >= scrollHeight` check.
- **Mobile Viewport:** 390px width simulation. Ensure `100dvh` is used for full-screen wizard to avoid mobile browser chrome issues.

## 6. Test Strategy

**Unit/Component:**
- `PlatformTrainingWizard`: Mock scroll container. Verify 'Next' is disabled at t=0 and scroll=0. Enable at t=0 and scroll=100%.
- `CandidateOnboardingPage`: Mock `listCandidateTasks`. Verify correct button label ('Start' vs 'Continue') per status.

**Integration:**
- `ApplicationFormPage`: Mock `submitApplication`. Verify payload structure matches Convex schema.
- `DocumentUploadPage`: Mock `generateUploadUrl`. Verify file POST and `addCandidateDocument` call sequence.

**E2E (Playwright):**
- **Flow:** Login as candidate -> Land on Training -> Complete Training -> Redirect to Onboarding -> Complete Application -> Upload Doc -> Sign HIPAA -> Accept Offer.
- **Gate:** Login as caregiver (no training) -> Attempt to access `/caregiver/today` -> Redirect to `/onboarding/training`.
- **Visual:** Snapshot test `PlatformTrainingWizard` at Step 1 vs Step 5 against Figma exports.

**Gate Commands:**
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7. Rollback / Verification Notes

- **Rollback:** Revert branch `feature/phase-2-worker-onboarding` to previous commit. No DB migration needed (backend mutations pre-exist).
- **Verification:**
  1. Confirm `npx convex codegen` runs without error after checkout.
  2. Verify dark tokens render correctly on physical mobile device or Chrome DevTools Device Mode (390x844).
  3. Check Network tab for 401/403 on Convex calls (ensures auth guards working).
  4. Confirm `memory.json` (agent memory) is not touched by this change (frontend only).

---
**Implementer Note:** Adhere strictly to `2-space indent`, `single quotes`, `no semicolons`. Do not edit `convex/_generated`. If Convex schema changes are discovered during wiring, run `npx convex codegen` immediately before committing.