import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // maplibre-gl loads its worker via a dynamic runtime import that Vite's
    // esbuild-based dep pre-bundler can't resolve (manifests as "file does
    // not exist at .../maplibre-gl-worker.mjs" the first time a map
    // interaction spins up the worker). It ships its own built output, so
    // it doesn't need pre-bundling — exclude it entirely rather than trying
    // to get the optimizer to handle it correctly.
    exclude: ['maplibre-gl'],
  },
})
