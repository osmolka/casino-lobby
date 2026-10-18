# Casino Lobby

React 18 + strict TypeScript + Vite, plain CSS (logical properties), no UI or state library.

## Run
```sh
npm install && npm start   # dev server: http://localhost:5173
npm run start:pwa          # production build + preview on :4173 (PWA, offline)
npm run check              # ESLint + Stylelint + typecheck + unit tests
npm run test:e2e           # Playwright on the preview build (:4173 free; once: npx playwright install chromium)
node scripts/proof.ts      # with start:pwa running: regenerates proof/*.png
```
Node: install/start `^20.19 || >=22.12` (Vite 8); `check` `^22.22.2 || ^24.15 || >=26` (Vitest 5, jsdom 30); `.ts` scripts ≥ 22.18. Mocks: `?mock=slow`, `fail-catalog`, `fail-`/`empty-` + `feed`/`wallet`/`promos`, comma-separated.

## What's built (spec §1–§2) and how to see it
| Item | How to see it | Test |
|---|---|---|
| Responsive, no horizontal scroll | DevTools at 360 / 768 / 1024 / 1440 | `catalog.spec` |
| Light/dark, one click, persisted, AA | "Dark theme" toggle in the header, reload | `Layout`, `tokens` |
| Keyboard + screen reader | Tab from "Skip to content" | `a11y.spec` (axe) |
| Clean console | fresh `npm start`, DevTools | every e2e test |
| Skeleton / empty / error + Retry | the `?mock=` flags above | each feature spec |
| Catalog: 100 games, filters, debounced search, sort, URL | `/?cat=slots&tag=megaways&sort=rtp`, Back | `catalog.spec` |
| Feed: pauses on hover, focus, hidden tab, offline, Pause; 50 max | hover the list, switch tabs | `feed.spec` |
| Wallet: balance, list, deposit + conversion, animation, failure | Deposit `100` → ok; `109` → error, rolled back | `wallet.spec` |
| Promotions: scroll container, snap, swipe; Prev/Next on desktop | swipe on a phone | `promos.spec`; momentum by hand |
| No spinners; all text from `src/i18n` | `?mock=slow`; Settings → Русский | `cssPolish`, `ru`; literals by review |
| Command palette: jump to a game, toggle theme | `Ctrl/⌘ + K` | `palette.spec` |

## Hardest trade-offs
1. **URL is the only filter state.** Filters `pushState`, search `replaceState` after 250 ms, so every view is a link and Back works. *Cost:* a pending debounce must be flushed or dropped on every push and `popstate`; unknown providers/tags are dropped only after the catalog loads (an extra `replaceState`).
2. **Balance is derived from transactions** (sum of pending + confirmed), so a failed deposit rolls back by itself. *Cost:* history only grows (trimming needs an opening-balance entry), and the optimistic balance briefly shows money that may not arrive.
3. **The app, not the service worker, owns the offline catalog** (`catalog:v1` in `localStorage`; the SW precaches the shell only). The failed-fetch path is explicit, with a banner that says why. *Cost:* a second cache beside the SW, a synchronous size-limited store, and a race (the copy is read when the attempt starts, or the feed's request saves one mid-attempt).

## Bonus answers (H1–H8)
- **H1 Second language — Done (ru).** `ru.ts satisfies Messages`, Russian plurals, switcher in Settings and the palette, persisted, applied before render. RTL not claimed. CSS uses logical properties throughout and `dir` is driven by the locale contract; remaining work: translation, icon mirroring audit, visual QA.
- **H2 Offline (PWA) — Done.** Precached shell (Workbox); the SW never serves `games.json`. A network error or non-ok response falls back to the last good catalog; a damaged body or an abort keeps its error. Refetches on `online`.
- **H3 Command palette — Done.** Tiers exact > prefix > word prefix > substring > subsequence (fzf-like bonuses for word starts and adjacency, gap penalty) over actions, games, providers; top 10.
- **H4 Dynamic accent — Done.** The hue slider writes one variable, `--accent-h` on `<html>`; `--accent` is `oklch()` with L/C per theme chosen so every hue 0–359 passes AA. Only the slider has React state, so the catalog does not re-render.
- **H5 Jackpot ticker — No:** the rAF approach is shown in the balance animation.
- **H6 Favorites drag — No.** Would use pointer events + move up/down buttons + localStorage, keyboard first.
- **H7 Virtualized feed — No.** The feed is a 50-item ring buffer; virtualization pays off only at thousands.
- **H8 Tiny game — No.** Would build a state machine (idle → spinning → settling → result), outcome decided before animating, RTP proven in a unit test.

## Runbook of proof
- **H1:** Settings (gear) → Language → Русский → whole UI in Russian, `document.documentElement.lang === "ru"`; 360 px emulation keeps the layout (`ru.spec`).
- **H2** (`npm run start:pwa`, open once online; each step is a test in `pwa.spec`): 1. Application → Manifest: installable. 2. Offline → reload: shell, catalog, "You are offline. Showing games saved at …". 3. Clear Local storage only (keep the SW) → Offline → reload: error + Retry; go online → loads by itself. 4. Block `/api/games.json` → reload: saved catalog + "Could not refresh the games…".
- **H3:** `Ctrl/⌘ + K` → `frz vlt` → Enter → the "Frozen Vault XL" card has focus (`imm bj` → Immersive Blackjack); arrows, Home/End, Esc.
- **H4:** Settings → Accent hue → the app recolors; DevTools: only `--accent-h` on `<html>` changes (`accent.spec`, `feedIsolation.test` "accent isolation").

## Assumptions (more in [NOTES.md](NOTES.md))
- A deposit fails when the **typed** amount ends in 9 (`,` = `.`): `10.9` fails, `10.90` succeeds, by design.
- "Transaction appears in the feed" = the wallet's own list. Fixed rates (USD 0.92, GBP 1.17 → EUR), 1–5000 per deposit.

## Proof
`proof/palette.png` (`Ctrl+K` → `live`), `proof/offline.png`. Riskiest line and "with a week": NOTES.md.
