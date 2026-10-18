import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gamesJson from '../../../public/api/games.json?raw';
import promosJson from '../../../public/api/promos.json?raw';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { setFullyVisible, triggerResize } from '../../test/observers';
import { setupUser } from '../../test/user';
import { Catalog } from '../catalog/Catalog';
import { CatalogProvider } from '../catalog/CatalogProvider';
import { Promos } from './Promos';
import { FINE_POINTER } from './usePromoScroller';

let promosResponse: () => Response;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function setUrl(url: string) {
  History.prototype.replaceState.call(window.history, null, '', `/${url}`);
}

/** Records whether the app handled each click, then stops jsdom's (unimplemented) link navigation. */
const handled: boolean[] = [];
function afterReact(event: MouseEvent) {
  handled.push(event.defaultPrevented);
  event.preventDefault();
}

beforeEach(() => {
  vi.useFakeTimers();
  setUrl('');
  promosResponse = () => new Response(promosJson, { status: 200 });
  fetchMock = vi.fn<typeof fetch>((input) =>
    Promise.resolve((input instanceof Request ? input.url : input.toString()).endsWith('promos.json') ? promosResponse() : new Response(gamesJson, { status: 200 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  handled.length = 0;
  window.addEventListener('click', afterReact);
});

afterEach(() => {
  window.removeEventListener('click', afterReact);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  setUrl('');
});

function renderLobby(url = '') {
  setUrl(url);
  return render(
    <StrictMode>
      <LocaleProvider>
        <CatalogProvider>
          <Catalog promos={<Promos />} />
        </CatalogProvider>
      </LocaleProvider>
    </StrictMode>,
  );
}

/** Catalog: 400–900 ms, promos: 600–1100 ms (+2500 ms with mock=slow). */
async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

const promosHeading = () => screen.getByRole('heading', { level: 2, name: 'Promotions' });
const gamesHeading = () => screen.getByRole('heading', { level: 1, name: 'Games' });
const promoList = () => screen.getByRole('list', { name: 'Current promotions' });
const promoLink = (title: string) => within(promoList()).getByRole('link', { name: new RegExp(`^${title}`) });
const search = () => window.location.search;

describe('Promos', () => {
  it('shows a skeleton, then a labelled list of promo links to canonical catalog views', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderLobby();
    const section = screen.getByRole('region', { name: 'Promotions' });
    expect(section.querySelector('[aria-busy="true"]')?.textContent).toBe('Loading promotions');
    expect(within(section).queryByRole('list')).toBeNull();

    await advance(600);
    expect(section.querySelector('[aria-busy="true"]')).toBeNull();
    expect(promoList().getAttribute('role')).toBe('list');
    const links = within(promoList()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/?cat=live',
      '/?tag=new',
      '/?tag=jackpot',
      '/?cat=slots&tag=megaways',
      '/?cat=table',
    ]);
    // Name from content (title, body, call to action); jsdom joins the inline parts without spaces.
    expect(promoLink('Live Casino Week').textContent).toBe(
      'Live Casino WeekReal dealers, real tables. Join a live game tonight.Play live',
    );
  });

  it('heading order: the h1 comes before the promos h2, which comes before the filters', async () => {
    renderLobby();
    await advance(1100);
    expect(gamesHeading().compareDocumentPosition(promosHeading()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const firstFilter = screen.getByRole('searchbox');
    expect(promosHeading().compareDocumentPosition(firstFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('plain click: one pushState to defaults + target (current sort kept), results shown, focus on the h1', async () => {
    renderLobby('?tag=new&q=book&sort=rtp');
    await advance(1100);
    const before = window.history.length;

    fireEvent.click(promoLink('Live Casino Week'));
    expect(handled).toEqual([true]);
    expect(search()).toBe('?cat=live&sort=rtp');
    expect(window.history.length).toBe(before + 1);
    await advance(0);
    expect(document.activeElement).toBe(gamesHeading());
    expect(screen.getAllByRole('status').map((el) => el.textContent)).toContain('20 games'); // banner + count
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
  });

  it('Enter on a focused promo link navigates the same way', async () => {
    const user = setupUser();
    renderLobby();
    await advance(1100);
    promoLink('Megaways madness').focus();
    await user.keyboard('{Enter}');
    expect(search()).toBe('?cat=slots&tag=megaways');
    expect(document.activeElement).toBe(gamesHeading());
  });

  it('same view: no history entry, focus still goes to the h1', async () => {
    renderLobby('?cat=live');
    await advance(1100);
    const before = window.history.length;
    fireEvent.click(promoLink('Live Casino Week'));
    expect(handled).toEqual([true]);
    expect(window.history.length).toBe(before);
    expect(search()).toBe('?cat=live');
    await advance(0);
    expect(document.activeElement).toBe(gamesHeading());
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('%s click is left to the browser', async (_name, init) => {
    renderLobby();
    await advance(1100);
    fireEvent.click(promoLink('Jackpot hunt'), init);
    expect(handled).toEqual([false]);
    expect(search()).toBe('');
  });

  it('a link with a target, or a click already handled, is left alone', async () => {
    renderLobby();
    await advance(1100);
    const link = promoLink('Jackpot hunt');
    link.setAttribute('target', '_blank');
    fireEvent.click(link);
    link.removeAttribute('target');

    const preventFirst = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener('click', preventFirst, { capture: true });
    fireEvent.click(link);
    document.removeEventListener('click', preventFirst, { capture: true });

    expect(handled).toEqual([false, true]); // the second was prevented by the capture listener, not the app
    expect(search()).toBe('');
  });

  it('?mock=fail-promos: compact alert with Retry; Retry shows the skeleton, focuses the h2, then loads', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderLobby('?mock=fail-promos');
    await advance(600);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { level: 3, name: 'Promotions did not load' })).toBeDefined();

    setUrl(''); // the next attempt has no mock flag
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(document.activeElement).toBe(promosHeading());
    expect(screen.getByRole('region', { name: 'Promotions' }).querySelector('[aria-busy="true"]')).not.toBeNull();
    await advance(600);
    expect(within(promoList()).getAllByRole('link')).toHaveLength(5);
  });

  it('HTTP 500 is an error state too', async () => {
    promosResponse = () => new Response('', { status: 500 });
    renderLobby();
    await advance(1100);
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('?mock=empty-promos: compact empty state with Retry, no list', async () => {
    renderLobby('?mock=empty-promos');
    await advance(1100);
    const section = screen.getByRole('region', { name: 'Promotions' });
    expect(within(section).getByRole('heading', { level: 3, name: 'No promotions right now' })).toBeDefined();
    expect(within(section).getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(within(section).queryByRole('list')).toBeNull();
    expect(within(section).queryByRole('alert')).toBeNull();
  });
});

describe('Promos Prev/Next', () => {
  const REDUCE = '(prefers-reduced-motion: reduce)';
  let matching: Set<string>;
  let size: { scroll: number; client: number };

  beforeEach(() => {
    matching = new Set([FINE_POINTER]);
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: matching.has(query),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    size = { scroll: 1600, client: 1000 };
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => size.scroll);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => size.client);
  });

  const prev = () => screen.getByRole('button', { name: 'Previous promotions' });
  const next = () => screen.getByRole('button', { name: 'Next promotions' });
  const items = () => [...promoList().children];
  /** Cards [from, to] are fully visible, as the IntersectionObserver reports after a scroll. */
  const show = (from: number, to: number) => {
    act(() => {
      setFullyVisible((_card, i) => i >= from && i <= to);
    });
  };

  async function loaded(url = '') {
    renderLobby(url);
    await advance(1100);
    show(0, 2);
  }

  it('next = first card after the last fully visible one, prev = last before the first; smooth, inline start', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    await loaded();
    expect(prev().getAttribute('aria-disabled')).toBe('true');
    expect(next().hasAttribute('aria-disabled')).toBe(false);
    expect(next().getAttribute('aria-controls')).toBe(promoList().id);

    fireEvent.click(next());
    expect(scrollSpy.mock.contexts).toEqual([items()[3]]);
    expect(scrollSpy).toHaveBeenLastCalledWith({ inline: 'start', block: 'nearest', behavior: 'smooth' });

    show(2, 4);
    expect(next().getAttribute('aria-disabled')).toBe('true');
    expect(prev().hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(prev());
    expect(scrollSpy.mock.contexts.at(-1)).toBe(items()[1]);
  });

  it('at the end, Enter on Next is a no-op and focus stays on the button (aria-disabled, not disabled)', async () => {
    const user = setupUser();
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    await loaded();
    next().focus();
    await user.keyboard('{Enter}');
    show(3, 4);
    expect(next().getAttribute('aria-disabled')).toBe('true');
    expect(next().hasAttribute('disabled')).toBe(false);
    scrollSpy.mockClear();

    await user.keyboard('{Enter}');
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(next());
  });

  it('reduced motion: the scroll is not smooth', async () => {
    matching.add(REDUCE);
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    await loaded();
    fireEvent.click(next());
    expect(scrollSpy).toHaveBeenLastCalledWith({ inline: 'start', block: 'nearest', behavior: 'auto' });
  });

  it('no buttons while nothing overflows; they follow the track size (ResizeObserver)', async () => {
    size = { scroll: 1000, client: 1000 };
    await loaded();
    expect(screen.queryByRole('button', { name: 'Next promotions' })).toBeNull();

    size = { scroll: 1600, client: 1000 };
    act(() => {
      triggerResize();
    });
    expect(next()).toBeDefined();
    expect(promoList().className).toContain('withControls');

    size = { scroll: 1000, client: 1000 };
    act(() => {
      triggerResize();
    });
    expect(screen.queryByRole('button', { name: 'Previous promotions' })).toBeNull();
    expect(promoList().className).not.toContain('withControls');
  });

  it('no buttons on a touch (coarse) pointer even when the track overflows', async () => {
    matching.clear();
    await loaded();
    expect(screen.queryByRole('button', { name: 'Next promotions' })).toBeNull();
  });

  it('no buttons in the loading, error and empty states', async () => {
    renderLobby('?mock=fail-promos');
    expect(screen.queryByRole('button', { name: 'Next promotions' })).toBeNull();
    await advance(1100);
    expect(screen.queryByRole('button', { name: 'Next promotions' })).toBeNull();
  });
});
