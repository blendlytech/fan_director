/**
 * The relay for recording the demo conversations (demo-recording.live.test.ts).
 *
 * Tests in workerd can't touch the disk, and a real conversation can't be
 * scripted in advance: the fan's next message depends on what the Director
 * just said. So the test asks this server for each next step and posts every
 * result back, and the operator answers by writing the next step file.
 *
 *   node test/live/demo-relay.mjs <run-id>
 *
 * Steps are read from   worker/.live-recordings/<run-id>/<case>/in-<n>.json
 * Records are written to worker/.live-recordings/<run-id>/<case>/out-<n>.json
 * The folder is git-ignored: it holds explicit text, and the repo is public.
 * Nothing here sees the API key.
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PORT = 8789
const runId = process.argv[2]
if (!runId || !/^[a-z0-9-]+$/.test(runId)) throw new Error('usage: node test/live/demo-relay.mjs <run-id>')
const root = path.join(import.meta.dirname, '..', '..', '.live-recordings', runId)
mkdirSync(root, { recursive: true })

const SAFE = /^[a-z0-9_-]+$/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/ping') return res.writeHead(204).end()
  const kase = url.searchParams.get('case') ?? ''
  const step = url.searchParams.get('step') ?? ''
  if (!SAFE.test(kase) || !/^\d+$/.test(step)) return res.writeHead(400).end()
  const dir = path.join(root, kase)
  mkdirSync(dir, { recursive: true })

  if (req.method === 'GET' && url.pathname === '/next') {
    // Long-poll for up to 25 s; the test asks again on 204.
    const file = path.join(dir, `in-${step}.json`)
    for (let i = 0; i < 50 && !existsSync(file); i += 1) await sleep(500)
    if (!existsSync(file)) return res.writeHead(204).end()
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(readFileSync(file, 'utf8'))
    return
  }
  if (req.method === 'POST' && url.pathname === '/record') {
    const body = await readBody(req)
    JSON.parse(body) // refuse anything that isn't JSON
    writeFileSync(path.join(dir, `out-${step}.json`), body)
    console.log(`recorded ${kase} step ${step} (${body.length} bytes)`)
    return res.writeHead(204).end()
  }
  res.writeHead(404).end()
}).listen(PORT, '127.0.0.1', () => console.log(`demo relay on 127.0.0.1:${PORT}, writing to ${root}`))
