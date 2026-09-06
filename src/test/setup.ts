import '@testing-library/jest-dom/vitest';

/*
 * Deterministic, low-motion environment for component tests. jsdom ships a
 * matchMedia that always answers "no", which would leave the decorative canvas
 * running against a 2d context jsdom does not implement — so we replace it and
 * pin reduced-motion on.
 */
{
  window.matchMedia = ((query: string) => ({
    // Tests run reduced-motion: canvases and animations are decoration, and
    // jsdom has no 2d context to give them anyway.
    matches: /prefers-reduced-motion/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
