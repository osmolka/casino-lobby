import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DEFAULT_FILTERS, type Filters } from './filters';
import { SEARCH_DEBOUNCE_MS, useCatalogFilters } from './useCatalogFilters';
import { makeGame } from './testGames';

// Calls the prototype method so test setup bypasses the instance spies below.
function setUrl(search: string) {
  History.prototype.replaceState.call(window.history, null, '', `/${search}`);
}

/** Simulates Back/Forward: the browser has already changed the URL when popstate fires. */
function popTo(search: string) {
  setUrl(search);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

let pushSpy: MockInstance<History['pushState']>;
let replaceSpy: MockInstance<History['replaceState']>;

beforeEach(() => {
  vi.useFakeTimers();
  setUrl('');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setUrl('');
});

/** Renders the hook, then starts counting history writes (mount-time canonicalization excluded). */
function render(search: string, options: { strict?: boolean } = {}) {
  setUrl(search);
  const renders: Filters[] = [];
  const hook = renderHook(
    () => {
      const api = useCatalogFilters();
      renders.push(api.filters);
      return api;
    },
    options.strict ? { wrapper: StrictMode } : {},
  );
  pushSpy = vi.spyOn(window.history, 'pushState');
  replaceSpy = vi.spyOn(window.history, 'replaceState');
  return { ...hook, renders };
}

const search = () => window.location.search;

describe('useCatalogFilters', () => {
  it('reads the initial state synchronously from the URL on the first render', () => {
    const { result, renders } = render('?cat=live&prov=pixel-oak&q=book&sort=new');
    const expected: Filters = { cat: 'live', prov: ['pixel-oak'], tag: null, q: 'book', sort: 'new' };
    expect(renders[0]).toEqual(expected);
    expect(result.current.filters).toEqual(expected);
    expect(result.current.query).toBe('book');
  });

  it('canonicalizes a non-canonical URL on mount with replaceState', () => {
    setUrl('?sort=trending&prov=b,a,a&mock=slow&cat=nope');
    const replace = vi.spyOn(window.history, 'replaceState');
    const push = vi.spyOn(window.history, 'pushState');
    renderHook(() => useCatalogFilters());
    expect(search()).toBe('?prov=a,b&mock=slow');
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes a canonical URL on a discrete filter change', () => {
    const { result } = render('');
    act(() => {
      result.current.update({ prov: ['pixel-oak', 'ember-games'], cat: 'slots' });
    });
    expect(search()).toBe('?cat=slots&prov=ember-games,pixel-oak');
    expect(result.current.filters.prov).toEqual(['ember-games', 'pixel-oak']);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('preserves ?mock on a discrete filter change', () => {
    const { result } = render('?mock=fail-catalog');
    act(() => {
      result.current.update({ sort: 'rtp' });
    });
    expect(search()).toBe('?sort=rtp&mock=fail-catalog');
  });

  it('preserves ?mock on a debounced search update', () => {
    const { result } = render('?mock=fail-catalog');
    act(() => {
      result.current.setQuery('book');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(search()).toBe('?q=book&mock=fail-catalog');
  });

  it('updates the input value instantly and the URL and list after the debounce via replaceState', () => {
    const { result } = render('');
    act(() => {
      result.current.setQuery('bo');
    });
    expect(result.current.query).toBe('bo');
    expect(result.current.filters.q).toBe('');
    expect(search()).toBe('');

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(result.current.filters.q).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.filters.q).toBe('bo');
    expect(search()).toBe('?q=bo');
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('restarts the debounce on each keystroke and applies only the last value', () => {
    const { result } = render('');
    act(() => {
      result.current.setQuery('b');
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.setQuery('bo');
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.setQuery('book');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(result.current.filters.q).toBe('book');
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it('commits a whitespace-only query as the default (no q in the URL)', () => {
    const { result } = render('?q=book');
    act(() => {
      result.current.setQuery('   ');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(result.current.filters.q).toBe('');
    expect(result.current.query).toBe('   ');
    expect(search()).toBe('');
  });

  it('flushes a pending query into the same pushState when a discrete filter changes', () => {
    const { result } = render('');
    act(() => {
      result.current.setQuery('book');
    });
    act(() => {
      result.current.update({ cat: 'slots' });
    });
    expect(search()).toBe('?cat=slots&q=book');
    expect(result.current.filters.q).toBe('book');
    expect(pushSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('does not push a history entry when the same state is applied again', () => {
    const { result } = render('?cat=live');
    act(() => {
      result.current.update({ cat: 'live' });
    });
    act(() => {
      result.current.update({ prov: [] });
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('does not write the URL when the debounced query equals the applied one', () => {
    const { result } = render('?q=book');
    act(() => {
      result.current.setQuery(' book ');
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('restores filters and the input value on popstate and cancels a pending search', () => {
    const { result } = render('?cat=live');
    act(() => {
      result.current.setQuery('typing');
    });
    act(() => {
      popTo('?tag=jackpot&q=book');
    });
    expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, tag: 'jackpot', q: 'book' });
    expect(result.current.query).toBe('book');

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    });
    expect(result.current.filters.q).toBe('book');
    expect(search()).toBe('?tag=jackpot&q=book');
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  describe('hash (#game-<id> card links)', () => {
    it('ignores a hash-only popstate: the pending search still applies and the input is not resynced', () => {
      const { result } = render('?cat=live');
      act(() => {
        result.current.setQuery('book');
      });
      act(() => {
        popTo('?cat=live#game-x');
      });
      expect(result.current.query).toBe('book');
      expect(result.current.filters.q).toBe('');

      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
      expect(result.current.filters.q).toBe('book');
      expect(window.location.search).toBe('?cat=live&q=book');
      expect(window.location.hash).toBe('#game-x');
    });

    it('drops the hash on a discrete filter push', () => {
      const { result } = render('?cat=live#game-x');
      act(() => {
        result.current.update({ sort: 'rtp' });
      });
      expect(search()).toBe('?cat=live&sort=rtp');
      expect(window.location.hash).toBe('');
      expect(pushSpy).toHaveBeenCalledTimes(1);
    });

    it('drops the hash on reset', () => {
      const { result } = render('?cat=live#game-x');
      act(() => {
        result.current.reset();
      });
      expect(window.location.hash).toBe('');
    });

    it('keeps the hash on replaceState writes (mount canonicalization, debounced search)', () => {
      const { result } = render('?sort=trending&cat=live#game-x');
      expect(search()).toBe('?cat=live');
      expect(window.location.hash).toBe('#game-x');
      act(() => {
        result.current.setQuery('book');
      });
      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
      expect(search()).toBe('?cat=live&q=book');
      expect(window.location.hash).toBe('#game-x');
    });
  });

  it('reset clears all filters and the input in one push, keeping mock', () => {
    const { result } = render('?cat=live&q=book&mock=slow');
    act(() => {
      result.current.reset();
    });
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
    expect(result.current.query).toBe('');
    expect(search()).toBe('?mock=slow');
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  describe('navigate (command palette)', () => {
    it('replaces all filters in one push, cancels a pending query and syncs the input', () => {
      const { result } = render('?cat=live&sort=rtp&mock=slow#game-x');
      act(() => {
        result.current.setQuery('typed');
      });
      act(() => {
        result.current.navigate({ ...DEFAULT_FILTERS, q: 'Book of Dawn', sort: 'rtp' });
      });
      expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, q: 'Book of Dawn', sort: 'rtp' });
      expect(result.current.query).toBe('Book of Dawn');
      expect(search()).toBe('?q=Book%20of%20Dawn&sort=rtp&mock=slow');
      expect(window.location.hash).toBe('');
      expect(pushSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      });
      expect(result.current.query).toBe('Book of Dawn');
      expect(replaceSpy).not.toHaveBeenCalled();

      act(() => {
        popTo('?cat=live&sort=rtp&mock=slow');
      });
      expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, cat: 'live', sort: 'rtp' });
      expect(result.current.query).toBe('');
    });

    it('syncs the input even when the filters do not change (no history entry)', () => {
      const { result } = render('?q=book');
      act(() => {
        result.current.setQuery('boo');
      });
      act(() => {
        result.current.navigate({ ...DEFAULT_FILTERS, q: 'book' });
      });
      expect(result.current.query).toBe('book');
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  describe('sanitize', () => {
    const catalog = [makeGame({ id: '1', provider: 'ember-games', tags: ['jackpot'] })];

    it('drops unknown providers and tags with replaceState', () => {
      const { result } = render('?prov=ember-games,ghost&tag=megaways&mock=slow');
      act(() => {
        result.current.sanitize(catalog);
      });
      expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, prov: ['ember-games'] });
      expect(search()).toBe('?prov=ember-games&mock=slow');
      expect(replaceSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('does nothing when every value is known', () => {
      const { result } = render('?prov=ember-games&tag=jackpot');
      act(() => {
        result.current.sanitize(catalog);
      });
      expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('also sanitizes a state restored by popstate once the catalog is known', () => {
      const { result } = render('');
      act(() => {
        result.current.sanitize(catalog);
      });
      act(() => {
        popTo('?prov=ghost');
      });
      expect(result.current.filters.prov).toEqual([]);
      expect(search()).toBe('');
      expect(replaceSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('removes the popstate listener and the pending timer on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { result, unmount } = render('');
    act(() => {
      result.current.setQuery('book');
    });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    popTo('?cat=live');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('registers exactly one popstate listener under StrictMode', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render('', { strict: true });
    const count = (spy: typeof addSpy) => spy.mock.calls.filter(([type]) => type === 'popstate').length;
    expect(count(addSpy) - count(removeSpy)).toBe(1);
    unmount();
    expect(count(addSpy) - count(removeSpy)).toBe(0);
  });
});
