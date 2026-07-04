# stage plan_opus
# cmd: hermes chat -q 'Read the file at C:\Users\pinol\Documents\Work\atriax\solid-pancake\.hermes-pipeline\20260604_163200\plan_opus.prompt.md and carry out its instructions completely and autonomously. Do not ask questions; make reasonable decisions and finish the task. Output your final result (plan / review / summary) as your last message.' -m claude-opus-4-8 --provider anthropic --yolo -Q

Exception in thread Thread-3 (_readerthread):
Traceback (most recent call last):
  File "C:\Users\pinol\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\Lib\threading.py", line 1045, in _bootstrap_inner
    self.run()
  File "C:\Users\pinol\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\Lib\threading.py", line 982, in run
    self._target(*self._args, **self._kwargs)
  File "C:\Users\pinol\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\Lib\subprocess.py", line 1599, in _readerthread
    buffer.append(fh.read())
                  ^^^^^^^^^
  File "<frozen codecs>", line 322, in decode
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xf3 in position 13: invalid continuation byte
I have all the context I need. Here is the implementation plan.

---

# Stage 0 Foundation — Shared Design-System Primitives: Implementation Plan

## 1. Goal & Acceptance Criteria

**Goal:** Add reference-independent, additive UI primitives and accessibility/size improvements to ATRIA-X's shared design system (`src/shared/ui/`) **without** altering the brand palette or any token values in `src/index.css`. All work is presentational — no Convex, no data fetching, no feature-page or backend changes.

**Acceptance criteria:**
- [ ] `Button.tsx` exposes a `lg` size with a **min 44px touch target** and `text-base`; all existing variants/sizes (`primary/secondary/danger/ghost/sidebar/sidebarActive` × `sm/md/lg/icon/sidebar`) remain intact and unchanged in behavior.
- [ ] Four new primitives exist in `src/shared/ui/`: `EmptyState.tsx`, `ProgressSteps.tsx`, `FieldGroup.tsx`, `Toast.tsx` — each presentational only.
- [ ] All four (and any sub-exports) are re-exported from `src/shared/ui/index.ts`.
- [ ] Every new primitive has a colocated Vitest component test (`*.test.tsx`) following the repo's Testing-Library style.
- [ ] No new dependencies (no Radix/shadcn). Uses only existing deps: `class-variance-authority`, `lucide-react`, `cn` from `@/shared/lib/cn`.
- [ ] No edits to `src/index.css` tokens, no edits to `convex/*`, no feature-page edits.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` all pass.
- [ ] Repo conventions honored: TS, function components, single quotes, **no semicolons**, 2-space indent, `--color-atria-*` tokens via Tailwind classes (`bg-atria-accent`, etc.).

**Note on `lg`:** A `lg` size *already exists* in `Button.tsx` as `'h-10 px-5'` (40px). This does **not** meet the 44px/`text-base` requirement. The task is therefore an *upgrade in place* of the existing `lg` token, not an additive new key — chosen to avoid a duplicate-key conflict and keep the variant name stable.

## 2. Files to Create / Modify

**Modify:**
- `src/shared/ui/Button.tsx` — redefine `lg` size → `'min-h-[44px] px-5 text-base'`.
- `src/shared/ui/index.ts` — add four new export lines.

**Create (components):**
- `src/shared/ui/EmptyState.tsx`
- `src/shared/ui/ProgressSteps.tsx`
- `src/shared/ui/FieldGroup.tsx`
- `src/shared/ui/Toast.tsx`

**Create (tests):**
- `src/shared/ui/Button.test.tsx` (new — none exists today; covers the `lg` upgrade + regression on existing variants)
- `src/shared/ui/EmptyState.test.tsx`
- `src/shared/ui/ProgressSteps.test.tsx`
- `src/shared/ui/FieldGroup.test.tsx`
- `src/shared/ui/Toast.test.tsx`

## 3. Step-by-Step Implementation

### 3.1 Button `lg` upgrade
In `buttonStyles` cva `size` map, replace `lg: 'h-10 px-5'` with `lg: 'min-h-[44px] px-5 text-base'`. Use `min-h-[44px]` (not fixed `h-`) so vertical padding can grow content while guaranteeing the 44px WCAG 2.5.5 touch target. Leave `defaultVariants` (`secondary`/`md`) untouched. No prop/type changes needed — `VariantProps` already derives `lg`.

### 3.2 EmptyState.tsx
Presentational no-data block. Pattern after `Badge.tsx`/`Input.tsx` (no cva needed — single visual form).
- Props: `{ icon?: LucideIcon, title: string, description?: string, action?: ReactNode, className?: string }`.
- `icon` typed as `LucideIcon` from `lucide-react`; render inside a muted circle (`text-atria-muted`, `bg-atria-bg`).
- Layout: centered column, `title` in `text-atria-ink font-medium`, `description` in `text-atria-muted text-sm`, optional `action` slot below (caller passes a `<Button size='lg'>`).
- `role='status'` on the container for a11y of empty/loading states.

### 3.3 ProgressSteps.tsx
Numbered step indicator for guided flows (e.g. shift documentation).
- Props: `{ steps: { label: string }[], current: number, orientation?: 'horizontal' | 'vertical', className?: string }`.
- Derive per-step state: index `< current` → `complete`, `=== current` → `current`, `> current` → `upcoming`.
- Use cva (`stepStyles`) keyed on a `state` variant to match the Button/Badge cva pattern:
  - complete → `bg-atria-accent text-white` + `Check` icon from lucide-react.
  - current → `border border-atria-accent text-atria-accent` (ring emphasis).
  - upcoming → `border border-atria-border text-atria-muted`.
- Container `role='list'`, each step `role='listitem'`; `aria-current='step'` on the current node. Orientation toggles `flex-row`/`flex-col` and connector orientation.

### 3.4 FieldGroup.tsx
Accessible wrapper around form inputs with larger readable labels.
- Props: `{ label: string, htmlFor?: string, helperText?: string, error?: string, required?: boolean, children: ReactNode, className?: string }`.
- Render `<label>` (`text-atria-ink font-medium text-sm`, `htmlFor` wired), the `children` slot (the actual `Input`/`Textarea`/`Select`), helper text (`text-atria-muted text-xs`) when no error, and error text (`text-atria-danger text-xs`) when `error` set.
- Required → append a `*` with `aria-hidden` and `aria-required` semantics left to the input.
- Error path: give error node an `id` and `role='alert'` so it announces; helper hidden when error present.

### 3.5 Toast.tsx
Inline/transient feedback message.
- cva `toastStyles` with `variant`: `success` (`bg-atria-success-bg text-atria-success`), `error` (`bg-atria-danger-bg text-atria-danger`), `info` (`bg-atria-info-bg text-atria-info`) — reusing the exact token families `Badge.tsx` already uses.
- Props: `{ variant?: 'success' | 'error' | 'info', message: string, onDismiss?: () => void, className?: string }`.
- Lucide icon per variant (`CheckCircle2`/`AlertCircle`/`Info`). Optional dismiss `<button>` (`X` icon, `aria-label='Dismiss'`).
- `role='status'` + `aria-live='polite'` container. **Presentational only** — auto-dismiss timing is the caller's responsibility (keeps it pure/testable; no `useEffect` side effects required, though an optional `durationMs` with internal `setTimeout` could be added if desired — default plan keeps it controlled to stay strictly presentational).

### 3.6 index.ts exports
Append:
```
export { EmptyState } from './EmptyState'
export { ProgressSteps } from './ProgressSteps'
export { FieldGroup } from './FieldGroup'
export { Toast } from './Toast'
```
(Single quotes, no semicolons — matches existing lines.)

### 3.7 Conventions / compiler safety
- `verbatimModuleSyntax: true` → use `import type` for all type-only imports (`LucideIcon`, `ReactNode`, `VariantProps`, HTML attr types).
- `noUnusedLocals/Params: true` → no dead vars; destructure only what's used.
- `erasableSyntaxOnly` → no enums/parameter properties; use string-literal union types.
- Use `cn` from `@/shared/lib/cn` (re-export of `@/shared/utils/cn`) to match Button/Badge.

## 4. Test Plan

**Framework:** Vitest + jsdom + Testing Library + `@testing-library/jest-dom` (setup at `src/test/setup.ts`). Mirror the import style in `ClientsPage.test.tsx` (`import { describe, it, expect } from 'vitest'`, `render, screen` from `@testing-library/react`, `userEvent` for interaction). These primitives need **no Convex/Clerk mocks** since they're presentational — simpler than feature tests.

**Unit cases:**
- **Button.test.tsx:** renders children; `size='lg'` element has classes `min-h-[44px]` and `text-base`; default renders `secondary`+`md` classes; `variant='primary'` → `bg-atria-accent`; custom `className` is merged; `onClick` fires via `userEvent`; `disabled` prevents click.
- **EmptyState.test.tsx:** renders `title`/`description`; renders `action` node when provided and omits when absent; renders passed icon; container has `role='status'`.
- **ProgressSteps.test.tsx:** renders all step labels; step at `current` index has `aria-current='step'`; steps before current render the complete/`Check` state; `orientation='vertical'` applies column layout class; guards `current` at bounds (0 and last).
- **FieldGroup.test.tsx:** label text + `htmlFor` association; helper text shown when no error; error text shown with `role='alert'` and helper hidden when `error` set; `required` reflected; children (an `<input>`) rendered.
- **Toast.test.tsx:** renders message; correct variant token class for success/error/info; dismiss button calls `onDismiss` via `userEvent`; no dismiss button when `onDismiss` omitted; container `role='status'`.

**E2E (Playwright):** No new specs required — these are sub-components not yet wired into routes, and current E2E covers signed-out smoke flows only. Wiring into feature pages is out of scope (explicitly forbidden by the task). Note in PR that visual integration E2E follows in later stages.

**Stress / automated considerations:** ProgressSteps must not crash with `steps=[]`, `current` out of range, or single-step arrays — add boundary assertions. Toast/EmptyState must handle long strings without layout assertions failing (test behavior/roles, not pixel widths). Keep tests deterministic — no timers unless `durationMs` is implemented (then use `vi.useFakeTimers()`).

## 5. Risks, Security & Edge Cases

- **Palette invariant:** Hard rule — do not touch `src/index.css`. Only consume existing `--color-atria-*` via Tailwind utility classes already proven in `Badge.tsx`. Risk of accidental new color: mitigated by reusing Badge's exact token classes.
- **Existing `lg` consumers:** Changing `lg` from `h-10` to `min-h-[44px] text-base` could enlarge any current `size='lg'` button. Search usages before merge (`size='lg'` / `size="lg"`); since this is Stage 0 and `lg` is rarely used, impact is expected minimal — verify visually in dev. This is an intentional accessibility upgrade, consistent with the task.
- **HIPAA / multi-tenancy / auth:** **No exposure.** These primitives are presentational, render only props, perform no data fetching, hold no PHI, and touch no Convex/auth path. No `authHelpers`, `requireTenant`, or tenant data involved. The central billing/approval invariant is untouched. The only residual concern is that callers must not pass PHI into these components in contexts lacking auth — but that's a downstream integration responsibility, out of scope here.
- **a11y edge cases:** ensure `role`/`aria-current`/`aria-live` are correct so screen readers announce step changes and toasts; FieldGroup error must use `role='alert'`.
- **TS strictness:** unused-param/local and `verbatimModuleSyntax` are the most likely build breakers — enforce `import type` and clean destructuring.

## 6. Rollback / Verification

**Verification (run from repo root):**
```bash
npm run lint
npm run typecheck      # tsc -b, catches import type / unused issues
npm run test           # vitest run — all new + existing specs green
npm run build          # optional final gate (typecheck + bundle)
```
No `npx convex codegen` needed — zero backend/schema changes.

**Manual smoke (optional):** `npm run dev`, drop the primitives onto a scratch route to eyeball the `lg` 44px target, ProgressSteps states, Toast variants, EmptyState, and FieldGroup error/helper toggling — then remove the scratch usage (do not commit feature-page edits).

**Rollback:** All changes are additive/isolated. To revert: delete the four new component files + four new test files + `Button.test.tsx`, remove the four export lines from `index.ts`, and restore the single `lg` line in `Button.tsx` to `lg: 'h-10 px-5'`. No migrations, no generated code, no backend state — clean `git revert` of the single commit fully restores prior behavior.

---

**Known environment caveat (for the implementer/runner):** per pipeline notes, this repo's Vitest 4.x requires Node ≥20.19/22.12; the pipeline prepends the bundled Node v22 (`C:\Users\pinol\AppData\Local\hermes\node`) to PATH so gates can run. Ensure deps are installed (`npm install`) before running gates.

session_id: 20260604_163205_a42eb2
