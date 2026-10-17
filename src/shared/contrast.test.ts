import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch, hslToHex, mixOklch, oklchToHex, parseHex, shiftLightness } from './contrast';

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

describe('oklch helpers', () => {
  it('round-trips sRGB colors through OKLCH', () => {
    for (const hex of ['#6b2fd6', '#b296ff', '#ffffff', '#1a1d27', '#167a3c']) expect(oklchToHex(hexToOklch(hex))).toBe(hex);
  });

  it('matches reference OKLCH values (CSS Color 4)', () => {
    const { l, c } = hexToOklch('#ffffff');
    expect(l).toBeCloseTo(1, 3);
    expect(c).toBeLessThan(1e-4);
    const red = hexToOklch('#ff0000');
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
  });

  it('mixOklch: endpoints, and an achromatic side takes the other hue', () => {
    expect(mixOklch('#6b2fd6', 1, '#ffffff')).toBe('#6b2fd6');
    expect(mixOklch('#6b2fd6', 0, '#ffffff')).toBe('#ffffff');
    expect(hexToOklch(mixOklch('#6b2fd6', 0.5, '#ffffff')).h).toBeCloseTo(hexToOklch('#6b2fd6').h, 0);
  });

  it('shiftLightness changes only lightness', () => {
    const before = hexToOklch('#6b2fd6');
    const after = hexToOklch(shiftLightness('#6b2fd6', -0.06));
    expect(after.l).toBeCloseTo(before.l - 0.06, 2);
    expect(after.c).toBeCloseTo(before.c, 2);
    expect(after.h).toBeCloseTo(before.h, 0);
  });
});
