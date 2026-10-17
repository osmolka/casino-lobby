export type ScrollDirection = 'prev' | 'next';

/**
 * Index of the card to align to the inline start. next = first card after the last fully visible one,
 * prev = last card before the first fully visible one. Null at an edge or when no card is fully visible.
 */
export function scrollTarget(direction: ScrollDirection, fullyVisible: readonly number[], count: number): number | null {
  if (fullyVisible.length === 0) return null;
  const target = direction === 'next' ? Math.max(...fullyVisible) + 1 : Math.min(...fullyVisible) - 1;
  return target >= 0 && target < count ? target : null;
}
