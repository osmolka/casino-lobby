import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyRange, formatPercent, minorToDecimal } from './format';

describe('minorToDecimal', () => {
  it('converts integer minor units to an exact decimal string', () => {
    expect(minorToDecimal(20, 2)).toBe('0.20');
    expect(minorToDecimal(10_000, 2)).toBe('100.00');
    expect(minorToDecimal(123_456, 2)).toBe('1234.56');
    expect(minorToDecimal(7, 3)).toBe('0.007');
    expect(minorToDecimal(1500, 0)).toBe('1500');
    expect(minorToDecimal(0, 2)).toBe('0.00');
  });

  it('handles negative amounts', () => {
    expect(minorToDecimal(-5, 2)).toBe('-0.05');
    expect(minorToDecimal(-1234, 2)).toBe('-12.34');
  });

  it('rejects non-integer amounts', () => {
    expect(() => minorToDecimal(1.5, 2)).toThrow(RangeError);
    expect(() => minorToDecimal(Number.NaN, 2)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it('uses the currency minor unit from Intl', () => {
    expect(formatMoney(20, 'EUR', 'en')).toBe('€0.20');
    expect(formatMoney(10_000, 'EUR', 'en')).toBe('€100.00');
    expect(formatMoney(150, 'JPY', 'en')).toBe('¥150');
  });

  it('follows the locale', () => {
    expect(formatMoney(123_456, 'EUR', 'ru')).toBe('1 234,56 €');
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatMoney(0.2, 'EUR', 'en')).toThrow(RangeError);
  });
});

describe('formatMoneyRange', () => {
  it('formats a locale-aware range', () => {
    expect(formatMoneyRange(20, 10_000, 'EUR', 'en')).toBe('€0.20 – €100.00');
  });
});

describe('formatPercent', () => {
  it('formats a percent value with up to two decimals', () => {
    expect(formatPercent(96.21, 'en')).toBe('96.21%');
    expect(formatPercent(97, 'en')).toBe('97%');
  });
});
