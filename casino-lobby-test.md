# Casino Lobby — Frontend Developer Test

> **Time box:** 3–5 hours of focused work (extend at your own risk).
> **Stack:** Your choice, but it must run with a single command (`npm install && npm start`).
> **Goal:** Build a polished, production-feeling **casino lobby** — the screen a player sees
> *before* they jump into a game. Think game catalog, live activity, wallet, promotions,
> and a smooth, "expensive" feel.
>
> **No real games are required.** A game is a card/link (e.g. "Slot", "Live Roulette").
> Focus on the **lobby shell** and the **frontend engineering craft** around it.

---

## 1. Non-negotiable fundamentals

These are the bar. If any of them is missing, the rest matters less.

- [ ] **Responsive layout** — works cleanly at 360px, 768px, 1024px, 1440px. No horizontal scroll, no broken grids.
- [ ] **Light and dark theme** with a one-click toggle, persisted across reloads. Colors must remain accessible (WCAG AA contrast).
- [ ] **Keyboard + screen-reader usable:** logical tab order, visible focus rings, `aria` labels on icon-only controls, no "click-only" features.
- [ ] **No console errors/warnings** in a fresh dev run.
- [ ] **Loading, empty, and error states** for every async region (see §2).
- [ ] **Type safety or discipline:** TypeScript (recommended) or a strict lint config that you actually run and pass.
- [ ] **README (≤ 1 page):** how to run, what you built, and the 3 hardest trade-offs you made.

---

## 2. Core features (MUST)

### 2.1 Game catalog with live filtering
- A grid of ~100 game cards fetched from a mock API (you may build the mock, or use `https://dummyjson.com`/your own fixture JSON).
- Each card: thumbnail, title, provider, tag(s), RTP, min/max bet.
- **Filter/sort that must work *together* and not break each other:**
  - Filter by category (`slots`, `table`, `live`), by provider (multi-select), and by tag.
  - Free-text **title/provider search with debounce**.
  - Sort: `Trending`, `New releases`, `Highest RTP`.
- The **URL must reflect filter state** (query params) so any combined view is shareable/bookmarkable. Restoring state from a deep link must work.
- "No results" state with a working "clear filters" action.

### 2.2 Live activity feed
- A side (or collapsible mobile) panel streaming **other players' wins**: avatar, game, amount, time.
- Entries arrive over time (mock a stream; a WebSocket *or* a long-polling/interval simulation is fine).
- Must: pause on hover, auto-pause when the tab is hidden, cap memory (bounded buffer), and **not** re-render the whole catalog on every tick.

### 2.3 Wallet widget
- Display balance, currency, and a recent-transactions list.
- A simulated **Deposit** flow (modal/drawer): amount, currency conversion (pick a rate), confirm.
- After deposit: balance animates to the new value; transaction appears in the feed.
- **Handle the failure path deterministically:** e.g. any deposit whose amount ends in `9` fails — you must show a clear error, roll back the optimistic UI, and keep the list consistent.

### 2.4 "Promotions" section
- A horizontal scroller of promo cards.
- On mobile it must be **swipeable with momentum**; on desktop scrollable. Implement it as a real scroll container (no janky fake scroll).

### 2.5 Global polish
- Suspensy/perceived-performance: route- or section-level skeletons instead of spinners.
- All text must come from a **single source** (i18n dictionary or `messages` file) — no hardcoded UI strings in components. (English required; a second language is a bonus, see §4.)
- A small **command palette** (`Ctrl/Cmd + K`) that can jump to a game or toggle theme.

---

## 3. Optional bonus features (extra credit)

Pick what you can actually finish. A working smaller set beats ten half-done items.

| Idea | What "done" means | Notes / trap |
|------|-------------------|-------------|
| **Second language** (i18n for real) | Full UI translated + a working switcher; no untranslated strings; layout must not break for the longer language. | RTL support is a big plus. This is where i18n "diets" fall apart. |
| **Offline support (PWA)** | Installable manifest; the lobby shell and the *last* catalog render survive a full network disconnect. | Must handle the *failed-fetch* path, not just `fetch` → `ok`. |
| **Command palette that actually scales** | Fuzzy match over games + providers + actions, with keyboard-only selection and a ranked result list. | Ranking/Scoring is the hard part, not the input box. |
| **Custom theming / dynamic accent** | User picks an accent color (or hue) at runtime; the whole app re-themes. | Avoid CSS-in-JS re-render storms; do it with CSS variables. |
| **Canvas/`requestAnimationFrame` "jackpot" ticker** | A smooth, frame-driven counting number for the "jackpot" total that stays at 60fps while the feed streams. | Frame-driven (not `setInterval`), pauses with the tab, respects reduced-motion. |
| **Drag-to-rearrange "Favorites"** | A favorites row you can reorder by dragging; order persisted to `localStorage`; a11y fallback (move up/down keys). | Pointer events + keyboard + persistence all together. |
| **Virtualized live feed** (if you skipped H3) | Virtualized the feed *and* keep it 60fps while it streams. | Easier to fail here than in the catalog. |
| **A tiny game (optional, big points)** | A fully playable, real game you built *in the lobby* (e.g. a 3-reel slot whose reels spin and land). Scored on feel + correctness (RTP honest, no double-spins). | This is the "show you can build a state machine" item. |

---

## 4. How to submit

1. **`README.md`** (≤ 1 page): run command, feature checklist, and your answers to the
   *why* questions in §3 (H1–H8). Keep them honest and short.
2. **Runbook of proof** — for each §3 item you claim "done," a one-liner: how I can
   *see* it (a keypress, a DevTools action, a URL to open).
3. **One screenshot or 15-second clip** (zip it into the repo) of the thing you're most proud of.
4. **A short written note** on: your single riskiest line of code, and what you'd change if you had a week.

> I value **judgment over feature count**. A smaller, *correct*, well-reasoned build
> that survives my probing beats a large, shiny one that falls over at H1 or H4.
> If you can't do a hard item, say so in the README and tell me what you *would* do —
> a correct "no, and here's why" scores more than a confident "yes."
