import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * user-event under vitest fake timers (verified in phase 2b): `advanceTimers` moves its own delays, and the
 * `jest` global makes RTL's asyncWrapper advance its setTimeout(0) (without it every call hangs).
 */
export function setupUser() {
  const advanceTimersByTime = (ms: number) => vi.advanceTimersByTime(ms);
  (globalThis as { jest?: unknown }).jest = { advanceTimersByTime };
  return userEvent.setup({ advanceTimers: advanceTimersByTime });
}
