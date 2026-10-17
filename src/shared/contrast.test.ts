import { describe, expect, it } from 'vitest';
import { contrastRatio, hslToHex, parseHex } from './contrast';

describe('contrast', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#1a2B3c')).toEqual([26, 43, 60]);
    expect(parseHex('red')).toBeNull();
  });

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('converts HSL to hex', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 25)).toBe('#008000');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(210, 50, 40)).toBe('#336699');
    expect(hslToHex(360, 100, 50)).toBe('#ff0000');
  });
});
