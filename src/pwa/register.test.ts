import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('registerServiceWorker', () => {
  it('does nothing outside a production build (dev and tests)', async () => {
    const register = vi.fn(() => Promise.resolve({}));
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
    expect(import.meta.env.PROD).toBe(false);
    registerServiceWorker();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(register).not.toHaveBeenCalled();
  });
});
