import { describe, expect, it } from 'vitest';
import type { Transaction, TransactionStatus } from './types';
import { initialWalletState, selectBalance, walletReducer, type WalletAction, type WalletState } from './walletReducer';

function tx(id: string, amount: number, status: TransactionStatus = 'pending'): Transaction {
  return { id, kind: 'deposit', amount, source: { amount, currency: 'EUR' }, status, createdAt: '2026-10-01T12:00:00.000Z' };
}

const ready = (transactions: Transaction[] = []): WalletState => walletReducer(initialWalletState, { type: 'loaded', transactions });

/** mulberry32, same as scripts/prng.ts (kept local: src/ does not import from scripts/). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('walletReducer: load', () => {
  it('loading → ready with the loaded transactions; balance = their sum', () => {
    const state = ready([tx('a', 500, 'confirmed'), tx('b', 250, 'confirmed')]);
    expect(state.load).toBe('ready');
    expect(selectBalance(state.transactions)).toBe(750);
  });

  it('loadFailed → error, loadStarted → loading', () => {
    const failed = walletReducer(initialWalletState, { type: 'loadFailed' });
    expect(failed.load).toBe('error');
    expect(walletReducer(failed, { type: 'loadStarted' }).load).toBe('loading');
  });

  it('ignores deposits until the wallet is ready', () => {
    expect(walletReducer(initialWalletState, { type: 'depositStarted', tx: tx('a', 100) })).toBe(initialWalletState);
  });
});

describe('walletReducer: deposits', () => {
  it('a started deposit is pending, newest first, and counts immediately (optimistic)', () => {
    const state = walletReducer(ready([tx('old', 1000, 'confirmed')]), { type: 'depositStarted', tx: tx('new', 500, 'confirmed') });
    expect(state.transactions.map((t) => [t.id, t.status])).toEqual([
      ['new', 'pending'],
      ['old', 'confirmed'],
    ]);
    expect(selectBalance(state.transactions)).toBe(1500);
  });

  it('a repeated dispatch with the same idempotency key is ignored', () => {
    const once = walletReducer(ready(), { type: 'depositStarted', tx: tx('k', 500) });
    const twice = walletReducer(once, { type: 'depositStarted', tx: tx('k', 9999) });
    expect(twice).toBe(once);
    // Also after it settled.
    const settled = walletReducer(once, { type: 'depositSettled', id: 'k', ok: false });
    expect(walletReducer(settled, { type: 'depositStarted', tx: tx('k', 500) })).toBe(settled);
  });

  it('success confirms; failure marks failed and rolls the balance back', () => {
    const base = walletReducer(ready([tx('old', 1000, 'confirmed')]), { type: 'depositStarted', tx: tx('k', 500) });
    const ok = walletReducer(base, { type: 'depositSettled', id: 'k', ok: true });
    expect(ok.transactions[0]?.status).toBe('confirmed');
    expect(selectBalance(ok.transactions)).toBe(1500);
    const failed = walletReducer(base, { type: 'depositSettled', id: 'k', ok: false });
    expect(failed.transactions[0]?.status).toBe('failed');
    expect(failed.transactions).toHaveLength(2);
    expect(selectBalance(failed.transactions)).toBe(1000);
  });

  it('settling an unknown or already settled transaction is a no-op', () => {
    const base = walletReducer(ready(), { type: 'depositStarted', tx: tx('k', 500) });
    expect(walletReducer(base, { type: 'depositSettled', id: 'nope', ok: true })).toBe(base);
    const failed = walletReducer(base, { type: 'depositSettled', id: 'k', ok: false });
    expect(walletReducer(failed, { type: 'depositSettled', id: 'k', ok: true })).toBe(failed);
  });
});

describe('invariant: balance === sum of pending + confirmed transactions', () => {
  it.each([1, 7, 42, 20261016, 0xdeadbeef])('holds after every step of a random sequence (seed %i)', (seed) => {
    const random = prng(seed);
    const int = (max: number) => Math.floor(random() * max);
    // Independent model: what each key should be, in insertion order.
    const model = new Map<string, { amount: number; status: TransactionStatus }>([['opening', { amount: 50_000, status: 'confirmed' }]]);
    let state = ready([tx('opening', 50_000, 'confirmed')]);
    let next = 0;

    for (let step = 0; step < 400; step++) {
      const keys = [...model.keys()];
      const r = random();
      let action: WalletAction;
      if (r < 0.4 || keys.length === 0) {
        const id = `k${next++}`;
        const amount = 100 + int(500_000);
        action = { type: 'depositStarted', tx: tx(id, amount) };
        model.set(id, { amount, status: 'pending' });
      } else if (r < 0.55) {
        // Double submit: same key, possibly different payload → ignored.
        action = { type: 'depositStarted', tx: tx(keys[int(keys.length)] ?? '', 1 + int(1000)) };
      } else if (r < 0.92) {
        const id = keys[int(keys.length)] ?? '';
        const ok = random() < 0.5;
        action = { type: 'depositSettled', id, ok };
        const entry = model.get(id);
        if (entry?.status === 'pending') entry.status = ok ? 'confirmed' : 'failed';
      } else {
        action = { type: 'depositSettled', id: `unknown${step}`, ok: random() < 0.5 };
      }

      state = walletReducer(state, action);

      const expected = [...model.values()].filter((m) => m.status !== 'failed').reduce((sum, m) => sum + m.amount, 0);
      expect(selectBalance(state.transactions), `step ${step}`).toBe(expected);
      expect(selectBalance(state.transactions)).toBeGreaterThanOrEqual(0);
      expect(new Set(state.transactions.map((t) => t.id)).size).toBe(model.size);
      for (const t of state.transactions) expect(t.status).toBe(model.get(t.id)?.status);
    }

    // Settle everything: balance = confirmed only, and no failed amount counts.
    for (const t of state.transactions) state = walletReducer(state, { type: 'depositSettled', id: t.id, ok: false });
    const confirmed = state.transactions.filter((t) => t.status === 'confirmed').reduce((sum, t) => sum + t.amount, 0);
    expect(state.transactions.some((t) => t.status === 'pending')).toBe(false);
    expect(selectBalance(state.transactions)).toBe(confirmed);
  });
});
