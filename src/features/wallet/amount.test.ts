import { describe, expect, it } from 'vitest';
import { MAX_DEPOSIT, MIN_DEPOSIT, parseAmount, willFail } from './amount';

describe('parseAmount', () => {
  it.each([
    ['100', '100', 10_000],
    ['19', '19', 1_900],
    ['10.99', '10.99', 1_099],
    ['9,99', '9.99', 999],
    ['90', '90', 9_000],
    ['9.50', '9.5', 950],
    ['10.90', '10.9', 1_090],
    ['09', '9', 900],
    ['1,5', '1.5', 150],
    ['  25.00  ', '25', 2_500],
    ['007.10', '7.1', 710],
    ['12.', '12', 1_200],
    ['1.230', '1.23', 123],
    ['5000', '5000', 500_000],
  ])('%j → %j (%i minor)', (input, normalized, minor) => {
    expect(parseAmount(input)).toEqual({ ok: true, normalized, minor });
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['abc', 'invalid'],
    ['1e3', 'invalid'],
    ['-5', 'invalid'],
    ['+5', 'invalid'],
    ['1.2.3', 'invalid'],
    ['1,2,3', 'invalid'],
    ['1 000', 'invalid'],
    ['.', 'invalid'],
    ['Infinity', 'invalid'],
    ['1.234', 'precision'],
    ['0', 'zero'],
    ['0.00', 'zero'],
    ['0.99', 'min'],
    ['5000.01', 'max'],
    ['99999999999999999999', 'max'],
  ])('%j → %s', (input, error) => {
    expect(parseAmount(input)).toEqual({ ok: false, error });
  });

  it('limits are 1.00 and 5000.00 in minor units', () => {
    expect(MIN_DEPOSIT).toBe(100);
    expect(MAX_DEPOSIT).toBe(500_000);
  });
});

describe('willFail: the normalized amount ends with 9', () => {
  const outcome = (input: string) => {
    const parsed = parseAmount(input);
    if (!parsed.ok) throw new Error(`fixture ${input} must be valid`);
    return { minor: parsed.minor, fails: willFail(parsed.normalized) };
  };

  it.each(['19', '109', '10.99', '9,99', '10.90', '10.9', '09'])('%j fails', (input) => {
    expect(outcome(input).fails).toBe(true);
  });

  it.each(['90', '9.50', '1,5', '100'])('%j succeeds', (input) => {
    expect(outcome(input).fails).toBe(false);
  });

  it('10.9 and 10.90 are the same amount with the same outcome', () => {
    expect(outcome('10.90')).toEqual(outcome('10.9'));
  });
});
