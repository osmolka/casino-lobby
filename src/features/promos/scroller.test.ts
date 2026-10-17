import { describe, expect, it } from 'vitest';
import { scrollTarget } from './scroller';

describe('scrollTarget', () => {
  it('next = the first card after the last fully visible one', () => {
    expect(scrollTarget('next', [0, 1, 2], 5)).toBe(3);
    expect(scrollTarget('next', [2, 1], 5)).toBe(3);
  });

  it('prev = the last card before the first fully visible one', () => {
    expect(scrollTarget('prev', [3, 4], 5)).toBe(2);
    expect(scrollTarget('prev', [2, 3], 5)).toBe(1);
  });

  it('null at the edges', () => {
    expect(scrollTarget('next', [3, 4], 5)).toBeNull();
    expect(scrollTarget('prev', [0, 1], 5)).toBeNull();
  });

  it('null when no card is fully visible or there are no cards', () => {
    expect(scrollTarget('next', [], 5)).toBeNull();
    expect(scrollTarget('prev', [], 5)).toBeNull();
    expect(scrollTarget('next', [], 0)).toBeNull();
  });
});
