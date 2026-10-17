import { describe, expect, it } from 'vitest';
import { isPaletteHotkey } from './hotkey';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('isPaletteHotkey', () => {
  it('Ctrl+K and Cmd+K', () => {
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'k', ctrlKey: true }))).toBe(true);
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'k', metaKey: true }))).toBe(true);
  });

  it('matches the physical key, so a Russian layout (key "л") works', () => {
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'л', ctrlKey: true }))).toBe(true);
    expect(isPaletteHotkey(key({ code: 'KeyR', key: 'k', ctrlKey: true }))).toBe(false); // e.g. Dvorak "k" elsewhere
  });

  it('ignores K alone and other modifier combinations', () => {
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'k' }))).toBe(false);
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'K', ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'k', ctrlKey: true, altKey: true }))).toBe(false);
  });

  it('ignores auto-repeat (holding the keys does not toggle repeatedly)', () => {
    expect(isPaletteHotkey(key({ code: 'KeyK', key: 'k', ctrlKey: true, repeat: true }))).toBe(false);
  });
});
