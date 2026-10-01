import { describe, expect, it } from 'vitest'
import { handleApi } from '../src/index'
import type { Env } from '../src/types'
import { bodyOf, boutique, call, clerkUser, deps, ORIGIN, testEnv, type Boutique } from './helpers'

/* The creator's lookbook (migration 0005): creator-only edits, owned uploads. */

const creatorToken = (b: Boutique) => b.owner.token({ claims: { fva: [0, 0] } })

// The smallest byte strings each format's signature check accepts.
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])

async function upload(token: string, bytes: Uint8Array, type = 'image/webp', env: Partial<Env> = {}): Promise<Response> {
  return handleApi(
    new Request(`${ORIGIN}/api/creator/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN, 'Content-Type': type },
      body: bytes,
    }),
    { ...testEnv, ...env },
    deps,
  )
}

async function loaded(b: Boutique) {
  const res = await call('GET', '/api/creator/profile', { token: await creatorToken(b) })
  expect(res.status).toBe(200)
  return bodyOf(res)
}

describe('who may use the lookbook routes', () => {
  it('needs a signed-in creator: signed out is 401, a fan is 403', async () => {
    expect((await call('GET', '/api/creator/profile')).status).toBe(401)
    const fan = clerkUser()
    for (const [method, path] of [['GET', '/api/creator/profile'], ['PUT', '/api/creator/profile'], ['POST', '/api/creator/media']] as const) {
      const res = await call(method, path, { token: await fan.token(), body: method === 'GET' ? undefined : {} })
      expect(res.status).toBe(403)
      expect((await bodyOf(res)).error).toBe('not_a_creator')
    }
  })

  it('refuses a save from another origin', async () => {
    const b = await boutique()
    const res = await call('PUT', '/api/creator/profile', { token: await creatorToken(b), origin: 'https://evil.test', body: {} })
    expect(res.status).toBe(403)
    expect((await bodyOf(res)).error).toBe('cross_origin')
  })
})

describe('reading and saving the profile', () => {
  it('starts a new creator from their own name, empty categories and adult categories marked', async () => {
    const b = await boutique('Rae Studio')
    const body = await loaded(b)
    expect(body.revision).toBe(0)
    expect(body.mediaUploads).toBe(true)
    expect(body.adultAllowed).toBe(false)
    expect(body.profile.brand.name).toBe('Rae Studio')
    expect(body.profile.categories.every((c: { items: unknown[] }) => c.items.length === 0)).toBe(true)
    expect(body.profile.categories.filter((c: { contentRating?: string }) => c.contentRating === 'adult').map((c: { id: string }) => c.id)).toEqual(['toys', 'fetishes'])
  })

  it('saves, bumps the revision, and refuses a stale revision with the current one', async () => {
    const b = await boutique()
    const { profile } = await loaded(b)
    profile.style = 'Soft and candid'
    profile.boundaries.hardNo = ['No feet', '  ']
    profile.categories.push({ id: 'shoes', name: 'Shoes', maxSelections: 3, items: [], custom: true })

    const saved = await call('PUT', '/api/creator/profile', { token: await creatorToken(b), body: { expectedRevision: 0, profile } })
    expect(saved.status).toBe(200)
    const savedBody = await bodyOf(saved)
    expect(savedBody.revision).toBe(1)
    expect(savedBody.profile.boundaries.hardNo).toEqual(['No feet'])

    const again = await loaded(b)
    expect(again.revision).toBe(1)
    expect(again.profile.style).toBe('Soft and candid')
    expect(again.profile.categories.at(-1)).toEqual({ id: 'shoes', name: 'Shoes', maxSelections: 3, items: [], custom: true })

    const stale = await call('PUT', '/api/creator/profile', { token: await creatorToken(b), body: { expectedRevision: 0, profile } })
    expect(stale.status).toBe(409)
    expect(await bodyOf(stale)).toEqual({ error: 'revision_conflict', revision: 1 })
  })

  it('keeps each creator to their own profile', async () => {
    const a = await boutique('Creator A')
    const b = await boutique('Creator B')
    const { profile } = await loaded(a)
    profile.mood = 'Only for A'
    expect((await call('PUT', '/api/creator/profile', { token: await creatorToken(a), body: { expectedRevision: 0, profile } })).status).toBe(200)
    const other = await loaded(b)
    expect(other.revision).toBe(0)
    expect(other.profile.mood).toBe('')
  })

  it('refuses unknown keys, bad limits, and images that are not this creator’s uploads', async () => {
    const b = await boutique()
    const token = await creatorToken(b)
    const { profile } = await loaded(b)
    const put = (p: unknown) => call('PUT', '/api/creator/profile', { token, body: { expectedRevision: 0, profile: p } })

    const extraKey = await put({ ...profile, price: 100 })
    expect(await bodyOf(extraKey)).toEqual({ error: 'invalid_profile', field: 'profile.price' })

    const tooMany = structuredClone(profile)
    tooMany.categories[0].maxSelections = 21
    expect((await bodyOf(await put(tooMany))).field).toBe('categories.0.maxSelections')

    const dataUrl = structuredClone(profile)
    dataUrl.categories[0].items.push({ id: 'x', name: 'Robe', image: 'data:image/webp;base64,AAAA' })
    expect((await bodyOf(await put(dataUrl))).field).toBe('categories.0.items.0.image')

    const bundled = structuredClone(profile)
    bundled.categories[0].items.push({ id: 'x', name: 'Robe', image: '/lookbook/bra.webp' })
    expect((await bodyOf(await put(bundled))).field).toBe('categories.0.items.0.image')

    const notUploaded = structuredClone(profile)
    notUploaded.categories[0].items.push({ id: 'x', name: 'Robe', image: `/api/media/${crypto.randomUUID()}` })
    const res = await put(notUploaded)
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('unknown_media')
  })

  it('keeps adult categories empty while adult content is off, even when renamed or relabelled', async () => {
    const b = await boutique()
    const token = await creatorToken(b)
    const media = await bodyOf(await upload(token, WEBP))
    const { profile } = await loaded(b)
    const toys = profile.categories.find((c: { id: string }) => c.id === 'toys')
    toys.name = 'Accessories two'
    toys.contentRating = 'general'
    toys.items.push({ id: 'one', name: 'One', image: media.url })
    const res = await call('PUT', '/api/creator/profile', { token, body: { expectedRevision: 0, profile } })
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('adult_content_disabled')
  })
})

describe('uploads', () => {
  it('stores an image the creator owns, serves it to anyone, and lets the profile use it', async () => {
    const b = await boutique()
    const token = await creatorToken(b)
    const res = await upload(token, WEBP)
    expect(res.status).toBe(201)
    const media = await bodyOf(res)
    expect(media.url).toBe(`/api/media/${media.id}`)

    const served = await call('GET', media.url, { origin: null })
    expect(served.status).toBe(200)
    expect(served.headers.get('Content-Type')).toBe('image/webp')
    expect(served.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(WEBP)

    const { profile } = await loaded(b)
    profile.categories[0].items.push({ id: 'robe', name: 'Red satin robe', image: media.url, custom: true })
    const saved = await call('PUT', '/api/creator/profile', { token, body: { expectedRevision: 0, profile } })
    expect(saved.status).toBe(200)
  })

  it('refuses another creator’s upload in a profile', async () => {
    const a = await boutique()
    const b = await boutique()
    const media = await bodyOf(await upload(await creatorToken(a), PNG, 'image/png'))
    const { profile } = await loaded(b)
    profile.categories[0].items.push({ id: 'stolen', name: 'Not mine', image: media.url })
    const res = await call('PUT', '/api/creator/profile', { token: await creatorToken(b), body: { expectedRevision: 0, profile } })
    expect(res.status).toBe(422)
    expect((await bodyOf(res)).error).toBe('unknown_media')
  })

  it('checks the type against the file’s first bytes', async () => {
    const b = await boutique()
    const token = await creatorToken(b)
    expect((await upload(token, WEBP, 'image/gif')).status).toBe(415)
    const mismatch = await upload(token, WEBP, 'image/png')
    expect(mismatch.status).toBe(400)
    expect((await bodyOf(mismatch)).error).toBe('invalid_image')
  })

  it('says plainly when this site has no media storage, and writes nothing', async () => {
    const b = await boutique()
    const token = await creatorToken(b)
    const res = await upload(token, WEBP, 'image/webp', { MEDIA: undefined })
    expect(res.status).toBe(503)
    expect((await bodyOf(res)).error).toBe('media_storage_unavailable')
    const rows = await testEnv.DB.prepare('SELECT COUNT(*) AS n FROM creator_media WHERE creator_id = ?').bind(b.creatorId).first<{ n: number }>()
    expect(rows?.n).toBe(0)

    const profile = await call('GET', '/api/creator/profile', { token, env: { MEDIA: undefined } })
    expect((await bodyOf(profile)).mediaUploads).toBe(false)
  })

  it('stops serving a suspended creator’s images', async () => {
    const b = await boutique()
    const media = await bodyOf(await upload(await creatorToken(b), WEBP))
    await testEnv.DB.prepare(`UPDATE creator SET status = 'suspended' WHERE id = ?`).bind(b.creatorId).run()
    expect((await call('GET', media.url, { origin: null })).status).toBe(404)
  })
})
