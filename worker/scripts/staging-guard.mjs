// Refuses a staging deploy while wrangler.jsonc still holds placeholders, if
// a switch that must stay off in every deployed environment is on (doc 11 §5.4),
// if AI is on without a ceiling inside the approved test budget,
// or if the frontend's Clerk publishable key belongs to a different Clerk
// instance than CLERK_ISSUER (every session would then fail with 401).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'wrangler.jsonc')
const text = readFileSync(configPath, 'utf8')
// Strip // line comments that aren't inside strings well enough for this file.
const config = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''))
const staging = config.env?.staging
const problems = []

if (!staging) problems.push('no env.staging block')
else {
  if (staging.name !== 'fan-director-studio-staging') problems.push(`unexpected Worker name ${staging.name}`)
  for (const db of staging.d1_databases ?? []) {
    if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(db.database_id)) problems.push(`D1 ${db.binding} still has the placeholder id`)
  }
  for (const [key, value] of Object.entries(staging.vars ?? {})) {
    if (String(value).includes('REPLACE')) problems.push(`var ${key} still has a placeholder`)
  }
  // AI may be on in staging only with a spending ceiling inside the owner's
  // approved Phase 3 test budget ($8, doc 11 §5.6 item 24).
  const ai = staging.vars?.AI_ENABLED
  const ceiling = String(staging.vars?.AI_BUDGET_CEILING_MICROUSD ?? '')
  if (ai !== 'false' && ai !== 'true') problems.push('AI_ENABLED must be "true" or "false"')
  if (ai === 'true' && !(/^\d+$/.test(ceiling) && Number(ceiling) > 0 && Number(ceiling) <= 8_000_000)) {
    problems.push('AI_ENABLED is "true" but AI_BUDGET_CEILING_MICROUSD is missing or above the approved $8 (8000000)')
  }
  if (staging.vars?.ADULT_CATALOG_ENABLED !== 'false') problems.push('ADULT_CATALOG_ENABLED must be "false"')
  if (staging.observability?.enabled !== false) problems.push('observability must stay disabled (tokens travel in URLs)')
  const keyProblem = checkPublishableKey(staging.vars?.CLERK_ISSUER)
  if (keyProblem) problems.push(keyProblem)
}

// Vite bakes VITE_CLERK_PUBLISHABLE_KEY into the build from the environment or
// frontend/.env.local. The key is `pk_<kind>_` + base64("<frontend api host>$").
// Only the decoded host is ever reported, never the key.
function checkPublishableKey(issuer) {
  let key = process.env.VITE_CLERK_PUBLISHABLE_KEY
  const envFile = join(dirname(configPath), '..', 'frontend', '.env.local')
  if (!key && existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => /^\s*VITE_CLERK_PUBLISHABLE_KEY\s*=/.test(l))
    key = line?.slice(line.indexOf('=') + 1).trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  if (!key) return 'no VITE_CLERK_PUBLISHABLE_KEY (environment or frontend/.env.local): the build would have no sign-in'
  const match = /^pk_(test|live)_([A-Za-z0-9+/=]+)$/.exec(key)
  if (!match) return 'VITE_CLERK_PUBLISHABLE_KEY is not a Clerk publishable key'
  const host = Buffer.from(match[2], 'base64').toString('utf8').replace(/\$$/, '')
  if (`https://${host}` !== issuer) return `publishable key is for ${host}, but CLERK_ISSUER is ${issuer}`
  return null
}

if (problems.length) {
  console.error('Staging deploy blocked:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('Staging config looks provisioned. Secrets are not checked here: run `wrangler secret list --env staging`.')
