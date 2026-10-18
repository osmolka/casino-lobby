import { describe, expect, it } from 'vitest';
import { formatMoney, formatRelativeTime } from '../shared/format';
import { en } from './en';
import { ru } from './ru';
import { translate } from './t';

interface Tree {
  [key: string]: string | Tree;
}

/** Every leaf as [dot path, value]; plural entries count as one leaf per form. */
function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`),
  );
}

/** Paths of plural entries (objects with an `other` form). */
function plurals(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    if (typeof value === 'string') return [];
    return typeof value.other === 'string' ? [`${prefix}${key}`] : plurals(value, `${prefix}${key}.`);
  });
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const at = (tree: Tree, path: string) => path.split('.').reduce<Tree | string | undefined>((node, k) => (typeof node === 'object' ? node[k] : undefined), tree);

const EN = en as unknown as Tree;
const RU = ru as unknown as Tree;
const PLURALS = plurals(EN);

/**
 * ru values allowed to equal en: the brand, endonyms (each language's name in itself), keyboard shortcuts,
 * industry terms and trademarks used as is in Russian, and templates that are only placeholders and symbols.
 */
const SAME_AS_EN = new Set([
  'app.name',
  'language.names.en',
  'language.names.ru',
  'palette.shortcut',
  'palette.shortcutMac',
  'catalog.card.rtp',
  'catalog.tag.megaways',
  'settings.accentValue',
  'wallet.dialog.currencyOption',
  'wallet.dialog.rateValue',
  'feed.meta',
]);

describe('ru dictionary', () => {
  it('has the same keys as en (plural entries may add forms)', () => {
    const ruKeys = new Set(leaves(RU).map(([k]) => k));
    const pluralPrefix = (k: string) => PLURALS.some((p) => k.startsWith(`${p}.`));
    expect(leaves(EN).map(([k]) => k).filter((k) => !ruKeys.has(k))).toEqual([]);
    expect([...ruKeys].filter((k) => !pluralPrefix(k) && at(EN, k) === undefined)).toEqual([]);
  });

  it('keeps every placeholder of the en value', () => {
    const mismatched = leaves(RU).flatMap(([key, value]) => {
      const plural = PLURALS.find((p) => key.startsWith(`${p}.`));
      const source = at(EN, plural ? `${plural}.other` : key);
      return typeof source === 'string' && placeholders(source).join() !== placeholders(value).join() ? [key] : [];
    });
    expect(mismatched).toEqual([]);
  });

  it.each(PLURALS)('%s has the Russian plural forms one/few/many/other', (path) => {
    const node = at(RU, path);
    expect(typeof node === 'object' ? Object.keys(node).sort() : node).toEqual(['few', 'many', 'one', 'other']);
  });

  it('no value is copied from en, except the allowlist', () => {
    const same = leaves(RU).flatMap(([key, value]) => (at(EN, key) === value && !SAME_AS_EN.has(key) ? [key] : []));
    expect(same).toEqual([]);
    for (const key of SAME_AS_EN) expect(at(RU, key), key).toBeTypeOf('string'); // the allowlist names real keys
  });

  it('language names are endonyms in both dictionaries', () => {
    expect(en.language.names).toEqual({ en: 'English', ru: 'Русский' });
    expect(ru.language.names).toEqual({ en: 'English', ru: 'Русский' });
  });
});

describe('ru plurals and formats', () => {
  it.each([
    [1, '1 игра'],
    [2, '2 игры'],
    [5, '5 игр'],
    [11, '11 игр'],
    [21, '21 игра'],
    [22, '22 игры'],
    [25, '25 игр'],
    [1.5, '1,5 игры'],
  ])('catalog.count %s → %s', (count, text) => {
    expect(translate(ru, 'ru', 'catalog.count', { count })).toBe(text);
  });

  it.each([
    [1, '1 результат'],
    [3, '3 результата'],
    [10, '10 результатов'],
  ])('palette.count %s → %s', (count, text) => {
    expect(translate(ru, 'ru', 'palette.count', { count })).toBe(text);
  });

  it('money and relative time follow the ru locale (Intl)', () => {
    expect(formatMoney(1_069_525, 'EUR', 'ru')).toBe('10 695,25 €');
    expect(formatMoney(1_090, 'EUR', 'ru')).toBe('10,90\u00a0€');
    const now = Date.UTC(2026, 9, 17, 12);
    expect(formatRelativeTime(now - 5 * 60_000, now, 'ru')).toBe('5 минут назад');
    expect(formatRelativeTime(now - 30_000, now, 'ru')).toBeNull(); // under a minute: the dictionary's "только что"
    expect(ru.feed.justNow).toBe('только что');
  });
});
