/**
 * Ctrl+K / Cmd+K. Matches `code` (the physical key), not `key`: on a Russian layout `key` is "л".
 * Auto-repeat is ignored so holding the keys does not open and close the palette in a loop.
 */
export function isPaletteHotkey(event: KeyboardEvent): boolean {
  return event.code === 'KeyK' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.repeat;
}
