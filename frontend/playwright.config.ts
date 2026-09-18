import { defineConfig, devices } from '@playwright/test'

// End-to-end smoke tests. By default they run against the Vite dev server in
// demo mode, which renders in StrictMode, so double-dispatch bugs show up here,
// not just in unit tests.
//
// The same suite runs against the deployed staging site (doc 11 §5.6 item 22):
//   E2E_MODE=staging E2E_BASE_URL=https://<staging host> npm run test:e2e
// No local server is started then; e2e/mode.ts holds the only differences.
const remote = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: remote ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        // The demo run has no sign-in. A key in .env.local would switch the app
        // to staging mode; a set-but-empty variable outranks .env files. A dev
        // server that is already running is reused as it is, key or not.
        env: { VITE_CLERK_PUBLISHABLE_KEY: '' },
      },
})
