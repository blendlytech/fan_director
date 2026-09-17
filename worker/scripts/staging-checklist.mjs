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
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page.goto(SITE, { waitUntil: 'networkidle' })

if (needsSignIn) {
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
if (result.draftId) writeFileSync(statePath, JSON.stringify({ ...state, draftId: result.draftId }, null, 2))
appendFileSync(evidencePath, `${JSON.stringify(result)}\n`)
console.log(JSON.stringify(result, null, 2))
console.log(`\nAppended to ${evidencePath}`)
await browser.close()
