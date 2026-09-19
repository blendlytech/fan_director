import { renderBoundaries } from '../../shared/domain/boundaries.ts'
import { normalizeContent, visibleContent } from '../../shared/domain/catalog.ts'
import { quote } from '../../shared/domain/quote.ts'
import { defaultSelections, priceRange, validTemplates } from '../../shared/domain/ranges.ts'
import type { CatalogContent, GateOptions, PricedDraft, Quote, SelectionError } from '../../shared/domain/types.ts'
import { ApiError, json, readJsonBody } from './http'
import type { Env } from './types'
import { assertOnlyKeys, parseBudget, parseSelections } from './validation'

export interface VersionRow {
  id: string
  version: number
  status: 'published' | 'retired'
  content: CatalogContent
  /** The catalog's current published version: differs from `id` when this one is stale. */
  currentVersionId: string | null
  creatorName: string
}

/**
 * Adult content is allowed only when the platform switch, the creator's own
 * switch and every compliance flag are on (doc 11 §5.4). Staging and
 * production keep the platform switch off, so this is false there.
 */
export async function adultAllowed(env: Env, creatorId: string): Promise<boolean> {
  if (env.ADULT_CATALOG_ENABLED !== 'true') return false
  const row = await env.DB.prepare(
    `SELECT c.adult_content_enabled AS enabled, cs.identity_verified, cs.age_verified, cs.records_complete,
            cs.payouts_enabled, cs.adult_catalog_approved
       FROM creator c LEFT JOIN compliance_status cs ON cs.creator_id = c.id WHERE c.id = ?`,
  )
    .bind(creatorId)
    .first<Record<string, number | null>>()
  if (!row) return false
  return [row.enabled, row.identity_verified, row.age_verified, row.records_complete, row.payouts_enabled, row.adult_catalog_approved]
    .every((flag) => flag === 1)
}

export async function gateFor(env: Env, creatorId: string): Promise<GateOptions> {
  return { adultAllowed: await adultAllowed(env, creatorId) }
}

/** A published or retired version of an active creator's catalog, or null. */
export async function loadVersion(env: Env, creatorId: string, versionId: string | null): Promise<VersionRow | null> {
  const row = await env.DB.prepare(
    `SELECT v.id, v.version, v.status, v.content_json, c.current_published_version_id AS current_id, cr.display_name
       FROM catalog c
       JOIN creator cr ON cr.id = c.creator_id AND cr.status = 'active'
       JOIN catalog_version v ON v.catalog_id = c.id AND v.status IN ('published', 'retired')
      WHERE c.creator_id = ? AND v.id = COALESCE(?, c.current_published_version_id)`,
  )
    .bind(creatorId, versionId)
    .first<{ id: string; version: number; status: 'published' | 'retired'; content_json: string; current_id: string | null; display_name: string }>()
  if (!row) return null
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    content: normalizeContent(JSON.parse(row.content_json)),
    currentVersionId: row.current_id,
    creatorName: row.display_name,
  }
}

/** Maps a typed validation error to the API's stable error codes. */
export function selectionError(error: SelectionError): ApiError {
  if (error.code === 'personalised_video_resale_forbidden') {
    return new ApiError(422, 'personalised_video_resale_forbidden', { itemIds: error.itemIds })
  }
  const { code, ...detail } = error
  return new ApiError(422, 'selection_rejected', { reason: code, ...detail })
}

export type QuoteOutcome = { ok: true; quote: Quote } | { ok: false; error: string; detail: Record<string, unknown> }

export function quoteOutcome(version: VersionRow, draft: PricedDraft, gate: GateOptions): QuoteOutcome {
  const q = quote(version.content, version.id, draft, gate)
  if (q.ok) return { ok: true, quote: q.value }
  const err = selectionError(q.error)
  return { ok: false, error: err.code, detail: err.extra ?? {} }
}

/**
 * The quote under the draft's own version, plus, when the catalog has moved on,
 * the breakdown the new version would give. The draft is never re-priced
 * silently: the fan must accept the new version (doc 11 §8 Phase 2).
 */
export async function quoteWithStaleness(env: Env, creatorId: string, version: VersionRow, draft: PricedDraft, gate: GateOptions) {
  const pinned = quote(version.content, version.id, draft, gate)
  if (!pinned.ok) throw selectionError(pinned.error)
  const stale = version.currentVersionId !== null && version.currentVersionId !== version.id
  if (!stale) return { quote: pinned.value, stale: false as const }
  const current = await loadVersion(env, creatorId, version.currentVersionId)
  return {
    quote: pinned.value,
    stale: true as const,
    current: current
      ? { catalogVersionId: current.id, ...quoteOutcome(current, draft, gate) }
      : null,
  }
}

/* ------------------------------ Routes ------------------------------------ */

const rangeCache = new Map<string, Record<string, { min: number; max: number }>>()

function rangesFor(version: VersionRow, gate: GateOptions): Record<string, { min: number; max: number }> {
  const cacheKey = `${version.id}:${gate.adultAllowed}`
  const cached = rangeCache.get(cacheKey)
  if (cached) return cached
  const ranges: Record<string, { min: number; max: number }> = {}
  const setting = visibleContent(version.content, gate).categories.find((c) => c.key === 'setting')
  for (const item of setting?.items ?? []) {
    const range = priceRange(version.content, item.id, gate)
    if (range) ranges[item.id] = range
  }
  // Published versions never change, so their ranges can be kept.
  rangeCache.set(cacheKey, ranges)
  return ranges
}

/** GET /api/creators/:creatorId/catalog: what a fan may see, filtered on the server. */
export async function getCatalog(env: Env, creatorId: string): Promise<Response> {
  const version = await loadVersion(env, creatorId, null)
  if (!version) throw new ApiError(404, 'not_found')
  const gate = await gateFor(env, creatorId)
  const visible = visibleContent(version.content, gate)
  return json(200, {
    creatorId,
    creatorName: version.creatorName,
    catalogVersionId: version.id,
    version: version.version,
    currency: visible.currency,
    categories: visible.categories,
    templates: validTemplates(version.content, gate),
    defaults: defaultSelections(version.content, gate),
    ranges: rangesFor(version, gate),
    boundaries: renderBoundaries(version.content.boundaries, version.creatorName, gate),
    delivery: visible.delivery,
    pricingNote: visible.pricingNote,
  })
}

/**
 * POST /api/creators/:creatorId/quote: prices a set of choices without saving
 * anything, so a signed-out visitor still sees the server's figures. The body
 * can't carry prices: any key outside the list is rejected.
 */
export async function postQuote(request: Request, env: Env, creatorId: string): Promise<Response> {
  const body = await readJsonBody(request, 16_384)
  assertOnlyKeys(body, ['catalogVersionId', 'selections', 'budget'], 'invalid_quote')
  for (const key of ['catalogVersionId', 'selections', 'budget']) {
    if (!(key in body)) throw new ApiError(400, 'invalid_quote', { field: key })
  }
  if (typeof body.catalogVersionId !== 'string' || body.catalogVersionId.length > 64) {
    throw new ApiError(400, 'invalid_quote', { field: 'catalogVersionId' })
  }
  const priced: PricedDraft = {
    selections: parseSelections(body.selections, 'invalid_quote'),
    budget: parseBudget(body.budget, 'invalid_quote'),
    customRequest: null,
  }
  const version = await loadVersion(env, creatorId, body.catalogVersionId)
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')
  return json(200, await quoteWithStaleness(env, creatorId, version, priced, await gateFor(env, creatorId)))
}
