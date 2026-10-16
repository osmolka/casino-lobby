# Casino Lobby — agent instructions

Frontend test task. Spec: `casino-lobby-test.md`. Decisions and phases: `PLAN.md` (source of truth). State between sessions: `PROGRESS.md`.

## Commands
- `npm start` — dev server
- `npm run check` — lint + typecheck + unit tests (the gate for every phase)
- `npm run build` / `npm run start:pwa` — production build / build + preview
- `npm run test:e2e` — Playwright against the preview build

Reporters are configured for short output. Do not pipe commands through `tail`, `head` or `grep`: piped commands need manual approval.

## Workflow
- One phase per session. Read `PROGRESS.md` and only the `PLAN.md` sections named in the task, not the whole file.
- Before coding, reply with a plan of max 10 lines (files, functions, test cases) and wait for OK.
- Pure logic (filters, URL state, wallet reducer, fuzzy scoring) gets tests first, implementation second.
- Make targeted edits. Do not rewrite whole files unless asked.
- Done = `npm run check` passes. Quote its final lines in the report.
- End of phase: update `PROGRESS.md`, then commit as `phase <id>: <summary>`.
- If the same check fails 3 times, stop and report what you tried.
- If the plan is ambiguous or contradicts the spec, ask. Do not assume.

## Verify, don't recall
- Package versions: `npm view <pkg> version`. Never invent package names.
- Dependencies outside the list in `PLAN.md` §2: ask before adding.
- Library APIs and config options: check types or README in `node_modules/<pkg>`. Applies especially to `vite-plugin-pwa`, `stylelint-use-logical`, Playwright, axe.
- Never state that a check passed without running it in this session.

## Hard rules (details in PLAN.md §3)
- No UI strings in components, including `aria-label`, `placeholder`, `title`, `alt`. English (`en`) is the default locale and the source of the `Messages` type.
- CSS: logical properties only (`*-inline-*`, `*-block-*`, `start/end`). Physical `left/right` is a lint error.
- Money: integer minor units only.
- Every async region: skeleton, error with retry, empty state. No spinners.
- Keyboard-operable everything; visible focus; `aria-label` on icon-only buttons.
- Clean up timers, listeners and rAF; effects must be StrictMode-safe.
- `localStorage` access wrapped in `try/catch`.
- Zero console errors and warnings in dev and preview.
- Service worker registers only when `import.meta.env.PROD`.

## Report format
Keep it short. Do not recap the code you wrote.
1. Files changed
2. Commands run and result (final lines)
3. Deviations from `PLAN.md` and why
4. Open questions
