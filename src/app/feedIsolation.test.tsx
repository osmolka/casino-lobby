import { StrictMode, type ProfilerOnRenderCallback } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGame } from '../features/catalog/testGames';
import { SEED_COUNT } from '../features/feed/feedStore';
import { MIN_DELAY_MS } from '../features/feed/generator';
import { setupUser } from '../test/user';
import { App } from './App';

const { gridCommits } = vi.hoisted(() => ({ gridCommits: vi.fn<ProfilerOnRenderCallback>() }));

// A <Profiler> where the catalog grid is mounted. The wrapper is not memoized, so the Profiler commits
// whenever Catalog re-renders at all, even when memo(GameGrid) itself would bail out.
vi.mock('../features/catalog/GameGrid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/catalog/GameGrid')>();
  const { Profiler, createElement } = await import('react');
  return {
    ...actual,
    GameGrid: (props: Parameters<typeof actual.GameGrid>[0]) =>
      createElement(Profiler, { id: 'catalog-grid', onRender: gridCommits }, createElement(actual.GameGrid, props)),
  };
});

const games = Array.from({ length: 30 }, (_, i) => makeGame({ id: `g${i}`, title: `Game ${i}` }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // every feed tick = MIN_DELAY_MS
  History.prototype.replaceState.call(window.history, null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(games), { status: 200 }))),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

describe('feed isolation', () => {
  it('10 feed ticks cause 0 catalog grid commits (real <App/>, StrictMode)', async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await advance(1000); // catalog, wallet and feed connect (400 ms each with random = 0)

    const feed = screen.getByRole('list', { name: 'Recent wins' });
    expect(within(feed).getAllByRole('listitem')).toHaveLength(SEED_COUNT);
    expect(screen.getByRole('main').querySelectorAll('ul[role="list"] > li')).toHaveLength(games.length);
    expect(gridCommits).toHaveBeenCalled(); // the probe is wired to the grid

    gridCommits.mockClear();
    for (let tick = 0; tick < 10; tick++) await advance(MIN_DELAY_MS);

    expect(within(feed).getAllByRole('listitem')).toHaveLength(SEED_COUNT + 10);
    expect(gridCommits).toHaveBeenCalledTimes(0);
  });
});

describe('command palette isolation', () => {
  it('opening the palette and typing cause 0 catalog grid commits (real <App/>, StrictMode)', async () => {
    // Feed ticks keep running here; the test above shows they never commit the grid.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const user = setupUser();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await advance(1000);
    expect(gridCommits).toHaveBeenCalled();
    gridCommits.mockClear();

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Search' }));
    const input = screen.getByRole('combobox', { name: 'Search games, providers and actions' });
    await user.keyboard('game 1{ArrowDown}{ArrowDown}{End}{Home}');
    await user.clear(input);
    await user.keyboard('xyz');
    expect(screen.getByRole('dialog', { name: 'Search and commands' })).toBeDefined();
    expect(gridCommits).toHaveBeenCalledTimes(0);

    await user.keyboard('{Escape}');
    expect(gridCommits).toHaveBeenCalledTimes(0);
  });
});
