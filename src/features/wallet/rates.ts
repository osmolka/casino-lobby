import type { Currency } from './types';

/** Fixed rates: wallet-currency (EUR) cents per 1.00 of the currency. */
export const RATES: Record<Currency, number> = {
  EUR: 100,
  USD: 92,
  GBP: 117,
};

/** Integer minor units of `currency` → integer EUR minor units, rounded half up. No float arithmetic. */
export function convertToWallet(minor: number, currency: Currency): number {
  if (!Number.isInteger(minor)) throw new RangeError(`Money must be integer minor units, got ${minor}`);
  const scaled = minor * RATES[currency];
  return (scaled - (scaled % 100)) / 100 + (scaled % 100 >= 50 ? 1 : 0);
}
