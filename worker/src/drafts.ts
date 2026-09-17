import type { FanIdentity } from './auth'
import { ApiError, json, readJsonBody } from './http'
import type { Deps, DraftContent, Env } from './types'
import { assertOnlyKeys, LIMITS, parseDraftContent, UUID } from './validation'

/**
 * Phase 1 persistence only. Category limits, requires/excludes, the rules
 * layer, boundary flags and quotes arrive in Phase 2; every response says so.
 */
const VALIDATION_PENDING = 'pending_phase_2'

interface DraftRow {
  id: string
  creator_id: string
  catalog_version_id: string
  revision: number
  content_json: string
  updated_at: string
}

interface CatalogItem {
  id: string
  hidden?: boolean
  contentRating?: string
  pricing?: { kind: string; minQty?: number; maxQty?: number }
}
interface CatalogCategory {
  hidden?: boolean
  contentRating?: string
  items?: CatalogItem[]
}

function present(row: DraftRow): Response {
  const content = JSON.parse(row.content_json) as DraftContent
  return json(200, {
    draft: {
      id: row.id,
      creatorId: row.creator_id,
      catalogVersionId: row.catalog_version_id,
      revision: row.revision,
      ...content,
      boundaryFlags: null,
    },
    validation: VALIDATION_PENDING,
    updatedAt: row.updated_at,
  })
}

async function loadOwned(env: Env, fanId: string, creatorId: string, draftId: string): Promise<DraftRow | null> {
  return env.DB.prepare(
    `SELECT id, creator_id, catalog_version_id, revision, content_json, updated_at
       FROM draft WHERE id = ? AND fan_id = ? AND creator_id = ?`,
  )
    .bind(draftId, fanId, creatorId)
    .first<DraftRow>()
}

export async function getDraft(env: Env, fan: FanIdentity, creatorId: string, draftId: string): Promise<Response> {
  if (!UUID.test(draftId)) throw new ApiError(404, 'not_found')
  const row = await loadOwned(env, fan.fanId, creatorId, draftId)
  // Another fan's draft, or one in another creator's boutique, looks exactly
  // like a draft that doesn't exist.
  if (!row) throw new ApiError(404, 'not_found')
  return present(row)
}

/** Rejects unknown, hidden and adult selections against the published version. */
async function assertSelectable(env: Env, creatorId: string, catalogVersionId: string, content: DraftContent): Promise<void> {
  const version = await env.DB.prepare(
    `SELECT v.content_json FROM catalog_version v JOIN catalog c ON c.id = v.catalog_id
      WHERE v.id = ? AND c.creator_id = ? AND v.status = 'published'`,
  )
    .bind(catalogVersionId, creatorId)
    .first<{ content_json: string }>()
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')

  const adultAllowed = env.ADULT_CATALOG_ENABLED === 'true'
  const parsed = JSON.parse(version.content_json) as { categories?: CatalogCategory[] }
  const items = new Map<string, { item: CatalogItem; category: CatalogCategory }>()
  for (const category of parsed.categories ?? []) {
    for (const item of category.items ?? []) items.set(item.id, { item, category })
  }

  for (const selection of content.selections) {
    const found = items.get(selection.itemId)
    if (!found) throw new ApiError(422, 'selection_rejected', { itemId: selection.itemId })
    const { item, category } = found
    const adult = item.contentRating !== 'general' || category.contentRating !== 'general'
    if (item.hidden !== false || category.hidden !== false || (adult && !adultAllowed)) {
      throw new ApiError(422, 'selection_rejected', { itemId: selection.itemId })
    }
    const pricing = item.pricing
    const perUnit = pricing?.kind === 'per_unit'
    const min = perUnit ? (pricing.minQty ?? 1) : 1
    const max = perUnit ? (pricing.maxQty ?? 1) : 1
    if (selection.qty < min || selection.qty > max) {
      throw new ApiError(422, 'selection_rejected', { itemId: selection.itemId })
    }
  }
}

export async function putDraft(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
  draftId: string,
): Promise<Response> {
  if (!UUID.test(draftId)) throw new ApiError(404, 'not_found')
  const body = await readJsonBody(request, LIMITS.draftBodyBytes)
  assertOnlyKeys(body, ['expectedRevision', 'catalogVersionId', 'draft'], 'invalid_draft')
  const { expectedRevision, catalogVersionId } = body
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    throw new ApiError(400, 'invalid_draft', { field: 'expectedRevision' })
  }
  if (typeof catalogVersionId !== 'string' || catalogVersionId.length > 64) {
    throw new ApiError(400, 'invalid_draft', { field: 'catalogVersionId' })
  }
  const content = parseDraftContent(body.draft)

  const creator = await env.DB.prepare(`SELECT id FROM creator WHERE id = ? AND status = 'active'`)
    .bind(creatorId)
    .first()
  if (!creator) throw new ApiError(404, 'not_found')
  await assertSelectable(env, creatorId, catalogVersionId, content)

  const now = deps.now().toISOString()
  const contentJson = JSON.stringify(content)

  if (expectedRevision === 0) {
    const inserted = await env.DB.prepare(
      `INSERT INTO draft (id, fan_id, creator_id, catalog_version_id, revision, content_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    )
      .bind(draftId, fan.fanId, creatorId, catalogVersionId, contentJson, now, now)
      .run()
    if (inserted.meta.changes === 1) return present((await loadOwned(env, fan.fanId, creatorId, draftId))!)
  } else {
    // Atomic compare-and-set: owner, tenant and catalog version never change here.
    const updated = await env.DB.prepare(
      `UPDATE draft SET content_json = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND fan_id = ? AND creator_id = ? AND catalog_version_id = ? AND revision = ?`,
    )
      .bind(contentJson, now, draftId, fan.fanId, creatorId, catalogVersionId, expectedRevision)
      .run()
    if (updated.meta.changes === 1) return present((await loadOwned(env, fan.fanId, creatorId, draftId))!)
  }

  const current = await loadOwned(env, fan.fanId, creatorId, draftId)
  // Someone else's id (or another boutique's) is indistinguishable from none.
  if (!current) throw new ApiError(404, 'not_found')
  if (current.catalog_version_id !== catalogVersionId) throw new ApiError(422, 'catalog_version_mismatch')
  const currentBody = (await present(current).json()) as Record<string, unknown>
  throw new ApiError(409, 'revision_conflict', { current: currentBody.draft })
}
