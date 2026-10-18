type Decimal = `${number}`;

const currencyFormats = new Map<string, Intl.NumberFormat>();
const percentFormats = new Map<string, Intl.NumberFormat>();

function currencyFormat(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let nf = currencyFormats.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { style: 'currency', currency });
    currencyFormats.set(key, nf);
  }
  return nf;
}

/** Exact decimal string for integer minor units (no float division), e.g. (20, 2) → '0.20'. */
export function minorToDecimal(minor: number, digits: number): Decimal {
  if (!Number.isInteger(minor)) throw new RangeError(`Money must be integer minor units, got ${minor}`);
  const sign = minor < 0 ? '-' : '';
  const abs = String(Math.abs(minor));
  if (digits === 0) return `${sign}${abs}` as Decimal;
  const padded = abs.padStart(digits + 1, '0');
  return `${sign}${padded.slice(0, -digits)}.${padded.slice(-digits)}` as Decimal;
}

function toDecimal(nf: Intl.NumberFormat, minor: number): Decimal {
  return minorToDecimal(minor, nf.resolvedOptions().maximumFractionDigits ?? 2);
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const nf = currencyFormat(currency, locale);
  return nf.format(toDecimal(nf, minor));
}

export function formatMoneyRange(minMinor: number, maxMinor: number, currency: string, locale: string): string {
  const nf = currencyFormat(currency, locale);
  return nf.formatRange(toDecimal(nf, minMinor), toDecimal(nf, maxMinor));
}

/** `value` is already a percentage, e.g. 96.21 → '96.21%'. */
export function formatPercent(value: number, locale: string): string {
  let nf = percentFormats.get(locale);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { style: 'unit', unit: 'percent', maximumFractionDigits: 2 });
    percentFormats.set(locale, nf);
  }
  return nf.format(value);
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
const currencyNames = new Map<string, Intl.DisplayNames>();

export function formatDateTime(iso: string, locale: string): string {
  let df = dateTimeFormats.get(locale);
  if (!df) {
    df = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    dateTimeFormats.set(locale, df);
  }
  return df.format(new Date(iso));
}

export function currencyName(code: string, locale: string): string {
  let names = currencyNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames(locale, { type: 'currency' });
    currencyNames.set(locale, names);
  }
  return names.of(code) ?? code;
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** '5 minutes ago' / '2 hours ago' in whole units; null under a minute (and for future times): show "just now". */
export function formatRelativeTime(at: number, now: number, locale: string): string | null {
  const elapsed = now - at;
  if (elapsed < MINUTE_MS) return null;
  let rtf = relativeFormats.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    relativeFormats.set(locale, rtf);
  }
  return elapsed < HOUR_MS
    ? rtf.format(-Math.floor(elapsed / MINUTE_MS), 'minute')
    : rtf.format(-Math.floor(elapsed / HOUR_MS), 'hour');
}
