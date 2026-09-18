import { authEnabled } from './auth/clerk'

/**
 * What this build can really do (doc 11 §7, "honest copy in staging"). The
 * public demo has no backend, so every capability is off there and its copy
 * and figures stay exactly as they are.
 */
export const capabilities = {
  /** Read Maya's catalog and quotes from the staging API (Phase 2). */
  serverCatalog: authEnabled,
  /** Saving drafts is not wired into the screens yet (design 18, after Gate 2). */
  persistence: false,
} as const
