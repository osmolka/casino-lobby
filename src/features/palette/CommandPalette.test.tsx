import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { App } from '../../app/App';
import { setupUser } from '../../test/user';
import { makeGame } from '../catalog/testGames';
import { SEARCH_DEBOUNCE_MS } from '../catalog/useCatalogFilters';

const games = [
  makeGame({ id: 'a', title: 'Book of Embers', provider: 'ember-games', providerName: 'Ember Games', popularity: 90 }),
  makeGame({ id: 'b', title: 'Lightning Roulette', provider: 'silverline-live', providerName: 'Silverline Live', category: 'live', popularity: 80 }),
  makeGame({ id: 'c', title: 'Blackjack Classic', provider: 'red-lantern', providerName: 'Red Lantern', category: 'table', tags: ['classic'], popularity: 70 }),
  makeGame({ id: 'd', title: 'Book of Dawn', provider: 'pixel-oak', providerName: 'Pixel Oak', popularity: 60 }),
  makeGame({ id: 'e', title: 'Frozen Vault XL', provider: 'pixel-oak', providerName: 'Pixel Oak', popularity: 50 }),
];

function setUrl(url: string) {
  History.prototype.replaceState.call(window.history, null, '', `/${url}`);
}

let pushSpy: MockInstance<History['pushState']>;
let scrollSpy: MockInstance<Element['scrollIntoView']>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0); // catalog, wallet and feed load in 400 ms
  setUrl('');
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(games), { status: 200 }))),
  );
  scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  setUrl('');
});

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function renderApp(url = '') {
  setUrl(url);
  const user = setupUser();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await advance(500);
  pushSpy = vi.spyOn(window.history, 'pushState');
  return user;
}

const trigger = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Search' });
const palette = () => screen.getByRole('dialog', { name: 'Search and commands' });
const queryPalette = () => screen.queryByRole('dialog', { name: 'Search and commands' });
const combobox = () => within(palette()).getByRole('combobox', { name: 'Search games, providers and actions' });
const options = () => within(palette()).getAllByRole('option');
const option = (label: string) => {
  const found = options().find((o) => o.textContent.startsWith(label));
  if (!found) throw new Error(`no option "${label}"`);
  return found;
};
const activeOption = () => {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};
const card = (id: string) => document.getElementById(`game-${id}`);

describe('command palette: open and close', () => {
  it('opens with the header button, focuses the combobox, Esc closes and returns focus to the button', async () => {
    const user = await renderApp();
    await user.click(trigger());
    expect(document.activeElement).toBe(combobox());
    await user.keyboard('{Escape}');
    expect(queryPalette()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Ctrl+K and Cmd+K toggle it, also with focus in an input; the default is prevented', async () => {
    const user = await renderApp();
    const search = screen.getByRole('searchbox', { name: 'Search games' });
    await user.click(search);
    await user.keyboard('{Control>}k{/Control}');
    expect(document.activeElement).toBe(combobox());
    await user.keyboard('{Control>}k{/Control}'); // focus is in the palette's input now
    expect(queryPalette()).toBeNull();
    expect(document.activeElement).toBe(search);

    await user.keyboard('{Meta>}k{/Meta}');
    expect(queryPalette()).not.toBeNull();
    await user.keyboard('{Escape}');

    const event = new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('matches the physical key: Ctrl+K on a Russian layout (key "л")', async () => {
    await renderApp();
    fireEvent.keyDown(document.body, { code: 'KeyK', key: 'л', ctrlKey: true });
    expect(queryPalette()).not.toBeNull();
  });
});

describe('command palette: combobox', () => {
  it('ARIA: combobox → listbox with groups and options; result count in a status region from the first render', async () => {
    const user = await renderApp();
    await user.click(trigger());
    const input = combobox();
    const listbox = within(palette()).getByRole('listbox', { name: 'Results' });
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(within(palette()).getByRole('status').textContent).toBe(`${options().length} results`);
    expect(within(listbox).getAllByRole('group').map((g) => g.getAttribute('aria-labelledby') && document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent)).toEqual([
      'Actions',
      'Games',
      'Providers',
    ]);
    expect(activeOption()).toBe(options()[0]);
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual(options().map((_, i) => String(i === 0)));

    await user.keyboard('qqqq');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(within(palette()).getByRole('status').textContent).toBe('0 results');
    expect(within(palette()).getByText('qqqq')).toBeDefined();
  });

  it('empty query: actions, then Trending games, then providers', async () => {
    const user = await renderApp('?cat=live');
    await user.click(trigger());
    expect(options().map((o) => o.textContent)).toEqual([
      'Switch to dark theme',
      'Change language to Русский',
      'Make a deposit',
      'Clear filters',
      'Book of EmbersEmber Games',
      'Lightning RouletteSilverline Live',
      'Blackjack ClassicRed Lantern',
      'Book of DawnPixel Oak',
      'Frozen Vault XLPixel Oak',
      'Ember Games1 game',
    ]); // max 10: the language action pushed the last provider out
  });

  it('keyboard order equals DOM order across groups: ↓ ↑ wrap, Home, End', async () => {
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('o');
    const dom = options();
    expect(new Set(dom.map((o) => o.closest('[role="group"]'))).size).toBeGreaterThan(1);

    const seen = [activeOption()];
    for (let i = 1; i < dom.length; i++) {
      await user.keyboard('{ArrowDown}');
      seen.push(activeOption());
    }
    expect(seen).toEqual(dom);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(dom[0]);
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toBe(dom.at(-1));
    await user.keyboard('{Home}');
    expect(activeOption()).toBe(dom[0]);
    await user.keyboard('{End}');
    expect(activeOption()).toBe(dom.at(-1));
    expect(activeOption()?.getAttribute('aria-selected')).toBe('true');
    expect(scrollSpy).toHaveBeenLastCalledWith({ block: 'nearest' });
  });

  it('typing resets the active option to the first match', async () => {
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('{End}b');
    expect(activeOption()).toBe(options()[0]);
  });

  it('highlights matched characters, one <mark> per run of adjacent matches', async () => {
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('frz vlt');
    const marks = [...option('Frozen Vault XL').querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['Fr', 'z', 'V', 'lt']);
  });

  it('ignores Enter while an IME is composing', async () => {
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('frozen');
    fireEvent.keyDown(combobox(), { key: 'Enter', isComposing: true });
    expect(queryPalette()).not.toBeNull();
    fireEvent.keyDown(combobox(), { key: 'Enter' });
    expect(queryPalette()).toBeNull();
  });

  it('pointer: hover moves the active option, click selects it', async () => {
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('book');
    await user.hover(option('Book of Dawn'));
    expect(activeOption()).toBe(option('Book of Dawn'));
    await user.click(option('Book of Dawn'));
    expect(queryPalette()).toBeNull();
    expect(document.activeElement).toBe(card('d'));
  });
});

describe('command palette: games and providers', () => {
  it('a game in the current results: focus moves to its card after the dialog returned focus; no history entry', async () => {
    const user = await renderApp();
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    await user.click(trigger());
    await user.keyboard('frz vlt{Enter}');

    expect(queryPalette()).toBeNull();
    expect(document.activeElement).toBe(card('e'));
    const focused = focusSpy.mock.contexts;
    expect(focused.indexOf(trigger())).toBeGreaterThan(-1);
    expect(focused.lastIndexOf(card('e') as HTMLElement)).toBeGreaterThan(focused.lastIndexOf(trigger()));
    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(scrollSpy.mock.contexts.at(-1)).toBe(card('e'));
    expect(scrollSpy).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('a hidden game: defaults + q = title (sort kept) in one push, pending search dropped, input synced; Back restores', async () => {
    const user = await renderApp('?cat=live&sort=rtp');
    expect(card('d')).toBeNull();
    const search = screen.getByRole('searchbox', { name: 'Search games' });
    await user.type(search, 'zzz'); // still debouncing
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('book of dawn{Enter}');

    expect(window.location.search).toBe('?q=Book%20of%20Dawn&sort=rtp');
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(search).toHaveProperty('value', 'Book of Dawn');
    expect(document.activeElement).toBe(card('d'));
    await advance(SEARCH_DEBOUNCE_MS);
    expect(window.location.search).toBe('?q=Book%20of%20Dawn&sort=rtp');
    expect(card('d')).not.toBeNull();

    act(() => {
      setUrl('?cat=live&sort=rtp');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(search).toHaveProperty('value', '');
    expect(card('d')).toBeNull();
    expect(card('b')).not.toBeNull();
  });

  it('honors prefers-reduced-motion: the card scroll is not smooth', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('frz vlt{Enter}');
    expect(scrollSpy).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('a provider: defaults + prov = [slug] (sort kept) in one push, then focus on the results heading', async () => {
    const user = await renderApp('?cat=table&tag=classic&sort=new');
    await user.click(trigger());
    await user.keyboard('pixel oak{Enter}');
    expect(window.location.search).toBe('?prov=pixel-oak&sort=new');
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Games' }));
    expect(card('d')).not.toBeNull();
    expect(card('e')).not.toBeNull();
    expect(card('a')).toBeNull();
  });
});

describe('command palette: actions', () => {
  it('theme: flips data-theme, closes, focus back on the trigger', async () => {
    document.documentElement.dataset.theme = 'light';
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('dark{Enter}');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark theme' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(trigger());
    await user.click(trigger());
    expect(option('Switch to light theme')).toBeDefined();
  });

  it('clear filters: listed only while filters are active; resets them and focuses the heading', async () => {
    const user = await renderApp('?cat=live');
    await user.click(trigger());
    await user.keyboard('clear{Enter}');
    expect(window.location.search).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Games' }));
    await user.click(trigger());
    await user.keyboard('clear');
    expect(within(palette()).queryAllByRole('option')).toHaveLength(0);
  });

  it('deposit: the palette closes before the deposit dialog opens; focus never ends on body', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const openAtShow: number[] = [];
    showModal.mockImplementation(function (this: HTMLDialogElement) {
      openAtShow.push(document.querySelectorAll('dialog[open]').length);
      this.setAttribute('open', '');
    });
    const user = await renderApp();
    await user.click(trigger());
    await user.keyboard('deposit{Enter}');

    const deposit = screen.getByRole('dialog', { name: 'Deposit' });
    expect(queryPalette()).toBeNull();
    expect(openAtShow).toEqual([0, 0]);
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(1);
    expect(deposit.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Deposit' })).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(trigger());
  });

  it('the hotkey does nothing while another dialog is open', async () => {
    const user = await renderApp();
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Deposit' }));
    await user.keyboard('{Control>}k{/Control}');
    expect(queryPalette()).toBeNull();
  });
});

describe('command palette: catalog states', () => {
  it('catalog failed: actions only, a note with Retry that keeps focus in the dialog', async () => {
    const user = await renderApp('?mock=fail-catalog');
    await user.click(trigger());
    expect(options().map((o) => o.textContent)).toEqual(['Switch to dark theme', 'Change language to Русский', 'Make a deposit']);
    await user.click(within(palette()).getByRole('button', { name: 'Try again' }));
    expect(document.activeElement).toBe(combobox());
    expect(within(palette()).getByText('Loading games')).toBeDefined();
  });
});

describe('command palette in ru', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru'; // what the boot script sets for a stored ru choice
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const ruPalette = () => screen.getByRole('dialog', { name: 'Поиск и команды' });
  const ruInput = () => within(ruPalette()).getByRole('combobox', { name: 'Поиск игр, провайдеров и действий' });
  const labels = () => within(ruPalette()).getAllByRole('option').map((o) => o.textContent);

  it('actions have Russian names; the language action lists only the other locale', async () => {
    const user = await renderApp();
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Поиск' }));
    expect(labels().slice(0, 3)).toEqual(['Включить тёмную тему', 'Сменить язык на English', 'Пополнить счёт']);
    expect(labels().some((l) => l.includes('Русский'))).toBe(false);
  });

  it('a Russian query finds the action (е matches ё); Enter on the language action switches to en', async () => {
    const user = await renderApp();
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Поиск' }));
    await user.type(ruInput(), 'темн');
    expect(labels()[0]).toBe('Включить тёмную тему');
    const marks = [...(within(ruPalette()).getAllByRole('option')[0]?.querySelectorAll('mark') ?? [])].map((m) => m.textContent);
    expect(marks).toEqual(['тёмн']); // the highlight is on the original text, with its ё

    await user.clear(ruInput());
    await user.type(ruInput(), 'язык');
    expect(labels()).toEqual(['Сменить язык на English']);
    await user.keyboard('{Enter}');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.queryByRole('dialog', { name: 'Поиск и команды' })).toBeNull();
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Search' })).toBeDefined();
  });
});
