# Progress

Keep this file under ~60 lines. Summarize; do not log every step. Update at the end of each phase. Status values: `todo`, `in progress`, `done`, `blocked`, `dropped`.

## Status
- done: 1 scaffold/themes/i18n/layout/fixture · 2a catalog data/filters/URL · 2b catalog UI · 3 wallet/deposit · 4 live feed (commits `phase <id>: …`)
- todo: 5 promos, palette (H3), polish · 6a H4 accent, H1 Russian · 6b H2 PWA · 6c H5 jackpot (only if approved) · 7 QA, RTL, docs

## Decisions and deviations from PLAN.md (phase — decision — reason)
- 1 — Pinned TS 6.0.3 / ESLint 9.39.5 (not latest 7.x / 10.x) — typescript-eslint needs TS <6.1; jsx-a11y supports ESLint ≤9.
- 1 — React 18.3.1 per §2 (19 is latest) — plan says React 18.
- 1 — Extra devDeps (approved): `@types/react@18`, `@types/react-dom@18`, `@testing-library/dom` (RTL peer), `@types/node`, `globals`. No `tsx`: generator runs on Node's native TS.
- 1 — Stylelint: `stylelint-use-logical@2.1.3` (§2 package), rule name is `csstools/use-logical: always` (also flags top/bottom → block-logical). Peer `stylelint >=11 <18` covers 17.16.
- 1 — `engines.node`: `^20.19.0 || >=22.12.0` = minimum for `npm install && npm start` (Vite 8). README must also say: `npm run check` needs Node `^22.22.2 || ^24.15 || >=26` (Vitest 5 / jsdom 30); `npm run gen:games` needs ≥22.18 (native TS).
- 1 — Font: Inter variable (latin, latin-ext incl. ₽, cyrillic) woff2 from Google Fonts in `public/fonts/` + `OFL.txt`.
- 1 — Language switcher renders only when >1 locale exists; palette trigger not rendered until phase 5.
- 1 — Fixture: `public/api/games.json` is a plain `Game[]`; seed 20261016, fixed reference date 2026-10-01 for `new` tag; one deliberately long title. A test asserts the committed JSON equals the generator output.
- 1 — Mobile feed = collapsible bar sticky at the bottom (DOM order main → aside matches visual order).
- fix — Removed the Inter font preload: correct markup (`as`/`type`/`crossorigin`, same URL as @font-face) still warned on repeat navigations because Chrome serves @font-face from its memory cache and leaves the preload unused. `font-display: swap` covers the first load.
- 2a — Two-step URL parse: `parseFilters` checks format only (enums, slug regex, q trim/cap 100); `sanitize(games)` in the hook drops unknown prov/tag via replaceState once data loads (approved).
- 2a — Hook `useCatalogFilters` also canonicalizes a non-canonical URL on mount (replaceState) and keeps non-filter params (`mock`) verbatim after the filter params.
- 2a — `?mock=fail-catalog` → `CatalogError('network')` after the delay, so H2 offline fallback can be demoed with it. `slow` = +2500 ms.
- 2a — "All" = `null` in `Filters`; `sort=trending` is the default and is not written.
- 2a — Search: q split on whitespace, every token must be a substring of lowercase `title providerName` (in `filterGames`; URL keeps q as typed, trimmed). `toLowerCase`, no accent folding / ru matching: catalog data is English, H1 is UI only.
- 2b — Card = `<a id="game-<id>" href="#game-<id>">` (no game page; card is its own `:target`, dashed outline). Hash-only popstate is a no-op in the hook (pending debounce kept). Push (discrete filter, reset) drops the hash; replaceState writes keep it.
- 2b — Thumbnails: CSS gradient from CSS vars + id-free SVG shapes (no SVG ids). Bets in EUR (wallet currency) via `formatMoneyRange` from integer minor units (string decimals, no float division).
- 2b — Sort is a native select in the always-visible toolbar; mobile "Filters (n)" counts cat + each provider + tag + q (not sort). Clear filters shows when filters ≠ defaults or the input is non-empty; focus → h1 after Clear/Retry.
- 2b — Catalog.test uses `fireEvent` (kept). For later phases (dialogs, palette), verified: user-event + vitest fake timers needs `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` AND a `globalThis.jest = { advanceTimersByTime: vi.advanceTimersByTime }` shim — RTL's `asyncWrapper` advances its `setTimeout(0)` only when `jest` exists; `advanceTimers` alone hangs. `shouldAdvanceTime: true` also works but follows the wall clock.
- 2b — E2E: `@playwright/test` 1.63.0 exact (approved), bundled Chromium (`npx playwright install chromium`). Specs in `tests/e2e/` (approved; PLAN §4 says `e2e/`), own `tsconfig.e2e.json`. Default target: build + preview on :4173 (webServer); `E2E_BASE_URL=<url>` targets a running dev server. Fixture `lobby` fails a test on any console error/warning, pageerror, HTTP ≥ 400 or failed request, and keeps every page open ≥ 5 s.
- fix — Cards: no `aria-labelledby` / `aria-describedby`; name = visible content (WCAG 2.5.3), no description (it repeated the name). axe clean without filters.
- 3 — Failure rule on the normalized amount (trailing zeros dropped): `10.90` → `10.9` fails (user-confirmed; PLAN rule wins over addition 5). Dialog preview shows the normalized amount; the rule is not mentioned in the UI.
- 3 — Wallet: fixture (opening €500 + 4 past deposits, €695.25), `?mock=empty-wallet` (no storage read/write). `wallet:v1` stores confirmed only, validated on read (shape, rate-consistent amount, unique ids); corrupt → fixture. Rates fixed in EUR cents per 1.00 (USD 0.92, GBP 1.17), half-up. Limits 1–5000 in the chosen currency.
- 3 — Confirm uses `aria-disabled` (not `disabled`) while in flight/offline: `disabled` drops focus to body. Guards: in-flight ref + idempotency key per attempt (provider returns the same promise for a repeated key; reducer ignores it).
- 3 — Native `<dialog>` + showModal (`shared/Dialog.tsx`): Tab wrap, Esc via `cancel` and `close`, focus → trigger, else fallback (header Deposit), never body. Scroll lock via `:root:has(dialog:modal)` + `scrollbar-gutter: stable`. jsdom stub for showModal/close/Esc in `test/setup.ts`. New token `--backdrop`.
- 3 — Wallet UI in the header: balance toggle → history panel (6 most recent), Deposit button (icon-only < 30rem). Failure after the dialog was closed → `role="alert"` notice in the widget. `i18n.rich()` interpolates nodes (amounts in `<bdi>`).
- 3 — `@axe-core/playwright` 4.14.0 exact (§2 list). `tests/e2e/a11y.spec.ts` new (did not exist). E2E dwell is opt-in (`lobby.dwell()`), used only by the console-cleanliness tests (split in 4 parallel runs); fixture is `auto`, so every test checks the console.
- 4 — Feed store (`features/feed/feedStore.ts`) on useSyncExternalStore: one timeout at most, only while subscribed and the pause set is empty; resume starts a fresh 1.2–3 s delay (no catch-up). 8 back-dated seed wins on connect, so the empty state appears only for `?mock=empty-feed`. Wins in EUR cents, log scale with squared exponent (median ≈ €28).
- 4 — `shared/browserSignals.ts`: one shared DOM listener per signal (`subscribeVisibility`, `subscribeOnline`) used by the store and `useOnline`. `useAnimatedNumber` has no hidden-tab listener (it relies on rAF stopping), so nothing to share there.
- 4 — Hover/focus pause on the wins `<ol>` only (tabIndex 0 + aria-label, scroll container), pointerType `mouse` only; Pause/Resume button outside it, label changes, no aria-pressed. jsx-a11y `no-noninteractive-tabindex` / `-element-interactions` disabled for that element with a reason.
- 4 — Game titles: `loadGames()` extracted from `fetchCatalog` (fetch + validate + catalog:v1 write, no delay/mocks); `connectFeed` = own delay + `fail-feed`/`empty-feed` + `loadGames`. Two requests to `api/games.json` (no in-flight dedup). While offline the store pauses (`offline` reason); generation needs no network.
- 4 — Isolation test renders the real `<App/>` (StrictMode); `GameGrid` is mocked as a non-memo `<Profiler>` wrapper around the real grid, so any Catalog re-render counts. Mutation-checked (feed state lifted into Layout → fails).
- 4 — Avatar: `hsl(hue var(--avatar-saturation) var(--avatar-lightness))` behind `--fg` initials; tokens.test checks all 360 hues (min 8.8:1 light, 4.9:1 dark).
- 4 — E2E feed spec uses `page.clock` (install at fixed T0, `pauseAt(T0 + 10 s)`, `runFor`); hidden tab emulated by overriding `document.hidden`. Whole e2e suite ≤ ~45 s incl. build.

## Open issues
- `npm audit`: 8 high, dev-only (braces via stylelint → globby/fast-glob), no fix upstream; `npm audit --omit=dev` = 0.
- Dev server shows unstyled content briefly (Vite injects CSS via JS in dev); theme attr is already correct. Preview/prod has no flash.

## For README (assumptions)
- Transactions appear in the wallet's own recent-transactions list, not the live feed.
- Deposit fails when the normalized amount (trailing zeros dropped, `,` = `.`) ends with 9: `19`, `10.90` fail; `90`, `9.50` succeed.
- Rates are fixed (USD 0.92, GBP 1.17 → EUR). Limits 1–5000 per deposit in the chosen currency.
- Confirmed transactions persist in `localStorage` (`wallet:v1`); pending/failed never. Corrupt data → fixture history.
- Feed: wins are simulated client-side; auto-pause on mouse hover, keyboard focus on the list, hidden tab and offline; Pause button. Relative time refreshes every 30 s.

## For NOTES.md ("with a week")
- Card a11y: restructure as heading link (title) + separate details, so the accessible name is shorter.
- Search: accent/diacritic folding (`normalize('NFD')`) and locale-aware matching.
- Feed: dedupe the concurrent `api/games.json` requests (shared in-flight promise with per-caller abort).
- Feed: the two jsx-a11y disables on the wins list are deliberate (focusable scrollable region with pointer/focus handlers that only pause).

## Bonus claim status (H1–H5: claimed / not claimed + one-line reason; filled in phases 6–7)

## Next
- Phase 5: promos, command palette (H3), polish. The palette takes games from the already-loaded catalog data: no third `games.json` request. Dialog/palette tests: see the user-event + fake timers note (2b).
- Phase 6b: on an offline reload the feed falls back to `catalog:v1` for titles, so catalog and feed agree. Consider one shared in-flight games request (cleared on failure) if it stays simple.
