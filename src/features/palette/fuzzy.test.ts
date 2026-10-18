import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../public/api/games.json?raw';
import type { Game } from '../catalog/types';
import { fuzzyScore, markRanges, rankItems } from './fuzzy';

const fixture = JSON.parse(fixtureJson) as Game[];
const titles = fixture.map((g) => g.title);

const score = (query: string, text: string) => fuzzyScore(query, text)?.score ?? null;
const rankTitles = (query: string, texts: readonly string[] = titles, limit?: number) =>
  rankItems(texts, query, { text: (s) => s, limit }).map((r) => r.item);

describe('fuzzyScore', () => {
  it('returns null when the query is not a subsequence of the text', () => {
    expect(fuzzyScore('xyz', 'Crystal Rush')).toBeNull();
    expect(fuzzyScore('hsur', 'Crystal Rush')).toBeNull(); // order matters
  });

  it('an empty or blank query matches everything with score 0 and no marks', () => {
    expect(fuzzyScore('', 'Crystal Rush')).toEqual({ score: 0, matches: [] });
    expect(fuzzyScore('   ', 'Crystal Rush')).toEqual({ score: 0, matches: [] });
  });

  it('tiers: exact > prefix > word prefix > substring > subsequence', () => {
    const tiers = ['Rush', 'Rush Hour', 'Crystal Rush', 'Brushed Gold', 'Ruby Shore'].map((t) => score('rush', t));
    expect(tiers.every((s) => s !== null)).toBe(true);
    const sorted = [...(tiers as number[])].sort((a, b) => b - a);
    expect(tiers).toEqual(sorted);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it('a subsequence never outranks a substring, however tight', () => {
    expect(score('ab', 'xaxb')).toBeLessThan(score('ab', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxab') ?? 0);
  });

  it('is case-insensitive and trims/collapses query whitespace; matches index the original text', () => {
    expect(fuzzyScore('  NEON   spins ', 'Neon Spins')).toEqual({ score: score('neon spins', 'Neon Spins'), matches: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(fuzzyScore('rush', 'Crystal Rush')?.matches).toEqual([8, 9, 10, 11]);
  });

  it('works with translated (Cyrillic) action names', () => {
    expect(fuzzyScore('ТЕМ', 'Сменить тему')?.matches).toEqual([8, 9, 10]);
    expect(score('тем', 'Сменить тему')).toBeGreaterThan(score('мен', 'Сменить тему') ?? 0); // word prefix > substring
    expect(fuzzyScore('смн тм', 'Сменить тему')?.matches).toEqual([0, 1, 3, 8, 10]);
  });

  it('treats ё and е as the same letter (Russian users often type е); indices still point into the text', () => {
    expect(fuzzyScore('темн', 'Включить тёмную тему')).toEqual({ score: 3000, matches: [9, 10, 11, 12] });
    expect(fuzzyScore('ТЁМН', 'Включить темную тему')?.score).toBe(3000);
    expect(fuzzyScore('тем ную', 'Включить тёмную тему')?.matches).toEqual([9, 10, 11, 12, 13, 14]); // subsequence folds too
  });

  it('folding is 1:1 per UTF-16 unit: the highlight ranges cut the original text, ё included', () => {
    const text = 'Включить тёмную тему';
    const ranges = markRanges(fuzzyScore('темн', text)?.matches ?? []);
    expect(ranges).toEqual([[9, 13]]);
    expect(ranges.map(([start, end]) => text.slice(start, end))).toEqual(['тёмн']);
    const upper = 'ЁЛКА ёлка';
    expect(markRanges(fuzzyScore('елк', upper)?.matches ?? []).map(([s, e]) => upper.slice(s, e))).toEqual(['ЁЛК']);
  });

  it('subsequence: tolerates missing letters (typos) and ignores spaces in the query', () => {
    expect(fuzzyScore('strbst', 'Starburst')).not.toBeNull();
    expect(fuzzyScore('crsh', 'Crystal Rush')).not.toBeNull();
    expect(fuzzyScore('frz vlt', 'Frozen Vault XL')?.matches).toEqual([0, 1, 3, 7, 10, 11]);
  });

  it('subsequence: a tighter match scores higher (gap penalty)', () => {
    expect(score('abc', 'xaxbxc')).toBeGreaterThan(score('abc', 'xaxxxxbxxxxc') ?? 0);
  });

  it('subsequence: prefers word starts over letters inside words', () => {
    // 'r' could be the nearby 'r' inside 'Sorry' or the farther word start 'Run': the word start wins.
    expect(fuzzyScore('sr', 'Sorry Run')?.matches).toEqual([0, 6]);
    // Same gap length; only the word starts differ.
    expect(score('mw', 'Max Win')).toBeGreaterThan(score('mw', 'ama xwin') ?? 0);
  });
});

describe('markRanges', () => {
  it('merges adjacent indices into one [start, end) range', () => {
    expect(markRanges([0, 1, 2, 5, 6, 9])).toEqual([
      [0, 3],
      [5, 7],
      [9, 10],
    ]);
    expect(markRanges([])).toEqual([]);
  });
});

describe('rankItems', () => {
  it('orders by tier, then shorter text first', () => {
    expect(rankTitles('frozen rush', ['Frozen Rush 2', 'Frozen Rush', 'Crystal Rush'])).toEqual(['Frozen Rush', 'Frozen Rush 2']);
    expect(rankTitles('rush', ['Frozen Rush 2', 'Rush Hour', 'Crystal Rush', 'Brushed', 'Rush'])).toEqual([
      'Rush',
      'Rush Hour',
      'Crystal Rush',
      'Frozen Rush 2',
      'Brushed',
    ]);
  });

  it('a small type bonus breaks ties within a tier, but never crosses tiers', () => {
    type Item = { label: string; action: boolean };
    const rank = (query: string, items: Item[]) =>
      rankItems(items, query, { text: (i) => i.label, bonus: (i) => (i.action ? 1 : 0) }).map((r) => r.item.label);
    const action = { label: 'Deposit', action: true };
    expect(rank('dep', [{ label: 'Depot', action: false }, action])).toEqual(['Deposit', 'Depot']);
    expect(rank('pos', [action, { label: 'Pos', action: false }])).toEqual(['Pos', 'Deposit']);
  });

  it('keeps the input order for an empty query and for equal scores and lengths', () => {
    expect(rankTitles('', ['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
    expect(rankTitles('roulette', ['Live Roulette', 'Mini Roulette'])).toEqual(['Live Roulette', 'Mini Roulette']);
  });

  it('returns at most `limit` results (default 10)', () => {
    expect(rankTitles('a')).toHaveLength(10);
    expect(rankTitles('a', titles, 3)).toHaveLength(3);
  });

  it('reference queries on the real fixture', () => {
    // Runbook (H3): an abbreviation finds the game.
    expect(rankTitles('frz vlt')[0]).toBe('Frozen Vault XL');
    expect(rankTitles('imm bj')[0]).toBe('Immersive Blackjack');
    expect(rankTitles('neon')[0]).toBe('Neon Spins'); // prefix tier, shortest first
    expect(rankTitles('roulette').slice(0, 2)).toEqual(['Mini Roulette', 'Live Roulette']);
    expect(rankTitles('blackjack')).toEqual(['Live Blackjack', 'Multihand Blackjack', 'Immersive Blackjack', 'Salon Privé Blackjack']);
    expect(rankTitles('hold')[0]).toMatch(/Hold/);
  });
});
