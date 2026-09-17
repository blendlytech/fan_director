// Prints a signed unsubscribe link token for one fan and creator, for the
// staging checklist only. Nothing in the app issues tokens over HTTP.
//
// The key comes from the environment, never from an argument, so it stays out
// of shell history. Use the same value you gave `wrangler secret put`.
//   PowerShell: $env:UNSUBSCRIBE_SIGNING_KEY = '<key>'; node scripts/issue-unsubscribe-token.mjs <fanId> <creatorId>
//   bash:       UNSUBSCRIBE_SIGNING_KEY='<key>' node scripts/issue-unsubscribe-token.mjs <fanId> <creatorId>
// fanId comes from fds.session() in scripts/staging-console.js.
import { signUnsubscribeToken } from './unsubscribe-token.mjs'

const [fanId, creatorId] = process.argv.slice(2)
const secret = process.env.UNSUBSCRIBE_SIGNING_KEY

if (!fanId || !creatorId) {
  console.error('Usage: node scripts/issue-unsubscribe-token.mjs <fanId> <creatorId>')
  process.exitCode = 2
} else if (!secret) {
  console.error('Set UNSUBSCRIBE_SIGNING_KEY in the environment first.')
  process.exitCode = 2
} else {
  try {
    console.log(await signUnsubscribeToken(secret, fanId, creatorId))
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  }
}
