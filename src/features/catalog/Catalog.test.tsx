import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { Catalog } from './Catalog';
import { parseFilters } from './urlState';
import { selectGames } from './filters';
import { makeGame } from './testGames';
import { thumbnailSpec } from './thumbnail';
import type { Game } from './types';

// fireEvent, not user-event: RTL's async wrapper waits on a setTimeout that vitest fake timers never fire.

// Spy on the thumbnail builder: one call per card render, so it shows whether memoized cards re-render.
vi.mock('./thumbnail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./thumbnail')>();
  return { ...actual, thumbnailSpec: vi.fn(actual.thumbnailSpec) };
});

const games: Game[] = [
  makeGame({ id: 'a', title: 'Book of Embers', provider: 'ember-games', providerName: 'Ember Games', tags: ['bonus-buy'], rtp: 96.5, popularity: 90, minBet: 20, maxBet: 10_000 }),
  makeGame({ id: 'b', title: 'Lightning Roulette', provider: 'silverline-live', providerName: 'Silverline Live', category: 'live', tags: ['jackpot'], rtp: 97.3, popularity: 80 }),
  makeGame({ id: 'c', title: 'Blackjack Classic', provider: 'red-lantern', providerName: 'Red Lantern', category: 'table', tags: ['classic'], rtp: 99.5, popularity: 70 }),
  makeGame({ id: 'd', title: 'Book of Dawn', provider: 'pixel-oak', providerName: 'Pixel Oak', tags: ['megaways', 'jackpot'], rtp: 95.9, popularity: 60 }),
  makeGame({ id: 'e', title: 'Ember Megaways', provider: 'ember-games', providerName: 'Ember Games', tags: ['megaways'], rtp: 96.8, popularity: 50 }),
  makeGame({ id: 'f', title: 'Pixel Gold', provider: 'pixel-oak', providerName: 'Pixel Oak', tags: ['cascading'], rtp: 97, popularity: 40 }),
];

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function setUrl(url: string) {
  History.prototype.replaceState.call(window.history, null, '', `/${url}`);
}

/** Simulates Back/Forward: the browser has already changed the URL when popstate fires. */
function popTo(url: string) {
  act(() => {
    setUrl(url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setUrl('');
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(games)));
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(thumbnailSpec).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  setUrl('');
});

function renderCatalog(url = '', options: { strict?: boolean } = {}) {
  setUrl(url);
  const ui = (
    <LocaleProvider>
      <Catalog />
    </LocaleProvider>
  );
  const view = render(options.strict ? <StrictMode>{ui}</StrictMode> : ui);
  return view;
}

/** Lets the artificial delay (400–900 ms, +2500 ms with mock=slow) and the fetch settle. */
async function load(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Card accessible names (aria-labelledby: title + provider), in DOM order. */
const cardNames = () => screen.queryAllByRole('link').map(accessibleName);
function accessibleName(el: HTMLElement): string {
  return (el.getAttribute('aria-labelledby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}
const expectedNames = (search: string) => selectGames(games, parseFilters(search)).map((g) => `${g.title} ${g.providerName}`);
const status = () => screen.getByRole('status');
const pressed = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', { name }).getAttribute('aria-pressed');
const heading = () => screen.getByRole('heading', { level: 1, name: 'Games' });

describe('Catalog', () => {
  it('shows a busy skeleton with hidden loading text, then the cards and the count', async () => {
    const { container } = renderCatalog();
    const skeleton = container.querySelector('[aria-busy="true"]');
    expect(skeleton?.textContent).toBe('Loading games');
    expect(status().textContent).toBe('');
    expect(status().getAttribute('aria-live')).toBe('polite');

    await load();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(status().textContent).toBe('6 games');
    expect(screen.getAllByRole('link')).toHaveLength(6);
  });

  it('restores a combined deep link: identical list, order and controls', async () => {
    const url = '?cat=slots&prov=ember-games,pixel-oak&tag=megaways&q=e&sort=rtp';
    renderCatalog(url);
    await load();

    expect(cardNames()).toEqual(expectedNames(url));
    expect(cardNames()).toEqual(['Ember Megaways Ember Games', 'Book of Dawn Pixel Oak']);
    expect(pressed('Category', 'Slots')).toBe('true');
    expect(pressed('Category', 'All')).toBe('false');
    expect(pressed('Tag', 'Megaways')).toBe('true');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Ember Games' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Red Lantern' }).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search games' }).value).toBe('e');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Sort by' }).value).toBe('rtp');
    expect(window.location.search).toBe(url);
  });

  it('renders the full catalog for a garbage URL without crashing', async () => {
    renderCatalog('?cat=casino&prov=%%%,UPPER,<b>&tag=../x&sort=random&cat=&foo=bar&%E0%A4%A=1');
    await load();
    expect(cardNames()).toEqual(expectedNames(''));
    expect(pressed('Category', 'All')).toBe('true');
    expect(pressed('Tag', 'All')).toBe('true');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Sort by' }).value).toBe('trending');
  });

  it('keeps a malformed percent-encoded query as typed and shows the empty state', async () => {
    renderCatalog('?q=%E0%A4%A');
    await load();
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search games' }).value).toBe('\uFFFD%A');
    expect(screen.getByRole('heading', { level: 2, name: 'No games match these filters' })).toBeDefined();
  });

  it('drops providers the catalog does not have once it loads', async () => {
    renderCatalog('?prov=ghost,pixel-oak');
    await load();
    expect(window.location.search).toBe('?prov=pixel-oak');
    expect(cardNames()).toEqual(expectedNames('?prov=pixel-oak'));
  });

  it('pushes a chip click to the URL; Back and Forward restore list and controls', async () => {
    renderCatalog();
    await load();
    const push = vi.spyOn(window.history, 'pushState');

    fireEvent.click(screen.getByRole('button', { name: 'Live casino' }));
    expect(window.location.search).toBe('?cat=live');
    expect(push).toHaveBeenCalledTimes(1);
    expect(cardNames()).toEqual(expectedNames('?cat=live'));
    expect(pressed('Category', 'Live casino')).toBe('true');

    popTo('');
    expect(cardNames()).toEqual(expectedNames(''));
    expect(pressed('Category', 'All')).toBe('true');

    popTo('?cat=live');
    expect(cardNames()).toEqual(expectedNames('?cat=live'));
    expect(pressed('Category', 'Live casino')).toBe('true');
  });

  it('toggles providers as a multi-select (OR within the group)', async () => {
    renderCatalog();
    await load();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pixel Oak' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Red Lantern' }));
    expect(window.location.search).toBe('?prov=pixel-oak,red-lantern');
    expect(cardNames()).toEqual(expectedNames('?prov=pixel-oak,red-lantern'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pixel Oak' }));
    expect(window.location.search).toBe('?prov=red-lantern');
  });

  it('updates the input instantly and the list and URL after the debounce', async () => {
    renderCatalog();
    await load();
    const input = screen.getByRole('searchbox', { name: 'Search games' });
    fireEvent.change(input, { target: { value: 'book' } });
    expect((input as HTMLInputElement).value).toBe('book');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(cardNames()).toEqual(expectedNames('?q=book'));
    expect(status().textContent).toBe('2 games');
    expect(window.location.search).toBe('?q=book');
  });

  it('hides Clear filters for the defaults and shows it for a non-default sort', async () => {
    renderCatalog();
    await load();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'rtp' } });
    expect(window.location.search).toBe('?sort=rtp');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDefined();
  });

  it('empty state: Clear filters restores every default incl. sort, keeps mock and focuses the heading', async () => {
    renderCatalog('?cat=table&q=zzz&sort=rtp&mock=slow');
    await load(4000);
    expect(screen.getByRole('heading', { level: 2, name: 'No games match these filters' })).toBeDefined();
    expect(status().textContent).toBe('0 games');

    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    const emptyStateButton = buttons[buttons.length - 1];
    if (!emptyStateButton) throw new Error('no Clear filters button');
    fireEvent.click(emptyStateButton);

    expect(window.location.search).toBe('?mock=slow');
    expect(cardNames()).toEqual(expectedNames(''));
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search games' }).value).toBe('');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Sort by' }).value).toBe('trending');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    expect(document.activeElement).toBe(heading());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('error state: shows the message, Retry reloads and focus moves to the heading', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderCatalog();
    await load();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not reach the server');
    expect(screen.queryAllByRole('link')).toHaveLength(0);

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(heading());
    expect(document.activeElement).not.toBe(document.body);

    await load();
    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cards are #game-<id> links named by title and provider, described by tags, RTP and bets', async () => {
    renderCatalog();
    await load();
    const card = screen.getByRole('link', { name: 'Book of Embers Ember Games' });
    expect(card.getAttribute('href')).toBe('#game-a');
    expect(card.id).toBe('game-a');
    const details = document.getElementById(card.getAttribute('aria-describedby') ?? '');
    expect(details?.textContent).toBe('Bonus buyRTP 96.5%Bet €0.20 – €100.00');
    expect(card.querySelectorAll('bdi')).toHaveLength(2);
  });

  it('has no duplicate ids in the rendered grid', async () => {
    const { container } = renderCatalog();
    await load();
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(games.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('labels tags from the dictionary and falls back to the slug for unknown ones', async () => {
    renderCatalog();
    await load();
    expect(within(screen.getByRole('group', { name: 'Tag' })).getByRole('button', { name: 'Bonus buy' })).toBeDefined();
    expect(within(screen.getByRole('group', { name: 'Tag' })).getByRole('button', { name: 'cascading' })).toBeDefined();
  });

  it('mobile disclosure: aria-expanded toggles and the label shows the active filter count', async () => {
    renderCatalog('?cat=slots&prov=pixel-oak&sort=rtp');
    await load();
    const toggle = screen.getByRole('button', { name: 'Filters (2)' });
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.dataset.open).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.dataset.open).toBe('true');
  });

  it('memoized cards do not re-render on filter or search-input changes', async () => {
    renderCatalog();
    await load();
    const spec = vi.mocked(thumbnailSpec);
    expect(spec).toHaveBeenCalledTimes(6);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search games' }), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Slots' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(spec).toHaveBeenCalledTimes(6);
  });

  it('fetches once under StrictMode and logs no errors', async () => {
    const error = vi.spyOn(console, 'error');
    renderCatalog('', { strict: true });
    await load();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(error).not.toHaveBeenCalled();
  });
});
