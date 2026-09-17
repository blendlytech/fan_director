// Unauthenticated smoke checks against a running Worker: local `wrangler dev`
// or the deployed staging URL. Writes nothing.
//   node scripts/smoke.mjs http://localhost:8787
const base = (process.argv[2] ?? 'http://localhost:8787').replace(/\/$/, '')
const results = []

async function check(name, fn) {
  try {
    await fn()
    results.push(['ok', name])
  } catch (err) {
    results.push(['FAIL', `${name}: ${err.message}`])
  }
}

function expect(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`)
}

await check('health answers 200 with no-store', async () => {
  const res = await fetch(`${base}/api/health`)
  expect(res.status, 200, 'status')
  expect(res.headers.get('cache-control'), 'no-store, private', 'cache-control')
})

await check('private API refuses a request without a token', async () => {
  expect((await fetch(`${base}/api/session`)).status, 401, 'status')
})

await check('a __session cookie alone is not a sign-in', async () => {
  const res = await fetch(`${base}/api/session`, { headers: { Cookie: '__session=eyJhbGciOiJSUzI1NiJ9.e30.x' } })
  expect(res.status, 401, 'status')
})

await check('unsubscribe GET with a bad token is read-only "invalid"', async () => {
  const res = await fetch(`${base}/api/unsubscribe/v1.bm9wZQ.bm9wZQ`)
  expect(res.status, 200, 'status')
  expect((await res.json()).state, 'invalid', 'state')
})

await check('unsubscribe POST from another origin is refused', async () => {
  const res = await fetch(`${base}/api/unsubscribe/v1.bm9wZQ.bm9wZQ`, { method: 'POST', headers: { Origin: 'https://evil.example' } })
  expect(res.status, 403, 'status')
})

await check('there is no creator draft route', async () => {
  expect((await fetch(`${base}/api/creator/drafts/00000000-0000-4000-8000-000000000000`)).status, 404, 'status')
})

await check('deep links still serve the app', async () => {
  const res = await fetch(`${base}/creator/requests/abc/ask`)
  expect(res.status, 200, 'status')
  expect((res.headers.get('content-type') ?? '').includes('text/html'), true, 'html')
})

for (const [status, line] of results) console.log(`${status.padEnd(4)} ${line}`)
// exitCode rather than exit(): exiting with sockets open trips a libuv assertion on Windows.
process.exitCode = results.some(([s]) => s === 'FAIL') ? 1 : 0
