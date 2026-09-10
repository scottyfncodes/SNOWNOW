import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * GitHub Pages serves this project from `/SNOWNOW/`, not from a domain root,
 * so every asset URL has to be prefixed or the page loads and then 404s on its
 * own JavaScript.
 *
 * The prefix is supplied by the deploy workflow rather than hard-coded here:
 * local dev, local preview and the test run all stay at `/`, and the one place
 * that needs to know about the subpath is the one place that publishes to it.
 */
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: { target: 'es2022' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // The server tests spin up a real `node:http` server and talk to it over
    // real sockets — a node environment, not jsdom, and no DOM test setup
    // (src/test/setup.ts reaches for `window`, which doesn't exist here).
    // Vitest's `projects` runs both configs as one `vitest run`/`npm test`.
    projects: [
      { extends: true },
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['server/**/*.test.mjs'],
        },
      },
    ],
  },
});
