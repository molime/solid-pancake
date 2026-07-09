# cmd: kimi -p 'Read the prompt file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.conclave-runs\20260706_100122\plan_c_plan_agentic.prompt.md and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested.'
# cwd: C:\Users\pinol\Documents\Work\atriax\solid-pancake
# elapsed: 376.4s rc=0

• I’ll inspect the actual repo files before writing the plan, as the prompt requires.I launched three parallel exploration agents. I’ll wait for their findings before composing the plan.I have the exploration summaries. Now I’ll read a few key source files directly to verify the seams I’ll cite in the plan.I found a likely backend mismatch for candidate file uploads. I’ll verify the file upload helper and route guard before finalizing the plan.Below is the premium implementation plan, produced after reading the actual repo files, backend functions, Figma spec, and shared UI surface.

  ---

  # ATRIA-X Session 6 — Candidate Portal + Platform Training Wizard

  ## 1. Restated Goal & Acceptance Criteria

  Build the candidate self-service portal and the platform-training wizard, pixel-faithful to the Figma candidate frames, gated to the `org:candidate` role (with `org:caregiver` allowed only into `/onboarding/training`). All work stays in branch `feature/phase-2-worker-onboarding`.

  **AC-1** — `src/features/onboarding/model/trainingSteps.ts` exists and exports exactly 5 `TrainingStep` objects (`welcome`, `shifts`, `documenting`, `documents`, `help`) with `minReadSeconds: 45` and ~150–200 word bodies.

  **AC-2** — `PlatformTrainingWizard.tsx` renders full-screen at `/onboarding/training` with no sidebar, a top logo, step label, progress bar, scrollable content card, scroll-progress bar, countdown timer, and a Next/Complete button that is visually disabled (35 % opacity) until `scrollProgress === 100` AND `secondsRemaining === 0`.

  **AC-3** — Completing the wizard calls `api.onboarding.completePlatformTraining({ clerkOrgId })` and navigates to `/onboarding` for `org:candidate` or `/caregiver/today` for `org:caregiver`, with a loading state on the button.

  **AC-4** — `TrainingGate` in `AppShell.tsx` (or a new `TrainingGate.tsx`) queries `api.onboarding.hasPlatformTrainingCompleted({ clerkOrgId })` for `org:caregiver`/`org:candidate`, shows `AppLoader` while loading, and redirects to `/onboarding/training` when training is incomplete and the current path is not already `/onboarding/training`.

  **AC-5** — `/onboarding` renders `CandidateOnboardingPage`, queries `api.candidates.listCandidateTasks({ clerkOrgId })`, shows "N of 5 tasks complete", task cards with correct status badges/CTAs, and routes to the correct sub-page per task kind.

  **AC-6** — `/onboarding/application` renders `ApplicationFormPage` with name/email prefilled/readonly, editable phone, experience/motivation textareas, and emergency contact fields; submits via `api.candidates.submitApplication({ clerkOrgId, fields: {...} })`; validates required fields inline; on success navigates to `/onboarding/status`.

  **AC-7** — `/onboarding/status` renders `ApplicationStatusPage` with a 5-stage vertical progress tracker driven by `api.candidates.getCandidateProfile({ clerkOrgId })` status, and shows the amber "needs corrections" banner + link when status is `needs_correction`.

  **AC-8** — `/onboarding/upload/:taskId` renders `DocumentUploadPage`, resolves task title from `listCandidateTasks`, performs a Convex file upload, then calls `api.candidates.addCandidateDocument({ clerkOrgId, fileId, documentType: task.type, label: task.title, expiresAt })` and navigates back to `/onboarding`.

  **AC-9** — `/onboarding/acknowledgment` renders `AcknowledgmentPage`, finds or creates a "HIPAA Acknowledgment" form definition, and calls `api.forms.submitForm({ clerkOrgId, formDefinitionId, data: { acknowledged: true } })` when the checkbox is checked.

  **AC-10** — `/onboarding/offer` renders `OfferAcceptancePage`, shows agency/position/start/compensation, and calls `acceptOffer`/`rejectOffer`; accepting navigates to `/onboarding/status` with the Accepted stage highlighted.

  **AC-11** — `/onboarding/profile` renders `CandidateProfilePage` with avatar initials from `displayName`, read-only rows, and edit mode for phone only.

  **AC-12** — `src/app/router.tsx` adds all `/onboarding/*` routes inside the `AppShell` layout, gated by `TenantRoleRouteGuard` to `org:candidate` except `/onboarding/training` which also allows `org:caregiver`.

  **AC-13** — `src/app/shell/Sidebar.tsx` shows onboarding-only nav items for `org:candidate` and hides admin/coordinator/caregiver items.

  **AC-14** — New unit tests exist for the wizard, checklist, form, and upload pages; `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` are green.

  **AC-15** — E2E is run honestly; if it fails due to missing Clerk credentials, that is reported without blocking the code gates.

  ---

  ## 2. Discovery Notes

  Verified by reading actual files in `C:/Users/pinol/Documents/Work/atriax/solid-pancake`.

  ### Frontend seams
  - **Router chokepoint**: `src/app/router.tsx` renders all app routes inside `<Route element={<AppShell />}>` (lines 169–301). `/onboarding/*` routes must be added inside this block.
  - **Route guards**: `TenantRoleRouteGuard` (`src/app/shell/RouteGuard.tsx`, lines 70–97) reads `member.role` from `api.members.me` and redirects disallowed caregivers to `/caregiver/today`, everyone else to `/`. It already knows `org:candidate`.
  - **AppShell**: `src/app/shell/AppShell.tsx` currently only wraps `TenantRouteGuard` → sidebar/topbar → `<Outlet />`. It does **not** resolve the member role; `Sidebar` and `Topbar` do that. The training gate must resolve `api.members.me` itself (or reuse `TenantRoleRouteGuard`-style logic) to know whether to call `hasPlatformTrainingCompleted`.
  - **Sidebar**: `src/app/shell/Sidebar.tsx` filters `navItems` by `member.role` (line 120). For `org:candidate` the filtered list is currently empty, so candidates see an empty sidebar. New onboarding-only items must be added for candidates.
  - **Shared UI primitives** (`src/shared/ui/index.ts`): `Button` (variants `primary/secondary/danger/ghost`, sizes `sm/md/lg`), `Card`, `Input`, `Textarea`, `Select`, `FieldGroup`, `Badge`, `StatusBadge`, `ProgressSteps`, `Checkbox`, `Dialog`, `AppLoader`, `Separator`. `Button` disabled styling sets `opacity:100` via CVA but the spec wants 35 % opacity, so we’ll pass `className` or wrap with an override.
  - **Class helper**: `cn` is re-exported from `src/shared/lib/cn.ts` (`clsx` + `tailwind-merge`).
  - **Theme tokens** (Tailwind 4 in `src/index.css`): existing tokens include `bg-atria-bg`, `bg-atria-surface`, `bg-atria-surface-2`, `bg-atria-surface-3`, `border-atria-border`, `text-atria-ink`, `text-atria-text-secondary`, `text-atria-text-muted`, `bg-atria-accent`, `text-atria-warning`, `bg-atria-danger`. Exact Figma hexes (`#0B0F10`, `#11171A`, `#22C55E`, etc.) can be applied via arbitrary values where the token mismatch matters for pixel-perfect acceptance.

  ### Backend seams
  - **Platform training**: `convex/onboarding.ts` exports:
    - `completePlatformTraining({ clerkOrgId, trainingId? })` — allowed roles `org:caregiver`, `org:candidate`.
    - `hasPlatformTrainingCompleted({ clerkOrgId, trainingId? })` — same roles.
  - **Candidate lifecycle**: `convex/candidates.ts` exports:
    - `getCandidateProfile({ clerkOrgId })` — returns own `candidates` doc or `null`.
    - `listCandidateTasks({ clerkOrgId })` — returns `candidateTasks[]` sorted by `order`.
    - `submitApplication({ clerkOrgId, fields: v.any() })` — upserts the latest application, sets candidate status to `applied`, completes the `form_submission` task.
    - `addCandidateDocument({ clerkOrgId, candidateId?, fileId, documentType, label, expiresAt? })` — `org:candidate` callers must omit `candidateId`; the function resolves the candidate from identity.
    - `acceptOffer({ clerkOrgId })` / `rejectOffer({ clerkOrgId })` — status checks inside mutations.
  - **Forms**: `convex/forms.ts` exports:
    - `listFormDefinitions({ clerkOrgId, includeInactive? })` — allowed for `org:candidate`.
    - `createFormDefinition({ clerkOrgId, name, description?, fields: any[] })` — **only** `org:admin`, `org:hr`.
    - `submitForm({ clerkOrgId, formDefinitionId, data: Record<string, any> })` — allowed for `org:candidate`, `org:caregiver`; auto-completes the candidate’s `form_submission` task.
  - **File upload gap**: `convex/files.ts` `generateUploadUrl({ clerkOrgId })` (line 38–49) currently allows only `['org:admin', 'org:coordinator', 'org:caregiver']`. It **does not** allow `org:candidate`. The task explicitly requires candidates to upload documents via this mutation. This is a verified backend seam that must be widened before the upload page can work end-to-end.

  ### Figma ground truth
  - Spec file: `.hermes-pipeline/20260706_095614/figma-candidate-spec.md`.
  - 11 exported PNGs in `.hermes-pipeline/20260706_095614/figma/` cover Application Entry/Form, Status, Checklist, Document Upload, Acknowledgment, Offer, Profile, and Training (locked/unlocked/complete).
  - Primary frame: 390 × 844, dark theme, green `#22C55E`, 28 px radius primary CTAs.

  ---

  ## 3. Alternatives Considered

  | Approach | Why rejected | Chosen approach |
  |---|---|---|
  | Put the training gate inside `TenantRouteGuard` | `TenantRouteGuard` is auth-level and does not resolve the member role; adding role queries there would force every route to pay the membership cost twice. | Add a new `TrainingGate` component inside `AppShell.tsx` that resolves `api.members.me` and conditionally calls `hasPlatformTrainingCompleted`. |
  | Reuse `TenantRoleRouteGuard` to also block candidates from all routes except onboarding | The guard redirects disallowed users to `/` or `/caregiver/today`, which is wrong for candidates who need to stay inside `/onboarding/*`. | Add a dedicated candidate route group with `allowedRoles={['org:candidate']}` and a separate `/onboarding/training` route allowing both candidate and caregiver. |
  | Put all onboarding pages under a single lazy-loaded `OnboardingLayout` | The wizard needs a full-screen no-sidebar layout, while other onboarding pages use the normal `AppShell` sidebar. | Keep pages inside `AppShell` but render the wizard with absolute/full-screen styling that hides the sidebar visually (or add a layout route exception only for `/onboarding/training`). Simpler: full-screen styled page inside the existing shell. |
  | Create a candidate-specific `generateUploadUrl` mutation | Duplicates file upload logic. | Extend the existing `convex/files.ts` `generateUploadUrl` allowed roles to include `org:candidate` and `org:hr` (they are tenant members). Minimal backend change, no new file. |
  | Create a generic "find or create form" helper on the backend | `createFormDefinition` requires `org:admin`/`org:hr`, so a candidate cannot create it. | Frontend acknowledges this: if no HIPAA form exists, the candidate sees an error state prompting coordinator/admin setup. The task says "find or create," but the backend does not permit candidates to create forms, so the plan surfaces this as an edge case rather than inventing an unsafe workaround. |

  ---

  ## 4. Files to Create / Modify

  | File | Change type | What changes |
  |---|---|---|
  | `src/features/onboarding/model/trainingSteps.ts` | Create | Export `TrainingStep` type and the 5-step array. |
  | `src/features/onboarding/components/PlatformTrainingWizard.tsx` | Create | Full-screen wizard UI, scroll + timer gate, mutation call, navigation. |
  | `src/app/shell/TrainingGate.tsx` | Create | New component: resolves role, calls `hasPlatformTrainingCompleted`, redirects or renders children. |
  | `src/app/shell/AppShell.tsx` | Modify | Insert `<TrainingGate>` between `TenantRouteGuard` and the layout div. |
  | `src/features/onboarding/pages/CandidateOnboardingPage.tsx` | Create | Checklist page: tasks, badges, CTAs, progress summary, success banner. |
  | `src/features/onboarding/pages/ApplicationFormPage.tsx` | Create | Application form with prefilled readonly fields and validation. |
  | `src/features/onboarding/pages/ApplicationStatusPage.tsx` | Create | 5-stage progress tracker + needs-correction banner. |
  | `src/features/onboarding/pages/DocumentUploadPage.tsx` | Create | Drop zone, `generateUploadUrl` + POST, `addCandidateDocument` call. |
  | `src/features/onboarding/pages/AcknowledgmentPage.tsx` | Create | Scrollable HIPAA policy, checkbox, `submitForm` call. |
  | `src/features/onboarding/pages/OfferAcceptancePage.tsx` | Create | Offer card, accept/decline mutations. |
  | `src/features/onboarding/pages/CandidateProfilePage.tsx` | Create | Read-only profile with phone edit mode. |
  | `src/features/onboarding/components/*` | Create (optional) | Reusable task card, status badge wrappers if not covered by shared UI. |
  | `src/app/router.tsx` | Modify | Add `/onboarding`, `/onboarding/application`, `/onboarding/status`, `/onboarding/upload/:taskId`, `/onboarding/acknowledgment`, `/onboarding/offer`, `/onboarding/profile`, `/onboarding/training` inside `AppShell`, with correct `TenantRoleRouteGuard` roles. |
  | `src/app/shell/Sidebar.tsx` | Modify | Add candidate-only nav items (Onboarding, Training, Profile, Status) and ensure they only appear for `org:candidate`. |
  | `convex/files.ts` | Modify | Add `org:candidate` (and `org:hr` for consistency) to `generateUploadUrl` allowed roles. |
  | `src/features/onboarding/components/PlatformTrainingWizard.test.tsx` | Create | Render, disabled/enabled Next, completion mutation, navigation. |
  | `src/features/onboarding/pages/CandidateOnboardingPage.test.tsx` | Create | Task rendering and CTA routing. |
  | `src/features/onboarding/pages/ApplicationFormPage.test.tsx` | Create | Validation and submit mutation. |
  | `src/features/onboarding/pages/DocumentUploadPage.test.tsx` | Create | Upload flow and `addCandidateDocument` call. |
  | `convex/files.test.ts` or extend existing | Modify (optional) | Add test that `org:candidate` can call `generateUploadUrl`. |

  ---

  ## 5. Data / Auth / Security / Multi-tenant / PHI / Idempotency Edge Cases

  ### Multi-tenancy
  - Every Convex call from the frontend must include `clerkOrgId` from `useOrganization().organization.id`.
  - All backend functions use `requireTenantRole`/`requireTenant`, which verify the caller has a `tenantMembers` row for that `clerkOrgId`. Cross-tenant access is rejected.
  - `addCandidateDocument` for `org:candidate` resolves the candidate from identity and rejects an explicit `candidateId` to prevent candidates from attaching documents to other profiles.

  ### Training gate edge cases
  - If `api.members.me` is loading, show `AppLoader`.
  - If role is `org:caregiver` or `org:candidate`, call `hasPlatformTrainingCompleted`.
  - If the query is loading, show `AppLoader`.
  - If training is incomplete and current path is not `/onboarding/training`, `<Navigate replace to='/onboarding/training' />`.
  - If training is incomplete and current path **is** `/onboarding/training`, render children to avoid a redirect loop.
  - If role is neither caregiver nor candidate, render children normally (admins/coordinators skip training gate).

  ### PHI / HIPAA
  - Acknowledgment page stores `acknowledged: true` via `submitForm`, which records the submitting user and timestamp in `formSubmissions`. This is the audit trail.
  - The page must not store a drawn signature image; the text "Your name serves as your electronic signature" matches the existing data model.
  - Document uploads for certifications contain PII/credentials; they land in `files` + `documentArchiveItems` with tenant isolation and `subjectType: 'candidate'`.

  ### Idempotency
  - `completePlatformTraining` checks for an existing completion and returns it rather than creating duplicates.
  - `submitApplication` upserts the latest non-hired application; re-submission is allowed unless the candidate is in a terminal status.
  - `acceptOffer` returns early if status is already `accepted`.
  - `addCandidateDocument` inserts a new archive item each time (intentional: each upload is a distinct record).

  ### File upload security gap
  - `generateUploadUrl` currently excludes `org:candidate`. Widening it to include candidates is required and safe because `requireTenantRole` still enforces tenant membership; the generated URL is scoped to the tenant’s storage. The mutation returns `{ url, tenantId, uploadedBy }`; the frontend only needs `url`.

  ### Form definition gap
  - `createFormDefinition` is admin/HR only. If the HIPAA form definition does not exist when a candidate reaches `/onboarding/acknowledgment`, the frontend cannot create it. The safest UX is to show an error: "This acknowledgment is not ready yet. Please contact your coordinator." This avoids giving candidates write access to form definitions.

  ---

  ## 6. Test Strategy

  ### Unit/component tests (Vitest + jsdom + RTL)
  Follow repo conventions: mock `@clerk/react` and `convex/react`, use `vi.useFakeTimers`, dynamic import after mocks.

  1. **`PlatformTrainingWizard.test.tsx`**
     - Renders step 1 with title and body.
     - Next button is disabled initially.
     - Scrolls content to bottom + advances timers to 45s → button enables.
     - Clicking enabled Next advances to step 2.
     - On final step, button label reads "Complete training".
     - Clicking final button calls `completePlatformTraining` and navigates to `/onboarding` (candidate) or `/caregiver/today` (caregiver).
     - Button shows loading state during mutation.

  2. **`CandidateOnboardingPage.test.tsx`**
     - Renders loading then tasks.
     - Shows "2 of 5 tasks complete" when two tasks are `complete`.
     - Pending task shows "Start" button linking to the correct route.
     - `in_progress` task shows "Continue".
     - `complete` task shows "✓ Done" and is disabled.
     - All required complete shows green success banner.

  3. **`ApplicationFormPage.test.tsx`**
     - Prefills name/email from candidate profile.
     - Phone is editable.
     - Submit disabled until required fields filled.
     - Calls `submitApplication` with correct field shape.
     - Navigates to `/onboarding/status` on success.

  4. **`DocumentUploadPage.test.tsx`**
     - Resolves task title from route `taskId`.
     - Selecting a file triggers `generateUploadUrl`, then POST to the returned URL, then `addCandidateDocument` with the right args.
     - Shows uploaded preview card.
     - Navigates to `/onboarding` after success.

  5. **`ApplicationStatusPage.test.tsx`**
     - Highlights the correct stage for each candidate status.
     - Shows needs-correction banner + link when status is `needs_correction`.

  6. **`TrainingGate.test.tsx`**
     - Loading role or training query renders `AppLoader`.
     - Incomplete training + path `/caregiver/today` redirects to `/onboarding/training`.
     - Incomplete training + path `/onboarding/training` renders children (no loop).
     - Complete training renders children.

  ### Backend test (optional but recommended)
  - Extend `convex/files.test.ts` to assert `org:candidate` can call `generateUploadUrl` after the role list is widened.

  ### Gate commands
  ```bash
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  ```

  ### E2E
  ```bash
  npm run e2e
  ```
  If this fails due to missing Clerk credentials or a non-configured test tenant, report it honestly; it does not block the above gates.

  ---

  ## 7. Rollback / Verification Notes

  ### Verification checklist before declaring done
  - [ ] `trainingSteps.ts` exports 5 steps with correct ids/titles/`minReadSeconds`.
  - [ ] `/onboarding/training` renders full-screen, no sidebar, and matches the locked/unlocked/complete PNGs.
  - [ ] Next button is disabled until scroll bottom + timer zero; enabled styling is full green.
  - [ ] `TrainingGate` redirects an untrained caregiver/candidate to `/onboarding/training` and does not loop.
  - [ ] `/onboarding` checklist shows tasks, correct CTAs, and the success banner when all complete.
  - [ ] `/onboarding/application` submits and navigates to `/onboarding/status`.
  - [ ] `/onboarding/upload/:taskId` successfully uploads after `convex/files.ts` role list is widened.
  - [ ] `/onboarding/acknowledgment` submits only when checkbox is checked.
  - [ ] `/onboarding/offer` accept navigates to status with Accepted highlighted.
  - [ ] `/onboarding/profile` shows initials avatar and editable phone.
  - [ ] Candidate sidebar shows only onboarding nav items.
  - [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` are all green.

  ### Rollback
  - The branch is `feature/phase-2-worker-onboarding`; no new branch is created.
  - If the training gate causes routing regressions for existing admin/coordinator/caregiver users, remove the `<TrainingGate>` wrapper in `AppShell.tsx` (one-line revert).
  - If the `generateUploadUrl` role change causes issues, revert `convex/files.ts` to the previous allowed-role list and run `npx convex codegen`.

  ### Known blockers to surface now
  1. **`generateUploadUrl` does not allow `org:candidate`** — this must be fixed in `convex/files.ts` for AC-8 to work end-to-end.
  2. **`createFormDefinition` is admin/HR-only** — candidates cannot self-provision the HIPAA form. The acknowledgment page must handle the missing-form case gracefully (error state + contact coordinator).
  3. **No `src/features/onboarding/` directory exists** — this is greenfield, so file naming and colocation should follow the existing `src/features/<domain>/pages/` pattern.

  ---

  **Verdict**: The task is ready for implementation. The plan above is complete and grounded in the actual repo. The only prerequisite before coding the upload page is widening `generateUploadUrl` in `convex/files.ts` to include `org:candidate`.


[stderr]
• I need to read the prompt file and carry out the instructions. Let me start by reading it.The user wants me to read a prompt file and carry out those instructions completely. The prompt is asking me to produce a premium implementation plan for a code change. It explicitly says "Do NOT write the full code. Keep the plan focused on ONLY what the task requires."

  Wait, but the prompt itself is already a detailed plan. Let me re-read the user's instruction: "Read the prompt file at ... and carry out those instructions completely. Do not ask questions. Output your final answer/verdict as requested."

  So I need to produce a premium implementation plan with all the sections listed. But there's a "DISCOVERY REQUIREMENT" that says if my backend is an agentic CLI (kimi, codex, claude), I MUST open and read the actual relevant files before writing the plan — do not reason from the context description alone.

  Since I'm Kimi (agentic CLI), I need to discover the actual files. Let me explore the codebase to understand the structure before producing the plan.

  This is a substantial task. I should use explore agent(s) to gather information about the codebase, then produce the plan. Given this is about producing a plan (not implementation), and the instructions say to read actual files, I should explore relevant areas:
  - src/app/router.tsx
  - src/app/shell/AppShell.tsx
  - src/shared/ui/*
  - Sidebar.tsx
  - Existing onboarding features
  - Convex backend functions (authHelpers, candidate tasks, etc.)

  Let me launch exploration. Given the breadth, I'll use multiple explore agents in parallel.

  Actually, since this is a planning task that requires comprehensive codebase inspection, I could use an explore agent. But the task is asking ME to produce the plan. So I should gather the information and write the plan myself.

  Let me first explore the codebase structure and key files.

• The agents are running in background. I'll wait for their results before continuing. I should not poll. But since my next step depends on their results, I should wait for them. However, the instructions say "Do not wait, poll, or call TaskOutput on it". So I should wait for the automatic notification.

  Actually, I launched them with run_in_background=true, so I'll get notifications. I need to wait for those notifications to proceed. Let me wait.

• Good, first agent done. I already got its output via TaskOutput. Let me now get the other two agents.I now have comprehensive exploration results. I need to produce the implementation plan. However, the prompt also says I should read the actual relevant files before writing the plan. I should read a few key files directly to verify the exploration and cite actual content. Let me read:
  1. src/app/router.tsx
  2. src/app/shell/AppShell.tsx
  3. src/app/shell/Sidebar.tsx
  4. src/shared/ui/index.ts (or key components)
  5. convex/onboarding.ts
  6. convex/candidates.ts (relevant parts)
  7. convex/forms.ts (relevant parts)
  8. .hermes-pipeline/20260706_095614/figma-candidate-spec.md

  Given the request is to produce a plan (not code), I don't need to read every line, but I should cite actual verified findings. Let me read these key files.

• I have excellent verified information. Now I need to produce the premium implementation plan. The prompt asks for 7 specific sections. I should also note one issue I discovered: `generateUploadUrl` does NOT allow `org:candidate` in `convex/files.ts`. The task says to use it. This is a conflict that needs to be addressed in the plan - either backend needs updating or we need to note this seam.

  Let me read the files.ts to confirm, and candidates.ts to confirm addCandidateDocument signature. Also maybe read RouteGuard to understand TenantRoleRouteGuard.

  Let me read a few more files to make sure I have accurate citations.

• I have enough verified info. Let me read more of candidates.ts around addCandidateDocument and submitApplication to be precise.Let me read around those functions to get exact signatures.I now have all the information I need. The key issue to surface in the plan:

  `generateUploadUrl` in `convex/files.ts` only allows `['org:admin', 'org:coordinator', 'org:caregiver']` and does NOT include `org:candidate`. But the task requires candidates to upload documents. So the plan needs to either:
  1. Modify `convex/files.ts` to allow `org:candidate` (since candidates are tenant members), or
  2. Create a candidate-specific upload mutation, or
  3. Note this as a required backend change.

  Given the task says "Backend mutations already exist; wire to them" and "run `npx convex codegen` only if schema/convex changes occur", but `generateUploadUrl` clearly needs modification. The safest approach is to extend `generateUploadUrl` to include `org:candidate` and `org:hr` since they're tenant members. But that's a backend change. The plan should note this.

  Also, I should read forms.ts to confirm submitForm and listFormDefinitions signatures.Let me read the submitForm handler to understand what it does for candidates.I now have all the verified information I need. I should now write the implementation plan. The prompt asked me to "carry out those instructions completely" and "Output your final answer/verdict as requested." The requested output is a premium implementation plan with 7 sections.

  I should produce this plan as my final answer. I need to make sure I cover all required sections and cite actual files/function names.

  Given the plan should be written to a file or returned as final answer? The prompt says "Output your final answer/verdict as requested." It doesn't specify writing to a file. The original task was to produce a plan. So I'll output the plan directly in my response.

  However, the instructions at the top say "Produce a premium implementation plan with ALL of the following sections" — it doesn't say write it to a file. So I'll provide it as the final response.

  Let me make sure I include:
  1. Restated goal and numbered acceptance criteria
  2. Discovery notes with actual function/type names
  3. Alternatives considered
  4. Files to create/modify table
  5. Data/auth/security/multi-tenant/PHI/idempotency edge cases
  6. Test strategy
  7. Rollback/verification notes

  I should also explicitly note the `generateUploadUrl` candidate role gap I discovered.

  Let me craft the plan now.

To resume this session: kimi -r session_0d480285-9071-40d2-8b65-ee7c9a504d19
