// Signs an unsubscribe token in the same `v1.<payload>.<signature>` format as
// issueUnsubscribeToken() in src/unsubscribe.ts. This copy has no imports, so it
// runs in plain Node for staging checks. test/unsubscribe-token-script.test.ts
// proves it matches the Worker byte for byte and that the Worker accepts it.

const ID = /^[A-Za-z0-9_-]{1,64}$/

function toB64url(bytes) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signUnsubscribeToken(secretBase64, fanId, creatorId, issuedAt = new Date()) {
  if (!ID.test(fanId) || !ID.test(creatorId)) throw new Error('invalid ids')
  const raw = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0))
  if (raw.byteLength < 32) throw new Error('UNSUBSCRIBE_SIGNING_KEY must be at least 32 bytes')
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const payload = toB64url(
    new TextEncoder().encode(JSON.stringify({ f: fanId, c: creatorId, t: Math.floor(issuedAt.getTime() / 1000) })),
  )
  const signed = `v1.${payload}`
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed))
  return `${signed}.${toB64url(new Uint8Array(sig))}`
}
