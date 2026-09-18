// Drives the Gate 1 staging checklist in a real browser, so the results come
// from genuine Clerk sessions instead of hand-typed console calls.
//
//   node scripts/staging-checklist.mjs <scenario> [--url <origin>]
//   scenarios: creator | fanA-first | fanA-again | fanB | unsubscribe
//
// A visible browser window opens on the staging site. Sign in there as the
// account the scenario needs: copy the link out of the email and paste it into
// THAT window's address bar. Clicking it opens your normal browser instead,
// which is a different browser to Clerk, and the sign-in never lands here.
//
// Every call is made from the page with a fresh session token and no cookies,
// exactly as scripts/staging-console.js does by hand. Results print as JSON and
// are appended to .staging-evidence.json (git-ignored) for the Gate 1 report.
//
// The unsubscribe scenario needs a token from scripts/issue-unsubscribe-token.mjs,
// passed as --token <token>.
//
// `--as <email or user id>` skips the manual sign-in: the script asks Clerk's
// Backend API for a one-time sign-in ticket and opens the site with it, creating
// the user first if that email doesn't exist yet. It needs CLERK_SECRET_KEY in
// .dev.vars. Sign-in tickets work on ANY Clerk instance, production included: a
// secret key can sign in as any user. So --as refuses anything but a development
// key (sk_test_). A session made this way is not evidence about the real sign-in
// UI: it proves what the Worker does with a session, not how it was obtained.
import { createRequire } from 'node:module'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const evidencePath = join(here, '..', '.staging-evidence.json')
const statePath = join(here, '..', '.staging-checklist-state.json')

const args = process.argv.slice(2)
const scenario = args[0]
const flag = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1] }
const SITE = flag('url') ?? 'https://fan-director-studio-staging.blendly.workers.dev'
const scenarios = ['creator', 'fanA-first', 'fanA-again', 'fanB', 'unsubscribe']
if (!scenarios.includes(scenario)) {
  console.error(`Usage: node scripts/staging-checklist.mjs <${scenarios.join(' | ')}> [--url <origin>] [--token <unsubscribe token>]`)
  process.exit(1)
}

// Playwright lives in the frontend workspace, which already installs Chromium for e2e.
const require = createRequire(join(here, '..', '..', 'frontend', 'package.json'))
let chromium
try {
  ({ chromium } = require('@playwright/test'))
} catch {
  console.error('Playwright is missing. Run: npm install --prefix ../frontend && npx playwright install chromium')
  process.exit(1)
}

const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {}

// --- Clerk Backend API, only used by --as. The secret never leaves this process.
function clerkSecret() {
  const file = join(here, '..', '.dev.vars')
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('CLERK_SECRET_KEY'))
  if (!line) throw new Error('CLERK_SECRET_KEY is missing from worker/.dev.vars')
  const key = line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')
  // Tickets sign in as anyone. Never let this script do that against production.
  if (!key.startsWith('sk_test_')) throw new Error('--as only runs with a development Clerk key (sk_test_)')
  return key
}

async function clerkApi(method, path, body) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${clerkSecret()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Clerk ${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  return data
}

/** Returns { userId, created }: finds the user by id or email, creating the email if new. */
async function resolveUser(who) {
  if (who.startsWith('user_')) return { userId: who, created: false }
  const found = await clerkApi('GET', `/users?email_address=${encodeURIComponent(who)}`)
  if (Array.isArray(found) && found[0]) return { userId: found[0].id, created: false }
  // Fans have no password by design (email link only); this also works while an
  // instance still has passwords switched on.
  const made = await clerkApi('POST', '/users', { email_address: [who], skip_password_requirement: true })
  return { userId: made.id, created: true }
}

// Runs inside the page. Mirrors scripts/staging-console.js: bearer token per call,
// no cookies, same paths and bodies.
const runInPage = async ({ scenario, state, token }) => {
  const clerk = window.Clerk
  const api = async (method, path, body, signedIn = true) => {
    const headers = {}
    if (signedIn) headers.Authorization = `Bearer ${await clerk.session.getToken()}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
    })
    let data = null
    try { data = await res.json() } catch { data = null }
    return { status: res.status, body: data }
  }
  const draftBody = (catalogVersionId, expectedRevision, selections) => ({
    expectedRevision,
    catalogVersionId,
    draft: { selections, fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: null },
  })
  const enc = encodeURIComponent

  const out = { scenario, at: new Date().toISOString(), steps: {} }
  if (clerk?.session) {
    const claims = JSON.parse(atob((await clerk.session.getToken()).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    out.claims = { sub: claims.sub, sid: claims.sid, fva: claims.fva, v: claims.v, azp: claims.azp, iss: claims.iss }
  }
  const step = async (name, fn) => { try { out.steps[name] = await fn() } catch (e) { out.steps[name] = { error: String(e) } } }

  if (scenario === 'creator') {
    await step('creator_me', () => api('GET', '/api/creator/me'))
    await step('session', () => api('GET', '/api/session'))
  } else if (scenario === 'fanA-first') {
    const id = crypto.randomUUID()
    out.draftId = id
    await step('consent_before', () => api('GET', '/api/creators/cr_staging_a/consent'))
    await step('onboarding_subscribe', () => api('POST', '/api/creators/cr_staging_a/consent-onboarding', { choice: 'subscribe', wordingVersion: 'news-v1' }))
    await step('onboarding_again', () => api('POST', '/api/creators/cr_staging_a/consent-onboarding', { choice: 'subscribe', wordingVersion: 'news-v1' }))
    await step('save_draft', () => api('PUT', `/api/creators/cr_staging_a/drafts/${enc(id)}`, draftBody('cv_staging_a1', 0, [{ itemId: 'a_minutes', qty: 5 }])))
    await step('reload_draft', () => api('GET', `/api/creators/cr_staging_a/drafts/${enc(id)}`))
    await step('hidden_item', () => api('PUT', `/api/creators/cr_staging_a/drafts/${crypto.randomUUID()}`, draftBody('cv_staging_a1', 0, [{ itemId: 'a_set_hidden', qty: 1 }])))
    await step('qty_over_max', () => api('PUT', `/api/creators/cr_staging_a/drafts/${crypto.randomUUID()}`, draftBody('cv_staging_a1', 0, [{ itemId: 'a_minutes', qty: 21 }])))
    await step('revision_conflict', () => api('PUT', `/api/creators/cr_staging_a/drafts/${enc(id)}`, draftBody('cv_staging_a1', 0, [{ itemId: 'a_minutes', qty: 6 }])))
    await step('other_creator_draft', () => api('GET', `/api/creators/cr_staging_b/drafts/${enc(id)}`))
    await step('catalog_version_mismatch', () => api('PUT', `/api/creators/cr_staging_b/drafts/${crypto.randomUUID()}`, draftBody('cv_staging_a1', 0, [{ itemId: 'b_minutes', qty: 5 }])))
  } else if (scenario === 'fanA-again') {
    await step('consent_after_signin', () => api('GET', '/api/creators/cr_staging_a/consent'))
    await step('reload_draft', () => api('GET', `/api/creators/cr_staging_a/drafts/${enc(state.draftId)}`))
  } else if (scenario === 'fanB') {
    // Fan B never answers the news step, so whether it shows depends only on the
    // sign-up timing rule: true on the first run, false on a run 60+ s later.
    await step('consent_check', () => api('GET', '/api/creators/cr_staging_a/consent'))
    await step('read_other_fans_draft', () => api('GET', `/api/creators/cr_staging_a/drafts/${enc(state.draftId)}`))
    await step('write_other_fans_draft', () => api('PUT', `/api/creators/cr_staging_a/drafts/${enc(state.draftId)}`, draftBody('cv_staging_a1', 1, [{ itemId: 'a_minutes', qty: 9 }])))
  } else if (scenario === 'unsubscribe') {
    // Signed out on purpose: an unsubscribe link works straight from an inbox.
    await step('get_first', () => api('GET', `/api/unsubscribe/${enc(token)}`, undefined, false))
    await step('get_second', () => api('GET', `/api/unsubscribe/${enc(token)}`, undefined, false))
    await step('post_first', () => api('POST', `/api/unsubscribe/${enc(token)}`, undefined, false))
    await step('post_second', () => api('POST', `/api/unsubscribe/${enc(token)}`, undefined, false))
    const last = token.at(-1)
    await step('tampered', () => api('GET', `/api/unsubscribe/${enc(token.slice(0, -1) + (last === 'A' ? 'B' : 'A'))}`, undefined, false))
  }
  return out
}

const needsSignIn = scenario !== 'unsubscribe'
const token = flag('token')
if (scenario === 'unsubscribe' && !token) {
  console.error('unsubscribe needs --token <token from scripts/issue-unsubscribe-token.mjs>')
  process.exit(1)
}
if ((scenario === 'fanA-again' || scenario === 'fanB') && !state.draftId) {
  console.error('No draft id recorded yet: run the fanA-first scenario first.')
  process.exit(1)
}

const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,940'] })
// Close the window even when a step throws, so failed runs don't leave it open.
try {
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page.goto(SITE, { waitUntil: 'networkidle' })

const as = flag('as')
if (needsSignIn && as) {
  const { userId, created } = await resolveUser(as)
  const { token: ticket } = await clerkApi('POST', '/sign_in_tokens', { user_id: userId, expires_in_seconds: 600 })
  console.log(`\nScenario "${scenario}" on ${SITE}\nSigning in as ${userId}${created ? ' (just created)' : ''} with a sign-in ticket...`)
  // The app mounts Clerk's modal, not its sign-in page, so nothing redeems a
  // ?__clerk_ticket= URL on its own. Redeem it with the ticket strategy instead.
  await page.waitForFunction(() => Boolean(window.Clerk?.loaded), null, { timeout: 60000, polling: 500 })
  const redeemed = await page.evaluate(async (t) => {
    try {
      const attempt = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket: t })
      if (attempt.status !== 'complete') return `sign-in status ${attempt.status}`
      await window.Clerk.setActive({ session: attempt.createdSessionId })
      return 'ok'
    } catch (e) {
      return `error: ${e?.errors?.[0]?.longMessage ?? e?.message ?? String(e)}`
    }
  }, ticket)
  if (redeemed !== 'ok') throw new Error(`Ticket sign-in failed: ${redeemed}`)
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 60000, polling: 500 })
  const user = await clerkApi('GET', `/users/${userId}`)
  const sessions = await clerkApi('GET', `/sessions?user_id=${userId}&status=active`)
  const list = Array.isArray(sessions) ? sessions : (sessions.data ?? [])
  const newest = list.sort((a, b) => b.created_at - a.created_at)[0]
  state.signIn = {
    userId,
    userCreatedAt: new Date(user.created_at).toISOString(),
    sessionCreatedAt: newest ? new Date(newest.created_at).toISOString() : null,
    gapSeconds: newest ? Math.round((newest.created_at - user.created_at) / 1000) : null,
  }
  console.log('Clerk timings:', JSON.stringify(state.signIn))
} else if (needsSignIn) {
  console.log(`\nScenario "${scenario}" on ${SITE}`)
  console.log('Sign in IN THIS WINDOW. Copy the link from the email and paste it into this window\'s address bar.')
  console.log('Waiting up to 15 minutes...')
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 900000, polling: 1000 })
  // The pasted link may leave the page on Clerk's verification screen.
  if (!page.url().startsWith(SITE)) await page.goto(SITE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 60000, polling: 500 })
  console.log('Signed in. Running the checks...')
} else {
  console.log(`\nScenario "${scenario}": no sign-in needed.`)
}

const result = await page.evaluate(runInPage, { scenario, state, token })
// Sign out, as a person would, so this session doesn't stay live: the Worker
// only counts a sign-up when the fan has exactly one live session.
if (needsSignIn) await page.evaluate(() => window.Clerk.signOut())
if (state.signIn) result.signIn = state.signIn
writeFileSync(statePath, JSON.stringify({ ...state, draftId: result.draftId ?? state.draftId }, null, 2))
appendFileSync(evidencePath, `${JSON.stringify(result)}\n`)
console.log(JSON.stringify(result, null, 2))
console.log(`\nAppended to ${evidencePath}`)
} finally {
  await browser.close()
}
