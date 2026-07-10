# ATRIA-X Session 7 — HR screens Figma spec

Exported PNGs in this directory:
- `hr-dashboard.png` — frame `149:86` "HR / Dashboard"
- `hr-candidate-pipeline.png` — frame `157:278` "HR / Candidate Pipeline"
- `hr-application-review.png` — frame `175:1878` "HR / Application Review"
- `hr-employee-profile.png` — frame `161:1318` "HR / Employee Profile"
- `hr-hire-convert.png` — frame `191:2534` "HR / Hire — Convert to Employee"
- `hr-cases.png` — frame `191:2688` "HR / Cases"

All screens: dark theme, desktop-first (sidebar 240px fixed), main content with `bg-atria-bg`, cards `bg-atria-surface` `border-atria-border`, rounded `var(--radius-atria-lg)`.

## Global HR sidebar section (Sidebar.tsx)
For `org:admin` or `org:hr` add nav items grouped under "People & hiring" (or appended in order):
- Dashboard (`/`) — existing, roles admin/coordinator only; for HR users keep visible to admin/hr? No, per task only the new HR-specific items.
- Candidates (`/hr/candidates`) icon `Users` — roles `org:admin`, `org:hr`
- Employees (`/hr/employees`) icon `Building2` — roles `org:admin`, `org:hr`
- Cases (`/hr/cases`) icon `ClipboardCheck` — roles `org:admin`, `org:hr`

Note: Figma sidebar labels are Dashboard, Candidates, Employees, Credentials, Cases, Documents. Use the icon style already present in Sidebar.tsx (`h-4 w-4`, active `bg-white/10 text-white`).

## 1. HRDashboardPage.tsx — route `/hr`
Title: `People & hiring`. Subtitle: `What needs your attention across hiring and the workforce today.`

Top KPI grid: 4 equal cards (reuse KpiCard) with these labels/accents:
- "In pipeline" — value = count candidates where `status in ['invited','application_draft','submitted','hr_review']`. Accent blue (`text-atria-info`, icon). Detail text can be empty or "candidates".
- "Active employees" — value = count tenantMembers with `role === 'org:caregiver'`. Accent green hero (`text-atria-success`).
- "Expiring credentials" — value `0` for Phase 3. Accent amber (`text-atria-warning`).
- "Open cases" — value = count `hrCases` with `status === 'open'`. Accent red (`text-atria-danger`).

Below KPIs: two-column layout.
Left card `Candidate pipeline` with header row: title left, `View all →` right (green link text, arrow). List top 3 pending candidates (newest first). Each row: colored initials avatar (circle, 40px, background matching status accent), name bold, status badge, invited date. `Review →` link on the right.
Right card `Action needed` is **not required for this session**; omit unless trivial. Figma shows credential/action alerts, but task scope focuses on candidate list + invite button.

Add an `Invite candidate` primary Button above the candidate list or in the KPI area as shown in task description. Opens `InviteCandidateModal`.

## 2. InviteCandidateModal.tsx
Dialog title `Invite candidate`. Form fields stacked:
- `displayName` (required)
- `email` (required)
- `phone` (optional)
Footer: `Cancel` secondary, `Send invitation` primary. On success toast `Invitation sent`, close, refresh dashboard counts.

## 3. CandidatePipelinePage.tsx — route `/hr/candidates`
Title: `Candidate Pipeline`. Subtitle: `Track applicants by stage — screening, interviews, offers, and onboarding.`

Filter tabs (pill style, active tab filled green `bg-atria-accent text-atria-bg`, inactive `border border-atria-border`):
- All
- In progress
- Review needed
- Hired

Table columns: NAME, EMAIL, INVITED, STATUS, TASKS, ACTIONS.
Rows: displayName bold, email muted, invited date, status badge, tasks progress (e.g. "2/5"), `Review →` link.

StatusBadge color/word mapping for candidate statuses:
- `invited` / `withdrawn` → gray / neutral
- `application_draft` → amber / warning label "Draft"
- `submitted` / `hr_review` → blue / info label "Submitted" / "Under review"
- `offer_sent` → teal (use info with slightly adjusted label) label "Offer sent"
- `accepted` / `hired` → green hero / success label "Accepted" / "Hired"
- `rejected` → red / danger label "Rejected"

## 4. ApplicationReviewPage.tsx — route `/hr/candidates/:candidateId`
Back link at top: `← Back to Candidate Pipeline` green.
Title `Application Review`. Subtitle: `{name} · {position} · Applied {date}`.

Layout: left panel (wider) + right panel.
Left panel card:
- Header row: 48px initials avatar, name, email, phone, status badge.
- Section `Application details`: labeled read-only field groups (2-column grid). Fields from `application.fields`: POSITION, EXPERIENCE, AVAILABILITY, RECRUITER.
- Section `Documents submitted`: list rows with document name left, status badge right (`Received` green, `Under review` amber, `Missing` red).
- Section `Recruiter notes`: textarea displaying/allowing editing of `hrNotes`. Required for `Request correction` action.

Right panel card `Your decision`:
- Primary CTA `Advance to next stage` (green filled, full width, icon check). Calls `sendOffer` only if all candidate tasks are completed or waived; otherwise disabled with helper text.
- Secondary `Request a correction` (amber outline, full width, icon arrow-left). Calls `reviewApplication` with `decision:'needs_correction'`; requires `hrNotes` textarea visible/entered.
- Danger `Reject application` (red outline, full width, icon X). Calls `reviewApplication` with `decision:'reject'`; confirmation dialog first.

All three actions show confirmation dialogs before executing. Toast on success.

Note: current `reviewApplication` mutation accepts only `approved`/`rejected`. The session must extend it to also accept `needs_correction` (or use a separate mutation). Task says: "'Request correction' secondary button (opens hrNotes textarea, calls reviewApplication decision:'needs_correction')". Update `candidates.ts` `reviewApplication` decision union to include `needs_correction` and set candidate status to `application_draft` (or keep applied) and application status accordingly.

## 5. HireConvertPage.tsx — route `/hr/candidates/:candidateId/hire`
Back link: `← Back to Candidate Pipeline`.
Title `Convert to Employee — {displayName}`. Subtitle: `Offer accepted · {position} · Application #{applicationId or number}`.

Left panel `Candidate profile`: read-only field groups (full name, email, phone, applied for, experience, recruiter, offer accepted date/rate/position).
Right panel `New employee record`: conversion target label `Caregiver`, ADP note `Worker will be registered in ADP when credentials are configured`, form fields (start date, pay rate, supervisor) — for this session, minimal version from task: just the summary + target + note + confirm button. Keep the fields but mark auto-populated or optional if backend not ready.

Primary button full width green `Confirm & hire` with checkmark icon. Calls `hireCandidate` mutation. On success toast `Candidate hired successfully — they are now an active caregiver`, navigate to `/hr/employees`. On error inline error.

Backend: add `hireCandidate` mutation in `candidates.ts` (org:admin/org:hr). It should:
- verify candidate status is `accepted`
- create or reuse employeeProfile (call existing `employeeProfiles.createCaregiverProfile` internal)
- create tenantMember? For Phase 2, existing `createCaregiver` action does invitation. Since candidate already has a Clerk user, `hireCandidate` can patch candidate status to `hired`, set application `hiredEmployeeProfileId`, create employeeProfile with `adpSyncStatus: 'pending_credentials'`.

## 6. EmployeesPage.tsx — route `/hr/employees`
Title `Employees`. Subtitle plain.
Table: NAME, EMAIL, ADP SYNC STATUS, ACTIONS. Rows: displayName, email, status badge from `employeeProfiles.adpSyncStatus`, `View →` link to `/hr/employees/:memberId`.

## 7. EmployeeProfilePage.tsx — route `/hr/employees/:memberId`
Back link `← Back to Employees`.
Header card: 64px initials avatar, name, role, start date (`tenantMember.createdAt`), ADP sync status badge, employment status badge `Active`.
Tabs: Profile / Documents / Cases (pill style, active green). For this session implement all three tabs.
- Profile tab: read-only personal info field groups (email, phone, address if available, DOB, SSN masked, pay rate, employment type).
- Documents tab: documentArchiveItems for this employee (subjectType `employee`, subjectId = clerkUserId).
- Cases tab: hrCases where `subjectId = clerkUserId`.

## 8. HRCasesPage.tsx — route `/hr/cases`
Title `HR Cases`. Subtitle: `Track discrepancies, disputes, and open issues requiring HR resolution.`
Table columns: SUBJECT, KIND, STATUS, ASSIGNED, CREATED, ACTIONS.
StatusBadge mapping: `open` red, `in_review` amber, `resolved` green, `closed` neutral.
`New case` primary button opens `NewCaseModal`: title, description, kind, subjectId (select employee/candidate). Calls `createHrCase` mutation.
Backend: add to `convex/hrCases.ts` (new file or extend): `createHrCase`, `listHrCases`, `updateHrCase`. All require `org:admin` or `org:hr`. `hrCases` schema already exists.

## Router / guards
Add all `/hr/*` routes inside `AppShell` with `TenantRoleRouteGuard allowedRoles={['org:admin','org:hr']}` and lazy imports from `@/features/hr/pages/*`. Use existing `RouteSuspense`.

## Shared UI usage
Use `src/shared/ui/*` (`Button`, `Card*`, `Dialog*`, `Input`, `Textarea`, `Select`, `Table*`, `StatusBadge`, `KpiCard`, `FieldGroup`, `EmptyState`, `Badge`). Use `cn` from `@/shared/lib/cn`. No new deps. Touch targets >=44px, type 16px+.

## Style
Single quotes, no semicolons, 2-space indent. Gates: lint, typecheck, test, build green.

## Visual acceptance
Live UI must match the exported PNGs state-by-state. Any visible divergence is a defect. The review stage compares screenshots to these PNGs.
