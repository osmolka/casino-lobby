import { describe, expect, it } from 'vitest';
import { MAX_DEPOSIT, MIN_DEPOSIT, parseAmount, willFail } from './amount';

describe('parseAmount', () => {
  it.each([
    ['100', '100', 10_000],
    ['19', '19', 1_900],
    ['10.99', '10.99', 1_099],
    ['9,99', '9,99', 999],
    ['90', '90', 9_000],
    ['9.50', '9.50', 950],
    ['10.90', '10.90', 1_090],
    ['09', '09', 900],
    ['1,5', '1,5', 150],
    ['  25.00  ', '25.00', 2_500],
    ['007.10', '007.10', 710],
    ['12.', '12.', 1_200],
    ['19,', '19,', 1_900],
    ['1.230', '1.230', 123],
    ['5000', '5000', 500_000],
  ])('%j → entered %j, %i minor', (input, entered, minor) => {
    expect(parseAmount(input)).toEqual({ ok: true, entered, minor });
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['abc', 'invalid'],
    ['1e3', 'invalid'],
    ['1e9', 'invalid'],
    ['-5', 'invalid'],
    ['+5', 'invalid'],
    ['+19', 'invalid'],
    ['1.2.3', 'invalid'],
    ['1,2,3', 'invalid'],
    ['1 000', 'invalid'],
    ['.', 'invalid'],
    ['Infinity', 'invalid'],
    ['１９', 'invalid'], // full-width digits
    ['١٩', 'invalid'], // Arabic-Indic digits
    ['1９', 'invalid'], // ASCII digits with a full-width last digit: never reaches the rule
    ['10.9９', 'invalid'],
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

describe('willFail: the last digit of the entered text is 9', () => {
  const outcome = (input: string) => {
    const parsed = parseAmount(input);
    if (!parsed.ok) throw new Error(`fixture ${input} must be valid`);
    return { minor: parsed.minor, fails: willFail(parsed.entered) };
  };

  it.each(['9', '19', '109', '10.99', '9,99', '10.9', '09', '19 ', ' 19'])('%j fails', (input) => {
    expect(outcome(input).fails).toBe(true);
  });

  it.each(['90', '9.50', '10.90', '100', '1,5', '10.'])('%j succeeds', (input) => {
    expect(outcome(input).fails).toBe(false);
  });

  // A trailing separator is valid input (12. = 12.00); the rule reads the last digit, so 19. and 19, fail as 19.
  it.each(['19.', '19,'])('%j (trailing separator) is valid and fails as 19', (input) => {
    expect(outcome(input)).toEqual({ minor: 1_900, fails: true });
  });

  it('trims the text itself too', () => {
    expect(willFail(' 19 ')).toBe(true);
    expect(willFail(' 10.90 ')).toBe(false);
  });

  // By design: the rule reads what the user typed, digit by digit, not the amount. 10.9 and 10.90 are the same
  // 1090 minor units, and the UI shows both as 10.90, but only the text ending in 9 fails. This keeps the demo
  // predictable from the keyboard ("ends with 9 fails") with no hidden normalization step.
  it('10.9 and 10.90: the same amount, different outcomes', () => {
    expect(outcome('10.9')).toEqual({ minor: 1_090, fails: true });
    expect(outcome('10.90')).toEqual({ minor: 1_090, fails: false });
  });

  it('is locale independent: ru "10,90" succeeds like en "10.90", ru "10,9" fails like en "10.9"', () => {
    expect(outcome('10,90')).toEqual(outcome('10.90'));
    expect(outcome('10,9')).toEqual(outcome('10.9'));
  });
});
