import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom exposes window.matchMedia as undefined.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

// jsdom has <dialog> but no showModal/close and no Esc → cancel. Emulates what browsers do.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog?.dispatchEvent(new Event('cancel', { cancelable: true }))) (dialog as HTMLDialogElement).close();
  });
}

// jsdom has no layout, so no scrollIntoView. A no-op that tests can spy on.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    // no layout in jsdom
  };
}

afterEach(() => {
  cleanup();
});
