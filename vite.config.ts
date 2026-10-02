import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative base so the build runs from any static host path (itch.io, GitHub Pages).
  base: './',
  plugins: [preact()],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
