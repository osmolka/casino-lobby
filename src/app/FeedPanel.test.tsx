import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGame } from '../features/catalog/testGames';
import { SEED_COUNT } from '../features/feed/feedStore';
import { TIME_REFRESH_MS } from '../features/feed/FeedList';
import { MIN_DELAY_MS } from '../features/feed/generator';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { FeedPanel } from './FeedPanel';

// Math.random = 0: connect after 400 ms, then exactly one win every MIN_DELAY_MS.
const CONNECT_MS = 400;
const games = [makeGame({ id: 'a', title: 'Book of Embers' }), makeGame({ id: 'b', title: 'Lightning Roulette' })];

function setUrl(url: string) {
  History.prototype.replaceState.call(window.history, null, '', `/${url}`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00.000Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0);
  setUrl('');
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

async function renderPanel(url = '', strict = false) {
  setUrl(url);
  const tree = (
    <LocaleProvider>
      <FeedPanel />
    </LocaleProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  await advance(CONNECT_MS);
}

const list = () => screen.getByRole('list', { name: 'Recent wins' });
const rows = () => within(list()).getAllByRole('listitem');
const pauseButton = () => screen.getByRole('button', { name: /^(Pause|Resume) live feed$/ });
const heading = () => screen.getByRole('heading', { level: 2, name: 'Live wins' });

function setHidden(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Asserts that no win arrives for a long while, then that the feed runs again once `resume` is called. */
async function expectStoppedThenRunning(resume: () => void | Promise<void>) {
  const before = rows().length;
  await advance(10 * MIN_DELAY_MS);
  expect(rows()).toHaveLength(before);
  await resume();
  expect(rows()).toHaveLength(before);
  await advance(MIN_DELAY_MS);
  expect(rows()).toHaveLength(before + 1);
}

describe('FeedPanel', () => {
  it('shows a skeleton while connecting, then the seeded wins', async () => {
    setUrl('');
    render(
      <LocaleProvider>
        <FeedPanel />
      </LocaleProvider>,
    );
    expect(screen.getByRole('status', { name: 'Loading live wins' }).getAttribute('aria-busy')).toBe('true');
    await advance(CONNECT_MS);
    expect(screen.queryByRole('status', { name: 'Loading live wins' })).toBeNull();
    expect(rows()).toHaveLength(SEED_COUNT);
  });

  it('renders each entry with initials, player, amount, game and a <time>', async () => {
    await renderPanel();
    // random = 0: seeds are 20 s apart before the connect time (t0 + 400 ms), the oldest 160 s before it.
    const first = rows()[0];
    const last = rows().at(-1);
    expect(first?.textContent).toBe('MAMila A. won €5.00Book of Embers · just now');
    expect(last?.textContent).toBe('MAMila A. won €5.00Book of Embers · 2 minutes ago');
    expect(first?.querySelector('[aria-hidden="true"]')?.textContent).toBe('MA');
    expect(last?.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-17T11:57:20.400Z');
  });

  it('list is focusable, labelled and has no aria-live on it or its entries', async () => {
    await renderPanel();
    expect(list().tabIndex).toBe(0);
    const panel = screen.getByRole('complementary', { name: 'Live wins' });
    expect(panel.querySelector('[aria-live]')).toBeNull();
  });

  it('adds one win per tick, newest first; existing rows keep their DOM nodes (keys by id)', async () => {
    await renderPanel();
    const oldFirst = rows()[0];
    await advance(MIN_DELAY_MS);
    expect(rows()).toHaveLength(SEED_COUNT + 1);
    expect(rows()[1]).toBe(oldFirst);
    expect(rows()[0]?.textContent).toContain('just now');
  });

  it('StrictMode: one generator per mount, not two', async () => {
    await renderPanel('', true);
    await advance(MIN_DELAY_MS * 3);
    expect(rows()).toHaveLength(SEED_COUNT + 3);
  });

  it('mouse hover on the list pauses; leaving resumes', async () => {
    await renderPanel();
    fireEvent.pointerEnter(list(), { pointerType: 'mouse' });
    expect(screen.getByText('Paused while you read')).toBeDefined();
    await expectStoppedThenRunning(() => {
      fireEvent.pointerLeave(list(), { pointerType: 'mouse' });
    });
  });

  it('a touch pointer does not pause (no sticky pause after a tap)', async () => {
    await renderPanel();
    fireEvent.pointerEnter(list(), { pointerType: 'touch' });
    await advance(MIN_DELAY_MS);
    expect(rows()).toHaveLength(SEED_COUNT + 1);
  });

  it('focus on the list pauses; focus moving inside it does not resume; focus leaving resumes', async () => {
    await renderPanel();
    act(() => {
      list().focus();
    });
    const inside = rows()[0];
    fireEvent.blur(list(), { relatedTarget: inside });
    await expectStoppedThenRunning(() => {
      act(() => {
        pauseButton().focus();
      });
    });
  });

  it('a hidden tab pauses; visible again resumes', async () => {
    await renderPanel();
    setHidden(true);
    await expectStoppedThenRunning(() => {
      setHidden(false);
    });
  });

  it('starts paused when the tab is already hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await renderPanel();
    await advance(10 * MIN_DELAY_MS);
    expect(rows()).toHaveLength(SEED_COUNT);
  });

  it('offline pauses and says so', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await renderPanel();
    expect(screen.getByText('Paused while offline')).toBeDefined();
    await expectStoppedThenRunning(() => {
      onLine.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
    });
  });

  it('Pause button: label changes, no aria-pressed, lives outside the hover/focus region', async () => {
    await renderPanel();
    const button = pauseButton();
    expect(button.textContent).toBe('Pause live feed');
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(list().contains(button)).toBe(false);
    fireEvent.click(button);
    expect(button.textContent).toBe('Resume live feed');
    expect(pauseButton()).toBe(button);
  });

  it('Pause stops the feed; Resume with the pointer over and focus on the button runs it again', async () => {
    await renderPanel();
    fireEvent.click(pauseButton());
    await expectStoppedThenRunning(() => {
      const button = pauseButton();
      fireEvent.pointerEnter(button, { pointerType: 'mouse' });
      act(() => {
        button.focus();
      });
      fireEvent.click(button);
      expect(button.textContent).toBe('Pause live feed');
    });
  });

  it('relative time refreshes on the 30 s timer', async () => {
    await renderPanel();
    await advance(MIN_DELAY_MS);
    fireEvent.click(pauseButton());
    const newest = rows()[0];
    expect(newest?.textContent).toContain('just now');
    // Win at t0 + 1.6 s; the list's clock ticks at t0 + 30 s, 60 s, 90 s.
    await advance(TIME_REFRESH_MS * 2);
    expect(newest?.textContent).toContain('just now');
    await advance(TIME_REFRESH_MS);
    expect(newest?.textContent).toContain('1 minute ago');
  });

  it('?mock=fail-feed: error with Try again; retry reconnects and focus goes to the panel heading', async () => {
    await renderPanel('?mock=fail-feed');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Live wins did not load');
    setUrl('');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(document.activeElement).toBe(heading());
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('status', { name: 'Loading live wins' })).toBeDefined();
    await advance(CONNECT_MS);
    expect(rows()).toHaveLength(SEED_COUNT);
  });

  it('?mock=empty-feed: empty state with Try again; focus goes to the panel heading', async () => {
    await renderPanel('?mock=empty-feed');
    expect(screen.getByRole('heading', { level: 3, name: 'No wins yet' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Recent wins' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(document.activeElement).toBe(heading());
    await advance(CONNECT_MS);
    expect(screen.getByRole('heading', { level: 3, name: 'No wins yet' })).toBeDefined();
  });
});
