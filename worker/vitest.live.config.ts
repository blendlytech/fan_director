import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

/**
 * The OPT-IN live suite (`npm run test:live`): real calls to OpenRouter with the
 * owner's key, inside the test process only (doc 11 §5.6 items 3 and 11). Never
 * part of `npm test`. Spend is capped by the same reservation ledger, against a
 * running total kept in the git-ignored .live-spend.json (see test/live/spend.ts).
 *
 * The key is read from the git-ignored worker/.dev.vars and never printed.
 */
function devVar(name: string): string | undefined {
  const file = path.join(import.meta.dirname, '.dev.vars')
  if (!existsSync(file)) return undefined
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
  return line?.slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, '$2') || undefined
}

/** Local live runs may spend at most $5 of the owner's $8 Phase 3 budget (doc 11 §5.6 item 24). */
const LOCAL_LIVE_CAP_MICROUSD = 5_000_000

/**
 * What's left for this run: $5 minus everything the key has spent since Phase 3's
 * first live run (OpenRouter's own usage figure, so it's cumulative across runs
 * and includes staging if staging uses the same key). The baseline is kept in
 * the git-ignored .live-spend.json.
 */
async function remainingMicroUsd(key: string): Promise<{ remaining: number; spentSoFar: number }> {
  const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`OpenRouter key check failed: HTTP ${res.status}`)
  const usage = Number(((await res.json()) as { data?: { usage?: number } }).data?.usage ?? NaN)
  if (!Number.isFinite(usage)) throw new Error('OpenRouter key check returned no usage figure')
  const file = path.join(import.meta.dirname, '.live-spend.json')
  let baseline = usage
  if (existsSync(file)) baseline = Number(JSON.parse(readFileSync(file, 'utf8')).baselineUsd)
  else writeFileSync(file, JSON.stringify({ baselineUsd: usage, recordedAt: new Date().toISOString() }, null, 2))
  const spentSoFar = Math.ceil((usage - baseline) * 1_000_000)
  return { remaining: Math.max(0, LOCAL_LIVE_CAP_MICROUSD - spentSoFar), spentSoFar }
}

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'))
  const key = devVar('OPENROUTER_API_KEY')
  if (!key) throw new Error('No OPENROUTER_API_KEY in worker/.dev.vars: the live suite needs the owner key')
  const budget = await remainingMicroUsd(key)
  console.log(`Live suite: Phase 3 spend so far $${(budget.spentSoFar / 1e6).toFixed(4)}; this run may spend up to $${(budget.remaining / 1e6).toFixed(4)}.`)
  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: 'test',
            APP_ORIGIN: 'https://app.test',
            CLERK_ISSUER: 'https://clerk.test',
            CLERK_AUTHORIZED_PARTIES: 'https://app.test',
            CLERK_JWT_KEY: 'set-per-test',
            CLERK_SECRET_KEY: 'unused-in-tests',
            UNSUBSCRIBE_SIGNING_KEY: 'dGVzdC1vbmx5LXVuc3Vic2NyaWJlLWtleS0zMi1ieXRlcyEh',
            LIVE_OPENROUTER_API_KEY: key,
            LIVE_BUDGET_MICROUSD: String(budget.remaining),
          },
        },
      }),
    ],
    test: {
      include: ['test/live/**/*.live.test.ts'],
      setupFiles: ['./test/apply-migrations.ts'],
      testTimeout: 600_000,
      hookTimeout: 120_000,
      fileParallelism: false,
    },
  }
})
