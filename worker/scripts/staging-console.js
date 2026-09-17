// Staging checklist helper (Gate 1). The frontend doesn't call the API yet, so
// the checks run from the browser console on the staging site itself.
//
// 1. Open the staging site, sign in as the account the check needs.
// 2. Open DevTools > Console, paste this whole file, press Enter.
// 3. Call the helpers, for example:  await fds.session()
//
// Every call gets a fresh Clerk session token (they last about a minute) and
// sends it as a bearer header. Cookies are never sent, which also proves the
// Worker doesn't sign anyone in from a cookie. The page's own origin satisfies
// the Worker's same-origin check. Nothing here holds or prints a secret or a
// token, and it only uses the public API.
;(() => {
  const clerk = window.Clerk
  if (!clerk) {
    console.error('fds: Clerk is not on this page. Was the frontend built with VITE_CLERK_PUBLISHABLE_KEY?')
    return
  }

  async function api(method, path, body, { signedIn = true } = {}) {
    const headers = {}
    if (signedIn) {
      const token = clerk.session ? await clerk.session.getToken() : null
      if (!token) throw new Error('fds: not signed in')
      headers.Authorization = `Bearer ${token}`
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
    })
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    const result = { status: res.status, body: data }
    console.log(`${method} ${path}`, result)
    return result
  }

  const enc = encodeURIComponent

  window.fds = {
    /** Non-secret claims of the current session: user, session id, fva, v, azp. */
    async claims() {
      const token = await clerk.session.getToken()
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const { sub, sid, fva, v, azp, iss } = JSON.parse(atob(b64))
      const result = { sub, sid, fva, v, azp, iss }
      console.log('claims', result)
      return result
    },

    session: () => api('GET', '/api/session'),
    creatorMe: () => api('GET', '/api/creator/me'),

    /** A new draft id (the Worker requires a UUID). */
    newDraftId: () => crypto.randomUUID(),

    /** A minimal DraftV2 PUT body. expectedRevision 0 creates. */
    draftBody: (catalogVersionId, expectedRevision, selections, extra = {}) => ({
      expectedRevision,
      catalogVersionId,
      draft: { selections, fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: null, ...extra },
    }),
    getDraft: (creatorId, draftId) => api('GET', `/api/creators/${enc(creatorId)}/drafts/${enc(draftId)}`),
    saveDraft: (creatorId, draftId, body) => api('PUT', `/api/creators/${enc(creatorId)}/drafts/${enc(draftId)}`, body),

    consent: (creatorId) => api('GET', `/api/creators/${enc(creatorId)}/consent`),
    subscribe: (creatorId, wordingVersion) =>
      api('POST', `/api/creators/${enc(creatorId)}/consent`, { status: 'subscribed', wordingVersion }),
    unsubscribeInSettings: (creatorId) => api('POST', `/api/creators/${enc(creatorId)}/consent`, { status: 'unsubscribed' }),
    /** choice: 'subscribe' (needs wordingVersion) or 'skip'. */
    onboarding: (creatorId, choice, wordingVersion) =>
      api('POST', `/api/creators/${enc(creatorId)}/consent-onboarding`, choice === 'subscribe' ? { choice, wordingVersion } : { choice }),

    /** As an email link would: no sign-in. Tokens come from scripts/issue-unsubscribe-token.mjs. */
    unsubscribeGet: (token) => api('GET', `/api/unsubscribe/${enc(token)}`, undefined, { signedIn: false }),
    unsubscribePost: (token) => api('POST', `/api/unsubscribe/${enc(token)}`, undefined, { signedIn: false }),
  }

  console.log('fds ready:', Object.keys(window.fds).join(', '))
})()
