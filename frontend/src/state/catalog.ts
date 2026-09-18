import { createContext, useContext } from 'react'
import { PILOT_CREATOR_ID, PILOT_CREATOR_NAME, PILOT_V1, PILOT_VERSION_ID } from '../../../shared/catalog/pilot-v1.ts'
import type { RenderedBoundaries } from '../../../shared/domain/boundaries.ts'
import { normalizeContent } from '../../../shared/domain/catalog.ts'
import { catalogView, type CatalogView } from '../domain/sceneCard'

export const CREATOR_ID = PILOT_CREATOR_ID

/** The public demo: Maya's bundled catalog, with the demo's own ranges. */
export const DEMO_VIEW = catalogView(PILOT_V1, PILOT_VERSION_ID, { creatorName: PILOT_CREATOR_NAME, ranges: 'demo' })

/**
 * Staging before the server answers: the same bundled catalog, with ranges
 * derived exactly as the server derives them, so nothing changes on screen
 * when the server's copy replaces it.
 */
export const STAGING_INITIAL_VIEW = catalogView(PILOT_V1, PILOT_VERSION_ID, { creatorName: PILOT_CREATOR_NAME, ranges: 'derived' })

/** Builds the view from `GET /api/creators/:id/catalog`. Throws on anything unexpected. */
export function viewFromServer(body: unknown): CatalogView {
  const b = body as {
    catalogVersionId?: unknown
    creatorName?: unknown
    categories?: unknown
    delivery?: unknown
    templates?: unknown
    pricingNote?: unknown
    ranges?: unknown
    boundaries?: unknown
  }
  if (typeof b?.catalogVersionId !== 'string' || typeof b.creatorName !== 'string' || !Array.isArray(b.categories)) {
    throw new Error('Unexpected catalog response')
  }
  if (typeof b.ranges !== 'object' || b.ranges === null || typeof b.boundaries !== 'object' || b.boundaries === null) {
    throw new Error('Unexpected catalog response')
  }
  // The server already removed what a fan may not see; the rendered boundaries come from its renderer.
  const content = normalizeContent({ categories: b.categories, delivery: b.delivery, templates: b.templates, pricingNote: b.pricingNote })
  return catalogView(content, b.catalogVersionId, {
    creatorName: b.creatorName,
    ranges: b.ranges as Record<string, { min: number; max: number }>,
    boundaries: b.boundaries as RenderedBoundaries,
  })
}

export type CatalogValue = {
  view: CatalogView
  /** 'bundled' until the staging server's catalog arrives; always 'bundled' in the demo. */
  source: 'bundled' | 'server'
}

export const CatalogContext = createContext<CatalogValue | null>(null)

export function useCatalog(): CatalogValue {
  const value = useContext(CatalogContext)
  if (!value) throw new Error('useCatalog must be used inside <CatalogProvider>')
  return value
}
