import { en } from '../../i18n/en';
import { DEFAULT_FILTERS, type Filters } from '../catalog/filters';
import { parseFilters, serializeFilters } from '../catalog/urlState';

/** Promo ids are the keys of `en.promos.items`, so every locale must translate every promo. */
export type PromoId = keyof typeof en.promos.items;
export const PROMO_IDS = Object.keys(en.promos.items) as PromoId[];

/** One entry of `api/promos.json`. Copy (title, body, call to action) comes from the dictionary by id. */
export interface Promo {
  id: PromoId;
  /** 0–359, drives the card gradient. */
  hue: number;
  /** Catalog view the card links to: canonical filter params (serializeFilters output, no "?"), never sort. */
  filters: string;
}

/**
 * The filters a promo's `filters` string stands for. Null unless it is in canonical form, is not the default
 * view and carries no sort (a promo click keeps the current sort, see filtersForPromo).
 */
export function promoTarget(filters: string): Filters | null {
  const target = parseFilters(filters);
  if (filters === '' || serializeFilters(target) !== filters || target.sort !== DEFAULT_FILTERS.sort) return null;
  return target;
}

const isPromoId = (v: unknown): v is PromoId => PROMO_IDS.some((id) => id === v);

/**
 * Validates the response body. Null for a bad shape; promos without copy (unknown id), with a broken target
 * or a repeated id are dropped, so one bad entry does not hide the rest.
 */
export function parsePromos(body: unknown): Promo[] | null {
  if (!Array.isArray(body)) return null;
  const promos: Promo[] = [];
  for (const item of body as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { id, hue, filters } = item as Record<keyof Promo, unknown>;
    if (typeof id !== 'string' || typeof filters !== 'string') return null;
    if (!Number.isInteger(hue) || (hue as number) < 0 || (hue as number) > 359) return null;
    if (!isPromoId(id) || promoTarget(filters) === null || promos.some((p) => p.id === id)) continue;
    promos.push({ id, hue: hue as number, filters });
  }
  return promos;
}
