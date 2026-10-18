/** Per-deposit limits in minor units of the chosen currency (all supported currencies have 2 decimals). */
export const MIN_DEPOSIT = 100;
export const MAX_DEPOSIT = 500_000;

export type AmountError = 'required' | 'invalid' | 'precision' | 'zero' | 'min' | 'max';

export type ParsedAmount =
  | { ok: true; /** The trimmed text as typed (the failure rule reads it); never shown in the UI. */ entered: string; minor: number }
  | { ok: false; error: AmountError };

// Digits with an optional single `.` or `,` separator. No signs, exponents or grouping.
const AMOUNT = /^(\d*)(?:[.,](\d*))?$/;
// More integer digits than this is far above MAX_DEPOSIT; stops before Number loses precision.
const MAX_INT_DIGITS = 9;

export function parseAmount(input: string): ParsedAmount {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'required' };
  const match = AMOUNT.exec(text);
  const intDigits = match?.[1] ?? '';
  const fracDigits = match?.[2] ?? '';
  if (!match || intDigits + fracDigits === '') return { ok: false, error: 'invalid' };

  const int = intDigits.replace(/^0+/, '') || '0';
  const frac = fracDigits.replace(/0+$/, '');
  if (frac.length > 2) return { ok: false, error: 'precision' };
  if (int.length > MAX_INT_DIGITS) return { ok: false, error: 'max' };

  const minor = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  if (minor === 0) return { ok: false, error: 'zero' };
  if (minor < MIN_DEPOSIT) return { ok: false, error: 'min' };
  if (minor > MAX_DEPOSIT) return { ok: false, error: 'max' };
  return { ok: true, entered: text, minor };
}

/**
 * The deterministic failure rule (README): the last digit of the entered text is 9. Trimmed; `,` and `.` alike;
 * no zero stripping, so 10.9 fails and 10.90 succeeds. A trailing separator is skipped: 19. fails as 19.
 * Only ever applied to text parseAmount accepted (ASCII digits).
 */
export function willFail(entered: string): boolean {
  return /9[.,]?$/.test(entered.trim());
}
