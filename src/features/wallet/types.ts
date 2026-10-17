export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** The balance and every `Transaction.amount` are in this currency. */
export const WALLET_CURRENCY: Currency = 'EUR';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type TransactionKind = 'opening' | 'deposit';

export interface Transaction {
  /** Idempotency key of the attempt that created it. */
  id: string;
  kind: TransactionKind;
  /** Credited amount, integer minor units of WALLET_CURRENCY. */
  amount: number;
  /** What the user entered: integer minor units of `currency`. */
  source: { amount: number; currency: Currency };
  status: TransactionStatus;
  /** ISO 8601. */
  createdAt: string;
}
