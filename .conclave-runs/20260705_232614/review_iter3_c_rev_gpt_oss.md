# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The change introduces a complete dev‑only screenshot harness with realistic mock data, conditional Vite aliasing, and new routing for the harness while keeping production untouched. All required mock modules (`@clerk/react`, `convex/react`) are provided, the week‑view data matches the Figma spec, and the `ScreenshotHarnessPage` correctly renders the requested views. Router updates conditionally expose the `/dev/screenshots` route only in dev with the flag, and the Sidebar now includes the new navigation items. New components (`CoverageRequestsPanel`, `ShiftEditorModal`, `ShiftPacketPanel`) are fully implemented and covered by extensive unit tests, which all pass. The Vite config now conditionally applies aliases based on `VITE_ENABLE_SCREENSHOT_MOCKS`, and `src/main.tsx` includes a Date override for consistent rendering. No production code imports dev files, no new runtime dependencies are added, and the existing test suite (including the new alias guard test) passes.

All acceptance criteria are satisfied, and there are no evident security, PHI, or regression concerns.

VERDICT: APPROVED