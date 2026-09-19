import { authEnabled } from './auth/clerk'

/**
 * What this build can really do (doc 11 §7, "honest copy in staging"). The
 * public demo has no backend, so every capability is off there and its copy
 * and figures stay exactly as they are.
 */
export const capabilities = {
  /** Read Maya's catalog and quotes from the staging API (Phase 2). */
  serverCatalog: authEnabled,
  /** Signed-in fans' drafts save on every change (design 18, owner-approved 2026-09-18). */
  persistence: authEnabled,
  /** The live AI Director (design 17). The server still decides whether AI is on. */
  aiDirector: authEnabled,
} as const
