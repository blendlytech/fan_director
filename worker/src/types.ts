export interface Env {
  DB: D1Database
  ASSETS: Fetcher

  ENVIRONMENT: 'development' | 'staging' | 'test'
  /** The site's own origin, e.g. https://fan-director-studio-staging.example.workers.dev */
  APP_ORIGIN: string
  /** Clerk Frontend API URL, the session token's `iss`. */
  CLERK_ISSUER: string
  /** Comma-separated origins accepted in the session token's `azp`. */
  CLERK_AUTHORIZED_PARTIES: string
  /** Switches that stay "false" in every deployed environment (doc 11 §5.4). */
  AI_ENABLED: string
  ADULT_CATALOG_ENABLED: string

  // Secrets, set with `wrangler secret put` (locally: worker/.dev.vars).
  /** Clerk instance public key (PEM, SPKI) for networkless session verification. */
  CLERK_JWT_KEY: string
  /** Clerk Backend API secret key. */
  CLERK_SECRET_KEY: string
  /** HMAC-SHA256 key for unsubscribe tokens, at least 32 random bytes, base64. */
  UNSUBSCRIBE_SIGNING_KEY: string
}

/** The parts of Clerk's Backend API the Worker uses. Mocked in tests. */
export interface ClerkBackend {
  getUser(userId: string): Promise<ClerkUser | null>
  getSession(sessionId: string): Promise<ClerkSession | null>
  /** Sessions for the user that are active or pending. */
  listLiveSessions(userId: string): Promise<ClerkSession[]>
}

export interface ClerkUser {
  id: string
  primaryEmailAddressId: string | null
  emailAddresses: { id: string; emailAddress: string; verified: boolean }[]
  totpEnabled: boolean
  backupCodeEnabled: boolean
  banned: boolean
  locked: boolean
  /** Unix milliseconds. */
  createdAt: number
}

export interface ClerkSession {
  id: string
  userId: string
  status: string
  /** Unix milliseconds. */
  createdAt: number
}

export interface Deps {
  clerk: ClerkBackend
  now: () => Date
}

export interface DraftSelection {
  itemId: string
  qty: number
}

/** DraftV2 as saved in Phase 1 (doc 11 §6). boundaryFlags are server-owned. */
export interface DraftContent {
  selections: DraftSelection[]
  fanDisplayName: string | null
  customRequest: string | null
  fanScript: string | null
  notes: { id: number; text: string }[]
  budget: number | null
}
