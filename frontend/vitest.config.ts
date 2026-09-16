import { defineConfig } from 'vitest/config'

// Unit tests only: the domain model and the reducer are pure, so they run in
// Node with no DOM. Browser behaviour is covered by Playwright in e2e/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
