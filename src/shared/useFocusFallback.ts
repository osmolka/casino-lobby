import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * For an element that can disappear on its own (e.g. a Retry button when data arrives): if it unmounts while
 * focused, focus moves to `fallback()` instead of dropping to body. Focus elsewhere is left alone. Attach the
 * ref to an element owned by the component that unmounts with it: the layout cleanup then runs while the
 * element is still in the document.
 */
export function useFocusFallback<T extends HTMLElement>(fallback: () => HTMLElement | null): RefObject<T> {
  const ref = useRef<T>(null);
  const fallbackRef = useRef(fallback);
  useLayoutEffect(() => {
    fallbackRef.current = fallback;
  });
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (element && element === document.activeElement) fallbackRef.current()?.focus();
    };
  }, []);
  return ref;
}
