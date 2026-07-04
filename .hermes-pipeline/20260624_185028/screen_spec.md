# Caregiver Shift Documentation — Screen Spec

> Source: Figma caregiver wizard lane (`talk-to-figma` channel `wzkdzbsj`) and the implemented `src/features/caregiver` flow.

## Global tokens

| Token | Value (dark) | Usage |
|-------|--------------|-------|
| `--color-atria-bg` | `#0a0e0f` | Page background |
| `--color-atria-surface` | `#11171a` | Card surface |
| `--color-atria-surface-2` | `#161d21` | Subtle panels / inline blocks |
| `--color-atria-text-primary` | `#f2f6f7` | Primary copy |
| `--color-atria-text-secondary` | `#aebcc2` | Secondary copy |
| `--color-atria-text-muted` | `#6e808a` | Metadata / quiet text |
| `--color-atria-border` | `#2a373d` | Card & input borders |
| `--color-atria-accent` | `#16a34a` | Primary action / success accent |
| `--color-atria-accent-hover` | `#15833d` | Primary action hover |
| `--color-atria-accent-quiet` | `rgba(22,163,74,0.14)` | Soft accent background |
| `--color-atria-danger` | `#f0564a` | Errors / blocked states |
| `--color-atria-danger-bg` | `rgba(240,86,74,0.14)` | Error block background |
| `--color-atria-info` | `#4d8df6` | Checking / info states |
| `--radius-atria-md` | `12px` | Cards, blocks |
| `--radius-atria-lg` | `16px` | Large cards |
| `--radius-atria-pill` | `999px` | Primary clock buttons |
| `--shadow-atria-pop` | `0 8px 24px rgba(0,0,0,0.5)` | Dialog shadow |

## Step accent tokens

| Step | Text class | Color |
|------|------------|-------|
| 1 When | `text-atria-step-when` | `#3b82f6` |
| 2 What | `text-atria-step-what` | `#a855f7` |
| 3 How | `text-atria-step-how` | `#f59e0b` |
| 4 Goal | `text-atria-step-goal` | `#14b8a6` |
| 5 Issues | `text-atria-step-issues` | `#ef4444` |
| 6 Done | `text-atria-step-done` | `#16a34a` |

---

## Frame: Today / Entry

**Frame ID:** `1:151`  
**Route:** `/caregiver/today`  
**Primary width:** 390px

### Layout
- Header: `Good morning, {firstName} 👋` (text-2xl, semibold) + `{weekday, month day}` (text-base, text-secondary).
- Section label: `Your visit today` (text-base, semibold).
- Visit card: rounded-2xl, border, stacked content with client name, time range + duration, short address, status pill, optional warning, primary CTA, helper, footer.

### Copy
- Heading: `Good morning, {firstName} 👋`
- Subhead: `{formatWeekdayDate(new Date())}`
- Section: `Your visit today`
- Client line: `{client.displayName}`
- Time line: `🕐 {start} – {end} · {duration}`
- Address line: `📍 {formatStreetAddress(serviceAddress)}`
- Status pills: `UPCOMING`, `IN PROGRESS`, `SUBMITTED`, `CORRECTION`, `APPROVED`, `BILLING READY`
- Warning: `⚠ Shift notes not started yet`
- CTA: `Clock in & start →`
- Helper: `It only takes a few minutes. We'll guide you step by step.`
- Footer: `Need help? Call your coordinator`

### Interaction
- Tap the card or CTA selects the shift; mobile detail pane replaces list.
- `Back to shifts` ghost button returns to list.

---

## Frame: Clock In

**Frame ID:** `201:3872`  
**Component:** `ShiftClockInScreen`  
**Primary width:** 390px

### Layout
- Header `Clock in` + subhead.
- Visit card with client name, time range, address.
- Clock card: `CURRENT TIME` label + large green time.
- Optional `LocationStatusPanel` when geofence + enforceClockIn.
- Full-width green pill CTA.
- Payroll note + footer.

### Copy
- Title: `Clock in`
- Subhead: `Start your shift to begin your notes.`
- Clock label: `CURRENT TIME`
- Button idle: `Clock in now →`
- Button loading: `Clocking in…`
- Payroll: `Your start time is sent to ADP for payroll. You can begin your shift notes right after clocking in.`
- Footer: `Need help? Call your coordinator`
- Location checking: `Checking your location…`
- Location denied: `Location access was denied. Enable location permissions in your browser settings to clock in.`
- Location unsupported: `Your browser does not support location services. Contact your coordinator.`

### Interaction / states
- Button disabled while `isLoading` or location blocked.
- On success → transition to Step 1 wizard.

---

## Frames: Step 1 When … Step 6 Done

**Component:** `ShiftNoteStep`  
**Primary width:** 390px

### Common layout
- Card with top border in step accent color.
- Top row: `Step {n} of 6` + `Autosaved ✓` (or `Saving…`).
- `ProgressSteps` bar with all 6 labels.
- Step prompt (text-2xl semibold accent) + helper.
- Footer (parent): outline `Back` + primary accent `Next Step →` / `Submit my notes ✓`.

### Per-step copy & fields

| Step | Prompt | Accent | Controls |
|------|--------|--------|----------|
| 1 When | `When were you there?` | blue | `I started at` / time / `Change`; `I finished at` / time / `Change`. Inline errors for missing/invalid times. |
| 2 What | `What did you help with?` | purple | Service tile grid: 🛁 Bathing, 🍽️ Meals, 🚶 Walking, 💊 Medication, 🧹 Housekeeping, 💬 Company. Selected shows checkmark and purple tint. |
| 3 How | `How did the visit go?` | amber | Large textarea, success message `✓ Looking good! Nice and clear.` + character count, quick-phrase chips `+ Bathing`, `+ Ate well`, `+ In good spirits`. |
| 4 Goal | `Did you work on her goals?` | teal | Goal cards: `Walk a little each day`, `Eat full meals`, `Spend time talking` with subtitle `Goal: …`. Selected shows checkmark. |
| 5 Issues | `Anything we should know?` | red | Choice cards: `😊 No, all good today` / `Everything went fine`; `⚠️ Yes, I need to report something` / `A fall, pain, mood change, or other concern`. Required task list rendered below. |
| 6 Done | `One last look 👀` | green | Review rows: `TIME`, `WHAT YOU HELPED WITH`, `YOUR NOTES`, `ISSUES` + `Edit` links. Confirmation checkbox `I confirm this is accurate and true.` |

### Interaction
- `Next Step` disabled until current step validation passes.
- Step 6 CTA label: `Submit my notes ✓`, disabled until confirmed.
- Text fields autosave after 800ms debounce via `updateProgressNote`.
- Service/goal/issue selections autosave via `servicesProvided` / `clientResponse`.

---

## Frame: Clock Out

**Frame ID:** `201:3873`  
**Component:** `ShiftClockOutScreen`  
**Primary width:** 390px

### Layout
- Header `Clock out` + subhead.
- Done pill `✓ SHIFT NOTE DONE`.
- Clock card with current time.
- Summary card: client + shift time range.
- `LocationStatusPanel` when geofence + enforceClockOut.
- `MissingChecklist` or `CompleteChecklist`.
- Full-width green pill CTA.
- Payroll note + footer.

### Copy
- Title: `Clock out`
- Subhead: `Your shift notes are complete. You can clock out now.`
- Done pill: `✓ SHIFT NOTE DONE`
- Clock label: `CURRENT TIME`
- Summary label: `Shift summary`
- Button idle: `Clock out now →`
- Button loading: `Submitting…`
- Complete checklist: `Everything looks good. You can clock out.`
- Missing heading: `What is still missing`
- Missing location: `Location needed for clock-out`
- Payroll: `Your end time is sent to ADP for payroll. Your shift note stays in ATRIA-X for your coordinator to review.`

### Interaction / states
- Button disabled until `blockers.length === 0 && locationReady && !isLoading`.
- On success → `ShiftSuccessScreen`.
- Server outside-radius/permission errors surface in checklist and error banner.

---

## Frame: Submission Success

**Frame ID:** `1:157`  
**Component:** `ShiftSuccessScreen`  
**Primary width:** 390px

### Layout
- Centered card, large success circle + check.
- Title, body, receipt card, CTA.

### Copy
- Title: `All done, {firstName}! 🎉`
- Body: `Your shift notes for {clientName} have been sent to your coordinator. Thank you for taking good care of her.`
- Receipt label: `SENT`
- Receipt value: `Today at {time} · Awaiting review`
- CTA: `Back to home`

---

## Visual-review artifacts

The exported Figma PNGs are present in `.hermes-pipeline/20260624_185028/figma/`. Capturing live runtime screenshots of every caregiver state requires a running dev server and an authenticated Clerk session; this headless pipeline environment does not provide Clerk credentials, so runtime screenshots could not be produced. All component-level states are covered by the passing unit tests in `src/features/caregiver/components/ShiftDocumentationForm.test.tsx` and `ShiftClockOutScreen.test.tsx`.
