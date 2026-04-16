import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built bundle can be mounted under any sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    // Dev server listens on loopback only. Set VITE_HOST=0.0.0.0 in the
    // environment if you explicitly need LAN access.
    host: process.env.VITE_HOST ?? '127.0.0.1',
  },
  build: {
    // Never ship source maps to production — they would leak the full
    // TSX source tree to anyone inspecting the deployed bundle.
    sourcemap: false,
  },
});
