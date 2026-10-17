/** Bounded buffer, newest first: returns a new array with `item` in front and at most `cap` entries. */
export function pushCapped<T>(list: readonly T[], item: T, cap: number): readonly T[] {
  const next = [item, ...list];
  if (next.length > cap) next.length = cap;
  return next;
}
