/**
 * jsdom has no ResizeObserver / IntersectionObserver (no layout). Installed by setup.ts; tests drive the
 * callbacks with `triggerResize()` and `setFullyVisible()`, as a browser would after layout or scrolling.
 */
class StubResizeObserver implements ResizeObserver {
  static readonly instances = new Set<StubResizeObserver>();
  readonly targets = new Set<Element>();

  constructor(readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.targets.add(target);
    StubResizeObserver.instances.add(this);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    StubResizeObserver.instances.delete(this);
  }
}

class StubIntersectionObserver implements IntersectionObserver {
  static readonly instances = new Set<StubIntersectionObserver>();
  readonly targets = new Set<Element>();
  readonly root: Element | Document | null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: readonly number[];

  constructor(
    readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null;
    const { threshold = 0 } = options;
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
  }

  observe(target: Element) {
    this.targets.add(target);
    StubIntersectionObserver.instances.add(this);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    StubIntersectionObserver.instances.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

export function installObserverStubs() {
  if (typeof window.ResizeObserver !== 'function') window.ResizeObserver = StubResizeObserver;
  if (typeof window.IntersectionObserver !== 'function') window.IntersectionObserver = StubIntersectionObserver;
}

/** Calls every live ResizeObserver with all of its targets. */
export function triggerResize() {
  for (const observer of [...StubResizeObserver.instances]) {
    const entries = [...observer.targets].map((target) => ({ target }) as ResizeObserverEntry);
    observer.callback(entries, observer);
  }
}

/** Calls every live IntersectionObserver: targets matching `isVisible` are fully visible, the rest hidden. */
export function setFullyVisible(isVisible: (target: Element, index: number) => boolean) {
  for (const observer of [...StubIntersectionObserver.instances]) {
    const entries = [...observer.targets].map((target, index) => {
      const visible = isVisible(target, index);
      return { target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry;
    });
    observer.callback(entries, observer);
  }
}
