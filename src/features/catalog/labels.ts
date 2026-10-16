import type { Game } from './types';

/** Dictionary label for a data slug (tag, category); unknown slugs are shown as is. */
export function labelFor(dict: Readonly<Record<string, string>>, slug: string): string {
  return Object.hasOwn(dict, slug) ? (dict[slug] ?? slug) : slug;
}

export interface ProviderOption {
  slug: string;
  name: string;
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });

export function providerOptions(games: readonly Game[]): ProviderOption[] {
  const byId = new Map<string, string>();
  for (const g of games) if (!byId.has(g.provider)) byId.set(g.provider, g.providerName);
  return [...byId].map(([slug, name]) => ({ slug, name })).sort((a, b) => collator.compare(a.name, b.name));
}

export function tagOptions(games: readonly Game[]): string[] {
  return [...new Set(games.flatMap((g) => g.tags))].sort();
}
