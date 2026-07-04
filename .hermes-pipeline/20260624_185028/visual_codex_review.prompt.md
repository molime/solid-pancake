# ATRIA-X Session 6 visual fidelity review

You are doing a focused visual/design review only. Compare the attached Figma PNGs against the attached runtime screenshots generated from the Clerk-free visual harness.

Context:
- The real app is Clerk-protected, so a test-only visual harness was used. It mocks Clerk/Convex and renders the real caregiver components at mobile width.
- Do NOT complain that Clerk is bypassed; that is intentionally test-only for visual review.
- Do NOT request unrelated refactors or broad polish. Only report real, visible Figma-fidelity issues that materially affect acceptance.
- If differences are minor and acceptable, say so.
- Prioritize: exact copy, screen order, major layout/card shape, step controls (service tiles, goal cards, issue choices, confirmation checkbox), colors/tokens, disabled/loading/geofence blocked states.

Attached images are in this order:
Figma references:
1 today_entry
2 clock_in
3 step1_when
4 step2_what
5 step3_how
6 step4_goal
7 step5_issues
8 step6_done
9 clock_out
10 success
11 states_edge_cases

Runtime screenshots:
12 today
13 clock_in
14 clock_in_geofence
15 step1_when
16 step2_what
17 step3_how
18 step4_goal
19 step5_issues
20 step6_done
21 clock_out
22 success

Return:
- VERDICT: APPROVED if the runtime is sufficiently faithful for engineering acceptance.
- VERDICT: CHANGES_REQUESTED only if there are concrete high-value visual/copy/control mismatches worth fixing before commit.
- If requesting changes, list only actionable blockers with the screen name and the exact mismatch.
