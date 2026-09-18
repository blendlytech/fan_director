import { effectiveLimits } from '../../shared/domain/boundaries.ts'
import type { BoundaryFlag, GateOptions } from '../../shared/domain/types.ts'
import type { FanIdentity } from './auth'
import { gateFor, loadVersion, quoteWithStaleness, selectionError, type VersionRow } from './catalog'
import { ApiError, json, readJsonBody } from './http'
import { limitLabel, recordBlock, screenDraft, verifiedPerformerCount } from './screening'
import type { Deps, DraftContent, Env } from './types'
import { validateSelections } from '../../shared/domain/validate.ts'
import { assertOnlyKeys, LIMITS, parseDraftContent, UUID } from './validation'

interface DraftRow {
  id: string
  creator_id: string
  catalog_version_id: string
  revision: number
  content_json: string
  boundary_flags_json: string | null
  updated_at: string
}

function draftOf(row: DraftRow) {
  const content = JSON.parse(row.content_json) as DraftContent
  return {
    id: row.id,
    creatorId: row.creator_id,
    catalogVersionId: row.catalog_version_id,
    revision: row.revision,
    ...content,
    boundaryFlags: row.boundary_flags_json ? (JSON.parse(row.boundary_flags_json) as BoundaryFlag[]) : [],
  }
}

/** The draft with its server quote. A draft saved before Phase 2 may no longer validate: it then says why. */
async function present(env: Env, row: DraftRow, status = 200): Promise<Response> {
  const draft = draftOf(row)
  const version = await loadVersion(env, row.creator_id, row.catalog_version_id)
  let pricing: Record<string, unknown> = { quote: null, stale: false }
  if (version) {
    try {
      pricing = await quoteWithStaleness(env, row.creator_id, version, draft, await gateFor(env, row.creator_id))
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
      pricing = { quote: null, stale: false, quoteError: { error: err.code, ...err.extra } }
    }
  }
  return json(status, { draft, ...pricing, updatedAt: row.updated_at })
}

async function loadOwned(env: Env, fanId: string, creatorId: string, draftId: string): Promise<DraftRow | null> {
  return env.DB.prepare(
    `SELECT id, creator_id, catalog_version_id, revision, content_json, boundary_flags_json, updated_at
       FROM draft WHERE id = ? AND fan_id = ? AND creator_id = ?`,
  )
    .bind(draftId, fanId, creatorId)
    .first<DraftRow>()
}

async function requireOwned(env: Env, fan: FanIdentity, creatorId: string, draftId: string): Promise<DraftRow> {
  if (!UUID.test(draftId)) throw new ApiError(404, 'not_found')
  const row = await loadOwned(env, fan.fanId, creatorId, draftId)
  // Another fan's draft, or one in another creator's boutique, looks exactly
  // like a draft that doesn't exist.
  if (!row) throw new ApiError(404, 'not_found')
  return row
}

export async function getDraft(env: Env, fan: FanIdentity, creatorId: string, draftId: string): Promise<Response> {
  return present(env, await requireOwned(env, fan, creatorId, draftId))
}

/** GET …/drafts/:id/quote: the same quote as the draft response, on its own. */
export async function getDraftQuote(env: Env, fan: FanIdentity, creatorId: string, draftId: string): Promise<Response> {
  const row = await requireOwned(env, fan, creatorId, draftId)
  const version = await loadVersion(env, creatorId, row.catalog_version_id)
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')
  const draft = draftOf(row)
  return json(200, await quoteWithStaleness(env, creatorId, version, draft, await gateFor(env, creatorId)))
}

/**
 * Everything a save must pass, in order: valid selections under the version,
 * the custom-request policy, the hard list (a block is recorded and answered)
 * and the creator's hard-no limits. Returns the ask-me flags to store.
 */
async function checkContent(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  version: VersionRow,
  creatorId: string,
  draftId: string,
  content: DraftContent,
  gate: GateOptions,
): Promise<BoundaryFlag[]> {
  const checked = validateSelections(version.content, content.selections, gate)
  if (!checked.ok) throw selectionError(checked.error)
  if (content.customRequest && version.content.boundaries.customRequestPolicy === 'decline') {
    throw new ApiError(422, 'custom_requests_not_accepted')
  }
  const screening = screenDraft(content, effectiveLimits(version.content.boundaries, gate), await verifiedPerformerCount(env, creatorId))
  if (screening.hardList) {
    await recordBlock(request, env, deps, fan, creatorId, version.creatorName, draftId, content, screening.hardList)
  }
  const hardNo = screening.hardNo[0]
  if (hardNo) {
    throw new ApiError(422, 'creator_limit_blocked', {
      limit: { kind: 'checklist', key: hardNo.limitKey },
      label: limitLabel(hardNo.limitKey),
      field: hardNo.source,
    })
  }
  return screening.flags
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

  const version = await loadVersion(env, creatorId, catalogVersionId)
  if (!version) {
    const creator = await env.DB.prepare(`SELECT id FROM creator WHERE id = ? AND status = 'active'`).bind(creatorId).first()
    if (!creator) throw new ApiError(404, 'not_found')
    throw new ApiError(422, 'catalog_version_mismatch')
  }
  const stale = version.currentVersionId !== version.id
  if (stale) {
    // A draft is never edited, or created, on an old version: the fan accepts the new one first.
    const current = expectedRevision === 0 ? null : await loadOwned(env, fan.fanId, creatorId, draftId)
    if (expectedRevision !== 0 && !current) throw new ApiError(404, 'not_found')
    throw new ApiError(409, 'catalog_version_stale', {
      currentCatalogVersionId: version.currentVersionId,
      ...(current ? { current: draftOf(current) } : {}),
    })
  }

  const gate = await gateFor(env, creatorId)
  const flags = await checkContent(request, env, deps, fan, version, creatorId, draftId, content, gate)
  const now = deps.now().toISOString()
  const contentJson = JSON.stringify(content)
  const flagsJson = JSON.stringify(flags)

  if (expectedRevision === 0) {
    const inserted = await env.DB.prepare(
      `INSERT INTO draft (id, fan_id, creator_id, catalog_version_id, revision, content_json, boundary_flags_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    )
      .bind(draftId, fan.fanId, creatorId, catalogVersionId, contentJson, flagsJson, now, now)
      .run()
    if (inserted.meta.changes === 1) return present(env, (await loadOwned(env, fan.fanId, creatorId, draftId))!)
  } else {
    // Atomic compare-and-set: owner, tenant and catalog version never change here.
    const updated = await env.DB.prepare(
      `UPDATE draft SET content_json = ?, boundary_flags_json = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND fan_id = ? AND creator_id = ? AND catalog_version_id = ? AND revision = ?`,
    )
      .bind(contentJson, flagsJson, now, draftId, fan.fanId, creatorId, catalogVersionId, expectedRevision)
      .run()
    if (updated.meta.changes === 1) return present(env, (await loadOwned(env, fan.fanId, creatorId, draftId))!)
  }

  const current = await loadOwned(env, fan.fanId, creatorId, draftId)
  // Someone else's id (or another boutique's) is indistinguishable from none.
  if (!current) throw new ApiError(404, 'not_found')
  if (current.catalog_version_id !== catalogVersionId) throw new ApiError(422, 'catalog_version_mismatch')
  const currentBody = (await (await present(env, current)).json()) as Record<string, unknown>
  throw new ApiError(409, 'revision_conflict', { current: currentBody.draft, quote: currentBody.quote ?? null })
}

/**
 * POST …/drafts/:id/accept-catalog-version: the fan accepts the new catalog
 * version's breakdown. The draft is checked again under the new version; if
 * it no longer fits, the typed error says why and nothing changes.
 */
export async function acceptCatalogVersion(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
  draftId: string,
): Promise<Response> {
  const row = await requireOwned(env, fan, creatorId, draftId)
  const body = await readJsonBody(request, 1_024)
  assertOnlyKeys(body, ['expectedRevision', 'catalogVersionId'], 'invalid_request')
  if (!Number.isInteger(body.expectedRevision) || typeof body.catalogVersionId !== 'string') {
    throw new ApiError(400, 'invalid_request')
  }
  const version = await loadVersion(env, creatorId, body.catalogVersionId)
  // Only the catalog's current version can be accepted.
  if (!version || version.currentVersionId !== version.id) throw new ApiError(422, 'catalog_version_mismatch')
  if (row.catalog_version_id === version.id) throw new ApiError(409, 'already_current')

  const content = JSON.parse(row.content_json) as DraftContent
  const flags = await checkContent(request, env, deps, fan, version, creatorId, draftId, content, await gateFor(env, creatorId))
  const updated = await env.DB.prepare(
    `UPDATE draft SET catalog_version_id = ?, boundary_flags_json = ?, revision = revision + 1, updated_at = ?
      WHERE id = ? AND fan_id = ? AND creator_id = ? AND revision = ?`,
  )
    .bind(version.id, JSON.stringify(flags), deps.now().toISOString(), draftId, fan.fanId, creatorId, body.expectedRevision)
    .run()
  const current = (await loadOwned(env, fan.fanId, creatorId, draftId))!
  if (updated.meta.changes !== 1) throw new ApiError(409, 'revision_conflict', { current: draftOf(current) })
  return present(env, current)
}
