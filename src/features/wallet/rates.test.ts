import { describe, expect, it } from 'vitest';
import { RATES, convertToWallet } from './rates';

describe('convertToWallet', () => {
  it('EUR is 1:1', () => {
    expect(RATES.EUR).toBe(100);
    expect(convertToWallet(12_345, 'EUR')).toBe(12_345);
  });

  it('converts with the fixed rate table', () => {
    expect(convertToWallet(10_000, 'USD')).toBe(9_200);
    expect(convertToWallet(2_500, 'GBP')).toBe(2_925);
  });

  it('rounds half up to whole cents', () => {
    // 0.05 USD × 0.92 = 0.046 → 0.05; 0.01 USD × 0.92 = 0.0092 → 0.01; 0.50 USD → 0.46.
    expect(convertToWallet(5, 'USD')).toBe(5);
    expect(convertToWallet(1, 'USD')).toBe(1);
    expect(convertToWallet(50, 'USD')).toBe(46);
    // 0.50 GBP × 1.17 = 0.585 → 0.59.
    expect(convertToWallet(50, 'GBP')).toBe(59);
  });

  it('always returns integers, up to the deposit limit', () => {
    for (const minor of [100, 101, 333, 999, 123_457, 500_000]) {
      for (const cur of ['EUR', 'USD', 'GBP'] as const) {
        expect(Number.isInteger(convertToWallet(minor, cur))).toBe(true);
      }
    }
  });

  it('rejects non-integer input', () => {
    expect(() => convertToWallet(1.5, 'USD')).toThrow(RangeError);
  });
});
