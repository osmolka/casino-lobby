import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { DEPOSIT_DELAY_MS, WALLET_STORAGE_KEY, createWalletApi } from './api';
import { WalletProvider } from './WalletProvider';
import { WalletWidget } from './WalletWidget';

const LOAD_MS = 400; // random() = 0 → minimum delay

function renderWallet(search = '', strict = false) {
  const api = createWalletApi({ search, random: () => 0 });
  const fetchWallet = vi.spyOn(api, 'fetchWallet');
  const submitDeposit = vi.spyOn(api, 'submitDeposit');
  const view = render(
    <LocaleProvider>
      <WalletProvider api={api}>
        <WalletWidget />
        <button type="button">Outside</button>
      </WalletProvider>
    </LocaleProvider>,
    { reactStrictMode: strict },
  );
  return { ...view, fetchWallet, submitDeposit };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function loaded(search = '', strict = false) {
  const result = renderWallet(search, strict);
  await advance(LOAD_MS);
  return result;
}

const balance = () => screen.getByRole('button', { name: /^Balance:/ });
const headerDeposit = () => screen.getAllByRole('button', { name: 'Deposit' })[0] as HTMLElement;
const dialog = () => screen.getByRole('dialog', { name: 'Deposit' });
const confirmButton = () => within(dialog()).getByRole('button', { name: /Confirm deposit|Processing/ });

function openDeposit(trigger = headerDeposit()) {
  trigger.focus();
  fireEvent.click(trigger);
  return dialog();
}

function fill(amount: string, currency?: string) {
  fireEvent.change(within(dialog()).getByLabelText('Amount'), { target: { value: amount } });
  if (currency) fireEvent.change(within(dialog()).getByLabelText('Currency'), { target: { value: currency } });
}

function openPanel() {
  if (balance().getAttribute('aria-expanded') !== 'true') fireEvent.click(balance());
  return screen.getByRole('region', { name: 'Wallet' });
}

const rows = () => within(openPanel()).getAllByRole('listitem').map((li) => li.textContent);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('wallet: load states', () => {
  it('skeleton first, then the fixture balance (sum of the transactions)', async () => {
    renderWallet();
    expect(screen.getByRole('status', { name: 'Loading wallet' }).getAttribute('aria-busy')).toBe('true');
    await advance(LOAD_MS);
    expect(balance().textContent).toContain('Balance: €695.25');
    expect(rows()).toHaveLength(5);
    expect(rows()[4]).toContain('Opening deposit');
  });

  it('?mock=fail-wallet: error with Retry; Retry shows the skeleton and keeps focus off body', async () => {
    await loaded('?mock=fail-wallet');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Wallet unavailable');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading wallet' })).toBeTruthy();
    expect(document.activeElement).not.toBe(document.body);
    await advance(LOAD_MS);
    expect(screen.getByRole('alert').textContent).toContain('Wallet unavailable');
  });

  it('?mock=empty-wallet: €0.00 and an empty state with a Deposit action', async () => {
    await loaded('?mock=empty-wallet');
    expect(balance().textContent).toContain('€0.00');
    const panel = openPanel();
    expect(within(panel).getByRole('heading', { name: 'No transactions yet' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Deposit' })).toBeTruthy();
  });
});

describe('wallet: deposit', () => {
  it('100 EUR: pending at once with the balance raised (optimistic), confirmed after the delay; focus back on Deposit', async () => {
    const { submitDeposit } = await loaded();
    openDeposit();
    fill('100');
    fireEvent.click(confirmButton());

    expect(balance().textContent).toContain('€795.25');
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true');
    expect(rows()[0]).toMatch(/Deposit.*€100\.00.*Pending/);

    await advance(DEPOSIT_DELAY_MS);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rows()[0]).toMatch(/€100\.00.*Confirmed/);
    expect(balance().textContent).toContain('€795.25');
    expect(document.activeElement).toBe(headerDeposit());
    expect(screen.getByText('Deposit of €100 confirmed.')).toBeTruthy();
    expect(submitDeposit).toHaveBeenCalledTimes(1);
  });

  it('109: error alert in the dialog, the transaction is Failed and the balance rolls back', async () => {
    await loaded();
    openDeposit();
    fill('109');
    fireEvent.click(confirmButton());
    expect(balance().textContent).toContain('€804.25');

    await advance(DEPOSIT_DELAY_MS);
    const alert = within(dialog()).getByRole('alert');
    expect(alert.textContent).toBe('The deposit of €109 failed. Your balance was not changed.');
    expect(balance().textContent).toContain('€695.25');
    expect(rows()[0]).toMatch(/€109\.00.*Failed/);
    expect(rows()).toHaveLength(6);
    expect(confirmButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('after a failure, a new attempt is a new transaction (new idempotency key)', async () => {
    const { submitDeposit } = await loaded();
    openDeposit();
    fill('19');
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(submitDeposit).toHaveBeenCalledTimes(2);
    expect(rows().filter((r) => r.includes('Failed'))).toHaveLength(2);
    expect(balance().textContent).toContain('€695.25');
  });

  it('double click on Confirm creates one transaction and one request', async () => {
    const { submitDeposit } = await loaded();
    openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(submitDeposit).toHaveBeenCalledTimes(1);
    expect(rows().filter((r) => r.includes('€100.00'))).toHaveLength(2); // the new one + fixture fx-2
    expect(balance().textContent).toContain('€795.25');
  });

  it('Enter in the field + click on Confirm creates one transaction', async () => {
    const { submitDeposit } = await loaded();
    openDeposit();
    fill('50');
    fireEvent.submit(within(dialog()).getByLabelText('Amount'));
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(submitDeposit).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(6);
    expect(balance().textContent).toContain('€745.25');
  });

  it('Esc while a failing request is in flight: dialog closes, focus returns, failure announced in the widget', async () => {
    await loaded();
    const dlg = openDeposit();
    fill('19');
    fireEvent.click(confirmButton());
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(headerDeposit());
    expect(balance().textContent).toContain('€714.25');

    await advance(DEPOSIT_DELAY_MS);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Deposit of €19 failed. Your balance was not changed.');
    expect(balance().textContent).toContain('€695.25');
    expect(rows()[0]).toMatch(/€19\.00.*Failed/);

    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.activeElement).toBe(headerDeposit());
  });

  it('Esc while a succeeding request is in flight: the result still applies and is announced', async () => {
    await loaded();
    const dlg = openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    fireEvent.keyDown(dlg, { key: 'Escape' });
    await advance(DEPOSIT_DELAY_MS);
    expect(rows()[0]).toMatch(/€100\.00.*Confirmed/);
    expect(screen.getByText('Deposit of €100 confirmed.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a result from an earlier attempt does not close a dialog opened again later', async () => {
    await loaded();
    const dlg = openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    fireEvent.keyDown(dlg, { key: 'Escape' });
    openDeposit();
    await advance(DEPOSIT_DELAY_MS);
    expect(dialog()).toBeTruthy();
  });

  it('focus falls back to the header Deposit button when the trigger is gone (empty-state Deposit)', async () => {
    await loaded('?mock=empty-wallet');
    const panel = openPanel();
    openDeposit(within(panel).getByRole('button', { name: 'Deposit' }));
    fill('100');
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(openPanel()).queryByRole('heading', { name: 'No transactions yet' })).toBeNull();
    expect(document.activeElement).toBe(headerDeposit());
  });
});

describe('deposit dialog', () => {
  it('focus starts in the amount field; Tab wraps inside the dialog; Esc and Cancel return focus', async () => {
    await loaded();
    const dlg = openDeposit();
    expect(document.activeElement).toBe(within(dlg).getByLabelText('Amount'));

    const confirm = confirmButton();
    confirm.focus();
    fireEvent.keyDown(dlg, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(dlg, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(headerDeposit());

    openDeposit();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(headerDeposit());
  });

  it('is modal and labelled', async () => {
    await loaded();
    const dlg = openDeposit();
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.hasAttribute('open')).toBe(true);
  });

  it.each([
    ['', 'Enter an amount.'],
    ['abc', 'Enter a number, for example 25 or 25.50.'],
    ['1.234', 'Use at most two decimal places.'],
    ['0', 'Enter an amount greater than zero.'],
    ['0.50', 'The minimum deposit is €1.00.'],
    ['5000.01', 'The maximum deposit is €5,000.00.'],
  ])('validation: %j → %s, no request', async (amount, message) => {
    const { submitDeposit } = await loaded();
    openDeposit();
    fill(amount);
    fireEvent.click(confirmButton());
    const input = within(dialog()).getByLabelText('Amount');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent)).toContain(message);
    expect(document.activeElement).toBe(input);
    expect(submitDeposit).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(5);
  });

  it('limits follow the chosen currency', async () => {
    await loaded();
    openDeposit();
    fill('1', 'GBP');
    expect(within(dialog()).getByText(/From/).textContent).toBe('From £1.00 to £5,000.00');
  });

  it('preview shows the normalized amount, the rate and the converted amount', async () => {
    await loaded();
    openDeposit();
    fill('10.90', 'USD');
    const preview = dialog().querySelector('dl') as HTMLElement;
    expect(preview.textContent).toBe('You deposit$10.9Rate$1.00 = €0.92You receive€10.03');
    expect(preview.querySelectorAll('bdi')).toHaveLength(4);
  });

  it('offline: a message, Confirm blocked, no request; back online it works', async () => {
    const { submitDeposit } = await loaded();
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    openDeposit();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    fill('100');
    expect(within(dialog()).getByRole('status').textContent).toBe('You are offline. Deposits are paused until the connection is back.');
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(submitDeposit).not.toHaveBeenCalled();

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(submitDeposit).toHaveBeenCalledTimes(1);
  });
});

describe('wallet panel', () => {
  it('is a disclosure: aria-expanded, Esc closes it and focuses the toggle, click outside closes it', async () => {
    await loaded();
    const toggle = balance();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    openPanel();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    within(openPanel()).getByRole('heading', { name: 'Recent transactions' });

    toggle.focus();
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);

    openPanel();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('statuses are text, not only color', async () => {
    await loaded();
    expect(rows().every((r) => r.includes('Confirmed'))).toBe(true);
  });
});

describe('robustness', () => {
  it('persists confirmed transactions only (wallet:v1)', async () => {
    await loaded();
    openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    const stored = () => JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) ?? '[]') as { status: string }[];
    expect(stored()).toHaveLength(5);
    await advance(DEPOSIT_DELAY_MS);
    expect(stored()).toHaveLength(6);

    openDeposit();
    fill('9');
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(stored()).toHaveLength(6);
    expect(stored().every((t) => t.status === 'confirmed')).toBe(true);
  });

  it('?mock=empty-wallet never writes storage', async () => {
    await loaded('?mock=empty-wallet');
    openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    await advance(DEPOSIT_DELAY_MS);
    expect(localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
  });

  it('StrictMode: one completed load, one request per deposit, no timers or frames left after unmount', async () => {
    const { fetchWallet, submitDeposit, unmount } = await loaded('', true);
    // The first (StrictMode) mount's load was aborted before its delay ended.
    expect(fetchWallet.mock.calls.filter(([signal]) => !signal.aborted)).toHaveLength(1);
    expect(rows()).toHaveLength(5);

    openDeposit();
    fill('100');
    fireEvent.click(confirmButton());
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    // jsdom queues its own document tasks with setImmediate; run what is due now. Our 800 ms deposit
    // delay and animation frames are not due, so they would still be counted here.
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(submitDeposit).toHaveBeenCalledTimes(1);
  });

  it('unmount mid-load leaves no timers', () => {
    const { unmount } = renderWallet();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

// The failure rule ("normalized amount ends with 9") does not depend on the locale: "10,90" in ru is "10.90" in en.
describe('wallet in ru', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    document.documentElement.lang = '';
  });

  const ruDialog = () => screen.getByRole('dialog', { name: 'Пополнение' });

  it('"10,90": the preview shows the normalized amount in ru format, and the deposit fails like "10.90" in en', async () => {
    await loaded();
    const trigger = screen.getAllByRole('button', { name: 'Пополнить' })[0] as HTMLElement;
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(within(ruDialog()).getByLabelText('Сумма'), { target: { value: '10,90' } });
    const preview = ruDialog().querySelector('dl') as HTMLElement;
    expect(within(preview).getByText('Вы вносите').nextElementSibling?.textContent).toBe('10,9 €');

    fireEvent.click(within(ruDialog()).getByRole('button', { name: 'Подтвердить пополнение' }));
    await advance(DEPOSIT_DELAY_MS);
    expect(within(ruDialog()).getByRole('alert').textContent).toBe('Пополнение на 10,9 € не прошло. Баланс не изменился.');
    expect(screen.getByRole('button', { name: /^Баланс:/ }).textContent).toContain('695,25 €');
  });
});
