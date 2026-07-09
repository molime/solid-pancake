# http://localhost:11434/api/chat
# model=gpt-oss:120b-cloud status=200

The change adds the full candidate lifecycle API, integrates it with existing auth, invitation, ADP sync, and audit mechanisms, and updates the schema with needed indexes and fields. All required mutations and queries are implemented, role‑based guards are enforced, candidate‑to‑Clerk user linking is handled in `members.sync`, and the ADP sync worker is scheduled on hire. The schema now supports task ordering and candidate lookup by Clerk user. Lint, type‑checking, and the full test suite all pass.

No security concerns or PHI leaks are introduced, and the mutation logic is idempotent where required (e.g., employee profile upserts, ADP sync scheduling). The missing platform‑training functions are already present in `convex/onboarding.ts`, and the generated API correctly re‑exports them.

All task requirements are satisfied and the implementation is stable.

VERDICT: APPROVED