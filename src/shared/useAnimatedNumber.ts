import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export const ANIMATION_MS = 600;

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

/** Integer between `from` and `to` at `progress` (clamped to 0..1). Never leaves that range: no overshoot. */
export function tween(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(from + (to - from) * easeOutCubic(p));
}

/**
 * Animates integer values (e.g. money in minor units) towards `target` with requestAnimationFrame.
 * Progress is elapsed time since the change, so a hidden tab (no frames) shows the final value on
 * its first frame back. A new target mid-way continues from the value on screen. Reduced motion → instant.
 */
export function useAnimatedNumber(target: number, durationMs = ANIMATION_MS): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  /** Where the next animation starts: the value on screen. */
  const fromRef = useRef(target);
  /** Mirrors `value` without a render dependency. */
  const shownRef = useRef(target);

  useEffect(() => {
    if (reduced) {
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target && shownRef.current === target) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = from === target ? 1 : Math.max(0, now - start) / durationMs;
      const next = tween(from, target, progress);
      fromRef.current = next;
      shownRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, reduced]);

  return reduced ? target : value;
}
