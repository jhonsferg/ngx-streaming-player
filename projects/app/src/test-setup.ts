// jsdom does not implement window.matchMedia, which GSAP's ScrollTrigger plugin
// calls during registration (see app.ts). Without this polyfill every spec in
// this project fails before a single test runs.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom does not implement IntersectionObserver either, which App uses to
// lazy-init sections on scroll (see app.ts initSectionObserver).
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
  globalThis.IntersectionObserver = window.IntersectionObserver;
}
