import type { Transaction } from './types';

export interface WalletState {
  load: 'loading' | 'error' | 'ready';
  /** Newest first. The balance is derived from these (selectBalance), never stored. */
  transactions: Transaction[];
}

export type WalletAction =
  | { type: 'loadStarted' }
  | { type: 'loadFailed' }
  | { type: 'loaded'; transactions: Transaction[] }
  /** `tx.id` is the attempt's idempotency key: a repeated key is ignored. */
  | { type: 'depositStarted'; tx: Transaction }
  | { type: 'depositSettled'; id: string; ok: boolean };

export const initialWalletState: WalletState = { load: 'loading', transactions: [] };

/** Invariant: balance === sum of pending and confirmed transactions, so a failure rolls back by itself. */
export function selectBalance(transactions: readonly Transaction[]): number {
  let sum = 0;
  for (const t of transactions) if (t.status !== 'failed') sum += t.amount;
  return sum;
}

export function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'loadStarted':
      return { load: 'loading', transactions: [] };
    case 'loadFailed':
      return { load: 'error', transactions: [] };
    case 'loaded':
      return { load: 'ready', transactions: action.transactions };
    case 'depositStarted': {
      if (state.load !== 'ready' || state.transactions.some((t) => t.id === action.tx.id)) return state;
      return { ...state, transactions: [{ ...action.tx, status: 'pending' }, ...state.transactions] };
    }
    case 'depositSettled': {
      const index = state.transactions.findIndex((t) => t.id === action.id && t.status === 'pending');
      if (index === -1) return state;
      const transactions = state.transactions.slice();
      const tx = transactions[index] as Transaction;
      transactions[index] = { ...tx, status: action.ok ? 'confirmed' : 'failed' };
      return { ...state, transactions };
    }
  }
}
