export interface FuzzyMatch {
  score: number;
  /** Indices into the original text of the matched characters, ascending. */
  matches: number[];
}

// Tier bases are 1000 apart; a subsequence score is clamped below the substring tier,
// so a type bonus or a tight subsequence never crosses a tier.
const EXACT = 5000;
const PREFIX = 4000;
const WORD_PREFIX = 3000;
const SUBSTRING = 2000;
const SUBSEQUENCE = 1000;

// Subsequence scoring (fzf-like): bonuses for word starts and consecutive letters, gap penalties.
const WORD_START_BONUS = 8;
const ADJACENT_BONUS = 4;
const GAP_START = 3;
const GAP_EXTEND = 1;

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Lowercase, and ё as е (Russian text often omits the dots). One UTF-16 unit in, one out. */
function fold(unit: string): string {
  const lower = unit.toLowerCase().charAt(0);
  return lower === 'ё' ? 'е' : lower;
}

/** Folds per UTF-16 unit, so indices into the result are indices into `text`. */
function lowerUnits(text: string): string[] {
  return Array.from({ length: text.length }, (_, i) => fold(text.charAt(i)));
}

function isWordStart(text: string, i: number): boolean {
  return i === 0 || !WORD_CHAR.test(text.charAt(i - 1));
}

const range = (start: number, length: number) => Array.from({ length }, (_, i) => start + i);

/** Best alignment of `query` (no spaces) as a subsequence of `text`; null if there is none. O(query × text). */
function subsequence(query: string[], text: string[], wordStart: boolean[]): FuzzyMatch | null {
  const n = text.length;
  const NONE = -Infinity;
  // best[i][j]: best score with query[i] matched at text[j]; from[i][j]: where query[i - 1] was matched.
  const best: number[][] = [];
  const from: number[][] = [];
  for (let i = 0; i < query.length; i++) {
    const row = new Array<number>(n).fill(NONE);
    const prevRow = new Array<number>(n).fill(-1);
    const prev = best[i - 1];
    // Running max over k < j - 1 of best[i - 1][k] + k * GAP_EXTEND (the gap penalty is linear after its start).
    let runMax = NONE;
    let runArg = -1;
    for (let j = 0; j < n; j++) {
      if (prev && j >= 2) {
        const k = j - 2;
        const candidate = (prev[k] ?? NONE) + k * GAP_EXTEND;
        if (candidate > runMax) {
          runMax = candidate;
          runArg = k;
        }
      }
      if (text[j] !== query[i]) continue;
      const bonus = wordStart[j] ? WORD_START_BONUS : 0;
      if (!prev) {
        row[j] = bonus;
        continue;
      }
      const adjacent = j >= 1 ? (prev[j - 1] ?? NONE) + ADJACENT_BONUS : NONE;
      // best[i-1][k] - gapPenalty(j - k - 1) = best[i-1][k] + k * GAP_EXTEND - GAP_START - (j - 2) * GAP_EXTEND
      const gapped = runMax === NONE ? NONE : runMax - GAP_START - (j - 2) * GAP_EXTEND;
      if (adjacent === NONE && gapped === NONE) continue;
      if (adjacent >= gapped) {
        row[j] = adjacent + bonus;
        prevRow[j] = j - 1;
      } else {
        row[j] = gapped + bonus;
        prevRow[j] = runArg;
      }
    }
    best.push(row);
    from.push(prevRow);
  }

  const last = best.at(-1) ?? [];
  let end = -1;
  for (let j = 0; j < n; j++) if ((last[j] ?? NONE) > (last[end] ?? NONE)) end = j;
  if (end < 0) return null;

  const raw = last[end] ?? 0;
  const matches: number[] = [];
  for (let i = query.length - 1, j = end; i >= 0; j = from[i]?.[j] ?? -1, i--) matches.push(j);
  matches.reverse();
  return { score: Math.min(Math.max(SUBSEQUENCE + raw, 1), SUBSTRING - 1), matches };
}

/**
 * Case-insensitive (and ё = е) fuzzy match. Tiers: exact > prefix > word prefix > substring > subsequence.
 * The query is trimmed and inner whitespace collapsed; a subsequence match ignores the query's spaces.
 * An empty query matches everything with score 0.
 */
export function fuzzyScore(query: string, text: string): FuzzyMatch | null {
  const q = lowerUnits(query.trim().replace(/\s+/g, ' ')).join('');
  if (q === '') return { score: 0, matches: [] };
  const units = lowerUnits(text);
  const lower = units.join('');
  if (lower === q) return { score: EXACT, matches: range(0, q.length) };
  if (lower.startsWith(q)) return { score: PREFIX, matches: range(0, q.length) };

  let substring = -1;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + 1)) {
    if (isWordStart(text, at)) return { score: WORD_PREFIX, matches: range(at, q.length) };
    if (substring === -1) substring = at;
  }
  if (substring !== -1) return { score: SUBSTRING, matches: range(substring, q.length) };

  const wordStart = units.map((_, i) => isWordStart(text, i));
  return subsequence(lowerUnits(q.replace(/ /g, '')), units, wordStart);
}

/** Merges ascending match indices into [start, end) ranges, one per <mark>. */
export function markRanges(matches: readonly number[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const i of matches) {
    const last = ranges.at(-1);
    if (last && last[1] === i) last[1] = i + 1;
    else ranges.push([i, i + 1]);
  }
  return ranges;
}

export interface Ranked<T> extends FuzzyMatch {
  item: T;
}

interface RankOptions<T> {
  text: (item: T) => string;
  /** Small per-item bonus, applied only to a match (e.g. actions matched by their name). Keep it < 1000. */
  bonus?: (item: T) => number;
  limit?: number | undefined;
}

export const DEFAULT_LIMIT = 10;

/** Matches, then sorts by score (+ bonus), then shorter text; equal items keep the input order. */
export function rankItems<T>(items: readonly T[], query: string, { text, bonus, limit = DEFAULT_LIMIT }: RankOptions<T>): Ranked<T>[] {
  const empty = query.trim() === '';
  const ranked: (Ranked<T> & { length: number })[] = [];
  for (const item of items) {
    const label = text(item);
    const match = fuzzyScore(query, label);
    if (!match) continue;
    const score = empty ? 0 : match.score + (bonus?.(item) ?? 0);
    ranked.push({ item, score, matches: match.matches, length: label.length });
  }
  if (!empty) ranked.sort((a, b) => b.score - a.score || a.length - b.length);
  return ranked.slice(0, limit).map(({ item, score, matches }) => ({ item, score, matches }));
}
