// Catalog publish, the admin path (doc 11 §8 Phase 2). Checks a catalog
// version and writes the SQL that publishes it; nothing touches a database.
// Run from worker/ with Node 24 or later.
//
//   node scripts/publish-catalog.ts pilot --out seeds/pilot-maya-v1.sql
//     Maya's pilot catalog v1 (shared/catalog/pilot-v1.ts), creating the
//     fictional creator and her catalog.
//
//   node scripts/publish-catalog.ts version --creator <id> --catalog <id> --id <versionId> --version <n> --file <content.json> --out <sql>
//     A later version of an existing catalog. The previous published version
//     is retired; drafts pinned to it are re-quoted only when the fan accepts.
//
// Then apply it with: npx wrangler d1 execute DB --env staging --remote --file <sql>
// Exit code 1, and no SQL, if any check fails.
import { readFileSync, writeFileSync } from 'node:fs'
import { normalizeContent } from '../../shared/domain/catalog.ts'
import {
  PILOT_BOUTIQUE_NAME,
  PILOT_CATALOG_ID,
  PILOT_CREATOR_ID,
  PILOT_CREATOR_NAME,
  PILOT_V1,
  PILOT_VERSION_ID,
} from '../../shared/catalog/pilot-v1.ts'
import { publishStatements, toSqlFile, validateCatalogForPublish, type PublishInput } from '../src/publish.ts'

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  const value = i > 0 ? process.argv[i + 1] : undefined
  if (!value) {
    console.error(`Missing --${name}`)
    process.exit(2)
  }
  return value
}

const now = new Date().toISOString()
let input: PublishInput
if (process.argv[2] === 'pilot') {
  input = {
    creatorId: PILOT_CREATOR_ID,
    catalogId: PILOT_CATALOG_ID,
    versionId: PILOT_VERSION_ID,
    version: 1,
    content: PILOT_V1,
    now,
    createCreator: { displayName: PILOT_CREATOR_NAME },
  }
} else if (process.argv[2] === 'version') {
  input = {
    creatorId: arg('creator'),
    catalogId: arg('catalog'),
    versionId: arg('id'),
    version: Number(arg('version')),
    content: normalizeContent(JSON.parse(readFileSync(arg('file'), 'utf8'))),
    now,
  }
} else {
  console.error('Usage: node scripts/publish-catalog.ts pilot | version --creator … --catalog … --id … --version … --file …')
  process.exit(2)
}

const problems = validateCatalogForPublish(input.content)
if (problems.length > 0) {
  console.error(`Not published. ${problems.length} problem(s); the version stays a draft:`)
  for (const p of problems) {
    console.error(p.code === 'hard_list' ? `  ${p.where}: breaks the hard-list rule "${p.key}"` : `  ${p.where}: ${p.detail}`)
  }
  process.exit(1)
}

const header = `-- ${input.createCreator ? `${PILOT_BOUTIQUE_NAME} pilot catalog` : 'Catalog'} ${input.versionId} (version ${input.version}), generated ${now}\n-- by worker/scripts/publish-catalog.ts after the publish checks passed. Adult content off.\n`
const sql = header + toSqlFile(publishStatements(input))
// --out writes UTF-8 directly: PowerShell's `>` would write UTF-16.
const out = process.argv.indexOf('--out')
if (out > 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], sql, 'utf8')
  console.error(`Wrote ${process.argv[out + 1]}`)
} else {
  process.stdout.write(sql)
}
