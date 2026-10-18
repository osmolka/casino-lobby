import { StrictMode, type ProfilerOnRenderCallback } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import promosJson from '../../public/api/promos.json?raw';
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
    vi.fn<typeof fetch>((input) =>
      Promise.resolve(new Response((input instanceof Request ? input.url : input.toString()).endsWith('promos.json') ? promosJson : JSON.stringify(games), { status: 200 })),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Catalog cards: the grid is the only unlabelled list in <main> (the promos list is labelled). */
const gridItems = () => screen.getByRole('main').querySelectorAll('ul[role="list"]:not([aria-label]) > li');

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
    expect(gridItems()).toHaveLength(games.length);
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

describe('promos isolation', () => {
  const promosRegion = () => screen.getByRole('region', { name: 'Promotions' });
  const renderApp = () =>
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

  it('promos loading and arriving cause 0 catalog grid commits (real <App/>, StrictMode)', async () => {
    renderApp();
    await advance(400); // catalog ready; promos (600 ms with random = 0) still loading
    expect(gridItems()).toHaveLength(games.length);
    expect(promosRegion().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(gridCommits).toHaveBeenCalled();
    gridCommits.mockClear();

    await advance(200);
    expect(within(promosRegion()).getAllByRole('link')).toHaveLength(5);
    expect(gridCommits).toHaveBeenCalledTimes(0);
  });

  it('?mock=fail-promos: the catalog still loads and filters; Retry causes 0 grid commits', async () => {
    History.prototype.replaceState.call(window.history, null, '', '/?mock=fail-promos');
    renderApp();
    await advance(1000);
    expect(within(promosRegion()).getByRole('alert')).toBeDefined();
    expect(gridItems()).toHaveLength(games.length);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Game 12' } });
    await advance(300);
    expect(gridItems()).toHaveLength(1);

    gridCommits.mockClear();
    fireEvent.click(within(promosRegion()).getByRole('button', { name: 'Try again' }));
    await advance(1000);
    expect(within(promosRegion()).getByRole('alert')).toBeDefined(); // the flag is still in the URL
    expect(gridCommits).toHaveBeenCalledTimes(0);
  });
});

describe('accent isolation', () => {
  it('opening settings, moving the hue slider and Reset cause 0 catalog grid commits (real <App/>, StrictMode)', async () => {
    const user = setupUser();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await advance(1000);
    expect(gridItems()).toHaveLength(games.length);
    expect(gridCommits).toHaveBeenCalled();
    gridCommits.mockClear();

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Settings' }));
    const slider = screen.getByRole('slider', { name: 'Accent hue' });
    for (const hue of ['0', '60', '180', '300']) fireEvent.change(slider, { target: { value: hue } });
    expect(document.documentElement.style.getPropertyValue('--accent-h')).toBe('300');
    await user.click(screen.getByRole('button', { name: 'Reset accent' }));
    expect(document.documentElement.style.getPropertyValue('--accent-h')).toBe('');
    expect(gridCommits).toHaveBeenCalledTimes(0);
  });
});
