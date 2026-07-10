# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

**Review Summary**

The submitted changes address the majority of the acceptance criteria and bring the test suite to a green state, but one critical requirement remains unmet.

### Completed Acceptance Criteria
| AC | Requirement | Status |
|----|-------------|--------|
| **AC‑2** | Added explicit assertions in `convex/onboarding.test.ts` for `form_submission` task completion and ADP sync status after hiring. | ✅ Implemented and verified. |
| **AC‑3** | Added cross‑caregiver overlap test, `excludeShiftId` test, and audit‑event verification in `convex/scheduling.test.ts`. | ✅ Implemented and verified. |
| **AC‑4** | Added test for multiple missing required fields and thin wrappers for `updateDocumentArchiveItem` in `convex/forms.test.ts`. Updated `convex/forms.ts` to list all missing fields. | ✅ Implemented and verified. |
| **AC‑5** | Implemented idempotent Phase 2 fixtures in `convex/seed.ts` (candidate, availability, coverage request, form definition, document archive items) and added a comprehensive test in `convex/seed.test.ts`. | ✅ Implemented and verified. |
| **AC‑6** | All gates (`lint`, `typecheck`, `test`, `e2e`, `build`) now pass (see gate logs). | ✅ Verified. |
| **AC‑7** | No modifications to `convex/_generated/`. | ✅ Confirmed. |

### Outstanding Acceptance Criterion
| AC | Requirement | Current Gap |
|----|-------------|-------------|
| **AC‑1** | *E2E `scheduling.spec.ts`* – “Send request” button must be scrolled into view (or forced) before clicking, and stale‑shift conflicts must be eliminated. | The test file `tests/e2e/scheduling.spec.ts` was **not** modified. The click still uses a plain `.click()` which can fail with “outside of the viewport”. While the seed cleanup now removes stale shifts, the viewport issue remains unaddressed.

### Additional Observations
* **Security / PHI** – No new exposure of sensitive data. The added role `org:candidate` in `convex/files.ts` aligns with existing guard patterns.
* **Idempotency** – The new `deleteFixtureCaregiverShifts` function robustly deletes both current‑day and future shifts for all fixture caregivers, preventing cross‑run contamination.
* **Code Quality** – All new code follows the project’s 2‑space, single‑quote style and respects existing guard conventions.

### Required Change
Modify **`tests/e2e/scheduling.spec.ts`** to ensure the “Send request” button is reliably clickable:

```ts
// Example fix (apply to the relevant line)
const sendBtn = page.locator('button:has-text("Send request")')
await sendBtn.scrollIntoViewIfNeeded()
await sendBtn.click({ force: true }) // fallback if still off‑screen
```

Optionally add a short `await page.waitForTimeout(100)` after opening the coverage panel to let UI settle.

No other code changes are needed.

---  
**Requested Action:** Implement the above modification to `tests/e2e/scheduling.spec.ts` and re‑run the full gate suite to confirm that `npm run e2e` now passes without viewport errors.

VERDICT: CHANGES_REQUESTED