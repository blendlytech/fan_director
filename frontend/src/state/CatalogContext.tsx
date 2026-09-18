import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { capabilities } from '../config'
import { CatalogContext, CREATOR_ID, DEMO_VIEW, STAGING_INITIAL_VIEW, viewFromServer, type CatalogValue } from './catalog'

/**
 * Maya's catalog for the fan screens. The demo uses the bundled copy. Staging
 * starts from the same bundled copy (so there is no loading state to design)
 * and switches to the server's published version when it arrives. If the
 * request fails, the bundled copy stays, and the Scene Card keeps its local
 * preview (doc 11 §7; failure states wait for designs 17–18).
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<CatalogValue>(() => ({
    view: capabilities.serverCatalog ? STAGING_INITIAL_VIEW : DEMO_VIEW,
    source: 'bundled',
  }))

  useEffect(() => {
    if (!capabilities.serverCatalog) return
    const controller = new AbortController()
    fetch(`/api/creators/${CREATOR_ID}/catalog`, { signal: controller.signal, credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`catalog ${res.status}`))))
      .then((body) => setValue({ view: viewFromServer(body), source: 'server' }))
      .catch(() => {
        // Keep the bundled catalog; nothing on screen claims otherwise.
      })
    return () => controller.abort()
  }, [])

  const memo = useMemo(() => value, [value])
  return <CatalogContext.Provider value={memo}>{children}</CatalogContext.Provider>
}
