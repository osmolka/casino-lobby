# Progress

Keep this file under ~60 lines. Summarize; do not log every step. Update at the end of each phase.

## Status

| Phase | Scope | Status | Commit |
|---|---|---|---|
| 1 | Scaffold, themes, i18n, layout, fixture | done | phase 1 |
| 2a | Catalog data, filters, URL state (no UI) | done | phase 2a |
| 2b | Catalog UI and states | todo | |
| 3 | Wallet and deposit | todo | |
| 4 | Live feed | todo | |
| 5 | Promos, command palette (H3), polish | todo | |
| 6a | H4 accent, H1 Russian | todo | |
| 6b | H2 PWA | todo | |
| 6c | H5 jackpot (only if approved) | todo | |
| 7 | QA, RTL decision, submission docs | todo | |

Status values: `todo`, `in progress`, `done`, `blocked`, `dropped`.

## Decisions and deviations from PLAN.md
<!-- One line each: phase — decision — reason -->
- 1 — Pinned TS 6.0.3 / ESLint 9.39.5 (not latest 7.x / 10.x) — typescript-eslint needs TS <6.1; jsx-a11y supports ESLint ≤9.
- 1 — React 18.3.1 per §2 (19 is latest) — plan says React 18.
- 1 — Extra devDeps (approved): `@types/react@18`, `@types/react-dom@18`, `@testing-library/dom` (RTL peer), `@types/node`, `globals`. No `tsx`: generator runs on Node's native TS.
- 1 — Stylelint: `stylelint-use-logical@2.1.3` (§2 package), rule name is `csstools/use-logical: always` (also flags top/bottom → block-logical). Peer `stylelint >=11 <18` covers 17.16.
- 1 — `engines.node`: `^20.19.0 || >=22.12.0` = minimum for `npm install && npm start` (Vite 8). README must also say: `npm run check` needs Node `^22.22.2 || ^24.15 || >=26` (Vitest 5 / jsdom 30); `npm run gen:games` needs ≥22.18 (native TS).
- 1 — Font: Inter variable (latin, latin-ext incl. ₽, cyrillic) woff2 from Google Fonts in `public/fonts/` + `OFL.txt`.
- 1 — Language switcher renders only when >1 locale exists; palette trigger not rendered until phase 5.
- 1 — Fixture: `public/api/games.json` is a plain `Game[]`; seed 20261016, fixed reference date 2026-10-01 for `new` tag; one deliberately long title. A test asserts the committed JSON equals the generator output.
- 1 — Mobile feed = collapsible bar sticky at the bottom (DOM order main → aside matches visual order).
- 2a — Two-step URL parse: `parseFilters` checks format only (enums, slug regex, q trim/cap 100); `sanitize(games)` in the hook drops unknown prov/tag via replaceState once data loads (approved).
- 2a — Hook `useCatalogFilters` also canonicalizes a non-canonical URL on mount (replaceState) and keeps non-filter params (`mock`) verbatim after the filter params.
- 2a — `?mock=fail-catalog` → `CatalogError('network')` after the delay, so H2 offline fallback can be demoed with it. `slow` = +2500 ms.
- 2a — "All" = `null` in `Filters`; `sort=trending` is the default and is not written.
- 2a — Search: q split on whitespace, every token must be a substring of lowercase `title providerName` (in `filterGames`; URL keeps q as typed, trimmed). `toLowerCase`, no accent folding / ru matching: catalog data is English, H1 is UI only.

## Open issues
<!-- One line each: what, where, how to reproduce -->
- `npm audit`: 8 high, dev-only (braces via stylelint → globby/fast-glob), no fix upstream; `npm audit --omit=dev` = 0.
- Dev server shows unstyled content briefly (Vite injects CSS via JS in dev); theme attr is already correct. Preview/prod has no flash.

## For NOTES.md ("with a week")
- Search: accent/diacritic folding (`normalize('NFD')`) and locale-aware matching.

## Bonus claim status
<!-- H1–H5: claimed / not claimed + one-line reason. Filled during phases 6–7. -->

## Next
<!-- What the next session should start with -->
Phase 2b: UI on top of `useCatalogFilters` (call `sanitize(games)` after load) + `fetchCatalog({ signal })` (ignore AbortError). Error text via `CATALOG_ERROR_KEYS[kind]`; `catalog.error.*` keys exist, add the rest of the 2b UI keys.
