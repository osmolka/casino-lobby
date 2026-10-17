import { describe, expect, it } from 'vitest';
import { pushCapped } from './ring';

describe('pushCapped', () => {
  it('puts the new item first', () => {
    expect(pushCapped([2, 1], 3, 5)).toEqual([3, 2, 1]);
  });

  it('drops the oldest items beyond the cap', () => {
    expect(pushCapped([3, 2, 1], 4, 3)).toEqual([4, 3, 2]);
  });

  it('never grows past the cap', () => {
    let list: readonly number[] = [];
    for (let i = 0; i < 200; i++) list = pushCapped(list, i, 50);
    expect(list).toHaveLength(50);
    expect(list[0]).toBe(199);
    expect(list.at(-1)).toBe(150);
  });

  it('does not mutate the input', () => {
    const input = Object.freeze([2, 1]);
    const output = pushCapped(input, 3, 2);
    expect(input).toEqual([2, 1]);
    expect(output).not.toBe(input);
  });
});
