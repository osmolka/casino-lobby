import { describe, expect, it } from 'vitest';
import { currencyName, formatDateTime, formatMoney, formatMoneyRange, formatPercent, formatRelativeTime, formatSavedAt, minorToDecimal } from './format';

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

describe('formatDateTime', () => {
  it('formats an ISO timestamp with the locale', () => {
    expect(formatDateTime('2026-09-01T09:00:00.000Z', 'en')).toMatch(/Sep 1, 2026/);
  });
});

describe('currencyName', () => {
  it('uses Intl.DisplayNames', () => {
    expect(currencyName('USD', 'en')).toBe('US Dollar');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-17T12:00:00.000Z');

  it('returns null under a minute (and for future times) so the caller shows "just now"', () => {
    expect(formatRelativeTime(now, now, 'en')).toBeNull();
    expect(formatRelativeTime(now - 59_999, now, 'en')).toBeNull();
    expect(formatRelativeTime(now + 5_000, now, 'en')).toBeNull();
  });

  it('uses whole minutes under an hour', () => {
    expect(formatRelativeTime(now - 60_000, now, 'en')).toBe('1 minute ago');
    expect(formatRelativeTime(now - 59 * 60_000 - 59_000, now, 'en')).toBe('59 minutes ago');
  });

  it('uses whole hours from an hour on', () => {
    expect(formatRelativeTime(now - 60 * 60_000, now, 'en')).toBe('1 hour ago');
    expect(formatRelativeTime(now - 26 * 60 * 60_000, now, 'en')).toBe('26 hours ago');
  });
});

describe('formatSavedAt', () => {
  // Local dates: "today" is the viewer's calendar day, whatever the time zone.
  const now = new Date(2026, 9, 16, 18, 30).getTime();
  const spaces = (text: string) => text.replace(/\s/g, ' ');

  it('shows only the time for a save from today', () => {
    expect(spaces(formatSavedAt(new Date(2026, 9, 16, 14, 5).getTime(), now, 'en'))).toBe('2:05 PM');
    expect(formatSavedAt(new Date(2026, 9, 16, 0, 0).getTime(), now, 'ru')).toBe('00:00');
  });

  it('adds the date for an earlier day', () => {
    expect(spaces(formatSavedAt(new Date(2026, 9, 15, 9, 7).getTime(), now, 'en'))).toBe('Oct 15, 2026, 9:07 AM');
    expect(spaces(formatSavedAt(new Date(2026, 9, 15, 23, 59).getTime(), now, 'ru'))).toBe('15 окт. 2026 г., 23:59');
  });

  it('treats a save "from the future" (clock change) like any other day', () => {
    expect(spaces(formatSavedAt(new Date(2026, 9, 17, 9, 7).getTime(), now, 'en'))).toBe('Oct 17, 2026, 9:07 AM');
  });
});
