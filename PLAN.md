# PLAN.md — Casino Lobby (Frontend Developer Test)

Source of truth for the agent. Original spec: `casino-lobby-test.md`. If this plan and the spec disagree, the spec wins; record the discrepancy in the README.

---

## 0. Agent working rules

1. Follow the phases strictly in order. Start the next phase only after the current phase's Definition of Done (DoD) is met.
2. At the end of each phase: `npm run check` (lint + typecheck + unit) is green, then commit with a meaningful message.
3. **Claim nothing without verification.** A bonus is listed as "done" in the README only if its runbook steps actually pass. Otherwise write an honest "no, and here's why".
4. Do not add dependencies beyond the list in §2 without an explicit reason recorded in the README. Pin exact versions and commit the lockfile.
5. The spec's time box is 3–5 hours. If time runs short, cut bonuses in the order from §7; never cut the mandatory scope.
6. Code, identifiers, commits, README and NOTES are in English.

---

## 1. Goal and principles

A casino lobby: game catalog, live wins feed, wallet, promotions, and an "expensive" product feel. No real games are required.

The reviewer values **judgment over feature count** and will probe the build. Priorities:
1. Mandatory fundamentals (spec §1), no exceptions.
2. Correctness of core features (spec §2) under the reviewer's stress scenarios.
3. A small set of bonuses, each finished completely.

---

## 2. Technical decisions

| Area | Decision |
|---|---|
| Build | Vite + React 18 + TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) |
| Styles | CSS Modules + CSS custom properties. No UI kits, no CSS-in-JS |
| Routing | No router. Filter state lives in query params via a custom hook |
| State | `useReducer` for the wallet; separate stores on `useSyncExternalStore` for the feed and the jackpot |
| Catalog data | Static `public/api/games.json`, loaded with a real `fetch` |
| i18n | Typed dictionaries `en`, `ru` + a `t()` function; formatting via `Intl` |
| Tests | Vitest + Testing Library (jsdom); Playwright + `@axe-core/playwright` for e2e |
| Lint | ESLint (`typescript-eslint` strict, `react-hooks`, `jsx-a11y`), `--max-warnings 0`; Stylelint with `stylelint-use-logical` |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`) |

**Allowed dependencies:** `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `stylelint`, `stylelint-config-standard`, `stylelint-use-logical`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test`, `@axe-core/playwright`, `vite-plugin-pwa`, `@vite-pwa/assets-generator` (icon generation only).

**`package.json` scripts:**

| Script | Purpose |
|---|---|
| `start` | `vite` (dev). Must work after `npm install && npm start` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `start:pwa` | `npm run build && vite preview` (PWA verification) |
| `lint` | `eslint . --max-warnings 0 && stylelint "src/**/*.css"` |
| `typecheck` | `tsc -b --noEmit` |
| `test` | `vitest run --reporter=dot` |
| `test:e2e` | `playwright test --reporter=line` (against the preview build; requires `npx playwright install`) |
| `check` | `lint` + `typecheck` + `test` |

---

## 3. Global rules (apply to every phase)

### 3.1 Text
- No UI strings in components, including `aria-label`, `title`, `placeholder`, `alt`, error and empty-state texts.
- **English is the primary language.** `en` is the default locale, the fallback, and the source of the dictionary's shape.
- The dictionary type is derived from `en`, with values widened to `string`:
  ```ts
  // i18n/en.ts
  export const en = { wallet: { deposit: 'Deposit' } /* ... */ };
  type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
  export type Messages = DeepString<typeof en>;

  // i18n/ru.ts
  export const ru = { wallet: { deposit: 'Пополнить' } } satisfies Messages;
  ```
  A missing or extra key in `ru` is a compile error. Do not use `as const` on `en` without `DeepString`: literal value types would make `ru` fail the check.
- Pluralization via `Intl.PluralRules` (required for `ru`).
- Numbers, currencies, dates and relative time via `Intl` with the current locale.

### 3.2 CSS
- **Logical properties only** (`margin-inline-*`, `padding-inline-*`, `inset-inline-*`, `text-align: start/end`, `border-inline-*`, `border-start-start-radius`, etc.). Physical `left/right` is forbidden and enforced by lint.
- Do not use `row-reverse` for visual order.
- Directional icons (chevrons, arrows) are mirrored under `[dir="rtl"]`.
- Animated offsets use `translateX(calc(var(--dir) * …))`, where `--dir: 1 | -1` is set from `[dir]`.
- Latin text and amounts inside running text are wrapped in `<bdi>` or use `unicode-bidi: isolate`.
- Against horizontal scroll: `min-width: 0` on flex/grid children, `overflow-wrap: anywhere` / `text-overflow: ellipsis` for long titles, wide blocks scroll inside their own container.

### 3.3 Themes and color
- Tokens on `:root`: `--bg`, `--surface`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--accent-fg`, `--focus`, `--danger`, `--success`.
- Theme in `data-theme` on `<html>`. Default from `prefers-color-scheme`, choice stored in `localStorage`.
- Theme, language and `dir` are set by an **inline script in `index.html` before CSS loads**, so there is no flash.
- Every text/background pair passes WCAG AA (4.5:1 for text, 3:1 for large text and UI outlines) in both themes.

### 3.4 Accessibility
- Logical tab order, visible `:focus-visible` (high contrast; never remove the outline without a replacement).
- `aria-label` on every icon-only button.
- No click-only features: everything that works with a mouse works with a keyboard.
- Modals/dialogs: focus trap, `Esc`, focus returns to the trigger, `aria-modal`, `aria-labelledby`.
- Auto-updating content (feed, jackpot) has an explicit pause control (WCAG 2.2.2).
- Animations respect `prefers-reduced-motion`.

### 3.5 Robustness
- All timers, listeners and `requestAnimationFrame` calls are cleaned up. Effects are correct under React StrictMode (the dev double mount must not create duplicate intervals).
- Money in **integer minor units only**, no float arithmetic.
- Every `localStorage` access is wrapped in `try/catch`; on failure fall back to defaults.
- Console in dev and preview: zero errors and warnings (including `key`, `aria`, 404s for assets and favicon).

### 3.6 Async region states
Every async region (catalog, feed, wallet, promos) has: a **skeleton** (not a spinner), an **error** state with retry, and an **empty** state with a clear action.

Failure injection for verification (works in both dev and preview): `?mock=fail-catalog`, `?mock=fail-feed`, `?mock=fail-wallet`, `?mock=empty-feed`, `?mock=slow` (several values comma-separated). The `mock` param is not part of filter state.
Promos (added in phase 5b): `?mock=fail-promos`, `?mock=empty-promos`.

---

## 4. Repository structure

```
public/
  api/games.json            # 100 games, generated by a script and committed
  icons/                    # PWA icons (192, 512, maskable)
  fonts/                    # self-hosted fonts
scripts/
  generate-games.ts         # seeded fixture generator
src/
  app/                      # App, layout, providers, theme, accent
  features/
    catalog/                # api, filters.ts (pure functions), urlState.ts, UI
    feed/                   # store, generator, UI
    wallet/                 # reducer, api, rates, DepositDialog
    promos/
    palette/                # fuzzy.ts, CommandPalette
    jackpot/                # (H5, optional)
  i18n/                     # en.ts, ru.ts, t(), locale context
  shared/                   # UI primitives, hooks (useDebounce, useAnimatedNumber, useVisibility), utils
  pwa/                      # SW registration (PROD only)
tests/
  e2e/                      # Playwright
README.md                   # ≤ 1 page
NOTES.md                    # riskiest line + week plan
proof/                      # screenshot / clip
```

---

## 5. Data models

```ts
type Category = 'slots' | 'table' | 'live';

interface Game {
  id: string;
  title: string;
  provider: string;        // slug
  providerName: string;
  category: Category;
  tags: string[];          // e.g. 'megaways', 'jackpot', 'classic', 'bonus-buy', 'new'
  rtp: number;             // percent, e.g. 96.21
  minBet: number;          // minor units
  maxBet: number;          // minor units
  releasedAt: string;      // ISO
  popularity: number;      // for Trending
  hue: number;             // for SVG thumbnail generation
}

type TxStatus = 'pending' | 'confirmed' | 'failed';
interface Transaction {
  id: string;
  type: 'deposit';
  amount: number;          // minor units, in wallet currency
  original: { amount: number; currency: Currency };
  status: TxStatus;
  createdAt: string;
  error?: string;          // i18n key
}

interface Win {
  id: string;
  player: string;          // nickname
  gameId: string;
  amount: number;          // minor units
  currency: Currency;
  at: number;              // timestamp
}

interface Locale {
  code: 'en' | 'ru';
  dir: 'ltr' | 'rtl';
  messages: Messages;
}
```

---

## 6. Phases

Phases 2 and 6 are run as separate sessions: 2a / 2b and 6a / 6b / 6c (see subsections).

### Phase 1 — Scaffold (~30 min)

- Init Vite + React + TS, strict `tsconfig`, ESLint, Stylelint with logical properties, Vitest, scripts from §2.
- Self-hosted font with a proper fallback stack, favicon.
- Theme tokens, theme toggle (icon-only button with `aria-label` and `aria-pressed`), persistence, inline script in `index.html`.
- i18n: `en.ts`, `t()`, locale context, `lang` and `dir` set on `<html>`.
- Layout: header (logo, palette trigger, wallet, theme, language), main column, feed side panel collapsible on mobile.
- `generate-games.ts` script (seeded PRNG), output to `public/api/games.json`: 100 games, ~8 providers, all 3 categories, realistic RTP 94–98%.

**DoD:** the shell renders in both themes without a flash; `npm run check` is green; the console is clean.

### Phase 2 — Catalog (~75 min, highest risk)

#### 2a — Data, filters, URL state (no UI)

**Data**
- `fetchCatalog()`: real `fetch('/api/games.json')`, artificial delay 400–900 ms, support for `?mock=fail-catalog|slow`.
- Explicit handling: `fetch` rejection (`TypeError`) and `!response.ok` both go to the error branch (H2 extends this later).
- A successful response is saved to `localStorage` under `catalog:v1` together with `fetchedAt` (foundation for H2).

**Filtering** (`filters.ts`, pure functions, covered by unit tests)
- Category: one or "all".
- Providers: multi-select, OR within the group.
- Tag: one or "all".
- Search: `title` and `providerName`, case-insensitive.
- AND across groups.
- Sort: `trending` (popularity ↓), `new` (releasedAt ↓), `rtp` (rtp ↓). Tie-break by `title` for stability.
- Tests: combinations of all filters, each sort, empty result, search by provider.

**URL** (`urlState.ts`)
- Schema: `?cat=slots&prov=netent,pragmatic&tag=jackpot&q=book&sort=rtp`.
- Default values are not written to the URL. Parameter order is canonical.
- Parsing with validation: unknown values are dropped, garbage never crashes the app. Tests for this.
- Discrete filters → `pushState`; search input → `replaceState`. Handle `popstate`.
- Search: the input value updates instantly; the URL and the list update after a 250 ms debounce.

#### 2b — UI and states

- Card: SVG thumbnail generated from `hue` and `id` (no external images), title, provider, tags, RTP, min/max bet (via `Intl`). The card is a link/button with a clear accessible name. `React.memo`.
- Filter panel: collapsible on mobile; controls are native or have correct roles (`fieldset`/`legend`, `aria-pressed` for chips).
- Result count in `aria-live="polite"`.
- States: skeleton grid, error with retry, empty with a "Clear filters" button (resets everything except `mock`).

**DoD (Phase 2):** any filter combination opens from a link and produces an identical view; Back/Forward restore states; a garbage URL does not break the page; filter and URL tests are green.

### Phase 3 — Wallet (~45 min)

**Model**
- Wallet currency: EUR. Deposit in EUR, USD or GBP using a fixed rate table (`rates.ts`), with a conversion preview.
- Reducer invariant: **`balance === sum of transactions with status pending or confirmed`**. Balance is derived, not stored separately, so rollback is automatic.
- Unit test of the invariant over an arbitrary sequence of successes and failures.

**Failure (deterministic)**
- The last digit of the entered text (trimmed, `,` treated as `.`, no zero stripping) is `9` → failure. Examples: `19`, `10.99`, `10.9`, `09` fail; `90`, `9.50`, `10.90`, `10.` succeed. A trailing separator is valid input and skipped by the rule (`19.` fails as 19). Locale independent (`10,90` = `10.90`). The UI shows amounts from integer minor units with two decimals and never mentions the rule. Document the rule in the README.
- "Server" delay ~800 ms.
- Optimistic UI: the transaction is `pending` immediately and the balance grows immediately. On failure: status `failed`, balance reverts (via the invariant), an error message in the dialog with `role="alert"`, the transaction is marked Failed in the list.

**Race protection**
- The confirm button is disabled while the request is in flight; plus an idempotency key per attempt in the reducer (a repeated dispatch with the same key is ignored).

**UI**
- Widget: balance, currency, Deposit button, recent transactions list (statuses shown as text, not only color).
- Balance animation via the shared `useAnimatedNumber` hook (rAF, delta time, `prefers-reduced-motion` → instant, correct behavior in a hidden tab).
- Deposit dialog: validation (number, > 0, limits), focus trap, `Esc`, focus return.
- Offline (`navigator.onLine === false`): deposit is blocked with a clear message.

**DoD:** deposit 100 → success and animation; 109 → error, balance and list consistent; double click / Enter + click create no duplicates; invariant test is green.

### Phase 4 — Live feed (~40 min)

- Win generator with 1.2–3 s jitter, store on `useSyncExternalStore`, **ring buffer of 50 entries**.
- Pause reasons form a set: `hover`, `focus` (`focusin/focusout`), `hidden` (`visibilitychange`), `user` (button), `offline`. Generation runs only when the set is empty. While paused, events **do not accumulate** and are not dumped at once when the pause ends.
- Visible Pause/Resume button (WCAG 2.2.2).
- Entry: avatar (initials/SVG), game, amount (`Intl`), relative time. Relative time is refreshed by a timer inside the feed component every 30 s, not through global state.
- Region with `aria-label`, no `aria-live` on each entry.
- Mobile: collapsible panel, button with `aria-expanded` and `aria-controls`.
- States: skeleton, error with retry (`?mock=fail-feed`), empty (`?mock=empty-feed`).
- **Isolation test:** Vitest + `<Profiler>` around the catalog grid; with fake timers advance 10 feed ticks; expect 0 grid commits.

**DoD:** isolation test is green; hover, focus, hidden tab and the button stop the feed; after 5 minutes the buffer holds 50.

### Phase 5 — Promos, command palette, polish (~30–40 min)

**Promos**
- A real scroll container: `overflow-x: auto`, `scroll-snap-type: x mandatory`, `scroll-padding-inline`, `overscroll-behavior-x: contain`. Native momentum on touch devices.
- Cards are focusable links; the container has an `aria-label`. Do not use `scrollLeft` directly (negative in RTL).
- Skeleton and error/empty states.

**Command palette (built to H3 scope from the start)**
- Open with `Ctrl/Cmd+K` and with a header button.
- Combobox pattern: `role="combobox"` on the input, `role="listbox"`/`option`, `aria-activedescendant`, arrows / Enter / Esc / Home / End. Focus trap, focus return.
- Sources: games, providers, actions (toggle theme, switch language, open deposit, clear filters).
- `fuzzy.ts` — pure function `fuzzyScore(query, text) → { score, matches } | null`:
  - tiers: exact match > prefix > word prefix > substring > subsequence (gap penalty);
  - tie-break: shorter title ranks higher;
  - small type bonus (actions rank higher when matched by their name);
  - works with translated action names.
- Highlight matched characters (`<mark>`), up to 10 results, grouped by type.
- Selecting a game: if its card is visible in the current results, scroll to it and focus it; otherwise set the search to the game title via `pushState` (Back restores previous filters), then scroll and focus.
- Ranking unit tests: order for a set of reference queries, subsequence typos, empty query.

**Polish**
- Skeletons in every region, not a single spinner.
- Final pass over hover/focus/active states and transitions (respecting reduced motion).

**DoD:** the palette is fully keyboard-operable; `fuzzy.ts` tests are green; promos swipe under touch emulation in DevTools.

### Phase 6 — Bonuses (~60 min)

Each bonus is committed separately.

#### 6a — H4, then H1

**H4 — Dynamic accent**
- Hue slider (0–360) in a settings menu, value in `--accent-h` on `:root`, persisted to `localStorage`, applied by the inline script before render.
- Derived colors via `oklch(L C var(--accent-h))` with fixed `L` and `C` per theme and a matched `--accent-fg`, so contrast holds across the whole hue circle.
- No React state for the tree's color: only the CSS variable changes.
- Verification: axe in both themes at hue 0, 60, 120, 180, 240, 300.

**H1 — Second language (ru)**
- Complete `ru.ts` dictionary (`satisfies Messages`), switcher in the header, persisted choice, `lang` on `<html>`.
- Russian plurals (e.g. `победа/победы/побед`).
- Layout check with long Russian strings at 360 px (buttons, filter chips, header, dialog).

#### 6b — H2 PWA

- Manifest: `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`, icons 192 / 512 / maskable (generate once from SVG and commit).
- `vite-plugin-pwa`, `generateSW`, `registerType: 'autoUpdate'`. Precache: shell, JS, CSS, fonts, icons. **`/api/games.json` is excluded from both SW precache and SW runtime caching** — catalog data caching is owned by the app (`catalog:v1` from Phase 2), so the failed-fetch path is explicit in app code and shows a banner.
- Register the SW **only when `import.meta.env.PROD`** — the dev console stays clean.
- Catalog logic:
  1. `fetch` succeeds and `ok` → fresh data, update `catalog:v1`.
  2. `fetch` rejects or `!ok`, and `catalog:v1` exists → show the saved catalog + banner "Offline — showing data from {time}" (`role="status"`).
  3. Error and no cache → error state with retry.
- `online`/`offline` events: network status banner; automatic refetch on `online`.
- While offline the feed is paused (reason `offline`) and deposit is blocked (Phase 3).

#### 6c — H5 (only if approved after QA)

See §7.1.

**DoD for each bonus:** all of its runbook steps from §9.2 pass. If not, revert or disable it (for H2: do not register the SW) and write "no" in the README.

### Phase 7 — QA, decisions, submission (~30–40 min)

1. Full QA checklist from §8.
2. **RTL decision** (see §7.2).
3. **H5 decision** (see §7.1).
4. README, runbook of proof, NOTES.md, screenshot/clip using the templates in §9.

---

## 7. Bonuses: final set

| # | Bonus | Status | Condition to claim |
|---|---|---|---|
| H1 | Second language | Doing (ru) | No untranslated strings; layout holds at 360 px |
| H2 | Offline / PWA | Doing | All 4 runbook steps pass |
| H3 | Scalable command palette | Doing (in Phase 5) | Ranking tests green; fully keyboard-operable |
| H4 | Dynamic accent | Doing | AA contrast at 6 reference hues in both themes |
| H5 | rAF jackpot ticker | Only if ≥ 20 min remain after QA | 60 fps while the feed streams; pauses with the tab; reduced motion |
| H6 | Drag-to-rearrange favorites | Not doing | — |
| H7 | Virtualized live feed | Not doing | — |
| H8 | Tiny game | Not doing | — |

**Cut order when time runs short:** H5 → H2 → H3 → H1. H4 is cut last. The mandatory scope is never cut.

### 7.1 H5 — Jackpot ticker (optional)
- Jackpot store: discrete increments every 4–6 s.
- Display via `useAnimatedNumber`, updating a DOM node through a `ref` (no React re-renders per frame).
- `requestAnimationFrame` loop with delta time; cancelled on `visibilitychange` → hidden; on return, no catch-up jump in the animation.
- `prefers-reduced-motion` → value is set immediately.
- For screen readers: a visually hidden value updated at most every 30 s, `aria-live="off"`.
- If not done: state in the README that the rAF approach is shown in the balance animation.

### 7.2 RTL — decided at the end
CSS uses logical properties from Phase 1, and `dir` comes from the locale contract. Claim RTL **only if** all of the following are met within ≤ 20 minutes:
1. An RTL locale (`ar`) with a **complete** translation is added (without a complete translation do not claim RTL — the spec requires "no untranslated strings").
2. Playwright at 360 / 768 / 1024 / 1440 with `dir="rtl"`: no horizontal scroll; header, filters, cards, dialogs, palette, feed and promos are mirrored and correct.
3. axe is clean in RTL.

Otherwise, in the README: "RTL not claimed. CSS uses logical properties throughout and `dir` is driven by the locale contract; remaining work: translation, icon mirroring audit, visual QA."

---

## 8. QA checklist (Phase 7)

**Automated**
- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm run typecheck`
- [ ] `npm test` — filters, URL, wallet invariant, feed isolation, fuzzy ranking
- [ ] `npm run build`
- [ ] Playwright: widths 360 / 768 / 1024 / 1440 — `document.documentElement.scrollWidth <= clientWidth`
- [ ] Playwright: `console` listener — zero `error`/`warning` on load and in main scenarios
- [ ] Playwright + axe: light and dark theme, open deposit dialog, open palette, 6 accent values
- [ ] Playwright: a deep link with combined filters restores the view
- [ ] Playwright: deposit 100 → success; 109 → error, balance unchanged

**Manual**
- [ ] Full keyboard-only pass: header → filters → catalog → feed → wallet → promos → palette
- [ ] Reload preserves theme, language, accent
- [ ] `?mock=fail-catalog`, `fail-feed`, `fail-wallet`, `empty-feed`, `slow` — correct states
- [ ] Hidden tab stops the feed; hover and focus stop it; Pause button works
- [ ] Dev console is clean on `npm start` (SW not registered)
- [ ] H2 runbook (§9.2) in `npm run start:pwa`
- [ ] Long Russian strings at 360 px

---

## 9. Submission

### 9.1 README.md (≤ 1 page)

```md
# Casino Lobby

## Run
npm install && npm start        # dev
npm run start:pwa               # production build + preview (PWA, offline)
npm run check                   # lint + typecheck + unit tests
npm run test:e2e                # Playwright (run `npx playwright install` once)

## What's built
<short checklist of spec §1 and §2>

## Hardest trade-offs
1. <e.g.: URL as the single source of truth for filters — pushState vs replaceState for search>
2. <e.g.: wallet balance derived from transactions so rollback is structural, not manual>
3. <e.g.: catalog offline cache owned by the app, not the service worker, to make the failed-fetch path explicit>

## Bonus answers (H1–H8)
- H1 Second language — Done (ru). RTL: <claimed / not claimed + why>.
- H2 Offline (PWA) — Done. <strategy: precached shell, app-level last-catalog cache, explicit reject vs !ok>
- H3 Command palette — Done. <ranking model in one line>
- H4 Dynamic accent — Done. <CSS variable + OKLCH, no React re-render>
- H5 Jackpot ticker — <Done / No: rAF approach is shown in the balance animation>
- H6 Favorites drag — No. Would use pointer events + move up/down buttons + localStorage, tested with keyboard first.
- H7 Virtualized feed — No. The feed is a 50-item ring buffer, so virtualization adds complexity without benefit; would add it if the buffer grew to thousands.
- H8 Tiny game — No. Would build an explicit state machine (idle → spinning → settling → result), decide the outcome before animating, and prove RTP analytically in a unit test.

## Assumptions
- Deposit failure rule: the last digit of the entered amount text is "9" (`10.9` fails, `10.90` succeeds: same amount, by design; `,` = `.`).
- "Transaction appears in the feed" interpreted as the wallet's transaction list.

## Proof
See "Runbook of proof" below and /proof.
```

### 9.2 Runbook of proof (README section)

- **H1:** language switcher in the header → the whole UI is in Russian; DevTools → `document.documentElement.lang === "ru"`; 360 px emulation — layout does not break.
- **H2:** `npm run start:pwa`
  1. DevTools → Application → Manifest: installable, icons present.
  2. Open the lobby → Network → Offline → reload: shell and catalog are present, banner "Offline — showing data from …".
  3. Application → Local storage → clear it (keep the service worker: a full "Clear site data" also unregisters it, then offline has no shell) → Offline → reload: error state with Retry (Retry while offline keeps the error); go online → the catalog loads automatically. Retry covers a reachable network with a failing server.
  4. Online, Network → Block request URL `/api/games.json` → reload: saved catalog + banner (failed fetch while the network is up).
- **H3:** `Ctrl/Cmd+K` → type `bk drd` (or an equivalent from the reference tests) → ranked list with highlighting; select with arrows and Enter.
- **H4:** settings menu → hue slider → the whole theme recolors; DevTools → `:root` → only `--accent-h` changes; React DevTools "Highlight updates" does not flash the tree.
- **H5 (if done):** DevTools → Performance while the feed streams → steady frames; hide the tab → rAF is not called.

### 9.3 NOTES.md
- **Riskiest line of code:** pick one specific line (candidates: URL ↔ state sync on `popstate`; the idempotency check in the wallet reducer; the `catch` branch in `fetchCatalog`) and explain why it is risky and what guards it.
- **What I'd change with a week:** RTL with a full translation, virtualization if the feed grows, H6 with full a11y, e2e in CI with visual snapshots, a real WebSocket mock, error monitoring.

### 9.4 Proof
- A screenshot or 15-second clip of the strongest part (suggestion: offline mode with the banner, or the palette with ranking) in `proof/`. A Playwright screenshot is fine.

---

## 10. Time budget

| Phase | Time |
|---|---|
| 1. Scaffold | ~30 min |
| 2. Catalog | ~75 min |
| 3. Wallet | ~45 min |
| 4. Feed | ~40 min |
| 5. Promos + palette + polish | ~30–40 min |
| 6. Bonuses (H4, H1, H2) | ~60 min |
| 7. QA + submission | ~30–40 min |
| **Total** | **~5–5.5 h** |

The build sits at the upper edge of the time box. If more than 30 minutes behind schedule by the end of Phase 5, apply the cut order from §7 immediately.
