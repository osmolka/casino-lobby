import { describe, expect, it } from 'vitest';
import { translate } from './t';

const messages = {
  a: { b: 'Hello, {name}!' },
  plain: 'Plain',
  games: { one: '{count} game', other: '{count} games' },
  ruGames: { one: '{count} игра', few: '{count} игры', many: '{count} игр', other: '{count} игры' },
};

describe('translate', () => {
  it('resolves a nested key', () => {
    expect(translate(messages, 'en', 'plain')).toBe('Plain');
  });

  it('interpolates variables', () => {
    expect(translate(messages, 'en', 'a.b', { name: 'Ann' })).toBe('Hello, Ann!');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(translate(messages, 'en', 'a.b')).toBe('Hello, {name}!');
  });

  it('selects English plural forms and formats count with the locale', () => {
    expect(translate(messages, 'en', 'games', { count: 1 })).toBe('1 game');
    expect(translate(messages, 'en', 'games', { count: 0 })).toBe('0 games');
    expect(translate(messages, 'en', 'games', { count: 1200 })).toBe('1,200 games');
  });

  it('selects Russian plural forms via Intl.PluralRules', () => {
    expect(translate(messages, 'ru', 'ruGames', { count: 1 })).toBe('1 игра');
    expect(translate(messages, 'ru', 'ruGames', { count: 3 })).toBe('3 игры');
    expect(translate(messages, 'ru', 'ruGames', { count: 5 })).toBe('5 игр');
    expect(translate(messages, 'ru', 'ruGames', { count: 21 })).toBe('21 игра');
  });

  it('falls back to "other" when a plural category is missing', () => {
    expect(translate(messages, 'ru', 'games', { count: 3 })).toBe('3 games');
  });

  it('returns the key itself when it is missing or not a leaf', () => {
    expect(translate(messages, 'en', 'nope.nothing')).toBe('nope.nothing');
    expect(translate(messages, 'en', 'a')).toBe('a');
  });
});
