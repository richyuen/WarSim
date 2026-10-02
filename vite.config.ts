import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base so the build runs from any static host path (itch.io, GitHub Pages).
  base: './',
  plugins: [preact()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    // bench.html hosts the render benchmarks (PLAN 0.14/0.15, `npm run bench`).
    rollupOptions: { input: { main: 'index.html', bench: 'bench.html' } },
  },
});
