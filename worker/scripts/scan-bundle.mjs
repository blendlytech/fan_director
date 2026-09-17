// Scans the built frontend (frontend/dist) for backend secrets (doc 11 §8 Phase 1).
// 1. Signatures: Clerk secret keys, PEM private keys, and names of Worker secrets.
// 2. Values: if CLERK_SECRET_KEY / UNSUBSCRIBE_SIGNING_KEY / CLERK_JWT_KEY are set
//    in this process's environment, their exact values are searched for too.
//    Values are never printed.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

let files
try {
  files = walk(root)
} catch {
  console.error(`No build at ${root}. Run npm run build --prefix frontend first.`)
  process.exit(2)
}

const signatures = [
  ['Clerk secret key', /sk_(test|live)_[A-Za-z0-9]{10,}/],
  ['PEM private key', /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ['Worker secret name', /UNSUBSCRIBE_SIGNING_KEY|CLERK_SECRET_KEY|CLERK_JWT_KEY/],
]
const values = ['CLERK_SECRET_KEY', 'UNSUBSCRIBE_SIGNING_KEY', 'CLERK_JWT_KEY']
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => typeof value === 'string' && value.length >= 16)

const findings = []
for (const file of files) {
  const text = readFileSync(file, 'latin1')
  for (const [label, re] of signatures) if (re.test(text)) findings.push(`${relative(root, file)}: ${label}`)
  for (const [name, value] of values) if (text.includes(value)) findings.push(`${relative(root, file)}: value of ${name}`)
}

console.log(`Scanned ${files.length} files; compared ${values.length} secret value(s) from the environment.`)
if (findings.length) {
  console.error('Secrets found in the frontend bundle:\n- ' + findings.join('\n- '))
  process.exit(1)
}
console.log('No secret signatures or values found.')
