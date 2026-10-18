import { delay } from '../../shared/delay';
import { getMockFlags } from '../../shared/mockFlags';
import { storageGet, storageSet } from '../../shared/storage';
import { willFail } from './amount';
import { convertToWallet } from './rates';
import { CURRENCIES, type Transaction } from './types';

/** Confirmed transactions only (`Transaction[]`, newest first). Pending and failed are never stored. */
export const WALLET_STORAGE_KEY = 'wallet:v1';
export const DEPOSIT_DELAY_MS = 800;

const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 900;
const SLOW_EXTRA_MS = 2500;

export class WalletError extends Error {
  override readonly name = 'WalletError';
}

const fixture = (id: string, kind: Transaction['kind'], amount: number, currency: Transaction['source']['currency'], createdAt: string): Transaction => ({
  id,
  kind,
  amount: convertToWallet(amount, currency),
  source: { amount, currency },
  status: 'confirmed',
  createdAt,
});

/** Initial history, newest first. Balance = €695.25. */
export const FIXTURE_TRANSACTIONS: readonly Transaction[] = [
  fixture('fx-4', 'deposit', 2_000, 'EUR', '2026-09-28T19:42:00.000Z'),
  fixture('fx-3', 'deposit', 2_500, 'GBP', '2026-09-21T10:05:00.000Z'),
  fixture('fx-2', 'deposit', 10_000, 'EUR', '2026-09-14T21:30:00.000Z'),
  fixture('fx-1', 'deposit', 5_000, 'USD', '2026-09-07T17:15:00.000Z'),
  fixture('opening', 'opening', 50_000, 'EUR', '2026-09-01T09:00:00.000Z'),
];

const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function isStoredTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<keyof Transaction, unknown>;
  const source = t.source as Record<keyof Transaction['source'], unknown> | null;
  return (
    typeof t.id === 'string' &&
    t.id !== '' &&
    (t.kind === 'opening' || t.kind === 'deposit') &&
    t.status === 'confirmed' &&
    typeof t.createdAt === 'string' &&
    !Number.isNaN(Date.parse(t.createdAt)) &&
    typeof source === 'object' &&
    source !== null &&
    isPositiveInt(source.amount) &&
    CURRENCIES.some((c) => c === source.currency) &&
    isPositiveInt(t.amount) &&
    t.amount === convertToWallet(source.amount, source.currency as Transaction['source']['currency'])
  );
}

/** Stored history, or null when missing or corrupt (any invalid entry discards all of it). */
export function readStoredTransactions(): Transaction[] | null {
  const raw = storageGet(WALLET_STORAGE_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every(isStoredTransaction)) return null;
  if (new Set(parsed.map((t) => t.id)).size !== parsed.length) return null;
  return parsed;
}

export function storeTransactions(transactions: readonly Transaction[]): void {
  storageSet(WALLET_STORAGE_KEY, JSON.stringify(transactions.filter((t) => t.status === 'confirmed')));
}

export interface WalletApi {
  /** False under `?mock=empty-wallet`: a mock session never overwrites the stored history. */
  persists: boolean;
  /** Rejects with WalletError, or with the signal's AbortError when aborted. */
  fetchWallet: (signal: AbortSignal) => Promise<Transaction[]>;
  /** The "server". Rejects with WalletError when the last digit of the entered text is 9 (README). */
  submitDeposit: (entered: string, signal: AbortSignal) => Promise<void>;
}

export interface WalletApiOptions {
  /** Defaults to `window.location.search`; read for `?mock=`. */
  search?: string;
  /** Injected for deterministic delays in tests. */
  random?: () => number;
}

export function createWalletApi(options: WalletApiOptions = {}): WalletApi {
  const { search = window.location.search, random = Math.random } = options;
  const mock = getMockFlags(search);
  const empty = mock.has('empty-wallet');

  return {
    persists: !empty,
    fetchWallet: async (signal) => {
      const ms = MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
      await delay(mock.has('slow') ? ms + SLOW_EXTRA_MS : ms, signal);
      if (mock.has('fail-wallet')) throw new WalletError('load');
      if (empty) return [];
      return readStoredTransactions() ?? [...FIXTURE_TRANSACTIONS];
    },
    submitDeposit: async (entered, signal) => {
      await delay(DEPOSIT_DELAY_MS, signal);
      if (willFail(entered)) throw new WalletError('deposit');
    },
  };
}
