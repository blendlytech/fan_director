import { isAdultCategory, parseCreatorProfile, starterProfile, type CreatorProfile } from '../../shared/domain/creatorProfile.ts'
import type { CreatorIdentity } from './auth'
import { adultAllowed } from './catalog'
import { ApiError, json, readJsonBody } from './http'
import type { Deps, Env } from './types'
import { assertOnlyKeys, UUID } from './validation'

/*
 * The creator's lookbook (migration 0005). Every route here but the image read
 * needs `requireCreator`, so a fan's session gets 403 not_a_creator and never
 * reaches a profile. The creator id always comes from the session, never from
 * the URL, so one creator can't name another's profile.
 */

export const MEDIA_LIMITS = {
  /** The browser resizes to 720 px WebP first, which lands far under this. */
  uploadBytes: 1_048_576,
  perCreator: 300,
  profileBodyBytes: 65_536,
} as const

const MEDIA_PATH = /^\/api\/media\/([0-9a-f-]{36})$/
const mediaUrl = (id: string) => `/api/media/${id}`
const mediaKey = (creatorId: string, id: string) => `creators/${creatorId}/${id}`

interface ProfileRow {
  revision: number
  content_json: string
}

async function loadProfile(env: Env, creator: CreatorIdentity): Promise<{ profile: CreatorProfile; revision: number }> {
  const row = await env.DB.prepare('SELECT revision, content_json FROM creator_profile WHERE creator_id = ?')
    .bind(creator.creatorId)
    .first<ProfileRow>()
  if (!row) return { profile: starterProfile(creator.displayName), revision: 0 }
  return { profile: JSON.parse(row.content_json) as CreatorProfile, revision: row.revision }
}

/** GET /api/creator/profile: the signed-in creator's own lookbook, or their starting point. */
export async function getCreatorProfile(env: Env, creator: CreatorIdentity): Promise<Response> {
  const { profile, revision } = await loadProfile(env, creator)
  return json(200, {
    profile,
    revision,
    // What this site can do, so the editor says so instead of failing late.
    mediaUploads: env.MEDIA !== undefined,
    adultAllowed: await adultAllowed(env, creator.creatorId),
  })
}

/**
 * PUT /api/creator/profile: replaces the lookbook. `expectedRevision` is the
 * revision the editor loaded (0 before the first save); anything else is a
 * 409 with the current revision, so a second tab can't silently overwrite.
 */
export async function putCreatorProfile(request: Request, env: Env, deps: Deps, creator: CreatorIdentity): Promise<Response> {
  const body = await readJsonBody(request, MEDIA_LIMITS.profileBodyBytes)
  assertOnlyKeys(body, ['expectedRevision', 'profile'], 'invalid_profile')
  const expected = body.expectedRevision
  if (!Number.isInteger(expected) || (expected as number) < 0) throw new ApiError(400, 'invalid_profile', { field: 'expectedRevision' })

  // Only the creator's own uploads may be stored, checked against the table below.
  const referenced = new Set<string>()
  const parsed = parseCreatorProfile(body.profile, {
    imageAllowed: (url) => {
      const match = MEDIA_PATH.exec(url)
      if (!match || !UUID.test(match[1])) return false
      referenced.add(match[1])
      return true
    },
  })
  if (!parsed.ok) throw new ApiError(400, 'invalid_profile', { field: parsed.field })
  const profile = parsed.profile

  if (!(await adultAllowed(env, creator.creatorId)) && profile.categories.some((c) => isAdultCategory(c) && c.items.length > 0)) {
    throw new ApiError(422, 'adult_content_disabled')
  }
  if (referenced.size > 0) {
    const ids = [...referenced]
    const owned = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM creator_media WHERE creator_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
    )
      .bind(creator.creatorId, ...ids)
      .first<{ n: number }>()
    if ((owned?.n ?? 0) !== ids.length) throw new ApiError(422, 'unknown_media')
  }

  const now = deps.now().toISOString()
  const content = JSON.stringify(profile)
  const result = expected === 0
    ? await env.DB.prepare(
        `INSERT INTO creator_profile (creator_id, revision, content_json, updated_at) VALUES (?, 1, ?, ?)
         ON CONFLICT (creator_id) DO NOTHING`,
      ).bind(creator.creatorId, content, now).run()
    : await env.DB.prepare(
        'UPDATE creator_profile SET revision = revision + 1, content_json = ?, updated_at = ? WHERE creator_id = ? AND revision = ?',
      ).bind(content, now, creator.creatorId, expected).run()

  if (result.meta.changes !== 1) {
    const current = await env.DB.prepare('SELECT revision FROM creator_profile WHERE creator_id = ?')
      .bind(creator.creatorId)
      .first<{ revision: number }>()
    throw new ApiError(409, 'revision_conflict', { revision: current?.revision ?? 0 })
  }
  return json(200, { profile, revision: (expected as number) + 1 })
}

const SIGNATURES: { type: string; matches: (b: Uint8Array) => boolean }[] = [
  { type: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', matches: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  {
    type: 'image/webp',
    matches: (b) => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
  },
]

async function readImageBody(request: Request): Promise<{ bytes: Uint8Array; type: string }> {
  const declaredType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  const signature = SIGNATURES.find((s) => s.type === declaredType)
  if (!signature) throw new ApiError(415, 'unsupported_media_type')
  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > MEDIA_LIMITS.uploadBytes) throw new ApiError(413, 'body_too_large')
  if (!request.body) throw new ApiError(400, 'invalid_image')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MEDIA_LIMITS.uploadBytes) {
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
  // The declared type must match the file's own first bytes.
  if (total < 12 || !signature.matches(bytes)) throw new ApiError(400, 'invalid_image')
  return { bytes, type: declaredType }
}

/**
 * POST /api/creator/media: one image as the raw request body. Without an R2
 * bucket bound to this Worker the answer is 503 media_storage_unavailable,
 * and nothing is written.
 */
export async function postCreatorMedia(request: Request, env: Env, deps: Deps, creator: CreatorIdentity): Promise<Response> {
  if (!env.MEDIA) throw new ApiError(503, 'media_storage_unavailable')
  const { bytes, type } = await readImageBody(request)

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM creator_media WHERE creator_id = ?')
    .bind(creator.creatorId)
    .first<{ n: number }>()
  if ((count?.n ?? 0) >= MEDIA_LIMITS.perCreator) throw new ApiError(422, 'media_limit_reached', { limit: MEDIA_LIMITS.perCreator })

  const id = crypto.randomUUID()
  await env.MEDIA.put(mediaKey(creator.creatorId, id), bytes, { httpMetadata: { contentType: type } })
  try {
    await env.DB.prepare('INSERT INTO creator_media (id, creator_id, content_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, creator.creatorId, type, bytes.byteLength, deps.now().toISOString())
      .run()
  } catch (err) {
    // No row means no owner: don't leave the bytes behind.
    await env.MEDIA.delete(mediaKey(creator.creatorId, id))
    throw err
  }
  return json(201, { id, url: mediaUrl(id), contentType: type, byteSize: bytes.byteLength })
}

/**
 * GET /api/media/:id: an uploaded image, for any visitor. `<img>` can't send a
 * session token, and fans will see these images. The id is a random UUID that
 * only appears in its creator's lookbook; a suspended creator's images stop
 * being served.
 */
export async function getMedia(env: Env, id: string): Promise<Response> {
  if (!UUID.test(id) || !env.MEDIA) throw new ApiError(404, 'not_found')
  const row = await env.DB.prepare(
    `SELECT m.creator_id, m.content_type FROM creator_media m
       JOIN creator c ON c.id = m.creator_id AND c.status = 'active'
      WHERE m.id = ?`,
  )
    .bind(id)
    .first<{ creator_id: string; content_type: string }>()
  if (!row) throw new ApiError(404, 'not_found')
  const object = await env.MEDIA.get(mediaKey(row.creator_id, id))
  if (!object) throw new ApiError(404, 'not_found')
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': row.content_type,
      // The bytes behind an id never change.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
