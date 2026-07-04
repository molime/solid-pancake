# SESSION 6 Figma caregiver wizard screen spec

Source: talk-to-figma channel `wzkdzbsj`, document `Page 1`.
Primary canvas size: 390 × 844 mobile frames, dark background `#0b0f10`.
Dark tokens observed: background `#0b0f10`, elevated/card `#151b1d`, field `#1b2326`, progress track `#1e2629`, border `#2a3437` / `#3f4d51`, text primary `#f5f7f6`, secondary `#9aa6a8`, muted `#687173`, success/primary green `#22c55e` / `#48d480`.
Step accents: When blue `#3b82f6`; What purple `#a855eb`; How amber `#f59e0b`; Goal teal `#14b8a6`; Issues red `#ef4444`; Done green `#22c55e`.
Standard spacing: 24px page gutter; 342px content width; 8px progress bar at y=92; major cards radius 16-20; primary CTA 342×56 or 342×64 pill radius 28-32; bottom nav buttons at y=760.

Exported PNGs:
- Today/entry — frame `1:151`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_91f471425665.png`
- Clock In — frame `201:3872`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_4e367f979e41.png`
- Step1 When — frame `1:152`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_36e82fc13798.png`
- Step2 What — frame `1:153`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_3289e7713ecb.png`
- Step3 How — frame `1:129`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_ce4c78f332be.png`
- Step4 Goal — frame `1:154`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_603496355d9d.png`
- Step5 Issues — frame `1:155`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_3d4dd53b5d7b.png`
- Step6 Done — frame `1:156`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_e9e2adc4dd76.png`
- Clock Out — frame `201:3873`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_134bc54f767c.png`
- Submission success — frame `1:157`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_093ed215dd51.png`
- States/edge cases gallery — frame `1:808`, PNG `C:\Users\pinol\AppData\Local\hermes\image_cache\img_4f037812b3cb.png`

Frame notes and exact copy:

1. `1:151` Caregiver / Entry — Today
- Header: `Good morning, Ana 👋`; subhead `Tuesday, June 4`.
- Section: `Your visit today`.
- Visit card 342×200 at x=24 y=192, card bg `#151b1d`, border `#2a3437`, r20.
- Status pill: `UPCOMING` in tinted blue/green pill.
- Visit text: `Maria Lopez`; `🕐 9:00 AM – 1:00 PM  ·  4 hours`; `📍 1820 Oak Street, Apt 4`; warning `⚠ Shift notes not started yet` in amber.
- CTA: 342×64 green pill `Clock in & start  →`.
- Helper: `It only takes a few minutes. We'll guide you step by step.`
- Footer: `Need help? Call your coordinator`.

2. `201:3872` Caregiver / Clock In
- Header: `Clock in`; subhead `Start your shift to begin your notes.`
- Visit card: `Maria Lopez`; `🕐 9:00 AM – 1:00 PM  ·  4 hours`; `📍 1820 Oak Street, Apt 4`.
- Clock card: label `CURRENT TIME`; large green time `9:02 AM`.
- CTA: green 342×64 pill `Clock in now  →`.
- Payroll note: `Your start time is sent to ADP for payroll. You can begin your shift notes right after clocking in.`
- Footer: `Need help? Call your coordinator`.
- State behavior: before clock-in, note steps locked. If geofence enforcement is enabled, request browser location before calling clockIn; show checking/permission/blocked in same dark card style. If disabled, no geolocation request or blockers.

3. `1:152` Caregiver / Step 1 — When?
- Accent blue `#3b82f6`.
- Top row: `Step 1 of 6`, `Autosaved ✓`; progress fill 57/342.
- Title: `When were you there?`; helper `Check the times are right. Tap to change if needed.`
- Cards: `I started at` / `9:00 AM` / `Change`; `I finished at` / `1:00 PM` / `Change`.
- Bottom: outline `Back`; blue `Next Step  →`.

4. `1:153` Caregiver / Step 2 — What?
- Accent purple `#a855eb`; progress fill 114/342.
- Title: `What did you help with?`; helper `Tap everything you did today. You can pick more than one.`
- Selected tiles: `🛁 Bathing ✓`, `🍽️ Meals ✓` with purple tint/stroke.
- Unselected tiles: `🚶 Walking`, `💊 Medication`, `🧹 Housekeeping`, `💬 Company`.
- Bottom: `Back`; purple `Next Step  →`.

5. `1:129` Caregiver / Step 3 — How?
- Accent amber `#f59e0b`; progress fill 171/342.
- Title: `How did the visit go?`; helper `Tell us in your own words what you helped with and how Maria was doing.`
- Focused textarea 342×200, amber stroke, sample note: `I helped Maria with her morning bath and got her dressed. She ate all of her breakfast and was in good spirits. We did her walking exercises in the hallway for about 15 minutes.`
- Validation: `✓ Looking good! Nice and clear.` and `178 characters`.
- Prompt: `Need ideas? Tap a quick phrase:` chips `+ Bathing`, `+ Ate well`, `+ In good spirits`.
- Bottom: `Back`; amber `Next Step  →`.

6. `1:154` Caregiver / Step 4 — Goal
- Accent teal `#14b8a6`; progress fill 228/342.
- Title: `Did you work on her goals?`; helper `These are Maria's care plan goals. Tap the ones you helped with today.`
- Selected goal cards: `Walk a little each day` / `Goal: stay mobile and steady` / `✓`; `Eat full meals` / `Goal: keep her strength up` / `✓`.
- Unselected: `Spend time talking` / `Goal: feel less lonely` / `○`.
- Bottom: `Back`; teal `Next Step  →`.

7. `1:155` Caregiver / Step 5 — Issues?
- Accent red in header/progress, but the happy path CTA is green.
- Title: `Anything we should know?`; helper `Did anything go wrong, or did Maria seem unwell? It's okay if not.`
- Choices: selected green `😊` / `No, all good today` / `Everything went fine`; unselected dark `⚠️` / `Yes, I need to report something` / `A fall, pain, mood change, or other concern`.
- Bottom: `Back`; green `Next Step  →`.

8. `1:156` Caregiver / Step 6 — Done
- Accent green, full progress.
- Title: `One last look 👀`; helper `Check everything looks right, then send it to your coordinator.`
- Review card labels: `TIME`, `WHAT YOU HELPED WITH`, `YOUR NOTES`, `ISSUES` plus `Edit` link.
- Values: `9:00 AM – 1:00 PM`; `Bathing · Meals · Walking goal`; note quote; `✓ No problems — all good today`.
- Confirmation checkbox: `I confirm this is accurate and true.`
- CTA: green `Submit my notes  ✓`; back text `← Go back and change something`.

9. `201:3873` Caregiver / Clock Out
- Header: `Clock out`; subhead `Your shift notes are complete. You can clock out now.`
- Done pill: `✓ SHIFT NOTE DONE`.
- Clock card: `CURRENT TIME`; `1:04 PM`.
- Summary: `Shift summary`; `Maria Lopez · 9:02 AM – 1:04 PM`.
- CTA: green `Clock out now  →`.
- Payroll note: `Your end time is sent to ADP for payroll. Your shift note stays in ATRIA-X for your coordinator to review.`
- State behavior: button disabled until note complete and, if geofence enabled, location is available/in-radius. Show a missing checklist for incomplete note/location items. Server outside-radius/permission errors render plain-language blocked state.

10. `1:157` Caregiver / Success
- Success circle: green tint, large check.
- Title: `All done, Ana! 🎉`.
- Body: `Your shift notes for Maria Lopez have been sent to your coordinator. Thank you for taking good care of her.`
- Receipt card: label `SENT`; `Today at 1:04 PM · Awaiting review`.
- CTA: `Back to home`.

Validation/state requirements:
- Use live inline validation, one question per step.
- Autosave indicator must be visible for guided steps.
- Status must always be color plus word/icon/copy, never color alone.
- Touch targets must be at least 44px; CTAs in the Figma are 56–64px tall.
- Geofence disabled: never call `navigator.geolocation` and hide location blockers.
- Geofence enabled: call geolocation for clock-in/out, show permission/checking/blocked states, pass location to Convex mutations.
- Server-side gating remains authoritative; UI only reflects and explains it.
