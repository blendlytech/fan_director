/** Stable error codes. Messages never echo input or internal detail. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code)
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...headers },
  })
}

export function errorResponse(err: ApiError): Response {
  return json(err.status, { error: err.code, ...err.extra })
}

export const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF defence for state-changing requests: the browser's Origin must be our
 * own. Bearer tokens already can't ride along cross-site; this also covers the
 * unauthenticated unsubscribe POST.
 */
export function assertSameOrigin(request: Request, appOrigin: string): void {
  const origin = request.headers.get('Origin')
  if (origin === null || origin !== appOrigin) throw new ApiError(403, 'cross_origin')
}

/**
 * The other half of the origin story (Phase 5, owner's decision (a), 2026-09-20).
 *
 * One Worker answers on several hostnames — the workers.dev host, the apex and
 * www — but `assertSameOrigin` above compares against a single `APP_ORIGIN`.
 * Rather than widen that check, we make sure the app is only ever *served* from
 * the canonical host, so a browser never has the chance to post from any other
 * one. `APP_ORIGIN` stays the one source of truth: change it, and the canonical
 * host moves with it.
 *
 * Returns the redirect to send, or `null` when the request is already on the
 * canonical host and should be handled normally.
 */
export function canonicalRedirect(request: Request, appOrigin: string): Response | null {
  let canonical: URL
  try {
    canonical = new URL(appOrigin)
  } catch {
    // A malformed APP_ORIGIN must not turn every request into a 500. Failing
    // open here costs only the redirect: assertSameOrigin still compares the
    // raw string and still refuses every send, so a typo degrades a convenience
    // and never weakens the CSRF check.
    return null
  }

  const url = new URL(request.url)
  // Origins, not hostnames: this also lifts a plain-http request onto https, so
  // a page is never served over a scheme it would then have to post from.
  if (url.origin === canonical.origin) return null

  url.protocol = canonical.protocol
  url.host = canonical.host
  // 301 (the owner's decision (a), 2026-09-20). `/api/*` is redirected too,
  // deliberately: exempting it would leave the old host answering the API with
  // the wrong Origin, which is the 403 cross_origin this arrangement exists to
  // prevent. A redirected POST arrives as a GET and fails as 405 instead —
  // a clearer signal, and cured by reloading the stale tab that caused it
  // (docs/testing/06-custom-domain.md, Part F).
  return Response.redirect(url.toString(), 301)
}

/** Reads a JSON object body, streaming so an oversized body is cut off early. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const type = request.headers.get('Content-Type') ?? ''
  if (!/^application\/json(\s*;|$)/i.test(type)) throw new ApiError(415, 'unsupported_media_type')
  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, 'body_too_large')
  if (!request.body) throw new ApiError(400, 'invalid_body')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new ApiError(413, 'body_too_large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
  } catch {
    throw new ApiError(400, 'invalid_body')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ApiError(400, 'invalid_body')
  return parsed as Record<string, unknown>
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

export function userAgent(request: Request): string {
  return (request.headers.get('User-Agent') ?? 'unknown').slice(0, 512)
}
