import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch, hslToHex, mixLch, mixOklch, oklchToHex, overlay, parseHex, shiftLightness } from './contrast';

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

  it('oklchToHex clips out-of-gamut colors per channel, like Chromium renders them', () => {
    // Pixels read from Chromium 153 screenshots of `background: oklch(…)`.
    expect(oklchToHex({ l: 0.49, c: 0.22, h: 120 })).toBe('#546d00');
    expect(oklchToHex({ l: 0.49, c: 0.22, h: 195 })).toBe('#007f87');
    expect(oklchToHex({ l: 0.73, c: 0.15, h: 110 })).toBe('#aeaf23');
    expect(oklchToHex({ l: 0.43, c: 0.22, h: 30 })).toBe('#a80000');
  });

  it('mixLch mixes unclipped OKLCH values (the origin is not gamut-mapped first)', () => {
    const accent = { l: 0.44, c: 0.19, h: 186 }; // out of sRGB
    const mixed = mixLch(accent, 0.12, hexToOklch('#ffffff'));
    expect(mixed.l).toBeCloseTo(0.44 * 0.12 + 0.88, 3);
    expect(mixed.c).toBeCloseTo(0.19 * 0.12, 3);
    expect(mixed.h).toBeCloseTo(186, 3); // white is achromatic: takes the accent's hue
    expect(mixLch(accent, 0.5, { l: 0.5, c: 0.1, h: 350 }).h).toBeCloseTo(268, 3); // shorter arc: +164°, halfway
  });

  it('overlay composites a color at an opacity over a background (8-bit sRGB)', () => {
    expect(overlay('#000000', 0.5, '#ffffff')).toBe('#808080');
    expect(overlay('#5a2fb0', 1, '#ffffff')).toBe('#5a2fb0');
    expect(overlay('#5a2fb0', 0, '#1a1d27')).toBe('#1a1d27');
  });

  it('shiftLightness changes only lightness', () => {
    const before = hexToOklch('#6b2fd6');
    const after = hexToOklch(shiftLightness('#6b2fd6', -0.06));
    expect(after.l).toBeCloseTo(before.l - 0.06, 2);
    expect(after.c).toBeCloseTo(before.c, 2);
    expect(after.h).toBeCloseTo(before.h, 0);
  });
});
