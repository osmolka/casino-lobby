import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEPOSIT_DELAY_MS,
  FIXTURE_TRANSACTIONS,
  WALLET_STORAGE_KEY,
  WalletError,
  createWalletApi,
  readStoredTransactions,
  storeTransactions,
} from './api';
import { convertToWallet } from './rates';
import type { Transaction } from './types';
import { selectBalance } from './walletReducer';

const signal = () => new AbortController().signal;
const deposit = (id: string, status: Transaction['status']): Transaction => ({
  id,
  kind: 'deposit',
  amount: 9_200,
  source: { amount: 10_000, currency: 'USD' },
  status,
  createdAt: '2026-10-17T10:00:00.000Z',
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

async function settle<T>(promise: Promise<T>, ms: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

describe('fixture', () => {
  it('is an opening deposit plus past confirmed deposits, newest first, consistent with the rates', () => {
    expect(FIXTURE_TRANSACTIONS.length).toBeGreaterThanOrEqual(4);
    expect(FIXTURE_TRANSACTIONS.at(-1)?.kind).toBe('opening');
    for (const t of FIXTURE_TRANSACTIONS) {
      expect(t.status).toBe('confirmed');
      expect(t.amount).toBe(convertToWallet(t.source.amount, t.source.currency));
      expect(Date.parse(t.createdAt)).toBeLessThan(Date.parse('2026-10-01'));
    }
    const dates = FIXTURE_TRANSACTIONS.map((t) => t.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(selectBalance(FIXTURE_TRANSACTIONS)).toBe(69_525);
  });
});

describe('fetchWallet', () => {
  it('loads the fixture when nothing is stored', async () => {
    const api = createWalletApi({ search: '', random: () => 0 });
    expect(await settle(api.fetchWallet(signal()), 1000)).toEqual(FIXTURE_TRANSACTIONS);
  });

  it('loads stored confirmed transactions instead of the fixture', async () => {
    const stored = [deposit('a', 'confirmed'), ...FIXTURE_TRANSACTIONS];
    storeTransactions(stored);
    const api = createWalletApi({ search: '', random: () => 0 });
    expect(await settle(api.fetchWallet(signal()), 1000)).toEqual(stored);
  });

  it('?mock=fail-wallet rejects with WalletError', async () => {
    const api = createWalletApi({ search: '?mock=fail-wallet', random: () => 0 });
    const result = api.fetchWallet(signal()).catch((e: unknown) => e);
    expect(await settle(result, 1000)).toBeInstanceOf(WalletError);
  });

  it('?mock=empty-wallet loads nothing and does not persist', async () => {
    storeTransactions(FIXTURE_TRANSACTIONS);
    const api = createWalletApi({ search: '?mock=empty-wallet', random: () => 0 });
    expect(await settle(api.fetchWallet(signal()), 1000)).toEqual([]);
    expect(api.persists).toBe(false);
  });

  it('?mock=slow adds delay', async () => {
    const api = createWalletApi({ search: '?mock=slow', random: () => 0 });
    let done = false;
    void api.fetchWallet(signal()).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(done).toBe(true);
  });

  it('abort clears the timer and rejects', async () => {
    const controller = new AbortController();
    const api = createWalletApi({ search: '', random: () => 0 });
    const result = api.fetchWallet(controller.signal).catch((e: unknown) => (e as Error).name);
    controller.abort();
    expect(await result).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('submitDeposit', () => {
  it(`resolves after ${DEPOSIT_DELAY_MS} ms, rejects when the entered text ends with the digit 9`, async () => {
    const api = createWalletApi({ search: '' });
    let ok = false;
    void api.submitDeposit('100', signal()).then(() => (ok = true));
    await vi.advanceTimersByTimeAsync(DEPOSIT_DELAY_MS - 1);
    expect(ok).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(ok).toBe(true);

    const failed = api.submitDeposit('10.9', signal()).catch((e: unknown) => e);
    expect(await settle(failed, DEPOSIT_DELAY_MS)).toBeInstanceOf(WalletError);
    const sameAmount = api.submitDeposit('10.90', signal()).then(() => 'ok');
    expect(await settle(sameAmount, DEPOSIT_DELAY_MS)).toBe('ok');
  });
});

describe('storage (wallet:v1)', () => {
  it('stores confirmed transactions only', () => {
    storeTransactions([deposit('p', 'pending'), deposit('c', 'confirmed'), deposit('f', 'failed')]);
    expect(readStoredTransactions()?.map((t) => t.id)).toEqual(['c']);
  });

  it.each([
    ['not JSON', '{oops'],
    ['not an array', '{"id":"a"}'],
    ['wrong status', JSON.stringify([deposit('a', 'pending')])],
    ['amount does not match the rate', JSON.stringify([{ ...deposit('a', 'confirmed'), amount: 1 }])],
    ['float amount', JSON.stringify([{ ...deposit('a', 'confirmed'), amount: 92.5 }])],
    ['unknown currency', JSON.stringify([{ ...deposit('a', 'confirmed'), source: { amount: 100, currency: 'BTC' } }])],
    ['bad date', JSON.stringify([{ ...deposit('a', 'confirmed'), createdAt: 'yesterday' }])],
    ['duplicate ids', JSON.stringify([deposit('a', 'confirmed'), deposit('a', 'confirmed')])],
  ])('corrupt data (%s) is ignored', (_, raw) => {
    localStorage.setItem(WALLET_STORAGE_KEY, raw);
    expect(readStoredTransactions()).toBeNull();
  });

  it('a throwing localStorage falls back to the fixture', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const api = createWalletApi({ search: '', random: () => 0 });
    expect(await settle(api.fetchWallet(signal()), 1000)).toEqual(FIXTURE_TRANSACTIONS);
    spy.mockRestore();
  });
});
