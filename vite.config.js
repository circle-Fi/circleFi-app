import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served from a GitHub Pages project path, so assets must be relative.
  base: './',
  build: { target: 'es2022' },
  define: { global: 'globalThis' },
});
