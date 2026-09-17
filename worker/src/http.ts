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
