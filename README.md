# ATRIA-X MVP

ATRIA-X is a React + Vite + Clerk + Convex MVP for caregiving agencies.

The core workflow is:

1. A caregiver completes shift documentation.
2. A coordinator reviews the submitted documentation.
3. Only complete, approved shifts become billing-ready.

This matches the product rule: **no billed service without complete, validated documentation.**

## Roles

| Role               | Navigation                                           | Key Actions                                                                                                                                          |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agency Admin**   | Dashboard, Review, Billing, Clients, Team, Knowledge | Manage the agency, invite team members, change roles, manage clients, seed demo data, review as escalation, and create invoices from approved shifts |
| **Coordinator**    | Dashboard, Review, Billing, Clients, Knowledge       | Review submitted shifts, approve or request correction, download proof, and create billing invoices                                                  |
| **Caregiver**      | Today, Knowledge                                     | Document assigned shifts, complete task checklists, upload required proof, and read agency knowledge docs                                            |
| **Platform Admin** | Platform                                             | Internal ATRIA-X role for listing tenants and seeing member/client/shift counts                                                                      |

Agency admins do not use the caregiver **Today** workflow in normal operation. The **Today** nav item is caregiver-only. Platform admin access is separate from agency roles and is controlled by the `platformAdmins` Convex table.

## What Is Built

- Multitenant agency login with Clerk organizations.
- Agency bootstrap flow that creates/selects a Clerk organization and mirrors it to a Convex tenant.
- Convex backend tables scoped by `tenantId`.
- Role-aware navigation plus server-side tenant and role checks.
- Caregiver shift documentation workflow with native time inputs, required note fields, required proof upload, and Convex Storage proof removal.
- Coordinator review workflow with proof download, approval, correction requests, and review history.
- Billing workflow with ready-to-invoice lines, caregiver/date filters, invoice creation, CSV download, and a full billing ledger.
- Knowledge search with debounced vector search, deterministic 32-dimension embeddings, and admin/coordinator article creation.
- Knowledge visibility options for all staff or admins/coordinators only.
- Team management with server-created Clerk invitations, ATRIA-X invite redirects, and role assignment synced to Convex.
- Platform admin page at `/platform` for listing all tenants.
- Demo data seeding from the dashboard with idempotent upserts and partial repair.

## Tech Stack

- React 19
- Vite 8
- TypeScript
- Tailwind CSS 4
- Clerk React
- Convex
- React Router
- Vitest
- Playwright

## Setup

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

`.env.local` needs:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://tidy-crocodile-154.convex.cloud
```

Convex also needs the Clerk issuer domain set on the deployment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://capable-macaw-17.clerk.accounts.dev
npx convex env set CLERK_SECRET_KEY sk_test_...
```

Start the app:

```bash
npm run dev
```

Open the URL Vite prints, usually:

```text
http://localhost:5173
```

## First-Time Demo Setup

1. Sign in or sign up through Clerk.
2. Create or select an agency organization.
3. Land on the ATRIA-X dashboard.
4. Click **Seed demo data**.

The seed creates or repairs demo clients, shifts, progress notes, tasks, knowledge docs, one submitted shift, and one billing-ready line for the selected agency. Repeat clicks do not duplicate data; the banner reports whether records were created, skipped, or repaired.

For role-separated testing, invite separate caregiver and coordinator accounts from **Team**, then use **Clients > Schedule** or **Bulk schedule** to assign shifts to the caregiver. Shifts scheduled in the past or at the current time open for documentation; future shifts stay scheduled until their start time.

## Scripts

Run code quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run browser smoke tests:

```bash
npm run e2e
```

Regenerate Convex bindings after changing Convex functions or schema:

```bash
npx convex codegen
```

## Project Structure

```text
src/app              Providers, router, shells, route guards, agency selection
src/features         Product features grouped by workflow
src/shared           Shared UI primitives, formatting, and small utilities
convex               Backend schema, auth config, queries, mutations, actions
tests/e2e            Playwright browser smoke tests
```

Important feature folders:

```text
src/features/caregiver      Shift documentation UI and validation drafts
src/features/coordinator    Review queue and decision UI
src/features/billing        Billing invoice creation, CSV downloads, and ledger
src/features/clients        Agency client list and creation
src/features/team           Clerk invitation and role management
src/features/search         Knowledge search and article creation
src/features/platform       Platform admin tenant listing
```

## Important Notes

- The app is agency-multitenant. A Clerk organization maps to one ATRIA-X tenant.
- Every core agency table stores `tenantId`.
- Most app routes require an active Clerk organization. `/platform` only requires sign-in, then checks `platformAdmins`.
- Agency role checks use `org:admin`, `org:coordinator`, and `org:caregiver`.
- Role-specific screens are guarded in the React router and rechecked in Convex functions.
- Platform admins are not agency admins. They are tracked separately in `platformAdmins`.
- Proof upload uses Convex Storage plus metadata in the `files` table.
- Knowledge docs are text articles in `complianceDocs`; file attachments for knowledge docs are not implemented yet.
- Billing keeps the original Convex `exportBatches` table for compatibility, but the UI presents those records as invoices with invoice numbers and CSV downloads.
- Full signed-in Playwright E2E needs dedicated Clerk test credentials. Current Playwright tests cover unauthenticated route smoke checks.
- Convex auth uses Clerk's default session token. Clerk organization claims must be present, and `CLERK_JWT_ISSUER_DOMAIN` must match the Clerk instance.
- Clerk organization invitations are created server-side so invite emails redirect to `/accept-invitation` in ATRIA-X. This requires `CLERK_SECRET_KEY` in Convex environment variables.
- Secrets should stay in `.env.local`; only `.env.example` is committed.
