import { describe, expect, it } from 'vitest'
import { canonicalRedirect } from '../src/http'

/* -------------------------------------------------------------------------- */
/*  One canonical host (Phase 5, owner's decision (a), 2026-09-20).            */
/*                                                                            */
/*  The Worker answers on the workers.dev host, the apex and www, but          */
/*  assertSameOrigin compares Origin against a single APP_ORIGIN. These tests  */
/*  pin the thing that makes that safe: the app is only ever *served* from     */
/*  APP_ORIGIN, so a browser is never handed a page it would post from         */
/*  somewhere else.                                                           */
/*                                                                            */
/*  The rest of the suite calls handleApi directly, so nothing else exercises  */
/*  this path.                                                                */
/* -------------------------------------------------------------------------- */

const CANONICAL = 'https://www.studiolens.me'
const OLD = 'https://fan-director-studio-staging.blendly.workers.dev'
const APEX = 'https://studiolens.me'

const get = (url: string) => new Request(url)
const locationOf = (res: Response | null) => {
  expect(res).not.toBeNull()
  return new URL(res!.headers.get('Location')!)
}

describe('canonicalRedirect', () => {
  it('lets a request already on the canonical host through', () => {
    expect(canonicalRedirect(get(`${CANONICAL}/studio`), CANONICAL)).toBeNull()
  })

  it('redirects the old workers.dev host', () => {
    expect(canonicalRedirect(get(`${OLD}/studio`), CANONICAL)).not.toBeNull()
  })

  it('redirects the bare apex, so studiolens.me lands on www', () => {
    expect(canonicalRedirect(get(`${APEX}/studio`), CANONICAL)).not.toBeNull()
  })

  it('answers with a redirect status the browser will follow', () => {
    const res = canonicalRedirect(get(`${OLD}/`), CANONICAL)
    expect([301, 302, 308]).toContain(res!.status)
  })

  it('sends the visitor to the canonical host, not merely away from the old one', () => {
    expect(locationOf(canonicalRedirect(get(`${OLD}/`), CANONICAL)).origin).toBe(CANONICAL)
  })

  it('keeps the path, so a deep link survives the move', () => {
    expect(locationOf(canonicalRedirect(get(`${OLD}/creator/requests`), CANONICAL)).pathname).toBe('/creator/requests')
  })

  it('keeps the query string, so an unsubscribe or draft link still works', () => {
    const to = locationOf(canonicalRedirect(get(`${OLD}/saved?draft=abc&from=email`), CANONICAL))
    expect(to.pathname).toBe('/saved')
    expect(to.searchParams.get('draft')).toBe('abc')
    expect(to.searchParams.get('from')).toBe('email')
  })

  it('follows APP_ORIGIN rather than any hardcoded hostname', () => {
    // The whole cutover is one config line; nothing here may assume studiolens.me.
    const elsewhere = 'https://example.test'
    expect(canonicalRedirect(get(`${elsewhere}/studio`), elsewhere)).toBeNull()
    expect(locationOf(canonicalRedirect(get(`${CANONICAL}/studio`), elsewhere)).origin).toBe(elsewhere)
  })

  it('lifts a plain-http request onto https', () => {
    // Same hostname, wrong scheme: a page served over http would post over http.
    const to = locationOf(canonicalRedirect(get('http://www.studiolens.me/review'), CANONICAL))
    expect(to.protocol).toBe('https:')
    expect(to.href).toBe(`${CANONICAL}/review`)
  })

  it('redirects /api too, so the old host answers nothing at all', () => {
    // Exempting the API would leave it reachable on a hostname whose Origin can
    // never match APP_ORIGIN — the 403 this whole arrangement exists to prevent.
    expect(locationOf(canonicalRedirect(get(`${OLD}/api/health`), CANONICAL)).href).toBe(`${CANONICAL}/api/health`)
  })

  it('serves the site rather than 500ing when APP_ORIGIN is malformed', () => {
    // A config typo must cost the redirect, not the whole Worker. assertSameOrigin
    // still refuses every send, so this fails open on a nicety and closed on CSRF.
    expect(canonicalRedirect(get(`${OLD}/studio`), 'not a url')).toBeNull()
    expect(canonicalRedirect(get(`${OLD}/studio`), '')).toBeNull()
  })
})
