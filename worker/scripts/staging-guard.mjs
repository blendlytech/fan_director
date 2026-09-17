// Refuses a staging deploy while wrangler.jsonc still holds placeholders, or if
// a switch that must stay off in every deployed environment is on (doc 11 §5.4).
import { readFileSync } from 'node:fs'
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
  if (staging.vars?.AI_ENABLED !== 'false') problems.push('AI_ENABLED must be "false"')
  if (staging.vars?.ADULT_CATALOG_ENABLED !== 'false') problems.push('ADULT_CATALOG_ENABLED must be "false"')
  if (staging.observability?.enabled !== false) problems.push('observability must stay disabled (tokens travel in URLs)')
}

if (problems.length) {
  console.error('Staging deploy blocked:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('Staging config looks provisioned. Secrets are not checked here: run `wrangler secret list --env staging`.')
