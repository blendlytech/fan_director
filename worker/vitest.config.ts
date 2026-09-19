import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'))
  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          // Tests only: never in wrangler.jsonc. Real secrets are never used here.
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: 'test',
            APP_ORIGIN: 'https://app.test',
            CLERK_ISSUER: 'https://clerk.test',
            CLERK_AUTHORIZED_PARTIES: 'https://app.test',
            CLERK_JWT_KEY: 'set-per-test',
            CLERK_SECRET_KEY: 'unused-in-tests',
            UNSUBSCRIBE_SIGNING_KEY: 'dGVzdC1vbmx5LXVuc3Vic2NyaWJlLWtleS0zMi1ieXRlcyEh',
            // Overrides any key in .dev.vars: ordinary tests only ever use the mocked provider.
            OPENROUTER_API_KEY: 'unused-in-tests',
          },
        },
      }),
    ],
    test: {
      // The live suite calls a real provider: only `npm run test:live` runs it.
      exclude: ['test/live/**', 'node_modules/**'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})
