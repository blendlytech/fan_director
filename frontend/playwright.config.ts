import { defineConfig, devices } from '@playwright/test'

// End-to-end smoke tests against the Vite dev server, which renders in
// StrictMode — so double-dispatch bugs show up here, not just in unit tests.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    // The suite tests the demo (no sign-in). A key in .env.local would switch
    // the app to staging mode; a set-but-empty variable outranks .env files.
    // A dev server that is already running is reused as it is, key or not.
    env: { VITE_CLERK_PUBLISHABLE_KEY: '' },
  },
})
