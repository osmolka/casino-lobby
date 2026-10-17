import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../../shared/useMediaQuery';
import { prefersReducedMotion } from '../../shared/useReducedMotion';
import { scrollTarget, type ScrollDirection } from './scroller';

/** Prev/Next buttons only for a mouse or trackpad; touch has swipe. */
export const FINE_POINTER = '(hover: hover) and (pointer: fine)';
/** A card counts as fully visible from this ratio (subpixel layout rarely gives exactly 1). */
const FULLY_VISIBLE = 0.98;

export interface PromoScroller {
  /** Pass as the scroll track's `ref` (a callback ref); its children are the cards. */
  setTrack: (el: HTMLElement | null) => void;
  /** The track overflows and the primary pointer is fine: render the buttons. */
  controls: boolean;
  atStart: boolean;
  atEnd: boolean;
  scroll: (direction: ScrollDirection) => void;
}

/**
 * Prev/Next for the promo track without reading or writing scroll offsets (negative in RTL): an
 * IntersectionObserver tracks the fully visible cards, and the target card is scrolled to the inline
 * start with scrollIntoView, so snapping and RTL stay with the browser. Edge state updates only when it
 * changes, so scrolling does not re-render the cards.
 */
export function usePromoScroller(): PromoScroller {
  const [track, setTrack] = useState<HTMLElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const fine = useMediaQuery(FINE_POINTER);
  const visibleRef = useRef(new Set<Element>());

  // Layout effect: the first measurement lands before paint, so the scrollbar never flashes.
  useLayoutEffect(() => {
    if (!track) return;
    const visible = visibleRef.current;
    const measure = () => {
      setOverflows(track.scrollWidth > track.clientWidth + 1);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(track);

    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= FULLY_VISIBLE) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const items = [...track.children];
        const first = items[0];
        const last = items.at(-1);
        const atStart = !first || visible.has(first);
        const atEnd = !last || visible.has(last);
        setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
      },
      { root: track, threshold: [0, FULLY_VISIBLE, 1] },
    );
    for (const item of track.children) intersection.observe(item);

    return () => {
      resize.disconnect();
      intersection.disconnect();
      visible.clear();
      setEdges({ atStart: true, atEnd: false });
    };
  }, [track]);

  const scroll = useCallback(
    (direction: ScrollDirection) => {
      if (!track) return;
      const items = [...track.children];
      const fully = items.flatMap((item, i) => (visibleRef.current.has(item) ? [i] : []));
      const index = scrollTarget(direction, fully, items.length);
      if (index === null) return;
      items[index]?.scrollIntoView({
        inline: 'start',
        block: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    },
    [track],
  );

  return { setTrack, controls: overflows && fine, ...edges, scroll };
}
