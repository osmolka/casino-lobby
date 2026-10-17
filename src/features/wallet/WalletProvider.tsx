import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createWalletApi, storeTransactions, type WalletApi } from './api';
import { convertToWallet } from './rates';
import type { Currency, Transaction } from './types';
import { initialWalletState, selectBalance, walletReducer } from './walletReducer';

export interface DepositRequest {
  /** Idempotency key of this attempt: the same key never creates a second transaction or request. */
  key: string;
  /** Normalized amount string; the failure rule is evaluated on it. */
  normalized: string;
  source: { amount: number; currency: Currency };
}

export type DepositResult = 'confirmed' | 'failed';

interface Wallet {
  load: 'loading' | 'error' | 'ready';
  transactions: Transaction[];
  /** Integer minor units of WALLET_CURRENCY, derived from the transactions. */
  balance: number;
  retry: () => void;
  deposit: (request: DepositRequest) => Promise<DepositResult>;
}

const WalletContext = createContext<Wallet | null>(null);

export function WalletProvider({ children, api: injected }: { children: ReactNode; api?: WalletApi }) {
  const [api] = useState(() => injected ?? createWalletApi());
  const [state, dispatch] = useReducer(walletReducer, initialWalletState);
  const [attempt, setAttempt] = useState(0);
  const requests = useRef(new Map<string, Promise<DepositResult>>());
  const controllers = useRef(new Set<AbortController>());

  // The request is aborted on unmount, so StrictMode's double mount loads once.
  useEffect(() => {
    const controller = new AbortController();
    api.fetchWallet(controller.signal).then(
      (transactions) => {
        dispatch({ type: 'loaded', transactions });
      },
      () => {
        if (!controller.signal.aborted) dispatch({ type: 'loadFailed' });
      },
    );
    return () => {
      controller.abort();
    };
  }, [api, attempt]);

  // In-flight deposits are aborted on unmount (no timers left behind).
  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    };
  }, []);

  useEffect(() => {
    if (state.load === 'ready' && api.persists) storeTransactions(state.transactions);
  }, [api, state]);

  const retry = useCallback(() => {
    dispatch({ type: 'loadStarted' });
    setAttempt((n) => n + 1);
  }, []);

  const deposit = useCallback(
    (request: DepositRequest): Promise<DepositResult> => {
      const existing = requests.current.get(request.key);
      if (existing) return existing;

      const { key, normalized, source } = request;
      dispatch({
        type: 'depositStarted',
        tx: {
          id: key,
          kind: 'deposit',
          amount: convertToWallet(source.amount, source.currency),
          source,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      });
      const controller = new AbortController();
      controllers.current.add(controller);
      const settle = (ok: boolean): DepositResult => {
        controllers.current.delete(controller);
        dispatch({ type: 'depositSettled', id: key, ok });
        return ok ? 'confirmed' : 'failed';
      };
      const promise = api.submitDeposit(normalized, controller.signal).then(
        () => settle(true),
        () => settle(false),
      );
      requests.current.set(key, promise);
      return promise;
    },
    [api],
  );

  const value = useMemo<Wallet>(
    () => ({ load: state.load, transactions: state.transactions, balance: selectBalance(state.transactions), retry, deposit }),
    [state, retry, deposit],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): Wallet {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}
