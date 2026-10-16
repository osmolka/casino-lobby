export type Vars = Record<string, string | number>;

interface Tree {
  [key: string]: string | Tree | undefined;
}

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function cached<T>(cache: Map<string, T>, locale: string, make: () => T): T {
  let value = cache.get(locale);
  if (!value) {
    value = make();
    cache.set(locale, value);
  }
  return value;
}

function lookup(messages: Tree, key: string): string | Tree | undefined {
  let node: string | Tree | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function interpolate(template: string, locale: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    if (typeof value === 'number') {
      return cached(numberFormats, locale, () => new Intl.NumberFormat(locale)).format(value);
    }
    return value;
  });
}

/**
 * Resolves a dot-path key. A leaf object with an `other` key is a plural entry:
 * the form is chosen with Intl.PluralRules from `vars.count`. Missing keys return the key.
 */
export function translate(messages: object, locale: string, key: string, vars: Vars = {}): string {
  const node = lookup(messages as Tree, key);
  if (typeof node === 'string') return interpolate(node, locale, vars);
  if (node && typeof node.other === 'string' && typeof vars.count === 'number') {
    const category = cached(pluralRules, locale, () => new Intl.PluralRules(locale)).select(vars.count);
    const form = node[category];
    return interpolate(typeof form === 'string' ? form : node.other, locale, vars);
  }
  return key;
}
