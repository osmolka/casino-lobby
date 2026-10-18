# Notes

## Riskiest line of code
`src/features/catalog/api.ts:151`, the catch branch of `fetchCatalog`:

```ts
if (!saved || !canUseSavedCatalog(error)) throw error;
```

**Why it is risky.** This one condition decides between "show the error" and "show old data as if it were fine". It has three ways to go wrong, and each looks plausible:
- Falling back on **any** error would hide a damaged response (`invalid`) behind a stale catalog, so a server bug turns into a silent "offline" story.
- Falling back on an **abort** would make a cancelled attempt (Retry, unmount) resolve with stale data; `useCatalog` checks the signal only on rejection, so that stale result would overwrite the newer attempt's state.
- `saved` must be the copy read **before** the 400–900 ms delay. Reading it here instead would pick up the copy the live feed saves during the attempt, so `?mock=fail-catalog` on a first visit would show "saved" data that was never shown before.

**What guards it** (`src/features/catalog/api.test.ts`, "fetchCatalog offline fallback (catalog:v1)"). Mutations run in phase 7:
- Line deleted: 13 tests fail, among them "keeps the "invalid" error: a damaged response is not a connectivity problem", "uses only a copy saved before the attempt started (the feed saving one meanwhile does not count)" and "fails as before when nothing usable is saved".
- Guard weakened to `if (!saved) throw error;`: 2 tests fail, "keeps the "invalid" error…" and "rethrows an abort during the fetch instead of falling back" (added in phase 7: the existing abort test aborted during the delay only, before this line runs).

## What I'd change with a week
- **RTL** with a complete `ar` translation, an icon-mirroring audit and visual QA at four widths (the CSS is already logical).
- **PWA updates:** `autoUpdate` reloads open tabs when a new SW activates, so a deposit in flight is lost (the wallet stays consistent: pending is never persisted). Use prompt mode and defer the update while a deposit is pending.
- **One games request:** catalog and feed each fetch `api/games.json`; share one in-flight promise with per-caller abort. The feed after an offline start also keeps the saved titles until it reconnects.
- **Search:** accent/diacritic folding (`normalize('NFD')`) and locale-aware matching; the palette already folds ё → е.
- **Card a11y:** a heading link (title) plus separate details, so the accessible name is shorter.
- **Header at 320 px with a classic scrollbar:** `scrollbar-gutter: stable` reserves 15 px, the theme toggle wraps to a second row (phones with overlay scrollbars keep one row). At 360 px in a desktop window, a five-digit balance wraps the Settings gear the same way.
- **Polish leftovers:** hover styles for provider checkbox rows and native selects, `:active` on game cards.
- **Process:** e2e in CI with visual snapshots, a real WebSocket mock for the feed, error monitoring, virtualization if the feed buffer grows, H6 with full keyboard support.

## Assumptions and limits not in the README
- Russian translates the UI only; game titles and provider names are catalog data and stay in English.
- The web manifest is static (en name, light colors); the `theme-color` meta follows the theme.
- `?mock=fail-catalog` with a catalog saved by an earlier visit shows that copy and the "could not refresh" banner, not the error state.
- H2 runbook step 3 clears Local storage only: a full "Clear site data" also unregisters the SW, so offline has no shell.
- Confirmed deposits persist in `localStorage` (`wallet:v1`); pending and failed never do. Corrupt data → fixture history.
- Feed wins are simulated client-side; relative times refresh every 30 s.
- Promotions: native swipe momentum is not automated (the e2e swipe checks scroll and snap only); checked by hand on a real device.
- E2E: stop `npm run start:pwa` (or anything on :4173) first; a busy port fails the run on purpose.
- `npm audit`: high-severity advisories in dev dependencies only (stylelint → globby → fast-glob → braces), no upstream fix; `npm audit --omit=dev` = 0.
