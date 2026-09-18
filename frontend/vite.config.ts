import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The catalog, quote and boundaries code lives in ../shared, shared with the Worker.
    fs: { allow: [import.meta.dirname, path.resolve(import.meta.dirname, '../shared')] },
  },
})
