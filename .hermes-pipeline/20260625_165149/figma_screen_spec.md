# ATRIA-X Session 7 Figma screen spec — coordinator review & approval

Source Figma channel: q21hjw9j
Parent Hermes joined channel and exported target frames before launching the pipeline.

## Exported PNGs
- Coordinator / Dashboard — frame `1:291` — `C:\Users\pinol\AppData\Local\hermes\image_cache\img_7681b2de40de.png`
- Coordinator / Review Queue — frame `1:399` — `C:\Users\pinol\AppData\Local\hermes\image_cache\img_f1558cdf10ec.png`
- Coordinator / Review Detail — frame `1:400` — `C:\Users\pinol\AppData\Local\hermes\image_cache\img_8b0676c66f64.png`

## Shared desktop shell and tokens
- Canvas: 1440 × 1024, desktop-first. Background `#0b0f10`.
- Sidebar: 248 px wide, fill `#101517`; logo mark 40 × 40, radius 10, fill `#22c55e`, black `A`; `ATRIA-X` wordmark white.
- Cards: fill `#151b1d`, stroke `#2a3437`, radius 16.
- Dark controls: fill `#1b2326`, stroke `#2a3437`, radius 10-12.
- Primary green: `#22c55e`; green text `#48d480`; amber `#f59e0b`/`#fbb451`; red `#ef4444`/`#f87777`; blue `#3b82f6`; purple `#a855eb`; teal `#14b8a6`.
- Text colors: primary `#f5f7f6`, secondary `#cfd2d4`, muted `#9aa6a8`, dim `#687173`, near-black `#0b0f10`.
- Typography: Inter in Figma; match sizes: page h1 26/31 bold, card heading 18/22 bold, nav 16/19, table/body 15-16, captions/labels 13-14 uppercase/bold.
- Spacing: main content starts x=288 on dashboard/queue after sidebar. Detail starts x=48 with no sidebar. Top page y=40. Card gaps 24 px. KPI grid 4 columns, 266 × 132.
- Status must be color + word, never color only.
- Responsive behavior: desktop is acceptance target. Below desktop, stack cards vertically, preserve big primary actions, keep readable 16 px body and 44+ px targets.

## Coordinator / Dashboard — frame 1:291
PNG: `C:\Users\pinol\AppData\Local\hermes\image_cache\img_7681b2de40de.png`

Exact copy visible: `Good afternoon, Carla`; `Here's what needs your attention today.`; `🔍  Search caregivers, clients…`; `+ Quick Actions`; nav `▦  Overview`, `◷  Documentation`, `✓  Compliance`, `🎓  Training`, `👥  Caregivers`, `🔔  Alerts`, `⚙  Settings`; profile `CN`, `Carla Núñez`, `Coordinator`; KPI cards `Total Caregivers`/`48`/`▲ 2 new this month`, `Compliance Rate`/`94%`/`▲ 3% vs last month`, `Pending Documents`/`12`/`● 4 need review now`, `Training Due`/`5`/`● 2 overdue`; card `Employee Compliance Status`, `View all →`; rows `Maria González` / `Home Health Aide · 12 clients` / `● Compliant` / `100%`, `James Carter` / `Personal Care Aide · 8 clients` / `● Warning` / `68%`, `Maria Lopez` / `Home Health Aide · CPR expired` / `● Critical` / `40%`, `Aisha Mohammed` / `Personal Care Aide · 10 clients` / `● Compliant` / `93%`; card `Supervisor Alerts`, badge `3`; alerts `CRITICAL · ACTION REQUIRED`, `Maria Lopez · CPR expired`, `Blocks billing for 3 visits · Tap to resolve`; `WARNING`, `James Carter · 2 notes overdue`, `From yesterday's shifts · Send reminder`; `CERTIFICATION`, `First Aid renewal · 19 days left`, `3 caregivers affected · Schedule training`.

## Coordinator / Review Queue — frame 1:399
PNG: `C:\Users\pinol\AppData\Local\hermes\image_cache\img_f1558cdf10ec.png`

Exact copy visible: `Documentation to review`; `8 shift notes are waiting for your review.`; filters `Pending · 8`, `Approved · 24`, `Returned · 2`; headers `CAREGIVER & CLIENT`, `SHIFT`, `STATUS`; rows: `Ana Silva  →  Maria Lopez` / `Submitted 1:04 PM today` / `9:00 AM – 1:00 PM` / `● Awaiting review` / `Review →`; `Marcus Green  →  Robert Hill` / `Submitted 12:46 PM today` / `8:00 AM – 12:30 PM` / `● Awaiting review` / `Review →`; `Julia Costa  →  Eleanor Park` / `⚠ Flagged an issue · needs attention` / `7:30 AM – 11:30 AM` / `● Issue flagged` / `Review →`; `Aisha Mohammed  →  Frank Diaz` / `Submitted 11:15 AM today` / `7:00 AM – 11:00 AM` / `● Awaiting review` / `Review →`; `Rosa Díaz  →  Helen Webb` / `Submitted 10:32 AM today` / `8:30 AM – 10:30 AM` / `● Awaiting review` / `Review →`.

Implementation requirement delta from prompt: real queue status pills must use exact business words and colors: `Submitted` (info), `Needs correction` (red), `Approved` (green), always color + word. Include filters for all three states and loading/empty/populated states.

## Coordinator / Review Detail — frame 1:400
PNG: `C:\Users\pinol\AppData\Local\hermes\image_cache\img_8b0676c66f64.png`

Exact copy visible: `←  Back to Documentation`; `AS`; `Ana Silva's shift notes`; `Client: Maria Lopez · Tue, June 4 · 9:00 AM – 1:00 PM · Submitted 1:04 PM`; sections `🕐  WHEN` / `9:00 AM – 1:00 PM (4 hours)`, `🧩  WHAT THEY HELPED WITH` / `Bathing · Meals · Walking`, `✍  HOW THE VISIT WENT (in Ana's words)` / `"I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes."`, `🎯  CARE PLAN GOALS WORKED ON` / `✓ Walk a little each day   ✓ Eat full meals`, `🩺  ISSUES REPORTED` / `✓ No problems — all good today`, `CAREGIVER CONFIRMATION` / `✓ Ana confirmed this is accurate and true · Signed 1:04 PM, June 4`, `VERIFICATION` / `📍 Location matched client address   ⏱ Submitted from on-site`; action card `Your decision`; `If everything looks right, approve it. If something needs fixing, send it back with a note.`; Figma buttons `✓  Approve note` and `↩  Request a correction`, but product copy must be `Approve` and `Request Correction`; dependency copy `Approving releases this note for billing.`; history `Note submitted by Ana Silva` / `Today · 1:04 PM`, `Accuracy confirmed · location verified` / `Today · 1:04 PM`, `Waiting for your review` / `You · now`.

Functional and test requirements: use existing `convex/reviews.ts`; keep tenant access through authHelpers; use shared UI + `@/shared/lib/cn`; tests for queue loading/empty/populated, approve mutation, request-correction mutation, required correction comment; acceptance screenshots against Figma; gates lint/typecheck/test/build green before success.
